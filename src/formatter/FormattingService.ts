import * as vscode from 'vscode';
import { getGlobalParsedDocumentService } from '../parser/ParsedDocumentService';
import type { ParsedDocument } from '../parser/types';
import { applyCommentFormatting } from './comments/commentFormatter';
import { getFormatterConfig } from './config';
import { containsDelimitedTextBlock, maskDelimitedTextBlocks, restoreDelimitedTextBlocks } from './heredoc/heredocGuard';
import { FormatModelBuilder } from './model/FormatModelBuilder';
import { classifyMacro, formatMacro } from './macro/macroFormatter';
import { FormatPrinter } from './printer/FormatPrinter';
import { findFormatTarget } from './range/findFormatTarget';
import {
    createSyntheticFormattingDocument,
    detectLineEnding,
    extractAndReindentWrappedBody,
    normalizeLineEndings,
    prepareSnippetRange,
    reindentRangeReplacement,
    wrapSnippetInSyntheticBlock
} from './text/formatTextSupport';
import { FormatTarget } from './types';

export class FormattingService {
    public async formatDocument(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
        const source = document.getText();
        const lineEnding = detectLineEnding(source);
        if (this.isStandaloneDefineMacro(source)) {
            const macroText = classifyMacro(source) === 'safe' ? formatMacro(source) : source;
            return this.replaceWholeDocument(document, normalizeLineEndings(macroText, lineEnding));
        }

        const maskedSource = maskDelimitedTextBlocks(source);
        const formattingDocument = maskedSource.blocks.length > 0
            ? createSyntheticFormattingDocument(document, maskedSource.maskedText)
            : document;

        const parsed = this.getParsedForFormatting(
            formattingDocument,
            maskedSource.maskedText,
            'document'
        );
        if (hasBlockingDiagnostics(parsed)) {
            return [];
        }
        if (!this.canBuildFormatModel(parsed)) {
            return this.replaceWholeDocument(document, document.getText());
        }

        const formattedText = normalizeLineEndings(
            restoreDelimitedTextBlocks(
                this.renderFormattedSource(source, parsed),
                maskedSource.blocks
            ),
            lineEnding
        );

        return this.replaceWholeDocument(document, formattedText);
    }

    public async formatRange(document: vscode.TextDocument, range: vscode.Range): Promise<vscode.TextEdit[]> {
        const lineEnding = detectLineEnding(document.getText());
        const parsed = this.getParsedForFormatting(
            document,
            document.getText(),
            `range-${range.start.line}-${range.start.character}-${range.end.line}-${range.end.character}`
        );
        if (hasBlockingDiagnostics(parsed)) {
            return [];
        }

        const target = findFormatTarget(document, range, parsed);
        if (!target) {
            return this.trySnippetRangeFallback(document, range);
        }

        if (target.kind === 'heredoc-body' || target.kind === 'array-delimiter-body') {
            return [];
        }

        if (!this.canBuildFormatModel(parsed) || !target.node) {
            return [this.createPassthroughEdit(document, target)];
        }

        const targetSource = document.getText(target.range);
        if (containsDelimitedTextBlock(targetSource)) {
            const formattedTarget = this.tryFormatDelimitedTarget(document, target, targetSource);
            if (formattedTarget) {
                return [vscode.TextEdit.replace(target.range, normalizeLineEndings(formattedTarget, lineEnding))];
            }

            return [this.createPassthroughEdit(document, target)];
        }

        const formattedText = normalizeLineEndings(
            reindentRangeReplacement(
                document,
                target.range,
                this.renderSyntaxNode(
                    parsed,
                    target.node as Parameters<FormatModelBuilder['buildFromSyntaxNode']>[0],
                    target.range
                )
            ),
            lineEnding
        );

        return [vscode.TextEdit.replace(target.range, formattedText)];
    }

    private createPassthroughEdit(document: vscode.TextDocument, target: FormatTarget): vscode.TextEdit {
        return vscode.TextEdit.replace(target.range, document.getText(target.range));
    }

    private replaceWholeDocument(document: vscode.TextDocument, text: string): vscode.TextEdit[] {
        const fullRange = new vscode.Range(
            new vscode.Position(0, 0),
            document.positionAt(document.getText().length)
        );
        return [vscode.TextEdit.replace(fullRange, text)];
    }

    private canBuildFormatModel(parsed: unknown): parsed is ParsedDocument {
        return Boolean(
            parsed
            && typeof (parsed as { text?: unknown }).text === 'string'
            && (parsed as { tree?: unknown }).tree
            && Array.isArray((parsed as { visibleTokens?: unknown[] }).visibleTokens)
            && Array.isArray((parsed as { hiddenTokens?: unknown[] }).hiddenTokens)
            && Array.isArray((parsed as { allTokens?: unknown[] }).allTokens)
        );
    }

