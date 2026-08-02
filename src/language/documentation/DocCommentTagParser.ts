import type {
    AttachedDocComment,
    CallableReturnDoc,
    CallableReturnObjects
} from './types';

type SupportedTag = 'brief' | 'details' | 'note' | 'param' | 'return' | 'lpc-return-objects';

export interface ParsedParamTag {
    type: string;
    name: string;
    description?: string;
}

export interface ParsedDocTags {
    summary?: string;
    details?: string;
    note?: string;
    params: ParsedParamTag[];
    returns?: CallableReturnDoc;
    returnObjects?: CallableReturnObjects;
    duplicateReturnTagCount: number;
    malformedParamTagCount: number;
}

interface PendingTag {
    tag: SupportedTag | 'unknown';
    lines: string[];
    paramType?: string;
    paramName?: string;
}

export class DocCommentTagParser {
    public parse(
        attachedDocComment: AttachedDocComment | undefined,
        returnType: string | undefined
    ): ParsedDocTags {
        if (!attachedDocComment) {
            return { params: [], duplicateReturnTagCount: 0, malformedParamTagCount: 0 };
        }

        const lines = normalizeDocCommentLines(attachedDocComment.text);
        const parsedDocTags: ParsedDocTags = {
            params: [],
            duplicateReturnTagCount: 0,
            malformedParamTagCount: 0
        };
        let pendingTag: PendingTag | undefined;
        let seenReturnTag = false;

        const finalizePendingTag = (): void => {
            if (!pendingTag) {
                return;
            }

            const normalizedText = normalizeTagText(pendingTag.lines);

            switch (pendingTag.tag) {
                case 'brief':
                    if (parsedDocTags.summary === undefined && normalizedText) {
                        parsedDocTags.summary = normalizedText;
                    }
                    break;
                case 'details':
                    if (normalizedText) {
                        parsedDocTags.details = appendDocBlock(parsedDocTags.details, normalizedText);
                    }
                    break;
                case 'note':
                    if (normalizedText) {
                        parsedDocTags.note = appendDocBlock(parsedDocTags.note, normalizedText);
                    }
                    break;
                case 'return':
                    if (seenReturnTag) {
                        parsedDocTags.duplicateReturnTagCount += 1;
                    } else {
                        seenReturnTag = true;
                        if (normalizedText) {
                            parsedDocTags.returns = {
                                type: returnType,
                                description: normalizedText
                            };
                        }
                    }
                    break;
                case 'param':
                    if (pendingTag.paramType && pendingTag.paramName) {
                        parsedDocTags.params.push({
                            type: pendingTag.paramType,
                            name: pendingTag.paramName,
                            description: normalizedText
                        });
                    }
                    break;
                case 'lpc-return-objects':
                    parsedDocTags.returnObjects = parseReturnObjectsLiteral(normalizedText);
                    break;
                case 'unknown':
                    break;
                default:
                    assertNever(pendingTag.tag);
            }

            pendingTag = undefined;
        };

        for (const rawLine of lines) {
            const trimmedLine = rawLine.trim();
            const tagMatch = trimmedLine.match(/^@([A-Za-z][A-Za-z0-9-]*)(?:\s+(.*))?$/u);

            if (tagMatch) {
                finalizePendingTag();

                const [, tagName, remainder = ''] = tagMatch;
                if (isSupportedTag(tagName)) {
                    if (tagName === 'param') {
                        const parsedParam = parseParamTagHeader(remainder);
                        if (parsedParam) {
                            pendingTag = {
                                tag: 'param',
                                paramType: parsedParam.type,
                                paramName: parsedParam.name,
                                lines: parsedParam.description ? [parsedParam.description] : []
                            };
                        } else {
                            parsedDocTags.malformedParamTagCount += 1;
                            pendingTag = {
                                tag: 'unknown',
                                lines: []
                            };
                        }
                    } else {
                        pendingTag = {
                            tag: tagName,
                            lines: remainder ? [remainder] : []
                        };
                    }
                } else {
                    pendingTag = {
                        tag: 'unknown',
                        lines: []
                    };
                }

                continue;
            }

            if (pendingTag) {
                pendingTag.lines.push(trimmedLine);
            }
        }

        finalizePendingTag();
        return parsedDocTags;
    }
}

export function parseParamTagHeader(value: string): ParsedParamTag | undefined {
    const match = value.match(/^(\S+)\s+(\S+)(?:\s+([\s\S]*))?$/u);
    if (!match) {
        return undefined;
    }

    const [, baseType, declarator, trailingText] = match;
    const attachedPointer = declarator.match(/^(\*+)([A-Za-z_][A-Za-z0-9_]*)$/u);
    if (attachedPointer) {
        return {
            type: appendPointerDeclarator(baseType, attachedPointer[1]),
            name: attachedPointer[2],
            description: trailingText
        };
    }

    if (/^\*+$/u.test(declarator) && trailingText) {
        const separatedPointer = trailingText.match(/^([A-Za-z_][A-Za-z0-9_]*)(?:\s+([\s\S]*))?$/u);
        if (separatedPointer) {
            return {
                type: appendPointerDeclarator(baseType, declarator),
                name: separatedPointer[1],
                description: separatedPointer[2]
            };
        }
    }

    return {
        type: baseType,
        name: declarator,
        description: trailingText
    };
}

function appendPointerDeclarator(baseType: string, pointer: string): string {
    return `${baseType} ${pointer}`;
}

function normalizeDocCommentLines(commentText: string): string[] {
    return commentText
        .replace(/\r\n/g, '\n')
        .replace(/^\/\*\*\s?/u, '')
        .replace(/\s*\*\/$/u, '')
        .split('\n')
        .map((line) => line.replace(/^\s*\*\s?/u, ''));
}

function normalizeTagText(lines: string[]): string | undefined {
    const normalizedLines = collapseBlankLines(lines.map((line) => line.trim()));

    while (normalizedLines.length > 0 && normalizedLines[0] === '') {
        normalizedLines.shift();
    }

    while (normalizedLines.length > 0 && normalizedLines[normalizedLines.length - 1] === '') {
        normalizedLines.pop();
    }

    if (normalizedLines.length === 0) {
        return undefined;
    }

    return normalizedLines.join('\n');
}

function collapseBlankLines(lines: string[]): string[] {
    const collapsed: string[] = [];
    let previousWasBlank = false;

    for (const line of lines) {
        const isBlank = line.length === 0;
        if (isBlank && previousWasBlank) {
            continue;
        }

        collapsed.push(line);
        previousWasBlank = isBlank;
    }

    return collapsed;
}

function appendDocBlock(existing: string | undefined, next: string): string {
    if (!existing) {
        return next;
    }

    return `${existing}\n\n${next}`;
}

function parseReturnObjectsLiteral(value: string | undefined): CallableReturnObjects | undefined {
    if (!value) {
        return undefined;
    }

    const trimmed = value.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
        return undefined;
    }

    try {
        const parsed = JSON.parse(`[${trimmed.slice(1, -1)}]`);
        return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')
            ? parsed
            : undefined;
    } catch {
        return undefined;
    }
}

function isSupportedTag(tagName: string): tagName is SupportedTag {
    return (
        tagName === 'brief'
        || tagName === 'details'
        || tagName === 'note'
        || tagName === 'param'
        || tagName === 'return'
        || tagName === 'lpc-return-objects'
    );
}

function assertNever(value: never): never {
    throw new Error(`Unexpected value: ${String(value)}`);
}
