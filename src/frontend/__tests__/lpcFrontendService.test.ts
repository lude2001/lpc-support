import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { LpcFrontendService } from '../LpcFrontendService';
import { TestHelper } from '../../__tests__/utils/TestHelper';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { attachDocumentWorkspaceProjectConfig } from '../../language/shared/documentWorkspaceConfig';

describe('LpcFrontendService', () => {
    let tempRoot: string | undefined;

    afterEach(() => {
        if (tempRoot) {
            fs.rmSync(tempRoot, { recursive: true, force: true });
            tempRoot = undefined;
        }
    });

    test('creates a snapshot with directives, macros, inactive ranges, and active source', () => {
        const document = TestHelper.createMockDocument([
            '#define PATH "/std/object"',
            '#ifdef ENABLED',
            'int broken = ;',
            '#endif',
            'inherit PATH;'
        ].join('\n'));

        const snapshot = new LpcFrontendService().get(document);

        expect(snapshot.uri).toBe(document.uri.toString());
        expect(snapshot.preprocessor.macros).toEqual([
            expect.objectContaining({ name: 'PATH', replacement: '"/std/object"' })
        ]);
        expect(snapshot.preprocessor.inactiveRanges).toEqual([
            expect.objectContaining({
                range: expect.objectContaining({
                    start: expect.objectContaining({ line: 2, character: 0 })
                })
            })
        ]);
        expect(snapshot.preprocessor.activeView.text).toContain('inherit "/std/object";');
        expect(snapshot.dialect.name).toBe('FluffOS');
    });

    test('returns cached snapshots for unchanged document versions', () => {
        const document = TestHelper.createMockDocument('#define FOO 1\nvoid create() {}');
        const service = new LpcFrontendService();

        const first = service.get(document);
        const second = service.get(document);

        expect(second).toBe(first);
    });

    test('imports include macros into conditional evaluation and macro expansion', () => {
        tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-frontend-include-'));
        const includeDir = path.join(tempRoot, 'include');
        fs.mkdirSync(includeDir, { recursive: true });
        fs.writeFileSync(path.join(includeDir, 'defs.h'), [
            '#define ENABLED 1',
            '#define Declare(name) int name##_value;'
        ].join('\n'));
        const document = TestHelper.createMockDocument([
            '#include <defs.h>',
            '#ifdef ENABLED',
            'Declare(score)',
            '#else',
            'int broken = ;',
            '#endif'
        ].join('\n'), 'lpc', path.join(tempRoot, 'main.c'));

        const snapshot = new LpcFrontendService({ includeDirectories: [includeDir] }).get(document);

        expect(snapshot.preprocessor.inactiveRanges).toEqual([
            expect.objectContaining({
                range: expect.objectContaining({
                    start: expect.objectContaining({ line: 4, character: 0 })
                })
            })
        ]);
        expect(snapshot.preprocessor.macros.map((macro) => macro.name)).toEqual(
            expect.arrayContaining(['ENABLED', 'Declare'])
        );
        expect(snapshot.preprocessor.activeView.text).toContain('int score_value;');
    });

    test('does not treat include directories as implicit global macro sources', () => {
        tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-frontend-include-'));
        const includeDir = path.join(tempRoot, 'include');
        fs.mkdirSync(includeDir, { recursive: true });
        fs.writeFileSync(path.join(includeDir, 'defs.h'), '#define ENABLED 1\n');
        const document = TestHelper.createMockDocument([
            '#ifdef ENABLED',
            'int should_not_be_active;',
            '#endif'
        ].join('\n'), 'lpc', path.join(tempRoot, 'main.c'));

        const snapshot = new LpcFrontendService({ includeDirectories: [includeDir] }).get(document);

        expect(snapshot.preprocessor.macros.map((macro) => macro.name)).not.toContain('ENABLED');
        expect(snapshot.preprocessor.inactiveRanges).toEqual([
            expect.objectContaining({
                range: expect.objectContaining({
                    start: expect.objectContaining({ line: 1, character: 0 })
                })
            })
        ]);
        expect(snapshot.preprocessor.activeView.text).not.toContain('should_not_be_active');
    });

    test('uses project config include directories only as explicit include search paths', () => {
        tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-frontend-project-include-'));
        const includeDir = path.join(tempRoot, 'include');
        fs.mkdirSync(includeDir, { recursive: true });
        fs.writeFileSync(path.join(tempRoot, 'lpc-support.json'), JSON.stringify({
            version: 1,
            configHellPath: 'config.hell'
        }), 'utf8');
        fs.writeFileSync(path.join(tempRoot, 'config.hell'), [
            'mudlib directory : ./',
            'include directories : /include'
        ].join('\n'), 'utf8');
        fs.writeFileSync(path.join(includeDir, 'defs.h'), '#define ENABLED 1\n', 'utf8');
        const document = TestHelper.createMockDocument([
            '#include <defs.h>',
            '#ifdef ENABLED',
            'int included_macro_is_active;',
            '#endif'
        ].join('\n'), 'lpc', path.join(tempRoot, 'main.c'));

        const snapshot = new LpcFrontendService().get(document);

        expect(snapshot.preprocessor.includeReferences[0].resolvedUri).toBe(vscode.Uri.file(path.join(includeDir, 'defs.h')).toString());
        expect(snapshot.preprocessor.macros.map((macro) => macro.name)).toContain('ENABLED');
        expect(snapshot.preprocessor.activeView.text).toContain('included_macro_is_active');
    });

    test('imports global include macros from project config as implicit driver macros', () => {
        tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-frontend-global-include-'));
        const includeDir = path.join(tempRoot, 'include');
        fs.mkdirSync(includeDir, { recursive: true });
        fs.writeFileSync(path.join(tempRoot, 'lpc-support.json'), JSON.stringify({
            version: 1,
            configHellPath: 'config.hell'
        }), 'utf8');
        fs.writeFileSync(path.join(tempRoot, 'config.hell'), [
            'mudlib directory : ./',
            'include directories : /include',
            'global include file : <globals.h>'
        ].join('\n'), 'utf8');
        fs.writeFileSync(path.join(includeDir, 'globals.h'), [
            '#include "ansi.h"',
            '#define PROTOCOL_D "/adm/protocol/protocol_server"'
        ].join('\n'), 'utf8');
        fs.writeFileSync(path.join(includeDir, 'ansi.h'), '#define NOR "$txt:reset#"\n', 'utf8');
        const document = TestHelper.createMockDocument(
            'string reset = NOR;\nobject protocol = PROTOCOL_D;\n',
            'lpc',
            path.join(tempRoot, 'main.c')
        );

        const snapshot = new LpcFrontendService().get(document);

        expect(snapshot.preprocessor.includeReferences).toEqual([]);
        expect(snapshot.preprocessor.macros).toEqual(expect.arrayContaining([
            expect.objectContaining({
                name: 'PROTOCOL_D',
                replacement: '"/adm/protocol/protocol_server"',
                sourceUri: vscode.Uri.file(path.join(includeDir, 'globals.h')).toString()
            })
        ]));
        expect(snapshot.preprocessor.macros).toEqual(expect.arrayContaining([
            expect.objectContaining({
                name: 'NOR',
                replacement: '"$txt:reset#"',
                sourceUri: vscode.Uri.file(path.join(includeDir, 'ansi.h')).toString()
            })
        ]));
        expect(snapshot.preprocessor.activeView.text).toContain('string reset = "$txt:reset#";');
        expect(snapshot.preprocessor.activeView.text).toContain('object protocol = "/adm/protocol/protocol_server";');
    });

    test('prefers attached workspace config for global include macros in LSP documents', () => {
        tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-frontend-attached-global-include-'));
        const includeDir = path.join(tempRoot, 'include');
        fs.mkdirSync(includeDir, { recursive: true });
        fs.writeFileSync(path.join(tempRoot, 'lpc-support.json'), JSON.stringify({
            version: 1,
            configHellPath: 'stale.hell'
        }), 'utf8');
        fs.writeFileSync(path.join(tempRoot, 'stale.hell'), [
            'mudlib directory : ./',
            'include directories : /include'
        ].join('\n'), 'utf8');
        fs.writeFileSync(path.join(includeDir, 'globals.h'), '#define PROTOCOL_D "/adm/protocol/protocol_server"\n', 'utf8');
        const document = attachDocumentWorkspaceProjectConfig(
            TestHelper.createMockDocument(
                'object protocol = PROTOCOL_D;\n',
                'lpc',
                path.join(tempRoot, 'main.c')
            ),
            {
                projectConfigPath: path.join(tempRoot, 'lpc-support.json'),
                configHellPath: 'config/config.dev',
                resolvedConfig: {
                    mudlibDirectory: './',
                    includeDirectories: ['/include'],
                    globalIncludeFile: '<globals.h>'
                }
            }
        );

        const snapshot = new LpcFrontendService().get(document);

        expect(snapshot.preprocessor.macros.map((macro) => macro.name)).toContain('PROTOCOL_D');
        expect(snapshot.preprocessor.activeView.text).toContain('object protocol = "/adm/protocol/protocol_server";');
    });
});
