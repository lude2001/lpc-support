import * as vscode from 'vscode';
import { ParsedDoc } from '../../parseCache';
import { IDiagnosticCollector } from '../types';
import { MacroManager } from '../../macroManager';

/**
 * 宏使用检查收集器
 * 专门处理宏定义相关的诊断
 */
export class MacroUsageCollector implements IDiagnosticCollector {
    public readonly name = 'MacroUsageCollector';

    constructor(private macroManager?: MacroManager) {}

    async collect(document: vscode.TextDocument, _parsed: ParsedDoc): Promise<vscode.Diagnostic[]> {
        const diagnostics: vscode.Diagnostic[] = [];

        if (!this.macroManager) {
            return diagnostics;
        }

        const text = document.getText();

        // 匹配可能的宏定义使用 (大写字母+下划线的标识符)
        const macroPattern = /\b([A-Z_][A-Z0-9_]*)\b/g;
        let match: RegExpExecArray | null;

        while ((match = macroPattern.exec(text)) !== null) {
            const macroName = match[1];
            const startPos = match.index;

            // 只检查以 _D 结尾的宏（文件对象宏）
            if (!/^[A-Z][A-Z0-9_]*_D$/.test(macroName)) {
                continue;
            }

            const macro = this.macroManager.getMacro(macroName);
            const canResolveMacro = await this.macroManager.canResolveMacro(macroName);

            // 可以在这里添加未定义宏的警告
            // 当前策略：保持问题面板清洁，不对已定义的宏添加诊断
        }

        return diagnostics;
    }
}
