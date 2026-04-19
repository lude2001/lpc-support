import * as vscode from 'vscode';
import { assertAnalysisService } from '../../../semantic/assertAnalysisService';
import type { DocumentAnalysisService } from '../../../semantic/documentAnalysisService';
import { SyntaxKind, type SyntaxNode } from '../../../syntax/types';

export type ScopedMethodIdentifierAnalysisService = Pick<DocumentAnalysisService, 'getSyntaxDocument'>;

export function findScopedMethodIdentifierAtPosition(
    document: vscode.TextDocument,
    position: vscode.Position,
    analysisService: ScopedMethodIdentifierAnalysisService
): SyntaxNode | undefined {
    const resolvedAnalysisService = assertAnalysisService('findScopedMethodIdentifierAtPosition', analysisService);
    const syntax = resolvedAnalysisService.getSyntaxDocument(document, false)
        ?? resolvedAnalysisService.getSyntaxDocument(document, true);
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
    methodName: string,
    analysisService: ScopedMethodIdentifierAnalysisService
): boolean {
    const methodIdentifier = findScopedMethodIdentifierAtPosition(document, position, analysisService);
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
