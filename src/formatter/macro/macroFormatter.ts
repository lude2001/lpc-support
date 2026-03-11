export function classifyMacro(text: string): 'safe' | 'unsafe' {
    if (!text.trimStart().startsWith('#define')) {
        return 'unsafe';
    }

    return text.includes('\\\n') || text.includes('\\\r\n') ? 'unsafe' : 'safe';
}

export function formatMacro(text: string): string {
    if (classifyMacro(text) === 'unsafe') {
        return text;
    }

    const match = text.match(/^#define\s+([A-Za-z_][A-Za-z0-9_]*)(\(([^)]*)\))?\s*(.*)$/);
    if (!match) {
        return text;
    }

    const [, name, rawArgsGroup, rawArgs = '', rawBody = ''] = match;
    const args = rawArgsGroup
        ? `(${rawArgs.split(',').map((arg) => arg.trim()).filter(Boolean).join(', ')})`
        : '';
    const body = normalizeMacroExpression(rawBody);

    return `#define ${name}${args}${body ? ` ${body}` : ''}`.trimEnd();
}

function normalizeMacroExpression(text: string): string {
    return text
        .replace(/\s+/g, ' ')
        .replace(/\s*,\s*/g, ', ')
        .replace(/\)\s*\+\s*\(/g, ') + (')
        .replace(/\(\s+/g, '(')
        .replace(/\s+\)/g, ')')
        .trim();
}
