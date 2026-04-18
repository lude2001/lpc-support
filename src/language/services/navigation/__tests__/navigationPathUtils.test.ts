import { describe, expect, test } from '@jest/globals';
import * as vscode from 'vscode';
import { normalizeWorkspaceUri } from '../navigationPathUtils';

describe('navigationPathUtils.normalizeWorkspaceUri', () => {
    test('normalizes four-slash Windows file URIs to the canonical three-slash form', () => {
        expect(normalizeWorkspaceUri('file:////D:/workspace/room.c')).toBe('file:///D:/workspace/room.c');
        expect(normalizeWorkspaceUri(vscode.Uri.parse('file:////D:/workspace/room.c'))).toBe('file:///D:/workspace/room.c');
    });

    test('leaves canonical file URIs and non-file URIs unchanged', () => {
        expect(normalizeWorkspaceUri('file:///D:/workspace/room.c')).toBe('file:///D:/workspace/room.c');
        expect(normalizeWorkspaceUri('untitled:room.c')).toBe('untitled:room.c');
    });
});
