"use strict";
// Generated from grammar/LPC.g4 by ANTLR 4.9.0-SNAPSHOT
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForInitContext = exports.ForStatementContext = exports.DoWhileStatementContext = exports.WhileStatementContext = exports.IfStatementContext = exports.ConcatItemContext = exports.StringConcatContext = exports.RefVariableContext = exports.ParenExprContext = exports.ArrayLiteralContext = exports.CharPrimaryContext = exports.StringPrimaryContext = exports.FloatPrimaryContext = exports.IntegerPrimaryContext = exports.IdentifierPrimaryContext = exports.AnonFunctionContext = exports.MappingLiteralExprContext = exports.ClosureExprContext = exports.StringConcatenationContext = exports.ScopeIdentifierContext = exports.PrimaryContext = exports.ArgumentListContext = exports.PostfixExpressionContext = exports.CastTypeContext = exports.CastExpressionContext = exports.UnaryExpressionContext = exports.MultiplicativeExpressionContext = exports.AdditiveExpressionContext = exports.ShiftExpressionContext = exports.RelationalExpressionContext = exports.EqualityExpressionContext = exports.BitwiseAndExpressionContext = exports.BitwiseXorExpressionContext = exports.BitwiseOrExpressionContext = exports.LogicalAndExpressionContext = exports.LogicalOrExpressionContext = exports.ConditionalExpressionContext = exports.AssignmentExpressionContext = exports.ExpressionContext = exports.ExprStatementContext = exports.BlockContext = exports.TypeSpecContext = exports.ParameterContext = exports.ParameterListContext = exports.VariableDeclaratorContext = exports.VariableDeclContext = exports.FunctionDefContext = exports.StatementContext = exports.SourceFileContext = exports.LPCParser = void 0;
exports.MacroInvokeContext = exports.TailHeadRangeContext = exports.SingleIndexContext = exports.OpenRangeContext = exports.HeadRangeContext = exports.TailIndexOnlyContext = exports.SliceExprContext = exports.MappingPairContext = exports.MappingPairListContext = exports.MappingLiteralContext = exports.PrototypeStatementContext = exports.InheritStatementContext = exports.ReturnStatementContext = exports.ContinueStatementContext = exports.BreakStatementContext = exports.SwitchLabelContext = exports.SwitchLabelWithColonContext = exports.SwitchSectionContext = exports.SwitchStatementContext = exports.ForeachVarContext = exports.ForeachInitContext = exports.ForeachStatementContext = exports.ExpressionListContext = void 0;
const ATN_1 = require("antlr4ts/atn/ATN");
const ATNDeserializer_1 = require("antlr4ts/atn/ATNDeserializer");
const FailedPredicateException_1 = require("antlr4ts/FailedPredicateException");
const NoViableAltException_1 = require("antlr4ts/NoViableAltException");
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
    sourceFile() {
        let _localctx = new SourceFileContext(this._ctx, this.state);
        this.enterRule(_localctx, 0, LPCParser.RULE_sourceFile);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 111;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.T__0) | (1 << LPCParser.T__1) | (1 << LPCParser.T__4) | (1 << LPCParser.T__5) | (1 << LPCParser.T__6) | (1 << LPCParser.T__7) | (1 << LPCParser.T__8) | (1 << LPCParser.T__9) | (1 << LPCParser.T__10) | (1 << LPCParser.T__11) | (1 << LPCParser.T__12) | (1 << LPCParser.T__13) | (1 << LPCParser.T__14) | (1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.IF) | (1 << LPCParser.FOR) | (1 << LPCParser.WHILE))) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & ((1 << (LPCParser.DO - 32)) | (1 << (LPCParser.SWITCH - 32)) | (1 << (LPCParser.BREAK - 32)) | (1 << (LPCParser.CONTINUE - 32)) | (1 << (LPCParser.RETURN - 32)) | (1 << (LPCParser.FOREACH - 32)) | (1 << (LPCParser.INHERIT - 32)) | (1 << (LPCParser.CATCH - 32)) | (1 << (LPCParser.REF - 32)) | (1 << (LPCParser.INC - 32)) | (1 << (LPCParser.DEC - 32)) | (1 << (LPCParser.PLUS - 32)) | (1 << (LPCParser.MINUS - 32)) | (1 << (LPCParser.STAR - 32)) | (1 << (LPCParser.SCOPE - 32)))) !== 0) || ((((_la - 68)) & ~0x1F) === 0 && ((1 << (_la - 68)) & ((1 << (LPCParser.NOT - 68)) | (1 << (LPCParser.CLOSURE - 68)) | (1 << (LPCParser.MODIFIER - 68)) | (1 << (LPCParser.Identifier - 68)) | (1 << (LPCParser.CHAR_LITERAL - 68)) | (1 << (LPCParser.BIT_NOT - 68)) | (1 << (LPCParser.HEREDOC_STRING - 68)))) !== 0)) {
                    {
                        {
                            this.state = 108;
                            this.statement();
                        }
                    }
                    this.state = 113;
                    this._errHandler.sync(this);
                    _la = this._input.LA(1);
                }
                this.state = 114;
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
            this.state = 135;
            this._errHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this._input, 1, this._ctx)) {
                case 1:
                    this.enterOuterAlt(_localctx, 1);
                    {
                        this.state = 116;
                        this.functionDef();
                    }
                    break;
                case 2:
                    this.enterOuterAlt(_localctx, 2);
                    {
                        this.state = 117;
                        this.variableDecl();
                        this.state = 118;
                        this.match(LPCParser.T__0);
                    }
                    break;
                case 3:
                    this.enterOuterAlt(_localctx, 3);
                    {
                        this.state = 120;
                        this.macroInvoke();
                    }
                    break;
                case 4:
                    this.enterOuterAlt(_localctx, 4);
                    {
                        this.state = 121;
                        this.ifStatement();
                    }
                    break;
                case 5:
                    this.enterOuterAlt(_localctx, 5);
                    {
                        this.state = 122;
                        this.whileStatement();
                    }
                    break;
                case 6:
                    this.enterOuterAlt(_localctx, 6);
                    {
                        this.state = 123;
                        this.forStatement();
                    }
                    break;
                case 7:
                    this.enterOuterAlt(_localctx, 7);
                    {
                        this.state = 124;
                        this.doWhileStatement();
                    }
                    break;
                case 8:
                    this.enterOuterAlt(_localctx, 8);
                    {
                        this.state = 125;
                        this.foreachStatement();
                    }
                    break;
                case 9:
                    this.enterOuterAlt(_localctx, 9);
                    {
                        this.state = 126;
                        this.switchStatement();
                    }
                    break;
                case 10:
                    this.enterOuterAlt(_localctx, 10);
                    {
                        this.state = 127;
                        this.breakStatement();
                    }
                    break;
                case 11:
                    this.enterOuterAlt(_localctx, 11);
                    {
                        this.state = 128;
                        this.continueStatement();
                    }
                    break;
                case 12:
                    this.enterOuterAlt(_localctx, 12);
                    {
                        this.state = 129;
                        this.returnStatement();
                    }
                    break;
                case 13:
                    this.enterOuterAlt(_localctx, 13);
                    {
                        this.state = 130;
                        this.inheritStatement();
                    }
                    break;
                case 14:
                    this.enterOuterAlt(_localctx, 14);
                    {
                        this.state = 131;
                        this.block();
                    }
                    break;
                case 15:
                    this.enterOuterAlt(_localctx, 15);
                    {
                        this.state = 132;
                        this.exprStatement();
                    }
                    break;
                case 16:
                    this.enterOuterAlt(_localctx, 16);
                    {
                        this.state = 133;
                        this.prototypeStatement();
                    }
                    break;
                case 17:
                    this.enterOuterAlt(_localctx, 17);
                    {
                        this.state = 134;
                        this.match(LPCParser.T__0);
                    }
                    break;
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
    functionDef() {
        let _localctx = new FunctionDefContext(this._ctx, this.state);
        this.enterRule(_localctx, 4, LPCParser.RULE_functionDef);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 140;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                while (_la === LPCParser.MODIFIER) {
                    {
                        {
                            this.state = 137;
                            this.match(LPCParser.MODIFIER);
                        }
                    }
                    this.state = 142;
                    this._errHandler.sync(this);
                    _la = this._input.LA(1);
                }
                this.state = 144;
                this._errHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this._input, 3, this._ctx)) {
                    case 1:
                        {
                            this.state = 143;
                            this.typeSpec();
                        }
                        break;
                }
                this.state = 149;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                while (_la === LPCParser.STAR) {
                    {
                        {
                            this.state = 146;
                            this.match(LPCParser.STAR);
                        }
                    }
                    this.state = 151;
                    this._errHandler.sync(this);
                    _la = this._input.LA(1);
                }
                this.state = 152;
                this.match(LPCParser.Identifier);
                this.state = 153;
                this.match(LPCParser.T__1);
                this.state = 155;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.T__4) | (1 << LPCParser.T__5) | (1 << LPCParser.T__6) | (1 << LPCParser.T__7) | (1 << LPCParser.T__8) | (1 << LPCParser.T__9) | (1 << LPCParser.T__10) | (1 << LPCParser.T__11) | (1 << LPCParser.T__12) | (1 << LPCParser.T__13))) !== 0) || _la === LPCParser.STAR || _la === LPCParser.Identifier) {
                    {
                        this.state = 154;
                        this.parameterList();
                    }
                }
                this.state = 157;
                this.match(LPCParser.T__2);
                this.state = 158;
                this.block();
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
    variableDecl() {
        let _localctx = new VariableDeclContext(this._ctx, this.state);
        this.enterRule(_localctx, 6, LPCParser.RULE_variableDecl);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 163;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                while (_la === LPCParser.MODIFIER) {
                    {
                        {
                            this.state = 160;
                            this.match(LPCParser.MODIFIER);
                        }
                    }
                    this.state = 165;
                    this._errHandler.sync(this);
                    _la = this._input.LA(1);
                }
                this.state = 166;
                this.typeSpec();
                this.state = 167;
                this.variableDeclarator();
                this.state = 172;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                while (_la === LPCParser.T__3) {
                    {
                        {
                            this.state = 168;
                            this.match(LPCParser.T__3);
                            this.state = 169;
                            this.variableDeclarator();
                        }
                    }
                    this.state = 174;
                    this._errHandler.sync(this);
                    _la = this._input.LA(1);
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
    variableDeclarator() {
        let _localctx = new VariableDeclaratorContext(this._ctx, this.state);
        this.enterRule(_localctx, 8, LPCParser.RULE_variableDeclarator);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 178;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                while (_la === LPCParser.STAR) {
                    {
                        {
                            this.state = 175;
                            this.match(LPCParser.STAR);
                        }
                    }
                    this.state = 180;
                    this._errHandler.sync(this);
                    _la = this._input.LA(1);
                }
                this.state = 181;
                this.match(LPCParser.Identifier);
                this.state = 184;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                if (_la === LPCParser.ASSIGN) {
                    {
                        this.state = 182;
                        this.match(LPCParser.ASSIGN);
                        this.state = 183;
                        this.expression();
                    }
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
    parameterList() {
        let _localctx = new ParameterListContext(this._ctx, this.state);
        this.enterRule(_localctx, 10, LPCParser.RULE_parameterList);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 186;
                this.parameter();
                this.state = 191;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                while (_la === LPCParser.T__3) {
                    {
                        {
                            this.state = 187;
                            this.match(LPCParser.T__3);
                            this.state = 188;
                            this.parameter();
                        }
                    }
                    this.state = 193;
                    this._errHandler.sync(this);
                    _la = this._input.LA(1);
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
    parameter() {
        let _localctx = new ParameterContext(this._ctx, this.state);
        this.enterRule(_localctx, 12, LPCParser.RULE_parameter);
        let _la;
        try {
            this.state = 213;
            this._errHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this._input, 14, this._ctx)) {
                case 1:
                    this.enterOuterAlt(_localctx, 1);
                    {
                        this.state = 194;
                        this.typeSpec();
                        this.state = 196;
                        this._errHandler.sync(this);
                        _la = this._input.LA(1);
                        if (_la === LPCParser.REF) {
                            {
                                this.state = 195;
                                this.match(LPCParser.REF);
                            }
                        }
                        this.state = 201;
                        this._errHandler.sync(this);
                        _la = this._input.LA(1);
                        while (_la === LPCParser.STAR) {
                            {
                                {
                                    this.state = 198;
                                    this.match(LPCParser.STAR);
                                }
                            }
                            this.state = 203;
                            this._errHandler.sync(this);
                            _la = this._input.LA(1);
                        }
                        this.state = 204;
                        this.match(LPCParser.Identifier);
                    }
                    break;
                case 2:
                    this.enterOuterAlt(_localctx, 2);
                    {
                        this.state = 209;
                        this._errHandler.sync(this);
                        _la = this._input.LA(1);
                        while (_la === LPCParser.STAR) {
                            {
                                {
                                    this.state = 206;
                                    this.match(LPCParser.STAR);
                                }
                            }
                            this.state = 211;
                            this._errHandler.sync(this);
                            _la = this._input.LA(1);
                        }
                        this.state = 212;
                        this.match(LPCParser.Identifier);
                    }
                    break;
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
    typeSpec() {
        let _localctx = new TypeSpecContext(this._ctx, this.state);
        this.enterRule(_localctx, 14, LPCParser.RULE_typeSpec);
        try {
            let _alt;
            this.state = 232;
            this._errHandler.sync(this);
            switch (this._input.LA(1)) {
                case LPCParser.T__4:
                    this.enterOuterAlt(_localctx, 1);
                    {
                        this.state = 215;
                        this.match(LPCParser.T__4);
                    }
                    break;
                case LPCParser.T__5:
                    this.enterOuterAlt(_localctx, 2);
                    {
                        this.state = 216;
                        this.match(LPCParser.T__5);
                    }
                    break;
                case LPCParser.T__6:
                    this.enterOuterAlt(_localctx, 3);
                    {
                        this.state = 217;
                        this.match(LPCParser.T__6);
                    }
                    break;
                case LPCParser.T__7:
                    this.enterOuterAlt(_localctx, 4);
                    {
                        this.state = 218;
                        this.match(LPCParser.T__7);
                    }
                    break;
                case LPCParser.T__8:
                    this.enterOuterAlt(_localctx, 5);
                    {
                        this.state = 219;
                        this.match(LPCParser.T__8);
                    }
                    break;
                case LPCParser.T__9:
                    this.enterOuterAlt(_localctx, 6);
                    {
                        this.state = 220;
                        this.match(LPCParser.T__9);
                    }
                    break;
                case LPCParser.T__10:
                    this.enterOuterAlt(_localctx, 7);
                    {
                        this.state = 221;
                        this.match(LPCParser.T__10);
                    }
                    break;
                case LPCParser.T__11:
                    this.enterOuterAlt(_localctx, 8);
                    {
                        this.state = 222;
                        this.match(LPCParser.T__11);
                    }
                    break;
                case LPCParser.T__12:
                    this.enterOuterAlt(_localctx, 9);
                    {
                        this.state = 223;
                        this.match(LPCParser.T__12);
                    }
                    break;
                case LPCParser.T__13:
                    this.enterOuterAlt(_localctx, 10);
                    {
                        this.state = 224;
                        this.match(LPCParser.T__13);
                    }
                    break;
                case LPCParser.Identifier:
                    this.enterOuterAlt(_localctx, 11);
                    {
                        this.state = 225;
                        this.match(LPCParser.Identifier);
                        this.state = 229;
                        this._errHandler.sync(this);
                        _alt = this.interpreter.adaptivePredict(this._input, 15, this._ctx);
                        while (_alt !== 2 && _alt !== ATN_1.ATN.INVALID_ALT_NUMBER) {
                            if (_alt === 1) {
                                {
                                    {
                                        this.state = 226;
                                        this.match(LPCParser.STAR);
                                    }
                                }
                            }
                            this.state = 231;
                            this._errHandler.sync(this);
                            _alt = this.interpreter.adaptivePredict(this._input, 15, this._ctx);
                        }
                    }
                    break;
                default:
                    throw new NoViableAltException_1.NoViableAltException(this);
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
    block() {
        let _localctx = new BlockContext(this._ctx, this.state);
        this.enterRule(_localctx, 16, LPCParser.RULE_block);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 234;
                this.match(LPCParser.T__14);
                this.state = 238;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.T__0) | (1 << LPCParser.T__1) | (1 << LPCParser.T__4) | (1 << LPCParser.T__5) | (1 << LPCParser.T__6) | (1 << LPCParser.T__7) | (1 << LPCParser.T__8) | (1 << LPCParser.T__9) | (1 << LPCParser.T__10) | (1 << LPCParser.T__11) | (1 << LPCParser.T__12) | (1 << LPCParser.T__13) | (1 << LPCParser.T__14) | (1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.IF) | (1 << LPCParser.FOR) | (1 << LPCParser.WHILE))) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & ((1 << (LPCParser.DO - 32)) | (1 << (LPCParser.SWITCH - 32)) | (1 << (LPCParser.BREAK - 32)) | (1 << (LPCParser.CONTINUE - 32)) | (1 << (LPCParser.RETURN - 32)) | (1 << (LPCParser.FOREACH - 32)) | (1 << (LPCParser.INHERIT - 32)) | (1 << (LPCParser.CATCH - 32)) | (1 << (LPCParser.REF - 32)) | (1 << (LPCParser.INC - 32)) | (1 << (LPCParser.DEC - 32)) | (1 << (LPCParser.PLUS - 32)) | (1 << (LPCParser.MINUS - 32)) | (1 << (LPCParser.STAR - 32)) | (1 << (LPCParser.SCOPE - 32)))) !== 0) || ((((_la - 68)) & ~0x1F) === 0 && ((1 << (_la - 68)) & ((1 << (LPCParser.NOT - 68)) | (1 << (LPCParser.CLOSURE - 68)) | (1 << (LPCParser.MODIFIER - 68)) | (1 << (LPCParser.Identifier - 68)) | (1 << (LPCParser.CHAR_LITERAL - 68)) | (1 << (LPCParser.BIT_NOT - 68)) | (1 << (LPCParser.HEREDOC_STRING - 68)))) !== 0)) {
                    {
                        {
                            this.state = 235;
                            this.statement();
                        }
                    }
                    this.state = 240;
                    this._errHandler.sync(this);
                    _la = this._input.LA(1);
                }
                this.state = 241;
                this.match(LPCParser.T__15);
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
    exprStatement() {
        let _localctx = new ExprStatementContext(this._ctx, this.state);
        this.enterRule(_localctx, 18, LPCParser.RULE_exprStatement);
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 243;
                this.expression();
                this.state = 244;
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
        this.enterRule(_localctx, 20, LPCParser.RULE_expression);
        try {
            let _alt;
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 246;
                this.assignmentExpression();
                this.state = 251;
                this._errHandler.sync(this);
                _alt = this.interpreter.adaptivePredict(this._input, 18, this._ctx);
                while (_alt !== 2 && _alt !== ATN_1.ATN.INVALID_ALT_NUMBER) {
                    if (_alt === 1) {
                        {
                            {
                                this.state = 247;
                                this.match(LPCParser.T__3);
                                this.state = 248;
                                this.assignmentExpression();
                            }
                        }
                    }
                    this.state = 253;
                    this._errHandler.sync(this);
                    _alt = this.interpreter.adaptivePredict(this._input, 18, this._ctx);
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
    assignmentExpression() {
        let _localctx = new AssignmentExpressionContext(this._ctx, this.state);
        this.enterRule(_localctx, 22, LPCParser.RULE_assignmentExpression);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 254;
                this.conditionalExpression();
                this.state = 257;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                if (((((_la - 50)) & ~0x1F) === 0 && ((1 << (_la - 50)) & ((1 << (LPCParser.PLUS_ASSIGN - 50)) | (1 << (LPCParser.MINUS_ASSIGN - 50)) | (1 << (LPCParser.STAR_ASSIGN - 50)) | (1 << (LPCParser.DIV_ASSIGN - 50)) | (1 << (LPCParser.PERCENT_ASSIGN - 50)) | (1 << (LPCParser.ASSIGN - 50)) | (1 << (LPCParser.BIT_OR_ASSIGN - 50)))) !== 0) || _la === LPCParser.BIT_AND_ASSIGN) {
                    {
                        this.state = 255;
                        _la = this._input.LA(1);
                        if (!(((((_la - 50)) & ~0x1F) === 0 && ((1 << (_la - 50)) & ((1 << (LPCParser.PLUS_ASSIGN - 50)) | (1 << (LPCParser.MINUS_ASSIGN - 50)) | (1 << (LPCParser.STAR_ASSIGN - 50)) | (1 << (LPCParser.DIV_ASSIGN - 50)) | (1 << (LPCParser.PERCENT_ASSIGN - 50)) | (1 << (LPCParser.ASSIGN - 50)) | (1 << (LPCParser.BIT_OR_ASSIGN - 50)))) !== 0) || _la === LPCParser.BIT_AND_ASSIGN)) {
                            this._errHandler.recoverInline(this);
                        }
                        else {
                            if (this._input.LA(1) === Token_1.Token.EOF) {
                                this.matchedEOF = true;
                            }
                            this._errHandler.reportMatch(this);
                            this.consume();
                        }
                        this.state = 256;
                        this.expression();
                    }
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
    conditionalExpression() {
        let _localctx = new ConditionalExpressionContext(this._ctx, this.state);
        this.enterRule(_localctx, 24, LPCParser.RULE_conditionalExpression);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 259;
                this.logicalOrExpression();
                this.state = 265;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                if (_la === LPCParser.T__16) {
                    {
                        this.state = 260;
                        this.match(LPCParser.T__16);
                        this.state = 261;
                        this.expression();
                        this.state = 262;
                        this.match(LPCParser.T__17);
                        this.state = 263;
                        this.conditionalExpression();
                    }
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
    logicalOrExpression() {
        let _localctx = new LogicalOrExpressionContext(this._ctx, this.state);
        this.enterRule(_localctx, 26, LPCParser.RULE_logicalOrExpression);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 267;
                this.logicalAndExpression();
                this.state = 272;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                while (_la === LPCParser.OR) {
                    {
                        {
                            this.state = 268;
                            this.match(LPCParser.OR);
                            this.state = 269;
                            this.logicalAndExpression();
                        }
                    }
                    this.state = 274;
                    this._errHandler.sync(this);
                    _la = this._input.LA(1);
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
    logicalAndExpression() {
        let _localctx = new LogicalAndExpressionContext(this._ctx, this.state);
        this.enterRule(_localctx, 28, LPCParser.RULE_logicalAndExpression);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 275;
                this.bitwiseOrExpression();
                this.state = 280;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                while (_la === LPCParser.AND) {
                    {
                        {
                            this.state = 276;
                            this.match(LPCParser.AND);
                            this.state = 277;
                            this.bitwiseOrExpression();
                        }
                    }
                    this.state = 282;
                    this._errHandler.sync(this);
                    _la = this._input.LA(1);
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
    bitwiseOrExpression() {
        let _localctx = new BitwiseOrExpressionContext(this._ctx, this.state);
        this.enterRule(_localctx, 30, LPCParser.RULE_bitwiseOrExpression);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 283;
                this.bitwiseXorExpression();
                this.state = 288;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                while (_la === LPCParser.BIT_OR) {
                    {
                        {
                            this.state = 284;
                            this.match(LPCParser.BIT_OR);
                            this.state = 285;
                            this.bitwiseXorExpression();
                        }
                    }
                    this.state = 290;
                    this._errHandler.sync(this);
                    _la = this._input.LA(1);
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
    bitwiseXorExpression() {
        let _localctx = new BitwiseXorExpressionContext(this._ctx, this.state);
        this.enterRule(_localctx, 32, LPCParser.RULE_bitwiseXorExpression);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 291;
                this.bitwiseAndExpression();
                this.state = 296;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                while (_la === LPCParser.BIT_XOR) {
                    {
                        {
                            this.state = 292;
                            this.match(LPCParser.BIT_XOR);
                            this.state = 293;
                            this.bitwiseAndExpression();
                        }
                    }
                    this.state = 298;
                    this._errHandler.sync(this);
                    _la = this._input.LA(1);
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
    bitwiseAndExpression() {
        let _localctx = new BitwiseAndExpressionContext(this._ctx, this.state);
        this.enterRule(_localctx, 34, LPCParser.RULE_bitwiseAndExpression);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 299;
                this.equalityExpression();
                this.state = 304;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                while (_la === LPCParser.BIT_AND) {
                    {
                        {
                            this.state = 300;
                            this.match(LPCParser.BIT_AND);
                            this.state = 301;
                            this.equalityExpression();
                        }
                    }
                    this.state = 306;
                    this._errHandler.sync(this);
                    _la = this._input.LA(1);
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
    equalityExpression() {
        let _localctx = new EqualityExpressionContext(this._ctx, this.state);
        this.enterRule(_localctx, 36, LPCParser.RULE_equalityExpression);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 307;
                this.relationalExpression();
                this.state = 312;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                while (_la === LPCParser.EQ || _la === LPCParser.NE) {
                    {
                        {
                            this.state = 308;
                            _la = this._input.LA(1);
                            if (!(_la === LPCParser.EQ || _la === LPCParser.NE)) {
                                this._errHandler.recoverInline(this);
                            }
                            else {
                                if (this._input.LA(1) === Token_1.Token.EOF) {
                                    this.matchedEOF = true;
                                }
                                this._errHandler.reportMatch(this);
                                this.consume();
                            }
                            this.state = 309;
                            this.relationalExpression();
                        }
                    }
                    this.state = 314;
                    this._errHandler.sync(this);
                    _la = this._input.LA(1);
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
    relationalExpression() {
        let _localctx = new RelationalExpressionContext(this._ctx, this.state);
        this.enterRule(_localctx, 38, LPCParser.RULE_relationalExpression);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 315;
                this.shiftExpression();
                this.state = 320;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                while (((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & ((1 << (LPCParser.GT - 61)) | (1 << (LPCParser.LT - 61)) | (1 << (LPCParser.GE - 61)) | (1 << (LPCParser.LE - 61)))) !== 0)) {
                    {
                        {
                            this.state = 316;
                            _la = this._input.LA(1);
                            if (!(((((_la - 61)) & ~0x1F) === 0 && ((1 << (_la - 61)) & ((1 << (LPCParser.GT - 61)) | (1 << (LPCParser.LT - 61)) | (1 << (LPCParser.GE - 61)) | (1 << (LPCParser.LE - 61)))) !== 0))) {
                                this._errHandler.recoverInline(this);
                            }
                            else {
                                if (this._input.LA(1) === Token_1.Token.EOF) {
                                    this.matchedEOF = true;
                                }
                                this._errHandler.reportMatch(this);
                                this.consume();
                            }
                            this.state = 317;
                            this.shiftExpression();
                        }
                    }
                    this.state = 322;
                    this._errHandler.sync(this);
                    _la = this._input.LA(1);
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
    shiftExpression() {
        let _localctx = new ShiftExpressionContext(this._ctx, this.state);
        this.enterRule(_localctx, 40, LPCParser.RULE_shiftExpression);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 323;
                this.additiveExpression();
                this.state = 328;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                while (_la === LPCParser.SHIFT_LEFT || _la === LPCParser.SHIFT_RIGHT) {
                    {
                        {
                            this.state = 324;
                            _la = this._input.LA(1);
                            if (!(_la === LPCParser.SHIFT_LEFT || _la === LPCParser.SHIFT_RIGHT)) {
                                this._errHandler.recoverInline(this);
                            }
                            else {
                                if (this._input.LA(1) === Token_1.Token.EOF) {
                                    this.matchedEOF = true;
                                }
                                this._errHandler.reportMatch(this);
                                this.consume();
                            }
                            this.state = 325;
                            this.additiveExpression();
                        }
                    }
                    this.state = 330;
                    this._errHandler.sync(this);
                    _la = this._input.LA(1);
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
    additiveExpression() {
        let _localctx = new AdditiveExpressionContext(this._ctx, this.state);
        this.enterRule(_localctx, 42, LPCParser.RULE_additiveExpression);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 331;
                this.multiplicativeExpression();
                this.state = 336;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                while (_la === LPCParser.PLUS || _la === LPCParser.MINUS) {
                    {
                        {
                            this.state = 332;
                            _la = this._input.LA(1);
                            if (!(_la === LPCParser.PLUS || _la === LPCParser.MINUS)) {
                                this._errHandler.recoverInline(this);
                            }
                            else {
                                if (this._input.LA(1) === Token_1.Token.EOF) {
                                    this.matchedEOF = true;
                                }
                                this._errHandler.reportMatch(this);
                                this.consume();
                            }
                            this.state = 333;
                            this.multiplicativeExpression();
                        }
                    }
                    this.state = 338;
                    this._errHandler.sync(this);
                    _la = this._input.LA(1);
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
    multiplicativeExpression() {
        let _localctx = new MultiplicativeExpressionContext(this._ctx, this.state);
        this.enterRule(_localctx, 44, LPCParser.RULE_multiplicativeExpression);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 339;
                this.unaryExpression();
                this.state = 344;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                while (((((_la - 57)) & ~0x1F) === 0 && ((1 << (_la - 57)) & ((1 << (LPCParser.STAR - 57)) | (1 << (LPCParser.DIV - 57)) | (1 << (LPCParser.PERCENT - 57)))) !== 0)) {
                    {
                        {
                            this.state = 340;
                            _la = this._input.LA(1);
                            if (!(((((_la - 57)) & ~0x1F) === 0 && ((1 << (_la - 57)) & ((1 << (LPCParser.STAR - 57)) | (1 << (LPCParser.DIV - 57)) | (1 << (LPCParser.PERCENT - 57)))) !== 0))) {
                                this._errHandler.recoverInline(this);
                            }
                            else {
                                if (this._input.LA(1) === Token_1.Token.EOF) {
                                    this.matchedEOF = true;
                                }
                                this._errHandler.reportMatch(this);
                                this.consume();
                            }
                            this.state = 341;
                            this.unaryExpression();
                        }
                    }
                    this.state = 346;
                    this._errHandler.sync(this);
                    _la = this._input.LA(1);
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
    unaryExpression() {
        let _localctx = new UnaryExpressionContext(this._ctx, this.state);
        this.enterRule(_localctx, 46, LPCParser.RULE_unaryExpression);
        let _la;
        try {
            this.state = 361;
            this._errHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this._input, 32, this._ctx)) {
                case 1:
                    this.enterOuterAlt(_localctx, 1);
                    {
                        this.state = 348;
                        this._errHandler.sync(this);
                        _la = this._input.LA(1);
                        if (_la === LPCParser.INC || _la === LPCParser.DEC) {
                            {
                                this.state = 347;
                                _la = this._input.LA(1);
                                if (!(_la === LPCParser.INC || _la === LPCParser.DEC)) {
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
                        this.state = 350;
                        this.postfixExpression();
                    }
                    break;
                case 2:
                    this.enterOuterAlt(_localctx, 2);
                    {
                        this.state = 351;
                        _la = this._input.LA(1);
                        if (!(((((_la - 55)) & ~0x1F) === 0 && ((1 << (_la - 55)) & ((1 << (LPCParser.PLUS - 55)) | (1 << (LPCParser.MINUS - 55)) | (1 << (LPCParser.STAR - 55)) | (1 << (LPCParser.NOT - 55)) | (1 << (LPCParser.BIT_NOT - 55)))) !== 0))) {
                            this._errHandler.recoverInline(this);
                        }
                        else {
                            if (this._input.LA(1) === Token_1.Token.EOF) {
                                this.matchedEOF = true;
                            }
                            this._errHandler.reportMatch(this);
                            this.consume();
                        }
                        this.state = 352;
                        this.unaryExpression();
                    }
                    break;
                case 3:
                    this.enterOuterAlt(_localctx, 3);
                    {
                        this.state = 353;
                        this.match(LPCParser.CATCH);
                        this.state = 354;
                        this.match(LPCParser.T__1);
                        this.state = 355;
                        this.expression();
                        this.state = 356;
                        this.match(LPCParser.T__2);
                    }
                    break;
                case 4:
                    this.enterOuterAlt(_localctx, 4);
                    {
                        this.state = 358;
                        this.match(LPCParser.CATCH);
                        this.state = 359;
                        this.block();
                    }
                    break;
                case 5:
                    this.enterOuterAlt(_localctx, 5);
                    {
                        this.state = 360;
                        this.castExpression();
                    }
                    break;
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
    castExpression() {
        let _localctx = new CastExpressionContext(this._ctx, this.state);
        this.enterRule(_localctx, 48, LPCParser.RULE_castExpression);
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 363;
                this.match(LPCParser.T__1);
                this.state = 364;
                this.castType();
                this.state = 365;
                this.match(LPCParser.T__2);
                this.state = 366;
                this.unaryExpression();
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
    castType() {
        let _localctx = new CastTypeContext(this._ctx, this.state);
        this.enterRule(_localctx, 50, LPCParser.RULE_castType);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 368;
                _la = this._input.LA(1);
                if (!((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.T__4) | (1 << LPCParser.T__5) | (1 << LPCParser.T__6) | (1 << LPCParser.T__7) | (1 << LPCParser.T__8) | (1 << LPCParser.T__9) | (1 << LPCParser.T__10) | (1 << LPCParser.T__11) | (1 << LPCParser.T__12) | (1 << LPCParser.T__13))) !== 0))) {
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
    postfixExpression() {
        let _localctx = new PostfixExpressionContext(this._ctx, this.state);
        this.enterRule(_localctx, 52, LPCParser.RULE_postfixExpression);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 370;
                this.primary();
                this.state = 393;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                while (_la === LPCParser.T__1 || _la === LPCParser.T__18 || ((((_la - 46)) & ~0x1F) === 0 && ((1 << (_la - 46)) & ((1 << (LPCParser.ARROW - 46)) | (1 << (LPCParser.DOT - 46)) | (1 << (LPCParser.INC - 46)) | (1 << (LPCParser.DEC - 46)) | (1 << (LPCParser.SCOPE - 46)))) !== 0)) {
                    {
                        this.state = 391;
                        this._errHandler.sync(this);
                        switch (this._input.LA(1)) {
                            case LPCParser.ARROW:
                            case LPCParser.DOT:
                            case LPCParser.SCOPE:
                                {
                                    {
                                        this.state = 371;
                                        _la = this._input.LA(1);
                                        if (!(((((_la - 46)) & ~0x1F) === 0 && ((1 << (_la - 46)) & ((1 << (LPCParser.ARROW - 46)) | (1 << (LPCParser.DOT - 46)) | (1 << (LPCParser.SCOPE - 46)))) !== 0))) {
                                            this._errHandler.recoverInline(this);
                                        }
                                        else {
                                            if (this._input.LA(1) === Token_1.Token.EOF) {
                                                this.matchedEOF = true;
                                            }
                                            this._errHandler.reportMatch(this);
                                            this.consume();
                                        }
                                        this.state = 372;
                                        this.match(LPCParser.Identifier);
                                        this.state = 378;
                                        this._errHandler.sync(this);
                                        switch (this.interpreter.adaptivePredict(this._input, 34, this._ctx)) {
                                            case 1:
                                                {
                                                    this.state = 373;
                                                    this.match(LPCParser.T__1);
                                                    this.state = 375;
                                                    this._errHandler.sync(this);
                                                    _la = this._input.LA(1);
                                                    if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.T__1) | (1 << LPCParser.T__10) | (1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.STRING_LITERAL))) !== 0) || ((((_la - 41)) & ~0x1F) === 0 && ((1 << (_la - 41)) & ((1 << (LPCParser.CATCH - 41)) | (1 << (LPCParser.REF - 41)) | (1 << (LPCParser.INC - 41)) | (1 << (LPCParser.DEC - 41)) | (1 << (LPCParser.PLUS - 41)) | (1 << (LPCParser.MINUS - 41)) | (1 << (LPCParser.STAR - 41)) | (1 << (LPCParser.SCOPE - 41)) | (1 << (LPCParser.NOT - 41)) | (1 << (LPCParser.CLOSURE - 41)))) !== 0) || ((((_la - 73)) & ~0x1F) === 0 && ((1 << (_la - 73)) & ((1 << (LPCParser.Identifier - 73)) | (1 << (LPCParser.CHAR_LITERAL - 73)) | (1 << (LPCParser.BIT_NOT - 73)) | (1 << (LPCParser.HEREDOC_STRING - 73)))) !== 0)) {
                                                        {
                                                            this.state = 374;
                                                            this.argumentList();
                                                        }
                                                    }
                                                    this.state = 377;
                                                    this.match(LPCParser.T__2);
                                                }
                                                break;
                                        }
                                    }
                                }
                                break;
                            case LPCParser.T__1:
                                {
                                    {
                                        this.state = 380;
                                        this.match(LPCParser.T__1);
                                        this.state = 382;
                                        this._errHandler.sync(this);
                                        _la = this._input.LA(1);
                                        if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.T__1) | (1 << LPCParser.T__10) | (1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.STRING_LITERAL))) !== 0) || ((((_la - 41)) & ~0x1F) === 0 && ((1 << (_la - 41)) & ((1 << (LPCParser.CATCH - 41)) | (1 << (LPCParser.REF - 41)) | (1 << (LPCParser.INC - 41)) | (1 << (LPCParser.DEC - 41)) | (1 << (LPCParser.PLUS - 41)) | (1 << (LPCParser.MINUS - 41)) | (1 << (LPCParser.STAR - 41)) | (1 << (LPCParser.SCOPE - 41)) | (1 << (LPCParser.NOT - 41)) | (1 << (LPCParser.CLOSURE - 41)))) !== 0) || ((((_la - 73)) & ~0x1F) === 0 && ((1 << (_la - 73)) & ((1 << (LPCParser.Identifier - 73)) | (1 << (LPCParser.CHAR_LITERAL - 73)) | (1 << (LPCParser.BIT_NOT - 73)) | (1 << (LPCParser.HEREDOC_STRING - 73)))) !== 0)) {
                                            {
                                                this.state = 381;
                                                this.argumentList();
                                            }
                                        }
                                        this.state = 384;
                                        this.match(LPCParser.T__2);
                                    }
                                }
                                break;
                            case LPCParser.T__18:
                                {
                                    this.state = 385;
                                    this.match(LPCParser.T__18);
                                    this.state = 386;
                                    this.sliceExpr();
                                    this.state = 387;
                                    this.match(LPCParser.T__19);
                                }
                                break;
                            case LPCParser.INC:
                                {
                                    this.state = 389;
                                    this.match(LPCParser.INC);
                                }
                                break;
                            case LPCParser.DEC:
                                {
                                    this.state = 390;
                                    this.match(LPCParser.DEC);
                                }
                                break;
                            default:
                                throw new NoViableAltException_1.NoViableAltException(this);
                        }
                    }
                    this.state = 395;
                    this._errHandler.sync(this);
                    _la = this._input.LA(1);
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
    argumentList() {
        let _localctx = new ArgumentListContext(this._ctx, this.state);
        this.enterRule(_localctx, 54, LPCParser.RULE_argumentList);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 396;
                this.assignmentExpression();
                this.state = 398;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                if (_la === LPCParser.ELLIPSIS) {
                    {
                        this.state = 397;
                        this.match(LPCParser.ELLIPSIS);
                    }
                }
                this.state = 407;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                while (_la === LPCParser.T__3) {
                    {
                        {
                            this.state = 400;
                            this.match(LPCParser.T__3);
                            this.state = 401;
                            this.assignmentExpression();
                            this.state = 403;
                            this._errHandler.sync(this);
                            _la = this._input.LA(1);
                            if (_la === LPCParser.ELLIPSIS) {
                                {
                                    this.state = 402;
                                    this.match(LPCParser.ELLIPSIS);
                                }
                            }
                        }
                    }
                    this.state = 409;
                    this._errHandler.sync(this);
                    _la = this._input.LA(1);
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
    primary() {
        let _localctx = new PrimaryContext(this._ctx, this.state);
        this.enterRule(_localctx, 56, LPCParser.RULE_primary);
        let _la;
        try {
            this.state = 440;
            this._errHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this._input, 43, this._ctx)) {
                case 1:
                    _localctx = new ScopeIdentifierContext(_localctx);
                    this.enterOuterAlt(_localctx, 1);
                    {
                        this.state = 410;
                        this.match(LPCParser.SCOPE);
                        this.state = 411;
                        this.match(LPCParser.Identifier);
                    }
                    break;
                case 2:
                    _localctx = new StringConcatenationContext(_localctx);
                    this.enterOuterAlt(_localctx, 2);
                    {
                        this.state = 412;
                        this.stringConcat();
                    }
                    break;
                case 3:
                    _localctx = new ClosureExprContext(_localctx);
                    this.enterOuterAlt(_localctx, 3);
                    {
                        this.state = 413;
                        this.match(LPCParser.CLOSURE);
                    }
                    break;
                case 4:
                    _localctx = new MappingLiteralExprContext(_localctx);
                    this.enterOuterAlt(_localctx, 4);
                    {
                        this.state = 414;
                        this.mappingLiteral();
                    }
                    break;
                case 5:
                    _localctx = new AnonFunctionContext(_localctx);
                    this.enterOuterAlt(_localctx, 5);
                    {
                        this.state = 415;
                        this.match(LPCParser.T__10);
                        this.state = 416;
                        this.match(LPCParser.T__1);
                        this.state = 418;
                        this._errHandler.sync(this);
                        _la = this._input.LA(1);
                        if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.T__4) | (1 << LPCParser.T__5) | (1 << LPCParser.T__6) | (1 << LPCParser.T__7) | (1 << LPCParser.T__8) | (1 << LPCParser.T__9) | (1 << LPCParser.T__10) | (1 << LPCParser.T__11) | (1 << LPCParser.T__12) | (1 << LPCParser.T__13))) !== 0) || _la === LPCParser.STAR || _la === LPCParser.Identifier) {
                            {
                                this.state = 417;
                                this.parameterList();
                            }
                        }
                        this.state = 420;
                        this.match(LPCParser.T__2);
                        this.state = 421;
                        this.block();
                    }
                    break;
                case 6:
                    _localctx = new IdentifierPrimaryContext(_localctx);
                    this.enterOuterAlt(_localctx, 6);
                    {
                        this.state = 422;
                        this.match(LPCParser.Identifier);
                    }
                    break;
                case 7:
                    _localctx = new IntegerPrimaryContext(_localctx);
                    this.enterOuterAlt(_localctx, 7);
                    {
                        this.state = 423;
                        this.match(LPCParser.INTEGER);
                    }
                    break;
                case 8:
                    _localctx = new FloatPrimaryContext(_localctx);
                    this.enterOuterAlt(_localctx, 8);
                    {
                        this.state = 424;
                        this.match(LPCParser.FLOAT);
                    }
                    break;
                case 9:
                    _localctx = new StringPrimaryContext(_localctx);
                    this.enterOuterAlt(_localctx, 9);
                    {
                        this.state = 425;
                        _la = this._input.LA(1);
                        if (!(_la === LPCParser.STRING_LITERAL || _la === LPCParser.HEREDOC_STRING)) {
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
                    break;
                case 10:
                    _localctx = new CharPrimaryContext(_localctx);
                    this.enterOuterAlt(_localctx, 10);
                    {
                        this.state = 426;
                        this.match(LPCParser.CHAR_LITERAL);
                    }
                    break;
                case 11:
                    _localctx = new ArrayLiteralContext(_localctx);
                    this.enterOuterAlt(_localctx, 11);
                    {
                        this.state = 427;
                        this.match(LPCParser.T__1);
                        this.state = 428;
                        this.match(LPCParser.T__14);
                        this.state = 430;
                        this._errHandler.sync(this);
                        _la = this._input.LA(1);
                        if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.T__1) | (1 << LPCParser.T__10) | (1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.STRING_LITERAL))) !== 0) || ((((_la - 41)) & ~0x1F) === 0 && ((1 << (_la - 41)) & ((1 << (LPCParser.CATCH - 41)) | (1 << (LPCParser.REF - 41)) | (1 << (LPCParser.INC - 41)) | (1 << (LPCParser.DEC - 41)) | (1 << (LPCParser.PLUS - 41)) | (1 << (LPCParser.MINUS - 41)) | (1 << (LPCParser.STAR - 41)) | (1 << (LPCParser.SCOPE - 41)) | (1 << (LPCParser.NOT - 41)) | (1 << (LPCParser.CLOSURE - 41)))) !== 0) || ((((_la - 73)) & ~0x1F) === 0 && ((1 << (_la - 73)) & ((1 << (LPCParser.Identifier - 73)) | (1 << (LPCParser.CHAR_LITERAL - 73)) | (1 << (LPCParser.BIT_NOT - 73)) | (1 << (LPCParser.HEREDOC_STRING - 73)))) !== 0)) {
                            {
                                this.state = 429;
                                this.expressionList();
                            }
                        }
                        this.state = 432;
                        this.match(LPCParser.T__15);
                        this.state = 433;
                        this.match(LPCParser.T__2);
                    }
                    break;
                case 12:
                    _localctx = new ParenExprContext(_localctx);
                    this.enterOuterAlt(_localctx, 12);
                    {
                        this.state = 434;
                        this.match(LPCParser.T__1);
                        this.state = 435;
                        this.expression();
                        this.state = 436;
                        this.match(LPCParser.T__2);
                    }
                    break;
                case 13:
                    _localctx = new RefVariableContext(_localctx);
                    this.enterOuterAlt(_localctx, 13);
                    {
                        this.state = 438;
                        this.match(LPCParser.REF);
                        this.state = 439;
                        this.match(LPCParser.Identifier);
                    }
                    break;
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
    stringConcat() {
        let _localctx = new StringConcatContext(this._ctx, this.state);
        this.enterRule(_localctx, 58, LPCParser.RULE_stringConcat);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 443;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                do {
                    {
                        {
                            this.state = 442;
                            this.concatItem();
                        }
                    }
                    this.state = 445;
                    this._errHandler.sync(this);
                    _la = this._input.LA(1);
                } while (_la === LPCParser.STRING_LITERAL || _la === LPCParser.Identifier);
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
    concatItem() {
        let _localctx = new ConcatItemContext(this._ctx, this.state);
        this.enterRule(_localctx, 60, LPCParser.RULE_concatItem);
        let _la;
        try {
            this.state = 455;
            this._errHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this._input, 46, this._ctx)) {
                case 1:
                    this.enterOuterAlt(_localctx, 1);
                    {
                        this.state = 447;
                        this.match(LPCParser.STRING_LITERAL);
                    }
                    break;
                case 2:
                    this.enterOuterAlt(_localctx, 2);
                    {
                        this.state = 448;
                        this.match(LPCParser.Identifier);
                        this.state = 449;
                        this.match(LPCParser.T__1);
                        this.state = 451;
                        this._errHandler.sync(this);
                        _la = this._input.LA(1);
                        if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.T__1) | (1 << LPCParser.T__10) | (1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.STRING_LITERAL))) !== 0) || ((((_la - 41)) & ~0x1F) === 0 && ((1 << (_la - 41)) & ((1 << (LPCParser.CATCH - 41)) | (1 << (LPCParser.REF - 41)) | (1 << (LPCParser.INC - 41)) | (1 << (LPCParser.DEC - 41)) | (1 << (LPCParser.PLUS - 41)) | (1 << (LPCParser.MINUS - 41)) | (1 << (LPCParser.STAR - 41)) | (1 << (LPCParser.SCOPE - 41)) | (1 << (LPCParser.NOT - 41)) | (1 << (LPCParser.CLOSURE - 41)))) !== 0) || ((((_la - 73)) & ~0x1F) === 0 && ((1 << (_la - 73)) & ((1 << (LPCParser.Identifier - 73)) | (1 << (LPCParser.CHAR_LITERAL - 73)) | (1 << (LPCParser.BIT_NOT - 73)) | (1 << (LPCParser.HEREDOC_STRING - 73)))) !== 0)) {
                            {
                                this.state = 450;
                                this.argumentList();
                            }
                        }
                        this.state = 453;
                        this.match(LPCParser.T__2);
                    }
                    break;
                case 3:
                    this.enterOuterAlt(_localctx, 3);
                    {
                        this.state = 454;
                        this.match(LPCParser.Identifier);
                    }
                    break;
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
    ifStatement() {
        let _localctx = new IfStatementContext(this._ctx, this.state);
        this.enterRule(_localctx, 62, LPCParser.RULE_ifStatement);
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 457;
                this.match(LPCParser.IF);
                this.state = 458;
                this.match(LPCParser.T__1);
                this.state = 459;
                this.expression();
                this.state = 460;
                this.match(LPCParser.T__2);
                this.state = 461;
                this.statement();
                this.state = 464;
                this._errHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this._input, 47, this._ctx)) {
                    case 1:
                        {
                            this.state = 462;
                            this.match(LPCParser.ELSE);
                            this.state = 463;
                            this.statement();
                        }
                        break;
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
    whileStatement() {
        let _localctx = new WhileStatementContext(this._ctx, this.state);
        this.enterRule(_localctx, 64, LPCParser.RULE_whileStatement);
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 466;
                this.match(LPCParser.WHILE);
                this.state = 467;
                this.match(LPCParser.T__1);
                this.state = 468;
                this.expression();
                this.state = 469;
                this.match(LPCParser.T__2);
                this.state = 470;
                this.statement();
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
    doWhileStatement() {
        let _localctx = new DoWhileStatementContext(this._ctx, this.state);
        this.enterRule(_localctx, 66, LPCParser.RULE_doWhileStatement);
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 472;
                this.match(LPCParser.DO);
                this.state = 473;
                this.statement();
                this.state = 474;
                this.match(LPCParser.WHILE);
                this.state = 475;
                this.match(LPCParser.T__1);
                this.state = 476;
                this.expression();
                this.state = 477;
                this.match(LPCParser.T__2);
                this.state = 478;
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
    forStatement() {
        let _localctx = new ForStatementContext(this._ctx, this.state);
        this.enterRule(_localctx, 68, LPCParser.RULE_forStatement);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 480;
                this.match(LPCParser.FOR);
                this.state = 481;
                this.match(LPCParser.T__1);
                this.state = 483;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.T__1) | (1 << LPCParser.T__4) | (1 << LPCParser.T__5) | (1 << LPCParser.T__6) | (1 << LPCParser.T__7) | (1 << LPCParser.T__8) | (1 << LPCParser.T__9) | (1 << LPCParser.T__10) | (1 << LPCParser.T__11) | (1 << LPCParser.T__12) | (1 << LPCParser.T__13) | (1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.STRING_LITERAL))) !== 0) || ((((_la - 41)) & ~0x1F) === 0 && ((1 << (_la - 41)) & ((1 << (LPCParser.CATCH - 41)) | (1 << (LPCParser.REF - 41)) | (1 << (LPCParser.INC - 41)) | (1 << (LPCParser.DEC - 41)) | (1 << (LPCParser.PLUS - 41)) | (1 << (LPCParser.MINUS - 41)) | (1 << (LPCParser.STAR - 41)) | (1 << (LPCParser.SCOPE - 41)) | (1 << (LPCParser.NOT - 41)) | (1 << (LPCParser.CLOSURE - 41)) | (1 << (LPCParser.MODIFIER - 41)))) !== 0) || ((((_la - 73)) & ~0x1F) === 0 && ((1 << (_la - 73)) & ((1 << (LPCParser.Identifier - 73)) | (1 << (LPCParser.CHAR_LITERAL - 73)) | (1 << (LPCParser.BIT_NOT - 73)) | (1 << (LPCParser.HEREDOC_STRING - 73)))) !== 0)) {
                    {
                        this.state = 482;
                        this.forInit();
                    }
                }
                this.state = 485;
                this.match(LPCParser.T__0);
                this.state = 487;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.T__1) | (1 << LPCParser.T__10) | (1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.STRING_LITERAL))) !== 0) || ((((_la - 41)) & ~0x1F) === 0 && ((1 << (_la - 41)) & ((1 << (LPCParser.CATCH - 41)) | (1 << (LPCParser.REF - 41)) | (1 << (LPCParser.INC - 41)) | (1 << (LPCParser.DEC - 41)) | (1 << (LPCParser.PLUS - 41)) | (1 << (LPCParser.MINUS - 41)) | (1 << (LPCParser.STAR - 41)) | (1 << (LPCParser.SCOPE - 41)) | (1 << (LPCParser.NOT - 41)) | (1 << (LPCParser.CLOSURE - 41)))) !== 0) || ((((_la - 73)) & ~0x1F) === 0 && ((1 << (_la - 73)) & ((1 << (LPCParser.Identifier - 73)) | (1 << (LPCParser.CHAR_LITERAL - 73)) | (1 << (LPCParser.BIT_NOT - 73)) | (1 << (LPCParser.HEREDOC_STRING - 73)))) !== 0)) {
                    {
                        this.state = 486;
                        this.expression();
                    }
                }
                this.state = 489;
                this.match(LPCParser.T__0);
                this.state = 491;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.T__1) | (1 << LPCParser.T__10) | (1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.STRING_LITERAL))) !== 0) || ((((_la - 41)) & ~0x1F) === 0 && ((1 << (_la - 41)) & ((1 << (LPCParser.CATCH - 41)) | (1 << (LPCParser.REF - 41)) | (1 << (LPCParser.INC - 41)) | (1 << (LPCParser.DEC - 41)) | (1 << (LPCParser.PLUS - 41)) | (1 << (LPCParser.MINUS - 41)) | (1 << (LPCParser.STAR - 41)) | (1 << (LPCParser.SCOPE - 41)) | (1 << (LPCParser.NOT - 41)) | (1 << (LPCParser.CLOSURE - 41)))) !== 0) || ((((_la - 73)) & ~0x1F) === 0 && ((1 << (_la - 73)) & ((1 << (LPCParser.Identifier - 73)) | (1 << (LPCParser.CHAR_LITERAL - 73)) | (1 << (LPCParser.BIT_NOT - 73)) | (1 << (LPCParser.HEREDOC_STRING - 73)))) !== 0)) {
                    {
                        this.state = 490;
                        this.expressionList();
                    }
                }
                this.state = 493;
                this.match(LPCParser.T__2);
                this.state = 494;
                this.statement();
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
    forInit() {
        let _localctx = new ForInitContext(this._ctx, this.state);
        this.enterRule(_localctx, 70, LPCParser.RULE_forInit);
        try {
            this.state = 498;
            this._errHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this._input, 51, this._ctx)) {
                case 1:
                    this.enterOuterAlt(_localctx, 1);
                    {
                        this.state = 496;
                        this.variableDecl();
                    }
                    break;
                case 2:
                    this.enterOuterAlt(_localctx, 2);
                    {
                        this.state = 497;
                        this.expressionList();
                    }
                    break;
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
    expressionList() {
        let _localctx = new ExpressionListContext(this._ctx, this.state);
        this.enterRule(_localctx, 72, LPCParser.RULE_expressionList);
        let _la;
        try {
            let _alt;
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 500;
                this.expression();
                this.state = 505;
                this._errHandler.sync(this);
                _alt = this.interpreter.adaptivePredict(this._input, 52, this._ctx);
                while (_alt !== 2 && _alt !== ATN_1.ATN.INVALID_ALT_NUMBER) {
                    if (_alt === 1) {
                        {
                            {
                                this.state = 501;
                                this.match(LPCParser.T__3);
                                this.state = 502;
                                this.expression();
                            }
                        }
                    }
                    this.state = 507;
                    this._errHandler.sync(this);
                    _alt = this.interpreter.adaptivePredict(this._input, 52, this._ctx);
                }
                this.state = 509;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                if (_la === LPCParser.T__3) {
                    {
                        this.state = 508;
                        this.match(LPCParser.T__3);
                    }
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
    foreachStatement() {
        let _localctx = new ForeachStatementContext(this._ctx, this.state);
        this.enterRule(_localctx, 74, LPCParser.RULE_foreachStatement);
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 511;
                this.match(LPCParser.FOREACH);
                this.state = 512;
                this.match(LPCParser.T__1);
                this.state = 513;
                this.foreachInit();
                this.state = 514;
                this.match(LPCParser.IN);
                this.state = 515;
                this.expression();
                this.state = 516;
                this.match(LPCParser.T__2);
                this.state = 517;
                this.statement();
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
    foreachInit() {
        let _localctx = new ForeachInitContext(this._ctx, this.state);
        this.enterRule(_localctx, 76, LPCParser.RULE_foreachInit);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 519;
                this.foreachVar();
                this.state = 522;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                if (_la === LPCParser.T__3) {
                    {
                        this.state = 520;
                        this.match(LPCParser.T__3);
                        this.state = 521;
                        this.foreachVar();
                    }
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
    foreachVar() {
        let _localctx = new ForeachVarContext(this._ctx, this.state);
        this.enterRule(_localctx, 78, LPCParser.RULE_foreachVar);
        let _la;
        try {
            this.state = 543;
            this._errHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this._input, 58, this._ctx)) {
                case 1:
                    this.enterOuterAlt(_localctx, 1);
                    {
                        this.state = 524;
                        this.typeSpec();
                        this.state = 526;
                        this._errHandler.sync(this);
                        _la = this._input.LA(1);
                        if (_la === LPCParser.REF) {
                            {
                                this.state = 525;
                                this.match(LPCParser.REF);
                            }
                        }
                        this.state = 531;
                        this._errHandler.sync(this);
                        _la = this._input.LA(1);
                        while (_la === LPCParser.STAR) {
                            {
                                {
                                    this.state = 528;
                                    this.match(LPCParser.STAR);
                                }
                            }
                            this.state = 533;
                            this._errHandler.sync(this);
                            _la = this._input.LA(1);
                        }
                        this.state = 534;
                        this.match(LPCParser.Identifier);
                    }
                    break;
                case 2:
                    this.enterOuterAlt(_localctx, 2);
                    {
                        this.state = 539;
                        this._errHandler.sync(this);
                        _la = this._input.LA(1);
                        while (_la === LPCParser.STAR) {
                            {
                                {
                                    this.state = 536;
                                    this.match(LPCParser.STAR);
                                }
                            }
                            this.state = 541;
                            this._errHandler.sync(this);
                            _la = this._input.LA(1);
                        }
                        this.state = 542;
                        this.match(LPCParser.Identifier);
                    }
                    break;
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
    switchStatement() {
        let _localctx = new SwitchStatementContext(this._ctx, this.state);
        this.enterRule(_localctx, 80, LPCParser.RULE_switchStatement);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 545;
                this.match(LPCParser.SWITCH);
                this.state = 546;
                this.match(LPCParser.T__1);
                this.state = 547;
                this.expression();
                this.state = 548;
                this.match(LPCParser.T__2);
                this.state = 549;
                this.match(LPCParser.T__14);
                this.state = 553;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                while (_la === LPCParser.CASE || _la === LPCParser.DEFAULT) {
                    {
                        {
                            this.state = 550;
                            this.switchSection();
                        }
                    }
                    this.state = 555;
                    this._errHandler.sync(this);
                    _la = this._input.LA(1);
                }
                this.state = 556;
                this.match(LPCParser.T__15);
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
    switchSection() {
        let _localctx = new SwitchSectionContext(this._ctx, this.state);
        this.enterRule(_localctx, 82, LPCParser.RULE_switchSection);
        let _la;
        try {
            let _alt;
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 558;
                this.switchLabelWithColon();
                this.state = 562;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.T__0) | (1 << LPCParser.T__1) | (1 << LPCParser.T__4) | (1 << LPCParser.T__5) | (1 << LPCParser.T__6) | (1 << LPCParser.T__7) | (1 << LPCParser.T__8) | (1 << LPCParser.T__9) | (1 << LPCParser.T__10) | (1 << LPCParser.T__11) | (1 << LPCParser.T__12) | (1 << LPCParser.T__13) | (1 << LPCParser.T__14) | (1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.IF) | (1 << LPCParser.FOR) | (1 << LPCParser.WHILE))) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & ((1 << (LPCParser.DO - 32)) | (1 << (LPCParser.SWITCH - 32)) | (1 << (LPCParser.BREAK - 32)) | (1 << (LPCParser.CONTINUE - 32)) | (1 << (LPCParser.RETURN - 32)) | (1 << (LPCParser.FOREACH - 32)) | (1 << (LPCParser.INHERIT - 32)) | (1 << (LPCParser.CATCH - 32)) | (1 << (LPCParser.REF - 32)) | (1 << (LPCParser.INC - 32)) | (1 << (LPCParser.DEC - 32)) | (1 << (LPCParser.PLUS - 32)) | (1 << (LPCParser.MINUS - 32)) | (1 << (LPCParser.STAR - 32)) | (1 << (LPCParser.SCOPE - 32)))) !== 0) || ((((_la - 68)) & ~0x1F) === 0 && ((1 << (_la - 68)) & ((1 << (LPCParser.NOT - 68)) | (1 << (LPCParser.CLOSURE - 68)) | (1 << (LPCParser.MODIFIER - 68)) | (1 << (LPCParser.Identifier - 68)) | (1 << (LPCParser.CHAR_LITERAL - 68)) | (1 << (LPCParser.BIT_NOT - 68)) | (1 << (LPCParser.HEREDOC_STRING - 68)))) !== 0)) {
                    {
                        {
                            this.state = 559;
                            this.statement();
                        }
                    }
                    this.state = 564;
                    this._errHandler.sync(this);
                    _la = this._input.LA(1);
                }
                this.state = 574;
                this._errHandler.sync(this);
                _alt = this.interpreter.adaptivePredict(this._input, 62, this._ctx);
                while (_alt !== 2 && _alt !== ATN_1.ATN.INVALID_ALT_NUMBER) {
                    if (_alt === 1) {
                        {
                            {
                                this.state = 565;
                                this.switchLabelWithColon();
                                this.state = 569;
                                this._errHandler.sync(this);
                                _la = this._input.LA(1);
                                while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.T__0) | (1 << LPCParser.T__1) | (1 << LPCParser.T__4) | (1 << LPCParser.T__5) | (1 << LPCParser.T__6) | (1 << LPCParser.T__7) | (1 << LPCParser.T__8) | (1 << LPCParser.T__9) | (1 << LPCParser.T__10) | (1 << LPCParser.T__11) | (1 << LPCParser.T__12) | (1 << LPCParser.T__13) | (1 << LPCParser.T__14) | (1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.IF) | (1 << LPCParser.FOR) | (1 << LPCParser.WHILE))) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & ((1 << (LPCParser.DO - 32)) | (1 << (LPCParser.SWITCH - 32)) | (1 << (LPCParser.BREAK - 32)) | (1 << (LPCParser.CONTINUE - 32)) | (1 << (LPCParser.RETURN - 32)) | (1 << (LPCParser.FOREACH - 32)) | (1 << (LPCParser.INHERIT - 32)) | (1 << (LPCParser.CATCH - 32)) | (1 << (LPCParser.REF - 32)) | (1 << (LPCParser.INC - 32)) | (1 << (LPCParser.DEC - 32)) | (1 << (LPCParser.PLUS - 32)) | (1 << (LPCParser.MINUS - 32)) | (1 << (LPCParser.STAR - 32)) | (1 << (LPCParser.SCOPE - 32)))) !== 0) || ((((_la - 68)) & ~0x1F) === 0 && ((1 << (_la - 68)) & ((1 << (LPCParser.NOT - 68)) | (1 << (LPCParser.CLOSURE - 68)) | (1 << (LPCParser.MODIFIER - 68)) | (1 << (LPCParser.Identifier - 68)) | (1 << (LPCParser.CHAR_LITERAL - 68)) | (1 << (LPCParser.BIT_NOT - 68)) | (1 << (LPCParser.HEREDOC_STRING - 68)))) !== 0)) {
                                    {
                                        {
                                            this.state = 566;
                                            this.statement();
                                        }
                                    }
                                    this.state = 571;
                                    this._errHandler.sync(this);
                                    _la = this._input.LA(1);
                                }
                            }
                        }
                    }
                    this.state = 576;
                    this._errHandler.sync(this);
                    _alt = this.interpreter.adaptivePredict(this._input, 62, this._ctx);
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
    switchLabelWithColon() {
        let _localctx = new SwitchLabelWithColonContext(this._ctx, this.state);
        this.enterRule(_localctx, 84, LPCParser.RULE_switchLabelWithColon);
        try {
            this.state = 583;
            this._errHandler.sync(this);
            switch (this._input.LA(1)) {
                case LPCParser.CASE:
                    this.enterOuterAlt(_localctx, 1);
                    {
                        this.state = 577;
                        this.match(LPCParser.CASE);
                        this.state = 578;
                        this.switchLabel();
                        this.state = 579;
                        this.match(LPCParser.T__17);
                    }
                    break;
                case LPCParser.DEFAULT:
                    this.enterOuterAlt(_localctx, 2);
                    {
                        this.state = 581;
                        this.match(LPCParser.DEFAULT);
                        this.state = 582;
                        this.match(LPCParser.T__17);
                    }
                    break;
                default:
                    throw new NoViableAltException_1.NoViableAltException(this);
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
    switchLabel() {
        let _localctx = new SwitchLabelContext(this._ctx, this.state);
        this.enterRule(_localctx, 86, LPCParser.RULE_switchLabel);
        let _la;
        try {
            this.state = 592;
            this._errHandler.sync(this);
            switch (this._input.LA(1)) {
                case LPCParser.T__1:
                case LPCParser.T__10:
                case LPCParser.INTEGER:
                case LPCParser.FLOAT:
                case LPCParser.STRING_LITERAL:
                case LPCParser.CATCH:
                case LPCParser.REF:
                case LPCParser.INC:
                case LPCParser.DEC:
                case LPCParser.PLUS:
                case LPCParser.MINUS:
                case LPCParser.STAR:
                case LPCParser.SCOPE:
                case LPCParser.NOT:
                case LPCParser.CLOSURE:
                case LPCParser.Identifier:
                case LPCParser.CHAR_LITERAL:
                case LPCParser.BIT_NOT:
                case LPCParser.HEREDOC_STRING:
                    this.enterOuterAlt(_localctx, 1);
                    {
                        this.state = 585;
                        this.expression();
                        this.state = 588;
                        this._errHandler.sync(this);
                        _la = this._input.LA(1);
                        if (_la === LPCParser.RANGE_OP) {
                            {
                                this.state = 586;
                                this.match(LPCParser.RANGE_OP);
                                this.state = 587;
                                this.expression();
                            }
                        }
                    }
                    break;
                case LPCParser.RANGE_OP:
                    this.enterOuterAlt(_localctx, 2);
                    {
                        this.state = 590;
                        this.match(LPCParser.RANGE_OP);
                        this.state = 591;
                        this.expression();
                    }
                    break;
                default:
                    throw new NoViableAltException_1.NoViableAltException(this);
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
    breakStatement() {
        let _localctx = new BreakStatementContext(this._ctx, this.state);
        this.enterRule(_localctx, 88, LPCParser.RULE_breakStatement);
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 594;
                this.match(LPCParser.BREAK);
                this.state = 595;
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
    continueStatement() {
        let _localctx = new ContinueStatementContext(this._ctx, this.state);
        this.enterRule(_localctx, 90, LPCParser.RULE_continueStatement);
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 597;
                this.match(LPCParser.CONTINUE);
                this.state = 598;
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
    returnStatement() {
        let _localctx = new ReturnStatementContext(this._ctx, this.state);
        this.enterRule(_localctx, 92, LPCParser.RULE_returnStatement);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 600;
                this.match(LPCParser.RETURN);
                this.state = 602;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.T__1) | (1 << LPCParser.T__10) | (1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.STRING_LITERAL))) !== 0) || ((((_la - 41)) & ~0x1F) === 0 && ((1 << (_la - 41)) & ((1 << (LPCParser.CATCH - 41)) | (1 << (LPCParser.REF - 41)) | (1 << (LPCParser.INC - 41)) | (1 << (LPCParser.DEC - 41)) | (1 << (LPCParser.PLUS - 41)) | (1 << (LPCParser.MINUS - 41)) | (1 << (LPCParser.STAR - 41)) | (1 << (LPCParser.SCOPE - 41)) | (1 << (LPCParser.NOT - 41)) | (1 << (LPCParser.CLOSURE - 41)))) !== 0) || ((((_la - 73)) & ~0x1F) === 0 && ((1 << (_la - 73)) & ((1 << (LPCParser.Identifier - 73)) | (1 << (LPCParser.CHAR_LITERAL - 73)) | (1 << (LPCParser.BIT_NOT - 73)) | (1 << (LPCParser.HEREDOC_STRING - 73)))) !== 0)) {
                    {
                        this.state = 601;
                        this.expression();
                    }
                }
                this.state = 604;
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
    inheritStatement() {
        let _localctx = new InheritStatementContext(this._ctx, this.state);
        this.enterRule(_localctx, 94, LPCParser.RULE_inheritStatement);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 606;
                this.match(LPCParser.INHERIT);
                this.state = 607;
                _la = this._input.LA(1);
                if (!(_la === LPCParser.STRING_LITERAL || _la === LPCParser.Identifier)) {
                    this._errHandler.recoverInline(this);
                }
                else {
                    if (this._input.LA(1) === Token_1.Token.EOF) {
                        this.matchedEOF = true;
                    }
                    this._errHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 608;
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
    prototypeStatement() {
        let _localctx = new PrototypeStatementContext(this._ctx, this.state);
        this.enterRule(_localctx, 96, LPCParser.RULE_prototypeStatement);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 613;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                while (_la === LPCParser.MODIFIER) {
                    {
                        {
                            this.state = 610;
                            this.match(LPCParser.MODIFIER);
                        }
                    }
                    this.state = 615;
                    this._errHandler.sync(this);
                    _la = this._input.LA(1);
                }
                this.state = 617;
                this._errHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this._input, 68, this._ctx)) {
                    case 1:
                        {
                            this.state = 616;
                            this.typeSpec();
                        }
                        break;
                }
                this.state = 622;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                while (_la === LPCParser.STAR) {
                    {
                        {
                            this.state = 619;
                            this.match(LPCParser.STAR);
                        }
                    }
                    this.state = 624;
                    this._errHandler.sync(this);
                    _la = this._input.LA(1);
                }
                this.state = 625;
                this.match(LPCParser.Identifier);
                this.state = 626;
                this.match(LPCParser.T__1);
                this.state = 628;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.T__4) | (1 << LPCParser.T__5) | (1 << LPCParser.T__6) | (1 << LPCParser.T__7) | (1 << LPCParser.T__8) | (1 << LPCParser.T__9) | (1 << LPCParser.T__10) | (1 << LPCParser.T__11) | (1 << LPCParser.T__12) | (1 << LPCParser.T__13))) !== 0) || _la === LPCParser.STAR || _la === LPCParser.Identifier) {
                    {
                        this.state = 627;
                        this.parameterList();
                    }
                }
                this.state = 630;
                this.match(LPCParser.T__2);
                this.state = 631;
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
    mappingLiteral() {
        let _localctx = new MappingLiteralContext(this._ctx, this.state);
        this.enterRule(_localctx, 98, LPCParser.RULE_mappingLiteral);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 633;
                this.match(LPCParser.T__1);
                this.state = 634;
                this.match(LPCParser.T__18);
                this.state = 636;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.T__1) | (1 << LPCParser.T__10) | (1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.STRING_LITERAL))) !== 0) || ((((_la - 41)) & ~0x1F) === 0 && ((1 << (_la - 41)) & ((1 << (LPCParser.CATCH - 41)) | (1 << (LPCParser.REF - 41)) | (1 << (LPCParser.INC - 41)) | (1 << (LPCParser.DEC - 41)) | (1 << (LPCParser.PLUS - 41)) | (1 << (LPCParser.MINUS - 41)) | (1 << (LPCParser.STAR - 41)) | (1 << (LPCParser.SCOPE - 41)) | (1 << (LPCParser.NOT - 41)) | (1 << (LPCParser.CLOSURE - 41)))) !== 0) || ((((_la - 73)) & ~0x1F) === 0 && ((1 << (_la - 73)) & ((1 << (LPCParser.Identifier - 73)) | (1 << (LPCParser.CHAR_LITERAL - 73)) | (1 << (LPCParser.BIT_NOT - 73)) | (1 << (LPCParser.HEREDOC_STRING - 73)))) !== 0)) {
                    {
                        this.state = 635;
                        this.mappingPairList();
                    }
                }
                this.state = 638;
                this.match(LPCParser.T__19);
                this.state = 639;
                this.match(LPCParser.T__2);
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
    mappingPairList() {
        let _localctx = new MappingPairListContext(this._ctx, this.state);
        this.enterRule(_localctx, 100, LPCParser.RULE_mappingPairList);
        let _la;
        try {
            let _alt;
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 641;
                this.mappingPair();
                this.state = 646;
                this._errHandler.sync(this);
                _alt = this.interpreter.adaptivePredict(this._input, 72, this._ctx);
                while (_alt !== 2 && _alt !== ATN_1.ATN.INVALID_ALT_NUMBER) {
                    if (_alt === 1) {
                        {
                            {
                                this.state = 642;
                                this.match(LPCParser.T__3);
                                this.state = 643;
                                this.mappingPair();
                            }
                        }
                    }
                    this.state = 648;
                    this._errHandler.sync(this);
                    _alt = this.interpreter.adaptivePredict(this._input, 72, this._ctx);
                }
                this.state = 650;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                if (_la === LPCParser.T__3) {
                    {
                        this.state = 649;
                        this.match(LPCParser.T__3);
                    }
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
    mappingPair() {
        let _localctx = new MappingPairContext(this._ctx, this.state);
        this.enterRule(_localctx, 102, LPCParser.RULE_mappingPair);
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 652;
                this.expression();
                this.state = 653;
                this.match(LPCParser.T__17);
                this.state = 654;
                this.expression();
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
    sliceExpr() {
        let _localctx = new SliceExprContext(this._ctx, this.state);
        this.enterRule(_localctx, 104, LPCParser.RULE_sliceExpr);
        let _la;
        try {
            this.state = 683;
            this._errHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this._input, 80, this._ctx)) {
                case 1:
                    _localctx = new TailIndexOnlyContext(_localctx);
                    this.enterOuterAlt(_localctx, 1);
                    {
                        this.state = 656;
                        this.match(LPCParser.LT);
                        this.state = 657;
                        this.expression();
                    }
                    break;
                case 2:
                    _localctx = new HeadRangeContext(_localctx);
                    this.enterOuterAlt(_localctx, 2);
                    {
                        this.state = 658;
                        this.expression();
                        this.state = 659;
                        this.match(LPCParser.RANGE_OP);
                        this.state = 661;
                        this._errHandler.sync(this);
                        _la = this._input.LA(1);
                        if (_la === LPCParser.LT) {
                            {
                                this.state = 660;
                                this.match(LPCParser.LT);
                            }
                        }
                        this.state = 664;
                        this._errHandler.sync(this);
                        _la = this._input.LA(1);
                        if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.T__1) | (1 << LPCParser.T__10) | (1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.STRING_LITERAL))) !== 0) || ((((_la - 41)) & ~0x1F) === 0 && ((1 << (_la - 41)) & ((1 << (LPCParser.CATCH - 41)) | (1 << (LPCParser.REF - 41)) | (1 << (LPCParser.INC - 41)) | (1 << (LPCParser.DEC - 41)) | (1 << (LPCParser.PLUS - 41)) | (1 << (LPCParser.MINUS - 41)) | (1 << (LPCParser.STAR - 41)) | (1 << (LPCParser.SCOPE - 41)) | (1 << (LPCParser.NOT - 41)) | (1 << (LPCParser.CLOSURE - 41)))) !== 0) || ((((_la - 73)) & ~0x1F) === 0 && ((1 << (_la - 73)) & ((1 << (LPCParser.Identifier - 73)) | (1 << (LPCParser.CHAR_LITERAL - 73)) | (1 << (LPCParser.BIT_NOT - 73)) | (1 << (LPCParser.HEREDOC_STRING - 73)))) !== 0)) {
                            {
                                this.state = 663;
                                this.expression();
                            }
                        }
                    }
                    break;
                case 3:
                    _localctx = new OpenRangeContext(_localctx);
                    this.enterOuterAlt(_localctx, 3);
                    {
                        this.state = 666;
                        this.match(LPCParser.RANGE_OP);
                        this.state = 668;
                        this._errHandler.sync(this);
                        _la = this._input.LA(1);
                        if (_la === LPCParser.LT) {
                            {
                                this.state = 667;
                                this.match(LPCParser.LT);
                            }
                        }
                        this.state = 671;
                        this._errHandler.sync(this);
                        _la = this._input.LA(1);
                        if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.T__1) | (1 << LPCParser.T__10) | (1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.STRING_LITERAL))) !== 0) || ((((_la - 41)) & ~0x1F) === 0 && ((1 << (_la - 41)) & ((1 << (LPCParser.CATCH - 41)) | (1 << (LPCParser.REF - 41)) | (1 << (LPCParser.INC - 41)) | (1 << (LPCParser.DEC - 41)) | (1 << (LPCParser.PLUS - 41)) | (1 << (LPCParser.MINUS - 41)) | (1 << (LPCParser.STAR - 41)) | (1 << (LPCParser.SCOPE - 41)) | (1 << (LPCParser.NOT - 41)) | (1 << (LPCParser.CLOSURE - 41)))) !== 0) || ((((_la - 73)) & ~0x1F) === 0 && ((1 << (_la - 73)) & ((1 << (LPCParser.Identifier - 73)) | (1 << (LPCParser.CHAR_LITERAL - 73)) | (1 << (LPCParser.BIT_NOT - 73)) | (1 << (LPCParser.HEREDOC_STRING - 73)))) !== 0)) {
                            {
                                this.state = 670;
                                this.expression();
                            }
                        }
                    }
                    break;
                case 4:
                    _localctx = new SingleIndexContext(_localctx);
                    this.enterOuterAlt(_localctx, 4);
                    {
                        this.state = 673;
                        this.expression();
                    }
                    break;
                case 5:
                    _localctx = new TailHeadRangeContext(_localctx);
                    this.enterOuterAlt(_localctx, 5);
                    {
                        this.state = 674;
                        this.match(LPCParser.LT);
                        this.state = 675;
                        this.expression();
                        this.state = 676;
                        this.match(LPCParser.RANGE_OP);
                        this.state = 678;
                        this._errHandler.sync(this);
                        _la = this._input.LA(1);
                        if (_la === LPCParser.LT) {
                            {
                                this.state = 677;
                                this.match(LPCParser.LT);
                            }
                        }
                        this.state = 681;
                        this._errHandler.sync(this);
                        _la = this._input.LA(1);
                        if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.T__1) | (1 << LPCParser.T__10) | (1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.STRING_LITERAL))) !== 0) || ((((_la - 41)) & ~0x1F) === 0 && ((1 << (_la - 41)) & ((1 << (LPCParser.CATCH - 41)) | (1 << (LPCParser.REF - 41)) | (1 << (LPCParser.INC - 41)) | (1 << (LPCParser.DEC - 41)) | (1 << (LPCParser.PLUS - 41)) | (1 << (LPCParser.MINUS - 41)) | (1 << (LPCParser.STAR - 41)) | (1 << (LPCParser.SCOPE - 41)) | (1 << (LPCParser.NOT - 41)) | (1 << (LPCParser.CLOSURE - 41)))) !== 0) || ((((_la - 73)) & ~0x1F) === 0 && ((1 << (_la - 73)) & ((1 << (LPCParser.Identifier - 73)) | (1 << (LPCParser.CHAR_LITERAL - 73)) | (1 << (LPCParser.BIT_NOT - 73)) | (1 << (LPCParser.HEREDOC_STRING - 73)))) !== 0)) {
                            {
                                this.state = 680;
                                this.expression();
                            }
                        }
                    }
                    break;
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
    macroInvoke() {
        let _localctx = new MacroInvokeContext(this._ctx, this.state);
        this.enterRule(_localctx, 106, LPCParser.RULE_macroInvoke);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 685;
                this.match(LPCParser.Identifier);
                this.state = 686;
                this.match(LPCParser.T__1);
                this.state = 688;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.T__1) | (1 << LPCParser.T__10) | (1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.STRING_LITERAL))) !== 0) || ((((_la - 41)) & ~0x1F) === 0 && ((1 << (_la - 41)) & ((1 << (LPCParser.CATCH - 41)) | (1 << (LPCParser.REF - 41)) | (1 << (LPCParser.INC - 41)) | (1 << (LPCParser.DEC - 41)) | (1 << (LPCParser.PLUS - 41)) | (1 << (LPCParser.MINUS - 41)) | (1 << (LPCParser.STAR - 41)) | (1 << (LPCParser.SCOPE - 41)) | (1 << (LPCParser.NOT - 41)) | (1 << (LPCParser.CLOSURE - 41)))) !== 0) || ((((_la - 73)) & ~0x1F) === 0 && ((1 << (_la - 73)) & ((1 << (LPCParser.Identifier - 73)) | (1 << (LPCParser.CHAR_LITERAL - 73)) | (1 << (LPCParser.BIT_NOT - 73)) | (1 << (LPCParser.HEREDOC_STRING - 73)))) !== 0)) {
                    {
                        this.state = 687;
                        this.argumentList();
                    }
                }
                this.state = 690;
                this.match(LPCParser.T__2);
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
LPCParser.T__5 = 6;
LPCParser.T__6 = 7;
LPCParser.T__7 = 8;
LPCParser.T__8 = 9;
LPCParser.T__9 = 10;
LPCParser.T__10 = 11;
LPCParser.T__11 = 12;
LPCParser.T__12 = 13;
LPCParser.T__13 = 14;
LPCParser.T__14 = 15;
LPCParser.T__15 = 16;
LPCParser.T__16 = 17;
LPCParser.T__17 = 18;
LPCParser.T__18 = 19;
LPCParser.T__19 = 20;
LPCParser.INTEGER = 21;
LPCParser.FLOAT = 22;
LPCParser.STRING_LITERAL = 23;
LPCParser.WS = 24;
LPCParser.LINE_COMMENT = 25;
LPCParser.BLOCK_COMMENT = 26;
LPCParser.DIRECTIVE = 27;
LPCParser.IF = 28;
LPCParser.ELSE = 29;
LPCParser.FOR = 30;
LPCParser.WHILE = 31;
LPCParser.DO = 32;
LPCParser.SWITCH = 33;
LPCParser.CASE = 34;
LPCParser.DEFAULT = 35;
LPCParser.BREAK = 36;
LPCParser.CONTINUE = 37;
LPCParser.RETURN = 38;
LPCParser.FOREACH = 39;
LPCParser.INHERIT = 40;
LPCParser.CATCH = 41;
LPCParser.REF = 42;
LPCParser.IN = 43;
LPCParser.ELLIPSIS = 44;
LPCParser.RANGE_OP = 45;
LPCParser.ARROW = 46;
LPCParser.DOT = 47;
LPCParser.INC = 48;
LPCParser.DEC = 49;
LPCParser.PLUS_ASSIGN = 50;
LPCParser.MINUS_ASSIGN = 51;
LPCParser.STAR_ASSIGN = 52;
LPCParser.DIV_ASSIGN = 53;
LPCParser.PERCENT_ASSIGN = 54;
LPCParser.PLUS = 55;
LPCParser.MINUS = 56;
LPCParser.STAR = 57;
LPCParser.DIV = 58;
LPCParser.PERCENT = 59;
LPCParser.SCOPE = 60;
LPCParser.GT = 61;
LPCParser.LT = 62;
LPCParser.GE = 63;
LPCParser.LE = 64;
LPCParser.EQ = 65;
LPCParser.NE = 66;
LPCParser.ASSIGN = 67;
LPCParser.NOT = 68;
LPCParser.AND = 69;
LPCParser.OR = 70;
LPCParser.CLOSURE = 71;
LPCParser.MODIFIER = 72;
LPCParser.Identifier = 73;
LPCParser.SHIFT_LEFT = 74;
LPCParser.SHIFT_RIGHT = 75;
LPCParser.CHAR_LITERAL = 76;
LPCParser.BIT_AND = 77;
LPCParser.BIT_OR = 78;
LPCParser.BIT_XOR = 79;
LPCParser.BIT_NOT = 80;
LPCParser.BIT_OR_ASSIGN = 81;
LPCParser.BIT_AND_ASSIGN = 82;
LPCParser.HEREDOC_STRING = 83;
LPCParser.RULE_sourceFile = 0;
LPCParser.RULE_statement = 1;
LPCParser.RULE_functionDef = 2;
LPCParser.RULE_variableDecl = 3;
LPCParser.RULE_variableDeclarator = 4;
LPCParser.RULE_parameterList = 5;
LPCParser.RULE_parameter = 6;
LPCParser.RULE_typeSpec = 7;
LPCParser.RULE_block = 8;
LPCParser.RULE_exprStatement = 9;
LPCParser.RULE_expression = 10;
LPCParser.RULE_assignmentExpression = 11;
LPCParser.RULE_conditionalExpression = 12;
LPCParser.RULE_logicalOrExpression = 13;
LPCParser.RULE_logicalAndExpression = 14;
LPCParser.RULE_bitwiseOrExpression = 15;
LPCParser.RULE_bitwiseXorExpression = 16;
LPCParser.RULE_bitwiseAndExpression = 17;
LPCParser.RULE_equalityExpression = 18;
LPCParser.RULE_relationalExpression = 19;
LPCParser.RULE_shiftExpression = 20;
LPCParser.RULE_additiveExpression = 21;
LPCParser.RULE_multiplicativeExpression = 22;
LPCParser.RULE_unaryExpression = 23;
LPCParser.RULE_castExpression = 24;
LPCParser.RULE_castType = 25;
LPCParser.RULE_postfixExpression = 26;
LPCParser.RULE_argumentList = 27;
LPCParser.RULE_primary = 28;
LPCParser.RULE_stringConcat = 29;
LPCParser.RULE_concatItem = 30;
LPCParser.RULE_ifStatement = 31;
LPCParser.RULE_whileStatement = 32;
LPCParser.RULE_doWhileStatement = 33;
LPCParser.RULE_forStatement = 34;
LPCParser.RULE_forInit = 35;
LPCParser.RULE_expressionList = 36;
LPCParser.RULE_foreachStatement = 37;
LPCParser.RULE_foreachInit = 38;
LPCParser.RULE_foreachVar = 39;
LPCParser.RULE_switchStatement = 40;
LPCParser.RULE_switchSection = 41;
LPCParser.RULE_switchLabelWithColon = 42;
LPCParser.RULE_switchLabel = 43;
LPCParser.RULE_breakStatement = 44;
LPCParser.RULE_continueStatement = 45;
LPCParser.RULE_returnStatement = 46;
LPCParser.RULE_inheritStatement = 47;
LPCParser.RULE_prototypeStatement = 48;
LPCParser.RULE_mappingLiteral = 49;
LPCParser.RULE_mappingPairList = 50;
LPCParser.RULE_mappingPair = 51;
LPCParser.RULE_sliceExpr = 52;
LPCParser.RULE_macroInvoke = 53;
// tslint:disable:no-trailing-whitespace
LPCParser.ruleNames = [
    "sourceFile", "statement", "functionDef", "variableDecl", "variableDeclarator",
    "parameterList", "parameter", "typeSpec", "block", "exprStatement", "expression",
    "assignmentExpression", "conditionalExpression", "logicalOrExpression",
    "logicalAndExpression", "bitwiseOrExpression", "bitwiseXorExpression",
    "bitwiseAndExpression", "equalityExpression", "relationalExpression",
    "shiftExpression", "additiveExpression", "multiplicativeExpression", "unaryExpression",
    "castExpression", "castType", "postfixExpression", "argumentList", "primary",
    "stringConcat", "concatItem", "ifStatement", "whileStatement", "doWhileStatement",
    "forStatement", "forInit", "expressionList", "foreachStatement", "foreachInit",
    "foreachVar", "switchStatement", "switchSection", "switchLabelWithColon",
    "switchLabel", "breakStatement", "continueStatement", "returnStatement",
    "inheritStatement", "prototypeStatement", "mappingLiteral", "mappingPairList",
    "mappingPair", "sliceExpr", "macroInvoke",
];
LPCParser._LITERAL_NAMES = [
    undefined, "';'", "'('", "')'", "','", "'int'", "'float'", "'string'",
    "'object'", "'mixed'", "'mapping'", "'function'", "'buffer'", "'void'",
    "'struct'", "'{'", "'}'", "'?'", "':'", "'['", "']'", undefined, undefined,
    undefined, undefined, undefined, undefined, undefined, "'if'", "'else'",
    "'for'", "'while'", "'do'", "'switch'", "'case'", "'default'", "'break'",
    "'continue'", "'return'", "'foreach'", "'inherit'", "'catch'", "'ref'",
    "'in'", "'...'", "'..'", "'->'", "'.'", "'++'", "'--'", "'+='", "'-='",
    "'*='", "'/='", "'%='", "'+'", "'-'", "'*'", "'/'", "'%'", "'::'", "'>'",
    "'<'", "'>='", "'<='", "'=='", "'!='", "'='", "'!'", "'&&'", "'||'", undefined,
    undefined, undefined, "'<<'", "'>>'", undefined, "'&'", "'|'", "'^'",
    "'~'", "'|='", "'&='",
];
LPCParser._SYMBOLIC_NAMES = [
    undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    "INTEGER", "FLOAT", "STRING_LITERAL", "WS", "LINE_COMMENT", "BLOCK_COMMENT",
    "DIRECTIVE", "IF", "ELSE", "FOR", "WHILE", "DO", "SWITCH", "CASE", "DEFAULT",
    "BREAK", "CONTINUE", "RETURN", "FOREACH", "INHERIT", "CATCH", "REF", "IN",
    "ELLIPSIS", "RANGE_OP", "ARROW", "DOT", "INC", "DEC", "PLUS_ASSIGN", "MINUS_ASSIGN",
    "STAR_ASSIGN", "DIV_ASSIGN", "PERCENT_ASSIGN", "PLUS", "MINUS", "STAR",
    "DIV", "PERCENT", "SCOPE", "GT", "LT", "GE", "LE", "EQ", "NE", "ASSIGN",
    "NOT", "AND", "OR", "CLOSURE", "MODIFIER", "Identifier", "SHIFT_LEFT",
    "SHIFT_RIGHT", "CHAR_LITERAL", "BIT_AND", "BIT_OR", "BIT_XOR", "BIT_NOT",
    "BIT_OR_ASSIGN", "BIT_AND_ASSIGN", "HEREDOC_STRING",
];
LPCParser.VOCABULARY = new VocabularyImpl_1.VocabularyImpl(LPCParser._LITERAL_NAMES, LPCParser._SYMBOLIC_NAMES, []);
LPCParser._serializedATNSegments = 2;
LPCParser._serializedATNSegment0 = "\x03\uC91D\uCABA\u058D\uAFBA\u4F53\u0607\uEA8B\uC241\x03U\u02B7\x04\x02" +
    "\t\x02\x04\x03\t\x03\x04\x04\t\x04\x04\x05\t\x05\x04\x06\t\x06\x04\x07" +
    "\t\x07\x04\b\t\b\x04\t\t\t\x04\n\t\n\x04\v\t\v\x04\f\t\f\x04\r\t\r\x04" +
    "\x0E\t\x0E\x04\x0F\t\x0F\x04\x10\t\x10\x04\x11\t\x11\x04\x12\t\x12\x04" +
    "\x13\t\x13\x04\x14\t\x14\x04\x15\t\x15\x04\x16\t\x16\x04\x17\t\x17\x04" +
    "\x18\t\x18\x04\x19\t\x19\x04\x1A\t\x1A\x04\x1B\t\x1B\x04\x1C\t\x1C\x04" +
    "\x1D\t\x1D\x04\x1E\t\x1E\x04\x1F\t\x1F\x04 \t \x04!\t!\x04\"\t\"\x04#" +
    "\t#\x04$\t$\x04%\t%\x04&\t&\x04\'\t\'\x04(\t(\x04)\t)\x04*\t*\x04+\t+" +
    "\x04,\t,\x04-\t-\x04.\t.\x04/\t/\x040\t0\x041\t1\x042\t2\x043\t3\x044" +
    "\t4\x045\t5\x046\t6\x047\t7\x03\x02\x07\x02p\n\x02\f\x02\x0E\x02s\v\x02" +
    "\x03\x02\x03\x02\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03" +
    "\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03" +
    "\x03\x03\x03\x03\x03\x03\x05\x03\x8A\n\x03\x03\x04\x07\x04\x8D\n\x04\f" +
    "\x04\x0E\x04\x90\v\x04\x03\x04\x05\x04\x93\n\x04\x03\x04\x07\x04\x96\n" +
    "\x04\f\x04\x0E\x04\x99\v\x04\x03\x04\x03\x04\x03\x04\x05\x04\x9E\n\x04" +
    "\x03\x04\x03\x04\x03\x04\x03\x05\x07\x05\xA4\n\x05\f\x05\x0E\x05\xA7\v" +
    "\x05\x03\x05\x03\x05\x03\x05\x03\x05\x07\x05\xAD\n\x05\f\x05\x0E\x05\xB0" +
    "\v\x05\x03\x06\x07\x06\xB3\n\x06\f\x06\x0E\x06\xB6\v\x06\x03\x06\x03\x06" +
    "\x03\x06\x05\x06\xBB\n\x06\x03\x07\x03\x07\x03\x07\x07\x07\xC0\n\x07\f" +
    "\x07\x0E\x07\xC3\v\x07\x03\b\x03\b\x05\b\xC7\n\b\x03\b\x07\b\xCA\n\b\f" +
    "\b\x0E\b\xCD\v\b\x03\b\x03\b\x03\b\x07\b\xD2\n\b\f\b\x0E\b\xD5\v\b\x03" +
    "\b\x05\b\xD8\n\b\x03\t\x03\t\x03\t\x03\t\x03\t\x03\t\x03\t\x03\t\x03\t" +
    "\x03\t\x03\t\x03\t\x07\t\xE6\n\t\f\t\x0E\t\xE9\v\t\x05\t\xEB\n\t\x03\n" +
    "\x03\n\x07\n\xEF\n\n\f\n\x0E\n\xF2\v\n\x03\n\x03\n\x03\v\x03\v\x03\v\x03" +
    "\f\x03\f\x03\f\x07\f\xFC\n\f\f\f\x0E\f\xFF\v\f\x03\r\x03\r\x03\r\x05\r" +
    "\u0104\n\r\x03\x0E\x03\x0E\x03\x0E\x03\x0E\x03\x0E\x03\x0E\x05\x0E\u010C" +
    "\n\x0E\x03\x0F\x03\x0F\x03\x0F\x07\x0F\u0111\n\x0F\f\x0F\x0E\x0F\u0114" +
    "\v\x0F\x03\x10\x03\x10\x03\x10\x07\x10\u0119\n\x10\f\x10\x0E\x10\u011C" +
    "\v\x10\x03\x11\x03\x11\x03\x11\x07\x11\u0121\n\x11\f\x11\x0E\x11\u0124" +
    "\v\x11\x03\x12\x03\x12\x03\x12\x07\x12\u0129\n\x12\f\x12\x0E\x12\u012C" +
    "\v\x12\x03\x13\x03\x13\x03\x13\x07\x13\u0131\n\x13\f\x13\x0E\x13\u0134" +
    "\v\x13\x03\x14\x03\x14\x03\x14\x07\x14\u0139\n\x14\f\x14\x0E\x14\u013C" +
    "\v\x14\x03\x15\x03\x15\x03\x15\x07\x15\u0141\n\x15\f\x15\x0E\x15\u0144" +
    "\v\x15\x03\x16\x03\x16\x03\x16\x07\x16\u0149\n\x16\f\x16\x0E\x16\u014C" +
    "\v\x16\x03\x17\x03\x17\x03\x17\x07\x17\u0151\n\x17\f\x17\x0E\x17\u0154" +
    "\v\x17\x03\x18\x03\x18\x03\x18\x07\x18\u0159\n\x18\f\x18\x0E\x18\u015C" +
    "\v\x18\x03\x19\x05\x19\u015F\n\x19\x03\x19\x03\x19\x03\x19\x03\x19\x03" +
    "\x19\x03\x19\x03\x19\x03\x19\x03\x19\x03\x19\x03\x19\x05\x19\u016C\n\x19" +
    "\x03\x1A\x03\x1A\x03\x1A\x03\x1A\x03\x1A\x03\x1B\x03\x1B\x03\x1C\x03\x1C" +
    "\x03\x1C\x03\x1C\x03\x1C\x05\x1C\u017A\n\x1C\x03\x1C\x05\x1C\u017D\n\x1C" +
    "\x03\x1C\x03\x1C\x05\x1C\u0181\n\x1C\x03\x1C\x03\x1C\x03\x1C\x03\x1C\x03" +
    "\x1C\x03\x1C\x03\x1C\x07\x1C\u018A\n\x1C\f\x1C\x0E\x1C\u018D\v\x1C\x03" +
    "\x1D\x03\x1D\x05\x1D\u0191\n\x1D\x03\x1D\x03\x1D\x03\x1D\x05\x1D\u0196" +
    "\n\x1D\x07\x1D\u0198\n\x1D\f\x1D\x0E\x1D\u019B\v\x1D\x03\x1E\x03\x1E\x03" +
    "\x1E\x03\x1E\x03\x1E\x03\x1E\x03\x1E\x03\x1E\x05\x1E\u01A5\n\x1E\x03\x1E" +
    "\x03\x1E\x03\x1E\x03\x1E\x03\x1E\x03\x1E\x03\x1E\x03\x1E\x03\x1E\x03\x1E" +
    "\x05\x1E\u01B1\n\x1E\x03\x1E\x03\x1E\x03\x1E\x03\x1E\x03\x1E\x03\x1E\x03" +
    "\x1E\x03\x1E\x05\x1E\u01BB\n\x1E\x03\x1F\x06\x1F\u01BE\n\x1F\r\x1F\x0E" +
    "\x1F\u01BF\x03 \x03 \x03 \x03 \x05 \u01C6\n \x03 \x03 \x05 \u01CA\n \x03" +
    "!\x03!\x03!\x03!\x03!\x03!\x03!\x05!\u01D3\n!\x03\"\x03\"\x03\"\x03\"" +
    "\x03\"\x03\"\x03#\x03#\x03#\x03#\x03#\x03#\x03#\x03#\x03$\x03$\x03$\x05" +
    "$\u01E6\n$\x03$\x03$\x05$\u01EA\n$\x03$\x03$\x05$\u01EE\n$\x03$\x03$\x03" +
    "$\x03%\x03%\x05%\u01F5\n%\x03&\x03&\x03&\x07&\u01FA\n&\f&\x0E&\u01FD\v" +
    "&\x03&\x05&\u0200\n&\x03\'\x03\'\x03\'\x03\'\x03\'\x03\'\x03\'\x03\'\x03" +
    "(\x03(\x03(\x05(\u020D\n(\x03)\x03)\x05)\u0211\n)\x03)\x07)\u0214\n)\f" +
    ")\x0E)\u0217\v)\x03)\x03)\x03)\x07)\u021C\n)\f)\x0E)\u021F\v)\x03)\x05" +
    ")\u0222\n)\x03*\x03*\x03*\x03*\x03*\x03*\x07*\u022A\n*\f*\x0E*\u022D\v" +
    "*\x03*\x03*\x03+\x03+\x07+\u0233\n+\f+\x0E+\u0236\v+\x03+\x03+\x07+\u023A" +
    "\n+\f+\x0E+\u023D\v+\x07+\u023F\n+\f+\x0E+\u0242\v+\x03,\x03,\x03,\x03" +
    ",\x03,\x03,\x05,\u024A\n,\x03-\x03-\x03-\x05-\u024F\n-\x03-\x03-\x05-" +
    "\u0253\n-\x03.\x03.\x03.\x03/\x03/\x03/\x030\x030\x050\u025D\n0\x030\x03" +
    "0\x031\x031\x031\x031\x032\x072\u0266\n2\f2\x0E2\u0269\v2\x032\x052\u026C" +
    "\n2\x032\x072\u026F\n2\f2\x0E2\u0272\v2\x032\x032\x032\x052\u0277\n2\x03" +
    "2\x032\x032\x033\x033\x033\x053\u027F\n3\x033\x033\x033\x034\x034\x03" +
    "4\x074\u0287\n4\f4\x0E4\u028A\v4\x034\x054\u028D\n4\x035\x035\x035\x03" +
    "5\x036\x036\x036\x036\x036\x056\u0298\n6\x036\x056\u029B\n6\x036\x036" +
    "\x056\u029F\n6\x036\x056\u02A2\n6\x036\x036\x036\x036\x036\x056\u02A9" +
    "\n6\x036\x056\u02AC\n6\x056\u02AE\n6\x037\x037\x037\x057\u02B3\n7\x03" +
    "7\x037\x037\x02\x02\x028\x02\x02\x04\x02\x06\x02\b\x02\n\x02\f\x02\x0E" +
    "\x02\x10\x02\x12\x02\x14\x02\x16\x02\x18\x02\x1A\x02\x1C\x02\x1E\x02 " +
    "\x02\"\x02$\x02&\x02(\x02*\x02,\x02.\x020\x022\x024\x026\x028\x02:\x02" +
    "<\x02>\x02@\x02B\x02D\x02F\x02H\x02J\x02L\x02N\x02P\x02R\x02T\x02V\x02" +
    "X\x02Z\x02\\\x02^\x02`\x02b\x02d\x02f\x02h\x02j\x02l\x02\x02\x0E\x05\x02" +
    "48EEST\x03\x02CD\x03\x02?B\x03\x02LM\x03\x029:\x03\x02;=\x03\x0223\x05" +
    "\x029;FFRR\x03\x02\x07\x10\x04\x0201>>\x04\x02\x19\x19UU\x04\x02\x19\x19" +
    "KK\x02\u02FF\x02q\x03\x02\x02\x02\x04\x89\x03\x02\x02\x02\x06\x8E\x03" +
    "\x02\x02\x02\b\xA5\x03\x02\x02\x02\n\xB4\x03\x02\x02\x02\f\xBC\x03\x02" +
    "\x02\x02\x0E\xD7\x03\x02\x02\x02\x10\xEA\x03\x02\x02\x02\x12\xEC\x03\x02" +
    "\x02\x02\x14\xF5\x03\x02\x02\x02\x16\xF8\x03\x02\x02\x02\x18\u0100\x03" +
    "\x02\x02\x02\x1A\u0105\x03\x02\x02\x02\x1C\u010D\x03\x02\x02\x02\x1E\u0115" +
    "\x03\x02\x02\x02 \u011D\x03\x02\x02\x02\"\u0125\x03\x02\x02\x02$\u012D" +
    "\x03\x02\x02\x02&\u0135\x03\x02\x02\x02(\u013D\x03\x02\x02\x02*\u0145" +
    "\x03\x02\x02\x02,\u014D\x03\x02\x02\x02.\u0155\x03\x02\x02\x020\u016B" +
    "\x03\x02\x02\x022\u016D\x03\x02\x02\x024\u0172\x03\x02\x02\x026\u0174" +
    "\x03\x02\x02\x028\u018E\x03\x02\x02\x02:\u01BA\x03\x02\x02\x02<\u01BD" +
    "\x03\x02\x02\x02>\u01C9\x03\x02\x02\x02@\u01CB\x03\x02\x02\x02B\u01D4" +
    "\x03\x02\x02\x02D\u01DA\x03\x02\x02\x02F\u01E2\x03\x02\x02\x02H\u01F4" +
    "\x03\x02\x02\x02J\u01F6\x03\x02\x02\x02L\u0201\x03\x02\x02\x02N\u0209" +
    "\x03\x02\x02\x02P\u0221\x03\x02\x02\x02R\u0223\x03\x02\x02\x02T\u0230" +
    "\x03\x02\x02\x02V\u0249\x03\x02\x02\x02X\u0252\x03\x02\x02\x02Z\u0254" +
    "\x03\x02\x02\x02\\\u0257\x03\x02\x02\x02^\u025A\x03\x02\x02\x02`\u0260" +
    "\x03\x02\x02\x02b\u0267\x03\x02\x02\x02d\u027B\x03\x02\x02\x02f\u0283" +
    "\x03\x02\x02\x02h\u028E\x03\x02\x02\x02j\u02AD\x03\x02\x02\x02l\u02AF" +
    "\x03\x02\x02\x02np\x05\x04\x03\x02on\x03\x02\x02\x02ps\x03\x02\x02\x02" +
    "qo\x03\x02\x02\x02qr\x03\x02\x02\x02rt\x03\x02\x02\x02sq\x03\x02\x02\x02" +
    "tu\x07\x02\x02\x03u\x03\x03\x02\x02\x02v\x8A\x05\x06\x04\x02wx\x05\b\x05" +
    "\x02xy\x07\x03\x02\x02y\x8A\x03\x02\x02\x02z\x8A\x05l7\x02{\x8A\x05@!" +
    "\x02|\x8A\x05B\"\x02}\x8A\x05F$\x02~\x8A\x05D#\x02\x7F\x8A\x05L\'\x02" +
    "\x80\x8A\x05R*\x02\x81\x8A\x05Z.\x02\x82\x8A\x05\\/\x02\x83\x8A\x05^0" +
    "\x02\x84\x8A\x05`1\x02\x85\x8A\x05\x12\n\x02\x86\x8A\x05\x14\v\x02\x87" +
    "\x8A\x05b2\x02\x88\x8A\x07\x03\x02\x02\x89v\x03\x02\x02\x02\x89w\x03\x02" +
    "\x02\x02\x89z\x03\x02\x02\x02\x89{\x03\x02\x02\x02\x89|\x03\x02\x02\x02" +
    "\x89}\x03\x02\x02\x02\x89~\x03\x02\x02\x02\x89\x7F\x03\x02\x02\x02\x89" +
    "\x80\x03\x02\x02\x02\x89\x81\x03\x02\x02\x02\x89\x82\x03\x02\x02\x02\x89" +
    "\x83\x03\x02\x02\x02\x89\x84\x03\x02\x02\x02\x89\x85\x03\x02\x02\x02\x89" +
    "\x86\x03\x02\x02\x02\x89\x87\x03\x02\x02\x02\x89\x88\x03\x02\x02\x02\x8A" +
    "\x05\x03\x02\x02\x02\x8B\x8D\x07J\x02\x02\x8C\x8B\x03\x02\x02\x02\x8D" +
    "\x90\x03\x02\x02\x02\x8E\x8C\x03\x02\x02\x02\x8E\x8F\x03\x02\x02\x02\x8F" +
    "\x92\x03\x02\x02\x02\x90\x8E\x03\x02\x02\x02\x91\x93\x05\x10\t\x02\x92" +
    "\x91\x03\x02\x02\x02\x92\x93\x03\x02\x02\x02\x93\x97\x03\x02\x02\x02\x94" +
    "\x96\x07;\x02\x02\x95\x94\x03\x02\x02\x02\x96\x99\x03\x02\x02\x02\x97" +
    "\x95\x03\x02\x02\x02\x97\x98\x03\x02\x02\x02\x98\x9A\x03\x02\x02\x02\x99" +
    "\x97\x03\x02\x02\x02\x9A\x9B\x07K\x02\x02\x9B\x9D\x07\x04\x02\x02\x9C" +
    "\x9E\x05\f\x07\x02\x9D\x9C\x03\x02\x02\x02\x9D\x9E\x03\x02\x02\x02\x9E" +
    "\x9F\x03\x02\x02\x02\x9F\xA0\x07\x05\x02\x02\xA0\xA1\x05\x12\n\x02\xA1" +
    "\x07\x03\x02\x02\x02\xA2\xA4\x07J\x02\x02\xA3\xA2\x03\x02\x02\x02\xA4" +
    "\xA7\x03\x02\x02\x02\xA5\xA3\x03\x02\x02\x02\xA5\xA6\x03\x02\x02\x02\xA6" +
    "\xA8\x03\x02\x02\x02\xA7\xA5\x03\x02\x02\x02\xA8\xA9\x05\x10\t\x02\xA9" +
    "\xAE\x05\n\x06\x02\xAA\xAB\x07\x06\x02\x02\xAB\xAD\x05\n\x06\x02\xAC\xAA" +
    "\x03\x02\x02\x02\xAD\xB0\x03\x02\x02\x02\xAE\xAC\x03\x02\x02\x02\xAE\xAF" +
    "\x03\x02\x02\x02\xAF\t\x03\x02\x02\x02\xB0\xAE\x03\x02\x02\x02\xB1\xB3" +
    "\x07;\x02\x02\xB2\xB1\x03\x02\x02\x02\xB3\xB6\x03\x02\x02\x02\xB4\xB2" +
    "\x03\x02\x02\x02\xB4\xB5\x03\x02\x02\x02\xB5\xB7\x03\x02\x02\x02\xB6\xB4" +
    "\x03\x02\x02\x02\xB7\xBA\x07K\x02\x02\xB8\xB9\x07E\x02\x02\xB9\xBB\x05" +
    "\x16\f\x02\xBA\xB8\x03\x02\x02\x02\xBA\xBB\x03\x02\x02\x02\xBB\v\x03\x02" +
    "\x02\x02\xBC\xC1\x05\x0E\b\x02\xBD\xBE\x07\x06\x02\x02\xBE\xC0\x05\x0E" +
    "\b\x02\xBF\xBD\x03\x02\x02\x02\xC0\xC3\x03\x02\x02\x02\xC1\xBF\x03\x02" +
    "\x02\x02\xC1\xC2\x03\x02\x02\x02\xC2\r\x03\x02\x02\x02\xC3\xC1\x03\x02" +
    "\x02\x02\xC4\xC6\x05\x10\t\x02\xC5\xC7\x07,\x02\x02\xC6\xC5\x03\x02\x02" +
    "\x02\xC6\xC7\x03\x02\x02\x02\xC7\xCB\x03\x02\x02\x02\xC8\xCA\x07;\x02" +
    "\x02\xC9\xC8\x03\x02\x02\x02\xCA\xCD\x03\x02\x02\x02\xCB\xC9\x03\x02\x02" +
    "\x02\xCB\xCC\x03\x02\x02\x02\xCC\xCE\x03\x02\x02\x02\xCD\xCB\x03\x02\x02" +
    "\x02\xCE\xCF\x07K\x02\x02\xCF\xD8\x03\x02\x02\x02\xD0\xD2\x07;\x02\x02" +
    "\xD1\xD0\x03\x02\x02\x02\xD2\xD5\x03\x02\x02\x02\xD3\xD1\x03\x02\x02\x02" +
    "\xD3\xD4\x03\x02\x02\x02\xD4\xD6\x03\x02\x02\x02\xD5\xD3\x03\x02\x02\x02" +
    "\xD6\xD8\x07K\x02\x02\xD7\xC4\x03\x02\x02\x02\xD7\xD3\x03\x02\x02\x02" +
    "\xD8\x0F\x03\x02\x02\x02\xD9\xEB\x07\x07\x02\x02\xDA\xEB\x07\b\x02\x02" +
    "\xDB\xEB\x07\t\x02\x02\xDC\xEB\x07\n\x02\x02\xDD\xEB\x07\v\x02\x02\xDE" +
    "\xEB\x07\f\x02\x02\xDF\xEB\x07\r\x02\x02\xE0\xEB\x07\x0E\x02\x02\xE1\xEB" +
    "\x07\x0F\x02\x02\xE2\xEB\x07\x10\x02\x02\xE3\xE7\x07K\x02\x02\xE4\xE6" +
    "\x07;\x02\x02\xE5\xE4\x03\x02\x02\x02\xE6\xE9\x03\x02\x02\x02\xE7\xE5" +
    "\x03\x02\x02\x02\xE7\xE8\x03\x02\x02\x02\xE8\xEB\x03\x02\x02\x02\xE9\xE7" +
    "\x03\x02\x02\x02\xEA\xD9\x03\x02\x02\x02\xEA\xDA\x03\x02\x02\x02\xEA\xDB" +
    "\x03\x02\x02\x02\xEA\xDC\x03\x02\x02\x02\xEA\xDD\x03\x02\x02\x02\xEA\xDE" +
    "\x03\x02\x02\x02\xEA\xDF\x03\x02\x02\x02\xEA\xE0\x03\x02\x02\x02\xEA\xE1" +
    "\x03\x02\x02\x02\xEA\xE2\x03\x02\x02\x02\xEA\xE3\x03\x02\x02\x02\xEB\x11" +
    "\x03\x02\x02\x02\xEC\xF0\x07\x11\x02\x02\xED\xEF\x05\x04\x03\x02\xEE\xED" +
    "\x03\x02\x02\x02\xEF\xF2\x03\x02\x02\x02\xF0\xEE\x03\x02\x02\x02\xF0\xF1" +
    "\x03\x02\x02\x02\xF1\xF3\x03\x02\x02\x02\xF2\xF0\x03\x02\x02\x02\xF3\xF4" +
    "\x07\x12\x02\x02\xF4\x13\x03\x02\x02\x02\xF5\xF6\x05\x16\f\x02\xF6\xF7" +
    "\x07\x03\x02\x02\xF7\x15\x03\x02\x02\x02\xF8\xFD\x05\x18\r\x02\xF9\xFA" +
    "\x07\x06\x02\x02\xFA\xFC\x05\x18\r\x02\xFB\xF9\x03\x02\x02\x02\xFC\xFF" +
    "\x03\x02\x02\x02\xFD\xFB\x03\x02\x02\x02\xFD\xFE\x03\x02\x02\x02\xFE\x17" +
    "\x03\x02\x02\x02\xFF\xFD\x03\x02\x02\x02\u0100\u0103\x05\x1A\x0E\x02\u0101" +
    "\u0102\t\x02\x02\x02\u0102\u0104\x05\x16\f\x02\u0103\u0101\x03\x02\x02" +
    "\x02\u0103\u0104\x03\x02\x02\x02\u0104\x19\x03\x02\x02\x02\u0105\u010B" +
    "\x05\x1C\x0F\x02\u0106\u0107\x07\x13\x02\x02\u0107\u0108\x05\x16\f\x02" +
    "\u0108\u0109\x07\x14\x02\x02\u0109\u010A\x05\x1A\x0E\x02\u010A\u010C\x03" +
    "\x02\x02\x02\u010B\u0106\x03\x02\x02\x02\u010B\u010C\x03\x02\x02\x02\u010C" +
    "\x1B\x03\x02\x02\x02\u010D\u0112\x05\x1E\x10\x02\u010E\u010F\x07H\x02" +
    "\x02\u010F\u0111\x05\x1E\x10\x02\u0110\u010E\x03\x02\x02\x02\u0111\u0114" +
    "\x03\x02\x02\x02\u0112\u0110\x03\x02\x02\x02\u0112\u0113\x03\x02\x02\x02" +
    "\u0113\x1D\x03\x02\x02\x02\u0114\u0112\x03\x02\x02\x02\u0115\u011A\x05" +
    " \x11\x02\u0116\u0117\x07G\x02\x02\u0117\u0119\x05 \x11\x02\u0118\u0116" +
    "\x03\x02\x02\x02\u0119\u011C\x03\x02\x02\x02\u011A\u0118\x03\x02\x02\x02" +
    "\u011A\u011B\x03\x02\x02\x02\u011B\x1F\x03\x02\x02\x02\u011C\u011A\x03" +
    "\x02\x02\x02\u011D\u0122\x05\"\x12\x02\u011E\u011F\x07P\x02\x02\u011F" +
    "\u0121\x05\"\x12\x02\u0120\u011E\x03\x02\x02\x02\u0121\u0124\x03\x02\x02" +
    "\x02\u0122\u0120\x03\x02\x02\x02\u0122\u0123\x03\x02\x02\x02\u0123!\x03" +
    "\x02\x02\x02\u0124\u0122\x03\x02\x02\x02\u0125\u012A\x05$\x13\x02\u0126" +
    "\u0127\x07Q\x02\x02\u0127\u0129\x05$\x13\x02\u0128\u0126\x03\x02\x02\x02" +
    "\u0129\u012C\x03\x02\x02\x02\u012A\u0128\x03\x02\x02\x02\u012A\u012B\x03" +
    "\x02\x02\x02\u012B#\x03\x02\x02\x02\u012C\u012A\x03\x02\x02\x02\u012D" +
    "\u0132\x05&\x14\x02\u012E\u012F\x07O\x02\x02\u012F\u0131\x05&\x14\x02" +
    "\u0130\u012E\x03\x02\x02\x02\u0131\u0134\x03\x02\x02\x02\u0132\u0130\x03" +
    "\x02\x02\x02\u0132\u0133\x03\x02\x02\x02\u0133%\x03\x02\x02\x02\u0134" +
    "\u0132\x03\x02\x02\x02\u0135\u013A\x05(\x15\x02\u0136\u0137\t\x03\x02" +
    "\x02\u0137\u0139\x05(\x15\x02\u0138\u0136\x03\x02\x02\x02\u0139\u013C" +
    "\x03\x02\x02\x02\u013A\u0138\x03\x02\x02\x02\u013A\u013B\x03\x02\x02\x02" +
    "\u013B\'\x03\x02\x02\x02\u013C\u013A\x03\x02\x02\x02\u013D\u0142\x05*" +
    "\x16\x02\u013E\u013F\t\x04\x02\x02\u013F\u0141\x05*\x16\x02\u0140\u013E" +
    "\x03\x02\x02\x02\u0141\u0144\x03\x02\x02\x02\u0142\u0140\x03\x02\x02\x02" +
    "\u0142\u0143\x03\x02\x02\x02\u0143)\x03\x02\x02\x02\u0144\u0142\x03\x02" +
    "\x02\x02\u0145\u014A\x05,\x17\x02\u0146\u0147\t\x05\x02\x02\u0147\u0149" +
    "\x05,\x17\x02\u0148\u0146\x03\x02\x02\x02\u0149\u014C\x03\x02\x02\x02" +
    "\u014A\u0148\x03\x02\x02\x02\u014A\u014B\x03\x02\x02\x02\u014B+\x03\x02" +
    "\x02\x02\u014C\u014A\x03\x02\x02\x02\u014D\u0152\x05.\x18\x02\u014E\u014F" +
    "\t\x06\x02\x02\u014F\u0151\x05.\x18\x02\u0150\u014E\x03\x02\x02\x02\u0151" +
    "\u0154\x03\x02\x02\x02\u0152\u0150\x03\x02\x02\x02\u0152\u0153\x03\x02" +
    "\x02\x02\u0153-\x03\x02\x02\x02\u0154\u0152\x03\x02\x02\x02\u0155\u015A" +
    "\x050\x19\x02\u0156\u0157\t\x07\x02\x02\u0157\u0159\x050\x19\x02\u0158" +
    "\u0156\x03\x02\x02\x02\u0159\u015C\x03\x02\x02\x02\u015A\u0158\x03\x02" +
    "\x02\x02\u015A\u015B\x03\x02\x02\x02\u015B/\x03\x02\x02\x02\u015C\u015A" +
    "\x03\x02\x02\x02\u015D\u015F\t\b\x02\x02\u015E\u015D\x03\x02\x02\x02\u015E" +
    "\u015F\x03\x02\x02\x02\u015F\u0160\x03\x02\x02\x02\u0160\u016C\x056\x1C" +
    "\x02\u0161\u0162\t\t\x02\x02\u0162\u016C\x050\x19\x02\u0163\u0164\x07" +
    "+\x02\x02\u0164\u0165\x07\x04\x02\x02\u0165\u0166\x05\x16\f\x02\u0166" +
    "\u0167\x07\x05\x02\x02\u0167\u016C\x03\x02\x02\x02\u0168\u0169\x07+\x02" +
    "\x02\u0169\u016C\x05\x12\n\x02\u016A\u016C\x052\x1A\x02\u016B\u015E\x03" +
    "\x02\x02\x02\u016B\u0161\x03\x02\x02\x02\u016B\u0163\x03\x02\x02\x02\u016B" +
    "\u0168\x03\x02\x02\x02\u016B\u016A\x03\x02\x02\x02\u016C1\x03\x02\x02" +
    "\x02\u016D\u016E\x07\x04\x02\x02\u016E\u016F\x054\x1B\x02\u016F\u0170" +
    "\x07\x05\x02\x02\u0170\u0171\x050\x19\x02\u01713\x03\x02\x02\x02\u0172" +
    "\u0173\t\n\x02\x02\u01735\x03\x02\x02\x02\u0174\u018B\x05:\x1E\x02\u0175" +
    "\u0176\t\v\x02\x02\u0176\u017C\x07K\x02\x02\u0177\u0179\x07\x04\x02\x02" +
    "\u0178\u017A\x058\x1D\x02\u0179\u0178\x03\x02\x02\x02\u0179\u017A\x03" +
    "\x02\x02\x02\u017A\u017B\x03\x02\x02\x02\u017B\u017D\x07\x05\x02\x02\u017C" +
    "\u0177\x03\x02\x02\x02\u017C\u017D\x03\x02\x02\x02\u017D\u018A\x03\x02" +
    "\x02\x02\u017E\u0180\x07\x04\x02\x02\u017F\u0181\x058\x1D\x02\u0180\u017F" +
    "\x03\x02\x02\x02\u0180\u0181\x03\x02\x02\x02\u0181\u0182\x03\x02\x02\x02" +
    "\u0182\u018A\x07\x05\x02\x02\u0183\u0184\x07\x15\x02\x02\u0184\u0185\x05" +
    "j6\x02\u0185\u0186\x07\x16\x02\x02\u0186\u018A\x03\x02\x02\x02\u0187\u018A" +
    "\x072\x02\x02\u0188\u018A\x073\x02\x02\u0189\u0175\x03\x02\x02\x02\u0189" +
    "\u017E\x03\x02\x02\x02\u0189\u0183\x03\x02\x02\x02\u0189\u0187\x03\x02" +
    "\x02\x02\u0189\u0188\x03\x02\x02\x02\u018A\u018D\x03\x02\x02\x02\u018B" +
    "\u0189\x03\x02\x02\x02\u018B\u018C\x03\x02\x02\x02\u018C7\x03\x02\x02" +
    "\x02\u018D\u018B\x03\x02\x02\x02\u018E\u0190\x05\x18\r\x02\u018F\u0191" +
    "\x07.\x02\x02\u0190\u018F\x03\x02\x02\x02\u0190\u0191\x03\x02\x02\x02" +
    "\u0191\u0199\x03\x02\x02\x02\u0192\u0193\x07\x06\x02\x02\u0193\u0195\x05" +
    "\x18\r\x02\u0194\u0196\x07.\x02\x02\u0195\u0194\x03\x02\x02\x02\u0195" +
    "\u0196\x03\x02\x02\x02\u0196\u0198\x03\x02\x02\x02\u0197\u0192\x03\x02" +
    "\x02\x02\u0198\u019B\x03\x02\x02\x02\u0199\u0197\x03\x02\x02\x02\u0199" +
    "\u019A\x03\x02\x02\x02\u019A9\x03\x02\x02\x02\u019B\u0199\x03\x02\x02" +
    "\x02\u019C\u019D\x07>\x02\x02\u019D\u01BB\x07K\x02\x02\u019E\u01BB\x05" +
    "<\x1F\x02\u019F\u01BB\x07I\x02\x02\u01A0\u01BB\x05d3\x02\u01A1\u01A2\x07" +
    "\r\x02\x02\u01A2\u01A4\x07\x04\x02\x02\u01A3\u01A5\x05\f\x07\x02\u01A4" +
    "\u01A3\x03\x02\x02\x02\u01A4\u01A5\x03\x02\x02\x02\u01A5\u01A6\x03\x02" +
    "\x02\x02\u01A6\u01A7\x07\x05\x02\x02\u01A7\u01BB\x05\x12\n\x02\u01A8\u01BB" +
    "\x07K\x02\x02\u01A9\u01BB\x07\x17\x02\x02\u01AA\u01BB\x07\x18\x02\x02" +
    "\u01AB\u01BB\t\f\x02\x02\u01AC\u01BB\x07N\x02\x02\u01AD\u01AE\x07\x04" +
    "\x02\x02\u01AE\u01B0\x07\x11\x02\x02\u01AF\u01B1\x05J&\x02\u01B0\u01AF" +
    "\x03\x02\x02\x02\u01B0\u01B1\x03\x02\x02\x02\u01B1\u01B2\x03\x02\x02\x02" +
    "\u01B2\u01B3\x07\x12\x02\x02\u01B3\u01BB\x07\x05\x02\x02\u01B4\u01B5\x07" +
    "\x04\x02\x02\u01B5\u01B6\x05\x16\f\x02\u01B6\u01B7\x07\x05\x02\x02\u01B7" +
    "\u01BB\x03\x02\x02\x02\u01B8\u01B9\x07,\x02\x02\u01B9\u01BB\x07K\x02\x02" +
    "\u01BA\u019C\x03\x02\x02\x02\u01BA\u019E\x03\x02\x02\x02\u01BA\u019F\x03" +
    "\x02\x02\x02\u01BA\u01A0\x03\x02\x02\x02\u01BA\u01A1\x03\x02\x02\x02\u01BA" +
    "\u01A8\x03\x02\x02\x02\u01BA\u01A9\x03\x02\x02\x02\u01BA\u01AA\x03\x02" +
    "\x02\x02\u01BA\u01AB\x03\x02\x02\x02\u01BA\u01AC\x03\x02\x02\x02\u01BA" +
    "\u01AD\x03\x02\x02\x02\u01BA\u01B4\x03\x02\x02\x02\u01BA\u01B8\x03\x02" +
    "\x02\x02\u01BB;\x03\x02\x02\x02\u01BC\u01BE\x05> \x02\u01BD\u01BC\x03" +
    "\x02\x02\x02\u01BE\u01BF\x03\x02\x02\x02\u01BF\u01BD\x03\x02\x02\x02\u01BF" +
    "\u01C0\x03\x02\x02\x02\u01C0=\x03\x02\x02\x02\u01C1\u01CA\x07\x19\x02" +
    "\x02\u01C2\u01C3\x07K\x02\x02\u01C3\u01C5\x07\x04\x02\x02\u01C4\u01C6" +
    "\x058\x1D\x02\u01C5\u01C4\x03\x02\x02\x02\u01C5\u01C6\x03\x02\x02\x02" +
    "\u01C6\u01C7\x03\x02\x02\x02\u01C7\u01CA\x07\x05\x02\x02\u01C8\u01CA\x07" +
    "K\x02\x02\u01C9\u01C1\x03\x02\x02\x02\u01C9\u01C2\x03\x02\x02\x02\u01C9" +
    "\u01C8\x03\x02\x02\x02\u01CA?\x03\x02\x02\x02\u01CB\u01CC\x07\x1E\x02" +
    "\x02\u01CC\u01CD\x07\x04\x02\x02\u01CD\u01CE\x05\x16\f\x02\u01CE\u01CF" +
    "\x07\x05\x02\x02\u01CF\u01D2\x05\x04\x03\x02\u01D0\u01D1\x07\x1F\x02\x02" +
    "\u01D1\u01D3\x05\x04\x03\x02\u01D2\u01D0\x03\x02\x02\x02\u01D2\u01D3\x03" +
    "\x02\x02\x02\u01D3A\x03\x02\x02\x02\u01D4\u01D5\x07!\x02\x02\u01D5\u01D6" +
    "\x07\x04\x02\x02\u01D6\u01D7\x05\x16\f\x02\u01D7\u01D8\x07\x05\x02\x02" +
    "\u01D8\u01D9\x05\x04\x03\x02\u01D9C\x03\x02\x02\x02\u01DA\u01DB\x07\"" +
    "\x02\x02\u01DB\u01DC\x05\x04\x03\x02\u01DC\u01DD\x07!\x02\x02\u01DD\u01DE" +
    "\x07\x04\x02\x02\u01DE\u01DF\x05\x16\f\x02\u01DF\u01E0\x07\x05\x02\x02" +
    "\u01E0\u01E1\x07\x03\x02\x02\u01E1E\x03\x02\x02\x02\u01E2\u01E3\x07 \x02" +
    "\x02\u01E3\u01E5\x07\x04\x02\x02\u01E4\u01E6\x05H%\x02\u01E5\u01E4\x03" +
    "\x02\x02\x02\u01E5\u01E6\x03\x02\x02\x02\u01E6\u01E7\x03\x02\x02\x02\u01E7" +
    "\u01E9\x07\x03\x02\x02\u01E8\u01EA\x05\x16\f\x02\u01E9\u01E8\x03\x02\x02" +
    "\x02\u01E9\u01EA\x03\x02\x02\x02\u01EA\u01EB\x03\x02\x02\x02\u01EB\u01ED" +
    "\x07\x03\x02\x02\u01EC\u01EE\x05J&\x02\u01ED\u01EC\x03\x02\x02\x02\u01ED" +
    "\u01EE\x03\x02\x02\x02\u01EE\u01EF\x03\x02\x02\x02\u01EF\u01F0\x07\x05" +
    "\x02\x02\u01F0\u01F1\x05\x04\x03\x02\u01F1G\x03\x02\x02\x02\u01F2\u01F5" +
    "\x05\b\x05\x02\u01F3\u01F5\x05J&\x02\u01F4\u01F2\x03\x02\x02\x02\u01F4" +
    "\u01F3\x03\x02\x02\x02\u01F5I\x03\x02\x02\x02\u01F6\u01FB\x05\x16\f\x02" +
    "\u01F7\u01F8\x07\x06\x02\x02\u01F8\u01FA\x05\x16\f\x02\u01F9\u01F7\x03" +
    "\x02\x02\x02\u01FA\u01FD\x03\x02\x02\x02\u01FB\u01F9\x03\x02\x02\x02\u01FB" +
    "\u01FC\x03\x02\x02\x02\u01FC\u01FF\x03\x02\x02\x02\u01FD\u01FB\x03\x02" +
    "\x02\x02\u01FE\u0200\x07\x06\x02\x02\u01FF\u01FE\x03\x02\x02\x02\u01FF" +
    "\u0200";
