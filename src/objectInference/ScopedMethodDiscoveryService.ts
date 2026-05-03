import * as path from 'path';
import * as vscode from 'vscode';
import { LPCParser } from '../antlr/LPCParser';
import { FunctionSummary } from '../completion/types';
import { InheritanceResolver } from '../completion/inheritanceResolver';
import { MacroManager } from '../macroManager';
import type { TextDocumentHost } from '../language/shared/WorkspaceDocumentPathSupport';
import { assertAnalysisService } from '../semantic/assertAnalysisService';
import type { DocumentAnalysisService } from '../semantic/documentAnalysisService';
import { SyntaxDocument, SyntaxKind, SyntaxNode } from '../syntax/types';
import {
    collectScopedBranchItems,
    matchesScopedQualifier,
    ResolvedScopedInheritTarget,
    resolveScopedDirectInheritSeeds
} from './scopedInheritanceTraversal';
import { isBareScopedPrefixSupportedByTokens } from './scopedSyntaxSupport';

export interface ScopedDiscoveredMethod {
    name: string;
    path: string;
    documentUri: string;
    declarationRange: vscode.Range;
    definition?: string;
    documentation?: string;
    returnType?: string;
    parameters: FunctionSummary['parameters'];
}

export interface ScopedMethodDiscoveryResult {
    status: 'resolved' | 'multiple' | 'unknown' | 'unsupported';
    qualifier?: string;
    methods: ScopedDiscoveredMethod[];
    reason?: string;
}

type ScopedDiscoveryShape =
    | { kind: 'bare'; prefix: string }
    | { kind: 'named'; prefix: string; qualifier: string }
    | { kind: 'unsupported'; prefix: string; qualifier?: string };

interface ScopedMethodCollection {
    methods: ScopedDiscoveredMethod[];
    hasUnresolvedTargets: boolean;
}

export interface ScopedMethodDiscoveryServiceDependencies {
    analysisService?: Pick<DocumentAnalysisService, 'getSyntaxDocument' | 'getSemanticSnapshot'>;
    inheritanceResolver: InheritanceResolver;
    host?: Pick<TextDocumentHost, 'openTextDocument'>;
}

export interface DefaultScopedMethodDiscoveryServiceDependencies {
    macroManager?: MacroManager;
    workspaceRoots?: string[];
    inheritanceResolver?: InheritanceResolver;
    analysisService?: Pick<DocumentAnalysisService, 'getSyntaxDocument' | 'getSemanticSnapshot'>;
    host?: Pick<TextDocumentHost, 'openTextDocument'>;
}

export class ScopedMethodDiscoveryService {
    private readonly analysisService: Pick<DocumentAnalysisService, 'getSyntaxDocument' | 'getSemanticSnapshot'>;
    private readonly inheritanceResolver: InheritanceResolver;
    private readonly host?: Pick<TextDocumentHost, 'openTextDocument'>;

    constructor(dependencies: ScopedMethodDiscoveryServiceDependencies) {
        this.analysisService = assertAnalysisService('ScopedMethodDiscoveryService', dependencies.analysisService);
        this.inheritanceResolver = dependencies.inheritanceResolver;
        this.host = dependencies.host;
    }

