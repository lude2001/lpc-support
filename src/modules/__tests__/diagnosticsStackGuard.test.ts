import * as fs from 'fs';
import * as path from 'path';

describe('diagnostics stack production guards', () => {
    const repoRoot = path.resolve(__dirname, '..', '..', '..');
    const extensionPath = path.join(repoRoot, 'src', 'extension.ts');
    const diagnosticsModulePath = path.join(repoRoot, 'src', 'modules', 'diagnosticsModule.ts');
    const runtimePath = path.join(repoRoot, 'src', 'lsp', 'server', 'runtime', 'createProductionLanguageServices.ts');

    test('extension registers diagnostics through the module, and module/runtime both rely on the shared stack factory', () => {
        const extensionSource = fs.readFileSync(extensionPath, 'utf8');
        const diagnosticsModuleSource = fs.readFileSync(diagnosticsModulePath, 'utf8');
        const runtimeSource = fs.readFileSync(runtimePath, 'utf8');

        expect(extensionSource).toContain("import { registerDiagnostics } from './modules/diagnosticsModule';");
        expect(extensionSource).toContain('registerDiagnostics(registry, context);');

        expect(diagnosticsModuleSource).toContain('createDiagnosticsStack');
        expect(diagnosticsModuleSource).not.toContain('createDefaultDiagnosticsCollectors');
        expect(diagnosticsModuleSource).not.toContain('createSharedDiagnosticsService');

        expect(runtimeSource).toContain('createDiagnosticsStack');
        expect(runtimeSource).not.toContain('createDefaultDiagnosticsCollectors');
        expect(runtimeSource).not.toContain('createSharedDiagnosticsService');
    });

    test('production sources do not import src/diagnostics/index.ts', () => {
        const srcRoot = path.join(repoRoot, 'src');
        const productionFiles = listProductionTypeScriptFiles(srcRoot);

        for (const filePath of productionFiles) {
            const source = fs.readFileSync(filePath, 'utf8');
            expect(source).not.toMatch(/from\s+['"][^'"]*diagnostics\/index['"]/);
            expect(source).not.toMatch(/from\s+['"][^'"]*diagnostics\\index['"]/);
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
