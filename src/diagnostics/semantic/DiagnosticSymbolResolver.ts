import * as vscode from 'vscode';
import { ProjectSymbolIndex } from '../../completion/projectSymbolIndex';
import type {
    FileGlobalSummary,
    FunctionSummary,
    IncludeDirective,
    MacroDefinitionSummary,
    MacroReference,
    SemanticSymbolSummary,
    TypeDefinitionSummary
} from '../../semantic/documentSemanticTypes';
import type { DocumentAnalysisService } from '../../semantic/documentAnalysisService';
import type { SemanticSnapshot } from '../../semantic/semanticSnapshot';
import type { CallableDoc, CallableSignature } from '../../language/documentation/types';
import type { WorkspaceDocumentPathSupport } from '../../language/shared/WorkspaceDocumentPathSupport';
import type { EfunDocsManager } from '../../efunDocs';
import type { HeaderOwnerContextService } from '../../language/shared/HeaderOwnerContextService';

export interface DiagnosticCallableSignature {
    name: string;
    requiredParameterCount: number;
    maxParameterCount?: number;
    isVariadic: boolean;
    source: 'local' | 'include' | 'inherited' | 'efun' | 'simul-efun';
}

export interface VisibleDiagnosticSymbols {
    functions: FunctionSummary[];
    symbols: SemanticSymbolSummary[];
    fileGlobals: FileGlobalSummary[];
    types: TypeDefinitionSummary[];
    macros: MacroDefinitionSummary[];
    macroReferences: MacroReference[];
    callableSignatures: DiagnosticCallableSignature[];
    hasUnresolvedDependencies: boolean;
}

export interface DiagnosticSymbolResolver {
    resolveVisibleSymbols(
        document: vscode.TextDocument,
        semantic: SemanticSnapshot
    ): Promise<VisibleDiagnosticSymbols> | VisibleDiagnosticSymbols;
}

type DiagnosticResolverAnalysisService = Pick<
    DocumentAnalysisService,
    'getSemanticSnapshot' | 'getBestAvailableSemanticSnapshot'
>;

export interface DefaultDiagnosticSymbolResolverOptions {
    analysisService: DiagnosticResolverAnalysisService;
    pathSupport: WorkspaceDocumentPathSupport;
    projectSymbolIndex: ProjectSymbolIndex;
    efunDocsManager?: Pick<
        EfunDocsManager,
        | 'getAllFunctions'
        | 'getAllSimulatedFunctions'
        | 'getStandardCallableDoc'
        | 'getSimulatedDoc'
    > & Partial<Pick<EfunDocsManager, 'ensureWorkspaceStateCurrent'>>;
    headerOwnerContextResolver?: Pick<HeaderOwnerContextService, 'resolveOwnerContext'>;
}

interface DependencySymbolCollection {
    functions: FunctionSummary[];
    fileGlobals: FileGlobalSummary[];
    types: TypeDefinitionSummary[];
}

interface DependencyIndexResult {
    hasUnresolved: boolean;
    included: DependencySymbolCollection;
    inherited: DependencySymbolCollection;
}

export class DefaultDiagnosticSymbolResolver implements DiagnosticSymbolResolver {
    public constructor(private readonly options: DefaultDiagnosticSymbolResolverOptions) {}

    public async resolveVisibleSymbols(
        document: vscode.TextDocument,
        semantic: SemanticSnapshot
    ): Promise<VisibleDiagnosticSymbols> {
        const dependencyState = await this.indexDocument(document, semantic, new Set<string>(), 'root');
        const uri = document.uri.toString();
        const included = this.options.projectSymbolIndex.getIncludedSymbols(uri);
        const inherited = this.options.projectSymbolIndex.getInheritedSymbols(uri);
        const efunSignatures = await this.collectEfunSignatures(document);
        const headerOwnerContext = await this.options.headerOwnerContextResolver?.resolveOwnerContext(document);
        const visibleFunctions = dedupeFunctions([
            ...semantic.exportedFunctions,
            ...(headerOwnerContext?.functions ?? []),
            ...included.functions,
            ...dependencyState.included.functions,
            ...inherited.functions,
            ...dependencyState.inherited.functions
        ]);
        const visibleFileGlobals = dedupeFileGlobals([
            ...(semantic.fileGlobals ?? []),
            ...(headerOwnerContext?.fileGlobals ?? []),
            ...included.fileGlobals,
            ...dependencyState.included.fileGlobals
        ]);
        const visibleTypes = dedupeTypes([
            ...semantic.typeDefinitions,
            ...(headerOwnerContext?.types ?? []),
            ...included.types,
            ...dependencyState.included.types,
            ...inherited.types,
            ...dependencyState.inherited.types
        ]);

        return {
            functions: visibleFunctions,
            symbols: semantic.symbols,
            fileGlobals: visibleFileGlobals,
            types: visibleTypes,
            macros: dedupeMacros([
                ...(semantic.macroDefinitions ?? []),
                ...(headerOwnerContext?.macros ?? [])
            ]),
            macroReferences: semantic.macroReferences,
            callableSignatures: [
                ...visibleFunctions.map((summary) => toSignature(summary, summary.origin)),
                ...efunSignatures
            ],
            hasUnresolvedDependencies: dependencyState.hasUnresolved || Boolean(headerOwnerContext?.isAmbiguous)
        };
    }

