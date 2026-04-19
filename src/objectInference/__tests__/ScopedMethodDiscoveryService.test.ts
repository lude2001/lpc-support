import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { ASTManager } from '../../ast/astManager';
import { createVsCodeTextDocumentHost } from '../../language/shared/WorkspaceDocumentPathSupport';
import { DocumentSemanticSnapshotService } from '../../semantic/documentSemanticSnapshotService';
import {
    configureAstManagerSingletonForTests,
    resetAstManagerSingletonForTests
} from '../../__tests__/testAstManagerSingleton';

declare const require: any;

const { ScopedMethodDiscoveryService } = require('../ScopedMethodDiscoveryService');

function createDocument(fileName: string, content: string, version = 1): vscode.TextDocument {
    const lines = content.split(/\r?\n/);
    const lineStarts = [0];

    for (let index = 0; index < content.length; index += 1) {
        if (content[index] === '\n') {
            lineStarts.push(index + 1);
        }
    }

    const offsetAt = (position: vscode.Position): number => {
        const lineStart = lineStarts[position.line] ?? content.length;
        return Math.min(lineStart + position.character, content.length);
    };

    return {
        uri: vscode.Uri.file(fileName),
        fileName,
        languageId: 'lpc',
        version,
        lineCount: lines.length,
        getText: jest.fn((range?: vscode.Range) => {
            if (!range) {
                return content;
            }

            return content.slice(offsetAt(range.start), offsetAt(range.end));
        }),
        lineAt: jest.fn((lineOrPosition: number | vscode.Position) => {
            const line = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
            return { text: lines[line] ?? '' };
        }),
        positionAt: jest.fn((offset: number) => {
            let line = 0;
            for (let index = 0; index < lineStarts.length; index += 1) {
                if (lineStarts[index] <= offset) {
                    line = index;
                } else {
                    break;
                }
            }

            return new vscode.Position(line, offset - lineStarts[line]);
        }),
        offsetAt: jest.fn((position: vscode.Position) => offsetAt(position))
    } as unknown as vscode.TextDocument;
}

function positionAfter(source: string, marker: string): vscode.Position {
    const offset = source.indexOf(marker);
    if (offset < 0) {
        throw new Error(`Marker not found: ${marker}`);
    }

    const targetOffset = offset + marker.length;
    const prefix = source.slice(0, targetOffset);
    const lines = prefix.split('\n');
    return new vscode.Position(lines.length - 1, lines[lines.length - 1].length);
}

