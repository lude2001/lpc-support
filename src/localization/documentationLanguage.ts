import * as vscode from 'vscode';
import type { UiLocale } from './locale';

/** Select the language for new comment text independently of host UI messages. */
export function resolveDocumentationLanguage(setting: unknown): UiLocale {
    return setting === 'en' ? 'en' : 'zh-cn';
}

export function getDocumentationLanguage(resource?: vscode.Uri): UiLocale {
    const setting = vscode.workspace.getConfiguration('lpc', resource)
        .get<unknown>('documentation.language', 'zh-cn');
    return resolveDocumentationLanguage(setting);
}
