import * as vscode from 'vscode';
import { isLpcPreprocessorDirective } from './languageFacts';
import {
    IncludeReferenceFact,
    MacroDefinitionFact,
    MacroReferenceFact,
    MacroUndefFact,
    PreprocessedSourceView,
    PreprocessorDirective,
    PreprocessorDirectiveKind,
    PreprocessorSnapshot
} from './types';

interface PhysicalLine {
    text: string;
    startOffset: number;
    endOffset: number;
    line: number;
}

export class PreprocessorScanner {
    public scan(uri: string, version: number, text: string): PreprocessorSnapshot {
        const lineStartOffsets = buildLineStartOffsets(text);
        const directives: PreprocessorDirective[] = [];
        const macros: MacroDefinitionFact[] = [];
        const undefs: MacroUndefFact[] = [];
        const includeReferences: IncludeReferenceFact[] = [];
        const lines = splitPhysicalLines(text);

        for (let index = 0; index < lines.length; index += 1) {
            const firstLine = lines[index];
            const trimmed = firstLine.text.trimStart();
            if (!trimmed.startsWith('#')) {
                continue;
            }

            const logicalLines = [firstLine];
            let commentState = scanDirectiveCommentState(firstLine.text);
            while (
                (endsWithContinuation(logicalLines[logicalLines.length - 1].text) || commentState.inBlockComment)
                && index + 1 < lines.length
            ) {
                index += 1;
                const nextLine = lines[index];
                logicalLines.push(nextLine);
                commentState = scanDirectiveCommentState(nextLine.text, commentState.inBlockComment);
            }

            const rawText = text.slice(
                logicalLines[0].startOffset,
                logicalLines[logicalLines.length - 1].endOffset
            );
            const directive = this.createDirective(rawText, logicalLines, lineStartOffsets);
            directives.push(directive);

            if (directive.kind === 'define') {
                const macro = this.tryCreateMacro(directive, uri);
                if (macro) {
                    macros.push(macro);
                }
                continue;
            }

            if (directive.kind === 'undef') {
                const undef = this.tryCreateUndef(directive);
                if (undef) {
                    undefs.push(undef);
                }
                continue;
            }

            if (directive.kind === 'include') {
                const include = this.tryCreateInclude(directive);
                if (include) {
                    includeReferences.push(include);
                }
            }
        }

        const activeView: PreprocessedSourceView = {
            text,
            sourceMap: [{ originalStartOffset: 0, activeStartOffset: 0, length: text.length }]
        };

        return {
            uri,
            version,
            text,
            directives,
            macros,
            undefs,
            macroReferences: this.collectMacroReferences(text, macros, lineStartOffsets),
            includeReferences,
            includeGraph: {
                rootUri: uri,
                edges: includeReferences.map((include) => ({
                    fromUri: uri,
                    includeValue: include.value,
                    toUri: include.resolvedUri
                }))
            },
            inactiveRanges: [],
            diagnostics: [],
            activeView
        };
    }

    private createDirective(
        rawText: string,
        logicalLines: PhysicalLine[],
        lineStartOffsets: number[]
    ): PreprocessorDirective {
        const firstLine = logicalLines[0];
        const lastLine = logicalLines[logicalLines.length - 1];
        const body = stripDirectiveComments(normalizeDirectiveBody(rawText));
        const command = (body.match(/^([A-Za-z_][A-Za-z0-9_]*)/) || [])[1] || '';
        const kind = toDirectiveKind(command);

        return {
            kind,
            rawText,
            body: body.slice(command.length).trimStart(),
            startOffset: firstLine.startOffset,
            endOffset: lastLine.endOffset,
            range: new vscode.Range(
                positionAt(lineStartOffsets, firstLine.startOffset),
                positionAt(lineStartOffsets, lastLine.endOffset)
            )
        };
    }

    private tryCreateMacro(directive: PreprocessorDirective, sourceUri: string): MacroDefinitionFact | undefined {
        const match = directive.body.match(/^([A-Za-z_][A-Za-z0-9_]*)(?:\(([^)]*)\))?\s*([\s\S]*)$/);
        if (!match) {
            return undefined;
        }

        const parameters = match[2] === undefined
            ? undefined
            : match[2].split(',').map((parameter) => parameter.trim()).filter(Boolean);

