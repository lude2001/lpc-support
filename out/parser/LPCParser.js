"use strict";
// Generated from grammar/LPC.g4 by ANTLR 4.9.0-SNAPSHOT
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdentifierContext = exports.TypeSpecifierContext = exports.PreprocessorDirectiveContext = exports.FunctionDeclarationContext = exports.ExpressionContext = exports.StatementContext = exports.ProgramContext = exports.LPCParser = void 0;
const ATNDeserializer_1 = require("antlr4ts/atn/ATNDeserializer");
const FailedPredicateException_1 = require("antlr4ts/FailedPredicateException");
const Parser_1 = require("antlr4ts/Parser");
const ParserRuleContext_1 = require("antlr4ts/ParserRuleContext");
const ParserATNSimulator_1 = require("antlr4ts/atn/ParserATNSimulator");
const RecognitionException_1 = require("antlr4ts/RecognitionException");
const Token_1 = require("antlr4ts/Token");
const VocabularyImpl_1 = require("antlr4ts/VocabularyImpl");
const Utils = require("antlr4ts/misc/Utils");
class LPCParser extends Parser_1.Parser {
    // @Override
    // @NotNull
    get vocabulary() {
        return LPCParser.VOCABULARY;
    }
    // tslint:enable:no-trailing-whitespace
    // @Override
    get grammarFileName() { return "LPC.g4"; }
    // @Override
    get ruleNames() { return LPCParser.ruleNames; }
    // @Override
    get serializedATN() { return LPCParser._serializedATN; }
    createFailedPredicateException(predicate, message) {
        return new FailedPredicateException_1.FailedPredicateException(this, predicate, message);
    }
    constructor(input) {
        super(input);
        this._interp = new ParserATNSimulator_1.ParserATNSimulator(LPCParser._ATN, this);
    }
    // @RuleVersion(0)
    program() {
        let _localctx = new ProgramContext(this._ctx, this.state);
        this.enterRule(_localctx, 0, LPCParser.RULE_program);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 19;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.VOID) | (1 << LPCParser.INT) | (1 << LPCParser.STRING) | (1 << LPCParser.OBJECT) | (1 << LPCParser.ARRAY) | (1 << LPCParser.MAPPING) | (1 << LPCParser.FLOAT) | (1 << LPCParser.BUFFER) | (1 << LPCParser.MIXED) | (1 << LPCParser.FUNCTION) | (1 << LPCParser.CLASS) | (1 << LPCParser.STRUCT))) !== 0) || _la === LPCParser.IDENTIFIER || _la === LPCParser.PREPROCESSOR_DIRECTIVE) {
                    {
                        this.state = 17;
                        this._errHandler.sync(this);
                        switch (this.interpreter.adaptivePredict(this._input, 0, this._ctx)) {
                            case 1:
                                {
                                    this.state = 14;
                                    this.statement();
                                }
                                break;
                            case 2:
                                {
                                    this.state = 15;
                                    this.functionDeclaration();
                                }
                                break;
                            case 3:
                                {
                                    this.state = 16;
                                    this.preprocessorDirective();
                                }
                                break;
                        }
                    }
                    this.state = 21;
                    this._errHandler.sync(this);
                    _la = this._input.LA(1);
                }
                this.state = 22;
                this.match(LPCParser.EOF);
            }
        }
        catch (re) {
            if (re instanceof RecognitionException_1.RecognitionException) {
                _localctx.exception = re;
                this._errHandler.reportError(this, re);
                this._errHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return _localctx;
    }
    // @RuleVersion(0)
    statement() {
        let _localctx = new StatementContext(this._ctx, this.state);
        this.enterRule(_localctx, 2, LPCParser.RULE_statement);
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 24;
                this.expression();
                this.state = 25;
                this.match(LPCParser.T__0);
            }
        }
        catch (re) {
            if (re instanceof RecognitionException_1.RecognitionException) {
                _localctx.exception = re;
                this._errHandler.reportError(this, re);
                this._errHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return _localctx;
    }
    // @RuleVersion(0)
    expression() {
        let _localctx = new ExpressionContext(this._ctx, this.state);
        this.enterRule(_localctx, 4, LPCParser.RULE_expression);
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 27;
                this.identifier();
            }
        }
        catch (re) {
            if (re instanceof RecognitionException_1.RecognitionException) {
                _localctx.exception = re;
                this._errHandler.reportError(this, re);
                this._errHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return _localctx;
    }
    // @RuleVersion(0)
    functionDeclaration() {
        let _localctx = new FunctionDeclarationContext(this._ctx, this.state);
        this.enterRule(_localctx, 6, LPCParser.RULE_functionDeclaration);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 30;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.VOID) | (1 << LPCParser.INT) | (1 << LPCParser.STRING) | (1 << LPCParser.OBJECT) | (1 << LPCParser.ARRAY) | (1 << LPCParser.MAPPING) | (1 << LPCParser.FLOAT) | (1 << LPCParser.BUFFER) | (1 << LPCParser.MIXED) | (1 << LPCParser.FUNCTION) | (1 << LPCParser.CLASS) | (1 << LPCParser.STRUCT))) !== 0)) {
                    {
                        this.state = 29;
                        this.typeSpecifier();
                    }
                }
                this.state = 32;
                this.identifier();
                this.state = 33;
                this.match(LPCParser.T__1);
                this.state = 34;
                this.match(LPCParser.T__2);
                this.state = 35;
                this.match(LPCParser.T__3);
                this.state = 36;
                this.match(LPCParser.T__4);
            }
        }
        catch (re) {
            if (re instanceof RecognitionException_1.RecognitionException) {
                _localctx.exception = re;
                this._errHandler.reportError(this, re);
                this._errHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return _localctx;
    }
    // @RuleVersion(0)
    preprocessorDirective() {
        let _localctx = new PreprocessorDirectiveContext(this._ctx, this.state);
        this.enterRule(_localctx, 8, LPCParser.RULE_preprocessorDirective);
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 38;
                this.match(LPCParser.PREPROCESSOR_DIRECTIVE);
            }
        }
        catch (re) {
            if (re instanceof RecognitionException_1.RecognitionException) {
                _localctx.exception = re;
                this._errHandler.reportError(this, re);
                this._errHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return _localctx;
    }
    // @RuleVersion(0)
    typeSpecifier() {
        let _localctx = new TypeSpecifierContext(this._ctx, this.state);
        this.enterRule(_localctx, 10, LPCParser.RULE_typeSpecifier);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 40;
                _la = this._input.LA(1);
                if (!((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.VOID) | (1 << LPCParser.INT) | (1 << LPCParser.STRING) | (1 << LPCParser.OBJECT) | (1 << LPCParser.ARRAY) | (1 << LPCParser.MAPPING) | (1 << LPCParser.FLOAT) | (1 << LPCParser.BUFFER) | (1 << LPCParser.MIXED) | (1 << LPCParser.FUNCTION) | (1 << LPCParser.CLASS) | (1 << LPCParser.STRUCT))) !== 0))) {
                    this._errHandler.recoverInline(this);
                }
                else {
                    if (this._input.LA(1) === Token_1.Token.EOF) {
                        this.matchedEOF = true;
                    }
                    this._errHandler.reportMatch(this);
                    this.consume();
                }
            }
        }
        catch (re) {
            if (re instanceof RecognitionException_1.RecognitionException) {
                _localctx.exception = re;
                this._errHandler.reportError(this, re);
                this._errHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return _localctx;
    }
    // @RuleVersion(0)
    identifier() {
        let _localctx = new IdentifierContext(this._ctx, this.state);
        this.enterRule(_localctx, 12, LPCParser.RULE_identifier);
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 42;
                this.match(LPCParser.IDENTIFIER);
            }
        }
        catch (re) {
            if (re instanceof RecognitionException_1.RecognitionException) {
                _localctx.exception = re;
                this._errHandler.reportError(this, re);
                this._errHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return _localctx;
    }
    static get _ATN() {
        if (!LPCParser.__ATN) {
            LPCParser.__ATN = new ATNDeserializer_1.ATNDeserializer().deserialize(Utils.toCharArray(LPCParser._serializedATN));
        }
        return LPCParser.__ATN;
    }
}
exports.LPCParser = LPCParser;
LPCParser.T__0 = 1;
LPCParser.T__1 = 2;
LPCParser.T__2 = 3;
LPCParser.T__3 = 4;
LPCParser.T__4 = 5;
LPCParser.VOID = 6;
LPCParser.INT = 7;
LPCParser.STRING = 8;
LPCParser.OBJECT = 9;
LPCParser.ARRAY = 10;
LPCParser.MAPPING = 11;
LPCParser.FLOAT = 12;
LPCParser.BUFFER = 13;
LPCParser.MIXED = 14;
LPCParser.FUNCTION = 15;
LPCParser.CLASS = 16;
LPCParser.STRUCT = 17;
LPCParser.IF = 18;
LPCParser.ELSE = 19;
LPCParser.WHILE = 20;
LPCParser.FOR = 21;
LPCParser.DO = 22;
LPCParser.SWITCH = 23;
LPCParser.CASE = 24;
LPCParser.DEFAULT = 25;
LPCParser.BREAK = 26;
LPCParser.CONTINUE = 27;
LPCParser.RETURN = 28;
LPCParser.FOREACH = 29;
LPCParser.INHERIT = 30;
LPCParser.PRIVATE = 31;
LPCParser.PROTECTED = 32;
LPCParser.PUBLIC = 33;
LPCParser.STATIC = 34;
LPCParser.NOMASK = 35;
LPCParser.VARARGS = 36;
LPCParser.IDENTIFIER = 37;
LPCParser.PREPROCESSOR_DIRECTIVE = 38;
LPCParser.LINE_COMMENT = 39;
LPCParser.BLOCK_COMMENT = 40;
LPCParser.WS = 41;
LPCParser.RULE_program = 0;
LPCParser.RULE_statement = 1;
LPCParser.RULE_expression = 2;
LPCParser.RULE_functionDeclaration = 3;
LPCParser.RULE_preprocessorDirective = 4;
LPCParser.RULE_typeSpecifier = 5;
LPCParser.RULE_identifier = 6;
// tslint:disable:no-trailing-whitespace
LPCParser.ruleNames = [
    "program", "statement", "expression", "functionDeclaration", "preprocessorDirective",
    "typeSpecifier", "identifier",
];
LPCParser._LITERAL_NAMES = [
    undefined, "';'", "'('", "')'", "'{'", "'}'", "'void'", "'int'", "'string'",
    "'object'", "'array'", "'mapping'", "'float'", "'buffer'", "'mixed'",
    "'function'", "'class'", "'struct'", "'if'", "'else'", "'while'", "'for'",
    "'do'", "'switch'", "'case'", "'default'", "'break'", "'continue'", "'return'",
    "'foreach'", "'inherit'", "'private'", "'protected'", "'public'", "'static'",
    "'nomask'", "'varargs'",
];
LPCParser._SYMBOLIC_NAMES = [
    undefined, undefined, undefined, undefined, undefined, undefined, "VOID",
    "INT", "STRING", "OBJECT", "ARRAY", "MAPPING", "FLOAT", "BUFFER", "MIXED",
    "FUNCTION", "CLASS", "STRUCT", "IF", "ELSE", "WHILE", "FOR", "DO", "SWITCH",
    "CASE", "DEFAULT", "BREAK", "CONTINUE", "RETURN", "FOREACH", "INHERIT",
    "PRIVATE", "PROTECTED", "PUBLIC", "STATIC", "NOMASK", "VARARGS", "IDENTIFIER",
    "PREPROCESSOR_DIRECTIVE", "LINE_COMMENT", "BLOCK_COMMENT", "WS",
];
LPCParser.VOCABULARY = new VocabularyImpl_1.VocabularyImpl(LPCParser._LITERAL_NAMES, LPCParser._SYMBOLIC_NAMES, []);
LPCParser._serializedATN = "\x03\uC91D\uCABA\u058D\uAFBA\u4F53\u0607\uEA8B\uC241\x03+/\x04\x02\t\x02" +
    "\x04\x03\t\x03\x04\x04\t\x04\x04\x05\t\x05\x04\x06\t\x06\x04\x07\t\x07" +
    "\x04\b\t\b\x03\x02\x03\x02\x03\x02\x07\x02\x14\n\x02\f\x02\x0E\x02\x17" +
    "\v\x02\x03\x02\x03\x02\x03\x03\x03\x03\x03\x03\x03\x04\x03\x04\x03\x05" +
    "\x05\x05!\n\x05\x03\x05\x03\x05\x03\x05\x03\x05\x03\x05\x03\x05\x03\x06" +
    "\x03\x06\x03\x07\x03\x07\x03\b\x03\b\x03\b\x02\x02\x02\t\x02\x02\x04\x02" +
    "\x06\x02\b\x02\n\x02\f\x02\x0E\x02\x02\x03\x03\x02\b\x13\x02+\x02\x15" +
    "\x03\x02\x02\x02\x04\x1A\x03\x02\x02\x02\x06\x1D\x03\x02\x02\x02\b \x03" +
    "\x02\x02\x02\n(\x03\x02\x02\x02\f*\x03\x02\x02\x02\x0E,\x03\x02\x02\x02" +
    "\x10\x14\x05\x04\x03\x02\x11\x14\x05\b\x05\x02\x12\x14\x05\n\x06\x02\x13" +
    "\x10\x03\x02\x02\x02\x13\x11\x03\x02\x02\x02\x13\x12\x03\x02\x02\x02\x14" +
    "\x17\x03\x02\x02\x02\x15\x13\x03\x02\x02\x02\x15\x16\x03\x02\x02\x02\x16" +
    "\x18\x03\x02\x02\x02\x17\x15\x03\x02\x02\x02\x18\x19\x07\x02\x02\x03\x19" +
    "\x03\x03\x02\x02\x02\x1A\x1B\x05\x06\x04\x02\x1B\x1C\x07\x03\x02\x02\x1C" +
    "\x05\x03\x02\x02\x02\x1D\x1E\x05\x0E\b\x02\x1E\x07\x03\x02\x02\x02\x1F" +
    "!\x05\f\x07\x02 \x1F\x03\x02\x02\x02 !\x03\x02\x02\x02!\"\x03\x02\x02" +
    "\x02\"#\x05\x0E\b\x02#$\x07\x04\x02\x02$%\x07\x05\x02\x02%&\x07\x06\x02" +
    "\x02&\'\x07\x07\x02\x02\'\t\x03\x02\x02\x02()\x07(\x02\x02)\v\x03\x02" +
    "\x02\x02*+\t\x02\x02\x02+\r\x03\x02\x02\x02,-\x07\'\x02\x02-\x0F\x03\x02" +
    "\x02\x02\x05\x13\x15 ";
