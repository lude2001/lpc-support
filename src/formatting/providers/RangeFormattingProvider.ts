import * as vscode from 'vscode';
import { FormattingController } from '../controller/FormattingController';

/**
 * LPC 范围格式化提供程序
 */
export class RangeFormattingProvider implements vscode.DocumentRangeFormattingEditProvider {
    private controller: FormattingController;

    constructor(controller: FormattingController) {
        this.controller = controller;
    }

    /**
     * 提供范围格式化编辑
     */
    async provideDocumentRangeFormattingEdits(
        document: vscode.TextDocument,
        range: vscode.Range,
        options: vscode.FormattingOptions,
        token: vscode.CancellationToken
    ): Promise<vscode.TextEdit[]> {
        try {
            // 检查是否支持该文档
            if (!this.controller.supportsDocument(document)) {
                return [];
            }

            // 检查取消状态
            if (token.isCancellationRequested) {
                return [];
            }

            // 验证范围
            const validatedRange = this.validateRange(document, range);
            if (!validatedRange) {
                return [];
            }

            // 临时更新配置以匹配 VS Code 的格式化选项
            await this.updateFormattingOptions(options);

            // 执行范围格式化
            const edits = await this.controller.formatRange(document, validatedRange);

            // 再次检查取消状态
            if (token.isCancellationRequested) {
                return [];
            }

            return edits;
            
        } catch (error) {
            console.error('RangeFormattingProvider 错误:', error);
            
            // 不在这里显示错误消息，由 FormattingController 处理
            return [];
        }
    }

    /**
     * 验证和修正范围
     */
    private validateRange(document: vscode.TextDocument, range: vscode.Range): vscode.Range | null {
        try {
            // 检查范围是否有效
            if (range.isEmpty) {
                return null;
            }

            // 确保范围在文档范围内
            const documentRange = new vscode.Range(
                new vscode.Position(0, 0),
                document.lineAt(document.lineCount - 1).range.end
            );

            const clampedRange = range.intersection(documentRange);
            if (!clampedRange || clampedRange.isEmpty) {
                return null;
            }

            // 尝试扩展范围到完整的语法元素
            return this.expandToSyntaxBoundaries(document, clampedRange);
            
        } catch (error) {
            console.warn('范围验证失败:', error);
            return range; // 返回原始范围
        }
    }

    /**
     * 扩展范围到语法边界
     */
    private expandToSyntaxBoundaries(document: vscode.TextDocument, range: vscode.Range): vscode.Range {
        try {
            let startLine = range.start.line;
            let endLine = range.end.line;
            
            // 将起始位置扩展到行开头
            const startLineText = document.lineAt(startLine).text;
            const startColumn = startLineText.search(/\S/); // 找到第一个非空白字符
            
            // 将结束位置扩展到行末尾
            const endLineText = document.lineAt(endLine).text;
            const endColumn = endLineText.length;
            
            return new vscode.Range(
                new vscode.Position(startLine, Math.max(0, startColumn)),
                new vscode.Position(endLine, endColumn)
            );
            
        } catch (error) {
            console.warn('范围扩展失败:', error);
            return range;
        }
    }

    /**
     * 根据 VS Code 的格式化选项更新配置
     */
    private async updateFormattingOptions(options: vscode.FormattingOptions): Promise<void> {
        try {
            const currentConfig = this.controller.getConfiguration();
            
            // 只更新必要的选项，保持其他配置不变
            const updates: any = {};
            
            if (options.tabSize !== currentConfig.indentSize) {
                updates.indentSize = options.tabSize;
            }
            
            if (options.insertSpaces !== currentConfig.useSpaces) {
                updates.useSpaces = options.insertSpaces;
            }
            
            // 只有在有变化时才更新
            if (Object.keys(updates).length > 0) {
                await this.controller.updateConfiguration(updates);
            }
            
        } catch (error) {
            // 配置更新失败不应该阻止格式化
            console.warn('更新格式化选项失败:', error);
        }
    }

    /**
     * 检查是否可以格式化指定范围
     */
    canFormatRange(document: vscode.TextDocument, range: vscode.Range): boolean {
        if (!this.controller.supportsDocument(document)) {
            return false;
        }
        
        const validatedRange = this.validateRange(document, range);
        return validatedRange !== null;
    }

    /**
     * 获取范围内的文本信息
     */
    getRangeInfo(document: vscode.TextDocument, range: vscode.Range): {
        text: string;
        lineCount: number;
        characterCount: number;
        isEmpty: boolean;
    } {
        const validatedRange = this.validateRange(document, range);
        if (!validatedRange) {
            return {
                text: '',
                lineCount: 0,
                characterCount: 0,
                isEmpty: true
            };
        }
        
        const text = document.getText(validatedRange);
        const lines = text.split('\n');
        
        return {
            text,
            lineCount: lines.length,
            characterCount: text.length,
            isEmpty: text.trim().length === 0
        };
    }

    /**
     * 获取格式化控制器
     */
    getController(): FormattingController {
        return this.controller;
    }
}