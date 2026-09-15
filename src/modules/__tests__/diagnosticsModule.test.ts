import type * as vscode from 'vscode';
import { ServiceRegistry } from '../../core/ServiceRegistry';
import { Services } from '../../core/ServiceKeys';
import { RustDiagnosticsCommands } from '../../diagnostics/RustDiagnosticsCommands';
import { registerDiagnostics } from '../diagnosticsModule';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';

jest.mock('../../diagnostics/RustDiagnosticsCommands', () => ({
    RustDiagnosticsCommands: jest.fn()
}));

describe('registerDiagnostics', () => {
    beforeEach(() => {
        (RustDiagnosticsCommands as unknown as jest.Mock).mockReset();
    });

    test('registers Rust-backed diagnostic commands without constructing the TS analysis stack', () => {
        const registry = new ServiceRegistry();
        const context = { subscriptions: [] } as unknown as vscode.ExtensionContext;
        const manager = { sendRequest: jest.fn() };
        const diagnostics = {
            showVariables: jest.fn(),
            scanFolder: jest.fn(),
            dispose: jest.fn()
        };
        (RustDiagnosticsCommands as unknown as jest.Mock).mockImplementation(() => diagnostics);

        registerDiagnostics(registry, context, manager as any);

        expect(RustDiagnosticsCommands).toHaveBeenCalledWith(context, manager);
        expect(registry.get(Services.Diagnostics)).toBe(diagnostics);
        registry.dispose();
        expect(diagnostics.dispose).toHaveBeenCalledTimes(1);
    });

    test('keeps commands registered when the LSP manager is unavailable', () => {
        const registry = new ServiceRegistry();
        const context = { subscriptions: [] } as unknown as vscode.ExtensionContext;
        const diagnostics = {
            showVariables: jest.fn(),
            scanFolder: jest.fn(),
            dispose: jest.fn()
        };
        (RustDiagnosticsCommands as unknown as jest.Mock).mockImplementation(() => diagnostics);

        registerDiagnostics(registry, context, undefined);

        expect(RustDiagnosticsCommands).toHaveBeenCalledWith(context, undefined);
        expect(registry.get(Services.Diagnostics)).toBe(diagnostics);
    });
});
