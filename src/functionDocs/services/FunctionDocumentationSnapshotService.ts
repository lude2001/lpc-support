import * as path from 'path';
import * as vscode from 'vscode';
import type { FunctionDocLookup, FunctionDocSourceGroup } from '../../efun/FunctionDocLookupTypes';
import type { CallableDoc } from '../../language/documentation/types';
import type { LanguageWorkspaceProjectConfig } from '../../language/contracts/LanguageWorkspaceContext';
import type {
    FunctionDocumentationPanelEntry,
    FunctionDocumentationPanelGroup,
    FunctionDocumentationPanelSnapshot,
    PanelCallableSignature,
    PanelSourceKind
} from '../contracts/FunctionDocumentationPanelProtocol';
import { DocumentationQualityService } from './DocumentationQualityService';
import { FunctionRelationProjectionService } from './FunctionRelationProjectionService';

export interface FunctionDocumentationLookupProvider {
    getFunctionDocLookupForDocument(
        document: vscode.TextDocument,
        options?: {
            forceFresh?: boolean;
            projectConfig?: LanguageWorkspaceProjectConfig;
            cancellationToken?: Pick<vscode.CancellationToken, 'isCancellationRequested'>;
        }
    ): Promise<FunctionDocLookup>;
    getAllFunctions?(): string[];
    getStandardCallableDoc?(name: string): CallableDoc | undefined;
    getAllSimulatedFunctions?(
        document?: vscode.TextDocument,
        projectConfig?: LanguageWorkspaceProjectConfig
    ): string[];
    getSimulatedDoc?(
        name: string,
        document?: vscode.TextDocument,
        projectConfig?: LanguageWorkspaceProjectConfig
    ): CallableDoc | undefined;
    ensureWorkspaceStateCurrent?(
        document?: vscode.TextDocument,
        projectConfig?: LanguageWorkspaceProjectConfig
    ): Promise<void>;
}

export class FunctionDocumentationSnapshotService {
    public constructor(
        private readonly lookupProvider: FunctionDocumentationLookupProvider,
        private readonly qualityService: DocumentationQualityService = new DocumentationQualityService(),
        private readonly relationService: FunctionRelationProjectionService = new FunctionRelationProjectionService()
    ) {}

    public async build(
        document: vscode.TextDocument,
        request: {
            sessionId: string;
            revision: number;
            projectConfig?: LanguageWorkspaceProjectConfig;
            forceFresh?: boolean;
            cancellationToken?: Pick<vscode.CancellationToken, 'isCancellationRequested'>;
        }
    ): Promise<FunctionDocumentationPanelSnapshot> {
        const lookup = await this.lookupProvider.getFunctionDocLookupForDocument(document, {
            forceFresh: request.forceFresh,
            projectConfig: request.projectConfig,
            cancellationToken: request.cancellationToken
        });
        const groups: FunctionDocumentationPanelGroup[] = [];
        const entries: FunctionDocumentationPanelEntry[] = [];

        this.projectGroup(lookup.currentFile, groups, entries, 0);
        for (const group of lookup.inheritedGroups) {
            this.projectGroup(group, groups, entries, 1);
        }
        for (const group of lookup.includeGroups) {
            this.projectGroup(group, groups, entries, 1);
        }
        const lookupDiagnostics = lookup.diagnostics ?? [];
        const configDiagnostics = request.projectConfig && !request.projectConfig.resolvedConfig
            ? [{
                code: 'project-config-unavailable',
                severity: 'warning' as const,
                stage: 'configuration',
                message: request.projectConfig.configHellPath
                    ? '项目配置尚未从 driver 配置同步，依赖路径可能不完整。'
                    : '当前工作区没有可用的 LPC 项目配置，依赖路径使用默认规则。',
                recoverable: true
            }]
            : [];
        this.relationService.project(entries, {
            inheritanceResolved: !lookupDiagnostics.some((diagnostic) =>
                diagnostic.stage === 'inheritance'
                || diagnostic.stage === 'analysis'
            )
        });
        for (const entry of entries) {
            if (entry.relation.status === 'unresolved') {
                entry.capabilities.canFindReferences = false;
            }
        }
        return {
            protocolVersion: 2,
            sessionId: request.sessionId,
            revision: request.revision,
            rootDocument: {
                uri: document.uri.toString(),
                workspaceRelativePath: getWorkspaceRelativePath(document),
                version: document.version,
                languageId: 'lpc'
            },
            status: lookupDiagnostics.length > 0 || configDiagnostics.length > 0 ? 'partial' : 'ready',
            groups,
            entries,
            diagnostics: [
                ...configDiagnostics,
                ...lookupDiagnostics.map((diagnostic) => ({
                    code: diagnostic.code,
                    severity: 'warning' as const,
                    stage: diagnostic.stage,
                    message: diagnostic.message,
                    recoverable: true
                }))
            ],
            capabilities: {
                supportsLiveRefresh: true,
                supportsExternalSearch: Boolean(
                    this.lookupProvider.getAllFunctions || this.lookupProvider.getAllSimulatedFunctions
                ),
                supportsDocumentationAuthoring: true
            }
        };
    }

