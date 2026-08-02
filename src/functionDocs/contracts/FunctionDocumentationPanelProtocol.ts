import type { CallableSourceKind, DocumentRange } from '../../language/documentation/types';

export type PanelSourceKind = Extract<CallableSourceKind, 'local' | 'inherit' | 'include' | 'simulEfun' | 'efun'>;
export type PanelDeclarationKind = 'implementation' | 'prototype' | 'external';
export type PanelDocumentationQualityStatus = 'complete' | 'incomplete' | 'inconsistent' | 'notApplicable';
export type PanelDocumentationAction = 'none' | 'generate' | 'complete' | 'update';

export interface PanelCallableParameter {
    name: string;
    type?: string;
    description?: string;
    optional: boolean;
    variadic: boolean;
    defaultValueText?: string;
}

export interface PanelCallableSignature {
    label: string;
    returnType?: string;
    parameters: PanelCallableParameter[];
    isParameterVariadic: boolean;
    isFunctionVarargs: boolean;
    arity?: {
        min: number;
        max?: number | null;
    };
    rawSyntax?: string;
}

export type PanelDocumentationIssueCode =
    | 'missing-summary'
    | 'missing-param-description'
    | 'orphan-param-tag'
    | 'missing-return-description'
    | 'stale-parameter-name'
    | 'duplicate-param-tag'
    | 'duplicate-return-tag';

export interface PanelDocumentationIssue {
    code: PanelDocumentationIssueCode;
    parameterName?: string;
    message: string;
}

export interface PanelDocumentationQuality {
    status: PanelDocumentationQualityStatus;
    issues: PanelDocumentationIssue[];
    action: PanelDocumentationAction;
}

export interface PanelCallableDocumentation {
    hasAttachedComment: boolean;
    attachedCommentRange?: DocumentRange;
    summary?: string;
    details?: string;
    note?: string;
    returns?: {
        type?: string;
        description?: string;
    };
    returnObjects?: string[];
}

export interface PanelFunctionRelation {
    status: 'none' | 'overrides' | 'overridden' | 'ambiguous' | 'unresolved';
    relatedEntryIds: string[];
    relatedSourceUris: string[];
    explanationCode?: string;
}

export interface PanelEntryCapabilities {
    canGoToDefinition: boolean;
    canFindReferences: boolean;
    canCopySignature: boolean;
    canGenerateDocumentation: boolean;
    canCompleteDocumentation: boolean;
    canUpdateDocumentation: boolean;
}

export interface FunctionDocumentationPanelEntry {
    id: string;
    declarationKey: string;
    name: string;
    sourceKind: PanelSourceKind;
    sourceGroupId: string;
    declarationKind: PanelDeclarationKind;
    sourceUri?: string;
    sourceRange?: DocumentRange;
    selectionRange?: DocumentRange;
    signatures: PanelCallableSignature[];
    documentation: PanelCallableDocumentation;
    quality: PanelDocumentationQuality;
    relation: PanelFunctionRelation;
    modifiers: string[];
    capabilities: PanelEntryCapabilities;
}

export interface FunctionDocumentationPanelGroup {
    id: string;
    sourceKind: PanelSourceKind;
    sourceUri?: string;
    workspaceRelativePath?: string;
    displayLabel: string;
    depth: number;
    parentGroupId?: string;
    entryIds: string[];
    diagnostics: string[];
}

export interface FunctionDocumentationPanelDiagnostic {
    code: string;
    severity: 'info' | 'warning' | 'error';
    stage: string;
    message: string;
    recoverable: boolean;
}

export interface FunctionDocumentationPanelSnapshot {
    protocolVersion: 2;
    sessionId: string;
    revision: number;
    rootDocument: {
        uri: string;
        workspaceRelativePath: string;
        version: number;
        languageId: 'lpc';
    };
    status: 'ready' | 'partial' | 'failed';
    groups: FunctionDocumentationPanelGroup[];
    entries: FunctionDocumentationPanelEntry[];
    diagnostics: FunctionDocumentationPanelDiagnostic[];
    capabilities: {
        supportsLiveRefresh: true;
        supportsExternalSearch: boolean;
        supportsDocumentationAuthoring: boolean;
    };
}

export type ExtensionToFunctionDocsMessage =
    | { type: 'snapshot'; payload: FunctionDocumentationPanelSnapshot }
    | { type: 'loading'; sessionId: string; revision: number; stage: string }
    | { type: 'actionResult'; requestId?: string; ok: boolean; message?: string }
    | {
        type: 'externalSearchResult';
        requestId: string;
        groups: FunctionDocumentationPanelGroup[];
        entries: FunctionDocumentationPanelEntry[];
        diagnostics?: FunctionDocumentationPanelDiagnostic[];
    };

export type FunctionDocsToExtensionMessage =
    | { type: 'ready'; protocolVersion: 2 }
    | { type: 'refresh'; sessionId: string }
    | { type: 'goToDefinition'; entryId: string; revision: number }
    | { type: 'findReferences'; entryId: string; revision: number }
    | {
        type: 'searchExternal';
        requestId: string;
        query: string;
        scopes: Array<'simulEfun' | 'efun'>;
    }
    | {
        type: 'authorDocumentation';
        entryId: string;
        revision: number;
        mode: 'generate' | 'complete' | 'update';
    };

export function isFunctionDocsToExtensionMessage(value: unknown): value is FunctionDocsToExtensionMessage {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const message = value as Record<string, unknown>;
    switch (message.type) {
        case 'ready':
            return message.protocolVersion === 2;
        case 'refresh':
            return typeof message.sessionId === 'string';
        case 'goToDefinition':
        case 'findReferences':
            return typeof message.entryId === 'string'
                && message.entryId.length > 0
                && typeof message.revision === 'number'
                && Number.isInteger(message.revision);
        case 'authorDocumentation':
            return typeof message.entryId === 'string'
                && message.entryId.length > 0
                && typeof message.revision === 'number'
                && Number.isInteger(message.revision)
                && (message.mode === 'generate' || message.mode === 'complete' || message.mode === 'update');
        case 'searchExternal':
            return typeof message.requestId === 'string'
                && typeof message.query === 'string'
                && message.query.length <= 512
                && Array.isArray(message.scopes)
                && message.scopes.length > 0
                && message.scopes.every((scope) => scope === 'simulEfun' || scope === 'efun');
        default:
            return false;
    }
}
