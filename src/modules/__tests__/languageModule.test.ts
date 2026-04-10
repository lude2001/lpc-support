import * as vscode from 'vscode';
import { ServiceRegistry } from '../../core/ServiceRegistry';
import { Services } from '../../core/ServiceKeys';
import { registerLanguageProviders } from '../languageModule';
import { LPCCompletionItemProvider } from '../../completionProvider';
import { LPCCodeActionProvider } from '../../codeActions';
import { LPCDefinitionProvider } from '../../definitionProvider';
import { LPCFormattingProvider } from '../../formatter/LPCFormattingProvider';
import { LPCSemanticTokensProvider, LPCSemanticTokensLegend } from '../../semanticTokensProvider';
import { LPCSymbolProvider } from '../../symbolProvider';
import { LPCReferenceProvider } from '../../referenceProvider';
import { LPCRenameProvider } from '../../renameProvider';
import { LPCFoldingRangeProvider } from '../../foldingProvider';
import { ObjectHoverProvider } from '../../objectInference/ObjectHoverProvider';
import { ObjectInferenceService } from '../../objectInference/ObjectInferenceService';

jest.mock('../../completionProvider', () => ({
    LPCCompletionItemProvider: jest.fn()
}));

jest.mock('../../codeActions', () => ({
    LPCCodeActionProvider: jest.fn()
}));

jest.mock('../../definitionProvider', () => ({
    LPCDefinitionProvider: jest.fn()
}));

jest.mock('../../formatter/LPCFormattingProvider', () => ({
    LPCFormattingProvider: jest.fn()
}));

jest.mock('../../semanticTokensProvider', () => ({
    LPCSemanticTokensProvider: jest.fn(),
    LPCSemanticTokensLegend: { id: 'semanticTokensLegend' }
}));

jest.mock('../../symbolProvider', () => ({
    LPCSymbolProvider: jest.fn()
}));

jest.mock('../../referenceProvider', () => ({
    LPCReferenceProvider: jest.fn()
}));

jest.mock('../../renameProvider', () => ({
    LPCRenameProvider: jest.fn()
}));

jest.mock('../../foldingProvider', () => ({
    LPCFoldingRangeProvider: jest.fn()
}));

jest.mock('../../objectInference/ObjectHoverProvider', () => ({
    ObjectHoverProvider: jest.fn()
}));

jest.mock('../../objectInference/ObjectInferenceService', () => ({
    ObjectInferenceService: jest.fn()
}));

