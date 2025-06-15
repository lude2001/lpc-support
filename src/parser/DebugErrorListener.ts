import { ANTLRErrorListener } from 'antlr4ts/ANTLRErrorListener';
import { RecognitionException, Token } from 'antlr4ts';
import { Recognizer } from 'antlr4ts/Recognizer';

export interface DebugSyntaxError {
  line: number;
  column: number;
  offendingToken: string;
  message: string;
  ruleStack: string[];
}

export class DebugErrorListener implements ANTLRErrorListener<any> {
  public readonly errors: DebugSyntaxError[] = [];

  syntaxError(
    recognizer: Recognizer<any, any>,
    offendingSymbol: Token | undefined,
    line: number,
    charPositionInLine: number,
    msg: string,
    e: RecognitionException | undefined
  ): void {
    const ruleStack: string[] =
      typeof (recognizer as any).getRuleInvocationStack === 'function'
        ? (recognizer as any).getRuleInvocationStack()
        : [];
    const offending = offendingSymbol?.text ?? '<no token>';

    this.errors.push({
      line,
      column: charPositionInLine,
      offendingToken: offending,
      message: msg,
      ruleStack: ruleStack.reverse() // 更直观：从入口到出错规则
    });
  }
} 