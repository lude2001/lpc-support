import { afterEach, describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import { DocumentSemanticSnapshotService } from '../../../../completion/documentSemanticSnapshotService';
import { createNavigationCapabilityContext } from '../../../../lsp/server/handlers/navigation/navigationHandlerContext';
import { DocumentStore } from '../../../../lsp/server/runtime/DocumentStore';
import { WorkspaceSession } from '../../../../lsp/server/runtime/WorkspaceSession';
import { clearGlobalParsedDocumentService } from '../../../../parser/ParsedDocumentService';

interface WorkspaceSymbolIndexView {
    getFunctionCandidateFiles(name: string): string[];
    getFileGlobalCandidateFiles(name: string): string[];
    getTypeCandidateFiles(name: string): string[];
}

interface WorkspaceSemanticIndexServiceLike {
    getIndexView(workspaceRoot: string): Promise<WorkspaceSymbolIndexView>;
}

interface WorkspaceSymbolOwnerResolverLike {
    resolveOwner(document: vscode.TextDocument, position: vscode.Position): Promise<any>;
}

type WorkspaceSymbolOwnerResolverCtor = new (options: {
    workspaceSemanticIndexService: WorkspaceSemanticIndexServiceLike;
}) => WorkspaceSymbolOwnerResolverLike;

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

function createWorkspaceSemanticIndexService(options: {
    functions?: Record<string, string[]>;
    fileGlobals?: Record<string, string[]>;
    types?: Record<string, string[]>;
}): WorkspaceSemanticIndexServiceLike {
    return {
        getIndexView: jest.fn(async () => ({
            getFunctionCandidateFiles: (name: string) => options.functions?.[name] ?? [],
            getFileGlobalCandidateFiles: (name: string) => options.fileGlobals?.[name] ?? [],
            getTypeCandidateFiles: (name: string) => options.types?.[name] ?? []
        }))
    };
}

function loadWorkspaceSymbolOwnerResolver(): WorkspaceSymbolOwnerResolverCtor {
    let modulePath: string;

    try {
        modulePath = require.resolve('../WorkspaceSymbolOwnerResolver');
    } catch (error) {
        const moduleError = error as NodeJS.ErrnoException;
        if (moduleError.code === 'MODULE_NOT_FOUND') {
            throw new Error('WorkspaceSymbolOwnerResolver is not implemented yet');
        }

        throw error;
    }

    const module = require(modulePath) as {
        WorkspaceSymbolOwnerResolver?: WorkspaceSymbolOwnerResolverCtor;
    };

    if (module.WorkspaceSymbolOwnerResolver) {
        return module.WorkspaceSymbolOwnerResolver;
    }

    throw new Error('WorkspaceSymbolOwnerResolver export is not implemented yet');
}

function canonicalOwnerLine(owner: any): number | undefined {
    return owner?.canonicalRange?.start?.line
        ?? owner?.canonicalDeclarationRange?.start?.line
        ?? owner?.declarationRange?.start?.line
        ?? owner?.canonicalDeclarationLine;
}

describe('WorkspaceSymbolOwnerResolver', () => {
    afterEach(() => {
        DocumentSemanticSnapshotService.getInstance().clear();
        clearGlobalParsedDocumentService();
    });

    test('returns workspace-visible owner for a uniquely declared function', async () => {
        const source = [
            'int query_id() { return 1; }',
            'int demo() { return query_id(); }'
        ].join('\n');
        const document = createTextDocument('file:///D:/workspace/room.c', source);
        const WorkspaceSymbolOwnerResolver = loadWorkspaceSymbolOwnerResolver();
        const resolver = new WorkspaceSymbolOwnerResolver({
            workspaceSemanticIndexService: createWorkspaceSemanticIndexService({
                functions: {
                    query_id: [document.uri.toString()]
                }
            })
        });

        const result = await resolver.resolveOwner(document, positionOn(source, 'query_id', 2));

        expect(result.kind).toBe('workspace-visible');
        expect(result.owner.kind).toBe('function');
        expect(result.owner.key).toContain('function:file:///D:/workspace/room.c');
    });

    test('accepts LSP runtime shim ranges when resolving current-file-only locals', async () => {
        const source = [
            'void demo() {',
            '    int local_hp = 1;',
            '    local_hp += 1;',
            '}'
        ].join('\n');
        const documentUri = 'file:///D:/workspace/local.c';
        const documentStore = new DocumentStore();
        documentStore.open(documentUri, 1, source);
        const workspaceSession = new WorkspaceSession({
            workspaceRoots: ['D:/workspace']
        });
        const context = createNavigationCapabilityContext(documentUri, documentStore, workspaceSession);
        const WorkspaceSymbolOwnerResolver = loadWorkspaceSymbolOwnerResolver();
        const resolver = new WorkspaceSymbolOwnerResolver({
            workspaceSemanticIndexService: createWorkspaceSemanticIndexService({})
        });

        const result = await resolver.resolveOwner(
            context.document as vscode.TextDocument,
            new vscode.Position(2, 6)
        );

        expect(result.kind).toBe('current-file-only');
    });

    test('keeps a locally resolved declaration workspace-visible even when another file declares the same name', async () => {
        const source = [
            'int query_id() { return 1; }',
            'int demo() { return query_id(); }'
        ].join('\n');
        const document = createTextDocument('file:///D:/workspace/room.c', source);
        const WorkspaceSymbolOwnerResolver = loadWorkspaceSymbolOwnerResolver();
        const resolver = new WorkspaceSymbolOwnerResolver({
            workspaceSemanticIndexService: createWorkspaceSemanticIndexService({
                functions: {
                    query_id: [
                        document.uri.toString(),
                        'file:///D:/workspace/other_room.c'
                    ]
                }
            })
        });

        const result = await resolver.resolveOwner(document, positionOn(source, 'query_id'));

        expect(result.kind).toBe('workspace-visible');
        expect(result.owner.kind).toBe('function');
        expect(result.owner.key).toContain('function:file:///D:/workspace/room.c');
    });

    test('treats locals and parameters as current-file only', async () => {
        const source = [
            'int demo(object actor) {',
            '    int local_hp = actor->query_hp();',
            '    return local_hp;',
            '}'
        ].join('\n');
        const document = createTextDocument('file:///D:/workspace/local.c', source);
        const WorkspaceSymbolOwnerResolver = loadWorkspaceSymbolOwnerResolver();
        const resolver = new WorkspaceSymbolOwnerResolver({
            workspaceSemanticIndexService: createWorkspaceSemanticIndexService({})
        });

        const parameterResult = await resolver.resolveOwner(document, positionOn(source, 'actor', 1));
        const localResult = await resolver.resolveOwner(document, positionOn(source, 'local_hp', 2));

        expect(parameterResult.kind).toBe('current-file-only');
        expect(localResult.kind).toBe('current-file-only');
    });

    test('returns workspace-visible owner for a uniquely declared file global', async () => {
        const source = [
            'object COMBAT_D = load_object("/adm/daemons/combat_d");',
            'void demo() { COMBAT_D->start(); }'
        ].join('\n');
        const document = createTextDocument('file:///D:/workspace/daemon_user.c', source);
        const WorkspaceSymbolOwnerResolver = loadWorkspaceSymbolOwnerResolver();
        const resolver = new WorkspaceSymbolOwnerResolver({
            workspaceSemanticIndexService: createWorkspaceSemanticIndexService({
                fileGlobals: {
                    COMBAT_D: [document.uri.toString()]
                }
            })
        });

        const result = await resolver.resolveOwner(document, positionOn(source, 'COMBAT_D', 2));

        expect(result.kind).toBe('workspace-visible');
        expect(result.owner.kind).toBe('global');
        expect(result.owner.key).toContain('global:file:///D:/workspace/daemon_user.c');
    });

    test('returns workspace-visible owner for a uniquely declared type definition', async () => {
        const source = [
            'class Payload { int hp; }',
            'class Payload build() {',
            '    class Payload payload = new(class Payload);',
            '    return payload;',
            '}'
        ].join('\n');
        const document = createTextDocument('file:///D:/workspace/types.c', source);
        const WorkspaceSymbolOwnerResolver = loadWorkspaceSymbolOwnerResolver();
        const resolver = new WorkspaceSymbolOwnerResolver({
            workspaceSemanticIndexService: createWorkspaceSemanticIndexService({
                types: {
                    Payload: [document.uri.toString()]
                }
            })
        });

        const result = await resolver.resolveOwner(document, positionOn(source, 'Payload', 3));

        expect(result.kind).toBe('workspace-visible');
        expect(result.owner.kind).toBe('type');
        expect(result.owner.key).toContain('type:file:///D:/workspace/types.c');
    });

    test('uses the implementation as canonical owner when a same-file prototype exists', async () => {
        const source = [
            'private mapping execute_command(object actor, string arg);',
            '',
            'mapping execute_command(object actor, string arg)',
            '{',
            '    return ([]);',
            '}'
        ].join('\n');
        const document = createTextDocument('file:///D:/workspace/prototype.c', source);
        const WorkspaceSymbolOwnerResolver = loadWorkspaceSymbolOwnerResolver();
        const resolver = new WorkspaceSymbolOwnerResolver({
            workspaceSemanticIndexService: createWorkspaceSemanticIndexService({
                functions: {
                    execute_command: [document.uri.toString()]
                }
            })
        });

        const result = await resolver.resolveOwner(document, positionOn(source, 'execute_command', 1));

        expect(result.kind).toBe('workspace-visible');
        expect(result.owner.kind).toBe('function');
        expect(canonicalOwnerLine(result.owner)).toBe(2);
    });

    test('returns ambiguous for cross-file prototype/implementation pairs that cannot be proven equivalent', async () => {
        const source = 'private mapping execute_command(object actor, string arg);';
        const document = createTextDocument('file:///D:/workspace/include/command.h', source);
        const WorkspaceSymbolOwnerResolver = loadWorkspaceSymbolOwnerResolver();
        const resolver = new WorkspaceSymbolOwnerResolver({
            workspaceSemanticIndexService: createWorkspaceSemanticIndexService({
                functions: {
                    execute_command: [
                        document.uri.toString(),
                        'file:///D:/workspace/cmds/command.c'
                    ]
                }
            })
        });

        const result = await resolver.resolveOwner(document, positionOn(source, 'execute_command'));

        expect(result.kind).toBe('ambiguous');
    });

    test('does not upgrade unresolved external tokens to workspace-visible owners using name uniqueness alone', async () => {
        const source = 'int look() { return query_id(); }';
        const document = createTextDocument('file:///D:/workspace/cmds/look.c', source);
        const WorkspaceSymbolOwnerResolver = loadWorkspaceSymbolOwnerResolver();
        const resolver = new WorkspaceSymbolOwnerResolver({
            workspaceSemanticIndexService: createWorkspaceSemanticIndexService({
                functions: {
                    query_id: ['file:///D:/workspace/room.c']
                }
            })
        });

        const result = await resolver.resolveOwner(document, positionOn(source, 'query_id'));

        expect(result.kind).toBe('unsupported');
    });
});
