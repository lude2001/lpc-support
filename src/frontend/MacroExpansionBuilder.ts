import {
    MacroDefinitionFact,
    MacroExpansionRange,
    MacroReferenceFact,
    PreprocessedSourceView,
    PreprocessorSourceMapEntry
} from './types';

export class MacroExpansionBuilder {
    public expand(
        activeView: PreprocessedSourceView,
        macroReferences: MacroReferenceFact[],
        macros: MacroDefinitionFact[] = []
    ): PreprocessedSourceView {
        let text = activeView.text;
        const appliedExpansions: AppliedExpansion[] = [];
        const macroByName = buildMacroMap(macros, macroReferences);
        const protectedRanges = collectDelimitedTextRanges(text);
        const sortedReferences = [...macroReferences]
            .sort((left, right) => right.startOffset - left.startOffset);

        for (const reference of sortedReferences) {
            if (isInsideRange(reference.startOffset, protectedRanges)) {
                continue;
            }

            const macro = reference.resolved;
            if (!macro) {
                continue;
            }

            if (macro.isFunctionLike) {
                const expanded = this.tryExpandWholeLineInvocation(text, reference, macroByName);
                if (!expanded) {
                    continue;
                }

                text = `${text.slice(0, expanded.lineStartOffset)}${expanded.expandedLine}${text.slice(expanded.lineEndOffset)}`;
                appliedExpansions.push({
                    macroName: reference.name,
                    originalStartOffset: expanded.lineStartOffset,
                    originalEndOffset: expanded.lineEndOffset,
                    replacementText: expanded.expandedLine
                });
                continue;
            }

            if (isActiveIdentifierReference(text, reference)) {
                const replacement = expandObjectMacroText(macro.replacement, macroByName);
                text = `${text.slice(0, reference.startOffset)}${replacement}${text.slice(reference.endOffset)}`;
                appliedExpansions.push({
                    macroName: reference.name,
                    originalStartOffset: reference.startOffset,
                    originalEndOffset: reference.endOffset,
                    replacementText: replacement
                });
            }
        }

        const expandedRanges = buildExpansionRanges(appliedExpansions);
        return {
            text,
            sourceMap: this.buildSourceMap(activeView, expandedRanges),
            expandedRanges
        };
    }

    private tryExpandWholeLineInvocation(
        text: string,
        reference: MacroReferenceFact,
        macroByName: Map<string, MacroDefinitionFact>
    ): { lineStartOffset: number; lineEndOffset: number; expandedLine: string } | undefined {
        const macro = reference.resolved;
        if (!macro?.parameters) {
            return undefined;
        }

        const invocation = parseWholeLineMacroInvocation(text, reference);
        if (!invocation) {
            return undefined;
        }

        const lineStartOffset = findLineStart(text, reference.startOffset);
        const lineEndOffset = findLineEnd(text, reference.startOffset);
        const args = splitMacroArguments(invocation.argumentText);
        if (args.length !== macro.parameters.length) {
            return undefined;
        }

        const expandedBody = expandObjectMacroText(
            expandFunctionMacroBody(macro.replacement, macro.parameters, args),
            macroByName
        );
        return {
            lineStartOffset,
            lineEndOffset,
            expandedLine: `${invocation.indent}${expandedBody}`
        };
    }

    private buildSourceMap(
        activeView: PreprocessedSourceView,
        expandedRanges: MacroExpansionRange[]
    ): PreprocessorSourceMapEntry[] {
        if (expandedRanges.length === 0) {
            return activeView.sourceMap;
        }

        const entries: PreprocessorSourceMapEntry[] = [];
        let originalCursor = 0;
        let activeCursor = 0;

        for (const range of expandedRanges) {
            const unchangedLength = Math.max(0, range.originalStartOffset - originalCursor);
            if (unchangedLength > 0) {
                entries.push({
                    originalStartOffset: originalCursor,
                    activeStartOffset: activeCursor,
                    length: unchangedLength
                });
                activeCursor += unchangedLength;
            }

            originalCursor = Math.max(originalCursor, range.originalEndOffset);
            activeCursor = range.activeEndOffset;
        }

        const tailLength = Math.max(0, activeView.text.length - originalCursor);
        if (tailLength > 0) {
            entries.push({
                originalStartOffset: originalCursor,
                activeStartOffset: activeCursor,
                length: tailLength
            });
        }

        return entries;
    }
}

interface AppliedExpansion {
    macroName: string;
    originalStartOffset: number;
    originalEndOffset: number;
    replacementText: string;
}

