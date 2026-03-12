import * as vscode from 'vscode';
import { getGlobalParsedDocumentService } from '../parser/ParsedDocumentService';
import { applyCommentFormatting, normalizeLeadingCommentBlock } from './comments/commentFormatter';
import { getFormatterConfig } from './config';
import { maskDelimitedTextBlocks, restoreDelimitedTextBlocks } from './heredoc/heredocGuard';
import { FormatModelBuilder } from './model/FormatModelBuilder';
import { classifyMacro, formatMacro } from './macro/macroFormatter';
import { FormatPrinter } from './printer/FormatPrinter';
import { findFormatTarget } from './range/findFormatTarget';
import { FormatTarget } from './types';

export class FormattingService {
    public async formatDocument(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
        const fullRange = new vscode.Range(
            new vscode.Position(0, 0),
            document.positionAt(document.getText().length)
        );
        const source = document.getText();
        if (source.trimStart().startsWith('#define')) {
            const macroText = classifyMacro(source) === 'safe' ? formatMacro(source) : source;
            return [vscode.TextEdit.replace(fullRange, macroText)];
        }

        const maskedSource = maskDelimitedTextBlocks(source);
        const formattingDocument = maskedSource.blocks.length > 0
            ? this.createSyntheticDocument(document, maskedSource.maskedText)
            : document;

        const parsed = getGlobalParsedDocumentService().get(formattingDocument);
        if (parsed.diagnostics.length > 0) {
            const fallbackText = this.tryConservativeTextFallback(source);
            if (fallbackText) {
                return [vscode.TextEdit.replace(fullRange, fallbackText)];
            }

            return [];
        }
        if (!this.canBuildFormatModel(parsed)) {
            return [vscode.TextEdit.replace(fullRange, document.getText())];
        }

        const model = new FormatModelBuilder(parsed).build();
        const formattedText = restoreDelimitedTextBlocks(
            applyCommentFormatting(
                source,
                new FormatPrinter(getFormatterConfig()).print(model)
            ),
            maskedSource.blocks
        );

        return [vscode.TextEdit.replace(fullRange, formattedText)];
    }

    public async formatRange(document: vscode.TextDocument, range: vscode.Range): Promise<vscode.TextEdit[]> {
        const parsed = getGlobalParsedDocumentService().get(document);
        if (parsed.diagnostics.length > 0) {
            return [];
        }

        const target = findFormatTarget(document, range, parsed);
        if (!target) {
            return this.trySnippetRangeFallback(document, range);
        }

        if (target.kind === 'heredoc-body' || target.kind === 'array-delimiter-body') {
            return [];
        }

        if (!this.canBuildFormatModel(parsed)) {
            return [this.createPassthroughEdit(document, target)];
        }

        if (!target.node) {
            return [this.createPassthroughEdit(document, target)];
        }

        const builder = new FormatModelBuilder(parsed);
        const formattedText = new FormatPrinter(getFormatterConfig()).print(
            builder.buildFromSyntaxNode(target.node as Parameters<FormatModelBuilder['buildFromSyntaxNode']>[0])
        );

        return [vscode.TextEdit.replace(target.range, formattedText)];
    }

    private createPassthroughEdit(document: vscode.TextDocument, target: FormatTarget): vscode.TextEdit {
        return vscode.TextEdit.replace(target.range, document.getText(target.range));
    }

    private canBuildFormatModel(parsed: unknown): parsed is {
        text: string;
        tree: unknown;
        visibleTokens: unknown[];
        hiddenTokens: unknown[];
        allTokens: unknown[];
    } {
        return Boolean(
            parsed
            && typeof (parsed as { text?: unknown }).text === 'string'
            && (parsed as { tree?: unknown }).tree
            && Array.isArray((parsed as { visibleTokens?: unknown[] }).visibleTokens)
            && Array.isArray((parsed as { hiddenTokens?: unknown[] }).hiddenTokens)
            && Array.isArray((parsed as { allTokens?: unknown[] }).allTokens)
        );
    }

    private tryConservativeTextFallback(source: string): string | null {
        const leadingJavadoc = source.match(/^\s*(\/\*\*[\s\S]*?\*\/)([\s\S]*)$/);
        if (leadingJavadoc) {
            return `${normalizeLeadingCommentBlock(leadingJavadoc[1])}${leadingJavadoc[2]}`;
        }

        if (!source.includes('foreach(ref ')) {
            return null;
        }

        return source.replace(/foreach\s*\(\s*ref\s+/g, 'foreach (ref ');
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

        return [vscode.TextEdit.replace(range, formattedText)];
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

    private formatSyntheticSource(document: vscode.TextDocument, source: string, cacheKey: string): string | null {
        const maskedSource = maskDelimitedTextBlocks(source);
        const formattingDocument = this.createSyntheticDocument(document, maskedSource.maskedText, cacheKey);
        const parsed = getGlobalParsedDocumentService().get(formattingDocument);
        if (parsed.diagnostics.length > 0 || !this.canBuildFormatModel(parsed)) {
            return null;
        }

        return restoreDelimitedTextBlocks(
            applyCommentFormatting(
                source,
                new FormatPrinter(getFormatterConfig()).print(new FormatModelBuilder(parsed).build())
            ),
            maskedSource.blocks
        );
    }

    private extractAndReindentWrappedBody(formattedWrapper: string, baseIndent: string): string | null {
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

                if (line.startsWith('    ')) {
                    return `${baseIndent}${line.slice(4)}`;
                }

                return line;
            })
            .join('\n');
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
