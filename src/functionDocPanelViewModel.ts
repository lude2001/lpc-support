import type { CallableDoc } from './language/documentation/types';
import { FunctionInfo } from './types/functionInfo';

type FunctionDocSourceGroup = {
    source: string;
    filePath: string;
    docs: Map<string, CallableDoc>;
};

export interface FunctionDocPanelFunctionData {
    name: string;
    source: string;
    filePath: string;
    line: number;
    definition: string;
    comment: string;
    documentationHtml: string;
    briefDescription: string;
}

export interface FunctionDocPanelInitialData {
    currentFunctions: FunctionDocPanelFunctionData[];
    inheritedFunctionGroups: Array<{
        source: string;
        functions: FunctionDocPanelFunctionData[];
    }>;
}

export function buildFunctionInfosFromDocGroup(group: FunctionDocSourceGroup): FunctionInfo[] {
    return Array.from(group.docs.values())
        .map((doc) => ({
            name: doc.name,
            definition: doc.signatures.map((signature) => signature.label).join('\n'),
            returnType: deriveCallableReturnType(doc),
            comment: renderFunctionDocComment(doc),
            briefDescription: doc.summary ?? '',
            source: group.source,
            filePath: group.filePath,
            line: doc.sourceRange?.start.line ?? 0
        }))
        .sort((left, right) => (left.line ?? 0) - (right.line ?? 0) || left.name.localeCompare(right.name));
}

export function buildFunctionDocPanelInitialData(
    currentFunctions: FunctionInfo[],
    inheritedFunctions: Map<string, FunctionInfo[]>
): FunctionDocPanelInitialData {
    return {
        currentFunctions: currentFunctions.map(toPanelFunctionData),
        inheritedFunctionGroups: Array.from(inheritedFunctions.entries()).map(([source, functions]) => ({
            source,
            functions: functions.map(toPanelFunctionData)
        }))
    };
}

function toPanelFunctionData(functionInfo: FunctionInfo): FunctionDocPanelFunctionData {
    return {
        name: functionInfo.name,
        source: functionInfo.source || '',
        filePath: functionInfo.filePath || '',
        line: functionInfo.line || 0,
        definition: functionInfo.definition || '',
        comment: functionInfo.comment || '',
        documentationHtml: renderCommentHtml(functionInfo.comment || ''),
        briefDescription: functionInfo.briefDescription || '暂无描述'
    };
}

export function renderFunctionDocComment(doc: CallableDoc): string {
    const hasDocumentation = Boolean(
        doc.summary
        || doc.details
        || doc.note
        || doc.returns?.description
        || doc.signatures.some((signature) => signature.parameters.some((parameter) => parameter.description))
    );
    if (!hasDocumentation) {
        return '';
    }

    const lines: string[] = ['/**'];

    if (doc.summary) {
        lines.push(` * @brief ${doc.summary}`);
    }

    for (const signature of doc.signatures) {
        for (const parameter of signature.parameters) {
            const parts = [' * @param'];
            if (parameter.type) {
                parts.push(parameter.type);
            }
            parts.push(parameter.name);
            if (parameter.description) {
                parts.push(parameter.description);
            }
            lines.push(parts.join(' '));
        }
    }

    if (doc.returns?.description) {
        lines.push(` * @return ${doc.returns.description}`);
    }

    if (doc.details) {
        for (const [index, line] of doc.details.split('\n').entries()) {
            lines.push(` * ${index === 0 ? '@details ' : ''}${line}`.trimEnd());
        }
    }

    if (doc.note) {
        for (const [index, line] of doc.note.split('\n').entries()) {
            lines.push(` * ${index === 0 ? '@note ' : ''}${line}`.trimEnd());
        }
    }

    lines.push(' */');
    return lines.join('\n');
}

