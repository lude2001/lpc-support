import type { CallableDoc, CallableParameter, CallableSignature } from './types';

export class CallableDocRenderer {
    public renderHover(doc: CallableDoc, options?: { sourceLabel?: string }): string {
        return renderDocument(doc, options);
    }

    public renderPanel(doc: CallableDoc): string {
        return renderDocument(doc);
    }

    public renderSignatureSummary(
        doc: CallableDoc,
        signatureIndex: number,
        activeParameter: number
    ): {
        label: string;
        documentation?: string;
        parameterDocs: string[];
    } {
        const signature = doc.signatures[signatureIndex] ?? createFallbackSignature(doc.name);
        const documentationSections = buildSummaryDocumentation(doc, signature, activeParameter);

        return {
            label: signature.label,
            documentation: documentationSections.length > 0 ? documentationSections.join('\n\n') : undefined,
            parameterDocs: signature.parameters.map((parameter) => formatParameterDocumentation(parameter))
        };
    }
}

function renderDocument(doc: CallableDoc, options?: { sourceLabel?: string }): string {
    const parts: string[] = [];

    if (options?.sourceLabel) {
        parts.push(`Source: ${options.sourceLabel}`);
    }

    for (const signature of doc.signatures) {
        parts.push(`\`\`\`lpc\n${signature.label}\n\`\`\``);
        const parameterSection = renderParametersSection(signature);
        if (parameterSection) {
            parts.push(parameterSection);
        }
    }

    if (doc.summary) {
        parts.push(doc.summary);
    }

    if (doc.returns?.description) {
        parts.push(`#### Returns\n\n${doc.returns.description}`);
    }

    if (doc.details) {
        parts.push(`#### Details\n\n${doc.details}`);
    }

    if (doc.note) {
        parts.push(`> **Note**  \n> ${doc.note.replace(/\n/g, '\n> ')}`);
    }

    return parts.filter((part) => part.trim().length > 0).join('\n\n');
}

function renderParametersSection(signature: CallableSignature | undefined): string | undefined {
    if (!signature || signature.parameters.length === 0) {
        return undefined;
    }

    const rows = signature.parameters.map((parameter) => {
        const description = escapeMarkdownTableCell(parameter.description ?? '');
        const type = parameter.type ? `\`${parameter.type}\`` : '';
        return `| \`${parameter.name}\` | ${type} | ${description} |`;
    });

    return [
        '#### Parameters',
        '',
        '| Name | Type | Description |',
        '|------|------|-------------|',
        ...rows
    ].join('\n');
}

function buildSummaryDocumentation(
    doc: CallableDoc,
    signature: CallableSignature,
    activeParameter: number
): string[] {
    const sections: string[] = [];

    if (doc.summary) {
        sections.push(doc.summary);
    }

    if (doc.returns?.description) {
        sections.push(`Returns: ${doc.returns.description}`);
    }

    if (doc.details) {
        sections.push(`Details: ${doc.details}`);
    }

    if (doc.note) {
        sections.push(`Note: ${doc.note}`);
    }

    if (activeParameter >= 0 && activeParameter < signature.parameters.length) {
        const parameter = signature.parameters[activeParameter];
        if (parameter.description) {
            sections.push(`Active parameter: ${formatParameterDocumentation(parameter)}`);
        }
    }

    return sections;
}

function formatParameterDocumentation(parameter: CallableParameter): string {
    const head = [parameter.type, parameter.name].filter(Boolean).join(' ').trim();
    if (parameter.description) {
        return `${head}: ${parameter.description}`;
    }

    return head;
}

function createFallbackSignature(name: string): CallableSignature {
    return {
        label: name,
        parameters: [],
        isVariadic: false
    };
}

function escapeMarkdownTableCell(value: string): string {
    return value
        .replace(/\\/g, '\\\\')
        .replace(/\|/g, '\\|')
        .replace(/\r?\n/g, '<br>');
}
