import { ASTManager } from '../ast/astManager';
import type { DocumentAnalysisService } from '../semantic/documentAnalysisService';
import { DocumentSemanticSnapshotService } from '../semantic/documentSemanticSnapshotService';

export function configureAstManagerSingletonForTests(
    analysisService: DocumentAnalysisService = DocumentSemanticSnapshotService.getInstance()
): DocumentAnalysisService {
    ASTManager.resetSingletonForTests();
    ASTManager.configureSingleton(analysisService);
    return analysisService;
}

export function getAstManagerForTests(): ASTManager {
    return ASTManager.getInstance();
}

export function resetAstManagerSingletonForTests(): void {
    try {
        ASTManager.getInstance().clearAllCache();
    } catch {
        // Tests may intentionally assert on unconfigured access.
    }

    DocumentSemanticSnapshotService.getInstance().clear();
    ASTManager.resetSingletonForTests();
}
