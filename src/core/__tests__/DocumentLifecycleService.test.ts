import * as vscode from 'vscode';

describe('DocumentLifecycleService', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('invalidates lpc document closes and deleted files, then disposes subscriptions', () => {
        const closeDisposable = { dispose: jest.fn() };
        const deleteDisposable = { dispose: jest.fn() };
        (vscode.workspace.onDidCloseTextDocument as jest.Mock).mockReturnValue(closeDisposable);
        (vscode.workspace.onDidDeleteFiles as jest.Mock).mockReturnValue(deleteDisposable);

        const { DocumentLifecycleService } = require('../DocumentLifecycleService');
        const service = new DocumentLifecycleService();
        const invalidatedUris: string[] = [];
        service.onInvalidate((uri: vscode.Uri) => {
            invalidatedUris.push(uri.toString());
        });

        const closeHandler = (vscode.workspace.onDidCloseTextDocument as jest.Mock).mock.calls[0][0];
        const deleteHandler = (vscode.workspace.onDidDeleteFiles as jest.Mock).mock.calls[0][0];

        closeHandler({
            uri: vscode.Uri.file('/virtual/demo.c'),
            languageId: 'lpc'
        });
        closeHandler({
            uri: vscode.Uri.file('/virtual/demo.txt'),
            languageId: 'plaintext'
        });
        deleteHandler({
            files: [vscode.Uri.file('/virtual/deleted.c'), vscode.Uri.file('/virtual/removed.h')]
        });

        expect(invalidatedUris).toEqual([
            'file:////virtual/demo.c',
            'file:////virtual/deleted.c',
            'file:////virtual/removed.h'
        ]);

        service.dispose();

        expect(closeDisposable.dispose).toHaveBeenCalledTimes(1);
        expect(deleteDisposable.dispose).toHaveBeenCalledTimes(1);

        deleteHandler({
            files: [vscode.Uri.file('/virtual/post-dispose.c')]
        });

        expect(invalidatedUris).toEqual([
            'file:////virtual/demo.c',
            'file:////virtual/deleted.c',
            'file:////virtual/removed.h'
        ]);
    });
});
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
