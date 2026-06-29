import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import type { ExtensionContext } from 'vscode';
import { CompletionInstrumentation } from '../../../completion/completionInstrumentation';
import { InheritanceResolver } from '../../../completion/inheritanceResolver';
import { ProjectSymbolIndex } from '../../../completion/projectSymbolIndex';
import { createDiagnosticsStack } from '../../../diagnostics';
import { EfunDocsManager } from '../../../efunDocs';
import { FunctionDocLookupBuilder } from '../../../efun/FunctionDocLookupBuilder';
import { clearGlobalLpcFrontendService } from '../../../frontend/LpcFrontendService';
import { CallableDocRenderer } from '../../../language/documentation/CallableDocRenderer';
import { createDefaultFunctionDocumentationService } from '../../../language/documentation/FunctionDocumentationService';
import { CompletionContextAnalyzer } from '../../../completion/completionContextAnalyzer';
import type { LanguageFeatureServices } from '../../../language/contracts/LanguageFeatureServices';
import { DefaultDiagnosticSymbolResolver } from '../../../diagnostics/semantic/DiagnosticSymbolResolver';
import { HeaderOwnerContextService } from '../../../language/shared/HeaderOwnerContextService';
import {
    WorkspaceDocumentPathSupport,
    createVsCodeWorkspaceDocumentHost
} from '../../../language/shared/WorkspaceDocumentPathSupport';
import { createLanguageCodeActionService } from '../../../language/services/codeActions/LanguageCodeActionService';
import { createDefaultQueryBackedLanguageCompletionService } from '../../../language/services/completion/LanguageCompletionService';
import { createDefaultScopedMethodCompletionSupport } from '../../../language/services/completion/ScopedMethodCompletionSupport';
import { createLanguageFormattingService } from '../../../language/services/formatting/LanguageFormattingService';
import { AstBackedLanguageDefinitionService } from '../../../language/services/navigation/LanguageDefinitionService';
import { EfunLanguageHoverService } from '../../../language/services/navigation/EfunLanguageHoverService';
import {
    createDefaultObjectInferenceLanguageHoverService,
    LanguageNavigationService,
    VsCodeHoverDocumentAdapter,
    VsCodeHoverMethodResolver,
    VsCodeHoverObjectAccessProvider
} from '../../../language/services/navigation/LanguageHoverService';
import { InheritedFileGlobalRelationService } from '../../../language/services/navigation/InheritedFileGlobalRelationService';
import { InheritedFunctionRelationService } from '../../../language/services/navigation/InheritedFunctionRelationService';
import { InheritedSymbolRelationService } from '../../../language/services/navigation/InheritedSymbolRelationService';
import { UnifiedLanguageHoverService } from '../../../language/services/navigation/UnifiedLanguageHoverService';
import { createDefaultAstBackedLanguageReferenceService } from '../../../language/services/navigation/LanguageReferenceService';
import { createDefaultAstBackedLanguageRenameService } from '../../../language/services/navigation/LanguageRenameService';
import { DefaultCallableDocResolver } from '../../../language/services/signatureHelp/DefaultCallableDocResolver';
import { DefaultCallableTargetDiscoveryService } from '../../../language/services/signatureHelp/DefaultCallableTargetDiscoveryService';
import { LanguageSignatureHelpService } from '../../../language/services/signatureHelp/LanguageSignatureHelpService';
import { createSyntaxAwareCallSiteAnalyzer } from '../../../language/services/signatureHelp/SyntaxAwareCallSiteAnalyzer';
import { createDefaultAstBackedLanguageSymbolService } from '../../../language/services/navigation/LanguageSymbolService';
import { FormattingService } from '../../../formatter/FormattingService';
import {
    DefaultLanguageFoldingService,
    LanguageStructureService
} from '../../../language/services/structure/LanguageFoldingService';
import { DefaultLanguageSemanticTokensService } from '../../../language/services/structure/LanguageSemanticTokensService';
import { createDefaultObjectInferenceService } from '../../../objectInference/ObjectInferenceService';
import { createDefaultScopedMethodDiscoveryService } from '../../../objectInference/ScopedMethodDiscoveryService';
import { ScopedMethodResolver } from '../../../objectInference/ScopedMethodResolver';
import { DocumentSemanticSnapshotService } from '../../../semantic/documentSemanticSnapshotService';
import {
    clearGlobalParsedDocumentService,
    getGlobalParsedDocumentService
} from '../../../parser/ParsedDocumentService';
import { createDefaultSemanticEvaluationService } from '../../../semanticEvaluation/SemanticEvaluationService';
import { TargetMethodLookup } from '../../../targetMethodLookup';
import { setServerWorkspaceRoots } from './serverHostState';
import type { WorkspaceChangeIndex } from './WorkspaceChangeIndex';
import { WorkspaceIndexingService } from './WorkspaceIndexingService';

