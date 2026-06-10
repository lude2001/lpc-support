import * as vscode from 'vscode';
import {
    InactiveRange,
    MacroDefinitionFact,
    MacroReferenceFact,
    MacroUndefFact,
    PreprocessorDirective
} from './types';
import { positionAt } from './PreprocessorScanner';

export interface MacroFactResolutionResult {
    activeMacros: MacroDefinitionFact[];
    macroReferences: MacroReferenceFact[];
    undefs: MacroUndefFact[];
}

export class MacroFactResolver {
    public resolve(
        text: string,
        directives: PreprocessorDirective[],
        inactiveRanges: InactiveRange[],
        initialMacros: MacroDefinitionFact[] = [],
        sourceUri?: string
    ): MacroFactResolutionResult {
        const lineStartOffsets = buildLineStartOffsets(text);
        const activeMacros = new Map<string, MacroDefinitionFact>();
        for (const macro of initialMacros) {
            activeMacros.set(macro.name, macro);
        }
        const macroReferences: MacroReferenceFact[] = [];
        const undefs: MacroUndefFact[] = [];
        let cursor = 0;

        for (const directive of directives) {
            this.collectReferences(text, lineStartOffsets, cursor, directive.startOffset, activeMacros, inactiveRanges, macroReferences);

            if (!isInsideInactiveRange(directive.startOffset, inactiveRanges)) {
                if (directive.kind === 'define') {
                    const macro = createMacroFact(directive, sourceUri);
                    if (macro) {
                        activeMacros.set(macro.name, macro);
                    }
                } else if (directive.kind === 'undef') {
                    const undef = createUndefFact(directive);
                    if (undef) {
                        activeMacros.delete(undef.name);
                        undefs.push(undef);
                    }
                }
            }

            cursor = directive.endOffset;
        }

        this.collectReferences(text, lineStartOffsets, cursor, text.length, activeMacros, inactiveRanges, macroReferences);

        return {
            activeMacros: Array.from(activeMacros.values()),
            macroReferences,
            undefs
        };
    }

    private collectReferences(
        text: string,
        lineStartOffsets: number[],
        startOffset: number,
        endOffset: number,
        activeMacros: Map<string, MacroDefinitionFact>,
        inactiveRanges: InactiveRange[],
        macroReferences: MacroReferenceFact[]
    ): void {
        if (activeMacros.size === 0 || endOffset <= startOffset) {
            return;
        }

        let cursor = startOffset;
        while (cursor < endOffset) {
            if (isInsideInactiveRange(cursor, inactiveRanges)) {
                cursor += 1;
                continue;
            }

            const char = text[cursor];
            if (char === '"' || char === '\'') {
                cursor = consumeQuoted(text, cursor, char, endOffset);
                continue;
            }

            if (char === '/' && text[cursor + 1] === '/') {
                cursor = consumeLineComment(text, cursor, endOffset);
                continue;
            }

            if (char === '/' && text[cursor + 1] === '*') {
                cursor = consumeBlockComment(text, cursor, endOffset);
                continue;
            }

            if (!isIdentifierStart(char)) {
                cursor += 1;
                continue;
            }

            const absoluteStart = cursor;
            let absoluteEnd = cursor + 1;
            while (absoluteEnd < endOffset && isIdentifierPart(text[absoluteEnd])) {
                absoluteEnd += 1;
            }
            cursor = absoluteEnd;

            if (isInsideInactiveRange(absoluteStart, inactiveRanges)) {
                continue;
            }

            const name = text.slice(absoluteStart, absoluteEnd);
            const macro = activeMacros.get(name);
            if (!macro) {
                continue;
            }

            macroReferences.push({
                name: macro.name,
                resolved: macro,
                startOffset: absoluteStart,
                endOffset: absoluteEnd,
                range: new vscode.Range(
                    positionAt(lineStartOffsets, absoluteStart),
                    positionAt(lineStartOffsets, absoluteEnd)
                )
            });
        }
    }
}

function consumeQuoted(text: string, startOffset: number, quote: string, maxOffset: number): number {
    let cursor = startOffset + 1;
    let escaped = false;

    while (cursor < maxOffset) {
        const char = text[cursor];
        cursor += 1;

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

    return cursor;
}

function consumeLineComment(text: string, startOffset: number, maxOffset: number): number {
    const newlineOffset = text.indexOf('\n', startOffset + 2);
    return newlineOffset === -1 || newlineOffset >= maxOffset ? maxOffset : newlineOffset + 1;
}

function consumeBlockComment(text: string, startOffset: number, maxOffset: number): number {
    const closingOffset = text.indexOf('*/', startOffset + 2);
    return closingOffset === -1 || closingOffset + 2 > maxOffset ? maxOffset : closingOffset + 2;
}

function isIdentifierStart(char: string | undefined): boolean {
    return Boolean(char && /[A-Za-z_]/.test(char));
}

function isIdentifierPart(char: string | undefined): boolean {
    return Boolean(char && /[A-Za-z0-9_]/.test(char));
}

function createMacroFact(directive: PreprocessorDirective, sourceUri?: string): MacroDefinitionFact | undefined {
    const match = directive.body.match(/^([A-Za-z_][A-Za-z0-9_]*)(?:\(([^)]*)\))?\s*([\s\S]*)$/);
    if (!match) {
        return undefined;
    }

    const parameters = match[2] === undefined
        ? undefined
        : match[2].split(',').map((parameter) => parameter.trim()).filter(Boolean);

    return {
        name: match[1],
        replacement: (match[3] || '').trimEnd(),
        parameters,
        isFunctionLike: parameters !== undefined,
        source: 'document',
        sourceUri,
        startOffset: directive.startOffset,
        endOffset: directive.endOffset,
        range: directive.range
    };
}

function createUndefFact(directive: PreprocessorDirective): MacroUndefFact | undefined {
    const match = directive.body.match(/^([A-Za-z_][A-Za-z0-9_]*)/);
    if (!match) {
        return undefined;
    }

    return {
        name: match[1],
        startOffset: directive.startOffset,
        endOffset: directive.endOffset,
        range: directive.range
    };
}

function isInsideInactiveRange(offset: number, inactiveRanges: InactiveRange[]): boolean {
    return inactiveRanges.some((range) => offset >= range.startOffset && offset < range.endOffset);
}

function buildLineStartOffsets(text: string): number[] {
    const offsets = [0];
    for (let index = 0; index < text.length; index += 1) {
        if (text[index] === '\n') {
            offsets.push(index + 1);
        }
    }
    return offsets;
}
