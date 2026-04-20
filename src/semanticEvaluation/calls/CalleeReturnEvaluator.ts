import * as vscode from 'vscode';
import { SyntaxKind, SyntaxNode } from '../../syntax/types';
import type { SemanticValue } from '../types';
import { unknownValue } from '../valueFactories';
import { CoreStaticEvaluator } from '../static/CoreStaticEvaluator';
import {
    createStaticEvaluationContext,
    type StaticEvaluationContext
} from '../static/StaticEvaluationContext';
import {
    bindEnvironmentValue,
    createValueEnvironment,
    type StaticEvaluationState
} from '../static/StaticEvaluationState';
import { ExpressionEvaluator } from '../static/ExpressionEvaluator';
import type { CallTargetResolver } from './CallTargetResolver';

export interface CalleeReturnEvaluatorOptions {
    callTargetResolver?: Pick<CallTargetResolver, 'resolveCallTarget'>;
}

function getArgumentExpressions(callExpression: SyntaxNode): readonly SyntaxNode[] {
    const argumentList = callExpression.children.find((child) => child.kind === SyntaxKind.ArgumentList);
    return argumentList?.children ?? [];
}

export class CalleeReturnEvaluator {
    private readonly callTargetResolver: Pick<CallTargetResolver, 'resolveCallTarget'>;

    public constructor(options: CalleeReturnEvaluatorOptions) {
        if (!options.callTargetResolver) {
            throw new Error('CalleeReturnEvaluator requires an injected CallTargetResolver');
        }

        this.callTargetResolver = options.callTargetResolver;
    }

    public async evaluateCallExpression(
        document: vscode.TextDocument,
        callExpression: SyntaxNode,
        callerContext: StaticEvaluationContext,
        callerState: StaticEvaluationState
    ): Promise<SemanticValue> {
        const nextCallDepth = callerContext.metadata.callDepth + 1;
        if (nextCallDepth > callerContext.budget.maxCallDepth) {
            return unknownValue();
        }

        const target = await this.callTargetResolver.resolveCallTarget(document, callExpression);
        if (!target) {
            return unknownValue();
        }

        const callerExpressionEvaluator = new ExpressionEvaluator(callerContext);
        const argumentValues = getArgumentExpressions(callExpression).map((argument) =>
            callerExpressionEvaluator.evaluate(argument, callerState)
        );

        let initialEnvironment = createValueEnvironment();
        for (let index = 0; index < target.functionSummary.parameters.length; index += 1) {
            const parameter = target.functionSummary.parameters[index];
            initialEnvironment = bindEnvironmentValue(
                initialEnvironment,
                parameter.name,
                argumentValues[index] ?? unknownValue()
            );
        }

        const calleeContext = createStaticEvaluationContext({
            syntax: target.syntax,
            semantic: target.semantic,
            functionSummary: target.functionSummary,
            budget: callerContext.budget,
            metadata: {
                documentUri: target.document.uri.toString(),
                functionName: target.functionSummary.name,
                callDepth: nextCallDepth
            },
            initialEnvironment
        });

        return new CoreStaticEvaluator(calleeContext).evaluateFunction(target.functionNode);
    }
}
