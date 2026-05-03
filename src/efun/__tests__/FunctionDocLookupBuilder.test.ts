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
                macroManager: {
                    getMacro: jest.fn().mockReturnValue({ value: '"/inherit/base"' })
                } as any
            }),
        });
        const document = createTextDocument(mainFile, 'inherit BASE_INHERIT;\n');

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
});
