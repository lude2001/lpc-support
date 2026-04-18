import * as vscode from 'vscode';
import { Scope, Symbol } from '../ast/symbolTable';
import type {
    DocumentSemanticSnapshot,
    FileGlobalSummary,
    FileSymbolRecord,
    FunctionSummary,
    IncludeDirective,
    InheritDirective,
    InheritExpressionKind,
    InheritedSymbolSet,
    MacroReference,
    MemberSummary,
    ParameterSummary,
    ResolvedInheritTarget,
    ScopeSummary,
    SnapshotStats,
    TypeDefinitionKind,
    TypeDefinitionLookup,
    TypeDefinitionSummary
} from '../semantic/documentSemanticTypes';

export type CompletionContextKind =
    | 'identifier'
    | 'member'
    | 'scoped-member'
    | 'preprocessor'
    | 'inherit-path'
    | 'include-path'
    | 'type-position';

export type CompletionCandidateSourceType =
    | 'local'
    | 'inherited'
    | 'scoped-method'
    | 'struct-member'
    | 'efun'
    | 'simul-efun'
    | 'keyword'
    | 'macro';

export type CompletionSortGroup =
    | 'scope'
    | 'type-member'
    | 'inherited'
    | 'builtin'
    | 'keyword';

export type CompletionStage =
    | 'context-analysis'
    | 'snapshot-load'
    | 'project-index-query'
    | 'candidate-build'
    | 'item-resolve'
    | 'request-total';

export interface CompletionQueryContext {
    kind: CompletionContextKind;
    receiverChain: string[];
    receiverExpression?: string;
    currentWord: string;
    linePrefix: string;
}

export interface CompletionCandidateMetadata {
    sourceUri?: string;
    sourceType: CompletionCandidateSourceType;
    documentationRef?: string;
    declarationKey?: string;
    symbol?: Symbol;
    scope?: Scope;
}

export interface CompletionCandidate {
    key: string;
    label: string;
    kind: vscode.CompletionItemKind;
    detail: string;
    insertText?: string;
    sortGroup: CompletionSortGroup;
    metadata: CompletionCandidateMetadata;
}

export interface CompletionQueryResult {
    context: CompletionQueryContext;
    candidates: CompletionCandidate[];
    isIncomplete?: boolean;
}

export interface CompletionStageMetric {
    stage: CompletionStage;
    durationMs: number;
    cacheHit?: boolean;
    candidateCount?: number;
}

export interface CompletionMetrics {
    documentUri: string;
    documentVersion: number;
    triggerKind?: vscode.CompletionTriggerKind;
    triggerCharacter?: string;
    contextKind: CompletionContextKind;
    totalDurationMs: number;
    totalCandidates: number;
    stages: CompletionStageMetric[];
    createdAt: number;
}

export type {
    DocumentSemanticSnapshot,
    FileGlobalSummary,
    FileSymbolRecord,
    FunctionSummary,
    IncludeDirective,
    InheritDirective,
    InheritExpressionKind,
    InheritedSymbolSet,
    MacroReference,
    MemberSummary,
    ParameterSummary,
    ResolvedInheritTarget,
    ScopeSummary,
    SnapshotStats,
    TypeDefinitionKind,
    TypeDefinitionLookup,
    TypeDefinitionSummary
};
