import * as vscode from 'vscode';
import { Symbol } from '../ast/symbolTable';
import { InheritanceResolver } from '../completion/inheritanceResolver';
import { MacroManager } from '../macroManager';
import { assertAnalysisService } from '../semantic/assertAnalysisService';
import type { DocumentAnalysisService } from '../semantic/documentAnalysisService';
import { SemanticSnapshot } from '../semantic/semanticSnapshot';
import { SyntaxKind, SyntaxNode } from '../syntax/types';
import { ObjectMethodReturnResolver } from './ObjectMethodReturnResolver';
import { ObjectResolutionOutcome, ReturnObjectResolver } from './ReturnObjectResolver';
import { assertTextDocumentHost, type TextDocumentHost } from '../language/shared/WorkspaceDocumentPathSupport';

export interface GlobalBindingResolution extends ObjectResolutionOutcome {
    hasVisibleBinding: boolean;
}

export type InheritedIdentifierResolver = (
    document: vscode.TextDocument,
    identifierName: string,
    visited: Set<string>
) => Promise<GlobalBindingResolution | undefined>;

export interface FileScopeBindingResolveOptions {
    visited?: Set<string>;
    resolveInheritedIdentifier?: InheritedIdentifierResolver;
}

export interface GlobalBindingResolveContext {
    document: vscode.TextDocument;
    snapshot: SemanticSnapshot;
    identifierName: string;
    visited: Set<string>;
    resolveInheritedIdentifier?: InheritedIdentifierResolver;
}

export class GlobalObjectBindingResolver {
    private readonly analysisService: Pick<DocumentAnalysisService, 'getSemanticSnapshot'>;
    private readonly inheritanceResolver: InheritanceResolver;
    private readonly host: Pick<TextDocumentHost, 'openTextDocument'>;

    constructor(
        private readonly returnObjectResolver: ReturnObjectResolver,
        private readonly objectMethodReturnResolver: ObjectMethodReturnResolver,
        macroManager?: MacroManager,
        analysisService?: Pick<DocumentAnalysisService, 'getSemanticSnapshot'>,
        host?: Pick<TextDocumentHost, 'openTextDocument'>
    ) {
        this.analysisService = assertAnalysisService('GlobalObjectBindingResolver', analysisService);
        this.inheritanceResolver = new InheritanceResolver(macroManager);
        this.host = assertTextDocumentHost('GlobalObjectBindingResolver', host as TextDocumentHost | undefined);
    }

    public async resolveVisibleBinding(
        document: vscode.TextDocument,
        identifierName: string,
        _position: vscode.Position,
        options?: FileScopeBindingResolveOptions
    ): Promise<GlobalBindingResolution | undefined> {
        return this.resolveFileScopeBinding(document, identifierName, options);
    }

    public async resolveFileScopeBinding(
        document: vscode.TextDocument,
        identifierName: string,
        options?: FileScopeBindingResolveOptions
    ): Promise<GlobalBindingResolution | undefined> {
        const snapshot = this.analysisService.getSemanticSnapshot(document, false);
        return this.resolveNamedBindingInSnapshot({
            document,
            snapshot,
            identifierName,
            visited: options?.visited ?? new Set(),
            resolveInheritedIdentifier: options?.resolveInheritedIdentifier
        });
    }

    public async resolveNamedBindingInSnapshot(
        context: GlobalBindingResolveContext
    ): Promise<GlobalBindingResolution | undefined> {
        const globalScope = context.snapshot.symbolTable.getGlobalScope();
        const symbol = this.findGlobalScopeSymbol(context.snapshot, context.identifierName);
        if (!symbol) {
            return undefined;
        }

        if (symbol.type === 'variable' && symbol.scope === globalScope && symbol.dataType !== 'object') {
            return {
                candidates: [],
                hasVisibleBinding: true
            };
        }

        if (!this.isVisibleGlobalObjectSymbol(globalScope, symbol)) {
            return undefined;
        }

        return this.resolveGlobalBindingFromSymbol(context, symbol, context.identifierName);
    }

