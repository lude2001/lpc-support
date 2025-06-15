import { CharStreams, CommonTokenStream } from 'antlr4ts';
import { LPCLexer } from './antlr/LPCLexer';
import { LPCParser } from './antlr/LPCParser';
import * as vscode from 'vscode';
import { CollectingErrorListener } from './parser/CollectingErrorListener';

export interface ParsedDoc {
    version: number;
    tokens: CommonTokenStream;
    tree: ReturnType<LPCParser['sourceFile']>;
    diagnostics: vscode.Diagnostic[];
}

const cache = new Map<string, ParsedDoc>();

export function getParsed(document: vscode.TextDocument): ParsedDoc {
    const key = document.uri.toString();
    const existing = cache.get(key);
    if (existing && existing.version === document.version) {
        return existing;
    }

    const input = CharStreams.fromString(document.getText());
    const lexer = new LPCLexer(input);
    const tokens = new CommonTokenStream(lexer);
    const parser = new LPCParser(tokens);

    // Attach error listener to collect syntax errors
    const errorListener = new CollectingErrorListener(document);
    parser.removeErrorListeners();
    parser.addErrorListener(errorListener);

    const tree = parser.sourceFile();
    const parsed: ParsedDoc = { version: document.version, tokens, tree, diagnostics: errorListener.diagnostics };
    cache.set(key, parsed);
    return parsed;
} 