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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MacroManager = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class MacroManager {
    constructor() {
        this.macros = new Map();
        this.scanningComplete = false;
        this.scanningPromise = null;
        this.loadIncludePath();
        this.setupFileWatcher();
        this.startInitialScan();
    }
    async loadIncludePath() {
        const config = vscode.workspace.getConfiguration('lpc');
        this.includePath = config.get('includePath');
        if (!this.includePath && vscode.workspace.workspaceFolders?.[0]) {
            // 默认使用工作区根目录下的 include 文件夹
            this.includePath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'include');
        }
        if (this.includePath) {
            await this.scanMacros();
        }
    }
    setupFileWatcher() {
        if (this.includePath) {
            // 监听头文件变化
            this.watcher?.dispose();
            this.watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(this.includePath, '**/*.h'));
            this.watcher.onDidChange(() => this.scanMacros());
            this.watcher.onDidCreate(() => this.scanMacros());
            this.watcher.onDidDelete(() => this.scanMacros());
        }
    }
    async setIncludePath(newPath) {
        this.includePath = newPath;
        await this.scanMacros();
        this.setupFileWatcher();
        // 保存配置
        await vscode.workspace.getConfiguration('lpc').update('includePath', newPath, true);
    }
    async scanMacros(progress) {
        this.macros.clear();
        if (!this.includePath || !fs.existsSync(this.includePath)) {
            return;
        }
        await this.scanDirectory(this.includePath, progress);
    }
    async scanDirectory(dirPath, progress) {
        const files = await fs.promises.readdir(dirPath);
        for (const file of files) {
            const fullPath = path.join(dirPath, file);
            const stat = await fs.promises.stat(fullPath);
            if (progress) {
                progress.report({ message: `扫描: ${path.relative(this.includePath, fullPath)}` });
            }
            if (stat.isDirectory()) {
                await this.scanDirectory(fullPath, progress);
            }
            else if (file.endsWith('.h')) {
                await this.scanFile(fullPath);
            }
        }
    }
    async scanFile(filePath) {
        const content = await fs.promises.readFile(filePath, 'utf8');
        const lines = content.split('\n');
        let currentComment = '';
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            // 收集注释
            if (line.startsWith('//')) {
                currentComment += line.substring(2).trim() + '\n';
                continue;
            }
            else if (line.startsWith('/*')) {
                // 处理多行注释
                let j = i;
                let commentBlock = '';
                while (j < lines.length && !lines[j].includes('*/')) {
                    commentBlock += lines[j].replace(/^\/\*/, '').trim() + '\n';
                    j++;
                }
                if (j < lines.length) {
                    commentBlock += lines[j].replace(/\*\/.*$/, '').trim();
                    i = j;
                }
                currentComment = commentBlock;
                continue;
            }
            // 匹配 #define 宏定义
            const match = line.match(/^#define\s+([A-Z_][A-Z0-9_]*)\s+(.+)$/);
            if (match) {
                const [, name, value] = match;
                this.macros.set(name, {
                    name,
                    value: value.trim().replace(/^"(.*)"$/, '$1'),
                    file: filePath,
                    line: i + 1,
                    description: currentComment.trim() || undefined
                });
                currentComment = ''; // 重置注释
            }
            else if (line.length > 0) {
                currentComment = ''; // 如果遇到非空行且不是宏定义，重置注释
            }
        }
    }
    getMacro(name) {
        return this.macros.get(name);
    }
    getAllMacros() {
        return Array.from(this.macros.values());
    }
    async showMacrosList() {
        const items = this.getAllMacros().map(macro => ({
            label: macro.name,
            description: macro.value,
            detail: `Defined in ${path.relative(this.includePath, macro.file)}:${macro.line}`,
            macro: macro
        }));
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: '选择宏定义以查看详情或跳转到定义',
            matchOnDescription: true,
            matchOnDetail: true
        });
        if (selected) {
            const document = await vscode.workspace.openTextDocument(selected.macro.file);
            const position = new vscode.Position(selected.macro.line - 1, 0);
            await vscode.window.showTextDocument(document, {
                selection: new vscode.Selection(position, position)
            });
        }
    }
    async configurePath() {
        const currentPath = this.includePath || '';
        const newPath = await vscode.window.showInputBox({
            prompt: '设置宏定义包含目录路径',
            value: currentPath,
            placeHolder: '例如: /path/to/your/include'
        });
        if (newPath) {
            await this.setIncludePath(newPath);
            await this.scanMacros();
            vscode.window.showInformationMessage(`已更新宏定义目录: ${newPath}`);
        }
    }
    getIncludePath() {
        return this.includePath;
    }
    dispose() {
        this.watcher?.dispose();
    }
    refreshMacros() {
        // 重新加载宏定义
        this.scanMacros();
    }
    async canResolveMacro(macroName) {
        // 等待初始扫描完成
        if (this.scanningPromise) {
            await this.scanningPromise;
        }
        // 检查是否可以解析宏
        return this.getMacro(macroName) !== undefined;
    }
    async startInitialScan() {
        this.scanningComplete = false;
        const progressOptions = {
            location: vscode.ProgressLocation.Window,
            title: "正在扫描宏定义..."
        };
        this.scanningPromise = Promise.resolve(vscode.window.withProgress(progressOptions, async (progress) => {
            await this.scanMacros(progress);
            this.scanningComplete = true;
        }));
        await this.scanningPromise;
    }
    getMacroHoverContent(macro) {
        const content = new vscode.MarkdownString();
        // 添加宏定义标题
        content.appendMarkdown(`### 宏定义: \`${macro.name}\`\n\n`);
        // 添加宏的值
        content.appendCodeblock(`#define ${macro.name} ${macro.value}`, 'lpc');
        // 如果有描述，添加描述部分
        if (macro.description) {
            content.appendMarkdown('\n**描述**:\n');
            content.appendMarkdown(macro.description);
        }
        // 添加文件位置信息
        const relativePath = this.includePath ?
            path.relative(this.includePath, macro.file) :
            macro.file;
        content.appendMarkdown(`\n\n*定义于 [${relativePath}:${macro.line}](${vscode.Uri.file(macro.file).toString()})*`);
        content.isTrusted = true;
        return content;
    }
}
exports.MacroManager = MacroManager;
//# sourceMappingURL=macroManager.js.map