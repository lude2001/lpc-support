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

    test('legacy completion shim no longer exposes singleton access, and singleton call sites stay on the explicit whitelist', () => {
        const legacySource = fs.readFileSync(legacyServicePath, 'utf8');

        expect(legacySource).not.toContain('getInstance(');

        const snapshotSingletonCallSites = listProductionTypeScriptFiles(srcRoot)
            .filter((filePath) => fs.readFileSync(filePath, 'utf8').includes('DocumentSemanticSnapshotService.getInstance('))
            .map((filePath) => path.relative(repoRoot, filePath).replace(/\\/g, '/'))
            .sort();

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
        expect(astConfigureCallSites).toEqual([
            'src/lsp/server/runtime/createProductionLanguageServices.ts',
            'src/modules/coreModule.ts'
        ]);
        expect(astSingletonCallSites).toEqual([]);
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
        const compatMaterializerSource = fs.readFileSync(
            path.join(srcRoot, 'efun', 'FunctionDocCompatMaterializer.ts'),
            'utf8'
        );

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

        expect(lookupBuilderSource).toContain('parseInheritStatements(');
        expect(lookupBuilderSource).toContain('loadInheritedFileDocs(');
        expect(lookupBuilderSource).toContain('loadIncludeFileDocs(');
        expect(lookupBuilderSource).toContain('getIncludeFiles(');
        expect(compatMaterializerSource).toContain('materializeLookup(');
        expect(compatMaterializerSource).toContain('materializeCompatDoc(');
    });

    test('direct workspace document opens remain only on the shared owner and example file', () => {
        const directOpenCallSites = listProductionTypeScriptFiles(srcRoot)
            .filter((filePath) => fs.readFileSync(filePath, 'utf8').includes('vscode.workspace.openTextDocument('))
            .map((filePath) => path.relative(repoRoot, filePath).replace(/\\/g, '/'))
            .sort();

        expect(directOpenCallSites).toEqual([
            'src/language/shared/WorkspaceDocumentPathSupport.ts',
            'src/utils/pathResolver.example.ts'
        ]);
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
