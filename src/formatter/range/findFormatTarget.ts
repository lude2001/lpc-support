import * as vscode from 'vscode';
import { ParsedDocument } from '../../parser/types';
import { SyntaxBuilder } from '../../syntax/SyntaxBuilder';
import { SyntaxNode } from '../../syntax/types';
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

    const candidateNodes = new SyntaxBuilder(parsed)
        .build()
        .nodes
        .filter((node) => node.kind !== 'SourceFile');
    const exactNode = findMatchingNode(document, normalizedRange, candidateNodes);

    if (!exactNode) {
        return null;
    }

    return {
        kind: 'node',
        range: exactNode.range,
        node: exactNode
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
): SyntaxNode | undefined {
    return candidateNodes.find((node) => rangesEqual(node.range, normalizedRange))
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
): SyntaxNode | undefined {
    const selectedText = document.getText(normalizedRange).trim();

    return nodes
        .filter((node) => rangesOverlap(node.range, normalizedRange))
        .filter((node) => document.getText(node.range).trim() === selectedText)
        .sort((left, right) => rangeLength(left.range) - rangeLength(right.range))[0];
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

function comparePositions(left: vscode.Position, right: vscode.Position): number {
    if (left.line !== right.line) {
        return left.line - right.line;
    }

    return left.character - right.character;
}

function rangeLength(range: vscode.Range): number {
    return ((range.end.line - range.start.line) * 1_000_000) + (range.end.character - range.start.character);
}
