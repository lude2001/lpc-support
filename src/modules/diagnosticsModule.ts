import * as vscode from 'vscode';
import { InheritanceResolver } from '../completion/inheritanceResolver';
import { ProjectSymbolIndex } from '../completion/projectSymbolIndex';
import { ServiceRegistry } from '../core/ServiceRegistry';
import { Services } from '../core/ServiceKeys';
import { DiagnosticsOrchestrator, createDiagnosticsStack } from '../diagnostics';
import { DefaultDiagnosticSymbolResolver } from '../diagnostics/semantic/DiagnosticSymbolResolver';
import { HeaderOwnerContextService } from '../language/shared/HeaderOwnerContextService';

export function registerDiagnostics(registry: ServiceRegistry, context: vscode.ExtensionContext): void {
    const analysisService = registry.get(Services.Analysis);
    const textDocumentHost = registry.get(Services.TextDocumentHost);
    const documentPathSupport = registry.get(Services.DocumentPathSupport);
    const efunDocsManager = registry.get(Services.EfunDocs);
    const headerOwnerContextService = new HeaderOwnerContextService(documentPathSupport, analysisService);
    const symbolResolver = new DefaultDiagnosticSymbolResolver({
        analysisService,
        pathSupport: documentPathSupport,
        projectSymbolIndex: new ProjectSymbolIndex(new InheritanceResolver()),
        efunDocsManager,
        headerOwnerContextResolver: headerOwnerContextService
    });
    const { diagnosticsService } = createDiagnosticsStack(analysisService, { symbolResolver });
    const diagnostics = new DiagnosticsOrchestrator(context, {
        diagnosticsService,
        textDocumentHost,
        analysisService
    });
    registry.register(Services.Diagnostics, diagnostics);
    registry.track(headerOwnerContextService);
    registry.track(diagnostics);
}