    public async searchExternal(
        document: vscode.TextDocument,
        request: {
            query: string;
            scopes: Array<'simulEfun' | 'efun'>;
            projectConfig?: LanguageWorkspaceProjectConfig;
            limit?: number;
        }
    ): Promise<{
        groups: FunctionDocumentationPanelGroup[];
        entries: FunctionDocumentationPanelEntry[];
        diagnostics: FunctionDocumentationPanelSnapshot['diagnostics'];
    }> {
        const query = request.query.trim().toLocaleLowerCase('zh-CN');
        const limit = request.limit ?? 200;
        const groups: FunctionDocumentationPanelGroup[] = [];
        const entries: FunctionDocumentationPanelEntry[] = [];
        const diagnostics: FunctionDocumentationPanelSnapshot['diagnostics'] = [];

        if (request.scopes.includes('simulEfun') && this.lookupProvider.getAllSimulatedFunctions) {
            try {
                await this.lookupProvider.ensureWorkspaceStateCurrent?.(document, request.projectConfig);
                const docs = this.lookupProvider.getAllSimulatedFunctions(document, request.projectConfig)
                    .map((name) => this.lookupProvider.getSimulatedDoc?.(name, document, request.projectConfig))
                    .filter((doc): doc is CallableDoc => Boolean(doc))
                    .filter((doc) => matchesCallableDoc(doc, query))
                    .slice(0, limit);
                this.projectExternalGroup('simulEfun', '模拟函数', docs, groups, entries);
            } catch {
                diagnostics.push(createExternalDiagnostic('simulEfun'));
            }
        }

        if (request.scopes.includes('efun') && this.lookupProvider.getAllFunctions) {
            try {
                const docs = this.lookupProvider.getAllFunctions()
                    .map((name) => this.lookupProvider.getStandardCallableDoc?.(name))
                    .filter((doc): doc is CallableDoc => Boolean(doc))
                    .filter((doc) => matchesCallableDoc(doc, query))
                    .slice(0, limit);
                this.projectExternalGroup('efun', '标准 Efun', docs, groups, entries);
            } catch {
                diagnostics.push(createExternalDiagnostic('efun'));
            }
        }

        return { groups, entries, diagnostics };
    }

    private projectGroup(
        source: FunctionDocSourceGroup,
        groups: FunctionDocumentationPanelGroup[],
        entries: FunctionDocumentationPanelEntry[],
        depth: number
    ): void {
        const sourceKind = toPanelSourceKind(source.sourceKind);
        const sourceUri = vscode.Uri.file(source.filePath).toString();
        const groupId = `${sourceKind}:${sourceUri}`;
        const declarationCounts = new Map<string, number>();
        for (const doc of source.entries) {
            declarationCounts.set(doc.name, (declarationCounts.get(doc.name) ?? 0) + 1);
        }
        const groupEntries = source.entries.map((doc) => this.projectEntry(
            doc,
            groupId,
            sourceKind,
            sourceUri,
            declarationCounts.get(doc.name) === 1
        ));
        const resolvedDepth = source.depth ?? depth;
        const parentGroupId = source.parentFilePath
            ? `${resolvedDepth <= 1 ? 'local' : sourceKind}:${vscode.Uri.file(source.parentFilePath).toString()}`
            : undefined;

        groups.push({
            id: groupId,
            sourceKind,
            sourceUri,
            workspaceRelativePath: getWorkspaceRelativeFilePath(source.filePath),
            displayLabel: sourceKind === 'local' ? '当前文件' : source.source,
            depth: resolvedDepth,
            parentGroupId,
            entryIds: groupEntries.map((entry) => entry.id),
            diagnostics: []
        });
        entries.push(...groupEntries);
    }

