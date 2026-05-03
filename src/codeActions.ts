import * as vscode from 'vscode';
import { GLM4Client } from './glm4Client';
import { FunctionInfoExtractor } from './language/documentation/FunctionInfoExtractor';
import type { DocumentAnalysisService } from './semantic/documentAnalysisService';

let commandsRegistered = false;
const RENAME_COMMAND_IDS = ['lpc.renameVarToSnakeCase', 'lpc.renameVarToCamelCase'] as const;
let functionInfoExtractor: FunctionInfoExtractor | undefined;

export function registerLpcCodeActionCommands(
    analysisService: Pick<DocumentAnalysisService, 'getSyntaxDocument'>
): void {
    functionInfoExtractor = new FunctionInfoExtractor(analysisService);

    if (commandsRegistered) {
        return;
    }

    for (const commandId of RENAME_COMMAND_IDS) {
        registerRenameCommand(commandId);
    }

    vscode.commands.registerCommand('lpc.generateJavadoc', generateJavadocCommand);

    commandsRegistered = true;
}

function registerRenameCommand(id: string): void {
    vscode.commands.registerCommand(id, async (
        uri: vscode.Uri,
        position: vscode.Position,
        newName: string
    ) => {
        const edit = await vscode.commands.executeCommand<vscode.WorkspaceEdit>(
            'vscode.executeDocumentRenameProvider',
            uri,
            position,
            newName
        );
        if (edit) {
            await vscode.workspace.applyEdit(edit);
        }
    });
}

async function generateJavadocCommand(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'lpc') {
        vscode.window.showErrorMessage('请在LPC文件中选择一个函数');
        return;
    }

    const config = vscode.workspace.getConfiguration('lpc');
    const enableAutoGeneration = config.get<boolean>('javadoc.enableAutoGeneration', true);

    if (!enableAutoGeneration) {
        vscode.window.showInformationMessage('Javadoc自动生成功能已禁用');
        return;
    }

    const selection = editor.selection;

    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '正在生成Javadoc注释...',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });

            let functionInfo: any = null;
            if (!selection.isEmpty) {
                functionInfo = functionInfoExtractor?.parseFunctionFromSelection(editor.document, selection);
            } else {
                functionInfo = functionInfoExtractor?.parseFunctionFromCursor(editor.document, selection.active);
            }

            if (!functionInfo) {
                vscode.window.showErrorMessage('无法找到函数定义，请确保光标位于函数内部或选择完整的函数');
                return;
            }

            progress.report({ increment: 30, message: '解析函数信息...' });

            const alwaysShowModelSelector = config.get<boolean>('glm4.alwaysShowModelSelector', false);
            const rememberLastModel = config.get<boolean>('glm4.rememberLastModel', true);
            const lastSelectedModel = config.get<string>('glm4.lastSelectedModel', '');

            const selectedModel = await selectModel(alwaysShowModelSelector, rememberLastModel, lastSelectedModel);
            if (!selectedModel) {
                vscode.window.showInformationMessage('已取消生成Javadoc注释');
                return;
            }

            const glm4Client = GLM4Client.fromVSCodeConfigWithModel(selectedModel);
            progress.report({ increment: 50, message: `使用模型 ${selectedModel} 调用API...` });

            const javadocComment = await glm4Client.generateJavadoc(functionInfo.fullText);
            progress.report({ increment: 80, message: '插入注释...' });

            const functionStartLine = functionInfo.line ?? selection.active.line;
            const insertPosition = new vscode.Position(functionStartLine, 0);
            const indent = getLineIndentation(editor.document, functionStartLine);
            const formattedComment = formatJavadocComment(javadocComment, indent);

            await editor.edit((editBuilder) => {
                editBuilder.insert(insertPosition, formattedComment + '\n');
            });

            progress.report({ increment: 100, message: '完成' });
            vscode.window.showInformationMessage('Javadoc注释生成成功！');
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        vscode.window.showErrorMessage(`生成Javadoc注释失败: ${errorMessage}`);
    }
}

async function selectModel(
    alwaysShowModelSelector: boolean,
    rememberLastModel: boolean,
    lastSelectedModel: string
): Promise<string | undefined> {
    if (alwaysShowModelSelector) {
        return GLM4Client.selectModel();
    }

    if (rememberLastModel && lastSelectedModel) {
        return lastSelectedModel;
    }

    return GLM4Client.selectModel();
}

function getLineIndentation(document: vscode.TextDocument, lineNumber: number): string {
    const line = document.lineAt(lineNumber);
    const match = line.text.match(/^(\s*)/);
    return match ? match[1] : '';
}

function formatJavadocComment(comment: string, indent: string): string {
    return comment
        .split('\n')
        .map((line) => line.trim() === '' ? indent : indent + line)
        .join('\n');
}
