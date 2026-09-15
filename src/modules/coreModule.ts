import * as vscode from 'vscode';
import { ServiceRegistry } from '../core/ServiceRegistry';
import { Services } from '../core/ServiceKeys';
import { LPCCompiler } from '../compiler';
import { BundledEfunDocsProvider } from '../efun/BundledEfunDocsProvider';
import { createVsCodeWorkspaceDocumentHost } from '../language/shared/WorkspaceDocumentPathSupport';
import { LpcProjectConfigService } from '../projectConfig/LpcProjectConfigService';
import { LpcProjectConfigSnapshotService } from '../projectConfig/LpcProjectConfigSnapshotService';
import { ProjectConfigOnboardingService } from '../projectConfig/ProjectConfigOnboardingService';

let registeredProjectConfigService: LpcProjectConfigService | undefined;

export async function registerCoreServices(registry: ServiceRegistry, context: vscode.ExtensionContext): Promise<void> {
    const projectConfigService = new LpcProjectConfigService();
    registeredProjectConfigService = projectConfigService;
    registry.register(Services.ProjectConfig, projectConfigService);
    const projectConfigSnapshotService = new LpcProjectConfigSnapshotService(projectConfigService);
    await projectConfigSnapshotService.start();
    registry.register(Services.ProjectConfigSnapshot, projectConfigSnapshotService);
    context.subscriptions.push(projectConfigSnapshotService);

    const projectConfigOnboardingService = new ProjectConfigOnboardingService({
        projectConfigService,
        snapshotService: projectConfigSnapshotService,
        memento: context.workspaceState
    });
    projectConfigOnboardingService.start();
    registry.register(Services.ProjectConfigOnboarding, projectConfigOnboardingService);
    context.subscriptions.push(projectConfigOnboardingService);

    const textDocumentHost = createVsCodeWorkspaceDocumentHost();
    registry.register(Services.TextDocumentHost, textDocumentHost);

    const efunDocsManager = new BundledEfunDocsProvider(context);
    registry.register(Services.EfunDocs, efunDocsManager);

    const compiler = new LPCCompiler(projectConfigService);
    registry.register(Services.Compiler, compiler);
}

export function getRegisteredProjectConfigService(): LpcProjectConfigService | undefined {
    return registeredProjectConfigService;
}