    private async indexDocument(
        document: vscode.TextDocument,
        semantic: SemanticSnapshot,
        visitedUris: Set<string>,
        relation: 'root' | 'include' | 'inherited'
    ): Promise<DependencyIndexResult> {
        if (visitedUris.has(semantic.uri)) {
            return emptyDependencyIndexResult();
        }

        visitedUris.add(semantic.uri);

        let hasUnresolved = false;
        const included = emptyDependencySymbolCollection();
        const inherited = emptyDependencySymbolCollection();
        const workspaceRoot = this.options.pathSupport.getWorkspaceFolderRoot(document);
        const resolvedIncludes = await this.resolveIncludeStatements(document, semantic.includeStatements, workspaceRoot);
        this.options.projectSymbolIndex.updateFromSemanticSnapshot({
            ...semantic,
            includeStatements: resolvedIncludes.includeStatements
        });
        hasUnresolved = hasUnresolved || resolvedIncludes.hasUnresolved;

        for (const includeStatement of resolvedIncludes.includeStatements) {
            if (!includeStatement.resolvedUri) {
                continue;
            }

            const childResult = await this.indexDependencyFile(
                vscode.Uri.parse(includeStatement.resolvedUri).fsPath,
                visitedUris,
                relation === 'inherited' ? 'inherited' : 'include'
            );
            hasUnresolved = hasUnresolved || childResult.hasUnresolved;
            mergeCollection(included, childResult.included);
            mergeCollection(inherited, childResult.inherited);
        }

        for (const inheritStatement of semantic.inheritStatements) {
            const inheritedFile = this.options.pathSupport.resolveInheritedFilePath(
                document,
                inheritStatement.value,
                workspaceRoot
            );
            if (!inheritedFile || !this.options.pathSupport.fileExists(inheritedFile)) {
                hasUnresolved = true;
                continue;
            }

            const childResult = await this.indexDependencyFile(inheritedFile, visitedUris, 'inherited');
            hasUnresolved = hasUnresolved || childResult.hasUnresolved;
            mergeCollection(inherited, childResult.inherited);
        }

        if (relation === 'include') {
            included.functions.push(...semantic.exportedFunctions.map((summary) => ({ ...summary, origin: 'include' as const })));
            included.fileGlobals.push(...(semantic.fileGlobals ?? []));
            included.types.push(...semantic.typeDefinitions);
        } else if (relation === 'inherited') {
            inherited.functions.push(...semantic.exportedFunctions.map((summary) => ({ ...summary, origin: 'inherited' as const })));
            inherited.types.push(...semantic.typeDefinitions);
        }

        return { hasUnresolved, included, inherited };
    }

    private async resolveIncludeStatements(
        document: vscode.TextDocument,
        includeStatements: IncludeDirective[],
        workspaceRoot: string | undefined
    ): Promise<{ includeStatements: IncludeDirective[]; hasUnresolved: boolean }> {
        let hasUnresolved = false;
        const resolvedStatements: IncludeDirective[] = [];

        for (const includeStatement of includeStatements) {
            if (includeStatement.resolvedUri) {
                resolvedStatements.push({ ...includeStatement });
                continue;
            }

            const includeFiles = await this.options.pathSupport.resolveIncludeFilePaths(
                document,
                includeStatement.value,
                includeStatement.isSystemInclude,
                workspaceRoot
            );
            const includeFile = includeFiles.find((filePath) => this.options.pathSupport.fileExists(filePath));
            if (!includeFile) {
                hasUnresolved = true;
                resolvedStatements.push({ ...includeStatement });
                continue;
            }

            resolvedStatements.push({
                ...includeStatement,
                resolvedUri: vscode.Uri.file(includeFile).toString()
            });
        }

        return {
            includeStatements: resolvedStatements,
            hasUnresolved
        };
    }

    private async indexDependencyFile(
        filePath: string,
        visitedUris: Set<string>,
        relation: 'include' | 'inherited'
    ): Promise<DependencyIndexResult> {
        const dependencyDocument = await this.options.pathSupport.tryOpenTextDocument(filePath);
        if (!dependencyDocument) {
            return unresolvedDependencyIndexResult();
        }

        let dependencySemantic: SemanticSnapshot;
        try {
            dependencySemantic = this.options.analysisService.getSemanticSnapshot(dependencyDocument, false);
        } catch {
            try {
                dependencySemantic = this.options.analysisService.getBestAvailableSemanticSnapshot(dependencyDocument);
            } catch {
                return unresolvedDependencyIndexResult();
            }
        }

        if (dependencySemantic.degraded) {
            return unresolvedDependencyIndexResult();
        }

        return this.indexDocument(dependencyDocument, dependencySemantic, visitedUris, relation);
    }

