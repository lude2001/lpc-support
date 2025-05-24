import * as vscode from 'vscode';
import { LPCDiagnostics } from './diagnostics';
import { LPCCodeActionProvider } from './codeActions';
import { LPCCompletionItemProvider } from './completionProvider';
import { LPCConfigManager } from './config';
import { LPCCompiler } from './compiler';
import { MacroManager } from './macroManager';
import { LPCDefinitionProvider } from './definitionProvider';
import { EfunDocsManager } from './efunDocs';
import { FunctionDocPanel } from './functionDocPanel';
import { formatLPCCode } from './formatter'; // 从 formatter.ts 导入

export function activate(context: vscode.ExtensionContext) {
    // 初始化诊断功能
    const macroManager = new MacroManager();
    const diagnostics = new LPCDiagnostics(context, macroManager);

    // 初始化 Efun 文档管理器
    const efunDocsManager = new EfunDocsManager(context);

    // 注册 efun 文档设置命令
    context.subscriptions.push(
        vscode.commands.registerCommand('lpc.efunDocsSettings', async () => {
            const items = [
                {
                    label: "更新 Efun 文档",
                    description: "从在线文档更新 Efun 函数文档",
                    command: 'lpc.updateEfunDocs'
                },
                {
                    label: "配置模拟函数库目录",
                    description: "设置模拟函数库的目录路径",
                    command: 'lpc.configureSimulatedEfuns'
                }
            ];

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'efun文档设置'
            });

            if (selected) {
                vscode.commands.executeCommand(selected.command);
            }
        })
    );

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

    // 注册函数文档面板命令
    let showFunctionDocCommand = vscode.commands.registerCommand('lpc.showFunctionDoc', () => {
        FunctionDocPanel.createOrShow(context, macroManager);
    });
    context.subscriptions.push(showFunctionDocCommand);

    // 注册批量编译命令
    let compileFolderCommand = vscode.commands.registerCommand('lpc.compileFolder', async (uri?: vscode.Uri) => {
        let targetFolder: string;

        if (uri) {
            // 如果是从右键菜单调用，使用选中的文件夹
            targetFolder = uri.fsPath;
        } else {
            // 如果是从命令面板调用，让用户选择工作区
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                vscode.window.showErrorMessage('请先打开一个工作区');
                return;
            }

            const folders = workspaceFolders.map(folder => ({
                label: folder.name,
                description: folder.uri.fsPath,
                uri: folder.uri
            }));

            // 如果只有一个工作区文件夹，直接使用它
            if (folders.length === 1) {
                targetFolder = folders[0].uri.fsPath;
            } else {
                // 如果有多个工作区文件夹，让用户选择
                const selected = await vscode.window.showQuickPick(folders, {
                    placeHolder: '选择要编译的文件夹'
                });

                if (!selected) {
                    return;
                }
                targetFolder = selected.uri.fsPath;
            }
        }

        await compiler.compileFolder(targetFolder);
    });
    context.subscriptions.push(compileFolderCommand);

    // 初始化代码补全提供程序
    const completionProvider = new LPCCompletionItemProvider(efunDocsManager, macroManager);
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            'lpc',
            completionProvider,
            '.', '->', '#' // 触发补全的字符
        )
    );

    // 注册文档变更事件，自动清除变量缓存
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            if (event.document.languageId === 'lpc') {
                completionProvider.clearVariableCache();
            }
        })
    );

    // 注册清除变量缓存命令
    context.subscriptions.push(
        vscode.commands.registerCommand('lpc.clearVariableCache', () => {
            completionProvider.clearVariableCache();
            vscode.window.showInformationMessage('已清除变量缓存');
        })
    );

    // 注册定义跳转提供程序
    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider(
            'lpc',
            new LPCDefinitionProvider(macroManager, efunDocsManager)
        )
    );

    // 注册扫描继承关系命令
    context.subscriptions.push(
        vscode.commands.registerCommand('lpc.scanInheritance', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'lpc') {
                completionProvider.scanInheritance(editor.document);
            } else {
                vscode.window.showWarningMessage('请在LPC文件中使用此命令');
            }
        })
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
}

// 停用扩展时调用
export function deactivate() {} 