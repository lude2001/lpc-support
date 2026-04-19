import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { InheritanceResolver } from '../../../../completion/inheritanceResolver';
import { ProjectSymbolIndex } from '../../../../completion/projectSymbolIndex';

declare const require: any;

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
        getText: () => content,
        lineAt: (lineOrPosition: number | vscode.Position) => {
            const line = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
            return { text: lines[line] ?? '' };
        },
        positionAt: (offset: number) => {
            let line = 0;
            for (let index = 0; index < lineStarts.length; index += 1) {
                if (lineStarts[index] <= offset) {
                    line = index;
                } else {
                    break;
                }
            }

            return new vscode.Position(line, offset - lineStarts[line]);
        },
        offsetAt: (position: vscode.Position) => offsetAt(position)
    } as unknown as vscode.TextDocument;
}

function createSnapshot(
    document: vscode.TextDocument,
    options?: {
        functionName?: string;
        inherits?: string[];
        createdAt?: number;
    }
): any {
    const functionName = options?.functionName ?? path.basename(document.fileName, '.c');
    const inherits = options?.inherits ?? [];

    return {
        uri: document.uri.toString(),
        version: document.version,
        parseDiagnostics: [],
        exportedFunctions: [{
            name: functionName,
            returnType: 'void',
            parameters: [],
            modifiers: [],
            sourceUri: document.uri.toString(),
            range: new vscode.Range(0, 0, 0, functionName.length),
            origin: 'local',
            definition: `void ${functionName}() {}`
        }],
        localScopes: [],
        typeDefinitions: [],
        fileGlobals: [],
        inheritStatements: inherits.map((inheritValue, index) => ({
            rawText: `inherit "${inheritValue}";`,
            expressionKind: 'string',
            value: inheritValue,
            range: new vscode.Range(index, 0, index, inheritValue.length + 10),
            isResolved: false
        })),
        includeStatements: [],
        macroReferences: [],
        createdAt: options?.createdAt ?? Date.now()
    };
}

function loadService(): any {
    return require('../CompletionInheritedIndexService').CompletionInheritedIndexService;
}