    private projectEntry(
        doc: CallableDoc,
        groupId: string,
        sourceKind: PanelSourceKind,
        sourceUri?: string,
        onlyDeclaration?: boolean
    ): FunctionDocumentationPanelEntry {
        const declarationKind = doc.declarationKind ?? inferDeclarationKind(doc);
        const quality = this.qualityService.analyze({ ...doc, declarationKind }, { onlyDeclaration });
        const isLocalImplementation = sourceKind === 'local' && declarationKind === 'implementation';

        return {
            id: doc.declarationKey,
            declarationKey: doc.declarationKey,
            name: doc.name,
            sourceKind,
            sourceGroupId: groupId,
            declarationKind,
            sourceUri,
            sourceRange: doc.sourceRange,
            selectionRange: doc.selectionRange,
            signatures: doc.signatures.map((signature): PanelCallableSignature => ({
                label: signature.label,
                returnType: signature.returnType,
                parameters: signature.parameters.map((parameter) => ({
                    name: parameter.name,
                    type: parameter.type,
                    description: parameter.description,
                    optional: parameter.optional === true,
                    variadic: parameter.variadic === true,
                    defaultValueText: parameter.defaultValueText
                })),
                isParameterVariadic: signature.isVariadic,
                isFunctionVarargs: doc.modifiers?.includes('varargs') === true,
                arity: signature.arity ? { ...signature.arity } : undefined,
                rawSyntax: signature.rawSyntax
            })),
            documentation: {
                hasAttachedComment: Boolean(doc.attachedCommentRange),
                attachedCommentRange: doc.attachedCommentRange,
                summary: doc.summary,
                details: doc.details,
                note: doc.note,
                returns: doc.returns ? { ...doc.returns } : undefined,
                returnObjects: doc.returnObjects ? [...doc.returnObjects] : undefined
            },
            quality,
            relation: {
                status: 'none',
                relatedEntryIds: [],
                relatedSourceUris: []
            },
            modifiers: doc.modifiers ? [...doc.modifiers] : [],
            capabilities: {
                canGoToDefinition: Boolean(sourceUri && doc.sourceRange),
                canFindReferences: Boolean(sourceUri && (doc.selectionRange ?? doc.sourceRange)),
                canCopySignature: doc.signatures.length > 0,
                canGenerateDocumentation: isLocalImplementation && quality.action === 'generate',
                canCompleteDocumentation: isLocalImplementation && quality.action === 'complete',
                canUpdateDocumentation: isLocalImplementation && quality.action === 'update'
            }
        };
    }

    private projectExternalGroup(
        sourceKind: Extract<PanelSourceKind, 'simulEfun' | 'efun'>,
        displayLabel: string,
        docs: CallableDoc[],
        groups: FunctionDocumentationPanelGroup[],
        entries: FunctionDocumentationPanelEntry[]
    ): void {
        if (docs.length === 0) {
            return;
        }
        const groupId = `${sourceKind}:external`;
        const groupEntries = docs.map((doc) => {
            const sourceUri = sourceKind === 'simulEfun' && doc.sourcePath
                ? vscode.Uri.file(doc.sourcePath).toString()
                : undefined;
            return this.projectEntry(
                { ...doc, sourceKind, declarationKind: 'external' },
                groupId,
                sourceKind,
                sourceUri
            );
        });
        groups.push({
            id: groupId,
            sourceKind,
            displayLabel,
            depth: 0,
            entryIds: groupEntries.map((entry) => entry.id),
            diagnostics: []
        });
        entries.push(...groupEntries);
    }
}

function matchesCallableDoc(doc: CallableDoc, query: string): boolean {
    if (!query) {
        return true;
    }
    const values: Array<string | undefined> = [
        doc.name,
        doc.summary,
        doc.details,
        doc.note,
        doc.returns?.type,
        doc.returns?.description,
        doc.sourcePath,
        ...(doc.returnObjects ?? [])
    ];
    for (const signature of doc.signatures) {
        values.push(signature.label, signature.returnType, signature.rawSyntax);
        for (const parameter of signature.parameters) {
            values.push(
                parameter.name,
                parameter.type,
                parameter.description,
                parameter.defaultValueText
            );
        }
    }
    return values
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLocaleLowerCase('zh-CN').includes(query));
}

function createExternalDiagnostic(source: 'simulEfun' | 'efun'): FunctionDocumentationPanelSnapshot['diagnostics'][number] {
    return {
        code: 'external-source-unavailable',
        severity: 'warning',
        stage: source,
        message: source === 'simulEfun' ? '模拟函数文档暂时不可用。' : '标准 Efun 文档暂时不可用。',
        recoverable: true
    };
}

function toPanelSourceKind(sourceKind: FunctionDocSourceGroup['sourceKind']): PanelSourceKind {
    if (sourceKind === 'local' || sourceKind === 'inherit' || sourceKind === 'include') {
        return sourceKind;
    }
    if (sourceKind === 'simulEfun' || sourceKind === 'efun') {
        return sourceKind;
    }
    return 'local';
}

function inferDeclarationKind(doc: CallableDoc): 'implementation' | 'prototype' | 'external' {
    if (doc.sourceKind === 'efun' || doc.sourceKind === 'simulEfun') {
        return 'external';
    }
    return doc.signatures.some((signature) => signature.label.trimEnd().endsWith(';'))
        ? 'prototype'
        : 'implementation';
}

function getWorkspaceRelativePath(document: vscode.TextDocument): string {
    return getWorkspaceRelativeFilePath(document.fileName);
}

function getWorkspaceRelativeFilePath(filePath: string): string {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
    if (!workspaceFolder) {
        return path.basename(filePath);
    }
    return path.relative(workspaceFolder.uri.fsPath, filePath).replace(/\\/g, '/');
}
