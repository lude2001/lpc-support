import { CharStreams, CommonTokenStream } from 'antlr4ts';
import { LPCLexer } from '../antlr/LPCLexer';
import { LPCParser } from '../antlr/LPCParser';

/**
 * LEGACY DEBUG-ONLY PARSER ENTRY
 *
 * Allowed:
 * - Parse-tree debugging helpers such as `ParseTreePrinter`.
 *
 * Forbidden:
 * - Production providers or caches importing this utility instead of `ParsedDocumentService`.
 * - Adding alternative parser behavior that diverges from the main parser service.
 *
 * Removal phase:
 * - Delete after debug tooling is migrated to reuse ParsedDocumentService output.
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
