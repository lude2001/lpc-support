import { describe, expect, test } from '@jest/globals';
import { createLanguageCodeActionService } from '../LanguageCodeActionService';
import { createContext, createDocument } from './testSupport';

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
