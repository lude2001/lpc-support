import * as vscode from 'vscode';
import { GLM4Client } from './glm4Client';
import type { LspClientManager } from './lsp/client/LspClientManager';

const RENAME_COMMAND_IDS = ['lpc.renameVarToSnakeCase', 'lpc.renameVarToCamelCase'] as const;

export interface LpcCommandHandler {
    id: string;
    handler: (...args: any[]) => any;
}

export function createLpcCodeActionCommandHandlers(
    lspClientManager: Pick<LspClientManager, 'sendRequest'> | undefined
): LpcCommandHandler[] {
    return [
        ...RENAME_COMMAND_IDS.map((id) => ({
            id,
            handler: createRenameCommandHandler()
        })),
        {
            id: 'lpc.generateJavadoc',
            handler: () => generateJavadocCommand(lspClientManager)
        }
    ];
}

function createRenameCommandHandler(): LpcCommandHandler['handler'] {
    return async (
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
    };
}

async function generateJavadocCommand(
    lspClientManager: Pick<LspClientManager, 'sendRequest'> | undefined
): Promise<void> {
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

            let functionText: string | undefined;
            let functionStartLine: number | undefined;
            if (!selection.isEmpty) {
                functionText = editor.document.getText(selection);
                functionStartLine = selection.start.line;
            } else {
                const functionRange = await lspClientManager?.sendRequest<{
                    name: string;
                    range: {
                        start: { line: number; character: number };
                        end: { line: number; character: number };
                    };
                }>('lpc/enclosingFunction', {
                    textDocument: { uri: editor.document.uri.toString() },
                    position: {
                        line: selection.active.line,
                        character: selection.active.character
                    }
                });
                if (functionRange) {
                    const range = new vscode.Range(
                        functionRange.range.start.line,
                        functionRange.range.start.character,
                        functionRange.range.end.line,
                        functionRange.range.end.character
                    );
                    functionText = editor.document.getText(range);
                    functionStartLine = range.start.line;
                }
            }

            if (!functionText || functionStartLine === undefined) {
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

            const javadocComment = await glm4Client.generateJavadoc(functionText);
            progress.report({ increment: 80, message: '插入注释...' });

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
