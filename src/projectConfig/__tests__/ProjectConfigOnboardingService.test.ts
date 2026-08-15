import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { LpcProjectConfigService } from '../LpcProjectConfigService';
import {
    detectLpcProject,
    ONBOARDING_ACTIONS,
    ProjectConfigOnboardingService
} from '../ProjectConfigOnboardingService';

describe('detectLpcProject', () => {
    test('returns non-lpc result for an empty workspace', () => {
        const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-onboarding-empty-'));

        const result = detectLpcProject(workspaceRoot);

        expect(result.isLpcProject).toBe(false);
        expect(result.configHellPath).toBeUndefined();
    });

    test('detects root config.hell as a strong signal', () => {
        const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-onboarding-root-hell-'));
        fs.writeFileSync(path.join(workspaceRoot, 'config.hell'), 'name : demo\n');

        const result = detectLpcProject(workspaceRoot);

        expect(result.isLpcProject).toBe(true);
        expect(result.configHellPath).toBe('config.hell');
    });

    test('detects config.hell one level below the workspace root', () => {
        const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-onboarding-nested-hell-'));
        fs.mkdirSync(path.join(workspaceRoot, 'config'));
        fs.writeFileSync(path.join(workspaceRoot, 'config', 'config.hell'), 'name : demo\n');

        const result = detectLpcProject(workspaceRoot);

        expect(result.isLpcProject).toBe(true);
        expect(result.configHellPath).toBe('config/config.hell');
    });

    test('detects a typical mudlib layout without config.hell', () => {
        const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-onboarding-mudlib-'));
        for (const dir of ['adm', 'include', 'clone']) {
            fs.mkdirSync(path.join(workspaceRoot, dir));
        }
        fs.mkdirSync(path.join(workspaceRoot, 'adm', 'single'), { recursive: true });
        fs.writeFileSync(
            path.join(workspaceRoot, 'adm', 'single', 'simul_efun.c'),
            'int sim_helper() { return 1; }'
        );

        const result = detectLpcProject(workspaceRoot);

        expect(result.isLpcProject).toBe(true);
        expect(result.configHellPath).toBeUndefined();
        expect(result.matchedSignals).toContain('adm/single/simul_efun.c');
    });

    test('requires at least three mud directories when no strong signal exists', () => {
        const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-onboarding-weak-'));
        for (const dir of ['include', 'obj']) {
            fs.mkdirSync(path.join(workspaceRoot, dir));
        }

        const result = detectLpcProject(workspaceRoot);

        expect(result.isLpcProject).toBe(false);
    });
});

