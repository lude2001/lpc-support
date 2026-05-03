import * as vscode from 'vscode';
import { DiagnosticContext, IDiagnosticCollector } from '../types';
import { MacroManager } from '../../macroManager';
import { ParsedDocument } from '../../parser/types';
import { SyntaxKind, SyntaxNode } from '../../syntax/types';

const VALID_OBJECT_NAME_PATTERN = /^[A-Z][A-Z0-9_]*(?:_D)?$/;
const MACRO_OBJECT_NAME_PATTERN = /^[A-Z][A-Z0-9_]*_D$/;
const MACRO_CANDIDATE_PATTERN = /^[A-Z_][A-Z0-9_]*$/;

/**
 * 对象访问检查收集器
 * 检查对象访问语法 (->、.) 的使用规范
 */
export class ObjectAccessCollector implements IDiagnosticCollector {
    public readonly name = 'ObjectAccessCollector';

    constructor(private macroManager?: MacroManager) {}

    async collect(
        _document: vscode.TextDocument,
        _parsed: ParsedDocument,
        context?: DiagnosticContext
    ): Promise<vscode.Diagnostic[]> {
        const syntax = context?.syntax;
        if (!syntax) {
            return [];
        }

        // 获取配置
        const config = vscode.workspace.getConfiguration('lpc.performance');
        const batchSize = config.get<number>('batchSize', 50);
        const memberAccesses = syntax.nodes.filter((node) => node.kind === SyntaxKind.MemberAccessExpression);
        const diagnostics: vscode.Diagnostic[] = [];

        // 分批处理匹配项
        let processedCount = 0;
        for (const memberAccess of memberAccesses) {
            const receiver = this.extractReceiver(memberAccess);
            if (!receiver) {
                continue;
            }

            // 检查宏定义
            if (receiver.isMacroObject) {
                await this.checkMacroUsage(receiver.objectExpression, context);
                continue;
            }

            // 检查对象命名规范
            if (!receiver.isMacroCandidate) {
                continue;
            }

            if (!VALID_OBJECT_NAME_PATTERN.test(receiver.objectExpression)) {
                diagnostics.push(this.createDiagnostic(
                    receiver.range,
                    '对象名应该使用大写字母和下划线，例如: USER_OB',
                    vscode.DiagnosticSeverity.Warning
                ));
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
    private async checkMacroUsage(objectName: string, context?: DiagnosticContext): Promise<void> {
        const semanticReference = context?.semantic?.macroReferences.find((reference) => reference.name === objectName);
        if (semanticReference?.resolvedValue) {
            return;
        }

        if (!this.macroManager) {
            return;
        }

        this.macroManager.getMacro(objectName);
        await this.macroManager.canResolveMacro(objectName);

        // 只对真正未定义的宏显示警告
        // 对于已定义的宏，不添加任何诊断信息，保持问题面板清洁
    }

    /**
     * 让出主线程
     */
    private async yieldToMainThread(): Promise<void> {
        return new Promise<void>((resolve) => setTimeout(resolve, 0));
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

    private extractReceiver(node: SyntaxNode): {
        objectExpression: string;
        isMacroObject: boolean;
        isMacroCandidate: boolean;
        range: vscode.Range;
    } | undefined {
        if (node.kind !== SyntaxKind.MemberAccessExpression || node.children.length < 2) {
            return undefined;
        }

        let receiver = node.children[0];
        while (receiver.kind === SyntaxKind.ParenthesizedExpression && receiver.children[0]) {
            receiver = receiver.children[0];
        }

        if (receiver.kind !== SyntaxKind.Identifier || !receiver.name) {
            return undefined;
        }

        const objectExpression = receiver.name;
        const isMacroCandidate = MACRO_CANDIDATE_PATTERN.test(objectExpression);

        return {
            objectExpression,
            isMacroObject: MACRO_OBJECT_NAME_PATTERN.test(objectExpression),
            isMacroCandidate,
            range: receiver.range
        };
    }
}
