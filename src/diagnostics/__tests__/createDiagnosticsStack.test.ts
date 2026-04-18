import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { ASTManager } from '../../ast/astManager';
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
        const macroManager = { kind: 'macro-manager' } as any;

        const collectors = createDefaultDiagnosticsCollectors(macroManager);

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
        const astManager = { kind: 'ast-manager' } as unknown as ASTManager;
        const diagnosticsService = { collectDiagnostics: jest.fn() } as any;
        const macroManager = { kind: 'macro-manager' } as any;

        jest.spyOn(ASTManager, 'getInstance').mockReturnValue(astManager);
        (createSharedDiagnosticsService as jest.Mock).mockReturnValue(diagnosticsService);

        const stack = createDiagnosticsStack(macroManager);

        expect(ASTManager.getInstance).toHaveBeenCalledTimes(1);
        expect(createSharedDiagnosticsService).toHaveBeenCalledTimes(1);
        expect(createSharedDiagnosticsService).toHaveBeenCalledWith(astManager, stack.collectors);
        expect(stack.collectors).toHaveLength(7);
        expect(stack.diagnosticsService).toBe(diagnosticsService);
    });
});
