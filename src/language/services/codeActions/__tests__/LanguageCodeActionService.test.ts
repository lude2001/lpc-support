import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import type { LanguageCapabilityContext } from '../../../contracts/LanguageCapabilityContext';
import { createLanguageCodeActionService } from '../LanguageCodeActionService';

function createDocument(source: string) {
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

function createContext(document: ReturnType<typeof createDocument>): LanguageCapabilityContext {
    return {
        document: document as any,
        workspace: {
            workspaceRoot: 'D:/workspace'
        },
        mode: 'lsp'
    };
}

describe('LanguageCodeActionService', () => {
    test('returns precise unused-variable quick fixes from diagnostics data', async () => {
        const source = 'int unused;\n';
        const document = createDocument(source);
        const service = createLanguageCodeActionService();

        const actions = await service.provideCodeActions({
            context: createContext(document),
            range: {
                start: { line: 0, character: 4 },
                end: { line: 0, character: 10 }
            },
            diagnostics: [
                {
                    range: {
                        start: { line: 0, character: 4 },
                        end: { line: 0, character: 10 }
                    },
                    severity: 'information',
                    message: "局部变量 'unused' 未被使用",
                    code: 'unusedVar',
                    source: 'lpc',
                    data: {
                        kind: 'var',
                        start: 4,
                        end: 10
                    }
                }
            ]
        });

        expect(actions).toEqual(expect.arrayContaining([
            expect.objectContaining({
                title: '删除未使用的变量',
                kind: 'quickfix',
                edit: {
                    changes: {
                        'file:///D:/workspace/test.c': [
                            {
                                range: {
                                    start: { line: 0, character: 0 },
                                    end: { line: 0, character: 12 }
                                },
                                newText: ''
                            }
                        ]
                    }
                }
            }),
            expect.objectContaining({
                title: '注释未使用的变量',
                kind: 'quickfix'
            })
        ]));
    });

    test('returns rename command suggestions for snake_case and camelCase quick fixes', async () => {
        const source = 'int MyValue_test;\n';
        const document = createDocument(source);
        const service = createLanguageCodeActionService();

        const actions = await service.provideCodeActions({
            context: createContext(document),
            range: {
                start: { line: 0, character: 4 },
                end: { line: 0, character: 16 }
            },
            diagnostics: [
                {
                    range: {
                        start: { line: 0, character: 4 },
                        end: { line: 0, character: 16 }
                    },
                    severity: 'information',
                    message: "局部变量 'MyValue_test' 未被使用",
                    code: 'unusedVar',
                    source: 'lpc'
                }
            ]
        });

        expect(actions).toEqual(expect.arrayContaining([
            expect.objectContaining({
                title: '改名为蛇形: _my_value_test',
                command: expect.objectContaining({
                    command: 'lpc.renameVarToSnakeCase'
                })
            }),
            expect.objectContaining({
                title: '改名为驼峰: MyValueTest',
                command: expect.objectContaining({
                    command: 'lpc.renameVarToCamelCase'
                })
            })
        ]));
    });
});
