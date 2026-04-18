import * as vscode from 'vscode';
import { LPCLexer } from '../../../antlr/LPCLexer';
import { ASTManager } from '../../../ast/astManager';
import { Symbol as LPCSymbol, SymbolType } from '../../../ast/symbolTable';
import { InheritanceResolver } from '../../../completion/inheritanceResolver';
import type { MacroManager } from '../../../macroManager';
import type { ScopedMethodResolver } from '../../../objectInference/ScopedMethodResolver';
import { resolveScopedDirectInheritSeeds } from '../../../objectInference/scopedInheritanceTraversal';
import { resolveVisibleSymbol } from '../../../symbolReferenceResolver';
import { InheritedFunctionRelationService } from './InheritedFunctionRelationService';
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
    functionRelationService?: Pick<InheritedFunctionRelationService, 'collectFunctionReferences'>;
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
    private readonly functionRelationService: Pick<InheritedFunctionRelationService, 'collectFunctionReferences'>;

    public constructor(options: InheritedSymbolRelationServiceOptions = {}) {
        this.inheritanceResolver = options.inheritanceResolver
            ?? new InheritanceResolver(options.macroManager, options.workspaceRoots);
        this.host = options.host ?? defaultHost;
        this.functionRelationService = options.functionRelationService
            ?? new InheritedFunctionRelationService(options);
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

        const functionMatches = await this.functionRelationService.collectFunctionReferences(document, targetPosition, options);
        if (functionMatches.length > 0) {
            return functionMatches;
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

    private findFileGlobalSymbol(
        snapshot: ReturnType<ASTManager['getSemanticSnapshot']>,
        symbolName: string
    ): LPCSymbol | undefined {
        const symbol = snapshot.symbolTable.getGlobalScope().symbols.get(symbolName);
        return symbol?.type === SymbolType.VARIABLE ? symbol : undefined;
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
