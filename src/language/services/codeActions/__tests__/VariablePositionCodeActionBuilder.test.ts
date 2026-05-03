import { describe, expect, jest, test } from '@jest/globals';
import { CodeActionDocumentSupport } from '../CodeActionDocumentSupport';
import { VariablePositionCodeActionBuilder } from '../VariablePositionCodeActionBuilder';
import { SyntaxKind } from '../../../../syntax/types';
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

    test('uses syntax ranges for block and function discovery when available', () => {
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
                end: { line: 2, character: 18 }
            },
            severity: 'information',
            message: '局部变量声明位置不正确',
            code: 'localVariableDeclarationPosition',
            source: 'lpc'
        } as any;
        const syntax = {
            nodes: [
                {
                    kind: SyntaxKind.FunctionDeclaration,
                    range: {
                        start: { line: 0, character: 0 },
                        end: { line: 4, character: 1 }
                    }
                },
                {
                    kind: SyntaxKind.Block,
                    range: {
                        start: { line: 1, character: 12 },
                        end: { line: 3, character: 5 }
                    }
                }
            ]
        } as any;
        const supportSpy = new CodeActionDocumentSupport();
        jest.spyOn(supportSpy, 'findBlockStart');
        jest.spyOn(supportSpy, 'findFunctionStart');

        const actions = new VariablePositionCodeActionBuilder(supportSpy).build(document as any, diagnostic, syntax);

        expect(actions).toHaveLength(2);
        expect(supportSpy.findBlockStart).not.toHaveBeenCalled();
        expect(supportSpy.findFunctionStart).not.toHaveBeenCalled();
    });
});
