import * as vscode from 'vscode';
import { ASTManager } from '../ast/astManager';
import { InheritanceResolver } from '../completion/inheritanceResolver';
import { MacroManager } from '../macroManager';
import { GlobalBindingResolution, GlobalObjectBindingResolver } from './GlobalObjectBindingResolver';

export class InheritedGlobalObjectBindingResolver {
    private readonly astManager = ASTManager.getInstance();
    private readonly inheritanceResolver: InheritanceResolver;

    constructor(
        macroManager: MacroManager | undefined,
        private readonly globalBindingResolver: GlobalObjectBindingResolver
    ) {
        this.inheritanceResolver = new InheritanceResolver(macroManager);
    }

    public async resolveInheritedBinding(
        document: vscode.TextDocument,
        identifierName: string,
        visitedUris: Set<string> = new Set([document.uri.toString()]),
        visitedBindings: Set<string> = new Set()
    ): Promise<GlobalBindingResolution | undefined> {
        const snapshot = this.astManager.getSemanticSnapshot(document, false);
        const resolvedTargets = this.inheritanceResolver.resolveInheritTargets(snapshot);

        for (const target of resolvedTargets) {
            if (!target.resolvedUri || visitedUris.has(target.resolvedUri)) {
                continue;
            }

            const branchVisitedUris = new Set(visitedUris);
            branchVisitedUris.add(target.resolvedUri);

            const parentDocument = await vscode.workspace.openTextDocument(vscode.Uri.parse(target.resolvedUri));
            const parentBinding = await this.globalBindingResolver.resolveFileScopeBinding(
                parentDocument,
                identifierName,
                {
                    visited: visitedBindings,
                    resolveInheritedIdentifier: (parentFile, name, nestedVisitedBindings) =>
                        this.resolveInheritedBinding(
                            parentFile,
                            name,
                            new Set([...branchVisitedUris, parentFile.uri.toString()]),
                            nestedVisitedBindings
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
                visitedBindings
            );
            if (nestedBinding) {
                return nestedBinding;
            }
        }

        return undefined;
    }
}
