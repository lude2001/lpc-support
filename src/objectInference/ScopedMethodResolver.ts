import * as path from 'path';
import * as vscode from 'vscode';
import { InheritanceResolver } from '../completion/inheritanceResolver';
import { MacroManager } from '../macroManager';
import { assertAnalysisService } from '../semantic/assertAnalysisService';
import type { DocumentAnalysisService } from '../semantic/documentAnalysisService';
import type { SemanticSnapshot } from '../semantic/semanticSnapshot';
import { SyntaxKind, SyntaxNode } from '../syntax/types';
import {
    collectScopedBranchItems,
    matchesScopedQualifier,
    resolveScopedDirectInheritSeeds
} from './scopedInheritanceTraversal';

export interface ScopedMethodTarget {
    path: string;
    methodName: string;
    document: vscode.TextDocument;
    location: vscode.Location;
    declarationRange: vscode.Range;
    sourceLabel: string;
}

export type ScopedMethodResolutionStatus = 'resolved' | 'multiple' | 'unknown' | 'unsupported';

export interface ScopedMethodResolution {
    status: ScopedMethodResolutionStatus;
    methodName: string;
    qualifier?: string;
    targets: ScopedMethodTarget[];
    reason?: 'unsupported-expression';
}

interface ScopedTargetCollection {
    targets: ScopedMethodTarget[];
    hasUnresolvedTargets: boolean;
}

type ScopedCallShape =
    | { kind: 'bare'; methodName: string }
    | { kind: 'named'; qualifier: string; methodName: string }
    | { kind: 'unsupported'; methodName: string; qualifier?: string };

export class ScopedMethodResolver {
    private readonly analysisService: Pick<DocumentAnalysisService, 'getSyntaxDocument' | 'getSemanticSnapshot'>;
    private readonly inheritanceResolver: InheritanceResolver;

    constructor(
        macroManager?: MacroManager,
        workspaceRoots?: string[],
        analysisService?: Pick<DocumentAnalysisService, 'getSyntaxDocument' | 'getSemanticSnapshot'>
    ) {
        this.analysisService = assertAnalysisService('ScopedMethodResolver', analysisService);
        this.inheritanceResolver = new InheritanceResolver(macroManager, workspaceRoots);
    }

