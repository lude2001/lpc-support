import * as vscode from 'vscode';
import * as path from 'path';
import { DiagnosticsOrchestrator } from './diagnostics';  // 更新导入
import { LPCCodeActionProvider } from './codeActions';
import { LPCCompletionItemProvider } from './completionProvider';
import { LPCConfigManager } from './config';
import { LPCCompiler } from './compiler';
import { MacroManager } from './macroManager';
import { LPCDefinitionProvider } from './definitionProvider';
import { EfunDocsManager } from './efunDocs';
import { FunctionDocPanel } from './functionDocPanel';
import { ErrorTreeDataProvider, ErrorServerConfig } from './errorTreeDataProvider';
import { LPCFoldingRangeProvider } from './foldingProvider';

import { getParseTreeString } from './parser/ParseTreePrinter';
import { DebugErrorListener } from './parser/DebugErrorListener';
import { CharStreams, CommonTokenStream } from 'antlr4ts';
import { LPCLexer } from './antlr/LPCLexer';
import { LPCParser } from './antlr/LPCParser';
import { LPCSemanticTokensProvider, LPCSemanticTokensLegend } from './semanticTokensProvider';
import { LPCSymbolProvider } from './symbolProvider';
import { LPCReferenceProvider } from './referenceProvider';
import { LPCRenameProvider } from './renameProvider';
import { disposeParseCache, getParserCacheStats, clearParseCache } from './parseCache';


