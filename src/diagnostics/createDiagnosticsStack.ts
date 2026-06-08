import { StringLiteralCollector } from '../collectors/StringLiteralCollector';
import { FileNamingCollector } from '../collectors/FileNamingCollector';
import { UnusedVariableCollector } from '../collectors/UnusedVariableCollector';
import { GlobalVariableCollector } from '../collectors/GlobalVariableCollector';
import { LocalVariableDeclarationCollector } from '../collectors/LocalVariableDeclarationCollector';
import { createSharedDiagnosticsService } from '../language/services/diagnostics/createSharedDiagnosticsService';
import type { LanguageDiagnosticsService } from '../language/services/diagnostics/LanguageDiagnosticsService';
import type { DocumentAnalysisService } from '../semantic/documentAnalysisService';
import { BasicSemanticDiagnosticsCollector } from './collectors/BasicSemanticDiagnosticsCollector';
import { MacroUsageCollector } from './collectors/MacroUsageCollector';
import { ObjectAccessCollector } from './collectors/ObjectAccessCollector';
import type { DiagnosticSymbolResolver } from './semantic/DiagnosticSymbolResolver';
import type { IDiagnosticCollector } from './types';

export interface DiagnosticsStack {
    collectors: IDiagnosticCollector[];
    diagnosticsService: LanguageDiagnosticsService;
}

type DiagnosticsAnalysisService = Pick<DocumentAnalysisService, 'parseDocument'>;

export interface CreateDiagnosticsStackOptions {
    symbolResolver?: DiagnosticSymbolResolver;
}

export function createDefaultDiagnosticsCollectors(
    options: CreateDiagnosticsStackOptions = {}
): IDiagnosticCollector[] {
    return [
        new StringLiteralCollector(),
        new FileNamingCollector(),
        new UnusedVariableCollector(),
        new GlobalVariableCollector(),
        new LocalVariableDeclarationCollector(),
        new ObjectAccessCollector(),
        new MacroUsageCollector(),
        new BasicSemanticDiagnosticsCollector(options.symbolResolver),
    ];
}

export function createDiagnosticsStack(
    analysisService: DiagnosticsAnalysisService,
    options: CreateDiagnosticsStackOptions = {}
): DiagnosticsStack {
    const collectors = createDefaultDiagnosticsCollectors(options);
    const diagnosticsService = createSharedDiagnosticsService(analysisService, collectors);

    return {
        collectors,
        diagnosticsService
    };
}
