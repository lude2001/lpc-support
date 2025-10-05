import * as vscode from 'vscode';
import { ParsedDoc } from '../../parseCache';
import { IDiagnosticCollector } from '../types';

/**
 * 函数调用检查收集器
 * 检查函数调用语法问题，如括号匹配等
 */
export class FunctionCallCollector implements IDiagnosticCollector {
    public readonly name = 'FunctionCallCollector';

    collect(document: vscode.TextDocument, _parsed: ParsedDoc): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        const text = document.getText();

        // 匹配函数调用模式
        const functionCallPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
        let match: RegExpExecArray | null;

        while ((match = functionCallPattern.exec(text)) !== null) {
            const functionName = match[1];
            const startPos = match.index;
            const openParenPos = match.index + match[0].length - 1;

            // 检查括号闭合
            const closingInfo = this.findClosingParen(text, openParenPos);

            if (!closingInfo.found) {
                diagnostics.push(new vscode.Diagnostic(
                    this.getRange(document, startPos, match[0].length),
                    `函数调用 '${functionName}' 缺少闭合的括号`,
                    vscode.DiagnosticSeverity.Error
                ));
            }
        }

        return diagnostics;
    }

    /**
     * 查找闭合括号
     */
    private findClosingParen(text: string, openPos: number): { found: boolean; position?: number } {
        let bracketCount = 1;
        let currentPos = openPos + 1;
        let inString = false;
        let stringChar = '';

        while (currentPos < text.length) {
            const char = text[currentPos];

            if (inString) {
                if (char === stringChar && text[currentPos - 1] !== '\\') {
                    inString = false;
                }
            } else {
                if (char === '"' || char === '\'') {
                    inString = true;
                    stringChar = char;
                } else if (char === '(') {
                    bracketCount++;
                } else if (char === ')') {
                    bracketCount--;
                    if (bracketCount === 0) {
                        return { found: true, position: currentPos };
                    }
                }
            }
            currentPos++;
        }

        return { found: false };
    }

    /**
     * 获取范围对象
     */
    private getRange(
        document: vscode.TextDocument,
        startPos: number,
        length: number
    ): vscode.Range {
        return new vscode.Range(
            document.positionAt(startPos),
            document.positionAt(startPos + length)
        );
    }
}
