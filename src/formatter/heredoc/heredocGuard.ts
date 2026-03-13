import * as vscode from 'vscode';

export function containsDelimitedTextBlock(text: string): boolean {
    return getDelimitedTextOpeners(text.split(/\r?\n/)).length > 0;
}

export function guardDelimitedTextBlock(text: string): string {
    const lines = text.split(/\r?\n/);
    const normalized = [...lines];

    for (const opener of getDelimitedTextOpeners(lines)) {
        const closing = findDelimitedTextClosing(lines, opener);
        if (closing) {
            normalized[closing.line] = lines[closing.line].trim();
        }
    }

    return normalized.join('\n');
}

export function detectDelimitedTextBodyRange(document: vscode.TextDocument, range: vscode.Range): boolean {
    const lines = document.getText().split(/\r?\n/);

    for (const opener of getDelimitedTextOpeners(lines)) {
        const closing = findDelimitedTextClosing(lines, opener);
        if (closing) {
            return range.start.line > opener.line && range.end.line < closing.line;
        }
    }

    return false;
}

export interface DelimitedTextBlockMask {
    placeholder: string;
    original: string;
    trailingWhitespace: string;
}

export function maskDelimitedTextBlocks(text: string): { maskedText: string; blocks: DelimitedTextBlockMask[] } {
    const lines = text.split(/\r?\n/);
    const blocks: DelimitedTextBlockMask[] = [];
    const lineStarts = buildLineStarts(text);
    const replacements: Array<{ start: number; end: number; replacement: string }> = [];

    for (const opener of getDelimitedTextOpeners(lines)) {
        const openerMatch = lines[opener.line].match(/@\@?[A-Za-z_][A-Za-z0-9_]*\b/);
        if (!openerMatch || openerMatch.index === undefined) {
            continue;
        }

        const closing = findDelimitedTextClosing(lines, opener);
        if (!closing) {
            continue;
        }

        const placeholder = `__LPC_DELIMITED_TEXT_${blocks.length}__`;
        blocks.push({
            placeholder,
            original: text.slice(
                lineStarts[opener.line] + openerMatch.index,
                lineStarts[closing.line] + closing.delimiterEnd
            ),
            trailingWhitespace: lines[closing.line].slice(closing.delimiterEnd).match(/^\s+/)?.[0] ?? ''
        });
        replacements.push({
            start: lineStarts[opener.line] + openerMatch.index,
            end: lineStarts[closing.line] + closing.delimiterEnd,
            replacement: `"${placeholder}"`
        });
    }

    let maskedText = text;
    for (const replacement of replacements.sort((left, right) => right.start - left.start)) {
        maskedText = `${maskedText.slice(0, replacement.start)}${replacement.replacement}${maskedText.slice(replacement.end)}`;
    }

    return {
        maskedText,
        blocks
    };
}

export function restoreDelimitedTextBlocks(text: string, blocks: DelimitedTextBlockMask[]): string {
    return blocks.reduce((current, block) => {
        const guardedPlaceholder = new RegExp(`"${block.placeholder}"(?=\\S)`, 'g');
        const plainPlaceholder = new RegExp(`"${block.placeholder}"`, 'g');

        return current
            .replace(guardedPlaceholder, `${block.original}${block.trailingWhitespace}`)
            .replace(plainPlaceholder, block.original);
    }, text);
}

function getDelimitedTextOpeners(lines: string[]): Array<{ line: number; tag: string }> {
    const openers: Array<{ line: number; tag: string }> = [];

    for (let index = 0; index < lines.length; index += 1) {
        const matcher = /@\@?([A-Za-z_][A-Za-z0-9_]*)\b/g;
        let openerMatch: RegExpExecArray | null;

        while ((openerMatch = matcher.exec(lines[index])) !== null) {
            if (isDelimitedTextOpenerPrefix(lines[index].slice(0, openerMatch.index))) {
                openers.push({ line: index, tag: openerMatch[1] });
                break;
            }
        }
    }

    return openers;
}

function isDelimitedTextOpenerPrefix(prefix: string): boolean {
    const trimmedPrefix = prefix.trimEnd();
    if (!trimmedPrefix) {
        return true;
    }

    return /(?:[=,(\[?:]|\breturn)$/.test(trimmedPrefix);
}

function buildLineStarts(text: string): number[] {
    const starts = [0];

    for (let index = 0; index < text.length; index += 1) {
        if (text[index] === '\n') {
            starts.push(index + 1);
        }
    }

    return starts;
}

function findDelimitedTextClosing(
    lines: string[],
    opener: { line: number; tag: string }
): { line: number; delimiterEnd: number } | undefined {
    const matcher = new RegExp(`^\\s*${escapeRegExp(opener.tag)}\\b`);

    for (let closingIndex = opener.line + 1; closingIndex < lines.length; closingIndex += 1) {
        const match = lines[closingIndex].match(matcher);
        if (!match) {
            continue;
        }

        return {
            line: closingIndex,
            delimiterEnd: match[0].length
        };
    }

    return undefined;
}

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
