import * as vscode from 'vscode';
import { ParsedDoc } from '../../parseCache';
import { IDiagnosticCollector } from '../types';
import { MacroManager } from '../../macroManager';

/**
 * 对象访问检查收集器
 * 检查对象访问语法 (->、.) 的使用规范
 */
export class ObjectAccessCollector implements IDiagnosticCollector {
    public readonly name = 'ObjectAccessCollector';

    // 预编译的正则表达式
    private readonly objectAccessRegex = /\b([A-Z_][A-Z0-9_]*)\s*(->|\.)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*(\()?/g;
    private readonly macroDefRegex = /\b([A-Z_][A-Z0-9_]*)\b/;

    constructor(private macroManager?: MacroManager) {}

    async collect(document: vscode.TextDocument, _parsed: ParsedDoc): Promise<vscode.Diagnostic[]> {
        const diagnostics: vscode.Diagnostic[] = [];
        const text = document.getText();

        // 获取配置
        const config = vscode.workspace.getConfiguration('lpc.performance');
        const batchSize = config.get<number>('batchSize', 50);

        // 收集所有匹配项
        const matches: Array<{
            fullMatch: string;
            object: string;
            accessor: string;
            member: string;
            isFunction: boolean;
            startPos: number;
            endPos: number;
        }> = [];

        this.objectAccessRegex.lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = this.objectAccessRegex.exec(text)) !== null) {
            const [fullMatch, object, accessor, member, isFunction] = match;
            matches.push({
                fullMatch,
                object,
                accessor,
                member,
                isFunction: isFunction !== undefined,
                startPos: match.index,
                endPos: match.index + fullMatch.length
            });
        }

        // 分批处理匹配项
        let processedCount = 0;
        for (const matchInfo of matches) {
            const { object, accessor, member, isFunction, startPos, endPos } = matchInfo;

            // 检查宏定义
            if (/^[A-Z][A-Z0-9_]*_D$/.test(object)) {
                await this.checkMacroUsage(object, startPos, document, diagnostics);
                continue;
            }

            // 检查对象命名规范
            if (!/^[A-Z][A-Z0-9_]*(?:_D)?$/.test(object)) {
                diagnostics.push(this.createDiagnostic(
                    this.getRange(document, startPos, object.length),
                    '对象名应该使用大写字母和下划线，例如: USER_OB',
                    vscode.DiagnosticSeverity.Warning
                ));
            }

            // 检查函数调用
            if (isFunction) {
                this.checkFunctionCall(text, startPos, endPos, document, diagnostics);
            }

            processedCount++;
            // 每处理一定数量后让出主线程
            if (processedCount % batchSize === 0) {
                await this.yieldToMainThread();
            }
        }

        return diagnostics;
    }

    /**
     * 检查宏使用
     */
    private async checkMacroUsage(
        object: string,
        startPos: number,
        document: vscode.TextDocument,
        diagnostics: vscode.Diagnostic[]
    ): Promise<void> {
        if (!this.macroManager) {
            return;
        }

        const macro = this.macroManager.getMacro(object);
        const canResolveMacro = await this.macroManager.canResolveMacro(object);

        // 只对真正未定义的宏显示警告
        // 对于已定义的宏，不添加任何诊断信息，保持问题面板清洁
    }

    /**
     * 检查函数调用的括号闭合
     */
    private checkFunctionCall(
        text: string,
        startPos: number,
        endPos: number,
        document: vscode.TextDocument,
        diagnostics: vscode.Diagnostic[]
    ): void {
        let bracketCount = 1;
        let currentPos = endPos;
        let foundClosing = false;
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
                        foundClosing = true;
                        break;
                    }
                }
            }
            currentPos++;
        }

        if (!foundClosing) {
            diagnostics.push(this.createDiagnostic(
                this.getRange(document, startPos, endPos - startPos),
                '函数调用缺少闭合的括号',
                vscode.DiagnosticSeverity.Error
            ));
        }
    }

    /**
     * 让出主线程
     */
    private async yieldToMainThread(): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, 0));
    }

    /**
     * 创建诊断对象
     */
    private createDiagnostic(
        range: vscode.Range,
        message: string,
        severity: vscode.DiagnosticSeverity,
        code?: string
    ): vscode.Diagnostic {
        const diagnostic = new vscode.Diagnostic(range, message, severity);
        if (code) {
            diagnostic.code = code;
        }
        return diagnostic;
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
