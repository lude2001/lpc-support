type SnippetParameter = string | { name: string };

export function buildFunctionSnippet(name: string, parameters: SnippetParameter[]): string {
    if (parameters.length === 0) {
        return `${name}()`;
    }

    const placeholders = parameters
        .map((parameter, index) => `\${${index + 1}:${typeof parameter === 'string' ? parameter : parameter.name}}`)
        .join(', ');
    return `${name}(${placeholders})`;
}
