import * as vscode from 'vscode';
import { ServiceRegistry } from '../core/ServiceRegistry';
import { Services } from '../core/ServiceKeys';
import { DocumentLifecycleService } from '../core/DocumentLifecycleService';
import { CompletionInstrumentation } from '../completion/completionInstrumentation';
import { LPCConfigManager } from '../config';
import { LPCCompiler } from '../compiler';
import { configureDiagnosticsAnalysisService } from '../diagnostics/createDiagnosticsStack';
import { EfunDocsManager } from '../efunDocs';
import { MacroManager } from '../macroManager';
import { getGlobalParsedDocumentService } from '../parser/ParsedDocumentService';
import { LpcProjectConfigService } from '../projectConfig/LpcProjectConfigService';
import { DocumentSemanticSnapshotService } from '../semantic/documentSemanticSnapshotService';
import { configureSimulatedEfunScannerAnalysisService } from '../efun/SimulatedEfunScanner';
import { configureSymbolReferenceAnalysisService } from '../symbolReferenceResolver';
import { configureTargetMethodLookupAnalysisService } from '../targetMethodLookup';
import { configureEfunHoverAnalysisService } from '../language/services/navigation/EfunLanguageHoverService';
import { configureScopedMethodIdentifierAnalysisService } from '../language/services/navigation/ScopedMethodIdentifierSupport';

let registeredProjectConfigService: LpcProjectConfigService | undefined;

export function registerCoreServices(registry: ServiceRegistry, context: vscode.ExtensionContext): void {
    const analysisService = DocumentSemanticSnapshotService.getInstance();
    configureDiagnosticsAnalysisService(analysisService);
    configureSymbolReferenceAnalysisService(analysisService);
    configureTargetMethodLookupAnalysisService(analysisService);
    configureSimulatedEfunScannerAnalysisService(analysisService);
    configureEfunHoverAnalysisService(analysisService);
    configureScopedMethodIdentifierAnalysisService(analysisService);
    const projectConfigService = new LpcProjectConfigService();
    registeredProjectConfigService = projectConfigService;
    registry.register(Services.ProjectConfig, projectConfigService);

    const macroManager = new MacroManager(projectConfigService);
    registry.register(Services.MacroManager, macroManager);
    context.subscriptions.push(macroManager);

    const efunDocsManager = new EfunDocsManager(context, projectConfigService);
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
