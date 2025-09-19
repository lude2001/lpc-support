import * as vscode from 'vscode';
import { FormattingController } from '../controller/FormattingController';

/**
 * LPC 文档格式化提供程序
 */
export class DocumentFormattingProvider implements vscode.DocumentFormattingEditProvider {
    private controller: FormattingController;

    constructor(controller: FormattingController) {
        this.controller = controller;
    }

    /**
     * 提供文档格式化编辑
     */
    async provideDocumentFormattingEdits(
        document: vscode.TextDocument,
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

            // 临时更新配置以匹配 VS Code 的格式化选项
            await this.updateFormattingOptions(options);

            // 执行格式化
            const edits = await this.controller.formatDocument(document);

            // 再次检查取消状态
            if (token.isCancellationRequested) {
                return [];
            }

            return edits;
            
        } catch (error) {
            console.error('DocumentFormattingProvider 错误:', error);
            
            // 不在这里显示错误消息，由 FormattingController 处理
            return [];
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
     * 检查是否可以格式化指定文档
     */
    canFormat(document: vscode.TextDocument): boolean {
        return this.controller.supportsDocument(document);
    }

    /**
     * 获取格式化控制器
     */
    getController(): FormattingController {
        return this.controller;
    }
}