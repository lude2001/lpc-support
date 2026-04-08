import * as path from 'path';
import * as ts from 'typescript';
import { describe, expect, test } from '@jest/globals';

function loadBuildConfig() {
    const projectPath = path.resolve(__dirname, '../../tsconfig.json');
    const configFile = ts.readConfigFile(projectPath, ts.sys.readFile);
    if (configFile.error) {
        throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n'));
    }

    return ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        path.dirname(projectPath)
    );
}

function getSrcTestFiles(): string[] {
    const srcRoot = path.resolve(__dirname, '..');

    return ts.sys.readDirectory(srcRoot, ['.ts'], undefined, ['**/*.test.ts']);
}

function usesJestGlobals(content: string): boolean {
    return /\b(jest|describe|test|expect|beforeEach|afterEach|beforeAll|afterAll)\b/.test(content);
}

function importsJestGlobals(content: string): boolean {
    return /from ['"]@jest\/globals['"]/.test(content);
}

describe('build tsconfig', () => {
    test('excludes Jest tests and shared test mocks from the build program', () => {
        const parsed = loadBuildConfig();
        const normalizedFiles = parsed.fileNames.map((fileName) => path.normalize(fileName));

        expect(normalizedFiles).not.toContain(path.normalize(path.resolve(__dirname, 'rangeFormatting.test.ts')));
        expect(normalizedFiles).not.toContain(path.normalize(path.resolve(__dirname, '../../tests/mocks/MockVSCode.ts')));
    });

    test('src Jest test files import @jest/globals explicitly', () => {
        const missingImports = getSrcTestFiles().filter((filePath) => {
            const content = ts.sys.readFile(filePath) ?? '';
            return usesJestGlobals(content) && !importsJestGlobals(content);
        });

        expect(missingImports).toEqual([]);
    });
});
