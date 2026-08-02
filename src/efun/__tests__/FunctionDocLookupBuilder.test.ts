import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { FunctionDocLookupBuilder } from '../FunctionDocLookupBuilder';
import { createDefaultFunctionDocumentationService } from '../../language/documentation/FunctionDocumentationService';
import {
    WorkspaceDocumentPathSupport,
    createVsCodeTextDocumentHost
} from '../../language/shared/WorkspaceDocumentPathSupport';
import { DocumentSemanticSnapshotService } from '../../semantic/documentSemanticSnapshotService';
import type { DocumentCallableDocs, CallableDoc } from '../../language/documentation/types';

function createTextDocument(filePath: string, content: string): vscode.TextDocument {
    const normalized = content.replace(/\r\n/g, '\n');
    const lineStarts = [0];
    const lines = normalized.split('\n');

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
        uri: vscode.Uri.file(filePath),
        fileName: filePath,
        languageId: filePath.endsWith('.h') || filePath.endsWith('.c') ? 'lpc' : 'plaintext',
        version: 1,
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
            text: lines[line] ?? ''
        }),
        positionAt,
        offsetAt,
        save: async () => true,
        validateRange: (range: vscode.Range) => range,
        validatePosition: (position: vscode.Position) => position
    } as unknown as vscode.TextDocument;
}

function normalizeMockFsPath(filePath: string): string {
    return path.resolve(filePath.replace(/^\/+([A-Za-z]:\/)/, '$1'));
}

function getDocByName(documentDocs: DocumentCallableDocs, name: string): CallableDoc | undefined {
    const declarationKey = documentDocs.byName.get(name)?.[0];
    return declarationKey ? documentDocs.byDeclaration.get(declarationKey) : undefined;
}

