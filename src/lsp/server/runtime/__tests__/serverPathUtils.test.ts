import { describe, expect, test } from '@jest/globals';
import {
    fromFileUri,
    normalizeComparablePath,
    resolveWorkspaceRootFromRoots
} from '../serverPathUtils';

describe('serverPathUtils', () => {
    test('fromFileUri normalizes file uris into platform file paths', () => {
        expect(fromFileUri('file:///D:/workspace/test.c')).toBe('D:/workspace/test.c');
        expect(fromFileUri('untitled:test')).toBe('untitled:test');
    });

    test('normalizeComparablePath lowercases Windows drive paths and trims trailing separators', () => {
        expect(normalizeComparablePath('D:\\Workspace\\src\\')).toBe('d:/workspace/src');
        expect(normalizeComparablePath('/workspace/src/')).toBe('/workspace/src');
    });

    test('resolveWorkspaceRootFromRoots prefers the deepest matching workspace root', () => {
        expect(resolveWorkspaceRootFromRoots(
            'file:///D:/workspace/sub/file.c',
            ['D:/workspace', 'D:/workspace/sub']
        )).toBe('D:/workspace/sub');
    });

    test('resolveWorkspaceRootFromRoots falls back to the first root when no document uri is available', () => {
        expect(resolveWorkspaceRootFromRoots(undefined, ['D:/a', 'D:/b'])).toBe('D:/a');
    });
});
