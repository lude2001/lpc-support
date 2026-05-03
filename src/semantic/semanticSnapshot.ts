import * as vscode from 'vscode';
import { SymbolTable } from '../ast/symbolTable';
import {
    DocumentSemanticSnapshot,
    FileGlobalSummary,
    FunctionSummary,
    IncludeDirective,
    InheritDirective,
    MacroDefinitionSummary,
    MacroReference,
    ScopeSummary,
    TypeDefinitionSummary
} from './documentSemanticTypes';
import { SyntaxDocument } from '../syntax/types';

export interface SemanticSnapshot {
    uri: string;
    version: number;
    syntax: SyntaxDocument;
    parseDiagnostics: vscode.Diagnostic[];
    exportedFunctions: FunctionSummary[];
    localScopes: ScopeSummary[];
    typeDefinitions: TypeDefinitionSummary[];
    fileGlobals?: FileGlobalSummary[];
    inheritStatements: InheritDirective[];
    includeStatements: IncludeDirective[];
    macroDefinitions?: MacroDefinitionSummary[];
    macroReferences: MacroReference[];
    symbolTable: SymbolTable;
    createdAt: number;
}

export function toDocumentSemanticSnapshot(snapshot: SemanticSnapshot): DocumentSemanticSnapshot {
    return {
        uri: snapshot.uri,
        version: snapshot.version,
        parseDiagnostics: snapshot.parseDiagnostics,
        exportedFunctions: snapshot.exportedFunctions,
        localScopes: snapshot.localScopes,
        typeDefinitions: snapshot.typeDefinitions,
        fileGlobals: snapshot.fileGlobals ? snapshot.fileGlobals.map((summary) => ({ ...summary })) : [],
        inheritStatements: snapshot.inheritStatements,
        includeStatements: snapshot.includeStatements,
        macroDefinitions: snapshot.macroDefinitions,
        macroReferences: snapshot.macroReferences,
        symbolTable: snapshot.symbolTable,
        createdAt: snapshot.createdAt
    };
}