export interface ProductionLanguageServicesOptions {
    changeIndex?: Pick<
        WorkspaceChangeIndex,
        'addDependencyFootprint' | 'recordDependencyFootprint' | 'get' | 'getWorkspaceConfigGeneration' | 'markClean'
    >;
}

export function createProductionLanguageServices(
    options: ProductionLanguageServicesOptions = {}
): LanguageFeatureServices {
    setServerWorkspaceRoots([process.cwd()]);

    const analysisService = DocumentSemanticSnapshotService.getInstance();

    const baseWorkspaceDocumentHost = createVsCodeWorkspaceDocumentHost();
    const documentationService = createDefaultFunctionDocumentationService();
    const completionInstrumentation = new CompletionInstrumentation();
    let ensureFreshDocument: ((uri: vscode.Uri) => void) | undefined;
    const workspaceDocumentHost = createFreshnessAwareWorkspaceDocumentHost(
        baseWorkspaceDocumentHost,
        (uri) => ensureFreshDocument?.(uri)
    );
    const documentPathSupport = new WorkspaceDocumentPathSupport({
        host: baseWorkspaceDocumentHost,
        analysisService,
        ensureFreshDocument: (uri) => ensureFreshDocument?.(uri)
    });
    const functionDocLookupBuilder = new FunctionDocLookupBuilder({
        documentationService,
        analysisService,
        pathSupport: documentPathSupport
    });
    const semanticEvaluationService = createDefaultSemanticEvaluationService({
        analysisService,
        pathSupport: documentPathSupport
    });
    const objectInferenceService = createDefaultObjectInferenceService({
        analysisService,
        dependencyFootprintRecorder: options.changeIndex,
        documentationService,
        host: workspaceDocumentHost,
        pathSupport: documentPathSupport,
        semanticEvaluationService
    });
    const inheritanceResolver = new InheritanceResolver();
    const scopedMethodResolver = new ScopedMethodResolver({
        analysisService,
        inheritanceResolver,
        host: workspaceDocumentHost
    });
    const projectSymbolIndex = new ProjectSymbolIndex(inheritanceResolver);
    const targetMethodLookup = new TargetMethodLookup(analysisService, documentPathSupport, options.changeIndex);
    const efunDocsManager = new EfunDocsManager(
        createServerExtensionContext(),
        undefined,
        analysisService,
        documentationService,
        documentPathSupport,
        functionDocLookupBuilder
    );
    const inheritedFunctionRelationService = new InheritedFunctionRelationService({
        analysisService,
        inheritanceResolver,
        scopedMethodResolver,
        host: workspaceDocumentHost
    });
    const inheritedFileGlobalRelationService = new InheritedFileGlobalRelationService({
        analysisService,
        inheritanceResolver,
        host: workspaceDocumentHost
    });
    const inheritedRelationService = new InheritedSymbolRelationService({
        analysisService,
        functionRelationService: inheritedFunctionRelationService,
        fileGlobalRelationService: inheritedFileGlobalRelationService
    });
    const scopedMethodDiscoveryService = createDefaultScopedMethodDiscoveryService({
        analysisService,
        inheritanceResolver,
        host: workspaceDocumentHost
    });
    const callableDocRenderer = new CallableDocRenderer();
    const scopedCompletionSupport = createDefaultScopedMethodCompletionSupport({
        documentationService,
        documentHost: workspaceDocumentHost,
        renderer: callableDocRenderer
    });

    const completionService = createDefaultQueryBackedLanguageCompletionService({
        efunDocsManager,
        analysisService,
        documentationService,
        objectInferenceService,
        instrumentation: completionInstrumentation,
        inheritanceReporter: vscode.window.createOutputChannel('LPC Inheritance'),
        projectSymbolIndex,
        contextAnalyzer: new CompletionContextAnalyzer(),
        scopedMethodDiscoveryService,
        scopedCompletionSupport
    });
    const codeActionsService = createLanguageCodeActionService(analysisService);
    const headerOwnerContextService = new HeaderOwnerContextService(
        documentPathSupport,
        analysisService,
        projectSymbolIndex
    );
    const diagnosticSymbolResolver = new DefaultDiagnosticSymbolResolver({
        analysisService,
        pathSupport: documentPathSupport,
        projectSymbolIndex,
        efunDocsManager,
        headerOwnerContextResolver: headerOwnerContextService,
        dependencyFootprintRecorder: options.changeIndex
    });
    const { diagnosticsService } = createDiagnosticsStack(analysisService, { symbolResolver: diagnosticSymbolResolver });
    const formattingService = createLanguageFormattingService(new FormattingService());
    const objectHoverService = createDefaultObjectInferenceLanguageHoverService(
        objectInferenceService,
        targetMethodLookup,
        {
            documentAdapter: new VsCodeHoverDocumentAdapter(),
            analysisService,
            objectAccessProvider: new VsCodeHoverObjectAccessProvider(objectInferenceService),
            methodResolver: new VsCodeHoverMethodResolver(targetMethodLookup),
            scopedMethodResolver,
            documentationService,
            renderer: callableDocRenderer
        }
    );
    const hoverService = new UnifiedLanguageHoverService(
        objectHoverService,
        {
            analysisService,
            efunHoverService: new EfunLanguageHoverService(efunDocsManager, analysisService, callableDocRenderer),
            headerOwnerContextService
        }
    );
    const definitionService = new AstBackedLanguageDefinitionService(
        efunDocsManager,
        objectInferenceService,
        targetMethodLookup,
        undefined,
        {
            analysisService,
            scopedMethodResolver,
            host: workspaceDocumentHost,
            pathSupport: documentPathSupport,
            headerOwnerContextService
        }
    );
    const referenceService = createDefaultAstBackedLanguageReferenceService({
        analysisService,
        inheritedRelationService
    });
    const renameService = createDefaultAstBackedLanguageRenameService({
        analysisService,
        inheritedRelationService
    });
    const symbolService = createDefaultAstBackedLanguageSymbolService({
        analysisService
    });
    const callableTargetDiscoveryService = new DefaultCallableTargetDiscoveryService(
        efunDocsManager,
        objectInferenceService,
        targetMethodLookup,
        scopedMethodResolver,
        analysisService
    );
    const callableDocResolver = new DefaultCallableDocResolver(
        documentationService,
        efunDocsManager,
        workspaceDocumentHost
    );
    const signatureHelpService = new LanguageSignatureHelpService({
        discoveryService: callableTargetDiscoveryService,
        docResolver: callableDocResolver,
        renderer: callableDocRenderer,
        callSiteAnalyzer: createSyntaxAwareCallSiteAnalyzer(analysisService)
    });
    const foldingService = new DefaultLanguageFoldingService(analysisService);
    const semanticTokensService = new DefaultLanguageSemanticTokensService(analysisService);
    const workspaceIndexingService = new WorkspaceIndexingService({
        analysisService,
        pathSupport: documentPathSupport,
        projectSymbolIndex
    });

    const navigationService: LanguageNavigationService = {
        provideHover: (request) => hoverService.provideHover(request),
        provideDefinition: (request) => definitionService.provideDefinition(request),
        provideReferences: (request) => referenceService.provideReferences(request),
        prepareRename: (request) => renameService.prepareRename(request),
        provideRenameEdits: (request) => renameService.provideRenameEdits(request),
        provideDocumentSymbols: (request) => symbolService.provideDocumentSymbols(request)
    };
    const structureService: LanguageStructureService = {
        provideFoldingRanges: (request) => foldingService.provideFoldingRanges(request),
        provideSemanticTokens: (request) => semanticTokensService.provideSemanticTokens(request)
    };
    const invalidateProductionDocument = (uri: string): void => {
        headerOwnerContextService.clear();
        const parsedUri = vscode.Uri.parse(uri);
        getGlobalParsedDocumentService().invalidate(parsedUri);
        analysisService.clearCache(uri);
        projectSymbolIndex.removeFile(uri);
    };
    ensureFreshDocument = (uri) => {
        const uriString = uri.toString();
        const state = options.changeIndex?.get(uriString);
        if (!state) {
            return;
        }

        if (
            state.dirty
            || state.maybeStale
            || state.workspaceConfigGeneration !== options.changeIndex?.getWorkspaceConfigGeneration()
        ) {
            invalidateProductionDocument(uriString);
            options.changeIndex?.markClean(uriString, state.lastChangedAt);
        }
    };

    return {
        completionService,
        codeActionsService,
        diagnosticsService,
        formattingService,
        navigationService,
        onWorkspaceConfigSync: async () => {
            headerOwnerContextService.clear();
            clearGlobalLpcFrontendService();
            clearGlobalParsedDocumentService();
            analysisService.clearAllCache();
            projectSymbolIndex.clear();
            efunDocsManager.invalidateWorkspaceState();
        },
        onDocumentInvalidated: (uri) => {
            invalidateProductionDocument(uri);
        },
        signatureHelpService,
        structureService,
        workspaceIndexingService,
        healthPerformanceProviders: {
            getParserStats: () => {
                const stats = getGlobalParsedDocumentService().getStats();
                return {
                    parseCount: stats.parseCount,
                    totalParseTime: stats.totalParseTime,
                    avgParseTime: stats.avgParseTime,
                    parseFiles: stats.parseFiles
                };
            },
            getSemanticStats: () => {
                const stats = analysisService.getStats();
                return {
                    totalSnapshots: stats.totalSnapshots,
                    buildCount: stats.buildCount,
                    totalBuildTimeMs: stats.totalBuildTimeMs,
                    buildFiles: stats.buildFiles
                };
            }
        }
    };
}

