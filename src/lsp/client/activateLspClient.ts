import * as vscode from 'vscode';
import * as path from 'path';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind
} from 'vscode-languageclient/node';
import { initializeConfigurationBridge } from './bridges/configurationBridge';
import { initializeSourceFileChangeBridge } from './bridges/sourceFileChangeBridge';
import { LspClientManager } from './LspClientManager';
import { getRegisteredProjectConfigService } from '../../modules/coreModule';
import { resolveLanguageServerRuntime } from './languageServerRuntime';

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
    let sourceFileChangeBridgeDisposable: vscode.Disposable | undefined;
    const client = createLanguageClient(context);

    return new LspClientManager({
        client,
        start: async () => {
            sourceFileChangeBridgeDisposable = initializeSourceFileChangeBridge({
                client
            });

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
            sourceFileChangeBridgeDisposable?.dispose();
            sourceFileChangeBridgeDisposable = undefined;
            configurationBridgeDisposable?.dispose();
            configurationBridgeDisposable = undefined;
        }
    });
}

function createLanguageClient(context: vscode.ExtensionContext): LanguageClient {
    const runtime = resolveLanguageServerRuntime(context);
    const serverOptions: ServerOptions = runtime.kind === 'rust'
        ? {
            run: {
                command: runtime.command,
                transport: TransportKind.stdio,
                options: {
                    env: {
                        ...process.env,
                        LPC_EXTENSION_ROOT: context.extensionPath
                    }
                }
            },
            debug: {
                command: runtime.command,
                transport: TransportKind.stdio,
                options: {
                    env: {
                        ...process.env,
                        LPC_EXTENSION_ROOT: context.extensionPath
                    }
                }
            }
        }
        : {
            run: {
                module: runtime.module,
                transport: TransportKind.ipc
            },
            debug: {
                module: runtime.module,
                transport: TransportKind.ipc
            }
        };
    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ language: 'lpc', scheme: 'file' }],
        outputChannel: vscode.window.createOutputChannel('LPC LSP')
    };

    return new LanguageClient(
        runtime.kind === 'rust' ? 'lpc-support-rust' : 'lpc-support-phase-a',
        runtime.kind === 'rust' ? 'LPC Support Rust' : 'LPC Support Phase A',
        serverOptions,
        clientOptions
    );
}
