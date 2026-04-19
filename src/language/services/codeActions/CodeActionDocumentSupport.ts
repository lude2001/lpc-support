import type { LanguageRange, LanguageWorkspaceEdit, LanguageTextEdit, RangeReadableDocument } from './types';

export class CodeActionDocumentSupport {
    public createWorkspaceEdit(uri: string, edits: LanguageTextEdit[]): LanguageWorkspaceEdit {
        return {
            changes: {
                [uri]: edits
            }
        };
    }

    public createLineRange(document: RangeReadableDocument, line: number, textLength: number): LanguageRange {
        return {
            start: { line, character: 0 },
            end: { line, character: textLength }
        };
    }

    public createLineRangeIncludingBreak(document: RangeReadableDocument, line: number, textLength: number): LanguageRange {
        return {
            start: { line, character: 0 },
            end: { line, character: textLength + 1 }
        };
    }

    public shouldDeleteEntireLine(newLineText: string): boolean {
        return /^\s*[a-zA-Z_][a-zA-Z0-9_]*\s*\*?\s*;?\s*$/.test(newLineText) || newLineText.trim() === '';
    }

    public toSnakeCase(name: string): string {
        return name
            .replace(/([A-Z])/g, '_$1')
            .replace(/__/g, '_')
            .toLowerCase();
    }

    public toCamelCase(name: string): string {
        return name.replace(/_([a-zA-Z])/g, (_, g1: string) => g1.toUpperCase());
    }

    public getLineIndentation(document: RangeReadableDocument, lineNumber: number): string {
        const line = document.lineAt(lineNumber);
        const match = line.text.match(/^(\s*)/);
        return match ? match[1] : '';
    }

    public findBlockStart(document: RangeReadableDocument, lineNumber: number): number {
        let braceCount = 0;

        for (let line = lineNumber; line >= 0; line -= 1) {
            const lineText = document.lineAt(line).text;
            for (let index = lineText.length - 1; index >= 0; index -= 1) {
                const char = lineText[index];
                if (char === '}') {
                    braceCount += 1;
                } else if (char === '{') {
                    if (braceCount === 0) {
                        return line;
                    }
                    braceCount -= 1;
                }
            }
        }

        return -1;
    }

    public findFunctionStart(document: RangeReadableDocument, lineNumber: number): number {
        for (let line = lineNumber; line >= 0; line -= 1) {
            const lineText = document.lineAt(line).text.trim();
            if (/^(?:(?:public|private|protected|static|nosave|varargs)\s+)*(?:int|string|object|mixed|void|float|mapping|status)\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\([^)]*\)/.test(lineText)) {
                return line;
            }
        }

        return -1;
    }

    public isVariableDeclaration(lineText: string): boolean {
        return /^\s*(?:(?:public|private|protected|static|nosave)\s+)*(?:int|string|object|mixed|void|float|mapping|status)\s+[a-zA-Z_][a-zA-Z0-9_*\s,]*;/.test(lineText);
    }
}
