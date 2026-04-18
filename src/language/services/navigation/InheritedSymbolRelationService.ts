import * as vscode from 'vscode';
import { LPCLexer } from '../../../antlr/LPCLexer';
import { ASTManager } from '../../../ast/astManager';
import { Symbol as LPCSymbol, SymbolType } from '../../../ast/symbolTable';
import { InheritanceResolver } from '../../../completion/inheritanceResolver';
import type { MacroManager } from '../../../macroManager';
import type { ScopedMethodResolver } from '../../../objectInference/ScopedMethodResolver';
import { resolveScopedDirectInheritSeeds } from '../../../objectInference/scopedInheritanceTraversal';
import { resolveSymbolReferences, resolveVisibleSymbol } from '../../../symbolReferenceResolver';
import { SyntaxKind, type SyntaxNode } from '../../../syntax/types';
import { normalizeWorkspaceUri } from './navigationPathUtils';

export interface InheritedReferenceMatch {
    uri: string;
    range: vscode.Range;
}

export type RenameTargetClassification =
    | { kind: 'current-file-only' }
    | { kind: 'file-global' }
    | { kind: 'unsupported' };

interface FileGlobalBinding {
    name: string;
    ownerUri: string;
    declarationRange: vscode.Range;
    pathDocuments: vscode.TextDocument[];
}

type FileGlobalBindingResolution =
    | { status: 'resolved'; binding: FileGlobalBinding }
    | { status: 'ambiguous' | 'unresolved' | 'none' };

export interface InheritedSymbolRelationServiceOptions {
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

export class InheritedSymbolRelationService {
    private readonly astManager = ASTManager.getInstance();
    private readonly inheritanceResolver: Pick<InheritanceResolver, 'resolveInheritTargets'>;
    private readonly host: {
        openTextDocument(target: string | vscode.Uri): Promise<vscode.TextDocument>;
    };
    private readonly scopedMethodResolver?: Pick<ScopedMethodResolver, 'resolveCallAt'>;

    public constructor(options: InheritedSymbolRelationServiceOptions = {}) {
        this.inheritanceResolver = options.inheritanceResolver
            ?? new InheritanceResolver(options.macroManager, options.workspaceRoots);
        this.host = options.host ?? defaultHost;
        this.scopedMethodResolver = options.scopedMethodResolver;
    }

    public async collectInheritedReferences(
        document: vscode.TextDocument,
        position: vscode.Position,
        options: { includeDeclaration: boolean }
    ): Promise<InheritedReferenceMatch[]> {
        const targetPosition = toVsCodePosition(position);
        const symbolName = this.getWordAtPosition(document, targetPosition);
        if (!symbolName) {
            return [];
        }

        const snapshot = this.astManager.getSemanticSnapshot(document, false);
        const resolvedSymbol = resolveVisibleSymbol(snapshot.symbolTable, symbolName, targetPosition);

        if (resolvedSymbol?.type === SymbolType.FUNCTION) {
            const family = await this.resolveFunctionFamilyFromVisibleSymbol(document, symbolName);
            if (!family || family.hasUnresolvedTargets) {
                return [];
            }

            return this.collectFunctionFamilyMatches(document, symbolName, family.documents, options);
        }

        if (resolvedSymbol?.type === SymbolType.STRUCT || resolvedSymbol?.type === SymbolType.CLASS) {
            return [];
        }

        const scopedFamily = await this.resolveFunctionFamilyFromScopedCall(document, targetPosition);
        if (scopedFamily) {
            return this.collectFunctionFamilyMatches(document, scopedFamily.methodName, scopedFamily.documents, options);
        }

        const globalBinding = await this.resolveVisibleFileGlobalBinding(document, symbolName, targetPosition);
        if (globalBinding.status !== 'resolved') {
            return [];
        }

        return this.collectFileGlobalMatches(globalBinding.binding, options);
    }

