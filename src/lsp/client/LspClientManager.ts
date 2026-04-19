import * as vscode from 'vscode';

export interface NotificationCapableLspClient {
    start?: () => Promise<void> | void;
    stop?: () => Promise<void> | void;
    sendNotification?: (method: string, payload: unknown) => Promise<void> | void;
    dispose?: () => void;
}

type LspClientLifecycle = {
    client?: NotificationCapableLspClient;
    start?: (manager: LspClientManager) => Promise<void> | void;
    stop?: (manager: LspClientManager) => Promise<void> | void;
    dispose?: () => void;
};

export class LspClientManager implements vscode.Disposable {
    private readonly lifecycle: LspClientLifecycle;
    private running = false;
    private disposed = false;
    private startPromise?: Promise<void>;
    private stopPromise?: Promise<void>;
    private disposePromise?: Promise<void>;

    public constructor(lifecycle: LspClientLifecycle) {
        this.lifecycle = lifecycle;
    }

    public async sendNotification(method: string, payload: unknown): Promise<void> {
        if (this.lifecycle.client?.sendNotification) {
            await this.lifecycle.client.sendNotification(method, payload);
        }
    }

    public async start(): Promise<void> {
        if (this.disposed) {
            return;
        }

        if (this.running) {
            return;
        }

        if (this.startPromise) {
            await this.startPromise;
            return;
        }

        this.startPromise = (async () => {
            if (this.lifecycle.client?.start) {
                await this.lifecycle.client.start();
            }
            await this.lifecycle.start?.(this);
            this.running = true;

            if (this.disposed) {
                await this.stopInternal();
            }
        })().finally(() => {
            this.startPromise = undefined;
        });

        await this.startPromise;
    }

    public async stop(): Promise<void> {
        if (this.startPromise) {
            await this.startPromise;
        }

        await this.stopInternal();
    }

    public dispose(): void {
        if (this.disposed) {
            return;
        }

        this.disposed = true;
        this.disposePromise ??= (async () => {
            await this.stop();
            this.lifecycle.client?.dispose?.();
            this.lifecycle.dispose?.();
        })();
    }

    private async stopInternal(): Promise<void> {
        if (!this.running) {
            return;
        }

        if (this.stopPromise) {
            await this.stopPromise;
            return;
        }

        this.stopPromise = (async () => {
            await this.lifecycle.stop?.(this);
            if (this.lifecycle.client?.stop) {
                await this.lifecycle.client.stop();
            }
            this.running = false;
        })().finally(() => {
            this.stopPromise = undefined;
        });

        await this.stopPromise;
    }
}
