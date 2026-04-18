import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import type { ExtensionContext } from 'vscode';
import { CompletionInstrumentation } from '../../../completion/completionInstrumentation';
import { createDiagnosticsStack } from '../../../diagnostics';
import { EfunDocsManager } from '../../../efunDocs';
import type { LanguageFeatureServices } from '../../../language/contracts/LanguageFeatureServices';
import { createLanguageCodeActionService } from '../../../language/services/codeActions/LanguageCodeActionService';
import { QueryBackedLanguageCompletionService } from '../../../language/services/completion/LanguageCompletionService';
import { createLanguageFormattingService } from '../../../language/services/formatting/LanguageFormattingService';
import { AstBackedLanguageDefinitionService } from '../../../language/services/navigation/LanguageDefinitionService';
import { EfunLanguageHoverService, configureEfunHoverAnalysisService } from '../../../language/services/navigation/EfunLanguageHoverService';
import {
    LanguageNavigationService,
    ObjectInferenceLanguageHoverService
} from '../../../language/services/navigation/LanguageHoverService';
import { InheritedSymbolRelationService } from '../../../language/services/navigation/InheritedSymbolRelationService';
import { configureScopedMethodIdentifierAnalysisService } from '../../../language/services/navigation/ScopedMethodIdentifierSupport';
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
import { configureSymbolReferenceAnalysisService } from '../../../symbolReferenceResolver';
import { TargetMethodLookup, configureTargetMethodLookupAnalysisService } from '../../../targetMethodLookup';
import { configureSimulatedEfunScannerAnalysisService } from '../../../efun/SimulatedEfunScanner';
import { setServerWorkspaceRoots } from './serverHostState';

export function createProductionLanguageServices(): LanguageFeatureServices {
    setServerWorkspaceRoots([process.cwd()]);

    const analysisService = DocumentSemanticSnapshotService.getInstance();
    configureSymbolReferenceAnalysisService(analysisService);
    configureTargetMethodLookupAnalysisService(analysisService);
    configureSimulatedEfunScannerAnalysisService(analysisService);
    configureEfunHoverAnalysisService(analysisService);
    configureScopedMethodIdentifierAnalysisService(analysisService);

    const projectConfigService = new LpcProjectConfigService();
    const macroManager = new MacroManager(projectConfigService);
    const efunDocsManager = new EfunDocsManager(createServerExtensionContext(), projectConfigService);
    const completionInstrumentation = new CompletionInstrumentation();
    const objectInferenceService = new ObjectInferenceService(macroManager, projectConfigService);
    const scopedMethodResolver = new ScopedMethodResolver(macroManager);
    const targetMethodLookup = new TargetMethodLookup(macroManager, projectConfigService, analysisService);
    const inheritedRelationService = new InheritedSymbolRelationService({
        macroManager,
        scopedMethodResolver,
        host: {
            openTextDocument: async (target: string | vscode.Uri) => typeof target === 'string'
                ? vscode.workspace.openTextDocument(target)
                : vscode.workspace.openTextDocument(target)
        }
    });

    const completionService = new QueryBackedLanguageCompletionService(
        efunDocsManager,
        macroManager,
        completionInstrumentation,
        objectInferenceService
    );
    const codeActionsService = createLanguageCodeActionService();
    const { diagnosticsService } = createDiagnosticsStack(macroManager, analysisService);
    const formattingService = createLanguageFormattingService(new FormattingService());
    const objectHoverService = new ObjectInferenceLanguageHoverService(
        objectInferenceService,
        macroManager,
        targetMethodLookup,
        projectConfigService,
        { scopedMethodResolver }
    );
    const hoverService = new UnifiedLanguageHoverService(
        objectHoverService,
        efunDocsManager,
        macroManager,
        { efunHoverService: new EfunLanguageHoverService(efunDocsManager, analysisService) }
    );
    const definitionService = new AstBackedLanguageDefinitionService(
        macroManager,
        efunDocsManager,
        objectInferenceService,
        targetMethodLookup,
        projectConfigService,
        { scopedMethodResolver }
    );
    const referenceService = new AstBackedLanguageReferenceService({ inheritedRelationService });
    const renameService = new AstBackedLanguageRenameService({ inheritedRelationService });
    const symbolService = new AstBackedLanguageSymbolService({
        analysisService
    });
    const signatureHelpService = new LanguageSignatureHelpService({
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
