import { describe, expect, test } from '@jest/globals';
import { CodeActionDocumentSupport } from '../CodeActionDocumentSupport';
import { VariablePositionCodeActionBuilder } from '../VariablePositionCodeActionBuilder';
import { createDocument } from './testSupport';

describe('VariablePositionCodeActionBuilder', () => {
    const support = new CodeActionDocumentSupport();
    const builder = new VariablePositionCodeActionBuilder(support);

    test('builds move-to-block-start and move-to-function-start actions', () => {
        const document = createDocument([
            'void demo() {',
            '    if (ok) {',
            '        int value;',
            '    }',
            '}'
        ].join('\n'));
        const diagnostic = {
            range: {
                start: { line: 2, character: 8 },
                end: { line: 2, character: 13 }
            },
            severity: 'information',
            message: '局部变量声明位置不正确',
            code: 'localVariableDeclarationPosition',
            source: 'lpc'
        } as any;

        const actions = builder.build(document as any, diagnostic);

        expect(actions).toEqual(expect.arrayContaining([
            expect.objectContaining({ title: '移动变量声明到当前代码块开头' }),
            expect.objectContaining({ title: '移动变量声明到函数开头' })
        ]));
    });
});
