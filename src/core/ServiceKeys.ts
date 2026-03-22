import type { CompletionInstrumentation } from '../completion/completionInstrumentation';
import type { DiagnosticsOrchestrator } from '../diagnostics';
import type { ErrorTreeDataProvider } from '../errorTreeDataProvider';
import type { LPCCompletionItemProvider } from '../completionProvider';
import type { EfunDocsManager } from '../efunDocs';
import type { LPCConfigManager } from '../config';
import type { LPCCompiler } from '../compiler';
import type { MacroManager } from '../macroManager';
import type { DocumentLifecycleService } from './DocumentLifecycleService';
import { ServiceKey } from './ServiceRegistry';

export const Services = {
    MacroManager: new ServiceKey<MacroManager>('MacroManager'),
    EfunDocs: new ServiceKey<EfunDocsManager>('EfunDocs'),
    ConfigManager: new ServiceKey<LPCConfigManager>('ConfigManager'),
    Compiler: new ServiceKey<LPCCompiler>('Compiler'),
    Lifecycle: new ServiceKey<DocumentLifecycleService>('Lifecycle'),
    Diagnostics: new ServiceKey<DiagnosticsOrchestrator>('Diagnostics'),
    Completion: new ServiceKey<LPCCompletionItemProvider>('Completion'),
    ErrorTree: new ServiceKey<ErrorTreeDataProvider>('ErrorTree'),
    CompletionInstrumentation: new ServiceKey<CompletionInstrumentation>('CompletionInstrumentation')
};
