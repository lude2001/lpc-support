import type { CompletionInstrumentation } from '../completion/completionInstrumentation';
import type { LPCCompiler } from '../compiler';
import type { LPCConfigManager } from '../config';
import type { DiagnosticsOrchestrator } from '../diagnostics';
import type { DocumentAnalysisService } from '../semantic/documentAnalysisService';
import type { FunctionDocumentationService } from '../language/documentation/FunctionDocumentationService';
import type { TextDocumentHost } from '../language/shared/WorkspaceDocumentPathSupport';
import type { WorkspaceDocumentPathSupport } from '../language/shared/WorkspaceDocumentPathSupport';
import type { DocumentLifecycleService } from './DocumentLifecycleService';
import type { EfunDocsManager } from '../efunDocs';
import type { ErrorTreeDataProvider } from '../errorTreeDataProvider';
import type { SemanticEvaluationService } from '../semanticEvaluation/SemanticEvaluationService';
import type { MacroManager } from '../macroManager';
import type { LpcProjectConfigService } from '../projectConfig/LpcProjectConfigService';
import { ServiceKey } from './ServiceRegistry';

export const Services = {
    MacroManager: new ServiceKey<MacroManager>('MacroManager'),
    EfunDocs: new ServiceKey<EfunDocsManager>('EfunDocs'),
    ConfigManager: new ServiceKey<LPCConfigManager>('ConfigManager'),
    Compiler: new ServiceKey<LPCCompiler>('Compiler'),
    ProjectConfig: new ServiceKey<LpcProjectConfigService>('ProjectConfig'),
    Analysis: new ServiceKey<DocumentAnalysisService>('Analysis'),
    FunctionDocumentation: new ServiceKey<FunctionDocumentationService>('FunctionDocumentation'),
    TextDocumentHost: new ServiceKey<TextDocumentHost>('TextDocumentHost'),
    DocumentPathSupport: new ServiceKey<WorkspaceDocumentPathSupport>('DocumentPathSupport'),
    SemanticEvaluation: new ServiceKey<SemanticEvaluationService>('SemanticEvaluation'),
    Lifecycle: new ServiceKey<DocumentLifecycleService>('Lifecycle'),
    Diagnostics: new ServiceKey<DiagnosticsOrchestrator>('Diagnostics'),
    ErrorTree: new ServiceKey<ErrorTreeDataProvider>('ErrorTree'),
    CompletionInstrumentation: new ServiceKey<CompletionInstrumentation>('CompletionInstrumentation')
};
