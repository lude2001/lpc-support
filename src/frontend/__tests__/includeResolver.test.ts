import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
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

    test('resolves LPC mudlib-absolute quoted includes from an ancestor root', () => {
        const roomDir = path.join(tempRoot, 'd', 'city');
        const helperDir = path.join(tempRoot, 'adm', 'simul_efun');
        fs.mkdirSync(roomDir, { recursive: true });
        fs.mkdirSync(helperDir, { recursive: true });
        fs.writeFileSync(path.join(helperDir, 'text_literal.h'), '#define TEXT_LITERAL 1');

        const text = '#include "/adm/simul_efun/text_literal.h"';
        const documentUri = vscode.Uri.file(path.join(roomDir, 'message.c')).toString();
        const snapshot = new PreprocessorScanner().scan(documentUri, 1, text);

        const resolved = new IncludeResolver().resolve(documentUri, snapshot.includeReferences);

        expect(resolved.includeReferences).toEqual([
            expect.objectContaining({
                value: '/adm/simul_efun/text_literal.h',
                resolvedUri: vscode.Uri.file(path.join(helperDir, 'text_literal.h')).toString()
            })
        ]);
        expect(resolved.diagnostics).toEqual([]);
    });

    test('resolves LPC system includes from an ancestor mudlib include directory', () => {
        const itemDir = path.join(tempRoot, 'inherit', 'item');
        const includeDir = path.join(tempRoot, 'include');
        fs.mkdirSync(itemDir, { recursive: true });
        fs.mkdirSync(includeDir, { recursive: true });
        fs.writeFileSync(path.join(includeDir, 'dbase.h'), '#define F_DBASE "/inherit/dbase"');

        const text = '#include <dbase.h>';
        const documentUri = vscode.Uri.file(path.join(itemDir, 'combined.c')).toString();
        const snapshot = new PreprocessorScanner().scan(documentUri, 1, text);

        const resolved = new IncludeResolver().resolve(documentUri, snapshot.includeReferences);

        expect(resolved.includeReferences).toEqual([
            expect.objectContaining({
                value: 'dbase.h',
                resolvedUri: vscode.Uri.file(path.join(includeDir, 'dbase.h')).toString()
            })
        ]);
        expect(resolved.diagnostics).toEqual([]);
    });
});
