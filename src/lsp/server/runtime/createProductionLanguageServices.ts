import * as path from 'path';
import * as fs from 'fs';
import type { ExtensionContext } from 'vscode';
import { ASTManager } from '../../../ast/astManager';
import { CompletionInstrumentation } from '../../../completion/completionInstrumentation';
import { createDefaultDiagnosticsCollectors } from '../../../diagnostics';
import { EfunDocsManager } from '../../../efunDocs';
import type { LanguageFeatureServices } from '../../../language/contracts/LanguageFeatureServices';
import { createLanguageCodeActionService } from '../../../language/services/codeActions/LanguageCodeActionService';
import { QueryBackedLanguageCompletionService } from '../../../language/services/completion/LanguageCompletionService';
import { createSharedDiagnosticsService } from '../../../language/services/diagnostics/createSharedDiagnosticsService';
import { createLanguageFormattingService } from '../../../language/services/formatting/LanguageFormattingService';
import { AstBackedLanguageDefinitionService } from '../../../language/services/navigation/LanguageDefinitionService';
import {
    LanguageNavigationService,
    ObjectInferenceLanguageHoverService
} from '../../../language/services/navigation/LanguageHoverService';
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
import { TargetMethodLookup } from '../../../targetMethodLookup';
import { setServerWorkspaceRoots } from './serverHostState';

export function createProductionLanguageServices(): LanguageFeatureServices {
    setServerWorkspaceRoots([process.cwd()]);

    const projectConfigService = new LpcProjectConfigService();
    const macroManager = new MacroManager(projectConfigService);
    const efunDocsManager = new EfunDocsManager(createServerExtensionContext(), projectConfigService);
    const completionInstrumentation = new CompletionInstrumentation();
    const objectInferenceService = new ObjectInferenceService(macroManager, projectConfigService);
    const scopedMethodResolver = new ScopedMethodResolver(macroManager, [process.cwd()]);
    const targetMethodLookup = new TargetMethodLookup(macroManager, projectConfigService);

    const completionService = new QueryBackedLanguageCompletionService(
        efunDocsManager,
        macroManager,
        completionInstrumentation,
        objectInferenceService
    );
    const codeActionsService = createLanguageCodeActionService();
    const diagnosticsCollectors = createDefaultDiagnosticsCollectors(macroManager);
    const diagnosticsService = createSharedDiagnosticsService(ASTManager.getInstance(), diagnosticsCollectors);
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
        macroManager
    );
    const definitionService = new AstBackedLanguageDefinitionService(
        macroManager,
        efunDocsManager,
        objectInferenceService,
        targetMethodLookup,
        projectConfigService,
        { scopedMethodResolver }
    );
    const referenceService = new AstBackedLanguageReferenceService();
    const renameService = new AstBackedLanguageRenameService();
    const symbolService = new AstBackedLanguageSymbolService();
    const signatureHelpService = new LanguageSignatureHelpService({
        efunDocsManager,
        objectInferenceService,
        targetMethodLookup,
        scopedMethodResolver
    });
    const foldingService = new DefaultLanguageFoldingService();
    const semanticTokensService = new DefaultLanguageSemanticTokensService();

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
