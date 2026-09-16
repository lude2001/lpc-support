import * as path from 'path';
import * as vscode from 'vscode';
import type { BundledEfunDocsProvider } from '../../efun/BundledEfunDocsProvider';
import type { FunctionDocLookup, FunctionDocSourceGroup } from '../../efun/FunctionDocLookupTypes';
import type { LanguageWorkspaceProjectConfig } from '../../language/contracts/LanguageWorkspaceContext';
import { DocCommentTagParser } from '../../language/documentation/DocCommentTagParser';
import type {
    CallableDoc,
    CallableParameter,
    CallableSignature,
    DocumentRange
} from '../../language/documentation/types';
import type { LspClientManager } from '../../lsp/client/LspClientManager';
import type { FunctionDocumentationLookupProvider } from './FunctionDocumentationSnapshotService';

interface RustFunctionDocumentationEntry {
    name: string;
    signature: string;
    parameters: string[];
    structuredSignature?: RustCallableSignature;
    documentation?: string;
    documentationRange?: DocumentRange;
    structuredDocumentation?: RustCallableDocumentation;
    returnObjects: string[];
    range: DocumentRange;
    selectionRange: DocumentRange;
    hasBody: boolean;
}

interface RustCallableSignature {
    label: string;
    rawSyntax: string;
    returnType?: string;
    modifiers: string[];
    parameters: Array<{
        label: string;
        name?: string;
        typeName?: string;
        passingMode: 'value' | 'reference';
        arrayDepth: number;
        variadic: boolean;
        isVariadicCollector: boolean;
        optional: boolean;
        defaultValueText?: string;
    }>;
    functionVarargs: boolean;
    trueVariadic: boolean;
    variadicKind: 'none' | 'permissiveModifier' | 'collectedTail';
    variadicParameterIndex?: number;
    declaredArity: number;
    minimumArity: number;
    maximumArity: number | null;
}

interface RustCallableDocumentation {
    rawText: string;
    summary?: string;
    parameters: Array<{
        typeName?: string;
        name: string;
        description?: string;
    }>;
    returns?: {
        typeName?: string;
        description?: string;
    };
    details?: string;
    note?: string;
    returnObjects: string[];
    extraTags: Array<{ name: string; value?: string }>;
    issues: Array<{
        code: 'orphan-param-tag' | 'stale-parameter-name' | 'duplicate-param-tag' | 'duplicate-return-tag';
        parameterName?: string;
    }>;
}

interface RustFunctionDocumentationGroup {
    uri: string;
    sourceKind: 'local' | 'inherit' | 'include';
    depth: number;
    parentUri?: string;
    entries: RustFunctionDocumentationEntry[];
}

interface RustFunctionDocumentationLookup {
    currentFile: RustFunctionDocumentationGroup;
    inheritedGroups: RustFunctionDocumentationGroup[];
    includeGroups: RustFunctionDocumentationGroup[];
}

/**
 * Bridges the Rust semantic snapshot into the existing documentation webview model.
 * This adapter only shapes already-parsed data; it never reparses LPC source in TS.
 */
export class RustFunctionDocumentationLookupProvider implements FunctionDocumentationLookupProvider {
    private readonly tagParser = new DocCommentTagParser();
    private readonly simulatedDocs = new Map<string, Map<string, CallableDoc>>();

    public constructor(
        private readonly manager: LspClientManager,
        private readonly bundledEfuns: Pick<BundledEfunDocsProvider, 'getAllFunctions' | 'getStandardCallableDoc'>
    ) {}

    public async getFunctionDocLookupForDocument(document: vscode.TextDocument): Promise<FunctionDocLookup> {
        const lookup = await this.manager.sendRequest<RustFunctionDocumentationLookup>(
            'lpc/functionDocumentation',
            { textDocument: { uri: document.uri.toString() } }
        );
        if (!lookup) {
            throw new Error('Rust language server did not return function documentation data');
        }
        return {
            currentFile: this.materializeGroup(lookup.currentFile),
            inheritedGroups: lookup.inheritedGroups.map((group) => this.materializeGroup(group)),
            includeGroups: lookup.includeGroups.map((group) => this.materializeGroup(group))
        };
    }

    public getAllFunctions(): string[] {
        return this.bundledEfuns.getAllFunctions();
    }

    public getStandardCallableDoc(name: string): CallableDoc | undefined {
        return this.bundledEfuns.getStandardCallableDoc(name);
    }

    public getAllSimulatedFunctions(
        document?: vscode.TextDocument,
        projectConfig?: LanguageWorkspaceProjectConfig
    ): string[] {
        return [...(this.simulatedDocs.get(workspaceKey(document, projectConfig))?.keys() ?? [])];
    }

    public getSimulatedDoc(
        name: string,
        document?: vscode.TextDocument,
        projectConfig?: LanguageWorkspaceProjectConfig
    ): CallableDoc | undefined {
        return this.simulatedDocs.get(workspaceKey(document, projectConfig))?.get(name);
    }

