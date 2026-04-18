import * as vscode from 'vscode';
import { Scope, Symbol, SymbolTable } from '../ast/symbolTable';

export type InheritExpressionKind = 'string' | 'macro' | 'unknown';

export type TypeDefinitionKind = 'struct' | 'class';

export interface ParameterSummary {
    name: string;
    dataType: string;
    range: vscode.Range;
    documentation?: string;
}

export interface MemberSummary {
    name: string;
    dataType: string;
    range: vscode.Range;
    documentation?: string;
    definition?: string;
    parameters?: ParameterSummary[];
    sourceScopeName?: string;
}

export interface FunctionSummary {
    name: string;
    returnType: string;
    parameters: ParameterSummary[];
    modifiers: string[];
    sourceUri: string;
    range: vscode.Range;
    origin: 'local' | 'inherited' | 'efun' | 'simul-efun';
    documentation?: string;
    definition?: string;
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

export interface MacroReference {
    name: string;
    range: vscode.Range;
    resolvedValue?: string;
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
    localScopes: ScopeSummary[];
    typeDefinitions: TypeDefinitionSummary[];
    fileGlobals: FileGlobalSummary[];
    inheritStatements: InheritDirective[];
    includeStatements: IncludeDirective[];
    macroReferences: MacroReference[];
    symbolTable: SymbolTable;
    createdAt: number;
}

export interface FileSymbolRecord {
    uri: string;
    version: number;
    exportedFunctions: FunctionSummary[];
    typeDefinitions: TypeDefinitionSummary[];
    fileGlobals: FileGlobalSummary[];
    inheritStatements: InheritDirective[];
    includeStatements: IncludeDirective[];
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
