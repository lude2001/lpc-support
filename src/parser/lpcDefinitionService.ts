import * as vscode from 'vscode';
import { CharStreams, CommonTokenStream, Token, ParserRuleContext as AntlrParserRuleContext } from 'antlr4';
import { ParseTreeWalker, TerminalNode, ParseTree } from 'antlr4/src/antlr4/tree/Tree';
import LPCLexer from '../../../out/parser/LPCLexer.js'; // Adjusted path assuming this file is in src/parser/
import LPCParser, { ProgramContext, PrimaryExpressionContext } from '../../../out/parser/LPCParser.js'; // Adjusted path
import { LPCSymbolTableListener } from './lpcSymbolTableListener';
import { LPCSymbol, Scope } from './symbolTable';

// Helper function to find the ParseTree node (specifically TerminalNode) at a given offset
function findNodeAtOffset(node: ParseTree | null, offset: number): TerminalNode | null {
    if (!node) {
        return null;
    }

    if (node instanceof TerminalNode) {
        const symbol = node.getSymbol();
        // Check if the offset is within the start and stop of the token
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
                        return foundNode; // Return the deepest TerminalNode found
                    }
                }
            }
            // If no child TerminalNode found at the offset, but offset is within this rule,
            // it means we are likely on whitespace or between tokens within this rule.
            return null;
        }
        return null;
    }
    return null;
}

// Helper to find the most specific scope at a given text offset
function findScopeAtOffset(startingScope: Scope | undefined, offset: number): Scope | undefined {
    if (!startingScope) return undefined;
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
        } else if (scopeNode instanceof TerminalNode) {
            nodeStartOffset = scopeNode.getSymbol().start;
            nodeEndOffset = scopeNode.getSymbol().stop;
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

export async function findDefinitionUsingParser(
    document: vscode.TextDocument,
    position: vscode.Position
): Promise<vscode.Location | null> {

    // console.log(`findDefinitionUsingParser: Request for ${document.uri} at L${position.line}C${position.character}`);

    try {
        const text = document.getText();
        const inputStream = CharStreams.fromString(text);
        const lexer = new LPCLexer(inputStream);
        lexer.removeErrorListeners();
        const tokenStream = new CommonTokenStream(lexer);
        const parser = new LPCParser(tokenStream);
        parser.removeErrorListeners();

        const tree = parser.program();

        const symbolTableListener = new LPCSymbolTableListener(parser);
        if (tree) {
            // Set the ProgramContext as the node for the global scope before walking
            symbolTableListener.globalScope.scopeNode = tree;
        }
        ParseTreeWalker.DEFAULT.walk(symbolTableListener, tree);

        const globalScope = symbolTableListener.globalScope;
        const offset = document.offsetAt(position);

        const terminalNodeAtPosition = findNodeAtOffset(tree, offset);

        if (terminalNodeAtPosition && terminalNodeAtPosition.getSymbol().type === LPCLexer.IDENTIFIER) {
            const identifierText = terminalNodeAtPosition.getText();
            // console.log(`Found IDENTIFIER "${identifierText}" at offset ${offset}`);

            const currentScope = findScopeAtOffset(globalScope, offset);
            if (currentScope) {
                // console.log(`Current scope for "${identifierText}" is a scope defined by a node of type: ${currentScope.scopeNode?.constructor?.name}`);
                const symbol = currentScope.resolve(identifierText);

                if (symbol && symbol.declarationNode) {
                    // The LPCSymbolTableListener is designed to store the TerminalNode of the identifier as declarationNode
                    let declarationAntlrToken: Token | undefined;

                    if (symbol.declarationNode instanceof TerminalNode) {
                        declarationAntlrToken = symbol.declarationNode.getSymbol();
                    }
                    // This else-if might be redundant if listener always stores TerminalNode
                    else if (symbol.declarationNode instanceof AntlrParserRuleContext && symbol.declarationNode.start) {
                        // This would point to the start of the rule, not the identifier itself.
                        // Prefer the direct TerminalNode if available.
                        // This case indicates that LPCSymbol.declarationNode might not always be the IDENTIFIER itself.
                        // For now, we assume the listener correctly sets declarationNode to the IDENTIFIER's TerminalNode.
                        // If not, LPCSymbolTableListener needs adjustment.
                        // Let's assume for now that LPCSymbolTableListener stores the TerminalNode of the identifier.
                        // declarationToken = symbol.declarationNode.start;
                        console.warn("Symbol's declarationNode is a ParserRuleContext, expected TerminalNode for precise location.");
                    }

                    if (declarationAntlrToken) {
                        const declLine = declarationAntlrToken.line - 1;
                        const declChar = declarationAntlrToken.column;
                        const declTextLength = declarationAntlrToken.text?.length || identifierText.length;

                        const range = new vscode.Range(declLine, declChar, declLine, declChar + declTextLength);
                        // console.log(`Definition found for "${identifierText}": L${declLine}C${declChar}`);
                        return new vscode.Location(document.uri, range);
                    } else {
                        // console.log(`Symbol "${identifierText}" found, but declarationNode.symbol is not a valid Token.`);
                    }
                } else {
                    // console.log(`Symbol "${identifierText}" not resolved in current scope or parents.`);
                }
            } else {
                // console.log(`No current scope found at offset ${offset}. This should not happen if globalScope is properly initialized.`);
            }
        } else {
            // console.log(`No IDENTIFIER terminal node found at offset ${offset}. Found: ${terminalNodeAtPosition?.getText()}`);
        }
    } catch (error) {
        console.error("Error during ANTLR parsing for findDefinitionUsingParser:", error);
    }

    return null;
}
