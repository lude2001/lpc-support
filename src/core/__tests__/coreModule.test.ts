import * as vscode from 'vscode';
import { ServiceRegistry } from '../ServiceRegistry';
import { Services } from '../ServiceKeys';
import { registerCoreServices } from '../../modules/coreModule';
import { MacroManager } from '../../macroManager';
import { EfunDocsManager } from '../../efunDocs';
import { CompletionInstrumentation } from '../../completion/completionInstrumentation';
import { LPCConfigManager } from '../../config';
import { LPCCompiler } from '../../compiler';
import { DocumentLifecycleService } from '../DocumentLifecycleService';
import { getGlobalParsedDocumentService } from '../../parser/ParsedDocumentService';
import { LpcProjectConfigService } from '../../projectConfig/LpcProjectConfigService';
import { DocumentSemanticSnapshotService } from '../../semantic/documentSemanticSnapshotService';
import { configureDiagnosticsAnalysisService } from '../../diagnostics/createDiagnosticsStack';
import { configureSimulatedEfunScannerAnalysisService } from '../../efun/SimulatedEfunScanner';
import { configureSymbolReferenceAnalysisService } from '../../symbolReferenceResolver';
import { configureTargetMethodLookupAnalysisService } from '../../targetMethodLookup';
import { configureEfunHoverAnalysisService } from '../../language/services/navigation/EfunLanguageHoverService';
import { configureScopedMethodIdentifierAnalysisService } from '../../language/services/navigation/ScopedMethodIdentifierSupport';

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

jest.mock('../../projectConfig/LpcProjectConfigService', () => ({
    LpcProjectConfigService: jest.fn()
}));

jest.mock('../DocumentLifecycleService', () => ({
    DocumentLifecycleService: jest.fn()
}));

jest.mock('../../semantic/documentSemanticSnapshotService', () => ({
    DocumentSemanticSnapshotService: {
        getInstance: jest.fn()
    }
}));

jest.mock('../../parser/ParsedDocumentService', () => ({
    getGlobalParsedDocumentService: jest.fn()
}));

jest.mock('../../diagnostics/createDiagnosticsStack', () => ({
    configureDiagnosticsAnalysisService: jest.fn()
}));

jest.mock('../../efun/SimulatedEfunScanner', () => ({
    configureSimulatedEfunScannerAnalysisService: jest.fn()
}));

jest.mock('../../symbolReferenceResolver', () => ({
    configureSymbolReferenceAnalysisService: jest.fn()
}));

jest.mock('../../targetMethodLookup', () => ({
    configureTargetMethodLookupAnalysisService: jest.fn()
}));

jest.mock('../../language/services/navigation/EfunLanguageHoverService', () => ({
    configureEfunHoverAnalysisService: jest.fn()
}));

jest.mock('../../language/services/navigation/ScopedMethodIdentifierSupport', () => ({
    configureScopedMethodIdentifierAnalysisService: jest.fn()
}));

