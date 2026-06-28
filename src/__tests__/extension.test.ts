import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import type * as vscode from 'vscode';
import { ServiceRegistry } from '../core/ServiceRegistry';
import { activate, deactivate } from '../extension';
import { activateLspClient } from '../lsp/client/activateLspClient';
import { registerWorkspaceIndexController } from '../lsp/client/workspaceIndexController';
import { registerCommands, registerWorkspaceIndexRebuildCommand } from '../modules/commandModule';
import { getRegisteredProjectConfigService, registerCoreServices } from '../modules/coreModule';
import { registerDiagnostics } from '../modules/diagnosticsModule';
import { registerUI } from '../modules/uiModule';
import { disposeGlobalParsedDocumentService } from '../parser/ParsedDocumentService';

jest.mock('../core/ServiceRegistry', () => ({
    ServiceRegistry: jest.fn()
}));

jest.mock('../modules/coreModule', () => ({
    getRegisteredProjectConfigService: jest.fn(),
    registerCoreServices: jest.fn()
}));

jest.mock('../modules/diagnosticsModule', () => ({
    registerDiagnostics: jest.fn()
}));

jest.mock('../modules/uiModule', () => ({
    registerUI: jest.fn()
}));

jest.mock('../modules/commandModule', () => ({
    registerCommands: jest.fn(),
    registerWorkspaceIndexRebuildCommand: jest.fn()
}));

jest.mock('../parser/ParsedDocumentService', () => ({
    disposeGlobalParsedDocumentService: jest.fn()
}));

jest.mock('../lsp/client/activateLspClient', () => ({
    activateLspClient: jest.fn()
}));

jest.mock('../lsp/client/workspaceIndexController', () => ({
    registerWorkspaceIndexController: jest.fn()
}));

jest.mock('vscode', () => ({}), { virtual: true });

describe('extension entrypoint', () => {
    let context: vscode.ExtensionContext;
    let registry: { dispose: jest.Mock };
    let projectConfigService: { loadForWorkspace: jest.Mock; getProjectConfigPath: jest.Mock };
    let registrationOrder: string[];

    beforeEach(() => {
        context = { subscriptions: [] } as unknown as vscode.ExtensionContext;
        registry = { dispose: jest.fn() };
        projectConfigService = { loadForWorkspace: jest.fn(), getProjectConfigPath: jest.fn() };
        registrationOrder = [];

        (ServiceRegistry as unknown as jest.Mock).mockReset().mockImplementation(() => registry);
        (registerCoreServices as jest.Mock).mockReset().mockImplementation(async () => {
            registrationOrder.push('core');
        });
        (getRegisteredProjectConfigService as jest.Mock).mockReset().mockReturnValue(projectConfigService);
        (registerDiagnostics as jest.Mock).mockReset().mockImplementation(() => {
            registrationOrder.push('diagnostics');
        });
        (registerUI as jest.Mock).mockReset().mockImplementation(() => {
            registrationOrder.push('ui');
        });
        (registerCommands as jest.Mock).mockReset().mockImplementation(() => {
            registrationOrder.push('commands');
        });
        (registerWorkspaceIndexRebuildCommand as jest.Mock).mockReset().mockReturnValue({ dispose: jest.fn() });
        (activateLspClient as jest.Mock).mockReset().mockResolvedValue(undefined);
        (registerWorkspaceIndexController as jest.Mock).mockReset();
        (disposeGlobalParsedDocumentService as jest.Mock).mockReset();
    });

    test('activate always wires the single public LSP path', async () => {
        await activate(context);

        expect(ServiceRegistry).toHaveBeenCalledTimes(1);
        expect(context.subscriptions).toContain(registry);
        expect(registerCoreServices).toHaveBeenCalledWith(registry, context);
        expect(registerDiagnostics).toHaveBeenCalledWith(registry, context);
        expect(registerUI).toHaveBeenCalledWith(registry, context);
        expect(registerCommands).toHaveBeenCalledWith(registry, context);
        expect(activateLspClient).toHaveBeenCalledWith(context);
        expect(registerWorkspaceIndexController).not.toHaveBeenCalled();
        expect(registrationOrder).toEqual(['core', 'diagnostics', 'ui', 'commands']);
    });

    test('activate registers workspace indexing controls when LSP starts', async () => {
        const manager = { sendRequest: jest.fn() };
        (activateLspClient as jest.Mock).mockResolvedValue(manager);

        await activate(context);

        expect(registerWorkspaceIndexController).toHaveBeenCalledWith({
            context,
            manager,
            projectConfigService,
            registerRebuildCommand: expect.any(Function)
        });
        const options = (registerWorkspaceIndexController as jest.Mock).mock.calls[0][0];
        const handler = jest.fn(async () => undefined);
        options.registerRebuildCommand(handler);
        expect(registerWorkspaceIndexRebuildCommand).toHaveBeenCalledWith(context, handler);
    });

    test('deactivate disposes the global parsed document service', () => {
        deactivate();

        expect(disposeGlobalParsedDocumentService).toHaveBeenCalledTimes(1);
    });
});
