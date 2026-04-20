import * as vscode from 'vscode';
import type { DocumentAnalysisService } from '../semantic/documentAnalysisService';
import { SyntaxKind, SyntaxNode } from '../syntax/types';
import {
    WorkspaceDocumentPathSupport,
    assertDocumentPathSupport
} from '../language/shared/WorkspaceDocumentPathSupport';
import type { SemanticValue } from './types';
import { unknownValue } from './valueFactories';
import type { CalleeReturnEvaluator } from './calls/CalleeReturnEvaluator';
import { CallTargetResolver } from './calls/CallTargetResolver';
import type { EnvironmentSemanticRegistry } from './environment/EnvironmentSemanticRegistry';
import { ThisPlayerProvider } from './environment/ThisPlayerProvider';
import { RuntimeNonStaticProvider } from './environment/RuntimeNonStaticProvider';
import {
    createStaticEvaluationContext,
    type StaticEvaluationContext
} from './static/StaticEvaluationContext';
import {
    bindEnvironmentValue,
    createStaticEvaluationState,
    createValueEnvironment,
    type StaticEvaluationState
} from './static/StaticEvaluationState';
import { StatementTransfer } from './static/StatementTransfer';
import { ExpressionEvaluator } from './static/ExpressionEvaluator';
import { CalleeReturnEvaluator as DefaultCalleeReturnEvaluator } from './calls/CalleeReturnEvaluator';
import { EnvironmentSemanticRegistry as DefaultEnvironmentSemanticRegistry } from './environment/EnvironmentSemanticRegistry';
import type { LpcProjectConfigService } from '../projectConfig/LpcProjectConfigService';

export interface SemanticEvaluationOutcome {
    value: SemanticValue;
    source: 'natural' | 'environment' | 'unknown';
}

export interface SemanticEvaluationServiceOptions {
    analysisService?: Pick<DocumentAnalysisService, 'getSyntaxDocument' | 'getSemanticSnapshot'>;
    pathSupport?: WorkspaceDocumentPathSupport;
    calleeReturnEvaluator?: Pick<CalleeReturnEvaluator, 'evaluateCallExpression'>;
    environmentRegistry?: Pick<EnvironmentSemanticRegistry, 'evaluate'>;
}

export interface DefaultSemanticEvaluationServiceDependencies {
    analysisService?: Pick<DocumentAnalysisService, 'getSyntaxDocument' | 'getSemanticSnapshot'>;
    pathSupport?: WorkspaceDocumentPathSupport;
    playerObjectPath?: string;
    projectConfigService?: Pick<LpcProjectConfigService, 'loadForWorkspace'>;
}

interface ContainingFunctionEvaluation {
    context: StaticEvaluationContext;
    state: StaticEvaluationState;
}

function rangeSize(range: vscode.Range): number {
    return (range.end.line - range.start.line) * 10_000 + (range.end.character - range.start.character);
}

function getCallExpressionName(callExpression: SyntaxNode): string | undefined {
    const callee = callExpression.children[0];
    if (callee?.kind === SyntaxKind.Identifier && callee.name) {
        return callee.name;
    }

    return undefined;
}

function getArgumentCount(callExpression: SyntaxNode): number {
    return callExpression.children.find((child) => child.kind === SyntaxKind.ArgumentList)?.children.length ?? 0;
}

function createBudgetConsumer(maxStatements: number) {
    let remainingStatements = maxStatements;
    return () => {
        if (remainingStatements <= 0) {
            return false;
        }

        remainingStatements -= 1;
        return true;
    };
}

export class SemanticEvaluationService {
    private readonly analysisService: Pick<DocumentAnalysisService, 'getSyntaxDocument' | 'getSemanticSnapshot'>;
    private readonly pathSupport: WorkspaceDocumentPathSupport;
    private readonly calleeReturnEvaluator: Pick<CalleeReturnEvaluator, 'evaluateCallExpression'>;
    private readonly environmentRegistry: Pick<EnvironmentSemanticRegistry, 'evaluate'>;

    public constructor(options: SemanticEvaluationServiceOptions) {
        if (!options.analysisService) {
            throw new Error('SemanticEvaluationService requires an injected analysis service');
        }

        this.analysisService = options.analysisService;
        this.pathSupport = assertDocumentPathSupport('SemanticEvaluationService', options.pathSupport);
        if (!options.calleeReturnEvaluator) {
            throw new Error('SemanticEvaluationService requires an injected CalleeReturnEvaluator');
        }

        if (!options.environmentRegistry) {
            throw new Error('SemanticEvaluationService requires an injected EnvironmentSemanticRegistry');
        }

        this.calleeReturnEvaluator = options.calleeReturnEvaluator;
        this.environmentRegistry = options.environmentRegistry;
    }

    public async evaluateCallExpression(
        document: vscode.TextDocument,
        callExpression: SyntaxNode
    ): Promise<SemanticEvaluationOutcome> {
        const naturalValue = await this.evaluateNaturalReturn(document, callExpression);
        if (naturalValue.kind !== 'unknown') {
            return {
                value: naturalValue,
                source: 'natural'
            };
        }

        const environmentValue = await this.evaluateEnvironment(document, callExpression);
        if (environmentValue && environmentValue.kind !== 'unknown') {
            return {
                value: environmentValue,
                source: 'environment'
            };
        }

        return {
            value: unknownValue(),
            source: 'unknown'
        };
    }

