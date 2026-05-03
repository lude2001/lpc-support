import * as vscode from 'vscode';
import { composeLpcType } from './ast/typeNormalization';
import { getGlobalParsedDocumentService } from './parser/ParsedDocumentService';
import { SyntaxBuilder } from './syntax/SyntaxBuilder';
import { SyntaxDocument, SyntaxKind, SyntaxNode } from './syntax/types';
import { FunctionInfo } from './types/functionInfo';

export class LPCFunctionParser {
    public static parseFunctionFromSelection(document: vscode.TextDocument, selection: vscode.Selection): FunctionInfo | null {
        const selectedText = document.getText(selection);
        if (!selectedText.trim()) {
            return null;
        }

        try {
            const syntax = this.getSyntaxDocument(document);
            const functionNode = this.findFunctionContainingRange(syntax, selection.start, selection.end);
            return functionNode ? this.extractFunctionInfo(document, functionNode) : null;
        } catch (error) {
            console.error('Error parsing function from selection:', error);
            return null;
        }
    }

    public static parseFunctionFromCursor(document: vscode.TextDocument, position: vscode.Position): FunctionInfo | null {
        try {
            const syntax = this.getSyntaxDocument(document);
            const functionNode = this.findFunctionContainingPosition(syntax, position);
            return functionNode ? this.extractFunctionInfo(document, functionNode) : null;
        } catch (error) {
            console.error('Error parsing function from cursor:', error);
            return null;
        }
    }

    public static parseAllFunctions(document: vscode.TextDocument, source: string = '当前文件', filePath?: string): FunctionInfo[] {
        try {
            return this.getFunctionDeclarations(this.getSyntaxDocument(document))
                .filter((node) => this.hasFunctionBody(node))
                .map((node) => this.extractFunctionInfo(document, node, source, filePath || document.fileName));
        } catch (error) {
            console.error('Error parsing functions:', error);
            return [];
        }
    }

    private static getSyntaxDocument(document: vscode.TextDocument): SyntaxDocument {
        return new SyntaxBuilder(getGlobalParsedDocumentService().get(document)).build();
    }

    private static getFunctionDeclarations(syntax: SyntaxDocument): SyntaxNode[] {
        return syntax.nodes
            .filter((node) => node.kind === SyntaxKind.FunctionDeclaration)
            .sort((left, right) => this.compareRanges(left.range, right.range));
    }

    private static findFunctionContainingRange(
        syntax: SyntaxDocument,
        start: vscode.Position,
        end: vscode.Position
    ): SyntaxNode | undefined {
        return this.getFunctionDeclarations(syntax)
            .filter((node) => this.hasFunctionBody(node))
            .find((node) => node.range.contains(start) && node.range.contains(end));
    }

    private static findFunctionContainingPosition(
        syntax: SyntaxDocument,
        position: vscode.Position
    ): SyntaxNode | undefined {
        return this.getFunctionDeclarations(syntax)
            .filter((node) => this.hasFunctionBody(node))
            .find((node) => node.range.contains(position));
    }

    private static extractFunctionInfo(
        document: vscode.TextDocument,
        functionNode: SyntaxNode,
        source?: string,
        filePath?: string
    ): FunctionInfo {
        const name = functionNode.name || 'function';
        const returnType = this.getFunctionReturnType(functionNode);
        const paramText = this.getParameterText(document, functionNode);
        const body = this.getFunctionBodyText(document, functionNode);
        const fullText = document.getText(functionNode.range);
        const comment = functionNode.attachedDocComment?.text ?? '';

        return {
            name,
            definition: `${returnType}${returnType.endsWith('*') ? '' : ' '}${name}${paramText}`,
            returnType,
            parameters: this.getParameters(functionNode),
            body,
            fullText,
            comment,
            briefDescription: this.extractBriefDescription(comment),
            source,
            filePath,
            line: functionNode.range.start.line
        };
    }

    private static getFunctionReturnType(functionNode: SyntaxNode): string {
        const typeReference = functionNode.children.find((child) => child.kind === SyntaxKind.TypeReference);
        if (!typeReference) {
            return 'void';
        }

        return composeLpcType(this.getTypeText(typeReference), this.readNumber(functionNode, 'pointerCount'));
    }

    private static getParameterText(document: vscode.TextDocument, functionNode: SyntaxNode): string {
        const parameterList = functionNode.children.find((child) => child.kind === SyntaxKind.ParameterList);
        return parameterList ? `(${document.getText(parameterList.range).trim()})` : '()';
    }

    private static getFunctionBodyText(document: vscode.TextDocument, functionNode: SyntaxNode): string {
        const body = functionNode.children.find((child) => child.kind === SyntaxKind.Block);
        return body ? document.getText(body.range) : '';
    }

    private static getParameters(functionNode: SyntaxNode): Array<{ type: string; name: string }> {
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
                        ? composeLpcType(this.getTypeText(typeReference), this.readNumber(parameter, 'pointerCount'))
                        : 'mixed',
                    name: parameter.name ?? ''
                };
            })
            .filter((parameter) => parameter.name.length > 0);
    }

    private static getTypeText(typeReference: SyntaxNode): string {
        const text = typeReference.metadata?.text;
        return typeof text === 'string' && text.trim()
            ? text.trim()
            : typeReference.name ?? 'mixed';
    }

    private static hasFunctionBody(functionNode: SyntaxNode): boolean {
        return functionNode.metadata?.hasBody === true
            || functionNode.children.some((child) => child.kind === SyntaxKind.Block);
    }

    private static readNumber(node: SyntaxNode, key: string): number {
        const value = node.metadata?.[key];
        return typeof value === 'number' && Number.isFinite(value) ? value : 0;
    }

    private static compareRanges(left: vscode.Range, right: vscode.Range): number {
        if (left.start.line !== right.start.line) {
            return left.start.line - right.start.line;
        }

        return left.start.character - right.start.character;
    }

    private static extractBriefDescription(comment: string): string {
        if (!comment || comment.trim() === '') {
            return '暂无描述';
        }

        const briefMatch = comment.match(/@brief\s+(.+?)(?=\n|$|@)/);
        if (briefMatch?.[1]) {
            return this.truncateBrief(briefMatch[1].trim());
        }

        for (const line of comment.split('\n')) {
            const cleanLine = line
                .replace(/^\/\*\*?\s*/, '')
                .replace(/\s*\*\/\s*$/, '')
                .replace(/^\s*\*\s?/, '')
                .trim();

            if (cleanLine && !cleanLine.startsWith('@')) {
                return this.truncateBrief(cleanLine);
            }
        }

        return '暂无描述';
    }

    private static truncateBrief(value: string): string {
        return value.length > 20 ? `${value.substring(0, 20)}...` : value;
    }
}