function deriveCallableReturnType(doc: CallableDoc): string | undefined {
    if (doc.signatures.length === 0) {
        return undefined;
    }

    if (doc.signatures.length === 1) {
        return doc.signatures[0].returnType;
    }

    const returnTypes = doc.signatures.map((signature) => signature.returnType?.trim()).filter(Boolean);
    if (returnTypes.length !== doc.signatures.length) {
        return undefined;
    }

    const [firstReturnType, ...restReturnTypes] = returnTypes;
    return restReturnTypes.every((returnType) => returnType === firstReturnType)
        ? firstReturnType
        : undefined;
}

function renderCommentHtml(comment: string): string {
    const lines = normalizeCommentLines(comment);
    if (lines.length === 0) {
        return '';
    }

    let html = '';
    const details: string[] = [];
    let parametersHtml = '';
    let inParameterList = false;
    let exampleLines: string[] = [];
    let inExample = false;

    const closeParameterList = () => {
        if (inParameterList) {
            parametersHtml += '</ul>';
            inParameterList = false;
        }
    };
    const flushExample = () => {
        if (inExample) {
            html += `<h4>示例</h4><pre><code>${escapeHtml(exampleLines.join('\n'))}</code></pre>`;
            exampleLines = [];
            inExample = false;
        }
    };

    for (const line of lines) {
        if (inExample && line.startsWith('@') && !line.startsWith('@example')) {
            flushExample();
        }

        if (inExample) {
            exampleLines.push(line);
            continue;
        }

        if (line.startsWith('@brief')) {
            html += `<h4>简要描述</h4><p>${escapeHtml(line.slice('@brief'.length).trim())}</p>`;
            continue;
        }

        if (line.startsWith('@details')) {
            details.push(line.slice('@details'.length).trim());
            continue;
        }

        if (line.startsWith('@note')) {
            details.push(line.slice('@note'.length).trim());
            continue;
        }

        if (line.startsWith('@param')) {
            if (!inParameterList) {
                parametersHtml += '<h4>参数</h4><ul class="param-list">';
                inParameterList = true;
            }
            parametersHtml += renderParameterLine(line.slice('@param'.length).trim());
            continue;
        }

        if (line.startsWith('@return')) {
            closeParameterList();
            html += parametersHtml;
            parametersHtml = '';
            html += `<h4>返回值</h4><p>${escapeHtml(line.slice('@return'.length).trim())}</p>`;
            continue;
        }

        if (line.startsWith('@example')) {
            closeParameterList();
            html += parametersHtml;
            parametersHtml = '';
            inExample = true;
            const firstExampleLine = line.slice('@example'.length).trim();
            if (firstExampleLine) {
                exampleLines.push(firstExampleLine);
            }
            continue;
        }

        if (!line.startsWith('@')) {
            details.push(line);
        }
    }

    closeParameterList();
    flushExample();

    if (details.length > 0) {
        html += `<h4>详细描述</h4><p>${escapeHtml(details.join(' '))}</p>`;
    }

    return parametersHtml ? `${html}${parametersHtml}` : html;
}

function normalizeCommentLines(comment: string): string[] {
    return comment
        .replace(/^\/\*\*?\s*/, '')
        .replace(/\s*\*\/\s*$/, '')
        .split(/\r?\n/)
        .map((line) => line.replace(/^\s*\*\s?/, '').trim())
        .filter((line) => line.length > 0);
}

function renderParameterLine(parameterText: string): string {
    const parts = parameterText.split(/\s+/).filter(Boolean);
    if (parts.length >= 3) {
        const [type, name, ...description] = parts;
        return `<li><strong>${escapeHtml(type)}</strong> <code>${escapeHtml(name)}</code>: ${escapeHtml(description.join(' '))}</li>`;
    }

    if (parts.length >= 2) {
        const [name, ...description] = parts;
        return `<li><code>${escapeHtml(name)}</code>: ${escapeHtml(description.join(' '))}</li>`;
    }

    return `<li>${escapeHtml(parameterText)}</li>`;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
