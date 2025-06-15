import * as vscode from 'vscode';
import { getParsed } from './parseCache';
import { LPCLexer } from './antlr/LPCLexer';

export class LPCRenameProvider implements vscode.RenameProvider {
    async prepareRename(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): Promise<vscode.Range | undefined> {
        const wordRange = document.getWordRangeAtPosition(position);
        return wordRange; // allow rename if have word
    }

    async provideRenameEdits(
        document: vscode.TextDocument,
        position: vscode.Position,
        newName: string,
        _token: vscode.CancellationToken
    ): Promise<vscode.WorkspaceEdit> {
        const edit = new vscode.WorkspaceEdit();
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) return edit;
        const oldName = document.getText(wordRange);

        const { tokens: tokenStream } = getParsed(document);

        for (const tok of tokenStream.getTokens()) {
            if (tok.channel !== LPCLexer.DEFAULT_TOKEN_CHANNEL) continue;
            if (tok.type === LPCLexer.STRING_LITERAL || tok.type === LPCLexer.LINE_COMMENT || tok.type === LPCLexer.BLOCK_COMMENT) continue;
            if (tok.type === LPCLexer.Identifier && tok.text === oldName) {
                const start = document.positionAt(tok.startIndex);
                const end = document.positionAt(tok.stopIndex + 1);
                edit.replace(document.uri, new vscode.Range(start, end), newName);
            }
        }
        return edit;
    }
} 