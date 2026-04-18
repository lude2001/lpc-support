import * as vscode from 'vscode';
import { Token } from 'antlr4ts';
import { LPCLexer } from '../../../antlr/LPCLexer';
import { SymbolType } from '../../../ast/symbolTable';
import { DocumentSemanticSnapshotService } from '../../../completion/documentSemanticSnapshotService';
import { SemanticSnapshot } from '../../../semantic/semanticSnapshot';
import { SyntaxKind, SyntaxNode } from '../../../syntax/types';
import { WorkspaceSymbolOwner } from './WorkspaceSymbolOwnerResolver';

export interface WorkspaceReferenceCandidate {
    range: vscode.Range;
    symbolName: string;
    isDeclaration: boolean;
}

export interface WorkspaceReferenceCandidateEnumeratorOptions {
    snapshotService?: DocumentSemanticSnapshotService;
}

export class WorkspaceReferenceCandidateEnumerator {
    private readonly snapshotService: DocumentSemanticSnapshotService;

    public constructor(options: WorkspaceReferenceCandidateEnumeratorOptions = {}) {
        this.snapshotService = options.snapshotService ?? DocumentSemanticSnapshotService.getInstance();
    }

    public enumerate(document: vscode.TextDocument, owner: WorkspaceSymbolOwner): WorkspaceReferenceCandidate[] {
        const snapshot = this.snapshotService.getSemanticSnapshot(document, true);
        const declarationKeys = this.collectDeclarationKeys(snapshot, owner);
        const tokenStream = snapshot.syntax.parsed.tokens;
        if (!tokenStream) {
            return [];
        }

        const candidates: WorkspaceReferenceCandidate[] = [];
        const seen = new Set<string>();
        for (const token of tokenStream.getTokens()) {
            if (!isMatchingIdentifierToken(token, owner.name)) {
                continue;
            }

            const range = new vscode.Range(
                document.positionAt(token.startIndex),
                document.positionAt(token.stopIndex + 1)
            );
            const key = `${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`;
            if (seen.has(key)) {
                continue;
            }

            seen.add(key);
            candidates.push({
                range,
                symbolName: owner.name,
                isDeclaration: declarationKeys.has(key)
            });
        }

        return candidates;
    }

    private collectDeclarationKeys(
        snapshot: SemanticSnapshot,
        owner: WorkspaceSymbolOwner
    ): Set<string> {
        const ranges = owner.kind === 'function'
            ? collectFunctionDeclarationRanges(snapshot.syntax.nodes, owner.name)
            : owner.kind === 'global'
                ? (snapshot.fileGlobals ?? [])
                    .filter((summary) => summary.name === owner.name)
                    .map((summary) => summary.selectionRange ?? summary.range)
                : snapshot.symbolTable
                    .getAllSymbols()
                    .filter((symbol) => (symbol.type === SymbolType.STRUCT || symbol.type === SymbolType.CLASS) && symbol.name === owner.name)
                    .map((symbol) => symbol.selectionRange ?? symbol.range);

        return new Set(ranges.map((range) => `${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`));
    }
}

function collectFunctionDeclarationRanges(nodes: readonly SyntaxNode[], functionName: string): vscode.Range[] {
    return nodes
        .filter((node) => node.kind === SyntaxKind.FunctionDeclaration && node.name === functionName)
        .map((node) => findIdentifierRange(node) ?? node.range);
}

function findIdentifierRange(node: SyntaxNode): vscode.Range | undefined {
    const directIdentifier = node.children.find((child) => child.kind === SyntaxKind.Identifier);
    if (directIdentifier) {
        return directIdentifier.range;
    }

    for (const child of node.children) {
        const nestedIdentifier = findIdentifierRange(child);
        if (nestedIdentifier) {
            return nestedIdentifier;
        }
    }

    return undefined;
}

function isMatchingIdentifierToken(token: Token, symbolName: string): boolean {
    return token.channel === LPCLexer.DEFAULT_TOKEN_CHANNEL
        && token.type === LPCLexer.Identifier
        && token.text === symbolName;
}
