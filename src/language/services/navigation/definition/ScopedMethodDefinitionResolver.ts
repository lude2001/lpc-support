import * as vscode from 'vscode';
import type { ScopedMethodResolver } from '../../../../objectInference/ScopedMethodResolver';
import { assertAnalysisService } from '../../../../semantic/assertAnalysisService';
import type { DocumentAnalysisService } from '../../../../semantic/documentAnalysisService';
import { isOnScopedMethodIdentifier } from '../ScopedMethodIdentifierSupport';

interface ScopedMethodDefinitionResolverDependencies {
    analysisService?: Pick<DocumentAnalysisService, 'getSyntaxDocument'>;
    scopedMethodResolver?: Pick<ScopedMethodResolver, 'resolveCallAt'>;
}

export class ScopedMethodDefinitionResolver {
    public constructor(private readonly dependencies: ScopedMethodDefinitionResolverDependencies) {}

    public async resolve(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<vscode.Location[] | undefined> {
        const scopedResolution = await this.dependencies.scopedMethodResolver?.resolveCallAt(document, position);
        const analysisService = this.dependencies.analysisService
            ? assertAnalysisService('ScopedMethodDefinitionResolver', this.dependencies.analysisService)
            : undefined;
        if (
            !scopedResolution
            || !analysisService
            || !isOnScopedMethodIdentifier(
                document,
                position,
                scopedResolution.methodName,
                analysisService
            )
        ) {
            return undefined;
        }

        if (scopedResolution.status === 'resolved' || scopedResolution.status === 'multiple') {
            return scopedResolution.targets.map((target) => target.location);
        }

        return [];
    }
}
