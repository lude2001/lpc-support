import * as vscode from 'vscode';
import { ServiceRegistry } from '../core/ServiceRegistry';
import { Services } from '../core/ServiceKeys';
import { DocumentLifecycleService } from '../core/DocumentLifecycleService';
import { CompletionInstrumentation } from '../completion/completionInstrumentation';
import { LPCConfigManager } from '../config';
import { LPCCompiler } from '../compiler';
import { EfunDocsManager } from '../efunDocs';
import { FunctionDocumentationService } from '../language/documentation/FunctionDocumentationService';
import { createVsCodeTextDocumentHost, WorkspaceDocumentPathSupport } from '../language/shared/WorkspaceDocumentPathSupport';
import { MacroManager } from '../macroManager';
import { getGlobalParsedDocumentService } from '../parser/ParsedDocumentService';
import { LpcProjectConfigService } from '../projectConfig/LpcProjectConfigService';
import { DocumentSemanticSnapshotService } from '../semantic/documentSemanticSnapshotService';

let registeredProjectConfigService: LpcProjectConfigService | undefined;

export function registerCoreServices(registry: ServiceRegistry, context: vscode.ExtensionContext): void {
    const analysisService = DocumentSemanticSnapshotService.getInstance();
    registry.register(Services.Analysis, analysisService);
    const projectConfigService = new LpcProjectConfigService();
    registeredProjectConfigService = projectConfigService;
    registry.register(Services.ProjectConfig, projectConfigService);

    const documentationService = new FunctionDocumentationService();
    registry.register(Services.FunctionDocumentation, documentationService);

    const textDocumentHost = createVsCodeTextDocumentHost();
    registry.register(Services.TextDocumentHost, textDocumentHost);

    const macroManager = new MacroManager(projectConfigService, textDocumentHost);
    registry.register(Services.MacroManager, macroManager);
    context.subscriptions.push(macroManager);

    const documentPathSupport = new WorkspaceDocumentPathSupport({
        host: textDocumentHost,
        macroManager,
        projectConfigService
    });
    registry.register(Services.DocumentPathSupport, documentPathSupport);

    const efunDocsManager = new EfunDocsManager(
        context,
        projectConfigService,
        analysisService,
        macroManager,
        documentationService,
        documentPathSupport
    );
    registry.register(Services.EfunDocs, efunDocsManager);

    const completionInstrumentation = new CompletionInstrumentation();
    registry.register(Services.CompletionInstrumentation, completionInstrumentation);
    context.subscriptions.push(completionInstrumentation);

    const configManager = new LPCConfigManager(context);
    registry.register(Services.ConfigManager, configManager);

    const compiler = new LPCCompiler(configManager);
    registry.register(Services.Compiler, compiler);

    const lifecycle = new DocumentLifecycleService();
    registry.register(Services.Lifecycle, lifecycle);
    context.subscriptions.push(lifecycle);
    lifecycle.onInvalidate(uri => {
        getGlobalParsedDocumentService().invalidate(uri);
        analysisService.clearCache(uri.toString());
    });
}

export function getRegisteredProjectConfigService(): LpcProjectConfigService | undefined {
    return registeredProjectConfigService;
}
