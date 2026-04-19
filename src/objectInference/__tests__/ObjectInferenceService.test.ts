import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ASTManager } from '../../ast/astManager';
import { SymbolType } from '../../ast/symbolTable';
import { DocumentSemanticSnapshotService } from '../../semantic/documentSemanticSnapshotService';
import { ObjectInferenceService } from '../ObjectInferenceService';
import {
    configureAstManagerSingletonForTests,
    resetAstManagerSingletonForTests
} from '../../__tests__/testAstManagerSingleton';

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

describe('ObjectInferenceService', () => {
    let fixtureRoot: string;
    let service: ObjectInferenceService;
    let macroManager: { getMacro: jest.Mock };
    const analysisService = DocumentSemanticSnapshotService.getInstance();
    const createService = (playerObjectPathOrProjectConfig?: unknown) =>
        new ObjectInferenceService(macroManager as any, playerObjectPathOrProjectConfig as any, analysisService);

    beforeEach(() => {
        jest.clearAllMocks();
        configureAstManagerSingletonForTests(analysisService);
        fixtureRoot = path.join(process.cwd(), '.tmp-object-inference');
        fs.rmSync(fixtureRoot, { recursive: true, force: true });
        fs.mkdirSync(path.join(fixtureRoot, 'adm', 'daemons'), { recursive: true });
        fs.mkdirSync(path.join(fixtureRoot, 'adm', 'objects'), { recursive: true });
        fs.mkdirSync(path.join(fixtureRoot, 'std'), { recursive: true });
        fs.mkdirSync(path.join(fixtureRoot, 'room'), { recursive: true });
        fs.writeFileSync(path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c'), 'void start() {}\n', 'utf8');
        fs.writeFileSync(path.join(fixtureRoot, 'adm', 'daemons', 'left_d.c'), 'void start() {}\n', 'utf8');
        fs.writeFileSync(path.join(fixtureRoot, 'adm', 'daemons', 'right_d.c'), 'void start() {}\n', 'utf8');
        fs.writeFileSync(path.join(fixtureRoot, 'adm', 'daemons', 'deep_d.c'), 'void start() {}\n', 'utf8');
        fs.writeFileSync(path.join(fixtureRoot, 'adm', 'daemons', 'parent_d.c'), 'void start() {}\n', 'utf8');
        fs.writeFileSync(path.join(fixtureRoot, 'adm', 'daemons', 'local_d.c'), 'void start() {}\n', 'utf8');
        fs.writeFileSync(path.join(fixtureRoot, 'adm', 'daemons', 'macro_d.c'), 'void start() {}\n', 'utf8');
        fs.writeFileSync(path.join(fixtureRoot, 'adm', 'daemons', 'far_d.c'), 'void start() {}\n', 'utf8');
        fs.writeFileSync(path.join(fixtureRoot, 'adm', 'objects', 'player.c'), 'void query_name() {}\n', 'utf8');
        fs.writeFileSync(path.join(fixtureRoot, 'adm', 'objects', 'sword.c'), 'void query() {}\n', 'utf8');
        fs.writeFileSync(path.join(fixtureRoot, 'adm', 'objects', 'shield.c'), 'void query() {}\n', 'utf8');

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

        service = createService();
    });

    afterEach(() => {
        resetAstManagerSingletonForTests();
        jest.restoreAllMocks();
        fs.rmSync(fixtureRoot, { recursive: true, force: true });
    });

    test('this_object() resolves to current document path', async () => {
        const source = [
            'void demo() {',
            '    this_object()->query();',
            '}'
        ].join('\n');
        const fileName = path.join(fixtureRoot, 'room', 'demo.c');
        const document = createDocument(fileName, source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'query'));

        expect(result).toEqual({
            receiver: 'this_object()',
            memberName: 'query',
            inference: {
                status: 'resolved',
                candidates: [
                    {
                        path: fileName,
                        source: 'builtin-call'
                    }
                ]
            }
        });
    });

    test('this_player() resolves when playerObjectPath is configured', async () => {
        const playerService = createService('/adm/objects/player');
        const source = [
            'void demo() {',
            '    this_player()->query_name();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'player.c'), source);

        const result = await playerService.inferObjectAccess(document, positionAfter(source, 'query_name'));

        expect(result).toEqual({
            receiver: 'this_player()',
            memberName: 'query_name',
            inference: {
                status: 'resolved',
                candidates: [
                    {
                        path: path.join(fixtureRoot, 'adm', 'objects', 'player.c'),
                        source: 'builtin-call'
                    }
                ]
            }
        });
    });

    test('this_player() resolves playerObjectPath using the current document workspace', async () => {
        const secondFixtureRoot = path.join(process.cwd(), '.tmp-object-inference-second');
        fs.rmSync(secondFixtureRoot, { recursive: true, force: true });
        fs.mkdirSync(path.join(secondFixtureRoot, 'adm', 'objects'), { recursive: true });
        fs.mkdirSync(path.join(secondFixtureRoot, 'room'), { recursive: true });
        fs.writeFileSync(path.join(secondFixtureRoot, 'adm', 'objects', 'second_player.c'), 'void query_name() {}\n', 'utf8');

        (vscode.workspace.getWorkspaceFolder as jest.Mock).mockReturnValue({
            uri: { fsPath: secondFixtureRoot }
        });

        const projectConfigService = {
            loadForWorkspace: jest.fn(async (workspaceRoot: string) => ({
                version: 1 as const,
                configHellPath: 'config.hell',
                playerObjectPath: workspaceRoot === secondFixtureRoot
                    ? '/adm/objects/second_player'
                    : '/adm/objects/player'
            }))
        };

        const playerService = createService(projectConfigService);
        const source = [
            'void demo() {',
            '    this_player()->query_name();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(secondFixtureRoot, 'room', 'player.c'), source);

        const result = await playerService.inferObjectAccess(document, positionAfter(source, 'query_name'));

        expect(projectConfigService.loadForWorkspace).toHaveBeenCalledWith(secondFixtureRoot);
        expect(result?.inference).toEqual({
            status: 'resolved',
            candidates: [
                {
                    path: path.join(secondFixtureRoot, 'adm', 'objects', 'second_player.c'),
                    source: 'builtin-call'
                }
            ]
        });

        fs.rmSync(secondFixtureRoot, { recursive: true, force: true });
    });

    test('this_player() without playerObjectPath returns empty candidates', async () => {
        const source = [
            'void demo() {',
            '    this_player()->query_name();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'player-no-config.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'query_name'));

        expect(result?.inference).toEqual({
            status: 'unknown',
            candidates: []
        });
    });

    test('this_player with arguments does not resolve', async () => {
        const playerService = createService('/adm/objects/player');
        const source = [
            'void demo() {',
            '    this_player(1)->query_name();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'player-with-args.c'), source);

        const result = await playerService.inferObjectAccess(document, positionAfter(source, 'query_name'));

        expect(result?.inference).toEqual({
            status: 'unsupported',
            reason: 'unsupported-expression',
            candidates: []
        });
    });

    test('load_object("/adm/daemons/combat_d") resolves to fixture file', async () => {
        const source = [
            'void demo() {',
            '    load_object("/adm/daemons/combat_d")->start();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'load-object.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'start'));

        expect(result?.inference).toEqual({
            status: 'resolved',
            candidates: [
                {
                    path: path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c'),
                    source: 'builtin-call'
                }
            ]
        });
    });

    test('load_object(COMBAT_D) resolves when builtin argument is a macro', async () => {
        macroManager.getMacro.mockReturnValue({
            name: 'COMBAT_D',
            value: '/adm/daemons/combat_d',
            file: path.join(fixtureRoot, 'include', 'daemons.h'),
            line: 1
        });

        const source = [
            'void demo() {',
            '    load_object(COMBAT_D)->start();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'load-object-macro.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'start'));

        expect(result?.inference).toEqual({
            status: 'resolved',
            candidates: [
                {
                    path: path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c'),
                    source: 'builtin-call'
                }
            ]
        });
    });

    test('load_object preserves parenthesized literal and macro arguments', async () => {
        macroManager.getMacro.mockReturnValue({
            name: 'COMBAT_D',
            value: '/adm/daemons/combat_d',
            file: path.join(fixtureRoot, 'include', 'daemons.h'),
            line: 1
        });

        const source = [
            'void demo() {',
            '    load_object(("/adm/daemons/combat_d"))->start();',
            '    load_object((COMBAT_D))->start();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'load-object-parenthesized.c'), source);
        const expectedPath = path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c');

        const literalResult = await service.inferObjectAccess(
            document,
            positionAfter(source, 'load_object(("/adm/daemons/combat_d"))->start')
        );
        const macroResult = await service.inferObjectAccess(
            document,
            positionAfter(source, 'load_object((COMBAT_D))->start')
        );

        expect(literalResult?.inference).toEqual({
            status: 'resolved',
            candidates: [{ path: expectedPath, source: 'builtin-call' }]
        });
        expect(macroResult?.inference).toEqual({
            status: 'resolved',
            candidates: [{ path: expectedPath, source: 'builtin-call' }]
        });
    });

    test('load_object rejects numeric builtin arguments as unsupported', async () => {
        const source = [
            'void demo() {',
            '    load_object(123)->start();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'load-object-invalid-number.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'start'));

        expect(result?.inference).toEqual({
            status: 'unsupported',
            reason: 'unsupported-expression',
            candidates: []
        });
    });

    test('load_object rejects indexed builtin arguments as unsupported', async () => {
        const source = [
            'void demo() {',
            '    mixed *arr;',
            '    load_object(arr[0])->start();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'load-object-invalid-index.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'start'));

        expect(result?.inference).toEqual({
            status: 'unsupported',
            reason: 'unsupported-expression',
            candidates: []
        });
    });

    test('this_object with extra arguments does not resolve to current document path', async () => {
        const source = [
            'void demo() {',
            '    this_object(123)->query();',
            '}'
        ].join('\n');
        const fileName = path.join(fixtureRoot, 'room', 'this-object-invalid-arity.c');
        const document = createDocument(fileName, source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'query'));

        expect(result?.inference).toEqual({
            status: 'unsupported',
            reason: 'unsupported-expression',
            candidates: []
        });
    });

    test('load_object with extra arguments does not resolve', async () => {
        const source = [
            'void demo() {',
            '    load_object("/adm/daemons/combat_d", foo)->start();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'load-object-extra-args.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'start'));

        expect(result?.inference).toEqual({
            status: 'unsupported',
            reason: 'unsupported-expression',
            candidates: []
        });
    });

    test('non-builtin calls with unsupported-looking arguments stay unknown', async () => {
        const source = [
            'void demo() {',
            '    mixed *arr;',
            '    foo(arr[0])->bar();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'non-builtin-call-index-arg.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'bar'));

        expect(result?.inference).toEqual({
            status: 'unknown',
            candidates: []
        });
    });

    test('direct string literal receiver resolves to fixture file', async () => {
        const source = [
            'void demo() {',
            '    "/adm/daemons/combat_d"->start();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'string-literal.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'start'));

        expect(result?.inference).toEqual({
            status: 'resolved',
            candidates: [
                {
                    path: path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c'),
                    source: 'literal'
                }
            ]
        });
    });

    test('macro object path resolves when macro manager returns a path', async () => {
        macroManager.getMacro.mockReturnValue({
            name: 'COMBAT_D',
            value: '/adm/daemons/combat_d',
            file: path.join(fixtureRoot, 'include', 'daemons.h'),
            line: 1
        });

        const source = [
            'void demo() {',
            '    COMBAT_D->start();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'macro-object.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'start'));

        expect(result?.inference).toEqual({
            status: 'resolved',
            candidates: [
                {
                    path: path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c'),
                    source: 'macro'
                }
            ]
        });
    });

    test('uppercase local receivers stay on identifier flow instead of macro-only resolution', async () => {
        const source = [
            'void demo(object COMBAT_D) {',
            '    COMBAT_D->start();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'uppercase-local.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'start'));

        expect(result?.inference).toEqual({
            status: 'unknown',
            candidates: []
        });
        expect(macroManager.getMacro).not.toHaveBeenCalled();
    });

    test('dot member access does not produce object inference', async () => {
        const source = [
            'void demo() {',
            '    foo.bar();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'dot-member-access.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'bar'));

        expect(result).toBeUndefined();
    });

    test('scope member access does not produce object inference', async () => {
        const source = [
            'void demo() {',
            '    Foo::bar();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'scope-member-access.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'bar'));

        expect(result).toBeUndefined();
    });

    test('find_object() and clone_object() use the same path rule', async () => {
        const source = [
            'void demo() {',
            '    find_object("/adm/daemons/combat_d")->start();',
            '    clone_object("/adm/daemons/combat_d")->start();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'find-clone.c'), source);
        const expectedPath = path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c');

        const findResult = await service.inferObjectAccess(document, positionAfter(source, 'find_object("/adm/daemons/combat_d")->start'));
        const cloneResult = await service.inferObjectAccess(document, positionAfter(source, 'clone_object("/adm/daemons/combat_d")->start'));

        expect(findResult?.inference).toEqual({
            status: 'resolved',
            candidates: [{ path: expectedPath, source: 'builtin-call' }]
        });
        expect(cloneResult?.inference).toEqual({
            status: 'resolved',
            candidates: [{ path: expectedPath, source: 'builtin-call' }]
        });
    });

    test('unresolved path-like receivers remain unknown', async () => {
        macroManager.getMacro.mockReturnValue({
            name: 'MISSING_D',
            value: '/adm/daemons/missing_d',
            file: path.join(fixtureRoot, 'include', 'daemons.h'),
            line: 1
        });

        const source = [
            'void demo() {',
            '    "/adm/daemons/missing_d"->start();',
            '    MISSING_D->start();',
            '    load_object("/adm/daemons/missing_d")->start();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'missing-paths.c'), source);

        const literalResult = await service.inferObjectAccess(document, positionAfter(source, '"/adm/daemons/missing_d"->start'));
        const macroResult = await service.inferObjectAccess(document, positionAfter(source, 'MISSING_D->start'));
        const builtinResult = await service.inferObjectAccess(document, positionAfter(source, 'load_object("/adm/daemons/missing_d")->start'));

        expect(literalResult?.inference).toEqual({
            status: 'unknown',
            candidates: []
        });
        expect(macroResult?.inference).toEqual({
            status: 'unknown',
            candidates: []
        });
        expect(builtinResult?.inference).toEqual({
            status: 'unknown',
            candidates: []
        });
    });

    test('invalid literal receivers are unsupported instead of unknown', async () => {
        const source = [
            'void demo() {',
            '    123->query();',
            "    'x'->query();",
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'invalid-literal.c'), source);

        const integerResult = await service.inferObjectAccess(document, positionAfter(source, '123->query'));
        const charResult = await service.inferObjectAccess(document, positionAfter(source, "'x'->query"));

        expect(integerResult?.inference).toEqual({
            status: 'unsupported',
            reason: 'unsupported-expression',
            candidates: []
        });
        expect(charResult?.inference).toEqual({
            status: 'unsupported',
            reason: 'unsupported-expression',
            candidates: []
        });
    });

    test('arr[0]->query() stays conservatively unsupported with unsupported-expression reason', async () => {
        const source = [
            'void demo() {',
            '    mixed *arr;',
            '    arr[0]->query();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'array-element.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'query'));

        expect(result?.inference).toEqual({
            status: 'unsupported',
            reason: 'unsupported-expression',
            candidates: []
        });
    });

    test('numeric-key mapping subscript receiver is unsupported instead of array-element', async () => {
        const source = [
            'void demo() {',
            '    ([1: "/adm/daemons/combat_d"])[1]->query();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'numeric-mapping-subscript.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'query'));

        expect(result?.inference).toEqual({
            status: 'unsupported',
            reason: 'unsupported-expression',
            candidates: []
        });
    });

    test('mapping subscript receiver is unsupported instead of array-element', async () => {
        const source = [
            'void demo() {',
            '    (["combat": "/adm/daemons/combat_d"])["combat"]->query();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'mapping-subscript.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'query'));

        expect(result?.inference).toEqual({
            status: 'unsupported',
            reason: 'unsupported-expression',
            candidates: []
        });
    });

    test('local variable assigned from load_object resolves through identifier tracing', async () => {
        const source = [
            'void demo() {',
            '    object daemon = load_object("/adm/daemons/combat_d");',
            '    daemon->start();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'local-load-object.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'daemon->start'));

        expect(result?.inference).toEqual({
            status: 'resolved',
            candidates: [
                {
                    path: path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c'),
                    source: 'builtin-call'
                }
            ]
        });
    });

    test('if else assignment to the same variable yields multiple candidates', async () => {
        const source = [
            'void demo(int flag) {',
            '    object daemon;',
            '    if (flag) {',
            '        daemon = load_object("/adm/daemons/combat_d");',
            '    } else {',
            '        daemon = load_object("/adm/objects/sword");',
            '    }',
            '    daemon->query();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'if-else-assignment.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'daemon->query'));

        expect(result?.inference).toEqual({
            status: 'multiple',
            candidates: [
                {
                    path: path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c'),
                    source: 'builtin-call'
                },
                {
                    path: path.join(fixtureRoot, 'adm', 'objects', 'sword.c'),
                    source: 'builtin-call'
                }
            ]
        });
    });

    test('current-function tracing keeps straight-line overwrites but merges if else branches', async () => {
        const sequentialSource = [
            'void demo() {',
            '    object ob;',
            '    ob = load_object("/adm/objects/sword");',
            '    ob = load_object("/adm/objects/shield");',
            '    ob->query();',
            '}'
        ].join('\n');
        const sequentialDocument = createDocument(
            path.join(fixtureRoot, 'room', 'sequential-overwrite.c'),
            sequentialSource
        );

        const sequentialResult = await service.inferObjectAccess(
            sequentialDocument,
            positionAfter(sequentialSource, 'ob->query')
        );

        expect(sequentialResult?.inference).toEqual({
            status: 'resolved',
            candidates: [
                {
                    path: path.join(fixtureRoot, 'adm', 'objects', 'shield.c'),
                    source: 'builtin-call'
                }
            ]
        });

        const branchSource = [
            'void demo(int flag) {',
            '    object daemon;',
            '    if (flag) {',
            '        daemon = load_object("/adm/daemons/combat_d");',
            '    } else {',
            '        daemon = load_object("/adm/objects/sword");',
            '    }',
            '    daemon->query();',
            '}'
        ].join('\n');
        const branchDocument = createDocument(path.join(fixtureRoot, 'room', 'if-else-assignment-merge.c'), branchSource);

        const branchResult = await service.inferObjectAccess(
            branchDocument,
            positionAfter(branchSource, 'daemon->query')
        );

        expect(branchResult?.inference).toEqual({
            status: 'multiple',
            candidates: [
                {
                    path: path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c'),
                    source: 'builtin-call'
                },
                {
                    path: path.join(fixtureRoot, 'adm', 'objects', 'sword.c'),
                    source: 'builtin-call'
                }
            ]
        });
    });

    test('if without else keeps receiver unknown when the assignment is not guaranteed', async () => {
        const source = [
            'void demo(int flag) {',
            '    object ob;',
            '    if (flag) {',
            '        ob = load_object("/adm/objects/sword");',
            '    }',
            '    ob->query();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'if-without-else.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'ob->query'));

        expect(result?.inference).toEqual({
            status: 'unknown',
            candidates: []
        });
    });

    test('if else merge stays unknown when only one branch resolves', async () => {
        const source = [
            'void demo(int flag) {',
            '    object ob;',
            '    if (flag) {',
            '        ob = load_object("/adm/objects/sword");',
            '    } else {',
            '        object other;',
            '        ob = other;',
            '    }',
            '    ob->query();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'if-else-resolved-unknown.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'ob->query'));

        expect(result?.inference).toEqual({
            status: 'unknown',
            candidates: []
        });
    });

    test('if else merge stays unsupported when one branch is unsupported', async () => {
        const source = [
            'void demo(int flag) {',
            '    object ob;',
            '    if (flag) {',
            '        ob = load_object("/adm/objects/sword");',
            '    } else {',
            '        ob = load_object(1);',
            '    }',
            '    ob->query();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'if-else-resolved-unsupported.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'ob->query'));

        expect(result?.inference).toEqual({
            status: 'unsupported',
            reason: 'unsupported-expression',
            candidates: []
        });
    });

    test('unsupported control flow writes degrade receiver tracing to unknown', async () => {
        const loopSource = [
            'void demo() {',
            '    object ob;',
            '    ob = load_object("/adm/objects/shield");',
            '    for (;;) {',
            '        ob = load_object("/adm/objects/sword");',
            '        break;',
            '    }',
            '    ob->query();',
            '}'
        ].join('\n');
        const loopDocument = createDocument(path.join(fixtureRoot, 'room', 'loop-write.c'), loopSource);

        const loopResult = await service.inferObjectAccess(loopDocument, positionAfter(loopSource, 'ob->query'));

        expect(loopResult?.inference).toEqual({
            status: 'unknown',
            candidates: []
        });

        const switchSource = [
            'void demo(int flag) {',
            '    object ob;',
            '    ob = load_object("/adm/objects/sword");',
            '    switch (flag) {',
            '    case 1:',
            '        ob = load_object("/adm/objects/shield");',
            '        break;',
            '    }',
            '    ob->query();',
            '}'
        ].join('\n');
        const switchDocument = createDocument(path.join(fixtureRoot, 'room', 'switch-write.c'), switchSource);

        const switchResult = await service.inferObjectAccess(switchDocument, positionAfter(switchSource, 'ob->query'));

        expect(switchResult?.inference).toEqual({
            status: 'unknown',
            candidates: []
        });
    });

    test('inner block declarations shadow without leaking writes to the outer receiver', async () => {
        const source = [
            'void demo() {',
            '    object ob = load_object("/adm/objects/shield");',
            '    {',
            '        object ob = load_object("/adm/objects/sword");',
            '        ob->query_inner();',
            '    }',
            '    ob->query_outer();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'block-shadowing.c'), source);

        const innerResult = await service.inferObjectAccess(
            document,
            positionAfter(source, 'ob->query_inner')
        );
        const outerResult = await service.inferObjectAccess(
            document,
            positionAfter(source, 'ob->query_outer')
        );

        expect(innerResult?.inference).toEqual({
            status: 'resolved',
            candidates: [
                {
                    path: path.join(fixtureRoot, 'adm', 'objects', 'sword.c'),
                    source: 'builtin-call'
                }
            ]
        });
        expect(outerResult?.inference).toEqual({
            status: 'resolved',
            candidates: [
                {
                    path: path.join(fixtureRoot, 'adm', 'objects', 'shield.c'),
                    source: 'builtin-call'
                }
            ]
        });
    });

    test('documented custom function return objects resolve on chained member access', async () => {
        const source = [
            '/**',
            ' * @brief helper docs',
            ' * @return object helper result',
            ' * @lpc-return-objects {"/adm/objects/sword", "/adm/objects/shield"}',
            ' */',
            'object helper() {',
            '    return this_object();',
            '}',
            '',
            'void demo() {',
            '    helper()->query("id");',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'documented-helper.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'helper()->query'));

        expect(result?.inference).toEqual({
            status: 'multiple',
            candidates: [
                {
                    path: path.join(fixtureRoot, 'adm', 'objects', 'sword.c'),
                    source: 'doc'
                },
                {
                    path: path.join(fixtureRoot, 'adm', 'objects', 'shield.c'),
                    source: 'doc'
                }
            ]
        });
    });

    test('single-candidate object method return objects propagate through assignment tracing', async () => {
        fs.writeFileSync(
            path.join(fixtureRoot, 'adm', 'objects', 'factory.c'),
            [
                '/**',
                ' * @brief build a sword',
                ' * @return object weapon',
                ' * @lpc-return-objects {"/adm/objects/sword"}',
                ' */',
                'object method() {',
                '    return clone_object("/adm/objects/sword");',
                '}'
            ].join('\n'),
            'utf8'
        );

        const source = [
            'void demo() {',
            '    object factory = load_object("/adm/objects/factory");',
            '    object weapon = factory->method();',
            '    weapon->query();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'method-return-assignment.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'weapon->query'));

        expect(result?.inference).toEqual({
            status: 'resolved',
            candidates: [
                {
                    path: path.join(fixtureRoot, 'adm', 'objects', 'sword.c'),
                    source: 'doc'
                }
            ]
        });
    });

    test('single-candidate object method return objects propagate through direct chained receivers', async () => {
        fs.writeFileSync(
            path.join(fixtureRoot, 'adm', 'objects', 'factory-direct-chain.c'),
            [
                '/**',
                ' * @brief build a sword',
                ' * @return object weapon',
                ' * @lpc-return-objects {"/adm/objects/sword"}',
                ' */',
                'object method() {',
                '    return clone_object("/adm/objects/sword");',
                '}'
            ].join('\n'),
            'utf8'
        );

        const source = [
            'void demo() {',
            '    object factory = load_object("/adm/objects/factory-direct-chain");',
            '    factory->method()->query();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'method-return-direct-chain.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'factory->method()->query'));

        expect(result?.inference).toEqual({
            status: 'resolved',
            candidates: [
                {
                    path: path.join(fixtureRoot, 'adm', 'objects', 'sword.c'),
                    source: 'doc'
                }
            ]
        });
    });

    test('single-candidate object method return tracing reports missing return annotations', async () => {
        fs.writeFileSync(
            path.join(fixtureRoot, 'adm', 'objects', 'factory-no-doc.c'),
            [
                'object method() {',
                '    return clone_object("/adm/objects/sword");',
                '}'
            ].join('\n'),
            'utf8'
        );

        const source = [
            'void demo() {',
            '    object factory = load_object("/adm/objects/factory-no-doc");',
            '    object weapon = factory->method();',
            '    weapon->query();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'method-return-missing-doc.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'weapon->query'));

        expect(result?.inference).toEqual({
            status: 'unknown',
            candidates: [],
            diagnostics: [
                {
                    code: 'missing-return-annotation',
                    methodName: 'method'
                }
            ]
        });
    });

    test('shared inherited implementation is deduped across multiple receiver candidates', async () => {
        const baseFactoryPath = path.join(fixtureRoot, 'adm', 'objects', 'base-factory.c');
        fs.writeFileSync(
            baseFactoryPath,
            [
                '/**',
                ' * @brief build a sword from the shared base implementation',
                ' * @return object weapon',
                ' * @lpc-return-objects {"/adm/objects/sword"}',
                ' */',
                'object method() {',
                '    return clone_object("/adm/objects/sword");',
                '}'
            ].join('\n'),
            'utf8'
        );
        fs.writeFileSync(
            path.join(fixtureRoot, 'adm', 'objects', 'left-factory.c'),
            'inherit "/adm/objects/base-factory";\n',
            'utf8'
        );
        fs.writeFileSync(
            path.join(fixtureRoot, 'adm', 'objects', 'right-factory.c'),
            'inherit "/adm/objects/base-factory";\n',
            'utf8'
        );

        const source = [
            'void demo(int flag) {',
            '    object factory;',
            '    if (flag) {',
            '        factory = load_object("/adm/objects/left-factory");',
            '    } else {',
            '        factory = load_object("/adm/objects/right-factory");',
            '    }',
            '    object weapon = factory->method();',
            '    weapon->query();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'shared-inherited-method.c'), source);
        (vscode.workspace.openTextDocument as jest.Mock).mockClear();

        const result = await service.inferObjectAccess(document, positionAfter(source, 'weapon->query'));

        expect(result?.inference).toEqual({
            status: 'resolved',
            candidates: [
                {
                    path: path.join(fixtureRoot, 'adm', 'objects', 'sword.c'),
                    source: 'doc'
                }
            ]
        });
    });

    test('method return inference reflects updated inherited implementations without stale cached docs', async () => {
        const baseFactoryPath = path.join(fixtureRoot, 'adm', 'objects', 'refreshable-base-factory.c');
        fs.writeFileSync(
            baseFactoryPath,
            [
                '/**',
                ' * @brief initial implementation',
                ' * @return object weapon',
                ' * @lpc-return-objects {"/adm/objects/sword"}',
                ' */',
                'object method() {',
                '    return clone_object("/adm/objects/sword");',
                '}'
            ].join('\n'),
            'utf8'
        );
        fs.writeFileSync(
            path.join(fixtureRoot, 'adm', 'objects', 'refreshable-child-factory.c'),
            'inherit "/adm/objects/refreshable-base-factory";\n',
            'utf8'
        );

        const source = [
            'void demo() {',
            '    object factory = load_object("/adm/objects/refreshable-child-factory");',
            '    object weapon = factory->method();',
            '    weapon->query();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'refreshable-method-resolution.c'), source);

        const initialResult = await service.inferObjectAccess(document, positionAfter(source, 'weapon->query'));

        expect(initialResult?.inference).toEqual({
            status: 'resolved',
            candidates: [
                {
                    path: path.join(fixtureRoot, 'adm', 'objects', 'sword.c'),
                    source: 'doc'
                }
            ]
        });

        fs.writeFileSync(
            baseFactoryPath,
            [
                '/**',
                ' * @brief updated implementation',
                ' * @return object armor',
                ' * @lpc-return-objects {"/adm/objects/shield"}',
                ' */',
                'object method() {',
                '    return clone_object("/adm/objects/shield");',
                '}'
            ].join('\n'),
            'utf8'
        );

        const updatedResult = await service.inferObjectAccess(document, positionAfter(source, 'weapon->query'));

        expect(updatedResult?.inference).toEqual({
            status: 'resolved',
            candidates: [
                {
                    path: path.join(fixtureRoot, 'adm', 'objects', 'shield.c'),
                    source: 'doc'
                }
            ]
        });
    });

    test('multiple receiver candidates keep distinct override implementations', async () => {
        fs.writeFileSync(
            path.join(fixtureRoot, 'adm', 'objects', 'base-override-factory.c'),
            [
                '/**',
                ' * @brief default implementation',
                ' * @return object weapon',
                ' * @lpc-return-objects {"/adm/objects/sword"}',
                ' */',
                'object method() {',
                '    return clone_object("/adm/objects/sword");',
                '}'
            ].join('\n'),
            'utf8'
        );
        fs.writeFileSync(
            path.join(fixtureRoot, 'adm', 'objects', 'left-override-factory.c'),
            'inherit "/adm/objects/base-override-factory";\n',
            'utf8'
        );
        fs.writeFileSync(
            path.join(fixtureRoot, 'adm', 'objects', 'right-override-factory.c'),
            [
                'inherit "/adm/objects/base-override-factory";',
                '/**',
                ' * @brief override implementation',
                ' * @return object shield',
                ' * @lpc-return-objects {"/adm/objects/shield"}',
                ' */',
                'object method() {',
                '    return clone_object("/adm/objects/shield");',
                '}'
            ].join('\n'),
            'utf8'
        );

        const source = [
            'void demo(int flag) {',
            '    object factory;',
            '    if (flag) {',
            '        factory = load_object("/adm/objects/left-override-factory");',
            '    } else {',
            '        factory = load_object("/adm/objects/right-override-factory");',
            '    }',
            '    object weapon = factory->method();',
            '    weapon->query();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'override-methods.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'weapon->query'));

        expect(result?.inference).toEqual({
            status: 'multiple',
            candidates: [
                {
                    path: path.join(fixtureRoot, 'adm', 'objects', 'sword.c'),
                    source: 'doc'
                },
                {
                    path: path.join(fixtureRoot, 'adm', 'objects', 'shield.c'),
                    source: 'doc'
                }
            ]
        });
    });

    test('multiple receiver candidates downgrade to unknown when one implementation lacks return docs', async () => {
        fs.writeFileSync(
            path.join(fixtureRoot, 'adm', 'objects', 'left-documented-factory.c'),
            [
                '/**',
                ' * @brief documented implementation',
                ' * @return object sword',
                ' * @lpc-return-objects {"/adm/objects/sword"}',
                ' */',
                'object method() {',
                '    return clone_object("/adm/objects/sword");',
                '}'
            ].join('\n'),
            'utf8'
        );
        fs.writeFileSync(
            path.join(fixtureRoot, 'adm', 'objects', 'right-undocumented-factory.c'),
            [
                'object method() {',
                '    return clone_object("/adm/objects/shield");',
                '}'
            ].join('\n'),
            'utf8'
        );

        const source = [
            'void demo(int flag) {',
            '    object factory;',
            '    if (flag) {',
            '        factory = load_object("/adm/objects/left-documented-factory");',
            '    } else {',
            '        factory = load_object("/adm/objects/right-undocumented-factory");',
            '    }',
            '    object weapon = factory->method();',
            '    weapon->query();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'method-missing-doc-in-branch.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'weapon->query'));

        expect(result?.inference).toEqual({
            status: 'unknown',
            candidates: [],
            diagnostics: [
                {
                    code: 'missing-return-annotation',
                    methodName: 'method'
                }
            ]
        });
    });

    test('inherited method implementations resolve return-object annotations', async () => {
        fs.writeFileSync(
            path.join(fixtureRoot, 'adm', 'objects', 'inherited-base-factory.c'),
            [
                '/**',
                ' * @brief inherited implementation',
                ' * @return object weapon',
                ' * @lpc-return-objects {"/adm/objects/sword"}',
                ' */',
                'object method() {',
                '    return clone_object("/adm/objects/sword");',
                '}'
            ].join('\n'),
            'utf8'
        );
        fs.writeFileSync(
            path.join(fixtureRoot, 'adm', 'objects', 'inherited-child-factory.c'),
            'inherit "/adm/objects/inherited-base-factory";\n',
            'utf8'
        );

        const source = [
            'void demo() {',
            '    object factory = load_object("/adm/objects/inherited-child-factory");',
            '    object weapon = factory->method();',
            '    weapon->query();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'inherited-method-resolution.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'weapon->query'));

        expect(result?.inference).toEqual({
            status: 'resolved',
            candidates: [
                {
                    path: path.join(fixtureRoot, 'adm', 'objects', 'sword.c'),
                    source: 'doc'
                }
            ]
        });
    });

    test('include-backed method implementations resolve return-object annotations', async () => {
        const includeDir = path.join(fixtureRoot, 'adm', 'objects', 'include');
        fs.mkdirSync(includeDir, { recursive: true });
        fs.writeFileSync(
            path.join(includeDir, 'factory-method.c'),
            [
                '/**',
                ' * @brief include-backed implementation',
                ' * @return object weapon',
                ' * @lpc-return-objects {"/adm/objects/sword"}',
                ' */',
                'object method() {',
                '    return clone_object("/adm/objects/sword");',
                '}'
            ].join('\n'),
            'utf8'
        );
        fs.writeFileSync(
            path.join(fixtureRoot, 'adm', 'objects', 'include-child-factory.c'),
            'include "/adm/objects/include/factory-method.c";\n',
            'utf8'
        );

        const source = [
            'void demo() {',
            '    object factory = load_object("/adm/objects/include-child-factory");',
            '    object weapon = factory->method();',
            '    weapon->query();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'include-method-resolution.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'weapon->query'));

        expect(result?.inference).toEqual({
            status: 'resolved',
            candidates: [
                {
                    path: path.join(fixtureRoot, 'adm', 'objects', 'sword.c'),
                    source: 'doc'
                }
            ]
        });
    });

    test('system include-backed method implementations resolve via project config include directories', async () => {
        const configuredIncludeDir = path.join(fixtureRoot, 'configured', 'include');
        const includeFilePath = path.join(configuredIncludeDir, 'factory_method.h');
        const childFactoryPath = path.join(fixtureRoot, 'adm', 'objects', 'configured-include-child-factory.c');
        fs.mkdirSync(configuredIncludeDir, { recursive: true });
        fs.writeFileSync(
            includeFilePath,
            [
                '/**',
                ' * @brief include-backed implementation from configured include directory',
                ' * @return object weapon',
                ' * @lpc-return-objects {"/adm/objects/sword"}',
                ' */',
                'object method();'
            ].join('\n'),
            'utf8'
        );
        fs.writeFileSync(
            childFactoryPath,
            'include <factory_method.h>;\n',
            'utf8'
        );

        const projectConfigService = {
            loadForWorkspace: jest.fn(async () => ({
                version: 1 as const,
                configHellPath: 'config.hell'
            })),
            getIncludeDirectoriesForWorkspace: jest.fn(async () => [configuredIncludeDir])
        };
        const baseAnalysisService = DocumentSemanticSnapshotService.getInstance();
        const analysisService = {
            getSyntaxDocument: baseAnalysisService.getSyntaxDocument.bind(baseAnalysisService),
            getSemanticSnapshot: jest.fn((targetDocument: vscode.TextDocument, useCache?: boolean) => {
                const sourceText = targetDocument.getText();
                if (sourceText.includes('include <factory_method.h>;')) {
                    return {
                        includeStatements: [{ value: 'factory_method.h', isSystemInclude: true }],
                        inheritStatements: [],
                        symbolTable: {
                            getAllSymbols: () => []
                        }
                    } as any;
                }

                if (sourceText.includes('object method();')) {
                    return {
                        includeStatements: [],
                        inheritStatements: [],
                        symbolTable: {
                            getAllSymbols: () => [{
                                type: SymbolType.FUNCTION,
                                name: 'method',
                                range: new vscode.Range(5, 0, 5, 15),
                                selectionRange: new vscode.Range(5, 0, 5, 15)
                            }]
                        }
                    } as any;
                }

                return baseAnalysisService.getSemanticSnapshot(targetDocument, useCache);
            })
        };
        const projectConfiguredService = new ObjectInferenceService(
            macroManager as any,
            projectConfigService as any,
            analysisService as any
        );
        const source = [
            'void demo() {',
            '    object factory = load_object("/adm/objects/configured-include-child-factory");',
            '    object weapon = factory->method();',
            '    weapon->query();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'configured-include-method-resolution.c'), source);

        const result = await projectConfiguredService.inferObjectAccess(document, positionAfter(source, 'weapon->query'));

        expect(result?.inference).toEqual({
            status: 'resolved',
            candidates: [
                {
                    path: path.join(fixtureRoot, 'adm', 'objects', 'sword.c'),
                    source: 'doc'
                }
            ]
        });
        expect(projectConfigService.getIncludeDirectoriesForWorkspace).toHaveBeenCalledWith(fixtureRoot);
    });

    test('bare object parameters remain unknown', async () => {
        const source = [
            'void demo(object ob) {',
            '    ob->query();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'bare-parameter.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'ob->query'));

        expect(result?.inference).toEqual({
            status: 'unknown',
            candidates: []
        });
    });

    test('uppercase local identifiers resolve through identifier tracing before macro fallback', async () => {
        macroManager.getMacro.mockReturnValue({
            name: 'COMBAT_D',
            value: '/adm/objects/shield',
            file: path.join(fixtureRoot, 'include', 'daemons.h'),
            line: 1
        });

        const source = [
            'void demo() {',
            '    object COMBAT_D = load_object("/adm/daemons/combat_d");',
            '    COMBAT_D->start();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'uppercase-local-trace.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'COMBAT_D->start'));

        expect(result?.inference).toEqual({
            status: 'resolved',
            candidates: [
                {
                    path: path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c'),
                    source: 'builtin-call'
                }
            ]
        });
    });

    test('file-scope global object initialized by load_object resolves in the current file', async () => {
        const source = [
            'object COMBAT_D = load_object("/adm/daemons/combat_d");',
            '',
            'void demo() {',
            '    COMBAT_D->start();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'global-load-object.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'COMBAT_D->start'));

        expect(result?.inference).toEqual({
            status: 'resolved',
            candidates: [
                {
                    path: path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c'),
                    source: 'builtin-call'
                }
            ]
        });
    });

    test('local aliases trace through visible file-scope global object bindings', async () => {
        const source = [
            'object COMBAT_D = load_object("/adm/daemons/combat_d");',
            '',
            'void demo() {',
            '    object ob = COMBAT_D;',
            '    ob->start();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'local-alias-from-global-load-object.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'ob->start'));

        expect(result?.inference).toEqual({
            status: 'resolved',
            candidates: [
                {
                    path: path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c'),
                    source: 'builtin-call'
                }
            ]
        });
    });

    test('visible file-scope global object wins over same-name macro fallback', async () => {
        macroManager.getMacro.mockReturnValue({
            name: 'COMBAT_D',
            value: '/adm/objects/shield',
            file: path.join(fixtureRoot, 'include', 'daemons.h'),
            line: 1
        });

        const source = [
            'object COMBAT_D = load_object("/adm/daemons/combat_d");',
            '',
            'void demo() {',
            '    COMBAT_D->start();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'global-vs-macro.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'COMBAT_D->start'));

        expect(result?.inference).toEqual({
            status: 'resolved',
            candidates: [
                {
                    path: path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c'),
                    source: 'builtin-call'
                }
            ]
        });
    });

    test('global aliases recurse through file-scope object bindings', async () => {
        const source = [
            'object TARGET_D = load_object("/adm/daemons/combat_d");',
            'object COMBAT_D = TARGET_D;',
            '',
            'void demo() {',
            '    COMBAT_D->start();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'global-alias-recurses.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'COMBAT_D->start'));

        expect(result?.inference).toEqual({
            status: 'resolved',
            candidates: [
                {
                    path: path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c'),
                    source: 'builtin-call'
                }
            ]
        });
    });

    test('macro-backed file-scope global object aliases still resolve through the macro initializer', async () => {
        macroManager.getMacro.mockReturnValue({
            name: 'COMBAT_PATH',
            value: '/adm/daemons/combat_d',
            file: path.join(fixtureRoot, 'include', 'daemons.h'),
            line: 1
        });

        const source = [
            'object COMBAT_D = COMBAT_PATH;',
            '',
            'void demo() {',
            '    COMBAT_D->start();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'global-alias-from-macro.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'COMBAT_D->start'));

        expect(result?.inference).toEqual({
            status: 'resolved',
            candidates: [
                {
                    path: path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c'),
                    source: 'macro'
                }
            ]
        });
    });

    test('global aliases degrade to unknown when file-scope aliases recurse in a cycle', async () => {
        macroManager.getMacro.mockReturnValue({
            name: 'COMBAT_D',
            value: '/adm/objects/shield',
            file: path.join(fixtureRoot, 'include', 'daemons.h'),
            line: 1
        });

        const source = [
            'object COMBAT_D = OTHER_D;',
            'object OTHER_D = COMBAT_D;',
            '',
            'void demo() {',
            '    COMBAT_D->start();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'global-alias-cycle.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'COMBAT_D->start'));

        expect(result?.inference).toEqual({
            status: 'unknown',
            candidates: []
        });
    });

    test('visible file-scope global with no initializer stays unknown instead of falling back to macros', async () => {
        macroManager.getMacro.mockReturnValue({
            name: 'COMBAT_D',
            value: '/adm/daemons/combat_d',
            file: path.join(fixtureRoot, 'include', 'daemons.h'),
            line: 1
        });

        const source = [
            'object COMBAT_D;',
            '',
            'void demo() {',
            '    COMBAT_D->start();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'global-no-initializer-stays-unknown.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'COMBAT_D->start'));

        expect(result?.inference).toEqual({
            status: 'unknown',
            candidates: []
        });
    });

    test('visible non-object file-scope globals block same-name macro fallback', async () => {
        macroManager.getMacro.mockReturnValue({
            name: 'COMBAT_D',
            value: '/adm/daemons/combat_d',
            file: path.join(fixtureRoot, 'include', 'daemons.h'),
            line: 1
        });

        const source = [
            'int COMBAT_D = 1;',
            '',
            'void demo() {',
            '    COMBAT_D->start();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'global-non-object-blocks-macro.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'COMBAT_D->start'));

        expect(result?.inference).toEqual({
            status: 'unknown',
            candidates: []
        });
    });

    test('visible file-scope global with unsupported initializer stays unsupported instead of falling back to macros', async () => {
        macroManager.getMacro.mockReturnValue({
            name: 'COMBAT_D',
            value: '/adm/daemons/combat_d',
            file: path.join(fixtureRoot, 'include', 'daemons.h'),
            line: 1
        });

        const source = [
            'object COMBAT_D = load_object(1);',
            '',
            'void demo() {',
            '    COMBAT_D->start();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'global-unsupported-initializer.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'COMBAT_D->start'));

        expect(result?.inference).toEqual({
            status: 'unsupported',
            reason: 'unsupported-expression',
            candidates: []
        });
    });

    test('same-file non-object globals inside global initializers block macro fallback', async () => {
        macroManager.getMacro.mockReturnValue({
            name: 'COMBAT_PATH',
            value: '/adm/daemons/combat_d',
            file: path.join(fixtureRoot, 'include', 'daemons.h'),
            line: 1
        });

        const source = [
            'int COMBAT_PATH = 1;',
            'object COMBAT_D = COMBAT_PATH;',
            '',
            'void demo() {',
            '    COMBAT_D->start();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'global-initializer-non-object-blocks-macro.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'COMBAT_D->start'));

        expect(result?.inference).toEqual({
            status: 'unknown',
            candidates: []
        });
    });

    test('documented-return initializer resolves visible file-scope global object', async () => {
        const source = [
            '/**',
            ' * @return object daemon',
            ' * @lpc-return-objects {"/adm/daemons/combat_d"}',
            ' */',
            'object create_combat_daemon() {',
            '    return load_object("/adm/daemons/combat_d");',
            '}',
            '',
            'object COMBAT_D = create_combat_daemon();',
            '',
            'void demo() {',
            '    COMBAT_D->start();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'global-documented-return-initializer.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'COMBAT_D->start'));

        expect(result?.inference).toEqual({
            status: 'resolved',
            candidates: [
                {
                    path: path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c'),
                    source: 'doc'
                }
            ]
        });
    });

    test('global object method initializer resolves visible file-scope global object', async () => {
        fs.writeFileSync(
            path.join(fixtureRoot, 'adm', 'objects', 'documented-factory.c'),
            [
                '/**',
                ' * @return object weapon',
                ' * @lpc-return-objects {"/adm/objects/sword"}',
                ' */',
                'object method() {',
                '    return clone_object("/adm/objects/sword");',
                '}'
            ].join('\n'),
            'utf8'
        );

        const source = [
            'object FACTORY = load_object("/adm/objects/documented-factory");',
            'object weapon = FACTORY->method();',
            '',
            'void demo() {',
            '    weapon->query();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'global-object-method-initializer.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'weapon->query'));

        expect(result?.inference).toEqual({
            status: 'resolved',
            candidates: [
                {
                    path: path.join(fixtureRoot, 'adm', 'objects', 'sword.c'),
                    source: 'doc'
                }
            ]
        });
    });

    test('global object method initializer stays unknown when receiver is a visible non-object global despite same-name macro', async () => {
        macroManager.getMacro.mockImplementation((name: string) => name === 'FACTORY'
            ? {
                name: 'FACTORY',
                value: '/adm/objects/documented-factory-macro-receiver',
                file: path.join(fixtureRoot, 'include', 'factory.h'),
                line: 1
            }
            : undefined);

        fs.writeFileSync(
            path.join(fixtureRoot, 'adm', 'objects', 'documented-factory-macro-receiver.c'),
            [
                '/**',
                ' * @return object weapon',
                ' * @lpc-return-objects {"/adm/objects/sword"}',
                ' */',
                'object method() {',
                '    return clone_object("/adm/objects/sword");',
                '}'
            ].join('\n'),
            'utf8'
        );

        const source = [
            'int FACTORY = 1;',
            'object weapon = FACTORY->method();',
            '',
            'void demo() {',
            '    weapon->query();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'global-method-receiver-non-object-stays-unknown.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'weapon->query'));

        expect(result?.inference).toEqual({
            status: 'unknown',
            candidates: []
        });
    });

    test('local aliases trace through file-scope global object method initializers', async () => {
        fs.writeFileSync(
            path.join(fixtureRoot, 'adm', 'objects', 'documented-factory-local-alias.c'),
            [
                '/**',
                ' * @return object weapon',
                ' * @lpc-return-objects {"/adm/objects/sword"}',
                ' */',
                'object method() {',
                '    return clone_object("/adm/objects/sword");',
                '}'
            ].join('\n'),
            'utf8'
        );

        const source = [
            'object FACTORY = load_object("/adm/objects/documented-factory-local-alias");',
            '',
            'void demo() {',
            '    object weapon = FACTORY->method();',
            '    weapon->query();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'local-alias-from-global-method-initializer.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'weapon->query'));

        expect(result?.inference).toEqual({
            status: 'resolved',
            candidates: [
                {
                    path: path.join(fixtureRoot, 'adm', 'objects', 'sword.c'),
                    source: 'doc'
                }
            ]
        });
    });

    test('direct inherit file-scope global object resolves in child receivers', async () => {
        const parentFile = path.join(fixtureRoot, 'std', 'room.c');
        fs.mkdirSync(path.dirname(parentFile), { recursive: true });
        fs.writeFileSync(
            parentFile,
            'object COMBAT_D = load_object("/adm/daemons/combat_d");\n',
            'utf8'
        );

        const source = [
            'inherit "/std/room";',
            '',
            'void demo() {',
            '    COMBAT_D->start();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'd', 'city', 'room.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'COMBAT_D->start'));

        expect(result?.inference).toEqual({
            status: 'resolved',
            candidates: [
                {
                    path: path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c'),
                    source: 'builtin-call'
                }
            ]
        });
    });

    test('multi-level inherited global object bindings resolve through declaration-order DFS', async () => {
        fs.writeFileSync(
            path.join(fixtureRoot, 'std', 'base_room.c'),
            'object COMBAT_D = load_object("/adm/daemons/combat_d");\n',
            'utf8'
        );
        fs.writeFileSync(
            path.join(fixtureRoot, 'std', 'room.c'),
            'inherit "/std/base_room";\n',
            'utf8'
        );

        const source = [
            'inherit "/std/room";',
            '',
            'void demo() {',
            '    COMBAT_D->start();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'd', 'forest', 'room.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'COMBAT_D->start'));

        expect(result?.inference?.candidates).toEqual([
            {
                path: path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c'),
                source: 'builtin-call'
            }
        ]);
    });

    test('direct inherit declaration order wins for same-name inherited globals', async () => {
        fs.writeFileSync(
            path.join(fixtureRoot, 'std', 'left_room.c'),
            'object COMBAT_D = load_object("/adm/daemons/left_d");\n',
            'utf8'
        );
        fs.writeFileSync(
            path.join(fixtureRoot, 'std', 'right_room.c'),
            'object COMBAT_D = load_object("/adm/daemons/right_d");\n',
            'utf8'
        );

        const source = [
            'inherit "/std/left_room";',
            'inherit "/std/right_room";',
            '',
            'void demo() {',
            '    COMBAT_D->start();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'd', 'forest', 'inherit-order-room.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'COMBAT_D->start'));

        expect(result?.inference?.candidates).toEqual([
            {
                path: path.join(fixtureRoot, 'adm', 'daemons', 'left_d.c'),
                source: 'builtin-call'
            }
        ]);
    });

    test('declaration-order DFS prefers the first direct inherit branch over later direct siblings', async () => {
        fs.writeFileSync(
            path.join(fixtureRoot, 'std', 'deep_parent.c'),
            'object COMBAT_D = load_object("/adm/daemons/deep_d");\n',
            'utf8'
        );
        fs.writeFileSync(
            path.join(fixtureRoot, 'std', 'left_room.c'),
            'inherit "/std/deep_parent";\n',
            'utf8'
        );
        fs.writeFileSync(
            path.join(fixtureRoot, 'std', 'right_room.c'),
            'object COMBAT_D = load_object("/adm/daemons/right_d");\n',
            'utf8'
        );

        const source = [
            'inherit "/std/left_room";',
            'inherit "/std/right_room";',
            '',
            'void demo() {',
            '    COMBAT_D->start();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'd', 'forest', 'inherit-dfs-vs-bfs.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'COMBAT_D->start'));

        expect(result?.inference?.candidates).toEqual([
            {
                path: path.join(fixtureRoot, 'adm', 'daemons', 'deep_d.c'),
                source: 'builtin-call'
            }
        ]);
    });

    test('current-file global object still wins over inherited same-name global object', async () => {
        fs.writeFileSync(
            path.join(fixtureRoot, 'std', 'room.c'),
            'object COMBAT_D = load_object("/adm/daemons/parent_d");\n',
            'utf8'
        );

        const source = [
            'inherit "/std/room";',
            '',
            'object COMBAT_D = load_object("/adm/daemons/local_d");',
            '',
            'void demo() {',
            '    COMBAT_D->start();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'd', 'city', 'shadow-object.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'COMBAT_D->start'));

        expect(result?.inference?.candidates).toEqual([
            {
                path: path.join(fixtureRoot, 'adm', 'daemons', 'local_d.c'),
                source: 'builtin-call'
            }
        ]);
    });

    test('current-file file-scope global declared after use still blocks inherited globals and macros', async () => {
        fs.writeFileSync(
            path.join(fixtureRoot, 'std', 'room.c'),
            'object COMBAT_D = load_object("/adm/daemons/parent_d");\n',
            'utf8'
        );
        macroManager.getMacro.mockReturnValue({
            name: 'COMBAT_D',
            value: '/adm/daemons/macro_d',
            file: path.join(fixtureRoot, 'include', 'daemons.h'),
            line: 1
        });

        const source = [
            'inherit "/std/room";',
            '',
            'void demo() {',
            '    COMBAT_D->start();',
            '}',
            '',
            'object COMBAT_D = load_object("/adm/daemons/local_d");'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'd', 'city', 'shadow-after-use.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'COMBAT_D->start'));

        expect(result?.inference?.candidates).toEqual([
            {
                path: path.join(fixtureRoot, 'adm', 'daemons', 'local_d.c'),
                source: 'builtin-call'
            }
        ]);
    });

    test('current-file non-object global blocks inherited same-name object and macro fallback', async () => {
        fs.writeFileSync(
            path.join(fixtureRoot, 'std', 'room.c'),
            'object COMBAT_D = load_object("/adm/daemons/parent_d");\n',
            'utf8'
        );
        macroManager.getMacro.mockReturnValue({
            name: 'COMBAT_D',
            value: '/adm/daemons/macro_d',
            file: path.join(fixtureRoot, 'include', 'daemons.h'),
            line: 1
        });

        const source = [
            'inherit "/std/room";',
            '',
            'int COMBAT_D = 1;',
            '',
            'void demo() {',
            '    COMBAT_D->start();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'd', 'city', 'shadow-non-object.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'COMBAT_D->start'));

        expect(result?.inference).toEqual({
            status: 'unknown',
            candidates: []
        });
    });

    test('current-file non-object global declared after use still blocks inherited globals and macros', async () => {
        fs.writeFileSync(
            path.join(fixtureRoot, 'std', 'room.c'),
            'object COMBAT_D = load_object("/adm/daemons/parent_d");\n',
            'utf8'
        );
        macroManager.getMacro.mockReturnValue({
            name: 'COMBAT_D',
            value: '/adm/daemons/macro_d',
            file: path.join(fixtureRoot, 'include', 'daemons.h'),
            line: 1
        });

        const source = [
            'inherit "/std/room";',
            '',
            'void demo() {',
            '    COMBAT_D->start();',
            '}',
            '',
            'int COMBAT_D = 1;'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'd', 'city', 'shadow-non-object-after-use.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'COMBAT_D->start'));

        expect(result?.inference).toEqual({
            status: 'unknown',
            candidates: []
        });
    });

    test('closer inherited non-object global blocks farther inherited object bindings and macros', async () => {
        fs.writeFileSync(
            path.join(fixtureRoot, 'std', 'base_room.c'),
            'object COMBAT_D = load_object("/adm/daemons/far_d");\n',
            'utf8'
        );
        fs.writeFileSync(
            path.join(fixtureRoot, 'std', 'room.c'),
            'inherit "/std/base_room";\nint COMBAT_D = 1;\n',
            'utf8'
        );
        macroManager.getMacro.mockReturnValue({
            name: 'COMBAT_D',
            value: '/adm/daemons/macro_d',
            file: path.join(fixtureRoot, 'include', 'daemons.h'),
            line: 1
        });

        const source = [
            'inherit "/std/room";',
            '',
            'void demo() {',
            '    COMBAT_D->start();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'd', 'city', 'closer-parent-blocks.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'COMBAT_D->start'));

        expect(result?.inference).toEqual({
            status: 'unknown',
            candidates: []
        });
    });

    test('local aliases trace through inherited file-scope global object bindings', async () => {
        fs.writeFileSync(
            path.join(fixtureRoot, 'std', 'room.c'),
            'object COMBAT_D = load_object("/adm/daemons/combat_d");\n',
            'utf8'
        );

        const source = [
            'inherit "/std/room";',
            '',
            'void demo() {',
            '    object ob = COMBAT_D;',
            '    ob->start();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'd', 'city', 'local-alias-through-inherit.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'ob->start'));

        expect(result?.inference?.candidates).toEqual([
            {
                path: path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c'),
                source: 'builtin-call'
            }
        ]);
    });

    test('current-file global initializer aliases inherited global object bindings', async () => {
        fs.writeFileSync(
            path.join(fixtureRoot, 'std', 'room.c'),
            'object COMBAT_D = load_object("/adm/daemons/combat_d");\n',
            'utf8'
        );

        const source = [
            'inherit "/std/room";',
            '',
            'object FACTORY = COMBAT_D;',
            '',
            'void demo() {',
            '    FACTORY->start();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'd', 'city', 'global-alias-through-inherit.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'FACTORY->start'));

        expect(result?.inference?.candidates).toEqual([
            {
                path: path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c'),
                source: 'builtin-call'
            }
        ]);
    });

    test('inherited global alias chains recurse across parent files', async () => {
        fs.writeFileSync(
            path.join(fixtureRoot, 'std', 'base_room.c'),
            'object FACTORY = load_object("/adm/daemons/combat_d");\n',
            'utf8'
        );
        fs.writeFileSync(
            path.join(fixtureRoot, 'std', 'room.c'),
            'inherit "/std/base_room";\nobject COMBAT_D = FACTORY;\n',
            'utf8'
        );

        const source = [
            'inherit "/std/room";',
            '',
            'void demo() {',
            '    COMBAT_D->start();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'd', 'city', 'inherited-global-alias-chain.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'COMBAT_D->start'));

        expect(result?.inference?.candidates).toEqual([
            {
                path: path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c'),
                source: 'builtin-call'
            }
        ]);
    });

    test('current-file global object method initializer resolves inherited global receiver bindings', async () => {
        fs.writeFileSync(
            path.join(fixtureRoot, 'adm', 'objects', 'inherited-global-method-factory.c'),
            [
                '/**',
                ' * @return object weapon',
                ' * @lpc-return-objects {"/adm/objects/sword"}',
                ' */',
                'object method() {',
                '    return clone_object("/adm/objects/sword");',
                '}'
            ].join('\n'),
            'utf8'
        );
        fs.writeFileSync(
            path.join(fixtureRoot, 'std', 'room.c'),
            'object FACTORY = load_object("/adm/objects/inherited-global-method-factory");\n',
            'utf8'
        );

        const source = [
            'inherit "/std/room";',
            '',
            'object weapon = FACTORY->method();',
            '',
            'void demo() {',
            '    weapon->query();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'd', 'city', 'global-method-through-inherit.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'weapon->query'));

        expect(result?.inference).toEqual({
            status: 'resolved',
            candidates: [
                {
                    path: path.join(fixtureRoot, 'adm', 'objects', 'sword.c'),
                    source: 'doc'
                }
            ]
        });
    });

    test('cross-file inherited global alias cycles degrade to unknown', async () => {
        macroManager.getMacro.mockReturnValue({
            name: 'COMBAT_D',
            value: '/adm/daemons/macro_d',
            file: path.join(fixtureRoot, 'include', 'daemons.h'),
            line: 1
        });
        fs.writeFileSync(
            path.join(fixtureRoot, 'std', 'cycle_a.c'),
            'inherit "/std/cycle_b";\nobject COMBAT_D = OTHER_D;\n',
            'utf8'
        );
        fs.writeFileSync(
            path.join(fixtureRoot, 'std', 'cycle_b.c'),
            'inherit "/std/cycle_a";\nobject OTHER_D = COMBAT_D;\n',
            'utf8'
        );

        const source = [
            'inherit "/std/cycle_a";',
            '',
            'void demo() {',
            '    COMBAT_D->start();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'd', 'city', 'cross-file-alias-cycle.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'COMBAT_D->start'));

        expect(result?.inference).toEqual({
            status: 'unknown',
            candidates: []
        });
    });

    test('inherited globals with unsupported initializers block macro fallback', async () => {
        macroManager.getMacro.mockReturnValue({
            name: 'COMBAT_D',
            value: '/adm/daemons/macro_d',
            file: path.join(fixtureRoot, 'include', 'daemons.h'),
            line: 1
        });
        fs.writeFileSync(
            path.join(fixtureRoot, 'std', 'room.c'),
            'object COMBAT_D = load_object(1);\n',
            'utf8'
        );

        const source = [
            'inherit "/std/room";',
            '',
            'void demo() {',
            '    COMBAT_D->start();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'd', 'city', 'inherit-unsupported-blocks-macro.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'COMBAT_D->start'));

        expect(result?.inference).toEqual({
            status: 'unsupported',
            reason: 'unsupported-expression',
            candidates: []
        });
    });

    test('inherited globals without initializers block macro fallback', async () => {
        macroManager.getMacro.mockReturnValue({
            name: 'COMBAT_D',
            value: '/adm/daemons/macro_d',
            file: path.join(fixtureRoot, 'include', 'daemons.h'),
            line: 1
        });
        fs.writeFileSync(
            path.join(fixtureRoot, 'std', 'room.c'),
            'object COMBAT_D;\n',
            'utf8'
        );

        const source = [
            'inherit "/std/room";',
            '',
            'void demo() {',
            '    COMBAT_D->start();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'd', 'city', 'inherit-no-initializer-blocks-macro.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'COMBAT_D->start'));

        expect(result?.inference).toEqual({
            status: 'unknown',
            candidates: []
        });
    });

    test('global object method initializer resolves via project config include directories', async () => {
        const configuredIncludeDir = path.join(fixtureRoot, 'configured', 'include');
        const includeFilePath = path.join(configuredIncludeDir, 'factory_method.h');
        const childFactoryPath = path.join(fixtureRoot, 'adm', 'objects', 'configured-global-include-child-factory.c');
        fs.mkdirSync(configuredIncludeDir, { recursive: true });
        fs.writeFileSync(
            includeFilePath,
            [
                '/**',
                ' * @brief include-backed implementation from configured include directory',
                ' * @return object weapon',
                ' * @lpc-return-objects {"/adm/objects/sword"}',
                ' */',
                'object method();'
            ].join('\n'),
            'utf8'
        );
        fs.writeFileSync(
            childFactoryPath,
            'include <factory_method.h>;\n',
            'utf8'
        );

        const projectConfigService = {
            loadForWorkspace: jest.fn(async () => ({
                version: 1 as const,
                configHellPath: 'config.hell'
            })),
            getIncludeDirectoriesForWorkspace: jest.fn(async () => [configuredIncludeDir])
        };
        const baseAnalysisService = DocumentSemanticSnapshotService.getInstance();
        const analysisService = {
            getSyntaxDocument: baseAnalysisService.getSyntaxDocument.bind(baseAnalysisService),
            getSemanticSnapshot: jest.fn((targetDocument: vscode.TextDocument, useCache?: boolean) => {
                const sourceText = targetDocument.getText();
                if (sourceText.includes('include <factory_method.h>;')) {
                    return {
                        includeStatements: [{ value: 'factory_method.h', isSystemInclude: true }],
                        inheritStatements: [],
                        symbolTable: {
                            getAllSymbols: () => []
                        }
                    } as any;
                }

                if (sourceText.includes('object method();')) {
                    return {
                        includeStatements: [],
                        inheritStatements: [],
                        symbolTable: {
                            getAllSymbols: () => [{
                                type: SymbolType.FUNCTION,
                                name: 'method',
                                range: new vscode.Range(5, 0, 5, 15),
                                selectionRange: new vscode.Range(5, 0, 5, 15)
                            }]
                        }
                    } as any;
                }

                return baseAnalysisService.getSemanticSnapshot(targetDocument, useCache);
            })
        };
        const projectConfiguredService = new ObjectInferenceService(
            macroManager as any,
            projectConfigService as any,
            analysisService as any
        );
        const source = [
            'object FACTORY = load_object("/adm/objects/configured-global-include-child-factory");',
            'object weapon = FACTORY->method();',
            '',
            'void demo() {',
            '    weapon->query();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'global-configured-include-method-resolution.c'), source);

        const result = await projectConfiguredService.inferObjectAccess(document, positionAfter(source, 'weapon->query'));

        expect(result?.inference).toEqual({
            status: 'resolved',
            candidates: [
                {
                    path: path.join(fixtureRoot, 'adm', 'objects', 'sword.c'),
                    source: 'doc'
                }
            ]
        });
        expect(projectConfigService.getIncludeDirectoriesForWorkspace).toHaveBeenCalledWith(fixtureRoot);
    });

    test('local object bindings still shadow file-scope globals', async () => {
        const source = [
            'object COMBAT_D = load_object("/adm/daemons/combat_d");',
            '',
            'void demo() {',
            '    object COMBAT_D = load_object("/adm/objects/sword");',
            '    COMBAT_D->query();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'global-shadowed-by-local.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'COMBAT_D->query'));

        expect(result?.inference).toEqual({
            status: 'resolved',
            candidates: [
                {
                    path: path.join(fixtureRoot, 'adm', 'objects', 'sword.c'),
                    source: 'builtin-call'
                }
            ]
        });
    });

    test('nested identifier rhs tracing prefers visible uppercase local bindings over macro fallback', async () => {
        macroManager.getMacro.mockReturnValue({
            name: 'COMBAT_D',
            value: '/adm/objects/shield',
            file: path.join(fixtureRoot, 'include', 'daemons.h'),
            line: 1
        });

        const source = [
            'void demo() {',
            '    object COMBAT_D = load_object("/adm/daemons/combat_d");',
            '    object ob = COMBAT_D;',
            '    ob->start();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'nested-uppercase-local-trace.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'ob->start'));

        expect(result?.inference).toEqual({
            status: 'resolved',
            candidates: [
                {
                    path: path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c'),
                    source: 'builtin-call'
                }
            ]
        });
    });

    test('out-of-scope inner block locals do not block later macro fallback', async () => {
        macroManager.getMacro.mockReturnValue({
            name: 'COMBAT_D',
            value: '/adm/daemons/combat_d',
            file: path.join(fixtureRoot, 'include', 'daemons.h'),
            line: 1
        });

        const source = [
            'void demo() {',
            '    {',
            '        object COMBAT_D = load_object("/adm/objects/sword");',
            '        COMBAT_D->query();',
            '    }',
            '    COMBAT_D->start();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'macro-fallback-after-inner-block.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'COMBAT_D->start'));

        expect(result?.inference).toEqual({
            status: 'resolved',
            candidates: [
                {
                    path: path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c'),
                    source: 'macro'
                }
            ]
        });
    });

    test('identifier tracing preserves unsupported builtin rhs semantics', async () => {
        const source = [
            'void demo() {',
            '    object ob = load_object(1);',
            '    ob->query();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'traced-unsupported-builtin.c'), source);

        const result = await service.inferObjectAccess(document, positionAfter(source, 'ob->query'));

        expect(result?.inference).toEqual({
            status: 'unsupported',
            reason: 'unsupported-expression',
            candidates: []
        });
    });
});
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
