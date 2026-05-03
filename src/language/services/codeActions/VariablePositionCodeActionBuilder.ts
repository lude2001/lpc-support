import {
    LANGUAGE_CODE_ACTION_KIND_QUICKFIX,
    type LanguageCodeAction,
    type LanguageDiagnostic,
    type RangeReadableDocument
} from './types';
import { CodeActionDocumentSupport } from './CodeActionDocumentSupport';
import { SyntaxDocument, SyntaxKind, SyntaxNode } from '../../../syntax/types';

export class VariablePositionCodeActionBuilder {
    public constructor(private readonly support: CodeActionDocumentSupport) {}

    public build(
        document: RangeReadableDocument,
        diagnostic: LanguageDiagnostic,
        syntax?: SyntaxDocument
    ): LanguageCodeAction[] {
        const actions: LanguageCodeAction[] = [];

        const moveToBlockStartAction = this.createMoveVariableToBlockStartAction(document, diagnostic, syntax);
        if (moveToBlockStartAction) {
            actions.push(moveToBlockStartAction);
        }

        const moveToFunctionStartAction = this.createMoveVariableToFunctionStartAction(document, diagnostic, syntax);
        if (moveToFunctionStartAction) {
            actions.push(moveToFunctionStartAction);
        }

        return actions;
    }

    private createMoveVariableToBlockStartAction(
        document: RangeReadableDocument,
        diagnostic: LanguageDiagnostic,
        syntax?: SyntaxDocument
    ): LanguageCodeAction | undefined {
        const variableLine = document.lineAt(diagnostic.range.start.line);
        const variableText = variableLine.text.trim();
        const blockStartLine = this.findContainingBlockStartLine(syntax, diagnostic)
            ?? this.support.findBlockStart(document, diagnostic.range.start.line);
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

    private createMoveVariableToFunctionStartAction(
        document: RangeReadableDocument,
        diagnostic: LanguageDiagnostic,
        syntax?: SyntaxDocument
    ): LanguageCodeAction | undefined {
        const variableLine = document.lineAt(diagnostic.range.start.line);
        const variableText = variableLine.text.trim();
        const functionStartLine = this.findContainingFunctionStartLine(syntax, diagnostic)
            ?? this.support.findFunctionStart(document, diagnostic.range.start.line);
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

    private findContainingBlockStartLine(
        syntax: SyntaxDocument | undefined,
        diagnostic: LanguageDiagnostic
    ): number | undefined {
        return this.findSmallestContainingNode(syntax, diagnostic, SyntaxKind.Block)?.range.start.line;
    }

    private findContainingFunctionStartLine(
        syntax: SyntaxDocument | undefined,
        diagnostic: LanguageDiagnostic
    ): number | undefined {
        return this.findSmallestContainingNode(syntax, diagnostic, SyntaxKind.FunctionDeclaration)?.range.start.line;
    }

    private findSmallestContainingNode(
        syntax: SyntaxDocument | undefined,
        diagnostic: LanguageDiagnostic,
        kind: SyntaxKind
    ): SyntaxNode | undefined {
        if (!syntax) {
            return undefined;
        }

        const candidates = syntax.nodes
            .filter((node) => node.kind === kind && containsRange(node.range, diagnostic.range))
            .sort((left, right) => getRangeSize(left.range) - getRangeSize(right.range));

        return candidates[0];
    }
}

function containsRange(
    outer: { start: { line: number; character: number }; end: { line: number; character: number } },
    inner: LanguageDiagnostic['range']
): boolean {
    return comparePositions(outer.start, inner.start) <= 0
        && comparePositions(outer.end, inner.end) >= 0;
}

function comparePositions(
    left: { line: number; character: number },
    right: { line: number; character: number }
): number {
    if (left.line !== right.line) {
        return left.line - right.line;
    }

    return left.character - right.character;
}

function getRangeSize(range: { start: { line: number; character: number }; end: { line: number; character: number } }): number {
    return (range.end.line - range.start.line) * 10_000
        + (range.end.character - range.start.character);
}
