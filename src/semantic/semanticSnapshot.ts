import * as vscode from 'vscode';
import { SymbolTable } from '../ast/symbolTable';
import {
    DocumentSemanticSnapshot,
    FunctionSummary,
    IncludeDirective,
    InheritDirective,
    MacroReference,
    ScopeSummary,
    TypeDefinitionSummary
} from '../completion/types';
import { SyntaxDocument } from '../syntax/types';

export interface SemanticSnapshot {
    uri: string;
    version: number;
    syntax: SyntaxDocument;
    parseDiagnostics: vscode.Diagnostic[];
    exportedFunctions: FunctionSummary[];
    localScopes: ScopeSummary[];
    typeDefinitions: TypeDefinitionSummary[];
    inheritStatements: InheritDirective[];
    includeStatements: IncludeDirective[];
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
        inheritStatements: snapshot.inheritStatements,
        includeStatements: snapshot.includeStatements,
        macroReferences: snapshot.macroReferences,
        symbolTable: snapshot.symbolTable,
        createdAt: snapshot.createdAt
    };
}
