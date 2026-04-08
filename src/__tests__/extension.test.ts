import type * as vscode from 'vscode';
import { ServiceRegistry } from '../core/ServiceRegistry';
import { activate, deactivate } from '../extension';
import { registerCoreServices } from '../modules/coreModule';
import { registerDiagnostics } from '../modules/diagnosticsModule';
import { registerLanguageProviders } from '../modules/languageModule';
import { registerUI } from '../modules/uiModule';
import { registerCommands } from '../modules/commandModule';
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

jest.mock('../modules/languageModule', () => ({
    registerLanguageProviders: jest.fn()
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
        (registerLanguageProviders as jest.Mock).mockReset().mockImplementation(() => {
            registrationOrder.push('language');
            return Promise.resolve();
        });
        (registerUI as jest.Mock).mockReset().mockImplementation(() => {
            registrationOrder.push('ui');
        });
        (registerCommands as jest.Mock).mockReset().mockImplementation(() => {
            registrationOrder.push('commands');
        });
        (disposeGlobalParsedDocumentService as jest.Mock).mockReset();
    });

    test('activate creates a registry, tracks it, and delegates registration in module order', async () => {
        await activate(context);

        expect(ServiceRegistry).toHaveBeenCalledTimes(1);
        expect(context.subscriptions).toContain(registry);
        expect(registerCoreServices).toHaveBeenCalledWith(registry, context);
        expect(registerDiagnostics).toHaveBeenCalledWith(registry, context);
        expect(registerLanguageProviders).toHaveBeenCalledWith(registry, context);
        expect(registerUI).toHaveBeenCalledWith(registry, context);
        expect(registerCommands).toHaveBeenCalledWith(registry, context);
        expect(registrationOrder).toEqual(['core', 'diagnostics', 'language', 'ui', 'commands']);
    });

    test('deactivate disposes the global parsed document service', () => {
        deactivate();

        expect(disposeGlobalParsedDocumentService).toHaveBeenCalledTimes(1);
    });
});
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
