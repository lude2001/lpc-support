import * as vscode from 'vscode';
import { ASTManager } from '../../../ast/astManager';
import { Symbol as LPCSymbol, SymbolType } from '../../../ast/symbolTable';
import { InheritanceResolver } from '../../../completion/inheritanceResolver';
import type { MacroManager } from '../../../macroManager';
import type { ScopedMethodResolver } from '../../../objectInference/ScopedMethodResolver';
import { resolveScopedDirectInheritSeeds } from '../../../objectInference/scopedInheritanceTraversal';
import { resolveSymbolReferences, resolveVisibleSymbol } from '../../../symbolReferenceResolver';
import { SyntaxKind, type SyntaxNode } from '../../../syntax/types';
import { normalizeWorkspaceUri } from './navigationPathUtils';
import { isOnScopedMethodIdentifier } from './ScopedMethodIdentifierSupport';

export interface InheritedFunctionRelationServiceOptions {
    macroManager?: MacroManager;
    workspaceRoots?: string[];
    inheritanceResolver?: Pick<InheritanceResolver, 'resolveInheritTargets'>;
    host?: {
        openTextDocument(target: string | vscode.Uri): Promise<vscode.TextDocument>;
    };
    scopedMethodResolver?: Pick<ScopedMethodResolver, 'resolveCallAt'>;
}

const defaultHost = {
    openTextDocument: async (target: string | vscode.Uri) => typeof target === 'string'
        ? vscode.workspace.openTextDocument(target)
        : vscode.workspace.openTextDocument(target)
};

export class InheritedFunctionRelationService {
    private readonly astManager = ASTManager.getInstance();
    private readonly inheritanceResolver: Pick<InheritanceResolver, 'resolveInheritTargets'>;
    private readonly host: {
        openTextDocument(target: string | vscode.Uri): Promise<vscode.TextDocument>;
    };
    private readonly scopedMethodResolver?: Pick<ScopedMethodResolver, 'resolveCallAt'>;

    public constructor(options: InheritedFunctionRelationServiceOptions = {}) {
        this.inheritanceResolver = options.inheritanceResolver
            ?? new InheritanceResolver(options.macroManager, options.workspaceRoots);
        this.host = options.host ?? defaultHost;
        this.scopedMethodResolver = options.scopedMethodResolver;
    }

    public async collectFunctionReferences(
        document: vscode.TextDocument,
        position: vscode.Position,
        options: { includeDeclaration: boolean }
    ): Promise<Array<{ uri: string; range: vscode.Range }>> {
        const targetPosition = toVsCodePosition(position);
        const functionName = getWordAtPosition(document, targetPosition);
        if (!functionName) {
            return [];
        }

        const snapshot = this.astManager.getSemanticSnapshot(document, false);
        const resolvedSymbol = resolveVisibleSymbol(snapshot.symbolTable, functionName, targetPosition);

        if (resolvedSymbol?.type === SymbolType.FUNCTION) {
            const family = await this.resolveFunctionFamilyFromVisibleSymbol(document, functionName);
            if (family.hasUnresolvedTargets) {
                return [];
            }

            return this.collectFunctionFamilyMatches(document, functionName, family.documents, options);
        }

        if (resolvedSymbol?.type === SymbolType.STRUCT || resolvedSymbol?.type === SymbolType.CLASS) {
            return [];
        }

        const scopedFamily = await this.resolveFunctionFamilyFromScopedCall(document, targetPosition);
        if (!scopedFamily) {
            return [];
        }

        return this.collectFunctionFamilyMatches(document, scopedFamily.methodName, scopedFamily.documents, options);
    }

    private async collectFunctionFamilyMatches(
        document: vscode.TextDocument,
        functionName: string,
        familyDocuments: vscode.TextDocument[],
        options: { includeDeclaration: boolean }
    ): Promise<Array<{ uri: string; range: vscode.Range }>> {
        const matches: Array<{ uri: string; range: vscode.Range }> = [];
        const seen = new Set<string>();
        const familyUris = new Set(familyDocuments.map((familyDocument) => normalizeWorkspaceUri(familyDocument.uri)));

        for (const familyDocument of familyDocuments) {
            const sameFileReferences = this.collectLocalFunctionMatches(familyDocument, functionName, options);
            for (const match of sameFileReferences) {
                pushUniqueMatch(matches, seen, match.uri, match.range);
            }
        }

        if (this.scopedMethodResolver) {
            const scopedMatches = await this.collectScopedFunctionMatches(document, functionName, familyUris);
            for (const match of scopedMatches) {
                pushUniqueMatch(matches, seen, match.uri, match.range);
            }
        }

        return matches;
    }