function buildExpansionRanges(appliedExpansions: AppliedExpansion[]): MacroExpansionRange[] {
    const sorted = [...appliedExpansions]
        .sort((left, right) => left.originalStartOffset - right.originalStartOffset);
    const ranges: MacroExpansionRange[] = [];
    let delta = 0;
    let consumedOriginalEnd = 0;

    for (const expansion of sorted) {
        if (expansion.originalStartOffset < consumedOriginalEnd) {
            continue;
        }

        const activeStartOffset = expansion.originalStartOffset + delta;
        const activeEndOffset = activeStartOffset + expansion.replacementText.length;
        ranges.push({
            macroName: expansion.macroName,
            originalStartOffset: expansion.originalStartOffset,
            originalEndOffset: expansion.originalEndOffset,
            activeStartOffset,
            activeEndOffset
        });

        delta += expansion.replacementText.length
            - (expansion.originalEndOffset - expansion.originalStartOffset);
        consumedOriginalEnd = expansion.originalEndOffset;
    }

    return ranges;
}

function buildMacroMap(
    macros: MacroDefinitionFact[],
    macroReferences: MacroReferenceFact[]
): Map<string, MacroDefinitionFact> {
    const result = new Map<string, MacroDefinitionFact>();
    for (const macro of macros) {
        result.set(macro.name, macro);
    }
    for (const reference of macroReferences) {
        if (reference.resolved) {
            result.set(reference.resolved.name, reference.resolved);
        }
    }
    return result;
}

function expandObjectMacroText(
    text: string,
    macroByName: Map<string, MacroDefinitionFact>,
    expanding: Set<string> = new Set(),
    depth = 0
): string {
    if (depth > 64 || macroByName.size === 0) {
        return text;
    }

    return replaceCodeIdentifiers(text, (identifier) => {
        const macro = macroByName.get(identifier);
        if (!macro || macro.isFunctionLike || expanding.has(identifier)) {
            return identifier;
        }

        expanding.add(identifier);
        const replacement = expandObjectMacroText(macro.replacement, macroByName, expanding, depth + 1);
        expanding.delete(identifier);
        return replacement;
    });
}

function replaceCodeIdentifiers(text: string, replaceIdentifier: (identifier: string) => string): string {
    let result = '';
    let index = 0;

    while (index < text.length) {
        const char = text[index];
        if (char === '"' || char === '\'') {
            const end = consumeQuoted(text, index, char);
            result += text.slice(index, end);
            index = end;
            continue;
        }

        if (isIdentifierStart(char)) {
            let end = index + 1;
            while (end < text.length && isIdentifierPart(text[end])) {
                end += 1;
            }

            result += replaceIdentifier(text.slice(index, end));
            index = end;
            continue;
        }

        result += char;
        index += 1;
    }

    return result;
}

function consumeQuoted(text: string, start: number, quote: string): number {
    let index = start + 1;
    let escaped = false;

    while (index < text.length) {
        const char = text[index];
        index += 1;

        if (escaped) {
            escaped = false;
            continue;
        }

        if (char === '\\') {
            escaped = true;
            continue;
        }

        if (char === quote) {
            break;
        }
    }

    return index;
}

function isActiveIdentifierReference(text: string, reference: MacroReferenceFact): boolean {
    return text.slice(reference.startOffset, reference.endOffset) === reference.name;
}

function isIdentifierStart(char: string | undefined): boolean {
    return Boolean(char && /[A-Za-z_]/.test(char));
}

function isIdentifierPart(char: string | undefined): boolean {
    return Boolean(char && /[A-Za-z0-9_]/.test(char));
}

interface TextRange {
    start: number;
    end: number;
}

