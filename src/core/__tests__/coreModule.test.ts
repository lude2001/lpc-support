import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import { LPCCompiler } from '../../compiler';
import { BundledEfunDocsProvider } from '../../efun/BundledEfunDocsProvider';
import { createVsCodeWorkspaceDocumentHost } from '../../language/shared/WorkspaceDocumentPathSupport';
import { registerCoreServices } from '../../modules/coreModule';
import { LpcProjectConfigService } from '../../projectConfig/LpcProjectConfigService';
import { LpcProjectConfigSnapshotService } from '../../projectConfig/LpcProjectConfigSnapshotService';
import { ProjectConfigOnboardingService } from '../../projectConfig/ProjectConfigOnboardingService';
import { Services } from '../ServiceKeys';
import { ServiceRegistry } from '../ServiceRegistry';

jest.mock('../../compiler', () => ({
    LPCCompiler: jest.fn()
}));

jest.mock('../../efun/BundledEfunDocsProvider', () => ({
    BundledEfunDocsProvider: jest.fn()
}));

jest.mock('../../language/shared/WorkspaceDocumentPathSupport', () => ({
    createVsCodeWorkspaceDocumentHost: jest.fn()
}));

jest.mock('../../projectConfig/LpcProjectConfigService', () => ({
    LpcProjectConfigService: jest.fn()
}));

jest.mock('../../projectConfig/LpcProjectConfigSnapshotService', () => ({
    LpcProjectConfigSnapshotService: jest.fn()
}));

jest.mock('../../projectConfig/ProjectConfigOnboardingService', () => ({
    ProjectConfigOnboardingService: jest.fn()
}));

describe('registerCoreServices', () => {
    let registry: ServiceRegistry;
    let context: vscode.ExtensionContext;
    let compiler: { id: string };
    let efunDocsProvider: { id: string };
    let projectConfigService: { id: string };
    let projectConfigSnapshotService: vscode.Disposable & { id: string; start: jest.Mock };
    let projectConfigOnboardingService: vscode.Disposable & { id: string; start: jest.Mock };
    let textDocumentHost: { openTextDocument: jest.Mock };

    beforeEach(() => {
        registry = new ServiceRegistry();
        context = {
            subscriptions: [],
            extensionPath: '/mock/extension',
            workspaceState: {
                get: jest.fn().mockReturnValue(undefined),
                update: jest.fn().mockResolvedValue(undefined)
            }
        } as unknown as vscode.ExtensionContext;

        compiler = { id: 'compiler' };
        efunDocsProvider = { id: 'bundledEfunDocs' };
        projectConfigService = { id: 'projectConfigService' };
        projectConfigSnapshotService = {
            id: 'projectConfigSnapshotService',
            start: jest.fn().mockResolvedValue(undefined),
            dispose: jest.fn()
        };
        projectConfigOnboardingService = {
            id: 'projectConfigOnboardingService',
            start: jest.fn(),
            dispose: jest.fn()
        };
        textDocumentHost = { openTextDocument: jest.fn() };

        (LPCCompiler as unknown as jest.Mock).mockReset().mockImplementation(() => compiler);
        (BundledEfunDocsProvider as unknown as jest.Mock).mockReset().mockImplementation(() => efunDocsProvider);
        (createVsCodeWorkspaceDocumentHost as jest.Mock).mockReset().mockReturnValue(textDocumentHost);
        (LpcProjectConfigService as unknown as jest.Mock).mockReset().mockImplementation(() => projectConfigService);
        (LpcProjectConfigSnapshotService as unknown as jest.Mock)
            .mockReset()
            .mockImplementation(() => projectConfigSnapshotService);
        (ProjectConfigOnboardingService as unknown as jest.Mock)
            .mockReset()
            .mockImplementation(() => projectConfigOnboardingService);
    });

    test('registers only lightweight host services and leaves source analysis to the Rust LSP', async () => {
        await registerCoreServices(registry, context);

        expect(LpcProjectConfigService).toHaveBeenCalledTimes(1);
        expect(LpcProjectConfigSnapshotService).toHaveBeenCalledWith(projectConfigService);
        expect(projectConfigSnapshotService.start).toHaveBeenCalledTimes(1);
        expect(ProjectConfigOnboardingService).toHaveBeenCalledWith({
            projectConfigService,
            snapshotService: projectConfigSnapshotService,
            memento: context.workspaceState
        });
        expect(projectConfigOnboardingService.start).toHaveBeenCalledTimes(1);
        expect(createVsCodeWorkspaceDocumentHost).toHaveBeenCalledTimes(1);
        expect(BundledEfunDocsProvider).toHaveBeenCalledWith(context);
        expect(LPCCompiler).toHaveBeenCalledWith(projectConfigService);

        expect(registry.get(Services.ProjectConfig)).toBe(projectConfigService);
        expect(registry.get(Services.ProjectConfigSnapshot)).toBe(projectConfigSnapshotService);
        expect(registry.get(Services.ProjectConfigOnboarding)).toBe(projectConfigOnboardingService);
        expect(registry.get(Services.TextDocumentHost)).toBe(textDocumentHost);
        expect(registry.get(Services.EfunDocs)).toBe(efunDocsProvider);
        expect(registry.get(Services.Compiler)).toBe(compiler);

        for (const legacyAnalysisService of [
            Services.Frontend,
            Services.Analysis,
            Services.FunctionDocumentation,
            Services.DocumentPathSupport,
            Services.SemanticEvaluation,
            Services.Lifecycle,
            Services.CompletionInstrumentation
        ]) {
            expect(() => registry.get(legacyAnalysisService as never)).toThrow('is not registered');
        }

        expect(context.subscriptions).toEqual([
            projectConfigSnapshotService,
            projectConfigOnboardingService
        ]);
    });
});
