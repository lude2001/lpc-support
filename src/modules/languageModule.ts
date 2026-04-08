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
import { ObjectHoverProvider } from '../objectInference/ObjectHoverProvider';
import { ObjectInferenceService } from '../objectInference/ObjectInferenceService';

export async function registerLanguageProviders(registry: ServiceRegistry, context: vscode.ExtensionContext): Promise<void> {
    const efunDocsManager = registry.get(Services.EfunDocs);
    const macroManager = registry.get(Services.MacroManager);
    const completionInstrumentation = registry.get(Services.CompletionInstrumentation);
    const projectConfigService = registry.get(Services.ProjectConfig);
    const objectInferenceService = new ObjectInferenceService(macroManager, projectConfigService);

    const completionProvider = new LPCCompletionItemProvider(
        efunDocsManager,
        macroManager,
        completionInstrumentation,
        objectInferenceService
    );
    registry.register(Services.Completion, completionProvider);

    const formattingProvider = new LPCFormattingProvider();
    const definitionProvider = new LPCDefinitionProvider(macroManager, efunDocsManager, objectInferenceService);
    const objectHoverProvider = new ObjectHoverProvider(objectInferenceService, macroManager);
    const macroHoverProvider: vscode.HoverProvider = {
        provideHover: async (document, position) => {
            const range = document.getWordRangeAtPosition(position);
            if (!range) {
                return;
            }

            const word = document.getText(range);
            if (!/^[A-Z][A-Z0-9_]*_D$/.test(word)) {
                return;
            }

            const macro = macroManager?.getMacro(word);
            if (macro) {
                return new vscode.Hover(macroManager.getMacroHoverContent(macro));
            }

            const canResolve = await macroManager?.canResolveMacro(word);
            if (canResolve) {
                return new vscode.Hover(`宏 \`${word}\` 已定义但无法获取具体值`);
            }
        }
    };

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
        vscode.languages.registerDefinitionProvider('lpc', definitionProvider),
        vscode.languages.registerDocumentSemanticTokensProvider(
            { language: 'lpc' },
            new LPCSemanticTokensProvider(),
            LPCSemanticTokensLegend
        ),
        vscode.languages.registerDocumentSymbolProvider({ language: 'lpc' }, new LPCSymbolProvider()),
        vscode.languages.registerReferenceProvider('lpc', new LPCReferenceProvider()),
        vscode.languages.registerRenameProvider('lpc', new LPCRenameProvider()),
        vscode.languages.registerFoldingRangeProvider({ language: 'lpc' }, new LPCFoldingRangeProvider()),
        vscode.languages.registerHoverProvider('lpc', objectHoverProvider),
        vscode.languages.registerHoverProvider('lpc', macroHoverProvider)
    );
}