export function activate(context: vscode.ExtensionContext) {
    // 初始化诊断功能 - 使用新的协调器
    const macroManager = new MacroManager();
    const diagnostics = new DiagnosticsOrchestrator(context, macroManager);

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

    // 注册错误诊断中心 (Tree View)
    const errorTreeProvider = new ErrorTreeDataProvider();
    vscode.window.createTreeView('lpcErrorTree', { treeDataProvider: errorTreeProvider });

    context.subscriptions.push(
        vscode.commands.registerCommand('lpc.errorTree.refresh', () => errorTreeProvider.refresh())
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('lpc.errorTree.clear', () => errorTreeProvider.clearErrors())
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('lpc.errorTree.addServer', async () => {
            const name = await vscode.window.showInputBox({ prompt: '输入服务器名称' });
            if (!name) return;

            const address = await vscode.window.showInputBox({ prompt: '输入服务器地址 (例如 http://127.0.0.1:8092)' });
            if (!address) return;

            const config = vscode.workspace.getConfiguration('lpc.errorViewer');
            const servers = config.get<ErrorServerConfig[]>('servers') || [];
            servers.push({ name, address });
            await config.update('servers', servers, vscode.ConfigurationTarget.Global);
            errorTreeProvider.refresh();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('lpc.errorTree.removeServer', async () => {
            const servers = errorTreeProvider.getServers();
            if (servers.length === 0) {
                vscode.window.showInformationMessage('没有配置的服务器。');
                return;
            }

            const serverToRemove = await vscode.window.showQuickPick(
                servers.map(s => s.name),
                { placeHolder: '选择要移除的服务器' }
            );

            if (serverToRemove) {
                const updatedServers = servers.filter(s => s.name !== serverToRemove);
                await vscode.workspace.getConfiguration('lpc.errorViewer').update('servers', updatedServers, vscode.ConfigurationTarget.Global);
                errorTreeProvider.refresh();
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('lpc.errorTree.manageServers', async () => {
            const items = [
                { label: "添加新服务器", command: 'lpc.errorTree.addServer' },
                { label: "移除服务器", command: 'lpc.errorTree.removeServer' },
                { label: "手动编辑 settings.json", command: 'openSettings' }
            ];

            const selected = await vscode.window.showQuickPick(items, { placeHolder: '管理错误查看器服务器' });

            if (selected) {
                if (selected.command === 'openSettings') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'lpc.errorViewer.servers');
                } else {
                    vscode.commands.executeCommand(selected.command);
                }
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('lpc.errorTree.selectServer', async () => {
            const servers = errorTreeProvider.getServers();
            if (servers.length === 0) {
                vscode.window.showInformationMessage('没有可用的服务器，请先添加。', '添加服务器').then(selection => {
                    if (selection === '添加服务器') {
                        vscode.commands.executeCommand('lpc.errorTree.addServer');
                    }
                });
                return;
            }
            const selected = await vscode.window.showQuickPick(servers.map(s => s.name), {
                placeHolder: "选择一个活动的错误服务器"
            });
            if (selected) {
                const server = servers.find(s => s.name === selected);
                if (server) {
                    errorTreeProvider.setActiveServer(server);
                }
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('lpc.errorTree.openErrorLocation', async (errorItem: any) => {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                vscode.window.showErrorMessage("请先打开一个工作区");
                return;
            }
            const rootPath = workspaceFolders[0].uri.fsPath;
            const filePath = path.join(rootPath, errorItem.file);
            const fileUri = vscode.Uri.file(filePath);

            try {
                const doc = await vscode.workspace.openTextDocument(fileUri);
                const editor = await vscode.window.showTextDocument(doc);
                const line = errorItem.line - 1; // VSCode lines are 0-based
                const range = new vscode.Range(line, 0, line, 100); // Select till column 100 to highlight
                editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
                editor.selection = new vscode.Selection(range.start, range.end);
            } catch (e) {
                vscode.window.showErrorMessage(`无法打开文件: ${filePath}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('lpc.errorTree.copyError', async (errorItem: any) => {
            if (!errorItem || !errorItem.fullError) {
                vscode.window.showErrorMessage('无法复制错误信息：错误项无效');
                return;
            }

            try {
                // 构建完整的错误信息
                const errorInfo = `文件: ${errorItem.file}\n行号: ${errorItem.line}\n错误类型: ${errorItem.type === 'compile' ? '编译错误' : '运行时错误'}\n错误信息: ${errorItem.fullError}`;

                // 复制到剪贴板
                await vscode.env.clipboard.writeText(errorInfo);
                vscode.window.showInformationMessage('错误信息已复制到剪贴板');
            } catch (error) {
                vscode.window.showErrorMessage('复制错误信息失败');
            }
        })
    );

    // 注册批量编译命令
    let compileFolderCommand = vscode.commands.registerCommand('lpc.compileFolder', async (uri?: vscode.Uri) => {
        let targetFolder: string;

        if (uri) {
            targetFolder = uri.fsPath;
        } else {
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

            if (folders.length === 1) {
                targetFolder = folders[0].uri.fsPath;
            } else {
                const selected = await vscode.window.showQuickPick(folders, {
                    placeHolder: '选择要编译的文件夹'
                });

                if (!selected) {
                    return;
                }
                targetFolder = selected.uri.fsPath;
            }
        }

        await new LPCCompiler(new LPCConfigManager(context)).compileFolder(targetFolder);
    });
    context.subscriptions.push(compileFolderCommand);

    // 注册显示解析树命令（调试用）
    const parseTreeCommand = vscode.commands.registerCommand('lpc.showParseTree', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'lpc') {
            vscode.window.showWarningMessage('请在 LPC 文件中使用此命令。');
            return;
        }
        try {
            const parseTreeStr = getParseTreeString(editor.document.getText());
            const output = vscode.window.createOutputChannel('LPC ParseTree');
            output.clear();
            output.appendLine(parseTreeStr);
            output.show(true);
        } catch (err: any) {
            vscode.window.showErrorMessage(`解析 LPC 代码时发生错误: ${err.message || err}`);
        }
    });
    context.subscriptions.push(parseTreeCommand);

    // —— 调试语法错误命令 ——
    const debugParseCmd = vscode.commands.registerCommand('lpc.debugParseErrors', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'lpc') {
            vscode.window.showWarningMessage('请在 LPC 文件中使用此命令');
            return;
        }

        const code = editor.document.getText();
        const input = CharStreams.fromString(code);
        const lexer = new LPCLexer(input);
        const tokenStream = new CommonTokenStream(lexer);
        const parser = new LPCParser(tokenStream);

        const debugListener = new DebugErrorListener();
        parser.removeErrorListeners();
        parser.addErrorListener(debugListener);

        parser.sourceFile();

        const output = vscode.window.createOutputChannel('LPC Parse Debug');
        output.clear();

        if (debugListener.errors.length === 0) {
            output.appendLine('未发现 ANTLR 语法错误。');
        } else {
            debugListener.errors.forEach((err, idx) => {
                output.appendLine(`错误 ${idx + 1}: 行 ${err.line}, 列 ${err.column}`);
                output.appendLine(`  token: ${err.offendingToken}`);
                output.appendLine(`  message: ${err.message}`);
                if (err.ruleStack.length) {
                    output.appendLine(`  rule stack: ${err.ruleStack.join(' -> ')}`);
                }
                output.appendLine('');
            });
        }
        output.show(true);
    });
    context.subscriptions.push(debugParseCmd);

    // 初始化代码补全提供程序
    const completionProvider = new LPCCompletionItemProvider(efunDocsManager, macroManager);
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            'lpc',
            completionProvider,
            '.', '->', '#'
        )
    );

    // 注册文档变更事件，自动清除变量缓存
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            if (event.document.languageId === 'lpc') {
                completionProvider.clearCache(event.document);
            }
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

    // 注册语义标记提供程序
    context.subscriptions.push(
        vscode.languages.registerDocumentSemanticTokensProvider(
            { language: 'lpc' },
            new LPCSemanticTokensProvider(),
            LPCSemanticTokensLegend
        )
    );

    // 注册文档符号提供程序 (大纲)
    context.subscriptions.push(
        vscode.languages.registerDocumentSymbolProvider(
            { language: 'lpc' },
            new LPCSymbolProvider()
        )
    );

    // 注册引用提供程序
    context.subscriptions.push(
        vscode.languages.registerReferenceProvider(
            'lpc',
            new LPCReferenceProvider()
        )
    );

    // 注册重命名提供程序
    context.subscriptions.push(
        vscode.languages.registerRenameProvider('lpc', new LPCRenameProvider())
    );

    // 注册折叠提供程序
    context.subscriptions.push(
        vscode.languages.registerFoldingRangeProvider(
            { language: 'lpc' },
            new LPCFoldingRangeProvider()
        )
    );




    // --- Start Driver Button ---
    const startDriverCommandId = 'lpc.startDriver';
    let driverStatusBarItem: vscode.StatusBarItem;

    // Create status bar item
    driverStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    driverStatusBarItem.command = startDriverCommandId;
    driverStatusBarItem.text = `$(play) 启动驱动`;
    driverStatusBarItem.tooltip = "启动 MUD 驱动程序";
    driverStatusBarItem.show();
    context.subscriptions.push(driverStatusBarItem);

    // Register command
    const startDriverCommandHandler = () => {
        const config = vscode.workspace.getConfiguration('lpc');
        const driverCommand = config.get<string>('driver.command');

        if (!driverCommand) {
            vscode.window.showWarningMessage('未配置驱动启动命令。请在设置中配置 `lpc.driver.command`。', '打开设置').then(selection => {
                if (selection === '打开设置') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'lpc.driver.command');
                }
            });
            return;
        }

        let cwd: string | undefined;

        if (path.isAbsolute(driverCommand)) {
            cwd = path.dirname(driverCommand);
        } else if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            cwd = vscode.workspace.workspaceFolders[0].uri.fsPath;
        }

        const terminal = vscode.window.createTerminal({ name: `MUD Driver`, cwd });
        terminal.sendText(driverCommand);
        terminal.show();
    };

    context.subscriptions.push(vscode.commands.registerCommand(startDriverCommandId, startDriverCommandHandler));

    // 注册性能监控命令
    context.subscriptions.push(
        vscode.commands.registerCommand('lpc.showPerformanceStats', () => {
            const stats = getParserCacheStats();
            const memoryMB = (stats.memory / 1024 / 1024).toFixed(2);
            vscode.window.showInformationMessage(
                `LPC 性能统计: 缓存文档 ${stats.size} 个, 内存使用 ${memoryMB} MB`
            );
        }),
        vscode.commands.registerCommand('lpc.clearCache', () => {
            clearParseCache();
            vscode.window.showInformationMessage('LPC 解析缓存已清理');
        })
    );

    // 监听配置变化
    vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('lpc.errorViewer.servers')) {
            errorTreeProvider.refresh();
        }
    });
}

// 停用扩展时调用
export function deactivate() {
    // 清理解析缓存资源
    disposeParseCache();
}