describe('ScopedMethodDiscoveryService', () => {
    let fixtureRoot: string;
    let macroManager: { getMacro: jest.Mock };
    let previousWorkspaceFolders: readonly vscode.WorkspaceFolder[] | undefined;
    const analysisService = DocumentSemanticSnapshotService.getInstance();
    const documentHost = createVsCodeTextDocumentHost();

    function fixturePath(relativePath: string): string {
        return path.join(fixtureRoot, relativePath.replace(/^[/\\]+/, ''));
    }

    function writeFixture(relativePath: string, content: string): string {
        const fullPath = fixturePath(relativePath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content, 'utf8');
        return fullPath;
    }

    beforeEach(() => {
        jest.clearAllMocks();
        configureAstManagerSingletonForTests(analysisService);
        previousWorkspaceFolders = vscode.workspace.workspaceFolders;
        fixtureRoot = path.join(process.cwd(), '.tmp-scoped-method-discovery');
        fs.rmSync(fixtureRoot, { recursive: true, force: true });
        fs.mkdirSync(path.join(fixtureRoot, 'std'), { recursive: true });
        fs.mkdirSync(path.join(fixtureRoot, 'domains'), { recursive: true });
        fs.mkdirSync(path.join(fixtureRoot, 'include'), { recursive: true });
        fs.mkdirSync(path.join(fixtureRoot, 'd', 'city'), { recursive: true });

        (vscode.workspace.openTextDocument as jest.Mock).mockImplementation(async (target: string | vscode.Uri) => {
            const filePath = typeof target === 'string' ? target : target.fsPath;
            const normalizedPath = filePath
                .replace(/^[/\\]+([A-Za-z]:[\\/])/, '$1')
                .replace(/\//g, path.sep);
            return createDocument(normalizedPath, fs.readFileSync(normalizedPath, 'utf8'));
        });

        (vscode.workspace.getWorkspaceFolder as jest.Mock).mockReturnValue({
            uri: { fsPath: fixtureRoot }
        });
        (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: fixtureRoot } }];

        macroManager = {
            getMacro: jest.fn()
        };
    });

    afterEach(() => {
        resetAstManagerSingletonForTests();
        (vscode.workspace as any).workspaceFolders = previousWorkspaceFolders;
        jest.restoreAllMocks();
        fs.rmSync(fixtureRoot, { recursive: true, force: true });
    });

    test('discovers visible methods for bare :: prefixes from direct inherit targets only', async () => {
        writeFixture('/std/base_room.c', [
            'void create() {}',
            'void reset() {}'
        ].join('\n'));

        const source = [
            'inherit "/std/base_room";',
            '',
            'void demo() {',
            '    ::cr',
            '}'
        ].join('\n');

        const document = createDocument(fixturePath('/d/city/room.c'), source);
        const service = new ScopedMethodDiscoveryService(macroManager as any, [fixtureRoot], analysisService, documentHost);

        const result = await service.discoverAt(document, positionAfter(source, '::cr'));

        expect(result.status).toBe('resolved');
        expect(result.methods.map((method: { name: string }) => method.name)).toEqual(['create']);
    });

    test('bare :: prefixes never leak current-file or include functions into scoped completion', async () => {
        writeFixture('/std/base_room.c', 'void create() {}\n');
        writeFixture('/include/helpers.h', 'void create_helper() {}\n');

        const source = [
            'inherit "/std/base_room";',
            'include "/include/helpers.h";',
            '',
            'void create_local() {}',
            '',
            'void demo() {',
            '    ::cr',
            '}'
        ].join('\n');

        const document = createDocument(fixturePath('/d/city/no_leak.c'), source);
        const service = new ScopedMethodDiscoveryService(macroManager as any, [fixtureRoot], analysisService, documentHost);

        const result = await service.discoverAt(document, positionAfter(source, '::cr'));

        expect(result.methods.map((method: { name: string }) => method.name)).toEqual(['create']);
    });

    test('discovers methods only from the uniquely matched named direct inherit branch', async () => {
        writeFixture('/std/room.c', 'void init() {}\nvoid create() {}\n');
        writeFixture('/std/combat.c', 'void init() {}\nvoid engage() {}\n');

        const source = [
            'inherit "/std/room";',
            'inherit "/std/combat";',
            '',
            'void demo() {',
            '    room::in',
            '}'
        ].join('\n');

        const document = createDocument(fixturePath('/d/city/mixed_room.c'), source);
        const service = new ScopedMethodDiscoveryService(macroManager as any, [fixtureRoot], analysisService, documentHost);

        const result = await service.discoverAt(document, positionAfter(source, 'room::in'));

        expect(result.status).toBe('resolved');
        expect(result.methods.map((method: { name: string }) => method.name)).toEqual(['init']);
    });

    test('named scoped discovery returns unknown when the qualifier is ambiguous', async () => {
        writeFixture('/std/room.c', 'void init() {}\n');
        writeFixture('/domains/room.c', 'void init() {}\n');

        const source = [
            'inherit "/std/room";',
            'inherit "/domains/room";',
            '',
            'void demo() {',
            '    room::in',
            '}'
        ].join('\n');

        const document = createDocument(fixturePath('/d/city/ambiguous.c'), source);
        const service = new ScopedMethodDiscoveryService(macroManager as any, [fixtureRoot], analysisService, documentHost);

        const result = await service.discoverAt(document, positionAfter(source, 'room::in'));

        expect(result.status).toBe('unknown');
        expect(result.methods).toEqual([]);
    });

    test('named scoped discovery returns unknown when any direct inherit remains unresolved', async () => {
        writeFixture('/std/room.c', 'void init() {}\n');

        const source = [
            'inherit "/std/room";',
            'inherit ROOM_BASE;',
            '',
            'void demo() {',
            '    room::in',
            '}'
        ].join('\n');

        const document = createDocument(fixturePath('/d/city/unresolved.c'), source);
        const service = new ScopedMethodDiscoveryService(macroManager as any, [fixtureRoot], analysisService, documentHost);

        const result = await service.discoverAt(document, positionAfter(source, 'room::in'));

        expect(result.status).toBe('unknown');
        expect(result.methods).toEqual([]);
    });

    test('bare scoped discovery returns unknown when a traversed parent branch has an unresolved direct inherit', async () => {
        writeFixture('/std/base_room.c', [
            'inherit "/std/room_parent";',
            'void create() {}'
        ].join('\n'));
        writeFixture('/std/room_parent.c', [
            'inherit ROOM_BASE;',
            'void create() {}'
        ].join('\n'));

        const source = [
            'inherit "/std/base_room";',
            '',
            'void demo() {',
            '    ::cr',
            '}'
        ].join('\n');

        const document = createDocument(fixturePath('/d/city/nested_unresolved.c'), source);
        const service = new ScopedMethodDiscoveryService(macroManager as any, [fixtureRoot], analysisService, documentHost);

        const result = await service.discoverAt(document, positionAfter(source, '::cr'));

        expect(result.status).toBe('unknown');
        expect(result.methods).toEqual([]);
    });

    test('non-identifier left sides stay unsupported for scoped completion discovery', async () => {
        const source = [
            'void demo() {',
            '    factory()::in;',
            '}'
        ].join('\n');

        const document = createDocument(fixturePath('/d/city/bad_scope.c'), source);
        const service = new ScopedMethodDiscoveryService(macroManager as any, [fixtureRoot], analysisService, documentHost);

        const result = await service.discoverAt(document, positionAfter(source, '::in'));

        expect(result.status).toBe('unsupported');
        expect(result.methods).toEqual([]);
    });
});
