"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LPCCompiler = void 0;
const vscode = __importStar(require("vscode"));
const axios_1 = __importDefault(require("axios"));
const path = __importStar(require("path"));
class LPCCompiler {
    constructor(configManager) {
        this.configManager = configManager;
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('lpc');
    }
    parseCompileMessage(msg, document) {
        const diagnostics = [];
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
                const range = new vscode.Range(new vscode.Position(lineNumber, 0), new vscode.Position(lineNumber, Number.MAX_VALUE));
                const diagnostic = new vscode.Diagnostic(range, message, severity);
                diagnostics.push(diagnostic);
            }
        }
        return diagnostics;
    }
    async compileFile(filePath) {
        // 清除之前的诊断信息
        this.diagnosticCollection.clear();
        const server = this.configManager.getActiveServer();
        if (!server) {
            const result = await vscode.window.showErrorMessage('未配置FluffOS服务器', '配置服务器');
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
            const response = await axios_1.default.post(`${server.url}/update_code/update_file`, {
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
                    vscode.window.showInformationMessage(data.msg);
                    // 清除之前的诊断信息
                    this.diagnosticCollection.delete(document.uri);
                }
                else {
                    // 解析编译消息中的警告和错误
                    const diagnostics = this.parseCompileMessage(data.msg, document);
                    // 设置诊断信息
                    this.diagnosticCollection.set(document.uri, diagnostics);
                    // 如果没有解析到具体的警告或错误，但编译失败了，显示整个错误消息
                    if (diagnostics.length === 0) {
                        const diagnostic = new vscode.Diagnostic(new vscode.Range(0, 0, 0, 0), data.msg, vscode.DiagnosticSeverity.Error);
                        this.diagnosticCollection.set(document.uri, [diagnostic]);
                    }
                    vscode.window.showErrorMessage(data.msg);
                }
            }
            else {
                vscode.window.showErrorMessage(`请求失败: ${response.statusText}`);
            }
        }
        catch (error) {
            if (error.response) {
                vscode.window.showErrorMessage(`编译失败: ${error.response.data.msg || error.message}`);
            }
            else if (error.request) {
                vscode.window.showErrorMessage('无法连接到FluffOS服务器，请检查服务器配置和网络连接');
            }
            else {
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
    async compileFolder(folderPath) {
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
            title: "正在批量编译文件",
            cancellable: true
        }, async (progress, token) => {
            const total = files.length;
            let current = 0;
            let success = 0;
            let failed = 0;
            for (const file of files) {
                if (token.isCancellationRequested) {
                    break;
                }
                try {
                    await this.compileFile(file.fsPath);
                    success++;
                }
                catch (error) {
                    failed++;
                    console.error(`编译文件 ${file.fsPath} 失败:`, error);
                }
                current++;
                progress.report({
                    message: `进度: ${current}/${total}`,
                    increment: (100 / total)
                });
            }
            vscode.window.showInformationMessage(`批量编译完成。成功: ${success}, 失败: ${failed}, 总计: ${total}`);
        });
    }
}
exports.LPCCompiler = LPCCompiler;
//# sourceMappingURL=compiler.js.map