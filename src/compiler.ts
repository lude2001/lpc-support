import * as vscode from 'vscode';
import axios from 'axios';
import * as path from 'path';
import { LPCConfigManager } from './config';

export class LPCCompiler {
    private configManager: LPCConfigManager;
    private diagnosticCollection: vscode.DiagnosticCollection;
    private outputChannel: vscode.OutputChannel;

    constructor(configManager: LPCConfigManager) {
        this.configManager = configManager;
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('lpc');
        this.outputChannel = vscode.window.createOutputChannel('LPC Compiler');
    }

    private parseCompileMessage(msg: string, document: vscode.TextDocument): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        const lines = msg.split('\n');
        
        for (const line of lines) {
            // 匹配包含 "line X:" 格式的错误信息
            const lineMatch = line.match(/line (\d+):/);
            if (lineMatch) {
                const lineNumber = parseInt(lineMatch[1]) - 1; // VSCode使用0基索引
                
                // 判断消息类型（Warning 或 Error）
                const isWarning = line.includes('Warning');
                const severity = isWarning ? 
                    vscode.DiagnosticSeverity.Warning : 
                    vscode.DiagnosticSeverity.Error;
                
                // 提取错误消息
                let message = line;
                const messageMatch = line.match(/line \d+:\s*(.*)/);
                if (messageMatch) {
                    message = messageMatch[1];
                }
                
                const range = new vscode.Range(
                    new vscode.Position(lineNumber, 0),
                    new vscode.Position(lineNumber, Number.MAX_VALUE)
                );
                
                const diagnostic = new vscode.Diagnostic(range, message, severity);
                diagnostics.push(diagnostic);
            }
        }
        
        return diagnostics;
    }

    public async compileFile(filePath: string): Promise<void> {
        // 检查文件扩展名，如果是 .h 文件则不编译
        if (filePath.endsWith('.h')) {
            vscode.window.showWarningMessage('头文件 (.h) 不需要单独编译。');
            return;
        }

        // 清除之前的诊断信息
        this.diagnosticCollection.clear();
        
        const server = this.configManager.getActiveServer();
        if (!server) {
            this.outputChannel.appendLine('错误: 未配置FluffOS服务器。');
            this.outputChannel.show(true);
            const result = await vscode.window.showErrorMessage(
                '未配置FluffOS服务器',
                '配置服务器'
            );
            if (result === '配置服务器') {
                await this.configManager.addServer();
            }
            return;
        }

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
        if (!workspaceFolder) {
            this.outputChannel.appendLine('错误: 无法确定项目根目录，请在工作区中打开项目。');
            this.outputChannel.show(true);
            return;
        }

        const relativePath = path.relative(workspaceFolder.uri.fsPath, filePath);
        const mudPath = '/' + relativePath.replace(/\\/g, '/');

        this.outputChannel.appendLine(`正在编译文件: ${mudPath}`);
        this.outputChannel.show(true);

        try {
            const response = await axios.post(`${server.url}/update_code/update_file`, {
                file_name: mudPath
            }, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            if (response.status === 200) {
                const data = response.data;
                const document = await vscode.workspace.openTextDocument(filePath);
                
                // 检查编译消息中是否包含"成功"
                if (data.msg.includes('成功')) {
                    this.outputChannel.appendLine(`编译成功: ${data.msg}`);
                    this.diagnosticCollection.delete(document.uri);
                } else {
                    // 解析编译消息中的警告和错误
                    const diagnostics = this.parseCompileMessage(data.msg, document);
                    
                    // 设置诊断信息
                    this.diagnosticCollection.set(document.uri, diagnostics);
                    
                    // 如果没有解析到具体的警告或错误，但编译失败了，显示整个错误消息
                    if (diagnostics.length === 0) {
                        const diagnostic = new vscode.Diagnostic(
                            new vscode.Range(0, 0, 0, 0),
                            data.msg,
                            vscode.DiagnosticSeverity.Error
                        );
                        this.diagnosticCollection.set(document.uri, [diagnostic]);
                    }
                    this.outputChannel.appendLine(`编译失败: ${data.msg}`);
                }
            } else {
                this.outputChannel.appendLine(`请求失败: ${response.statusText}`);
                this.outputChannel.show(true);
            }
        } catch (error: any) {
            if (error.response) {
                this.outputChannel.appendLine(`编译失败: ${error.response.data.msg || error.message}`);
            } else if (error.request) {
                this.outputChannel.appendLine('无法连接到FluffOS服务器，请检查服务器配置和网络连接');
            } else {
                this.outputChannel.appendLine(`编译错误: ${error.message}`);
            }
            this.outputChannel.show(true);
        }
    }

    // 添加一个辅助方法来检查和修正路径
    private normalizeMudPath(filePath: string, workspacePath: string): string {
        // 移除工作区路径前缀
        let relativePath = path.relative(workspacePath, filePath);
        // 转换为 MUD 风格的路径（使用正斜杠）
        relativePath = relativePath.replace(/\\/g, '/');
        // 确保以 / 开头
        return relativePath.startsWith('/') ? relativePath : '/' + relativePath;
    }

    public async compileFolder(folderPath: string): Promise<void> {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(folderPath));
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('无法确定项目根目录，请在工作区中打开项目');
            return;
        }

        // 获取文件夹下所有的.c文件
        const pattern = new vscode.RelativePattern(folderPath, '**/*.c');
        const files = await vscode.workspace.findFiles(pattern);

        if (files.length === 0) {
            vscode.window.showInformationMessage('未找到任何.c文件');
            return;
        }

        // 创建进度条
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "正在批量编译文件 (并行)",
            cancellable: true
        }, async (progress, token) => {
            const total = files.length;
            let current = 0;
            let success = 0;
            let failed = 0;

            // 使用 Promise.allSettled 并发编译所有文件
            const compileTasks = files.map(async (file, index) => {
                if (token.isCancellationRequested) {
                    return;
                }
                try {
                    await this.compileFile(file.fsPath);
                    success++;
                } catch (error) {
                    failed++;
                    console.error(`编译文件 ${file.fsPath} 失败:`, error);
                } finally {
                    current++;
                    progress.report({
                        message: `进度: ${current}/${total}`,
                        increment: (100 / total)
                    });
                    // 每编译100个文件停顿0.5秒
                    if (current % 100 === 0) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }
            });

            await Promise.allSettled(compileTasks);

            // 改为输出到输出通道
            this.outputChannel.appendLine(
                `批量编译完成。成功: ${success}, 失败: ${failed}, 总计: ${total}`
            );
            this.outputChannel.show(true);
        });
    }
} 