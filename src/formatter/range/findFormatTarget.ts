import * as vscode from 'vscode';
import { ParsedDocument } from '../../parser/types';
import { SyntaxBuilder } from '../../syntax/SyntaxBuilder';
import { SyntaxKind, SyntaxNode } from '../../syntax/types';
import { detectDelimitedTextBodyRange } from '../heredoc/heredocGuard';
import { FormatTarget } from '../types';

export function findFormatTarget(
    document: vscode.TextDocument,
    range: vscode.Range,
    parsed: ParsedDocument
): FormatTarget | null {
    if (range.isEmpty) {
        return null;
    }

    const normalizedRange = trimWhitespaceRange(document, range);
    if (!normalizedRange) {
        return null;
    }

    if (isDelimitedTextSelection(document, range, normalizedRange)) {
        return {
            kind: 'heredoc-body',
            range: normalizedRange
        };
    }

    const syntaxNodes = new SyntaxBuilder(parsed)
        .build()
        .nodes;
    const candidateNodes = syntaxNodes
        .filter((node) => node.kind !== 'SourceFile');
    const exactMatch = findMatchingNode(document, normalizedRange, candidateNodes);

    if (!exactMatch) {
        const punctuatedNode = findNodeWithTrailingMissingTokens(document, normalizedRange, candidateNodes);
        if (!punctuatedNode) {
            return null;
        }

        return {
            kind: 'node',
            range: punctuatedNode.range,
            node: punctuatedNode.node
        };
    }

    return {
        kind: 'node',
        range: exactMatch.range,
        node: exactMatch.node
    };
}

function isDelimitedTextSelection(
    document: vscode.TextDocument,
    originalRange: vscode.Range,
    normalizedRange: vscode.Range
): boolean {
    return detectDelimitedTextBodyRange(document, originalRange)
        || detectDelimitedTextBodyRange(document, normalizedRange);
}

function findMatchingNode(
    document: vscode.TextDocument,
    normalizedRange: vscode.Range,
    candidateNodes: SyntaxNode[]
): { node: SyntaxNode; range: vscode.Range } | undefined {
    const exactNode = candidateNodes.find((node) => rangesEqual(node.range, normalizedRange));
    if (exactNode) {
        return {
            node: exactNode,
            range: exactNode.range
        };
    }

    return findNodeWithLeadingTrivia(document, normalizedRange, candidateNodes)
        ?? findTextEquivalentNode(document, normalizedRange, candidateNodes);
}

function trimWhitespaceRange(document: vscode.TextDocument, range: vscode.Range): vscode.Range | null {
    const selectedText = document.getText(range);
    const firstContentIndex = selectedText.search(/\S/);
    if (firstContentIndex === -1) {
        return null;
    }

    let lastContentIndex = selectedText.length - 1;
    while (lastContentIndex >= 0 && /\s/.test(selectedText[lastContentIndex])) {
        lastContentIndex -= 1;
    }

    const startOffset = document.offsetAt(range.start) + firstContentIndex;
    const endOffset = document.offsetAt(range.start) + lastContentIndex + 1;

    return new vscode.Range(document.positionAt(startOffset), document.positionAt(endOffset));
}

function findTextEquivalentNode(
    document: vscode.TextDocument,
    normalizedRange: vscode.Range,
    nodes: SyntaxNode[]
): { node: SyntaxNode; range: vscode.Range } | undefined {
    const selectedText = normalizeComparableSelection(document.getText(normalizedRange).trim());
    const commentStrippedSelection = stripTrailingInlineComment(selectedText);
    const exactTextNode = nodes
        .filter((node) => rangesOverlap(node.range, normalizedRange))
        .filter((node) => normalizeComparableSelection(document.getText(node.range).trim()) === selectedText)
        .sort((left, right) => rangeLength(left.range) - rangeLength(right.range))[0];

    if (exactTextNode) {
        return {
            node: exactTextNode,
            range: exactTextNode.range
        };
    }

    if (!commentStrippedSelection || commentStrippedSelection === selectedText) {
        return undefined;
    }

    const commentStrippedNode = nodes
        .filter((node) => rangeContains(normalizedRange, node.range))
        .filter((node) => normalizeComparableSelection(document.getText(node.range).trim()) === commentStrippedSelection)
        .sort((left, right) => rangeLength(left.range) - rangeLength(right.range))[0];

    return commentStrippedNode
        ? {
            node: commentStrippedNode,
            range: commentStrippedNode.range
        }
        : undefined;
}

