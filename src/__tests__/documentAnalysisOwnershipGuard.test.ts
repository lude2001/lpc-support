import { describe, expect, test } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

describe('document analysis ownership guards', () => {
    const repoRoot = path.resolve(__dirname, '..', '..');
    const srcRoot = path.join(repoRoot, 'src');
    const legacyServicePath = path.join(srcRoot, 'completion', 'documentSemanticSnapshotService.ts');

    test('production sources no longer import the analysis owner from the legacy completion path', () => {
        const productionFiles = listProductionTypeScriptFiles(srcRoot);

        for (const filePath of productionFiles) {
            if (filePath === legacyServicePath) {
                continue;
            }

            const source = fs.readFileSync(filePath, 'utf8');
            expect(source).not.toMatch(/from\s+['"][^'"]*completion\/documentSemanticSnapshotService['"]/);
            expect(source).not.toMatch(/from\s+['"][^'"]*completion\\documentSemanticSnapshotService['"]/);
        }
    });

    test('semantic and ast owner layers do not import analysis snapshot contracts from completion/types', () => {
        const ownerFiles = [
            path.join(srcRoot, 'semantic', 'documentAnalysisService.ts'),
            path.join(srcRoot, 'semantic', 'documentSemanticSnapshotService.ts'),
            path.join(srcRoot, 'semantic', 'SemanticModelBuilder.ts'),
            path.join(srcRoot, 'semantic', 'semanticSnapshot.ts'),
            path.join(srcRoot, 'ast', 'astManager.ts')
        ];

        for (const filePath of ownerFiles) {
            const source = fs.readFileSync(filePath, 'utf8');
            expect(source).not.toMatch(/from\s+['"][^'"]*completion\/types['"]/);
            expect(source).not.toMatch(/from\s+['"][^'"]*completion\\types['"]/);
        }
    });

    test('legacy completion shim no longer exposes singleton access, and AST singleton wiring stays out of production', () => {
        const legacySource = fs.readFileSync(legacyServicePath, 'utf8');

        expect(legacySource).not.toContain('getInstance(');

        const snapshotSingletonCallSites = listProductionTypeScriptFiles(srcRoot)
            .filter((filePath) => fs.readFileSync(filePath, 'utf8').includes('DocumentSemanticSnapshotService.getInstance('))
            .map((filePath) => path.relative(repoRoot, filePath).replace(/\\/g, '/'))
            .sort();
        const astManagerSource = fs.readFileSync(
            path.join(srcRoot, 'ast', 'astManager.ts'),
            'utf8'
        );

        const astConfigureCallSites = listProductionTypeScriptFiles(srcRoot)
            .filter((filePath) => filePath !== path.join(srcRoot, 'ast', 'astManager.ts'))
            .filter((filePath) => fs.readFileSync(filePath, 'utf8').includes('ASTManager.configureSingleton('))
            .map((filePath) => path.relative(repoRoot, filePath).replace(/\\/g, '/'))
            .sort();

        const astSingletonCallSites = listProductionTypeScriptFiles(srcRoot)
            .filter((filePath) => fs.readFileSync(filePath, 'utf8').includes('ASTManager.getInstance('))
            .map((filePath) => path.relative(repoRoot, filePath).replace(/\\/g, '/'))
            .sort();

        expect(snapshotSingletonCallSites).toEqual([
            'src/lsp/server/runtime/createProductionLanguageServices.ts',
            'src/modules/coreModule.ts'
        ]);
        expect(astConfigureCallSites).toEqual([]);
        expect(astSingletonCallSites).toEqual([]);
        expect(astManagerSource).not.toContain('public static configureSingleton(');
        expect(astManagerSource).not.toContain('public static getInstance(');
        expect(astManagerSource).not.toContain('public static resetSingletonForTests(');
    });

    test('FunctionDocumentationService default assembly stays on the documented factory/composition roots', () => {
        const documentationInstantiationCallSites = listProductionTypeScriptFiles(srcRoot)
            .filter((filePath) => fs.readFileSync(filePath, 'utf8').includes('createDefaultFunctionDocumentationService('))
            .map((filePath) => path.relative(repoRoot, filePath).replace(/\\/g, '/'))
            .sort();

        expect(documentationInstantiationCallSites).toEqual([
            'src/language/documentation/FunctionDocumentationService.ts',
            'src/lsp/server/runtime/createProductionLanguageServices.ts',
            'src/modules/coreModule.ts'
        ]);
    });

    test('scoped-method helper seam no longer exposes ambient analysis ownership hooks', () => {
        const ambientAnalysisAccessCallSites = listProductionTypeScriptFiles(srcRoot)
            .filter((filePath) => {
                const source = fs.readFileSync(filePath, 'utf8');
                return source.includes('requireConfiguredDocumentAnalysisService(')
                    || source.includes('getConfiguredDocumentAnalysisService(')
                    || source.includes('configureScopedMethodIdentifierAnalysisService(');
            })
            .map((filePath) => path.relative(repoRoot, filePath).replace(/\\/g, '/'))
            .sort();

        expect(ambientAnalysisAccessCallSites).toEqual([]);
    });

    test('production scoped identifier lookups pass analysis services explicitly', () => {
        const explicitScopedCallSites = listProductionTypeScriptFiles(srcRoot)
            .filter((filePath) => filePath !== path.join(srcRoot, 'language', 'services', 'navigation', 'ScopedMethodIdentifierSupport.ts'))
            .filter((filePath) => {
                const source = fs.readFileSync(filePath, 'utf8');
                return source.includes('isOnScopedMethodIdentifier(')
                    || source.includes('isScopedIdentifier?: ScopedIdentifierTester')
                    || source.includes('dependencies.isScopedIdentifier ?? isOnScopedMethodIdentifier');
            })
            .map((filePath) => path.relative(repoRoot, filePath).replace(/\\/g, '/'))
            .sort();

        expect(explicitScopedCallSites).toEqual([
            'src/language/services/navigation/InheritedFunctionRelationService.ts',
            'src/language/services/navigation/definition/ScopedMethodDefinitionResolver.ts',
            'src/language/services/navigation/hover/ScopedMethodHoverResolver.ts'
        ]);

        for (const relativePath of explicitScopedCallSites) {
            const source = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
            if (relativePath === 'src/language/services/navigation/hover/ScopedMethodHoverResolver.ts') {
                expect(source).toContain('dependencies.isScopedIdentifier ?? isOnScopedMethodIdentifier');
                continue;
            }

            expect(source).toMatch(/isOnScopedMethodIdentifier\([\s\S]*?,[\s\S]*?,[\s\S]*?,[\s\S]*?\)/);
        }
    });

    test('ASTManager stays a thin facade without legacy product APIs', () => {
        const astManagerSource = fs.readFileSync(path.join(srcRoot, 'ast', 'astManager.ts'), 'utf8');

        expect(astManagerSource).not.toContain('getCompletionItems(');
        expect(astManagerSource).not.toContain('getStructMemberCompletions(');
        expect(astManagerSource).not.toContain('getFunctionDefinition(');
        expect(astManagerSource).not.toContain('getHoverInfo(');
        expect(astManagerSource).not.toContain('getDiagnostics(');
    });

    test('production services depend on DocumentAnalysisService instead of the ASTManager facade', () => {
        const astManagerImports = listProductionTypeScriptFiles(srcRoot)
            .filter((filePath) => filePath !== path.join(srcRoot, 'ast', 'astManager.ts'))
            .filter((filePath) => fs.readFileSync(filePath, 'utf8').includes('ast/astManager'))
            .map((filePath) => path.relative(repoRoot, filePath).replace(/\\/g, '/'))
            .sort();

        expect(astManagerImports).toEqual([]);
    });

    test('host commands do not use the standalone function parser facade', () => {
        const productionCallSites = listProductionTypeScriptFiles(srcRoot)
            .filter((filePath) => filePath !== path.join(srcRoot, 'functionParser.ts'))
            .filter((filePath) => fs.readFileSync(filePath, 'utf8').includes('LPCFunctionParser'))
            .map((filePath) => path.relative(repoRoot, filePath).replace(/\\/g, '/'))
            .sort();

        expect(productionCallSites).toEqual([]);
    });

    test('host code-action commands delegate function extraction to documentation services', () => {
        const codeActionsSource = fs.readFileSync(path.join(srcRoot, 'codeActions.ts'), 'utf8');

        expect(codeActionsSource).not.toContain('SyntaxKind');
        expect(codeActionsSource).not.toContain('FunctionDeclaration');
        expect(codeActionsSource).toContain('FunctionInfoExtractor');
    });

    test('inheritance resolution does not read include paths back out of MacroManager', () => {
        const productionCallSites = listProductionTypeScriptFiles(srcRoot)
            .filter((filePath) => filePath !== path.join(srcRoot, 'macroManager.ts'))
            .filter((filePath) => fs.readFileSync(filePath, 'utf8').includes('getIncludePath'))
            .map((filePath) => path.relative(repoRoot, filePath).replace(/\\/g, '/'))
            .sort();

        expect(productionCallSites).toEqual([]);
    });

    test('old macro manager service is removed from production ownership', () => {
        expect(fs.existsSync(path.join(srcRoot, 'macroManager.ts'))).toBe(false);

        const macroManagerCallSites = listProductionTypeScriptFiles(srcRoot)
            .filter((filePath) => {
                const source = fs.readFileSync(filePath, 'utf8');
                return source.includes('macroManager')
                    || source.includes('MacroManager')
                    || source.includes('configureMacroPath');
            })
            .map((filePath) => path.relative(repoRoot, filePath).replace(/\\/g, '/'))
            .sort();

        expect(macroManagerCallSites).toEqual([]);
    });

    test('debug parser facade does not bypass ParsedDocumentService', () => {
        expect(fs.existsSync(path.join(srcRoot, 'parser', 'LPCParserUtil.ts'))).toBe(false);
        expect(fs.existsSync(path.join(srcRoot, 'parser', 'ParseTreePrinter.ts'))).toBe(false);
    });

    test('LanguageCompletionService stays a coordinator without inherited-index, candidate, or presentation helpers', () => {
        const completionServiceSource = fs.readFileSync(
            path.join(srcRoot, 'language', 'services', 'completion', 'LanguageCompletionService.ts'),
            'utf8'
        );

        expect(completionServiceSource).not.toContain('private warmInheritedIndex(');
        expect(completionServiceSource).not.toContain('private refreshInheritedIndex(');
        expect(completionServiceSource).not.toContain('private indexMissingInheritedSnapshots(');
        expect(completionServiceSource).not.toContain('private createReadonlyDocumentFromUri(');
        expect(completionServiceSource).not.toContain('private getDocumentForUri(');
        expect(completionServiceSource).not.toContain('private resolveCompletionCandidates(');
        expect(completionServiceSource).not.toContain('private appendInheritedFallbackCandidates(');
        expect(completionServiceSource).not.toContain('private buildObjectMemberCandidates(');
        expect(completionServiceSource).not.toContain('private createCompletionItem(');
        expect(completionServiceSource).not.toContain('private applyStructuredDocumentation(');
        expect(completionServiceSource).not.toContain('private applyEfunDocumentation(');
        expect(completionServiceSource).not.toContain('private applyMacroDocumentation(');
        expect(completionServiceSource).not.toContain('private applyKeywordDocumentation(');
        expect(completionServiceSource).not.toContain('projectSymbolIndex.updateFromSnapshot(');
        expect(completionServiceSource).not.toContain('projectSymbolIndex.removeFile(');
        expect(completionServiceSource).not.toContain('projectSymbolIndex.clear(');
    });

    test('LanguageHoverService stays a coordinator without scoped/object/doc-shim helper ownership', () => {
        const hoverServiceSource = fs.readFileSync(
            path.join(srcRoot, 'language', 'services', 'navigation', 'LanguageHoverService.ts'),
            'utf8'
        );

        expect(hoverServiceSource).not.toContain('private isHoveringMemberName(');
        expect(hoverServiceSource).not.toContain('private loadMethodDocsFromCandidates(');
        expect(hoverServiceSource).not.toContain('private renderResolvedCandidatesHover(');
        expect(hoverServiceSource).not.toContain('private renderMultipleCandidatesHover(');
        expect(hoverServiceSource).not.toContain('private loadScopedMethodDoc(');
        expect(hoverServiceSource).not.toContain('function toDocumentationTextDocument(');
        expect(hoverServiceSource).not.toContain('function createCompletedTextDocumentShim(');
        expect(hoverServiceSource).not.toContain('function createSyntheticDocumentationUri(');
    });

    test('reference and rename services keep current-file adapter assembly in dedicated default factories', () => {
        const referenceServiceSource = fs.readFileSync(
            path.join(srcRoot, 'language', 'services', 'navigation', 'LanguageReferenceService.ts'),
            'utf8'
        );
        const renameServiceSource = fs.readFileSync(
            path.join(srcRoot, 'language', 'services', 'navigation', 'LanguageRenameService.ts'),
            'utf8'
        );

        expect(referenceServiceSource).not.toContain('private getReferenceResolver(');
        expect(renameServiceSource).not.toContain('private getReferenceResolver(');
        expect(referenceServiceSource).toContain('createDefaultAstBackedLanguageReferenceService(');
        expect(renameServiceSource).toContain('createDefaultAstBackedLanguageRenameService(');
    });

    test('LanguageSignatureHelpService stays a coordinator without inline analyzer/discovery/doc/presentation ownership', () => {
        const signatureHelpServiceSource = fs.readFileSync(
            path.join(srcRoot, 'language', 'services', 'signatureHelp', 'LanguageSignatureHelpService.ts'),
            'utf8'
        );

        expect(signatureHelpServiceSource).not.toContain('class SyntaxAwareCallSiteAnalyzer');
        expect(signatureHelpServiceSource).not.toContain('class DefaultCallableTargetDiscoveryService');
        expect(signatureHelpServiceSource).not.toContain('class DefaultCallableDocResolver');
        expect(signatureHelpServiceSource).not.toContain('function dedupeTargets(');
        expect(signatureHelpServiceSource).not.toContain('function mergeCallableDocGroups(');
        expect(signatureHelpServiceSource).not.toContain('function flattenMergedGroups(');
        expect(signatureHelpServiceSource).not.toContain('function selectActiveSignature(');
        expect(signatureHelpServiceSource).not.toContain('function countActiveParameterIndex(');
    });

    test('document host and path infrastructure stays on the shared owner instead of reappearing inline', () => {
        const targetMethodLookupSource = fs.readFileSync(
            path.join(srcRoot, 'targetMethodLookup.ts'),
            'utf8'
        );
        const inheritedFunctionRelationSource = fs.readFileSync(
            path.join(srcRoot, 'language', 'services', 'navigation', 'InheritedFunctionRelationService.ts'),
            'utf8'
        );
        const inheritedFileGlobalRelationSource = fs.readFileSync(
            path.join(srcRoot, 'language', 'services', 'navigation', 'InheritedFileGlobalRelationService.ts'),
            'utf8'
        );
        const productionServicesSource = fs.readFileSync(
            path.join(srcRoot, 'lsp', 'server', 'runtime', 'createProductionLanguageServices.ts'),
            'utf8'
        );

        expect(targetMethodLookupSource).not.toContain('private async resolveIncludeFilePaths(');
        expect(targetMethodLookupSource).not.toContain('private async getIncludeDirectories(');
        expect(targetMethodLookupSource).not.toContain('private resolveInheritedFilePath(');
        expect(targetMethodLookupSource).not.toContain('private resolveWorkspaceFilePath(');
        expect(targetMethodLookupSource).not.toContain('private ensureHeaderOrSourceExtension(');
        expect(targetMethodLookupSource).not.toContain('private ensureExtension(');
        expect(targetMethodLookupSource).not.toContain('private async tryOpenTextDocument(');

        expect(inheritedFunctionRelationSource).not.toContain("const defaultHost = {");
        expect(inheritedFileGlobalRelationSource).not.toContain("const defaultHost = {");
        expect(productionServicesSource).not.toContain("openTextDocument: async (target: string | vscode.Uri)");
    });

    test('core language and object-inference services do not bypass the shared document host owner', () => {
        const guardedFiles = [
            path.join(srcRoot, 'language', 'services', 'navigation', 'LanguageDefinitionService.ts'),
            path.join(srcRoot, 'language', 'services', 'completion', 'ScopedMethodCompletionSupport.ts'),
            path.join(srcRoot, 'objectInference', 'GlobalObjectBindingResolver.ts'),
            path.join(srcRoot, 'objectInference', 'InheritedGlobalObjectBindingResolver.ts'),
            path.join(srcRoot, 'objectInference', 'scopedInheritanceTraversal.ts')
        ];

        for (const filePath of guardedFiles) {
            const source = fs.readFileSync(filePath, 'utf8');
            expect(source).not.toContain('vscode.workspace.openTextDocument(');
        }
    });

    test('function doc panel stays presentation-only while tracker owns traversal', () => {
        const functionDocPanelSource = fs.readFileSync(
            path.join(srcRoot, 'functionDocPanel.ts'),
            'utf8'
        );
        const trackerSource = fs.readFileSync(
            path.join(srcRoot, 'efun', 'FileFunctionDocTracker.ts'),
            'utf8'
        );
        const lookupBuilderSource = fs.readFileSync(
            path.join(srcRoot, 'efun', 'FunctionDocLookupBuilder.ts'),
            'utf8'
        );
        const compatMaterializerPath = path.join(srcRoot, 'efun', 'FunctionDocCompatMaterializer.ts');

        expect(functionDocPanelSource).not.toContain('parseInheritedFunctions(');
        expect(functionDocPanelSource).not.toContain('parseIncludedFunctions(');
        expect(functionDocPanelSource).not.toContain('processInheritedFile(');
        expect(functionDocPanelSource).not.toContain('getIncludeFiles(');
        expect(trackerSource).not.toContain('vscode.workspace.openTextDocument(');
        expect(trackerSource).not.toContain('resolveWorkspaceRoot(');
        expect(trackerSource).not.toContain('parseInheritStatements(');
        expect(trackerSource).not.toContain('loadInheritedFileDocs(');
        expect(trackerSource).not.toContain('loadIncludeFileDocs(');
        expect(trackerSource).not.toContain('getIncludeFiles(');
        expect(trackerSource).not.toContain('buildCompatDocsForDocument(');
        expect(trackerSource).not.toContain('materializeCompatDoc(');
        expect(fs.existsSync(compatMaterializerPath)).toBe(false);

        expect(lookupBuilderSource).toContain('loadInheritedFileDocs(');
        expect(lookupBuilderSource).toContain('loadIncludeFileDocs(');
        expect(lookupBuilderSource).toContain('getIncludeFiles(');
        expect(lookupBuilderSource).not.toContain('parseInheritStatements(');
        expect(lookupBuilderSource).not.toContain('document.getText()');
        expect(lookupBuilderSource).not.toContain('includeRegex');
    });

    test('direct workspace document opens remain only on the shared owner and example file', () => {
        const directOpenCallSites = listProductionTypeScriptFiles(srcRoot)
            .filter((filePath) => fs.readFileSync(filePath, 'utf8').includes('vscode.workspace.openTextDocument('))
            .map((filePath) => path.relative(repoRoot, filePath).replace(/\\/g, '/'))
            .sort();

        expect(directOpenCallSites).toEqual([
            'src/language/shared/WorkspaceDocumentPathSupport.ts'
        ]);
    });

    test('call target resolution consumes include facts instead of reparsing document text', () => {
        const callTargetResolverSource = fs.readFileSync(
            path.join(srcRoot, 'semanticEvaluation', 'calls', 'CallTargetResolver.ts'),
            'utf8'
        );

        expect(callTargetResolverSource).not.toContain('document.getText()');
        expect(callTargetResolverSource).not.toContain('#include');
        expect(callTargetResolverSource).not.toContain('line.match(');
    });

    test('standalone function parser facade is not kept as a second structural parser', () => {
        expect(fs.existsSync(path.join(srcRoot, 'functionParser.ts'))).toBe(false);
    });

    test('simulated efun scanner consumes semantic include facts instead of directive regex fallback', () => {
        const scannerSource = fs.readFileSync(
            path.join(srcRoot, 'efun', 'SimulatedEfunScanner.ts'),
            'utf8'
        );

        expect(scannerSource).not.toContain('extractDirectiveIncludeFiles');
        expect(scannerSource).not.toContain('extractDirectiveIncludePath');
        expect(scannerSource).not.toContain('#?include');
    });

    test('function doc lookup consumes semantic inherit and include facts', () => {
        const lookupBuilderSource = fs.readFileSync(
            path.join(srcRoot, 'efun', 'FunctionDocLookupBuilder.ts'),
            'utf8'
        );

        expect(lookupBuilderSource).not.toContain('parseInheritStatements');
        expect(lookupBuilderSource).not.toContain('document.getText()');
        expect(lookupBuilderSource).not.toContain('includeRegex');
    });

    test('LanguageCodeActionService stays a coordinator without inline quick-fix builders or text helpers', () => {
        const codeActionServiceSource = fs.readFileSync(
            path.join(srcRoot, 'language', 'services', 'codeActions', 'LanguageCodeActionService.ts'),
            'utf8'
        );

        expect(codeActionServiceSource).not.toContain('private createRemoveVariableAction(');
        expect(codeActionServiceSource).not.toContain('private createCommentVariableAction(');
        expect(codeActionServiceSource).not.toContain('private createMakeGlobalAction(');
        expect(codeActionServiceSource).not.toContain('private createRenameVariableCaseAction(');
        expect(codeActionServiceSource).not.toContain('private createMoveVariableToBlockStartAction(');
        expect(codeActionServiceSource).not.toContain('private createMoveVariableToFunctionStartAction(');
        expect(codeActionServiceSource).not.toContain('private createWorkspaceEdit(');
        expect(codeActionServiceSource).not.toContain('private createLineRange(');
        expect(codeActionServiceSource).not.toContain('private createLineRangeIncludingBreak(');
        expect(codeActionServiceSource).not.toContain('private toSnakeCase(');
        expect(codeActionServiceSource).not.toContain('private toCamelCase(');
        expect(codeActionServiceSource).not.toContain('private findBlockStart(');
        expect(codeActionServiceSource).not.toContain('private findFunctionStart(');
    });

    test('FormattingService keeps generic text mechanics in formatter text support', () => {
        const formattingServiceSource = fs.readFileSync(
            path.join(srcRoot, 'formatter', 'FormattingService.ts'),
            'utf8'
        );

        expect(formattingServiceSource).not.toContain('private createSyntheticDocument(');
        expect(formattingServiceSource).not.toContain('private prepareSnippetRange(');
        expect(formattingServiceSource).not.toContain('private reindentRangeReplacement(');
        expect(formattingServiceSource).not.toContain('private detectLineEnding(');
        expect(formattingServiceSource).toContain("from './text/formatTextSupport'");
    });

    test('default diagnostics do not instantiate the legacy regex variable analyzer', () => {
        const productionFiles = listProductionTypeScriptFiles(srcRoot);
        const regexAnalyzerImports = productionFiles
            .filter((filePath) => fs.readFileSync(filePath, 'utf8').includes('diagnostics/analyzers/VariableAnalyzer'))
            .map((filePath) => path.relative(repoRoot, filePath).replace(/\\/g, '/'))
            .sort();

        expect(regexAnalyzerImports).toEqual([]);
        expect(fs.existsSync(path.join(srcRoot, 'diagnostics', 'analyzers', 'VariableAnalyzer.ts'))).toBe(false);
    });
});

function listProductionTypeScriptFiles(rootDir: string): string[] {
    const files: string[] = [];

    for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
        const fullPath = path.join(rootDir, entry.name);

        if (entry.isDirectory()) {
            if (entry.name === '__tests__' || entry.name === 'antlr') {
                continue;
            }

            files.push(...listProductionTypeScriptFiles(fullPath));
            continue;
        }

        if (!entry.name.endsWith('.ts')) {
            continue;
        }

        if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.spec.ts')) {
            continue;
        }

        files.push(fullPath);
    }

    return files;
}