    private async trySnippetRangeFallback(document: vscode.TextDocument, range: vscode.Range): Promise<vscode.TextEdit[]> {
        const snippet = prepareSnippetRange(document, range);
        if (!snippet) {
            return [];
        }

        const wrappedSnippet = wrapSnippetInSyntheticBlock(snippet.dedentedText);
        const formattedWrapper = this.formatSyntheticSource(
            document,
            wrappedSnippet,
            `range-${range.start.line}-${range.start.character}-${range.end.line}-${range.end.character}`
        );
        if (!formattedWrapper) {
            return [];
        }

        const formattedText = extractAndReindentWrappedBody(formattedWrapper, snippet.baseIndent);
        if (formattedText === null) {
            return [];
        }

        return [vscode.TextEdit.replace(range, normalizeLineEndings(formattedText, detectLineEnding(document.getText())))];
    }

    private getParsedForFormatting(
        document: vscode.TextDocument,
        _source: string,
        _cacheKey: string
    ): ReturnType<ReturnType<typeof getGlobalParsedDocumentService>['get']> {
        return getGlobalParsedDocumentService().get(document);
    }

    private tryFormatDelimitedTarget(document: vscode.TextDocument, target: FormatTarget, source: string): string | null {
        const baseCacheKey = `range-target-${target.range.start.line}-${target.range.start.character}-${target.range.end.line}-${target.range.end.character}`;
        const directFormat = this.formatSyntheticSource(document, source, `${baseCacheKey}-direct`);
        if (directFormat) {
            return directFormat;
        }

        const wrappedFormat = this.formatSyntheticSource(
            document,
            wrapSnippetInSyntheticBlock(source),
            `${baseCacheKey}-wrapped`
        );
        if (!wrappedFormat) {
            return null;
        }

        return extractAndReindentWrappedBody(wrappedFormat, '');
    }

    private formatSyntheticSource(document: vscode.TextDocument, source: string, cacheKey: string): string | null {
        const maskedSource = maskDelimitedTextBlocks(source);
        const formattingDocument = createSyntheticFormattingDocument(document, maskedSource.maskedText, cacheKey);
        const parsed = getGlobalParsedDocumentService().get(formattingDocument);
        if (hasBlockingDiagnostics(parsed) || !this.canBuildFormatModel(parsed)) {
            return null;
        }

        return restoreDelimitedTextBlocks(
            this.renderFormattedSource(source, parsed),
            maskedSource.blocks
        );
    }

    private renderFormattedSource(
        source: string,
        parsed: ParsedDocument
    ): string {
        return applyCommentFormatting(
            source,
            this.createPrinter().print(new FormatModelBuilder(parsed).build())
        );
    }

    private renderSyntaxNode(
        parsed: ParsedDocument,
        node: Parameters<FormatModelBuilder['buildFromSyntaxNode']>[0],
        range: vscode.Range
    ): string {
        return this.createPrinter().print(
            new FormatModelBuilder(parsed).buildFromSyntaxNode(this.limitRootTriviaToRange(node, range))
        );
    }

    private limitRootTriviaToRange<T extends {
        leadingTrivia: readonly { range: vscode.Range }[];
        trailingTrivia: readonly { range: vscode.Range }[];
    }>(node: T, range: vscode.Range): T {
        return {
            ...node,
            leadingTrivia: node.leadingTrivia.filter((trivia) => this.rangesOverlapOrTouch(trivia.range, range)),
            trailingTrivia: node.trailingTrivia.filter((trivia) => this.rangesOverlapOrTouch(trivia.range, range))
        };
    }

    private rangesOverlapOrTouch(left: vscode.Range, right: vscode.Range): boolean {
        return this.comparePositions(left.end, right.start) >= 0
            && this.comparePositions(right.end, left.start) >= 0;
    }

    private comparePositions(left: vscode.Position, right: vscode.Position): number {
        if (left.line !== right.line) {
            return left.line - right.line;
        }

        return left.character - right.character;
    }

    private createPrinter(): FormatPrinter {
        return new FormatPrinter(getFormatterConfig());
    }

    private isStandaloneDefineMacro(source: string): boolean {
        const trimmedSource = source.trim();
        if (!trimmedSource.startsWith('#define')) {
            return false;
        }

        const lines = trimmedSource.split(/\r?\n/);
        let index = 0;
        while (index < lines.length) {
            const line = lines[index];
            if (index === 0 || lines[index - 1].trimEnd().endsWith('\\')) {
                index += 1;
                continue;
            }

            return lines.slice(index).every((remainingLine) => remainingLine.trim().length === 0);
        }

        return true;
    }

}

function hasBlockingDiagnostics(parsed: Pick<ParsedDocument, 'diagnostics'>): boolean {
    return parsed.diagnostics.some((diagnostic) => diagnostic.severity === vscode.DiagnosticSeverity.Error);
}
