import * as vscode from 'vscode';
import { InheritanceResolver } from '../completion/inheritanceResolver';
import { MacroManager } from '../macroManager';
import { assertAnalysisService } from '../semantic/assertAnalysisService';
import type { DocumentAnalysisService } from '../semantic/documentAnalysisService';
import { GlobalBindingResolution, GlobalObjectBindingResolver } from './GlobalObjectBindingResolver';

export class InheritedGlobalObjectBindingResolver {
    private readonly analysisService: Pick<DocumentAnalysisService, 'getSemanticSnapshot'>;
    private readonly inheritanceResolver: InheritanceResolver;

    constructor(
        macroManager: MacroManager | undefined,
        private readonly globalBindingResolver: GlobalObjectBindingResolver,
        analysisService?: Pick<DocumentAnalysisService, 'getSemanticSnapshot'>
    ) {
        this.analysisService = assertAnalysisService('InheritedGlobalObjectBindingResolver', analysisService);
        this.inheritanceResolver = new InheritanceResolver(macroManager);
    }

    public async resolveInheritedBinding(
        document: vscode.TextDocument,
        identifierName: string,
        visitedUris: Set<string> = new Set([document.uri.toString()]),
        visitedBindings: Set<string> = new Set()
    ): Promise<GlobalBindingResolution | undefined> {
        const snapshot = this.analysisService.getSemanticSnapshot(document, false);
        const resolvedTargets = this.inheritanceResolver.resolveInheritTargets(snapshot);

        for (const target of resolvedTargets) {
            if (!target.resolvedUri || visitedUris.has(target.resolvedUri)) {
                continue;
            }

            const branchVisitedUris = new Set(visitedUris);
            branchVisitedUris.add(target.resolvedUri);
            const branchVisitedBindings = new Set(visitedBindings);

            try {
                const parentDocument = await vscode.workspace.openTextDocument(vscode.Uri.parse(target.resolvedUri));
                const parentBinding = await this.globalBindingResolver.resolveFileScopeBinding(
                    parentDocument,
                    identifierName,
                    {
                        visited: branchVisitedBindings,
                        resolveInheritedIdentifier: (parentFile, name, nestedVisitedBindings) =>
                            this.resolveInheritedBinding(
                                parentFile,
                                name,
                                new Set([...branchVisitedUris, parentFile.uri.toString()]),
                                new Set(nestedVisitedBindings)
                            )
                    }
                );

                if (parentBinding) {
                    return parentBinding;
                }

                const nestedBinding = await this.resolveInheritedBinding(
                    parentDocument,
                    identifierName,
                    branchVisitedUris,
                    branchVisitedBindings
                );
                if (nestedBinding) {
                    return nestedBinding;
                }
            } catch {
                continue;
            }
        }

        return undefined;
    }
}
