export function applyCommentFormatting(source: string, formatted: string): string {
    let result = ensureLeadingComment(source, formatted);
    result = preserveSingleLineTrailingComment(source, result);
    return preserveTrailingCommentBlock(source, result);
}

function extractLeadingComment(source: string): string | null {
    const blockMatch = source.match(/^\s*(\/\*\*[\s\S]*?\*\/)\s*/);
    if (blockMatch) {
        return blockMatch[1];
    }

    const lineMatch = source.match(/^\s*((?:\/\/[^\n\r]*(?:\r?\n|$))+)/);
    return lineMatch ? lineMatch[1].trimEnd() : null;
}

function extractTrailingLineComment(source: string): string | null {
    const match = source.match(/\/\/[^\n\r]*\s*$/);
    if (!match) {
        return null;
    }

    const beforeComment = source.slice(0, match.index).trimEnd();
    return beforeComment.includes('\n') || beforeComment.length > 0
        ? match[0].trimEnd()
        : null;
}

function extractTrailingLineCommentBlock(source: string): string | null {
    const normalizedSource = normalizeLineEndings(source);
    const lines = normalizedSource.split('\n');
    const trailingLines: string[] = [];
    let sawCommentLine = false;

    for (let index = lines.length - 1; index >= 0; index--) {
        const line = lines[index];
        const trimmedLine = line.trim();

        if (trimmedLine.startsWith('//')) {
            trailingLines.unshift(line);
            sawCommentLine = true;
            continue;
        }

        if (trimmedLine === '' && sawCommentLine) {
            trailingLines.unshift(line);
            continue;
        }

        break;
    }

    if (!sawCommentLine) {
        return null;
    }

    const beforeComment = lines
        .slice(0, lines.length - trailingLines.length)
        .join('\n')
        .trimEnd();
    if (beforeComment.length === 0) {
        return null;
    }

    return trailingLines.join('\n').trimEnd();
}

function normalizeLeadingComment(comment: string): string {
    if (!comment.startsWith('/**')) {
        return comment.trimEnd();
    }

    const lines = comment.split(/\r?\n/);
    if (lines.length <= 1) {
        return comment.trimEnd();
    }

    const normalizedLines = lines.map((line, index) => {
        if (index === 0) {
            return '/**';
        }

        if (index === lines.length - 1) {
            return ' */';
        }

        const content = line.replace(/^\s*\*?\s?/, '');
        return content ? ` * ${content}` : ' *';
    });

    return normalizedLines
        .join('\n')
        .replace(/\n\*/g, '\n *')
        .replace(/\n\*\//g, '\n */')
        .trimEnd();
}

export function normalizeLeadingCommentBlock(comment: string): string {
    return normalizeLeadingComment(comment);
}

function canonicalizeLeadingComment(comment: string): string {
    return normalizeLineEndings(comment)
        .replace(/[ \t]+$/gm, '')
        .trim();
}

function isSingleLineSource(source: string): boolean {
    return !/[\r\n]/.test(source);
}

function endsWithNormalizedBlock(result: string, block: string): boolean {
    return canonicalizeLeadingComment(result).endsWith(canonicalizeLeadingComment(block));
}

function ensureLeadingComment(source: string, formatted: string): string {
    const leadingComment = extractLeadingComment(source);
    if (!leadingComment) {
        return formatted;
    }

    const normalizedLeadingComment = normalizeCommentForComparison(leadingComment);
    const trimmedResult = formatted.trimStart();
    const existingLeadingComment = extractLeadingComment(trimmedResult);
    const normalizedExistingLeadingComment = existingLeadingComment
        ? normalizeCommentForComparison(existingLeadingComment)
        : null;

    if (normalizedExistingLeadingComment === normalizedLeadingComment) {
        return trimmedResult;
    }

    return `${normalizeLeadingComment(leadingComment)}\n${trimmedResult}`;
}

function preserveSingleLineTrailingComment(source: string, formatted: string): string {
    const trailingComment = extractTrailingLineComment(source);
    if (!trailingComment || !isSingleLineSource(source) || !formatted.includes('\n') || formatted.startsWith(trailingComment)) {
        return formatted;
    }

    return `${trailingComment}\n${formatted}`;
}

function preserveTrailingCommentBlock(source: string, formatted: string): string {
    const trailingCommentBlock = extractTrailingLineCommentBlock(source);
    if (!trailingCommentBlock || endsWithNormalizedBlock(formatted, trailingCommentBlock)) {
        return formatted;
    }

    const trimmedResult = formatted.trimEnd();
    return trimmedResult.length > 0
        ? `${trimmedResult}\n\n${trailingCommentBlock}`
        : trailingCommentBlock;
}

function normalizeCommentForComparison(comment: string): string {
    return canonicalizeLeadingComment(normalizeLeadingComment(comment));
}

function normalizeLineEndings(text: string): string {
    return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}