    private collectLocalFunctionMatches(
        document: vscode.TextDocument,
        functionName: string,
        options: { includeDeclaration: boolean }
    ): Array<{ uri: string; range: vscode.Range }> {
        const snapshot = this.astManager.getSemanticSnapshot(document, false);
        const symbol = this.findGlobalFunctionSymbol(snapshot, functionName);
        if (!symbol) {
            return [];
        }

        const resolvedReferences = resolveSymbolReferences(document, symbol.selectionRange?.start ?? symbol.range.start);
        if (!resolvedReferences) {
            return [];
        }

        return resolvedReferences.matches
            .filter((match) => options.includeDeclaration || !match.isDeclaration)
            .map((match) => ({
                uri: normalizeWorkspaceUri(document.uri),
                range: match.range
            }));
    }

    private async collectScopedFunctionMatches(
        document: vscode.TextDocument,
        functionName: string,
        familyUris: Set<string>
    ): Promise<Array<{ uri: string; range: vscode.Range }>> {
        const syntax = this.astManager.getSyntaxDocument(document, false)
            ?? this.astManager.getSyntaxDocument(document, true);
        if (!syntax || !this.scopedMethodResolver) {
            return [];
        }

        const matches: Array<{ uri: string; range: vscode.Range }> = [];
        const seen = new Set<string>();
        for (const callExpression of this.collectCallExpressions(syntax.nodes)) {
            const scopedMethodRange = this.getScopedMethodRange(callExpression, functionName);
            if (!scopedMethodRange) {
                continue;
            }

            const resolution = await this.scopedMethodResolver.resolveCallAt(document, scopedMethodRange.start);
            if (!resolution || resolution.status !== 'resolved' || resolution.methodName !== functionName) {
                continue;
            }

            const pointsIntoFamily = resolution.targets.some((target) => familyUris.has(normalizeWorkspaceUri(target.document.uri)));
            if (!pointsIntoFamily) {
                continue;
            }

            pushUniqueMatch(matches, seen, normalizeWorkspaceUri(document.uri), scopedMethodRange);
        }

        return matches;
    }

    private async resolveFunctionFamilyFromVisibleSymbol(
        document: vscode.TextDocument,
        functionName: string
    ): Promise<{ documents: vscode.TextDocument[]; hasUnresolvedTargets: boolean }> {
        const familyDocuments = new Map<string, vscode.TextDocument>([
            [normalizeWorkspaceUri(document.uri), document]
        ]);

        const inheritedDocuments = await this.collectInheritedFunctionFamilyDocuments(
            document,
            functionName,
            new Set([normalizeWorkspaceUri(document.uri)])
        );
        if (inheritedDocuments.hasUnresolvedTargets) {
            return {
                documents: Array.from(familyDocuments.values()),
                hasUnresolvedTargets: true
            };
        }

        for (const familyDocument of inheritedDocuments.documents) {
            familyDocuments.set(normalizeWorkspaceUri(familyDocument.uri), familyDocument);
        }

        return {
            documents: Array.from(familyDocuments.values()),
            hasUnresolvedTargets: false
        };
    }

