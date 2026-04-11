import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { WorkspaceSession } from '../runtime/WorkspaceSession';
import type { WorkspaceConfigSyncPayload } from '../../shared/protocol/workspaceConfigSync';
import type { LanguageFeatureServices } from '../../../language/contracts/LanguageFeatureServices';
import type { LanguageCompletionService } from '../../../language/services/completion/LanguageCompletionService';
import type { LanguageNavigationService } from '../../../language/services/navigation/LanguageHoverService';
import type { LanguageStructureService } from '../../../language/services/structure/LanguageFoldingService';
import { Uri, workspace } from '../runtime/vscodeShim';

describe('WorkspaceSession', () => {
    test('stores workspace roots and synchronized config snapshots', () => {
        const workspaceRoot = 'D:/code/lpc-support';
        const session = new WorkspaceSession({
            workspaceRoots: [workspaceRoot]
        });

        session.updateWorkspaceConfig(workspaceRoot, {
            projectConfigPath: 'D:/code/lpc-support/lpc-support.json',
            resolvedConfig: {
                includeDirectories: ['include']
            }
        });

        expect(session.getWorkspaceRoots()).toEqual([workspaceRoot]);
        expect(session.getWorkspaceConfig(workspaceRoot)?.projectConfigPath).toContain('lpc-support.json');
        expect(session.getWorkspaceConfig(workspaceRoot)?.resolvedConfig?.includeDirectories).toEqual(['include']);
    });

    test('returns a defensive copy for nested resolvedConfig state', () => {
        const workspaceRoot = 'D:/code/lpc-support';
        const session = new WorkspaceSession({
            workspaceRoots: [workspaceRoot]
        });

        session.updateWorkspaceConfig(workspaceRoot, {
            projectConfigPath: 'D:/code/lpc-support/lpc-support.json',
            resolvedConfig: {
                includeDirectories: ['include']
            }
        });

        const snapshot = session.getWorkspaceConfig(workspaceRoot);
        snapshot?.resolvedConfig?.includeDirectories?.push('mutated');

        expect(session.getWorkspaceConfig(workspaceRoot)?.resolvedConfig?.includeDirectories).toEqual(['include']);
    });

    test('exposes a typed language workspace context', () => {
        const workspaceRoot = 'D:/code/lpc-support';
        const session = new WorkspaceSession({
            workspaceRoots: [workspaceRoot]
        });

        session.updateWorkspaceConfig(workspaceRoot, {
            projectConfigPath: 'D:/code/lpc-support/lpc-support.json',
            resolvedConfig: {
                includeDirectories: ['include']
            }
        });

        const context = session.toLanguageWorkspaceContext(workspaceRoot);

        expect(context.workspaceRoot).toBe(workspaceRoot);
        expect(context.projectConfig?.projectConfigPath).toContain('lpc-support.json');
        expect(context.projectConfig?.resolvedConfig?.includeDirectories).toEqual(['include']);
    });

    test('applies workspace config sync payloads as the runtime source of truth', () => {
        const session = new WorkspaceSession({
            workspaceRoots: ['D:/workspace-a']
        });

        session.updateWorkspaceConfig('D:/workspace-a', {
            projectConfigPath: 'D:/workspace-a/lpc-support.json'
        });

        const payload: WorkspaceConfigSyncPayload = {
            workspaceRoots: ['D:/workspace-b'],
            workspaces: [
                {
                    workspaceRoot: 'D:/workspace-b',
                    projectConfigPath: 'D:/workspace-b/lpc-support.json',
                    configHellPath: 'config.hell',
                    resolvedConfig: {
                        includeDirectories: ['include']
                    },
                    lastSyncedAt: '2026-04-10T00:00:00.000Z'
                }
            ]
        };

        session.applyWorkspaceConfigSync(payload);

        expect(session.getWorkspaceRoots()).toEqual(['D:/workspace-b']);
        expect(session.getWorkspaceConfig('D:/workspace-a')).toBeUndefined();
        expect(session.getWorkspaceConfig('D:/workspace-b')).toEqual({
            projectConfigPath: 'D:/workspace-b/lpc-support.json',
            configHellPath: 'config.hell',
            resolvedConfig: {
                includeDirectories: ['include']
            },
            lastSyncedAt: '2026-04-10T00:00:00.000Z'
        });
    });

    test('normalizes synchronized roots and updates server workspace state after config changes', () => {
        const session = new WorkspaceSession({
            workspaceRoots: ['D:/workspace-initial']
        });

        session.applyWorkspaceConfigSync({
            workspaceRoots: ['D:\\workspace-a\\', 'D:/workspace-a/nested/', 'D:/workspace-a'],
            workspaces: [
                {
                    workspaceRoot: 'D:\\workspace-a\\',
                    projectConfigPath: 'D:\\workspace-a\\lpc-support.json'
                },
                {
                    workspaceRoot: 'D:/workspace-a/nested/',
                    projectConfigPath: 'D:/workspace-a/nested/lpc-support.json'
                }
            ]
        });

        expect(session.getWorkspaceRoots()).toEqual(['D:/workspace-a', 'D:/workspace-a/nested']);
        expect(session.getWorkspaceConfig('D:/workspace-a')?.projectConfigPath).toBe('D:/workspace-a/lpc-support.json');
        expect(workspace.rootPath).toBe('D:/workspace-a');
        expect(workspace.workspaceFolders.map(folder => folder.uri.fsPath)).toEqual([
            'D:/workspace-a',
            'D:/workspace-a/nested'
        ]);
        expect(workspace.getWorkspaceFolder(Uri.file('D:/workspace-a/nested/src/example.c'))).toEqual(
            expect.objectContaining({
                index: 1,
                uri: expect.objectContaining({
                    fsPath: 'D:/workspace-a/nested'
                })
            })
        );

        session.applyWorkspaceConfigSync({
            workspaceRoots: ['D:/workspace-b/'],
            workspaces: [
                {
                    workspaceRoot: 'D:/workspace-b/',
                    projectConfigPath: 'D:/workspace-b/lpc-support.json'
                }
            ]
        });

        expect(session.getWorkspaceRoots()).toEqual(['D:/workspace-b']);
        expect(workspace.rootPath).toBe('D:/workspace-b');
        expect(workspace.getWorkspaceFolder(Uri.file('D:/workspace-a/src/example.c'))).toBeUndefined();
    });

    test('exposes services through the language workspace context', () => {
        const workspaceRoot = 'D:/code/lpc-support';
        const completionService = {} as LanguageCompletionService;
        const navigationService = {} as LanguageNavigationService;
        const structureService = {} as LanguageStructureService;

        const session = new WorkspaceSession({
            workspaceRoots: [workspaceRoot],
            featureServices: {
                completionService,
                navigationService,
                structureService
            }
        });

        const context = session.toLanguageWorkspaceContext(workspaceRoot);
        const services: LanguageFeatureServices | undefined = context.services;

        expect(services).toBeDefined();
        expect(services.completionService).toBe(completionService);
        expect(services.navigationService).toBe(navigationService);
        expect(services.structureService).toBe(structureService);
    });
});
