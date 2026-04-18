import { afterEach, describe, expect, jest, test } from '@jest/globals';
import * as path from 'path';
import * as vscode from 'vscode';
import { DocumentSemanticSnapshotService } from '../../../../completion/documentSemanticSnapshotService';
import { clearGlobalParsedDocumentService } from '../../../../parser/ParsedDocumentService';

interface WorkspaceSymbolIndexView {
    getFunctionCandidateFiles(name: string): string[];
    getFileGlobalCandidateFiles(name: string): string[];
    getTypeCandidateFiles(name: string): string[];
}

interface WorkspaceSemanticIndexServiceLike {
    getIndexView(workspaceRoot: string): Promise<WorkspaceSymbolIndexView>;
}

type WorkspaceSemanticIndexServiceCtor = new (options: { host: WorkspaceSemanticIndexHost }) => WorkspaceSemanticIndexServiceLike;

interface WorkspaceSemanticIndexHost {
    findFiles(pattern: vscode.RelativePattern): Promise<readonly vscode.Uri[]>;
    openTextDocument(target: string | vscode.Uri): Promise<vscode.TextDocument>;
    getWorkspaceFolders(): readonly { uri: { fsPath: string } }[] | undefined;
}

interface OpenDocumentFixture {
    uri: string;
    text: string;
    version: number;
}

interface HostFixtureOptions {
    files: string[];
    texts: Record<string, string>;
    openDocuments?: OpenDocumentFixture[];
    workspaceRoots?: string[];
}

const originalTextDocumentsDescriptor = Object.getOwnPropertyDescriptor(vscode.workspace, 'textDocuments');

