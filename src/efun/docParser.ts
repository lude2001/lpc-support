import type { EfunDoc } from './types';

/**
 * @deprecated Legacy helper kept only for transitional callers such as simulated-efun scanning and focused tests.
 * New hover/panel/return-object production paths should use FunctionDocumentationService + CallableDoc instead.
 */

export interface ParseFunctionDocsOptions {
    isSimulated?: boolean;
    sourceFile?: string;
}

function normalizeDocComment(docComment: string): string {
    return docComment
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map(line => line.replace(/^\s*\*\s?/, ''))
        .join('\n')
        .trim();
}

export function extractReturnType(syntax: string | undefined, funcName: string): string | undefined {
    if (!syntax) {
        return undefined;
    }

    const firstLine = syntax
        .split('\n')
        .map(line => line.trim())
        .find(Boolean);

    if (!firstLine) {
        return undefined;
    }

    const escapedName = funcName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = firstLine.match(new RegExp(`\\b${escapedName}\\s*\\(`));
    if (!match || match.index === undefined) {
        return undefined;
    }

    let prefix = firstLine.slice(0, match.index).trim().replace(/^varargs\s+/i, '');
    if (!prefix) {
        return undefined;
    }

    if (prefix.includes('=')) {
        prefix = prefix.slice(0, prefix.lastIndexOf('=')).trim();
        prefix = prefix.replace(/\s+[A-Za-z_][A-Za-z0-9_]*$/u, '').trim();
    }

    return prefix || undefined;
}

function extractParamDescriptions(normalizedComment: string): string[] {
    const params: string[] = [];
    const paramPattern = /(?:^|\n)@param\s+(\S+)\s+(\S+)\s+([\s\S]*?)(?=\n@[A-Za-z][A-Za-z0-9-]*|$)/g;

    let match: RegExpExecArray | null;
    while ((match = paramPattern.exec(normalizedComment)) !== null) {
        const [, type, name, descriptionBlock] = match;
        const description = descriptionBlock
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .join(' ');

        if (description) {
            params.push(`${type} ${name}: ${description}`);
        }
    }

    return params;
}

function extractFirstCommentLine(normalizedComment: string): string | undefined {
    const firstLine = normalizedComment
        .split('\n')
        .map(line => line.trim())
        .find(Boolean);

    return firstLine || undefined;
}

export function extractTagBlock(docComment: string, tag: string): string | undefined {
    const normalizedComment = normalizeDocComment(docComment);
    const regex = new RegExp(`(?:^|\\n)@${tag}\\s+([\\s\\S]*?)(?=\\n@[A-Za-z][A-Za-z0-9-]*|$)`, 'i');
    const match = normalizedComment.match(regex);

    if (!match) {
        return undefined;
    }

    const value = match[1]
        .split('\n')
        .map(line => line.trim())
        .join('\n')
        .trim();

    return value || undefined;
}

export function parseReturnObjects(docComment: string): string[] | undefined {
    const tagValue = extractTagBlock(docComment, 'lpc-return-objects');
    if (!tagValue) {
        return undefined;
    }

    const match = tagValue.match(/^\{([\s\S]*)\}$/);
    if (!match) {
        return undefined;
    }

    const content = match[1].trim();
    if (!content) {
        return undefined;
    }

    const itemPattern = /"([^"\\]*(?:\\.[^"\\]*)*)"/g;
    const strictListPattern = /^\s*"([^"\\]*(?:\\.[^"\\]*)*)"\s*(,\s*"([^"\\]*(?:\\.[^"\\]*)*)"\s*)*$/;
    if (!strictListPattern.test(content)) {
        return undefined;
    }

    const values = Array.from(content.matchAll(itemPattern), item => item[1]);
    return values.length > 0 ? values : undefined;
}

export function parseFunctionDocs(
    content: string,
    category: string,
    options: ParseFunctionDocsOptions = {}
): Map<string, EfunDoc> {
    const docs = new Map<string, EfunDoc>();
    const functionPattern = /\/\*\*\s*([\s\S]*?)\s*\*\/\s*(?:private\s+|public\s+|protected\s+|static\s+|nomask\s+)*((?:varargs\s+)?(?:mixed|void|int|string|object|mapping|array|float|function|buffer|class|[a-zA-Z_][a-zA-Z0-9_]*)\s*\**\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\))/g;

    let match: RegExpExecArray | null;
    while ((match = functionPattern.exec(content)) !== null) {
        try {
            const [, docComment, funcDecl, funcName] = match;
            const syntax = funcDecl.trim();
            const normalizedComment = normalizeDocComment(docComment);
            const description = extractTagBlock(docComment, 'brief') ?? extractFirstCommentLine(normalizedComment) ?? '';
            const doc: EfunDoc = {
                name: funcName,
                syntax,
                description,
                returnType: extractReturnType(syntax, funcName),
                category
            };

            if (options.sourceFile) {
                const startOffset = match.index + match[0].lastIndexOf(funcDecl);
                const endOffset = startOffset + funcDecl.length;
                doc.sourceFile = options.sourceFile;
                doc.sourceRange = {
                    start: offsetToPosition(content, startOffset),
                    end: offsetToPosition(content, endOffset)
                };
            }

            if (options.isSimulated) {
                doc.isSimulated = true;
            } else {
                doc.lastUpdated = Date.now();
            }

            const details = extractTagBlock(docComment, 'details');
            if (details) {
                doc.details = details;
            }

            const note = extractTagBlock(docComment, 'note');
            if (note) {
                doc.note = note;
            }

            const params = extractParamDescriptions(normalizedComment);
            if (params.length > 0) {
                doc.description += `${doc.description ? '\n\n' : ''}参数:\n${params.join('\n')}`;
            }

            const returnValue = extractTagBlock(docComment, 'return');
            if (returnValue) {
                doc.returnValue = returnValue;
            }

            const returnObjects = parseReturnObjects(docComment);
            if (returnObjects) {
                doc.returnObjects = returnObjects;
            }

            docs.set(funcName, doc);
        } catch (error) {
            console.error('解析函数文档失败:', error);
        }
    }

    return docs;
}

function offsetToPosition(content: string, offset: number): { line: number; character: number } {
    const normalizedOffset = Math.max(0, Math.min(offset, content.length));
    const precedingContent = content.slice(0, normalizedOffset);
    const lines = precedingContent.split('\n');
    const line = lines.length - 1;
    const character = lines[lines.length - 1]?.length ?? 0;

    return { line, character };
}
