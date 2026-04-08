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
        fs.mkdirSync(path.join(fixtureRoot, 'room'), { recursive: true });
        fs.writeFileSync(path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c'), 'void start() {}\n', 'utf8');

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

    test('arr[0]->query() yields unsupported array-element inference', async () => {
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
            reason: 'array-element',
            candidates: []
        });
    });
});