    public async classifyRenameTarget(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<RenameTargetClassification> {
        const targetPosition = toVsCodePosition(position);
        const symbolName = this.getWordAtPosition(document, targetPosition);
        if (!symbolName) {
            return { kind: 'unsupported' };
        }

        const snapshot = this.astManager.getSemanticSnapshot(document, false);
        const resolvedSymbol = resolveVisibleSymbol(snapshot.symbolTable, symbolName, targetPosition);
        if (resolvedSymbol?.type === SymbolType.PARAMETER) {
            return { kind: 'current-file-only' };
        }

        if (resolvedSymbol?.type === SymbolType.VARIABLE && resolvedSymbol.scope !== snapshot.symbolTable.getGlobalScope()) {
            return { kind: 'current-file-only' };
        }

        if (resolvedSymbol?.type === SymbolType.FUNCTION || resolvedSymbol?.type === SymbolType.STRUCT || resolvedSymbol?.type === SymbolType.CLASS) {
            return { kind: 'unsupported' };
        }

        if (resolvedSymbol?.type === SymbolType.VARIABLE) {
            return { kind: 'file-global' };
        }

        const inheritedBinding = await this.resolveVisibleFileGlobalBinding(document, symbolName, targetPosition);
        return inheritedBinding.status === 'resolved'
            ? { kind: 'file-global' }
            : { kind: 'unsupported' };
    }

    public async buildInheritedRenameEdits(
        document: vscode.TextDocument,
        position: vscode.Position,
        newName: string
    ): Promise<Record<string, Array<{ range: vscode.Range; newText: string }>>> {
        const targetPosition = toVsCodePosition(position);
        const symbolName = this.getWordAtPosition(document, targetPosition);
        if (!symbolName) {
            return {};
        }

        const binding = await this.resolveVisibleFileGlobalBinding(document, symbolName, targetPosition);
        if (binding.status !== 'resolved') {
            return {};
        }

        const matches = await this.collectFileGlobalMatches(binding.binding, { includeDeclaration: true });
        const changes: Record<string, Array<{ range: vscode.Range; newText: string }>> = {};

        for (const match of matches) {
            const edits = changes[match.uri] ?? [];
            edits.push({
                range: match.range,
                newText: newName
            });
            changes[match.uri] = edits;
        }

        return changes;
    }

    private async collectFunctionFamilyMatches(
        document: vscode.TextDocument,
        functionName: string,
        familyDocuments: vscode.TextDocument[],
        options: { includeDeclaration: boolean }
    ): Promise<InheritedReferenceMatch[]> {
        const matches: InheritedReferenceMatch[] = [];
        const seen = new Set<string>();
        const familyUris = new Set(familyDocuments.map((familyDocument) => normalizeWorkspaceUri(familyDocument.uri)));

        for (const familyDocument of familyDocuments) {
            const sameFileReferences = this.collectLocalFunctionMatches(familyDocument, functionName, options);
            for (const match of sameFileReferences) {
                this.pushUniqueMatch(matches, seen, match.uri, match.range);
            }
        }

        if (this.scopedMethodResolver) {
            const scopedMatches = await this.collectScopedFunctionMatches(
                document,
                functionName,
                familyUris
            );

            for (const match of scopedMatches) {
                this.pushUniqueMatch(matches, seen, match.uri, match.range);
            }
        }

        return matches;
    }

    private collectLocalFunctionMatches(
        document: vscode.TextDocument,
        functionName: string,
        options: { includeDeclaration: boolean }
    ): InheritedReferenceMatch[] {
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
    ): Promise<InheritedReferenceMatch[]> {
        const syntax = this.astManager.getSyntaxDocument(document, false)
            ?? this.astManager.getSyntaxDocument(document, true);
        if (!syntax || !this.scopedMethodResolver) {
            return [];
        }

        const matches: InheritedReferenceMatch[] = [];
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

            const pointsIntoFamily = resolution.targets.some((target) => {
                const targetUri = normalizeWorkspaceUri(target.document.uri);
                return familyUris.has(targetUri);
            });
            if (!pointsIntoFamily) {
                continue;
            }

            this.pushUniqueMatch(matches, seen, normalizeWorkspaceUri(document.uri), scopedMethodRange);
        }

        return matches;
    }

    private async collectFileGlobalMatches(
        binding: FileGlobalBinding,
        options: { includeDeclaration: boolean }
    ): Promise<InheritedReferenceMatch[]> {
        const matches: InheritedReferenceMatch[] = [];
        const seen = new Set<string>();
        const cache = new Map<string, FileGlobalBindingResolution>();

        for (const chainDocument of binding.pathDocuments) {
            const parseResult = this.astManager.parseDocument(chainDocument, false);
            const tokenStream = parseResult.parsed?.tokens;
            if (!tokenStream) {
                continue;
            }

            for (const token of tokenStream.getTokens()) {
                if (
                    token.channel !== 0
                    || token.type !== LPCLexer.Identifier
                    || token.text !== binding.name
                ) {
                    continue;
                }

                const range = new vscode.Range(
                    chainDocument.positionAt(token.startIndex),
                    chainDocument.positionAt(token.stopIndex + 1)
                );
                const isDeclaration = normalizeWorkspaceUri(chainDocument.uri) === binding.ownerUri
                    && this.rangesEqual(range, binding.declarationRange);
                if (!options.includeDeclaration && isDeclaration) {
                    continue;
                }

                const resolution = await this.resolveVisibleFileGlobalBinding(
                    chainDocument,
                    binding.name,
                    range.start,
                    cache
                );
                if (resolution.status !== 'resolved') {
                    continue;
                }

                if (
                    resolution.binding.ownerUri !== binding.ownerUri
                    || !this.rangesEqual(resolution.binding.declarationRange, binding.declarationRange)
                ) {
                    continue;
                }

                this.pushUniqueMatch(matches, seen, normalizeWorkspaceUri(chainDocument.uri), range);
            }
        }

        return matches;
    }

