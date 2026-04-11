import type { LanguageCapabilityContext } from '../../contracts/LanguageCapabilityContext';
import type { LanguageDiagnostic } from '../diagnostics/LanguageDiagnosticsService';
import type { LanguageRange, LanguagePosition } from '../../contracts/LanguagePosition';
import type { LanguageWorkspaceEdit, LanguageTextEdit } from '../navigation/LanguageRenameService';

export interface LanguageCodeActionCommand {
    title: string;
    command: string;
    arguments?: unknown[];
}

export interface LanguageCodeAction {
    title: string;
    kind?: string;
    diagnostics?: LanguageDiagnostic[];
    edit?: LanguageWorkspaceEdit;
    command?: LanguageCodeActionCommand;
    isPreferred?: boolean;
}

export interface LanguageCodeActionRequest {
    context: LanguageCapabilityContext;
    range: LanguageRange;
    diagnostics: LanguageDiagnostic[];
    only?: readonly string[];
}

export interface LanguageCodeActionService {
    provideCodeActions(request: LanguageCodeActionRequest): Promise<LanguageCodeAction[]>;
}

interface RangeReadableDocument {
    uri: string;
    getText(range?: LanguageRange): string;
    lineAt(lineOrPosition: number | { line: number }): {
        text: string;
        range?: LanguageRange;
        rangeIncludingLineBreak?: LanguageRange;
    };
    positionAt(offset: number): LanguagePosition;
}

type DiagnosticWithOffsets = LanguageDiagnostic & {
    data?: {
        start?: number;
        end?: number;
    };
};

export const LANGUAGE_CODE_ACTION_KIND_QUICKFIX = 'quickfix';
export const UNUSED_VAR_DIAGNOSTIC_CODE = 'unusedVar';
export const UNUSED_PARAM_DIAGNOSTIC_CODE = 'unusedParam';
export const UNUSED_GLOBAL_VAR_DIAGNOSTIC_CODE = 'unusedGlobalVar';
export const LOCAL_VARIABLE_POSITION_DIAGNOSTIC_CODE = 'localVariableDeclarationPosition';

class DefaultLanguageCodeActionService implements LanguageCodeActionService {
    public async provideCodeActions(request: LanguageCodeActionRequest): Promise<LanguageCodeAction[]> {
        if (request.only && request.only.length > 0 && !request.only.includes(LANGUAGE_CODE_ACTION_KIND_QUICKFIX)) {
            return [];
        }

        const document = request.context.document as unknown as RangeReadableDocument;
        const actions: LanguageCodeAction[] = [];

        for (const diagnostic of request.diagnostics) {
            const code = diagnostic.code?.toString();

            if (
                code === UNUSED_VAR_DIAGNOSTIC_CODE ||
                code === UNUSED_PARAM_DIAGNOSTIC_CODE ||
                code === UNUSED_GLOBAL_VAR_DIAGNOSTIC_CODE
            ) {
                const removeAction = this.createRemoveVariableAction(document, diagnostic);
                if (removeAction) {
                    actions.push(removeAction);
                }

                const commentAction = this.createCommentVariableAction(document, diagnostic);
                if (commentAction) {
                    actions.push(commentAction);
                }

                const makeGlobalAction = this.createMakeGlobalAction(document, diagnostic);
                if (makeGlobalAction) {
                    actions.push(makeGlobalAction);
                }

                const snakeCaseAction = this.createRenameVariableCaseAction(document, diagnostic, 'snake');
                if (snakeCaseAction) {
                    actions.push(snakeCaseAction);
                }

                const camelCaseAction = this.createRenameVariableCaseAction(document, diagnostic, 'camel');
                if (camelCaseAction) {
                    actions.push(camelCaseAction);
                }
            }

            if (code === LOCAL_VARIABLE_POSITION_DIAGNOSTIC_CODE) {
                const moveToBlockStartAction = this.createMoveVariableToBlockStartAction(document, diagnostic);
                if (moveToBlockStartAction) {
                    actions.push(moveToBlockStartAction);
                }

                const moveToFunctionStartAction = this.createMoveVariableToFunctionStartAction(document, diagnostic);
                if (moveToFunctionStartAction) {
                    actions.push(moveToFunctionStartAction);
                }
            }
        }

        return actions;
    }

