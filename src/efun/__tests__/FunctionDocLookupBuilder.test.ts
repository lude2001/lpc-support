import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { FunctionDocCompatMaterializer } from '../FunctionDocCompatMaterializer';
import { FunctionDocLookupBuilder } from '../FunctionDocLookupBuilder';
import { createDefaultFunctionDocumentationService } from '../../language/documentation/FunctionDocumentationService';
import {
    WorkspaceDocumentPathSupport,
    createVsCodeTextDocumentHost
} from '../../language/shared/WorkspaceDocumentPathSupport';
import { DocumentSemanticSnapshotService } from '../../semantic/documentSemanticSnapshotService';

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
        const materializer = new FunctionDocCompatMaterializer();
        const document = createTextDocument(mainFile, '#include "/include/helper.h"\n');

        const lookup = await builder.buildLookup(document);
        const doc = materializer.materializeLookup(lookup).lookup.includeGroups[0]?.docs.get('helper_live');

        expect(doc).toMatchObject({
            name: 'helper_live',
            category: '包含自 helper.h',
            description: 'live include helper',
            syntax: 'int helper_live();'
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
        const materializer = new FunctionDocCompatMaterializer();
        const document = createTextDocument(mainFile, '#include "/include/helper.h"\n');

        const lookup = await builder.buildLookup(document);
        const doc = materializer.materializeLookup(lookup).lookup.includeGroups[0]?.docs.get('helper_multi_root');

        expect(doc).toMatchObject({
            name: 'helper_multi_root',
            category: '包含自 helper.h',
            description: 'multi root helper',
            syntax: 'int helper_multi_root();'
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
        const materializer = new FunctionDocCompatMaterializer();
        const document = createTextDocument(mainFile, 'inherit BASE_INHERIT;\n');

        const lookup = await builder.buildLookup(document);
        const doc = materializer.materializeLookup(lookup).lookup.inheritedGroups[0]?.docs.get('helper_inherited');

        expect(doc).toMatchObject({
            name: 'helper_inherited',
            category: '继承自 base.c',
            description: 'inherited helper',
            syntax: 'int helper_inherited();'
        });

        fs.rmSync(tempRoot, { recursive: true, force: true });
    });
});