function toCanonicalFileUriParts(uriValue: string): { canonicalUri: string; fsPath: string } {
    const rawPath = uriValue
        .replace(/^file:\/*/i, '')
        .replace(/\\/g, '/')
        .replace(/^\/+([A-Za-z]:)/, '$1');

    return {
        canonicalUri: `file:///${rawPath}`,
        fsPath: rawPath
    };
}

function createTextDocument(uriValue: string, source: string, version: number = 1): vscode.TextDocument {
    const uriParts = toCanonicalFileUriParts(uriValue);
    const uri = {
        fsPath: uriParts.fsPath,
        toString: () => uriParts.canonicalUri
    } as vscode.Uri;
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

function toFixtureUriKey(uri: vscode.Uri): string {
    return toCanonicalFileUriParts(uri.toString()).canonicalUri;
}

function setOpenDocuments(fixtures: OpenDocumentFixture[] = []): void {
    const documents = fixtures.map((fixture) => createTextDocument(fixture.uri, fixture.text, fixture.version));
    Object.defineProperty(vscode.workspace, 'textDocuments', {
        configurable: true,
        get: () => documents
    });
}

function deriveWorkspaceRoots(files: string[], explicitRoots?: string[]): string[] {
    if (explicitRoots && explicitRoots.length > 0) {
        return explicitRoots;
    }

    return Array.from(new Set(files.map((fileUri) => path.dirname(vscode.Uri.parse(fileUri).fsPath))));
}

function escapeForRegex(value: string): string {
    return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function toRelativePatternRegex(globPattern: string): RegExp {
    const normalizedPattern = globPattern.replace(/\\/g, '/');
    let regexSource = '';

    for (let index = 0; index < normalizedPattern.length; index += 1) {
        const current = normalizedPattern[index];
        const next = normalizedPattern[index + 1];

        if (current === '*' && next === '*') {
            regexSource += '.*';
            index += 1;
            continue;
        }

        if (current === '*') {
            regexSource += '[^/]*';
            continue;
        }

        if (current === '?') {
            regexSource += '.';
            continue;
        }

        regexSource += escapeForRegex(current);
    }

    return new RegExp(`^${regexSource}$`, 'i');
}

function matchesRelativePattern(uri: vscode.Uri, pattern: vscode.RelativePattern): boolean {
    const base = typeof (pattern as any).base === 'string'
        ? path.normalize((pattern as any).base)
        : (pattern as any).baseUri?.fsPath
            ? path.normalize((pattern as any).baseUri.fsPath)
            : '';
    const fsPath = path.normalize(uri.fsPath);
    const relativeToBase = base ? path.relative(base, fsPath) : '';
    if (
        base
        && relativeToBase !== ''
        && (relativeToBase.startsWith('..') || path.isAbsolute(relativeToBase))
    ) {
        return false;
    }

    const rawPattern = typeof (pattern as any).pattern === 'string'
        ? (pattern as any).pattern
        : '**/*';
    const relativePath = base
        ? relativeToBase.replace(/\\/g, '/')
        : fsPath.replace(/\\/g, '/');

    return toRelativePatternRegex(rawPattern).test(relativePath);
}

function createHost(options: HostFixtureOptions): WorkspaceSemanticIndexHost {
    const workspaceRoots = deriveWorkspaceRoots(options.files, options.workspaceRoots);
    setOpenDocuments(options.openDocuments);

    return {
        findFiles: jest.fn(async (pattern: vscode.RelativePattern) => {
            return options.files
                .map((fileUri) => vscode.Uri.parse(fileUri))
                .filter((uri) => matchesRelativePattern(uri, pattern));
        }),
        openTextDocument: jest.fn(async (target: string | vscode.Uri) => {
            const uri = typeof target === 'string'
                ? vscode.Uri.parse(target)
                : target;
            const text = options.texts[toFixtureUriKey(uri)];
            if (typeof text !== 'string') {
                throw new Error(`No fixture text for ${toFixtureUriKey(uri)}`);
            }

            return createTextDocument(toFixtureUriKey(uri), text);
        }),
        getWorkspaceFolders: jest.fn(() => workspaceRoots.map((workspaceRoot) => ({
            uri: { fsPath: workspaceRoot }
        })))
    };
}

function loadWorkspaceSemanticIndexService(): WorkspaceSemanticIndexServiceCtor {
    let modulePath: string;

    try {
        modulePath = require.resolve('../WorkspaceSemanticIndexService');
    } catch (error) {
        const moduleError = error as NodeJS.ErrnoException;
        if (moduleError.code === 'MODULE_NOT_FOUND') {
            throw new Error('WorkspaceSemanticIndexService is not implemented yet');
        }

        throw error;
    }

    const module = require(modulePath) as {
        WorkspaceSemanticIndexService?: WorkspaceSemanticIndexServiceCtor;
    };

    if (module.WorkspaceSemanticIndexService) {
        return module.WorkspaceSemanticIndexService;
    }

    throw new Error('WorkspaceSemanticIndexService export is not implemented yet');
}

describe('WorkspaceSemanticIndexService', () => {
    afterEach(() => {
        DocumentSemanticSnapshotService.getInstance().clear();
        clearGlobalParsedDocumentService();

        if (originalTextDocumentsDescriptor) {
            Object.defineProperty(vscode.workspace, 'textDocuments', originalTextDocumentsDescriptor);
        } else {
            delete (vscode.workspace as any).textDocuments;
        }
    });

    test('indexes unopened workspace files through host findFiles/openTextDocument', async () => {
        const host = createHost({
            files: ['file:///D:/workspace/a.c', 'file:///D:/workspace/b.c'],
            texts: {
                'file:///D:/workspace/a.c': 'int query_id() { return 1; }',
                'file:///D:/workspace/b.c': 'int demo() { return query_id(); }'
            }
        });

        const WorkspaceSemanticIndexService = loadWorkspaceSemanticIndexService();
        const service = new WorkspaceSemanticIndexService({ host });
        const view = await service.getIndexView('D:/workspace');

        expect(view.getFunctionCandidateFiles('query_id')).toContain('file:///D:/workspace/a.c');
    });

    test('prefers open document text over disk text for the active workspace file', async () => {
        const host = createHost({
            files: ['file:///D:/workspace/room.c'],
            texts: {
                'file:///D:/workspace/room.c': 'int old_name() { return 1; }'
            },
            openDocuments: [{
                uri: 'file:///D:/workspace/room.c',
                text: 'int new_name() { return 1; }',
                version: 7
            }]
        });

        const WorkspaceSemanticIndexService = loadWorkspaceSemanticIndexService();
        const service = new WorkspaceSemanticIndexService({ host });
        const view = await service.getIndexView('D:/workspace');

        expect(view.getFunctionCandidateFiles('new_name')).toContain('file:///D:/workspace/room.c');
        expect(view.getFunctionCandidateFiles('old_name')).toEqual([]);
    });

    test('does not mix candidate files across workspace roots', async () => {
        const host = createHost({
            files: ['file:///D:/alpha/query.c', 'file:///D:/beta/query.c'],
            texts: {
                'file:///D:/alpha/query.c': 'int query_id() { return 1; }',
                'file:///D:/beta/query.c': 'int query_id() { return 2; }'
            },
            workspaceRoots: ['D:/alpha', 'D:/beta']
        });

        const WorkspaceSemanticIndexService = loadWorkspaceSemanticIndexService();
        const service = new WorkspaceSemanticIndexService({ host });
        const alphaView = await service.getIndexView('D:/alpha');

        expect(alphaView.getFunctionCandidateFiles('query_id')).toEqual(['file:///D:/alpha/query.c']);
    });

    test('exposes candidate files for fileGlobals through the workspace index view', async () => {
        const host = createHost({
            files: ['file:///D:/workspace/room.c'],
            texts: {
                'file:///D:/workspace/room.c': 'object COMBAT_D; void demo() { COMBAT_D = 0; }'
            }
        });

        const WorkspaceSemanticIndexService = loadWorkspaceSemanticIndexService();
        const service = new WorkspaceSemanticIndexService({ host });
        const view = await service.getIndexView('D:/workspace');

        expect(view.getFileGlobalCandidateFiles('COMBAT_D')).toEqual(['file:///D:/workspace/room.c']);
    });

    test('exposes candidate files for type definitions through the workspace index view', async () => {
        const host = createHost({
            files: ['file:///D:/workspace/types.c'],
            texts: {
                'file:///D:/workspace/types.c': 'class Payload { int hp; }'
            }
        });

        const WorkspaceSemanticIndexService = loadWorkspaceSemanticIndexService();
        const service = new WorkspaceSemanticIndexService({ host });
        const view = await service.getIndexView('D:/workspace');

        expect(view.getTypeCandidateFiles('Payload')).toEqual(['file:///D:/workspace/types.c']);
    });

    test('keeps function candidate queries available through the workspace index view', async () => {
        const host = createHost({
            files: ['file:///D:/workspace/query.c'],
            texts: {
                'file:///D:/workspace/query.c': 'int query_id() { return 1; }'
            }
        });

        const WorkspaceSemanticIndexService = loadWorkspaceSemanticIndexService();
        const service = new WorkspaceSemanticIndexService({ host });
        const view = await service.getIndexView('D:/workspace');

        expect(view.getFunctionCandidateFiles('query_id')).toEqual(['file:///D:/workspace/query.c']);
    });

    test('refreshes workspace discovery while avoiding a full cold rebuild on repeated requests', async () => {
        const host = createHost({
            files: ['file:///D:/workspace/query.c'],
            texts: {
                'file:///D:/workspace/query.c': 'int query_id() { return 1; }'
            }
        });

        const WorkspaceSemanticIndexService = loadWorkspaceSemanticIndexService();
        const service = new WorkspaceSemanticIndexService({ host });

        await service.getIndexView('D:/workspace');
        await service.getIndexView('D:/workspace');

        expect(host.findFiles).toHaveBeenCalledTimes(8);
        expect(host.openTextDocument).toHaveBeenCalledTimes(2);
    });

    test('refreshes cached open-document entries when document versions change', async () => {
        const host = createHost({
            files: ['file:///D:/workspace/room.c'],
            texts: {
                'file:///D:/workspace/room.c': 'int disk_name() { return 1; }'
            },
            openDocuments: [{
                uri: 'file:///D:/workspace/room.c',
                text: 'int old_name() { return 1; }',
                version: 7
            }]
        });

        const WorkspaceSemanticIndexService = loadWorkspaceSemanticIndexService();
        const service = new WorkspaceSemanticIndexService({ host });

        const firstView = await service.getIndexView('D:/workspace');
        expect(firstView.getFunctionCandidateFiles('old_name')).toEqual(['file:///D:/workspace/room.c']);

        setOpenDocuments([{
            uri: 'file:///D:/workspace/room.c',
            text: 'int new_name() { return 1; }',
            version: 8
        }]);

        const secondView = await service.getIndexView('D:/workspace');
        expect(secondView.getFunctionCandidateFiles('new_name')).toEqual(['file:///D:/workspace/room.c']);
        expect(secondView.getFunctionCandidateFiles('old_name')).toEqual([]);
        expect(host.openTextDocument).not.toHaveBeenCalled();
    });

    test('adds new unopened files and removes deleted unopened files after discovery refresh', async () => {
        const files = ['file:///D:/workspace/query.c'];
        const texts: Record<string, string> = {
            'file:///D:/workspace/query.c': 'int query_id() { return 1; }'
        };
        const host = createHost({ files, texts });

        const WorkspaceSemanticIndexService = loadWorkspaceSemanticIndexService();
        const service = new WorkspaceSemanticIndexService({ host });

        const firstView = await service.getIndexView('D:/workspace');
        expect(firstView.getFunctionCandidateFiles('query_id')).toEqual(['file:///D:/workspace/query.c']);

        files.splice(0, files.length, 'file:///D:/workspace/new_query.c');
        delete texts['file:///D:/workspace/query.c'];
        texts['file:///D:/workspace/new_query.c'] = 'int new_query() { return 1; }';

        const secondView = await service.getIndexView('D:/workspace');
        expect(secondView.getFunctionCandidateFiles('query_id')).toEqual([]);
        expect(secondView.getFunctionCandidateFiles('new_query')).toEqual(['file:///D:/workspace/new_query.c']);
    });

    test('revalidates cached unopened file entries when disk content changes', async () => {
        const texts: Record<string, string> = {
            'file:///D:/workspace/room.c': 'int old_disk_name() { return 1; }'
        };
        const host = createHost({
            files: ['file:///D:/workspace/room.c'],
            texts
        });

        const WorkspaceSemanticIndexService = loadWorkspaceSemanticIndexService();
        const service = new WorkspaceSemanticIndexService({ host });

        const firstView = await service.getIndexView('D:/workspace');
        expect(firstView.getFunctionCandidateFiles('old_disk_name')).toEqual(['file:///D:/workspace/room.c']);

        texts['file:///D:/workspace/room.c'] = 'int new_disk_name() { return 1; }';

        const secondView = await service.getIndexView('D:/workspace');
        expect(secondView.getFunctionCandidateFiles('new_disk_name')).toEqual(['file:///D:/workspace/room.c']);
        expect(secondView.getFunctionCandidateFiles('old_disk_name')).toEqual([]);
    });
});