function collectDelimitedTextRanges(text: string): TextRange[] {
    const lines = text.split(/\r?\n/);
    const lineStarts = buildLineStarts(text);
    const ranges: TextRange[] = [];

    for (let line = 0; line < lines.length; line += 1) {
        const opener = findDelimitedTextOpener(lines[line]);
        if (!opener) {
            continue;
        }

        const closing = findDelimitedTextClosing(lines, line + 1, opener.tag);
        if (!closing) {
            continue;
        }

        ranges.push({
            start: lineStarts[line] + opener.index,
            end: lineStarts[closing.line] + closing.delimiterEnd
        });
        line = closing.line;
    }

    return ranges;
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

function findDelimitedTextOpener(line: string): { index: number; tag: string } | undefined {
    const matcher = /@@?([A-Za-z_][A-Za-z0-9_]*)\b/g;
    let match: RegExpExecArray | null;

    while ((match = matcher.exec(line)) !== null) {
        if (isDelimitedTextOpenerPrefix(line.slice(0, match.index))) {
            return {
                index: match.index,
                tag: match[1]
            };
        }
    }

    return undefined;
}

function isDelimitedTextOpenerPrefix(prefix: string): boolean {
    const trimmedPrefix = prefix.trimEnd();
    if (!trimmedPrefix) {
        return true;
    }

    if (/^(?:\/\/|\/\*|\*)/.test(trimmedPrefix.trimStart())) {
        return false;
    }

    return /(?:\b(?:return|case|throw)|[=,({\[]|(?:\+\+|--|&&|\|\||<<|>>|->|[?:+\-*/%!~&|^<>]))$/.test(trimmedPrefix);
}

function findDelimitedTextClosing(
    lines: string[],
    startLine: number,
    tag: string
): { line: number; delimiterEnd: number } | undefined {
    const matcher = new RegExp(`^\\s*${escapeRegExp(tag)}\\b`);

    for (let line = startLine; line < lines.length; line += 1) {
        const match = lines[line].match(matcher);
        if (!match || !isDelimitedTextClosingSuffix(lines[line].slice(match[0].length))) {
            continue;
        }

        return {
            line,
            delimiterEnd: match[0].length
        };
    }

    return undefined;
}

function isDelimitedTextClosingSuffix(suffix: string): boolean {
    return /^\s*(?:[)\],;}]+\s*)?(?:(?:\/\/.*)|(?:\/\*.*\*\/\s*))?$/.test(suffix);
}

function isInsideRange(offset: number, ranges: TextRange[]): boolean {
    return ranges.some((range) => offset >= range.start && offset < range.end);
}

function parseWholeLineMacroInvocation(
    text: string,
    reference: MacroReferenceFact
): { indent: string; argumentText: string } | undefined {
    const lineStartOffset = findLineStart(text, reference.startOffset);
    const lineEndOffset = findLineEnd(text, reference.startOffset);
    const line = text.slice(lineStartOffset, lineEndOffset);
    const referenceColumn = reference.startOffset - lineStartOffset;
    const beforeMacro = line.slice(0, referenceColumn);
    if (!/^\s*$/.test(beforeMacro)) {
        return undefined;
    }

    let cursor = referenceColumn + reference.name.length;
    while (cursor < line.length && /\s/.test(line[cursor])) {
        cursor++;
    }
    if (line[cursor] !== '(') {
        return undefined;
    }

    const argumentStart = cursor + 1;
    const argumentEnd = findMatchingParen(line, cursor);
    if (argumentEnd === undefined) {
        return undefined;
    }

    const suffix = line.slice(argumentEnd + 1);
    if (!/^\s*;?\s*$/.test(suffix)) {
        return undefined;
    }

    return {
        indent: beforeMacro,
        argumentText: line.slice(argumentStart, argumentEnd)
    };
}

function findMatchingParen(text: string, openParenIndex: number): number | undefined {
    let depth = 0;
    let quote: '"' | '\'' | undefined;
    let escaped = false;

    for (let index = openParenIndex; index < text.length; index++) {
        const char = text[index];
        if (quote) {
            if (escaped) {
                escaped = false;
            } else if (char === '\\') {
                escaped = true;
            } else if (char === quote) {
                quote = undefined;
            }
            continue;
        }

        if (char === '"' || char === '\'') {
            quote = char;
            continue;
        }

        if (char === '(') {
            depth++;
            continue;
        }

        if (char === ')') {
            depth--;
            if (depth === 0) {
                return index;
            }
        }
    }

    return undefined;
}

function expandFunctionMacroBody(body: string, parameters: string[], args: string[]): string {
    let expanded = body;
    parameters.forEach((parameter, index) => {
        const pattern = new RegExp(`(^|[^#])#\\s*${escapeRegExp(parameter)}\\b`, 'g');
        expanded = expanded.replace(pattern, (_match, prefix: string) => `${prefix}"${escapeStringLiteral(args[index].trim())}"`);
    });
    parameters.forEach((parameter, index) => {
        const pattern = new RegExp(`\\b${escapeRegExp(parameter)}\\b`, 'g');
        expanded = expanded.replace(pattern, args[index].trim());
    });

    return expanded.replace(/##/g, '');
}

function splitMacroArguments(argumentText: string): string[] {
    const args: string[] = [];
    let current = '';
    let depth = 0;
    let quote: '"' | '\'' | undefined;
    let escaped = false;

    for (const char of argumentText) {
        if (quote) {
            current += char;
            if (escaped) {
                escaped = false;
            } else if (char === '\\') {
                escaped = true;
            } else if (char === quote) {
                quote = undefined;
            }
            continue;
        }

        if (char === '"' || char === '\'') {
            quote = char;
            current += char;
            continue;
        }

        if (char === '(' || char === '[' || char === '{') {
            depth += 1;
            current += char;
            continue;
        }

        if (char === ')' || char === ']' || char === '}') {
            depth = Math.max(0, depth - 1);
            current += char;
            continue;
        }

        if (char === ',' && depth === 0) {
            args.push(current.trim());
            current = '';
            continue;
        }

        current += char;
    }

    if (current.trim() || argumentText.trim() === '') {
        args.push(current.trim());
    }

    return args;
}

function findLineStart(text: string, offset: number): number {
    const index = text.lastIndexOf('\n', offset);
    return index < 0 ? 0 : index + 1;
}

function findLineEnd(text: string, offset: number): number {
    const index = text.indexOf('\n', offset);
    return index < 0 ? text.length : index;
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeStringLiteral(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
