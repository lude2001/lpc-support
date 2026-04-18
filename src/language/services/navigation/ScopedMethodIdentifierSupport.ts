import * as vscode from 'vscode';
import { ASTManager } from '../../../ast/astManager';
import { SyntaxKind, type SyntaxNode } from '../../../syntax/types';

function getAstManager(): ASTManager {
    return ASTManager.getInstance();
}

export function findScopedMethodIdentifierAtPosition(
    document: vscode.TextDocument,
    position: vscode.Position
): SyntaxNode | undefined {
    const astManager = getAstManager();
    const syntax = astManager.getSyntaxDocument(document, false)
        ?? astManager.getSyntaxDocument(document, true);
    if (!syntax) {
        return undefined;
    }

    const scopedCallCandidates = [...syntax.nodes]
        .filter((node) => node.kind === SyntaxKind.CallExpression && node.range.contains(position))
        .sort((left, right) => compareScopedCallCandidates(document, left, right));

    for (const candidate of scopedCallCandidates) {
        const methodIdentifier = getScopedMethodIdentifier(candidate);
        if (methodIdentifier && methodIdentifier.range.contains(position)) {
            return methodIdentifier;
        }
    }

    return undefined;
}

export function isOnScopedMethodIdentifier(
    document: vscode.TextDocument,
    position: vscode.Position,
    methodName: string
): boolean {
    const methodIdentifier = findScopedMethodIdentifierAtPosition(document, position);
    return Boolean(methodIdentifier && methodIdentifier.name === methodName);
}

function getScopedMethodIdentifier(callExpression: SyntaxNode): SyntaxNode | undefined {
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

function compareScopedCallCandidates(
    document: vscode.TextDocument,
    left: SyntaxNode,
    right: SyntaxNode
): number {
    const leftSpan = getRangeSpanSize(document, left.range);
    const rightSpan = getRangeSpanSize(document, right.range);
    if (leftSpan !== rightSpan) {
        return leftSpan - rightSpan;
    }

    const leftStart = document.offsetAt(left.range.start);
    const rightStart = document.offsetAt(right.range.start);
    if (leftStart !== rightStart) {
        return leftStart - rightStart;
    }

    const leftEnd = document.offsetAt(left.range.end);
    const rightEnd = document.offsetAt(right.range.end);
    return leftEnd - rightEnd;
}

function getRangeSpanSize(document: vscode.TextDocument, range: vscode.Range): number {
    return document.offsetAt(range.end) - document.offsetAt(range.start);
}
