import * as vscode from 'vscode';
import { composeLpcType } from '../../ast/typeNormalization';
import type { DocumentAnalysisService } from '../../semantic/documentAnalysisService';
import { SyntaxDocument, SyntaxKind, SyntaxNode } from '../../syntax/types';
import type { FunctionInfo } from '../../types/functionInfo';

export class FunctionInfoExtractor {
    public constructor(
        private readonly analysisService: Pick<DocumentAnalysisService, 'getSyntaxDocument'>
    ) {}

    public parseFunctionFromSelection(
        document: vscode.TextDocument,
        selection: vscode.Selection
    ): FunctionInfo | undefined {
        if (!document.getText(selection).trim()) {
            return undefined;
        }

        const functionNode = this.findFunctionContainingRange(
            this.getSyntaxDocument(document),
            selection.start,
            selection.end
        );
        return functionNode ? this.extractFunctionInfo(document, functionNode) : undefined;
    }

    public parseFunctionFromCursor(
        document: vscode.TextDocument,
        position: vscode.Position
    ): FunctionInfo | undefined {
        const functionNode = this.findFunctionContainingPosition(this.getSyntaxDocument(document), position);
        return functionNode ? this.extractFunctionInfo(document, functionNode) : undefined;
    }

    private getSyntaxDocument(document: vscode.TextDocument): SyntaxDocument {
        const syntax = this.analysisService.getSyntaxDocument(document, false)
            ?? this.analysisService.getSyntaxDocument(document, true);
        if (!syntax) {
            throw new Error('无法解析当前 LPC 文档');
        }

        return syntax;
    }

    private getFunctionDeclarations(syntax: SyntaxDocument): SyntaxNode[] {
        return syntax.nodes
            .filter((node) => node.kind === SyntaxKind.FunctionDeclaration)
            .filter(hasFunctionBody)
            .sort((left, right) => compareRanges(left.range, right.range));
    }

    private findFunctionContainingRange(
        syntax: SyntaxDocument,
        start: vscode.Position,
        end: vscode.Position
    ): SyntaxNode | undefined {
        return this.getFunctionDeclarations(syntax)
            .find((node) => node.range.contains(start) && node.range.contains(end));
    }

    private findFunctionContainingPosition(
        syntax: SyntaxDocument,
        position: vscode.Position
    ): SyntaxNode | undefined {
        return this.getFunctionDeclarations(syntax)
            .find((node) => node.range.contains(position));
    }

    private extractFunctionInfo(
        document: vscode.TextDocument,
        functionNode: SyntaxNode
    ): FunctionInfo {
        const name = functionNode.name || 'function';
        const returnType = getFunctionReturnType(functionNode);
        const paramText = getParameterText(document, functionNode);
        const body = getFunctionBodyText(document, functionNode);
        const fullText = document.getText(functionNode.range);
        const comment = functionNode.attachedDocComment?.text ?? '';

        return {
            name,
            definition: `${returnType}${returnType.endsWith('*') ? '' : ' '}${name}${paramText}`,
            returnType,
            parameters: getParameters(functionNode),
            body,
            fullText,
            comment,
            briefDescription: extractBriefDescription(comment),
            source: '当前文件',
            filePath: document.fileName,
            line: functionNode.range.start.line
        };
    }
}

function getFunctionReturnType(functionNode: SyntaxNode): string {
    const typeReference = functionNode.children.find((child) => child.kind === SyntaxKind.TypeReference);
    if (!typeReference) {
        return 'void';
    }

    return composeLpcType(getTypeText(typeReference), readNumber(functionNode, 'pointerCount'));
}

function getParameterText(document: vscode.TextDocument, functionNode: SyntaxNode): string {
    const parameterList = functionNode.children.find((child) => child.kind === SyntaxKind.ParameterList);
    return parameterList ? `(${document.getText(parameterList.range).trim()})` : '()';
}

function getFunctionBodyText(document: vscode.TextDocument, functionNode: SyntaxNode): string {
    const body = functionNode.children.find((child) => child.kind === SyntaxKind.Block);
    return body ? document.getText(body.range) : '';
}

function getParameters(functionNode: SyntaxNode): Array<{ type: string; name: string }> {
    const parameterList = functionNode.children.find((child) => child.kind === SyntaxKind.ParameterList);
    if (!parameterList) {
        return [];
    }

    return parameterList.children
        .filter((child) => child.kind === SyntaxKind.ParameterDeclaration)
        .map((parameter) => {
            const typeReference = parameter.children.find((child) => child.kind === SyntaxKind.TypeReference);
            return {
                type: typeReference
                    ? composeLpcType(getTypeText(typeReference), readNumber(parameter, 'pointerCount'))
                    : 'mixed',
                name: parameter.name ?? ''
            };
        })
        .filter((parameter) => parameter.name.length > 0);
}

function getTypeText(typeReference: SyntaxNode): string {
    const text = typeReference.metadata?.text;
    return typeof text === 'string' && text.trim()
        ? text.trim()
        : typeReference.name ?? 'mixed';
}

function hasFunctionBody(functionNode: SyntaxNode): boolean {
    return functionNode.metadata?.hasBody === true
        || functionNode.children.some((child) => child.kind === SyntaxKind.Block);
}

function readNumber(node: SyntaxNode, key: string): number {
    const value = node.metadata?.[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function compareRanges(left: vscode.Range, right: vscode.Range): number {
    if (left.start.line !== right.start.line) {
        return left.start.line - right.start.line;
    }

    return left.start.character - right.start.character;
}

function extractBriefDescription(comment: string): string {
    if (!comment || comment.trim() === '') {
        return '暂无描述';
    }

    const briefMatch = comment.match(/@brief\s+(.+?)(?=\n|$|@)/);
    if (briefMatch?.[1]) {
        return truncateBrief(briefMatch[1].trim());
    }

    for (const line of comment.split('\n')) {
        const cleanLine = line
            .replace(/^\/\*\*?\s*/, '')
            .replace(/\s*\*\/\s*$/, '')
            .replace(/^\s*\*\s?/, '')
            .trim();

        if (cleanLine && !cleanLine.startsWith('@')) {
            return truncateBrief(cleanLine);
        }
    }

    return '暂无描述';
}

function truncateBrief(value: string): string {
    return value.length > 20 ? `${value.substring(0, 20)}...` : value;
}
