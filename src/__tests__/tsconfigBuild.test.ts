import * as path from 'path';
import * as ts from 'typescript';

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

describe('build tsconfig', () => {
    test('excludes Jest tests and shared test mocks from the build program', () => {
        const parsed = loadBuildConfig();
        const normalizedFiles = parsed.fileNames.map((fileName) => path.normalize(fileName));

        expect(normalizedFiles).not.toContain(path.normalize(path.resolve(__dirname, 'rangeFormatting.test.ts')));
        expect(normalizedFiles).not.toContain(path.normalize(path.resolve(__dirname, '../../tests/mocks/MockVSCode.ts')));
    });
});
