import * as vscode from 'vscode';
import { ASTManager } from '../../ast/astManager';
import { SyntaxDocument, SyntaxKind, SyntaxNode } from '../../syntax/types';

export function createTextDocument(filePath: string, source: string, version = 1): vscode.TextDocument {
    const lines = source.split(/\r?\n/);
    const lineStarts = [0];

    for (let index = 0; index < source.length; index += 1) {
        if (source[index] === '\n') {
            lineStarts.push(index + 1);
        }
    }

    const offsetAt = (position: vscode.Position): number => {
        const lineStart = lineStarts[position.line] ?? source.length;
        return Math.min(lineStart + position.character, source.length);
    };

    const positionAt = (offset: number): vscode.Position => {
        let line = 0;
        for (let index = 0; index < lineStarts.length; index += 1) {
            if (lineStarts[index] <= offset) {
                line = index;
            } else {
                break;
            }
        }

        return new vscode.Position(line, offset - lineStarts[line]);
    };

    return {
        uri: vscode.Uri.file(filePath),
        fileName: filePath,
        languageId: 'lpc',
        version,
        lineCount: lines.length,
        isDirty: false,
        isClosed: false,
        isUntitled: false,
        eol: vscode.EndOfLine.LF,
        getText: (range?: vscode.Range) => {
            if (!range) {
                return source;
            }

            return source.slice(offsetAt(range.start), offsetAt(range.end));
        },
        lineAt: (line: number) => ({ text: lines[line] ?? '' }),
        getWordRangeAtPosition: (position: vscode.Position) => {
            const lineText = lines[position.line] ?? '';
            const isWordCharacter = (char: string | undefined) => Boolean(char && /[A-Za-z0-9_]/.test(char));

            let start = position.character;
            while (start > 0 && isWordCharacter(lineText[start - 1])) {
                start -= 1;
            }

            let end = position.character;
            while (end < lineText.length && isWordCharacter(lineText[end])) {
                end += 1;
            }

            if (start === end) {
                return undefined;
            }

            return new vscode.Range(position.line, start, position.line, end);
        },
        positionAt,
        offsetAt,
        save: async () => true,
        validateRange: (range: vscode.Range) => range,
        validatePosition: (position: vscode.Position) => position
    } as unknown as vscode.TextDocument;
}

export function getSyntaxDocument(document: vscode.TextDocument): SyntaxDocument {
    const syntax = ASTManager.getInstance().getSyntaxDocument(document, false)
        ?? ASTManager.getInstance().getSyntaxDocument(document, true);
    if (!syntax) {
        throw new Error('Expected syntax document for receiver trace test.');
    }

    return syntax;
}

export function findFunctionDeclaration(syntax: SyntaxDocument): SyntaxNode {
    const functionNode = [...syntax.nodes].find((node) => node.kind === SyntaxKind.FunctionDeclaration);
    if (!functionNode) {
        throw new Error('Expected function declaration in receiver trace test.');
    }

    return functionNode;
}

export function findFirstCallExpression(syntax: SyntaxDocument): SyntaxNode {
    const callExpression = [...syntax.nodes].find((node) => node.kind === SyntaxKind.CallExpression);
    if (!callExpression) {
        throw new Error('Expected call expression in receiver trace test.');
    }

    return callExpression;
}
