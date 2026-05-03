import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { FileNamingCollector } from '../../collectors/FileNamingCollector';
import { GlobalVariableCollector } from '../../collectors/GlobalVariableCollector';
import { LocalVariableDeclarationCollector } from '../../collectors/LocalVariableDeclarationCollector';
import { StringLiteralCollector } from '../../collectors/StringLiteralCollector';
import { UnusedVariableCollector } from '../../collectors/UnusedVariableCollector';
import { createSharedDiagnosticsService } from '../../language/services/diagnostics/createSharedDiagnosticsService';
import { MacroUsageCollector } from '../collectors/MacroUsageCollector';
import { ObjectAccessCollector } from '../collectors/ObjectAccessCollector';
import {
    createDefaultDiagnosticsCollectors,
    createDiagnosticsStack
} from '../createDiagnosticsStack';

jest.mock('../../language/services/diagnostics/createSharedDiagnosticsService', () => ({
    createSharedDiagnosticsService: jest.fn()
}));

describe('createDiagnosticsStack', () => {
    afterEach(() => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
    });

    test('creates the default collector set in the expected order', () => {
        const collectors = createDefaultDiagnosticsCollectors();

        expect(collectors).toHaveLength(7);
        expect(collectors[0]).toBeInstanceOf(StringLiteralCollector);
        expect(collectors[1]).toBeInstanceOf(FileNamingCollector);
        expect(collectors[2]).toBeInstanceOf(UnusedVariableCollector);
        expect(collectors[3]).toBeInstanceOf(GlobalVariableCollector);
        expect(collectors[4]).toBeInstanceOf(LocalVariableDeclarationCollector);
        expect(collectors[5]).toBeInstanceOf(ObjectAccessCollector);
        expect(collectors[6]).toBeInstanceOf(MacroUsageCollector);
    });

    test('assembles diagnostics service from ASTManager and the default collector set', () => {
        const analysisService = {
            parseDocument: jest.fn()
        } as any;
        const diagnosticsService = { collectDiagnostics: jest.fn() } as any;
        (createSharedDiagnosticsService as jest.Mock).mockReturnValue(diagnosticsService);

        const stack = createDiagnosticsStack(analysisService);

        expect(createSharedDiagnosticsService).toHaveBeenCalledTimes(1);
        expect(createSharedDiagnosticsService).toHaveBeenCalledWith(
            expect.objectContaining({
                parseDocument: expect.any(Function)
            }),
            stack.collectors
        );
        expect(createSharedDiagnosticsService.mock.calls[0][0].parseDocument).toBeDefined();
        expect(stack.collectors).toHaveLength(7);
        expect(stack.diagnosticsService).toBe(diagnosticsService);
    });
});
