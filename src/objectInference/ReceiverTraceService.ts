import * as vscode from 'vscode';
import { SyntaxDocument, SyntaxNode } from '../syntax/types';
import { GlobalObjectBindingResolver } from './GlobalObjectBindingResolver';
import { InheritedGlobalObjectBindingResolver } from './InheritedGlobalObjectBindingResolver';
import { ObjectMethodReturnResolver } from './ObjectMethodReturnResolver';
import { ObjectCandidate, ObjectInferenceReason } from './types';
import { ObjectResolutionOutcome, ReturnObjectResolver } from './ReturnObjectResolver';
import { ReceiverFunctionLocator } from './ReceiverFunctionLocator';
import { ReceiverBindingResolver } from './ReceiverBindingResolver';
import { ReceiverFlowCollector } from './ReceiverFlowCollector';
import { ReceiverExpressionResolver } from './ReceiverExpressionResolver';
import { TracedReceiverResult } from './ReceiverTraceTypes';

export class ReceiverTraceService {
    private readonly functionLocator = new ReceiverFunctionLocator();
    private readonly bindingResolver = new ReceiverBindingResolver();
    private readonly flowCollector = new ReceiverFlowCollector(this.bindingResolver);
    private readonly expressionResolver: ReceiverExpressionResolver;

    constructor(
        private readonly returnObjectResolver: ReturnObjectResolver,
        private readonly objectMethodReturnResolver: ObjectMethodReturnResolver,
        private readonly globalBindingResolver: GlobalObjectBindingResolver,
        private readonly inheritedGlobalBindingResolver: InheritedGlobalObjectBindingResolver
    ) {
        this.expressionResolver = new ReceiverExpressionResolver({
            returnObjectResolver,
            objectMethodReturnResolver,
            globalBindingResolver,
            inheritedGlobalBindingResolver,
            identifierTracer: {
                traceIdentifierInFunction: this.traceIdentifierInFunction.bind(this)
            }
        });
    }

    public async traceIdentifier(
        document: vscode.TextDocument,
        syntax: SyntaxDocument,
        identifierNode: SyntaxNode
    ): Promise<TracedReceiverResult | undefined> {
        if (!identifierNode.name) {
            return undefined;
        }

        const containingFunction = this.functionLocator.findContainingFunction(syntax, identifierNode.range.start);
        if (!containingFunction) {
            return undefined;
        }

        const binding = this.bindingResolver.resolveVisibleBinding(
            containingFunction,
            identifierNode.name,
            identifierNode.range.start
        );

        return this.traceIdentifierInFunction(
            document,
            containingFunction,
            identifierNode.name,
            identifierNode.range.start,
            new Set<string>(),
            binding
        );
    }

    public async traceExpressionOutcome(
        document: vscode.TextDocument,
        syntax: SyntaxDocument,
        expression: SyntaxNode
    ): Promise<ObjectResolutionOutcome> {
        const containingFunction = this.functionLocator.findContainingFunction(syntax, expression.range.start);
        if (!containingFunction) {
            return this.returnObjectResolver.resolveExpressionOutcome(document, expression);
        }

        return this.expressionResolver.resolveSourceExpression(
            document,
            containingFunction,
            expression,
            expression.range.start,
            new Set<string>()
        );
    }

    public async traceIdentifierInFunction(
        document: vscode.TextDocument,
        functionNode: SyntaxNode,
        identifierName: string,
        usagePosition: vscode.Position,
        visited: Set<string>,
        binding: SyntaxNode | undefined = this.bindingResolver.resolveVisibleBinding(functionNode, identifierName, usagePosition)
    ): Promise<TracedReceiverResult> {
        const visitKey = `${this.bindingResolver.bindingKey(identifierName, binding)}@${usagePosition.line}:${usagePosition.character}`;
        if (visited.has(visitKey)) {
            return {
                candidates: [],
                hasVisibleBinding: binding !== undefined
            };
        }

        visited.add(visitKey);

        const sourceState = this.flowCollector.collectSourceExpressions(functionNode, identifierName, usagePosition, binding);
        const candidates: ObjectCandidate[] = [];
        const diagnostics = [] as NonNullable<ObjectResolutionOutcome['diagnostics']>;
        let reason: ObjectInferenceReason | undefined;
        let hasUnknownSource = sourceState.isConservativeUnknown;

        for (const expression of sourceState.expressions) {
            const outcome = await this.expressionResolver.resolveSourceExpression(
                document,
                functionNode,
                expression,
                usagePosition,
                visited
            );

            if (outcome.candidates.length === 0 && !outcome.reason && !outcome.diagnostics?.length) {
                hasUnknownSource = true;
            }

            candidates.push(...outcome.candidates);
            diagnostics.push(...(outcome.diagnostics ?? []));
            reason = reason ?? outcome.reason;
        }

        if (reason || hasUnknownSource) {
            return {
                candidates: [],
                reason,
                diagnostics: diagnostics.length > 0 ? diagnostics : undefined,
                hasVisibleBinding: binding !== undefined
            };
        }

        return {
            candidates,
            reason,
            diagnostics: diagnostics.length > 0 ? diagnostics : undefined,
            hasVisibleBinding: binding !== undefined
        };
    }
}
