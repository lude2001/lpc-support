import { afterEach, describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';

interface WorkspaceSymbolOwner {
    kind: 'function' | 'global' | 'type';
    key: string;
    name: string;
}

interface ReferenceCandidate {
    range: vscode.Range;
    symbolName: string;
    isDeclaration?: boolean;
}

interface WorkspaceReferenceCandidateEnumeratorLike {
    enumerate(document: vscode.TextDocument, owner: WorkspaceSymbolOwner): ReferenceCandidate[];
}

interface WorkspaceSymbolOwnerResolverLike {
    resolveOwner(document: vscode.TextDocument, position: vscode.Position): Promise<any>;
}

interface WorkspaceReferenceCollectorLike {
    collect(
        owner: WorkspaceSymbolOwner,
        candidateFiles: string[],
        options: { includeDeclaration: boolean }
    ): Promise<Array<{ uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } }>>;
}

type WorkspaceReferenceCollectorCtor = new (options: {
    host: { openTextDocument(target: string | vscode.Uri): Promise<vscode.TextDocument> };
    ownerResolver: WorkspaceSymbolOwnerResolverLike;
    candidateEnumerator: WorkspaceReferenceCandidateEnumeratorLike;
}) => WorkspaceReferenceCollectorLike;

interface OpenDocumentFixture {
    uri: string;
    text: string;
    version: number;
}

const originalTextDocumentsDescriptor = Object.getOwnPropertyDescriptor(vscode.workspace, 'textDocuments');

function createTextDocument(uriValue: string, source: string, version: number = 1): vscode.TextDocument {
    const uri = vscode.Uri.parse(uriValue);
    const lines = source.split(/\r?\n/);
    const lineStarts = [0];

    for (let index = 0; index < source.length; index += 1) {
        if (source[index] === '\n') {
            lineStarts.push(index + 1);
        }
    }

    const offsetAt = (position: vscode.Position): number => {
        const lineStart = lineStarts[position.line] ?? source.length;
        return Math.min(lineStart + position.character, source.length);
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
        uri,
        fileName: uri.fsPath,
        languageId: 'lpc',
        version,
        lineCount: lines.length,
        isDirty: false,
        isClosed: false,
        isUntitled: false,
        eol: vscode.EndOfLine.LF,
        getText: jest.fn((range?: vscode.Range) => {
            if (!range) {
                return source;
            }

            return source.slice(offsetAt(range.start), offsetAt(range.end));
        }),
        lineAt: jest.fn((line: number) => ({ text: lines[line] ?? '' })),
        getWordRangeAtPosition: jest.fn((position: vscode.Position) => {
            const lineText = lines[position.line] ?? '';
            const isWordCharacter = (char: string | undefined) => Boolean(char && /[A-Za-z0-9_]/.test(char));

            let start = position.character;
            while (start > 0 && isWordCharacter(lineText[start - 1])) {
                start -= 1;
            }

            let end = position.character;
            while (end < lineText.length && isWordCharacter(lineText[end])) {
                end += 1;
            }

            if (start === end) {
                return undefined;
            }

            return new vscode.Range(position.line, start, position.line, end);
        }),
        positionAt: jest.fn(positionAt),
        offsetAt: jest.fn(offsetAt),
        save: jest.fn(async () => true),
        validateRange: jest.fn((range: vscode.Range) => range),
        validatePosition: jest.fn((position: vscode.Position) => position)
    } as unknown as vscode.TextDocument;
}

function setOpenDocuments(fixtures: OpenDocumentFixture[] = []): void {
    const documents = fixtures.map((fixture) => createTextDocument(fixture.uri, fixture.text, fixture.version));
    Object.defineProperty(vscode.workspace, 'textDocuments', {
        configurable: true,
        get: () => documents
    });
}

function createHost(texts: Record<string, string>): { openTextDocument(target: string | vscode.Uri): Promise<vscode.TextDocument> } {
    return {
        openTextDocument: jest.fn(async (target: string | vscode.Uri) => {
            const uri = typeof target === 'string' ? target : target.toString();
            const text = texts[uri];
            if (typeof text !== 'string') {
                throw new Error(`No fixture text for ${uri}`);
            }

            return createTextDocument(uri, text);
        })
    };
}

function positionKey(uri: string, line: number, character: number, version?: number): string {
    return `${uri}#${line}:${character}#${version ?? '*'}`;
}

function createOwnerResolutionMap(entries: Array<[string, any]>): WorkspaceSymbolOwnerResolverLike {
    const lookup = new Map(entries);

    return {
        resolveOwner: jest.fn(async (document: vscode.TextDocument, position: vscode.Position) => {
            return lookup.get(positionKey(document.uri.toString(), position.line, position.character, document.version))
                ?? lookup.get(positionKey(document.uri.toString(), position.line, position.character))
                ?? { kind: 'unsupported', reason: 'fixture missing owner resolution' };
        })
    };
}

