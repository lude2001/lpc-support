import type { LanguageCapabilityContext } from '../../../contracts/LanguageCapabilityContext';

export function createDocument(source: string) {
    const lines = source.split(/\r?\n/);
    const lineStarts = [0];
    for (let index = 0; index < source.length; index += 1) {
        if (source[index] === '\n') {
            lineStarts.push(index + 1);
        }
    }

    const offsetAt = (line: number, character: number): number => {
        const lineStart = lineStarts[line] ?? source.length;
        return Math.min(lineStart + character, source.length);
    };

    return {
        uri: 'file:///D:/workspace/test.c',
        version: 1,
        getText: (range?: { start: { line: number; character: number }; end: { line: number; character: number } }) => {
            if (!range) {
                return source;
            }

            return source.slice(offsetAt(range.start.line, range.start.character), offsetAt(range.end.line, range.end.character));
        },
        lineAt: (lineOrPosition: number | { line: number }) => {
            const line = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
            const text = lines[line] ?? '';
            return {
                text,
                range: {
                    start: { line, character: 0 },
                    end: { line, character: text.length }
                },
                rangeIncludingLineBreak: {
                    start: { line, character: 0 },
                    end: { line, character: text.length + 1 }
                }
            };
        },
        positionAt: (offset: number) => {
            let line = 0;
            for (let index = 0; index < lineStarts.length; index += 1) {
                if (lineStarts[index] <= offset) {
                    line = index;
                } else {
                    break;
                }
            }

            return {
                line,
                character: offset - lineStarts[line]
            };
        }
    };
}

export function createContext(document: ReturnType<typeof createDocument>): LanguageCapabilityContext {
    return {
        document: document as any,
        workspace: {
            workspaceRoot: 'D:/workspace'
        },
        mode: 'lsp'
    };
}
