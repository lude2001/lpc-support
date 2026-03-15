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
        if (closing && range.start.line > opener.line && range.end.line < closing.line) {
            return true;
        }
    }

    return false;
}

export interface DelimitedTextBlockMask {
    placeholder: string;
    original: string;
    syntacticSuffix: string;
    trailingCommentSuffix: string;
}

export function maskDelimitedTextBlocks(text: string): { maskedText: string; blocks: DelimitedTextBlockMask[] } {
    const lines = text.split(/\r?\n/);
    const blocks: DelimitedTextBlockMask[] = [];
    const lineStarts = buildLineStarts(text);
    const replacements: Array<{ start: number; end: number; replacement: string }> = [];

    for (const opener of getDelimitedTextOpeners(lines)) {
        const openerMatch = findDelimitedTextOpenerMatch(lines[opener.line], (match) => match.tag === opener.tag);
        if (!openerMatch) {
            continue;
        }

        const closing = findDelimitedTextClosing(lines, opener);
        if (!closing) {
            continue;
        }

        const suffix = lines[closing.line].slice(closing.delimiterEnd);
        const { syntacticSuffix, trailingCommentSuffix } = splitDelimitedTextClosingSuffix(suffix);
        const placeholder = `__LPC_DELIMITED_TEXT_${blocks.length}__`;
        blocks.push({
            placeholder,
            original: text.slice(
                lineStarts[opener.line] + openerMatch.index,
                lineStarts[closing.line] + closing.delimiterEnd
            ),
            syntacticSuffix,
            trailingCommentSuffix
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
        if (!shouldRestoreDelimitedTextSuffix(block)) {
            const plainPlaceholder = new RegExp(`"${block.placeholder}"`, 'g');
            return current.replace(plainPlaceholder, block.original);
        }

        const placeholderWithSuffix = new RegExp(
            `"${block.placeholder}"${toFlexibleWhitespacePattern(block.syntacticSuffix)}`,
            'g'
        );

        return current.replace(
            placeholderWithSuffix,
            `${block.original}${block.syntacticSuffix}${block.trailingCommentSuffix}`
        );
    }, text);
}

function shouldRestoreDelimitedTextSuffix(block: DelimitedTextBlockMask): boolean {
    return block.trailingCommentSuffix.length > 0
        || block.syntacticSuffix !== ''
        || /\s/.test(block.syntacticSuffix);
}

function getDelimitedTextOpeners(lines: string[]): Array<{ line: number; tag: string }> {
    const openers: Array<{ line: number; tag: string }> = [];

    for (let index = 0; index < lines.length; index += 1) {
        const openerMatch = findDelimitedTextOpenerMatch(
            lines[index],
            (match) => isDelimitedTextOpenerPrefix(lines[index].slice(0, match.index))
        );
        if (!openerMatch) {
            continue;
        }

        openers.push({ line: index, tag: openerMatch.tag });
    }

    return openers;
}

function findDelimitedTextOpenerMatch(
    line: string,
    predicate: (match: { index: number; tag: string }) => boolean = () => true
): { index: number; tag: string } | null {
    const matcher = /@\@?([A-Za-z_][A-Za-z0-9_]*)\b/g;
    let openerMatch: RegExpExecArray | null;

    while ((openerMatch = matcher.exec(line)) !== null) {
        if (openerMatch.index === undefined) {
            continue;
        }

        const match = {
            index: openerMatch.index,
            tag: openerMatch[1]
        };
        if (predicate(match)) {
            return match;
        }
    }

    return null;
}

function isDelimitedTextOpenerPrefix(prefix: string): boolean {
    const trimmedPrefix = prefix.trimEnd();
    if (!trimmedPrefix) {
        return true;
    }

    if (isCommentOnlyPrefix(trimmedPrefix)) {
        return false;
    }

    return /(?:\b(?:return|case|throw)|[=,({\[]|(?:\+\+|--|&&|\|\||<<|>>|->|[?:+\-*/%!~&|^<>]))$/.test(trimmedPrefix);
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
        if (!match || !isDelimitedTextClosingSuffix(lines[closingIndex].slice(match[0].length))) {
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

function isDelimitedTextClosingSuffix(suffix: string): boolean {
    return /^\s*(?:[)\],;}]+\s*)?(?:(?:\/\/.*)|(?:\/\*.*\*\/\s*))?$/.test(suffix);
}

function splitDelimitedTextClosingSuffix(suffix: string): {
    syntacticSuffix: string;
    trailingCommentSuffix: string;
} {
    const commentMatch = suffix.match(/(\s*(?:\/\/.*|\/\*.*\*\/\s*))$/);
    const syntacticSuffix = commentMatch && commentMatch.index !== undefined
        ? suffix.slice(0, commentMatch.index)
        : suffix;
    const trailingCommentSuffix = commentMatch ? commentMatch[1] : '';

    return {
        syntacticSuffix: trimTrailingStructuralBraces(syntacticSuffix),
        trailingCommentSuffix
    };
}

function toFlexibleWhitespacePattern(text: string): string {
    return text
        .split(/(\s+)/)
        .filter((part) => part.length > 0)
        .map((part) => /^\s+$/.test(part) ? '\\s*' : escapeRegExp(part))
        .join('');
}

function trimTrailingStructuralBraces(suffix: string): string {
    const trailingBraceMatch = suffix.match(/^(.*?[;)\],])(\s*}+\s*)$/);
    if (!trailingBraceMatch) {
        return suffix;
    }

    return trailingBraceMatch[1];
}

function isCommentOnlyPrefix(prefix: string): boolean {
    return /^\s*(?:\/\/|\/\*+|\*)/.test(prefix);
}
