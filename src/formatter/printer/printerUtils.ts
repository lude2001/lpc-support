import { normalizeLeadingCommentBlock } from '../comments/commentFormatter';
import { FormatNode } from '../model/formatNodes';
import { SyntaxKind } from '../../syntax/types';

export function normalizeInlineText(text: string): string {
    const placeholders = new Map<string, string>([
        ['__ARROW__', '->'],
        ['__SCOPE__', '::'],
        ['__ELLIPSIS__', '...'],
        ['__RANGE__', '..'],
        ['__INCREMENT__', '++'],
        ['__DECREMENT__', '--'],
        ['__PLUS_ASSIGN__', '+='],
        ['__MINUS_ASSIGN__', '-='],
        ['__STAR_ASSIGN__', '*='],
        ['__DIV_ASSIGN__', '/='],
        ['__PERCENT_ASSIGN__', '%='],
        ['__BIT_OR_ASSIGN__', '|='],
        ['__BIT_AND_ASSIGN__', '&='],
        ['__GE__', '>='],
        ['__LE__', '<='],
        ['__EQ__', '=='],
        ['__NE__', '!='],
        ['__AND__', '&&'],
        ['__OR__', '||'],
        ['__SHIFT_LEFT__', '<<'],
        ['__SHIFT_RIGHT__', '>>']
    ]);

    let normalized = text
        .replace(/\.\.\./g, ' __ELLIPSIS__ ')
        .replace(/->/g, ' __ARROW__ ')
        .replace(/::/g, ' __SCOPE__ ')
        .replace(/\+\+/g, ' __INCREMENT__ ')
        .replace(/--/g, ' __DECREMENT__ ')
        .replace(/\+=/g, ' __PLUS_ASSIGN__ ')
        .replace(/-=/g, ' __MINUS_ASSIGN__ ')
        .replace(/\*=/g, ' __STAR_ASSIGN__ ')
        .replace(/\/=/g, ' __DIV_ASSIGN__ ')
        .replace(/%=/g, ' __PERCENT_ASSIGN__ ')
        .replace(/\|=/g, ' __BIT_OR_ASSIGN__ ')
        .replace(/&=/g, ' __BIT_AND_ASSIGN__ ')
        .replace(/>=/g, ' __GE__ ')
        .replace(/<=/g, ' __LE__ ')
        .replace(/==/g, ' __EQ__ ')
        .replace(/!=/g, ' __NE__ ')
        .replace(/&&/g, ' __AND__ ')
        .replace(/\|\|/g, ' __OR__ ')
        .replace(/<</g, ' __SHIFT_LEFT__ ')
        .replace(/>>/g, ' __SHIFT_RIGHT__ ')
        .replace(/\.\./g, ' __RANGE__ ')
        .replace(/\s+/g, ' ')
        .trim();

    normalized = normalized
        .replace(/\s*,\s*/g, ', ')
        .replace(/\(\s+/g, '(')
        .replace(/\s+\)/g, ')')
        .replace(/\[\s+/g, '[')
        .replace(/\s+\]/g, ']')
        .replace(/\s*([=+\-*/%<>!&|?:])\s*/g, ' $1 ')
        .replace(/\s*;\s*/g, ';')
        .replace(/\s+/g, ' ')
        .trim();

    for (const [placeholder, token] of placeholders.entries()) {
        normalized = normalized.replace(new RegExp(placeholder, 'g'), token);
    }

    return normalized;
}

export function appendToLastLine(text: string, suffix: string): string {
    const lastNewline = text.lastIndexOf('\n');
    if (lastNewline === -1) {
        return `${text}${suffix}`;
    }

    return `${text.slice(0, lastNewline + 1)}${text.slice(lastNewline + 1)}${suffix}`;
}

export function repeatPointer(count: number): string {
    return count > 0 ? '*'.repeat(count) : '';
}

export function trimTrailingWhitespace(text: string): string {
    return text.replace(/[ \t]+$/gm, '');
}

export function ensureStatementTerminator(text: string): string {
    return text.endsWith(';') ? text : `${text};`;
}

export function prefixMultiline(prefix: string, value: string, indent: string): string {
    if (!value.includes('\n')) {
        return `${prefix}${value}`;
    }

    const [firstLine, ...rest] = value.split('\n');
    const normalizedFirstLine = firstLine.startsWith(indent)
        ? firstLine.slice(indent.length)
        : firstLine;

    return [`${prefix}${normalizedFirstLine}`, ...rest].join('\n');
}

export function trimLeadingIndent(text: string, indent: string): string {
    if (!indent || !text.startsWith(indent)) {
        return text;
    }

    return `${text.slice(indent.length)}`;
}

export function extractPreservableTrivia(trivia: readonly string[]): string[] {
    return trivia
        .map((entry) => entry.trim())
        .filter(Boolean)
        .flatMap((entry) => {
            if (/^#/.test(entry)) {
                return [entry];
            }

            if (/^\/\//.test(entry)) {
                return [entry];
            }

            if (/^\/\*/.test(entry)) {
                return [normalizeLeadingCommentBlock(entry)];
            }

            return [];
        });
}

export function hasPreservableTrivia(node: FormatNode): boolean {
    return extractPreservableTrivia(node.leadingTrivia).length > 0
        || extractPreservableTrivia(node.trailingTrivia).length > 0;
}

export function containsCommentSyntax(text: string): boolean {
    return /\/\*|\/\//.test(text);
}

export function indentTrivia(entry: string, indent: string): string {
    if (!indent || entry.startsWith('#')) {
        return entry;
    }

    return entry
        .split('\n')
        .map((line) => line.length > 0 ? `${indent}${line}` : line)
        .join('\n');
}

export function normalizeClosureBody(text: string): string {
    return text.replace(/\s*,\s*/g, ', ');
}

export function classifyBlockSpacingGroup(node: FormatNode): 'declaration' | 'control' | 'other' {
    switch (node.syntaxKind) {
        case SyntaxKind.VariableDeclaration:
            return 'declaration';
        case SyntaxKind.IfStatement:
        case SyntaxKind.SwitchStatement:
        case SyntaxKind.WhileStatement:
        case SyntaxKind.DoWhileStatement:
        case SyntaxKind.ForStatement:
        case SyntaxKind.ForeachStatement:
            return 'control';
        default:
            return 'other';
    }
}

export function shouldPreserveTerminalNewline(text: string): boolean {
    return /\r?\n$/.test(text);
}
