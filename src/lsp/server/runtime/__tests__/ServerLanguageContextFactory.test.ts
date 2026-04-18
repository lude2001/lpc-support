import { describe, expect, test } from '@jest/globals';
import * as vscode from 'vscode';
import { DocumentStore } from '../DocumentStore';
import { ServerLanguageContextFactory } from '../ServerLanguageContextFactory';
import { WorkspaceSession } from '../WorkspaceSession';

describe('ServerLanguageContextFactory', () => {
    test('creates a navigation-compatible capability context from DocumentStore text', () => {
        const store = new DocumentStore();
        store.open('file:///D:/workspace/test.c', 7, 'int main() {\n    local_\n}');

        const session = new WorkspaceSession({ workspaceRoots: ['D:/work', 'D:/workspace'] });
        const factory = new ServerLanguageContextFactory(store, session);
        const context = factory.createCapabilityContext('file:///D:/workspace/test.c');

        expect(context.workspace.workspaceRoot).toBe('D:/workspace');
        expect(context.document.getText()).toContain('local_');
        expect(context.document.getWordRangeAtPosition({ line: 1, character: 6 })).toEqual(
            new vscode.Range(1, 4, 1, 10)
        );
        expect(context.document.positionAt(17)).toEqual(expect.objectContaining({ line: 1, character: 4 }));
    });

    test('creates a diagnostics-light context from the same shared roots', () => {
        const store = new DocumentStore();
        store.open('file:///D:/workspace/check.c', 1, 'BAD_OBJECT->query_name();');

        const session = new WorkspaceSession({ workspaceRoots: ['D:/workspace'] });
        const factory = new ServerLanguageContextFactory(store, session);
        const diagnosticsContext = factory.createDiagnosticsRequestContext('file:///D:/workspace/check.c');

        expect(diagnosticsContext.workspaceRoot).toBe('D:/workspace');
        expect(diagnosticsContext.document.getText()).toBe('BAD_OBJECT->query_name();');
    });

    test('falls back safely when createCapabilityContext receives no documentUri', () => {
        const session = new WorkspaceSession({ workspaceRoots: ['D:/workspace'] });
        const factory = new ServerLanguageContextFactory(new DocumentStore(), session);
        const context = factory.createCapabilityContext(undefined);

        expect(context.workspace.workspaceRoot).toBe('D:/workspace');
        expect(context.document.getText()).toBe('');
        expect(context.document.fileName).toBe('');
    });
});
