import * as vscode from 'vscode';
import { Scope, Symbol, SymbolTable, SymbolType } from '../ast/symbolTable';

export type InheritExpressionKind = 'string' | 'macro' | 'unknown';

export type TypeDefinitionKind = 'struct' | 'class';

export interface ParameterSummary {
    name: string;
    dataType: string;
    range: vscode.Range;
    documentation?: string;
    isReference?: boolean;
    isVariadic?: boolean;
    hasDefaultValue?: boolean;
    defaultValueText?: string;
}

export interface MemberSummary {
    name: string;
    dataType: string;
    range: vscode.Range;
    selectionRange?: vscode.Range;
    documentation?: string;
    definition?: string;
    parameters?: ParameterSummary[];
    sourceScopeName?: string;
}

export interface FunctionSummary {
    name: string;
    returnType: string;
    parameters: ParameterSummary[];
    requiredParameterCount?: number;
    maxParameterCount?: number;
    isVariadic?: boolean;
    modifiers: string[];
    sourceUri: string;
    range: vscode.Range;
    origin: 'local' | 'include' | 'inherited' | 'efun' | 'simul-efun';
    documentation?: string;
    definition?: string;
    hasBody?: boolean;
    isPrototype?: boolean;
}

export interface TypeDefinitionSummary {
    name: string;
    kind: TypeDefinitionKind;
    members: MemberSummary[];
    sourceUri: string;
    range: vscode.Range;
    definition?: string;
}

export interface FileGlobalSummary {
    name: string;
    dataType: string;
    sourceUri: string;
    range: vscode.Range;
    selectionRange?: vscode.Range;
}

export interface ScopeSummary {
    name: string;
    range: vscode.Range;
    symbolNames: string[];
    childScopes: string[];
    parentScopeName?: string;
}

export interface SemanticSymbolSummary {
    name: string;
    kind: SymbolType;
    dataType: string;
    sourceUri: string;
    range: vscode.Range;
    selectionRange?: vscode.Range;
    scopeName: string;
    definition?: string;
    documentation?: string;
    modifiers?: string[];
    isReference?: boolean;
    isVariadic?: boolean;
    hasDefaultValue?: boolean;
    defaultValueText?: string;
}

export interface MacroReference {
    name: string;
    range: vscode.Range;
    resolvedValue?: string;
}

export interface MacroDefinitionSummary {
    name: string;
    value: string;
    range: vscode.Range;
    parameters?: string[];
    isFunctionLike: boolean;
    sourceUri: string;
}

export interface IncludeDirective {
    rawText: string;
    value: string;
    range: vscode.Range;
    isSystemInclude: boolean;
    resolvedUri?: string;
}

export interface InheritDirective {
    rawText: string;
    expressionKind: InheritExpressionKind;
    value: string;
    range: vscode.Range;
    resolvedUri?: string;
    isResolved: boolean;
}

export interface DocumentSemanticSnapshot {
    uri: string;
    version: number;
    parseDiagnostics: vscode.Diagnostic[];
    exportedFunctions: FunctionSummary[];
    symbols: SemanticSymbolSummary[];
    localScopes: ScopeSummary[];
    typeDefinitions: TypeDefinitionSummary[];
    fileGlobals: FileGlobalSummary[];
    inheritStatements: InheritDirective[];
    includeStatements: IncludeDirective[];
    macroDefinitions?: MacroDefinitionSummary[];
    macroReferences: MacroReference[];
    symbolTable: SymbolTable;
    createdAt: number;
}

export interface FileSymbolRecord {
    uri: string;
    version: number;
    exportedFunctions: FunctionSummary[];
    symbols?: SemanticSymbolSummary[];
    typeDefinitions: TypeDefinitionSummary[];
    fileGlobals: FileGlobalSummary[];
    inheritStatements: InheritDirective[];
    includeStatements: IncludeDirective[];
    macroDefinitions?: MacroDefinitionSummary[];
    macroReferences: MacroReference[];
    updatedAt: number;
}

export interface ResolvedInheritTarget {
    rawValue: string;
    expressionKind: InheritExpressionKind;
    sourceUri: string;
    resolvedUri?: string;
    isResolved: boolean;
}

export interface InheritedSymbolSet {
    chain: string[];
    functions: FunctionSummary[];
    types: TypeDefinitionSummary[];
    unresolvedTargets: ResolvedInheritTarget[];
}

export interface IncludedSymbolSet {
    files: string[];
    functions: FunctionSummary[];
    types: TypeDefinitionSummary[];
    fileGlobals: FileGlobalSummary[];
    unresolvedIncludes: IncludeDirective[];
}

export interface TypeDefinitionLookup {
    typeName: string;
    definitions: TypeDefinitionSummary[];
}

export interface SnapshotStats {
    totalSnapshots: number;
    activeDocumentUris: string[];
    lastUpdatedAt?: number;
}

export type DocumentSemanticSymbol = Symbol;
export type DocumentSemanticScope = Scope;
