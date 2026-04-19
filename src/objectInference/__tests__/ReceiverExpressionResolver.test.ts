import * as vscode from 'vscode';
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { ObjectCandidate } from '../types';
import { ReceiverExpressionResolver } from '../ReceiverExpressionResolver';
import {
    configureAstManagerSingletonForTests,
    resetAstManagerSingletonForTests
} from '../../__tests__/testAstManagerSingleton';
import { createTextDocument, findFirstCallExpression, findFunctionDeclaration, getSyntaxDocument } from './receiverTraceTestUtils';

describe('ReceiverExpressionResolver', () => {
    beforeEach(() => {
        configureAstManagerSingletonForTests();
    });

    afterEach(() => {
        resetAstManagerSingletonForTests();
        jest.restoreAllMocks();
    });

    test('routes receiver->method() through identifier tracing before object-method return resolution', async () => {
        const document = createTextDocument(
            'D:/workspace/receiver-expression.c',
            [
                'void demo() {',
                '    ob->factory();',
                '}'
            ].join('\n')
        );
        const syntax = getSyntaxDocument(document);
        const functionNode = findFunctionDeclaration(syntax);
        const callExpression = findFirstCallExpression(syntax);
        const tracedCandidates: ObjectCandidate[] = [{ path: '/obj/factory.c', source: 'assignment' }];
        const resolvedCandidates: ObjectCandidate[] = [{ path: '/obj/product.c', source: 'doc' }];

        const identifierTracer = {
            traceIdentifierInFunction: jest.fn().mockResolvedValue({
                candidates: tracedCandidates,
                hasVisibleBinding: true
            })
        };
        const objectMethodReturnResolver = {
            resolveMethodReturnOutcome: jest.fn().mockResolvedValue({
                candidates: resolvedCandidates
            })
        };
        const resolver = new ReceiverExpressionResolver({
            returnObjectResolver: {
                resolveExpressionOutcome: jest.fn().mockResolvedValue({ candidates: [] })
            } as any,
            objectMethodReturnResolver: objectMethodReturnResolver as any,
            globalBindingResolver: {
                resolveVisibleBinding: jest.fn()
            } as any,
            inheritedGlobalBindingResolver: {
                resolveInheritedBinding: jest.fn()
            } as any,
            identifierTracer
        });

        const result = await resolver.resolveSourceExpression(
            document,
            functionNode,
            callExpression,
            callExpression.range.start,
            new Set<string>()
        );

        expect(identifierTracer.traceIdentifierInFunction).toHaveBeenCalledWith(
            document,
            functionNode,
            'ob',
            expect.any(vscode.Position),
            expect.any(Set)
        );
        expect(objectMethodReturnResolver.resolveMethodReturnOutcome).toHaveBeenCalledWith(
            document,
            tracedCandidates,
            'factory'
        );
        expect(result.candidates).toEqual(resolvedCandidates);
    });
});