describe('registerLanguageProviders', () => {
    let registry: ServiceRegistry;
    let context: vscode.ExtensionContext;
    let completionProvider: { handleDocumentChange: jest.Mock };
    let efunDocsManager: { id: string };
    let macroManager: {
        id: string;
        getMacro: jest.Mock;
        getMacroHoverContent: jest.Mock;
        canResolveMacro: jest.Mock;
    };
    let completionInstrumentation: { id: string };
    let codeActionProvider: {};
    let formattingProviderInstanceA: { id: string };
    let formattingProviderInstanceB: { id: string };
    let definitionProvider: {};
    let objectInferenceService: {};
    let objectHoverProvider: {};
    let semanticTokensProvider: {};
    let symbolProvider: {};
    let referenceProvider: {};
    let renameProvider: {};
    let foldingProvider: {};

    let projectConfigService: { loadForWorkspace: jest.Mock };

    beforeEach(() => {
        registry = new ServiceRegistry();
        context = { subscriptions: [] } as vscode.ExtensionContext;

        completionProvider = { handleDocumentChange: jest.fn() };
        efunDocsManager = { id: 'efunDocsManager' };
        macroManager = {
            id: 'macroManager',
            getMacro: jest.fn(),
            getMacroHoverContent: jest.fn(),
            canResolveMacro: jest.fn()
        };
        completionInstrumentation = { id: 'completionInstrumentation' };
        codeActionProvider = { id: 'codeActionProvider' };
        formattingProviderInstanceA = { id: 'formattingProvider-a' };
        formattingProviderInstanceB = { id: 'formattingProvider-b' };
        definitionProvider = { id: 'definitionProvider' };
        objectInferenceService = { id: 'objectInferenceService' };
        objectHoverProvider = { id: 'objectHoverProvider' };
        semanticTokensProvider = { id: 'semanticTokensProvider' };
        symbolProvider = { id: 'symbolProvider' };
        referenceProvider = { id: 'referenceProvider' };
        renameProvider = { id: 'renameProvider' };
        foldingProvider = { id: 'foldingProvider' };
        projectConfigService = { loadForWorkspace: jest.fn().mockResolvedValue(undefined) };

        (LPCCompletionItemProvider as unknown as jest.Mock).mockReset().mockImplementation(() => completionProvider);
        (LPCCodeActionProvider as unknown as jest.Mock).mockReset().mockImplementation(() => codeActionProvider);
        (LPCDefinitionProvider as unknown as jest.Mock).mockReset().mockImplementation(() => definitionProvider);
        (ObjectInferenceService as unknown as jest.Mock).mockReset().mockImplementation(() => objectInferenceService);
        (ObjectHoverProvider as unknown as jest.Mock).mockReset().mockImplementation(() => objectHoverProvider);
        (LPCFormattingProvider as unknown as jest.Mock).mockReset().mockImplementationOnce(() => formattingProviderInstanceA).mockImplementationOnce(() => formattingProviderInstanceB);
        (LPCSemanticTokensProvider as unknown as jest.Mock).mockReset().mockImplementation(() => semanticTokensProvider);
        (LPCSymbolProvider as unknown as jest.Mock).mockReset().mockImplementation(() => symbolProvider);
        (LPCReferenceProvider as unknown as jest.Mock).mockReset().mockImplementation(() => referenceProvider);
        (LPCRenameProvider as unknown as jest.Mock).mockReset().mockImplementation(() => renameProvider);
        (LPCFoldingRangeProvider as unknown as jest.Mock).mockReset().mockImplementation(() => foldingProvider);

        registry.register(Services.EfunDocs, efunDocsManager);
        registry.register(Services.MacroManager, macroManager);
        registry.register(Services.CompletionInstrumentation, completionInstrumentation);
        registry.register(Services.ProjectConfig, projectConfigService as any);

        (vscode.languages.registerCompletionItemProvider as jest.Mock).mockClear();
        (vscode.languages.registerCodeActionsProvider as jest.Mock).mockClear();
        (vscode.languages.registerDocumentFormattingEditProvider as jest.Mock).mockClear();
        (vscode.languages.registerDocumentRangeFormattingEditProvider as jest.Mock).mockClear();
        (vscode.languages.registerDefinitionProvider as jest.Mock).mockClear();
        (vscode.languages.registerDocumentSemanticTokensProvider as jest.Mock).mockClear();
        (vscode.languages.registerDocumentSymbolProvider as jest.Mock).mockClear();
        (vscode.languages.registerReferenceProvider as jest.Mock).mockClear();
        (vscode.languages.registerRenameProvider as jest.Mock).mockClear();
        (vscode.languages.registerFoldingRangeProvider as jest.Mock).mockClear();
        (vscode.languages.registerHoverProvider as jest.Mock).mockClear();
        (vscode.workspace.onDidChangeTextDocument as jest.Mock).mockClear();
    });

    test('registers language providers and completion service using registry services', async () => {
        await registerLanguageProviders(registry, context);

        expect(LPCCompletionItemProvider).toHaveBeenCalledTimes(1);
        expect(LPCCompletionItemProvider).toHaveBeenCalledWith(
            efunDocsManager,
            macroManager,
            completionInstrumentation,
            objectInferenceService
        );
        expect(ObjectInferenceService).toHaveBeenCalledWith(macroManager, projectConfigService);
        expect(registry.get(Services.Completion)).toBe(completionProvider);
        expect(vscode.languages.registerCompletionItemProvider)
            .toHaveBeenCalledWith('lpc', completionProvider, '>', '#');
        expect(vscode.languages.registerCodeActionsProvider)
            .toHaveBeenCalledWith('lpc', codeActionProvider, {
                providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
            });
        expect(LPCFormattingProvider).toHaveBeenCalledTimes(1);
        expect(vscode.languages.registerDocumentFormattingEditProvider)
            .toHaveBeenCalledWith('lpc', formattingProviderInstanceA);
        expect(vscode.languages.registerDocumentRangeFormattingEditProvider)
            .toHaveBeenCalledWith('lpc', formattingProviderInstanceA);
        expect(vscode.languages.registerDefinitionProvider)
            .toHaveBeenCalledWith('lpc', definitionProvider);
        expect(LPCDefinitionProvider).toHaveBeenCalledWith(
            macroManager,
            efunDocsManager,
            objectInferenceService,
            expect.anything()
        );
        expect(ObjectHoverProvider).toHaveBeenCalledWith(objectInferenceService, macroManager, expect.anything());
        expect(vscode.languages.registerDocumentSemanticTokensProvider)
            .toHaveBeenCalledWith(
                { language: 'lpc' },
                semanticTokensProvider,
                LPCSemanticTokensLegend
            );
        expect(vscode.languages.registerDocumentSymbolProvider)
            .toHaveBeenCalledWith({ language: 'lpc' }, symbolProvider);
        expect(vscode.languages.registerReferenceProvider)
            .toHaveBeenCalledWith('lpc', referenceProvider);
        expect(vscode.languages.registerRenameProvider)
            .toHaveBeenCalledWith('lpc', renameProvider);
        expect(vscode.languages.registerFoldingRangeProvider)
            .toHaveBeenCalledWith({ language: 'lpc' }, foldingProvider);
        expect(vscode.languages.registerHoverProvider).toHaveBeenCalledTimes(2);
        expect(vscode.languages.registerHoverProvider)
            .toHaveBeenNthCalledWith(1, 'lpc', objectHoverProvider);
        expect(vscode.languages.registerHoverProvider)
            .toHaveBeenNthCalledWith(2, 'lpc', expect.objectContaining({
                provideHover: expect.any(Function)
            }));
        expect(vscode.workspace.onDidChangeTextDocument).toHaveBeenCalledTimes(1);
        expect(context.subscriptions).toHaveLength(13);
    });

    test('calls completionProvider.handleDocumentChange for lpc documents only', async () => {
        await registerLanguageProviders(registry, context);

        const onChangeHandler = (vscode.workspace.onDidChangeTextDocument as jest.Mock).mock.calls[0][0];
        onChangeHandler({ document: { languageId: 'txt' } });
        onChangeHandler({ document: { languageId: 'lpc' } });

        expect(completionProvider.handleDocumentChange).toHaveBeenCalledTimes(1);
        expect(completionProvider.handleDocumentChange).toHaveBeenCalledWith({ languageId: 'lpc' });
    });

    test('registers macro hover provider that resolves defined and unresolved macros', async () => {
        const macro = { name: 'USER_D', value: '/adm/user' };
        const hoverContent = new vscode.MarkdownString('macro docs');
        macroManager.getMacro.mockReturnValue(macro);
        macroManager.getMacroHoverContent.mockReturnValue(hoverContent);
        macroManager.canResolveMacro.mockResolvedValue(true);

        await registerLanguageProviders(registry, context);

        const hoverProvider = (vscode.languages.registerHoverProvider as jest.Mock).mock.calls[1][1];
        const document = {
            getWordRangeAtPosition: jest.fn(() => ({ start: new vscode.Position(0, 0), end: new vscode.Position(0, 6) })),
            getText: jest.fn(() => 'USER_D')
        } as any;

        const resolvedHover = await hoverProvider.provideHover(document, new vscode.Position(0, 0), {} as any);

        expect(macroManager.getMacro).toHaveBeenCalledWith('USER_D');
        expect(macroManager.getMacroHoverContent).toHaveBeenCalledWith(macro);
        expect(resolvedHover).toBeInstanceOf(vscode.Hover);
        expect((resolvedHover as vscode.Hover).contents).toBe(hoverContent);

        macroManager.getMacro.mockReturnValue(undefined);
        const unresolvedHover = await hoverProvider.provideHover(document, new vscode.Position(0, 0), {} as any);

        expect(macroManager.canResolveMacro).toHaveBeenCalledWith('USER_D');
        expect(unresolvedHover).toBeInstanceOf(vscode.Hover);
        expect(((unresolvedHover as vscode.Hover).contents as vscode.MarkdownString).value || (unresolvedHover as any).contents).toContain('USER_D');
    });

    test('passes project config service to ObjectInferenceService without eagerly binding the first workspace', async () => {
        (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/workspace-a' } }, { uri: { fsPath: '/workspace-b' } }];

        await registerLanguageProviders(registry, context);

        expect(projectConfigService.loadForWorkspace).not.toHaveBeenCalled();
        expect(ObjectInferenceService).toHaveBeenCalledWith(macroManager, projectConfigService);
    });
});

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
