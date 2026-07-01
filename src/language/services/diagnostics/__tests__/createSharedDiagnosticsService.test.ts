import { describe, expect, jest, test } from '@jest/globals';
import type { IDiagnosticCollector } from '../../../../diagnostics/types';
import type { DiagnosticFactsProvider } from '../../../../diagnostics/semantic/DiagnosticTypeFacts';
import { createSharedDiagnosticsService } from '../createSharedDiagnosticsService';

describe('createSharedDiagnosticsService', () => {
    test('passes request-scoped diagnostic facts provider through DiagnosticContext', async () => {
        const analysisService = {
            parseDocument: jest.fn(() => ({
                parsed: {} as any,
                syntax: { nodes: [] },
                semantic: { degraded: false },
                snapshot: { parseDiagnostics: [] }
            }))
        };
        const collector: IDiagnosticCollector = {
            name: 'ContextProbeCollector',
            collect: jest.fn(() => [])
        };
        const diagnosticFactsProvider = {
            getFacts: jest.fn()
        } as unknown as DiagnosticFactsProvider;
        const service = createSharedDiagnosticsService(analysisService, [collector], {
            diagnosticFactsProvider
        });

        await service.collectDiagnostics({
            context: {
                document: {
                    uri: 'file:///workspace/demo.c',
                    version: 1,
                    getText: () => ''
                },
                workspace: {},
                mode: 'lsp'
            }
        });

        expect(collector.collect).toHaveBeenCalledWith(
            expect.any(Object),
            expect.any(Object),
            expect.objectContaining({
                diagnosticFactsProvider
            })
        );
    });
});