    private isVisibleGlobalObjectSymbol(globalScope: Symbol['scope'], symbol: Symbol): boolean {
        return symbol.type === 'variable'
            && symbol.scope === globalScope
            && symbol.dataType === 'object';
    }

    private findGlobalScopeSymbol(snapshot: SemanticSnapshot, identifierName: string): Symbol | undefined {
        return snapshot.symbolTable.getGlobalScope().symbols.get(identifierName);
    }

    private findDeclarator(
        nodes: readonly SyntaxNode[],
        symbol: Symbol,
        identifierName: string
    ): SyntaxNode | undefined {
        return nodes.find((node) =>
            node.kind === SyntaxKind.VariableDeclarator
            && node.name === identifierName
            && this.rangesEqual(node.range, symbol.range)
        );
    }

    private async resolveGlobalBindingFromSymbol(
        context: GlobalBindingResolveContext,
        symbol: Symbol,
        identifierName: string
    ): Promise<GlobalBindingResolution> {
        const visitKey = this.getVisitKey(context.document, symbol, identifierName);
        if (context.visited.has(visitKey)) {
            return {
                candidates: [],
                hasVisibleBinding: true
            };
        }

        context.visited.add(visitKey);

        const declarator = this.findDeclarator(context.snapshot.syntax.nodes, symbol, identifierName);
        if (!declarator) {
            return {
                candidates: [],
                hasVisibleBinding: true
            };
        }

        const initializer = declarator.children[1];
        if (!initializer) {
            return {
                candidates: [],
                hasVisibleBinding: true
            };
        }

        const unwrappedInitializer = this.unwrapParenthesizedExpression(initializer);
        if (unwrappedInitializer.kind === SyntaxKind.Identifier && unwrappedInitializer.name) {
            const sameFileBinding = await this.resolveNamedBindingInSnapshot({
                ...context,
                identifierName: unwrappedInitializer.name
            });
            if (sameFileBinding) {
                return sameFileBinding;
            }

            if (context.resolveInheritedIdentifier) {
                const inheritedBinding = await context.resolveInheritedIdentifier(
                    context.document,
                    unwrappedInitializer.name,
                    context.visited
                );
                if (inheritedBinding) {
                    return inheritedBinding;
                }

                if (await this.hasInheritedVisibleBinding(context.document, unwrappedInitializer.name)) {
                    return {
                        candidates: [],
                        hasVisibleBinding: true
                    };
                }
            }
        }

        const methodInitializerOutcome = await this.resolveMemberMethodInitializer(
            context,
            unwrappedInitializer
        );
        if (methodInitializerOutcome) {
            return {
                ...methodInitializerOutcome,
                hasVisibleBinding: true
            };
        }

        const outcome = await this.returnObjectResolver.resolveExpressionOutcome(context.document, unwrappedInitializer);
        return {
            ...outcome,
            hasVisibleBinding: true
        };
    }

    private unwrapParenthesizedExpression(node: SyntaxNode): SyntaxNode {
        if (node.kind === SyntaxKind.ParenthesizedExpression && node.children[0]) {
            return this.unwrapParenthesizedExpression(node.children[0]);
        }

        return node;
    }

    private async resolveMemberMethodInitializer(
        context: GlobalBindingResolveContext,
        initializer: SyntaxNode
    ): Promise<ObjectResolutionOutcome | undefined> {
        if (initializer.kind !== SyntaxKind.CallExpression) {
            return undefined;
        }

        const callee = initializer.children[0];
        if (
            callee?.kind !== SyntaxKind.MemberAccessExpression
            || callee.metadata?.operator !== '->'
            || callee.children[0] === undefined
            || callee.children[1]?.kind !== SyntaxKind.Identifier
            || !callee.children[1].name
        ) {
            return undefined;
        }

        const receiverOutcome = await this.resolveMethodReceiverOutcome(
            context,
            callee.children[0]
        );
        if (receiverOutcome.candidates.length === 0) {
            return receiverOutcome.reason || receiverOutcome.diagnostics?.length
                ? receiverOutcome
                : { candidates: [] };
        }

        return this.objectMethodReturnResolver.resolveMethodReturnOutcome(
            context.document,
            receiverOutcome.candidates,
            callee.children[1].name
        );
    }

