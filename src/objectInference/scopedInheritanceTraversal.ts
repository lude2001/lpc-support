import * as path from 'path';
import * as vscode from 'vscode';
import { ASTManager } from '../ast/astManager';
import { InheritanceResolver } from '../completion/inheritanceResolver';
import { ResolvedInheritTarget } from '../completion/types';
import { assertTextDocumentHost, type TextDocumentHost } from '../language/shared/WorkspaceDocumentPathSupport';

export type ResolvedScopedInheritTarget = ResolvedInheritTarget & {
    resolvedUri: string;
    isResolved: true;
};

export interface ScopedSeedResolution {
    resolvedTargets: ResolvedScopedInheritTarget[];
    hasUnresolvedTargets: boolean;
}

export interface ScopedBranchCollection<TItem> {
    items: TItem[];
    hasUnresolvedTargets: boolean;
}

interface CollectScopedBranchItemsOptions<TItem> {
    astManager: ASTManager;
    inheritanceResolver: InheritanceResolver;
    host?: Pick<TextDocumentHost, 'openTextDocument'>;
    seed: ResolvedScopedInheritTarget;
    visitedUris: Set<string>;
    collectFromDocument: (
        document: vscode.TextDocument,
        snapshot: ReturnType<ASTManager['getSemanticSnapshot']>
    ) => TItem[];
}

export function resolveScopedDirectInheritSeeds(
    inheritanceResolver: InheritanceResolver,
    snapshot: Parameters<InheritanceResolver['resolveInheritTargets']>[0]
): ScopedSeedResolution {
    const resolvedTargets: ResolvedScopedInheritTarget[] = [];
    let hasUnresolvedTargets = false;

    for (const target of inheritanceResolver.resolveInheritTargets(snapshot)) {
        if (!target.isResolved || !target.resolvedUri) {
            hasUnresolvedTargets = true;
            continue;
        }

        resolvedTargets.push({
            ...target,
            isResolved: true,
            resolvedUri: target.resolvedUri
        });
    }

    return {
        resolvedTargets,
        hasUnresolvedTargets
    };
}

export function matchesScopedQualifier(target: ResolvedScopedInheritTarget, qualifier: string): boolean {
    return stripSourceExtension(normalizeFsPath(vscode.Uri.parse(target.resolvedUri).fsPath)) === qualifier;
}

export async function collectScopedBranchItems<TItem>(
    options: CollectScopedBranchItemsOptions<TItem>
): Promise<ScopedBranchCollection<TItem>> {
    const normalizedUri = options.seed.resolvedUri;
    if (options.visitedUris.has(normalizedUri)) {
        return {
            items: [],
            hasUnresolvedTargets: false
        };
    }

    options.visitedUris.add(normalizedUri);

    try {
        const host = assertTextDocumentHost('collectScopedBranchItems', options.host as TextDocumentHost | undefined);
        const document = await host.openTextDocument(vscode.Uri.parse(normalizedUri));
        const snapshot = options.astManager.getSemanticSnapshot(document, false);
        const items = options.collectFromDocument(document, snapshot);
        const nestedSeeds = resolveScopedDirectInheritSeeds(options.inheritanceResolver, snapshot);

        if (nestedSeeds.hasUnresolvedTargets) {
            return {
                items: [],
                hasUnresolvedTargets: true
            };
        }

        for (const nestedSeed of nestedSeeds.resolvedTargets) {
            const nestedCollection = await collectScopedBranchItems({
                ...options,
                seed: nestedSeed
            });
            if (nestedCollection.hasUnresolvedTargets) {
                return {
                    items: [],
                    hasUnresolvedTargets: true
                };
            }

            items.push(...nestedCollection.items);
        }

        return {
            items,
            hasUnresolvedTargets: false
        };
    } catch {
        return {
            items: [],
            hasUnresolvedTargets: false
        };
    }
}

function stripSourceExtension(filePath: string): string {
    const baseName = path.basename(filePath);
    return baseName.endsWith('.c') ? baseName.slice(0, -2) : baseName;
}

function normalizeFsPath(filePath: string): string {
    return path.normalize(filePath.replace(/^[/\\]+([A-Za-z]:[\\/])/, '$1'));
}
