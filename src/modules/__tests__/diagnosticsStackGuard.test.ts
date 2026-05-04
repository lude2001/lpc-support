import { describe, expect, test } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

describe('diagnostics stack production guards', () => {
    const repoRoot = path.resolve(__dirname, '..', '..', '..');
    const extensionPath = path.join(repoRoot, 'src', 'extension.ts');
    const diagnosticsEntryPath = path.join(repoRoot, 'src', 'diagnostics.ts');
    const legacyDiagnosticsBarrelPath = path.join(repoRoot, 'src', 'diagnostics', 'index.ts');
    const diagnosticsModulePath = path.join(repoRoot, 'src', 'modules', 'diagnosticsModule.ts');
    const runtimePath = path.join(repoRoot, 'src', 'lsp', 'server', 'runtime', 'createProductionLanguageServices.ts');
    const orchestratorPath = path.join(repoRoot, 'src', 'diagnostics', 'DiagnosticsOrchestrator.ts');

    test('extension registers diagnostics through the module, and production diagnostics assembly uses the single shared entrypoint', () => {
        const extensionSource = fs.readFileSync(extensionPath, 'utf8');
        const diagnosticsEntrySource = fs.readFileSync(diagnosticsEntryPath, 'utf8');
        const diagnosticsModuleSource = fs.readFileSync(diagnosticsModulePath, 'utf8');
        const runtimeSource = fs.readFileSync(runtimePath, 'utf8');

        expect(extensionSource).toContain("import { registerDiagnostics } from './modules/diagnosticsModule';");
        expect(extensionSource).toContain('registerDiagnostics(registry, context);');

        expect(diagnosticsEntrySource).toContain('createDiagnosticsStack');
        expect(diagnosticsEntrySource).not.toContain('createDefaultDiagnosticsCollectors');

        expect(diagnosticsModuleSource).toContain("from '../diagnostics';");
        expect(diagnosticsModuleSource).toContain('createDiagnosticsStack');
        expect(diagnosticsModuleSource).not.toContain('createDefaultDiagnosticsCollectors');
        expect(diagnosticsModuleSource).not.toContain('createSharedDiagnosticsService');
        expect(diagnosticsModuleSource).not.toContain("../diagnostics/createDiagnosticsStack");

        expect(runtimeSource).toContain("from '../../../diagnostics';");
        expect(runtimeSource).toContain('createDiagnosticsStack');
        expect(runtimeSource).not.toContain('createDefaultDiagnosticsCollectors');
        expect(runtimeSource).not.toContain('createSharedDiagnosticsService');
        expect(runtimeSource).not.toContain("../../../diagnostics/createDiagnosticsStack");
    });

    test('legacy diagnostics barrel is gone and production sources no longer bypass the diagnostics entrypoint', () => {
        const srcRoot = path.join(repoRoot, 'src');
        const productionFiles = listProductionTypeScriptFiles(srcRoot);

        expect(fs.existsSync(legacyDiagnosticsBarrelPath)).toBe(false);

        for (const filePath of productionFiles) {
            if (filePath === diagnosticsEntryPath) {
                continue;
            }

            const source = fs.readFileSync(filePath, 'utf8');
            expect(source).not.toMatch(/from\s+['"][^'"]*diagnostics\/index['"]/);
            expect(source).not.toMatch(/from\s+['"][^'"]*diagnostics\\index['"]/);
            expect(source).not.toMatch(/from\s+['"][^'"]*diagnostics\/createDiagnosticsStack['"]/);
            expect(source).not.toMatch(/from\s+['"][^'"]*diagnostics\\createDiagnosticsStack['"]/);
        }
    });

    test('diagnostics orchestrator no longer contains host lifecycle wiring or fallback stack builders', () => {
        const orchestratorSource = fs.readFileSync(orchestratorPath, 'utf8');

        expect(orchestratorSource).not.toContain('registerDocumentLifecycle');
        expect(orchestratorSource).not.toContain('initializeCollectors(');
        expect(orchestratorSource).not.toContain('createDiagnosticsService(');
        expect(orchestratorSource).not.toContain('onDidChangeTextDocument(');
        expect(orchestratorSource).not.toContain('onDidCloseTextDocument(');
        expect(orchestratorSource).not.toContain('onDidDeleteFiles(');
        expect(orchestratorSource).not.toContain('clearDocumentAnalysisState(');
        expect(orchestratorSource).not.toContain("from '../language/services/diagnostics/createSharedDiagnosticsService'");
    });

    test('production diagnostic collectors consume syntax and semantic facts instead of ANTLR contexts', () => {
        const collectorRoot = path.join(repoRoot, 'src', 'collectors');
        const productionCollectorFiles = listProductionTypeScriptFiles(collectorRoot);

        for (const filePath of productionCollectorFiles) {
            const source = fs.readFileSync(filePath, 'utf8');
            expect(source).not.toMatch(/from\s+['"][^'"]*antlr\//);
            expect(source).not.toMatch(/from\s+['"][^'"]*antlr\\/);
        }
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
