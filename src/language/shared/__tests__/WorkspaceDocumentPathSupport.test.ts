import * as vscode from 'vscode';
import { describe, expect, jest, test } from '@jest/globals';
import {
    assertOpenTextDocumentHost,
    assertTextDocumentHost,
    assertWorkspaceDocumentHost,
    createVsCodeTextDocumentHost,
    createVsCodeWorkspaceDocumentHost
} from '../WorkspaceDocumentPathSupport';

describe('workspace document host contract', () => {
    test('createVsCodeTextDocumentHost delegates to the VS Code workspace API', async () => {
        const openTextDocument = jest.fn(async () => ({ uri: vscode.Uri.file('D:/w/room.c') }));
        const getWorkspaceFolder = jest.fn(() => undefined);
        jest.spyOn(vscode.workspace, 'openTextDocument').mockImplementation(openTextDocument as never);
        jest.spyOn(vscode.workspace, 'getWorkspaceFolder').mockImplementation(getWorkspaceFolder as never);

        const host = createVsCodeTextDocumentHost();

        await host.openTextDocument(vscode.Uri.file('D:/w/room.c'));
        expect(openTextDocument).toHaveBeenCalledWith(vscode.Uri.file('D:/w/room.c'));
        expect(host.getWorkspaceFolder(vscode.Uri.file('D:/w/room.c'))).toBeUndefined();
    });

    test('createVsCodeWorkspaceDocumentHost extends the text document host with workspace search', async () => {
        const findFiles = jest.fn(async () => []);
        jest.spyOn(vscode.workspace, 'findFiles').mockImplementation(findFiles as never);

        const host = createVsCodeWorkspaceDocumentHost();

        await host.findFiles('**/*.c');
        expect(findFiles).toHaveBeenCalledWith('**/*.c', undefined);
        expect(host.getWorkspaceFolders()).toBe(vscode.workspace.workspaceFolders);
    });

    test('host assertions reject missing hosts and return injected ones', () => {
        const host = createVsCodeTextDocumentHost();

        expect(() => assertTextDocumentHost('Owner', undefined)).toThrow('Owner requires an injected TextDocumentHost');
        expect(() => assertOpenTextDocumentHost('Owner', undefined)).toThrow('Owner requires an injected openTextDocument host');
        expect(() => assertWorkspaceDocumentHost('Owner', undefined)).toThrow('Owner requires an injected WorkspaceDocumentHost');
        expect(assertTextDocumentHost('Owner', host)).toBe(host);
    });
});
