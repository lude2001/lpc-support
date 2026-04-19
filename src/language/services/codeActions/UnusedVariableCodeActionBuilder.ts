import {
    LANGUAGE_CODE_ACTION_KIND_QUICKFIX,
    type DiagnosticWithOffsets,
    type LanguageCodeAction,
    type LanguageDiagnostic,
    type RangeReadableDocument
} from './types';
import { CodeActionDocumentSupport } from './CodeActionDocumentSupport';

export class UnusedVariableCodeActionBuilder {
    public constructor(private readonly support: CodeActionDocumentSupport) {}

    public build(document: RangeReadableDocument, diagnostic: LanguageDiagnostic): LanguageCodeAction[] {
        const actions: LanguageCodeAction[] = [];

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

        return actions;
    }

    private createRemoveVariableAction(document: RangeReadableDocument, diagnostic: LanguageDiagnostic): LanguageCodeAction | undefined {
        const line = document.lineAt(diagnostic.range.start.line);
        const lineText = line.text;

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

        const replaceRange = this.support.shouldDeleteEntireLine(newLineText)
            ? this.support.createLineRangeIncludingBreak(document, diagnostic.range.start.line, line.text.length)
            : this.support.createLineRange(document, diagnostic.range.start.line, line.text.length);
        const newText = this.support.shouldDeleteEntireLine(newLineText) ? '' : newLineText;

        return {
            title: '删除未使用的变量',
            kind: LANGUAGE_CODE_ACTION_KIND_QUICKFIX,
            diagnostics: [diagnostic],
            isPreferred: true,
            edit: this.support.createWorkspaceEdit(document.uri, [
                {
                    range: replaceRange,
                    newText
                }
            ])
        };
    }

    private createCommentVariableAction(document: RangeReadableDocument, diagnostic: LanguageDiagnostic): LanguageCodeAction | undefined {
        const offsetData = (diagnostic as DiagnosticWithOffsets).data;

        let targetRange;
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
            targetRange = this.support.createLineRange(document, diagnostic.range.start.line, line.text.length);
        }

        const original = document.getText(targetRange);
        return {
            title: '注释未使用的变量',
            kind: LANGUAGE_CODE_ACTION_KIND_QUICKFIX,
            diagnostics: [diagnostic],
            edit: this.support.createWorkspaceEdit(document.uri, [
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
            edit: this.support.createWorkspaceEdit(document.uri, [
                {
                    range: this.support.createLineRange(document, diagnostic.range.start.line, line.text.length),
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

        const newName = mode === 'snake' ? this.support.toSnakeCase(oldName) : this.support.toCamelCase(oldName);
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
}
