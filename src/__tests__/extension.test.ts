import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import type * as vscode from 'vscode';
import { ServiceRegistry } from '../core/ServiceRegistry';
import { activate, deactivate } from '../extension';
import { activateLspClient } from '../lsp/client/activateLspClient';
import { registerCommands } from '../modules/commandModule';
import { registerCoreServices } from '../modules/coreModule';
import { registerDiagnostics } from '../modules/diagnosticsModule';
import { registerUI } from '../modules/uiModule';
import { disposeGlobalParsedDocumentService } from '../parser/ParsedDocumentService';

jest.mock('../core/ServiceRegistry', () => ({
    ServiceRegistry: jest.fn()
}));

jest.mock('../modules/coreModule', () => ({
    registerCoreServices: jest.fn()
}));

jest.mock('../modules/diagnosticsModule', () => ({
    registerDiagnostics: jest.fn()
}));

jest.mock('../modules/uiModule', () => ({
    registerUI: jest.fn()
}));

jest.mock('../modules/commandModule', () => ({
    registerCommands: jest.fn()
}));

jest.mock('../parser/ParsedDocumentService', () => ({
    disposeGlobalParsedDocumentService: jest.fn()
}));

jest.mock('../lsp/client/activateLspClient', () => ({
    activateLspClient: jest.fn()
}));

jest.mock('vscode', () => ({}), { virtual: true });

describe('extension entrypoint', () => {
    let context: vscode.ExtensionContext;
    let registry: { dispose: jest.Mock };
    let registrationOrder: string[];

    beforeEach(() => {
        context = { subscriptions: [] } as unknown as vscode.ExtensionContext;
        registry = { dispose: jest.fn() };
        registrationOrder = [];

        (ServiceRegistry as unknown as jest.Mock).mockReset().mockImplementation(() => registry);
        (registerCoreServices as jest.Mock).mockReset().mockImplementation(() => {
            registrationOrder.push('core');
        });
        (registerDiagnostics as jest.Mock).mockReset().mockImplementation(() => {
            registrationOrder.push('diagnostics');
        });
        (registerUI as jest.Mock).mockReset().mockImplementation(() => {
            registrationOrder.push('ui');
        });
        (registerCommands as jest.Mock).mockReset().mockImplementation(() => {
            registrationOrder.push('commands');
        });
        (activateLspClient as jest.Mock).mockReset().mockResolvedValue(undefined);
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
        expect(registrationOrder).toEqual(['core', 'diagnostics', 'ui', 'commands']);
    });

    test('deactivate disposes the global parsed document service', () => {
        deactivate();

        expect(disposeGlobalParsedDocumentService).toHaveBeenCalledTimes(1);
    });
});
