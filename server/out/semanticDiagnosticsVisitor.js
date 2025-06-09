"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LpcSemanticDiagnosticsVisitor = void 0;
const AbstractParseTreeVisitor_1 = require("antlr4ts/tree/AbstractParseTreeVisitor");
const node_1 = require("vscode-languageserver/node");
const LPCParser_1 = require("./parser/LPCParser");
const utils_1 = require("./utils");
/**
 * Represents a single scope (e.g., a function body) containing symbols.
 */
class Scope {
    constructor(parent) {
        this.parent = parent;
        this.symbols = new Map();
    }
    define(name, range) {
        this.symbols.set(name, { used: false, range });
    }
    resolve(name) {
        var _a, _b;
        const symbol = this.symbols.get(name);
        if (symbol) {
            symbol.used = true;
            return true;
        }
        return (_b = (_a = this.parent) === null || _a === void 0 ? void 0 : _a.resolve(name)) !== null && _b !== void 0 ? _b : false;
    }
}
class LpcFunctionCollectorVisitor extends AbstractParseTreeVisitor_1.AbstractParseTreeVisitor {
    constructor(functions) {
        super();
        this.functions = functions;
    }
    visitFunctionDeclaration(ctx) {
        const identifier = ctx.identifier();
        const info = (0, utils_1.getIdentifierInfo)(identifier);
        if (info) {
            this.functions.add(info.name);
        }
    }
    defaultResult() { }
}
class LpcSemanticDiagnosticsVisitor extends AbstractParseTreeVisitor_1.AbstractParseTreeVisitor {
    constructor(document) {
        super();
        this.document = document;
        this.diagnostics = [];
        this.currentScope = new Scope(null);
        this.declaredFunctions = new Set();
    }
    defaultResult() {
        return;
    }
    /**
     * Runs a pre-pass over the tree to collect all function declarations.
     * This must be called before the main `visit` call.
     * @param tree The root of the parse tree.
     */
    runPrePass(tree) {
        const collector = new LpcFunctionCollectorVisitor(this.declaredFunctions);
        collector.visit(tree);
    }
    // --- Scope Management ---
    enterScope() {
        this.currentScope = new Scope(this.currentScope);
    }
    exitScope() {
        // Report unused variables before exiting the scope
        for (const [name, symbol] of this.currentScope.symbols.entries()) {
            if (!symbol.used) {
                this.diagnostics.push({
                    severity: node_1.DiagnosticSeverity.Warning,
                    range: symbol.range,
                    message: `Variable '${name}' is declared but never used.`,
                    source: 'LPC Semantics'
                });
            }
        }
        this.currentScope = this.currentScope.parent;
    }
    visitFunctionDeclaration(ctx) {
        this.enterScope();
        // Define function parameters in the new scope
        const paramList = ctx.parameterList();
        if (paramList) {
            for (const param of paramList.parameter()) {
                const identifier = param.identifier();
                const info = (0, utils_1.getIdentifierInfo)(identifier);
                if (!info)
                    continue;
                const range = {
                    start: this.document.positionAt(info.token.startIndex),
                    end: this.document.positionAt(info.token.stopIndex + 1),
                };
                this.currentScope.define(info.name, range);
            }
        }
        this.currentFunctionRange = {
            start: this.document.positionAt(ctx.start.startIndex),
            end: this.document.positionAt(ctx.stop.stopIndex + 1),
        };
        this.visitChildren(ctx);
        this.currentFunctionRange = undefined;
        this.exitScope();
    }
    visitVariableDeclaration(ctx) {
        for (const declarator of ctx.variableDeclarator()) {
            const identifier = declarator.identifier();
            const info = (0, utils_1.getIdentifierInfo)(identifier);
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
    isBuiltIn(name) {
        // This is a placeholder for a real list of LPC efuncs/built-ins
        const builtIns = new Set(['write', 'this_object', 'environment', 'find_player', 'say', 'tell_object', 'sizeof', 'filter_array', 'all_inventory', 'base_name', 'clonep', 'new', 'destruct', 'geteuid', 'seteuid', 'objectp', 'stringp', 'random', 'member_array', 'command', 'reset_eval_cost', 'is_character', 'userp', 'query_dex']);
        return builtIns.has(name);
    }
    visitIdentifier(ctx) {
        var _a;
        const parent = ctx.parent;
        if (!parent)
            return;
        // If this identifier is the function name in a declaration, we don't need to check it.
        if (parent instanceof LPCParser_1.FunctionDeclarationContext && parent.identifier() === ctx) {
            return;
        }
        // If this identifier is a variable name in a declaration, we don't need to check it.
        if (parent instanceof LPCParser_1.VariableDeclaratorContext) {
            return;
        }
        const name = (_a = (0, utils_1.getIdentifierInfo)(ctx)) === null || _a === void 0 ? void 0 : _a.name;
        if (!name)
            return;
        // Is it a function call?
        if (parent instanceof LPCParser_1.ExpressionContext && parent.text.endsWith(')')) {
            const children = parent.children;
            if (children && children.length > 1 && children[1].text === '(') {
                if (!this.declaredFunctions.has(name) && !this.isBuiltIn(name)) {
                    this.diagnostics.push({
                        severity: node_1.DiagnosticSeverity.Warning,
                        range: {
                            start: this.document.positionAt(ctx.start.startIndex),
                            end: this.document.positionAt(ctx.stop.stopIndex + 1),
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
                severity: node_1.DiagnosticSeverity.Warning,
                range: {
                    start: this.document.positionAt(ctx.start.startIndex),
                    end: this.document.positionAt(ctx.stop.stopIndex + 1),
                },
                message: `Variable or function '${name}' is not defined.`,
                source: 'LPC Semantic'
            });
        }
    }
    visitExpression(ctx) {
        // Check for function calls
        if (ctx.childCount === 2 && ctx.getChild(0) instanceof LPCParser_1.IdentifierContext && ctx.getChild(1).text === '(') {
            const funcNameCtx = ctx.getChild(0);
            const info = (0, utils_1.getIdentifierInfo)(funcNameCtx);
            if (info && !this.declaredFunctions.has(info.name)) {
                const range = {
                    start: this.document.positionAt(info.token.startIndex),
                    end: this.document.positionAt(info.token.stopIndex + 1)
                };
                this.diagnostics.push({
                    severity: node_1.DiagnosticSeverity.Error,
                    range: range,
                    message: `Call to undefined function '${info.name}'.`,
                    source: 'LPC Semantics'
                });
            }
        }
        // Continue traversal
        this.visitChildren(ctx);
    }
    getDiagnostics() {
        return this.diagnostics;
    }
}
exports.LpcSemanticDiagnosticsVisitor = LpcSemanticDiagnosticsVisitor;
//# sourceMappingURL=semanticDiagnosticsVisitor.js.map