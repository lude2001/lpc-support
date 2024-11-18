import * as vscode from 'vscode';
import { LPCDiagnostics } from './diagnostics';
import { LPCCodeActionProvider } from './codeActions';
import { LPCCompletionItemProvider } from './completionProvider';
import { LPCConfigManager } from './config';
import { LPCCompiler } from './compiler';
import { MacroManager } from './macroManager';
import { LPCDefinitionProvider } from './definitionProvider';

export function activate(context: vscode.ExtensionContext) {
    // 初始化诊断功能
    const macroManager = new MacroManager();
    const diagnostics = new LPCDiagnostics(context, macroManager);

    // 注册代码操作提供程序
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider('lpc', new LPCCodeActionProvider(), {
            providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
        })
    );

    // 注册格式化提供程序
    context.subscriptions.push(
        vscode.languages.registerDocumentFormattingEditProvider('lpc', {
            provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
                const text = document.getText();
                const formatted = formatLPCCode(text);
                const range = new vscode.Range(
                    document.positionAt(0),
                    document.positionAt(text.length)
                );
                return [vscode.TextEdit.replace(range, formatted)];
            }
        })
    );

    // 分析当前打开的文档
    if (vscode.window.activeTextEditor) {
        diagnostics.analyzeDocument(vscode.window.activeTextEditor.document);
    }

    // 注册右键菜单命令
    let disposable = vscode.commands.registerCommand('lpc-support.checkUnusedVariables', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            diagnostics.analyzeDocument(editor.document, true);
            vscode.window.showInformationMessage('已完成未使用变量检查');
        }
    });

    context.subscriptions.push(disposable);

    // 在 activate 函数中添加
    let scanFolderCommand = vscode.commands.registerCommand('lpc.scanFolder', () => {
        diagnostics.scanFolder();
    });
    context.subscriptions.push(scanFolderCommand);

    // 注册代码补全提供程序
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            'lpc',
            new LPCCompletionItemProvider(),
            '.', '->', '#' // 触发补全的字符
        )
    );

    // 初始化配置管理器和编译器
    const configManager = new LPCConfigManager(context);
    const compiler = new LPCCompiler(configManager);

    // 注册服务器管理命令
    context.subscriptions.push(
        vscode.commands.registerCommand('lpc.addServer', () => configManager.addServer()),
        vscode.commands.registerCommand('lpc.selectServer', () => configManager.selectServer()),
        vscode.commands.registerCommand('lpc.removeServer', () => configManager.removeServer()),
        vscode.commands.registerCommand('lpc.manageServers', () => configManager.showServerManager())
    );

    // 注册编译命令
    context.subscriptions.push(
        vscode.commands.registerCommand('lpc.compileFile', async () => {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'lpc') {
                await compiler.compileFile(editor.document.fileName);
            }
        })
    );

    // 注册宏相关命令
    context.subscriptions.push(
        vscode.commands.registerCommand('lpc.showMacros', () => macroManager.showMacrosList()),
        vscode.commands.registerCommand('lpc.configureMacroPath', () => macroManager.configurePath())
    );

    // 将宏管理器添加到清理列表
    context.subscriptions.push(macroManager);

    // 注册定义提供程序
    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider(
            'lpc',
            new LPCDefinitionProvider(macroManager)
        )
    );
}

function formatLPCCode(code: string): string {
    const lines = code.split(/\r?\n/);
    let formatted = '';
    let indentLevel = 0;
    const indentSize = 4;
    let inMultilineComment = false;
    let inMultilineString = false;
    let mappingLevel = 0;
    let inLongText = false;

    for (let line of lines) {
        let trimmedLine = line.trim();

        // 处理多行注释的开始
        if (trimmedLine.startsWith('/*')) {
            inMultilineComment = true;
        }

        // 处理多行注释的结束
        if (trimmedLine.endsWith('*/')) {
            inMultilineComment = false;
        }

        // 处理多行字符串的开始和结束
        if (trimmedLine.startsWith('"""') || trimmedLine.endsWith('"""')) {
            inMultilineString = !inMultilineString;
        }

        // 处理 mapping 的开始
        if (trimmedLine.startsWith('([')) {
            mappingLevel++;
        }

        // 处理 mapping 的结束
        if (trimmedLine.endsWith('])')) {
            mappingLevel = Math.max(0, mappingLevel - 1);
        }

        // 处理 @LONG 和 @TEXT 的开始
        if (trimmedLine.startsWith('@LONG') || trimmedLine.startsWith('@TEXT')) {
            inLongText = true;
        }

        // 处理 @LONG 和 @TEXT 的结束
        if (inLongText && (trimmedLine === 'LONG' || trimmedLine === 'TEXT')) {
            inLongText = false;
        }

        // 处理缩进减少
        if (!inMultilineComment && !inMultilineString && mappingLevel === 0 && !inLongText && trimmedLine.startsWith('}')) {
            indentLevel = Math.max(0, indentLevel - 1);
        }

        // 添加当前缩进
        if (trimmedLine.length > 0) {
            formatted += ' '.repeat(indentLevel * indentSize) + trimmedLine + '\n';
        } else {
            formatted += '\n';
        }

        // 处理缩进增加
        if (!inMultilineComment && !inMultilineString && mappingLevel === 0 && !inLongText && trimmedLine.endsWith('{')) {
            indentLevel++;
        }

        // 处理 case 和 default 语句
        if (!inMultilineComment && !inMultilineString && mappingLevel === 0 && !inLongText && (trimmedLine.startsWith('case') || trimmedLine.startsWith('default:'))) {
            formatted += ' '.repeat(indentLevel * indentSize) + trimmedLine + '\n';
            indentLevel++;
        }

        // 处理 else 和 break 语句
        if (!inMultilineComment && !inMultilineString && mappingLevel === 0 && !inLongText && (trimmedLine.startsWith('else') || trimmedLine.startsWith('break;'))) {
            indentLevel = Math.max(0, indentLevel - 1);
            formatted += ' '.repeat(indentLevel * indentSize) + trimmedLine + '\n';
        }
    }

    return formatted;
}

// 停用扩展时调用
export function deactivate() {} 