import * as vscode from 'vscode';
import { ASTManager } from '../../../../ast/astManager';
import type { ScopedMethodResolver } from '../../../../objectInference/ScopedMethodResolver';
import { SyntaxKind, type SyntaxNode } from '../../../../syntax/types';

interface ScopedMethodDefinitionResolverDependencies {
    astManager: ASTManager;
    scopedMethodResolver?: Pick<ScopedMethodResolver, 'resolveCallAt'>;
}

export class ScopedMethodDefinitionResolver {
    public constructor(private readonly dependencies: ScopedMethodDefinitionResolverDependencies) {}

    public async resolve(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<vscode.Location[] | undefined> {
        const scopedResolution = await this.dependencies.scopedMethodResolver?.resolveCallAt(document, position);
        if (!scopedResolution || !this.isOnScopedMethodIdentifier(document, position, scopedResolution.methodName)) {
            return undefined;
        }

        if (scopedResolution.status === 'resolved' || scopedResolution.status === 'multiple') {
            return scopedResolution.targets.map((target) => target.location);
        }

        return [];
    }

    private isOnScopedMethodIdentifier(
        document: vscode.TextDocument,
        position: vscode.Position,
        methodName: string
    ): boolean {
        const methodIdentifier = this.findScopedMethodIdentifierAtPosition(document, position);
        if (!methodIdentifier || methodIdentifier.name !== methodName) {
            return false;
        }

        return methodIdentifier.range.contains(position);
    }

    private findScopedMethodIdentifierAtPosition(
        document: vscode.TextDocument,
        position: vscode.Position
    ): SyntaxNode | undefined {
        const syntax = this.dependencies.astManager.getSyntaxDocument(document, false)
            ?? this.dependencies.astManager.getSyntaxDocument(document, true);
        if (!syntax) {
            return undefined;
        }

        const scopedCallCandidates = [...syntax.nodes]
            .filter((node) => node.kind === SyntaxKind.CallExpression && node.range.contains(position))
            .sort((left, right) => this.getRangeSize(left.range) - this.getRangeSize(right.range));

        for (const candidate of scopedCallCandidates) {
            const methodIdentifier = this.getScopedMethodIdentifier(candidate);
            if (methodIdentifier) {
                return methodIdentifier;
            }
        }

        return undefined;
    }

    private getScopedMethodIdentifier(callExpression: SyntaxNode): SyntaxNode | undefined {
        const callee = callExpression.children[0];
        if (!callee) {
            return undefined;
        }

        if (callee.kind === SyntaxKind.Identifier && callee.metadata?.scopeQualifier === '::' && callee.name) {
            return callee;
        }

        if (callee.kind !== SyntaxKind.MemberAccessExpression || callee.metadata?.operator !== '::') {
            return undefined;
        }

        const memberNode = callee.children[1];
        if (memberNode?.kind !== SyntaxKind.Identifier || !memberNode.name) {
            return undefined;
        }

        return memberNode;
    }

    private getRangeSize(range: vscode.Range): number {
        return (range.end.line - range.start.line) * 10_000 + (range.end.character - range.start.character);
    }
}
