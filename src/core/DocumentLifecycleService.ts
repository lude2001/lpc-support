import * as vscode from 'vscode';

export type InvalidateHandler = (uri: vscode.Uri) => void;

export class DocumentLifecycleService implements vscode.Disposable {
    private readonly handlers = new Set<InvalidateHandler>();
    private readonly subscriptions: vscode.Disposable[];

    constructor() {
        this.subscriptions = [
            vscode.workspace.onDidCloseTextDocument((document) => {
                if (document.languageId === 'lpc') {
                    this.invalidate(document.uri);
                }
            }),
            vscode.workspace.onDidDeleteFiles((event) => {
                for (const uri of event.files) {
                    this.invalidate(uri);
                }
            })
        ];
    }

    public onInvalidate(handler: InvalidateHandler): void {
        this.handlers.add(handler);
    }

    public dispose(): void {
        for (const subscription of this.subscriptions) {
            subscription.dispose();
        }

        this.handlers.clear();
    }

    private invalidate(uri: vscode.Uri): void {
        for (const handler of this.handlers) {
            handler(uri);
        }
    }
}
