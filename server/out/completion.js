"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LpcCompletionVisitor = void 0;
const node_1 = require("vscode-languageserver/node");
const AbstractParseTreeVisitor_1 = require("antlr4ts/tree/AbstractParseTreeVisitor");
const antlr4ts_1 = require("antlr4ts");
class LpcCompletionVisitor extends AbstractParseTreeVisitor_1.AbstractParseTreeVisitor {
    constructor(document, position, tree) {
        super();
        this.document = document;
        this.position = position;
        this.allFunctionNames = new Set();
        this.completions = [];
        this.cursorOffset = this.document.offsetAt(this.position);
        this.collectAllFunctions(tree);
        this.findCursorNode(tree, this.cursorOffset);
    }
    defaultResult() {
        return [];
    }
    aggregateResult(aggregate, nextResult) {
        return aggregate.concat(nextResult);
    }
    // We'll implement visit methods later to get context-aware completions.
    collectAllFunctions(tree) {
        const visitor = new (class extends AbstractParseTreeVisitor_1.AbstractParseTreeVisitor {
            constructor(functions) {
                super();
                this.functions = functions;
            }
            visitFunctionDeclaration(ctx) {
                const identifier = ctx.identifier();
                if (identifier) {
                    this.functions.add(identifier.text);
                }
            }
            defaultResult() { }
        })(this.allFunctionNames);
        visitor.visit(tree);
    }
    findCursorNode(tree, offset) {
        var _a, _b;
        const stack = [tree];
        let foundNode;
        while (stack.length > 0) {
            const node = stack.pop();
            if (node instanceof antlr4ts_1.RuleContext) {
                const ruleNode = node;
                if (ruleNode.start.startIndex <= offset && ((_b = (_a = ruleNode.stop) === null || _a === void 0 ? void 0 : _a.stopIndex) !== null && _b !== void 0 ? _b : -1) >= offset) {
                    foundNode = node;
                    for (let i = node.childCount - 1; i >= 0; i--) {
                        stack.push(node.getChild(i));
                    }
                }
            }
        }
        this.cursorNode = foundNode;
    }
    getCompletions() {
        if (this.cursorNode) {
            this.visit(this.cursorNode);
        }
        let results = [];
        // 1. Add keywords
        const keywords = ['if', 'else', 'while', 'for', 'return', 'inherit', 'int', 'string', 'void'];
        const keywordCompletions = keywords.map(kw => ({
            label: kw,
            kind: node_1.CompletionItemKind.Keyword
        }));
        results = results.concat(keywordCompletions);
        // 2. Add function names
        const functionCompletions = Array.from(this.allFunctionNames).map(name => ({
            label: name,
            kind: node_1.CompletionItemKind.Function
        }));
        results = results.concat(functionCompletions);
        this.completions = this.completions.concat(keywordCompletions);
        this.completions = this.completions.concat(functionCompletions);
        return this.completions;
    }
    // New visit method to get local variables
    visitFunctionDeclaration(ctx) {
        const variables = [];
        const paramList = ctx.parameterList();
        if (paramList) {
            for (const param of paramList.parameter()) {
                const identifier = param.identifier();
                // Ensure the variable is declared before the cursor
                if (identifier.start.stopIndex < this.cursorOffset) {
                    variables.push({
                        label: identifier.text,
                        kind: node_1.CompletionItemKind.Variable,
                    });
                }
            }
        }
        this.completions.push(...variables);
        return []; // We handle results via the class member
    }
}
exports.LpcCompletionVisitor = LpcCompletionVisitor;
//# sourceMappingURL=completion.js.map