    public async ensureWorkspaceStateCurrent(
        document?: vscode.TextDocument,
        projectConfig?: LanguageWorkspaceProjectConfig
    ): Promise<void> {
        const key = workspaceKey(document, projectConfig);
        if (this.simulatedDocs.has(key)) {
            return;
        }
        const docs = new Map<string, CallableDoc>();
        this.simulatedDocs.set(key, docs);
        const entryCandidates = resolveSimulatedEfunCandidates(document, projectConfig);
        for (const entryFile of entryCandidates) {
            const lookup = await this.manager.sendRequest<RustFunctionDocumentationLookup>(
                'lpc/functionDocumentation',
                { textDocument: { uri: vscode.Uri.file(entryFile).toString() } }
            );
            if (!lookup) {
                continue;
            }
            for (const group of [lookup.currentFile, ...lookup.inheritedGroups, ...lookup.includeGroups]) {
                const filePath = vscode.Uri.parse(group.uri).fsPath;
                for (const entry of group.entries) {
                    const callable = this.materializeEntry(group, filePath, entry);
                    docs.set(entry.name, {
                        ...callable,
                        sourceKind: 'simulEfun',
                        declarationKind: 'external'
                    });
                }
            }
            break;
        }
    }

    private materializeGroup(group: RustFunctionDocumentationGroup): FunctionDocSourceGroup {
        const filePath = vscode.Uri.parse(group.uri).fsPath;
        const entries = group.entries.map((entry) => this.materializeEntry(group, filePath, entry));
        return {
            source: path.basename(filePath),
            filePath,
            sourceKind: group.sourceKind,
            entries,
            docs: new Map(entries.map((entry) => [entry.name, entry])),
            depth: group.depth,
            parentFilePath: group.parentUri ? vscode.Uri.parse(group.parentUri).fsPath : undefined
        };
    }

    private materializeEntry(
        group: RustFunctionDocumentationGroup,
        filePath: string,
        entry: RustFunctionDocumentationEntry
    ): CallableDoc {
        const returnType = extractReturnType(entry.signature, entry.name);
        const structured = entry.structuredDocumentation;
        const parsedTags = structured
            ? undefined
            : this.tagParser.parse(
                entry.documentation && entry.documentationRange
                    ? { kind: 'javadoc', text: entry.documentation, range: entry.documentationRange }
                    : undefined,
                returnType
            );
        const documentedParameters = structured
            ? structured.parameters.map((parameter) => ({
                name: parameter.name,
                type: parameter.typeName,
                description: parameter.description
            }))
            : parsedTags!.params;
        const signature = materializeSignature(entry, returnType, documentedParameters);
        return {
            name: entry.name,
            declarationKey: `${group.uri}#${entry.range.start.line}:${entry.range.start.character}-${entry.range.end.line}:${entry.range.end.character}`,
            signatures: [signature],
            summary: structured?.summary ?? parsedTags?.summary,
            details: structured?.details ?? parsedTags?.details,
            note: structured?.note ?? parsedTags?.note,
            returns: structured?.returns
                ? {
                    type: structured.returns.typeName,
                    description: structured.returns.description
                }
                : parsedTags?.returns,
            returnObjects: structured?.returnObjects ?? parsedTags?.returnObjects ?? entry.returnObjects,
            sourceKind: group.sourceKind,
            sourcePath: filePath,
            sourceRange: entry.range,
            selectionRange: entry.selectionRange,
            attachedCommentRange: entry.documentationRange,
            declarationKind: entry.hasBody ? 'implementation' : 'prototype',
            modifiers: entry.structuredSignature?.modifiers ?? extractModifiers(entry.signature),
            documentationIssues: structured?.issues ?? buildDocumentationIssues(signature, parsedTags!)
        };
    }
}

function materializeSignature(
    entry: RustFunctionDocumentationEntry,
    returnType: string | undefined,
    documentedParameters: Array<{ name: string; type?: string; description?: string }>
): CallableSignature {
    const parameters = entry.structuredSignature
        ? entry.structuredSignature.parameters.map((parameter, index) => ({
            name: parameter.name ?? `arg${index + 1}`,
            sourceName: parameter.name,
            type: parameter.typeName,
            passingMode: parameter.passingMode,
            arrayDepth: parameter.arrayDepth,
            isVariadicCollector: parameter.isVariadicCollector || undefined,
            optional: parameter.optional || undefined,
            variadic: parameter.variadic || undefined,
            defaultValueText: parameter.defaultValueText
        }))
        : entry.parameters.map((parameter, index) => parseParameter(parameter, index));
    for (const documented of documentedParameters) {
        const parameter = parameters.find((candidate) => candidate.name === documented.name);
        if (parameter) {
            parameter.type ??= documented.type;
            parameter.description = documented.description;
        }
    }
    const isFunctionVarargs = entry.structuredSignature?.functionVarargs
        ?? extractModifiers(entry.signature).includes('varargs');
    const isVariadic = entry.structuredSignature?.trueVariadic
        ?? parameters.some((parameter) => parameter.variadic === true);
    return {
        label: entry.structuredSignature?.label ?? entry.signature,
        returnType: entry.structuredSignature?.returnType ?? returnType,
        parameters,
        isVariadic,
        arity: entry.structuredSignature
            ? {
                min: entry.structuredSignature.minimumArity,
                max: entry.structuredSignature.maximumArity
            }
            : isFunctionVarargs
                ? { min: 0, max: null }
                : undefined,
        rawSyntax: entry.structuredSignature?.rawSyntax ?? entry.signature
    };
}

