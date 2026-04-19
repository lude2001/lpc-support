import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { MacroManager } from '../../macroManager';
import { createVsCodeTextDocumentHost } from '../../language/shared/WorkspaceDocumentPathSupport';
import { LpcProjectConfigService } from '../LpcProjectConfigService';

describe('MacroManager project config integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: jest.fn((_: string, defaultValue?: unknown) => defaultValue),
            update: jest.fn().mockResolvedValue(undefined)
        });
        (vscode.workspace as any).createFileSystemWatcher = jest.fn().mockReturnValue({
            onDidChange: jest.fn(),
            onDidCreate: jest.fn(),
            onDidDelete: jest.fn(),
            dispose: jest.fn()
        });
        (vscode.window as any).withProgress = jest.fn(async (_options: unknown, task: (progress: { report: jest.Mock }) => Promise<void>) => {
            await task({ report: jest.fn() });
        });
    });

    test('MacroManager uses includeDirectories from lpc-support.json and ignores legacy setting', async () => {
        const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-macro-project-config-'));
        const includeDir = path.join(workspaceRoot, 'include');
        const configPath = path.join(workspaceRoot, 'lpc-support.json');
        const hellPath = path.join(workspaceRoot, 'config.hell');
        const projectConfigService = new LpcProjectConfigService();

        fs.mkdirSync(includeDir, { recursive: true });
        fs.writeFileSync(configPath, JSON.stringify({
            version: 1,
            configHellPath: 'config.hell'
        }, null, 2));
        fs.writeFileSync(hellPath, 'include directories : /include');

        (vscode.workspace.workspaceFolders as unknown) = [{ uri: { fsPath: workspaceRoot } }];
        (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([]);

        const manager = new MacroManager(projectConfigService, createVsCodeTextDocumentHost());
        await (manager as any).initializationPromise;

        expect(manager.getIncludePath()).toBe(includeDir);
    });

    test('MacroManager does not fall back to legacy includePath even when lpc-support.json exists without includeDirectories', async () => {
        const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-macro-legacy-disabled-'));
        const legacyIncludeDir = path.join(workspaceRoot, 'legacy-include');
        const configPath = path.join(workspaceRoot, 'lpc-support.json');
        const projectConfigService = new LpcProjectConfigService();

        fs.mkdirSync(legacyIncludeDir, { recursive: true });
        fs.writeFileSync(path.join(legacyIncludeDir, 'globals.h'), '#define TEST_D "/test"\n');
        fs.writeFileSync(configPath, JSON.stringify({
            version: 1,
            configHellPath: 'config.hell'
        }, null, 2));

        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: jest.fn((key: string, defaultValue?: unknown) => key === 'includePath' ? 'legacy-include' : defaultValue),
            update: jest.fn().mockResolvedValue(undefined)
        });
        (vscode.workspace.workspaceFolders as unknown) = [{ uri: { fsPath: workspaceRoot } }];

        const manager = new MacroManager(projectConfigService, createVsCodeTextDocumentHost());
        await (manager as any).initializationPromise;

        expect(manager.getIncludePath()).toBeUndefined();
        expect(manager.getAllMacros()).toEqual([]);
    });

    test('configurePath persists includeDirectories into lpc-support.json instead of workspace settings', async () => {
        const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-macro-configure-project-config-'));
        const includeDir = path.join(workspaceRoot, 'include');
        const configPath = path.join(workspaceRoot, 'lpc-support.json');
        const projectConfigService = new LpcProjectConfigService();

        fs.mkdirSync(includeDir, { recursive: true });
        fs.writeFileSync(configPath, JSON.stringify({
            version: 1,
            configHellPath: 'config.hell'
        }, null, 2));

        const configUpdate = jest.fn().mockResolvedValue(undefined);
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: jest.fn((_: string, defaultValue?: unknown) => defaultValue),
            update: configUpdate
        });
        (vscode.workspace.workspaceFolders as unknown) = [{ uri: { fsPath: workspaceRoot } }];
        (vscode.window.showInputBox as jest.Mock).mockResolvedValue(includeDir);

        const manager = new MacroManager(projectConfigService, createVsCodeTextDocumentHost());
        await (manager as any).initializationPromise;

        await manager.configurePath();

        const written = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        expect(written.resolved?.includeDirectories).toEqual([path.join('.', 'include')]);
        expect(configUpdate).not.toHaveBeenCalled();
    });
});
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