class ProgramContext extends ParserRuleContext_1.ParserRuleContext {
    EOF() { return this.getToken(LPCParser.EOF, 0); }
    statement(i) {
        if (i === undefined) {
            return this.getRuleContexts(StatementContext);
        }
        else {
            return this.getRuleContext(i, StatementContext);
        }
    }
    functionDeclaration(i) {
        if (i === undefined) {
            return this.getRuleContexts(FunctionDeclarationContext);
        }
        else {
            return this.getRuleContext(i, FunctionDeclarationContext);
        }
    }
    preprocessorDirective(i) {
        if (i === undefined) {
            return this.getRuleContexts(PreprocessorDirectiveContext);
        }
        else {
            return this.getRuleContext(i, PreprocessorDirectiveContext);
        }
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_program; }
    // @Override
    enterRule(listener) {
        if (listener.enterProgram) {
            listener.enterProgram(this);
        }
    }
    // @Override
    exitRule(listener) {
        if (listener.exitProgram) {
            listener.exitProgram(this);
        }
    }
    // @Override
    accept(visitor) {
        if (visitor.visitProgram) {
            return visitor.visitProgram(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.ProgramContext = ProgramContext;
class StatementContext extends ParserRuleContext_1.ParserRuleContext {
    expression() {
        return this.getRuleContext(0, ExpressionContext);
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_statement; }
    // @Override
    enterRule(listener) {
        if (listener.enterStatement) {
            listener.enterStatement(this);
        }
    }
    // @Override
    exitRule(listener) {
        if (listener.exitStatement) {
            listener.exitStatement(this);
        }
    }
    // @Override
    accept(visitor) {
        if (visitor.visitStatement) {
            return visitor.visitStatement(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.StatementContext = StatementContext;
class ExpressionContext extends ParserRuleContext_1.ParserRuleContext {
    identifier() {
        return this.getRuleContext(0, IdentifierContext);
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_expression; }
    // @Override
    enterRule(listener) {
        if (listener.enterExpression) {
            listener.enterExpression(this);
        }
    }
    // @Override
    exitRule(listener) {
        if (listener.exitExpression) {
            listener.exitExpression(this);
        }
    }
    // @Override
    accept(visitor) {
        if (visitor.visitExpression) {
            return visitor.visitExpression(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.ExpressionContext = ExpressionContext;
class FunctionDeclarationContext extends ParserRuleContext_1.ParserRuleContext {
    identifier() {
        return this.getRuleContext(0, IdentifierContext);
    }
    typeSpecifier() {
        return this.tryGetRuleContext(0, TypeSpecifierContext);
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_functionDeclaration; }
    // @Override
    enterRule(listener) {
        if (listener.enterFunctionDeclaration) {
            listener.enterFunctionDeclaration(this);
        }
    }
    // @Override
    exitRule(listener) {
        if (listener.exitFunctionDeclaration) {
            listener.exitFunctionDeclaration(this);
        }
    }
    // @Override
    accept(visitor) {
        if (visitor.visitFunctionDeclaration) {
            return visitor.visitFunctionDeclaration(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.FunctionDeclarationContext = FunctionDeclarationContext;
class PreprocessorDirectiveContext extends ParserRuleContext_1.ParserRuleContext {
    PREPROCESSOR_DIRECTIVE() { return this.getToken(LPCParser.PREPROCESSOR_DIRECTIVE, 0); }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_preprocessorDirective; }
    // @Override
    enterRule(listener) {
        if (listener.enterPreprocessorDirective) {
            listener.enterPreprocessorDirective(this);
        }
    }
    // @Override
    exitRule(listener) {
        if (listener.exitPreprocessorDirective) {
            listener.exitPreprocessorDirective(this);
        }
    }
    // @Override
    accept(visitor) {
        if (visitor.visitPreprocessorDirective) {
            return visitor.visitPreprocessorDirective(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.PreprocessorDirectiveContext = PreprocessorDirectiveContext;
class TypeSpecifierContext extends ParserRuleContext_1.ParserRuleContext {
    VOID() { return this.tryGetToken(LPCParser.VOID, 0); }
    INT() { return this.tryGetToken(LPCParser.INT, 0); }
    STRING() { return this.tryGetToken(LPCParser.STRING, 0); }
    OBJECT() { return this.tryGetToken(LPCParser.OBJECT, 0); }
    ARRAY() { return this.tryGetToken(LPCParser.ARRAY, 0); }
    MAPPING() { return this.tryGetToken(LPCParser.MAPPING, 0); }
    FLOAT() { return this.tryGetToken(LPCParser.FLOAT, 0); }
    BUFFER() { return this.tryGetToken(LPCParser.BUFFER, 0); }
    MIXED() { return this.tryGetToken(LPCParser.MIXED, 0); }
    FUNCTION() { return this.tryGetToken(LPCParser.FUNCTION, 0); }
    CLASS() { return this.tryGetToken(LPCParser.CLASS, 0); }
    STRUCT() { return this.tryGetToken(LPCParser.STRUCT, 0); }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_typeSpecifier; }
    // @Override
    enterRule(listener) {
        if (listener.enterTypeSpecifier) {
            listener.enterTypeSpecifier(this);
        }
    }
    // @Override
    exitRule(listener) {
        if (listener.exitTypeSpecifier) {
            listener.exitTypeSpecifier(this);
        }
    }
    // @Override
    accept(visitor) {
        if (visitor.visitTypeSpecifier) {
            return visitor.visitTypeSpecifier(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.TypeSpecifierContext = TypeSpecifierContext;
class IdentifierContext extends ParserRuleContext_1.ParserRuleContext {
    IDENTIFIER() { return this.getToken(LPCParser.IDENTIFIER, 0); }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_identifier; }
    // @Override
    enterRule(listener) {
        if (listener.enterIdentifier) {
            listener.enterIdentifier(this);
        }
    }
    // @Override
    exitRule(listener) {
        if (listener.exitIdentifier) {
            listener.exitIdentifier(this);
        }
    }
    // @Override
    accept(visitor) {
        if (visitor.visitIdentifier) {
            return visitor.visitIdentifier(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.IdentifierContext = IdentifierContext;
//# sourceMappingURL=LPCParser.js.map