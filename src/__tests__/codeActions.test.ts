import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import { createLpcCodeActionCommandHandlers } from '../codeActions';
import { GLM4Client } from '../glm4Client';

describe('createLpcCodeActionCommandHandlers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns rename and Javadoc handlers without registering commands directly', () => {
        const handlers = createLpcCodeActionCommandHandlers({
            sendRequest: jest.fn() as unknown as <T>(method: string, payload: unknown) => Promise<T>
        });

        expect(handlers.map(handler => handler.id)).toEqual([
            'lpc.renameVarToSnakeCase',
            'lpc.renameVarToCamelCase',
            'lpc.generateJavadoc'
        ]);
        expect(handlers.every(handler => typeof handler.handler === 'function')).toBe(true);
        expect(vscode.commands.registerCommand).not.toHaveBeenCalled();
    });
});

describe('Javadoc generation command', () => {
    const comment = '/**\n * @brief 执行操作。\n * @param int value 输入值。\n */';
    let document: {
        version: number;
        uri: vscode.Uri;
        languageId: string;
        eol: vscode.EndOfLine;
        getText: jest.Mock;
        lineAt: jest.Mock;
    };
    let insert: jest.Mock;
    let generate: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        document = {
            version: 1,
            uri: vscode.Uri.file('D:/mud/demo.c'),
            languageId: 'lpc',
            eol: vscode.EndOfLine.LF,
            getText: jest.fn(() => 'void demo(int value) {}'),
            lineAt: jest.fn(() => ({ text: 'void demo(int value) {}' }))
        };
        insert = jest.fn();
        (vscode.window as any).activeTextEditor = {
            document,
            selection: { isEmpty: true, active: new vscode.Position(0, 8) },
            edit: jest.fn(async (callback: (builder: { insert: jest.Mock }) => void) => {
                callback({ insert });
                return true;
            })
        };
        (vscode.window as any).withProgress = jest.fn(async (_options: unknown, task: (progress: { report: jest.Mock }) => Promise<void>) =>
            task({ report: jest.fn() })
        );
        jest.spyOn(GLM4Client, 'selectModel').mockResolvedValue('test-model');
        generate = jest.fn(async () => comment);
        jest.spyOn(GLM4Client, 'fromVSCodeConfigWithModel').mockReturnValue({
            generateJavadoc: generate
        } as unknown as GLM4Client);
    });

    afterEach(() => {
        jest.restoreAllMocks();
        (vscode.window as any).activeTextEditor = undefined;
    });

    function command(documentationRange?: object): () => Promise<void> {
        const sendRequest = jest.fn(async (method: string) => method === 'lpc/enclosingFunction'
            ? { name: 'demo', range: { start: { line: 0, character: 0 }, end: { line: 0, character: 23 } } }
            : {
                currentFile: { entries: [{
                    name: 'demo',
                    range: { start: { line: 0, character: 0 }, end: { line: 0, character: 23 } },
                    documentationRange,
                    structuredSignature: { returnType: 'void', parameters: [{ name: 'value' }] }
                }] }
            });
        return createLpcCodeActionCommandHandlers({ sendRequest } as any)
            .find((item) => item.id === 'lpc.generateJavadoc')!.handler;
    }

    test('uses Rust signature facts and refuses to duplicate an existing comment', async () => {
        await command({ start: { line: 0, character: 0 }, end: { line: 0, character: 3 } })();
        expect(generate).not.toHaveBeenCalled();
        expect(insert).not.toHaveBeenCalled();

        await command()();
        expect(generate).toHaveBeenCalledWith('void demo(int value) {}', {
            name: 'demo', parameters: ['value'], returnType: 'void'
        }, 'zh-cn');
        expect(GLM4Client.selectModel).not.toHaveBeenCalled();
        expect(GLM4Client.fromVSCodeConfigWithModel).toHaveBeenCalledWith('GLM-4-Flash-250414');
        expect(insert).toHaveBeenCalledTimes(1);
    });

    test('does not insert a result after the document changes during generation', async () => {
        generate.mockImplementation(async () => {
            document.version = 2;
            return comment;
        });
        await command()();
        expect(insert).not.toHaveBeenCalled();
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('文档已变化'));
    });

    test('does not generate or edit when model selection is cancelled', async () => {
        jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
            get: (key: string, fallback: unknown) => key === 'glm4.alwaysShowModelSelector' ? true : fallback
        } as unknown as vscode.WorkspaceConfiguration);
        jest.mocked(GLM4Client.selectModel).mockResolvedValueOnce(undefined);

        await command()();

        expect(GLM4Client.selectModel).toHaveBeenCalledTimes(1);
        expect(GLM4Client.fromVSCodeConfigWithModel).not.toHaveBeenCalled();
        expect(generate).not.toHaveBeenCalled();
        expect(vscode.window.activeTextEditor!.edit).not.toHaveBeenCalled();
        expect(insert).not.toHaveBeenCalled();
    });

    test.each(['en', 'zh-cn'].flatMap(uiLanguage => ['en', 'zh-cn'].map(outputLanguage => ({
        uiLanguage, outputLanguage
    }))))('passes resource-scoped $outputLanguage output with $uiLanguage UI and keeps CRLF/indent', async ({ uiLanguage, outputLanguage }) => {
        (vscode.env as { language: string }).language = uiLanguage;
        const configuration = jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
            get: (key: string, fallback: unknown) => key === 'documentation.language' ? outputLanguage : fallback
        } as unknown as vscode.WorkspaceConfiguration);
        const generated = outputLanguage === 'en'
            ? '/**\n * @brief Run the operation.\n * @param int value Input value.\n */'
            : comment;
        generate.mockImplementation(async () => generated);
        document.eol = vscode.EndOfLine.CRLF;
        document.lineAt.mockReturnValue({ text: '    void demo(int value) {}' });

        try {
            await command()();

            expect(configuration).toHaveBeenCalledWith('lpc', document.uri);
            expect(generate).toHaveBeenCalledWith('void demo(int value) {}', {
                name: 'demo', parameters: ['value'], returnType: 'void'
            }, outputLanguage);
            expect(insert.mock.calls[0][1]).toBe(generated.split('\n').map(line => '    ' + line).join('\r\n') + '\r\n');
        } finally {
            (vscode.env as { language: string }).language = 'zh-cn';
        }
    });
});
