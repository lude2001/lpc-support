import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import type { ExtensionContext } from 'vscode';
import { CompletionInstrumentation } from '../../../completion/completionInstrumentation';
import { InheritanceResolver } from '../../../completion/inheritanceResolver';
import { createDiagnosticsStack } from '../../../diagnostics';
import { EfunDocsManager } from '../../../efunDocs';
import { FunctionDocCompatMaterializer } from '../../../efun/FunctionDocCompatMaterializer';
import { FunctionDocLookupBuilder } from '../../../efun/FunctionDocLookupBuilder';
import { FunctionDocumentationService } from '../../../language/documentation/FunctionDocumentationService';
import type { LanguageFeatureServices } from '../../../language/contracts/LanguageFeatureServices';
import {
    WorkspaceDocumentPathSupport,
    createVsCodeWorkspaceDocumentHost
} from '../../../language/shared/WorkspaceDocumentPathSupport';
import { createLanguageCodeActionService } from '../../../language/services/codeActions/LanguageCodeActionService';
import { createDefaultQueryBackedLanguageCompletionService } from '../../../language/services/completion/LanguageCompletionService';
import { ScopedMethodCompletionSupport } from '../../../language/services/completion/ScopedMethodCompletionSupport';
import { createLanguageFormattingService } from '../../../language/services/formatting/LanguageFormattingService';
import { AstBackedLanguageDefinitionService } from '../../../language/services/navigation/LanguageDefinitionService';
import { EfunLanguageHoverService } from '../../../language/services/navigation/EfunLanguageHoverService';
import {
    createDefaultObjectInferenceLanguageHoverService,
    LanguageNavigationService
} from '../../../language/services/navigation/LanguageHoverService';
import { InheritedFileGlobalRelationService } from '../../../language/services/navigation/InheritedFileGlobalRelationService';
import { InheritedFunctionRelationService } from '../../../language/services/navigation/InheritedFunctionRelationService';
import { InheritedSymbolRelationService } from '../../../language/services/navigation/InheritedSymbolRelationService';
import { UnifiedLanguageHoverService } from '../../../language/services/navigation/UnifiedLanguageHoverService';
import { AstBackedLanguageReferenceService } from '../../../language/services/navigation/LanguageReferenceService';
import { AstBackedLanguageRenameService } from '../../../language/services/navigation/LanguageRenameService';
import { DefaultCallableDocResolver } from '../../../language/services/signatureHelp/DefaultCallableDocResolver';
import { DefaultCallableTargetDiscoveryService } from '../../../language/services/signatureHelp/DefaultCallableTargetDiscoveryService';
import { LanguageSignatureHelpService } from '../../../language/services/signatureHelp/LanguageSignatureHelpService';
import { createSyntaxAwareCallSiteAnalyzer } from '../../../language/services/signatureHelp/SyntaxAwareCallSiteAnalyzer';
import { AstBackedLanguageSymbolService } from '../../../language/services/navigation/LanguageSymbolService';
import { FormattingService } from '../../../formatter/FormattingService';
import { CallableDocRenderer } from '../../../language/documentation/CallableDocRenderer';
import {
    DefaultLanguageFoldingService,
    LanguageStructureService
} from '../../../language/services/structure/LanguageFoldingService';
import { DefaultLanguageSemanticTokensService } from '../../../language/services/structure/LanguageSemanticTokensService';
import { MacroManager } from '../../../macroManager';
import { ObjectInferenceService } from '../../../objectInference/ObjectInferenceService';
import { ScopedMethodResolver } from '../../../objectInference/ScopedMethodResolver';
import { LpcProjectConfigService } from '../../../projectConfig/LpcProjectConfigService';
import { DocumentSemanticSnapshotService } from '../../../semantic/documentSemanticSnapshotService';
import { TargetMethodLookup } from '../../../targetMethodLookup';
import { setServerWorkspaceRoots } from './serverHostState';

