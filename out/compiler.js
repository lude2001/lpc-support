"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LPCCompiler = void 0;
const vscode = require("vscode");
const axios_1 = require("axios");
const path = require("path");
class LPCCompiler {
    constructor(configManager) {
        this.configManager = configManager;
    }
    async compileFile(filePath) {
        const server = this.configManager.getActiveServer();
        if (!server) {
            const result = await vscode.window.showErrorMessage('未配置FluffOS服务器', '配置服务器');
            if (result === '配置服务器') {
                await this.configManager.addServer();
            }
            return;
        }
        // 获取工作区根目录
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('无法确定项目根目录，请在工作区中打开项目');
            return;
        }
        // 计算相对路径
        const relativePath = path.relative(workspaceFolder.uri.fsPath, filePath);
        // 确保路径以 / 开头
        const mudPath = '/' + relativePath.replace(/\\/g, '/');
        try {
            const response = await axios_1.default.post(`${server.url}/update_code/update_file`, {
                file_name: mudPath
            }, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
            if (response.status === 200) {
                const data = response.data;
                if (data.code === 'update_file') {
                    // 移除消息中的换行符，使提示更整洁
                    const msg = data.msg.replace(/[\n\r]+/g, ' ').trim();
                    vscode.window.showInformationMessage(msg);
                }
                else {
                    // 如果返回的不是 update_file，说明编译失败
                    vscode.window.showErrorMessage(data.msg || '编译失败，未知错误');
                }
            }
            else {
                vscode.window.showErrorMessage(`请求失败: ${response.statusText}`);
            }
        }
        catch (error) {
            // 处理网络错误或其他异常
            if (error.response) {
                // 服务器返回了错误状态码
                vscode.window.showErrorMessage(`编译失败: ${error.response.data.msg || error.message}`);
            }
            else if (error.request) {
                // 请求发出但没有收到响应
                vscode.window.showErrorMessage('无法连接到FluffOS服务器，请检查服务器配置和网络连接');
            }
            else {
                // 请求设置时发生错误
                vscode.window.showErrorMessage(`编译错误: ${error.message}`);
            }
        }
    }
    // 添加一个辅助方法来检查和修正路径
    normalizeMudPath(filePath, workspacePath) {
        // 移除工作区路径前缀
        let relativePath = path.relative(workspacePath, filePath);
        // 转换为 MUD 风格的路径（使用正斜杠）
        relativePath = relativePath.replace(/\\/g, '/');
        // 确保以 / 开头
        return relativePath.startsWith('/') ? relativePath : '/' + relativePath;
    }
}
exports.LPCCompiler = LPCCompiler;
//# sourceMappingURL=compiler.js.map