LPCParser._serializedATNSegment1 = "\x03\x02\x02\x02\u0200K\x03\x02\x02\x02\u0201\u0202\x07)\x02\x02\u0202" +
    "\u0203\x07\x04\x02\x02\u0203\u0204\x05N(\x02\u0204\u0205\x07-\x02\x02" +
    "\u0205\u0206\x05\x16\f\x02\u0206\u0207\x07\x05\x02\x02\u0207\u0208\x05" +
    "\x04\x03\x02\u0208M\x03\x02\x02\x02\u0209\u020C\x05P)\x02\u020A\u020B" +
    "\x07\x06\x02\x02\u020B\u020D\x05P)\x02\u020C\u020A\x03\x02\x02\x02\u020C" +
    "\u020D\x03\x02\x02\x02\u020DO\x03\x02\x02\x02\u020E\u0210\x05\x10\t\x02" +
    "\u020F\u0211\x07,\x02\x02\u0210\u020F\x03\x02\x02\x02\u0210\u0211\x03" +
    "\x02\x02\x02\u0211\u0215\x03\x02\x02\x02\u0212\u0214\x07;\x02\x02\u0213" +
    "\u0212\x03\x02\x02\x02\u0214\u0217\x03\x02\x02\x02\u0215\u0213\x03\x02" +
    "\x02\x02\u0215\u0216\x03\x02\x02\x02\u0216\u0218\x03\x02\x02\x02\u0217" +
    "\u0215\x03\x02\x02\x02\u0218\u0219\x07K\x02\x02\u0219\u0222\x03\x02\x02" +
    "\x02\u021A\u021C\x07;\x02\x02\u021B\u021A\x03\x02\x02\x02\u021C\u021F" +
    "\x03\x02\x02\x02\u021D\u021B\x03\x02\x02\x02\u021D\u021E\x03\x02\x02\x02" +
    "\u021E\u0220\x03\x02\x02\x02\u021F\u021D\x03\x02\x02\x02\u0220\u0222\x07" +
    "K\x02\x02\u0221\u020E\x03\x02\x02\x02\u0221\u021D\x03\x02\x02\x02\u0222" +
    "Q\x03\x02\x02\x02\u0223\u0224\x07#\x02\x02\u0224\u0225\x07\x04\x02\x02" +
    "\u0225\u0226\x05\x16\f\x02\u0226\u0227\x07\x05\x02\x02\u0227\u022B\x07" +
    "\x11\x02\x02\u0228\u022A\x05T+\x02\u0229\u0228\x03\x02\x02\x02\u022A\u022D" +
    "\x03\x02\x02\x02\u022B\u0229\x03\x02\x02\x02\u022B\u022C\x03\x02\x02\x02" +
    "\u022C\u022E\x03\x02\x02\x02\u022D\u022B\x03\x02\x02\x02\u022E\u022F\x07" +
    "\x12\x02\x02\u022FS\x03\x02\x02\x02\u0230\u0234\x05V,\x02\u0231\u0233" +
    "\x05\x04\x03\x02\u0232\u0231\x03\x02\x02\x02\u0233\u0236\x03\x02\x02\x02" +
    "\u0234\u0232\x03\x02\x02\x02\u0234\u0235\x03\x02\x02\x02\u0235\u0240\x03" +
    "\x02\x02\x02\u0236\u0234\x03\x02\x02\x02\u0237\u023B\x05V,\x02\u0238\u023A" +
    "\x05\x04\x03\x02\u0239\u0238\x03\x02\x02\x02\u023A\u023D\x03\x02\x02\x02" +
    "\u023B\u0239\x03\x02\x02\x02\u023B\u023C\x03\x02\x02\x02\u023C\u023F\x03" +
    "\x02\x02\x02\u023D\u023B\x03\x02\x02\x02\u023E\u0237\x03\x02\x02\x02\u023F" +
    "\u0242\x03\x02\x02\x02\u0240\u023E\x03\x02\x02\x02\u0240\u0241\x03\x02" +
    "\x02\x02\u0241U\x03\x02\x02\x02\u0242\u0240\x03\x02\x02\x02\u0243\u0244" +
    "\x07$\x02\x02\u0244\u0245\x05X-\x02\u0245\u0246\x07\x14\x02\x02\u0246" +
    "\u024A\x03\x02\x02\x02\u0247\u0248\x07%\x02\x02\u0248\u024A\x07\x14\x02" +
    "\x02\u0249\u0243\x03\x02\x02\x02\u0249\u0247\x03\x02\x02\x02\u024AW\x03" +
    "\x02\x02\x02\u024B\u024E\x05\x16\f\x02\u024C\u024D\x07/\x02\x02\u024D" +
    "\u024F\x05\x16\f\x02\u024E\u024C\x03\x02\x02\x02\u024E\u024F\x03\x02\x02" +
    "\x02\u024F\u0253\x03\x02\x02\x02\u0250\u0251\x07/\x02\x02\u0251\u0253" +
    "\x05\x16\f\x02\u0252\u024B\x03\x02\x02\x02\u0252\u0250\x03\x02\x02\x02" +
    "\u0253Y\x03\x02\x02\x02\u0254\u0255\x07&\x02\x02\u0255\u0256\x07\x03\x02" +
    "\x02\u0256[\x03\x02\x02\x02\u0257\u0258\x07\'\x02\x02\u0258\u0259\x07" +
    "\x03\x02\x02\u0259]\x03\x02\x02\x02\u025A\u025C\x07(\x02\x02\u025B\u025D" +
    "\x05\x16\f\x02\u025C\u025B\x03\x02\x02\x02\u025C\u025D\x03\x02\x02\x02" +
    "\u025D\u025E\x03\x02\x02\x02\u025E\u025F\x07\x03\x02\x02\u025F_\x03\x02" +
    "\x02\x02\u0260\u0261\x07*\x02\x02\u0261\u0262\t\r\x02\x02\u0262\u0263" +
    "\x07\x03\x02\x02\u0263a\x03\x02\x02\x02\u0264\u0266\x07J\x02\x02\u0265" +
    "\u0264\x03\x02\x02\x02\u0266\u0269\x03\x02\x02\x02\u0267\u0265\x03\x02" +
    "\x02\x02\u0267\u0268\x03\x02\x02\x02\u0268\u026B\x03\x02\x02\x02\u0269" +
    "\u0267\x03\x02\x02\x02\u026A\u026C\x05\x10\t\x02\u026B\u026A\x03\x02\x02" +
    "\x02\u026B\u026C\x03\x02\x02\x02\u026C\u0270\x03\x02\x02\x02\u026D\u026F" +
    "\x07;\x02\x02\u026E\u026D\x03\x02\x02\x02\u026F\u0272\x03\x02\x02\x02" +
    "\u0270\u026E\x03\x02\x02\x02\u0270\u0271\x03\x02\x02\x02\u0271\u0273\x03" +
    "\x02\x02\x02\u0272\u0270\x03\x02\x02\x02\u0273\u0274\x07K\x02\x02\u0274" +
    "\u0276\x07\x04\x02\x02\u0275\u0277\x05\f\x07\x02\u0276\u0275\x03\x02\x02" +
    "\x02\u0276\u0277\x03\x02\x02\x02\u0277\u0278\x03\x02\x02\x02\u0278\u0279" +
    "\x07\x05\x02\x02\u0279\u027A\x07\x03\x02\x02\u027Ac\x03\x02\x02\x02\u027B" +
    "\u027C\x07\x04\x02\x02\u027C\u027E\x07\x15\x02\x02\u027D\u027F\x05f4\x02" +
    "\u027E\u027D\x03\x02\x02\x02\u027E\u027F\x03\x02\x02\x02\u027F\u0280\x03" +
    "\x02\x02\x02\u0280\u0281\x07\x16\x02\x02\u0281\u0282\x07\x05\x02\x02\u0282" +
    "e\x03\x02\x02\x02\u0283\u0288\x05h5\x02\u0284\u0285\x07\x06\x02\x02\u0285" +
    "\u0287\x05h5\x02\u0286\u0284\x03\x02\x02\x02\u0287\u028A\x03\x02\x02\x02" +
    "\u0288\u0286\x03\x02\x02\x02\u0288\u0289\x03\x02\x02\x02\u0289\u028C\x03" +
    "\x02\x02\x02\u028A\u0288\x03\x02\x02\x02\u028B\u028D\x07\x06\x02\x02\u028C" +
    "\u028B\x03\x02\x02\x02\u028C\u028D\x03\x02\x02\x02\u028Dg\x03\x02\x02" +
    "\x02\u028E\u028F\x05\x16\f\x02\u028F\u0290\x07\x14\x02\x02\u0290\u0291" +
    "\x05\x16\f\x02\u0291i\x03\x02\x02\x02\u0292\u0293\x07@\x02\x02\u0293\u02AE" +
    "\x05\x16\f\x02\u0294\u0295\x05\x16\f\x02\u0295\u0297\x07/\x02\x02\u0296" +
    "\u0298\x07@\x02\x02\u0297\u0296\x03\x02\x02\x02\u0297\u0298\x03\x02\x02" +
    "\x02\u0298\u029A\x03\x02\x02\x02\u0299\u029B\x05\x16\f\x02\u029A\u0299" +
    "\x03\x02\x02\x02\u029A\u029B\x03\x02\x02\x02\u029B\u02AE\x03\x02\x02\x02" +
    "\u029C\u029E\x07/\x02\x02\u029D\u029F\x07@\x02\x02\u029E\u029D\x03\x02" +
    "\x02\x02\u029E\u029F\x03\x02\x02\x02\u029F\u02A1\x03\x02\x02\x02\u02A0" +
    "\u02A2\x05\x16\f\x02\u02A1\u02A0\x03\x02\x02\x02\u02A1\u02A2\x03\x02\x02" +
    "\x02\u02A2\u02AE\x03\x02\x02\x02\u02A3\u02AE\x05\x16\f\x02\u02A4\u02A5" +
    "\x07@\x02\x02\u02A5\u02A6\x05\x16\f\x02\u02A6\u02A8\x07/\x02\x02\u02A7" +
    "\u02A9\x07@\x02\x02\u02A8\u02A7\x03\x02\x02\x02\u02A8\u02A9\x03\x02\x02" +
    "\x02\u02A9\u02AB\x03\x02\x02\x02\u02AA\u02AC\x05\x16\f\x02\u02AB\u02AA" +
    "\x03\x02\x02\x02\u02AB\u02AC\x03\x02\x02\x02\u02AC\u02AE\x03\x02\x02\x02" +
    "\u02AD\u0292\x03\x02\x02\x02\u02AD\u0294\x03\x02\x02\x02\u02AD\u029C\x03" +
    "\x02\x02\x02\u02AD\u02A3\x03\x02\x02\x02\u02AD\u02A4\x03\x02\x02\x02\u02AE" +
    "k\x03\x02\x02\x02\u02AF\u02B0\x07K\x02\x02\u02B0\u02B2\x07\x04\x02\x02" +
    "\u02B1\u02B3\x058\x1D\x02\u02B2\u02B1\x03\x02\x02\x02\u02B2\u02B3\x03" +
    "\x02\x02\x02\u02B3\u02B4\x03\x02\x02\x02\u02B4\u02B5\x07\x05\x02\x02\u02B5" +
    "m\x03\x02\x02\x02Tq\x89\x8E\x92\x97\x9D\xA5\xAE\xB4\xBA\xC1\xC6\xCB\xD3" +
    "\xD7\xE7\xEA\xF0\xFD\u0103\u010B\u0112\u011A\u0122\u012A\u0132\u013A\u0142" +
    "\u014A\u0152\u015A\u015E\u016B\u0179\u017C\u0180\u0189\u018B\u0190\u0195" +
    "\u0199\u01A4\u01B0\u01BA\u01BF\u01C5\u01C9\u01D2\u01E5\u01E9\u01ED\u01F4" +
    "\u01FB\u01FF\u020C\u0210\u0215\u021D\u0221\u022B\u0234\u023B\u0240\u0249" +
    "\u024E\u0252\u025C\u0267\u026B\u0270\u0276\u027E\u0288\u028C\u0297\u029A" +
    "\u029E\u02A1\u02A8\u02AB\u02AD\u02B2";
