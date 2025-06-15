import * as vscode from 'vscode';
import { CommonTokenStream } from 'antlr4ts';
import { LPCLexer } from './antlr/LPCLexer';
import { getParsed } from './parseCache';

export class LPCReferenceProvider implements vscode.ReferenceProvider {
    async provideReferences(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.ReferenceContext,
        _token: vscode.CancellationToken
    ): Promise<vscode.Location[]> {
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) return [];
        const word = document.getText(wordRange);

        const { tokens: tokenStream } = getParsed(document);

        const locations: vscode.Location[] = [];
        for (const tok of tokenStream.getTokens()) {
            if (tok.channel !== LPCLexer.DEFAULT_TOKEN_CHANNEL) continue;
            if (tok.type === LPCLexer.STRING_LITERAL || tok.type === LPCLexer.LINE_COMMENT || tok.type === LPCLexer.BLOCK_COMMENT) continue;
            if (tok.type === LPCLexer.Identifier && tok.text === word) {
                const startPos = document.positionAt(tok.startIndex);
                const endPos = document.positionAt(tok.stopIndex + 1);
                const loc = new vscode.Location(document.uri, new vscode.Range(startPos, endPos));
                // If includeDeclaration is false, filter out declaration tokens (simple heuristic: same line contains type keywords)
                if (!context.includeDeclaration) {
                    const lineText = document.lineAt(startPos.line).text;
                    const typeKeywordRegex = /\b(int|float|string|object|mixed|mapping|buffer|void|struct|class)\b/;
                    if (typeKeywordRegex.test(lineText) && lineText.indexOf(word) > lineText.indexOf(' ')) {
                        continue; // assume declaration
                    }
                }
                locations.push(loc);
            }
        }
        return locations;
    }
} 