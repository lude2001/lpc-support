import * as vscode from 'vscode';
import { ServiceRegistry } from '../ServiceRegistry';
import { Services } from '../ServiceKeys';
import { registerCoreServices } from '../../modules/coreModule';
import { MacroManager } from '../../macroManager';
import { EfunDocsManager } from '../../efunDocs';
import { CompletionInstrumentation } from '../../completion/completionInstrumentation';
import { LPCConfigManager } from '../../config';
import { LPCCompiler } from '../../compiler';

jest.mock('../../macroManager', () => ({
    MacroManager: jest.fn()
}));

jest.mock('../../efunDocs', () => ({
    EfunDocsManager: jest.fn()
}));

jest.mock('../../completion/completionInstrumentation', () => ({
    CompletionInstrumentation: jest.fn()
}));

jest.mock('../../config', () => ({
    LPCConfigManager: jest.fn()
}));

jest.mock('../../compiler', () => ({
    LPCCompiler: jest.fn()
}));

describe('registerCoreServices', () => {
    let registry: ServiceRegistry;
    let context: vscode.ExtensionContext;
    let macroManager: vscode.Disposable & { id: string };
    let efunDocsManager: { id: string };
    let completionInstrumentation: vscode.Disposable & { id: string };
    let configManager: { id: string };
    let compiler: { id: string };

    beforeEach(() => {
        registry = new ServiceRegistry();
        context = {
            subscriptions: [],
            extensionPath: '/mock/extension',
            globalStoragePath: '/mock/storage'
        } as vscode.ExtensionContext;

        macroManager = { id: 'macroManager', dispose: jest.fn() };
        efunDocsManager = { id: 'efunDocsManager' };
        completionInstrumentation = { id: 'completionInstrumentation', dispose: jest.fn() };
        configManager = { id: 'configManager' };
        compiler = { id: 'compiler' };

        (MacroManager as unknown as jest.Mock).mockReset().mockImplementation(() => macroManager);
        (EfunDocsManager as unknown as jest.Mock).mockReset().mockImplementation(() => efunDocsManager);
        (CompletionInstrumentation as unknown as jest.Mock).mockReset().mockImplementation(() => completionInstrumentation);
        (LPCConfigManager as unknown as jest.Mock).mockReset().mockImplementation(() => configManager);
        (LPCCompiler as unknown as jest.Mock).mockReset().mockImplementation(() => compiler);
    });

    test('registers core services and tracks expected disposables', () => {
        registerCoreServices(registry, context);

        expect(MacroManager).toHaveBeenCalledTimes(1);
        expect(EfunDocsManager).toHaveBeenCalledTimes(1);
        expect(EfunDocsManager).toHaveBeenCalledWith(context);
        expect(CompletionInstrumentation).toHaveBeenCalledTimes(1);
        expect(LPCConfigManager).toHaveBeenCalledTimes(1);
        expect(LPCConfigManager).toHaveBeenCalledWith(context);
        expect(LPCCompiler).toHaveBeenCalledTimes(1);
        expect(LPCCompiler).toHaveBeenCalledWith(configManager);

        expect(registry.get(Services.MacroManager)).toBe(macroManager);
        expect(registry.get(Services.EfunDocs)).toBe(efunDocsManager);
        expect(registry.get(Services.ConfigManager)).toBe(configManager);
        expect(registry.get(Services.Compiler)).toBe(compiler);
        expect(registry.get(Services.CompletionInstrumentation)).toBe(completionInstrumentation);

        expect(context.subscriptions).toEqual([macroManager, completionInstrumentation]);
        expect(typeof context.subscriptions[0].dispose).toBe('function');
        expect(typeof context.subscriptions[1].dispose).toBe('function');
    });
});
