import * as vscode from 'vscode';
import { SourceFileContext } from '../antlr/LPCParser';
import {
    clearGlobalParsedDocumentService,
    getGlobalParsedDocumentService
} from '../parser/ParsedDocumentService';
import { SymbolTable } from './symbolTable';
import {
    DocumentAnalysisService,
    DocumentSemanticAnalysis
} from '../semantic/documentAnalysisService';
import { DocumentSemanticSnapshot } from '../semantic/documentSemanticTypes';
import { SemanticSnapshot } from '../semantic/semanticSnapshot';
import { SyntaxDocument } from '../syntax/types';
import { ParsedDocument as ParsedDoc } from '../parser/types';

export interface ParseResult {
    ast: SourceFileContext;
    symbolTable: SymbolTable;
    parseErrors: vscode.Diagnostic[];
    parsed?: ParsedDoc;
    syntax?: SyntaxDocument;
    semantic?: SemanticSnapshot;
    snapshot: DocumentSemanticSnapshot;
}

export class ASTManager {
    private static instance: ASTManager | undefined;
    private readonly snapshotService: DocumentAnalysisService;

    private constructor(snapshotService: DocumentAnalysisService) {
        this.snapshotService = snapshotService;
    }

    public static configureSingleton(snapshotService: DocumentAnalysisService): ASTManager {
        ASTManager.instance = new ASTManager(snapshotService);
        return ASTManager.instance;
    }

    public static getInstance(): ASTManager {
        if (!ASTManager.instance) {
            throw new Error('ASTManager singleton is not configured. Call ASTManager.configureSingleton(...) first.');
        }
        return ASTManager.instance;
    }

    public static resetSingletonForTests(): void {
        ASTManager.instance = undefined;
    }

    // 解析文档并构建AST和符号表
    public parseDocument(document: vscode.TextDocument, useCache: boolean = true): ParseResult {
        const analysis = this.snapshotService.parseDocument(document, useCache);
        return this.toParseResult(analysis);
    }

    // 清除指定文档的缓存
    public clearCache(documentUri: string): void {
        this.snapshotService.clearCache(documentUri);
        const uri = vscode.Uri.parse(documentUri);
        getGlobalParsedDocumentService().invalidate(uri);
    }

    // 清除所有缓存
    public clearAllCache(): void {
        this.snapshotService.clearAllCache();
        clearGlobalParsedDocumentService();
    }

    public getSnapshot(document: vscode.TextDocument, useCache: boolean = true): DocumentSemanticSnapshot {
        return this.snapshotService.getSnapshot(document, useCache);
    }

    public getBestAvailableSnapshot(document: vscode.TextDocument): DocumentSemanticSnapshot {
        return this.snapshotService.getBestAvailableSnapshot(document);
    }

    public getSemanticSnapshot(document: vscode.TextDocument, useCache: boolean = true): SemanticSnapshot {
        return this.snapshotService.getSemanticSnapshot(document, useCache);
    }

    public getBestAvailableSemanticSnapshot(document: vscode.TextDocument): SemanticSnapshot {
        return this.snapshotService.getBestAvailableSemanticSnapshot(document);
    }

    public scheduleSnapshotRefresh(
        document: vscode.TextDocument,
        onReady?: (snapshot: DocumentSemanticSnapshot) => void
    ): void {
        this.snapshotService.scheduleRefresh(document, onReady);
    }

    public hasSnapshot(document: vscode.TextDocument): boolean {
        return this.snapshotService.hasSnapshot(document);
    }

    public hasFreshSnapshot(document: vscode.TextDocument): boolean {
        return this.snapshotService.hasFreshSnapshot(document);
    }

    public getSyntaxDocument(document: vscode.TextDocument, useCache: boolean = true): SyntaxDocument | undefined {
        return this.snapshotService.getSyntaxDocument(document, useCache);
    }

    private toParseResult(analysis: DocumentSemanticAnalysis): ParseResult {
        return {
            ast: analysis.ast,
            symbolTable: analysis.symbolTable,
            parseErrors: analysis.parseErrors,
            parsed: analysis.parsed,
            syntax: analysis.syntax,
            semantic: analysis.semantic,
            snapshot: analysis.snapshot
        };
    }
}
