import * as vscode from 'vscode';
import axios from 'axios';
import * as path from 'path';
import { LPCConfigManager } from './config';

export class LPCRunner {
    private configManager: LPCConfigManager;
    private diagnosticCollection: vscode.DiagnosticCollection;

    constructor(configManager: LPCConfigManager) {
        this.configManager = configManager;
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('lpc');
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

    public async runFile(filePath: string, args: string[] = []): Promise<void> {
        // 清除之前的诊断信息
        this.diagnosticCollection.clear();
        
        const server = this.configManager.getActiveServer();
        if (!server) {
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
            vscode.window.showErrorMessage('无法确定项目根目录，请在工作区中打开项目');
            return;
        }

        const relativePath = path.relative(workspaceFolder.uri.fsPath, filePath);
        const mudPath = '/' + relativePath.replace(/\\/g, '/');

        try {
            // 首先尝试编译文件
            const compileResponse = await axios.post(`${server.url}/update_code/update_file`, {
                file_name: mudPath
            }, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            if (compileResponse.status === 200) {
                const compileData = compileResponse.data;
                const document = await vscode.workspace.openTextDocument(filePath);

                // 如果编译成功，尝试运行文件
                if (compileData.msg.includes('成功')) {
                    // 清除之前的诊断信息
                    this.diagnosticCollection.delete(document.uri);

                    // 构建运行参数
                    const runParams = {
                        file_name: mudPath,
                        args: args
                    };

                    // 发送运行请求
                    const runResponse = await axios.post(`${server.url}/run_file`, runParams, {
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });

                    if (runResponse.status === 200) {
                        const runData = runResponse.data;
                        // 显示运行结果
                        if (runData.success) {
                            vscode.window.showInformationMessage(`运行成功: ${runData.output || '无输出'}`);
                        } else {
                            vscode.window.showErrorMessage(`运行失败: ${runData.error || '未知错误'}`);
                        }
                    }
                } else {
                    // 处理编译错误
                    const diagnostics = this.parseCompileMessage(compileData.msg, document);
                    this.diagnosticCollection.set(document.uri, diagnostics);
                    
                    if (diagnostics.length === 0) {
                        const diagnostic = new vscode.Diagnostic(
                            new vscode.Range(0, 0, 0, 0),
                            compileData.msg,
                            vscode.DiagnosticSeverity.Error
                        );
                        this.diagnosticCollection.set(document.uri, [diagnostic]);
                    }
                    
                    vscode.window.showErrorMessage(compileData.msg);
                }
            } else {
                vscode.window.showErrorMessage(`请求失败: ${compileResponse.statusText}`);
            }
        } catch (error: any) {
            if (error.response) {
                vscode.window.showErrorMessage(`操作失败: ${error.response.data.msg || error.message}`);
            } else if (error.request) {
                vscode.window.showErrorMessage('无法连接到FluffOS服务器，请检查服务器配置和网络连接');
            } else {
                vscode.window.showErrorMessage(`错误: ${error.message}`);
            }
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
} 