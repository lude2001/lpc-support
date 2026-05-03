import {
    MacroExpansionRange,
    MacroReferenceFact,
    PreprocessedSourceView,
    PreprocessorSourceMapEntry
} from './types';

export class MacroExpansionBuilder {
    public expand(
        activeView: PreprocessedSourceView,
        macroReferences: MacroReferenceFact[]
    ): PreprocessedSourceView {
        let text = activeView.text;
        const expandedRanges: MacroExpansionRange[] = [];
        const expandableReferences = macroReferences
            .filter((reference) => reference.resolved?.isFunctionLike)
            .sort((left, right) => right.startOffset - left.startOffset);

        for (const reference of expandableReferences) {
            const expanded = this.tryExpandWholeLineInvocation(text, reference);
            if (!expanded) {
                continue;
            }

            text = `${text.slice(0, expanded.lineStartOffset)}${expanded.expandedLine}${text.slice(expanded.lineEndOffset)}`;
            expandedRanges.push({
                macroName: reference.name,
                originalStartOffset: expanded.lineStartOffset,
                originalEndOffset: expanded.lineEndOffset,
                activeStartOffset: expanded.lineStartOffset,
                activeEndOffset: expanded.lineStartOffset + expanded.expandedLine.length
            });
        }

        return {
            text,
            sourceMap: this.buildSourceMap(text),
            expandedRanges: expandedRanges.reverse()
        };
    }

    private tryExpandWholeLineInvocation(
        text: string,
        reference: MacroReferenceFact
    ): { lineStartOffset: number; lineEndOffset: number; expandedLine: string } | undefined {
        const macro = reference.resolved;
        if (!macro?.parameters) {
            return undefined;
        }

        const lineStartOffset = findLineStart(text, reference.startOffset);
        const lineEndOffset = findLineEnd(text, reference.startOffset);
        const line = text.slice(lineStartOffset, lineEndOffset);
        const pattern = new RegExp(`^(\\s*)${escapeRegExp(reference.name)}\\s*\\((.*)\\)\\s*;?\\s*$`);
        const match = line.match(pattern);
        if (!match) {
            return undefined;
        }

        const args = splitMacroArguments(match[2]);
        if (args.length !== macro.parameters.length) {
            return undefined;
        }

        const expandedBody = expandFunctionMacroBody(macro.replacement, macro.parameters, args);
        return {
            lineStartOffset,
            lineEndOffset,
            expandedLine: `${match[1]}${expandedBody}`
        };
    }

    private buildSourceMap(text: string): PreprocessorSourceMapEntry[] {
        return [{ originalStartOffset: 0, activeStartOffset: 0, length: text.length }];
    }
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