export function createProductionLanguageServices(): LanguageFeatureServices {
    setServerWorkspaceRoots([process.cwd()]);

    const analysisService = DocumentSemanticSnapshotService.getInstance();

    const workspaceDocumentHost = createVsCodeWorkspaceDocumentHost();
    const projectConfigService = new LpcProjectConfigService();
    const macroManager = new MacroManager(projectConfigService, workspaceDocumentHost);
    const documentationService = new FunctionDocumentationService();
    const completionInstrumentation = new CompletionInstrumentation();
    const documentPathSupport = new WorkspaceDocumentPathSupport({
        host: workspaceDocumentHost,
        macroManager,
        projectConfigService
    });
    const functionDocCompatMaterializer = new FunctionDocCompatMaterializer();
    const functionDocLookupBuilder = new FunctionDocLookupBuilder({
        documentationService,
        pathSupport: documentPathSupport
    });
    const objectInferenceService = new ObjectInferenceService(
        macroManager,
        projectConfigService,
        analysisService,
        documentationService,
        workspaceDocumentHost,
        documentPathSupport
    );
    const scopedMethodResolver = new ScopedMethodResolver(macroManager, undefined, analysisService, workspaceDocumentHost);
    const inheritanceResolver = new InheritanceResolver(macroManager, undefined);
    const targetMethodLookup = new TargetMethodLookup(analysisService, documentPathSupport);
    const efunDocsManager = new EfunDocsManager(
        createServerExtensionContext(),
        projectConfigService,
        analysisService,
        macroManager,
        documentationService,
        documentPathSupport,
        functionDocCompatMaterializer,
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
    const scopedMethodDiscoveryService = new ScopedMethodDiscoveryService(
        macroManager,
        undefined,
        analysisService,
        workspaceDocumentHost
    );
    const scopedCompletionSupport = new ScopedMethodCompletionSupport({
        documentationService,
        documentHost: workspaceDocumentHost
    });

    const completionService = createDefaultQueryBackedLanguageCompletionService({
        efunDocsManager,
        macroManager,
        analysisService,
        documentationService,
        objectInferenceService,
        instrumentation: completionInstrumentation,
        inheritanceReporter: vscode.window.createOutputChannel('LPC Inheritance'),
        scopedMethodDiscoveryService,
        scopedCompletionSupport
    });
    const codeActionsService = createLanguageCodeActionService();
    const { diagnosticsService } = createDiagnosticsStack(macroManager, analysisService);
    const formattingService = createLanguageFormattingService(new FormattingService());
    const objectHoverService = createDefaultObjectInferenceLanguageHoverService(
        objectInferenceService,
        targetMethodLookup,
        {
            analysisService,
            scopedMethodResolver,
            documentationService
        }
    );
    const hoverService = new UnifiedLanguageHoverService(
        objectHoverService,
        macroManager,
        {
            efunHoverService: new EfunLanguageHoverService(efunDocsManager, analysisService)
        }
    );
    const definitionService = new AstBackedLanguageDefinitionService(
        macroManager,
        efunDocsManager,
        objectInferenceService,
        targetMethodLookup,
        projectConfigService,
        {
            analysisService,
            scopedMethodResolver,
            host: workspaceDocumentHost,
            pathSupport: documentPathSupport
        }
    );
    const referenceService = new AstBackedLanguageReferenceService({
        analysisService,
        inheritedRelationService
    });
    const renameService = new AstBackedLanguageRenameService({
        analysisService,
        inheritedRelationService
    });
    const symbolService = new AstBackedLanguageSymbolService({
        analysisService
    });
    const callableTargetDiscoveryService = new DefaultCallableTargetDiscoveryService(
        efunDocsManager,
        objectInferenceService,
        targetMethodLookup,
        scopedMethodResolver
    );
    const callableDocResolver = new DefaultCallableDocResolver(
        documentationService,
        efunDocsManager,
        workspaceDocumentHost
    );
    const signatureHelpService = new LanguageSignatureHelpService({
        discoveryService: callableTargetDiscoveryService,
        docResolver: callableDocResolver,
        renderer: new CallableDocRenderer(),
        callSiteAnalyzer: createSyntaxAwareCallSiteAnalyzer(analysisService)
    });
    const foldingService = new DefaultLanguageFoldingService(analysisService);
    const semanticTokensService = new DefaultLanguageSemanticTokensService(analysisService);

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

    return {
        completionService,
        codeActionsService,
        diagnosticsService,
        formattingService,
        navigationService,
        signatureHelpService,
        structureService
    };
}

function createServerExtensionContext(): ExtensionContext {
    return {
        subscriptions: [],
        extensionPath: resolveServerExtensionPath()
    } as unknown as ExtensionContext;
}

export function resolveServerExtensionPath(startDir: string = __dirname): string {
    let currentDir = path.resolve(startDir);

    while (true) {
        const packageJsonPath = path.join(currentDir, 'package.json');
        const efunDocsPath = path.join(currentDir, 'config', 'efun-docs.json');
        if (fs.existsSync(packageJsonPath) && fs.existsSync(efunDocsPath)) {
            return currentDir;
        }

        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) {
            return path.resolve(startDir, '..', '..', '..', '..');
        }

        currentDir = parentDir;
    }
}