        return {
            name: match[1],
            replacement: stripReplacementComments(match[3] || '').trimEnd(),
            parameters,
            isFunctionLike: parameters !== undefined,
            source: 'document',
            sourceUri,
            startOffset: directive.startOffset,
            endOffset: directive.endOffset,
            range: directive.range
        };
    }

    private tryCreateUndef(directive: PreprocessorDirective): MacroUndefFact | undefined {
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

    private tryCreateInclude(directive: PreprocessorDirective): IncludeReferenceFact | undefined {
        const match = directive.body.match(/^([<"])([^>"]+)[>"]/);
        if (!match) {
            return undefined;
        }

        return {
            rawText: directive.rawText,
            value: match[2],
            isSystemInclude: match[1] === '<',
            startOffset: directive.startOffset,
            endOffset: directive.endOffset,
            range: directive.range
        };
    }

    private collectMacroReferences(
        text: string,
        macros: MacroDefinitionFact[],
        lineStartOffsets: number[]
    ): MacroReferenceFact[] {
        const references: MacroReferenceFact[] = [];
        for (const macro of macros) {
            const pattern = new RegExp(`\\b${escapeRegExp(macro.name)}\\b`, 'g');
            let match: RegExpExecArray | null;
            while ((match = pattern.exec(text)) !== null) {
                if (match.index >= macro.startOffset && match.index < macro.endOffset) {
                    continue;
                }
                references.push({
                    name: macro.name,
                    resolved: macro,
                    startOffset: match.index,
                    endOffset: match.index + macro.name.length,
                    range: new vscode.Range(
                        positionAt(lineStartOffsets, match.index),
                        positionAt(lineStartOffsets, match.index + macro.name.length)
                    )
                });
            }
        }

        return references;
    }
}

function splitPhysicalLines(text: string): PhysicalLine[] {
    const lines: PhysicalLine[] = [];
    let startOffset = 0;
    let line = 0;

    for (let index = 0; index < text.length; index += 1) {
        if (text[index] !== '\n') {
            continue;
        }

        lines.push({
            text: text.slice(startOffset, index),
            startOffset,
            endOffset: index,
            line
        });
        startOffset = index + 1;
        line += 1;
    }

    lines.push({
        text: text.slice(startOffset),
        startOffset,
        endOffset: text.length,
        line
    });

    return lines;
}

function normalizeDirectiveBody(rawText: string): string {
    const withoutHash = rawText.replace(/^\s*#/, '');
    return withoutHash
        .split(/\r?\n/)
        .map((line) => line.replace(/\\\s*$/, ''))
        .join('\n')
        .trim();
}

export function stripReplacementComments(text: string): string {
    let result = '';
    let inString = false;
    let inChar = false;
    let escaping = false;

    for (let index = 0; index < text.length; index += 1) {
        const current = text[index];
        const next = text[index + 1];

        if (escaping) {
            result += current;
            escaping = false;
            continue;
        }

        if (inString || inChar) {
            result += current;
            if (current === '\\') {
                escaping = true;
                continue;
            }
            if (inString && current === '"') {
                inString = false;
            } else if (inChar && current === "'") {
                inChar = false;
            }
            continue;
        }

        if (current === '"') {
            inString = true;
            result += current;
            continue;
        }

        if (current === "'") {
            inChar = true;
            result += current;
            continue;
        }

        if (current === '/' && next === '/') {
            while (index + 1 < text.length && text[index + 1] !== '\n' && text[index + 1] !== '\r') {
                index += 1;
            }
            continue;
        }

        if (current === '/' && next === '*') {
            index += 2;
            while (index < text.length && !(text[index] === '*' && text[index + 1] === '/')) {
                index += 1;
            }
            if (index < text.length) {
                index += 1;
            }
            result += ' ';
            continue;
        }

        result += current;
    }

    return result;
}

function endsWithContinuation(line: string): boolean {
    return /\\\s*$/.test(line);
}

function scanDirectiveCommentState(text: string, initialInBlockComment = false): { inBlockComment: boolean } {
    let inString = false;
    let inChar = false;
    let escaping = false;
    let inBlockComment = initialInBlockComment;

    for (let index = 0; index < text.length; index += 1) {
        const current = text[index];
        const next = text[index + 1];

        if (inBlockComment) {
            if (current === '*' && next === '/') {
                inBlockComment = false;
                index += 1;
            }
            continue;
        }

        if (escaping) {
            escaping = false;
            continue;
        }

        if (inString || inChar) {
            if (current === '\\') {
                escaping = true;
                continue;
            }
            if (inString && current === '"') {
                inString = false;
            } else if (inChar && current === "'") {
                inChar = false;
            }
            continue;
        }

        if (current === '"') {
            inString = true;
            continue;
        }

        if (current === "'") {
            inChar = true;
            continue;
        }

        if (current === '/' && next === '/') {
            break;
        }

        if (current === '/' && next === '*') {
            inBlockComment = true;
            index += 1;
        }
    }

    return { inBlockComment };
}

function stripDirectiveComments(text: string): string {
    return stripReplacementComments(text);
}

function toDirectiveKind(command: string): PreprocessorDirectiveKind {
    return isLpcPreprocessorDirective(command) ? command : 'unknown';
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

export function positionAt(lineStartOffsets: number[], offset: number): vscode.Position {
    const normalizedOffset = Math.max(0, offset);
    let low = 0;
    let high = lineStartOffsets.length - 1;

    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (lineStartOffsets[mid] > normalizedOffset) {
            high = mid - 1;
        } else {
            low = mid + 1;
        }
    }

    const line = Math.max(0, high);
    return new vscode.Position(line, normalizedOffset - lineStartOffsets[line]);
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
