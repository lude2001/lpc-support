import { CharStreams, CommonTokenStream } from 'antlr4ts';
import { LPCLexer } from '../antlr/LPCLexer';
import { LPCParser } from '../antlr/LPCParser';

/**
 * 使用 ANTLR 生成的词法、语法解析器将 LPC 代码解析为 ParseTree。
 * 如果语法不完整或出现错误，ANTLR 会抛出异常，调用方可捕获进行诊断。
 */
export function parseLPC(code: string) {
  const input = CharStreams.fromString(code);
  const lexer = new LPCLexer(input);
  const tokenStream = new CommonTokenStream(lexer);
  const parser = new LPCParser(tokenStream);
  // 入口规则与 LPC.g4 中保持一致
  const tree = parser.sourceFile();
  return { parser, tree };
} 