describe('FunctionDocLookupBuilder', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (vscode.workspace.workspaceFolders as unknown) = [];
        (vscode.workspace.openTextDocument as jest.Mock).mockImplementation(async (target: string) => {
            const filePath = typeof target === 'string' ? target : target.fsPath;
            return createTextDocument(filePath, fs.readFileSync(filePath, 'utf8'));
        });
    });

    test('include lookup uses live unsaved document text', async () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-tracker-live-'));
        const includeDir = path.join(tempRoot, 'include');
        const mainFile = path.join(tempRoot, 'main.c');
        const includeFile = path.join(includeDir, 'helper.h');

        fs.mkdirSync(includeDir, { recursive: true });
        fs.writeFileSync(mainFile, '');
        fs.writeFileSync(
            includeFile,
            [
                '/**',
                ' * @brief live include helper',
                ' */',
                'int helper_live();'
            ].join('\n')
        );

        (vscode.workspace.getWorkspaceFolder as jest.Mock).mockReturnValue({ uri: { fsPath: tempRoot } });

        const builder = new FunctionDocLookupBuilder({
            documentationService: createDefaultFunctionDocumentationService(),
            analysisService: DocumentSemanticSnapshotService.getInstance(),
            pathSupport: new WorkspaceDocumentPathSupport({
                host: createVsCodeTextDocumentHost()
            })
        });
        const document = createTextDocument(mainFile, '#include "/include/helper.h"\n');

        const lookup = await builder.buildLookup(document);
        const doc = getDocByName(lookup.includeGroups[0].docs, 'helper_live');

        expect(lookup.includeGroups[0].sourceKind).toBe('include');
        expect(doc).toMatchObject({
            name: 'helper_live',
            summary: 'live include helper',
            signatures: [
                expect.objectContaining({
                    label: 'int helper_live();',
                    returnType: 'int'
                })
            ]
        });

        fs.rmSync(tempRoot, { recursive: true, force: true });
    });

    test('workspace-root resolution comes from the owning workspace folder', async () => {
        const rootA = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-root-a-'));
        const rootB = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-root-b-'));
        const includeDir = path.join(rootB, 'include');
        const mainFile = path.join(rootB, 'main.c');
        const includeFile = path.join(includeDir, 'helper.h');

        fs.mkdirSync(includeDir, { recursive: true });
        fs.writeFileSync(mainFile, '#include "/include/helper.h"\n');
        fs.writeFileSync(
            includeFile,
            [
                '/**',
                ' * @brief multi root helper',
                ' */',
                'int helper_multi_root();'
            ].join('\n')
        );

        (vscode.workspace.getWorkspaceFolder as jest.Mock).mockImplementation((uri: vscode.Uri) => {
            const fsPath = normalizeMockFsPath(uri.fsPath);
            if (fsPath.startsWith(rootB)) {
                return { uri: { fsPath: rootB } };
            }

            if (fsPath.startsWith(rootA)) {
                return { uri: { fsPath: rootA } };
            }

            return undefined;
        });

        const builder = new FunctionDocLookupBuilder({
            documentationService: createDefaultFunctionDocumentationService(),
            analysisService: DocumentSemanticSnapshotService.getInstance(),
            pathSupport: new WorkspaceDocumentPathSupport({
                host: createVsCodeTextDocumentHost()
            })
        });
        const document = createTextDocument(mainFile, '#include "/include/helper.h"\n');

        const lookup = await builder.buildLookup(document);
        const doc = getDocByName(lookup.includeGroups[0].docs, 'helper_multi_root');

        expect(lookup.includeGroups[0].sourceKind).toBe('include');
        expect(doc).toMatchObject({
            name: 'helper_multi_root',
            summary: 'multi root helper',
            signatures: [
                expect.objectContaining({
                    label: 'int helper_multi_root();',
                    returnType: 'int'
                })
            ]
        });

        fs.rmSync(rootA, { recursive: true, force: true });
        fs.rmSync(rootB, { recursive: true, force: true });
    });

    test('macro-based inherits resolve through the shared path support and stay on the inherited lookup path', async () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-inherit-root-'));
        const inheritDir = path.join(tempRoot, 'inherit');
        const mainFile = path.join(tempRoot, 'main.c');
        const inheritedFile = path.join(inheritDir, 'base.c');

        fs.mkdirSync(inheritDir, { recursive: true });
        fs.writeFileSync(
            inheritedFile,
            [
                '/**',
                ' * @brief inherited helper',
                ' */',
                'int helper_inherited();'
            ].join('\n')
        );

        (vscode.workspace.getWorkspaceFolder as jest.Mock).mockReturnValue({ uri: { fsPath: tempRoot } });

        const builder = new FunctionDocLookupBuilder({
            documentationService: createDefaultFunctionDocumentationService(),
            analysisService: DocumentSemanticSnapshotService.getInstance(),
            pathSupport: new WorkspaceDocumentPathSupport({
                host: createVsCodeTextDocumentHost(),
                analysisService: DocumentSemanticSnapshotService.getInstance()
            }),
        });
        const document = createTextDocument(mainFile, '#define BASE_INHERIT "/inherit/base"\ninherit BASE_INHERIT;\n');

        const lookup = await builder.buildLookup(document);
        const doc = getDocByName(lookup.inheritedGroups[0].docs, 'helper_inherited');

        expect(lookup.inheritedGroups[0].sourceKind).toBe('inherit');
        expect(doc).toMatchObject({
            name: 'helper_inherited',
            summary: 'inherited helper',
            signatures: [
                expect.objectContaining({
                    label: 'int helper_inherited();',
                    returnType: 'int'
                })
            ]
        });

        fs.rmSync(tempRoot, { recursive: true, force: true });
    });

    test('absolute inherits honor workspace project config mudlib directory', async () => {
        const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-doc-workspace-'));
        const mudlibRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-doc-mudlib-'));
        const mainFile = path.join(workspaceRoot, 'cmds', 'main.c');
        const inheritedFile = path.join(mudlibRoot, 'std', 'base.c');

        fs.mkdirSync(path.dirname(mainFile), { recursive: true });
        fs.mkdirSync(path.dirname(inheritedFile), { recursive: true });
        fs.writeFileSync(
            inheritedFile,
            [
                '/**',
                ' * @brief mudlib inherited helper',
                ' */',
                'int helper_mudlib();'
            ].join('\n')
        );

        (vscode.workspace.getWorkspaceFolder as jest.Mock).mockReturnValue({ uri: { fsPath: workspaceRoot } });

        const builder = new FunctionDocLookupBuilder({
            documentationService: createDefaultFunctionDocumentationService(),
            analysisService: DocumentSemanticSnapshotService.getInstance(),
            pathSupport: new WorkspaceDocumentPathSupport({
                host: createVsCodeTextDocumentHost(),
                analysisService: DocumentSemanticSnapshotService.getInstance()
            }),
        });
        const document = createTextDocument(mainFile, 'inherit "/std/base";\n');

        const lookup = await builder.buildLookup(document, {
            projectConfig: {
                projectConfigPath: path.join(workspaceRoot, 'lpc-support.json'),
                resolvedConfig: {
                    mudlibDirectory: mudlibRoot
                }
            }
        });
        const doc = getDocByName(lookup.inheritedGroups[0].docs, 'helper_mudlib');

        expect(lookup.inheritedGroups[0].sourceKind).toBe('inherit');
        expect(lookup.inheritedGroups[0].filePath).toBe(inheritedFile);
        expect(doc).toMatchObject({
            name: 'helper_mudlib',
            summary: 'mudlib inherited helper'
        });

        fs.rmSync(workspaceRoot, { recursive: true, force: true });
        fs.rmSync(mudlibRoot, { recursive: true, force: true });
    });

    test('traverses transitive inherit and include graphs breadth-first without cycling', async () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-doc-graph-'));
        const mainFile = path.join(tempRoot, 'main.c');
        const baseFile = path.join(tempRoot, 'inherit', 'base.c');
        const grandFile = path.join(tempRoot, 'inherit', 'grand.c');
        const firstHeader = path.join(tempRoot, 'include', 'first.h');
        const secondHeader = path.join(tempRoot, 'include', 'second.h');
        fs.mkdirSync(path.dirname(baseFile), { recursive: true });
        fs.mkdirSync(path.dirname(firstHeader), { recursive: true });
        fs.writeFileSync(mainFile, '');
        fs.writeFileSync(baseFile, 'inherit "/inherit/grand";\nint base_fn();\n');
        fs.writeFileSync(grandFile, 'inherit "/inherit/base";\nint grand_fn();\n');
        fs.writeFileSync(firstHeader, '#include "/include/second.h"\nint first_fn();\n');
        fs.writeFileSync(secondHeader, '#include "/include/first.h"\nint second_fn();\n');
        (vscode.workspace.getWorkspaceFolder as jest.Mock).mockReturnValue({ uri: { fsPath: tempRoot } });

        const builder = new FunctionDocLookupBuilder({
            documentationService: createDefaultFunctionDocumentationService(),
            analysisService: DocumentSemanticSnapshotService.getInstance(),
            pathSupport: new WorkspaceDocumentPathSupport({
                host: createVsCodeTextDocumentHost(),
                analysisService: DocumentSemanticSnapshotService.getInstance()
            })
        });
        const document = createTextDocument(
            mainFile,
            'inherit "/inherit/base";\n#include "/include/first.h"\n'
        );

        const lookup = await builder.buildLookup(document);

        expect(lookup.inheritedGroups.map((group) => [path.basename(group.filePath), group.depth])).toEqual([
            ['base.c', 1],
            ['grand.c', 2]
        ]);
        expect(lookup.includeGroups.map((group) => [path.basename(group.filePath), group.depth])).toEqual([
            ['first.h', 1],
            ['second.h', 2]
        ]);
        expect(lookup.diagnostics?.map((diagnostic) => diagnostic.code)).toEqual([
            'inherit-cycle',
            'include-cycle'
        ]);

        fs.rmSync(tempRoot, { recursive: true, force: true });
    });

    test('resolves system includes from every configured directory and preserves duplicate basenames', async () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-doc-system-includes-'));
        const mainFile = path.join(tempRoot, 'main.c');
        const firstIncludeRoot = path.join(tempRoot, 'headers-a');
        const secondIncludeRoot = path.join(tempRoot, 'headers-b');
        const firstHeader = path.join(firstIncludeRoot, 'common.h');
        const secondHeader = path.join(secondIncludeRoot, 'common.h');
        fs.mkdirSync(firstIncludeRoot, { recursive: true });
        fs.mkdirSync(secondIncludeRoot, { recursive: true });
        fs.writeFileSync(mainFile, '');
        fs.writeFileSync(firstHeader, 'int common_from_a();\n');
        fs.writeFileSync(secondHeader, 'int common_from_b();\n');
        (vscode.workspace.getWorkspaceFolder as jest.Mock).mockReturnValue({ uri: { fsPath: tempRoot } });

        const builder = new FunctionDocLookupBuilder({
            documentationService: createDefaultFunctionDocumentationService(),
            analysisService: DocumentSemanticSnapshotService.getInstance(),
            pathSupport: new WorkspaceDocumentPathSupport({
                host: createVsCodeTextDocumentHost(),
                analysisService: DocumentSemanticSnapshotService.getInstance()
            })
        });
        const document = createTextDocument(
            mainFile,
            '#include <common.h>\n#include <headers-b/common.h>\n'
        );

        const lookup = await builder.buildLookup(document, {
            projectConfig: {
                projectConfigPath: path.join(tempRoot, 'lpc-support.json'),
                resolvedConfig: {
                    includeDirectories: ['headers-a', '.']
                }
            }
        });

        expect(lookup.includeGroups.map((group) => group.filePath)).toEqual([firstHeader, secondHeader]);
        expect(lookup.includeGroups.map((group) => path.basename(group.filePath))).toEqual(['common.h', 'common.h']);
        expect(getDocByName(lookup.includeGroups[0].docs, 'common_from_a')).toBeDefined();
        expect(getDocByName(lookup.includeGroups[1].docs, 'common_from_b')).toBeDefined();

        fs.rmSync(tempRoot, { recursive: true, force: true });
    });

    test('materializes a converging dependency only once when reached through multiple parent edges', async () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-doc-converging-'));
        const mainFile = path.join(tempRoot, 'main.c');
        const firstHeader = path.join(tempRoot, 'include', 'first.h');
        const secondHeader = path.join(tempRoot, 'include', 'second.h');
        const sharedHeader = path.join(tempRoot, 'include', 'shared.h');
        fs.mkdirSync(path.dirname(firstHeader), { recursive: true });
        fs.writeFileSync(mainFile, '');
        fs.writeFileSync(firstHeader, '#include "/include/shared.h"\nint first_fn();\n');
        fs.writeFileSync(secondHeader, '#include "/include/shared.h"\nint second_fn();\n');
        fs.writeFileSync(sharedHeader, 'int shared_fn();\n');
        (vscode.workspace.getWorkspaceFolder as jest.Mock).mockReturnValue({ uri: { fsPath: tempRoot } });

        const builder = new FunctionDocLookupBuilder({
            documentationService: createDefaultFunctionDocumentationService(),
            analysisService: DocumentSemanticSnapshotService.getInstance(),
            pathSupport: new WorkspaceDocumentPathSupport({
                host: createVsCodeTextDocumentHost(),
                analysisService: DocumentSemanticSnapshotService.getInstance()
            })
        });
        const document = createTextDocument(
            mainFile,
            '#include "/include/first.h"\n#include "/include/second.h"\n'
        );

        const lookup = await builder.buildLookup(document);

        expect(lookup.includeGroups.filter((group) => group.filePath === sharedHeader)).toHaveLength(1);
        expect(lookup.includeGroups.map((group) => path.basename(group.filePath))).toEqual([
            'first.h',
            'second.h',
            'shared.h'
        ]);
        expect(lookup.diagnostics).toEqual([]);

        fs.rmSync(tempRoot, { recursive: true, force: true });
    });

    test('stops dependency traversal when cancellation is requested', async () => {
        const document = createTextDocument('D:/workspace/main.c', 'inherit "/base";\n');
        const builder = new FunctionDocLookupBuilder({
            documentationService: createDefaultFunctionDocumentationService(),
            analysisService: DocumentSemanticSnapshotService.getInstance(),
            pathSupport: new WorkspaceDocumentPathSupport({ host: createVsCodeTextDocumentHost() })
        });

        const lookup = await builder.buildLookup(document, {
            cancellationToken: { isCancellationRequested: true }
        });

        expect(lookup.inheritedGroups).toEqual([]);
        expect(lookup.diagnostics?.map((diagnostic) => diagnostic.code)).toContain('analysis-cancelled');
    });

    test('isolates dependency analysis failures as partial diagnostics instead of failing the lookup', async () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-doc-partial-'));
        const mainFile = path.join(tempRoot, 'main.c');
        const inheritedFile = path.join(tempRoot, 'base.c');
        const includeFile = path.join(tempRoot, 'helper.h');
        fs.writeFileSync(mainFile, '');
        fs.writeFileSync(inheritedFile, 'int inherited_fn();\n');
        fs.writeFileSync(includeFile, 'int included_fn();\n');
        (vscode.workspace.getWorkspaceFolder as jest.Mock).mockReturnValue({ uri: { fsPath: tempRoot } });
        const semanticService = DocumentSemanticSnapshotService.getInstance();
        const analysisService = {
            getSemanticSnapshot: jest.fn((document: vscode.TextDocument, allowCached?: boolean) => {
                if (document.fileName === inheritedFile || document.fileName === includeFile) {
                    throw new Error('dependency analysis failed');
                }
                return semanticService.getSemanticSnapshot(document, allowCached);
            })
        };
        const builder = new FunctionDocLookupBuilder({
            documentationService: createDefaultFunctionDocumentationService(),
            analysisService,
            pathSupport: new WorkspaceDocumentPathSupport({
                host: createVsCodeTextDocumentHost(),
                analysisService
            })
        });
        const document = createTextDocument(
            mainFile,
            'inherit "/base";\n#include "/helper.h"\n'
        );

        const lookup = await builder.buildLookup(document);

        expect(lookup.inheritedGroups).toHaveLength(1);
        expect(lookup.includeGroups).toHaveLength(1);
        expect(lookup.diagnostics).toEqual([
            expect.objectContaining({ stage: 'inheritance', code: 'dependency-analysis-failed' }),
            expect.objectContaining({ stage: 'include', code: 'dependency-analysis-failed' })
        ]);
        expect(consoleError).toHaveBeenCalledTimes(2);
        consoleError.mockRestore();
        fs.rmSync(tempRoot, { recursive: true, force: true });
    });
});
