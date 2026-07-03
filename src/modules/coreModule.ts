import * as vscode from 'vscode';
import { ServiceRegistry } from '../core/ServiceRegistry';
import { Services } from '../core/ServiceKeys';
import { DocumentLifecycleService } from '../core/DocumentLifecycleService';
import { CompletionInstrumentation } from '../completion/completionInstrumentation';
import { LPCCompiler } from '../compiler';
import { EfunDocsManager } from '../efunDocs';
import { FunctionDocLookupBuilder } from '../efun/FunctionDocLookupBuilder';
import { LpcFrontendService } from '../frontend/LpcFrontendService';
import { createDefaultFunctionDocumentationService } from '../language/documentation/FunctionDocumentationService';
import { createVsCodeWorkspaceDocumentHost, WorkspaceDocumentPathSupport } from '../language/shared/WorkspaceDocumentPathSupport';
import { getGlobalParsedDocumentService } from '../parser/ParsedDocumentService';
import { LpcProjectConfigService } from '../projectConfig/LpcProjectConfigService';
import { LpcProjectConfigSnapshotService } from '../projectConfig/LpcProjectConfigSnapshotService';
import { DocumentSemanticSnapshotService } from '../semantic/documentSemanticSnapshotService';
import { createDefaultSemanticEvaluationService } from '../semanticEvaluation/SemanticEvaluationService';

let registeredProjectConfigService: LpcProjectConfigService | undefined;

export async function registerCoreServices(registry: ServiceRegistry, context: vscode.ExtensionContext): Promise<void> {
    const analysisService = DocumentSemanticSnapshotService.getInstance();
    registry.register(Services.Analysis, analysisService);
    const projectConfigService = new LpcProjectConfigService();
    registeredProjectConfigService = projectConfigService;
    registry.register(Services.ProjectConfig, projectConfigService);
    const projectConfigSnapshotService = new LpcProjectConfigSnapshotService(projectConfigService);
    await projectConfigSnapshotService.start();
    context.subscriptions.push(projectConfigSnapshotService);

    const frontendService = new LpcFrontendService();
    registry.register(Services.Frontend, frontendService);

    const documentationService = createDefaultFunctionDocumentationService();
    registry.register(Services.FunctionDocumentation, documentationService);

    const invalidateDocument = (uri: vscode.Uri): void => {
        frontendService.invalidate(uri);
        getGlobalParsedDocumentService().invalidate(uri);
        analysisService.clearCache(uri.toString());
    };
    const baseTextDocumentHost = createVsCodeWorkspaceDocumentHost();
    const textDocumentHost = {
        ...baseTextDocumentHost,
        openTextDocument: async (target: string | vscode.Uri) => {
            invalidateDocument(toDocumentUri(target));
            return baseTextDocumentHost.openTextDocument(target);
        }
    };
    registry.register(Services.TextDocumentHost, textDocumentHost);

    const documentPathSupport = new WorkspaceDocumentPathSupport({
        host: textDocumentHost,
        analysisService,
        projectConfigService
    });
    registry.register(Services.DocumentPathSupport, documentPathSupport);
    const semanticEvaluationService = createDefaultSemanticEvaluationService({
        analysisService,
        pathSupport: documentPathSupport,
        projectConfigProvider: projectConfigSnapshotService
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
    await efunDocsManager.bundledDocsReady;
    registry.register(Services.EfunDocs, efunDocsManager);

    const completionInstrumentation = new CompletionInstrumentation();
    registry.register(Services.CompletionInstrumentation, completionInstrumentation);
    context.subscriptions.push(completionInstrumentation);

    const compiler = new LPCCompiler(projectConfigService);
    registry.register(Services.Compiler, compiler);

    const lifecycle = new DocumentLifecycleService();
    registry.register(Services.Lifecycle, lifecycle);
    context.subscriptions.push(lifecycle);
    lifecycle.onInvalidate(uri => {
        invalidateDocument(uri);
    });
}

export function getRegisteredProjectConfigService(): LpcProjectConfigService | undefined {
    return registeredProjectConfigService;
}

function toDocumentUri(target: string | vscode.Uri): vscode.Uri {
    if (typeof target !== 'string') {
        return target;
    }

    return /^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(target)
        ? vscode.Uri.parse(target)
        : vscode.Uri.file(target);
}