function parseParameter(source: string, index: number): CallableParameter {
    const withoutDefault = source.replace(/\s*=\s*[\s\S]*$/u, '').trim();
    const variadic = /\.\.\./u.test(withoutDefault);
    const normalized = withoutDefault.replace(/\.\.\./gu, '').trim();
    const nameMatch = normalized.match(/([A-Za-z_][A-Za-z0-9_]*)\s*$/u);
    const name = nameMatch?.[1] ?? `arg${index + 1}`;
    const type = nameMatch
        ? normalized.slice(0, nameMatch.index).trim().replace(/\s+/gu, ' ') || undefined
        : undefined;
    return {
        name,
        type,
        optional: withoutDefault !== source.trim() || undefined,
        variadic: variadic || undefined
    };
}

function extractReturnType(signature: string, functionName: string): string | undefined {
    const nameIndex = signature.search(new RegExp(`\\b${escapeRegExp(functionName)}\\s*\\(`, 'u'));
    if (nameIndex < 0) {
        return undefined;
    }
    const modifiers = new Set(['private', 'protected', 'public', 'static', 'nomask', 'varargs', 'nosave']);
    const tokens = signature.slice(0, nameIndex).trim().split(/\s+/u);
    while (tokens.length > 0 && modifiers.has(tokens[0])) {
        tokens.shift();
    }
    return tokens.join(' ') || undefined;
}

function extractModifiers(signature: string): string[] {
    const supported = new Set(['private', 'protected', 'public', 'static', 'nomask', 'varargs', 'nosave']);
    return signature.trim().split(/\s+/u).filter((token) => supported.has(token));
}

function buildDocumentationIssues(
    signature: CallableSignature,
    parsed: ReturnType<DocCommentTagParser['parse']>
): CallableDoc['documentationIssues'] {
    const issues: NonNullable<CallableDoc['documentationIssues']> = [];
    const parameterNames = new Set(signature.parameters.map((parameter) => parameter.name));
    const seen = new Set<string>();
    for (const parameter of parsed.params) {
        if (seen.has(parameter.name)) {
            issues.push({ code: 'duplicate-param-tag', parameterName: parameter.name });
        }
        seen.add(parameter.name);
        if (!parameterNames.has(parameter.name)) {
            issues.push({ code: 'stale-parameter-name', parameterName: parameter.name });
        }
    }
    for (let index = 0; index < parsed.malformedParamTagCount; index += 1) {
        issues.push({ code: 'orphan-param-tag' });
    }
    for (let index = 0; index < parsed.duplicateReturnTagCount; index += 1) {
        issues.push({ code: 'duplicate-return-tag' });
    }
    return issues.length > 0 ? issues : undefined;
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function workspaceKey(
    document?: vscode.TextDocument,
    projectConfig?: LanguageWorkspaceProjectConfig
): string {
    return vscode.workspace.getWorkspaceFolder(document?.uri ?? vscode.Uri.file(projectConfig?.projectConfigPath ?? ''))
        ?.uri.fsPath
        ?? projectConfig?.projectConfigPath
        ?? '<no-workspace>';
}

function resolveSimulatedEfunCandidates(
    document?: vscode.TextDocument,
    projectConfig?: LanguageWorkspaceProjectConfig
): string[] {
    const configured = projectConfig?.resolvedConfig?.simulatedEfunFile;
    if (!configured) {
        return [];
    }
    const workspaceRoot = vscode.workspace.getWorkspaceFolder(document?.uri ?? vscode.Uri.file(projectConfig.projectConfigPath))
        ?.uri.fsPath
        ?? path.dirname(projectConfig.projectConfigPath);
    const mudlibDirectory = projectConfig.resolvedConfig?.mudlibDirectory;
    const mudlibRoot = !mudlibDirectory
        ? workspaceRoot
        : isNativeAbsolutePath(mudlibDirectory)
            ? mudlibDirectory
            : projectConfig.configHellPath
                ? path.resolve(path.dirname(path.resolve(workspaceRoot, projectConfig.configHellPath)), mudlibDirectory)
                : path.resolve(workspaceRoot, mudlibDirectory);
    const entryPath = isNativeAbsolutePath(configured)
        ? configured
        : path.join(mudlibRoot, configured.replace(/^[/\\]+/u, ''));
    return path.extname(entryPath)
        ? [entryPath]
        : [`${entryPath}.c`, `${entryPath}.h`, entryPath];
}

function isNativeAbsolutePath(targetPath: string): boolean {
    return /^[A-Za-z]:[\\/]/u.test(targetPath) || targetPath.startsWith('\\\\');
}
