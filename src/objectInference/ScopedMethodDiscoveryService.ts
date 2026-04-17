import * as path from 'path';
import * as vscode from 'vscode';
import { LPCParser } from '../antlr/LPCParser';
import { ASTManager } from '../ast/astManager';
import { FunctionSummary, ResolvedInheritTarget } from '../completion/types';
import { InheritanceResolver } from '../completion/inheritanceResolver';
import { MacroManager } from '../macroManager';
import { SyntaxDocument, SyntaxKind, SyntaxNode } from '../syntax/types';

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

type ResolvedScopedInheritTarget = ResolvedInheritTarget & {
    resolvedUri: string;
    isResolved: true;
};

type ScopedDiscoveryShape =
    | { kind: 'bare'; prefix: string }
    | { kind: 'named'; prefix: string; qualifier: string }
    | { kind: 'unsupported'; prefix: string; qualifier?: string };

interface ScopedSeedResolution {
    resolvedTargets: ResolvedScopedInheritTarget[];
    hasUnresolvedTargets: boolean;
}

interface ScopedMethodCollection {
    methods: ScopedDiscoveredMethod[];
    hasUnresolvedTargets: boolean;
}

export class ScopedMethodDiscoveryService {
    private readonly astManager = ASTManager.getInstance();
    private readonly inheritanceResolver: InheritanceResolver;

    constructor(
        macroManager?: MacroManager,
        workspaceRoots?: string[]
    ) {
        this.inheritanceResolver = new InheritanceResolver(macroManager, workspaceRoots);
    }

    public async discoverAt(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<ScopedMethodDiscoveryResult> {
        const syntax = this.astManager.getSyntaxDocument(document, false)
            ?? this.astManager.getSyntaxDocument(document, true);
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

        const snapshot = this.astManager.getSemanticSnapshot(document, false);
        const directSeeds = this.resolveDirectInheritSeeds(snapshot);
        if (directSeeds.hasUnresolvedTargets) {
            return {
                status: 'unknown',
                qualifier: shape.kind === 'named' ? shape.qualifier : undefined,
                methods: []
            };
        }

        if (shape.kind === 'named') {
            const matchedSeeds = directSeeds.resolvedTargets.filter((target) => this.matchesQualifier(target, shape.qualifier));
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

                if (!this.isBareScopedPrefixSupported(document, node)) {
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

    private resolveDirectInheritSeeds(
        snapshot: Parameters<InheritanceResolver['resolveInheritTargets']>[0]
    ): ScopedSeedResolution {
        const resolvedTargets: ResolvedScopedInheritTarget[] = [];
        let hasUnresolvedTargets = false;

        for (const target of this.inheritanceResolver.resolveInheritTargets(snapshot)) {
            if (!target.isResolved || !target.resolvedUri) {
                hasUnresolvedTargets = true;
                continue;
            }

            resolvedTargets.push({
                ...target,
                resolvedUri: target.resolvedUri,
                isResolved: true
            });
        }

        return {
            resolvedTargets,
            hasUnresolvedTargets
        };
    }

    private async collectMethodsFromSeed(
        seed: ResolvedScopedInheritTarget,
        prefix: string,
        visitedUris: Set<string>
    ): Promise<ScopedMethodCollection> {
        if (visitedUris.has(seed.resolvedUri)) {
            return {
                methods: [],
                hasUnresolvedTargets: false
            };
        }

        visitedUris.add(seed.resolvedUri);

        try {
            const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(seed.resolvedUri));
            const snapshot = this.astManager.getSemanticSnapshot(document, false);
            const methods = snapshot.exportedFunctions
                .filter((func) => func.name.startsWith(prefix))
                .map((func) => this.toDiscoveredMethod(document, func));

            const nestedSeeds = this.resolveDirectInheritSeeds(snapshot);
            if (nestedSeeds.hasUnresolvedTargets) {
                return {
                    methods: [],
                    hasUnresolvedTargets: true
                };
            }

            for (const nestedSeed of nestedSeeds.resolvedTargets) {
                const nestedCollection = await this.collectMethodsFromSeed(nestedSeed, prefix, visitedUris);
                if (nestedCollection.hasUnresolvedTargets) {
                    return {
                        methods: [],
                        hasUnresolvedTargets: true
                    };
                }

                methods.push(...nestedCollection.methods);
            }

            return {
                methods,
                hasUnresolvedTargets: false
            };
        } catch {
            return {
                methods: [],
                hasUnresolvedTargets: false
            };
        }
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

    private isBareScopedPrefixSupported(document: vscode.TextDocument, node: SyntaxNode): boolean {
        const startOffset = document.offsetAt(node.range.start);
        if (startOffset <= 0) {
            return true;
        }

        const previousCharacter = document.getText(new vscode.Range(
            document.positionAt(startOffset - 1),
            document.positionAt(startOffset)
        ));

        return /[\s([{\[;,:=]/.test(previousCharacter);
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

    private matchesQualifier(target: ResolvedScopedInheritTarget, qualifier: string): boolean {
        return this.stripSourceExtension(this.normalizeFsPath(vscode.Uri.parse(target.resolvedUri).fsPath)) === qualifier;
    }

    private getMethodKey(method: ScopedDiscoveredMethod): string {
        const range = method.declarationRange;
        return `${method.path}:${range.start.line}:${range.start.character}:${range.end.line}:${range.end.character}`;
    }

    private rangeTouchesPosition(range: vscode.Range, position: vscode.Position): boolean {
        return range.contains(position) || range.end.isEqual(position);
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
