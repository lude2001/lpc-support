import * as vscode from 'vscode';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { FunctionDocPanel } from '../functionDocPanel';
import { LPCFunctionParser } from '../functionParser';

function createTextDocument(filePath: string, content: string): vscode.TextDocument {
    const normalized = content.replace(/\r\n/g, '\n');
    const lineStarts = [0];
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
        languageId: 'lpc',
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
            text: normalized.split('\n')[line] ?? ''
        }),
        positionAt,
        offsetAt,
        save: async () => true,
        validateRange: (range: vscode.Range) => range,
        validatePosition: (position: vscode.Position) => position
    } as unknown as vscode.TextDocument;
}

describe('FunctionDocPanel', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (vscode.workspace.getWorkspaceFolder as jest.Mock).mockReturnValue(undefined);
        (vscode.window.onDidChangeActiveTextEditor as jest.Mock).mockReturnValue({ dispose: jest.fn() });
        (vscode.workspace as any).onDidSaveTextDocument = jest.fn().mockReturnValue({ dispose: jest.fn() });
    });

    test('update builds panel data from shared documentation service instead of panel-specific extraction', async () => {
        const parseAllFunctionsSpy = jest.spyOn(LPCFunctionParser, 'parseAllFunctions');
        const panel = {
            title: '',
            webview: {
                html: '',
                onDidReceiveMessage: jest.fn()
            },
            onDidDispose: jest.fn(),
            dispose: jest.fn(),
            reveal: jest.fn()
        } as unknown as vscode.WebviewPanel;
        const efunDocsManager = {
            getFunctionDocLookupForDocument: jest.fn(async () => ({
                currentFile: {
                    source: '当前文件',
                    filePath: 'D:/code/lpc/obj/npc.c',
                    docs: new Map([[
                        'query_name',
                        {
                            name: 'query_name',
                            syntax: 'string query_name(string style)',
                            description: '来自共享文档。',
                            details: '面板应该直接读取共享文档数据。',
                            signatures: [{
                                label: 'string query_name(string style)',
                                parameters: [{
                                    name: 'style',
                                    type: 'string',
                                    description: '显示风格'
                                }],
                                isVariadic: false
                            }],
                            sourceRange: {
                                start: { line: 5, character: 0 },
                                end: { line: 7, character: 1 }
                            }
                        }
                    ]])
                },
                inheritedGroups: [],
                includeGroups: []
            }))
        };
        const document = createTextDocument(
            'D:/code/lpc/obj/npc.c',
            [
                '/**',
                ' * @brief 来自共享文档。',
                ' * @param string style 显示风格。',
                ' * @details 面板应该直接读取共享文档数据。',
                ' */',
                'string query_name(string style) {',
                '    return style;',
                '}'
            ].join('\n')
        );

        const panelInstance = new (FunctionDocPanel as any)(
            panel,
            efunDocsManager,
            {
                openTextDocument: jest.fn()
            }
        );
        await panelInstance.update(document);

        expect(efunDocsManager.getFunctionDocLookupForDocument).toHaveBeenCalledWith(document, { forceFresh: true });
        expect(parseAllFunctionsSpy).not.toHaveBeenCalled();
        expect(panel.title).toContain('npc.c');
        expect(panel.webview.html).toContain('query_name');
        expect(panel.webview.html).toContain('来自共享文档');
    });
});
