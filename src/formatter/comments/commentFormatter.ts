export function applyCommentFormatting(source: string, formatted: string): string {
    let result = formatted;
    const leadingComment = extractLeadingComment(source);
    if (leadingComment) {
        result = `${normalizeLeadingComment(leadingComment)}\n${result.trimStart()}`;
    }

    const trailingComment = extractTrailingLineComment(source);
    if (trailingComment && result.includes('\n') && !result.startsWith(trailingComment)) {
        result = `${trailingComment}\n${result}`;
    }

    return result;
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
