import * as vscode from 'vscode';
import { LPCLexer } from '../../../antlr/LPCLexer';
import { Symbol as LPCSymbol, SymbolType } from '../../../ast/symbolTable';
import { InheritanceResolver } from '../../../completion/inheritanceResolver';
import type { MacroManager } from '../../../macroManager';
import { assertAnalysisService } from '../../../semantic/assertAnalysisService';
import type { DocumentAnalysisService } from '../../../semantic/documentAnalysisService';
import type { SemanticSnapshot } from '../../../semantic/semanticSnapshot';
import { resolveScopedDirectInheritSeeds } from '../../../objectInference/scopedInheritanceTraversal';
import { resolveVisibleSymbol } from '../../../symbolReferenceResolver';
import { assertOpenTextDocumentHost } from '../../shared/WorkspaceDocumentPathSupport';
import { normalizeWorkspaceUri } from './navigationPathUtils';
export interface FileGlobalBinding {
    name: string;
    ownerUri: string;
    declarationRange: vscode.Range;
    pathDocuments: vscode.TextDocument[];
}

export type FileGlobalBindingResolution =
    | { status: 'resolved'; binding: FileGlobalBinding }
    | { status: 'ambiguous' | 'unresolved' | 'none' };

export interface InheritedFileGlobalRelationServiceOptions {
    analysisService?: Pick<DocumentAnalysisService, 'parseDocument' | 'getSemanticSnapshot' | 'getSyntaxDocument'>;
    macroManager?: MacroManager;
    workspaceRoots?: string[];
    inheritanceResolver?: Pick<InheritanceResolver, 'resolveInheritTargets'>;
    host?: {
        openTextDocument(target: string | vscode.Uri): Promise<vscode.TextDocument>;
    };
}

export class InheritedFileGlobalRelationService {
    private readonly analysisService: Pick<DocumentAnalysisService, 'parseDocument' | 'getSemanticSnapshot' | 'getSyntaxDocument'>;
    private readonly inheritanceResolver: Pick<InheritanceResolver, 'resolveInheritTargets'>;
    private readonly host: {
        openTextDocument(target: string | vscode.Uri): Promise<vscode.TextDocument>;
    };

    public constructor(options: InheritedFileGlobalRelationServiceOptions = {}) {
        this.analysisService = assertAnalysisService('InheritedFileGlobalRelationService', options.analysisService);
        this.inheritanceResolver = options.inheritanceResolver
            ?? new InheritanceResolver(options.macroManager, options.workspaceRoots);
        this.host = assertOpenTextDocumentHost('InheritedFileGlobalRelationService', options.host);
    }

    public async resolveVisibleBinding(
        document: vscode.TextDocument,
        symbolName: string,
        position: vscode.Position
    ): Promise<FileGlobalBindingResolution> {
        return this.resolveVisibleBindingInternal(document, symbolName, position, new Map());
    }

    public async collectReferences(
        binding: FileGlobalBinding,
        options: { includeDeclaration: boolean }
    ): Promise<Array<{ uri: string; range: vscode.Range }>> {
        const matches: Array<{ uri: string; range: vscode.Range }> = [];
        const seen = new Set<string>();
        const cache = new Map<string, FileGlobalBindingResolution>();

        for (const chainDocument of binding.pathDocuments) {
            const parseResult = this.analysisService.parseDocument(chainDocument, false);
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
                    && rangesEqual(range, binding.declarationRange);
                if (!options.includeDeclaration && isDeclaration) {
                    continue;
                }

                const resolution = await this.resolveVisibleBindingInternal(
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
                    || !rangesEqual(resolution.binding.declarationRange, binding.declarationRange)
                ) {
                    continue;
                }

                pushUniqueMatch(matches, seen, normalizeWorkspaceUri(chainDocument.uri), range);
            }
        }

        return matches;
    }

    private async resolveVisibleBindingInternal(
        document: vscode.TextDocument,
        symbolName: string,
        position: vscode.Position,
        cache: Map<string, FileGlobalBindingResolution>
    ): Promise<FileGlobalBindingResolution> {
        const snapshot = this.analysisService.getSemanticSnapshot(document, false);
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

        const snapshot = this.analysisService.getSemanticSnapshot(document, false);
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

        const branchMatches = new Map<string, FileGlobalBinding>();
        let hasAmbiguousBranch = false;
        let hasUnresolvedBranch = false;

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
                    const mergedBinding = {
                        ...branchResolution.binding,
                        pathDocuments: mergePathDocuments(document, ...branchResolution.binding.pathDocuments)
                    };
                    const bindingKey = getBindingIdentityKey(mergedBinding);
                    const existingBinding = branchMatches.get(bindingKey);

                    branchMatches.set(
                        bindingKey,
                        existingBinding
                            ? {
                                ...existingBinding,
                                pathDocuments: mergePathDocuments(
                                    ...existingBinding.pathDocuments,
                                    ...mergedBinding.pathDocuments
                                )
                            }
                            : mergedBinding
                    );
                } else if (branchResolution.status === 'unresolved') {
                    hasUnresolvedBranch = true;
                } else if (branchResolution.status === 'ambiguous') {
                    hasAmbiguousBranch = true;
                }
            } catch {
                hasUnresolvedBranch = true;
            }
        }

        const result = hasUnresolvedBranch
            ? { status: 'unresolved' as const }
            : branchMatches.size === 1 && !hasAmbiguousBranch
            ? { status: 'resolved' as const, binding: [...branchMatches.values()][0] }
            : branchMatches.size > 1 || hasAmbiguousBranch
                ? { status: 'ambiguous' as const }
                : { status: 'none' as const };

        cache.set(cacheKey, result);
        return result;
    }

    private findFileGlobalSymbol(
        snapshot: SemanticSnapshot,
        symbolName: string
    ): LPCSymbol | undefined {
        const symbol = snapshot.symbolTable.getGlobalScope().symbols.get(symbolName);
        return symbol?.type === SymbolType.VARIABLE ? symbol : undefined;
    }
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

function rangesEqual(left: vscode.Range, right: vscode.Range): boolean {
    return left.start.isEqual(right.start) && left.end.isEqual(right.end);
}

function getBindingIdentityKey(binding: Pick<FileGlobalBinding, 'ownerUri' | 'declarationRange'>): string {
    return `${binding.ownerUri}#${binding.declarationRange.start.line}:${binding.declarationRange.start.character}-${binding.declarationRange.end.line}:${binding.declarationRange.end.character}`;
}

function mergePathDocuments(...documents: vscode.TextDocument[]): vscode.TextDocument[] {
    const merged: vscode.TextDocument[] = [];
    const seen = new Set<string>();

    for (const document of documents) {
        const key = normalizeWorkspaceUri(document.uri);
        if (seen.has(key)) {
            continue;
        }

        seen.add(key);
        merged.push(document);
    }

    return merged;
}