function createCandidateEnumerator(
    candidatesByUri: Record<string, ReferenceCandidate[]>
): WorkspaceReferenceCandidateEnumeratorLike {
    return {
        enumerate: jest.fn((document: vscode.TextDocument) => candidatesByUri[document.uri.toString()] ?? [])
    };
}

function loadWorkspaceReferenceCollector(): WorkspaceReferenceCollectorCtor {
    let modulePath: string;

    try {
        modulePath = require.resolve('../WorkspaceReferenceCollector');
    } catch (error) {
        const moduleError = error as NodeJS.ErrnoException;
        if (moduleError.code === 'MODULE_NOT_FOUND') {
            throw new Error('WorkspaceReferenceCollector is not implemented yet');
        }

        throw error;
    }

    const module = require(modulePath) as {
        WorkspaceReferenceCollector?: WorkspaceReferenceCollectorCtor;
    };

    if (module.WorkspaceReferenceCollector) {
        return module.WorkspaceReferenceCollector;
    }

    throw new Error('WorkspaceReferenceCollector export is not implemented yet');
}

function targetOwner(): WorkspaceSymbolOwner {
    return {
        kind: 'function',
        key: 'function:file:///D:/workspace/room.c:query_id',
        name: 'query_id'
    };
}

describe('WorkspaceReferenceCollector', () => {
    afterEach(() => {
        if (originalTextDocumentsDescriptor) {
            Object.defineProperty(vscode.workspace, 'textDocuments', originalTextDocumentsDescriptor);
        } else {
            delete (vscode.workspace as any).textDocuments;
        }
    });

    test('collects references only from files whose confirmed owner matches the target owner', async () => {
        const owner = targetOwner();
        const roomUri = 'file:///D:/workspace/room.c';
        const lookUri = 'file:///D:/workspace/cmds/look.c';
        const WorkspaceReferenceCollector = loadWorkspaceReferenceCollector();
        const collector = new WorkspaceReferenceCollector({
            host: createHost({
                [roomUri]: 'int query_id() { return 1; }\nint demo() { return query_id(); }',
                [lookUri]: 'int look() { return query_id(); }'
            }),
            candidateEnumerator: createCandidateEnumerator({
                [roomUri]: [
                    { range: new vscode.Range(0, 4, 0, 12), symbolName: 'query_id', isDeclaration: true },
                    { range: new vscode.Range(1, 20, 1, 28), symbolName: 'query_id' }
                ],
                [lookUri]: [
                    { range: new vscode.Range(0, 20, 0, 28), symbolName: 'query_id' }
                ]
            }),
            ownerResolver: createOwnerResolutionMap([
                [positionKey(roomUri, 0, 4), { kind: 'workspace-visible', owner }],
                [positionKey(roomUri, 1, 20), { kind: 'workspace-visible', owner }],
                [positionKey(lookUri, 0, 20), { kind: 'workspace-visible', owner }]
            ])
        });

        const matches = await collector.collect(owner, [roomUri, lookUri], { includeDeclaration: false });

        expect(matches.map((item) => item.uri)).toEqual([roomUri, lookUri]);
    });

    test('filters same-name but different-owner functions', async () => {
        const owner = targetOwner();
        const roomUri = 'file:///D:/workspace/room.c';
        const otherUri = 'file:///D:/workspace/other/query.c';
        const WorkspaceReferenceCollector = loadWorkspaceReferenceCollector();
        const collector = new WorkspaceReferenceCollector({
            host: createHost({
                [roomUri]: 'int query_id() { return 1; }',
                [otherUri]: 'int query_id() { return 2; }'
            }),
            candidateEnumerator: createCandidateEnumerator({
                [roomUri]: [{ range: new vscode.Range(0, 4, 0, 12), symbolName: 'query_id', isDeclaration: true }],
                [otherUri]: [{ range: new vscode.Range(0, 4, 0, 12), symbolName: 'query_id', isDeclaration: true }]
            }),
            ownerResolver: createOwnerResolutionMap([
                [positionKey(roomUri, 0, 4), { kind: 'workspace-visible', owner }],
                [positionKey(otherUri, 0, 4), {
                    kind: 'workspace-visible',
                    owner: { kind: 'function', key: 'function:file:///D:/workspace/other/query.c:query_id', name: 'query_id' }
                }]
            ])
        });

        const matches = await collector.collect(owner, [roomUri, otherUri], { includeDeclaration: true });

        expect(matches.map((item) => item.uri)).toEqual([roomUri]);
    });

    test('filters same-name different-owner candidates within the same file after re-confirmation', async () => {
        const owner = targetOwner();
        const mixedUri = 'file:///D:/workspace/mixed.c';
        const WorkspaceReferenceCollector = loadWorkspaceReferenceCollector();
        const collector = new WorkspaceReferenceCollector({
            host: createHost({
                [mixedUri]: 'int query_id() { return 1; }\nint demo() { return query_id(); }'
            }),
            candidateEnumerator: createCandidateEnumerator({
                [mixedUri]: [
                    { range: new vscode.Range(0, 4, 0, 12), symbolName: 'query_id', isDeclaration: true },
                    { range: new vscode.Range(0, 20, 0, 28), symbolName: 'query_id' },
                    { range: new vscode.Range(1, 20, 1, 28), symbolName: 'query_id' }
                ]
            }),
            ownerResolver: createOwnerResolutionMap([
                [positionKey(mixedUri, 0, 4), { kind: 'workspace-visible', owner }],
                [positionKey(mixedUri, 0, 20), {
                    kind: 'workspace-visible',
                    owner: { kind: 'function', key: 'function:file:///D:/workspace/mixed.c:other_query_id', name: 'query_id' }
                }],
                [positionKey(mixedUri, 1, 20), { kind: 'workspace-visible', owner }]
            ])
        });

        const matches = await collector.collect(owner, [mixedUri], { includeDeclaration: true });

        expect(matches.every((item) => item.uri === mixedUri)).toBe(true);
        expect(matches).toHaveLength(2);
    });

    test('same-file prototype and implementation stay in one callable family for references', async () => {
        const owner: WorkspaceSymbolOwner = {
            kind: 'function',
            key: 'function:file:///D:/workspace/prototype.c:execute_command',
            name: 'execute_command'
        };
        const prototypeUri = 'file:///D:/workspace/prototype.c';
        const WorkspaceReferenceCollector = loadWorkspaceReferenceCollector();
        const collector = new WorkspaceReferenceCollector({
            host: createHost({
                [prototypeUri]: [
                    'private mapping execute_command(object actor, string arg);',
                    '',
                    'mapping execute_command(object actor, string arg)',
                    '{',
                    '    return ([]);',
                    '}',
                    '',
                    'void demo() { execute_command(this_player(), ""); }'
                ].join('\n')
            }),
            candidateEnumerator: createCandidateEnumerator({
                [prototypeUri]: [
                    { range: new vscode.Range(0, 16, 0, 31), symbolName: 'execute_command', isDeclaration: true },
                    { range: new vscode.Range(2, 8, 2, 23), symbolName: 'execute_command', isDeclaration: true },
                    { range: new vscode.Range(7, 14, 7, 29), symbolName: 'execute_command' }
                ]
            }),
            ownerResolver: createOwnerResolutionMap([
                [positionKey(prototypeUri, 0, 16), { kind: 'workspace-visible', owner }],
                [positionKey(prototypeUri, 2, 8), { kind: 'workspace-visible', owner }],
                [positionKey(prototypeUri, 7, 14), { kind: 'workspace-visible', owner }]
            ])
        });

        const matches = await collector.collect(owner, [prototypeUri], { includeDeclaration: true });

        expect(matches).toEqual(expect.arrayContaining([
            expect.objectContaining({ uri: prototypeUri, range: expect.objectContaining({ start: { line: 0, character: 16 } }) }),
            expect.objectContaining({ uri: prototypeUri, range: expect.objectContaining({ start: { line: 2, character: 8 } }) })
        ]));
    });

    test('prefers the open document snapshot over disk content when confirming owners', async () => {
        const owner = targetOwner();
        const roomUri = 'file:///D:/workspace/room.c';
        setOpenDocuments([{
            uri: roomUri,
            text: 'int query_id() { return 1; }',
            version: 7
        }]);

        const ownerResolver = createOwnerResolutionMap([
            [positionKey(roomUri, 0, 4, 7), { kind: 'workspace-visible', owner }],
            [positionKey(roomUri, 0, 4, 1), { kind: 'workspace-visible', owner: { kind: 'function', key: 'disk-owner', name: 'query_id' } }]
        ]);
        const WorkspaceReferenceCollector = loadWorkspaceReferenceCollector();
        const collector = new WorkspaceReferenceCollector({
            host: createHost({
                [roomUri]: 'int disk_query_id() { return 0; }'
            }),
            candidateEnumerator: createCandidateEnumerator({
                [roomUri]: [{ range: new vscode.Range(0, 4, 0, 12), symbolName: 'query_id', isDeclaration: true }]
            }),
            ownerResolver
        });

        const matches = await collector.collect(owner, [roomUri], { includeDeclaration: true });

        expect(matches[0].range.start.line).toBe(0);
        expect((ownerResolver.resolveOwner as jest.Mock).mock.calls[0][0].version).toBe(7);
    });
});
