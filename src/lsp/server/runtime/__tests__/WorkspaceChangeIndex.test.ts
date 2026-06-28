import { describe, expect, test } from '@jest/globals';
import { WorkspaceChangeIndex } from '../WorkspaceChangeIndex';

describe('WorkspaceChangeIndex', () => {
    test('tracks open and change versions without storing semantic facts', () => {
        const index = new WorkspaceChangeIndex();
        const uri = 'file:///D:/workspace/room.c';

        index.markOpened(uri, 1);
        expect(index.get(uri)).toEqual(expect.objectContaining({
            uri,
            openVersion: 1,
            dirty: true,
            deleted: false,
            workspaceConfigGeneration: 0
        }));

        index.markClean(uri);
        index.markChanged(uri, 2);

        expect(index.get(uri)).toEqual(expect.objectContaining({
            uri,
            openVersion: 2,
            dirty: true,
            deleted: false
        }));
    });

    test('bumps workspace config generation for later freshness checks', () => {
        const index = new WorkspaceChangeIndex();

        expect(index.getWorkspaceConfigGeneration()).toBe(0);
        expect(index.nextWorkspaceConfigGeneration()).toBe(1);
        expect(index.nextWorkspaceConfigGeneration()).toBe(2);

        index.markOpened('file:///D:/workspace/room.c', 1);
        expect(index.get('file:///D:/workspace/room.c')).toEqual(expect.objectContaining({
            workspaceConfigGeneration: 2
        }));
    });

    test('marks closed and deleted files as dirty state changes', () => {
        const index = new WorkspaceChangeIndex();
        const uri = 'file:///D:/workspace/room.c';

        index.markOpened(uri, 1);
        index.markClosed(uri);

        expect(index.get(uri)).toEqual(expect.objectContaining({
            openVersion: undefined,
            dirty: true,
            deleted: false
        }));

        index.markDeleted(uri);
        expect(index.get(uri)).toEqual(expect.objectContaining({
            openVersion: undefined,
            dirty: true,
            deleted: true
        }));
    });
});
