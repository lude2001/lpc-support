import * as vscode from 'vscode';
import { CharStreams, CommonTokenStream, Token, ParserRuleContext as AntlrParserRuleContext } from 'antlr4';
import { ParseTreeWalker, TerminalNode, ParseTree } from 'antlr4/src/antlr4/tree/Tree';
import LPCLexer from '../../out/parser/LPCLexer.js';
import LPCParser, { ProgramContext } from '../../out/parser/LPCParser.js';
import { LPCSymbolTableListener } from './parser/lpcSymbolTableListener'; // Adjusted path
import { LPCSymbol, Scope } from './parser/symbolTable'; // Adjusted path

// Helper function to find the ParseTree node (specifically TerminalNode) at a given offset
function findNodeAtOffset(node: ParseTree | null, offset: number): TerminalNode | null {
    if (!node) {
        return null;
    }

    if (node instanceof TerminalNode) {
        const symbol = node.getSymbol();
        if (symbol.start <= offset && symbol.stop >= offset) {
            return node;
        }
        return null;
    }

    if (node instanceof AntlrParserRuleContext) {
        const prc = node as AntlrParserRuleContext;
        // Check if the offset is within the range of this rule context
        if (prc.start && prc.stop && prc.start.start <= offset && prc.stop.stop >= offset) {
            // Search children
            for (let i = 0; i < node.getChildCount(); i++) {
                const child = node.getChild(i);
                if (child) {
                    const foundNode = findNodeAtOffset(child, offset);
                    if (foundNode) {
                        return foundNode;
                    }
                }
            }
            // If no child TerminalNode found at the offset, but offset is within this rule,
            // this rule itself might be the most specific context, but we want a TerminalNode.
            // This can happen if hovering over whitespace within a rule.
            return null; // Only return terminal nodes
        }
        return null;
    }
    return null;
}

// Helper to find the most specific scope at a given text offset
function findScopeAtOffset(startingScope: Scope, offset: number): Scope {
    let bestMatch: Scope = startingScope;

    function findRecursive(currentScope: Scope) {
        const scopeNode = currentScope.scopeNode;
        let nodeStartOffset = -1;
        let nodeEndOffset = -1;

        if (scopeNode instanceof AntlrParserRuleContext) {
            if (scopeNode.start && scopeNode.stop) {
                nodeStartOffset = scopeNode.start.start;
                nodeEndOffset = scopeNode.stop.stop;
            }
        }

        if (nodeStartOffset !== -1 && nodeEndOffset !== -1 && offset >= nodeStartOffset && offset <= nodeEndOffset) {
            bestMatch = currentScope;
            for (const childScope of currentScope.children) {
                findRecursive(childScope);
            }
        }
    }

    if (startingScope.scopeNode) {
        findRecursive(startingScope);
    }
    return bestMatch;
}


export class LPCHoverProvider implements vscode.HoverProvider {
    async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        cancellationToken: vscode.CancellationToken
    ): Promise<vscode.Hover | null> {

        // console.log(`Hover request for ${document.uri} at ${position.line}:${position.character}`);

        try {
            const text = document.getText();
            const inputStream = CharStreams.fromString(text);
            const lexer = new LPCLexer(inputStream);
            lexer.removeErrorListeners();
            const tokenStream = new CommonTokenStream(lexer);
            const parser = new LPCParser(tokenStream);
            parser.removeErrorListeners();
            const tree = parser.program(); // Assuming 'program' is the entry rule

            if (cancellationToken.isCancellationRequested) return null;

            const symbolTableListener = new LPCSymbolTableListener(parser);
            if (tree) {
                symbolTableListener.globalScope.scopeNode = tree;
            }
            ParseTreeWalker.DEFAULT.walk(symbolTableListener, tree);

            if (cancellationToken.isCancellationRequested) return null;

            const offset = document.offsetAt(position);
            const terminalNode = findNodeAtOffset(tree, offset);

            if (terminalNode && terminalNode.getSymbol().type === LPCLexer.IDENTIFIER) {
                const identifierText = terminalNode.getText();
                // console.log(`Found IDENTIFIER: ${identifierText} at offset ${offset}`);

                const currentScope = findScopeAtOffset(symbolTableListener.globalScope, offset);
                const symbol = currentScope.resolve(identifierText);

                if (symbol) {
                    // Assume LPCSymbol has 'kind' and 'type' properties.
                    // The 'kind' (variable, function, class, parameter) would ideally be set in LPCSymbolTableListener.
                    // For now, we'll make a placeholder for 'kind'.
                    const symbolKind = (symbol as any).kind || 'identifier'; // Fallback kind
                    const symbolType = symbol.type || 'unknown';

                    let declarationLine = -1;
                    if (symbol.declarationNode instanceof TerminalNode) {
                        declarationLine = symbol.declarationNode.getSymbol().line;
                    } else if (symbol.declarationNode instanceof AntlrParserRuleContext) {
                        declarationLine = symbol.declarationNode.start.line;
                    }

                    const markdownString = new vscode.MarkdownString();
                    markdownString.appendCodeblock(`(${symbolKind}) ${symbolType} ${symbol.name}`, 'lpc');
                    if (declarationLine !== -1) {
                        markdownString.appendMarkdown(`\n*Declared at line ${declarationLine}*`);
                    }
                    // Could add more info like scope, file path if symbol table supports it.
                    // console.log(`Symbol found: ${symbol.name}, Hover: ${markdownString.value}`);
                    return new vscode.Hover(markdownString);
                } else {
                    // console.log(`Symbol not found: ${identifierText}`);
                }
            } else {
                // console.log(`No terminal node or not an IDENTIFIER at offset ${offset}. Node: ${terminalNode?.getText()}`);
            }

        } catch (error) {
            console.error("Error during hover provider processing:", error);
        }

        return null;
    }
}
