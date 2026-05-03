import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { IncludeResolver } from '../IncludeResolver';
import { PreprocessorScanner } from '../PreprocessorScanner';

describe('IncludeResolver', () => {
    let tempRoot: string;

    beforeEach(() => {
        tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-include-resolver-'));
    });

    afterEach(() => {
        fs.rmSync(tempRoot, { recursive: true, force: true });
    });

    test('resolves quoted includes relative to the current document and system includes from include directories', () => {
        const sourceDir = path.join(tempRoot, 'src');
        const includeDir = path.join(tempRoot, 'include');
        fs.mkdirSync(sourceDir, { recursive: true });
        fs.mkdirSync(includeDir, { recursive: true });
        fs.writeFileSync(path.join(sourceDir, 'local.h'), '#define LOCAL 1');
        fs.writeFileSync(path.join(includeDir, 'globals.h'), '#define GLOBAL 1');

        const text = [
            '#include "local.h"',
            '#include <globals.h>'
        ].join('\n');
        const documentUri = vscode.Uri.file(path.join(sourceDir, 'main.c')).toString();
        const snapshot = new PreprocessorScanner().scan(documentUri, 1, text);

        const resolved = new IncludeResolver([includeDir]).resolve(documentUri, snapshot.includeReferences);

        expect(resolved.includeReferences).toEqual([
            expect.objectContaining({
                value: 'local.h',
                resolvedUri: vscode.Uri.file(path.join(sourceDir, 'local.h')).toString()
            }),
            expect.objectContaining({
                value: 'globals.h',
                resolvedUri: vscode.Uri.file(path.join(includeDir, 'globals.h')).toString()
            })
        ]);
        expect(resolved.includeGraph.edges).toEqual([
            expect.objectContaining({
                fromUri: documentUri,
                includeValue: 'local.h',
                toUri: vscode.Uri.file(path.join(sourceDir, 'local.h')).toString()
            }),
            expect.objectContaining({
                fromUri: documentUri,
                includeValue: 'globals.h',
                toUri: vscode.Uri.file(path.join(includeDir, 'globals.h')).toString()
            })
        ]);
        expect(resolved.diagnostics).toEqual([]);
    });
});
