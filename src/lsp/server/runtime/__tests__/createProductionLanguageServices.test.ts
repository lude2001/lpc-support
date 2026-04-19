import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';

const analysisService = {
    kind: 'document-analysis-service',
    clearCache: jest.fn(),
    parseDocument: jest.fn(),
    getSyntaxDocument: jest.fn(),
    getSemanticSnapshot: jest.fn(),
    getBestAvailableSnapshot: jest.fn()
};
const astManager = { kind: 'ast-manager' };
const configureAstManagerSingleton = jest.fn(() => astManager);
const efunHoverService = { provideHover: jest.fn() };
const efunHoverCtor = jest.fn(() => efunHoverService);

jest.mock('../../../../semantic/documentSemanticSnapshotService', () => ({
    DocumentSemanticSnapshotService: {
        getInstance: jest.fn(() => analysisService)
    }
}));

jest.mock('../../../../language/services/navigation/EfunLanguageHoverService', () => ({
    EfunLanguageHoverService: efunHoverCtor
}));

describe('createProductionLanguageServices', () => {
    afterEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    test('assembles production completion, navigation, and structure services from the runtime factory', () => {
        const projectConfigService = { kind: 'project-config' };
        const macroManager = { kind: 'macro-manager' };
        const efunDocsManager = { kind: 'efun-docs-manager' };
        const documentationService = { kind: 'function-documentation-service' };
        const completionInstrumentation = { kind: 'completion-instrumentation' };
        const objectInferenceService = { kind: 'object-inference-service' };
        const targetMethodLookup = { kind: 'target-method-lookup' };
        const completionService = { provideCompletion: jest.fn() };
        const diagnosticsService = { collectDiagnostics: jest.fn() };
        const formattingService = {
            formatDocument: jest.fn(),
            formatRange: jest.fn()
        };
        const hoverService = { provideHover: jest.fn() };
        const signatureHelpService = { provideSignatureHelp: jest.fn() };
        const definitionService = { provideDefinition: jest.fn() };
        const referenceService = { provideReferences: jest.fn() };
        const renameService = {
            prepareRename: jest.fn(),
            provideRenameEdits: jest.fn()
        };
        const symbolService = { provideDocumentSymbols: jest.fn() };
        const foldingService = { provideFoldingRanges: jest.fn() };
        const semanticTokensService = { provideSemanticTokens: jest.fn() };
        const codeActionsService = { provideCodeActions: jest.fn() };

        jest.isolateModules(() => {
            jest.doMock('../../../../projectConfig/LpcProjectConfigService', () => ({
                LpcProjectConfigService: jest.fn(() => projectConfigService)
            }));
            jest.doMock('../../../../macroManager', () => ({
                MacroManager: jest.fn(() => macroManager)
            }));
            jest.doMock('../../../../efun/EfunDocsManager', () => ({
                EfunDocsManager: jest.fn(() => efunDocsManager)
            }));
            jest.doMock('../../../../language/documentation/FunctionDocumentationService', () => ({
                FunctionDocumentationService: jest.fn(() => documentationService)
            }));
            jest.doMock('../../../../completion/completionInstrumentation', () => ({
                CompletionInstrumentation: jest.fn(() => completionInstrumentation)
            }));
            jest.doMock('../../../../ast/astManager', () => ({
                ASTManager: {
                    configureSingleton: configureAstManagerSingleton,
                    getInstance: jest.fn(() => astManager)
                }
            }));
            jest.doMock('../../../../diagnostics', () => ({
                createDiagnosticsStack: jest.fn(() => ({
                    collectors: ['diagnostics-collector'],
                    diagnosticsService
                }))
            }));
            jest.doMock('../../../../language/services/formatting/LanguageFormattingService', () => ({
                createLanguageFormattingService: jest.fn(() => formattingService)
            }));
            jest.doMock('../../../../formatter/FormattingService', () => ({
                FormattingService: jest.fn()
            }));
            jest.doMock('../../../../objectInference/ObjectInferenceService', () => ({
                ObjectInferenceService: jest.fn(() => objectInferenceService)
            }));
            jest.doMock('../../../../targetMethodLookup', () => ({
                TargetMethodLookup: jest.fn(() => targetMethodLookup)
            }));
            jest.doMock('../../../../language/services/completion/LanguageCompletionService', () => ({
                QueryBackedLanguageCompletionService: jest.fn(() => completionService)
            }));
            jest.doMock('../../../../language/services/navigation/LanguageHoverService', () => ({
                ObjectInferenceLanguageHoverService: jest.fn(() => hoverService)
            }));
            jest.doMock('../../../../language/services/navigation/LanguageDefinitionService', () => ({
                AstBackedLanguageDefinitionService: jest.fn(() => definitionService)
            }));
            jest.doMock('../../../../language/services/signatureHelp/LanguageSignatureHelpService', () => ({
                LanguageSignatureHelpService: jest.fn(() => signatureHelpService)
            }));
            jest.doMock('../../../../language/services/navigation/LanguageReferenceService', () => ({
                AstBackedLanguageReferenceService: jest.fn(() => referenceService)
            }));
            jest.doMock('../../../../language/services/navigation/LanguageRenameService', () => ({
                AstBackedLanguageRenameService: jest.fn(() => renameService)
            }));
            jest.doMock('../../../../language/services/navigation/LanguageSymbolService', () => ({
                AstBackedLanguageSymbolService: jest.fn(() => symbolService)
            }));
            jest.doMock('../../../../language/services/navigation/UnifiedLanguageHoverService', () => ({
                UnifiedLanguageHoverService: jest.fn(() => hoverService)
            }));
            jest.doMock('../../../../language/services/codeActions/LanguageCodeActionService', () => ({
                createLanguageCodeActionService: jest.fn(() => codeActionsService)
            }));
            jest.doMock('../../../../language/services/structure/LanguageFoldingService', () => ({
                DefaultLanguageFoldingService: jest.fn(() => foldingService)
            }));
            jest.doMock('../../../../language/services/structure/LanguageSemanticTokensService', () => ({
                DefaultLanguageSemanticTokensService: jest.fn(() => semanticTokensService)
            }));

            const {
                createProductionLanguageServices
            } = require('../createProductionLanguageServices') as typeof import('../createProductionLanguageServices');

            const services = createProductionLanguageServices();
            const request = { example: true } as any;

            const { EfunDocsManager } = require('../../../../efun/EfunDocsManager') as typeof import('../../../../efun/EfunDocsManager');
            const { FunctionDocumentationService } = require('../../../../language/documentation/FunctionDocumentationService') as typeof import('../../../../language/documentation/FunctionDocumentationService');
            const { ObjectInferenceService } = require('../../../../objectInference/ObjectInferenceService') as typeof import('../../../../objectInference/ObjectInferenceService');
            const { QueryBackedLanguageCompletionService } = require('../../../../language/services/completion/LanguageCompletionService') as typeof import('../../../../language/services/completion/LanguageCompletionService');
            const { ObjectInferenceLanguageHoverService } = require('../../../../language/services/navigation/LanguageHoverService') as typeof import('../../../../language/services/navigation/LanguageHoverService');
            const { AstBackedLanguageDefinitionService } = require('../../../../language/services/navigation/LanguageDefinitionService') as typeof import('../../../../language/services/navigation/LanguageDefinitionService');
            const { LanguageSignatureHelpService } = require('../../../../language/services/signatureHelp/LanguageSignatureHelpService') as typeof import('../../../../language/services/signatureHelp/LanguageSignatureHelpService');
            expect(configureAstManagerSingleton).toHaveBeenCalledWith(analysisService);
            expect(FunctionDocumentationService).toHaveBeenCalledTimes(1);
            expect(ObjectInferenceService).toHaveBeenCalledWith(
                macroManager,
                projectConfigService,
                analysisService,
                documentationService
            );
            expect(EfunDocsManager).toHaveBeenCalledWith(
                expect.anything(),
                projectConfigService,
                analysisService,
                macroManager,
                documentationService
            );
            expect(QueryBackedLanguageCompletionService).toHaveBeenCalledWith(
                efunDocsManager,
                macroManager,
                completionInstrumentation,
                objectInferenceService,
                undefined,
                expect.objectContaining({
                    analysisService,
                    documentationService
                })
            );
            expect(ObjectInferenceLanguageHoverService).toHaveBeenCalledWith(
                objectInferenceService,
                macroManager,
                targetMethodLookup,
                projectConfigService,
                expect.objectContaining({
                    analysisService,
                    documentationService
                })
            );
            expect(AstBackedLanguageDefinitionService).toHaveBeenCalledWith(
                macroManager,
                efunDocsManager,
                objectInferenceService,
                targetMethodLookup,
                projectConfigService,
                expect.objectContaining({
                    analysisService
                })
            );
            expect(LanguageSignatureHelpService).toHaveBeenCalledWith(
                expect.objectContaining({
                    analysisService,
                    efunDocsManager,
                    objectInferenceService,
                    targetMethodLookup,
                    documentationService
                })
            );
            expect(services.completionService).toBe(completionService);
            expect(services.diagnosticsService).toBe(diagnosticsService);
            expect(services.formattingService).toBe(formattingService);
            expect(services.codeActionsService).toBe(codeActionsService);
            expect(services.signatureHelpService).toBe(signatureHelpService);
            services.navigationService?.provideHover(request);
            services.navigationService?.provideDefinition(request);
            services.navigationService?.provideReferences(request);
            services.navigationService?.prepareRename(request);
            services.navigationService?.provideRenameEdits(request);
            services.navigationService?.provideDocumentSymbols(request);
            services.structureService?.provideFoldingRanges(request);
            services.structureService?.provideSemanticTokens(request);
            services.codeActionsService?.provideCodeActions(request);
            services.signatureHelpService?.provideSignatureHelp(request);

            expect(hoverService.provideHover).toHaveBeenCalledWith(request);
            expect(definitionService.provideDefinition).toHaveBeenCalledWith(request);
            expect(referenceService.provideReferences).toHaveBeenCalledWith(request);
            expect(renameService.prepareRename).toHaveBeenCalledWith(request);
            expect(renameService.provideRenameEdits).toHaveBeenCalledWith(request);
            expect(symbolService.provideDocumentSymbols).toHaveBeenCalledWith(request);
            expect(foldingService.provideFoldingRanges).toHaveBeenCalledWith(request);
            expect(semanticTokensService.provideSemanticTokens).toHaveBeenCalledWith(request);
            expect(codeActionsService.provideCodeActions).toHaveBeenCalledWith(request);
            expect(signatureHelpService.provideSignatureHelp).toHaveBeenCalledWith(request);
        });
    });

    test('createProductionLanguageServices passes scopedMethodResolver into shipped hover, definition, and signature-help services', () => {
        const macroManager = { kind: 'macro-manager' };
        const scopedMethodResolver = { kind: 'scoped-method-resolver' };
        const scopedMethodResolverCtor = jest.fn(() => scopedMethodResolver);
        const hoverCtor = jest.fn(() => ({ provideHover: jest.fn() }));
        const definitionCtor = jest.fn(() => ({ provideDefinition: jest.fn() }));
        const signatureHelpCtor = jest.fn(() => ({ provideSignatureHelp: jest.fn() }));

        jest.isolateModules(() => {
            jest.doMock('../../../../projectConfig/LpcProjectConfigService', () => ({
                LpcProjectConfigService: jest.fn(() => ({ kind: 'project-config' }))
            }));
            jest.doMock('../../../../macroManager', () => ({
                MacroManager: jest.fn(() => macroManager)
            }));
            jest.doMock('../../../../efun/EfunDocsManager', () => ({
                EfunDocsManager: jest.fn(() => ({ kind: 'efun-docs-manager' }))
            }));
            jest.doMock('../../../../language/documentation/FunctionDocumentationService', () => ({
                FunctionDocumentationService: jest.fn(() => ({ kind: 'function-documentation-service' }))
            }));
            jest.doMock('../../../../completion/completionInstrumentation', () => ({
                CompletionInstrumentation: jest.fn(() => ({ kind: 'completion-instrumentation' }))
            }));
            jest.doMock('../../../../ast/astManager', () => ({
                ASTManager: {
                    configureSingleton: configureAstManagerSingleton,
                    getInstance: jest.fn(() => astManager)
                }
            }));
            jest.doMock('../../../../diagnostics', () => ({
                createDiagnosticsStack: jest.fn(() => ({
                    collectors: ['diagnostics-collector'],
                    diagnosticsService: { collectDiagnostics: jest.fn() }
                }))
            }));
            jest.doMock('../../../../language/services/formatting/LanguageFormattingService', () => ({
                createLanguageFormattingService: jest.fn(() => ({ formatDocument: jest.fn(), formatRange: jest.fn() }))
            }));
            jest.doMock('../../../../formatter/FormattingService', () => ({
                FormattingService: jest.fn()
            }));
            jest.doMock('../../../../objectInference/ObjectInferenceService', () => ({
                ObjectInferenceService: jest.fn(() => ({ kind: 'object-inference-service' }))
            }));
            jest.doMock('../../../../objectInference/ScopedMethodResolver', () => ({
                ScopedMethodResolver: scopedMethodResolverCtor
            }));
            jest.doMock('../../../../targetMethodLookup', () => ({
                TargetMethodLookup: jest.fn(() => ({ kind: 'target-method-lookup' }))
            }));
            jest.doMock('../../../../language/services/completion/LanguageCompletionService', () => ({
                QueryBackedLanguageCompletionService: jest.fn(() => ({ provideCompletion: jest.fn() }))
            }));
            jest.doMock('../../../../language/services/navigation/LanguageHoverService', () => ({
                ObjectInferenceLanguageHoverService: hoverCtor
            }));
            jest.doMock('../../../../language/services/navigation/LanguageDefinitionService', () => ({
                AstBackedLanguageDefinitionService: definitionCtor
            }));
            jest.doMock('../../../../language/services/signatureHelp/LanguageSignatureHelpService', () => ({
                LanguageSignatureHelpService: signatureHelpCtor
            }));
            jest.doMock('../../../../language/services/navigation/UnifiedLanguageHoverService', () => ({
                UnifiedLanguageHoverService: jest.fn(() => ({ provideHover: jest.fn() }))
            }));
            jest.doMock('../../../../language/services/navigation/LanguageReferenceService', () => ({
                AstBackedLanguageReferenceService: jest.fn(() => ({ provideReferences: jest.fn() }))
            }));
            jest.doMock('../../../../language/services/navigation/LanguageRenameService', () => ({
                AstBackedLanguageRenameService: jest.fn(() => ({ prepareRename: jest.fn(), provideRenameEdits: jest.fn() }))
            }));
            jest.doMock('../../../../language/services/navigation/LanguageSymbolService', () => ({
                AstBackedLanguageSymbolService: jest.fn(() => ({ provideDocumentSymbols: jest.fn() }))
            }));
            jest.doMock('../../../../language/services/codeActions/LanguageCodeActionService', () => ({
                createLanguageCodeActionService: jest.fn(() => ({ provideCodeActions: jest.fn() }))
            }));
            jest.doMock('../../../../language/services/structure/LanguageFoldingService', () => ({
                DefaultLanguageFoldingService: jest.fn(() => ({ provideFoldingRanges: jest.fn() }))
            }));
            jest.doMock('../../../../language/services/structure/LanguageSemanticTokensService', () => ({
                DefaultLanguageSemanticTokensService: jest.fn(() => ({ provideSemanticTokens: jest.fn() }))
            }));

            const {
                createProductionLanguageServices
            } = require('../createProductionLanguageServices') as typeof import('../createProductionLanguageServices');

            createProductionLanguageServices();

            expect(configureAstManagerSingleton).toHaveBeenCalledWith(analysisService);
            expect(scopedMethodResolverCtor).toHaveBeenCalledWith(
                macroManager,
                undefined,
                analysisService
            );
            expect(scopedMethodResolverCtor).not.toHaveBeenCalledWith(macroManager, [process.cwd()]);
            expect(hoverCtor).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.anything(),
                expect.anything(),
                expect.objectContaining({ scopedMethodResolver })
            );
            expect(definitionCtor).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.anything(),
                expect.anything(),
                expect.anything(),
                expect.objectContaining({ scopedMethodResolver })
            );
            expect(signatureHelpCtor).toHaveBeenCalledWith(
                expect.objectContaining({ scopedMethodResolver })
            );
        });
    });

    test('createProductionLanguageServices wires the inherited relation service into references and rename', () => {
        const inheritedRelationService = { kind: 'inherited-relation-service' };
        const inheritedRelationCtor = jest.fn(() => inheritedRelationService);
        const referenceService = { provideReferences: jest.fn() };
        const renameService = {
            prepareRename: jest.fn(),
            provideRenameEdits: jest.fn()
        };
        const referenceCtor = jest.fn(() => referenceService);
        const renameCtor = jest.fn(() => renameService);

        jest.isolateModules(() => {
            jest.doMock('../../../../projectConfig/LpcProjectConfigService', () => ({
                LpcProjectConfigService: jest.fn(() => ({ kind: 'project-config' }))
            }));
            jest.doMock('../../../../macroManager', () => ({
                MacroManager: jest.fn(() => ({ kind: 'macro-manager' }))
            }));
            jest.doMock('../../../../efun/EfunDocsManager', () => ({
                EfunDocsManager: jest.fn(() => ({ kind: 'efun-docs-manager' }))
            }));
            jest.doMock('../../../../completion/completionInstrumentation', () => ({
                CompletionInstrumentation: jest.fn(() => ({ kind: 'completion-instrumentation' }))
            }));
            jest.doMock('../../../../ast/astManager', () => ({
                ASTManager: {
                    configureSingleton: configureAstManagerSingleton,
                    getInstance: jest.fn(() => astManager)
                }
            }));
            jest.doMock('../../../../diagnostics', () => ({
                createDiagnosticsStack: jest.fn(() => ({
                    collectors: ['diagnostics-collector'],
                    diagnosticsService: { collectDiagnostics: jest.fn() }
                }))
            }));
            jest.doMock('../../../../language/services/formatting/LanguageFormattingService', () => ({
                createLanguageFormattingService: jest.fn(() => ({ formatDocument: jest.fn(), formatRange: jest.fn() }))
            }));
            jest.doMock('../../../../formatter/FormattingService', () => ({
                FormattingService: jest.fn()
            }));
            jest.doMock('../../../../objectInference/ObjectInferenceService', () => ({
                ObjectInferenceService: jest.fn(() => ({ kind: 'object-inference-service' }))
            }));
            jest.doMock('../../../../objectInference/ScopedMethodResolver', () => ({
                ScopedMethodResolver: jest.fn(() => ({ kind: 'scoped-method-resolver' }))
            }));
            jest.doMock('../../../../targetMethodLookup', () => ({
                TargetMethodLookup: jest.fn(() => ({ kind: 'target-method-lookup' }))
            }));
            jest.doMock('../../../../language/services/completion/LanguageCompletionService', () => ({
                QueryBackedLanguageCompletionService: jest.fn(() => ({ provideCompletion: jest.fn() }))
            }));
            jest.doMock('../../../../language/services/navigation/LanguageHoverService', () => ({
                ObjectInferenceLanguageHoverService: jest.fn(() => ({ provideHover: jest.fn() }))
            }));
            jest.doMock('../../../../language/services/navigation/LanguageDefinitionService', () => ({
                AstBackedLanguageDefinitionService: jest.fn(() => ({ provideDefinition: jest.fn() }))
            }));
            jest.doMock('../../../../language/services/navigation/LanguageReferenceService', () => ({
                AstBackedLanguageReferenceService: referenceCtor
            }));
            jest.doMock('../../../../language/services/navigation/LanguageRenameService', () => ({
                AstBackedLanguageRenameService: renameCtor
            }));
            jest.doMock('../../../../language/services/navigation/LanguageSymbolService', () => ({
                AstBackedLanguageSymbolService: jest.fn(() => ({ provideDocumentSymbols: jest.fn() }))
            }));
            jest.doMock('../../../../language/services/navigation/UnifiedLanguageHoverService', () => ({
                UnifiedLanguageHoverService: jest.fn(() => ({ provideHover: jest.fn() }))
            }));
            jest.doMock('../../../../language/services/signatureHelp/LanguageSignatureHelpService', () => ({
                LanguageSignatureHelpService: jest.fn(() => ({ provideSignatureHelp: jest.fn() }))
            }));
            jest.doMock('../../../../language/services/codeActions/LanguageCodeActionService', () => ({
                createLanguageCodeActionService: jest.fn(() => ({ provideCodeActions: jest.fn() }))
            }));
            jest.doMock('../../../../language/services/structure/LanguageFoldingService', () => ({
                DefaultLanguageFoldingService: jest.fn(() => ({ provideFoldingRanges: jest.fn() }))
            }));
            jest.doMock('../../../../language/services/structure/LanguageSemanticTokensService', () => ({
                DefaultLanguageSemanticTokensService: jest.fn(() => ({ provideSemanticTokens: jest.fn() }))
            }));
            jest.doMock('../../../../language/services/navigation/InheritedSymbolRelationService', () => ({
                InheritedSymbolRelationService: inheritedRelationCtor
            }));

            const {
                createProductionLanguageServices
            } = require('../createProductionLanguageServices') as typeof import('../createProductionLanguageServices');

            createProductionLanguageServices();

            expect(configureAstManagerSingleton).toHaveBeenCalledWith(analysisService);
            expect(inheritedRelationCtor).toHaveBeenCalledWith(expect.objectContaining({
                scopedMethodResolver: expect.anything(),
                macroManager: expect.anything(),
                host: expect.objectContaining({
                    openTextDocument: expect.any(Function)
                })
            }));
            expect(referenceCtor).toHaveBeenCalledWith(expect.objectContaining({
                inheritedRelationService
            }));
            expect(renameCtor).toHaveBeenCalledWith(expect.objectContaining({
                inheritedRelationService
            }));
        });
    });

    test('creates diagnostics services through the shared diagnostics stack factory', () => {
        const macroManager = { kind: 'macro-manager' };
        const diagnosticsStack = {
            collectors: ['diagnostics-collector'],
            diagnosticsService: { collectDiagnostics: jest.fn() }
        };
        const createDiagnosticsStack = jest.fn(() => diagnosticsStack);

        jest.isolateModules(() => {
            jest.doMock('../../../../projectConfig/LpcProjectConfigService', () => ({
                LpcProjectConfigService: jest.fn(() => ({ kind: 'project-config' }))
            }));
            jest.doMock('../../../../macroManager', () => ({
                MacroManager: jest.fn(() => macroManager)
            }));
            jest.doMock('../../../../efun/EfunDocsManager', () => ({
                EfunDocsManager: jest.fn(() => ({ kind: 'efun-docs-manager' }))
            }));
            jest.doMock('../../../../completion/completionInstrumentation', () => ({
                CompletionInstrumentation: jest.fn(() => ({ kind: 'completion-instrumentation' }))
            }));
            jest.doMock('../../../../diagnostics', () => ({
                createDiagnosticsStack
            }));
            jest.doMock('../../../../language/services/formatting/LanguageFormattingService', () => ({
                createLanguageFormattingService: jest.fn(() => ({ formatDocument: jest.fn(), formatRange: jest.fn() }))
            }));
            jest.doMock('../../../../formatter/FormattingService', () => ({
                FormattingService: jest.fn()
            }));
            jest.doMock('../../../../objectInference/ObjectInferenceService', () => ({
                ObjectInferenceService: jest.fn(() => ({ kind: 'object-inference-service' }))
            }));
            jest.doMock('../../../../objectInference/ScopedMethodResolver', () => ({
                ScopedMethodResolver: jest.fn(() => ({ kind: 'scoped-method-resolver' }))
            }));
            jest.doMock('../../../../targetMethodLookup', () => ({
                TargetMethodLookup: jest.fn(() => ({ kind: 'target-method-lookup' }))
            }));
            jest.doMock('../../../../language/services/completion/LanguageCompletionService', () => ({
                QueryBackedLanguageCompletionService: jest.fn(() => ({ provideCompletion: jest.fn() }))
            }));
            jest.doMock('../../../../language/services/navigation/LanguageHoverService', () => ({
                ObjectInferenceLanguageHoverService: jest.fn(() => ({ provideHover: jest.fn() }))
            }));
            jest.doMock('../../../../language/services/navigation/LanguageDefinitionService', () => ({
                AstBackedLanguageDefinitionService: jest.fn(() => ({ provideDefinition: jest.fn() }))
            }));
            jest.doMock('../../../../language/services/navigation/LanguageReferenceService', () => ({
                AstBackedLanguageReferenceService: jest.fn(() => ({ provideReferences: jest.fn() }))
            }));
            jest.doMock('../../../../language/services/navigation/LanguageRenameService', () => ({
                AstBackedLanguageRenameService: jest.fn(() => ({ prepareRename: jest.fn(), provideRenameEdits: jest.fn() }))
            }));
            jest.doMock('../../../../language/services/navigation/LanguageSymbolService', () => ({
                AstBackedLanguageSymbolService: jest.fn(() => ({ provideDocumentSymbols: jest.fn() }))
            }));
            jest.doMock('../../../../language/services/navigation/UnifiedLanguageHoverService', () => ({
                UnifiedLanguageHoverService: jest.fn(() => ({ provideHover: jest.fn() }))
            }));
            jest.doMock('../../../../language/services/signatureHelp/LanguageSignatureHelpService', () => ({
                LanguageSignatureHelpService: jest.fn(() => ({ provideSignatureHelp: jest.fn() }))
            }));
            jest.doMock('../../../../language/services/codeActions/LanguageCodeActionService', () => ({
                createLanguageCodeActionService: jest.fn(() => ({ provideCodeActions: jest.fn() }))
            }));
            jest.doMock('../../../../language/services/structure/LanguageFoldingService', () => ({
                DefaultLanguageFoldingService: jest.fn(() => ({ provideFoldingRanges: jest.fn() }))
            }));
            jest.doMock('../../../../language/services/structure/LanguageSemanticTokensService', () => ({
                DefaultLanguageSemanticTokensService: jest.fn(() => ({ provideSemanticTokens: jest.fn() }))
            }));
            jest.doMock('../../../../language/services/navigation/InheritedSymbolRelationService', () => ({
                InheritedSymbolRelationService: jest.fn(() => ({ kind: 'inherited-relation-service' }))
            }));

            const {
                createProductionLanguageServices
            } = require('../createProductionLanguageServices') as typeof import('../createProductionLanguageServices');

            const services = createProductionLanguageServices();

            expect(createDiagnosticsStack).toHaveBeenCalledTimes(1);
            expect(createDiagnosticsStack).toHaveBeenCalledWith(macroManager, analysisService);
            expect(services.diagnosticsService).toBe(diagnosticsStack.diagnosticsService);
        });
    });

    test('resolves the extension root from both src and dist-style runtime directories', () => {
        jest.isolateModules(() => {
            const moduleUnderTest = require('../createProductionLanguageServices') as typeof import('../createProductionLanguageServices');
            const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-runtime-root-'));
            const extensionRoot = path.join(tempRoot, 'extension');
            const srcRuntimeDir = path.join(extensionRoot, 'src', 'lsp', 'server', 'runtime');
            const distRuntimeDir = path.join(extensionRoot, 'dist', 'lsp');

            fs.mkdirSync(path.join(extensionRoot, 'config'), { recursive: true });
            fs.mkdirSync(srcRuntimeDir, { recursive: true });
            fs.mkdirSync(distRuntimeDir, { recursive: true });
            fs.writeFileSync(path.join(extensionRoot, 'package.json'), '{"name":"lpc-support"}', 'utf8');
            fs.writeFileSync(path.join(extensionRoot, 'config', 'efun-docs.json'), '{"docs":{},"categories":{}}', 'utf8');

            expect(moduleUnderTest.resolveServerExtensionPath(srcRuntimeDir)).toBe(extensionRoot);
            expect(moduleUnderTest.resolveServerExtensionPath(distRuntimeDir)).toBe(extensionRoot);

            fs.rmSync(tempRoot, { recursive: true, force: true });
        });
    });
});
