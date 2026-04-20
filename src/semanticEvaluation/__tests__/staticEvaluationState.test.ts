import {
    createStaticEvaluationBudget,
    createStaticEvaluationContext
} from '../static/StaticEvaluationContext';
import {
    appendReturnValue,
    bindEnvironmentValue,
    createControlFlowState,
    createReturnAccumulator,
    createStaticEvaluationState,
    createValueEnvironment,
    getEnvironmentValue,
    joinStaticEvaluationStates
} from '../static/StaticEvaluationState';
import {
    literalValue,
    objectValue
} from '../valueFactories';

describe('static evaluation state primitives', () => {
    test('binds and looks up values in the environment immutably', () => {
        const initialEnvironment = createValueEnvironment();
        const nextEnvironment = bindEnvironmentValue(
            initialEnvironment,
            'model_name',
            literalValue('login')
        );

        expect(getEnvironmentValue(initialEnvironment, 'model_name')).toBeUndefined();
        expect(getEnvironmentValue(nextEnvironment, 'model_name')).toEqual(literalValue('login'));
    });

    test('joins state shells without re-testing value join internals', () => {
        const left = createStaticEvaluationState({
            environment: bindEnvironmentValue(
                createValueEnvironment(),
                'model',
                objectValue('/adm/protocol/model/login_model')
            ),
            controlFlow: createControlFlowState({
                reachable: true,
                hasReturned: false,
                termination: 'none'
            })
        });
        const right = createStaticEvaluationState({
            environment: bindEnvironmentValue(
                createValueEnvironment(),
                'model',
                objectValue('/adm/protocol/model/classify_popup_model')
            ),
            controlFlow: createControlFlowState({
                reachable: true,
                hasReturned: true,
                termination: 'return'
            })
        });

        const joined = joinStaticEvaluationStates([left, right]);

        expect(getEnvironmentValue(joined.environment, 'model')).toEqual({
            kind: 'union',
            values: [
                {
                    kind: 'object',
                    path: '/adm/protocol/model/login_model'
                },
                {
                    kind: 'object',
                    path: '/adm/protocol/model/classify_popup_model'
                }
            ]
        });
        expect(joined.controlFlow).toEqual({
            reachable: true,
            hasReturned: false,
            termination: 'none'
        });
    });

    test('accumulates return values and exposes the joined result', () => {
        const accumulator = appendReturnValue(
            appendReturnValue(
                createReturnAccumulator(),
                objectValue('/adm/protocol/model/login_model')
            ),
            objectValue('/adm/protocol/model/classify_popup_model')
        );

        expect(accumulator.values).toEqual([
            {
                kind: 'object',
                path: '/adm/protocol/model/login_model'
            },
            {
                kind: 'object',
                path: '/adm/protocol/model/classify_popup_model'
            }
        ]);
        expect(accumulator.result).toEqual({
            kind: 'union',
            values: [
                {
                    kind: 'object',
                    path: '/adm/protocol/model/login_model'
                },
                {
                    kind: 'object',
                    path: '/adm/protocol/model/classify_popup_model'
                }
            ]
        });
    });

    test('creates contexts with budget metadata and initial state shell', () => {
        const context = createStaticEvaluationContext({
            budget: createStaticEvaluationBudget({
                maxCallDepth: 3,
                maxStatements: 64,
                maxBranches: 8,
                maxUnionSize: 4
            }),
            metadata: {
                documentUri: 'file:///adm/protocol/protocol_server.c',
                functionName: 'model_get',
                callDepth: 1
            },
            initialEnvironment: bindEnvironmentValue(
                createValueEnvironment(),
                'model_name',
                literalValue('login')
            )
        });

        expect(context.budget).toEqual({
            maxCallDepth: 3,
            maxStatements: 64,
            maxBranches: 8,
            maxUnionSize: 4
        });
        expect(context.metadata).toEqual({
            documentUri: 'file:///adm/protocol/protocol_server.c',
            functionName: 'model_get',
            callDepth: 1
        });
        expect(getEnvironmentValue(context.initialEnvironment, 'model_name')).toEqual({
            kind: 'literal',
            valueType: 'string',
            value: 'login'
        });
    });
});
