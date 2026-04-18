import { describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';

interface WorkspaceSymbolOwner {
    kind: 'function' | 'global' | 'type';
    key: string;
    name: string;
}

interface WorkspaceOwnerResolution {
    kind: 'workspace-visible' | 'current-file-only' | 'ambiguous' | 'unsupported';
    owner?: WorkspaceSymbolOwner;
    reason?: string;
}

interface WorkspaceSymbolIndexView {
    getFunctionCandidateFiles(name: string): string[];
    getFileGlobalCandidateFiles(name: string): string[];
    getTypeCandidateFiles(name: string): string[];
}

interface WorkspaceSemanticIndexServiceLike {
    getIndexView(workspaceRoot: string): Promise<WorkspaceSymbolIndexView>;
}

interface WorkspaceSymbolOwnerResolverLike {
    resolveOwner(document: vscode.TextDocument, position: vscode.Position): Promise<WorkspaceOwnerResolution>;
}

interface WorkspaceReferenceCollectorLike {
    collect(
        owner: WorkspaceSymbolOwner,
        candidateFiles: string[],
        options: { includeDeclaration: boolean }
    ): Promise<Array<{ uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } }>>;
}

interface WorkspaceSymbolRelationServiceLike {
    collectReferences(
        document: vscode.TextDocument,
        position: vscode.Position,
        options: { includeDeclaration: boolean }
    ): Promise<any>;
    prepareRename(document: vscode.TextDocument, position: vscode.Position): Promise<any>;
    buildRenameEdit(document: vscode.TextDocument, position: vscode.Position, newName: string): Promise<any>;
}

type WorkspaceSymbolRelationServiceCtor = new (options: {
    ownerResolver: WorkspaceSymbolOwnerResolverLike;
    workspaceSemanticIndexService: WorkspaceSemanticIndexServiceLike;
    referenceCollector: WorkspaceReferenceCollectorLike;
}) => WorkspaceSymbolRelationServiceLike;

function createTextDocument(uriValue: string, source: string): vscode.TextDocument {
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

    return {
        uri,
        fileName: uri.fsPath,
        languageId: 'lpc',
        version: 1,
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
        save: jest.fn(async () => true),
        validateRange: jest.fn((range: vscode.Range) => range),
        validatePosition: jest.fn((position: vscode.Position) => position)
    } as unknown as vscode.TextDocument;
}

function positionOn(source: string, symbol: string, occurrence: number = 1): vscode.Position {
    let fromIndex = 0;
    let symbolIndex = -1;

    for (let seen = 0; seen < occurrence; seen += 1) {
        symbolIndex = source.indexOf(symbol, fromIndex);
        if (symbolIndex === -1) {
            throw new Error(`Could not find occurrence ${occurrence} of ${symbol}`);
        }

        fromIndex = symbolIndex + symbol.length;
    }

    const prefix = source.slice(0, symbolIndex);
    const line = prefix.split('\n').length - 1;
    const lastNewlineIndex = prefix.lastIndexOf('\n');
    const character = lastNewlineIndex === -1
        ? prefix.length
        : prefix.length - lastNewlineIndex - 1;

    return new vscode.Position(line, character + 1);
}

function createWorkspaceSemanticIndexService(view: WorkspaceSymbolIndexView): WorkspaceSemanticIndexServiceLike {
    return {
        getIndexView: jest.fn(async () => view)
    };
}

function loadWorkspaceSymbolRelationModule(): {
    WorkspaceSymbolRelationService: WorkspaceSymbolRelationServiceCtor;
    CURRENT_FILE_FALLBACK: symbol;
} {
    let modulePath: string;

    try {
        modulePath = require.resolve('../WorkspaceSymbolRelationService');
    } catch (error) {
        const moduleError = error as NodeJS.ErrnoException;
        if (moduleError.code === 'MODULE_NOT_FOUND') {
            throw new Error('WorkspaceSymbolRelationService is not implemented yet');
        }

        throw error;
    }

    const module = require(modulePath) as {
        WorkspaceSymbolRelationService?: WorkspaceSymbolRelationServiceCtor;
        CURRENT_FILE_FALLBACK?: symbol;
    };

    if (module.WorkspaceSymbolRelationService && module.CURRENT_FILE_FALLBACK) {
        return {
            WorkspaceSymbolRelationService: module.WorkspaceSymbolRelationService,
            CURRENT_FILE_FALLBACK: module.CURRENT_FILE_FALLBACK
        };
    }

    throw new Error('WorkspaceSymbolRelationService exports are not implemented yet');
}

function workspaceOwner(name: string): WorkspaceSymbolOwner {
    return {
        kind: 'function',
        key: `function:file:///D:/workspace/room.c:${name}`,
        name
    };
}

