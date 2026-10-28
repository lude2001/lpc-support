import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { resolveUiLocale } from './localization/locale';

export function renderFunctionDocPanelHtml(
    baseDir: string,
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
    nonce: string
): string {
    const locale = resolveUiLocale(vscode.env.language);
    const template = loadTemplate(baseDir);
    if (!template) {
        return getFallbackContent(locale);
    }

    const templateRoot = vscode.Uri.joinPath(extensionUri, 'dist', 'templates');
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(templateRoot, 'functionDocPanel.js')).toString();
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(templateRoot, 'functionDocPanel.css')).toString();

    const tokens: Record<string, string> = {
        lang: locale === 'zh-cn' ? 'zh-CN' : 'en',
        cspSource: webview.cspSource,
        nonce,
        scriptUri,
        styleUri,
        panelTitle: vscode.l10n.t('LPC Function Documentation Center'),
        heading: vscode.l10n.t('Function Documentation Center'),
        waitingDocument: vscode.l10n.t('Waiting for the current document…'),
        connectingService: vscode.l10n.t('Connecting to the language service'),
        refresh: vscode.l10n.t('Refresh'),
        refreshDocumentation: vscode.l10n.t('Refresh function documentation'),
        filterToolbar: vscode.l10n.t('Function filter toolbar'),
        searchPlaceholder: vscode.l10n.t('Search functions, signatures, parameters, or documentation'),
        searchLabel: vscode.l10n.t('Search function documentation'),
        sourceScope: vscode.l10n.t('Source scope'),
        all: vscode.l10n.t('All'),
        currentFile: vscode.l10n.t('Current file'),
        inherited: vscode.l10n.t('Inherited'),
        included: vscode.l10n.t('Included'),
        simulatedEfuns: vscode.l10n.t('Simulated efuns'),
        efun: vscode.l10n.t('Efun'),
        documentationStatus: vscode.l10n.t('Documentation status'),
        allStatuses: vscode.l10n.t('All statuses'),
        complete: vscode.l10n.t('Complete'),
        incomplete: vscode.l10n.t('Incomplete'),
        inconsistent: vscode.l10n.t('Inconsistent'),
        declarationKind: vscode.l10n.t('Declaration kind'),
        allDeclarations: vscode.l10n.t('All declarations'),
        implementation: vscode.l10n.t('Implementation'),
        prototype: vscode.l10n.t('Prototype'),
        functionCatalogue: vscode.l10n.t('Function catalogue'),
        visibleDeclarations: vscode.l10n.t('Visible declarations'),
        declarationList: vscode.l10n.t('Function declaration list'),
        functionDetails: vscode.l10n.t('Function details'),
        selectFunction: vscode.l10n.t('Select a function'),
        selectionHelp: vscode.l10n.t('Select an item in the catalogue to view structured signatures, source relationships, and documentation quality.')
    };
    const localizationData = serializeHtmlJson({
        locale,
        messages: locale === 'zh-cn' ? vscode.l10n.bundle ?? {} : {}
    });
    return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => key === 'localizationData'
        ? localizationData
        : Object.prototype.hasOwnProperty.call(tokens, key) ? escapeHtml(tokens[key]) : match);
}

function loadTemplate(baseDir: string): string | undefined {
    const candidates = [
        path.join(baseDir, 'templates', 'functionDocPanel.html'),
        path.join(baseDir, '..', 'src', 'templates', 'functionDocPanel.html')
    ];

    for (const candidate of candidates) {
        try {
            if (fs.existsSync(candidate)) {
                return fs.readFileSync(candidate, 'utf8');
            }
        } catch (error) {
            console.error(vscode.l10n.t('Failed to read the function documentation template:'), error);
        }
    }
    return undefined;
}

function getFallbackContent(locale: 'en' | 'zh-cn'): string {
    const title = escapeHtml(vscode.l10n.t('Could not load the Function Documentation Center'));
    const description = escapeHtml(vscode.l10n.t('Template resources are unavailable.'));
    return `<!DOCTYPE html><html lang="${locale === 'zh-cn' ? 'zh-CN' : 'en'}"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none';"><title>${title}</title></head><body><h3>${title}</h3><p>${description}</p></body></html>`;
}

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]!);
}

function serializeHtmlJson(value: unknown): string {
    return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (character) =>
        `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
}
