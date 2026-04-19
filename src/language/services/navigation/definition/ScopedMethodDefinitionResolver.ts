import * as vscode from 'vscode';
import type { ScopedMethodResolver } from '../../../../objectInference/ScopedMethodResolver';
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
        if (
            !scopedResolution
            || !isOnScopedMethodIdentifier(
                document,
                position,
                scopedResolution.methodName,
                this.dependencies.analysisService
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
