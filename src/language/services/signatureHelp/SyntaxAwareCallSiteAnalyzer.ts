import * as vscode from 'vscode';
import type { LanguageRange } from '../../contracts/LanguagePosition';
import { assertAnalysisService } from '../../../semantic/assertAnalysisService';
import type { DocumentAnalysisService } from '../../../semantic/documentAnalysisService';
import { SyntaxKind, type SyntaxDocument, type SyntaxNode } from '../../../syntax/types';
import type { CallableDiscoveryRequest } from './LanguageSignatureHelpService';
import { compareRangeSize } from './SignatureHelpPresentationSupport';

export interface AnalyzedCallSite extends CallableDiscoveryRequest {
    parsed: SyntaxDocument['parsed'];
    callExpression: SyntaxNode;
    callee: SyntaxNode;
    argumentList?: SyntaxNode;
    closeParenTokenIndex: number;
}

export interface CallSiteAnalyzer {
    analyze(document: vscode.TextDocument, position: vscode.Position): AnalyzedCallSite | undefined;
}

export class SyntaxAwareCallSiteAnalyzer implements CallSiteAnalyzer {
    public constructor(
        private readonly analysisService: Pick<DocumentAnalysisService, 'getSyntaxDocument'>
    ) {}

    public analyze(document: vscode.TextDocument, position: vscode.Position): AnalyzedCallSite | undefined {
        const syntax = this.analysisService.getSyntaxDocument(document, false)
            ?? this.analysisService.getSyntaxDocument(document, true);
        if (!syntax) {
            return undefined;
        }
        const parsed = syntax.parsed;
        const candidates = [...syntax.nodes]
            .filter((node) => node.kind === SyntaxKind.CallExpression && node.range.contains(position))
            .sort((left, right) => compareRangeSize(left.range, right.range));

        for (const candidate of candidates) {
            const callee = candidate.children[0];
            const argumentList = candidate.children.find((child) => child.kind === SyntaxKind.ArgumentList);
            const calleeInfo = getCalleeInfo(callee);
            if (!callee || !calleeInfo) {
                continue;
            }

            const callBounds = getCallBoundaryTokens(parsed, candidate, callee);
            if (!callBounds || !isPositionInsideCallArguments(document, position, callBounds)) {
                continue;
            }

            return {
                document,
                position,
                callExpressionRange: candidate.range,
                calleeName: calleeInfo.name,
                callKind: calleeInfo.callKind,
                calleeLookupPosition: getCalleeLookupPosition(callee),
                parsed,
                callExpression: candidate,
                callee,
                argumentList,
                closeParenTokenIndex: callBounds.closeParen.tokenIndex
            };
        }

        return undefined;
    }
}

export function createSyntaxAwareCallSiteAnalyzer(
    analysisService?: Pick<DocumentAnalysisService, 'getSyntaxDocument'>
): SyntaxAwareCallSiteAnalyzer {
    return new SyntaxAwareCallSiteAnalyzer(assertAnalysisService('LanguageSignatureHelpService', analysisService));
}

export function countActiveParameterIndex(
    document: vscode.TextDocument,
    position: vscode.Position,
    analyzedCallSite: AnalyzedCallSite
): number {
    const { argumentList, closeParenTokenIndex, parsed } = analyzedCallSite;
    if (!argumentList || argumentList.children.length === 0) {
        return 0;
    }
    const cursorOffset = document.offsetAt(position);
    const separatorTokens = getTopLevelArgumentSeparators(parsed.visibleTokens, argumentList, closeParenTokenIndex);
    return separatorTokens.filter((token) => token.startIndex < cursorOffset).length;
}

function getCalleeInfo(
    callee: SyntaxNode | undefined
): { name: string; callKind: 'function' | 'objectMethod' | 'scopedMethod' } | undefined {
    if (!callee) {
        return undefined;
    }

    if (callee.kind === SyntaxKind.Identifier && callee.name) {
        return {
            name: callee.name,
            callKind: callee.metadata?.scopeQualifier === '::' ? 'scopedMethod' : 'function'
        };
    }

    if (callee.kind === SyntaxKind.MemberAccessExpression && callee.children.length >= 2) {
        const operator = callee.metadata?.operator;
        const memberNode = callee.children[1];
        if (memberNode?.kind !== SyntaxKind.Identifier || !memberNode.name) {
            return undefined;
        }

        return {
            name: memberNode.name,
            callKind: operator === '->'
                ? 'objectMethod'
                : operator === '::'
                    ? 'scopedMethod'
                    : 'function'
        };
    }

    return undefined;
}

function getCalleeLookupPosition(callee: SyntaxNode | undefined): vscode.Position | undefined {
    if (!callee) {
        return undefined;
    }

    if (callee.kind === SyntaxKind.MemberAccessExpression && callee.children.length >= 2) {
        return callee.children[1].range.start;
    }

    return callee.range.start;
}

function isPositionInsideCallArguments(
    document: vscode.TextDocument,
    position: vscode.Position,
    callBounds: { openParen: SyntaxDocument['parsed']['visibleTokens'][number]; closeParen: SyntaxDocument['parsed']['visibleTokens'][number] }
): boolean {
    const cursorOffset = document.offsetAt(position);
    return cursorOffset >= callBounds.openParen.stopIndex + 1 && cursorOffset <= callBounds.closeParen.startIndex;
}

function getCallBoundaryTokens(
    parsed: SyntaxDocument['parsed'],
    callExpression: SyntaxNode,
    callee: SyntaxNode
): { openParen: SyntaxDocument['parsed']['visibleTokens'][number]; closeParen: SyntaxDocument['parsed']['visibleTokens'][number] } | undefined {
    const candidateTokens = parsed.visibleTokens.filter((token) =>
        token.tokenIndex > callee.tokenRange.end
        && token.tokenIndex <= callExpression.tokenRange.end
    );
    const openParen = candidateTokens.find((token) => token.text === '(');
    const closeParen = [...candidateTokens].reverse().find((token) => token.text === ')');

    return openParen && closeParen ? { openParen, closeParen } : undefined;
}

function getTopLevelArgumentSeparators(
    visibleTokens: SyntaxDocument['parsed']['visibleTokens'],
    argumentList: SyntaxNode,
    closeParenTokenIndex: number
): SyntaxDocument['parsed']['visibleTokens'] {
    const expressions = [...argumentList.children].sort((left, right) => left.tokenRange.start - right.tokenRange.start);
    const separators: SyntaxDocument['parsed']['visibleTokens'] = [];

    for (let index = 0; index < expressions.length - 1; index += 1) {
        const separator = findVisibleTokenBetween(
            visibleTokens,
            expressions[index].tokenRange.end,
            expressions[index + 1].tokenRange.start,
            ','
        );
        if (separator) {
            separators.push(separator);
        }
    }

    if (argumentList.metadata?.hasTrailingComma === true) {
        const trailingSeparator = findVisibleTokenBetween(
            visibleTokens,
            expressions[expressions.length - 1].tokenRange.end,
            closeParenTokenIndex,
            ','
        );
        if (trailingSeparator) {
            separators.push(trailingSeparator);
        }
    }

    return separators;
}

function findVisibleTokenBetween(
    visibleTokens: SyntaxDocument['parsed']['visibleTokens'],
    startTokenIndex: number,
    endTokenIndex: number,
    text: string
) {
    return visibleTokens.find((token) =>
        token.tokenIndex > startTokenIndex
        && token.tokenIndex < endTokenIndex
        && token.text === text
    );
}
