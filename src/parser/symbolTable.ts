import { ParseTree } from 'antlr4/src/antlr4/tree/Tree'; // Adjusted import for ParseTree
import * as vscode from 'vscode'; // For Diagnostic if we create them here

export type SymbolKind =
    | 'variable'
    | 'function'
    | 'class'
    | 'parameter'
    | 'macro'
    | 'type_alias' // e.g. if LPC had typedefs
    | 'efun'
    | 'simul_efun'
    | 'lpc_keyword'
    | 'modifier'
    | 'operator'
    | 'unknown';

export interface LPCSymbol {
    name: string;
    kind: SymbolKind;
    type?: string; // Optional: store type information if available
    declarationNode: ParseTree; // The ANTLR node where this symbol is declared
    scope: Scope; // The scope in which this symbol is defined
    // Add more properties as needed, e.g., modifiers, if it's a function, parameters, etc.
}

export class Scope {
    parent: Scope | null;
    symbols: Map<string, LPCSymbol>;
    children: Scope[]; // Child scopes
    scopeNode: ParseTree; // The ANTLR node that defines this scope (e.g., FunctionDefinitionContext, CompoundStatementContext)

    constructor(parent: Scope | null, scopeNode: ParseTree) {
        this.parent = parent;
        this.symbols = new Map<string, LPCSymbol>();
        this.children = [];
        this.scopeNode = scopeNode;
    }

    // Define a symbol in the current scope
    define(symbol: LPCSymbol): void {
        this.symbols.set(symbol.name, symbol);
    }

    // Look up a symbol in the current scope and its parent scopes
    resolve(name: string): LPCSymbol | undefined {
        let currentScope: Scope | null = this;
        while (currentScope) {
            const symbol = currentScope.symbols.get(name);
            if (symbol) {
                return symbol;
            }
            currentScope = currentScope.parent;
        }
        return undefined;
    }

    // Add a child scope
    addChild(childScope: Scope): void {
        this.children.push(childScope);
    }
}
