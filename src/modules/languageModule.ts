import * as vscode from 'vscode';
import { ServiceRegistry } from '../core/ServiceRegistry';
import { Services } from '../core/ServiceKeys';
import { LPCCodeActionProvider } from '../codeActions';
import { LPCCompletionItemProvider } from '../completionProvider';
import { LPCDefinitionProvider } from '../definitionProvider';
import { LPCFormattingProvider } from '../formatter/LPCFormattingProvider';
import {
    LPCSemanticTokensProvider,
    LPCSemanticTokensLegend
} from '../semanticTokensProvider';
import { LPCSymbolProvider } from '../symbolProvider';
import { LPCReferenceProvider } from '../referenceProvider';
import { LPCRenameProvider } from '../renameProvider';
import { LPCFoldingRangeProvider } from '../foldingProvider';

export function registerLanguageProviders(registry: ServiceRegistry, context: vscode.ExtensionContext): void {
    const efunDocsManager = registry.get(Services.EfunDocs);
    const macroManager = registry.get(Services.MacroManager);
    const completionInstrumentation = registry.get(Services.CompletionInstrumentation);

    const completionProvider = new LPCCompletionItemProvider(
        efunDocsManager,
        macroManager,
        completionInstrumentation
    );
    registry.register(Services.Completion, completionProvider);

    const formattingProvider = new LPCFormattingProvider();

    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider('lpc', completionProvider, '>', '#'),
        vscode.workspace.onDidChangeTextDocument(event => {
            if (event.document.languageId === 'lpc') {
                completionProvider.handleDocumentChange(event.document);
            }
        })
    );

    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            'lpc',
            new LPCCodeActionProvider(),
            {
                providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
            }
        ),
        vscode.languages.registerDocumentFormattingEditProvider('lpc', formattingProvider),
        vscode.languages.registerDocumentRangeFormattingEditProvider('lpc', formattingProvider),
        vscode.languages.registerDefinitionProvider('lpc', new LPCDefinitionProvider(macroManager, efunDocsManager)),
        vscode.languages.registerDocumentSemanticTokensProvider(
            { language: 'lpc' },
            new LPCSemanticTokensProvider(),
            LPCSemanticTokensLegend
        ),
        vscode.languages.registerDocumentSymbolProvider({ language: 'lpc' }, new LPCSymbolProvider()),
        vscode.languages.registerReferenceProvider('lpc', new LPCReferenceProvider()),
        vscode.languages.registerRenameProvider('lpc', new LPCRenameProvider()),
        vscode.languages.registerFoldingRangeProvider({ language: 'lpc' }, new LPCFoldingRangeProvider())
    );
}
