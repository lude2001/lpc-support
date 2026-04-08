import * as vscode from 'vscode';
import axios from 'axios';
import { ErrorTreeDataProvider } from '../errorTreeDataProvider';

jest.mock('axios');

describe('ErrorTreeDataProvider', () => {
    let projectConfigService: {
        loadForWorkspace: jest.Mock;
    };

    beforeEach(() => {
        projectConfigService = {
            loadForWorkspace: jest.fn()
        };

        (axios.get as jest.Mock).mockReset().mockResolvedValue({ data: { errors: [] } });
        (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: 'D:/workspace' } }];
    });

    test('refresh uses remote compilation servers from lpc-support.json and follows the active server', async () => {
        projectConfigService.loadForWorkspace.mockResolvedValue({
            version: 1,
            configHellPath: 'config.hell',
            compile: {
                mode: 'remote',
                remote: {
                    activeServer: 'Beta',
                    servers: [
                        { name: 'Alpha', url: 'http://127.0.0.1:8080' },
                        { name: 'Beta', url: 'http://127.0.0.1:8081' }
                    ]
                }
            }
        });

        const provider = new ErrorTreeDataProvider(projectConfigService as any);
        await provider.fetchErrors();

        expect(projectConfigService.loadForWorkspace).toHaveBeenCalledWith('D:/workspace');
        expect(axios.get).toHaveBeenCalledWith('http://127.0.0.1:8081/error_info/get_compile_errors');
        expect(axios.get).toHaveBeenCalledWith('http://127.0.0.1:8081/error_info/get_runtime_errors');
    });

    test('returns placeholder when project config does not provide remote servers', async () => {
        projectConfigService.loadForWorkspace.mockResolvedValue({
            version: 1,
            configHellPath: 'config.hell',
            compile: {
                mode: 'local',
                remote: {
                    servers: []
                }
            }
        });

        const provider = new ErrorTreeDataProvider(projectConfigService as any);
        await provider.fetchErrors();
        const children = await provider.getChildren();

        expect(axios.get).not.toHaveBeenCalled();
        expect(children[0].label).toBe('No error server selected.');
    });
});
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