    private createRemoveVariableAction(document: RangeReadableDocument, diagnostic: LanguageDiagnostic): LanguageCodeAction | undefined {
        const line = document.lineAt(diagnostic.range.start.line);
        let lineText = line.text;

        let varStartCol = diagnostic.range.start.character;
        const varEndCol = diagnostic.range.end.character;

        let index = varStartCol - 1;
        while (index >= 0 && /[ \t\*]/.test(lineText[index])) {
            index -= 1;
        }

        const hadCommaBefore = index >= 0 && lineText[index] === ',';

        if (hadCommaBefore) {
            varStartCol = index;
        } else {
            varStartCol = index + 1;
        }

        const before = lineText.slice(0, varStartCol);
        const after = lineText.slice(varEndCol);
        const afterTrimStart = after.replace(/^\s*/, '');

        let newLineText = '';
        if (hadCommaBefore) {
            newLineText = before + after;
        } else if (/^,/.test(afterTrimStart)) {
            newLineText = before + afterTrimStart.replace(/^,/, '');
        }

        const replaceRange = this.shouldDeleteEntireLine(newLineText)
            ? this.createLineRangeIncludingBreak(document, diagnostic.range.start.line, line.text.length)
            : this.createLineRange(document, diagnostic.range.start.line, line.text.length);
        const newText = this.shouldDeleteEntireLine(newLineText) ? '' : newLineText;

        return {
            title: '删除未使用的变量',
            kind: LANGUAGE_CODE_ACTION_KIND_QUICKFIX,
            diagnostics: [diagnostic],
            isPreferred: true,
            edit: this.createWorkspaceEdit(document.uri, [
                {
                    range: replaceRange,
                    newText
                }
            ])
        };
    }

    private createCommentVariableAction(document: RangeReadableDocument, diagnostic: LanguageDiagnostic): LanguageCodeAction | undefined {
        const offsetData = (diagnostic as DiagnosticWithOffsets).data;

        let targetRange: LanguageRange;
        if (typeof offsetData?.start === 'number' && typeof offsetData?.end === 'number') {
            const text = document.getText();
            let start = offsetData.start;
            let end = offsetData.end;

            let index = start - 1;
            while (index >= 0 && /[ \t\*]/.test(text[index])) {
                index -= 1;
            }
            if (index >= 0 && text[index] === ',') {
                start = index;
            } else {
                start = index + 1;
            }

            index = end;
            while (index < text.length && /[ \t]/.test(text[index])) {
                index += 1;
            }
            if (index < text.length && text[index] === ',') {
                end = index + 1;
            }

            targetRange = {
                start: document.positionAt(start),
                end: document.positionAt(end)
            };
        } else {
            const line = document.lineAt(diagnostic.range.start.line);
            targetRange = this.createLineRange(document, diagnostic.range.start.line, line.text.length);
        }

        const original = document.getText(targetRange);
        return {
            title: '注释未使用的变量',
            kind: LANGUAGE_CODE_ACTION_KIND_QUICKFIX,
            diagnostics: [diagnostic],
            edit: this.createWorkspaceEdit(document.uri, [
                {
                    range: targetRange,
                    newText: `/*${original}*/`
                }
            ])
        };
    }

    private createMakeGlobalAction(document: RangeReadableDocument, diagnostic: LanguageDiagnostic): LanguageCodeAction | undefined {
        const line = document.lineAt(diagnostic.range.start.line);
        const newText = line.text.replace(/^\s*/, '$&nosave ');

        return {
            title: '将变量标记为全局变量',
            kind: LANGUAGE_CODE_ACTION_KIND_QUICKFIX,
            diagnostics: [diagnostic],
            edit: this.createWorkspaceEdit(document.uri, [
                {
                    range: this.createLineRange(document, diagnostic.range.start.line, line.text.length),
                    newText
                }
            ])
        };
    }

    private createRenameVariableCaseAction(
        document: RangeReadableDocument,
        diagnostic: LanguageDiagnostic,
        mode: 'snake' | 'camel'
    ): LanguageCodeAction | undefined {
        const oldName = document.getText(diagnostic.range).trim();
        if (!oldName) {
            return undefined;
        }

        const newName = mode === 'snake' ? this.toSnakeCase(oldName) : this.toCamelCase(oldName);
        if (newName === oldName) {
            return undefined;
        }

        const title = `改名为${mode === 'snake' ? '蛇形' : '驼峰'}: ${newName}`;
        return {
            title,
            kind: LANGUAGE_CODE_ACTION_KIND_QUICKFIX,
            diagnostics: [diagnostic],
            command: {
                title,
                command: mode === 'snake' ? 'lpc.renameVarToSnakeCase' : 'lpc.renameVarToCamelCase',
                arguments: [document.uri, diagnostic.range.start, newName]
            }
        };
    }

    private createMoveVariableToBlockStartAction(document: RangeReadableDocument, diagnostic: LanguageDiagnostic): LanguageCodeAction | undefined {
        const variableLine = document.lineAt(diagnostic.range.start.line);
        const variableText = variableLine.text.trim();
        const blockStartLine = this.findBlockStart(document, diagnostic.range.start.line);
        if (blockStartLine === -1) {
            return undefined;
        }

        const blockIndent = this.getLineIndentation(document, blockStartLine);
        let insertLine = blockStartLine + 1;
        while (true) {
            const line = document.lineAt(insertLine);
            const lineText = line.text.trim();
            if (lineText === '' || lineText.startsWith('//') || lineText.startsWith('/*')) {
                insertLine += 1;
                continue;
            }
            if (this.isVariableDeclaration(lineText)) {
                insertLine += 1;
                continue;
            }
            break;
        }

        return {
            title: '移动变量声明到当前代码块开头',
            kind: LANGUAGE_CODE_ACTION_KIND_QUICKFIX,
            diagnostics: [diagnostic],
            isPreferred: true,
            edit: this.createWorkspaceEdit(document.uri, [
                {
                    range: this.createLineRangeIncludingBreak(document, diagnostic.range.start.line, variableLine.text.length),
                    newText: ''
                },
                {
                    range: {
                        start: { line: insertLine, character: 0 },
                        end: { line: insertLine, character: 0 }
                    },
                    newText: `${blockIndent}    ${variableText}\n`
                }
            ])
        };
    }

