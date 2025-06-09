import { RecognitionException, Recognizer } from 'antlr4ts';
import { ATNSimulator } from 'antlr4ts/atn/ATNSimulator';
import { ANTLRErrorListener } from 'antlr4ts/ANTLRErrorListener';
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

export class LpcErrorListener implements ANTLRErrorListener<any> {
    private diagnostics: Diagnostic[] = [];

    constructor(private readonly document: TextDocument) {}

    syntaxError<T>(
        recognizer: Recognizer<T, ATNSimulator>,
        offendingSymbol: T | undefined,
        line: number,
        charPositionInLine: number,
        msg: string,
        e: RecognitionException | undefined
    ): void {
        const range = {
            start: { line: line - 1, character: charPositionInLine },
            end: { line: line - 1, character: charPositionInLine + 1 } // Default to 1 char length
        };

        // If the offending symbol has a start and stop index, use it for a better range
        if (offendingSymbol && (offendingSymbol as any).startIndex && (offendingSymbol as any).stopIndex) {
            const start = this.document.positionAt((offendingSymbol as any).startIndex);
            const end = this.document.positionAt((offendingSymbol as any).stopIndex + 1);
            range.start = start;
            range.end = end;
        } else {
            // Fallback for when there's no offending symbol info
            const lineText = this.document.getText({
                start: { line: line - 1, character: 0 },
                end: { line: line - 1, character: Number.MAX_VALUE }
            });
            const endChar = charPositionInLine + (lineText.substring(charPositionInLine).match(/^\w+/) || [''])[0].length;
            range.end = { line: line - 1, character: endChar };
        }


        const diagnostic: Diagnostic = {
            severity: DiagnosticSeverity.Error,
            range,
            message: msg,
            source: 'LPC Parser'
        };

        this.diagnostics.push(diagnostic);
    }

    getDiagnostics(): Diagnostic[] {
        return this.diagnostics;
    }
} 