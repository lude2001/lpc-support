import { ASTManager } from '../ast/astManager';
import type { DocumentAnalysisService } from '../semantic/documentAnalysisService';
import { DocumentSemanticSnapshotService } from '../semantic/documentSemanticSnapshotService';

let currentTestAstManager: ASTManager | undefined;

export function configureAstManagerSingletonForTests(
    analysisService: DocumentAnalysisService = DocumentSemanticSnapshotService.getInstance()
): DocumentAnalysisService {
    currentTestAstManager = new ASTManager(analysisService);
    return analysisService;
}

export function getAstManagerForTests(): ASTManager {
    if (!currentTestAstManager) {
        throw new Error('Test ASTManager is not configured. Call configureAstManagerSingletonForTests() first.');
    }

    return currentTestAstManager;
}

export function resetAstManagerSingletonForTests(): void {
    try {
        currentTestAstManager?.clearAllCache();
    } catch {
        // Tests may intentionally assert on unconfigured access.
    }

    DocumentSemanticSnapshotService.getInstance().clear();
    currentTestAstManager = undefined;
}
