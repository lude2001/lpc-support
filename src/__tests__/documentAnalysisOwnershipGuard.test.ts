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

        const astSingletonCallSites = listProductionTypeScriptFiles(srcRoot)
            .filter((filePath) => fs.readFileSync(filePath, 'utf8').includes('ASTManager.getInstance('))
            .map((filePath) => path.relative(repoRoot, filePath).replace(/\\/g, '/'))
            .sort();

        expect(snapshotSingletonCallSites).toEqual([
            'src/ast/astManager.ts',
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