describe('registerCoreServices', () => {
    let registry: ServiceRegistry;
    let context: vscode.ExtensionContext;
    let macroManager: vscode.Disposable & { id: string };
    let efunDocsManager: { id: string };
    let completionInstrumentation: vscode.Disposable & { id: string };
    let configManager: { id: string };
    let compiler: { id: string };
    let projectConfigService: { id: string };
    let lifecycle: vscode.Disposable & { id: string; onInvalidate: jest.Mock };
    let parsedDocumentService: { invalidate: jest.Mock };
    let analysisService: { clearCache: jest.Mock };

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
        projectConfigService = { id: 'projectConfigService' };
        lifecycle = { id: 'lifecycle', dispose: jest.fn(), onInvalidate: jest.fn() };
        parsedDocumentService = { invalidate: jest.fn() };
        analysisService = { clearCache: jest.fn() };

        (MacroManager as unknown as jest.Mock).mockReset().mockImplementation(() => macroManager);
        (EfunDocsManager as unknown as jest.Mock).mockReset().mockImplementation(() => efunDocsManager);
        (CompletionInstrumentation as unknown as jest.Mock).mockReset().mockImplementation(() => completionInstrumentation);
        (LPCConfigManager as unknown as jest.Mock).mockReset().mockImplementation(() => configManager);
        (LPCCompiler as unknown as jest.Mock).mockReset().mockImplementation(() => compiler);
        (LpcProjectConfigService as unknown as jest.Mock).mockReset().mockImplementation(() => projectConfigService);
        (DocumentLifecycleService as unknown as jest.Mock).mockReset().mockImplementation(() => lifecycle);
        (getGlobalParsedDocumentService as jest.Mock).mockReset().mockReturnValue(parsedDocumentService);
        ((DocumentSemanticSnapshotService as any).getInstance as jest.Mock).mockReset().mockReturnValue(analysisService);
        (configureDiagnosticsAnalysisService as jest.Mock).mockReset();
        (configureSimulatedEfunScannerAnalysisService as jest.Mock).mockReset();
        (configureSymbolReferenceAnalysisService as jest.Mock).mockReset();
        (configureTargetMethodLookupAnalysisService as jest.Mock).mockReset();
        (configureEfunHoverAnalysisService as jest.Mock).mockReset();
        (configureScopedMethodIdentifierAnalysisService as jest.Mock).mockReset();
    });

    test('registers core services, tracks disposables, and wires lifecycle invalidation', () => {
        registerCoreServices(registry, context);

        expect(MacroManager).toHaveBeenCalledTimes(1);
        expect(MacroManager).toHaveBeenCalledWith(projectConfigService);
        expect(EfunDocsManager).toHaveBeenCalledTimes(1);
        expect(EfunDocsManager).toHaveBeenCalledWith(context, projectConfigService);
        expect(CompletionInstrumentation).toHaveBeenCalledTimes(1);
        expect(LPCConfigManager).toHaveBeenCalledTimes(1);
        expect(LPCConfigManager).toHaveBeenCalledWith(context);
        expect(LPCCompiler).toHaveBeenCalledTimes(1);
        expect(LPCCompiler).toHaveBeenCalledWith(configManager);
        expect(LpcProjectConfigService).toHaveBeenCalledTimes(1);
        expect(DocumentLifecycleService).toHaveBeenCalledTimes(1);

        expect(registry.get(Services.MacroManager)).toBe(macroManager);
        expect(registry.get(Services.EfunDocs)).toBe(efunDocsManager);
        expect(registry.get(Services.ConfigManager)).toBe(configManager);
        expect(registry.get(Services.Compiler)).toBe(compiler);
        expect(registry.get(Services.ProjectConfig)).toBe(projectConfigService);
        expect(registry.get(Services.CompletionInstrumentation)).toBe(completionInstrumentation);
        expect(registry.get(Services.Lifecycle)).toBe(lifecycle);
        expect(DocumentSemanticSnapshotService.getInstance).toHaveBeenCalledTimes(1);
        expect(configureDiagnosticsAnalysisService).toHaveBeenCalledWith(analysisService);
        expect(configureSimulatedEfunScannerAnalysisService).toHaveBeenCalledWith(analysisService);
        expect(configureSymbolReferenceAnalysisService).toHaveBeenCalledWith(analysisService);
        expect(configureTargetMethodLookupAnalysisService).toHaveBeenCalledWith(analysisService);
        expect(configureEfunHoverAnalysisService).toHaveBeenCalledWith(analysisService);
        expect(configureScopedMethodIdentifierAnalysisService).toHaveBeenCalledWith(analysisService);

        expect(context.subscriptions).toEqual([macroManager, completionInstrumentation, lifecycle]);
        expect(typeof context.subscriptions[0].dispose).toBe('function');
        expect(typeof context.subscriptions[1].dispose).toBe('function');
        expect(typeof context.subscriptions[2].dispose).toBe('function');

        expect(lifecycle.onInvalidate).toHaveBeenCalledTimes(1);

        const lifecycleHandler = lifecycle.onInvalidate.mock.calls[0][0];
        const uri = vscode.Uri.file('/virtual/lifecycle.c');
        lifecycleHandler(uri);

        expect(parsedDocumentService.invalidate).toHaveBeenCalledTimes(1);
        expect(parsedDocumentService.invalidate).toHaveBeenCalledWith(uri);
        expect(analysisService.clearCache).toHaveBeenCalledTimes(1);
        expect(analysisService.clearCache).toHaveBeenCalledWith(uri.toString());
    });
});