    public async resolveCallAt(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<ScopedMethodResolution | undefined> {
        const syntax = this.analysisService.getSyntaxDocument(document, false)
            ?? this.analysisService.getSyntaxDocument(document, true);
        if (!syntax) {
            return undefined;
        }

        const callExpressions = this.findCallExpressionsAtPosition(syntax.nodes, position);
        if (callExpressions.length === 0) {
            return undefined;
        }

        for (const callExpression of callExpressions) {
            const scope = this.classifyScopedCall(callExpression);
            if (!scope) {
                continue;
            }

            if (this.isMalformedScopedCall(document, callExpression) || scope.kind === 'unsupported') {
                const qualifier = scope.kind === 'named'
                    ? scope.qualifier
                    : scope.kind === 'unsupported'
                        ? scope.qualifier
                        : undefined;

                return this.createUnsupportedResolution(
                    scope.methodName,
                    qualifier
                );
            }

            const targetCollection = scope.kind === 'bare'
                ? await this.resolveBareScopedTargets(document, scope.methodName)
                : await this.resolveNamedScopedTargets(document, scope.qualifier, scope.methodName);

            return scope.kind === 'bare'
                ? this.normalizeScopedResolution(scope.methodName, targetCollection)
                : this.normalizeScopedResolution(scope.methodName, targetCollection, scope.qualifier);
        }

        return undefined;
    }

    private classifyScopedCall(callExpression: SyntaxNode): ScopedCallShape | undefined {
        const callee = callExpression.children[0];
        if (!callee) {
            return undefined;
        }

        if (callee.kind === SyntaxKind.Identifier && callee.metadata?.scopeQualifier === '::') {
            if (!callee.name) {
                return undefined;
            }

            return {
                kind: 'bare',
                methodName: callee.name
            };
        }

        if (callee.kind !== SyntaxKind.MemberAccessExpression || callee.metadata?.operator !== '::') {
            return undefined;
        }

        if (callee.children.length < 2) {
            return {
                kind: 'unsupported',
                methodName: callee.children[1]?.name ?? '',
                qualifier: callee.children[0]?.kind === SyntaxKind.Identifier ? callee.children[0].name : undefined
            };
        }

        const qualifierNode = callee.children[0];
        const memberNode = callee.children[1];
        if (
            qualifierNode.kind !== SyntaxKind.Identifier
            || !qualifierNode.name
            || memberNode.kind !== SyntaxKind.Identifier
            || !memberNode.name
        ) {
            return {
                kind: 'unsupported',
                methodName: memberNode.name ?? '',
                qualifier: qualifierNode.kind === SyntaxKind.Identifier ? qualifierNode.name : undefined
            };
        }

        return {
            kind: 'named',
            qualifier: qualifierNode.name,
            methodName: memberNode.name
        };
    }

    private isMalformedScopedCall(
        document: vscode.TextDocument,
        callExpression: SyntaxNode
    ): boolean {
        const callee = callExpression.children[0];
        if (callee?.kind === SyntaxKind.Identifier && callee.metadata?.scopeQualifier === '::') {
            const startOffset = document.offsetAt(callExpression.range.start);
            if (startOffset <= 0) {
                return false;
            }

            const previousCharacter = document.getText(new vscode.Range(
                document.positionAt(startOffset - 1),
                document.positionAt(startOffset)
            ));

            return !/[\s([{\[;,:=]/.test(previousCharacter);
        }

        if (callee?.kind !== SyntaxKind.MemberAccessExpression || callee.metadata?.operator !== '::') {
            return false;
        }

        return callee.children.length < 2
            || callee.children[0].kind !== SyntaxKind.Identifier
            || !callee.children[0].name
            || callee.children[1].kind !== SyntaxKind.Identifier
            || !callee.children[1].name;
    }

    private findCallExpressionsAtPosition(
        nodes: readonly SyntaxNode[],
        position: vscode.Position
    ): SyntaxNode[] {
        return [...nodes]
            .filter((node) => node.kind === SyntaxKind.CallExpression)
            .filter((node) => node.range.contains(position))
            .sort((left, right) => this.getRangeSize(left.range) - this.getRangeSize(right.range));
    }

    private async resolveBareScopedTargets(
        document: vscode.TextDocument,
        methodName: string
    ): Promise<ScopedTargetCollection> {
        const snapshot = this.analysisService.getSemanticSnapshot(document, false);
        const directSeeds = resolveScopedDirectInheritSeeds(this.inheritanceResolver, snapshot);
        if (directSeeds.hasUnresolvedTargets) {
            return {
                targets: [],
                hasUnresolvedTargets: true
            };
        }

        const visitedUris = new Set<string>();
        const targets: ScopedMethodTarget[] = [];

        for (const seed of directSeeds.resolvedTargets) {
            const branchResult = await collectScopedBranchItems({
                astManager: createScopedTraversalAnalysisFacade(this.analysisService),
                inheritanceResolver: this.inheritanceResolver,
                seed,
                visitedUris,
                collectFromDocument: (targetDocument, snapshot) => {
                    const directTarget = this.findMethodTarget(targetDocument, snapshot, methodName);
                    return directTarget ? [directTarget] : [];
                }
            });
            if (branchResult.hasUnresolvedTargets) {
                return {
                    targets: [],
                    hasUnresolvedTargets: true
                };
            }

            targets.push(...branchResult.items);
        }

        return {
            targets,
            hasUnresolvedTargets: false
        };
    }

    private async resolveNamedScopedTargets(
        document: vscode.TextDocument,
        qualifier: string,
        methodName: string
    ): Promise<ScopedTargetCollection> {
        const snapshot = this.analysisService.getSemanticSnapshot(document, false);
        const directSeeds = resolveScopedDirectInheritSeeds(this.inheritanceResolver, snapshot);
        if (directSeeds.hasUnresolvedTargets) {
            return {
                targets: [],
                hasUnresolvedTargets: true
            };
        }

        const matchedSeeds = directSeeds.resolvedTargets.filter((seed) => matchesScopedQualifier(seed, qualifier));
        if (matchedSeeds.length !== 1) {
            return {
                targets: [],
                hasUnresolvedTargets: false
            };
        }

        const matchedCollection = await collectScopedBranchItems({
            astManager: createScopedTraversalAnalysisFacade(this.analysisService),
            inheritanceResolver: this.inheritanceResolver,
            seed: matchedSeeds[0],
            visitedUris: new Set<string>(),
            collectFromDocument: (targetDocument, snapshot) => {
                const directTarget = this.findMethodTarget(targetDocument, snapshot, methodName);
                return directTarget ? [directTarget] : [];
            }
        });

        return {
            targets: matchedCollection.items,
            hasUnresolvedTargets: matchedCollection.hasUnresolvedTargets
        };
    }

    private findMethodTarget(
        document: vscode.TextDocument,
        snapshot: SemanticSnapshot,
        methodName: string
    ): ScopedMethodTarget | undefined {
        const symbol = snapshot.symbolTable.getGlobalScope().symbols.get(methodName);

        if (!symbol || symbol.type !== 'function') {
            return undefined;
        }

        const declarationRange = symbol.selectionRange ?? symbol.range;
        return {
            path: this.normalizeFsPath(document.uri.fsPath),
            methodName,
            document,
            location: new vscode.Location(document.uri, declarationRange),
            declarationRange,
            sourceLabel: document.uri.fsPath
        };
    }

    private normalizeScopedResolution(
        methodName: string,
        targetCollection: ScopedTargetCollection,
        qualifier?: string
    ): ScopedMethodResolution {
        if (targetCollection.hasUnresolvedTargets) {
            return {
                status: 'unknown',
                methodName,
                qualifier,
                targets: []
            };
        }

        const deduped: ScopedMethodTarget[] = [];
        const seen = new Set<string>();

        for (const target of targetCollection.targets) {
            const key = this.getTargetKey(target);
            if (seen.has(key)) {
                continue;
            }

            seen.add(key);
            deduped.push(target);
        }

        if (deduped.length === 0) {
            return {
                status: 'unknown',
                methodName,
                qualifier,
                targets: []
            };
        }

        if (deduped.length === 1) {
            return {
                status: 'resolved',
                methodName,
                qualifier,
                targets: deduped
            };
        }

        return {
            status: 'multiple',
            methodName,
            qualifier,
            targets: deduped
        };
    }

    private createUnsupportedResolution(methodName: string, qualifier?: string): ScopedMethodResolution {
        return {
            status: 'unsupported',
            methodName,
            qualifier,
            targets: [],
            reason: 'unsupported-expression'
        };
    }

    private getTargetKey(target: ScopedMethodTarget): string {
        const range = target.declarationRange;
        return `${target.path}:${range.start.line}:${range.start.character}:${range.end.line}:${range.end.character}`;
    }

    private normalizeFsPath(filePath: string): string {
        return path.normalize(filePath.replace(/^[/\\]+([A-Za-z]:[\\/])/, '$1'));
    }

    private getRangeSize(range: vscode.Range): number {
        return (range.end.line - range.start.line) * 10_000 + (range.end.character - range.start.character);
    }
}

function createScopedTraversalAnalysisFacade(
    analysisService: Pick<DocumentAnalysisService, 'getSemanticSnapshot'>
) {
    return {
        getSemanticSnapshot: (document: vscode.TextDocument, useCache: boolean = true) =>
            analysisService.getSemanticSnapshot(document, useCache)
    } as any;
}
