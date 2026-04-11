import type { LanguageDocument } from './LanguageDocument';
import type { LanguageWorkspaceContext } from './LanguageWorkspaceContext';

export type LanguageRuntimeMode = 'lsp';

export interface LanguageCancellationSignal {
    isCancellationRequested: boolean;
}

export interface LanguageCapabilityContext {
    document: LanguageDocument;
    workspace: LanguageWorkspaceContext;
    mode: LanguageRuntimeMode;
    cancellation?: LanguageCancellationSignal;
}