    private createMoveVariableToFunctionStartAction(document: RangeReadableDocument, diagnostic: LanguageDiagnostic): LanguageCodeAction | undefined {
        const variableLine = document.lineAt(diagnostic.range.start.line);
        const variableText = variableLine.text.trim();
        const functionStartLine = this.findFunctionStart(document, diagnostic.range.start.line);
        if (functionStartLine === -1) {
            return undefined;
        }

        let functionBodyStart = functionStartLine;
        for (let line = functionStartLine; line <= diagnostic.range.start.line; line += 1) {
            if (document.lineAt(line).text.includes('{')) {
                functionBodyStart = line + 1;
                break;
            }
        }

        let insertLine = functionBodyStart;
        while (true) {
            const line = document.lineAt(insertLine);
            const lineText = line.text.trim();
            if (lineText === '' || lineText.startsWith('//') || lineText.startsWith('/*')) {
                insertLine += 1;
                continue;
            }
            if (this.isVariableDeclaration(lineText)) {
                insertLine += 1;
                continue;
            }
            break;
        }

        const functionIndent = this.getLineIndentation(document, functionBodyStart) || '    ';
        return {
            title: '移动变量声明到函数开头',
            kind: LANGUAGE_CODE_ACTION_KIND_QUICKFIX,
            diagnostics: [diagnostic],
            edit: this.createWorkspaceEdit(document.uri, [
                {
                    range: this.createLineRangeIncludingBreak(document, diagnostic.range.start.line, variableLine.text.length),
                    newText: ''
                },
                {
                    range: {
                        start: { line: insertLine, character: 0 },
                        end: { line: insertLine, character: 0 }
                    },
                    newText: `${functionIndent}${variableText}\n`
                }
            ])
        };
    }

    private createWorkspaceEdit(uri: string, edits: LanguageTextEdit[]): LanguageWorkspaceEdit {
        return {
            changes: {
                [uri]: edits
            }
        };
    }

    private createLineRange(document: RangeReadableDocument, line: number, textLength: number): LanguageRange {
        return {
            start: { line, character: 0 },
            end: { line, character: textLength }
        };
    }

    private createLineRangeIncludingBreak(document: RangeReadableDocument, line: number, textLength: number): LanguageRange {
        return {
            start: { line, character: 0 },
            end: { line, character: textLength + 1 }
        };
    }

    private shouldDeleteEntireLine(newLineText: string): boolean {
        return /^\s*[a-zA-Z_][a-zA-Z0-9_]*\s*\*?\s*;?\s*$/.test(newLineText) || newLineText.trim() === '';
    }

    private toSnakeCase(name: string): string {
        return name
            .replace(/([A-Z])/g, '_$1')
            .replace(/__/g, '_')
            .toLowerCase();
    }

    private toCamelCase(name: string): string {
        return name.replace(/_([a-zA-Z])/g, (_, g1: string) => g1.toUpperCase());
    }

    private getLineIndentation(document: RangeReadableDocument, lineNumber: number): string {
        const line = document.lineAt(lineNumber);
        const match = line.text.match(/^(\s*)/);
        return match ? match[1] : '';
    }

    private findBlockStart(document: RangeReadableDocument, lineNumber: number): number {
        let braceCount = 0;

        for (let line = lineNumber; line >= 0; line -= 1) {
            const lineText = document.lineAt(line).text;
            for (let index = lineText.length - 1; index >= 0; index -= 1) {
                const char = lineText[index];
                if (char === '}') {
                    braceCount += 1;
                } else if (char === '{') {
                    if (braceCount === 0) {
                        return line;
                    }
                    braceCount -= 1;
                }
            }
        }

        return -1;
    }

    private findFunctionStart(document: RangeReadableDocument, lineNumber: number): number {
        for (let line = lineNumber; line >= 0; line -= 1) {
            const lineText = document.lineAt(line).text.trim();
            if (/^(?:(?:public|private|protected|static|nosave|varargs)\s+)*(?:int|string|object|mixed|void|float|mapping|status)\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\([^)]*\)/.test(lineText)) {
                return line;
            }
        }

        return -1;
    }

    private isVariableDeclaration(lineText: string): boolean {
        return /^\s*(?:(?:public|private|protected|static|nosave)\s+)*(?:int|string|object|mixed|void|float|mapping|status)\s+[a-zA-Z_][a-zA-Z0-9_*\s,]*;/.test(lineText);
    }
}

export function createLanguageCodeActionService(): LanguageCodeActionService {
    return new DefaultLanguageCodeActionService();
}
