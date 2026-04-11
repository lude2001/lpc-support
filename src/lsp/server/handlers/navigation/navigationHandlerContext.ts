import type { LanguageCapabilityContext } from '../../../../language/contracts/LanguageCapabilityContext';
import { DocumentStore } from '../../runtime/DocumentStore';
import { WorkspaceSession } from '../../runtime/WorkspaceSession';

export function createNavigationCapabilityContext(
    documentUri: string,
    documentStore: DocumentStore,
    workspaceSession: WorkspaceSession
): LanguageCapabilityContext {
    const storedDocument = documentStore.get(documentUri);
    const workspaceRoot = resolveWorkspaceRoot(documentUri, workspaceSession);

    return {
        document: createTextDocumentShim(documentUri, storedDocument),
        workspace: workspaceSession.toLanguageWorkspaceContext(workspaceRoot),
        mode: 'lsp',
        cancellation: {
            isCancellationRequested: false
        }
    };
}

function resolveWorkspaceRoot(documentUri: string, workspaceSession: WorkspaceSession): string {
    const workspaceRoots = workspaceSession.getWorkspaceRoots();
    if (workspaceRoots.length === 0) {
        return '';
    }

    const normalizedDocumentPath = normalizeComparablePath(fromFileUri(documentUri));
    const matchedWorkspaceRoot = workspaceRoots.reduce<string | undefined>((bestMatch, root) => {
        const normalizedRoot = normalizeComparablePath(root);
        if (!isPathPrefix(normalizedRoot, normalizedDocumentPath)) {
            return bestMatch;
        }

        if (!bestMatch) {
            return root;
        }

        return normalizedRoot.length > normalizeComparablePath(bestMatch).length ? root : bestMatch;
    }, undefined);
    return matchedWorkspaceRoot ?? workspaceRoots[0];
}

function createTextDocumentShim(
    documentUri: string,
    storedDocument: Readonly<{ uri: string; version: number; text: string }> | undefined
): LanguageCapabilityContext['document'] {
    const text = storedDocument?.text ?? '';
    const version = storedDocument?.version ?? 0;
    const fileName = fromFileUri(documentUri);
    const lines = text.split(/\r?\n/);
    const lineStarts = buildLineStarts(text);
    const uriLike = createUriLike(documentUri, fileName);

    return {
        uri: uriLike,
        version,
        fileName,
        languageId: 'lpc',
        lineCount: lines.length,
        getText: (range?: { start: { line: number; character: number }; end: { line: number; character: number } }) => {
            if (!range) {
                return text;
            }

            return text.slice(offsetAt(range.start, lineStarts, text), offsetAt(range.end, lineStarts, text));
        },
        getWordRangeAtPosition: (position: { line: number; character: number }) => {
            const lineText = lines[position.line] ?? '';
            if (lineText.length === 0) {
                return undefined;
            }

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

            return createHostRange(
                createHostPosition(position.line, start),
                createHostPosition(position.line, end)
            );
        },
        lineAt: (lineOrPosition: number | { line: number }) => {
            const line = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
            const lineText = lines[line] ?? '';
            const lineStart = lineStarts[line] ?? text.length;
            const lineEnd = lineStart + lineText.length;
            const range = createHostRange(
                createHostPosition(line, 0),
                createHostPosition(line, lineText.length)
            );

            return {
                lineNumber: line,
                text: lineText,
                range,
                rangeIncludingLineBreak: {
                    start: range.start,
                    end: createHostPosition(line, text[lineEnd] === '\n' ? lineText.length + 1 : lineText.length)
                },
                firstNonWhitespaceCharacterIndex: lineText.search(/\S|$/),
                isEmptyOrWhitespace: lineText.trim().length === 0
            };
        },
        offsetAt: (position: { line: number; character: number }) => offsetAt(position, lineStarts, text),
        positionAt: (offset: number) => {
            const safeOffset = Math.max(0, Math.min(offset, text.length));
            let line = 0;

            for (let index = 0; index < lineStarts.length; index += 1) {
                if (lineStarts[index] <= safeOffset) {
                    line = index;
                } else {
                    break;
                }
            }

            return createHostPosition(line, safeOffset - lineStarts[line]);
        }
    } as unknown as LanguageCapabilityContext['document'];
}

function createUriLike(uri: string, fileName: string): { fsPath: string; path: string; scheme: string; toString(): string } {
    return {
        fsPath: fileName,
        path: fileName.startsWith('/') ? fileName : `/${fileName}`,
        scheme: uri.startsWith('file://') ? 'file' : '',
        toString: () => uri
    };
}

function offsetAt(
    position: { line: number; character: number },
    lineStarts: number[],
    text: string
): number {
    const lineStart = lineStarts[position.line] ?? text.length;
    return Math.min(lineStart + position.character, text.length);
}

function buildLineStarts(text: string): number[] {
    const lineStarts = [0];

    for (let index = 0; index < text.length; index += 1) {
        if (text[index] === '\n') {
            lineStarts.push(index + 1);
        }
    }

    return lineStarts;
}

function isWordCharacter(char: string | undefined): boolean {
    return Boolean(char && /[A-Za-z0-9_]/.test(char));
}

function createHostPosition(line: number, character: number): { line: number; character: number } {
    return { line, character };
}

function createHostRange(
    start: { line: number; character: number },
    end: { line: number; character: number }
): { start: { line: number; character: number }; end: { line: number; character: number } } {
    return { start, end };
}

function fromFileUri(uri: string): string {
    if (!uri.startsWith('file://')) {
        return uri;
    }

    const decoded = decodeURIComponent(uri.replace(/^file:\/\/+/, '/'));
    return decoded.replace(/^\/([A-Za-z]:\/)/, '$1');
}

function normalizeComparablePath(path: string): string {
    const normalizedPath = path
        .replace(/\\/g, '/')
        .replace(/\/+$/, '');

    return isWindowsDrivePath(normalizedPath)
        ? normalizedPath.toLowerCase()
        : normalizedPath;
}

function isPathPrefix(root: string, candidate: string): boolean {
    return candidate === root || candidate.startsWith(`${root}/`);
}

function isWindowsDrivePath(path: string): boolean {
    return /^[A-Za-z]:\//.test(path);
}
