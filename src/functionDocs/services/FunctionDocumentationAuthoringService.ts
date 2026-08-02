import * as vscode from 'vscode';
import type {
    FunctionDocumentationPanelEntry,
    PanelDocumentationAction
} from '../contracts/FunctionDocumentationPanelProtocol';
import { parseParamTagHeader } from '../../language/documentation/DocCommentTagParser';

export class FunctionDocumentationAuthoringService {
    public async apply(
        editor: vscode.TextEditor,
        entry: FunctionDocumentationPanelEntry,
        mode: Exclude<PanelDocumentationAction, 'none'>,
        options: {
            removeDuplicateTags?: boolean;
            removeStaleParamTags?: boolean;
            removeOrphanParamTags?: boolean;
        } = {}
    ): Promise<boolean> {
        if (!entry.sourceRange) {
            throw new Error('所选声明缺少可编辑范围。');
        }

        if (mode === 'generate' || !entry.documentation.attachedCommentRange) {
            const position = new vscode.Position(entry.sourceRange.start.line, 0);
            const indent = getIndent(editor.document.lineAt(entry.sourceRange.start.line).text);
            const eol = getDocumentEol(editor.document);
            const comment = renderSkeleton(entry, indent, eol);
            return editor.edit((editBuilder) => editBuilder.insert(position, `${comment}${eol}`));
        }

        const commentRange = toVsCodeRange(entry.documentation.attachedCommentRange);
        const existingComment = editor.document.getText(commentRange);
        const eol = existingComment.includes('\r\n') ? '\r\n' : getDocumentEol(editor.document);
        const deduplicatedComment = options.removeDuplicateTags
            || options.removeStaleParamTags
            || options.removeOrphanParamTags
            ? removeInconsistentTagBlocks(existingComment, entry, options)
            : existingComment;
        const normalizedComment = completeEmptyTags(deduplicatedComment, entry);
        const additions = renderMissingTags(
            entry,
            getIndent(editor.document.lineAt(commentRange.start.line).text),
            normalizedComment
        );
        const closingIndex = normalizedComment.lastIndexOf('*/');
        if (closingIndex < 0) {
            throw new Error('现有文档注释不完整，无法安全补全。');
        }
        if (additions.length === 0 && normalizedComment === existingComment) {
            return false;
        }
        const separator = normalizedComment.slice(0, closingIndex).endsWith('\n') || additions.length === 0 ? '' : eol;
        const additionText = additions.length > 0 ? `${additions.join(eol)}${eol}` : '';
        const replacement = `${normalizedComment.slice(0, closingIndex)}${separator}${additionText}${normalizedComment.slice(closingIndex)}`;
        return editor.edit((editBuilder) => editBuilder.replace(commentRange, replacement));
    }
}

function removeInconsistentTagBlocks(
    comment: string,
    entry: FunctionDocumentationPanelEntry,
    options: {
        removeDuplicateTags?: boolean;
        removeStaleParamTags?: boolean;
        removeOrphanParamTags?: boolean;
    }
): string {
    const duplicateParams = new Set(
        entry.quality.issues
            .filter((issue) => issue.code === 'duplicate-param-tag' && issue.parameterName)
            .map((issue) => issue.parameterName!)
    );
    const staleParams = new Set(
        entry.quality.issues
            .filter((issue) => issue.code === 'stale-parameter-name' && issue.parameterName)
            .map((issue) => issue.parameterName!)
    );
    const removeDuplicateReturn = entry.quality.issues.some((issue) => issue.code === 'duplicate-return-tag');
    const removeOrphanParams = options.removeOrphanParamTags
        && entry.quality.issues.some((issue) => issue.code === 'orphan-param-tag');
    const eol = comment.includes('\r\n') ? '\r\n' : '\n';
    const lines = comment.split(/\r?\n/u);
    const kept: string[] = [];
    const seenParams = new Set<string>();
    let seenReturn = false;
    let skipping = false;

    for (const line of lines) {
        const tagMatch = line.match(/^\s*\*\s*@([A-Za-z][A-Za-z0-9-]*)(?:\s+(.*))?$/u);
        if (tagMatch) {
            skipping = false;
            if (tagMatch[1] === 'param') {
                const paramName = parseParamTagHeader(tagMatch[2] ?? '')?.name;
                if (!paramName && removeOrphanParams) {
                    skipping = true;
                    continue;
                }
                if (paramName && options.removeStaleParamTags && staleParams.has(paramName)) {
                    skipping = true;
                    continue;
                }
                if (
                    paramName
                    && options.removeDuplicateTags
                    && duplicateParams.has(paramName)
                    && seenParams.has(paramName)
                ) {
                    skipping = true;
                    continue;
                }
                if (paramName) seenParams.add(paramName);
            } else if (tagMatch[1] === 'return' && options.removeDuplicateTags && removeDuplicateReturn) {
                if (seenReturn) {
                    skipping = true;
                    continue;
                }
                seenReturn = true;
            }
        } else if (/^\s*\*\/$/u.test(line)) {
            skipping = false;
        }
        if (!skipping) kept.push(line);
    }
    return kept.join(eol);
}

