import * as vscode from 'vscode';
import { ASTManager } from './ast/astManager';
import { SyntaxKind, SyntaxNode } from './syntax/types';

/**
 * LPC 折叠提供程序
 * 支持注释块、函数、结构体等代码块的折叠
 */
export class LPCFoldingRangeProvider implements vscode.FoldingRangeProvider {
    private readonly astManager = ASTManager.getInstance();

    provideFoldingRanges(
        document: vscode.TextDocument,
        _context: vscode.FoldingContext,
        _token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.FoldingRange[]> {
        const foldingRanges: vscode.FoldingRange[] = [];
        const seen = new Set<string>();
        const syntax = this.astManager.getSyntaxDocument(document);

        if (!syntax) {
            return foldingRanges;
        }

        this.collectTriviaFolding(syntax.parsed.tokenTriviaIndex.getAllTrivia(), foldingRanges, seen);
        this.collectSyntaxFolding(syntax.root, foldingRanges, seen);

        return foldingRanges;
    }

    private collectTriviaFolding(
        triviaItems: ReadonlyArray<{ kind: string; range: vscode.Range }>,
        ranges: vscode.FoldingRange[],
        seen: Set<string>
    ): void {
        for (const trivia of triviaItems) {
            if (trivia.kind !== 'block-comment' && trivia.kind !== 'directive') {
                continue;
            }

            this.pushRange(ranges, seen, trivia.range, trivia.kind === 'block-comment'
                ? vscode.FoldingRangeKind.Comment
                : vscode.FoldingRangeKind.Region);
        }
    }

    private collectSyntaxFolding(node: SyntaxNode, ranges: vscode.FoldingRange[], seen: Set<string>): void {
        if (this.isFoldableNode(node.kind)) {
            this.pushRange(ranges, seen, node.range, vscode.FoldingRangeKind.Region);
        }

        for (const child of node.children) {
            this.collectSyntaxFolding(child, ranges, seen);
        }
    }

    private isFoldableNode(kind: SyntaxKind): boolean {
        return kind === SyntaxKind.FunctionDeclaration
            || kind === SyntaxKind.StructDeclaration
            || kind === SyntaxKind.ClassDeclaration
            || kind === SyntaxKind.Block
            || kind === SyntaxKind.IfStatement
            || kind === SyntaxKind.ForStatement
            || kind === SyntaxKind.ForeachStatement
            || kind === SyntaxKind.WhileStatement
            || kind === SyntaxKind.DoWhileStatement
            || kind === SyntaxKind.SwitchStatement;
    }

    private pushRange(
        ranges: vscode.FoldingRange[],
        seen: Set<string>,
        range: vscode.Range,
        kind: vscode.FoldingRangeKind
    ): void {
        if (range.end.line <= range.start.line) {
            return;
        }

        const key = `${range.start.line}:${range.end.line}:${kind}`;
        if (seen.has(key)) {
            return;
        }

        seen.add(key);
        ranges.push(new vscode.FoldingRange(range.start.line, range.end.line, kind));
    }
}