describe('ProjectConfigOnboardingService', () => {
    const originalShowInformationMessage = vscode.window.showInformationMessage;
    const originalOpenExternal = vscode.env.openExternal;
    const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
    const originalOnDidChangeWorkspaceFolders = vscode.workspace.onDidChangeWorkspaceFolders;
    let workspaceRoot: string;

    const createMemento = () => ({
        get: jest.fn((): boolean | undefined => undefined),
        update: jest.fn(() => Promise.resolve(undefined))
    });

    const createPromptMock = (selection: string | undefined) =>
        jest.fn(() => Promise.resolve(selection));

    beforeEach(() => {
        workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-onboarding-service-'));
        (vscode.workspace as any).onDidChangeWorkspaceFolders = jest.fn().mockReturnValue({ dispose: jest.fn() });
    });

    afterEach(() => {
        (vscode.window as any).showInformationMessage = originalShowInformationMessage;
        (vscode.env as any).openExternal = originalOpenExternal;
        (vscode.workspace as any).workspaceFolders = originalWorkspaceFolders;
        (vscode.workspace as any).onDidChangeWorkspaceFolders = originalOnDidChangeWorkspaceFolders;
        jest.restoreAllMocks();
    });

    const createService = (overrides: Partial<{
        memento: ReturnType<typeof createMemento>;
        showInformationMessage: ReturnType<typeof createPromptMock>;
    }> = {}) => {
        const projectConfigService = new LpcProjectConfigService();
        const snapshotService = { refreshWorkspaceSnapshot: jest.fn(() => Promise.resolve(undefined)) };
        const service = new ProjectConfigOnboardingService({
            projectConfigService,
            snapshotService: snapshotService as any,
            memento: (overrides.memento ?? createMemento()) as any,
            documentationUri: 'https://example.com/lpc-support'
        });
        (vscode.window as any).showInformationMessage = overrides.showInformationMessage
            ?? createPromptMock(undefined);
        (vscode.env as any).openExternal = jest.fn(() => Promise.resolve(true));
        return { service, snapshotService };
    };

    test('skips the prompt when lpc-support.json already exists', async () => {
        fs.writeFileSync(
            path.join(workspaceRoot, 'lpc-support.json'),
            JSON.stringify({ version: 1, configHellPath: 'config.hell' })
        );
        const showInformationMessage = createPromptMock(undefined);
        const { service } = createService({ showInformationMessage });

        await service.checkAndPromptWorkspace(workspaceRoot);

        expect(showInformationMessage).not.toHaveBeenCalled();
    });

    test('skips the prompt when the workspace dismissed onboarding before', async () => {
        fs.writeFileSync(path.join(workspaceRoot, 'config.hell'), 'name : demo\n');
        const memento = createMemento();
        memento.get.mockReturnValue(true);
        const showInformationMessage = createPromptMock(undefined);
        const { service } = createService({ memento, showInformationMessage });

        await service.checkAndPromptWorkspace(workspaceRoot);

        expect(memento.get).toHaveBeenCalledWith(ProjectConfigOnboardingService.DISMISSED_STATE_KEY);
        expect(showInformationMessage).not.toHaveBeenCalled();
    });

    test('prompts for a detected mud workspace and generates config on demand', async () => {
        fs.writeFileSync(path.join(workspaceRoot, 'config.hell'), 'name : demo\n');
        const showInformationMessage = createPromptMock(ONBOARDING_ACTIONS.generate);
        const { service, snapshotService } = createService({ showInformationMessage });

        await service.checkAndPromptWorkspace(workspaceRoot);

        const promptCalls = showInformationMessage.mock.calls.filter(
            (call: any[]) => typeof call[1] === 'string' && call[1] === ONBOARDING_ACTIONS.generate
        );
        expect(promptCalls).toHaveLength(1);
        expect(fs.existsSync(path.join(workspaceRoot, 'lpc-support.json'))).toBe(true);
        const written = JSON.parse(fs.readFileSync(path.join(workspaceRoot, 'lpc-support.json'), 'utf8'));
        expect(written.configHellPath).toBe('config.hell');
        expect(snapshotService.refreshWorkspaceSnapshot).toHaveBeenCalledWith(workspaceRoot);
    });

    test('records dismissal when the user chooses never remind again', async () => {
        fs.writeFileSync(path.join(workspaceRoot, 'config.hell'), 'name : demo\n');
        const showInformationMessage = createPromptMock(ONBOARDING_ACTIONS.neverRemind);
        const memento = createMemento();
        const { service } = createService({ memento, showInformationMessage });

        await service.checkAndPromptWorkspace(workspaceRoot);

        expect(memento.update).toHaveBeenCalledWith(ProjectConfigOnboardingService.DISMISSED_STATE_KEY, true);
        expect(fs.existsSync(path.join(workspaceRoot, 'lpc-support.json'))).toBe(false);
    });

    test('opens documentation when the user chooses view docs', async () => {
        fs.writeFileSync(path.join(workspaceRoot, 'config.hell'), 'name : demo\n');
        const showInformationMessage = createPromptMock(ONBOARDING_ACTIONS.viewDocs);
        const { service } = createService({ showInformationMessage });

        await service.checkAndPromptWorkspace(workspaceRoot);

        expect(vscode.env.openExternal).toHaveBeenCalledWith(
            expect.objectContaining({ toString: expect.any(Function) })
        );
        expect(fs.existsSync(path.join(workspaceRoot, 'lpc-support.json'))).toBe(false);
    });

    test('does not prompt for a workspace without lpc project features', async () => {
        const showInformationMessage = createPromptMock(undefined);
        const { service } = createService({ showInformationMessage });

        await service.checkAndPromptWorkspace(workspaceRoot);

        expect(showInformationMessage).not.toHaveBeenCalled();
    });

    test('generateProjectConfig writes lpc-support.json with the detected config.hell', async () => {
        fs.mkdirSync(path.join(workspaceRoot, 'etc'));
        fs.writeFileSync(path.join(workspaceRoot, 'etc', 'config.hell'), 'name : demo\n');
        const showInformationMessage = createPromptMock(undefined);
        const { service, snapshotService } = createService({ showInformationMessage });

        const created = await service.generateProjectConfig(workspaceRoot);

        expect(created).toBe(true);
        const written = JSON.parse(fs.readFileSync(path.join(workspaceRoot, 'lpc-support.json'), 'utf8'));
        expect(written.configHellPath).toBe('etc/config.hell');
        expect(snapshotService.refreshWorkspaceSnapshot).toHaveBeenCalledWith(workspaceRoot);
    });

    test('start prompts once per workspace without awaiting user interaction', async () => {
        fs.writeFileSync(path.join(workspaceRoot, 'config.hell'), 'name : demo\n');
        const showInformationMessage = createPromptMock(undefined);
        const { service } = createService({ showInformationMessage });
        (vscode.workspace as any).workspaceFolders = [
            { uri: { fsPath: workspaceRoot } }
        ];

        service.start();
        await new Promise((resolve) => setTimeout(resolve, 0));
        await service.checkAndPromptWorkspace(workspaceRoot);

        expect(showInformationMessage).toHaveBeenCalledTimes(1);
    });
});
