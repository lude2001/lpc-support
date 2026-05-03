import * as vscode from 'vscode';
import { getFormatterConfig } from '../config';

export interface SnippetRangeText {
    dedentedText: string;
    baseIndent: string;
}

export function detectLineEnding(text: string): string {
    return text.includes('\r\n') ? '\r\n' : '\n';
}

export function normalizeLineEndings(text: string, lineEnding: string): string {
    return text.replace(/\r\n|\r|\n/g, lineEnding);
}

export function prepareSnippetRange(
    document: vscode.TextDocument,
    range: vscode.Range
): SnippetRangeText | null {
    const text = document.getText(range);
    if (!text.trim()) {
        return null;
    }

    const lines = text.split(/\r?\n/);
    const firstNonEmptyLine = lines.find((line) => line.trim().length > 0);
    if (!firstNonEmptyLine) {
        return null;
    }

    const baseIndent = firstNonEmptyLine.match(/^[ \t]*/)?.[0] ?? '';
    const dedentedText = lines
        .map((line) => line.startsWith(baseIndent) ? line.slice(baseIndent.length) : line)
        .join('\n')
        .trim();

    return dedentedText ? { dedentedText, baseIndent } : null;
}

export function wrapSnippetInSyntheticBlock(text: string): string {
    return `void __lpc_range_wrapper__()\n{\n${text}\n}`;
}

export function extractAndReindentWrappedBody(formattedWrapper: string, baseIndent: string): string | null {
    const syntheticIndent = ' '.repeat(getFormatterConfig().indentSize);
    const bodyStart = formattedWrapper.indexOf('{\n');
    const bodyEnd = formattedWrapper.lastIndexOf('\n}');
    if (bodyStart < 0 || bodyEnd < 0 || bodyEnd <= bodyStart + 2) {
        return null;
    }

    return formattedWrapper
        .slice(bodyStart + 2, bodyEnd)
        .split('\n')
        .map((line) => {
            if (!line.length) {
                return line;
            }

            if (syntheticIndent.length > 0 && line.startsWith(syntheticIndent)) {
                return `${baseIndent}${line.slice(syntheticIndent.length)}`;
            }

            return line;
        })
        .join('\n');
}

export function reindentRangeReplacement(
    document: vscode.TextDocument,
    range: vscode.Range,
    text: string
): string {
    if (!text.includes('\n')) {
        return text;
    }

    const lineIndent = document.lineAt(range.start.line).text
        .slice(0, range.start.character)
        .match(/^[ \t]*/)?.[0] ?? '';
    if (!lineIndent) {
        return text;
    }

    const [firstLine, ...restLines] = text.split('\n');
    return [
        firstLine,
        ...restLines.map((line) => line.length > 0 ? `${lineIndent}${line}` : line)
    ].join('\n');
}

export function createSyntheticFormattingDocument(
    document: vscode.TextDocument,
    text: string,
    cacheKey = 'masked-document'
): vscode.TextDocument {
    const lines = text.split(/\r?\n/);
    const lineStarts = [0];
    const syntheticUri = vscode.Uri.parse(`${document.uri.toString()}?lpc-format=${cacheKey}-${document.version}`);

    for (let index = 0; index < text.length; index += 1) {
        if (text[index] === '\n') {
            lineStarts.push(index + 1);
        }
    }

    const offsetAt = (position: vscode.Position): number => {
        const lineStart = lineStarts[position.line] ?? text.length;
        return Math.min(lineStart + position.character, text.length);
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
        ...document,
        uri: syntheticUri,
        version: document.version,
        lineCount: lines.length,
        getText: (range?: vscode.Range) => {
            if (!range) {
                return text;
            }

            return text.slice(offsetAt(range.start), offsetAt(range.end));
        },
        positionAt,
        offsetAt
    };
}
