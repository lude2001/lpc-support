import * as vscode from 'vscode';
import { DiagnosticContext, IDiagnosticCollector } from '../types';
import { ParsedDocument } from '../../parser/types';

const OBJECT_MACRO_NAME_PATTERN = /^[A-Z][A-Z0-9_]*_D$/;

/**
 * 宏使用检查收集器
 * 专门处理宏定义相关的诊断
 */
export class MacroUsageCollector implements IDiagnosticCollector {
    public readonly name = 'MacroUsageCollector';

    async collect(
        _document: vscode.TextDocument,
        _parsed: ParsedDocument,
        context?: DiagnosticContext
    ): Promise<vscode.Diagnostic[]> {
        if (context?.semantic) {
            for (const reference of context.semantic.macroReferences) {
                if (!OBJECT_MACRO_NAME_PATTERN.test(reference.name) || reference.resolvedValue) {
                    continue;
                }
            }
        }

        return [];
    }
}
