import * as vscode from 'vscode';
import * as path from 'path';
import {
    CloseAction,
    ErrorAction,
    type ErrorHandler,
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
    const serverOptions: ServerOptions = {
        run: {
            command: runtime.command,
            transport: TransportKind.stdio,
            options: {
                env: {
                    ...process.env,
                    LPC_EXTENSION_ROOT: context.extensionPath,
                    LPC_INDEX_CACHE_VERSION: String(
                        context.extension?.packageJSON?.version ?? 'development'
                    ),
                    LPC_INDEX_CACHE_ROOT: path.join(
                        context.globalStorageUri?.fsPath ?? context.extensionPath ?? process.cwd(),
                        'workspace-index'
                    )
                }
            }
        },
        debug: {
            command: runtime.command,
            transport: TransportKind.stdio,
            options: {
                env: {
                    ...process.env,
                    LPC_EXTENSION_ROOT: context.extensionPath,
                    LPC_INDEX_CACHE_VERSION: String(
                        context.extension?.packageJSON?.version ?? 'development'
                    ),
                    LPC_INDEX_CACHE_ROOT: path.join(
                        context.globalStorageUri?.fsPath ?? context.extensionPath ?? process.cwd(),
                        'workspace-index'
                    )
                }
            }
        }
    };
    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ language: 'lpc', scheme: 'file' }],
        outputChannel: vscode.window.createOutputChannel('LPC LSP'),
        connectionOptions: {
            maxRestartCount: 3
        },
        errorHandler: createLspClientErrorHandler('LPC Support Rust', 3)
    };

    return new LanguageClient(
        'lpc-support-rust',
        'LPC Support Rust',
        serverOptions,
        clientOptions
    );
}

export function createLspClientErrorHandler(
    clientName: string,
    maxRestartCount: number,
    now: () => number = Date.now
): ErrorHandler {
    const restartWindowMs = 3 * 60 * 1000;
    const restarts: number[] = [];

    return {
        error(_error: Error, _message: unknown, count: number | undefined) {
            if (count && count <= 3) {
                return { action: ErrorAction.Continue, handled: true };
            }

            return { action: ErrorAction.Shutdown };
        },
        closed() {
            const timestamp = now();
            restarts.push(timestamp);
            while (restarts.length > 0 && timestamp - restarts[0] > restartWindowMs) {
                restarts.shift();
            }

            if (restarts.length <= maxRestartCount) {
                return { action: CloseAction.Restart, handled: true };
            }

            return {
                action: CloseAction.DoNotRestart,
                message: `${clientName} server crashed ${maxRestartCount + 1} times in the last 3 minutes. `
                    + 'The server will not be restarted. See the LPC LSP output for details.'
            };
        }
    };
}
