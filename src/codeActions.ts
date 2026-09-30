import * as vscode from 'vscode';
import { GLM4Client, type JavadocContract } from './glm4Client';
import type { LspClientManager } from './lsp/client/LspClientManager';

const RENAME_COMMAND_IDS = ['lpc.renameVarToSnakeCase', 'lpc.renameVarToCamelCase'] as const;

interface RustDocumentationEntry {
    name: string;
    range: {
        start: { line: number; character: number };
        end: { line: number; character: number };
    };
    documentationRange?: unknown;
    structuredSignature?: {
        returnType?: string;
        parameters: Array<{ name?: string }>;
    };
}

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
    const documentVersion = editor.document.version;

    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '正在生成Javadoc注释...',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });

            let functionText: string | undefined;
            let functionStartLine: number | undefined;
            let declarationRange: vscode.Range | undefined;
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
                    declarationRange = range;
                }
            }

            if (!functionText || functionStartLine === undefined) {
                vscode.window.showErrorMessage('无法找到函数定义，请确保光标位于函数内部或选择完整的函数');
                return;
            }

            const lookup = await lspClientManager?.sendRequest<{
                currentFile: { entries: RustDocumentationEntry[] };
            }>('lpc/functionDocumentation', {
                textDocument: { uri: editor.document.uri.toString() }
            });
            const entries = lookup?.currentFile?.entries ?? [];
            const matchingEntries = entries.filter((entry) => declarationRange
                ? entry.range.start.line === declarationRange.start.line
                    && entry.range.start.character === declarationRange.start.character
                : entry.range.start.line >= selection.start.line
                    && entry.range.end.line <= selection.end.line);
            if (matchingEntries.length !== 1) {
                vscode.window.showErrorMessage('无法确认唯一的函数声明，请选择完整函数后重试。');
                return;
            }
            const target = matchingEntries[0];
            if (target.documentationRange) {
                vscode.window.showInformationMessage('该函数已有文档注释，请使用函数文档中心补全或更新。');
                return;
            }
            functionStartLine = target.range.start.line;
            const contract: JavadocContract | undefined = target.structuredSignature
                && target.structuredSignature.parameters.every((parameter) => Boolean(parameter.name))
                ? {
                    name: target.name,
                    parameters: target.structuredSignature.parameters.map((parameter) => parameter.name!),
                    returnType: target.structuredSignature.returnType
                }
                : undefined;

            progress.report({ increment: 30, message: '解析函数信息...' });

            const alwaysShowModelSelector = config.get<boolean>('glm4.alwaysShowModelSelector', false);
            const rememberLastModel = config.get<boolean>('glm4.rememberLastModel', true);
            const lastSelectedModel = config.get<string>('glm4.lastSelectedModel', '');
            const configuredModel = config.get<string>('glm4.model', 'GLM-4-Flash-250414');

            const selectedModel = await selectModel(
                alwaysShowModelSelector, rememberLastModel, lastSelectedModel, configuredModel
            );
            if (!selectedModel) {
                vscode.window.showInformationMessage('已取消生成Javadoc注释');
                return;
            }

            const glm4Client = GLM4Client.fromVSCodeConfigWithModel(selectedModel);
            progress.report({ increment: 50, message: `使用模型 ${selectedModel} 调用API...` });

            const javadocComment = await glm4Client.generateJavadoc(functionText, contract);
            progress.report({ increment: 80, message: '插入注释...' });

            if (editor.document.version !== documentVersion) {
                vscode.window.showErrorMessage('生成期间文档已变化，未写入注释；请重新执行。');
                return;
            }

            const insertPosition = new vscode.Position(functionStartLine, 0);
            const indent = getLineIndentation(editor.document, functionStartLine);
            const eol = editor.document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
            const formattedComment = formatJavadocComment(javadocComment, indent, eol);

            const applied = await editor.edit((editBuilder) => {
                editBuilder.insert(insertPosition, formattedComment + eol);
            });

            if (!applied) {
                throw new Error('编辑器未接受注释插入，请重新执行。');
            }

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
    lastSelectedModel: string,
    configuredModel: string
): Promise<string | undefined> {
    if (alwaysShowModelSelector) {
        return GLM4Client.selectModel();
    }

    if (rememberLastModel && lastSelectedModel) {
        return lastSelectedModel;
    }

    return configuredModel;
}

function getLineIndentation(document: vscode.TextDocument, lineNumber: number): string {
    const line = document.lineAt(lineNumber);
    const match = line.text.match(/^(\s*)/);
    return match ? match[1] : '';
}

function formatJavadocComment(comment: string, indent: string, eol: string): string {
    return comment
        .split(/\r?\n/u)
        .map((line) => line.trim() === '' ? indent : indent + line)
        .join(eol);
}
