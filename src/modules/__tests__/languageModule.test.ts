import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import { ServiceRegistry } from '../../core/ServiceRegistry';
import { Services } from '../../core/ServiceKeys';
import { registerHostLanguageAffordances } from '../languageModule';

describe('registerHostLanguageAffordances', () => {
    let registry: ServiceRegistry;
    let context: vscode.ExtensionContext;

    beforeEach(() => {
        registry = new ServiceRegistry();
        context = { subscriptions: [] } as vscode.ExtensionContext;
        (vscode.languages.registerCodeActionsProvider as jest.Mock).mockClear();
        (vscode.languages.registerHoverProvider as jest.Mock).mockClear();
    });

    test('does not register host-side code actions or hover providers after LSP cutover', async () => {
        await registerHostLanguageAffordances(registry, context);

        expect(vscode.languages.registerCodeActionsProvider).not.toHaveBeenCalled();
        expect(vscode.languages.registerHoverProvider).not.toHaveBeenCalled();
        expect(context.subscriptions).toHaveLength(0);
    });
});
