import * as vscode from 'vscode';
import { parseFunctionDocs } from '../efun/docParser';
import { MacroManager } from '../macroManager';
import { SyntaxKind, SyntaxNode } from '../syntax/types';
import { PathResolver } from '../utils/pathResolver';
import { ClassifiedReceiver, ObjectCandidate } from './types';

export class ReturnObjectResolver {
    constructor(private readonly macroManager?: MacroManager) {}

    public async resolveExpression(
        document: vscode.TextDocument,
        expression: SyntaxNode
    ): Promise<ObjectCandidate[]> {
        if (expression.kind === SyntaxKind.ParenthesizedExpression && expression.children[0]) {
            return this.resolveExpression(document, expression.children[0]);
        }

        if (expression.kind === SyntaxKind.Literal) {
            const nodeText = this.getNodeText(document, expression);
            if (!this.isStringLiteral(nodeText)) {
                return [];
            }

            return this.resolvePathCandidate(document, nodeText, 'literal');
        }

        if (expression.kind === SyntaxKind.Identifier && expression.name) {
            if (!this.macroManager?.getMacro(expression.name)) {
                return [];
            }

            return this.resolvePathCandidate(document, expression.name, 'macro');
        }

        if (expression.kind !== SyntaxKind.CallExpression) {
            return [];
        }

        const callee = expression.children[0];
        const argumentList = expression.children[1];
        if (callee?.kind !== SyntaxKind.Identifier || !callee.name) {
            return [];
        }

        const builtinCandidates = await this.resolveCall(document, {
            kind: 'call',
            calleeName: callee.name,
            argumentCount: argumentList?.children.length ?? 0,
            firstArgument: argumentList?.children[0]
                ? this.getExpressionText(document, argumentList.children[0])
                : undefined,
            nodeText: this.getNodeText(document, expression)
        });
        if (builtinCandidates.length > 0 || this.isBuiltinCall(callee.name)) {
            return builtinCandidates;
        }

        return this.resolveDocumentedReturnObjects(document, callee.name);
    }

    public async resolveCall(
        document: vscode.TextDocument,
        receiver: Extract<ClassifiedReceiver, { kind: 'call' }>
    ): Promise<ObjectCandidate[]> {
        if (receiver.calleeName === 'this_object') {
            if (receiver.argumentCount !== 0) {
                return [];
            }

            return [{ path: document.fileName, source: 'builtin-call' }];
        }

        if (!['load_object', 'find_object', 'clone_object'].includes(receiver.calleeName)) {
            return [];
        }

        if (receiver.argumentCount !== 1 || !receiver.firstArgument) {
            return [];
        }

        const resolvedPath = await PathResolver.resolveObjectPath(document, receiver.firstArgument, this.macroManager);
        if (!resolvedPath) {
            return [];
        }

        return [{ path: resolvedPath, source: 'builtin-call' }];
    }

    private async resolveDocumentedReturnObjects(
        document: vscode.TextDocument,
        functionName: string
    ): Promise<ObjectCandidate[]> {
        const returnObjects = parseFunctionDocs(document.getText(), '当前文件').get(functionName)?.returnObjects;
        if (!returnObjects || returnObjects.length === 0) {
            return [];
        }

        const candidates: ObjectCandidate[] = [];
        for (const objectPath of returnObjects) {
            const resolvedPath = await PathResolver.resolveObjectPath(
                document,
                this.toObjectPathExpression(objectPath),
                this.macroManager
            );
            if (resolvedPath) {
                candidates.push({ path: resolvedPath, source: 'doc' });
            }
        }

        return candidates;
    }

    private async resolvePathCandidate(
        document: vscode.TextDocument,
        expression: string,
        source: ObjectCandidate['source']
    ): Promise<ObjectCandidate[]> {
        const resolvedPath = await PathResolver.resolveObjectPath(document, expression, this.macroManager);
        if (!resolvedPath) {
            return [];
        }

        return [{ path: resolvedPath, source }];
    }

    private isBuiltinCall(name: string): boolean {
        return ['this_object', 'load_object', 'find_object', 'clone_object'].includes(name);
    }

    private isStringLiteral(value: string): boolean {
        return value.length >= 2 && value.startsWith('"') && value.endsWith('"');
    }

    private getNodeText(document: vscode.TextDocument, node: SyntaxNode): string {
        return typeof node.metadata?.text === 'string'
            ? node.metadata.text
            : document.getText(node.range);
    }

    private getExpressionText(document: vscode.TextDocument, node: SyntaxNode): string {
        if (node.kind === SyntaxKind.ParenthesizedExpression && node.children[0]) {
            return this.getExpressionText(document, node.children[0]);
        }

        return this.getNodeText(document, node);
    }

    private toObjectPathExpression(objectPath: string): string {
        if (this.macroManager?.getMacro(objectPath)) {
            return objectPath;
        }

        return this.isStringLiteral(objectPath)
            ? objectPath
            : `"${objectPath}"`;
    }
}
