import {
    LANGUAGE_CODE_ACTION_KIND_QUICKFIX,
    type LanguageCodeAction,
    type LanguageDiagnostic,
    type RangeReadableDocument
} from './types';
import { CodeActionDocumentSupport } from './CodeActionDocumentSupport';

export class VariablePositionCodeActionBuilder {
    public constructor(private readonly support: CodeActionDocumentSupport) {}

    public build(document: RangeReadableDocument, diagnostic: LanguageDiagnostic): LanguageCodeAction[] {
        const actions: LanguageCodeAction[] = [];

        const moveToBlockStartAction = this.createMoveVariableToBlockStartAction(document, diagnostic);
        if (moveToBlockStartAction) {
            actions.push(moveToBlockStartAction);
        }

        const moveToFunctionStartAction = this.createMoveVariableToFunctionStartAction(document, diagnostic);
        if (moveToFunctionStartAction) {
            actions.push(moveToFunctionStartAction);
        }

        return actions;
    }

    private createMoveVariableToBlockStartAction(document: RangeReadableDocument, diagnostic: LanguageDiagnostic): LanguageCodeAction | undefined {
        const variableLine = document.lineAt(diagnostic.range.start.line);
        const variableText = variableLine.text.trim();
        const blockStartLine = this.support.findBlockStart(document, diagnostic.range.start.line);
        if (blockStartLine === -1) {
            return undefined;
        }

        const blockIndent = this.support.getLineIndentation(document, blockStartLine);
        let insertLine = blockStartLine + 1;
        while (true) {
            const line = document.lineAt(insertLine);
            const lineText = line.text.trim();
            if (lineText === '' || lineText.startsWith('//') || lineText.startsWith('/*')) {
                insertLine += 1;
                continue;
            }
            if (this.support.isVariableDeclaration(lineText)) {
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
            edit: this.support.createWorkspaceEdit(document.uri, [
                {
                    range: this.support.createLineRangeIncludingBreak(document, diagnostic.range.start.line, variableLine.text.length),
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
        const functionStartLine = this.support.findFunctionStart(document, diagnostic.range.start.line);
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
            if (this.support.isVariableDeclaration(lineText)) {
                insertLine += 1;
                continue;
            }
            break;
        }

        const functionIndent = this.support.getLineIndentation(document, functionBodyStart) || '    ';
        return {
            title: '移动变量声明到函数开头',
            kind: LANGUAGE_CODE_ACTION_KIND_QUICKFIX,
            diagnostics: [diagnostic],
            edit: this.support.createWorkspaceEdit(document.uri, [
                {
                    range: this.support.createLineRangeIncludingBreak(document, diagnostic.range.start.line, variableLine.text.length),
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
}