LPCParser._serializedATN = Utils.join([
    LPCParser._serializedATNSegment0,
    LPCParser._serializedATNSegment1,
], "");
class SourceFileContext extends ParserRuleContext_1.ParserRuleContext {
    EOF() { return this.getToken(LPCParser.EOF, 0); }
    statement(i) {
        if (i === undefined) {
            return this.getRuleContexts(StatementContext);
        }
        else {
            return this.getRuleContext(i, StatementContext);
        }
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_sourceFile; }
    // @Override
    accept(visitor) {
        if (visitor.visitSourceFile) {
            return visitor.visitSourceFile(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.SourceFileContext = SourceFileContext;
class StatementContext extends ParserRuleContext_1.ParserRuleContext {
    functionDef() {
        return this.tryGetRuleContext(0, FunctionDefContext);
    }
    variableDecl() {
        return this.tryGetRuleContext(0, VariableDeclContext);
    }
    macroInvoke() {
        return this.tryGetRuleContext(0, MacroInvokeContext);
    }
    ifStatement() {
        return this.tryGetRuleContext(0, IfStatementContext);
    }
    whileStatement() {
        return this.tryGetRuleContext(0, WhileStatementContext);
    }
    forStatement() {
        return this.tryGetRuleContext(0, ForStatementContext);
    }
    doWhileStatement() {
        return this.tryGetRuleContext(0, DoWhileStatementContext);
    }
    foreachStatement() {
        return this.tryGetRuleContext(0, ForeachStatementContext);
    }
    switchStatement() {
        return this.tryGetRuleContext(0, SwitchStatementContext);
    }
    breakStatement() {
        return this.tryGetRuleContext(0, BreakStatementContext);
    }
    continueStatement() {
        return this.tryGetRuleContext(0, ContinueStatementContext);
    }
    returnStatement() {
        return this.tryGetRuleContext(0, ReturnStatementContext);
    }
    inheritStatement() {
        return this.tryGetRuleContext(0, InheritStatementContext);
    }
    block() {
        return this.tryGetRuleContext(0, BlockContext);
    }
    exprStatement() {
        return this.tryGetRuleContext(0, ExprStatementContext);
    }
    prototypeStatement() {
        return this.tryGetRuleContext(0, PrototypeStatementContext);
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_statement; }
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
class FunctionDefContext extends ParserRuleContext_1.ParserRuleContext {
    Identifier() { return this.getToken(LPCParser.Identifier, 0); }
    block() {
        return this.getRuleContext(0, BlockContext);
    }
    MODIFIER(i) {
        if (i === undefined) {
            return this.getTokens(LPCParser.MODIFIER);
        }
        else {
            return this.getToken(LPCParser.MODIFIER, i);
        }
    }
    typeSpec() {
        return this.tryGetRuleContext(0, TypeSpecContext);
    }
    STAR(i) {
        if (i === undefined) {
            return this.getTokens(LPCParser.STAR);
        }
        else {
            return this.getToken(LPCParser.STAR, i);
        }
    }
    parameterList() {
        return this.tryGetRuleContext(0, ParameterListContext);
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_functionDef; }
    // @Override
    accept(visitor) {
        if (visitor.visitFunctionDef) {
            return visitor.visitFunctionDef(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.FunctionDefContext = FunctionDefContext;
class VariableDeclContext extends ParserRuleContext_1.ParserRuleContext {
    typeSpec() {
        return this.getRuleContext(0, TypeSpecContext);
    }
    variableDeclarator(i) {
        if (i === undefined) {
            return this.getRuleContexts(VariableDeclaratorContext);
        }
        else {
            return this.getRuleContext(i, VariableDeclaratorContext);
        }
    }
    MODIFIER(i) {
        if (i === undefined) {
            return this.getTokens(LPCParser.MODIFIER);
        }
        else {
            return this.getToken(LPCParser.MODIFIER, i);
        }
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_variableDecl; }
    // @Override
    accept(visitor) {
        if (visitor.visitVariableDecl) {
            return visitor.visitVariableDecl(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.VariableDeclContext = VariableDeclContext;
class VariableDeclaratorContext extends ParserRuleContext_1.ParserRuleContext {
    Identifier() { return this.getToken(LPCParser.Identifier, 0); }
    STAR(i) {
        if (i === undefined) {
            return this.getTokens(LPCParser.STAR);
        }
        else {
            return this.getToken(LPCParser.STAR, i);
        }
    }
    ASSIGN() { return this.tryGetToken(LPCParser.ASSIGN, 0); }
    expression() {
        return this.tryGetRuleContext(0, ExpressionContext);
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_variableDeclarator; }
    // @Override
    accept(visitor) {
        if (visitor.visitVariableDeclarator) {
            return visitor.visitVariableDeclarator(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.VariableDeclaratorContext = VariableDeclaratorContext;
class ParameterListContext extends ParserRuleContext_1.ParserRuleContext {
    parameter(i) {
        if (i === undefined) {
            return this.getRuleContexts(ParameterContext);
        }
        else {
            return this.getRuleContext(i, ParameterContext);
        }
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_parameterList; }
    // @Override
    accept(visitor) {
        if (visitor.visitParameterList) {
            return visitor.visitParameterList(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.ParameterListContext = ParameterListContext;
class ParameterContext extends ParserRuleContext_1.ParserRuleContext {
    typeSpec() {
        return this.tryGetRuleContext(0, TypeSpecContext);
    }
    Identifier() { return this.getToken(LPCParser.Identifier, 0); }
    REF() { return this.tryGetToken(LPCParser.REF, 0); }
    STAR(i) {
        if (i === undefined) {
            return this.getTokens(LPCParser.STAR);
        }
        else {
            return this.getToken(LPCParser.STAR, i);
        }
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_parameter; }
    // @Override
    accept(visitor) {
        if (visitor.visitParameter) {
            return visitor.visitParameter(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.ParameterContext = ParameterContext;
class TypeSpecContext extends ParserRuleContext_1.ParserRuleContext {
    Identifier() { return this.tryGetToken(LPCParser.Identifier, 0); }
    STAR(i) {
        if (i === undefined) {
            return this.getTokens(LPCParser.STAR);
        }
        else {
            return this.getToken(LPCParser.STAR, i);
        }
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_typeSpec; }
    // @Override
    accept(visitor) {
        if (visitor.visitTypeSpec) {
            return visitor.visitTypeSpec(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.TypeSpecContext = TypeSpecContext;
class BlockContext extends ParserRuleContext_1.ParserRuleContext {
    statement(i) {
        if (i === undefined) {
            return this.getRuleContexts(StatementContext);
        }
        else {
            return this.getRuleContext(i, StatementContext);
        }
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_block; }
    // @Override
    accept(visitor) {
        if (visitor.visitBlock) {
            return visitor.visitBlock(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.BlockContext = BlockContext;
class ExprStatementContext extends ParserRuleContext_1.ParserRuleContext {
    expression() {
        return this.getRuleContext(0, ExpressionContext);
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_exprStatement; }
    // @Override
    accept(visitor) {
        if (visitor.visitExprStatement) {
            return visitor.visitExprStatement(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.ExprStatementContext = ExprStatementContext;
class ExpressionContext extends ParserRuleContext_1.ParserRuleContext {
    assignmentExpression(i) {
        if (i === undefined) {
            return this.getRuleContexts(AssignmentExpressionContext);
        }
        else {
            return this.getRuleContext(i, AssignmentExpressionContext);
        }
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_expression; }
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
class AssignmentExpressionContext extends ParserRuleContext_1.ParserRuleContext {
    conditionalExpression() {
        return this.getRuleContext(0, ConditionalExpressionContext);
    }
    expression() {
        return this.tryGetRuleContext(0, ExpressionContext);
    }
    ASSIGN() { return this.tryGetToken(LPCParser.ASSIGN, 0); }
    PLUS_ASSIGN() { return this.tryGetToken(LPCParser.PLUS_ASSIGN, 0); }
    MINUS_ASSIGN() { return this.tryGetToken(LPCParser.MINUS_ASSIGN, 0); }
    STAR_ASSIGN() { return this.tryGetToken(LPCParser.STAR_ASSIGN, 0); }
    DIV_ASSIGN() { return this.tryGetToken(LPCParser.DIV_ASSIGN, 0); }
    PERCENT_ASSIGN() { return this.tryGetToken(LPCParser.PERCENT_ASSIGN, 0); }
    BIT_OR_ASSIGN() { return this.tryGetToken(LPCParser.BIT_OR_ASSIGN, 0); }
    BIT_AND_ASSIGN() { return this.tryGetToken(LPCParser.BIT_AND_ASSIGN, 0); }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_assignmentExpression; }
    // @Override
    accept(visitor) {
        if (visitor.visitAssignmentExpression) {
            return visitor.visitAssignmentExpression(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.AssignmentExpressionContext = AssignmentExpressionContext;
class ConditionalExpressionContext extends ParserRuleContext_1.ParserRuleContext {
    logicalOrExpression() {
        return this.getRuleContext(0, LogicalOrExpressionContext);
    }
    expression() {
        return this.tryGetRuleContext(0, ExpressionContext);
    }
    conditionalExpression() {
        return this.tryGetRuleContext(0, ConditionalExpressionContext);
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_conditionalExpression; }
    // @Override
    accept(visitor) {
        if (visitor.visitConditionalExpression) {
            return visitor.visitConditionalExpression(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.ConditionalExpressionContext = ConditionalExpressionContext;
class LogicalOrExpressionContext extends ParserRuleContext_1.ParserRuleContext {
    logicalAndExpression(i) {
        if (i === undefined) {
            return this.getRuleContexts(LogicalAndExpressionContext);
        }
        else {
            return this.getRuleContext(i, LogicalAndExpressionContext);
        }
    }
    OR(i) {
        if (i === undefined) {
            return this.getTokens(LPCParser.OR);
        }
        else {
            return this.getToken(LPCParser.OR, i);
        }
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_logicalOrExpression; }
    // @Override
    accept(visitor) {
        if (visitor.visitLogicalOrExpression) {
            return visitor.visitLogicalOrExpression(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.LogicalOrExpressionContext = LogicalOrExpressionContext;
class LogicalAndExpressionContext extends ParserRuleContext_1.ParserRuleContext {
    bitwiseOrExpression(i) {
        if (i === undefined) {
            return this.getRuleContexts(BitwiseOrExpressionContext);
        }
        else {
            return this.getRuleContext(i, BitwiseOrExpressionContext);
        }
    }
    AND(i) {
        if (i === undefined) {
            return this.getTokens(LPCParser.AND);
        }
        else {
            return this.getToken(LPCParser.AND, i);
        }
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_logicalAndExpression; }
    // @Override
    accept(visitor) {
        if (visitor.visitLogicalAndExpression) {
            return visitor.visitLogicalAndExpression(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.LogicalAndExpressionContext = LogicalAndExpressionContext;
class BitwiseOrExpressionContext extends ParserRuleContext_1.ParserRuleContext {
    bitwiseXorExpression(i) {
        if (i === undefined) {
            return this.getRuleContexts(BitwiseXorExpressionContext);
        }
        else {
            return this.getRuleContext(i, BitwiseXorExpressionContext);
        }
    }
    BIT_OR(i) {
        if (i === undefined) {
            return this.getTokens(LPCParser.BIT_OR);
        }
        else {
            return this.getToken(LPCParser.BIT_OR, i);
        }
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_bitwiseOrExpression; }
    // @Override
    accept(visitor) {
        if (visitor.visitBitwiseOrExpression) {
            return visitor.visitBitwiseOrExpression(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.BitwiseOrExpressionContext = BitwiseOrExpressionContext;
class BitwiseXorExpressionContext extends ParserRuleContext_1.ParserRuleContext {
    bitwiseAndExpression(i) {
        if (i === undefined) {
            return this.getRuleContexts(BitwiseAndExpressionContext);
        }
        else {
            return this.getRuleContext(i, BitwiseAndExpressionContext);
        }
    }
    BIT_XOR(i) {
        if (i === undefined) {
            return this.getTokens(LPCParser.BIT_XOR);
        }
        else {
            return this.getToken(LPCParser.BIT_XOR, i);
        }
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_bitwiseXorExpression; }
    // @Override
    accept(visitor) {
        if (visitor.visitBitwiseXorExpression) {
            return visitor.visitBitwiseXorExpression(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.BitwiseXorExpressionContext = BitwiseXorExpressionContext;
class BitwiseAndExpressionContext extends ParserRuleContext_1.ParserRuleContext {
    equalityExpression(i) {
        if (i === undefined) {
            return this.getRuleContexts(EqualityExpressionContext);
        }
        else {
            return this.getRuleContext(i, EqualityExpressionContext);
        }
    }
    BIT_AND(i) {
        if (i === undefined) {
            return this.getTokens(LPCParser.BIT_AND);
        }
        else {
            return this.getToken(LPCParser.BIT_AND, i);
        }
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_bitwiseAndExpression; }
    // @Override
    accept(visitor) {
        if (visitor.visitBitwiseAndExpression) {
            return visitor.visitBitwiseAndExpression(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.BitwiseAndExpressionContext = BitwiseAndExpressionContext;
class EqualityExpressionContext extends ParserRuleContext_1.ParserRuleContext {
    relationalExpression(i) {
        if (i === undefined) {
            return this.getRuleContexts(RelationalExpressionContext);
        }
        else {
            return this.getRuleContext(i, RelationalExpressionContext);
        }
    }
    EQ(i) {
        if (i === undefined) {
            return this.getTokens(LPCParser.EQ);
        }
        else {
            return this.getToken(LPCParser.EQ, i);
        }
    }
    NE(i) {
        if (i === undefined) {
            return this.getTokens(LPCParser.NE);
        }
        else {
            return this.getToken(LPCParser.NE, i);
        }
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_equalityExpression; }
    // @Override
    accept(visitor) {
        if (visitor.visitEqualityExpression) {
            return visitor.visitEqualityExpression(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.EqualityExpressionContext = EqualityExpressionContext;
class RelationalExpressionContext extends ParserRuleContext_1.ParserRuleContext {
    shiftExpression(i) {
        if (i === undefined) {
            return this.getRuleContexts(ShiftExpressionContext);
        }
        else {
            return this.getRuleContext(i, ShiftExpressionContext);
        }
    }
    GT(i) {
        if (i === undefined) {
            return this.getTokens(LPCParser.GT);
        }
        else {
            return this.getToken(LPCParser.GT, i);
        }
    }
    LT(i) {
        if (i === undefined) {
            return this.getTokens(LPCParser.LT);
        }
        else {
            return this.getToken(LPCParser.LT, i);
        }
    }
    GE(i) {
        if (i === undefined) {
            return this.getTokens(LPCParser.GE);
        }
        else {
            return this.getToken(LPCParser.GE, i);
        }
    }
    LE(i) {
        if (i === undefined) {
            return this.getTokens(LPCParser.LE);
        }
        else {
            return this.getToken(LPCParser.LE, i);
        }
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_relationalExpression; }
    // @Override
    accept(visitor) {
        if (visitor.visitRelationalExpression) {
            return visitor.visitRelationalExpression(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.RelationalExpressionContext = RelationalExpressionContext;
class ShiftExpressionContext extends ParserRuleContext_1.ParserRuleContext {
    additiveExpression(i) {
        if (i === undefined) {
            return this.getRuleContexts(AdditiveExpressionContext);
        }
        else {
            return this.getRuleContext(i, AdditiveExpressionContext);
        }
    }
    SHIFT_LEFT(i) {
        if (i === undefined) {
            return this.getTokens(LPCParser.SHIFT_LEFT);
        }
        else {
            return this.getToken(LPCParser.SHIFT_LEFT, i);
        }
    }
    SHIFT_RIGHT(i) {
        if (i === undefined) {
            return this.getTokens(LPCParser.SHIFT_RIGHT);
        }
        else {
            return this.getToken(LPCParser.SHIFT_RIGHT, i);
        }
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_shiftExpression; }
    // @Override
    accept(visitor) {
        if (visitor.visitShiftExpression) {
            return visitor.visitShiftExpression(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.ShiftExpressionContext = ShiftExpressionContext;
class AdditiveExpressionContext extends ParserRuleContext_1.ParserRuleContext {
    multiplicativeExpression(i) {
        if (i === undefined) {
            return this.getRuleContexts(MultiplicativeExpressionContext);
        }
        else {
            return this.getRuleContext(i, MultiplicativeExpressionContext);
        }
    }
    PLUS(i) {
        if (i === undefined) {
            return this.getTokens(LPCParser.PLUS);
        }
        else {
            return this.getToken(LPCParser.PLUS, i);
        }
    }
    MINUS(i) {
        if (i === undefined) {
            return this.getTokens(LPCParser.MINUS);
        }
        else {
            return this.getToken(LPCParser.MINUS, i);
        }
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_additiveExpression; }
    // @Override
    accept(visitor) {
        if (visitor.visitAdditiveExpression) {
            return visitor.visitAdditiveExpression(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.AdditiveExpressionContext = AdditiveExpressionContext;
class MultiplicativeExpressionContext extends ParserRuleContext_1.ParserRuleContext {
    unaryExpression(i) {
        if (i === undefined) {
            return this.getRuleContexts(UnaryExpressionContext);
        }
        else {
            return this.getRuleContext(i, UnaryExpressionContext);
        }
    }
    STAR(i) {
        if (i === undefined) {
            return this.getTokens(LPCParser.STAR);
        }
        else {
            return this.getToken(LPCParser.STAR, i);
        }
    }
    DIV(i) {
        if (i === undefined) {
            return this.getTokens(LPCParser.DIV);
        }
        else {
            return this.getToken(LPCParser.DIV, i);
        }
    }
    PERCENT(i) {
        if (i === undefined) {
            return this.getTokens(LPCParser.PERCENT);
        }
        else {
            return this.getToken(LPCParser.PERCENT, i);
        }
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_multiplicativeExpression; }
    // @Override
    accept(visitor) {
        if (visitor.visitMultiplicativeExpression) {
            return visitor.visitMultiplicativeExpression(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.MultiplicativeExpressionContext = MultiplicativeExpressionContext;
class UnaryExpressionContext extends ParserRuleContext_1.ParserRuleContext {
    postfixExpression() {
        return this.tryGetRuleContext(0, PostfixExpressionContext);
    }
    INC() { return this.tryGetToken(LPCParser.INC, 0); }
    DEC() { return this.tryGetToken(LPCParser.DEC, 0); }
    unaryExpression() {
        return this.tryGetRuleContext(0, UnaryExpressionContext);
    }
    PLUS() { return this.tryGetToken(LPCParser.PLUS, 0); }
    MINUS() { return this.tryGetToken(LPCParser.MINUS, 0); }
    NOT() { return this.tryGetToken(LPCParser.NOT, 0); }
    BIT_NOT() { return this.tryGetToken(LPCParser.BIT_NOT, 0); }
    STAR() { return this.tryGetToken(LPCParser.STAR, 0); }
    CATCH() { return this.tryGetToken(LPCParser.CATCH, 0); }
    expression() {
        return this.tryGetRuleContext(0, ExpressionContext);
    }
    block() {
        return this.tryGetRuleContext(0, BlockContext);
    }
    castExpression() {
        return this.tryGetRuleContext(0, CastExpressionContext);
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_unaryExpression; }
    // @Override
    accept(visitor) {
        if (visitor.visitUnaryExpression) {
            return visitor.visitUnaryExpression(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.UnaryExpressionContext = UnaryExpressionContext;
class CastExpressionContext extends ParserRuleContext_1.ParserRuleContext {
    castType() {
        return this.getRuleContext(0, CastTypeContext);
    }
    unaryExpression() {
        return this.getRuleContext(0, UnaryExpressionContext);
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_castExpression; }
    // @Override
    accept(visitor) {
        if (visitor.visitCastExpression) {
            return visitor.visitCastExpression(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.CastExpressionContext = CastExpressionContext;
class CastTypeContext extends ParserRuleContext_1.ParserRuleContext {
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_castType; }
    // @Override
    accept(visitor) {
        if (visitor.visitCastType) {
            return visitor.visitCastType(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.CastTypeContext = CastTypeContext;
class PostfixExpressionContext extends ParserRuleContext_1.ParserRuleContext {
    primary() {
        return this.getRuleContext(0, PrimaryContext);
    }
    sliceExpr(i) {
        if (i === undefined) {
            return this.getRuleContexts(SliceExprContext);
        }
        else {
            return this.getRuleContext(i, SliceExprContext);
        }
    }
    INC(i) {
        if (i === undefined) {
            return this.getTokens(LPCParser.INC);
        }
        else {
            return this.getToken(LPCParser.INC, i);
        }
    }
    DEC(i) {
        if (i === undefined) {
            return this.getTokens(LPCParser.DEC);
        }
        else {
            return this.getToken(LPCParser.DEC, i);
        }
    }
    Identifier(i) {
        if (i === undefined) {
            return this.getTokens(LPCParser.Identifier);
        }
        else {
            return this.getToken(LPCParser.Identifier, i);
        }
    }
    ARROW(i) {
        if (i === undefined) {
            return this.getTokens(LPCParser.ARROW);
        }
        else {
            return this.getToken(LPCParser.ARROW, i);
        }
    }
    DOT(i) {
        if (i === undefined) {
            return this.getTokens(LPCParser.DOT);
        }
        else {
            return this.getToken(LPCParser.DOT, i);
        }
    }
    SCOPE(i) {
        if (i === undefined) {
            return this.getTokens(LPCParser.SCOPE);
        }
        else {
            return this.getToken(LPCParser.SCOPE, i);
        }
    }
    argumentList(i) {
        if (i === undefined) {
            return this.getRuleContexts(ArgumentListContext);
        }
        else {
            return this.getRuleContext(i, ArgumentListContext);
        }
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_postfixExpression; }
    // @Override
    accept(visitor) {
        if (visitor.visitPostfixExpression) {
            return visitor.visitPostfixExpression(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.PostfixExpressionContext = PostfixExpressionContext;
class ArgumentListContext extends ParserRuleContext_1.ParserRuleContext {
    assignmentExpression(i) {
        if (i === undefined) {
            return this.getRuleContexts(AssignmentExpressionContext);
        }
        else {
            return this.getRuleContext(i, AssignmentExpressionContext);
        }
    }
    ELLIPSIS(i) {
        if (i === undefined) {
            return this.getTokens(LPCParser.ELLIPSIS);
        }
        else {
            return this.getToken(LPCParser.ELLIPSIS, i);
        }
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_argumentList; }
    // @Override
    accept(visitor) {
        if (visitor.visitArgumentList) {
            return visitor.visitArgumentList(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.ArgumentListContext = ArgumentListContext;
class PrimaryContext extends ParserRuleContext_1.ParserRuleContext {
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_primary; }
    copyFrom(ctx) {
        super.copyFrom(ctx);
    }
}
exports.PrimaryContext = PrimaryContext;
class ScopeIdentifierContext extends PrimaryContext {
    SCOPE() { return this.getToken(LPCParser.SCOPE, 0); }
    Identifier() { return this.getToken(LPCParser.Identifier, 0); }
    constructor(ctx) {
        super(ctx.parent, ctx.invokingState);
        this.copyFrom(ctx);
    }
    // @Override
    accept(visitor) {
        if (visitor.visitScopeIdentifier) {
            return visitor.visitScopeIdentifier(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.ScopeIdentifierContext = ScopeIdentifierContext;
class StringConcatenationContext extends PrimaryContext {
    stringConcat() {
        return this.getRuleContext(0, StringConcatContext);
    }
    constructor(ctx) {
        super(ctx.parent, ctx.invokingState);
        this.copyFrom(ctx);
    }
    // @Override
    accept(visitor) {
        if (visitor.visitStringConcatenation) {
            return visitor.visitStringConcatenation(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.StringConcatenationContext = StringConcatenationContext;
class ClosureExprContext extends PrimaryContext {
    CLOSURE() { return this.getToken(LPCParser.CLOSURE, 0); }
    constructor(ctx) {
        super(ctx.parent, ctx.invokingState);
        this.copyFrom(ctx);
    }
    // @Override
    accept(visitor) {
        if (visitor.visitClosureExpr) {
            return visitor.visitClosureExpr(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.ClosureExprContext = ClosureExprContext;
class MappingLiteralExprContext extends PrimaryContext {
    mappingLiteral() {
        return this.getRuleContext(0, MappingLiteralContext);
    }
    constructor(ctx) {
        super(ctx.parent, ctx.invokingState);
        this.copyFrom(ctx);
    }
    // @Override
    accept(visitor) {
        if (visitor.visitMappingLiteralExpr) {
            return visitor.visitMappingLiteralExpr(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.MappingLiteralExprContext = MappingLiteralExprContext;
class AnonFunctionContext extends PrimaryContext {
    block() {
        return this.getRuleContext(0, BlockContext);
    }
    parameterList() {
        return this.tryGetRuleContext(0, ParameterListContext);
    }
    constructor(ctx) {
        super(ctx.parent, ctx.invokingState);
        this.copyFrom(ctx);
    }
    // @Override
    accept(visitor) {
        if (visitor.visitAnonFunction) {
            return visitor.visitAnonFunction(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.AnonFunctionContext = AnonFunctionContext;
class IdentifierPrimaryContext extends PrimaryContext {
    Identifier() { return this.getToken(LPCParser.Identifier, 0); }
    constructor(ctx) {
        super(ctx.parent, ctx.invokingState);
        this.copyFrom(ctx);
    }
    // @Override
    accept(visitor) {
        if (visitor.visitIdentifierPrimary) {
            return visitor.visitIdentifierPrimary(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.IdentifierPrimaryContext = IdentifierPrimaryContext;
class IntegerPrimaryContext extends PrimaryContext {
    INTEGER() { return this.getToken(LPCParser.INTEGER, 0); }
    constructor(ctx) {
        super(ctx.parent, ctx.invokingState);
        this.copyFrom(ctx);
    }
    // @Override
    accept(visitor) {
        if (visitor.visitIntegerPrimary) {
            return visitor.visitIntegerPrimary(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.IntegerPrimaryContext = IntegerPrimaryContext;
class FloatPrimaryContext extends PrimaryContext {
    FLOAT() { return this.getToken(LPCParser.FLOAT, 0); }
    constructor(ctx) {
        super(ctx.parent, ctx.invokingState);
        this.copyFrom(ctx);
    }
    // @Override
    accept(visitor) {
        if (visitor.visitFloatPrimary) {
            return visitor.visitFloatPrimary(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.FloatPrimaryContext = FloatPrimaryContext;
class StringPrimaryContext extends PrimaryContext {
    STRING_LITERAL() { return this.tryGetToken(LPCParser.STRING_LITERAL, 0); }
    HEREDOC_STRING() { return this.tryGetToken(LPCParser.HEREDOC_STRING, 0); }
    constructor(ctx) {
        super(ctx.parent, ctx.invokingState);
        this.copyFrom(ctx);
    }
    // @Override
    accept(visitor) {
        if (visitor.visitStringPrimary) {
            return visitor.visitStringPrimary(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.StringPrimaryContext = StringPrimaryContext;
class CharPrimaryContext extends PrimaryContext {
    CHAR_LITERAL() { return this.getToken(LPCParser.CHAR_LITERAL, 0); }
    constructor(ctx) {
        super(ctx.parent, ctx.invokingState);
        this.copyFrom(ctx);
    }
    // @Override
    accept(visitor) {
        if (visitor.visitCharPrimary) {
            return visitor.visitCharPrimary(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.CharPrimaryContext = CharPrimaryContext;
class ArrayLiteralContext extends PrimaryContext {
    expressionList() {
        return this.tryGetRuleContext(0, ExpressionListContext);
    }
    constructor(ctx) {
        super(ctx.parent, ctx.invokingState);
        this.copyFrom(ctx);
    }
    // @Override
    accept(visitor) {
        if (visitor.visitArrayLiteral) {
            return visitor.visitArrayLiteral(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.ArrayLiteralContext = ArrayLiteralContext;
class ParenExprContext extends PrimaryContext {
    expression() {
        return this.getRuleContext(0, ExpressionContext);
    }
    constructor(ctx) {
        super(ctx.parent, ctx.invokingState);
        this.copyFrom(ctx);
    }
    // @Override
    accept(visitor) {
        if (visitor.visitParenExpr) {
            return visitor.visitParenExpr(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.ParenExprContext = ParenExprContext;
class RefVariableContext extends PrimaryContext {
    REF() { return this.getToken(LPCParser.REF, 0); }
    Identifier() { return this.getToken(LPCParser.Identifier, 0); }
    constructor(ctx) {
        super(ctx.parent, ctx.invokingState);
        this.copyFrom(ctx);
    }
    // @Override
    accept(visitor) {
        if (visitor.visitRefVariable) {
            return visitor.visitRefVariable(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.RefVariableContext = RefVariableContext;
class StringConcatContext extends ParserRuleContext_1.ParserRuleContext {
    concatItem(i) {
        if (i === undefined) {
            return this.getRuleContexts(ConcatItemContext);
        }
        else {
            return this.getRuleContext(i, ConcatItemContext);
        }
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_stringConcat; }
    // @Override
    accept(visitor) {
        if (visitor.visitStringConcat) {
            return visitor.visitStringConcat(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.StringConcatContext = StringConcatContext;
class ConcatItemContext extends ParserRuleContext_1.ParserRuleContext {
    STRING_LITERAL() { return this.tryGetToken(LPCParser.STRING_LITERAL, 0); }
    Identifier() { return this.tryGetToken(LPCParser.Identifier, 0); }
    argumentList() {
        return this.tryGetRuleContext(0, ArgumentListContext);
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_concatItem; }
    // @Override
    accept(visitor) {
        if (visitor.visitConcatItem) {
            return visitor.visitConcatItem(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.ConcatItemContext = ConcatItemContext;
class IfStatementContext extends ParserRuleContext_1.ParserRuleContext {
    IF() { return this.getToken(LPCParser.IF, 0); }
    expression() {
        return this.getRuleContext(0, ExpressionContext);
    }
    statement(i) {
        if (i === undefined) {
            return this.getRuleContexts(StatementContext);
        }
        else {
            return this.getRuleContext(i, StatementContext);
        }
    }
    ELSE() { return this.tryGetToken(LPCParser.ELSE, 0); }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_ifStatement; }
    // @Override
    accept(visitor) {
        if (visitor.visitIfStatement) {
            return visitor.visitIfStatement(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.IfStatementContext = IfStatementContext;
class WhileStatementContext extends ParserRuleContext_1.ParserRuleContext {
    WHILE() { return this.getToken(LPCParser.WHILE, 0); }
    expression() {
        return this.getRuleContext(0, ExpressionContext);
    }
    statement() {
        return this.getRuleContext(0, StatementContext);
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_whileStatement; }
    // @Override
    accept(visitor) {
        if (visitor.visitWhileStatement) {
            return visitor.visitWhileStatement(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.WhileStatementContext = WhileStatementContext;
class DoWhileStatementContext extends ParserRuleContext_1.ParserRuleContext {
    DO() { return this.getToken(LPCParser.DO, 0); }
    statement() {
        return this.getRuleContext(0, StatementContext);
    }
    WHILE() { return this.getToken(LPCParser.WHILE, 0); }
    expression() {
        return this.getRuleContext(0, ExpressionContext);
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_doWhileStatement; }
    // @Override
    accept(visitor) {
        if (visitor.visitDoWhileStatement) {
            return visitor.visitDoWhileStatement(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.DoWhileStatementContext = DoWhileStatementContext;
class ForStatementContext extends ParserRuleContext_1.ParserRuleContext {
    FOR() { return this.getToken(LPCParser.FOR, 0); }
    statement() {
        return this.getRuleContext(0, StatementContext);
    }
    forInit() {
        return this.tryGetRuleContext(0, ForInitContext);
    }
    expression() {
        return this.tryGetRuleContext(0, ExpressionContext);
    }
    expressionList() {
        return this.tryGetRuleContext(0, ExpressionListContext);
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_forStatement; }
    // @Override
    accept(visitor) {
        if (visitor.visitForStatement) {
            return visitor.visitForStatement(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.ForStatementContext = ForStatementContext;
class ForInitContext extends ParserRuleContext_1.ParserRuleContext {
    variableDecl() {
        return this.tryGetRuleContext(0, VariableDeclContext);
    }
    expressionList() {
        return this.tryGetRuleContext(0, ExpressionListContext);
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_forInit; }
    // @Override
    accept(visitor) {
        if (visitor.visitForInit) {
            return visitor.visitForInit(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.ForInitContext = ForInitContext;
class ExpressionListContext extends ParserRuleContext_1.ParserRuleContext {
    expression(i) {
        if (i === undefined) {
            return this.getRuleContexts(ExpressionContext);
        }
        else {
            return this.getRuleContext(i, ExpressionContext);
        }
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_expressionList; }
    // @Override
    accept(visitor) {
        if (visitor.visitExpressionList) {
            return visitor.visitExpressionList(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.ExpressionListContext = ExpressionListContext;
class ForeachStatementContext extends ParserRuleContext_1.ParserRuleContext {
    FOREACH() { return this.getToken(LPCParser.FOREACH, 0); }
    foreachInit() {
        return this.getRuleContext(0, ForeachInitContext);
    }
    IN() { return this.getToken(LPCParser.IN, 0); }
    expression() {
        return this.getRuleContext(0, ExpressionContext);
    }
    statement() {
        return this.getRuleContext(0, StatementContext);
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_foreachStatement; }
    // @Override
    accept(visitor) {
        if (visitor.visitForeachStatement) {
            return visitor.visitForeachStatement(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.ForeachStatementContext = ForeachStatementContext;
class ForeachInitContext extends ParserRuleContext_1.ParserRuleContext {
    foreachVar(i) {
        if (i === undefined) {
            return this.getRuleContexts(ForeachVarContext);
        }
        else {
            return this.getRuleContext(i, ForeachVarContext);
        }
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_foreachInit; }
    // @Override
    accept(visitor) {
        if (visitor.visitForeachInit) {
            return visitor.visitForeachInit(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.ForeachInitContext = ForeachInitContext;
class ForeachVarContext extends ParserRuleContext_1.ParserRuleContext {
    typeSpec() {
        return this.tryGetRuleContext(0, TypeSpecContext);
    }
    Identifier() { return this.getToken(LPCParser.Identifier, 0); }
    REF() { return this.tryGetToken(LPCParser.REF, 0); }
    STAR(i) {
        if (i === undefined) {
            return this.getTokens(LPCParser.STAR);
        }
        else {
            return this.getToken(LPCParser.STAR, i);
        }
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_foreachVar; }
    // @Override
    accept(visitor) {
        if (visitor.visitForeachVar) {
            return visitor.visitForeachVar(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.ForeachVarContext = ForeachVarContext;
class SwitchStatementContext extends ParserRuleContext_1.ParserRuleContext {
    SWITCH() { return this.getToken(LPCParser.SWITCH, 0); }
    expression() {
        return this.getRuleContext(0, ExpressionContext);
    }
    switchSection(i) {
        if (i === undefined) {
            return this.getRuleContexts(SwitchSectionContext);
        }
        else {
            return this.getRuleContext(i, SwitchSectionContext);
        }
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_switchStatement; }
    // @Override
    accept(visitor) {
        if (visitor.visitSwitchStatement) {
            return visitor.visitSwitchStatement(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.SwitchStatementContext = SwitchStatementContext;
class SwitchSectionContext extends ParserRuleContext_1.ParserRuleContext {
    switchLabelWithColon(i) {
        if (i === undefined) {
            return this.getRuleContexts(SwitchLabelWithColonContext);
        }
        else {
            return this.getRuleContext(i, SwitchLabelWithColonContext);
        }
    }
    statement(i) {
        if (i === undefined) {
            return this.getRuleContexts(StatementContext);
        }
        else {
            return this.getRuleContext(i, StatementContext);
        }
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_switchSection; }
    // @Override
    accept(visitor) {
        if (visitor.visitSwitchSection) {
            return visitor.visitSwitchSection(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.SwitchSectionContext = SwitchSectionContext;
class SwitchLabelWithColonContext extends ParserRuleContext_1.ParserRuleContext {
    CASE() { return this.tryGetToken(LPCParser.CASE, 0); }
    switchLabel() {
        return this.tryGetRuleContext(0, SwitchLabelContext);
    }
    DEFAULT() { return this.tryGetToken(LPCParser.DEFAULT, 0); }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_switchLabelWithColon; }
    // @Override
    accept(visitor) {
        if (visitor.visitSwitchLabelWithColon) {
            return visitor.visitSwitchLabelWithColon(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.SwitchLabelWithColonContext = SwitchLabelWithColonContext;
class SwitchLabelContext extends ParserRuleContext_1.ParserRuleContext {
    expression(i) {
        if (i === undefined) {
            return this.getRuleContexts(ExpressionContext);
        }
        else {
            return this.getRuleContext(i, ExpressionContext);
        }
    }
    RANGE_OP() { return this.tryGetToken(LPCParser.RANGE_OP, 0); }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_switchLabel; }
    // @Override
    accept(visitor) {
        if (visitor.visitSwitchLabel) {
            return visitor.visitSwitchLabel(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.SwitchLabelContext = SwitchLabelContext;
class BreakStatementContext extends ParserRuleContext_1.ParserRuleContext {
    BREAK() { return this.getToken(LPCParser.BREAK, 0); }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_breakStatement; }
    // @Override
    accept(visitor) {
        if (visitor.visitBreakStatement) {
            return visitor.visitBreakStatement(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.BreakStatementContext = BreakStatementContext;
class ContinueStatementContext extends ParserRuleContext_1.ParserRuleContext {
    CONTINUE() { return this.getToken(LPCParser.CONTINUE, 0); }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_continueStatement; }
    // @Override
    accept(visitor) {
        if (visitor.visitContinueStatement) {
            return visitor.visitContinueStatement(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.ContinueStatementContext = ContinueStatementContext;
class ReturnStatementContext extends ParserRuleContext_1.ParserRuleContext {
    RETURN() { return this.getToken(LPCParser.RETURN, 0); }
    expression() {
        return this.tryGetRuleContext(0, ExpressionContext);
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_returnStatement; }
    // @Override
    accept(visitor) {
        if (visitor.visitReturnStatement) {
            return visitor.visitReturnStatement(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.ReturnStatementContext = ReturnStatementContext;
class InheritStatementContext extends ParserRuleContext_1.ParserRuleContext {
    INHERIT() { return this.getToken(LPCParser.INHERIT, 0); }
    Identifier() { return this.tryGetToken(LPCParser.Identifier, 0); }
    STRING_LITERAL() { return this.tryGetToken(LPCParser.STRING_LITERAL, 0); }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_inheritStatement; }
    // @Override
    accept(visitor) {
        if (visitor.visitInheritStatement) {
            return visitor.visitInheritStatement(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.InheritStatementContext = InheritStatementContext;
class PrototypeStatementContext extends ParserRuleContext_1.ParserRuleContext {
    Identifier() { return this.getToken(LPCParser.Identifier, 0); }
    MODIFIER(i) {
        if (i === undefined) {
            return this.getTokens(LPCParser.MODIFIER);
        }
        else {
            return this.getToken(LPCParser.MODIFIER, i);
        }
    }
    typeSpec() {
        return this.tryGetRuleContext(0, TypeSpecContext);
    }
    STAR(i) {
        if (i === undefined) {
            return this.getTokens(LPCParser.STAR);
        }
        else {
            return this.getToken(LPCParser.STAR, i);
        }
    }
    parameterList() {
        return this.tryGetRuleContext(0, ParameterListContext);
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_prototypeStatement; }
    // @Override
    accept(visitor) {
        if (visitor.visitPrototypeStatement) {
            return visitor.visitPrototypeStatement(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.PrototypeStatementContext = PrototypeStatementContext;
class MappingLiteralContext extends ParserRuleContext_1.ParserRuleContext {
    mappingPairList() {
        return this.tryGetRuleContext(0, MappingPairListContext);
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_mappingLiteral; }
    // @Override
    accept(visitor) {
        if (visitor.visitMappingLiteral) {
            return visitor.visitMappingLiteral(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.MappingLiteralContext = MappingLiteralContext;
class MappingPairListContext extends ParserRuleContext_1.ParserRuleContext {
    mappingPair(i) {
        if (i === undefined) {
            return this.getRuleContexts(MappingPairContext);
        }
        else {
            return this.getRuleContext(i, MappingPairContext);
        }
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_mappingPairList; }
    // @Override
    accept(visitor) {
        if (visitor.visitMappingPairList) {
            return visitor.visitMappingPairList(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.MappingPairListContext = MappingPairListContext;
class MappingPairContext extends ParserRuleContext_1.ParserRuleContext {
    expression(i) {
        if (i === undefined) {
            return this.getRuleContexts(ExpressionContext);
        }
        else {
            return this.getRuleContext(i, ExpressionContext);
        }
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_mappingPair; }
    // @Override
    accept(visitor) {
        if (visitor.visitMappingPair) {
            return visitor.visitMappingPair(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.MappingPairContext = MappingPairContext;
class SliceExprContext extends ParserRuleContext_1.ParserRuleContext {
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_sliceExpr; }
    copyFrom(ctx) {
        super.copyFrom(ctx);
    }
}
exports.SliceExprContext = SliceExprContext;
class TailIndexOnlyContext extends SliceExprContext {
    LT() { return this.getToken(LPCParser.LT, 0); }
    expression() {
        return this.getRuleContext(0, ExpressionContext);
    }
    constructor(ctx) {
        super(ctx.parent, ctx.invokingState);
        this.copyFrom(ctx);
    }
    // @Override
    accept(visitor) {
        if (visitor.visitTailIndexOnly) {
            return visitor.visitTailIndexOnly(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.TailIndexOnlyContext = TailIndexOnlyContext;
class HeadRangeContext extends SliceExprContext {
    expression(i) {
        if (i === undefined) {
            return this.getRuleContexts(ExpressionContext);
        }
        else {
            return this.getRuleContext(i, ExpressionContext);
        }
    }
    RANGE_OP() { return this.getToken(LPCParser.RANGE_OP, 0); }
    LT() { return this.tryGetToken(LPCParser.LT, 0); }
    constructor(ctx) {
        super(ctx.parent, ctx.invokingState);
        this.copyFrom(ctx);
    }
    // @Override
    accept(visitor) {
        if (visitor.visitHeadRange) {
            return visitor.visitHeadRange(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.HeadRangeContext = HeadRangeContext;
class OpenRangeContext extends SliceExprContext {
    RANGE_OP() { return this.getToken(LPCParser.RANGE_OP, 0); }
    LT() { return this.tryGetToken(LPCParser.LT, 0); }
    expression() {
        return this.tryGetRuleContext(0, ExpressionContext);
    }
    constructor(ctx) {
        super(ctx.parent, ctx.invokingState);
        this.copyFrom(ctx);
    }
    // @Override
    accept(visitor) {
        if (visitor.visitOpenRange) {
            return visitor.visitOpenRange(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.OpenRangeContext = OpenRangeContext;
class SingleIndexContext extends SliceExprContext {
    expression() {
        return this.getRuleContext(0, ExpressionContext);
    }
    constructor(ctx) {
        super(ctx.parent, ctx.invokingState);
        this.copyFrom(ctx);
    }
    // @Override
    accept(visitor) {
        if (visitor.visitSingleIndex) {
            return visitor.visitSingleIndex(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.SingleIndexContext = SingleIndexContext;
class TailHeadRangeContext extends SliceExprContext {
    LT(i) {
        if (i === undefined) {
            return this.getTokens(LPCParser.LT);
        }
        else {
            return this.getToken(LPCParser.LT, i);
        }
    }
    expression(i) {
        if (i === undefined) {
            return this.getRuleContexts(ExpressionContext);
        }
        else {
            return this.getRuleContext(i, ExpressionContext);
        }
    }
    RANGE_OP() { return this.getToken(LPCParser.RANGE_OP, 0); }
    constructor(ctx) {
        super(ctx.parent, ctx.invokingState);
        this.copyFrom(ctx);
    }
    // @Override
    accept(visitor) {
        if (visitor.visitTailHeadRange) {
            return visitor.visitTailHeadRange(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.TailHeadRangeContext = TailHeadRangeContext;
class MacroInvokeContext extends ParserRuleContext_1.ParserRuleContext {
    Identifier() { return this.getToken(LPCParser.Identifier, 0); }
    argumentList() {
        return this.tryGetRuleContext(0, ArgumentListContext);
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return LPCParser.RULE_macroInvoke; }
    // @Override
    accept(visitor) {
        if (visitor.visitMacroInvoke) {
            return visitor.visitMacroInvoke(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.MacroInvokeContext = MacroInvokeContext;
//# sourceMappingURL=LPCParser.js.map