import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
describe('createProductionLanguageServices', () => {
    afterEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    test('assembles production completion, navigation, and structure services from the runtime factory', () => {
        const projectConfigService = { kind: 'project-config' };
        const macroManager = { kind: 'macro-manager' };
        const efunDocsManager = { kind: 'efun-docs-manager' };
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
            jest.doMock('../../../../completion/completionInstrumentation', () => ({
                CompletionInstrumentation: jest.fn(() => completionInstrumentation)
            }));
            jest.doMock('../../../../ast/astManager', () => ({
                ASTManager: {
                    getInstance: jest.fn(() => ({ kind: 'ast-manager' }))
                }
            }));
            jest.doMock('../../../../diagnostics', () => ({
                createDefaultDiagnosticsCollectors: jest.fn(() => ['diagnostics-collector'])
            }));
            jest.doMock('../../../../language/services/diagnostics/createSharedDiagnosticsService', () => ({
                createSharedDiagnosticsService: jest.fn(() => diagnosticsService)
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

            expect(services.completionService).toBe(completionService);
            expect(services.diagnosticsService).toBe(diagnosticsService);
            expect(services.formattingService).toBe(formattingService);
            expect(services.codeActionsService).toBe(codeActionsService);
            services.navigationService?.provideHover(request);
            services.navigationService?.provideDefinition(request);
            services.navigationService?.provideReferences(request);
            services.navigationService?.prepareRename(request);
            services.navigationService?.provideRenameEdits(request);
            services.navigationService?.provideDocumentSymbols(request);
            services.structureService?.provideFoldingRanges(request);
            services.structureService?.provideSemanticTokens(request);
            services.codeActionsService?.provideCodeActions(request);

            expect(hoverService.provideHover).toHaveBeenCalledWith(request);
            expect(definitionService.provideDefinition).toHaveBeenCalledWith(request);
            expect(referenceService.provideReferences).toHaveBeenCalledWith(request);
            expect(renameService.prepareRename).toHaveBeenCalledWith(request);
            expect(renameService.provideRenameEdits).toHaveBeenCalledWith(request);
            expect(symbolService.provideDocumentSymbols).toHaveBeenCalledWith(request);
            expect(foldingService.provideFoldingRanges).toHaveBeenCalledWith(request);
            expect(semanticTokensService.provideSemanticTokens).toHaveBeenCalledWith(request);
            expect(codeActionsService.provideCodeActions).toHaveBeenCalledWith(request);
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
