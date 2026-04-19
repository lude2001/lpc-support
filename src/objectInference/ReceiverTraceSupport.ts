import * as vscode from 'vscode';
import { SyntaxNode } from '../syntax/types';

export function isBeforeOrEqual(left: vscode.Position, right: vscode.Position): boolean {
    return left.isBefore(right) || left.isEqual(right);
}

export function getRangeSize(range: vscode.Range): number {
    return (range.end.line - range.start.line) * 10_000 + (range.end.character - range.start.character);
}

export function sameBinding(left: SyntaxNode | undefined, right: SyntaxNode | undefined): boolean {
    return left === right;
}
