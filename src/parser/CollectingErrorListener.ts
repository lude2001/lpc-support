import { ANTLRErrorListener } from 'antlr4ts/ANTLRErrorListener';
import { RecognitionException } from 'antlr4ts';
import { Recognizer } from 'antlr4ts/Recognizer';
import * as vscode from 'vscode';

export class CollectingErrorListener implements ANTLRErrorListener<any> {
  public readonly diagnostics: vscode.Diagnostic[] = [];

  constructor(private readonly document: vscode.TextDocument) {
  }

  syntaxError(
    recognizer: Recognizer<any, any>,
    offendingSymbol: any,
    line: number,
    charPositionInLine: number,
    msg: string,
    e: RecognitionException | undefined
  ): void {
    // ANTLR 的行号从 1 开始，而 VSCode 的 Position 从 0 开始
    const lineIndex = line - 1;
    const startColumn = charPositionInLine;

    let length = 1;
    if (offendingSymbol && typeof offendingSymbol.text === 'string') {
      length = offendingSymbol.text.length || 1;
    }

    const range = new vscode.Range(
      new vscode.Position(lineIndex, startColumn),
      new vscode.Position(lineIndex, startColumn + length)
    );

    const diagnostic = new vscode.Diagnostic(range, msg, vscode.DiagnosticSeverity.Error);
    diagnostic.source = 'ANTLR';
    this.diagnostics.push(diagnostic);
  }
} 