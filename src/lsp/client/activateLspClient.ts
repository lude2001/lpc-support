import * as vscode from 'vscode';
import * as path from 'path';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind
} from 'vscode-languageclient/node';
import { initializeConfigurationBridge } from './bridges/configurationBridge';
import { LspClientManager } from './LspClientManager';
import { getRegisteredProjectConfigService } from '../../modules/coreModule';

export type LspClientManagerFactory = () => LspClientManager;

export async function activateLspClient(
    context: vscode.ExtensionContext,
    createManager: LspClientManagerFactory = () => createPhaseAClientManager(context)
): Promise<LspClientManager | undefined> {
    const manager = createManager();
    context.subscriptions.push(manager);
    await manager.start();
    return manager;
}

function createPhaseAClientManager(context: vscode.ExtensionContext): LspClientManager {
    let configurationBridgeDisposable: vscode.Disposable | undefined;
    const client = createPhaseALanguageClient(context);

    return new LspClientManager({
        client,
        start: async () => {
            const projectConfigService = getRegisteredProjectConfigService();
            if (!projectConfigService) {
                return;
            }

            configurationBridgeDisposable = await initializeConfigurationBridge({
                client,
                projectConfigService
            });
        },
        stop: async () => {
            configurationBridgeDisposable?.dispose();
            configurationBridgeDisposable = undefined;
        }
    });
}

function createPhaseALanguageClient(context: vscode.ExtensionContext): LanguageClient {
    const serverModule = context.asAbsolutePath(path.join('dist', 'lsp', 'server.js'));
    const serverOptions: ServerOptions = {
        run: {
            module: serverModule,
            transport: TransportKind.ipc
        },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc
        }
    };
    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ language: 'lpc', scheme: 'file' }],
        outputChannel: vscode.window.createOutputChannel('LPC LSP')
    };

    return new LanguageClient(
        'lpc-support-phase-a',
        'LPC Support Phase A',
        serverOptions,
        clientOptions
    );
}