describe('CompletionInheritedIndexService', () => {
    const originalTextDocuments = (vscode.workspace as any).textDocuments;
    let workspaceRoot: string;

    beforeEach(() => {
        workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'completion-inherited-index-'));
        Object.defineProperty(vscode.workspace, 'textDocuments', {
            configurable: true,
            value: []
        });
    });

    afterEach(() => {
        fs.rmSync(workspaceRoot, { recursive: true, force: true });
        Object.defineProperty(vscode.workspace, 'textDocuments', {
            configurable: true,
            value: originalTextDocuments ?? []
        });
    });

    test('refreshInheritedIndex updates ProjectSymbolIndex from the current document snapshot', () => {
        const CompletionInheritedIndexService = loadService();
        const rootPath = path.join(workspaceRoot, 'root.c');
        fs.writeFileSync(rootPath, 'void root() {}\n');
        const rootDocument = createDocument(rootPath, 'void root() {}\n', 3);
        const rootSnapshot = createSnapshot(rootDocument, { functionName: 'root_refresh' });
        const analysisService = {
            getBestAvailableSemanticSnapshot: jest.fn(() => rootSnapshot),
            getSemanticSnapshot: jest.fn(() => rootSnapshot),
            getBestAvailableSnapshot: jest.fn(() => rootSnapshot),
            getSnapshot: jest.fn(() => rootSnapshot)
        };
        const projectSymbolIndex = new ProjectSymbolIndex(
            new InheritanceResolver(undefined as any, [workspaceRoot])
        );
        const service = new CompletionInheritedIndexService(
            analysisService as any,
            projectSymbolIndex,
            { appendLine: jest.fn(), clear: jest.fn(), show: jest.fn() }
        );

        const indexedSnapshot = service.refreshInheritedIndex(rootDocument);

        expect(indexedSnapshot.uri).toBe(rootDocument.uri.toString());
        expect(projectSymbolIndex.getRecord(rootDocument.uri.toString())?.exportedFunctions.map(func => func.name)).toEqual([
            'root_refresh'
        ]);
        expect(analysisService.getBestAvailableSemanticSnapshot).toHaveBeenCalledWith(rootDocument);
    });

    test('recursive inherit indexing prefers already-open documents before readonly disk fallback', () => {
        const CompletionInheritedIndexService = loadService();
        const rootPath = path.join(workspaceRoot, 'root.c');
        const parentPath = path.join(workspaceRoot, 'parent.c');
        const grandPath = path.join(workspaceRoot, 'grand.c');
        fs.writeFileSync(rootPath, 'inherit "parent";\n');
        fs.writeFileSync(parentPath, 'inherit "grand";\nvoid parent_disk() {}\n');
        fs.writeFileSync(grandPath, 'void grand_disk() {}\n');

        const rootDocument = createDocument(rootPath, 'inherit "parent";\n', 1);
        const openParentDocument = createDocument(parentPath, 'inherit "grand";\nvoid parent_open() {}\n', 7);
        const grandDiskDocument = createDocument(grandPath, 'void grand_disk() {}\n', 1);

        const rootSnapshot = createSnapshot(rootDocument, { functionName: 'root', inherits: ['parent'] });
        const parentOpenSnapshot = createSnapshot(openParentDocument, { functionName: 'parent_open', inherits: ['grand'] });
        const parentDiskSnapshot = createSnapshot(createDocument(parentPath, 'inherit "grand";\nvoid parent_disk() {}\n', 1), {
            functionName: 'parent_disk',
            inherits: ['grand']
        });
        const grandSnapshot = createSnapshot(grandDiskDocument, { functionName: 'grand_disk' });

        Object.defineProperty(vscode.workspace, 'textDocuments', {
            configurable: true,
            value: [openParentDocument]
        });

        const analysisService = {
            getBestAvailableSemanticSnapshot: jest.fn((document: vscode.TextDocument) => {
                if (document.uri.toString() === rootDocument.uri.toString()) {
                    return rootSnapshot;
                }

                if (document.uri.toString() === openParentDocument.uri.toString()) {
                    return document.version === 7 ? parentOpenSnapshot : parentDiskSnapshot;
                }

                if (document.uri.toString() === grandDiskDocument.uri.toString()) {
                    return grandSnapshot;
                }

                throw new Error(`Unexpected best-available request for ${document.uri.toString()}`);
            }),
            getSemanticSnapshot: jest.fn((document: vscode.TextDocument) => {
                if (document.uri.toString() === rootDocument.uri.toString()) {
                    return rootSnapshot;
                }

                if (document.uri.toString() === openParentDocument.uri.toString()) {
                    return document.version === 7 ? parentOpenSnapshot : parentDiskSnapshot;
                }

                if (document.uri.toString() === grandDiskDocument.uri.toString()) {
                    return grandSnapshot;
                }

                throw new Error(`Unexpected semantic request for ${document.uri.toString()}`);
            }),
            getBestAvailableSnapshot: jest.fn(),
            getSnapshot: jest.fn()
        };
        const projectSymbolIndex = new ProjectSymbolIndex(
            new InheritanceResolver(undefined as any, [workspaceRoot])
        );
        const service = new CompletionInheritedIndexService(
            analysisService as any,
            projectSymbolIndex,
            { appendLine: jest.fn(), clear: jest.fn(), show: jest.fn() }
        );

        service.refreshInheritedIndex(rootDocument);

        expect(projectSymbolIndex.getRecord(vscode.Uri.file(parentPath).toString())?.exportedFunctions.map(func => func.name)).toEqual([
            'parent_open'
        ]);
        expect(projectSymbolIndex.getRecord(vscode.Uri.file(grandPath).toString())?.exportedFunctions.map(func => func.name)).toEqual([
            'grand_disk'
        ]);
    });

    test('missing inherited files do not throw and simply stop recursive expansion', () => {
        const CompletionInheritedIndexService = loadService();
        const rootPath = path.join(workspaceRoot, 'root.c');
        fs.writeFileSync(rootPath, 'inherit "missing_parent";\n');
        const rootDocument = createDocument(rootPath, 'inherit "missing_parent";\n', 1);
        const rootSnapshot = createSnapshot(rootDocument, {
            functionName: 'root',
            inherits: ['missing_parent']
        });
        const analysisService = {
            getBestAvailableSemanticSnapshot: jest.fn(() => rootSnapshot),
            getSemanticSnapshot: jest.fn(() => rootSnapshot),
            getBestAvailableSnapshot: jest.fn(() => rootSnapshot),
            getSnapshot: jest.fn(() => rootSnapshot)
        };
        const projectSymbolIndex = new ProjectSymbolIndex(
            new InheritanceResolver(undefined as any, [workspaceRoot])
        );
        const reporter = { appendLine: jest.fn(), clear: jest.fn(), show: jest.fn() };
        const service = new CompletionInheritedIndexService(
            analysisService as any,
            projectSymbolIndex,
            reporter
        );

        expect(() => service.refreshInheritedIndex(rootDocument)).not.toThrow();
        expect(projectSymbolIndex.getRecord(rootDocument.uri.toString())?.exportedFunctions.map(func => func.name)).toEqual([
            'root'
        ]);
        expect(projectSymbolIndex.getInheritedSymbols(rootDocument.uri.toString()).unresolvedTargets.map(target => target.rawValue)).toEqual([
            'missing_parent'
        ]);
        expect(reporter.appendLine).not.toHaveBeenCalled();
    });
});