    public async discoverAt(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<ScopedMethodDiscoveryResult> {
        const syntax = this.analysisService.getSyntaxDocument(document, false)
            ?? this.analysisService.getSyntaxDocument(document, true);
        if (!syntax) {
            return {
                status: 'unknown',
                methods: []
            };
        }

        const shape = this.findScopedShapeAtPosition(document, syntax, position);
        if (!shape) {
            return {
                status: 'unknown',
                methods: []
            };
        }

        if (shape.kind === 'unsupported') {
            return {
                status: 'unsupported',
                qualifier: shape.qualifier,
                methods: [],
                reason: 'unsupported-expression'
            };
        }

        const snapshot = this.analysisService.getSemanticSnapshot(document, false);
        const directSeeds = resolveScopedDirectInheritSeeds(this.inheritanceResolver, snapshot);
        if (directSeeds.hasUnresolvedTargets) {
            return {
                status: 'unknown',
                qualifier: shape.kind === 'named' ? shape.qualifier : undefined,
                methods: []
            };
        }

        if (shape.kind === 'named') {
            const matchedSeeds = directSeeds.resolvedTargets.filter((target) => matchesScopedQualifier(target, shape.qualifier));
            if (matchedSeeds.length !== 1) {
                return {
                    status: 'unknown',
                    qualifier: shape.qualifier,
                    methods: []
                };
            }

            const collection = await this.collectMethodsFromSeed(matchedSeeds[0], shape.prefix, new Set<string>());
            return this.normalizeDiscoveryResult(collection, shape.qualifier, 1);
        }

        const methods: ScopedDiscoveredMethod[] = [];
        let matchingSeedCount = 0;

        for (const seed of directSeeds.resolvedTargets) {
            const collection = await this.collectMethodsFromSeed(seed, shape.prefix, new Set<string>());
            if (collection.hasUnresolvedTargets) {
                return {
                    status: 'unknown',
                    methods: []
                };
            }

            if (collection.methods.length > 0) {
                matchingSeedCount += 1;
            }

            methods.push(...collection.methods);
        }

        return this.normalizeDiscoveryResult(
            {
                methods,
                hasUnresolvedTargets: false
            },
            undefined,
            matchingSeedCount
        );
    }

    private findScopedShapeAtPosition(
        document: vscode.TextDocument,
        syntax: SyntaxDocument,
        position: vscode.Position
    ): ScopedDiscoveryShape | undefined {
        const candidates = [...syntax.nodes]
            .filter((node) => this.rangeTouchesPosition(node.range, position))
            .sort((left, right) => this.getRangeSize(left.range) - this.getRangeSize(right.range));

        for (const node of candidates) {
            if (node.kind === SyntaxKind.Identifier && node.metadata?.scopeQualifier === '::' && node.name) {
                if (!this.rangeTouchesPosition(node.range, position)) {
                    continue;
                }

                if (!isBareScopedPrefixSupportedByTokens(document, syntax, node)) {
                    return {
                        kind: 'unsupported',
                        prefix: node.name
                    };
                }

                return {
                    kind: 'bare',
                    prefix: node.name
                };
            }

            if (node.kind !== SyntaxKind.MemberAccessExpression || node.metadata?.operator !== '::') {
                continue;
            }

            const qualifierNode = node.children[0];
            const memberNode = node.children[1];
            if (!memberNode || !this.rangeTouchesPosition(memberNode.range, position)) {
                continue;
            }

            if (memberNode.kind !== SyntaxKind.Identifier || !memberNode.name) {
                return {
                    kind: 'unsupported',
                    prefix: '',
                    qualifier: qualifierNode?.kind === SyntaxKind.Identifier ? qualifierNode.name : undefined
                };
            }

            if (qualifierNode?.kind !== SyntaxKind.Identifier || !qualifierNode.name) {
                return {
                    kind: 'unsupported',
                    prefix: memberNode.name,
                    qualifier: qualifierNode?.kind === SyntaxKind.Identifier ? qualifierNode.name : undefined
                };
            }

            return {
                kind: 'named',
                prefix: memberNode.name,
                qualifier: qualifierNode.name
            };
        }

        return this.classifyScopedTokens(document, syntax, position);
    }

    private classifyScopedTokens(
        document: vscode.TextDocument,
        syntax: SyntaxDocument,
        position: vscode.Position
    ): ScopedDiscoveryShape | undefined {
        const offset = document.offsetAt(position);
        const visibleTokens = syntax.parsed.allTokens.filter((token) => token.type > 0);
        let identifierIndex = -1;

        for (let index = visibleTokens.length - 1; index >= 0; index -= 1) {
            const token = visibleTokens[index];
            if (token.type !== LPCParser.Identifier) {
                continue;
            }

            if (token.startIndex <= Math.max(offset - 1, 0) && token.stopIndex + 1 >= offset) {
                identifierIndex = index;
                break;
            }
        }

        if (identifierIndex < 0) {
            return undefined;
        }

        const identifierToken = visibleTokens[identifierIndex];
        const scopeToken = visibleTokens[identifierIndex - 1];
        if (!scopeToken || scopeToken.type !== LPCParser.SCOPE) {
            return undefined;
        }

        const qualifierToken = visibleTokens[identifierIndex - 2];
        if (!qualifierToken) {
            return {
                kind: 'bare',
                prefix: identifierToken.text ?? ''
            };
        }

        if (qualifierToken.type === LPCParser.Identifier) {
            return {
                kind: 'named',
                prefix: identifierToken.text ?? '',
                qualifier: qualifierToken.text ?? ''
            };
        }

        return {
            kind: 'unsupported',
            prefix: identifierToken.text ?? ''
        };
    }

    private async collectMethodsFromSeed(
        seed: ResolvedScopedInheritTarget,
        prefix: string,
        visitedUris: Set<string>
    ): Promise<ScopedMethodCollection> {
        const collection = await collectScopedBranchItems({
            astManager: createScopedTraversalAnalysisFacade(this.analysisService),
            inheritanceResolver: this.inheritanceResolver,
            host: this.host,
            seed,
            visitedUris,
            collectFromDocument: (targetDocument, snapshot) => {
                return snapshot.exportedFunctions
                    .filter((func) => func.name.startsWith(prefix))
                    .map((func) => this.toDiscoveredMethod(targetDocument, func));
            }
        });

        return {
            methods: collection.items,
            hasUnresolvedTargets: collection.hasUnresolvedTargets
        };
    }

    private normalizeDiscoveryResult(
        collection: ScopedMethodCollection,
        qualifier?: string,
        matchingSeedCount: number = 1
    ): ScopedMethodDiscoveryResult {
        if (collection.hasUnresolvedTargets) {
            return {
                status: 'unknown',
                qualifier,
                methods: []
            };
        }

        const deduped = new Map<string, ScopedDiscoveredMethod>();
        for (const method of collection.methods) {
            deduped.set(this.getMethodKey(method), method);
        }

        const methods = Array.from(deduped.values()).sort((left, right) => left.name.localeCompare(right.name));
        if (methods.length === 0) {
            return {
                status: 'unknown',
                qualifier,
                methods: []
            };
        }

        return {
            status: matchingSeedCount > 1 ? 'multiple' : 'resolved',
            qualifier,
            methods
        };
    }

    private toDiscoveredMethod(document: vscode.TextDocument, func: FunctionSummary): ScopedDiscoveredMethod {
        return {
            name: func.name,
            path: this.normalizeFsPath(document.uri.fsPath),
            documentUri: document.uri.toString(),
            declarationRange: func.range,
            definition: func.definition,
            documentation: func.documentation,
            returnType: func.returnType,
            parameters: func.parameters
        };
    }

    private getMethodKey(method: ScopedDiscoveredMethod): string {
        const range = method.declarationRange;
        return `${method.path}:${range.start.line}:${range.start.character}:${range.end.line}:${range.end.character}`;
    }

    private rangeTouchesPosition(range: vscode.Range, position: vscode.Position): boolean {
        return range.contains(position) || range.end.isEqual(position);
    }

    private normalizeFsPath(filePath: string): string {
        return path.normalize(filePath.replace(/^[/\\]+([A-Za-z]:[\\/])/, '$1'));
    }

    private getRangeSize(range: vscode.Range): number {
        return (range.end.line - range.start.line) * 10_000 + (range.end.character - range.start.character);
    }
}

export function createDefaultScopedMethodDiscoveryService(
    dependencies: DefaultScopedMethodDiscoveryServiceDependencies
): ScopedMethodDiscoveryService {
    return new ScopedMethodDiscoveryService({
        analysisService: dependencies.analysisService,
        inheritanceResolver: dependencies.inheritanceResolver
            ?? new InheritanceResolver(dependencies.macroManager, dependencies.workspaceRoots),
        host: dependencies.host
    });
}

function createScopedTraversalAnalysisFacade(
    analysisService: Pick<DocumentAnalysisService, 'getSemanticSnapshot'>
) {
    return {
        getSemanticSnapshot: (document: vscode.TextDocument, useCache: boolean = true) =>
            analysisService.getSemanticSnapshot(document, useCache)
    } as any;
}
