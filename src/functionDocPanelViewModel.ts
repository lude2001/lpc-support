import type { EfunDoc } from './efun/types';
import { FunctionInfo } from './types/functionInfo';

type FunctionDocSourceGroup = {
    source: string;
    filePath: string;
    docs: Map<string, EfunDoc>;
};

export interface FunctionDocPanelFunctionData {
    name: string;
    source: string;
    filePath: string;
    line: number;
    definition: string;
    comment: string;
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
            definition: doc.syntax,
            returnType: doc.returnType,
            comment: renderFunctionDocComment(doc),
            briefDescription: doc.description ?? '',
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
        briefDescription: functionInfo.briefDescription || '暂无描述'
    };
}

export function renderFunctionDocComment(doc: EfunDoc): string {
    const hasDocumentation = Boolean(
        doc.description
        || doc.details
        || doc.note
        || doc.returnValue
        || doc.signatures?.some((signature) => signature.parameters.some((parameter) => parameter.description))
    );
    if (!hasDocumentation) {
        return '';
    }

    const lines: string[] = ['/**'];

    if (doc.description) {
        lines.push(` * @brief ${doc.description}`);
    }

    for (const signature of doc.signatures ?? []) {
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

    if (doc.returnValue) {
        lines.push(` * @return ${doc.returnValue}`);
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
