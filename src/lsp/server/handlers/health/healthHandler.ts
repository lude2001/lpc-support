import type { HealthStatusResponse } from '../../../shared/protocol/health';
import { DocumentStore } from '../../runtime/DocumentStore';

type HealthHandlerDependencies = {
    documentStore: DocumentStore;
    serverVersion: string;
};

export function createHealthHandler(
    dependencies: HealthHandlerDependencies
): () => Promise<HealthStatusResponse> {
    return async () => ({
        status: 'ok',
        mode: 'phase-a',
        serverVersion: dependencies.serverVersion,
        documentCount: dependencies.documentStore.count()
    });
}
