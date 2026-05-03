import { StringLiteralCollector } from '../collectors/StringLiteralCollector';
import { FileNamingCollector } from '../collectors/FileNamingCollector';
import { UnusedVariableCollector } from '../collectors/UnusedVariableCollector';
import { GlobalVariableCollector } from '../collectors/GlobalVariableCollector';
import { LocalVariableDeclarationCollector } from '../collectors/LocalVariableDeclarationCollector';
import { createSharedDiagnosticsService } from '../language/services/diagnostics/createSharedDiagnosticsService';
import type { LanguageDiagnosticsService } from '../language/services/diagnostics/LanguageDiagnosticsService';
import type { DocumentAnalysisService } from '../semantic/documentAnalysisService';
import { MacroUsageCollector } from './collectors/MacroUsageCollector';
import { ObjectAccessCollector } from './collectors/ObjectAccessCollector';
import type { IDiagnosticCollector } from './types';

export interface DiagnosticsStack {
    collectors: IDiagnosticCollector[];
    diagnosticsService: LanguageDiagnosticsService;
}

type DiagnosticsAnalysisService = Pick<DocumentAnalysisService, 'parseDocument'>;

export function createDefaultDiagnosticsCollectors(): IDiagnosticCollector[] {
    return [
        new StringLiteralCollector(),
        new FileNamingCollector(),
        new UnusedVariableCollector(),
        new GlobalVariableCollector(),
        new LocalVariableDeclarationCollector(),
        new ObjectAccessCollector(),
        new MacroUsageCollector(),
    ];
}

export function createDiagnosticsStack(
    analysisService: DiagnosticsAnalysisService
): DiagnosticsStack {
    const collectors = createDefaultDiagnosticsCollectors();
    const diagnosticsService = createSharedDiagnosticsService(analysisService, collectors);

    return {
        collectors,
        diagnosticsService
    };
}
