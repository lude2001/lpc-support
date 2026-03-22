import * as vscode from 'vscode';
import { ServiceRegistry } from '../core/ServiceRegistry';
import { Services } from '../core/ServiceKeys';
import { DocumentLifecycleService } from '../core/DocumentLifecycleService';
import { CompletionInstrumentation } from '../completion/completionInstrumentation';
import { LPCConfigManager } from '../config';
import { LPCCompiler } from '../compiler';
import { EfunDocsManager } from '../efunDocs';
import { MacroManager } from '../macroManager';
import { ASTManager } from '../ast/astManager';
import { getGlobalParsedDocumentService } from '../parser/ParsedDocumentService';
import { LpcProjectConfigService } from '../projectConfig/LpcProjectConfigService';

export function registerCoreServices(registry: ServiceRegistry, context: vscode.ExtensionContext): void {
    const projectConfigService = new LpcProjectConfigService();
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
        ASTManager.getInstance().clearCache(uri.toString());
    });
}