function createServerExtensionContext(): ExtensionContext {
    return {
        subscriptions: [],
        extensionPath: resolveServerExtensionPath()
    } as unknown as ExtensionContext;
}

function createFreshnessAwareWorkspaceDocumentHost(
    host: ReturnType<typeof createVsCodeWorkspaceDocumentHost>,
    ensureFreshDocument: (uri: vscode.Uri) => void | Promise<void>
): ReturnType<typeof createVsCodeWorkspaceDocumentHost> {
    return {
        ...host,
        openTextDocument: async (target) => {
            try {
                await ensureFreshDocument(toDocumentUri(target));
            } catch {
                // Freshness invalidation is best-effort; opening the document still gives callers the latest host view.
            }
            return host.openTextDocument(target);
        }
    };
}

function toDocumentUri(target: string | vscode.Uri): vscode.Uri {
    if (typeof target !== 'string') {
        return target;
    }

    return /^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(target)
        ? vscode.Uri.parse(target)
        : vscode.Uri.file(target);
}

export function resolveServerExtensionPath(startDir: string = __dirname): string {
    let currentDir = path.resolve(startDir);

    while (true) {
        const packageJsonPath = path.join(currentDir, 'package.json');
        if (fs.existsSync(packageJsonPath) && hasBundledEfunDocs(currentDir)) {
            return currentDir;
        }

        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) {
            return path.resolve(startDir, '..', '..', '..', '..');
        }

        currentDir = parentDir;
    }
}

function hasBundledEfunDocs(extensionRoot: string): boolean {
    const splitDocsDir = path.join(extensionRoot, 'config', 'efun-docs', 'docs');
    const splitCategoriesPath = path.join(extensionRoot, 'config', 'efun-docs', 'categories.json');
    if (fs.existsSync(splitCategoriesPath) && fs.existsSync(splitDocsDir)) {
        return true;
    }

    return fs.existsSync(path.join(extensionRoot, 'config', 'efun-docs.json'));
}