function findNodeWithLeadingTrivia(
    document: vscode.TextDocument,
    normalizedRange: vscode.Range,
    nodes: SyntaxNode[]
): { node: SyntaxNode; range: vscode.Range } | undefined {
    const selectedText = normalizeComparableSelection(document.getText(normalizedRange).trim());

    return nodes
        .map((node) => ({
            node,
            range: getNodeSelectableRange(node)
        }))
        .filter((candidate) => !rangesEqual(candidate.range, candidate.node.range))
        .filter((candidate) => rangesEqual(candidate.range, normalizedRange)
            || normalizeComparableSelection(document.getText(candidate.range).trim()) === selectedText)
        .sort((left, right) => rangeLength(left.range) - rangeLength(right.range))[0];
}

function getNodeSelectableRange(node: SyntaxNode): vscode.Range {
    const firstPreservableLeadingTrivia = node.leadingTrivia.find((trivia) => isPreservableTrivia(trivia.kind));
    if (!firstPreservableLeadingTrivia) {
        return node.range;
    }

    return new vscode.Range(firstPreservableLeadingTrivia.range.start, node.range.end);
}

function isPreservableTrivia(kind: string): boolean {
    return kind === 'line-comment' || kind === 'block-comment' || kind === 'directive';
}

function stripTrailingInlineComment(text: string): string {
    return text.replace(/\s*(?:\/\/.*|\/\*.*\*\/)\s*$/, '').trimEnd();
}

function normalizeComparableSelection(text: string): string {
    return stripTrailingListSeparator(stripTrailingInlineComment(text));
}

function stripTrailingListSeparator(text: string): string {
    return text.replace(/\s*,\s*$/, '').trimEnd();
}

function findNodeWithTrailingMissingTokens(
    document: vscode.TextDocument,
    normalizedRange: vscode.Range,
    nodes: SyntaxNode[]
): { node: SyntaxNode; range: vscode.Range } | undefined {
    const targetText = stripTrailingInlineComment(document.getText(normalizedRange).trim());
    if (!targetText) {
        return undefined;
    }

    const orderedNodes = nodes
        .filter((node) => rangeContains(normalizedRange, node.range))
        .sort((left, right) => compareRanges(left.range, right.range));

    for (const node of orderedNodes) {
        if (node.kind === SyntaxKind.Missing) {
            continue;
        }

        let combinedRange = node.range;
        let currentEnd = node.range.end;

        for (const candidate of orderedNodes) {
            if (candidate.kind !== SyntaxKind.Missing || !positionsEqual(candidate.range.start, currentEnd)) {
                continue;
            }

            combinedRange = new vscode.Range(node.range.start, candidate.range.end);
            currentEnd = candidate.range.end;
        }

        if (document.getText(combinedRange).trim() === targetText) {
            return {
                node,
                range: combinedRange
            };
        }
    }

    return undefined;
}

function rangesEqual(left: vscode.Range, right: vscode.Range): boolean {
    return positionsEqual(left.start, right.start) && positionsEqual(left.end, right.end);
}

function rangesOverlap(left: vscode.Range, right: vscode.Range): boolean {
    return comparePositions(left.end, right.start) > 0 && comparePositions(right.end, left.start) > 0;
}

function positionsEqual(left: vscode.Position, right: vscode.Position): boolean {
    return left.line === right.line && left.character === right.character;
}

function rangeContains(outer: vscode.Range, inner: vscode.Range): boolean {
    return comparePositions(outer.start, inner.start) <= 0 && comparePositions(outer.end, inner.end) >= 0;
}

function comparePositions(left: vscode.Position, right: vscode.Position): number {
    if (left.line !== right.line) {
        return left.line - right.line;
    }

    return left.character - right.character;
}

function rangeLength(range: vscode.Range): number {
    return ((range.end.line - range.start.line) * 1_000_000) + (range.end.character - range.start.character);
}

function compareRanges(left: vscode.Range, right: vscode.Range): number {
    return comparePositions(left.start, right.start) || comparePositions(left.end, right.end);
}
