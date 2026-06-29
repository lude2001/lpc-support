import type { HealthStatusResponse } from '../../../shared/protocol/health';
import { DocumentStore } from '../../runtime/DocumentStore';

type HealthHandlerDependencies = {
    documentStore: DocumentStore;
    serverVersion: string;
    getParserStats?: () => NonNullable<HealthStatusResponse['performance']>['parser'];
    getSemanticStats?: () => NonNullable<HealthStatusResponse['performance']>['semantic'];
};

export function createHealthHandler(
    dependencies: HealthHandlerDependencies
): () => Promise<HealthStatusResponse> {
    return async () => {
        const parser = dependencies.getParserStats?.();
        const semantic = dependencies.getSemanticStats?.();
        return {
            status: 'ok',
            mode: 'phase-a',
            serverVersion: dependencies.serverVersion,
            documentCount: dependencies.documentStore.count(),
            performance: parser || semantic ? { parser, semantic } : undefined
        };
    };
}
