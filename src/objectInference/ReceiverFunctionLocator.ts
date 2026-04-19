import * as vscode from 'vscode';
import { SyntaxDocument, SyntaxKind, SyntaxNode } from '../syntax/types';
import { getRangeSize } from './ReceiverTraceSupport';

export class ReceiverFunctionLocator {
    public findContainingFunction(syntax: SyntaxDocument, position: vscode.Position): SyntaxNode | undefined {
        return [...syntax.nodes]
            .filter((node) => node.kind === SyntaxKind.FunctionDeclaration)
            .filter((node) => node.range.contains(position))
            .sort((left, right) => getRangeSize(left.range) - getRangeSize(right.range))[0];
    }
}
