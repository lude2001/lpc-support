import * as vscode from 'vscode';

export class ServiceKey<T> {
    constructor(public readonly id: string) {}
}

export class ServiceRegistry implements vscode.Disposable {
    private services = new Map<string, unknown>();
    private disposables: vscode.Disposable[] = [];

    register<T>(key: ServiceKey<T>, instance: T): void {
        if (this.services.has(key.id)) {
            throw new Error(`Service "${key.id}" is already registered`);
        }

        this.services.set(key.id, instance);
    }

    get<T>(key: ServiceKey<T>): T {
        if (!this.services.has(key.id)) {
            throw new Error(`Service "${key.id}" is not registered`);
        }

        return this.services.get(key.id) as T;
    }

    track(disposable: vscode.Disposable): void {
        this.disposables.push(disposable);
    }

    dispose(): void {
        for (const disposable of this.disposables.reverse()) {
            disposable.dispose();
        }

        this.disposables = [];
        this.services.clear();
    }
}
