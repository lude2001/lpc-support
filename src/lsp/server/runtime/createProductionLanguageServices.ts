import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import type { ExtensionContext } from 'vscode';
import { CompletionInstrumentation } from '../../../completion/completionInstrumentation';
import { createDiagnosticsStack } from '../../../diagnostics';
import { EfunDocsManager } from '../../../efunDocs';
import { ASTManager } from '../../../ast/astManager';
import type { LanguageFeatureServices } from '../../../language/contracts/LanguageFeatureServices';
import { defaultTextDocumentHost } from '../../../language/shared/WorkspaceDocumentPathSupport';
import { createLanguageCodeActionService } from '../../../language/services/codeActions/LanguageCodeActionService';
import { QueryBackedLanguageCompletionService } from '../../../language/services/completion/LanguageCompletionService';
import { createLanguageFormattingService } from '../../../language/services/formatting/LanguageFormattingService';
import { AstBackedLanguageDefinitionService } from '../../../language/services/navigation/LanguageDefinitionService';
import { EfunLanguageHoverService } from '../../../language/services/navigation/EfunLanguageHoverService';
import {
    LanguageNavigationService,
    ObjectInferenceLanguageHoverService
} from '../../../language/services/navigation/LanguageHoverService';
import { InheritedSymbolRelationService } from '../../../language/services/navigation/InheritedSymbolRelationService';
import { UnifiedLanguageHoverService } from '../../../language/services/navigation/UnifiedLanguageHoverService';
import { AstBackedLanguageReferenceService } from '../../../language/services/navigation/LanguageReferenceService';
import { AstBackedLanguageRenameService } from '../../../language/services/navigation/LanguageRenameService';
import { LanguageSignatureHelpService } from '../../../language/services/signatureHelp/LanguageSignatureHelpService';
import { AstBackedLanguageSymbolService } from '../../../language/services/navigation/LanguageSymbolService';
import { FormattingService } from '../../../formatter/FormattingService';
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
    ASTManager.configureSingleton(analysisService);

    const projectConfigService = new LpcProjectConfigService();
    const macroManager = new MacroManager(projectConfigService);
    const efunDocsManager = new EfunDocsManager(createServerExtensionContext(), projectConfigService, analysisService);
    const completionInstrumentation = new CompletionInstrumentation();
    const objectInferenceService = new ObjectInferenceService(macroManager, projectConfigService, analysisService);
    const scopedMethodResolver = new ScopedMethodResolver(macroManager, undefined, analysisService);
    const targetMethodLookup = new TargetMethodLookup(macroManager, projectConfigService, analysisService);
    const inheritedRelationService = new InheritedSymbolRelationService({
        analysisService,
        macroManager,
        scopedMethodResolver,
        host: defaultTextDocumentHost
    });

    const completionService = new QueryBackedLanguageCompletionService(
        efunDocsManager,
        macroManager,
        completionInstrumentation,
        objectInferenceService,
        undefined,
        {
            analysisService
        }
    );
    const codeActionsService = createLanguageCodeActionService();
    const { diagnosticsService } = createDiagnosticsStack(macroManager, analysisService);
    const formattingService = createLanguageFormattingService(new FormattingService());
    const objectHoverService = new ObjectInferenceLanguageHoverService(
        objectInferenceService,
        macroManager,
        targetMethodLookup,
        projectConfigService,
        {
            analysisService,
            scopedMethodResolver
        }
    );
    const hoverService = new UnifiedLanguageHoverService(
        objectHoverService,
        efunDocsManager,
        macroManager,
        {
            analysisService,
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
            scopedMethodResolver
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
    const signatureHelpService = new LanguageSignatureHelpService({
        analysisService,
        efunDocsManager,
        objectInferenceService,
        targetMethodLookup,
        scopedMethodResolver
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
