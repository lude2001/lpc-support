import { Trees } from 'antlr4ts/tree/Trees';
import { parseLPC } from './LPCParserUtil';

/**
 * 将 LPC 源代码解析并以 Lisp-风格式输出语法树，方便调试。
 */
export function getParseTreeString(code: string): string {
  const { parser, tree } = parseLPC(code);
  return Trees.toStringTree(tree, parser);
} 