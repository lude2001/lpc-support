import { CommonTokenStream, Token } from 'antlr4ts';
import * as vscode from 'vscode';
import { LPCParser } from '../antlr/LPCParser';
import { LpcFrontendSnapshot } from '../frontend/types';

export type LayoutTriviaSource = 'lexer-hidden-channel';
export type TriviaKind = 'whitespace' | 'newline' | 'line-comment' | 'block-comment' | 'directive';

export interface Trivia {
    kind: TriviaKind;
    text: string;
    range: vscode.Range;
    tokenIndex: number;
    startOffset: number;
    endOffset: number;
}

export interface TokenTriviaAccessor {
    getLeadingTrivia(tokenIndex: number): Trivia[];
    getTrailingTrivia(tokenIndex: number): Trivia[];
    getInterveningTrivia(startTokenIndex: number, endTokenIndex: number): Trivia[];
    getTriviaForHiddenToken(tokenIndex: number): Trivia[];
    getAllTrivia(): Trivia[];
}

export interface ParsedDocument {
    uri: string;
    version: number;
    text: string;
    parseText: string;
    frontend?: LpcFrontendSnapshot;
    tokenStream: CommonTokenStream;
    tokens: CommonTokenStream;
    allTokens: Token[];
    visibleTokens: Token[];
    hiddenTokens: Token[];
    tokenTriviaIndex: TokenTriviaAccessor;
    tree: ReturnType<LPCParser['sourceFile']>;
    diagnostics: vscode.Diagnostic[];
    createdAt: number;
    lastAccessed: number;
    parseTimeMs: number;
    parseTime: number;
    size: number;
    layoutTriviaSource: LayoutTriviaSource;
}

export interface ParsedDocumentServiceConfig {
    maxSize?: number;
    maxMemory?: number;
    ttl?: number;
    cleanupInterval?: number;
    enableMonitoring?: boolean;
}

export interface ParsedDocumentStats {
    size: number;
    memory: number;
    hits: number;
    misses: number;
    hitRate: number;
    evictions: number;
    avgAccessTime: number;
    parseCount: number;
    avgParseTime: number;
    totalParseTime: number;
}
