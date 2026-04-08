import * as vscode from 'vscode';
import { FolderScanner } from '../FolderScanner';

describe('FolderScanner', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (vscode.window as any).withProgress = jest.fn().mockImplementation(
            async (_options: unknown, task: (progress: { report: jest.Mock }, token: { isCancellationRequested: boolean }) => Promise<void>) => {
                await task({ report: jest.fn() }, { isCancellationRequested: false });
            }
        );
    });

    test('waits for asynchronous analysis results before reading diagnostics', async () => {
        let analyzed = false;
        const outputChannel = {
            appendLine: jest.fn(),
            clear: jest.fn(),
            show: jest.fn(),
            dispose: jest.fn()
        };
        const diagnosticCollection = {
            get: jest.fn().mockImplementation(() => analyzed ? [
                new vscode.Diagnostic(new vscode.Range(0, 0, 0, 1), 'unused var')
            ] : [])
        };
        const scanner = new FolderScanner(
            jest.fn().mockImplementation(() => new Promise<void>(resolve => {
                setTimeout(() => {
                    analyzed = true;
                    resolve();
                }, 20);
            }).then(() => [
                new vscode.Diagnostic(new vscode.Range(0, 0, 0, 1), 'unused var')
            ])),
            diagnosticCollection as unknown as vscode.DiagnosticCollection
        ) as any;

        jest.spyOn(scanner, 'findLPCFiles').mockResolvedValue(['D:/workspace/test.c']);
        (vscode.window.showOpenDialog as jest.Mock).mockResolvedValue([{ fsPath: 'D:/workspace' }]);
        (vscode.window.createOutputChannel as jest.Mock).mockReturnValue(outputChannel);
        (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue({
            uri: vscode.Uri.file('D:/workspace/test.c'),
            fileName: 'D:/workspace/test.c',
            languageId: 'lpc',
            version: 1
        });

        await scanner.scanFolder();

        expect(diagnosticCollection.get).not.toHaveBeenCalled();
        expect(outputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('unused var'));
    });
});
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
