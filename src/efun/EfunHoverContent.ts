import * as vscode from 'vscode';
import type { EfunDoc } from './types';

export function buildEfunHoverMarkdown(doc: EfunDoc): string {
    const parts: string[] = [];

    if (doc.syntax) {
        parts.push(`\`\`\`lpc\n${doc.syntax}\n\`\`\``);
    }

    if (doc.returnType) {
        parts.push(`**Return Type:** \`${doc.returnType}\``);
    }

    if (doc.category) {
        parts.push(`<sub>${doc.category}</sub>`);
    }

    const description = buildDescriptionSection(doc.description);
    if (description) {
        parts.push('---');
        parts.push(description);
    }

    if (doc.returnValue) {
        parts.push(`#### Returns\n\n${doc.returnValue}`);
    }

    if (doc.details) {
        parts.push(`#### Details\n\n${doc.details}`);
    }

    if (doc.note) {
        parts.push(`> **Note**  \n> ${doc.note.replace(/\n/g, '\n> ')}`);
    }

    if (doc.reference && doc.reference.length > 0) {
        parts.push(`**See also:** ${doc.reference.map((ref) => `\`${ref}\``).join(', ')}`);
    }

    return parts.filter((part) => part.trim().length > 0).join('\n\n');
}

export function createEfunHover(markdown: string, range?: vscode.Range): vscode.Hover {
    const content = new vscode.MarkdownString();
    content.isTrusted = false;
    content.supportHtml = true;
    content.appendMarkdown(markdown);
    return range ? new vscode.Hover(content, range) : new vscode.Hover(content);
}

function buildDescriptionSection(description: string | undefined): string {
    if (!description) {
        return '';
    }

    const descriptionLines = description.split('\n');
    const mainDescription: string[] = [];
    const parameterLines: string[] = [];
    let inParameters = false;

    for (const line of descriptionLines) {
        if (line.trim() === '参数:') {
            inParameters = true;
            continue;
        }

        if (inParameters) {
            parameterLines.push(line);
        } else if (line.trim()) {
            mainDescription.push(line);
        }
    }

    const sections: string[] = [];
    if (mainDescription.length > 0) {
        sections.push(mainDescription.join('\n'));
    }

    const parametersTable = buildParametersTable(parameterLines);
    if (parametersTable) {
        sections.push(`#### Parameters\n\n${parametersTable}`);
    }

    return sections.join('\n\n');
}

function buildParametersTable(parameterLines: string[]): string {
    const rows = parameterLines
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => {
            const match = line.match(/^(?:(.+?)\s+)?`?([A-Za-z_][A-Za-z0-9_]*)`?\s*:\s*(.+)$/);
            if (!match) {
                return `| ${escapeMarkdownTableCell(line)} | | |`;
            }

            const [, type, name, desc] = match;
            const normalizedType = type?.trim();
            const escapedDesc = escapeMarkdownTableCell(desc);
            if (normalizedType) {
                return `| \`${name}\` | \`${normalizedType}\` | ${escapedDesc} |`;
            }

            return `| \`${name}\` | | ${escapedDesc} |`;
        });

    if (rows.length === 0) {
        return '';
    }

    return [
        '| Name | Type | Description |',
        '|------|------|-------------|',
        ...rows
    ].join('\n');
}

function escapeMarkdownTableCell(value: string): string {
    return value
        .replace(/\\/g, '\\\\')
        .replace(/\|/g, '\\|')
        .replace(/\r?\n/g, '<br>');
}
