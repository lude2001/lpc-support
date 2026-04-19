import * as vscode from 'vscode';
import { SyntaxKind, SyntaxNode } from '../syntax/types';
import { GlobalObjectBindingResolver } from './GlobalObjectBindingResolver';
import { InheritedGlobalObjectBindingResolver } from './InheritedGlobalObjectBindingResolver';
import { ObjectMethodReturnResolver } from './ObjectMethodReturnResolver';
import { ObjectResolutionOutcome, ReturnObjectResolver } from './ReturnObjectResolver';
import { ReceiverIdentifierTraceResolver } from './ReceiverTraceTypes';

interface ReceiverExpressionResolverOptions {
    returnObjectResolver: ReturnObjectResolver;
    objectMethodReturnResolver: ObjectMethodReturnResolver;
    globalBindingResolver: GlobalObjectBindingResolver;
    inheritedGlobalBindingResolver: InheritedGlobalObjectBindingResolver;
    identifierTracer: ReceiverIdentifierTraceResolver;
}

export class ReceiverExpressionResolver {
    private readonly returnObjectResolver: ReturnObjectResolver;
    private readonly objectMethodReturnResolver: ObjectMethodReturnResolver;
    private readonly globalBindingResolver: GlobalObjectBindingResolver;
    private readonly inheritedGlobalBindingResolver: InheritedGlobalObjectBindingResolver;
    private readonly identifierTracer: ReceiverIdentifierTraceResolver;

    public constructor(options: ReceiverExpressionResolverOptions) {
        this.returnObjectResolver = options.returnObjectResolver;
        this.objectMethodReturnResolver = options.objectMethodReturnResolver;
        this.globalBindingResolver = options.globalBindingResolver;
        this.inheritedGlobalBindingResolver = options.inheritedGlobalBindingResolver;
        this.identifierTracer = options.identifierTracer;
    }

    public async resolveSourceExpression(
        document: vscode.TextDocument,
        functionNode: SyntaxNode,
        expression: SyntaxNode,
        usagePosition: vscode.Position,
        visited: Set<string>
    ): Promise<ObjectResolutionOutcome> {
        if (expression.kind === SyntaxKind.ParenthesizedExpression && expression.children[0]) {
            return this.resolveSourceExpression(document, functionNode, expression.children[0], usagePosition, visited);
        }

        const memberMethodOutcome = await this.resolveMemberMethodCallExpression(
            document,
            functionNode,
            expression,
            usagePosition,
            visited
        );
        if (memberMethodOutcome) {
            return memberMethodOutcome;
        }

        if (expression.kind === SyntaxKind.Identifier && expression.name) {
            return this.resolveIdentifierSourceOutcome(
                document,
                functionNode,
                expression,
                visited
            );
        }

        const directResolution = await this.returnObjectResolver.resolveExpressionOutcome(document, expression);
        if (directResolution.candidates.length > 0 || directResolution.reason || directResolution.diagnostics?.length) {
            return directResolution;
        }

        return { candidates: [] };
    }

    private async resolveMemberMethodCallExpression(
        document: vscode.TextDocument,
        functionNode: SyntaxNode,
        expression: SyntaxNode,
        usagePosition: vscode.Position,
        visited: Set<string>
    ): Promise<ObjectResolutionOutcome | undefined> {
        if (expression.kind !== SyntaxKind.CallExpression) {
            return undefined;
        }

        const callee = expression.children[0];
        if (
            callee?.kind !== SyntaxKind.MemberAccessExpression
            || callee.metadata?.operator !== '->'
            || callee.children[0] === undefined
            || callee.children[1]?.kind !== SyntaxKind.Identifier
            || !callee.children[1].name
        ) {
            return undefined;
        }

        const receiverOutcome = await this.resolveReceiverExpression(
            document,
            functionNode,
            callee.children[0],
            usagePosition,
            visited
        );
        if (receiverOutcome.candidates.length === 0) {
            if (receiverOutcome.reason || receiverOutcome.diagnostics?.length) {
                return receiverOutcome;
            }

            return { candidates: [] };
        }

        const methodOutcome = await this.objectMethodReturnResolver.resolveMethodReturnOutcome(
            document,
            receiverOutcome.candidates,
            callee.children[1].name
        );

        if (methodOutcome.candidates.length > 0 || methodOutcome.diagnostics?.length) {
            return methodOutcome;
        }

        return { candidates: [] };
    }

    private async resolveReceiverExpression(
        document: vscode.TextDocument,
        functionNode: SyntaxNode,
        expression: SyntaxNode,
        usagePosition: vscode.Position,
        visited: Set<string>
    ): Promise<ObjectResolutionOutcome> {
        if (expression.kind === SyntaxKind.ParenthesizedExpression && expression.children[0]) {
            return this.resolveReceiverExpression(document, functionNode, expression.children[0], usagePosition, visited);
        }

        if (expression.kind === SyntaxKind.Identifier && expression.name) {
            return this.resolveIdentifierSourceOutcome(document, functionNode, expression, visited);
        }

        return this.returnObjectResolver.resolveExpressionOutcome(document, expression);
    }

    private async resolveIdentifierSourceOutcome(
        document: vscode.TextDocument,
        functionNode: SyntaxNode,
        expression: SyntaxNode,
        visited: Set<string>
    ): Promise<ObjectResolutionOutcome> {
        const tracedIdentifier = await this.identifierTracer.traceIdentifierInFunction(
            document,
            functionNode,
            expression.name!,
            expression.range.start,
            visited
        );
        if (
            tracedIdentifier.candidates.length > 0
            || tracedIdentifier.reason
            || tracedIdentifier.diagnostics?.length
            || tracedIdentifier.hasVisibleBinding
        ) {
            return tracedIdentifier;
        }

        const globalBindingResult = await this.globalBindingResolver.resolveVisibleBinding(
            document,
            expression.name!,
            expression.range.start,
            {
                resolveInheritedIdentifier: (parentFile, name, visitedBindings) =>
                    this.inheritedGlobalBindingResolver.resolveInheritedBinding(
                        parentFile,
                        name,
                        undefined,
                        visitedBindings
                    )
            }
        );
        if (
            globalBindingResult
            && (
                globalBindingResult.candidates.length > 0
                || globalBindingResult.reason
                || globalBindingResult.diagnostics?.length
                || globalBindingResult.hasVisibleBinding
            )
        ) {
            return globalBindingResult;
        }

        const inheritedBindingResult = await this.inheritedGlobalBindingResolver.resolveInheritedBinding(
            document,
            expression.name!
        );
        if (
            inheritedBindingResult
            && (
                inheritedBindingResult.candidates.length > 0
                || inheritedBindingResult.reason
                || inheritedBindingResult.diagnostics?.length
                || inheritedBindingResult.hasVisibleBinding
            )
        ) {
            return inheritedBindingResult;
        }

        const directResolution = await this.returnObjectResolver.resolveExpressionOutcome(document, expression);
        if (directResolution.candidates.length > 0 || directResolution.reason || directResolution.diagnostics?.length) {
            return directResolution;
        }

        return { candidates: [] };
    }
}