describe('WorkspaceSymbolRelationService', () => {
    test('returns workspace references for workspace-visible owners', async () => {
        const source = 'int demo() { return query_id(); }';
        const document = createTextDocument('file:///D:/workspace/room.c', source);
        const owner = workspaceOwner('query_id');
        const { WorkspaceSymbolRelationService } = loadWorkspaceSymbolRelationModule();
        const service = new WorkspaceSymbolRelationService({
            ownerResolver: {
                resolveOwner: jest.fn(async () => ({ kind: 'workspace-visible', owner }))
            },
            workspaceSemanticIndexService: createWorkspaceSemanticIndexService({
                getFunctionCandidateFiles: () => ['file:///D:/workspace/room.c', 'file:///D:/workspace/cmds/look.c'],
                getFileGlobalCandidateFiles: () => [],
                getTypeCandidateFiles: () => []
            }),
            referenceCollector: {
                collect: jest.fn(async () => ([
                    {
                        uri: 'file:///D:/workspace/room.c',
                        range: { start: { line: 0, character: 20 }, end: { line: 0, character: 28 } }
                    },
                    {
                        uri: 'file:///D:/workspace/cmds/look.c',
                        range: { start: { line: 0, character: 18 }, end: { line: 0, character: 26 } }
                    }
                ]))
            }
        });

        const refs = await service.collectReferences(document, positionOn(source, 'query_id'), { includeDeclaration: false });

        expect(refs).toHaveLength(2);
        expect(new Set(refs.map((item: any) => item.uri))).toEqual(new Set([
            'file:///D:/workspace/room.c',
            'file:///D:/workspace/cmds/look.c'
        ]));
    });

    test('routes file-global owners through file-global candidate selection before collecting references', async () => {
        const source = 'void demo() { COMBAT_D->start(); }';
        const document = createTextDocument('file:///D:/workspace/cmds/fight.c', source);
        const owner: WorkspaceSymbolOwner = {
            kind: 'global',
            key: 'global:file:///D:/workspace/daemon_user.c:COMBAT_D',
            name: 'COMBAT_D'
        };
        const indexView = {
            getFunctionCandidateFiles: jest.fn(() => []),
            getFileGlobalCandidateFiles: jest.fn(() => [
                'file:///D:/workspace/daemon_user.c',
                'file:///D:/workspace/cmds/fight.c'
            ]),
            getTypeCandidateFiles: jest.fn(() => [])
        };
        const { WorkspaceSymbolRelationService } = loadWorkspaceSymbolRelationModule();
        const service = new WorkspaceSymbolRelationService({
            ownerResolver: {
                resolveOwner: jest.fn(async () => ({ kind: 'workspace-visible', owner }))
            },
            workspaceSemanticIndexService: createWorkspaceSemanticIndexService(indexView),
            referenceCollector: {
                collect: jest.fn(async () => ([
                    {
                        uri: 'file:///D:/workspace/daemon_user.c',
                        range: { start: { line: 0, character: 7 }, end: { line: 0, character: 15 } }
                    },
                    {
                        uri: 'file:///D:/workspace/cmds/fight.c',
                        range: { start: { line: 0, character: 14 }, end: { line: 0, character: 22 } }
                    }
                ]))
            }
        });

        const refs = await service.collectReferences(document, positionOn(source, 'COMBAT_D'), { includeDeclaration: true });

        expect(indexView.getFileGlobalCandidateFiles).toHaveBeenCalledWith('COMBAT_D');
        expect(refs).toHaveLength(2);
        expect(new Set(refs.map((item: any) => item.uri))).toEqual(new Set([
            'file:///D:/workspace/daemon_user.c',
            'file:///D:/workspace/cmds/fight.c'
        ]));
    });

    test('returns the current-file fallback sentinel for locals and parameters', async () => {
        const source = 'int demo(int local_hp) { return local_hp; }';
        const document = createTextDocument('file:///D:/workspace/local.c', source);
        const { WorkspaceSymbolRelationService, CURRENT_FILE_FALLBACK } = loadWorkspaceSymbolRelationModule();
        const service = new WorkspaceSymbolRelationService({
            ownerResolver: {
                resolveOwner: jest.fn(async () => ({ kind: 'current-file-only' }))
            },
            workspaceSemanticIndexService: createWorkspaceSemanticIndexService({
                getFunctionCandidateFiles: () => [],
                getFileGlobalCandidateFiles: () => [],
                getTypeCandidateFiles: () => []
            }),
            referenceCollector: {
                collect: jest.fn()
            }
        });

        const result = await service.collectReferences(document, positionOn(source, 'local_hp', 2), { includeDeclaration: true });

        expect(result).toBe(CURRENT_FILE_FALLBACK);
    });

    test('prepareRename stays undefined when owner resolution is ambiguous', async () => {
        const source = 'private mapping execute_command(object actor, string arg);';
        const document = createTextDocument('file:///D:/workspace/include/command.h', source);
        const { WorkspaceSymbolRelationService } = loadWorkspaceSymbolRelationModule();
        const service = new WorkspaceSymbolRelationService({
            ownerResolver: {
                resolveOwner: jest.fn(async () => ({ kind: 'ambiguous', reason: 'cross-file callable family' }))
            },
            workspaceSemanticIndexService: createWorkspaceSemanticIndexService({
                getFunctionCandidateFiles: () => ['file:///D:/workspace/include/command.h', 'file:///D:/workspace/cmds/command.c'],
                getFileGlobalCandidateFiles: () => [],
                getTypeCandidateFiles: () => []
            }),
            referenceCollector: {
                collect: jest.fn()
            }
        });

        const prepared = await service.prepareRename(document, positionOn(source, 'execute_command'));

        expect(prepared).toBeUndefined();
    });

    test('buildRenameEdit returns multi-uri edits only when every match reconfirms the same owner', async () => {
        const source = 'int demo() { return query_id(); }';
        const document = createTextDocument('file:///D:/workspace/room.c', source);
        const owner = workspaceOwner('query_id');
        const { WorkspaceSymbolRelationService } = loadWorkspaceSymbolRelationModule();
        const service = new WorkspaceSymbolRelationService({
            ownerResolver: {
                resolveOwner: jest.fn(async () => ({ kind: 'workspace-visible', owner }))
            },
            workspaceSemanticIndexService: createWorkspaceSemanticIndexService({
                getFunctionCandidateFiles: () => ['file:///D:/workspace/room.c', 'file:///D:/workspace/cmds/look.c'],
                getFileGlobalCandidateFiles: () => [],
                getTypeCandidateFiles: () => []
            }),
            referenceCollector: {
                collect: jest.fn(async () => ([
                    {
                        uri: 'file:///D:/workspace/room.c',
                        range: { start: { line: 0, character: 20 }, end: { line: 0, character: 28 } }
                    },
                    {
                        uri: 'file:///D:/workspace/cmds/look.c',
                        range: { start: { line: 0, character: 18 }, end: { line: 0, character: 26 } }
                    }
                ]))
            }
        });

        const edit = await service.buildRenameEdit(document, positionOn(source, 'query_id'), 'query_name');

        expect(new Set(Object.keys(edit.changes))).toEqual(new Set([
            'file:///D:/workspace/room.c',
            'file:///D:/workspace/cmds/look.c'
        ]));
    });

    test('same-file prototype and implementation are renamed as one callable family', async () => {
        const source = [
            'private mapping execute_command(object actor, string arg);',
            '',
            'mapping execute_command(object actor, string arg)',
            '{',
            '    return ([]);',
            '}',
            '',
            'void demo() { execute_command(this_player(), ""); }'
        ].join('\n');
        const document = createTextDocument('file:///D:/workspace/prototype.c', source);
        const owner = workspaceOwner('execute_command');
        const { WorkspaceSymbolRelationService } = loadWorkspaceSymbolRelationModule();
        const service = new WorkspaceSymbolRelationService({
            ownerResolver: {
                resolveOwner: jest.fn(async () => ({ kind: 'workspace-visible', owner }))
            },
            workspaceSemanticIndexService: createWorkspaceSemanticIndexService({
                getFunctionCandidateFiles: () => ['file:///D:/workspace/prototype.c'],
                getFileGlobalCandidateFiles: () => [],
                getTypeCandidateFiles: () => []
            }),
            referenceCollector: {
                collect: jest.fn(async () => ([
                    {
                        uri: 'file:///D:/workspace/prototype.c',
                        range: { start: { line: 0, character: 16 }, end: { line: 0, character: 31 } }
                    },
                    {
                        uri: 'file:///D:/workspace/prototype.c',
                        range: { start: { line: 2, character: 8 }, end: { line: 2, character: 23 } }
                    },
                    {
                        uri: 'file:///D:/workspace/prototype.c',
                        range: { start: { line: 7, character: 14 }, end: { line: 7, character: 29 } }
                    }
                ]))
            }
        });

        const edit = await service.buildRenameEdit(document, positionOn(source, 'execute_command', 1), 'perform_command');

        expect(edit.changes['file:///D:/workspace/prototype.c']).toEqual(expect.arrayContaining([
            expect.objectContaining({ newText: 'perform_command', range: expect.objectContaining({ start: { line: 0, character: 16 } }) }),
            expect.objectContaining({ newText: 'perform_command', range: expect.objectContaining({ start: { line: 2, character: 8 } }) })
        ]));
    });
});
