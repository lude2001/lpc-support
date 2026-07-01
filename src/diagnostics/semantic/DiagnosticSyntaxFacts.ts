import { SyntaxKind, type SyntaxNode } from '../../syntax/types';
import type { DiagnosticCallableSignature } from './DiagnosticSymbolResolver';

export interface DirectDiagnosticCallSite {
    callee: SyntaxNode;
    arguments: readonly SyntaxNode[];
    argumentCount: number;
}

export function getDirectDiagnosticCallSite(callExpression: SyntaxNode): DirectDiagnosticCallSite | undefined {
    if (callExpression.kind !== SyntaxKind.CallExpression) {
        return undefined;
    }

    const callee = getDirectCallee(callExpression);
    if (!callee) {
        return undefined;
    }

    const args = getCallArguments(callExpression);
    if (!args) {
        return undefined;
    }

    return {
        callee,
        arguments: args,
        argumentCount: args.length
    };
}

export function acceptsDiagnosticArgumentCount(
    signature: DiagnosticCallableSignature,
    argumentCount: number
): boolean {
    if (argumentCount < signature.requiredParameterCount) {
        return false;
    }

    return signature.maxParameterCount === undefined
        || signature.isVariadic
        || argumentCount <= signature.maxParameterCount;
}

function getDirectCallee(callExpression: SyntaxNode): SyntaxNode | undefined {
    const firstChild = callExpression.children[0];
    if (
        firstChild?.kind === SyntaxKind.Identifier
        && firstChild.name
        && !firstChild.metadata?.scopeQualifier
    ) {
        return firstChild;
    }

    if (firstChild?.kind === SyntaxKind.MemberAccessExpression || firstChild?.metadata?.scopeQualifier) {
        return undefined;
    }

    if (typeof callExpression.name !== 'string') {
        return undefined;
    }

    return callExpression.children.find((child) =>
        child.kind === SyntaxKind.Identifier
        && child.name === callExpression.name
        && !child.metadata?.scopeQualifier
    );
}

function getCallArguments(callExpression: SyntaxNode): readonly SyntaxNode[] | undefined {
    const argumentList = callExpression.children.find((child) => child.kind === SyntaxKind.ArgumentList);
    if (!argumentList) {
        return [];
    }

    return argumentList.children.some((child) =>
        child.kind === SyntaxKind.SpreadElement || child.isMissing || child.isOpaque
    )
        ? undefined
        : argumentList.children;
}
