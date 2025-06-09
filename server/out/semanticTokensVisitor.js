"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LpcSemanticTokensVisitor = void 0;
const AbstractParseTreeVisitor_1 = require("antlr4ts/tree/AbstractParseTreeVisitor");
const node_1 = require("vscode-languageserver/node");
const LPCParser_1 = require("./parser/LPCParser");
const LPCLexer_1 = require("./parser/LPCLexer");
const utils_1 = require("./utils");
// --- Token-Type Mapping ---
const tokenTypeMap = new Map();
function initializeTokenTypeMap() {
    const keywordTypes = [
        LPCLexer_1.LPCLexer.IF, LPCLexer_1.LPCLexer.ELSE, LPCLexer_1.LPCLexer.WHILE, LPCLexer_1.LPCLexer.FOR, LPCLexer_1.LPCLexer.DO, LPCLexer_1.LPCLexer.SWITCH,
        LPCLexer_1.LPCLexer.CASE, LPCLexer_1.LPCLexer.DEFAULT, LPCLexer_1.LPCLexer.BREAK, LPCLexer_1.LPCLexer.CONTINUE, LPCLexer_1.LPCLexer.RETURN,
        LPCLexer_1.LPCLexer.FOREACH, LPCLexer_1.LPCLexer.INHERIT, LPCLexer_1.LPCLexer.IN, LPCLexer_1.LPCLexer.EFUN, LPCLexer_1.LPCLexer.NEW,
        LPCLexer_1.LPCLexer.CATCH, LPCLexer_1.LPCLexer.SSCANF, LPCLexer_1.LPCLexer.PARSE_COMMAND, LPCLexer_1.LPCLexer.TIME_EXPRESSION
    ];
    for (const type of keywordTypes) {
        tokenTypeMap.set(type, 'keyword');
    }
    const modifierTypes = [
        LPCLexer_1.LPCLexer.PRIVATE, LPCLexer_1.LPCLexer.PROTECTED, LPCLexer_1.LPCLexer.PUBLIC,
        LPCLexer_1.LPCLexer.STATIC, LPCLexer_1.LPCLexer.NOMASK, LPCLexer_1.LPCLexer.VARARGS, LPCLexer_1.LPCLexer.NOSAVE, LPCLexer_1.LPCLexer.REF
    ];
    for (const type of modifierTypes) {
        tokenTypeMap.set(type, 'modifier');
    }
    const preprocessorTypes = [
        LPCLexer_1.LPCLexer.PP_INCLUDE, LPCLexer_1.LPCLexer.PP_DEFINE, LPCLexer_1.LPCLexer.PP_IFDEF, LPCLexer_1.LPCLexer.PP_IFNDEF,
        LPCLexer_1.LPCLexer.PP_IF, LPCLexer_1.LPCLexer.PP_ELSE, LPCLexer_1.LPCLexer.PP_ENDIF, LPCLexer_1.LPCLexer.PP_ERROR, LPCLexer_1.LPCLexer.PP_PRAGMA
    ];
    for (const type of preprocessorTypes) {
        tokenTypeMap.set(type, 'preprocessor');
    }
    const typeKeywordTypes = [
        LPCLexer_1.LPCLexer.VOID, LPCLexer_1.LPCLexer.INT, LPCLexer_1.LPCLexer.STRING, LPCLexer_1.LPCLexer.OBJECT, LPCLexer_1.LPCLexer.ARRAY,
        LPCLexer_1.LPCLexer.MAPPING, LPCLexer_1.LPCLexer.FLOAT, LPCLexer_1.LPCLexer.BUFFER, LPCLexer_1.LPCLexer.MIXED, LPCLexer_1.LPCLexer.FUNCTION,
        LPCLexer_1.LPCLexer.CLASS, LPCLexer_1.LPCLexer.STRUCT, LPCLexer_1.LPCLexer.CLOSURE
    ];
    for (const type of typeKeywordTypes) {
        tokenTypeMap.set(type, 'type');
    }
}
initializeTokenTypeMap();
// --- End Mapping ---
class LpcSemanticTokensVisitor extends AbstractParseTreeVisitor_1.AbstractParseTreeVisitor {
    constructor(legend) {
        super();
        this.legend = legend;
        this.builder = new node_1.SemanticTokensBuilder();
    }
    defaultResult() {
        return;
    }
    visitTerminal(node) {
        const tokenTypeName = tokenTypeMap.get(node.symbol.type);
        if (tokenTypeName) {
            const tokenTypeIndex = this.legend.tokenTypes.indexOf(tokenTypeName);
            if (tokenTypeIndex >= 0) {
                this.builder.push(node.symbol.line - 1, node.symbol.charPositionInLine, node.text.length, tokenTypeIndex, 0 // No modifiers for keywords/types for now
                );
            }
        }
    }
    visitFunctionDeclaration(ctx) {
        const identifier = ctx.identifier();
        const info = (0, utils_1.getIdentifierInfo)(identifier);
        if (info) {
            const tokenTypeIndex = this.legend.tokenTypes.indexOf('function');
            const tokenModifierIndex = this.legend.tokenModifiers.indexOf('declaration');
            const tokenModifiers = tokenModifierIndex >= 0 ? 1 << tokenModifierIndex : 0;
            if (tokenTypeIndex >= 0) {
                this.builder.push(info.token.line - 1, info.token.charPositionInLine, info.name.length, tokenTypeIndex, tokenModifiers);
            }
        }
        this.visitChildren(ctx);
    }
    visitPreprocessorDirective(ctx) {
        const ppDefine = ctx.ppDefine();
        if (ppDefine) {
            const identifier = ppDefine.IDENTIFIER();
            if (identifier) {
                const tokenTypeIndex = this.legend.tokenTypes.indexOf('macro');
                if (tokenTypeIndex >= 0) {
                    this.builder.push(identifier.symbol.line - 1, identifier.symbol.charPositionInLine, identifier.text.length, tokenTypeIndex, 0 // No modifiers for now
                    );
                }
            }
        }
        this.visitChildren(ctx);
    }
    // Override visitChildren to ensure we don't double-visit identifiers
    visitChildren(node) {
        for (let i = 0; i < node.childCount; i++) {
            const child = node.getChild(i);
            // Don't visit identifiers that are handled by other visitor methods
            if (!(child instanceof LPCParser_1.IdentifierContext)) {
                this.visit(child);
            }
        }
    }
    getTokens() {
        return this.builder.build();
    }
}
exports.LpcSemanticTokensVisitor = LpcSemanticTokensVisitor;
//# sourceMappingURL=semanticTokensVisitor.js.map