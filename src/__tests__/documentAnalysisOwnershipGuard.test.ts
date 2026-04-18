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

        const singletonCallSites = listProductionTypeScriptFiles(srcRoot)
            .filter((filePath) => fs.readFileSync(filePath, 'utf8').includes('DocumentSemanticSnapshotService.getInstance('))
            .map((filePath) => path.relative(repoRoot, filePath).replace(/\\/g, '/'))
            .sort();

        expect(singletonCallSites).toEqual([
            'src/ast/astManager.ts'
        ]);
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
