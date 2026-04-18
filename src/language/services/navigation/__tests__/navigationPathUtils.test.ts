import { describe, expect, test } from '@jest/globals';
import * as vscode from 'vscode';
import { normalizeNavigationFsPath, normalizeWorkspaceUri } from '../navigationPathUtils';

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

describe('navigationPathUtils.normalizeNavigationFsPath', () => {
    test('normalizes Windows drive paths across slash variants and leading uri-style separators', () => {
        expect(normalizeNavigationFsPath('D:\\workspace\\room.h')).toBe('d:/workspace/room.h');
        expect(normalizeNavigationFsPath('D:/workspace/room.h')).toBe('d:/workspace/room.h');
        expect(normalizeNavigationFsPath('/D:/workspace/room.h')).toBe('d:/workspace/room.h');
        expect(normalizeNavigationFsPath('\\\\D:\\workspace\\room.h')).toBe('d:/workspace/room.h');
    });

    test('leaves non-windows paths slash-normalized without lowercasing unrelated prefixes', () => {
        expect(normalizeNavigationFsPath('/workspace/include/shared.h')).toBe('/workspace/include/shared.h');
    });
});