    private async resolveMethodReceiverOutcome(
        context: GlobalBindingResolveContext,
        receiver: SyntaxNode
    ): Promise<ObjectResolutionOutcome> {
        const unwrappedReceiver = this.unwrapParenthesizedExpression(receiver);
        if (unwrappedReceiver.kind === SyntaxKind.Identifier && unwrappedReceiver.name) {
            const sameFileBinding = await this.resolveNamedBindingInSnapshot({
                ...context,
                identifierName: unwrappedReceiver.name
            });
            if (sameFileBinding) {
                return {
                    candidates: sameFileBinding.candidates,
                    reason: sameFileBinding.reason,
                    diagnostics: sameFileBinding.diagnostics
                };
            }

            if (context.resolveInheritedIdentifier) {
                const inheritedBinding = await context.resolveInheritedIdentifier(
                    context.document,
                    unwrappedReceiver.name,
                    context.visited
                );
                if (inheritedBinding) {
                    return {
                        candidates: inheritedBinding.candidates,
                        reason: inheritedBinding.reason,
                        diagnostics: inheritedBinding.diagnostics
                    };
                }

                if (await this.hasInheritedVisibleBinding(context.document, unwrappedReceiver.name)) {
                    return { candidates: [] };
                }
            }
        }

        return this.returnObjectResolver.resolveExpressionOutcome(context.document, unwrappedReceiver);
    }

    private async hasInheritedVisibleBinding(
        document: vscode.TextDocument,
        identifierName: string,
        visitedUris: Set<string> = new Set([document.uri.toString()])
    ): Promise<boolean> {
        const snapshot = this.analysisService.getSemanticSnapshot(document, false);
        const resolvedTargets = this.inheritanceResolver.resolveInheritTargets(snapshot);

        for (const target of resolvedTargets) {
            if (!target.resolvedUri || visitedUris.has(target.resolvedUri)) {
                continue;
            }

            const branchVisitedUris = new Set(visitedUris);
            branchVisitedUris.add(target.resolvedUri);

            try {
                const parentDocument = await this.host.openTextDocument(
                    this.toWorkspaceFilePath(target.resolvedUri)
                );
                const parentSnapshot = this.analysisService.getSemanticSnapshot(parentDocument, false);
                const parentSymbol = this.findGlobalScopeSymbol(parentSnapshot, identifierName);
                const globalScope = parentSnapshot.symbolTable.getGlobalScope();
                if (
                    parentSymbol
                    && parentSymbol.type === 'variable'
                    && parentSymbol.scope === globalScope
                ) {
                    return true;
                }

                if (await this.hasInheritedVisibleBinding(parentDocument, identifierName, branchVisitedUris)) {
                    return true;
                }
            } catch {
                continue;
            }
        }

        return false;
    }

    private toWorkspaceFilePath(uri: string): string {
        return vscode.Uri.parse(uri).fsPath.replace(/^[/\\]+([A-Za-z]:[\\/])/, '$1');
    }

    private getVisitKey(document: vscode.TextDocument, symbol: Symbol, identifierName: string): string {
        return `${document.uri.toString()}:${identifierName}:${symbol.range.start.line}:${symbol.range.start.character}:${symbol.range.end.line}:${symbol.range.end.character}`;
    }

    private rangesEqual(left: vscode.Range, right: vscode.Range): boolean {
        return left.start.isEqual(right.start) && left.end.isEqual(right.end);
    }
}
