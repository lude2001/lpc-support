import type { LanguageCompletionService } from '../services/completion/LanguageCompletionService';
import type { LanguageCodeActionService } from '../services/codeActions/LanguageCodeActionService';
import type { LanguageDiagnosticsService } from '../services/diagnostics/LanguageDiagnosticsService';
import type { LanguageFormattingService } from '../services/formatting/LanguageFormattingService';
import type { LanguageNavigationService } from '../services/navigation/LanguageHoverService';
import type { LanguageSignatureHelpService } from '../services/signatureHelp/LanguageSignatureHelpService';
import type { LanguageStructureService } from '../services/structure/LanguageFoldingService';

export interface LanguageFeatureServices {
    codeActionsService?: LanguageCodeActionService;
    completionService?: LanguageCompletionService;
    diagnosticsService?: LanguageDiagnosticsService;
    formattingService?: LanguageFormattingService;
    navigationService?: LanguageNavigationService;
    signatureHelpService?: LanguageSignatureHelpService;
    structureService?: LanguageStructureService;
}
