import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import { ServiceRegistry } from '../ServiceRegistry';
import { Services } from '../ServiceKeys';
import { registerCoreServices } from '../../modules/coreModule';
import { EfunDocsManager } from '../../efunDocs';
import { createDefaultFunctionDocumentationService } from '../../language/documentation/FunctionDocumentationService';
import { CompletionInstrumentation } from '../../completion/completionInstrumentation';
import { LPCCompiler } from '../../compiler';
import { LpcFrontendService } from '../../frontend/LpcFrontendService';
import { DocumentLifecycleService } from '../DocumentLifecycleService';
import { getGlobalParsedDocumentService } from '../../parser/ParsedDocumentService';
import { LpcProjectConfigService } from '../../projectConfig/LpcProjectConfigService';
import { DocumentSemanticSnapshotService } from '../../semantic/documentSemanticSnapshotService';

jest.mock('../../efunDocs', () => ({
    EfunDocsManager: jest.fn()
}));

jest.mock('../../language/documentation/FunctionDocumentationService', () => ({
    createDefaultFunctionDocumentationService: jest.fn()
}));

jest.mock('../../completion/completionInstrumentation', () => ({
    CompletionInstrumentation: jest.fn()
}));

jest.mock('../../frontend/LpcFrontendService', () => ({
    LpcFrontendService: jest.fn()
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

describe('registerCoreServices', () => {
    let registry: ServiceRegistry;
    let context: vscode.ExtensionContext;
    let efunDocsManager: { id: string };
    let documentationService: { id: string };
    let completionInstrumentation: vscode.Disposable & { id: string };
    let compiler: { id: string };
    let frontendService: { id: string; invalidate: jest.Mock; clear: jest.Mock };
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

        efunDocsManager = { id: 'efunDocsManager' };
        documentationService = { id: 'documentationService' };
        completionInstrumentation = { id: 'completionInstrumentation', dispose: jest.fn() };
        compiler = { id: 'compiler' };
        frontendService = { id: 'frontendService', invalidate: jest.fn(), clear: jest.fn() };
        projectConfigService = { id: 'projectConfigService' };
        lifecycle = { id: 'lifecycle', dispose: jest.fn(), onInvalidate: jest.fn() };
        parsedDocumentService = { invalidate: jest.fn() };
        analysisService = { clearCache: jest.fn() };

        (EfunDocsManager as unknown as jest.Mock).mockReset().mockImplementation(() => efunDocsManager);
        (createDefaultFunctionDocumentationService as unknown as jest.Mock).mockReset().mockImplementation(() => documentationService);
        (CompletionInstrumentation as unknown as jest.Mock).mockReset().mockImplementation(() => completionInstrumentation);
        (LPCCompiler as unknown as jest.Mock).mockReset().mockImplementation(() => compiler);
        (LpcFrontendService as unknown as jest.Mock).mockReset().mockImplementation(() => frontendService);
        (LpcProjectConfigService as unknown as jest.Mock).mockReset().mockImplementation(() => projectConfigService);
        (DocumentLifecycleService as unknown as jest.Mock).mockReset().mockImplementation(() => lifecycle);
        (getGlobalParsedDocumentService as jest.Mock).mockReset().mockReturnValue(parsedDocumentService);
        ((DocumentSemanticSnapshotService as any).getInstance as jest.Mock).mockReset().mockReturnValue(analysisService);
    });

    test('registers core services, tracks disposables, and wires lifecycle invalidation', () => {
        registerCoreServices(registry, context);

        expect(createDefaultFunctionDocumentationService).toHaveBeenCalledTimes(1);
        expect(EfunDocsManager).toHaveBeenCalledTimes(1);
        expect(EfunDocsManager).toHaveBeenCalledWith(
            context,
            projectConfigService,
            analysisService,
            documentationService,
            expect.anything(),
            expect.anything()
        );
        expect(CompletionInstrumentation).toHaveBeenCalledTimes(1);
        expect(LPCCompiler).toHaveBeenCalledTimes(1);
        expect(LPCCompiler).toHaveBeenCalledWith(projectConfigService);
        expect(LpcFrontendService).toHaveBeenCalledTimes(1);
        expect(LpcProjectConfigService).toHaveBeenCalledTimes(1);
        expect(DocumentLifecycleService).toHaveBeenCalledTimes(1);

        expect(registry.get(Services.EfunDocs)).toBe(efunDocsManager);
        expect(registry.get(Services.Compiler)).toBe(compiler);
        expect(registry.get(Services.Frontend)).toBe(frontendService);
        expect(registry.get(Services.ProjectConfig)).toBe(projectConfigService);
        expect(registry.get(Services.FunctionDocumentation)).toBe(documentationService);
        expect(registry.get(Services.TextDocumentHost)).toEqual(expect.objectContaining({
            openTextDocument: expect.any(Function)
        }));
        expect(registry.get(Services.DocumentPathSupport)).toBeDefined();
        expect(registry.get(Services.CompletionInstrumentation)).toBe(completionInstrumentation);
        expect(registry.get(Services.Lifecycle)).toBe(lifecycle);
        expect(registry.get(Services.Analysis)).toBe(analysisService);
        expect(DocumentSemanticSnapshotService.getInstance).toHaveBeenCalledTimes(1);

        expect(context.subscriptions).toEqual([completionInstrumentation, lifecycle]);
        expect(typeof context.subscriptions[0].dispose).toBe('function');
        expect(typeof context.subscriptions[1].dispose).toBe('function');

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
