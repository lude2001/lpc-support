import * as vscode from 'vscode';
import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import { ReceiverBindingResolver } from '../ReceiverBindingResolver';
import { ReceiverFlowCollector } from '../ReceiverFlowCollector';
import {
    configureAstManagerSingletonForTests,
    resetAstManagerSingletonForTests
} from '../../__tests__/testAstManagerSingleton';
import { createTextDocument, findFunctionDeclaration, getSyntaxDocument } from './receiverTraceTestUtils';

describe('ReceiverFlowCollector', () => {
    const bindingResolver = new ReceiverBindingResolver();
    const collector = new ReceiverFlowCollector(bindingResolver);

    beforeEach(() => {
        configureAstManagerSingletonForTests();
    });

    afterEach(() => {
        resetAstManagerSingletonForTests();
    });

    test('merges if/else assignment source expressions for the same binding', () => {
        const document = createTextDocument(
            'D:/workspace/receiver-flow.c',
            [
                'void demo() {',
                '    object ob;',
                '    if (flag) {',
                '        ob = load_object("/obj/left");',
                '    } else {',
                '        ob = load_object("/obj/right");',
                '    }',
                '    ob->query();',
                '}'
            ].join('\n')
        );
        const syntax = getSyntaxDocument(document);
        const functionNode = findFunctionDeclaration(syntax);
        const binding = bindingResolver.resolveVisibleBinding(functionNode, 'ob', new vscode.Position(7, 6));
        const state = collector.collectSourceExpressions(functionNode, 'ob', new vscode.Position(7, 6), binding);

        expect(state.isConservativeUnknown).toBe(false);
        expect(state.expressions).toHaveLength(2);
        expect(state.expressions.map((expression) => expression.range.start.line)).toEqual([3, 5]);
    });

    test('downgrades to conservative unknown when unsupported control flow might write the tracked binding', () => {
        const document = createTextDocument(
            'D:/workspace/receiver-flow-loop.c',
            [
                'void demo() {',
                '    object ob;',
                '    while (flag) {',
                '        ob = load_object("/obj/left");',
                '    }',
                '    ob->query();',
                '}'
            ].join('\n')
        );
        const syntax = getSyntaxDocument(document);
        const functionNode = findFunctionDeclaration(syntax);
        const binding = bindingResolver.resolveVisibleBinding(functionNode, 'ob', new vscode.Position(5, 6));
        const state = collector.collectSourceExpressions(functionNode, 'ob', new vscode.Position(5, 6), binding);

        expect(state.expressions).toEqual([]);
        expect(state.isConservativeUnknown).toBe(true);
    });
});