    private async evaluateNaturalReturn(
        document: vscode.TextDocument,
        callExpression: SyntaxNode
    ): Promise<SemanticValue> {
        const containingFunction = this.resolveContainingFunctionEvaluation(document, callExpression);
        if (!containingFunction) {
            return unknownValue();
        }

        return this.calleeReturnEvaluator.evaluateCallExpression(
            document,
            callExpression,
            containingFunction.context,
            containingFunction.state
        );
    }

    private async evaluateEnvironment(
        document: vscode.TextDocument,
        callExpression: SyntaxNode
    ): Promise<SemanticValue | undefined> {
        const calleeName = getCallExpressionName(callExpression);
        if (!calleeName) {
            return undefined;
        }

        return this.environmentRegistry.evaluate({
            document,
            calleeName,
            argumentCount: getArgumentCount(callExpression),
            workspaceRoot: this.pathSupport.getWorkspaceFolderRoot(document),
            pathSupport: this.pathSupport
        });
    }

    private resolveContainingFunctionEvaluation(
        document: vscode.TextDocument,
        callExpression: SyntaxNode
    ): ContainingFunctionEvaluation | undefined {
        const syntax = this.analysisService.getSyntaxDocument(document, false)
            ?? this.analysisService.getSyntaxDocument(document, true);
        if (!syntax) {
            return undefined;
        }

        const semantic = this.analysisService.getSemanticSnapshot(document, false);
        const functionNode = syntax.nodes
            .filter((node) =>
                node.kind === SyntaxKind.FunctionDeclaration
                && node.range.contains(callExpression.range.start)
                && node.children.some((child) => child.kind === SyntaxKind.Block)
            )
            .sort((left, right) => rangeSize(left.range) - rangeSize(right.range))[0];
        if (!functionNode?.name) {
            return undefined;
        }

        const functionSummary = semantic.exportedFunctions.find((entry) =>
            entry.name === functionNode.name && entry.range.contains(callExpression.range.start)
        ) ?? semantic.exportedFunctions.find((entry) => entry.name === functionNode.name);
        if (!functionSummary) {
            return undefined;
        }

        let initialEnvironment = createValueEnvironment();
        for (const parameter of functionSummary.parameters) {
            initialEnvironment = bindEnvironmentValue(initialEnvironment, parameter.name, unknownValue());
        }

        const context = createStaticEvaluationContext({
            syntax,
            semantic,
            functionSummary,
            metadata: {
                documentUri: document.uri.toString(),
                functionName: functionSummary.name,
                callDepth: 0
            },
            initialEnvironment
        });
        const state = this.buildStateBeforeCall(functionNode, callExpression, context);
        if (!state) {
            return undefined;
        }

        return {
            context,
            state
        };
    }

    private buildStateBeforeCall(
        functionNode: SyntaxNode,
        callExpression: SyntaxNode,
        context: StaticEvaluationContext
    ): StaticEvaluationState | undefined {
        const blockNode = functionNode.children.find((child) => child.kind === SyntaxKind.Block);
        if (!blockNode) {
            return undefined;
        }

        const expressionEvaluator = new ExpressionEvaluator(context);
        const statementTransfer = new StatementTransfer(
            context,
            expressionEvaluator,
            createBudgetConsumer(context.budget.maxStatements)
        );
        let currentState = createStaticEvaluationState({
            environment: context.initialEnvironment
        });

        for (const child of blockNode.children) {
            if (!currentState.controlFlow.reachable || currentState.controlFlow.hasReturned) {
                break;
            }

            if (child.range.contains(callExpression.range.start)) {
                return currentState;
            }

            const nextState = statementTransfer.transfer(child, currentState);
            if (!nextState) {
                return undefined;
            }

            currentState = nextState;
        }

        return currentState;
    }
}

export function createDefaultSemanticEvaluationService(
    dependencies: DefaultSemanticEvaluationServiceDependencies
): SemanticEvaluationService {
    const pathSupport = assertDocumentPathSupport('SemanticEvaluationService', dependencies.pathSupport);
    if (!dependencies.analysisService) {
        throw new Error('SemanticEvaluationService requires an injected analysis service');
    }

    const callTargetResolver = new CallTargetResolver({
        analysisService: dependencies.analysisService,
        pathSupport
    });
    const calleeReturnEvaluator = new DefaultCalleeReturnEvaluator({
        callTargetResolver
    });
    const environmentRegistry = new DefaultEnvironmentSemanticRegistry([
        new ThisPlayerProvider({
            playerObjectPath: dependencies.playerObjectPath,
            projectConfigService: dependencies.projectConfigService
        }),
        new RuntimeNonStaticProvider()
    ]);

    return new SemanticEvaluationService({
        analysisService: dependencies.analysisService,
        pathSupport,
        calleeReturnEvaluator,
        environmentRegistry
    });
}
