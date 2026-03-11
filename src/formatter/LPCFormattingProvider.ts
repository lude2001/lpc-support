import * as vscode from 'vscode';
import { getFormatterConfig } from './config';
import { FormattingService } from './FormattingService';

export class LPCFormattingProvider implements vscode.DocumentFormattingEditProvider, vscode.DocumentRangeFormattingEditProvider {
    constructor(private readonly formattingService: FormattingService = new FormattingService()) {}

    public provideDocumentFormattingEdits(
        document: vscode.TextDocument,
        _options: vscode.FormattingOptions,
        _token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.TextEdit[]> {
        getFormatterConfig();
        return this.formattingService.formatDocument(document);
    }

    public provideDocumentRangeFormattingEdits(
        document: vscode.TextDocument,
        range: vscode.Range,
        _options: vscode.FormattingOptions,
        _token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.TextEdit[]> {
        getFormatterConfig();
        return this.formattingService.formatRange(document, range);
    }
}