    private async resolveFunctionFamilyFromVisibleSymbol(
        document: vscode.TextDocument,
        functionName: string
    ): Promise<{ documents: vscode.TextDocument[]; hasUnresolvedTargets: boolean } | undefined> {
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

    private async resolveVisibleFileGlobalBinding(
        document: vscode.TextDocument,
        symbolName: string,
        position: vscode.Position,
        cache: Map<string, FileGlobalBindingResolution> = new Map()
    ): Promise<FileGlobalBindingResolution> {
        const snapshot = this.astManager.getSemanticSnapshot(document, false);
        const resolvedSymbol = resolveVisibleSymbol(snapshot.symbolTable, symbolName, position);
        if (resolvedSymbol) {
            if (resolvedSymbol.type === SymbolType.VARIABLE && resolvedSymbol.scope === snapshot.symbolTable.getGlobalScope()) {
                return {
                    status: 'resolved',
                    binding: {
                        name: symbolName,
                        ownerUri: normalizeWorkspaceUri(document.uri),
                        declarationRange: resolvedSymbol.selectionRange ?? resolvedSymbol.range,
                        pathDocuments: [document]
                    }
                };
            }

            return { status: 'none' };
        }

        return this.resolveBranchGlobalOwner(document, symbolName, cache, new Set([normalizeWorkspaceUri(document.uri)]));
    }

    private async resolveBranchGlobalOwner(
        document: vscode.TextDocument,
        symbolName: string,
        cache: Map<string, FileGlobalBindingResolution>,
        visitedUris: Set<string>
    ): Promise<FileGlobalBindingResolution> {
        const cacheKey = `${normalizeWorkspaceUri(document.uri)}::${symbolName}`;
        const cached = cache.get(cacheKey);
        if (cached) {
            return cached;
        }

        const snapshot = this.astManager.getSemanticSnapshot(document, false);
        const localSymbol = this.findFileGlobalSymbol(snapshot, symbolName);
        if (localSymbol) {
            const resolved = {
                status: 'resolved' as const,
                binding: {
                    name: symbolName,
                    ownerUri: normalizeWorkspaceUri(document.uri),
                    declarationRange: localSymbol.selectionRange ?? localSymbol.range,
                    pathDocuments: [document]
                }
            };
            cache.set(cacheKey, resolved);
            return resolved;
        }

        const directSeeds = resolveScopedDirectInheritSeeds(this.inheritanceResolver as any, snapshot);
        if (directSeeds.hasUnresolvedTargets) {
            const unresolved = { status: 'unresolved' as const };
            cache.set(cacheKey, unresolved);
            return unresolved;
        }

        const branchMatches: FileGlobalBinding[] = [];
        let hasAmbiguousBranch = false;

        for (const seed of directSeeds.resolvedTargets) {
            const targetUri = normalizeWorkspaceUri(seed.resolvedUri);
            if (visitedUris.has(targetUri)) {
                continue;
            }

            try {
                const inheritedDocument = await this.host.openTextDocument(vscode.Uri.parse(seed.resolvedUri));
                const branchVisited = new Set(visitedUris);
                branchVisited.add(targetUri);
                const branchResolution = await this.resolveBranchGlobalOwner(
                    inheritedDocument,
                    symbolName,
                    cache,
                    branchVisited
                );

                if (branchResolution.status === 'resolved') {
                    branchMatches.push({
                        ...branchResolution.binding,
                        pathDocuments: [document, ...branchResolution.binding.pathDocuments]
                    });
                } else if (branchResolution.status === 'ambiguous' || branchResolution.status === 'unresolved') {
                    hasAmbiguousBranch = true;
                }
            } catch {
                continue;
            }
        }

        const result = branchMatches.length === 1 && !hasAmbiguousBranch
            ? { status: 'resolved' as const, binding: branchMatches[0] }
            : branchMatches.length > 1 || hasAmbiguousBranch
                ? { status: 'ambiguous' as const }
                : { status: 'none' as const };

        cache.set(cacheKey, result);
        return result;
    }

    private findGlobalFunctionSymbol(
        snapshot: ReturnType<ASTManager['getSemanticSnapshot']>,
        functionName: string
    ): LPCSymbol | undefined {
        const symbol = snapshot.symbolTable.getGlobalScope().symbols.get(functionName);
        return symbol?.type === SymbolType.FUNCTION ? symbol : undefined;
    }

    private findFileGlobalSymbol(
        snapshot: ReturnType<ASTManager['getSemanticSnapshot']>,
        symbolName: string
    ): LPCSymbol | undefined {
        const symbol = snapshot.symbolTable.getGlobalScope().symbols.get(symbolName);
        return symbol?.type === SymbolType.VARIABLE ? symbol : undefined;
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

    private getWordAtPosition(document: vscode.TextDocument, position: vscode.Position): string | undefined {
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return undefined;
        }

        const word = document.getText(wordRange);
        return word || undefined;
    }

    private pushUniqueMatch(
        matches: InheritedReferenceMatch[],
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

    private rangesEqual(left: vscode.Range, right: vscode.Range): boolean {
        return left.start.isEqual(right.start) && left.end.isEqual(right.end);
    }
}

function toVsCodePosition(position: vscode.Position | { line: number; character: number }): vscode.Position {
    return position instanceof vscode.Position
        ? position
        : new vscode.Position(position.line, position.character);
}