    private async resolveFunctionFamilyFromScopedCall(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<{ methodName: string; documents: vscode.TextDocument[] } | undefined> {
        if (!this.scopedMethodResolver) {
            return undefined;
        }

        const resolution = await this.scopedMethodResolver.resolveCallAt(document, position);
        if (!resolution || resolution.status !== 'resolved' || resolution.targets.length === 0) {
            return undefined;
        }
        if (!isOnScopedMethodIdentifier(document, position, resolution.methodName)) {
            return undefined;
        }

        const familyDocuments = new Map<string, vscode.TextDocument>();
        for (const target of resolution.targets) {
            familyDocuments.set(normalizeWorkspaceUri(target.document.uri), target.document);
        }

        return {
            methodName: resolution.methodName,
            documents: Array.from(familyDocuments.values())
        };
    }

    private async collectInheritedFunctionFamilyDocuments(
        document: vscode.TextDocument,
        functionName: string,
        visitedUris: Set<string>
    ): Promise<{ documents: vscode.TextDocument[]; hasUnresolvedTargets: boolean }> {
        const snapshot = this.astManager.getSemanticSnapshot(document, false);
        const directSeeds = resolveScopedDirectInheritSeeds(this.inheritanceResolver as any, snapshot);
        if (directSeeds.hasUnresolvedTargets) {
            return { documents: [], hasUnresolvedTargets: true };
        }

        const documents = new Map<string, vscode.TextDocument>();
        for (const seed of directSeeds.resolvedTargets) {
            const targetUri = normalizeWorkspaceUri(seed.resolvedUri);
            if (visitedUris.has(targetUri)) {
                continue;
            }

            visitedUris.add(targetUri);

            try {
                const inheritedDocument = await this.host.openTextDocument(vscode.Uri.parse(seed.resolvedUri));
                const inheritedSnapshot = this.astManager.getSemanticSnapshot(inheritedDocument, false);
                if (this.findGlobalFunctionSymbol(inheritedSnapshot, functionName)) {
                    documents.set(targetUri, inheritedDocument);
                }

                const nested = await this.collectInheritedFunctionFamilyDocuments(
                    inheritedDocument,
                    functionName,
                    visitedUris
                );
                if (nested.hasUnresolvedTargets) {
                    return { documents: [], hasUnresolvedTargets: true };
                }

                for (const nestedDocument of nested.documents) {
                    documents.set(normalizeWorkspaceUri(nestedDocument.uri), nestedDocument);
                }
            } catch {
                continue;
            }
        }

        return {
            documents: Array.from(documents.values()),
            hasUnresolvedTargets: false
        };
    }

    private findGlobalFunctionSymbol(
        snapshot: ReturnType<ASTManager['getSemanticSnapshot']>,
        functionName: string
    ): LPCSymbol | undefined {
        const symbol = snapshot.symbolTable.getGlobalScope().symbols.get(functionName);
        return symbol?.type === SymbolType.FUNCTION ? symbol : undefined;
    }

    private collectCallExpressions(nodes: readonly SyntaxNode[]): SyntaxNode[] {
        const queue = [...nodes];
        const callExpressions: SyntaxNode[] = [];

        while (queue.length > 0) {
            const current = queue.shift()!;
            if (current.kind === SyntaxKind.CallExpression) {
                callExpressions.push(current);
            }
            queue.push(...current.children);
        }

        return callExpressions;
    }

    private getScopedMethodRange(callExpression: SyntaxNode, methodName: string): vscode.Range | undefined {
        const callee = callExpression.children[0];
        if (!callee) {
            return undefined;
        }

        if (callee.kind === SyntaxKind.Identifier && callee.metadata?.scopeQualifier === '::' && callee.name === methodName) {
            return callee.range;
        }

        if (callee.kind !== SyntaxKind.MemberAccessExpression || callee.metadata?.operator !== '::') {
            return undefined;
        }

        const memberNode = callee.children[1];
        if (memberNode?.kind !== SyntaxKind.Identifier || memberNode.name !== methodName) {
            return undefined;
        }

        return memberNode.range;
    }
}

function getWordAtPosition(document: vscode.TextDocument, position: vscode.Position): string | undefined {
    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) {
        return undefined;
    }

    const word = document.getText(wordRange);
    return word || undefined;
}

function pushUniqueMatch(
    matches: Array<{ uri: string; range: vscode.Range }>,
    seen: Set<string>,
    uri: string | vscode.Uri,
    range: vscode.Range
): void {
    const normalizedUri = normalizeWorkspaceUri(uri);
    const key = `${normalizedUri}#${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`;
    if (seen.has(key)) {
        return;
    }

    seen.add(key);
    matches.push({
        uri: normalizedUri,
        range
    });
}

function toVsCodePosition(position: vscode.Position | { line: number; character: number }): vscode.Position {
    return position instanceof vscode.Position
        ? position
        : new vscode.Position(position.line, position.character);
}
