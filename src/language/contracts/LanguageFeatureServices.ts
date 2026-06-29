import type { LanguageCompletionService } from '../services/completion/LanguageCompletionService';
import type { LanguageCodeActionService } from '../services/codeActions/LanguageCodeActionService';
import type { LanguageDiagnosticsService } from '../services/diagnostics/LanguageDiagnosticsService';
import type { LanguageFormattingService } from '../services/formatting/LanguageFormattingService';
import type { LanguageNavigationService } from '../services/navigation/LanguageHoverService';
import type { LanguageSignatureHelpService } from '../services/signatureHelp/LanguageSignatureHelpService';
import type { LanguageStructureService } from '../services/structure/LanguageFoldingService';
import type { HealthStatusResponse } from '../../lsp/shared/protocol/health';
import type {
    WorkspaceIndexProgressPayload,
    WorkspaceIndexRebuildParams,
    WorkspaceIndexRebuildResult
} from '../../lsp/shared/protocol/workspaceIndex';

export interface LanguageWorkspaceIndexingService {
    rebuild(
        params: WorkspaceIndexRebuildParams,
        onProgress?: (progress: WorkspaceIndexProgressPayload) => void | Promise<void>
    ): Promise<WorkspaceIndexRebuildResult>;
}

export interface LanguageHealthPerformanceProviders {
    getParserStats?: () => NonNullable<HealthStatusResponse['performance']>['parser'];
    getSemanticStats?: () => NonNullable<HealthStatusResponse['performance']>['semantic'];
}

export interface LanguageFeatureServices {
    codeActionsService?: LanguageCodeActionService;
    completionService?: LanguageCompletionService;
    diagnosticsService?: LanguageDiagnosticsService;
    formattingService?: LanguageFormattingService;
    navigationService?: LanguageNavigationService;
    onDocumentInvalidated?: (uri: string) => void;
    onWorkspaceConfigSync?: () => Promise<void>;
    signatureHelpService?: LanguageSignatureHelpService;
    structureService?: LanguageStructureService;
    workspaceIndexingService?: LanguageWorkspaceIndexingService;
    healthPerformanceProviders?: LanguageHealthPerformanceProviders;
}
