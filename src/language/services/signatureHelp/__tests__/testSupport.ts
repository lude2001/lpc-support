import * as vscode from 'vscode';
import type { CallableDoc } from '../../../documentation/types';

export function createDocument(
    content: string,
    filePath = 'D:/workspace/signature-help.c',
    version = 1
): vscode.TextDocument {
    const normalized = content.replace(/\r\n/g, '\n');
    const lineStarts = [0];

    for (let index = 0; index < normalized.length; index += 1) {
        if (normalized[index] === '\n') {
            lineStarts.push(index + 1);
        }
    }

    const offsetAt = (position: vscode.Position): number => {
        const lineStart = lineStarts[position.line] ?? normalized.length;
        return Math.min(lineStart + position.character, normalized.length);
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

    const getWordRangeAtPosition = (position: vscode.Position): vscode.Range | undefined => {
        const lineText = normalized.split('\n')[position.line] ?? '';
        if (lineText.length === 0) {
            return undefined;
        }

        const isWordCharacter = (char: string | undefined): boolean => Boolean(char && /[A-Za-z0-9_]/.test(char));
        let anchor = Math.max(0, Math.min(position.character, lineText.length - 1));
        if (!isWordCharacter(lineText[anchor]) && position.character > 0 && isWordCharacter(lineText[position.character - 1])) {
            anchor = position.character - 1;
        }

        if (!isWordCharacter(lineText[anchor])) {
            return undefined;
        }

        let start = anchor;
        while (start > 0 && isWordCharacter(lineText[start - 1])) {
            start -= 1;
        }

        let end = anchor + 1;
        while (end < lineText.length && isWordCharacter(lineText[end])) {
            end += 1;
        }

        return new vscode.Range(position.line, start, position.line, end);
    };

    return {
        uri: vscode.Uri.file(filePath),
        fileName: filePath,
        languageId: 'lpc',
        version,
        lineCount: lineStarts.length,
        isDirty: false,
        isClosed: false,
        isUntitled: false,
        eol: vscode.EndOfLine.LF,
        getText: (range?: vscode.Range) => {
            if (!range) {
                return normalized;
            }

            return normalized.slice(offsetAt(range.start), offsetAt(range.end));
        },
        getWordRangeAtPosition,
        lineAt: (line: number) => ({
            text: normalized.split('\n')[line] ?? ''
        }),
        offsetAt,
        positionAt,
        save: async () => true,
        validateRange: (range: vscode.Range) => range,
        validatePosition: (position: vscode.Position) => position
    } as unknown as vscode.TextDocument;
}

export function positionAfter(source: string, marker: string, occurrence = 1): vscode.Position {
    let fromIndex = 0;
    let index = -1;

    for (let count = 0; count < occurrence; count += 1) {
        index = source.indexOf(marker, fromIndex);
        if (index < 0) {
            throw new Error(`Marker "${marker}" not found in source.`);
        }
        fromIndex = index + marker.length;
    }

    const offset = index + marker.length;
    const prefix = source.slice(0, offset);
    const line = prefix.split('\n').length - 1;
    const lastNewline = prefix.lastIndexOf('\n');
    const character = lastNewline >= 0 ? offset - lastNewline - 1 : offset;
    return new vscode.Position(line, character);
}

export function createCallableDoc(
    name: string,
    sourceKind: CallableDoc['sourceKind'],
    declarationKey: string,
    signatures: CallableDoc['signatures'],
    overrides: Partial<CallableDoc> = {}
): CallableDoc {
    return {
        name,
        declarationKey,
        signatures,
        sourceKind,
        ...overrides
    };
}
