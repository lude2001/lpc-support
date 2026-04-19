import * as vscode from 'vscode';
import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import { ReceiverBindingResolver } from '../ReceiverBindingResolver';
import {
    configureAstManagerSingletonForTests,
    resetAstManagerSingletonForTests
} from '../../__tests__/testAstManagerSingleton';
import { createTextDocument, findFunctionDeclaration, getSyntaxDocument } from './receiverTraceTestUtils';

describe('ReceiverBindingResolver', () => {
    const resolver = new ReceiverBindingResolver();

    beforeEach(() => {
        configureAstManagerSingletonForTests();
    });

    afterEach(() => {
        resetAstManagerSingletonForTests();
    });

    test('prefers the innermost visible local binding over the parameter', () => {
        const document = createTextDocument(
            'D:/workspace/receiver-binding.c',
            [
                'void demo(int value) {',
                '    if (1) {',
                '        int value = 2;',
                '        value;',
                '    }',
                '    value;',
                '}'
            ].join('\n')
        );
        const syntax = getSyntaxDocument(document);
        const functionNode = findFunctionDeclaration(syntax);

        const innerBinding = resolver.resolveVisibleBinding(functionNode, 'value', new vscode.Position(3, 10));
        const outerBinding = resolver.resolveVisibleBinding(functionNode, 'value', new vscode.Position(5, 6));

        expect(innerBinding?.kind).toBe('VariableDeclarator');
        expect(innerBinding?.range.start.line).toBe(2);
        expect(outerBinding?.kind).toBe('ParameterDeclaration');
        expect(outerBinding?.range.start.line).toBe(0);
    });
});
