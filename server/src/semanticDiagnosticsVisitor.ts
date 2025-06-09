import { AbstractParseTreeVisitor } from 'antlr4ts/tree/AbstractParseTreeVisitor';
import { Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver/node';
import { ExpressionContext, FunctionDeclarationContext, IdentifierContext, VariableDeclarationContext, VariableDeclaratorContext } from './parser/LPCParser';
import { LPCVisitor } from './parser/LPCVisitor';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { TerminalNode } from 'antlr4ts/tree/TerminalNode';
import { ParseTree } from 'antlr4ts/tree/ParseTree';
import { getIdentifierInfo } from './utils';

/**
 * Represents a single scope (e.g., a function body) containing symbols.
 */
class Scope {
    public symbols: Map<string, { used: boolean; range: Range }> = new Map();
    constructor(public parent: Scope | null) {}

    public define(name: string, range: Range) {
        this.symbols.set(name, { used: false, range });
    }

    public resolve(name: string): boolean {
        const symbol = this.symbols.get(name);
        if (symbol) {
            symbol.used = true;
            return true;
        }
        return this.parent?.resolve(name) ?? false;
    }
}

class LpcFunctionCollectorVisitor extends AbstractParseTreeVisitor<void> implements LPCVisitor<void> {
    constructor(private functions: Set<string>) {
        super();
    }
    visitFunctionDeclaration(ctx: FunctionDeclarationContext): void {
        const identifier = ctx.identifier();
        const info = getIdentifierInfo(identifier);
        if (info) {
            this.functions.add(info.name);
        }
    }
    protected defaultResult() {}
}

export class LpcSemanticDiagnosticsVisitor extends AbstractParseTreeVisitor<void> implements LPCVisitor<void> {

    private diagnostics: Diagnostic[] = [];
    private currentScope: Scope = new Scope(null);
    private declaredFunctions: Set<string> = new Set();
    private currentFunctionRange: Range | undefined;

    constructor(private readonly document: TextDocument) {
        super();
    }
    
    protected defaultResult(): void {
        return;
    }

    /**
     * Runs a pre-pass over the tree to collect all function declarations.
     * This must be called before the main `visit` call.
     * @param tree The root of the parse tree.
     */
    public runPrePass(tree: ParseTree): void {
        const collector = new LpcFunctionCollectorVisitor(this.declaredFunctions);
        collector.visit(tree);
    }

    // --- Scope Management ---
    private enterScope(): void {
        this.currentScope = new Scope(this.currentScope);
    }

    private exitScope(): void {
        // Report unused variables before exiting the scope
        for (const [name, symbol] of this.currentScope.symbols.entries()) {
            if (!symbol.used) {
                this.diagnostics.push({
                    severity: DiagnosticSeverity.Warning,
                    range: symbol.range,
                    message: `Variable '${name}' is declared but never used.`,
                    source: 'LPC Semantics'
                });
            }
        }
        this.currentScope = this.currentScope.parent!;
    }
    
    visitFunctionDeclaration(ctx: FunctionDeclarationContext): void {
        this.enterScope();
        // Define function parameters in the new scope
        const paramList = ctx.parameterList();
        if (paramList) {
            for (const param of paramList.parameter()) {
                const identifier = param.identifier();
                const info = getIdentifierInfo(identifier);
                if (!info) continue;

                const range = {
                    start: this.document.positionAt(info.token.startIndex),
                    end: this.document.positionAt(info.token.stopIndex + 1),
                };
                this.currentScope.define(info.name, range);
            }
        }
        this.currentFunctionRange = {
            start: this.document.positionAt(ctx.start.startIndex),
            end: this.document.positionAt(ctx.stop!.stopIndex + 1),
        };
        this.visitChildren(ctx);
        this.currentFunctionRange = undefined;
        this.exitScope();
    }

    visitVariableDeclaration(ctx: VariableDeclarationContext): void {
        for (const declarator of ctx.variableDeclarator()) {
            const identifier = declarator.identifier();
            const info = getIdentifierInfo(identifier);
            if (info) {
                const range = {
                    start: this.document.positionAt(info.token.startIndex),
                    end: this.document.positionAt(info.token.stopIndex + 1),
                };
                this.currentScope.define(info.name, range);
            }
        }

        // Also visit the expression part of the declaration if it exists
        this.visitChildren(ctx);
    }

    private isBuiltIn(name: string): boolean {
        // This is a placeholder for a real list of LPC efuncs/built-ins
        const builtIns = new Set(['write', 'this_object', 'environment', 'find_player', 'say', 'tell_object', 'sizeof', 'filter_array', 'all_inventory', 'base_name', 'clonep', 'new', 'destruct', 'geteuid', 'seteuid', 'objectp', 'stringp', 'random', 'member_array', 'command', 'reset_eval_cost', 'is_character', 'userp', 'query_dex']);
        return builtIns.has(name);
    }

    visitIdentifier(ctx: IdentifierContext): void {
        const parent = ctx.parent;
        if (!parent) return;

        // If this identifier is the function name in a declaration, we don't need to check it.
        if (parent instanceof FunctionDeclarationContext && parent.identifier() === ctx) {
            return;
        }

        // If this identifier is a variable name in a declaration, we don't need to check it.
        if (parent instanceof VariableDeclaratorContext) {
            return;
        }
        
        const name = getIdentifierInfo(ctx)?.name;
        if (!name) return;

        // Is it a function call?
        if (parent instanceof ExpressionContext && parent.text.endsWith(')')) {
            const children = parent.children;
            if (children && children.length > 1 && children[1].text === '(') {
                 if (!this.declaredFunctions.has(name) && !this.isBuiltIn(name)) {
                     this.diagnostics.push({
                         severity: DiagnosticSeverity.Warning,
                         range: {
                             start: this.document.positionAt(ctx.start.startIndex),
                             end: this.document.positionAt(ctx.stop!.stopIndex + 1),
                         },
                         message: `Function '${name}' is not defined.`,
                         source: 'LPC Semantic'
                     });
                 }
                 return; // It's a function call, don't check as a variable
            }
        }
        
        // It's not a declaration or a function call, so it must be a variable.
        // Let's resolve it in the current scope.
        if (!this.currentScope.resolve(name)) {
             this.diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                range: {
                    start: this.document.positionAt(ctx.start.startIndex),
                    end: this.document.positionAt(ctx.stop!.stopIndex + 1),
                },
                message: `Variable or function '${name}' is not defined.`,
                source: 'LPC Semantic'
            });
        }
    }

    visitExpression(ctx: ExpressionContext): void {
        // Check for function calls
        if (ctx.childCount === 2 && ctx.getChild(0) instanceof IdentifierContext && ctx.getChild(1).text === '(') {
            const funcNameCtx = ctx.getChild(0) as IdentifierContext;
            const info = getIdentifierInfo(funcNameCtx);

            if (info && !this.declaredFunctions.has(info.name)) {
                const range = {
                    start: this.document.positionAt(info.token.startIndex),
                    end: this.document.positionAt(info.token.stopIndex + 1)
                };
                this.diagnostics.push({
                    severity: DiagnosticSeverity.Error,
                    range: range,
                    message: `Call to undefined function '${info.name}'.`,
                    source: 'LPC Semantics'
                });
            }
        }
        
        // Continue traversal
        this.visitChildren(ctx);
    }

    getDiagnostics(): Diagnostic[] {
        return this.diagnostics;
    }
} 