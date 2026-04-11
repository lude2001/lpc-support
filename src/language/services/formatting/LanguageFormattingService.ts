import * as vscode from 'vscode';
import type { LanguageDocument } from '../../contracts/LanguageDocument';
import type { LanguageRange } from '../../contracts/LanguagePosition';
import type { LanguageTextEdit } from '../navigation/LanguageRenameService';
import { FormattingService } from '../../../formatter/FormattingService';

export interface LanguageFormattingDocumentRequest {
    document: LanguageDocument;
}

export interface LanguageFormattingRangeRequest {
    document: LanguageDocument;
    range: LanguageRange;
}

export interface LanguageFormattingService {
    formatDocument(request: LanguageFormattingDocumentRequest): Promise<LanguageTextEdit[]>;
    formatRange(request: LanguageFormattingRangeRequest): Promise<LanguageTextEdit[]>;
}

class DefaultLanguageFormattingService implements LanguageFormattingService {
    public constructor(private readonly formattingCore: FormattingService) {}

    public async formatDocument(request: LanguageFormattingDocumentRequest): Promise<LanguageTextEdit[]> {
        const edits = await this.formattingCore.formatDocument(createFormattingDocument(request.document));
        return toLanguageTextEdits(edits);
    }

    public async formatRange(request: LanguageFormattingRangeRequest): Promise<LanguageTextEdit[]> {
        const edits = await this.formattingCore.formatRange(
            createFormattingDocument(request.document),
            new vscode.Range(
                request.range.start.line,
                request.range.start.character,
                request.range.end.line,
                request.range.end.character
            )
        );
        return toLanguageTextEdits(edits);
    }
}

export function createLanguageFormattingService(
    formattingCore: FormattingService = new FormattingService()
): LanguageFormattingService {
    return new DefaultLanguageFormattingService(formattingCore);
}

function toLanguageTextEdits(edits: vscode.TextEdit[]): LanguageTextEdit[] {
    return edits.map((edit) => ({
        range: {
            start: {
                line: edit.range.start.line,
                character: edit.range.start.character
            },
            end: {
                line: edit.range.end.line,
                character: edit.range.end.character
            }
        },
        newText: edit.newText
    }));
}

function createFormattingDocument(document: LanguageDocument): vscode.TextDocument {
    const text = document.getText();
    const lines = text.split(/\r?\n/);
    const lineStarts = [0];

    for (let index = 0; index < text.length; index += 1) {
        if (text[index] === '\n') {
            lineStarts.push(index + 1);
        }
    }

    const uri = vscode.Uri.parse(document.uri);

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

    const lineAt = (lineOrPosition: number | vscode.Position): vscode.TextLine => {
        const line = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
        const textLine = lines[line] ?? '';
        return {
            lineNumber: line,
            text: textLine,
            range: new vscode.Range(line, 0, line, textLine.length),
            rangeIncludingLineBreak: new vscode.Range(line, 0, line + 1, 0),
            firstNonWhitespaceCharacterIndex: textLine.search(/\S/),
            isEmptyOrWhitespace: !/\S/.test(textLine)
        };
    };

    return {
        uri,
        fileName: uri.fsPath || document.uri,
        languageId: 'lpc',
        version: document.version,
        lineCount: lines.length,
        isDirty: false,
        isClosed: false,
        isUntitled: false,
        eol: vscode.EndOfLine.LF,
        getText: (range?: vscode.Range) => {
            if (!range) {
                return text;
            }

            return text.slice(offsetAt(range.start), offsetAt(range.end));
        },
        lineAt,
        positionAt,
        offsetAt,
        validateRange: (range: vscode.Range) => range,
        validatePosition: (position: vscode.Position) => position,
        getWordRangeAtPosition: (position: vscode.Position, regex?: RegExp) => {
            const lineText = lineAt(position.line).text;
            const wordRegex = regex ?? /[a-zA-Z_][a-zA-Z0-9_]*/g;
            const pattern = wordRegex.global ? wordRegex : new RegExp(wordRegex.source, `${wordRegex.flags}g`);
            for (const match of lineText.matchAll(pattern)) {
                const start = match.index ?? 0;
                const end = start + match[0].length;
                if (position.character >= start && position.character <= end) {
                    return new vscode.Range(position.line, start, position.line, end);
                }
            }

            return undefined;
        },
        save: async () => true
    } as unknown as vscode.TextDocument;
}
