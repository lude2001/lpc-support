import * as vscode from 'vscode';
import { SymbolTable } from '../ast/symbolTable';
import { ParsedDocument as ParsedDoc } from '../parser/types';
import { SyntaxDocument } from '../syntax/types';
import { SemanticSnapshot } from './semanticSnapshot';
import { DocumentSemanticSnapshot, SnapshotStats } from './documentSemanticTypes';

export interface DocumentSemanticAnalysis {
    symbolTable: SymbolTable;
    parseErrors: vscode.Diagnostic[];
    parsed?: ParsedDoc;
    syntax?: SyntaxDocument;
    semantic?: SemanticSnapshot;
    snapshot: DocumentSemanticSnapshot;
}

export interface CompleteDocumentSemanticAnalysis extends DocumentSemanticAnalysis {
    parsed: ParsedDoc;
    syntax: SyntaxDocument;
    semantic: SemanticSnapshot;
}

export type SnapshotAccessMode = 'cacheFirst' | 'refreshIfStale' | 'forceRefresh';

export interface DocumentAnalysisService {
    parseDocument(document: vscode.TextDocument, mode?: boolean | SnapshotAccessMode): DocumentSemanticAnalysis;
    getAnalysis(document: vscode.TextDocument, mode?: boolean | SnapshotAccessMode): DocumentSemanticAnalysis;
    getBestAvailableAnalysis(document: vscode.TextDocument): DocumentSemanticAnalysis;
    getSyntaxDocument(document: vscode.TextDocument, mode?: boolean | SnapshotAccessMode): SyntaxDocument | undefined;
    getSemanticSnapshot(document: vscode.TextDocument, mode?: boolean | SnapshotAccessMode): SemanticSnapshot;
    getSnapshot(document: vscode.TextDocument, mode?: boolean | SnapshotAccessMode): DocumentSemanticSnapshot;
    getBestAvailableSnapshot(document: vscode.TextDocument): DocumentSemanticSnapshot;
    getBestAvailableSemanticSnapshot(document: vscode.TextDocument): SemanticSnapshot;
    scheduleRefresh(document: vscode.TextDocument, onReady?: (snapshot: DocumentSemanticSnapshot) => void): void;
    hasSnapshot(document: vscode.TextDocument): boolean;
    hasFreshSnapshot(document: vscode.TextDocument): boolean;
    clearCache(uri: vscode.Uri | string): void;
    clearAllCache(): void;
    getStats(): SnapshotStats;
}
