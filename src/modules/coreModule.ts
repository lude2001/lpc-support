import * as vscode from 'vscode';
import { ServiceRegistry } from '../core/ServiceRegistry';
import { Services } from '../core/ServiceKeys';
import { DocumentLifecycleService } from '../core/DocumentLifecycleService';
import { CompletionInstrumentation } from '../completion/completionInstrumentation';
import { LPCConfigManager } from '../config';
import { LPCCompiler } from '../compiler';
import { EfunDocsManager } from '../efunDocs';
import { FunctionDocLookupBuilder } from '../efun/FunctionDocLookupBuilder';
import { LpcFrontendService } from '../frontend/LpcFrontendService';
import { createDefaultFunctionDocumentationService } from '../language/documentation/FunctionDocumentationService';
import { createVsCodeTextDocumentHost, WorkspaceDocumentPathSupport } from '../language/shared/WorkspaceDocumentPathSupport';
import { MacroManager } from '../macroManager';
import { getGlobalParsedDocumentService } from '../parser/ParsedDocumentService';
import { LpcProjectConfigService } from '../projectConfig/LpcProjectConfigService';
import { DocumentSemanticSnapshotService } from '../semantic/documentSemanticSnapshotService';
import { createDefaultSemanticEvaluationService } from '../semanticEvaluation/SemanticEvaluationService';

let registeredProjectConfigService: LpcProjectConfigService | undefined;

export function registerCoreServices(registry: ServiceRegistry, context: vscode.ExtensionContext): void {
    const analysisService = DocumentSemanticSnapshotService.getInstance();
    registry.register(Services.Analysis, analysisService);
    const projectConfigService = new LpcProjectConfigService();
    registeredProjectConfigService = projectConfigService;
    registry.register(Services.ProjectConfig, projectConfigService);

    const frontendService = new LpcFrontendService();
    registry.register(Services.Frontend, frontendService);

    const documentationService = createDefaultFunctionDocumentationService();
    registry.register(Services.FunctionDocumentation, documentationService);

    const textDocumentHost = createVsCodeTextDocumentHost();
    registry.register(Services.TextDocumentHost, textDocumentHost);

    const macroManager = new MacroManager(projectConfigService, textDocumentHost);
    registry.register(Services.MacroManager, macroManager);
    context.subscriptions.push(macroManager);

    const documentPathSupport = new WorkspaceDocumentPathSupport({
        host: textDocumentHost,
        macroManager,
        analysisService,
        projectConfigService
    });
    registry.register(Services.DocumentPathSupport, documentPathSupport);
    const semanticEvaluationService = createDefaultSemanticEvaluationService({
        analysisService,
        pathSupport: documentPathSupport,
        projectConfigService
    });
    registry.register(Services.SemanticEvaluation, semanticEvaluationService);
    const functionDocLookupBuilder = new FunctionDocLookupBuilder({
        documentationService,
        analysisService,
        pathSupport: documentPathSupport
    });

    const efunDocsManager = new EfunDocsManager(
        context,
        projectConfigService,
        analysisService,
        documentationService,
        documentPathSupport,
        functionDocLookupBuilder
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
        frontendService.invalidate(uri);
        getGlobalParsedDocumentService().invalidate(uri);
        analysisService.clearCache(uri.toString());
    });
}

export function getRegisteredProjectConfigService(): LpcProjectConfigService | undefined {
    return registeredProjectConfigService;
}
