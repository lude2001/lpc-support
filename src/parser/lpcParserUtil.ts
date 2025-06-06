import { CharStreams, CommonTokenStream, CharStream, TokenStream, Recognizer, RecognitionException, ANTLRErrorListener } from 'antlr4';
import LPCLexer from '../../out/parser/LPCLexer.js';
import LPCParser from '../../out/parser/LPCParser.js';
import { ProgramContext } from '../../out/parser/LPCParser.js'; // Assuming 'program' is the entry rule and ANTLR generates context types

// Optional: Basic error listener for debugging
class ConsoleErrorListener implements ANTLRErrorListener<any> {
    syntaxError(
        recognizer: Recognizer<any, any>,
        offendingSymbol: any,
        line: number,
        column: number,
        msg: string,
        e: RecognitionException | undefined
    ): void {
        console.error(`Error at line ${line}:${column} - ${msg}`);
    }
}

export function parseLpcCode(code: string): ProgramContext {
    const inputStream: CharStream = CharStreams.fromString(code);
    const lexer: LPCLexer = new LPCLexer(inputStream);
    const tokenStream: CommonTokenStream = new CommonTokenStream(lexer);
    const parser: LPCParser = new LPCParser(tokenStream);

    // Optional: Add error listener
    parser.removeErrorListeners(); // Remove default console error listener
    parser.addErrorListener(new ConsoleErrorListener()); // Add custom one

    const tree: ProgramContext = parser.program(); // Assuming 'program' is your entry rule in LPC.g4
    return tree;
}

// Example of how you might use this utility (for testing purposes, not part of the util itself)
/*
if (require.main === module) {
    const sampleCode = `
        void main() {
            int x = 10;
            if (x > 5) {
                write("X is greater than 5");
            }
        }
    `;
    try {
        console.log("Attempting to parse LPC code...");
        const ast = parseLpcCode(sampleCode);
        console.log("Parsing successful. AST (entry rule context):", ast);
        // To explore the tree, you'd typically use a Visitor or Listener.
        // For example, ast.toStringTree(parser.ruleNames, parser) might give a string representation.
    } catch (error) {
        console.error("Parsing failed:", error);
    }
}
*/
