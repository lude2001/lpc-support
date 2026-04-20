import * as vscode from 'vscode';
import type { FunctionSummary } from '../../semantic/documentSemanticTypes';
import type { DocumentAnalysisService } from '../../semantic/documentAnalysisService';
import type { SemanticSnapshot } from '../../semantic/semanticSnapshot';
import { SyntaxDocument, SyntaxKind, SyntaxNode } from '../../syntax/types';
import {
    WorkspaceDocumentPathSupport,
    assertDocumentPathSupport
} from '../../language/shared/WorkspaceDocumentPathSupport';

export interface ResolvedCallTarget {
    document: vscode.TextDocument;
    syntax: SyntaxDocument;
    semantic: SemanticSnapshot;
    functionNode: SyntaxNode;
    functionSummary: FunctionSummary;
}

export interface CallTargetResolverOptions {
    analysisService?: Pick<DocumentAnalysisService, 'getSyntaxDocument' | 'getSemanticSnapshot'>;
    pathSupport?: WorkspaceDocumentPathSupport;
}

function getDirectCalleeName(callExpression: SyntaxNode): string | undefined {
    const callee = callExpression.children[0];
    if (callee?.kind === SyntaxKind.Identifier && callee.name) {
        return callee.name;
    }

    return typeof callExpression.name === 'string'
        ? callExpression.name
        : undefined;
}

function getLiteralDirectiveValue(node: SyntaxNode | undefined): string | undefined {
    if (!node) {
        return undefined;
    }

    if (node.kind === SyntaxKind.Literal) {
        const text = node.metadata?.text;
        if (typeof text !== 'string') {
            return undefined;
        }

        if (
            (text.startsWith('"') && text.endsWith('"'))
            || (text.startsWith('<') && text.endsWith('>'))
        ) {
            return text.slice(1, -1);
        }

        return text;
    }

    if (node.kind === SyntaxKind.Identifier && node.name) {
        return node.name;
    }

    return undefined;
}

function collectIncludeSpecs(
    document: vscode.TextDocument,
    syntax: SyntaxDocument,
    semantic: SemanticSnapshot
): Array<{ value: string; isSystemInclude: boolean }> {
    if (semantic.includeStatements.length > 0) {
        return semantic.includeStatements.map((statement) => ({
            value: statement.value,
            isSystemInclude: statement.isSystemInclude
        }));
    }

    const syntaxFallback = syntax.root.children
        .filter((child) => child.kind === SyntaxKind.IncludeDirective)
        .map((child) => ({
            value: getLiteralDirectiveValue(child.children[0]) ?? '',
            isSystemInclude: false
        }))
        .filter((entry) => entry.value.length > 0);
    if (syntaxFallback.length > 0) {
        return syntaxFallback;
    }

    const textFallback = document.getText()
        .split(/\r?\n/)
        .map((line) => {
            const match = line.match(/^\s*#include\s+([<"])([^>"]+)[>"]/);
            if (!match) {
                return undefined;
            }

            return {
                value: match[2],
                isSystemInclude: match[1] === '<'
            };
        })
        .filter((entry): entry is { value: string; isSystemInclude: boolean } => Boolean(entry));

    return textFallback;
}

function collectInheritValues(
    syntax: SyntaxDocument,
    semantic: SemanticSnapshot
): string[] {
    if (semantic.inheritStatements.length > 0) {
        return semantic.inheritStatements.map((statement) => statement.value);
    }

    return syntax.root.children
        .filter((child) => child.kind === SyntaxKind.InheritDirective)
        .map((child) => getLiteralDirectiveValue(child.children[0]) ?? '')
        .filter((entry) => entry.length > 0);
}

export class CallTargetResolver {
    private readonly analysisService: Pick<DocumentAnalysisService, 'getSyntaxDocument' | 'getSemanticSnapshot'>;
    private readonly pathSupport: WorkspaceDocumentPathSupport;

    public constructor(options: CallTargetResolverOptions) {
        if (!options.analysisService) {
            throw new Error('CallTargetResolver requires an injected analysis service');
        }

        this.analysisService = options.analysisService;
        this.pathSupport = assertDocumentPathSupport('CallTargetResolver', options.pathSupport);
    }

    public async resolveCallTarget(
        document: vscode.TextDocument,
        callExpression: SyntaxNode
    ): Promise<ResolvedCallTarget | undefined> {
        const functionName = getDirectCalleeName(callExpression);
        if (!functionName) {
            return undefined;
        }

        return this.resolveFunctionTarget(document, functionName, new Set<string>());
    }

    private async resolveFunctionTarget(
        document: vscode.TextDocument,
        functionName: string,
        visitedDocuments: Set<string>
    ): Promise<ResolvedCallTarget | undefined> {
        const documentKey = document.uri.toString();
        if (visitedDocuments.has(documentKey)) {
            return undefined;
        }

        visitedDocuments.add(documentKey);

        const directTarget = this.resolveInDocument(document, functionName);
        if (directTarget) {
            return directTarget;
        }

        const workspaceRoot = this.pathSupport.getWorkspaceFolderRoot(document);
        const syntax = this.analysisService.getSyntaxDocument(document, false);
        if (!syntax) {
            return undefined;
        }

        const semantic = this.analysisService.getSemanticSnapshot(document, false);

        for (const includeStatement of collectIncludeSpecs(document, syntax, semantic)) {
            const includeFiles = await this.pathSupport.resolveIncludeFilePaths(
                document,
                includeStatement.value,
                includeStatement.isSystemInclude,
                workspaceRoot
            );

            for (const includeFile of includeFiles) {
                if (!this.pathSupport.fileExists(includeFile)) {
                    continue;
                }

                const includeDocument = await this.pathSupport.tryOpenTextDocument(includeFile);
                if (!includeDocument) {
                    continue;
                }

                const includeTarget = await this.resolveFunctionTarget(
                    includeDocument,
                    functionName,
                    visitedDocuments
                );
                if (includeTarget) {
                    return includeTarget;
                }
            }
        }

        for (const inheritValue of collectInheritValues(syntax, semantic)) {
            const inheritedFile = this.pathSupport.resolveInheritedFilePath(
                document,
                inheritValue,
                workspaceRoot
            );
            if (!inheritedFile || !this.pathSupport.fileExists(inheritedFile)) {
                continue;
            }

            const inheritedDocument = await this.pathSupport.tryOpenTextDocument(inheritedFile);
            if (!inheritedDocument) {
                continue;
            }

            const inheritedTarget = await this.resolveFunctionTarget(
                inheritedDocument,
                functionName,
                visitedDocuments
            );
            if (inheritedTarget) {
                return inheritedTarget;
            }
        }

        return undefined;
    }

    private resolveInDocument(
        document: vscode.TextDocument,
        functionName: string
    ): ResolvedCallTarget | undefined {
        const syntax = this.analysisService.getSyntaxDocument(document, false);
        if (!syntax) {
            return undefined;
        }

        const semantic = this.analysisService.getSemanticSnapshot(document, false);
        const functionSummary = semantic.exportedFunctions.find((entry) => entry.name === functionName);
        if (!functionSummary) {
            return undefined;
        }

        const candidateNodes = syntax.nodes.filter(
            (node) => node.kind === SyntaxKind.FunctionDeclaration
                && node.name === functionName
        );
        const functionNode = candidateNodes.find((node) =>
            node.children.some((child) => child.kind === SyntaxKind.Block)
        );
        if (!functionNode) {
            return undefined;
        }

        return {
            document,
            syntax,
            semantic,
            functionNode,
            functionSummary
        };
    }
}
