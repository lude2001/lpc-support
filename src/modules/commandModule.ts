import * as path from 'path';
import * as vscode from 'vscode';
import { CharStreams, CommonTokenStream } from 'antlr4ts';
import { LPCCompiler } from '../compiler';
import { LPCConfigManager } from '../config';
import { Services } from '../core/ServiceKeys';
import { ServiceRegistry } from '../core/ServiceRegistry';
import type { ErrorServerConfig } from '../errorTreeDataProvider';
import { FunctionDocPanel } from '../functionDocPanel';
import { LPCLexer } from '../antlr/LPCLexer';
import { LPCParser } from '../antlr/LPCParser';
import { DebugErrorListener } from '../parser/DebugErrorListener';
import { getParseTreeString } from '../parser/ParseTreePrinter';
import {
    clearGlobalParsedDocumentService,
    getGlobalParsedDocumentService
} from '../parser/ParsedDocumentService';

export function registerCommands(registry: ServiceRegistry, context: vscode.ExtensionContext): void {
    const macroManager = registry.get(Services.MacroManager);
    const diagnostics = registry.get(Services.Diagnostics);
    const completionProvider = registry.get(Services.Completion);
    const completionInstrumentation = registry.get(Services.CompletionInstrumentation);
    const configManager = registry.get(Services.ConfigManager);
    const compiler = registry.get(Services.Compiler);
    const errorTreeProvider = registry.get(Services.ErrorTree);

    register(context, 'lpc.efunDocsSettings', async () => {
        const items = [
            {
                label: '配置模拟函数库目录',
                description: '设置本地模拟函数库的目录路径',
                command: 'lpc.configureSimulatedEfuns'
            }
        ];

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'efun文档设置'
        });

        if (selected) {
            vscode.commands.executeCommand(selected.command);
        }
    });

    register(context, 'lpc-support.checkUnusedVariables', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            diagnostics.analyzeDocument(editor.document, true);
            vscode.window.showInformationMessage('已完成未使用变量检查');
        }
    });

    register(context, 'lpc.scanFolder', () => {
        diagnostics.scanFolder();
    });

    register(context, 'lpc.showFunctionDoc', () => {
        FunctionDocPanel.createOrShow(context, macroManager);
    });

    register(context, 'lpc.errorTree.refresh', () => errorTreeProvider.refresh());
    register(context, 'lpc.errorTree.clear', () => errorTreeProvider.clearErrors());

    register(context, 'lpc.errorTree.addServer', async () => {
        const name = await vscode.window.showInputBox({ prompt: '输入服务器名称' });
        if (!name) {
            return;
        }

        const address = await vscode.window.showInputBox({ prompt: '输入服务器地址 (例如 http://127.0.0.1:8092)' });
        if (!address) {
            return;
        }

        const config = vscode.workspace.getConfiguration('lpc.errorViewer');
        const servers = config.get<ErrorServerConfig[]>('servers') || [];
        servers.push({ name, address });
        await config.update('servers', servers, vscode.ConfigurationTarget.Global);
        errorTreeProvider.refresh();
    });

    register(context, 'lpc.errorTree.removeServer', async () => {
        const servers = errorTreeProvider.getServers();
        if (servers.length === 0) {
            vscode.window.showInformationMessage('没有配置的服务器。');
            return;
        }

        const serverToRemove = await vscode.window.showQuickPick(
            servers.map(server => server.name),
            { placeHolder: '选择要移除的服务器' }
        );

        if (serverToRemove) {
            const updatedServers = servers.filter(server => server.name !== serverToRemove);
            await vscode.workspace
                .getConfiguration('lpc.errorViewer')
                .update('servers', updatedServers, vscode.ConfigurationTarget.Global);
            errorTreeProvider.refresh();
        }
    });

    register(context, 'lpc.errorTree.manageServers', async () => {
        const items = [
            { label: '添加新服务器', command: 'lpc.errorTree.addServer' },
            { label: '移除服务器', command: 'lpc.errorTree.removeServer' },
            { label: '手动编辑 settings.json', command: 'openSettings' }
        ];

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: '管理错误查看器服务器'
        });

        if (!selected) {
            return;
        }

        if (selected.command === 'openSettings') {
            vscode.commands.executeCommand('workbench.action.openSettings', 'lpc.errorViewer.servers');
            return;
        }

        vscode.commands.executeCommand(selected.command);
    });

    register(context, 'lpc.errorTree.selectServer', async () => {
        const servers = errorTreeProvider.getServers();
        if (servers.length === 0) {
            vscode.window.showInformationMessage('没有可用的服务器，请先添加。', '添加服务器').then(selection => {
                if (selection === '添加服务器') {
                    vscode.commands.executeCommand('lpc.errorTree.addServer');
                }
            });
            return;
        }

        const selected = await vscode.window.showQuickPick(
            servers.map(server => server.name),
            { placeHolder: '选择一个活动的错误服务器' }
        );

        if (!selected) {
            return;
        }

        const server = servers.find(candidate => candidate.name === selected);
        if (server) {
            errorTreeProvider.setActiveServer(server);
        }
    });

    register(context, 'lpc.errorTree.openErrorLocation', async (errorItem: any) => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('请先打开一个工作区');
            return;
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        const filePath = path.join(rootPath, errorItem.file);
        const fileUri = vscode.Uri.file(filePath);

        try {
            const document = await vscode.workspace.openTextDocument(fileUri);
            const editor = await vscode.window.showTextDocument(document);
            const line = errorItem.line - 1;
            const range = new vscode.Range(line, 0, line, 100);
            editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
            editor.selection = new vscode.Selection(range.start, range.end);
        } catch {
            vscode.window.showErrorMessage(`无法打开文件: ${filePath}`);
        }
    });

    register(context, 'lpc.errorTree.copyError', async (errorItem: any) => {
        if (!errorItem || !errorItem.fullError) {
            vscode.window.showErrorMessage('无法复制错误信息：错误项无效');
            return;
        }

        try {
            const errorInfo = `文件: ${errorItem.file}\n行号: ${errorItem.line}\n错误类型: ${errorItem.type === 'compile' ? '编译错误' : '运行时错误'}\n错误信息: ${errorItem.fullError}`;
            await vscode.env.clipboard.writeText(errorInfo);
            vscode.window.showInformationMessage('错误信息已复制到剪贴板');
        } catch {
            vscode.window.showErrorMessage('复制错误信息失败');
        }
    });

    register(context, 'lpc.compileFolder', async (uri?: vscode.Uri) => {
        let targetFolder: string;

        if (uri) {
            targetFolder = uri.fsPath;
        } else {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
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

    register(context, 'lpc.showParseTree', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'lpc') {
            vscode.window.showWarningMessage('请在 LPC 文件中使用此命令。');
            return;
        }

        try {
            const parseTree = getParseTreeString(editor.document.getText());
            const output = vscode.window.createOutputChannel('LPC ParseTree');
            output.clear();
            output.appendLine(parseTree);
            output.show(true);
        } catch (error: any) {
            vscode.window.showErrorMessage(`解析 LPC 代码时发生错误: ${error.message || error}`);
        }
    });

    register(context, 'lpc.debugParseErrors', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'lpc') {
            vscode.window.showWarningMessage('请在 LPC 文件中使用此命令');
            return;
        }

        const input = CharStreams.fromString(editor.document.getText());
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
            debugListener.errors.forEach((error, index) => {
                output.appendLine(`错误 ${index + 1}: 行 ${error.line}, 列 ${error.column}`);
                output.appendLine(`  token: ${error.offendingToken}`);
                output.appendLine(`  message: ${error.message}`);
                if (error.ruleStack.length) {
                    output.appendLine(`  rule stack: ${error.ruleStack.join(' -> ')}`);
                }
                output.appendLine('');
            });
        }

        output.show(true);
    });

    register(context, 'lpc.scanInheritance', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'lpc') {
            completionProvider.scanInheritance(editor.document);
            return;
        }

        vscode.window.showWarningMessage('请在LPC文件中使用此命令');
    });

    register(context, 'lpc.addServer', () => configManager.addServer());
    register(context, 'lpc.selectServer', () => configManager.selectServer());
    register(context, 'lpc.removeServer', () => configManager.removeServer());
    register(context, 'lpc.manageServers', () => configManager.showServerManager());

    register(context, 'lpc.compileFile', async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'lpc') {
            await compiler.compileFile(editor.document.fileName);
        }
    });

    register(context, 'lpc.showMacros', () => macroManager.showMacrosList());
    register(context, 'lpc.configureMacroPath', () => macroManager.configurePath());

    register(context, 'lpc.startDriver', () => {
        const config = vscode.workspace.getConfiguration('lpc');
        const driverCommand = config.get<string>('driver.command');

        if (!driverCommand) {
            vscode.window.showWarningMessage(
                '未配置驱动启动命令。请在设置中配置 `lpc.driver.command`。',
                '打开设置'
            ).then(selection => {
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

        const terminal = vscode.window.createTerminal({ name: 'MUD Driver', cwd });
        terminal.sendText(driverCommand);
        terminal.show();
    });

    register(context, 'lpc.showPerformanceStats', () => {
        const stats = getGlobalParsedDocumentService().getStats();
        completionInstrumentation.showReport(stats);
        vscode.window.showInformationMessage(completionInstrumentation.formatSummary(stats));
    });

    register(context, 'lpc.clearCache', () => {
        clearGlobalParsedDocumentService();
        completionProvider.clearCache();
        completionInstrumentation.clear();
        vscode.window.showInformationMessage('LPC 解析与补全缓存已清理');
    });
}

function register(
    context: vscode.ExtensionContext,
    commandId: string,
    handler: (...args: any[]) => any
): void {
    context.subscriptions.push(vscode.commands.registerCommand(commandId, handler));
}
