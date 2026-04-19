import { describe, expect, test } from '@jest/globals';
import { CodeActionDocumentSupport } from '../CodeActionDocumentSupport';
import { UnusedVariableCodeActionBuilder } from '../UnusedVariableCodeActionBuilder';
import { createDocument } from './testSupport';

describe('UnusedVariableCodeActionBuilder', () => {
    const support = new CodeActionDocumentSupport();
    const builder = new UnusedVariableCodeActionBuilder(support);

    test('builds remove and comment actions for unused variables', () => {
        const document = createDocument('int unused;\n');
        const diagnostic = {
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
        } as any;

        const actions = builder.build(document as any, diagnostic);

        expect(actions).toEqual(expect.arrayContaining([
            expect.objectContaining({ title: '删除未使用的变量' }),
            expect.objectContaining({ title: '注释未使用的变量' }),
            expect.objectContaining({ title: '将变量标记为全局变量' })
        ]));
    });

    test('builds rename command suggestions for snake_case and camelCase', () => {
        const document = createDocument('int MyValue_test;\n');
        const diagnostic = {
            range: {
                start: { line: 0, character: 4 },
                end: { line: 0, character: 16 }
            },
            severity: 'information',
            message: "局部变量 'MyValue_test' 未被使用",
            code: 'unusedVar',
            source: 'lpc'
        } as any;

        const actions = builder.build(document as any, diagnostic);

        expect(actions).toEqual(expect.arrayContaining([
            expect.objectContaining({
                title: '改名为蛇形: _my_value_test',
                command: expect.objectContaining({ command: 'lpc.renameVarToSnakeCase' })
            }),
            expect.objectContaining({
                title: '改名为驼峰: MyValueTest',
                command: expect.objectContaining({ command: 'lpc.renameVarToCamelCase' })
            })
        ]));
    });
});
