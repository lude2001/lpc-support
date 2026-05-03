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
import { FormatTarget } from './types';

export class FormattingService {
    public async formatDocument(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
        const source = document.getText();
        const lineEnding = this.detectLineEnding(source);
        if (this.isStandaloneDefineMacro(source)) {
            const macroText = classifyMacro(source) === 'safe' ? formatMacro(source) : source;
            return this.replaceWholeDocument(document, this.normalizeLineEndings(macroText, lineEnding));
        }

        const maskedSource = maskDelimitedTextBlocks(source);
        const formattingDocument = maskedSource.blocks.length > 0
            ? this.createSyntheticDocument(document, maskedSource.maskedText)
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

        const formattedText = this.normalizeLineEndings(
            restoreDelimitedTextBlocks(
                this.renderFormattedSource(source, parsed),
                maskedSource.blocks
            ),
            lineEnding
        );

        return this.replaceWholeDocument(document, formattedText);
    }

    public async formatRange(document: vscode.TextDocument, range: vscode.Range): Promise<vscode.TextEdit[]> {
        const lineEnding = this.detectLineEnding(document.getText());
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
                return [vscode.TextEdit.replace(target.range, this.normalizeLineEndings(formattedTarget, lineEnding))];
            }

            return [this.createPassthroughEdit(document, target)];
        }

        const formattedText = this.normalizeLineEndings(
            this.reindentRangeReplacement(
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
        const snippet = this.prepareSnippetRange(document, range);
        if (!snippet) {
            return [];
        }

        const wrappedSnippet = this.wrapSnippetInSyntheticBlock(snippet.dedentedText);
        const formattedWrapper = this.formatSyntheticSource(
            document,
            wrappedSnippet,
            `range-${range.start.line}-${range.start.character}-${range.end.line}-${range.end.character}`
        );
        if (!formattedWrapper) {
            return [];
        }

        const formattedText = this.extractAndReindentWrappedBody(formattedWrapper, snippet.baseIndent);
        if (formattedText === null) {
            return [];
        }

        return [vscode.TextEdit.replace(range, this.normalizeLineEndings(formattedText, this.detectLineEnding(document.getText())))];
    }

    private getParsedForFormatting(
        document: vscode.TextDocument,
        source: string,
        cacheKey: string
    ): ReturnType<ReturnType<typeof getGlobalParsedDocumentService>['get']> {
        const parsed = getGlobalParsedDocumentService().get(document);
        if (!hasBlockingDiagnostics(parsed)) {
            return parsed;
        }

        const recoveredParsed = this.tryRecoverForeachRefParsed(document, source, getBlockingDiagnostics(parsed), cacheKey);
        return recoveredParsed ?? parsed;
    }

    private prepareSnippetRange(
        document: vscode.TextDocument,
        range: vscode.Range
    ): { dedentedText: string; baseIndent: string } | null {
        const text = document.getText(range);
        if (!text.trim()) {
            return null;
        }

        const lines = text.split(/\r?\n/);
        const firstNonEmptyLine = lines.find((line) => line.trim().length > 0);
        if (!firstNonEmptyLine) {
            return null;
        }

        const baseIndent = firstNonEmptyLine.match(/^[ \t]*/)?.[0] ?? '';
        const dedentedText = lines
            .map((line) => line.startsWith(baseIndent) ? line.slice(baseIndent.length) : line)
            .join('\n')
            .trim();

        return dedentedText ? { dedentedText, baseIndent } : null;
    }

    private wrapSnippetInSyntheticBlock(text: string): string {
        return `void __lpc_range_wrapper__()\n{\n${text}\n}`;
    }

    private tryFormatDelimitedTarget(document: vscode.TextDocument, target: FormatTarget, source: string): string | null {
        const baseCacheKey = `range-target-${target.range.start.line}-${target.range.start.character}-${target.range.end.line}-${target.range.end.character}`;
        const directFormat = this.formatSyntheticSource(document, source, `${baseCacheKey}-direct`);
        if (directFormat) {
            return directFormat;
        }

        const wrappedFormat = this.formatSyntheticSource(
            document,
            this.wrapSnippetInSyntheticBlock(source),
            `${baseCacheKey}-wrapped`
        );
        if (!wrappedFormat) {
            return null;
        }

        return this.extractAndReindentWrappedBody(wrappedFormat, '');
    }

    private formatSyntheticSource(document: vscode.TextDocument, source: string, cacheKey: string): string | null {
        const maskedSource = maskDelimitedTextBlocks(source);
        const formattingDocument = this.createSyntheticDocument(document, maskedSource.maskedText, cacheKey);
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

    private extractAndReindentWrappedBody(formattedWrapper: string, baseIndent: string): string | null {
        const syntheticIndent = ' '.repeat(getFormatterConfig().indentSize);
        const bodyStart = formattedWrapper.indexOf('{\n');
        const bodyEnd = formattedWrapper.lastIndexOf('\n}');
        if (bodyStart < 0 || bodyEnd < 0 || bodyEnd <= bodyStart + 2) {
            return null;
        }

        return formattedWrapper
            .slice(bodyStart + 2, bodyEnd)
            .split('\n')
            .map((line) => {
                if (!line.length) {
                    return line;
                }

                if (syntheticIndent.length > 0 && line.startsWith(syntheticIndent)) {
                    return `${baseIndent}${line.slice(syntheticIndent.length)}`;
                }

                return line;
            })
            .join('\n');
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

    private tryRecoverForeachRefParsed(
        document: vscode.TextDocument,
        source: string,
        diagnostics: ReadonlyArray<{ message: string }>,
        cacheKey: string
    ): ReturnType<ReturnType<typeof getGlobalParsedDocumentService>['get']> | null {
        if (!this.hasOnlyKnownForeachRefDiagnostics(source, diagnostics)) {
            return null;
        }

        const recoveredSource = rewriteForeachRefBindingsForParsing(source);
        if (recoveredSource === source) {
            return null;
        }

        const recoveredDocument = this.createSyntheticDocument(document, recoveredSource, `foreach-ref-${cacheKey}`);
        const recoveredParsed = getGlobalParsedDocumentService().get(recoveredDocument);
        return recoveredParsed.diagnostics.length === 0
            ? recoveredParsed
            : null;
    }

    private hasOnlyKnownForeachRefDiagnostics(
        source: string,
        diagnostics: ReadonlyArray<{ message: string }>
    ): boolean {
        return diagnostics.length > 0
            && /\bforeach\s*\(\s*ref\b/.test(source)
            && diagnostics.every((diagnostic) => (
                diagnostic.message.includes("extraneous input 'ref' expecting")
            ));
    }

    private reindentRangeReplacement(document: vscode.TextDocument, range: vscode.Range, text: string): string {
        if (!text.includes('\n')) {
            return text;
        }

        const lineIndent = document.lineAt(range.start.line).text
            .slice(0, range.start.character)
            .match(/^[ \t]*/)?.[0] ?? '';
        if (!lineIndent) {
            return text;
        }

        const [firstLine, ...restLines] = text.split('\n');
        return [
            firstLine,
            ...restLines.map((line) => line.length > 0 ? `${lineIndent}${line}` : line)
        ].join('\n');
    }

    private detectLineEnding(text: string): string {
        return text.includes('\r\n') ? '\r\n' : '\n';
    }

    private normalizeLineEndings(text: string, lineEnding: string): string {
        return text.replace(/\r\n|\r|\n/g, lineEnding);
    }

    private createSyntheticDocument(document: vscode.TextDocument, text: string, cacheKey = 'masked-document'): vscode.TextDocument {
        const lines = text.split(/\r?\n/);
        const lineStarts = [0];
        const syntheticUri = vscode.Uri.parse(`${document.uri.toString()}?lpc-format=${cacheKey}-${document.version}`);

        for (let index = 0; index < text.length; index += 1) {
            if (text[index] === '\n') {
                lineStarts.push(index + 1);
            }
        }

        const offsetAt = (position: vscode.Position): number => {
            const lineStart = lineStarts[position.line] ?? text.length;
            return Math.min(lineStart + position.character, text.length);
        };

        const positionAt = (offset: number): vscode.Position => {
            let line = 0;
            for (let index = 0; index < lineStarts.length; index += 1) {
                if (lineStarts[index] <= offset) {
                    line = index;
                } else {
                    break;
                }
            }

            return new vscode.Position(line, offset - lineStarts[line]);
        };

        return {
            ...document,
            uri: syntheticUri,
            version: document.version,
            lineCount: lines.length,
            getText: (range?: vscode.Range) => {
                if (!range) {
                    return text;
                }

                return text.slice(offsetAt(range.start), offsetAt(range.end));
            },
            positionAt,
            offsetAt
        };
    }
}

function rewriteForeachRefBindingsForParsing(source: string): string {
    let rewritten = source;
    let cursor = 0;

    while (cursor < rewritten.length) {
        const foreachIndex = rewritten.indexOf('foreach', cursor);
        if (foreachIndex === -1) {
            break;
        }

        const openParenIndex = rewritten.indexOf('(', foreachIndex);
        if (openParenIndex === -1) {
            break;
        }

        const closeParenIndex = findClosingParenIndex(rewritten, openParenIndex);
        if (closeParenIndex === -1) {
            break;
        }

        const header = rewritten.slice(openParenIndex + 1, closeParenIndex);
        const keywordMatch = header.match(/\bin\b/);
        if (!keywordMatch || keywordMatch.index === undefined) {
            cursor = closeParenIndex + 1;
            continue;
        }

        const bindings = header.slice(0, keywordMatch.index);
        const rewrittenBindings = bindings
            .split(',')
            .map((binding) => rewriteForeachBindingForParsing(binding))
            .join(',');

        if (rewrittenBindings !== bindings) {
            rewritten = `${rewritten.slice(0, openParenIndex + 1)}${rewrittenBindings}${rewritten.slice(openParenIndex + 1 + bindings.length)}`;
        }

        cursor = closeParenIndex + 1;
    }

    return rewritten;
}

function rewriteForeachBindingForParsing(binding: string): string {
    const match = binding.match(/^(\s*)ref(\s+)([A-Za-z_][A-Za-z0-9_]*)(\s*(?:\*+\s*)*)(\s+[A-Za-z_][A-Za-z0-9_]*\s*)$/);
    if (!match) {
        return binding;
    }

    const [, leadingWhitespace, whitespaceAfterRef, typeName, pointerSegment, identifierSegment] = match;
    return `${leadingWhitespace}${typeName}${whitespaceAfterRef}ref${pointerSegment}${identifierSegment}`;
}

function findClosingParenIndex(text: string, openParenIndex: number): number {
    let depth = 0;

    for (let index = openParenIndex; index < text.length; index += 1) {
        if (text[index] === '(') {
            depth += 1;
        } else if (text[index] === ')') {
            depth -= 1;
            if (depth === 0) {
                return index;
            }
        }
    }

    return -1;
}

function getBlockingDiagnostics(parsed: Pick<ParsedDocument, 'diagnostics'>): vscode.Diagnostic[] {
    return parsed.diagnostics.filter((diagnostic) => diagnostic.severity === vscode.DiagnosticSeverity.Error);
}

function hasBlockingDiagnostics(parsed: Pick<ParsedDocument, 'diagnostics'>): boolean {
    return getBlockingDiagnostics(parsed).length > 0;
}
