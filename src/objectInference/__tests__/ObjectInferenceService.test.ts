import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ASTManager } from '../../ast/astManager';
import { ObjectInferenceService } from '../ObjectInferenceService';

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

    beforeEach(() => {
        jest.clearAllMocks();
        fixtureRoot = path.join(process.cwd(), '.tmp-object-inference');
        fs.rmSync(fixtureRoot, { recursive: true, force: true });
        fs.mkdirSync(path.join(fixtureRoot, 'adm', 'daemons'), { recursive: true });
        fs.mkdirSync(path.join(fixtureRoot, 'adm', 'objects'), { recursive: true });
        fs.mkdirSync(path.join(fixtureRoot, 'room'), { recursive: true });
        fs.writeFileSync(path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c'), 'void start() {}\n', 'utf8');
        fs.writeFileSync(path.join(fixtureRoot, 'adm', 'objects', 'sword.c'), 'void query() {}\n', 'utf8');
        fs.writeFileSync(path.join(fixtureRoot, 'adm', 'objects', 'shield.c'), 'void query() {}\n', 'utf8');

        (vscode.workspace.getWorkspaceFolder as jest.Mock).mockReturnValue({
            uri: { fsPath: fixtureRoot }
        });
        (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: fixtureRoot } }];

        macroManager = {
            getMacro: jest.fn()
        };

        service = new ObjectInferenceService(macroManager as any);
    });

    afterEach(() => {
        ASTManager.getInstance().clearAllCache();
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
