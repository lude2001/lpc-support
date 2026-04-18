import { ASTManager } from '../ast/astManager';
import type { MacroManager } from '../macroManager';
import { createDefaultDiagnosticsCollectors } from './DiagnosticsOrchestrator';
import type { IDiagnosticCollector } from './types';
import { createSharedDiagnosticsService } from '../language/services/diagnostics/createSharedDiagnosticsService';
import type { LanguageDiagnosticsService } from '../language/services/diagnostics/LanguageDiagnosticsService';

export interface DiagnosticsStack {
    collectors: IDiagnosticCollector[];
    diagnosticsService: LanguageDiagnosticsService;
}

export function createDiagnosticsStack(macroManager: MacroManager): DiagnosticsStack {
    const collectors = createDefaultDiagnosticsCollectors(macroManager);
    const diagnosticsService = createSharedDiagnosticsService(ASTManager.getInstance(), collectors);

    return {
        collectors,
        diagnosticsService
    };
}
