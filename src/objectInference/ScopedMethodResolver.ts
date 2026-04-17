import * as path from 'path';
import * as vscode from 'vscode';
import { ASTManager } from '../ast/astManager';
import { InheritanceResolver } from '../completion/inheritanceResolver';
import { MacroManager } from '../macroManager';
import { ResolvedInheritTarget } from '../completion/types';
import { SyntaxKind, SyntaxNode } from '../syntax/types';

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

type ResolvedScopedInheritTarget = ResolvedInheritTarget & {
    resolvedUri: string;
    isResolved: true;
};

type ScopedCallShape =
    | { kind: 'bare'; methodName: string }
    | { kind: 'named'; qualifier: string; methodName: string }
    | { kind: 'unsupported'; methodName: string; qualifier?: string };

export class ScopedMethodResolver {
    private readonly astManager = ASTManager.getInstance();
    private readonly inheritanceResolver: InheritanceResolver;

    constructor(
        macroManager?: MacroManager,
        workspaceRoots?: string[]
    ) {
        this.inheritanceResolver = new InheritanceResolver(macroManager, workspaceRoots);
    }

    public async resolveCallAt(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<ScopedMethodResolution | undefined> {
        const syntax = this.astManager.getSyntaxDocument(document, false)
            ?? this.astManager.getSyntaxDocument(document, true);
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

            const targets = scope.kind === 'bare'
                ? await this.resolveBareScopedTargets(document, scope.methodName)
                : await this.resolveNamedScopedTargets(document, scope.qualifier, scope.methodName);

            return scope.kind === 'bare'
                ? this.normalizeScopedResolution(scope.methodName, targets)
                : this.normalizeScopedResolution(scope.methodName, targets, scope.qualifier);
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
    ): Promise<ScopedMethodTarget[]> {
        const snapshot = this.astManager.getSemanticSnapshot(document, false);
        const directSeeds = this.resolveDirectInheritSeeds(snapshot);
        const visitedUris = new Set<string>();
        const targets: ScopedMethodTarget[] = [];

        for (const seed of directSeeds) {
            targets.push(...await this.collectTargetsFromSeed(seed, methodName, visitedUris));
        }

        return targets;
    }

    private async resolveNamedScopedTargets(
        document: vscode.TextDocument,
        qualifier: string,
        methodName: string
    ): Promise<ScopedMethodTarget[]> {
        const snapshot = this.astManager.getSemanticSnapshot(document, false);
        const directSeeds = this.resolveDirectInheritSeeds(snapshot);
        const matchedSeeds = directSeeds.filter((seed) => this.matchesQualifier(seed, qualifier));
        if (matchedSeeds.length !== 1) {
            return [];
        }

        return this.collectTargetsFromSeed(matchedSeeds[0], methodName, new Set<string>());
    }

    private resolveDirectInheritSeeds(
        snapshot: Parameters<InheritanceResolver['resolveInheritTargets']>[0]
    ): ResolvedScopedInheritTarget[] {
        const resolvedTargets: ResolvedScopedInheritTarget[] = [];

        for (const target of this.inheritanceResolver.resolveInheritTargets(snapshot)) {
            if (!target.isResolved || !target.resolvedUri) {
                continue;
            }

            resolvedTargets.push({
                ...target,
                isResolved: true,
                resolvedUri: target.resolvedUri
            });
        }

        return resolvedTargets;
    }

    private matchesQualifier(target: ResolvedScopedInheritTarget, qualifier: string): boolean {
        return this.stripSourceExtension(this.normalizeFsPath(vscode.Uri.parse(target.resolvedUri).fsPath)) === qualifier;
    }

    private async collectTargetsFromSeed(
        seed: ResolvedScopedInheritTarget,
        methodName: string,
        visitedUris: Set<string>
    ): Promise<ScopedMethodTarget[]> {
        const normalizedUri = seed.resolvedUri;
        if (visitedUris.has(normalizedUri)) {
            return [];
        }

        visitedUris.add(normalizedUri);

        try {
            const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(normalizedUri));
            const snapshot = this.astManager.getSemanticSnapshot(document, false);
            const targets: ScopedMethodTarget[] = [];

            const directTarget = this.findMethodTarget(document, snapshot, methodName);
            if (directTarget) {
                targets.push(directTarget);
            }

            const nestedSeeds = this.resolveDirectInheritSeeds(snapshot);
            for (const nestedSeed of nestedSeeds) {
                targets.push(...await this.collectTargetsFromSeed(nestedSeed, methodName, visitedUris));
            }

            return targets;
        } catch {
            return [];
        }
    }

    private findMethodTarget(
        document: vscode.TextDocument,
        snapshot: ReturnType<ASTManager['getSemanticSnapshot']>,
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
        targets: ScopedMethodTarget[],
        qualifier?: string
    ): ScopedMethodResolution {
        const deduped: ScopedMethodTarget[] = [];
        const seen = new Set<string>();

        for (const target of targets) {
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

    private stripSourceExtension(filePath: string): string {
        const baseName = path.basename(filePath);
        return baseName.endsWith('.c') ? baseName.slice(0, -2) : baseName;
    }

    private normalizeFsPath(filePath: string): string {
        return path.normalize(filePath.replace(/^[/\\]+([A-Za-z]:[\\/])/, '$1'));
    }

    private getRangeSize(range: vscode.Range): number {
        return (range.end.line - range.start.line) * 10_000 + (range.end.character - range.start.character);
    }
}
