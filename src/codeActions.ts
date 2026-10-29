import * as vscode from 'vscode';
import { GLM4Client, type JavadocContract } from './glm4Client';
import type { LspClientManager } from './lsp/client/LspClientManager';
import { getDocumentationLanguage } from './localization/documentationLanguage';

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
        vscode.window.showErrorMessage(vscode.l10n.t('Select a function in an LPC file'));
        return;
    }

    const config = vscode.workspace.getConfiguration('lpc');
    const enableAutoGeneration = config.get<boolean>('javadoc.enableAutoGeneration', true);

    if (!enableAutoGeneration) {
        vscode.window.showInformationMessage(vscode.l10n.t('Automatic Javadoc generation is disabled'));
        return;
    }

    const selection = editor.selection;
    const documentVersion = editor.document.version;

    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: vscode.l10n.t('Generating Javadoc comment...'),
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
                vscode.window.showErrorMessage(vscode.l10n.t('No function definition was found. Place the cursor inside a function or select the complete function.'));
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
                vscode.window.showErrorMessage(vscode.l10n.t('Could not identify exactly one function declaration. Select the complete function and try again.'));
                return;
            }
            const target = matchingEntries[0];
            if (target.documentationRange) {
                vscode.window.showInformationMessage(vscode.l10n.t('This function already has a documentation comment. Use the Function Documentation Center to complete or update it.'));
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

            progress.report({ increment: 30, message: vscode.l10n.t('Reading function information...') });

            const alwaysShowModelSelector = config.get<boolean>('glm4.alwaysShowModelSelector', false);
            const rememberLastModel = config.get<boolean>('glm4.rememberLastModel', true);
            const lastSelectedModel = config.get<string>('glm4.lastSelectedModel', '');
            const configuredModel = config.get<string>('glm4.model', 'GLM-4-Flash-250414');

            const selectedModel = await selectModel(
                alwaysShowModelSelector, rememberLastModel, lastSelectedModel, configuredModel
            );
            if (!selectedModel) {
                vscode.window.showInformationMessage(vscode.l10n.t('Javadoc generation was cancelled'));
                return;
            }

            const glm4Client = GLM4Client.fromVSCodeConfigWithModel(selectedModel);
            progress.report({ increment: 50, message: vscode.l10n.t('Calling the API with model {0}...', selectedModel) });

            const javadocComment = await glm4Client.generateJavadoc(
                functionText, contract, getDocumentationLanguage(editor.document.uri)
            );
            progress.report({ increment: 80, message: vscode.l10n.t('Inserting comment...') });

            if (editor.document.version !== documentVersion) {
                vscode.window.showErrorMessage(vscode.l10n.t('The document changed during generation. No comment was inserted. Run the command again.'));
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
                throw new Error(vscode.l10n.t('The editor did not accept the comment insertion. Run the command again.'));
            }

            progress.report({ increment: 100, message: vscode.l10n.t('Done') });
            vscode.window.showInformationMessage(vscode.l10n.t('Javadoc comment generated successfully!'));
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : vscode.l10n.t('Unknown error');
        vscode.window.showErrorMessage(vscode.l10n.t('Failed to generate Javadoc comment: {0}', errorMessage));
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
