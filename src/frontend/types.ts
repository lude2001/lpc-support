import * as vscode from 'vscode';

export type PreprocessorDirectiveKind =
    | 'include'
    | 'define'
    | 'undef'
    | 'if'
    | 'ifdef'
    | 'ifndef'
    | 'elif'
    | 'else'
    | 'endif'
    | 'pragma'
    | 'error'
    | 'warning'
    | 'line'
    | 'unknown';

export interface SourceOffsetRange {
    startOffset: number;
    endOffset: number;
    range: vscode.Range;
}

export interface PreprocessorDirective extends SourceOffsetRange {
    kind: PreprocessorDirectiveKind;
    rawText: string;
    body: string;
}

export interface MacroDefinitionFact extends SourceOffsetRange {
    name: string;
    replacement: string;
    parameters?: string[];
    isFunctionLike: boolean;
    source: 'document' | 'config' | 'include' | 'global-include';
    sourceUri?: string;
}

export interface MacroUndefFact extends SourceOffsetRange {
    name: string;
}

export interface MacroReferenceFact extends SourceOffsetRange {
    name: string;
    resolved?: MacroDefinitionFact;
}

export interface IncludeReferenceFact extends SourceOffsetRange {
    rawText: string;
    value: string;
    isSystemInclude: boolean;
    resolvedUri?: string;
}

export interface InactiveRange extends SourceOffsetRange {
    reason: 'condition-false' | 'parent-inactive';
}

export interface PreprocessorDiagnostic {
    code: string;
    message: string;
    severity: vscode.DiagnosticSeverity;
    range: vscode.Range;
}

export interface PreprocessorSourceMapEntry {
    originalStartOffset: number;
    activeStartOffset: number;
    length: number;
}

export interface PreprocessedSourceView {
    text: string;
    sourceMap: PreprocessorSourceMapEntry[];
    expandedRanges?: MacroExpansionRange[];
}

export interface MacroExpansionRange {
    macroName: string;
    originalStartOffset: number;
    originalEndOffset: number;
    activeStartOffset: number;
    activeEndOffset: number;
}

export interface IncludeGraph {
    rootUri: string;
    edges: IncludeGraphEdge[];
}

export interface IncludeGraphEdge {
    fromUri: string;
    includeValue: string;
    toUri?: string;
}

export interface PreprocessorSnapshot {
    uri: string;
    version: number;
    text: string;
    directives: PreprocessorDirective[];
    macros: MacroDefinitionFact[];
    undefs: MacroUndefFact[];
    macroReferences: MacroReferenceFact[];
    includeReferences: IncludeReferenceFact[];
    includeGraph: IncludeGraph;
    inactiveRanges: InactiveRange[];
    diagnostics: PreprocessorDiagnostic[];
    activeView: PreprocessedSourceView;
}

export interface LpcDialectProfile {
    name: string;
    supportedKeywords: readonly string[];
    supportedOperators: readonly string[];
    builtinTypes: readonly string[];
    declarationModifiers: readonly string[];
    controlKeywords: readonly string[];
    declarationKeywords: readonly string[];
    expressionKeywords: readonly string[];
    preprocessorDirectives: readonly string[];
    recognizedPartialKeywords: readonly string[];
    recognizedPartialOperators: readonly string[];
}

export interface LpcFrontendSnapshot {
    uri: string;
    version: number;
    text: string;
    preprocessor: PreprocessorSnapshot;
    dialect: LpcDialectProfile;
    createdAt: number;
}

export interface ConditionalEvaluationResult {
    inactiveRanges: InactiveRange[];
    diagnostics: PreprocessorDiagnostic[];
}
