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

    test('marks disk changes without replacing an open document version', () => {
        const index = new WorkspaceChangeIndex();
        const uri = 'file:///D:/workspace/room.c';

        index.markOpened(uri, 9);
        index.markDiskChanged(uri, 'changed');

        expect(index.get(uri)).toEqual(expect.objectContaining({
            openVersion: 9,
            dirty: true,
            deleted: false
        }));

        index.markDiskChanged(uri, 'deleted');
        expect(index.get(uri)).toEqual(expect.objectContaining({
            openVersion: 9,
            dirty: true,
            deleted: true
        }));
    });

    test('marks open owners maybe stale when a recorded dependency changes on disk', () => {
        const index = new WorkspaceChangeIndex();
        const ownerUri = 'file:///D:/workspace/room.c';
        const dependencyUri = 'file:///D:/workspace/include/helper.h';

        index.markOpened(ownerUri, 3);
        index.recordDependencyFootprint(ownerUri, [dependencyUri]);
        index.markDiskChanged(dependencyUri, 'changed');

        expect(index.get(ownerUri)).toEqual(expect.objectContaining({
            openVersion: 3,
            maybeStale: true,
            lastDependencyFootprint: [dependencyUri]
        }));
        expect(index.getMaybeStaleOpenUris()).toEqual([ownerUri]);
    });

    test('keeps closed owners out of maybe stale open files', () => {
        const index = new WorkspaceChangeIndex();
        const ownerUri = 'file:///D:/workspace/room.c';
        const dependencyUri = 'file:///D:/workspace/include/helper.h';

        index.markOpened(ownerUri, 3);
        index.recordDependencyFootprint(ownerUri, [dependencyUri]);
        index.markClosed(ownerUri);
        index.markDiskChanged(dependencyUri, 'changed');

        expect(index.get(ownerUri)).toEqual(expect.objectContaining({
            openVersion: undefined,
            maybeStale: false
        }));
        expect(index.getMaybeStaleOpenUris()).toEqual([]);
    });

    test('deduplicates dependency footprints and clears maybe stale state when clean', () => {
        const index = new WorkspaceChangeIndex();
        const ownerUri = 'file:///D:/workspace/room.c';
        const dependencyUri = 'file:///D:/workspace/include/helper.h';

        index.markOpened(ownerUri, 3);
        index.recordDependencyFootprint(ownerUri, [
            dependencyUri,
            'file:///d:/workspace/include/helper.h'
        ]);
        index.markDiskChanged(dependencyUri, 'changed');
        index.markClean(ownerUri);

        expect(index.get(ownerUri)).toEqual(expect.objectContaining({
            dirty: false,
            maybeStale: false,
            lastDependencyFootprint: [dependencyUri]
        }));
        expect(index.getMaybeStaleOpenUris()).toEqual([]);
    });

    test('does not mark clean when the file changed after diagnostics refresh started', () => {
        const index = new WorkspaceChangeIndex();
        const uri = 'file:///D:/workspace/room.c';

        const opened = index.markOpened(uri, 1);
        index.markChanged(uri, 2);
        index.markClean(uri, opened.lastChangedAt);

        expect(index.get(uri)).toEqual(expect.objectContaining({
            openVersion: 2,
            dirty: true
        }));
    });

    test('advances owner freshness when a dependency marks it maybe stale again', () => {
        const index = new WorkspaceChangeIndex();
        const ownerUri = 'file:///D:/workspace/room.c';
        const dependencyUri = 'file:///D:/workspace/include/helper.h';

        index.markOpened(ownerUri, 3);
        index.recordDependencyFootprint(ownerUri, [dependencyUri]);
        const beforeDependencyChange = index.get(ownerUri)!.lastChangedAt;
        index.markDiskChanged(dependencyUri, 'changed');

        expect(index.get(ownerUri)).toEqual(expect.objectContaining({
            maybeStale: true
        }));
        expect(index.get(ownerUri)!.lastChangedAt).toBeGreaterThan(beforeDependencyChange);
    });

    test('appends dependency footprints without replacing existing diagnostics dependencies', () => {
        const index = new WorkspaceChangeIndex();
        const ownerUri = 'file:///D:/workspace/room.c';
        const includeUri = 'file:///D:/workspace/include/helper.h';
        const targetUri = 'file:///D:/workspace/obj/npc.c';

        index.markOpened(ownerUri, 3);
        index.recordDependencyFootprint(ownerUri, [includeUri]);
        index.markDiskChanged(includeUri, 'changed');
        index.addDependencyFootprint(ownerUri, [targetUri, includeUri]);

        expect(index.get(ownerUri)).toEqual(expect.objectContaining({
            maybeStale: true,
            lastDependencyFootprint: [includeUri, targetUri]
        }));
    });

    test('replaces diagnostics footprints without dropping object target footprints', () => {
        const index = new WorkspaceChangeIndex();
        const ownerUri = 'file:///D:/workspace/room.c';
        const oldIncludeUri = 'file:///D:/workspace/include/old.h';
        const nextIncludeUri = 'file:///D:/workspace/include/next.h';
        const targetUri = 'file:///D:/workspace/obj/npc.c';

        index.markOpened(ownerUri, 3);
        index.recordDependencyFootprint(ownerUri, [oldIncludeUri]);
        index.addDependencyFootprint(ownerUri, [targetUri]);
        index.recordDependencyFootprint(ownerUri, [nextIncludeUri]);

        expect(index.get(ownerUri)).toEqual(expect.objectContaining({
            lastDiagnosticDependencyFootprint: [nextIncludeUri],
            lastDependencyFootprint: [nextIncludeUri, targetUri],
            lastTargetDependencyFootprint: [targetUri]
        }));
    });
});
