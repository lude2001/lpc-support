import { describe, expect, jest, test } from '@jest/globals';
import { DocumentFreshnessService } from '../DocumentFreshnessService';
import { ServerLogger } from '../ServerLogger';
import { WorkspaceChangeIndex } from '../WorkspaceChangeIndex';

describe('DocumentFreshnessService', () => {
    test('invalidates the runtime document before notifying production caches', () => {
        const calls: string[] = [];
        const { logger, output } = createLogger();
        const service = new DocumentFreshnessService({
            invalidateRuntimeDocument: (uri) => calls.push(`runtime:${uri}`),
            logger,
            onDocumentInvalidated: (uri) => calls.push(`production:${uri}`)
        });

        service.invalidateDocument('file:///D:/workspace/room.c');

        expect(calls).toEqual([
            'runtime:file:///D:/workspace/room.c',
            'production:file:///D:/workspace/room.c'
        ]);
        expect(output.error).not.toHaveBeenCalled();
    });

    test('logs production invalidation failures without skipping runtime invalidation', () => {
        const invalidateRuntimeDocument = jest.fn();
        const { logger, output } = createLogger();
        const service = new DocumentFreshnessService({
            invalidateRuntimeDocument,
            logger,
            onDocumentInvalidated: () => {
                throw new Error('boom');
            }
        });

        service.invalidateDocument('file:///D:/workspace/room.c');

        expect(invalidateRuntimeDocument).toHaveBeenCalledWith('file:///D:/workspace/room.c');
        expect(output.error).toHaveBeenCalledWith(
            'Failed to invalidate file:///D:/workspace/room.c: boom'
        );
    });

    test('keeps diagnostics dirty when the document changes after refresh starts', () => {
        const changeIndex = new WorkspaceChangeIndex();
        const uri = 'file:///D:/workspace/room.c';
        const service = new DocumentFreshnessService({
            changeIndex,
            invalidateRuntimeDocument: jest.fn(),
            logger: createLogger().logger
        });

        changeIndex.markOpened(uri, 1);
        const token = service.createDiagnosticFreshnessToken(uri);
        changeIndex.markChanged(uri, 2);
        service.markDiagnosticsClean(token);

        expect(changeIndex.get(uri)).toEqual(expect.objectContaining({
            openVersion: 2,
            dirty: true
        }));
    });

    test('invalidates a maybe stale request document before language features run', () => {
        const changeIndex = new WorkspaceChangeIndex();
        const ownerUri = 'file:///D:/workspace/room.c';
        const dependencyUri = 'file:///D:/workspace/include/settings.h';
        const invalidateRuntimeDocument = jest.fn();
        const onDocumentInvalidated = jest.fn();
        const service = new DocumentFreshnessService({
            changeIndex,
            invalidateRuntimeDocument,
            logger: createLogger().logger,
            onDocumentInvalidated
        });

        changeIndex.markOpened(ownerUri, 1);
        changeIndex.recordDependencyFootprint(ownerUri, [dependencyUri]);
        changeIndex.markClean(ownerUri);
        changeIndex.markDiskChanged(dependencyUri, 'changed');
        service.ensureFreshRequestDocument(ownerUri);

        expect(invalidateRuntimeDocument).toHaveBeenCalledWith(ownerUri);
        expect(onDocumentInvalidated).toHaveBeenCalledWith(ownerUri);
    });

    test('marks a refreshed request document clean so repeated language requests reuse caches', () => {
        const changeIndex = new WorkspaceChangeIndex();
        const uri = 'file:///D:/workspace/room.c';
        const invalidateRuntimeDocument = jest.fn();
        const service = new DocumentFreshnessService({
            changeIndex,
            invalidateRuntimeDocument,
            logger: createLogger().logger
        });

        changeIndex.markOpened(uri, 1);

        service.ensureFreshRequestDocument(uri);
        service.ensureFreshRequestDocument(uri);

        expect(invalidateRuntimeDocument).toHaveBeenCalledTimes(1);
        expect(changeIndex.get(uri)).toEqual(expect.objectContaining({
            dirty: false,
            maybeStale: false
        }));
    });

    test('invalidates a request document when workspace config generation changed', () => {
        const changeIndex = new WorkspaceChangeIndex();
        const uri = 'file:///D:/workspace/room.c';
        const invalidateRuntimeDocument = jest.fn();
        const service = new DocumentFreshnessService({
            changeIndex,
            invalidateRuntimeDocument,
            logger: createLogger().logger
        });

        changeIndex.markOpened(uri, 1);
        changeIndex.markClean(uri);
        changeIndex.nextWorkspaceConfigGeneration();
        service.ensureFreshRequestDocument(uri);

        expect(invalidateRuntimeDocument).toHaveBeenCalledWith(uri);
    });

    test('does not invalidate a clean request document', () => {
        const changeIndex = new WorkspaceChangeIndex();
        const uri = 'file:///D:/workspace/room.c';
        const invalidateRuntimeDocument = jest.fn();
        const service = new DocumentFreshnessService({
            changeIndex,
            invalidateRuntimeDocument,
            logger: createLogger().logger
        });

        changeIndex.markOpened(uri, 1);
        changeIndex.markClean(uri);
        service.ensureFreshRequestDocument(uri);

        expect(invalidateRuntimeDocument).not.toHaveBeenCalled();
    });
});

function createLogger(): {
    logger: ServerLogger;
    output: {
        info: jest.Mock;
        warn: jest.Mock;
        error: jest.Mock;
        log: jest.Mock;
    };
} {
    const output = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        log: jest.fn()
    };

    return {
        logger: new ServerLogger(output),
        output
    };
}
