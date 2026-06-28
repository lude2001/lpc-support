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