    private async collectEfunSignatures(document: vscode.TextDocument): Promise<DiagnosticCallableSignature[]> {
        const manager = this.options.efunDocsManager;
        if (!manager) {
            return [];
        }

        await manager.ensureWorkspaceStateCurrent?.(document);

        const signatures: DiagnosticCallableSignature[] = [];
        for (const name of manager.getAllFunctions()) {
            signatures.push(...fromCallableDoc(name, manager.getStandardCallableDoc(name), 'efun'));
        }
        for (const name of manager.getAllSimulatedFunctions(document)) {
            signatures.push(...fromCallableDoc(name, manager.getSimulatedDoc(name, document), 'simul-efun'));
        }

        return signatures;
    }
}

function toSignature(
    summary: FunctionSummary,
    source: DiagnosticCallableSignature['source']
): DiagnosticCallableSignature {
    const requiredParameterCount = summary.requiredParameterCount
        ?? summary.parameters.filter((parameter) => !parameter.hasDefaultValue && !parameter.isVariadic).length;
    const maxParameterCount = summary.maxParameterCount
        ?? (summary.isVariadic || summary.parameters.some((parameter) => parameter.isVariadic)
            ? undefined
            : summary.parameters.length);

    return {
        name: summary.name,
        requiredParameterCount,
        maxParameterCount,
        isVariadic: Boolean(summary.isVariadic || summary.parameters.some((parameter) => parameter.isVariadic)),
        source
    };
}

function emptyDependencySymbolCollection(): DependencySymbolCollection {
    return {
        functions: [],
        fileGlobals: [],
        types: []
    };
}

function emptyDependencyIndexResult(): DependencyIndexResult {
    return {
        hasUnresolved: false,
        included: emptyDependencySymbolCollection(),
        inherited: emptyDependencySymbolCollection()
    };
}

function unresolvedDependencyIndexResult(): DependencyIndexResult {
    return {
        ...emptyDependencyIndexResult(),
        hasUnresolved: true
    };
}

function mergeCollection(
    target: DependencySymbolCollection,
    source: DependencySymbolCollection
): void {
    target.functions.push(...source.functions);
    target.fileGlobals.push(...source.fileGlobals);
    target.types.push(...source.types);
}

function dedupeFunctions(functions: FunctionSummary[]): FunctionSummary[] {
    const seen = new Set<string>();
    return functions.filter((summary) => {
        const key = `${summary.origin}:${summary.sourceUri}:${summary.name}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

function dedupeFileGlobals(fileGlobals: FileGlobalSummary[]): FileGlobalSummary[] {
    const seen = new Set<string>();
    return fileGlobals.filter((summary) => {
        const key = `${summary.sourceUri}:${summary.name}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

function dedupeTypes(types: TypeDefinitionSummary[]): TypeDefinitionSummary[] {
    const seen = new Set<string>();
    return types.filter((summary) => {
        const key = `${summary.sourceUri}:${summary.name}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

function dedupeMacros(macros: MacroDefinitionSummary[]): MacroDefinitionSummary[] {
    const seen = new Set<string>();
    return macros.filter((summary) => {
        const key = `${summary.sourceUri}:${summary.name}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

function fromCallableDoc(
    name: string,
    doc: CallableDoc | undefined,
    source: 'efun' | 'simul-efun'
): DiagnosticCallableSignature[] {
    if (!doc) {
        return [];
    }

    if (doc.signatures.length === 0) {
        return [createUnknownCallableSignature(name, source)];
    }

    return doc.signatures.map((signature) => fromCallableSignature(name, signature, source));
}

function createUnknownCallableSignature(
    name: string,
    source: 'efun' | 'simul-efun'
): DiagnosticCallableSignature {
    return {
        name,
        requiredParameterCount: 0,
        maxParameterCount: undefined,
        isVariadic: true,
        source
    };
}

function fromCallableSignature(
    name: string,
    signature: CallableSignature,
    source: 'efun' | 'simul-efun'
): DiagnosticCallableSignature {
    if (signature.arity) {
        return {
            name,
            requiredParameterCount: signature.arity.min,
            maxParameterCount: signature.arity.max === null ? undefined : signature.arity.max,
            isVariadic: signature.arity.max === null,
            source
        };
    }

    const requiredParameterCount = signature.parameters.filter(
        (parameter) => !isOptionalCallableParameter(parameter) && !parameter.variadic
    ).length;
    const hasVariadicParameter = signature.isVariadic
        || signature.parameters.some((parameter) => parameter.variadic);

    return {
        name,
        requiredParameterCount,
        maxParameterCount: hasVariadicParameter ? undefined : signature.parameters.length,
        isVariadic: hasVariadicParameter,
        source
    };
}

function isOptionalCallableParameter(parameter: CallableSignature['parameters'][number]): boolean {
    return parameter.optional === true;
}