function completeEmptyTags(comment: string, entry: FunctionDocumentationPanelEntry): string {
    const missingSummary = entry.quality.issues.some((issue) => issue.code === 'missing-summary');
    const missingReturn = entry.quality.issues.some((issue) => issue.code === 'missing-return-description');
    const missingParams = new Set(
        entry.quality.issues
            .filter((issue) => issue.code === 'missing-param-description' && issue.parameterName)
            .map((issue) => issue.parameterName!)
    );
    if (!missingSummary && !missingReturn && missingParams.size === 0) {
        return comment;
    }

    const eol = comment.includes('\r\n') ? '\r\n' : '\n';
    return comment.split(/\r?\n/u).map((line) => {
        const tagMatch = line.match(/^(\s*\*\s*@([A-Za-z][A-Za-z0-9-]*))(?:\s+(.*))?$/u);
        if (!tagMatch) {
            return line;
        }
        const [, prefix, tagName, remainder = ''] = tagMatch;
        if (tagName === 'brief' && missingSummary && !remainder.trim()) {
            return `${prefix} TODO: 简要说明 ${entry.name} 的用途。`;
        }
        if (tagName === 'return' && missingReturn && !remainder.trim()) {
            return `${prefix} TODO: 说明返回值。`;
        }
        if (tagName === 'param') {
            const parsedParam = parseParamTagHeader(remainder);
            if (parsedParam && missingParams.has(parsedParam.name) && !parsedParam.description?.trim()) {
                return `${line} TODO: 说明 ${parsedParam.name}。`;
            }
        }
        return line;
    }).join(eol);
}

function renderSkeleton(entry: FunctionDocumentationPanelEntry, indent: string, eol: string): string {
    const lines = [
        `${indent}/**`,
        `${indent} * @brief TODO: 简要说明 ${entry.name} 的用途。`
    ];
    const parameters = uniqueParameters(entry);
    for (const parameter of parameters) {
        lines.push(`${indent} * @param ${parameter.type || 'mixed'} ${parameter.name} TODO: 说明 ${parameter.name}。`);
    }
    if (requiresReturnDescription(entry)) {
        lines.push(`${indent} * @return TODO: 说明返回值。`);
    }
    lines.push(`${indent} */`);
    return lines.join(eol);
}

function renderMissingTags(
    entry: FunctionDocumentationPanelEntry,
    indent: string,
    existingComment: string
): string[] {
    const lines: string[] = [];
    const existingTags = collectExistingTags(existingComment);
    if (
        entry.quality.issues.some((issue) => issue.code === 'missing-summary')
        && !existingTags.hasBrief
    ) {
        lines.push(`${indent} * @brief TODO: 简要说明 ${entry.name} 的用途。`);
    }

    const parameters = new Map(uniqueParameters(entry).map((parameter) => [parameter.name, parameter]));
    for (const issue of entry.quality.issues) {
        if (issue.code !== 'missing-param-description' || !issue.parameterName) {
            continue;
        }
        const parameter = parameters.get(issue.parameterName);
        if (parameter && !existingTags.paramNames.has(parameter.name)) {
            lines.push(`${indent} * @param ${parameter.type || 'mixed'} ${parameter.name} TODO: 说明 ${parameter.name}。`);
        }
    }
    if (
        entry.quality.issues.some((issue) => issue.code === 'missing-return-description')
        && !existingTags.hasReturn
    ) {
        lines.push(`${indent} * @return TODO: 说明返回值。`);
    }
    return lines;
}

function collectExistingTags(comment: string): {
    hasBrief: boolean;
    hasReturn: boolean;
    paramNames: Set<string>;
} {
    let hasBrief = false;
    let hasReturn = false;
    const paramNames = new Set<string>();
    for (const line of comment.split(/\r?\n/u)) {
        const tagMatch = line.match(/^\s*\*\s*@([A-Za-z][A-Za-z0-9-]*)(?:\s+(.*))?$/u);
        if (!tagMatch) {
            continue;
        }
        if (tagMatch[1] === 'brief') {
            hasBrief = true;
        } else if (tagMatch[1] === 'return') {
            hasReturn = true;
        } else if (tagMatch[1] === 'param') {
            const parsedParam = parseParamTagHeader(tagMatch[2] ?? '');
            if (parsedParam) {
                paramNames.add(parsedParam.name);
            }
        }
    }
    return { hasBrief, hasReturn, paramNames };
}

function uniqueParameters(entry: FunctionDocumentationPanelEntry): Array<{ name: string; type?: string }> {
    const parameters = new Map<string, { name: string; type?: string }>();
    for (const signature of entry.signatures) {
        for (const parameter of signature.parameters) {
            if (!parameters.has(parameter.name)) {
                parameters.set(parameter.name, parameter);
            }
        }
    }
    return [...parameters.values()];
}

function requiresReturnDescription(entry: FunctionDocumentationPanelEntry): boolean {
    return entry.signatures.some((signature) => signature.returnType && signature.returnType !== 'void');
}

function getIndent(lineText: string): string {
    return lineText.match(/^\s*/)?.[0] ?? '';
}

function getDocumentEol(document: vscode.TextDocument): string {
    return document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
}

function toVsCodeRange(range: { start: { line: number; character: number }; end: { line: number; character: number } }): vscode.Range {
    return new vscode.Range(
        range.start.line,
        range.start.character,
        range.end.line,
        range.end.character
    );
}
