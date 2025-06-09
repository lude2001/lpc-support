"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LpcSymbolVisitor = void 0;
const AbstractParseTreeVisitor_1 = require("antlr4ts/tree/AbstractParseTreeVisitor");
const node_1 = require("vscode-languageserver/node");
const utils_1 = require("./utils");
class LpcSymbolVisitor extends AbstractParseTreeVisitor_1.AbstractParseTreeVisitor {
    constructor(document) {
        super();
        this.document = document;
    }
    defaultResult() {
        return [];
    }
    aggregateResult(aggregate, nextResult) {
        return aggregate.concat(nextResult);
    }
    visitProgram(ctx) {
        var _a;
        const symbols = [];
        for (const child of (_a = ctx.children) !== null && _a !== void 0 ? _a : []) {
            symbols.push(...this.visit(child));
        }
        return symbols;
    }
    visitFunctionDeclaration(ctx) {
        const identifier = ctx.identifier();
        const info = (0, utils_1.getIdentifierInfo)(identifier);
        if (!info)
            return [];
        const range = {
            start: this.document.positionAt(ctx.start.startIndex),
            end: this.document.positionAt(ctx.stop.stopIndex + 1)
        };
        const symbol = node_1.DocumentSymbol.create(info.name, 'Function', node_1.SymbolKind.Function, range, range);
        return [symbol];
    }
}
exports.LpcSymbolVisitor = LpcSymbolVisitor;
//# sourceMappingURL=symbolVisitor.js.map