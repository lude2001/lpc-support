import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { beforeEach, afterEach, describe, expect, jest, test } from '@jest/globals';
import { ASTManager } from '../../ast/astManager';
import { DocumentSemanticSnapshotService } from '../../semantic/documentSemanticSnapshotService';
import { configureScopedMethodIdentifierAnalysisService } from '../../language/services/navigation/ScopedMethodIdentifierSupport';

declare const require: any;

const { ScopedMethodResolver } = require('../ScopedMethodResolver');

function createDocument(fileName: string, content: string, version = 1): vscode.TextDocument {
    const normalized = content.replace(/\r\n/g, '\n');
    const lineStarts = [0];

    for (let index = 0; index < normalized.length; index += 1) {
        if (normalized[index] === '\n') {
            lineStarts.push(index + 1);
        }
    }

    const offsetAt = (position: vscode.Position): number => {
        const lineStart = lineStarts[position.line] ?? normalized.length;
        return Math.min(lineStart + position.character, normalized.length);
    };

    const positionAt = (offset: number): vscode.Position => {
        let line = 0;
        for (let index = 0; index < lineStarts.length; index += 1) {
            if (lineStarts[index] <= offset) {
                line = index;
            } else {
                break;
            }
        }

        return new vscode.Position(line, offset - lineStarts[line]);
    };

    return {
        uri: vscode.Uri.file(fileName),
        fileName,
        languageId: 'lpc',
        version,
        lineCount: lineStarts.length,
        isDirty: false,
        isClosed: false,
        isUntitled: false,
        eol: vscode.EndOfLine.LF,
        getText: (range?: vscode.Range) => {
            if (!range) {
                return normalized;
            }

            return normalized.slice(offsetAt(range.start), offsetAt(range.end));
        },
        lineAt: (line: number) => ({
            text: normalized.split('\n')[line] ?? ''
        }),
        positionAt,
        offsetAt,
        save: async () => true,
        validateRange: (range: vscode.Range) => range,
        validatePosition: (position: vscode.Position) => position
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

describe('ScopedMethodResolver', () => {
    let fixtureRoot: string;
    let macroManager: { getMacro: jest.Mock };
    let previousWorkspaceFolders: readonly vscode.WorkspaceFolder[] | undefined;
    const analysisService = DocumentSemanticSnapshotService.getInstance();

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
        configureScopedMethodIdentifierAnalysisService(analysisService);
        previousWorkspaceFolders = vscode.workspace.workspaceFolders;
        fixtureRoot = path.join(process.cwd(), '.tmp-scoped-method-resolver');
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
        ASTManager.getInstance().clearAllCache();
        DocumentSemanticSnapshotService.getInstance().clear();
        configureScopedMethodIdentifierAnalysisService(undefined);
        (vscode.workspace as any).workspaceFolders = previousWorkspaceFolders;
        jest.restoreAllMocks();
        fs.rmSync(fixtureRoot, { recursive: true, force: true });
    });

    test('bare ::create() resolves first direct inherit implementation, not current file', async () => {
        writeFixture('/std/base_room.c', 'void create() {}\n');
        const source = [
            'inherit "/std/base_room";',
            '',
            'void create() {}',
            '',
            'void demo() {',
            '    ::create();',
            '}'
        ].join('\n');
        writeFixture('/d/city/room.c', source);
        const document = createDocument(fixturePath('/d/city/room.c'), source);

        const resolver = new ScopedMethodResolver(macroManager as any, [fixtureRoot], analysisService);
        const result = await resolver.resolveCallAt(document, positionAfter(source, '::create'));

        expect(result.status).toBe('resolved');
        expect(result.targets.map((target: { path: string }) => target.path)).toEqual([
            fixturePath('/std/base_room.c')
        ]);
    });

    test('bare ::init() never falls back to same-named current-file function', async () => {
        writeFixture('/std/base_room.c', 'void init() {}\n');
        const source = [
            'inherit "/std/base_room";',
            '',
            'void init() {}',
            '',
            'void demo() {',
            '    ::init();',
            '}'
        ].join('\n');
        writeFixture('/d/city/room.c', source);
        const document = createDocument(fixturePath('/d/city/room.c'), source);

        const resolver = new ScopedMethodResolver(macroManager as any, [fixtureRoot], analysisService);
        const result = await resolver.resolveCallAt(document, positionAfter(source, '::init'));

        expect(result.status).toBe('resolved');
        expect(result.targets[0].path).toBe(fixturePath('/std/base_room.c'));
    });

    test('bare ::query_name() ignores same-named include function', async () => {
        writeFixture('/std/base_room.c', 'string query_name() { return "base"; }\n');
        writeFixture('/include/helpers.h', 'string query_name() { return "header"; }\n');

        const source = [
            'inherit "/std/base_room";',
            'include "/include/helpers.h";',
            '',
            'void demo() {',
            '    ::query_name();',
            '}'
        ].join('\n');
        writeFixture('/d/city/room.c', source);
        const document = createDocument(fixturePath('/d/city/room.c'), source);

        const resolver = new ScopedMethodResolver(macroManager as any, [fixtureRoot], analysisService);
        const result = await resolver.resolveCallAt(document, positionAfter(source, '::query_name'));

        expect(result.status).toBe('resolved');
        expect(result.targets[0].path).toBe(fixturePath('/std/base_room.c'));
    });

    test('bare ::init() returns unknown when no inherit target implements it', async () => {
        writeFixture('/std/base_room.c', 'void reset() {}\n');

        const source = [
            'inherit "/std/base_room";',
            '',
            'void init() {}',
            '',
            'void demo() {',
            '    ::init();',
            '}'
        ].join('\n');
        writeFixture('/d/city/room.c', source);
        const document = createDocument(fixturePath('/d/city/room.c'), source);

        const resolver = new ScopedMethodResolver(macroManager as any, [fixtureRoot], analysisService);
        const result = await resolver.resolveCallAt(document, positionAfter(source, '::init'));

        expect(result.status).toBe('unknown');
        expect(result.targets).toEqual([]);
    });

    test('bare ::init() is unknown when a direct inherit is unresolved even if a resolved direct inherit implements it', async () => {
        writeFixture('/std/room.c', 'void init() {}\n');

        const source = [
            'inherit "/std/room";',
            'inherit MISSING_PARENT;',
            '',
            'void demo() {',
            '    ::init();',
            '}'
        ].join('\n');
        writeFixture('/d/city/unresolved_direct_scope.c', source);
        const document = createDocument(fixturePath('/d/city/unresolved_direct_scope.c'), source);

        const resolver = new ScopedMethodResolver(macroManager as any, [fixtureRoot], analysisService);
        const result = await resolver.resolveCallAt(document, positionAfter(source, '::init'));

        expect(result.status).toBe('unknown');
        expect(result.targets).toEqual([]);
    });

    test('room::init() resolves uniquely matched direct inherit branch', async () => {
        writeFixture('/std/room.c', 'void init() {}\n');
        writeFixture('/std/combat.c', 'void init() {}\n');

        const source = [
            'inherit "/std/room";',
            'inherit "/std/combat";',
            '',
            'void demo() {',
            '    room::init();',
            '}'
        ].join('\n');
        writeFixture('/d/city/mixed_room.c', source);
        const document = createDocument(fixturePath('/d/city/mixed_room.c'), source);

        const resolver = new ScopedMethodResolver(macroManager as any, [fixtureRoot], analysisService);
        const result = await resolver.resolveCallAt(document, positionAfter(source, 'room::init'));

        expect(result.status).toBe('resolved');
        expect(result.targets[0].path).toBe(fixturePath('/std/room.c'));
    });

    test('room::init() is unknown when qualifier does not uniquely match a direct inherit basename', async () => {
        writeFixture('/std/room.c', 'void init() {}\n');
        writeFixture('/domains/room.c', 'void init() {}\n');

        const source = [
            'inherit "/std/room";',
            'inherit "/domains/room";',
            '',
            'void demo() {',
            '    room::init();',
            '}'
        ].join('\n');
        writeFixture('/d/city/ambiguous_room.c', source);
        const document = createDocument(fixturePath('/d/city/ambiguous_room.c'), source);

        const resolver = new ScopedMethodResolver(macroManager as any, [fixtureRoot], analysisService);
        const result = await resolver.resolveCallAt(document, positionAfter(source, 'room::init'));

        expect(result.status).toBe('unknown');
        expect(result.targets).toEqual([]);
    });

    test('room::init() is unknown when a direct inherit is unresolved even if the resolved room branch matches and implements it', async () => {
        writeFixture('/std/room.c', 'void init() {}\n');

        const source = [
            'inherit "/std/room";',
            'inherit MISSING_PARENT;',
            '',
            'void demo() {',
            '    room::init();',
            '}'
        ].join('\n');
        writeFixture('/d/city/unresolved_named_scope.c', source);
        const document = createDocument(fixturePath('/d/city/unresolved_named_scope.c'), source);

        const resolver = new ScopedMethodResolver(macroManager as any, [fixtureRoot], analysisService);
        const result = await resolver.resolveCallAt(document, positionAfter(source, 'room::init'));

        expect(result.status).toBe('unknown');
        expect(result.targets).toEqual([]);
    });

    test('non-identifier left side of :: is unsupported', async () => {
        const source = [
            'void demo() {',
            '    factory()::init();',
            '}'
        ].join('\n');
        writeFixture('/d/city/bad_scope.c', source);
        const document = createDocument(fixturePath('/d/city/bad_scope.c'), source);

        const resolver = new ScopedMethodResolver(macroManager as any, [fixtureRoot], analysisService);
        const result = await resolver.resolveCallAt(document, positionAfter(source, '::init'));

        expect(result.status).toBe('unsupported');
        expect(result.targets).toEqual([]);
    });

    test('bare ::init() returns multiple when two direct inherit branches both implement the method', async () => {
        writeFixture('/std/room.c', 'void init() {}\n');
        writeFixture('/std/combat.c', 'void init() {}\n');

        const source = [
            'inherit "/std/room";',
            'inherit "/std/combat";',
            '',
            'void demo() {',
            '    ::init();',
            '}'
        ].join('\n');
        writeFixture('/d/city/multi_scope.c', source);
        const document = createDocument(fixturePath('/d/city/multi_scope.c'), source);

        const resolver = new ScopedMethodResolver(macroManager as any, [fixtureRoot], analysisService);
        const result = await resolver.resolveCallAt(document, positionAfter(source, '::init'));

        expect(result.status).toBe('multiple');
        expect(result.targets.map((target: { path: string }) => target.path)).toEqual([
            fixturePath('/std/room.c'),
            fixturePath('/std/combat.c')
        ]);
    });

    test('bare ::init() is unknown when a traversed parent has an unresolved direct inherit', async () => {
        writeFixture('/std/base_room.c', 'void init() {}\n');
        writeFixture('/std/room.c', [
            'inherit MISSING_PARENT;',
            'inherit "/std/base_room";'
        ].join('\n'));

        const source = [
            'inherit "/std/room";',
            '',
            'void demo() {',
            '    ::init();',
            '}'
        ].join('\n');
        writeFixture('/d/city/unresolved_nested_scope.c', source);
        const document = createDocument(fixturePath('/d/city/unresolved_nested_scope.c'), source);

        const resolver = new ScopedMethodResolver(macroManager as any, [fixtureRoot], analysisService);
        const result = await resolver.resolveCallAt(document, positionAfter(source, '::init'));

        expect(result.status).toBe('unknown');
        expect(result.targets).toEqual([]);
    });
});
