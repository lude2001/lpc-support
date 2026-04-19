import * as vscode from 'vscode';

export interface HoverResolvedMethodDocumentSource {
    path: string;
    documentText: string;
    document?: Partial<vscode.TextDocument>;
}

export function toDocumentationTextDocument(
    resolvedMethod: HoverResolvedMethodDocumentSource
): vscode.TextDocument {
    const candidate = resolvedMethod.document;
    if (isCompleteTextDocument(candidate)) {
        return candidate;
    }

    return createCompletedTextDocumentShim(
        resolvedMethod.path,
        resolvedMethod.documentText,
        candidate
    );
}

export function isCompleteTextDocument(
    document: Partial<vscode.TextDocument> | undefined
): document is vscode.TextDocument {
    return Boolean(
        document
        && typeof document.getText === 'function'
        && typeof document.fileName === 'string'
        && typeof document.version === 'number'
        && document.uri
        && typeof document.uri.toString === 'function'
    );
}

export function createCompletedTextDocumentShim(
    filePath: string,
    fallbackContent: string,
    baseDocument?: Partial<vscode.TextDocument>
): vscode.TextDocument {
    const rawContent = typeof baseDocument?.getText === 'function'
        ? baseDocument.getText()
        : fallbackContent;
    const normalized = rawContent.replace(/\r\n/g, '\n');
    const lineStarts = [0];
    const lines = normalized.split('\n');
    const hash = createSyntheticDocumentHash(normalized);
    const uri = createSyntheticDocumentationUri(filePath, hash);

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

    return {
        uri,
        fileName: filePath,
        languageId: baseDocument?.languageId ?? 'lpc',
        version: typeof baseDocument?.version === 'number' ? baseDocument.version : hash,
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
        lineAt: (line: number) => ({
            text: lines[line] ?? ''
        }),
        positionAt,
        offsetAt,
        save: async () => true,
        validateRange: (range: vscode.Range) => range,
        validatePosition: (position: vscode.Position) => position
    } as unknown as vscode.TextDocument;
}

export function createSyntheticDocumentHash(content: string): number {
    let hash = 0;
    for (let index = 0; index < content.length; index += 1) {
        hash = ((hash * 31) + content.charCodeAt(index)) >>> 0;
    }

    return hash;
}

export function createSyntheticDocumentationUri(filePath: string, hash: number): vscode.Uri {
    return {
        fsPath: filePath,
        toString: () => `lpc-hover-synthetic://${encodeURIComponent(filePath)}?v=${hash}`
    } as unknown as vscode.Uri;
}
