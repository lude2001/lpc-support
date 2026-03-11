import * as vscode from 'vscode';
import { DiagnosticContext, IDiagnosticCollector } from '../types';
import { MacroManager } from '../../macroManager';
import { ParsedDocument } from '../../parser/types';
import { SyntaxKind } from '../../syntax/types';

const OBJECT_MACRO_NAME_PATTERN = /^[A-Z][A-Z0-9_]*_D$/;

/**
 * 宏使用检查收集器
 * 专门处理宏定义相关的诊断
 */
export class MacroUsageCollector implements IDiagnosticCollector {
    public readonly name = 'MacroUsageCollector';

    constructor(private macroManager?: MacroManager) {}

    async collect(
        _document: vscode.TextDocument,
        _parsed: ParsedDocument,
        context?: DiagnosticContext
    ): Promise<vscode.Diagnostic[]> {
        const syntax = context?.syntax;
        if (!this.macroManager || !syntax) {
            return [];
        }

        for (const node of syntax.nodes) {
            if (node.kind !== SyntaxKind.Identifier || !node.name) {
                continue;
            }

            const macroName = node.name;
            if (!OBJECT_MACRO_NAME_PATTERN.test(macroName)) {
                continue;
            }

            this.macroManager.getMacro(macroName);
            await this.macroManager.canResolveMacro(macroName);

            // 可以在这里添加未定义宏的警告
            // 当前策略：保持问题面板清洁，不对已定义的宏添加诊断
        }

        return [];
    }
}
