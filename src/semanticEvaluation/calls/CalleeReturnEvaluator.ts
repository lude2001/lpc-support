import * as vscode from 'vscode';
import type { WorkspaceDocumentPathSupport } from '../../language/shared/WorkspaceDocumentPathSupport';
import { SyntaxKind, SyntaxNode } from '../../syntax/types';
import type { SemanticValue } from '../types';
import { unknownValue } from '../valueFactories';
import { CoreStaticEvaluator } from '../static/CoreStaticEvaluator';
import {
    createResolvedEnvironmentCallKey,
    createStaticEvaluationContext,
    type StaticEvaluationContext
} from '../static/StaticEvaluationContext';
import {
    bindEnvironmentValue,
    createValueEnvironment,
    type StaticEvaluationState
} from '../static/StaticEvaluationState';
import { ExpressionEvaluator } from '../static/ExpressionEvaluator';
import type { EnvironmentSemanticRegistry } from '../environment/EnvironmentSemanticRegistry';
import type { CallTargetResolver, ResolvedCallTarget } from './CallTargetResolver';

export interface CalleeReturnEvaluatorOptions {
    callTargetResolver?: Pick<CallTargetResolver, 'resolveCallTarget'>;
    environmentRegistry?: Pick<EnvironmentSemanticRegistry, 'evaluate'>;
    pathSupport?: Pick<WorkspaceDocumentPathSupport, 'getWorkspaceFolderRoot' | 'resolveObjectFilePath'>;
}

function collectDirectIdentifierCalls(root: SyntaxNode): SyntaxNode[] {
    const calls: SyntaxNode[] = [];
    const queue: SyntaxNode[] = [root];

    while (queue.length > 0) {
        const current = queue.shift()!;
        if (
            current.kind === SyntaxKind.CallExpression
            && current.children[0]?.kind === SyntaxKind.Identifier
        ) {
            calls.push(current);
        }

        queue.push(...current.children);
    }

    return calls;
}

function getArgumentExpressions(callExpression: SyntaxNode): readonly SyntaxNode[] {
    const argumentList = callExpression.children.find((child) => child.kind === SyntaxKind.ArgumentList);
    return argumentList?.children ?? [];
}

export class CalleeReturnEvaluator {
    private readonly callTargetResolver: Pick<CallTargetResolver, 'resolveCallTarget'>;
    private readonly environmentRegistry?: Pick<EnvironmentSemanticRegistry, 'evaluate'>;
    private readonly pathSupport?: Pick<WorkspaceDocumentPathSupport, 'getWorkspaceFolderRoot' | 'resolveObjectFilePath'>;

    public constructor(options: CalleeReturnEvaluatorOptions) {
        if (!options.callTargetResolver) {
            throw new Error('CalleeReturnEvaluator requires an injected CallTargetResolver');
        }

        this.callTargetResolver = options.callTargetResolver;
        this.environmentRegistry = options.environmentRegistry;
        this.pathSupport = options.pathSupport;
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

        const target = await this.callTargetResolver.resolveCallTarget(
            document,
            callExpression,
            callerContext,
            callerState
        );
        if (!target) {
            return unknownValue();
        }

        const resolvedDirectCalls = new Map<string, ResolvedCallTarget>();
        const resolvedEnvironmentCalls = new Map(callerContext.resolvedEnvironmentCalls ?? []);
        await this.collectResolvedCallSemantics(
            target,
            resolvedDirectCalls,
            resolvedEnvironmentCalls,
            new Set<string>(),
            callerContext.budget.maxCallDepth - nextCallDepth
        );

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
            resolvedDirectCalls,
            resolvedEnvironmentCalls,
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

    private async collectResolvedCallSemantics(
        target: ResolvedCallTarget,
        resolvedDirectCalls: Map<string, ResolvedCallTarget>,
        resolvedEnvironmentCalls: Map<string, SemanticValue>,
        visitedFunctions: Set<string>,
        remainingDepth: number
    ): Promise<void> {
        const targetKey = `${target.document.uri.toString()}|${target.functionSummary.name}`;
        if (visitedFunctions.has(targetKey)) {
            return;
        }

        visitedFunctions.add(targetKey);

        for (const directCall of collectDirectIdentifierCalls(target.functionNode)) {
            const directCallee = directCall.children[0];
            if (directCallee?.kind !== SyntaxKind.Identifier || !directCallee.name) {
                continue;
            }

            const argumentCount = getArgumentExpressions(directCall).length;
            const environmentCallKey = createResolvedEnvironmentCallKey(
                target.document.uri.toString(),
                directCallee.name,
                argumentCount
            );
            if (!resolvedEnvironmentCalls.has(environmentCallKey)) {
                const environmentValue = await this.evaluateEnvironmentCall(
                    target.document,
                    directCallee.name,
                    argumentCount
                );
                if (environmentValue) {
                    resolvedEnvironmentCalls.set(environmentCallKey, environmentValue);
                }
            }

            const nestedTarget = await this.callTargetResolver.resolveCallTarget(target.document, directCall);
            if (!nestedTarget) {
                continue;
            }

            if (!resolvedDirectCalls.has(directCallee.name)) {
                resolvedDirectCalls.set(directCallee.name, nestedTarget);
            }

            if (remainingDepth > 0) {
                await this.collectResolvedCallSemantics(
                    nestedTarget,
                    resolvedDirectCalls,
                    resolvedEnvironmentCalls,
                    visitedFunctions,
                    remainingDepth - 1
                );
            }
        }
    }

    private async evaluateEnvironmentCall(
        document: vscode.TextDocument,
        calleeName: string,
        argumentCount: number
    ): Promise<SemanticValue | undefined> {
        if (!this.environmentRegistry || !this.pathSupport) {
            return undefined;
        }

        return this.environmentRegistry.evaluate({
            document,
            calleeName,
            argumentCount,
            workspaceRoot: this.pathSupport.getWorkspaceFolderRoot(document),
            pathSupport: this.pathSupport
        });
    }
}
