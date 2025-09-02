// Generated from grammar/LPCParser.g4 by ANTLR 4.9.0-SNAPSHOT


import { ATN } from "antlr4ts/atn/ATN";
import { ATNDeserializer } from "antlr4ts/atn/ATNDeserializer";
import { FailedPredicateException } from "antlr4ts/FailedPredicateException";
import { NotNull } from "antlr4ts/Decorators";
import { NoViableAltException } from "antlr4ts/NoViableAltException";
import { Override } from "antlr4ts/Decorators";
import { Parser } from "antlr4ts/Parser";
import { ParserRuleContext } from "antlr4ts/ParserRuleContext";
import { ParserATNSimulator } from "antlr4ts/atn/ParserATNSimulator";
import { ParseTreeListener } from "antlr4ts/tree/ParseTreeListener";
import { ParseTreeVisitor } from "antlr4ts/tree/ParseTreeVisitor";
import { RecognitionException } from "antlr4ts/RecognitionException";
import { RuleContext } from "antlr4ts/RuleContext";
//import { RuleVersion } from "antlr4ts/RuleVersion";
import { TerminalNode } from "antlr4ts/tree/TerminalNode";
import { Token } from "antlr4ts/Token";
import { TokenStream } from "antlr4ts/TokenStream";
import { Vocabulary } from "antlr4ts/Vocabulary";
import { VocabularyImpl } from "antlr4ts/VocabularyImpl";

import * as Utils from "antlr4ts/misc/Utils";

import { LPCParserVisitor } from "./LPCParserVisitor";


export class LPCParser extends Parser {
	public static readonly INTEGER = 1;
	public static readonly FLOAT = 2;
	public static readonly CHAR_LITERAL = 3;
	public static readonly STRING_LITERAL = 4;
	public static readonly HEREDOC_START = 5;
	public static readonly HEREDOC_END = 6;
	public static readonly WS = 7;
	public static readonly LINE_COMMENT = 8;
	public static readonly BLOCK_COMMENT = 9;
	public static readonly DIRECTIVE = 10;
	public static readonly IF = 11;
	public static readonly ELSE = 12;
	public static readonly FOR = 13;
	public static readonly WHILE = 14;
	public static readonly DO = 15;
	public static readonly SWITCH = 16;
	public static readonly CASE = 17;
	public static readonly DEFAULT = 18;
	public static readonly BREAK = 19;
	public static readonly CONTINUE = 20;
	public static readonly RETURN = 21;
	public static readonly FOREACH = 22;
	public static readonly INHERIT = 23;
	public static readonly INCLUDE = 24;
	public static readonly CATCH = 25;
	public static readonly REF = 26;
	public static readonly IN = 27;
	public static readonly KW_INT = 28;
	public static readonly KW_FLOAT = 29;
	public static readonly KW_STRING = 30;
	public static readonly KW_OBJECT = 31;
	public static readonly KW_MIXED = 32;
	public static readonly KW_MAPPING = 33;
	public static readonly KW_FUNCTION = 34;
	public static readonly KW_BUFFER = 35;
	public static readonly KW_VOID = 36;
	public static readonly KW_STRUCT = 37;
	public static readonly ELLIPSIS = 38;
	public static readonly RANGE_OP = 39;
	public static readonly ARROW = 40;
	public static readonly DOT = 41;
	public static readonly INC = 42;
	public static readonly DEC = 43;
	public static readonly PLUS_ASSIGN = 44;
	public static readonly MINUS_ASSIGN = 45;
	public static readonly STAR_ASSIGN = 46;
	public static readonly DIV_ASSIGN = 47;
	public static readonly PERCENT_ASSIGN = 48;
	public static readonly PLUS = 49;
	public static readonly MINUS = 50;
	public static readonly STAR = 51;
	public static readonly DIV = 52;
	public static readonly PERCENT = 53;
	public static readonly SCOPE = 54;
	public static readonly SEMI = 55;
	public static readonly COMMA = 56;
	public static readonly LPAREN = 57;
	public static readonly RPAREN = 58;
	public static readonly LBRACE = 59;
	public static readonly RBRACE = 60;
	public static readonly LBRACK = 61;
	public static readonly RBRACK = 62;
	public static readonly QUESTION = 63;
	public static readonly COLON = 64;
	public static readonly GT = 65;
	public static readonly LT = 66;
	public static readonly GE = 67;
	public static readonly LE = 68;
	public static readonly EQ = 69;
	public static readonly NE = 70;
	public static readonly ASSIGN = 71;
	public static readonly NOT = 72;
	public static readonly AND = 73;
	public static readonly OR = 74;
	public static readonly SHIFT_LEFT = 75;
	public static readonly SHIFT_RIGHT = 76;
	public static readonly BIT_AND = 77;
	public static readonly BIT_OR = 78;
	public static readonly BIT_XOR = 79;
	public static readonly BIT_NOT = 80;
	public static readonly BIT_OR_ASSIGN = 81;
	public static readonly BIT_AND_ASSIGN = 82;
	public static readonly MODIFIER = 83;
	public static readonly Identifier = 84;
	public static readonly RULE_sourceFile = 0;
	public static readonly RULE_statement = 1;
	public static readonly RULE_functionDef = 2;
	public static readonly RULE_variableDecl = 3;
	public static readonly RULE_variableDeclarator = 4;
	public static readonly RULE_parameterList = 5;
	public static readonly RULE_parameter = 6;
	public static readonly RULE_typeSpec = 7;
	public static readonly RULE_block = 8;
	public static readonly RULE_exprStatement = 9;
	public static readonly RULE_expression = 10;
	public static readonly RULE_assignmentExpression = 11;
	public static readonly RULE_conditionalExpression = 12;
	public static readonly RULE_logicalOrExpression = 13;
	public static readonly RULE_logicalAndExpression = 14;
	public static readonly RULE_bitwiseOrExpression = 15;
	public static readonly RULE_bitwiseXorExpression = 16;
	public static readonly RULE_bitwiseAndExpression = 17;
	public static readonly RULE_equalityExpression = 18;
	public static readonly RULE_relationalExpression = 19;
	public static readonly RULE_shiftExpression = 20;
	public static readonly RULE_additiveExpression = 21;
	public static readonly RULE_multiplicativeExpression = 22;
	public static readonly RULE_unaryExpression = 23;
	public static readonly RULE_castExpression = 24;
	public static readonly RULE_castType = 25;
	public static readonly RULE_postfixExpression = 26;
	public static readonly RULE_argumentList = 27;
	public static readonly RULE_primary = 28;
	public static readonly RULE_stringConcat = 29;
	public static readonly RULE_concatItem = 30;
	public static readonly RULE_ifStatement = 31;
	public static readonly RULE_whileStatement = 32;
	public static readonly RULE_doWhileStatement = 33;
	public static readonly RULE_forStatement = 34;
	public static readonly RULE_forInit = 35;
	public static readonly RULE_expressionList = 36;
	public static readonly RULE_foreachStatement = 37;
	public static readonly RULE_foreachInit = 38;
	public static readonly RULE_foreachVar = 39;
	public static readonly RULE_switchStatement = 40;
	public static readonly RULE_switchSection = 41;
	public static readonly RULE_switchLabelWithColon = 42;
	public static readonly RULE_switchLabel = 43;
	public static readonly RULE_breakStatement = 44;
	public static readonly RULE_continueStatement = 45;
	public static readonly RULE_returnStatement = 46;
	public static readonly RULE_closureExpr = 47;
	public static readonly RULE_inheritStatement = 48;
	public static readonly RULE_includeStatement = 49;
	public static readonly RULE_macroInvoke = 50;
	public static readonly RULE_prototypeStatement = 51;
	public static readonly RULE_mappingLiteral = 52;
	public static readonly RULE_mappingPairList = 53;
	public static readonly RULE_mappingPair = 54;
	public static readonly RULE_sliceExpr = 55;
	// tslint:disable:no-trailing-whitespace
	public static readonly ruleNames: string[] = [
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
		"closureExpr", "inheritStatement", "includeStatement", "macroInvoke", 
		"prototypeStatement", "mappingLiteral", "mappingPairList", "mappingPair", 
		"sliceExpr",
	];

	private static readonly _LITERAL_NAMES: Array<string | undefined> = [
		undefined, undefined, undefined, undefined, undefined, undefined, undefined, 
		undefined, undefined, undefined, undefined, "'if'", "'else'", "'for'", 
		"'while'", "'do'", "'switch'", "'case'", "'default'", "'break'", "'continue'", 
		"'return'", "'foreach'", "'inherit'", "'include'", "'catch'", "'ref'", 
		"'in'", "'int'", "'float'", "'string'", "'object'", "'mixed'", "'mapping'", 
		"'function'", "'buffer'", "'void'", "'struct'", "'...'", "'..'", "'->'", 
		"'.'", "'++'", "'--'", "'+='", "'-='", "'*='", "'/='", "'%='", "'+'", 
		"'-'", "'*'", "'/'", "'%'", "'::'", "';'", "','", "'('", "')'", "'{'", 
		"'}'", "'['", "']'", "'?'", "':'", "'>'", "'<'", "'>='", "'<='", "'=='", 
		"'!='", "'='", "'!'", "'&&'", "'||'", "'<<'", "'>>'", "'&'", "'|'", "'^'", 
		"'~'", "'|='", "'&='",
	];
	private static readonly _SYMBOLIC_NAMES: Array<string | undefined> = [
		undefined, "INTEGER", "FLOAT", "CHAR_LITERAL", "STRING_LITERAL", "HEREDOC_START", 
		"HEREDOC_END", "WS", "LINE_COMMENT", "BLOCK_COMMENT", "DIRECTIVE", "IF", 
		"ELSE", "FOR", "WHILE", "DO", "SWITCH", "CASE", "DEFAULT", "BREAK", "CONTINUE", 
		"RETURN", "FOREACH", "INHERIT", "INCLUDE", "CATCH", "REF", "IN", "KW_INT", 
		"KW_FLOAT", "KW_STRING", "KW_OBJECT", "KW_MIXED", "KW_MAPPING", "KW_FUNCTION", 
		"KW_BUFFER", "KW_VOID", "KW_STRUCT", "ELLIPSIS", "RANGE_OP", "ARROW", 
		"DOT", "INC", "DEC", "PLUS_ASSIGN", "MINUS_ASSIGN", "STAR_ASSIGN", "DIV_ASSIGN", 
		"PERCENT_ASSIGN", "PLUS", "MINUS", "STAR", "DIV", "PERCENT", "SCOPE", 
		"SEMI", "COMMA", "LPAREN", "RPAREN", "LBRACE", "RBRACE", "LBRACK", "RBRACK", 
		"QUESTION", "COLON", "GT", "LT", "GE", "LE", "EQ", "NE", "ASSIGN", "NOT", 
		"AND", "OR", "SHIFT_LEFT", "SHIFT_RIGHT", "BIT_AND", "BIT_OR", "BIT_XOR", 
		"BIT_NOT", "BIT_OR_ASSIGN", "BIT_AND_ASSIGN", "MODIFIER", "Identifier",
	];
	public static readonly VOCABULARY: Vocabulary = new VocabularyImpl(LPCParser._LITERAL_NAMES, LPCParser._SYMBOLIC_NAMES, []);

	// @Override
	// @NotNull
	public get vocabulary(): Vocabulary {
		return LPCParser.VOCABULARY;
	}
	// tslint:enable:no-trailing-whitespace

	// @Override
	public get grammarFileName(): string { return "LPCParser.g4"; }

	// @Override
	public get ruleNames(): string[] { return LPCParser.ruleNames; }

	// @Override
	public get serializedATN(): string { return LPCParser._serializedATN; }

	protected createFailedPredicateException(predicate?: string, message?: string): FailedPredicateException {
		return new FailedPredicateException(this, predicate, message);
	}

	constructor(input: TokenStream) {
		super(input);
		this._interp = new ParserATNSimulator(LPCParser._ATN, this);
	}
	// @RuleVersion(0)
	public sourceFile(): SourceFileContext {
		let _localctx: SourceFileContext = new SourceFileContext(this._ctx, this.state);
		this.enterRule(_localctx, 0, LPCParser.RULE_sourceFile);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 115;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.IF) | (1 << LPCParser.FOR) | (1 << LPCParser.WHILE) | (1 << LPCParser.DO) | (1 << LPCParser.SWITCH) | (1 << LPCParser.BREAK) | (1 << LPCParser.CONTINUE) | (1 << LPCParser.RETURN) | (1 << LPCParser.FOREACH) | (1 << LPCParser.INHERIT) | (1 << LPCParser.INCLUDE) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF) | (1 << LPCParser.KW_INT) | (1 << LPCParser.KW_FLOAT) | (1 << LPCParser.KW_STRING) | (1 << LPCParser.KW_OBJECT))) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & ((1 << (LPCParser.KW_MIXED - 32)) | (1 << (LPCParser.KW_MAPPING - 32)) | (1 << (LPCParser.KW_FUNCTION - 32)) | (1 << (LPCParser.KW_BUFFER - 32)) | (1 << (LPCParser.KW_VOID - 32)) | (1 << (LPCParser.KW_STRUCT - 32)) | (1 << (LPCParser.INC - 32)) | (1 << (LPCParser.DEC - 32)) | (1 << (LPCParser.PLUS - 32)) | (1 << (LPCParser.MINUS - 32)) | (1 << (LPCParser.STAR - 32)) | (1 << (LPCParser.SCOPE - 32)) | (1 << (LPCParser.SEMI - 32)) | (1 << (LPCParser.LPAREN - 32)) | (1 << (LPCParser.LBRACE - 32)))) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & ((1 << (LPCParser.NOT - 72)) | (1 << (LPCParser.BIT_NOT - 72)) | (1 << (LPCParser.MODIFIER - 72)) | (1 << (LPCParser.Identifier - 72)))) !== 0)) {
				{
				{
				this.state = 112;
				this.statement();
				}
				}
				this.state = 117;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 118;
			this.match(LPCParser.EOF);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public statement(): StatementContext {
		let _localctx: StatementContext = new StatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 2, LPCParser.RULE_statement);
		try {
			this.state = 140;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 1, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 120;
				this.functionDef();
				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 121;
				this.variableDecl();
				this.state = 122;
				this.match(LPCParser.SEMI);
				}
				break;

			case 3:
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 124;
				this.macroInvoke();
				}
				break;

			case 4:
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 125;
				this.ifStatement();
				}
				break;

			case 5:
				this.enterOuterAlt(_localctx, 5);
				{
				this.state = 126;
				this.whileStatement();
				}
				break;

			case 6:
				this.enterOuterAlt(_localctx, 6);
				{
				this.state = 127;
				this.forStatement();
				}
				break;

			case 7:
				this.enterOuterAlt(_localctx, 7);
				{
				this.state = 128;
				this.doWhileStatement();
				}
				break;

			case 8:
				this.enterOuterAlt(_localctx, 8);
				{
				this.state = 129;
				this.foreachStatement();
				}
				break;

			case 9:
				this.enterOuterAlt(_localctx, 9);
				{
				this.state = 130;
				this.switchStatement();
				}
				break;

			case 10:
				this.enterOuterAlt(_localctx, 10);
				{
				this.state = 131;
				this.breakStatement();
				}
				break;

			case 11:
				this.enterOuterAlt(_localctx, 11);
				{
				this.state = 132;
				this.continueStatement();
				}
				break;

			case 12:
				this.enterOuterAlt(_localctx, 12);
				{
				this.state = 133;
				this.returnStatement();
				}
				break;

			case 13:
				this.enterOuterAlt(_localctx, 13);
				{
				this.state = 134;
				this.inheritStatement();
				}
				break;

			case 14:
				this.enterOuterAlt(_localctx, 14);
				{
				this.state = 135;
				this.includeStatement();
				}
				break;

			case 15:
				this.enterOuterAlt(_localctx, 15);
				{
				this.state = 136;
				this.block();
				}
				break;

			case 16:
				this.enterOuterAlt(_localctx, 16);
				{
				this.state = 137;
				this.exprStatement();
				}
				break;

			case 17:
				this.enterOuterAlt(_localctx, 17);
				{
				this.state = 138;
				this.prototypeStatement();
				}
				break;

			case 18:
				this.enterOuterAlt(_localctx, 18);
				{
				this.state = 139;
				this.match(LPCParser.SEMI);
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public functionDef(): FunctionDefContext {
		let _localctx: FunctionDefContext = new FunctionDefContext(this._ctx, this.state);
		this.enterRule(_localctx, 4, LPCParser.RULE_functionDef);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 145;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.MODIFIER) {
				{
				{
				this.state = 142;
				this.match(LPCParser.MODIFIER);
				}
				}
				this.state = 147;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 149;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 3, this._ctx) ) {
			case 1:
				{
				this.state = 148;
				this.typeSpec();
				}
				break;
			}
			this.state = 154;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.STAR) {
				{
				{
				this.state = 151;
				this.match(LPCParser.STAR);
				}
				}
				this.state = 156;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 157;
			this.match(LPCParser.Identifier);
			this.state = 158;
			this.match(LPCParser.LPAREN);
			this.state = 160;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & ((1 << (LPCParser.KW_INT - 28)) | (1 << (LPCParser.KW_FLOAT - 28)) | (1 << (LPCParser.KW_STRING - 28)) | (1 << (LPCParser.KW_OBJECT - 28)) | (1 << (LPCParser.KW_MIXED - 28)) | (1 << (LPCParser.KW_MAPPING - 28)) | (1 << (LPCParser.KW_FUNCTION - 28)) | (1 << (LPCParser.KW_BUFFER - 28)) | (1 << (LPCParser.KW_VOID - 28)) | (1 << (LPCParser.KW_STRUCT - 28)) | (1 << (LPCParser.STAR - 28)))) !== 0) || _la === LPCParser.Identifier) {
				{
				this.state = 159;
				this.parameterList();
				}
			}

			this.state = 162;
			this.match(LPCParser.RPAREN);
			this.state = 163;
			this.block();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public variableDecl(): VariableDeclContext {
		let _localctx: VariableDeclContext = new VariableDeclContext(this._ctx, this.state);
		this.enterRule(_localctx, 6, LPCParser.RULE_variableDecl);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 168;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.MODIFIER) {
				{
				{
				this.state = 165;
				this.match(LPCParser.MODIFIER);
				}
				}
				this.state = 170;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 171;
			this.typeSpec();
			this.state = 172;
			this.variableDeclarator();
			this.state = 177;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.COMMA) {
				{
				{
				this.state = 173;
				this.match(LPCParser.COMMA);
				this.state = 174;
				this.variableDeclarator();
				}
				}
				this.state = 179;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public variableDeclarator(): VariableDeclaratorContext {
		let _localctx: VariableDeclaratorContext = new VariableDeclaratorContext(this._ctx, this.state);
		this.enterRule(_localctx, 8, LPCParser.RULE_variableDeclarator);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 183;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.STAR) {
				{
				{
				this.state = 180;
				this.match(LPCParser.STAR);
				}
				}
				this.state = 185;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 186;
			this.match(LPCParser.Identifier);
			this.state = 189;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === LPCParser.ASSIGN) {
				{
				this.state = 187;
				this.match(LPCParser.ASSIGN);
				this.state = 188;
				this.expression();
				}
			}

			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public parameterList(): ParameterListContext {
		let _localctx: ParameterListContext = new ParameterListContext(this._ctx, this.state);
		this.enterRule(_localctx, 10, LPCParser.RULE_parameterList);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 191;
			this.parameter();
			this.state = 196;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.COMMA) {
				{
				{
				this.state = 192;
				this.match(LPCParser.COMMA);
				this.state = 193;
				this.parameter();
				}
				}
				this.state = 198;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public parameter(): ParameterContext {
		let _localctx: ParameterContext = new ParameterContext(this._ctx, this.state);
		this.enterRule(_localctx, 12, LPCParser.RULE_parameter);
		let _la: number;
		try {
			this.state = 233;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 18, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 199;
				this.typeSpec();
				this.state = 201;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.REF) {
					{
					this.state = 200;
					this.match(LPCParser.REF);
					}
				}

				this.state = 206;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === LPCParser.STAR) {
					{
					{
					this.state = 203;
					this.match(LPCParser.STAR);
					}
					}
					this.state = 208;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 209;
				this.match(LPCParser.Identifier);
				this.state = 211;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.ELLIPSIS) {
					{
					this.state = 210;
					this.match(LPCParser.ELLIPSIS);
					}
				}

				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 213;
				this.typeSpec();
				this.state = 215;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.REF) {
					{
					this.state = 214;
					this.match(LPCParser.REF);
					}
				}

				this.state = 220;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === LPCParser.STAR) {
					{
					{
					this.state = 217;
					this.match(LPCParser.STAR);
					}
					}
					this.state = 222;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
				break;

			case 3:
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 226;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === LPCParser.STAR) {
					{
					{
					this.state = 223;
					this.match(LPCParser.STAR);
					}
					}
					this.state = 228;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 229;
				this.match(LPCParser.Identifier);
				this.state = 231;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.ELLIPSIS) {
					{
					this.state = 230;
					this.match(LPCParser.ELLIPSIS);
					}
				}

				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public typeSpec(): TypeSpecContext {
		let _localctx: TypeSpecContext = new TypeSpecContext(this._ctx, this.state);
		this.enterRule(_localctx, 14, LPCParser.RULE_typeSpec);
		try {
			let _alt: number;
			this.state = 252;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case LPCParser.KW_INT:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 235;
				this.match(LPCParser.KW_INT);
				}
				break;
			case LPCParser.KW_FLOAT:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 236;
				this.match(LPCParser.KW_FLOAT);
				}
				break;
			case LPCParser.KW_STRING:
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 237;
				this.match(LPCParser.KW_STRING);
				}
				break;
			case LPCParser.KW_OBJECT:
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 238;
				this.match(LPCParser.KW_OBJECT);
				}
				break;
			case LPCParser.KW_MIXED:
				this.enterOuterAlt(_localctx, 5);
				{
				this.state = 239;
				this.match(LPCParser.KW_MIXED);
				}
				break;
			case LPCParser.KW_MAPPING:
				this.enterOuterAlt(_localctx, 6);
				{
				this.state = 240;
				this.match(LPCParser.KW_MAPPING);
				}
				break;
			case LPCParser.KW_FUNCTION:
				this.enterOuterAlt(_localctx, 7);
				{
				this.state = 241;
				this.match(LPCParser.KW_FUNCTION);
				}
				break;
			case LPCParser.KW_BUFFER:
				this.enterOuterAlt(_localctx, 8);
				{
				this.state = 242;
				this.match(LPCParser.KW_BUFFER);
				}
				break;
			case LPCParser.KW_VOID:
				this.enterOuterAlt(_localctx, 9);
				{
				this.state = 243;
				this.match(LPCParser.KW_VOID);
				}
				break;
			case LPCParser.KW_STRUCT:
				this.enterOuterAlt(_localctx, 10);
				{
				this.state = 244;
				this.match(LPCParser.KW_STRUCT);
				}
				break;
			case LPCParser.Identifier:
				this.enterOuterAlt(_localctx, 11);
				{
				this.state = 245;
				this.match(LPCParser.Identifier);
				this.state = 249;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 19, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 246;
						this.match(LPCParser.STAR);
						}
						}
					}
					this.state = 251;
					this._errHandler.sync(this);
					_alt = this.interpreter.adaptivePredict(this._input, 19, this._ctx);
				}
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public block(): BlockContext {
		let _localctx: BlockContext = new BlockContext(this._ctx, this.state);
		this.enterRule(_localctx, 16, LPCParser.RULE_block);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 254;
			this.match(LPCParser.LBRACE);
			this.state = 258;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.IF) | (1 << LPCParser.FOR) | (1 << LPCParser.WHILE) | (1 << LPCParser.DO) | (1 << LPCParser.SWITCH) | (1 << LPCParser.BREAK) | (1 << LPCParser.CONTINUE) | (1 << LPCParser.RETURN) | (1 << LPCParser.FOREACH) | (1 << LPCParser.INHERIT) | (1 << LPCParser.INCLUDE) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF) | (1 << LPCParser.KW_INT) | (1 << LPCParser.KW_FLOAT) | (1 << LPCParser.KW_STRING) | (1 << LPCParser.KW_OBJECT))) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & ((1 << (LPCParser.KW_MIXED - 32)) | (1 << (LPCParser.KW_MAPPING - 32)) | (1 << (LPCParser.KW_FUNCTION - 32)) | (1 << (LPCParser.KW_BUFFER - 32)) | (1 << (LPCParser.KW_VOID - 32)) | (1 << (LPCParser.KW_STRUCT - 32)) | (1 << (LPCParser.INC - 32)) | (1 << (LPCParser.DEC - 32)) | (1 << (LPCParser.PLUS - 32)) | (1 << (LPCParser.MINUS - 32)) | (1 << (LPCParser.STAR - 32)) | (1 << (LPCParser.SCOPE - 32)) | (1 << (LPCParser.SEMI - 32)) | (1 << (LPCParser.LPAREN - 32)) | (1 << (LPCParser.LBRACE - 32)))) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & ((1 << (LPCParser.NOT - 72)) | (1 << (LPCParser.BIT_NOT - 72)) | (1 << (LPCParser.MODIFIER - 72)) | (1 << (LPCParser.Identifier - 72)))) !== 0)) {
				{
				{
				this.state = 255;
				this.statement();
				}
				}
				this.state = 260;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 261;
			this.match(LPCParser.RBRACE);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public exprStatement(): ExprStatementContext {
		let _localctx: ExprStatementContext = new ExprStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 18, LPCParser.RULE_exprStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 263;
			this.expression();
			this.state = 264;
			this.match(LPCParser.SEMI);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public expression(): ExpressionContext {
		let _localctx: ExpressionContext = new ExpressionContext(this._ctx, this.state);
		this.enterRule(_localctx, 20, LPCParser.RULE_expression);
		try {
			let _alt: number;
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 266;
			this.assignmentExpression();
			this.state = 271;
			this._errHandler.sync(this);
			_alt = this.interpreter.adaptivePredict(this._input, 22, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 267;
					this.match(LPCParser.COMMA);
					this.state = 268;
					this.assignmentExpression();
					}
					}
				}
				this.state = 273;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 22, this._ctx);
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public assignmentExpression(): AssignmentExpressionContext {
		let _localctx: AssignmentExpressionContext = new AssignmentExpressionContext(this._ctx, this.state);
		this.enterRule(_localctx, 22, LPCParser.RULE_assignmentExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 274;
			this.conditionalExpression();
			this.state = 277;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 44)) & ~0x1F) === 0 && ((1 << (_la - 44)) & ((1 << (LPCParser.PLUS_ASSIGN - 44)) | (1 << (LPCParser.MINUS_ASSIGN - 44)) | (1 << (LPCParser.STAR_ASSIGN - 44)) | (1 << (LPCParser.DIV_ASSIGN - 44)) | (1 << (LPCParser.PERCENT_ASSIGN - 44)) | (1 << (LPCParser.ASSIGN - 44)))) !== 0) || _la === LPCParser.BIT_OR_ASSIGN || _la === LPCParser.BIT_AND_ASSIGN) {
				{
				this.state = 275;
				_la = this._input.LA(1);
				if (!(((((_la - 44)) & ~0x1F) === 0 && ((1 << (_la - 44)) & ((1 << (LPCParser.PLUS_ASSIGN - 44)) | (1 << (LPCParser.MINUS_ASSIGN - 44)) | (1 << (LPCParser.STAR_ASSIGN - 44)) | (1 << (LPCParser.DIV_ASSIGN - 44)) | (1 << (LPCParser.PERCENT_ASSIGN - 44)) | (1 << (LPCParser.ASSIGN - 44)))) !== 0) || _la === LPCParser.BIT_OR_ASSIGN || _la === LPCParser.BIT_AND_ASSIGN)) {
				this._errHandler.recoverInline(this);
				} else {
					if (this._input.LA(1) === Token.EOF) {
						this.matchedEOF = true;
					}

					this._errHandler.reportMatch(this);
					this.consume();
				}
				this.state = 276;
				this.expression();
				}
			}

			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public conditionalExpression(): ConditionalExpressionContext {
		let _localctx: ConditionalExpressionContext = new ConditionalExpressionContext(this._ctx, this.state);
		this.enterRule(_localctx, 24, LPCParser.RULE_conditionalExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 279;
			this.logicalOrExpression();
			this.state = 285;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === LPCParser.QUESTION) {
				{
				this.state = 280;
				this.match(LPCParser.QUESTION);
				this.state = 281;
				this.expression();
				this.state = 282;
				this.match(LPCParser.COLON);
				this.state = 283;
				this.conditionalExpression();
				}
			}

			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public logicalOrExpression(): LogicalOrExpressionContext {
		let _localctx: LogicalOrExpressionContext = new LogicalOrExpressionContext(this._ctx, this.state);
		this.enterRule(_localctx, 26, LPCParser.RULE_logicalOrExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 287;
			this.logicalAndExpression();
			this.state = 292;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.OR) {
				{
				{
				this.state = 288;
				this.match(LPCParser.OR);
				this.state = 289;
				this.logicalAndExpression();
				}
				}
				this.state = 294;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public logicalAndExpression(): LogicalAndExpressionContext {
		let _localctx: LogicalAndExpressionContext = new LogicalAndExpressionContext(this._ctx, this.state);
		this.enterRule(_localctx, 28, LPCParser.RULE_logicalAndExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 295;
			this.bitwiseOrExpression();
			this.state = 300;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.AND) {
				{
				{
				this.state = 296;
				this.match(LPCParser.AND);
				this.state = 297;
				this.bitwiseOrExpression();
				}
				}
				this.state = 302;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public bitwiseOrExpression(): BitwiseOrExpressionContext {
		let _localctx: BitwiseOrExpressionContext = new BitwiseOrExpressionContext(this._ctx, this.state);
		this.enterRule(_localctx, 30, LPCParser.RULE_bitwiseOrExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 303;
			this.bitwiseXorExpression();
			this.state = 308;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.BIT_OR) {
				{
				{
				this.state = 304;
				this.match(LPCParser.BIT_OR);
				this.state = 305;
				this.bitwiseXorExpression();
				}
				}
				this.state = 310;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public bitwiseXorExpression(): BitwiseXorExpressionContext {
		let _localctx: BitwiseXorExpressionContext = new BitwiseXorExpressionContext(this._ctx, this.state);
		this.enterRule(_localctx, 32, LPCParser.RULE_bitwiseXorExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 311;
			this.bitwiseAndExpression();
			this.state = 316;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.BIT_XOR) {
				{
				{
				this.state = 312;
				this.match(LPCParser.BIT_XOR);
				this.state = 313;
				this.bitwiseAndExpression();
				}
				}
				this.state = 318;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public bitwiseAndExpression(): BitwiseAndExpressionContext {
		let _localctx: BitwiseAndExpressionContext = new BitwiseAndExpressionContext(this._ctx, this.state);
		this.enterRule(_localctx, 34, LPCParser.RULE_bitwiseAndExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 319;
			this.equalityExpression();
			this.state = 324;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.BIT_AND) {
				{
				{
				this.state = 320;
				this.match(LPCParser.BIT_AND);
				this.state = 321;
				this.equalityExpression();
				}
				}
				this.state = 326;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public equalityExpression(): EqualityExpressionContext {
		let _localctx: EqualityExpressionContext = new EqualityExpressionContext(this._ctx, this.state);
		this.enterRule(_localctx, 36, LPCParser.RULE_equalityExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 327;
			this.relationalExpression();
			this.state = 332;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.EQ || _la === LPCParser.NE) {
				{
				{
				this.state = 328;
				_la = this._input.LA(1);
				if (!(_la === LPCParser.EQ || _la === LPCParser.NE)) {
				this._errHandler.recoverInline(this);
				} else {
					if (this._input.LA(1) === Token.EOF) {
						this.matchedEOF = true;
					}

					this._errHandler.reportMatch(this);
					this.consume();
				}
				this.state = 329;
				this.relationalExpression();
				}
				}
				this.state = 334;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public relationalExpression(): RelationalExpressionContext {
		let _localctx: RelationalExpressionContext = new RelationalExpressionContext(this._ctx, this.state);
		this.enterRule(_localctx, 38, LPCParser.RULE_relationalExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 335;
			this.shiftExpression();
			this.state = 340;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 65)) & ~0x1F) === 0 && ((1 << (_la - 65)) & ((1 << (LPCParser.GT - 65)) | (1 << (LPCParser.LT - 65)) | (1 << (LPCParser.GE - 65)) | (1 << (LPCParser.LE - 65)))) !== 0)) {
				{
				{
				this.state = 336;
				_la = this._input.LA(1);
				if (!(((((_la - 65)) & ~0x1F) === 0 && ((1 << (_la - 65)) & ((1 << (LPCParser.GT - 65)) | (1 << (LPCParser.LT - 65)) | (1 << (LPCParser.GE - 65)) | (1 << (LPCParser.LE - 65)))) !== 0))) {
				this._errHandler.recoverInline(this);
				} else {
					if (this._input.LA(1) === Token.EOF) {
						this.matchedEOF = true;
					}

					this._errHandler.reportMatch(this);
					this.consume();
				}
				this.state = 337;
				this.shiftExpression();
				}
				}
				this.state = 342;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public shiftExpression(): ShiftExpressionContext {
		let _localctx: ShiftExpressionContext = new ShiftExpressionContext(this._ctx, this.state);
		this.enterRule(_localctx, 40, LPCParser.RULE_shiftExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 343;
			this.additiveExpression();
			this.state = 348;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.SHIFT_LEFT || _la === LPCParser.SHIFT_RIGHT) {
				{
				{
				this.state = 344;
				_la = this._input.LA(1);
				if (!(_la === LPCParser.SHIFT_LEFT || _la === LPCParser.SHIFT_RIGHT)) {
				this._errHandler.recoverInline(this);
				} else {
					if (this._input.LA(1) === Token.EOF) {
						this.matchedEOF = true;
					}

					this._errHandler.reportMatch(this);
					this.consume();
				}
				this.state = 345;
				this.additiveExpression();
				}
				}
				this.state = 350;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public additiveExpression(): AdditiveExpressionContext {
		let _localctx: AdditiveExpressionContext = new AdditiveExpressionContext(this._ctx, this.state);
		this.enterRule(_localctx, 42, LPCParser.RULE_additiveExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 351;
			this.multiplicativeExpression();
			this.state = 356;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.PLUS || _la === LPCParser.MINUS) {
				{
				{
				this.state = 352;
				_la = this._input.LA(1);
				if (!(_la === LPCParser.PLUS || _la === LPCParser.MINUS)) {
				this._errHandler.recoverInline(this);
				} else {
					if (this._input.LA(1) === Token.EOF) {
						this.matchedEOF = true;
					}

					this._errHandler.reportMatch(this);
					this.consume();
				}
				this.state = 353;
				this.multiplicativeExpression();
				}
				}
				this.state = 358;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public multiplicativeExpression(): MultiplicativeExpressionContext {
		let _localctx: MultiplicativeExpressionContext = new MultiplicativeExpressionContext(this._ctx, this.state);
		this.enterRule(_localctx, 44, LPCParser.RULE_multiplicativeExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 359;
			this.unaryExpression();
			this.state = 364;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 51)) & ~0x1F) === 0 && ((1 << (_la - 51)) & ((1 << (LPCParser.STAR - 51)) | (1 << (LPCParser.DIV - 51)) | (1 << (LPCParser.PERCENT - 51)))) !== 0)) {
				{
				{
				this.state = 360;
				_la = this._input.LA(1);
				if (!(((((_la - 51)) & ~0x1F) === 0 && ((1 << (_la - 51)) & ((1 << (LPCParser.STAR - 51)) | (1 << (LPCParser.DIV - 51)) | (1 << (LPCParser.PERCENT - 51)))) !== 0))) {
				this._errHandler.recoverInline(this);
				} else {
					if (this._input.LA(1) === Token.EOF) {
						this.matchedEOF = true;
					}

					this._errHandler.reportMatch(this);
					this.consume();
				}
				this.state = 361;
				this.unaryExpression();
				}
				}
				this.state = 366;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public unaryExpression(): UnaryExpressionContext {
		let _localctx: UnaryExpressionContext = new UnaryExpressionContext(this._ctx, this.state);
		this.enterRule(_localctx, 46, LPCParser.RULE_unaryExpression);
		let _la: number;
		try {
			this.state = 381;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 36, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 368;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.INC || _la === LPCParser.DEC) {
					{
					this.state = 367;
					_la = this._input.LA(1);
					if (!(_la === LPCParser.INC || _la === LPCParser.DEC)) {
					this._errHandler.recoverInline(this);
					} else {
						if (this._input.LA(1) === Token.EOF) {
							this.matchedEOF = true;
						}

						this._errHandler.reportMatch(this);
						this.consume();
					}
					}
				}

				this.state = 370;
				this.postfixExpression();
				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 371;
				_la = this._input.LA(1);
				if (!(((((_la - 49)) & ~0x1F) === 0 && ((1 << (_la - 49)) & ((1 << (LPCParser.PLUS - 49)) | (1 << (LPCParser.MINUS - 49)) | (1 << (LPCParser.STAR - 49)) | (1 << (LPCParser.NOT - 49)) | (1 << (LPCParser.BIT_NOT - 49)))) !== 0))) {
				this._errHandler.recoverInline(this);
				} else {
					if (this._input.LA(1) === Token.EOF) {
						this.matchedEOF = true;
					}

					this._errHandler.reportMatch(this);
					this.consume();
				}
				this.state = 372;
				this.unaryExpression();
				}
				break;

			case 3:
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 373;
				this.match(LPCParser.CATCH);
				this.state = 374;
				this.match(LPCParser.LPAREN);
				this.state = 375;
				this.expression();
				this.state = 376;
				this.match(LPCParser.RPAREN);
				}
				break;

			case 4:
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 378;
				this.match(LPCParser.CATCH);
				this.state = 379;
				this.block();
				}
				break;

			case 5:
				this.enterOuterAlt(_localctx, 5);
				{
				this.state = 380;
				this.castExpression();
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public castExpression(): CastExpressionContext {
		let _localctx: CastExpressionContext = new CastExpressionContext(this._ctx, this.state);
		this.enterRule(_localctx, 48, LPCParser.RULE_castExpression);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 383;
			this.match(LPCParser.LPAREN);
			this.state = 384;
			this.castType();
			this.state = 385;
			this.match(LPCParser.RPAREN);
			this.state = 386;
			this.unaryExpression();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public castType(): CastTypeContext {
		let _localctx: CastTypeContext = new CastTypeContext(this._ctx, this.state);
		this.enterRule(_localctx, 50, LPCParser.RULE_castType);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 388;
			_la = this._input.LA(1);
			if (!(((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & ((1 << (LPCParser.KW_INT - 28)) | (1 << (LPCParser.KW_FLOAT - 28)) | (1 << (LPCParser.KW_STRING - 28)) | (1 << (LPCParser.KW_OBJECT - 28)) | (1 << (LPCParser.KW_MIXED - 28)) | (1 << (LPCParser.KW_MAPPING - 28)) | (1 << (LPCParser.KW_FUNCTION - 28)) | (1 << (LPCParser.KW_BUFFER - 28)) | (1 << (LPCParser.KW_VOID - 28)) | (1 << (LPCParser.KW_STRUCT - 28)))) !== 0))) {
			this._errHandler.recoverInline(this);
			} else {
				if (this._input.LA(1) === Token.EOF) {
					this.matchedEOF = true;
				}

				this._errHandler.reportMatch(this);
				this.consume();
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public postfixExpression(): PostfixExpressionContext {
		let _localctx: PostfixExpressionContext = new PostfixExpressionContext(this._ctx, this.state);
		this.enterRule(_localctx, 52, LPCParser.RULE_postfixExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 390;
			this.primary();
			this.state = 413;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 40)) & ~0x1F) === 0 && ((1 << (_la - 40)) & ((1 << (LPCParser.ARROW - 40)) | (1 << (LPCParser.DOT - 40)) | (1 << (LPCParser.INC - 40)) | (1 << (LPCParser.DEC - 40)) | (1 << (LPCParser.SCOPE - 40)) | (1 << (LPCParser.LPAREN - 40)) | (1 << (LPCParser.LBRACK - 40)))) !== 0)) {
				{
				this.state = 411;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case LPCParser.ARROW:
				case LPCParser.DOT:
				case LPCParser.SCOPE:
					{
					{
					this.state = 391;
					_la = this._input.LA(1);
					if (!(((((_la - 40)) & ~0x1F) === 0 && ((1 << (_la - 40)) & ((1 << (LPCParser.ARROW - 40)) | (1 << (LPCParser.DOT - 40)) | (1 << (LPCParser.SCOPE - 40)))) !== 0))) {
					this._errHandler.recoverInline(this);
					} else {
						if (this._input.LA(1) === Token.EOF) {
							this.matchedEOF = true;
						}

						this._errHandler.reportMatch(this);
						this.consume();
					}
					this.state = 392;
					this.match(LPCParser.Identifier);
					this.state = 398;
					this._errHandler.sync(this);
					switch ( this.interpreter.adaptivePredict(this._input, 38, this._ctx) ) {
					case 1:
						{
						this.state = 393;
						this.match(LPCParser.LPAREN);
						this.state = 395;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & ((1 << (LPCParser.KW_FUNCTION - 34)) | (1 << (LPCParser.INC - 34)) | (1 << (LPCParser.DEC - 34)) | (1 << (LPCParser.PLUS - 34)) | (1 << (LPCParser.MINUS - 34)) | (1 << (LPCParser.STAR - 34)) | (1 << (LPCParser.SCOPE - 34)) | (1 << (LPCParser.LPAREN - 34)))) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & ((1 << (LPCParser.NOT - 72)) | (1 << (LPCParser.BIT_NOT - 72)) | (1 << (LPCParser.Identifier - 72)))) !== 0)) {
							{
							this.state = 394;
							this.argumentList();
							}
						}

						this.state = 397;
						this.match(LPCParser.RPAREN);
						}
						break;
					}
					}
					}
					break;
				case LPCParser.LPAREN:
					{
					{
					this.state = 400;
					this.match(LPCParser.LPAREN);
					this.state = 402;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & ((1 << (LPCParser.KW_FUNCTION - 34)) | (1 << (LPCParser.INC - 34)) | (1 << (LPCParser.DEC - 34)) | (1 << (LPCParser.PLUS - 34)) | (1 << (LPCParser.MINUS - 34)) | (1 << (LPCParser.STAR - 34)) | (1 << (LPCParser.SCOPE - 34)) | (1 << (LPCParser.LPAREN - 34)))) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & ((1 << (LPCParser.NOT - 72)) | (1 << (LPCParser.BIT_NOT - 72)) | (1 << (LPCParser.Identifier - 72)))) !== 0)) {
						{
						this.state = 401;
						this.argumentList();
						}
					}

					this.state = 404;
					this.match(LPCParser.RPAREN);
					}
					}
					break;
				case LPCParser.LBRACK:
					{
					this.state = 405;
					this.match(LPCParser.LBRACK);
					this.state = 406;
					this.sliceExpr();
					this.state = 407;
					this.match(LPCParser.RBRACK);
					}
					break;
				case LPCParser.INC:
					{
					this.state = 409;
					this.match(LPCParser.INC);
					}
					break;
				case LPCParser.DEC:
					{
					this.state = 410;
					this.match(LPCParser.DEC);
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 415;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public argumentList(): ArgumentListContext {
		let _localctx: ArgumentListContext = new ArgumentListContext(this._ctx, this.state);
		this.enterRule(_localctx, 54, LPCParser.RULE_argumentList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 416;
			this.assignmentExpression();
			this.state = 418;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === LPCParser.ELLIPSIS) {
				{
				this.state = 417;
				this.match(LPCParser.ELLIPSIS);
				}
			}

			this.state = 427;
			this._errHandler.sync(this);
			_alt = this.interpreter.adaptivePredict(this._input, 44, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 420;
					this.match(LPCParser.COMMA);
					this.state = 421;
					this.assignmentExpression();
					this.state = 423;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la === LPCParser.ELLIPSIS) {
						{
						this.state = 422;
						this.match(LPCParser.ELLIPSIS);
						}
					}

					}
					}
				}
				this.state = 429;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 44, this._ctx);
			}
			this.state = 431;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === LPCParser.COMMA) {
				{
				this.state = 430;
				this.match(LPCParser.COMMA);
				}
			}

			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public primary(): PrimaryContext {
		let _localctx: PrimaryContext = new PrimaryContext(this._ctx, this.state);
		this.enterRule(_localctx, 56, LPCParser.RULE_primary);
		let _la: number;
		try {
			this.state = 463;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 48, this._ctx) ) {
			case 1:
				_localctx = new ScopeIdentifierContext(_localctx);
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 433;
				this.match(LPCParser.SCOPE);
				this.state = 434;
				this.match(LPCParser.Identifier);
				}
				break;

			case 2:
				_localctx = new StringConcatenationContext(_localctx);
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 435;
				this.stringConcat();
				}
				break;

			case 3:
				_localctx = new ClosurePrimaryContext(_localctx);
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 436;
				this.closureExpr();
				}
				break;

			case 4:
				_localctx = new MappingLiteralExprContext(_localctx);
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 437;
				this.mappingLiteral();
				}
				break;

			case 5:
				_localctx = new AnonFunctionContext(_localctx);
				this.enterOuterAlt(_localctx, 5);
				{
				this.state = 438;
				this.match(LPCParser.KW_FUNCTION);
				this.state = 439;
				this.match(LPCParser.LPAREN);
				this.state = 441;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & ((1 << (LPCParser.KW_INT - 28)) | (1 << (LPCParser.KW_FLOAT - 28)) | (1 << (LPCParser.KW_STRING - 28)) | (1 << (LPCParser.KW_OBJECT - 28)) | (1 << (LPCParser.KW_MIXED - 28)) | (1 << (LPCParser.KW_MAPPING - 28)) | (1 << (LPCParser.KW_FUNCTION - 28)) | (1 << (LPCParser.KW_BUFFER - 28)) | (1 << (LPCParser.KW_VOID - 28)) | (1 << (LPCParser.KW_STRUCT - 28)) | (1 << (LPCParser.STAR - 28)))) !== 0) || _la === LPCParser.Identifier) {
					{
					this.state = 440;
					this.parameterList();
					}
				}

				this.state = 443;
				this.match(LPCParser.RPAREN);
				this.state = 444;
				this.block();
				}
				break;

			case 6:
				_localctx = new IdentifierPrimaryContext(_localctx);
				this.enterOuterAlt(_localctx, 6);
				{
				this.state = 445;
				this.match(LPCParser.Identifier);
				}
				break;

			case 7:
				_localctx = new IntegerPrimaryContext(_localctx);
				this.enterOuterAlt(_localctx, 7);
				{
				this.state = 446;
				this.match(LPCParser.INTEGER);
				}
				break;

			case 8:
				_localctx = new FloatPrimaryContext(_localctx);
				this.enterOuterAlt(_localctx, 8);
				{
				this.state = 447;
				this.match(LPCParser.FLOAT);
				}
				break;

			case 9:
				_localctx = new StringPrimaryContext(_localctx);
				this.enterOuterAlt(_localctx, 9);
				{
				this.state = 448;
				this.match(LPCParser.STRING_LITERAL);
				}
				break;

			case 10:
				_localctx = new CharPrimaryContext(_localctx);
				this.enterOuterAlt(_localctx, 10);
				{
				this.state = 449;
				this.match(LPCParser.CHAR_LITERAL);
				}
				break;

			case 11:
				_localctx = new ArrayLiteralContext(_localctx);
				this.enterOuterAlt(_localctx, 11);
				{
				this.state = 450;
				this.match(LPCParser.LPAREN);
				this.state = 451;
				this.match(LPCParser.LBRACE);
				this.state = 453;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & ((1 << (LPCParser.KW_FUNCTION - 34)) | (1 << (LPCParser.INC - 34)) | (1 << (LPCParser.DEC - 34)) | (1 << (LPCParser.PLUS - 34)) | (1 << (LPCParser.MINUS - 34)) | (1 << (LPCParser.STAR - 34)) | (1 << (LPCParser.SCOPE - 34)) | (1 << (LPCParser.LPAREN - 34)))) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & ((1 << (LPCParser.NOT - 72)) | (1 << (LPCParser.BIT_NOT - 72)) | (1 << (LPCParser.Identifier - 72)))) !== 0)) {
					{
					this.state = 452;
					this.expressionList();
					}
				}

				this.state = 455;
				this.match(LPCParser.RBRACE);
				this.state = 456;
				this.match(LPCParser.RPAREN);
				}
				break;

			case 12:
				_localctx = new ParenExprContext(_localctx);
				this.enterOuterAlt(_localctx, 12);
				{
				this.state = 457;
				this.match(LPCParser.LPAREN);
				this.state = 458;
				this.expression();
				this.state = 459;
				this.match(LPCParser.RPAREN);
				}
				break;

			case 13:
				_localctx = new RefVariableContext(_localctx);
				this.enterOuterAlt(_localctx, 13);
				{
				this.state = 461;
				this.match(LPCParser.REF);
				this.state = 462;
				this.match(LPCParser.Identifier);
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public stringConcat(): StringConcatContext {
		let _localctx: StringConcatContext = new StringConcatContext(this._ctx, this.state);
		this.enterRule(_localctx, 58, LPCParser.RULE_stringConcat);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 466;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 465;
				this.concatItem();
				}
				}
				this.state = 468;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while (_la === LPCParser.STRING_LITERAL || _la === LPCParser.Identifier);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public concatItem(): ConcatItemContext {
		let _localctx: ConcatItemContext = new ConcatItemContext(this._ctx, this.state);
		this.enterRule(_localctx, 60, LPCParser.RULE_concatItem);
		let _la: number;
		try {
			this.state = 478;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 51, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 470;
				this.match(LPCParser.STRING_LITERAL);
				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 471;
				this.match(LPCParser.Identifier);
				this.state = 472;
				this.match(LPCParser.LPAREN);
				this.state = 474;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & ((1 << (LPCParser.KW_FUNCTION - 34)) | (1 << (LPCParser.INC - 34)) | (1 << (LPCParser.DEC - 34)) | (1 << (LPCParser.PLUS - 34)) | (1 << (LPCParser.MINUS - 34)) | (1 << (LPCParser.STAR - 34)) | (1 << (LPCParser.SCOPE - 34)) | (1 << (LPCParser.LPAREN - 34)))) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & ((1 << (LPCParser.NOT - 72)) | (1 << (LPCParser.BIT_NOT - 72)) | (1 << (LPCParser.Identifier - 72)))) !== 0)) {
					{
					this.state = 473;
					this.argumentList();
					}
				}

				this.state = 476;
				this.match(LPCParser.RPAREN);
				}
				break;

			case 3:
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 477;
				this.match(LPCParser.Identifier);
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public ifStatement(): IfStatementContext {
		let _localctx: IfStatementContext = new IfStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 62, LPCParser.RULE_ifStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 480;
			this.match(LPCParser.IF);
			this.state = 481;
			this.match(LPCParser.LPAREN);
			this.state = 482;
			this.expression();
			this.state = 483;
			this.match(LPCParser.RPAREN);
			this.state = 484;
			this.statement();
			this.state = 487;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 52, this._ctx) ) {
			case 1:
				{
				this.state = 485;
				this.match(LPCParser.ELSE);
				this.state = 486;
				this.statement();
				}
				break;
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public whileStatement(): WhileStatementContext {
		let _localctx: WhileStatementContext = new WhileStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 64, LPCParser.RULE_whileStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 489;
			this.match(LPCParser.WHILE);
			this.state = 490;
			this.match(LPCParser.LPAREN);
			this.state = 491;
			this.expression();
			this.state = 492;
			this.match(LPCParser.RPAREN);
			this.state = 493;
			this.statement();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public doWhileStatement(): DoWhileStatementContext {
		let _localctx: DoWhileStatementContext = new DoWhileStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 66, LPCParser.RULE_doWhileStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 495;
			this.match(LPCParser.DO);
			this.state = 496;
			this.statement();
			this.state = 497;
			this.match(LPCParser.WHILE);
			this.state = 498;
			this.match(LPCParser.LPAREN);
			this.state = 499;
			this.expression();
			this.state = 500;
			this.match(LPCParser.RPAREN);
			this.state = 501;
			this.match(LPCParser.SEMI);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public forStatement(): ForStatementContext {
		let _localctx: ForStatementContext = new ForStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 68, LPCParser.RULE_forStatement);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 503;
			this.match(LPCParser.FOR);
			this.state = 504;
			this.match(LPCParser.LPAREN);
			this.state = 506;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF) | (1 << LPCParser.KW_INT) | (1 << LPCParser.KW_FLOAT) | (1 << LPCParser.KW_STRING) | (1 << LPCParser.KW_OBJECT))) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & ((1 << (LPCParser.KW_MIXED - 32)) | (1 << (LPCParser.KW_MAPPING - 32)) | (1 << (LPCParser.KW_FUNCTION - 32)) | (1 << (LPCParser.KW_BUFFER - 32)) | (1 << (LPCParser.KW_VOID - 32)) | (1 << (LPCParser.KW_STRUCT - 32)) | (1 << (LPCParser.INC - 32)) | (1 << (LPCParser.DEC - 32)) | (1 << (LPCParser.PLUS - 32)) | (1 << (LPCParser.MINUS - 32)) | (1 << (LPCParser.STAR - 32)) | (1 << (LPCParser.SCOPE - 32)) | (1 << (LPCParser.LPAREN - 32)))) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & ((1 << (LPCParser.NOT - 72)) | (1 << (LPCParser.BIT_NOT - 72)) | (1 << (LPCParser.MODIFIER - 72)) | (1 << (LPCParser.Identifier - 72)))) !== 0)) {
				{
				this.state = 505;
				this.forInit();
				}
			}

			this.state = 508;
			this.match(LPCParser.SEMI);
			this.state = 510;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & ((1 << (LPCParser.KW_FUNCTION - 34)) | (1 << (LPCParser.INC - 34)) | (1 << (LPCParser.DEC - 34)) | (1 << (LPCParser.PLUS - 34)) | (1 << (LPCParser.MINUS - 34)) | (1 << (LPCParser.STAR - 34)) | (1 << (LPCParser.SCOPE - 34)) | (1 << (LPCParser.LPAREN - 34)))) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & ((1 << (LPCParser.NOT - 72)) | (1 << (LPCParser.BIT_NOT - 72)) | (1 << (LPCParser.Identifier - 72)))) !== 0)) {
				{
				this.state = 509;
				this.expression();
				}
			}

			this.state = 512;
			this.match(LPCParser.SEMI);
			this.state = 514;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & ((1 << (LPCParser.KW_FUNCTION - 34)) | (1 << (LPCParser.INC - 34)) | (1 << (LPCParser.DEC - 34)) | (1 << (LPCParser.PLUS - 34)) | (1 << (LPCParser.MINUS - 34)) | (1 << (LPCParser.STAR - 34)) | (1 << (LPCParser.SCOPE - 34)) | (1 << (LPCParser.LPAREN - 34)))) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & ((1 << (LPCParser.NOT - 72)) | (1 << (LPCParser.BIT_NOT - 72)) | (1 << (LPCParser.Identifier - 72)))) !== 0)) {
				{
				this.state = 513;
				this.expressionList();
				}
			}

			this.state = 516;
			this.match(LPCParser.RPAREN);
			this.state = 517;
			this.statement();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public forInit(): ForInitContext {
		let _localctx: ForInitContext = new ForInitContext(this._ctx, this.state);
		this.enterRule(_localctx, 70, LPCParser.RULE_forInit);
		try {
			this.state = 521;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 56, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 519;
				this.variableDecl();
				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 520;
				this.expressionList();
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public expressionList(): ExpressionListContext {
		let _localctx: ExpressionListContext = new ExpressionListContext(this._ctx, this.state);
		this.enterRule(_localctx, 72, LPCParser.RULE_expressionList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 523;
			this.expression();
			this.state = 528;
			this._errHandler.sync(this);
			_alt = this.interpreter.adaptivePredict(this._input, 57, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 524;
					this.match(LPCParser.COMMA);
					this.state = 525;
					this.expression();
					}
					}
				}
				this.state = 530;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 57, this._ctx);
			}
			this.state = 532;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === LPCParser.COMMA) {
				{
				this.state = 531;
				this.match(LPCParser.COMMA);
				}
			}

			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public foreachStatement(): ForeachStatementContext {
		let _localctx: ForeachStatementContext = new ForeachStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 74, LPCParser.RULE_foreachStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 534;
			this.match(LPCParser.FOREACH);
			this.state = 535;
			this.match(LPCParser.LPAREN);
			this.state = 536;
			this.foreachInit();
			this.state = 537;
			this.match(LPCParser.IN);
			this.state = 538;
			this.expression();
			this.state = 539;
			this.match(LPCParser.RPAREN);
			this.state = 540;
			this.statement();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public foreachInit(): ForeachInitContext {
		let _localctx: ForeachInitContext = new ForeachInitContext(this._ctx, this.state);
		this.enterRule(_localctx, 76, LPCParser.RULE_foreachInit);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 542;
			this.foreachVar();
			this.state = 545;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === LPCParser.COMMA) {
				{
				this.state = 543;
				this.match(LPCParser.COMMA);
				this.state = 544;
				this.foreachVar();
				}
			}

			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public foreachVar(): ForeachVarContext {
		let _localctx: ForeachVarContext = new ForeachVarContext(this._ctx, this.state);
		this.enterRule(_localctx, 78, LPCParser.RULE_foreachVar);
		let _la: number;
		try {
			this.state = 566;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 63, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 547;
				this.typeSpec();
				this.state = 549;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.REF) {
					{
					this.state = 548;
					this.match(LPCParser.REF);
					}
				}

				this.state = 554;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === LPCParser.STAR) {
					{
					{
					this.state = 551;
					this.match(LPCParser.STAR);
					}
					}
					this.state = 556;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 557;
				this.match(LPCParser.Identifier);
				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 562;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === LPCParser.STAR) {
					{
					{
					this.state = 559;
					this.match(LPCParser.STAR);
					}
					}
					this.state = 564;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 565;
				this.match(LPCParser.Identifier);
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public switchStatement(): SwitchStatementContext {
		let _localctx: SwitchStatementContext = new SwitchStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 80, LPCParser.RULE_switchStatement);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 568;
			this.match(LPCParser.SWITCH);
			this.state = 569;
			this.match(LPCParser.LPAREN);
			this.state = 570;
			this.expression();
			this.state = 571;
			this.match(LPCParser.RPAREN);
			this.state = 572;
			this.match(LPCParser.LBRACE);
			this.state = 576;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.CASE || _la === LPCParser.DEFAULT) {
				{
				{
				this.state = 573;
				this.switchSection();
				}
				}
				this.state = 578;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 579;
			this.match(LPCParser.RBRACE);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public switchSection(): SwitchSectionContext {
		let _localctx: SwitchSectionContext = new SwitchSectionContext(this._ctx, this.state);
		this.enterRule(_localctx, 82, LPCParser.RULE_switchSection);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 581;
			this.switchLabelWithColon();
			this.state = 585;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.IF) | (1 << LPCParser.FOR) | (1 << LPCParser.WHILE) | (1 << LPCParser.DO) | (1 << LPCParser.SWITCH) | (1 << LPCParser.BREAK) | (1 << LPCParser.CONTINUE) | (1 << LPCParser.RETURN) | (1 << LPCParser.FOREACH) | (1 << LPCParser.INHERIT) | (1 << LPCParser.INCLUDE) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF) | (1 << LPCParser.KW_INT) | (1 << LPCParser.KW_FLOAT) | (1 << LPCParser.KW_STRING) | (1 << LPCParser.KW_OBJECT))) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & ((1 << (LPCParser.KW_MIXED - 32)) | (1 << (LPCParser.KW_MAPPING - 32)) | (1 << (LPCParser.KW_FUNCTION - 32)) | (1 << (LPCParser.KW_BUFFER - 32)) | (1 << (LPCParser.KW_VOID - 32)) | (1 << (LPCParser.KW_STRUCT - 32)) | (1 << (LPCParser.INC - 32)) | (1 << (LPCParser.DEC - 32)) | (1 << (LPCParser.PLUS - 32)) | (1 << (LPCParser.MINUS - 32)) | (1 << (LPCParser.STAR - 32)) | (1 << (LPCParser.SCOPE - 32)) | (1 << (LPCParser.SEMI - 32)) | (1 << (LPCParser.LPAREN - 32)) | (1 << (LPCParser.LBRACE - 32)))) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & ((1 << (LPCParser.NOT - 72)) | (1 << (LPCParser.BIT_NOT - 72)) | (1 << (LPCParser.MODIFIER - 72)) | (1 << (LPCParser.Identifier - 72)))) !== 0)) {
				{
				{
				this.state = 582;
				this.statement();
				}
				}
				this.state = 587;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 597;
			this._errHandler.sync(this);
			_alt = this.interpreter.adaptivePredict(this._input, 67, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 588;
					this.switchLabelWithColon();
					this.state = 592;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.IF) | (1 << LPCParser.FOR) | (1 << LPCParser.WHILE) | (1 << LPCParser.DO) | (1 << LPCParser.SWITCH) | (1 << LPCParser.BREAK) | (1 << LPCParser.CONTINUE) | (1 << LPCParser.RETURN) | (1 << LPCParser.FOREACH) | (1 << LPCParser.INHERIT) | (1 << LPCParser.INCLUDE) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF) | (1 << LPCParser.KW_INT) | (1 << LPCParser.KW_FLOAT) | (1 << LPCParser.KW_STRING) | (1 << LPCParser.KW_OBJECT))) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & ((1 << (LPCParser.KW_MIXED - 32)) | (1 << (LPCParser.KW_MAPPING - 32)) | (1 << (LPCParser.KW_FUNCTION - 32)) | (1 << (LPCParser.KW_BUFFER - 32)) | (1 << (LPCParser.KW_VOID - 32)) | (1 << (LPCParser.KW_STRUCT - 32)) | (1 << (LPCParser.INC - 32)) | (1 << (LPCParser.DEC - 32)) | (1 << (LPCParser.PLUS - 32)) | (1 << (LPCParser.MINUS - 32)) | (1 << (LPCParser.STAR - 32)) | (1 << (LPCParser.SCOPE - 32)) | (1 << (LPCParser.SEMI - 32)) | (1 << (LPCParser.LPAREN - 32)) | (1 << (LPCParser.LBRACE - 32)))) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & ((1 << (LPCParser.NOT - 72)) | (1 << (LPCParser.BIT_NOT - 72)) | (1 << (LPCParser.MODIFIER - 72)) | (1 << (LPCParser.Identifier - 72)))) !== 0)) {
						{
						{
						this.state = 589;
						this.statement();
						}
						}
						this.state = 594;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					}
					}
				}
				this.state = 599;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 67, this._ctx);
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public switchLabelWithColon(): SwitchLabelWithColonContext {
		let _localctx: SwitchLabelWithColonContext = new SwitchLabelWithColonContext(this._ctx, this.state);
		this.enterRule(_localctx, 84, LPCParser.RULE_switchLabelWithColon);
		try {
			this.state = 606;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case LPCParser.CASE:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 600;
				this.match(LPCParser.CASE);
				this.state = 601;
				this.switchLabel();
				this.state = 602;
				this.match(LPCParser.COLON);
				}
				break;
			case LPCParser.DEFAULT:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 604;
				this.match(LPCParser.DEFAULT);
				this.state = 605;
				this.match(LPCParser.COLON);
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public switchLabel(): SwitchLabelContext {
		let _localctx: SwitchLabelContext = new SwitchLabelContext(this._ctx, this.state);
		this.enterRule(_localctx, 86, LPCParser.RULE_switchLabel);
		let _la: number;
		try {
			this.state = 615;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case LPCParser.INTEGER:
			case LPCParser.FLOAT:
			case LPCParser.CHAR_LITERAL:
			case LPCParser.STRING_LITERAL:
			case LPCParser.CATCH:
			case LPCParser.REF:
			case LPCParser.KW_FUNCTION:
			case LPCParser.INC:
			case LPCParser.DEC:
			case LPCParser.PLUS:
			case LPCParser.MINUS:
			case LPCParser.STAR:
			case LPCParser.SCOPE:
			case LPCParser.LPAREN:
			case LPCParser.NOT:
			case LPCParser.BIT_NOT:
			case LPCParser.Identifier:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 608;
				this.expression();
				this.state = 611;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.RANGE_OP) {
					{
					this.state = 609;
					this.match(LPCParser.RANGE_OP);
					this.state = 610;
					this.expression();
					}
				}

				}
				break;
			case LPCParser.RANGE_OP:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 613;
				this.match(LPCParser.RANGE_OP);
				this.state = 614;
				this.expression();
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public breakStatement(): BreakStatementContext {
		let _localctx: BreakStatementContext = new BreakStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 88, LPCParser.RULE_breakStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 617;
			this.match(LPCParser.BREAK);
			this.state = 618;
			this.match(LPCParser.SEMI);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public continueStatement(): ContinueStatementContext {
		let _localctx: ContinueStatementContext = new ContinueStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 90, LPCParser.RULE_continueStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 620;
			this.match(LPCParser.CONTINUE);
			this.state = 621;
			this.match(LPCParser.SEMI);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public returnStatement(): ReturnStatementContext {
		let _localctx: ReturnStatementContext = new ReturnStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 92, LPCParser.RULE_returnStatement);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 623;
			this.match(LPCParser.RETURN);
			this.state = 625;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & ((1 << (LPCParser.KW_FUNCTION - 34)) | (1 << (LPCParser.INC - 34)) | (1 << (LPCParser.DEC - 34)) | (1 << (LPCParser.PLUS - 34)) | (1 << (LPCParser.MINUS - 34)) | (1 << (LPCParser.STAR - 34)) | (1 << (LPCParser.SCOPE - 34)) | (1 << (LPCParser.LPAREN - 34)))) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & ((1 << (LPCParser.NOT - 72)) | (1 << (LPCParser.BIT_NOT - 72)) | (1 << (LPCParser.Identifier - 72)))) !== 0)) {
				{
				this.state = 624;
				this.expression();
				}
			}

			this.state = 627;
			this.match(LPCParser.SEMI);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public closureExpr(): ClosureExprContext {
		let _localctx: ClosureExprContext = new ClosureExprContext(this._ctx, this.state);
		this.enterRule(_localctx, 94, LPCParser.RULE_closureExpr);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 629;
			this.match(LPCParser.LPAREN);
			this.state = 630;
			this.match(LPCParser.COLON);
			this.state = 632;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & ((1 << (LPCParser.KW_FUNCTION - 34)) | (1 << (LPCParser.INC - 34)) | (1 << (LPCParser.DEC - 34)) | (1 << (LPCParser.PLUS - 34)) | (1 << (LPCParser.MINUS - 34)) | (1 << (LPCParser.STAR - 34)) | (1 << (LPCParser.SCOPE - 34)) | (1 << (LPCParser.LPAREN - 34)))) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & ((1 << (LPCParser.NOT - 72)) | (1 << (LPCParser.BIT_NOT - 72)) | (1 << (LPCParser.Identifier - 72)))) !== 0)) {
				{
				this.state = 631;
				this.expression();
				}
			}

			this.state = 634;
			this.match(LPCParser.COLON);
			this.state = 635;
			this.match(LPCParser.RPAREN);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public inheritStatement(): InheritStatementContext {
		let _localctx: InheritStatementContext = new InheritStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 96, LPCParser.RULE_inheritStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 637;
			this.match(LPCParser.INHERIT);
			this.state = 638;
			this.expression();
			this.state = 639;
			this.match(LPCParser.SEMI);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public includeStatement(): IncludeStatementContext {
		let _localctx: IncludeStatementContext = new IncludeStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 98, LPCParser.RULE_includeStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 641;
			this.match(LPCParser.INCLUDE);
			this.state = 642;
			this.expression();
			this.state = 643;
			this.match(LPCParser.SEMI);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public macroInvoke(): MacroInvokeContext {
		let _localctx: MacroInvokeContext = new MacroInvokeContext(this._ctx, this.state);
		this.enterRule(_localctx, 100, LPCParser.RULE_macroInvoke);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 645;
			this.match(LPCParser.Identifier);
			this.state = 646;
			this.match(LPCParser.LPAREN);
			this.state = 648;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & ((1 << (LPCParser.KW_FUNCTION - 34)) | (1 << (LPCParser.INC - 34)) | (1 << (LPCParser.DEC - 34)) | (1 << (LPCParser.PLUS - 34)) | (1 << (LPCParser.MINUS - 34)) | (1 << (LPCParser.STAR - 34)) | (1 << (LPCParser.SCOPE - 34)) | (1 << (LPCParser.LPAREN - 34)))) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & ((1 << (LPCParser.NOT - 72)) | (1 << (LPCParser.BIT_NOT - 72)) | (1 << (LPCParser.Identifier - 72)))) !== 0)) {
				{
				this.state = 647;
				this.argumentList();
				}
			}

			this.state = 650;
			this.match(LPCParser.RPAREN);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public prototypeStatement(): PrototypeStatementContext {
		let _localctx: PrototypeStatementContext = new PrototypeStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 102, LPCParser.RULE_prototypeStatement);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 655;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.MODIFIER) {
				{
				{
				this.state = 652;
				this.match(LPCParser.MODIFIER);
				}
				}
				this.state = 657;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 659;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 75, this._ctx) ) {
			case 1:
				{
				this.state = 658;
				this.typeSpec();
				}
				break;
			}
			this.state = 664;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.STAR) {
				{
				{
				this.state = 661;
				this.match(LPCParser.STAR);
				}
				}
				this.state = 666;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 667;
			this.match(LPCParser.Identifier);
			this.state = 668;
			this.match(LPCParser.LPAREN);
			this.state = 670;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & ((1 << (LPCParser.KW_INT - 28)) | (1 << (LPCParser.KW_FLOAT - 28)) | (1 << (LPCParser.KW_STRING - 28)) | (1 << (LPCParser.KW_OBJECT - 28)) | (1 << (LPCParser.KW_MIXED - 28)) | (1 << (LPCParser.KW_MAPPING - 28)) | (1 << (LPCParser.KW_FUNCTION - 28)) | (1 << (LPCParser.KW_BUFFER - 28)) | (1 << (LPCParser.KW_VOID - 28)) | (1 << (LPCParser.KW_STRUCT - 28)) | (1 << (LPCParser.STAR - 28)))) !== 0) || _la === LPCParser.Identifier) {
				{
				this.state = 669;
				this.parameterList();
				}
			}

			this.state = 672;
			this.match(LPCParser.RPAREN);
			this.state = 673;
			this.match(LPCParser.SEMI);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public mappingLiteral(): MappingLiteralContext {
		let _localctx: MappingLiteralContext = new MappingLiteralContext(this._ctx, this.state);
		this.enterRule(_localctx, 104, LPCParser.RULE_mappingLiteral);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 675;
			this.match(LPCParser.LPAREN);
			this.state = 676;
			this.match(LPCParser.LBRACK);
			this.state = 678;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & ((1 << (LPCParser.KW_FUNCTION - 34)) | (1 << (LPCParser.INC - 34)) | (1 << (LPCParser.DEC - 34)) | (1 << (LPCParser.PLUS - 34)) | (1 << (LPCParser.MINUS - 34)) | (1 << (LPCParser.STAR - 34)) | (1 << (LPCParser.SCOPE - 34)) | (1 << (LPCParser.LPAREN - 34)))) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & ((1 << (LPCParser.NOT - 72)) | (1 << (LPCParser.BIT_NOT - 72)) | (1 << (LPCParser.Identifier - 72)))) !== 0)) {
				{
				this.state = 677;
				this.mappingPairList();
				}
			}

			this.state = 680;
			this.match(LPCParser.RBRACK);
			this.state = 681;
			this.match(LPCParser.RPAREN);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public mappingPairList(): MappingPairListContext {
		let _localctx: MappingPairListContext = new MappingPairListContext(this._ctx, this.state);
		this.enterRule(_localctx, 106, LPCParser.RULE_mappingPairList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 683;
			this.mappingPair();
			this.state = 688;
			this._errHandler.sync(this);
			_alt = this.interpreter.adaptivePredict(this._input, 79, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 684;
					this.match(LPCParser.COMMA);
					this.state = 685;
					this.mappingPair();
					}
					}
				}
				this.state = 690;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 79, this._ctx);
			}
			this.state = 692;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === LPCParser.COMMA) {
				{
				this.state = 691;
				this.match(LPCParser.COMMA);
				}
			}

			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public mappingPair(): MappingPairContext {
		let _localctx: MappingPairContext = new MappingPairContext(this._ctx, this.state);
		this.enterRule(_localctx, 108, LPCParser.RULE_mappingPair);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 694;
			this.expression();
			this.state = 695;
			this.match(LPCParser.COLON);
			this.state = 696;
			this.expression();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public sliceExpr(): SliceExprContext {
		let _localctx: SliceExprContext = new SliceExprContext(this._ctx, this.state);
		this.enterRule(_localctx, 110, LPCParser.RULE_sliceExpr);
		let _la: number;
		try {
			this.state = 725;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 87, this._ctx) ) {
			case 1:
				_localctx = new TailIndexOnlyContext(_localctx);
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 698;
				this.match(LPCParser.LT);
				this.state = 699;
				this.expression();
				}
				break;

			case 2:
				_localctx = new HeadRangeContext(_localctx);
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 700;
				this.expression();
				this.state = 701;
				this.match(LPCParser.RANGE_OP);
				this.state = 703;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.LT) {
					{
					this.state = 702;
					this.match(LPCParser.LT);
					}
				}

				this.state = 706;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & ((1 << (LPCParser.KW_FUNCTION - 34)) | (1 << (LPCParser.INC - 34)) | (1 << (LPCParser.DEC - 34)) | (1 << (LPCParser.PLUS - 34)) | (1 << (LPCParser.MINUS - 34)) | (1 << (LPCParser.STAR - 34)) | (1 << (LPCParser.SCOPE - 34)) | (1 << (LPCParser.LPAREN - 34)))) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & ((1 << (LPCParser.NOT - 72)) | (1 << (LPCParser.BIT_NOT - 72)) | (1 << (LPCParser.Identifier - 72)))) !== 0)) {
					{
					this.state = 705;
					this.expression();
					}
				}

				}
				break;

			case 3:
				_localctx = new OpenRangeContext(_localctx);
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 708;
				this.match(LPCParser.RANGE_OP);
				this.state = 710;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.LT) {
					{
					this.state = 709;
					this.match(LPCParser.LT);
					}
				}

				this.state = 713;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & ((1 << (LPCParser.KW_FUNCTION - 34)) | (1 << (LPCParser.INC - 34)) | (1 << (LPCParser.DEC - 34)) | (1 << (LPCParser.PLUS - 34)) | (1 << (LPCParser.MINUS - 34)) | (1 << (LPCParser.STAR - 34)) | (1 << (LPCParser.SCOPE - 34)) | (1 << (LPCParser.LPAREN - 34)))) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & ((1 << (LPCParser.NOT - 72)) | (1 << (LPCParser.BIT_NOT - 72)) | (1 << (LPCParser.Identifier - 72)))) !== 0)) {
					{
					this.state = 712;
					this.expression();
					}
				}

				}
				break;

			case 4:
				_localctx = new SingleIndexContext(_localctx);
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 715;
				this.expression();
				}
				break;

			case 5:
				_localctx = new TailHeadRangeContext(_localctx);
				this.enterOuterAlt(_localctx, 5);
				{
				this.state = 716;
				this.match(LPCParser.LT);
				this.state = 717;
				this.expression();
				this.state = 718;
				this.match(LPCParser.RANGE_OP);
				this.state = 720;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.LT) {
					{
					this.state = 719;
					this.match(LPCParser.LT);
					}
				}

				this.state = 723;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & ((1 << (LPCParser.KW_FUNCTION - 34)) | (1 << (LPCParser.INC - 34)) | (1 << (LPCParser.DEC - 34)) | (1 << (LPCParser.PLUS - 34)) | (1 << (LPCParser.MINUS - 34)) | (1 << (LPCParser.STAR - 34)) | (1 << (LPCParser.SCOPE - 34)) | (1 << (LPCParser.LPAREN - 34)))) !== 0) || ((((_la - 72)) & ~0x1F) === 0 && ((1 << (_la - 72)) & ((1 << (LPCParser.NOT - 72)) | (1 << (LPCParser.BIT_NOT - 72)) | (1 << (LPCParser.Identifier - 72)))) !== 0)) {
					{
					this.state = 722;
					this.expression();
					}
				}

				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}

	private static readonly _serializedATNSegments: number = 2;
	private static readonly _serializedATNSegment0: string =
		"\x03\uC91D\uCABA\u058D\uAFBA\u4F53\u0607\uEA8B\uC241\x03V\u02DA\x04\x02" +
		"\t\x02\x04\x03\t\x03\x04\x04\t\x04\x04\x05\t\x05\x04\x06\t\x06\x04\x07" +
		"\t\x07\x04\b\t\b\x04\t\t\t\x04\n\t\n\x04\v\t\v\x04\f\t\f\x04\r\t\r\x04" +
		"\x0E\t\x0E\x04\x0F\t\x0F\x04\x10\t\x10\x04\x11\t\x11\x04\x12\t\x12\x04" +
		"\x13\t\x13\x04\x14\t\x14\x04\x15\t\x15\x04\x16\t\x16\x04\x17\t\x17\x04" +
		"\x18\t\x18\x04\x19\t\x19\x04\x1A\t\x1A\x04\x1B\t\x1B\x04\x1C\t\x1C\x04" +
		"\x1D\t\x1D\x04\x1E\t\x1E\x04\x1F\t\x1F\x04 \t \x04!\t!\x04\"\t\"\x04#" +
		"\t#\x04$\t$\x04%\t%\x04&\t&\x04\'\t\'\x04(\t(\x04)\t)\x04*\t*\x04+\t+" +
		"\x04,\t,\x04-\t-\x04.\t.\x04/\t/\x040\t0\x041\t1\x042\t2\x043\t3\x044" +
		"\t4\x045\t5\x046\t6\x047\t7\x048\t8\x049\t9\x03\x02\x07\x02t\n\x02\f\x02" +
		"\x0E\x02w\v\x02\x03\x02\x03\x02\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03" +
		"\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03" +
		"\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x05\x03\x8F\n\x03\x03" +
		"\x04\x07\x04\x92\n\x04\f\x04\x0E\x04\x95\v\x04\x03\x04\x05\x04\x98\n\x04" +
		"\x03\x04\x07\x04\x9B\n\x04\f\x04\x0E\x04\x9E\v\x04\x03\x04\x03\x04\x03" +
		"\x04\x05\x04\xA3\n\x04\x03\x04\x03\x04\x03\x04\x03\x05\x07\x05\xA9\n\x05" +
		"\f\x05\x0E\x05\xAC\v\x05\x03\x05\x03\x05\x03\x05\x03\x05\x07\x05\xB2\n" +
		"\x05\f\x05\x0E\x05\xB5\v\x05\x03\x06\x07\x06\xB8\n\x06\f\x06\x0E\x06\xBB" +
		"\v\x06\x03\x06\x03\x06\x03\x06\x05\x06\xC0\n\x06\x03\x07\x03\x07\x03\x07" +
		"\x07\x07\xC5\n\x07\f\x07\x0E\x07\xC8\v\x07\x03\b\x03\b\x05\b\xCC\n\b\x03" +
		"\b\x07\b\xCF\n\b\f\b\x0E\b\xD2\v\b\x03\b\x03\b\x05\b\xD6\n\b\x03\b\x03" +
		"\b\x05\b\xDA\n\b\x03\b\x07\b\xDD\n\b\f\b\x0E\b\xE0\v\b\x03\b\x07\b\xE3" +
		"\n\b\f\b\x0E\b\xE6\v\b\x03\b\x03\b\x05\b\xEA\n\b\x05\b\xEC\n\b\x03\t\x03" +
		"\t\x03\t\x03\t\x03\t\x03\t\x03\t\x03\t\x03\t\x03\t\x03\t\x03\t\x07\t\xFA" +
		"\n\t\f\t\x0E\t\xFD\v\t\x05\t\xFF\n\t\x03\n\x03\n\x07\n\u0103\n\n\f\n\x0E" +
		"\n\u0106\v\n\x03\n\x03\n\x03\v\x03\v\x03\v\x03\f\x03\f\x03\f\x07\f\u0110" +
		"\n\f\f\f\x0E\f\u0113\v\f\x03\r\x03\r\x03\r\x05\r\u0118\n\r\x03\x0E\x03" +
		"\x0E\x03\x0E\x03\x0E\x03\x0E\x03\x0E\x05\x0E\u0120\n\x0E\x03\x0F\x03\x0F" +
		"\x03\x0F\x07\x0F\u0125\n\x0F\f\x0F\x0E\x0F\u0128\v\x0F\x03\x10\x03\x10" +
		"\x03\x10\x07\x10\u012D\n\x10\f\x10\x0E\x10\u0130\v\x10\x03\x11\x03\x11" +
		"\x03\x11\x07\x11\u0135\n\x11\f\x11\x0E\x11\u0138\v\x11\x03\x12\x03\x12" +
		"\x03\x12\x07\x12\u013D\n\x12\f\x12\x0E\x12\u0140\v\x12\x03\x13\x03\x13" +
		"\x03\x13\x07\x13\u0145\n\x13\f\x13\x0E\x13\u0148\v\x13\x03\x14\x03\x14" +
		"\x03\x14\x07\x14\u014D\n\x14\f\x14\x0E\x14\u0150\v\x14\x03\x15\x03\x15" +
		"\x03\x15\x07\x15\u0155\n\x15\f\x15\x0E\x15\u0158\v\x15\x03\x16\x03\x16" +
		"\x03\x16\x07\x16\u015D\n\x16\f\x16\x0E\x16\u0160\v\x16\x03\x17\x03\x17" +
		"\x03\x17\x07\x17\u0165\n\x17\f\x17\x0E\x17\u0168\v\x17\x03\x18\x03\x18" +
		"\x03\x18\x07\x18\u016D\n\x18\f\x18\x0E\x18\u0170\v\x18\x03\x19\x05\x19" +
		"\u0173\n\x19\x03\x19\x03\x19\x03\x19\x03\x19\x03\x19\x03\x19\x03\x19\x03" +
		"\x19\x03\x19\x03\x19\x03\x19\x05\x19\u0180\n\x19\x03\x1A\x03\x1A\x03\x1A" +
		"\x03\x1A\x03\x1A\x03\x1B\x03\x1B\x03\x1C\x03\x1C\x03\x1C\x03\x1C\x03\x1C" +
		"\x05\x1C\u018E\n\x1C\x03\x1C\x05\x1C\u0191\n\x1C\x03\x1C\x03\x1C\x05\x1C" +
		"\u0195\n\x1C\x03\x1C\x03\x1C\x03\x1C\x03\x1C\x03\x1C\x03\x1C\x03\x1C\x07" +
		"\x1C\u019E\n\x1C\f\x1C\x0E\x1C\u01A1\v\x1C\x03\x1D\x03\x1D\x05\x1D\u01A5" +
		"\n\x1D\x03\x1D\x03\x1D\x03\x1D\x05\x1D\u01AA\n\x1D\x07\x1D\u01AC\n\x1D" +
		"\f\x1D\x0E\x1D\u01AF\v\x1D\x03\x1D\x05\x1D\u01B2\n\x1D\x03\x1E\x03\x1E" +
		"\x03\x1E\x03\x1E\x03\x1E\x03\x1E\x03\x1E\x03\x1E\x05\x1E\u01BC\n\x1E\x03" +
		"\x1E\x03\x1E\x03\x1E\x03\x1E\x03\x1E\x03\x1E\x03\x1E\x03\x1E\x03\x1E\x03" +
		"\x1E\x05\x1E\u01C8\n\x1E\x03\x1E\x03\x1E\x03\x1E\x03\x1E\x03\x1E\x03\x1E" +
		"\x03\x1E\x03\x1E\x05\x1E\u01D2\n\x1E\x03\x1F\x06\x1F\u01D5\n\x1F\r\x1F" +
		"\x0E\x1F\u01D6\x03 \x03 \x03 \x03 \x05 \u01DD\n \x03 \x03 \x05 \u01E1" +
		"\n \x03!\x03!\x03!\x03!\x03!\x03!\x03!\x05!\u01EA\n!\x03\"\x03\"\x03\"" +
		"\x03\"\x03\"\x03\"\x03#\x03#\x03#\x03#\x03#\x03#\x03#\x03#\x03$\x03$\x03" +
		"$\x05$\u01FD\n$\x03$\x03$\x05$\u0201\n$\x03$\x03$\x05$\u0205\n$\x03$\x03" +
		"$\x03$\x03%\x03%\x05%\u020C\n%\x03&\x03&\x03&\x07&\u0211\n&\f&\x0E&\u0214" +
		"\v&\x03&\x05&\u0217\n&\x03\'\x03\'\x03\'\x03\'\x03\'\x03\'\x03\'\x03\'" +
		"\x03(\x03(\x03(\x05(\u0224\n(\x03)\x03)\x05)\u0228\n)\x03)\x07)\u022B" +
		"\n)\f)\x0E)\u022E\v)\x03)\x03)\x03)\x07)\u0233\n)\f)\x0E)\u0236\v)\x03" +
		")\x05)\u0239\n)\x03*\x03*\x03*\x03*\x03*\x03*\x07*\u0241\n*\f*\x0E*\u0244" +
		"\v*\x03*\x03*\x03+\x03+\x07+\u024A\n+\f+\x0E+\u024D\v+\x03+\x03+\x07+" +
		"\u0251\n+\f+\x0E+\u0254\v+\x07+\u0256\n+\f+\x0E+\u0259\v+\x03,\x03,\x03" +
		",\x03,\x03,\x03,\x05,\u0261\n,\x03-\x03-\x03-\x05-\u0266\n-\x03-\x03-" +
		"\x05-\u026A\n-\x03.\x03.\x03.\x03/\x03/\x03/\x030\x030\x050\u0274\n0\x03" +
		"0\x030\x031\x031\x031\x051\u027B\n1\x031\x031\x031\x032\x032\x032\x03" +
		"2\x033\x033\x033\x033\x034\x034\x034\x054\u028B\n4\x034\x034\x035\x07" +
		"5\u0290\n5\f5\x0E5\u0293\v5\x035\x055\u0296\n5\x035\x075\u0299\n5\f5\x0E" +
		"5\u029C\v5\x035\x035\x035\x055\u02A1\n5\x035\x035\x035\x036\x036\x036" +
		"\x056\u02A9\n6\x036\x036\x036\x037\x037\x037\x077\u02B1\n7\f7\x0E7\u02B4" +
		"\v7\x037\x057\u02B7\n7\x038\x038\x038\x038\x039\x039\x039\x039\x039\x05" +
		"9\u02C2\n9\x039\x059\u02C5\n9\x039\x039\x059\u02C9\n9\x039\x059\u02CC" +
		"\n9\x039\x039\x039\x039\x039\x059\u02D3\n9\x039\x059\u02D6\n9\x059\u02D8" +
		"\n9\x039\x02\x02\x02:\x02\x02\x04\x02\x06\x02\b\x02\n\x02\f\x02\x0E\x02" +
		"\x10\x02\x12\x02\x14\x02\x16\x02\x18\x02\x1A\x02\x1C\x02\x1E\x02 \x02" +
		"\"\x02$\x02&\x02(\x02*\x02,\x02.\x020\x022\x024\x026\x028\x02:\x02<\x02" +
		">\x02@\x02B\x02D\x02F\x02H\x02J\x02L\x02N\x02P\x02R\x02T\x02V\x02X\x02" +
		"Z\x02\\\x02^\x02`\x02b\x02d\x02f\x02h\x02j\x02l\x02n\x02p\x02\x02\f\x05" +
		"\x02.2IIST\x03\x02GH\x03\x02CF\x03\x02MN\x03\x0234\x03\x0257\x03\x02," +
		"-\x05\x0235JJRR\x03\x02\x1E\'\x04\x02*+88\x02\u0328\x02u\x03\x02\x02\x02" +
		"\x04\x8E\x03\x02\x02\x02\x06\x93\x03\x02\x02\x02\b\xAA\x03\x02\x02\x02" +
		"\n\xB9\x03\x02\x02\x02\f\xC1\x03\x02\x02\x02\x0E\xEB\x03\x02\x02\x02\x10" +
		"\xFE\x03\x02\x02\x02\x12\u0100\x03\x02\x02\x02\x14\u0109\x03\x02\x02\x02" +
		"\x16\u010C\x03\x02\x02\x02\x18\u0114\x03\x02\x02\x02\x1A\u0119\x03\x02" +
		"\x02\x02\x1C\u0121\x03\x02\x02\x02\x1E\u0129\x03\x02\x02\x02 \u0131\x03" +
		"\x02\x02\x02\"\u0139\x03\x02\x02\x02$\u0141\x03\x02\x02\x02&\u0149\x03" +
		"\x02\x02\x02(\u0151\x03\x02\x02\x02*\u0159\x03\x02\x02\x02,\u0161\x03" +
		"\x02\x02\x02.\u0169\x03\x02\x02\x020\u017F\x03\x02\x02\x022\u0181\x03" +
		"\x02\x02\x024\u0186\x03\x02\x02\x026\u0188\x03\x02\x02\x028\u01A2\x03" +
		"\x02\x02\x02:\u01D1\x03\x02\x02\x02<\u01D4\x03\x02\x02\x02>\u01E0\x03" +
		"\x02\x02\x02@\u01E2\x03\x02\x02\x02B\u01EB\x03\x02\x02\x02D\u01F1\x03" +
		"\x02\x02\x02F\u01F9\x03\x02\x02\x02H\u020B\x03\x02\x02\x02J\u020D\x03" +
		"\x02\x02\x02L\u0218\x03\x02\x02\x02N\u0220\x03\x02\x02\x02P\u0238\x03" +
		"\x02\x02\x02R\u023A\x03\x02\x02\x02T\u0247\x03\x02\x02\x02V\u0260\x03" +
		"\x02\x02\x02X\u0269\x03\x02\x02\x02Z\u026B\x03\x02\x02\x02\\\u026E\x03" +
		"\x02\x02\x02^\u0271\x03\x02\x02\x02`\u0277\x03\x02\x02\x02b\u027F\x03" +
		"\x02\x02\x02d\u0283\x03\x02\x02\x02f\u0287\x03\x02\x02\x02h\u0291\x03" +
		"\x02\x02\x02j\u02A5\x03\x02\x02\x02l\u02AD\x03\x02\x02\x02n\u02B8\x03" +
		"\x02\x02\x02p\u02D7\x03\x02\x02\x02rt\x05\x04\x03\x02sr\x03\x02\x02\x02" +
		"tw\x03\x02\x02\x02us\x03\x02\x02\x02uv\x03\x02\x02\x02vx\x03\x02\x02\x02" +
		"wu\x03\x02\x02\x02xy\x07\x02\x02\x03y\x03\x03\x02\x02\x02z\x8F\x05\x06" +
		"\x04\x02{|\x05\b\x05\x02|}\x079\x02\x02}\x8F\x03\x02\x02\x02~\x8F\x05" +
		"f4\x02\x7F\x8F\x05@!\x02\x80\x8F\x05B\"\x02\x81\x8F\x05F$\x02\x82\x8F" +
		"\x05D#\x02\x83\x8F\x05L\'\x02\x84\x8F\x05R*\x02\x85\x8F\x05Z.\x02\x86" +
		"\x8F\x05\\/\x02\x87\x8F\x05^0\x02\x88\x8F\x05b2\x02\x89\x8F\x05d3\x02" +
		"\x8A\x8F\x05\x12\n\x02\x8B\x8F\x05\x14\v\x02\x8C\x8F\x05h5\x02\x8D\x8F" +
		"\x079\x02\x02\x8Ez\x03\x02\x02\x02\x8E{\x03\x02\x02\x02\x8E~\x03\x02\x02" +
		"\x02\x8E\x7F\x03\x02\x02\x02\x8E\x80\x03\x02\x02\x02\x8E\x81\x03\x02\x02" +
		"\x02\x8E\x82\x03\x02\x02\x02\x8E\x83\x03\x02\x02\x02\x8E\x84\x03\x02\x02" +
		"\x02\x8E\x85\x03\x02\x02\x02\x8E\x86\x03\x02\x02\x02\x8E\x87\x03\x02\x02" +
		"\x02\x8E\x88\x03\x02\x02\x02\x8E\x89\x03\x02\x02\x02\x8E\x8A\x03\x02\x02" +
		"\x02\x8E\x8B\x03\x02\x02\x02\x8E\x8C\x03\x02\x02\x02\x8E\x8D\x03\x02\x02" +
		"\x02\x8F\x05\x03\x02\x02\x02\x90\x92\x07U\x02\x02\x91\x90\x03\x02\x02" +
		"\x02\x92\x95\x03\x02\x02\x02\x93\x91\x03\x02\x02\x02\x93\x94\x03\x02\x02" +
		"\x02\x94\x97\x03\x02\x02\x02\x95\x93\x03\x02\x02\x02\x96\x98\x05\x10\t" +
		"\x02\x97\x96\x03\x02\x02\x02\x97\x98\x03\x02\x02\x02\x98\x9C\x03\x02\x02" +
		"\x02\x99\x9B\x075\x02\x02\x9A\x99\x03\x02\x02\x02\x9B\x9E\x03\x02\x02" +
		"\x02\x9C\x9A\x03\x02\x02\x02\x9C\x9D\x03\x02\x02\x02\x9D\x9F\x03\x02\x02" +
		"\x02\x9E\x9C\x03\x02\x02\x02\x9F\xA0\x07V\x02\x02\xA0\xA2\x07;\x02\x02" +
		"\xA1\xA3\x05\f\x07\x02\xA2\xA1\x03\x02\x02\x02\xA2\xA3\x03\x02\x02\x02" +
		"\xA3\xA4\x03\x02\x02\x02\xA4\xA5\x07<\x02\x02\xA5\xA6\x05\x12\n\x02\xA6" +
		"\x07\x03\x02\x02\x02\xA7\xA9\x07U\x02\x02\xA8\xA7\x03\x02\x02\x02\xA9" +
		"\xAC\x03\x02\x02\x02\xAA\xA8\x03\x02\x02\x02\xAA\xAB\x03\x02\x02\x02\xAB" +
		"\xAD\x03\x02\x02\x02\xAC\xAA\x03\x02\x02\x02\xAD\xAE\x05\x10\t\x02\xAE" +
		"\xB3\x05\n\x06\x02\xAF\xB0\x07:\x02\x02\xB0\xB2\x05\n\x06\x02\xB1\xAF" +
		"\x03\x02\x02\x02\xB2\xB5\x03\x02\x02\x02\xB3\xB1\x03\x02\x02\x02\xB3\xB4" +
		"\x03\x02\x02\x02\xB4\t\x03\x02\x02\x02\xB5\xB3\x03\x02\x02\x02\xB6\xB8" +
		"\x075\x02\x02\xB7\xB6\x03\x02\x02\x02\xB8\xBB\x03\x02\x02\x02\xB9\xB7" +
		"\x03\x02\x02\x02\xB9\xBA\x03\x02\x02\x02\xBA\xBC\x03\x02\x02\x02\xBB\xB9" +
		"\x03\x02\x02\x02\xBC\xBF\x07V\x02\x02\xBD\xBE\x07I\x02\x02\xBE\xC0\x05" +
		"\x16\f\x02\xBF\xBD\x03\x02\x02\x02\xBF\xC0\x03\x02\x02\x02\xC0\v\x03\x02" +
		"\x02\x02\xC1\xC6\x05\x0E\b\x02\xC2\xC3\x07:\x02\x02\xC3\xC5\x05\x0E\b" +
		"\x02\xC4\xC2\x03\x02\x02\x02\xC5\xC8\x03\x02\x02\x02\xC6\xC4\x03\x02\x02" +
		"\x02\xC6\xC7\x03\x02\x02\x02\xC7\r\x03\x02\x02\x02\xC8\xC6\x03\x02\x02" +
		"\x02\xC9\xCB\x05\x10\t\x02\xCA\xCC\x07\x1C\x02\x02\xCB\xCA\x03\x02\x02" +
		"\x02\xCB\xCC\x03\x02\x02\x02\xCC\xD0\x03\x02\x02\x02\xCD\xCF\x075\x02" +
		"\x02\xCE\xCD\x03\x02\x02\x02\xCF\xD2\x03\x02\x02\x02\xD0\xCE\x03\x02\x02" +
		"\x02\xD0\xD1\x03\x02\x02\x02\xD1\xD3\x03\x02\x02\x02\xD2\xD0\x03\x02\x02" +
		"\x02\xD3\xD5\x07V\x02\x02\xD4\xD6\x07(\x02\x02\xD5\xD4\x03\x02\x02\x02" +
		"\xD5\xD6\x03\x02\x02\x02\xD6\xEC\x03\x02\x02\x02\xD7\xD9\x05\x10\t\x02" +
		"\xD8\xDA\x07\x1C\x02\x02\xD9\xD8\x03\x02\x02\x02\xD9\xDA\x03\x02\x02\x02" +
		"\xDA\xDE\x03\x02\x02\x02\xDB\xDD\x075\x02\x02\xDC\xDB\x03\x02\x02\x02" +
		"\xDD\xE0\x03\x02\x02\x02\xDE\xDC\x03\x02\x02\x02\xDE\xDF\x03\x02\x02\x02" +
		"\xDF\xEC\x03\x02\x02\x02\xE0\xDE\x03\x02\x02\x02\xE1\xE3\x075\x02\x02" +
		"\xE2\xE1\x03\x02\x02\x02\xE3\xE6\x03\x02\x02\x02\xE4\xE2\x03\x02\x02\x02" +
		"\xE4\xE5\x03\x02\x02\x02\xE5\xE7\x03\x02\x02\x02\xE6\xE4\x03\x02\x02\x02" +
		"\xE7\xE9\x07V\x02\x02\xE8\xEA\x07(\x02\x02\xE9\xE8\x03\x02\x02\x02\xE9" +
		"\xEA\x03\x02\x02\x02\xEA\xEC\x03\x02\x02\x02\xEB\xC9\x03\x02\x02\x02\xEB" +
		"\xD7\x03\x02\x02\x02\xEB\xE4\x03\x02\x02\x02\xEC\x0F\x03\x02\x02\x02\xED" +
		"\xFF\x07\x1E\x02\x02\xEE\xFF\x07\x1F\x02\x02\xEF\xFF\x07 \x02\x02\xF0" +
		"\xFF\x07!\x02\x02\xF1\xFF\x07\"\x02\x02\xF2\xFF\x07#\x02\x02\xF3\xFF\x07" +
		"$\x02\x02\xF4\xFF\x07%\x02\x02\xF5\xFF\x07&\x02\x02\xF6\xFF\x07\'\x02" +
		"\x02\xF7\xFB\x07V\x02\x02\xF8\xFA\x075\x02\x02\xF9\xF8\x03\x02\x02\x02" +
		"\xFA\xFD\x03\x02\x02\x02\xFB\xF9\x03\x02\x02\x02\xFB\xFC\x03\x02\x02\x02" +
		"\xFC\xFF\x03\x02\x02\x02\xFD\xFB\x03\x02\x02\x02\xFE\xED\x03\x02\x02\x02" +
		"\xFE\xEE\x03\x02\x02\x02\xFE\xEF\x03\x02\x02\x02\xFE\xF0\x03\x02\x02\x02" +
		"\xFE\xF1\x03\x02\x02\x02\xFE\xF2\x03\x02\x02\x02\xFE\xF3\x03\x02\x02\x02" +
		"\xFE\xF4\x03\x02\x02\x02\xFE\xF5\x03\x02\x02\x02\xFE\xF6\x03\x02\x02\x02" +
		"\xFE\xF7\x03\x02\x02\x02\xFF\x11\x03\x02\x02\x02\u0100\u0104\x07=\x02" +
		"\x02\u0101\u0103\x05\x04\x03\x02\u0102\u0101\x03\x02\x02\x02\u0103\u0106" +
		"\x03\x02\x02\x02\u0104\u0102\x03\x02\x02\x02\u0104\u0105\x03\x02\x02\x02" +
		"\u0105\u0107\x03\x02\x02\x02\u0106\u0104\x03\x02\x02\x02\u0107\u0108\x07" +
		">\x02\x02\u0108\x13\x03\x02\x02\x02\u0109\u010A\x05\x16\f\x02\u010A\u010B" +
		"\x079\x02\x02\u010B\x15\x03\x02\x02\x02\u010C\u0111\x05\x18\r\x02\u010D" +
		"\u010E\x07:\x02\x02\u010E\u0110\x05\x18\r\x02\u010F\u010D\x03\x02\x02" +
		"\x02\u0110\u0113\x03\x02\x02\x02\u0111\u010F\x03\x02\x02\x02\u0111\u0112" +
		"\x03\x02\x02\x02\u0112\x17\x03\x02\x02\x02\u0113\u0111\x03\x02\x02\x02" +
		"\u0114\u0117\x05\x1A\x0E\x02\u0115\u0116\t\x02\x02\x02\u0116\u0118\x05" +
		"\x16\f\x02\u0117\u0115\x03\x02\x02\x02\u0117\u0118\x03\x02\x02\x02\u0118" +
		"\x19\x03\x02\x02\x02\u0119\u011F\x05\x1C\x0F\x02\u011A\u011B\x07A\x02" +
		"\x02\u011B\u011C\x05\x16\f\x02\u011C\u011D\x07B\x02\x02\u011D\u011E\x05" +
		"\x1A\x0E\x02\u011E\u0120\x03\x02\x02\x02\u011F\u011A\x03\x02\x02\x02\u011F" +
		"\u0120\x03\x02\x02\x02\u0120\x1B\x03\x02\x02\x02\u0121\u0126\x05\x1E\x10" +
		"\x02\u0122\u0123\x07L\x02\x02\u0123\u0125\x05\x1E\x10\x02\u0124\u0122" +
		"\x03\x02\x02\x02\u0125\u0128\x03\x02\x02\x02\u0126\u0124\x03\x02\x02\x02" +
		"\u0126\u0127\x03\x02\x02\x02\u0127\x1D\x03\x02\x02\x02\u0128\u0126\x03" +
		"\x02\x02\x02\u0129\u012E\x05 \x11\x02\u012A\u012B\x07K\x02\x02\u012B\u012D" +
		"\x05 \x11\x02\u012C\u012A\x03\x02\x02\x02\u012D\u0130\x03\x02\x02\x02" +
		"\u012E\u012C\x03\x02\x02\x02\u012E\u012F\x03\x02\x02\x02\u012F\x1F\x03" +
		"\x02\x02\x02\u0130\u012E\x03\x02\x02\x02\u0131\u0136\x05\"\x12\x02\u0132" +
		"\u0133\x07P\x02\x02\u0133\u0135\x05\"\x12\x02\u0134\u0132\x03\x02\x02" +
		"\x02\u0135\u0138\x03\x02\x02\x02\u0136\u0134\x03\x02\x02\x02\u0136\u0137" +
		"\x03\x02\x02\x02\u0137!\x03\x02\x02\x02\u0138\u0136\x03\x02\x02\x02\u0139" +
		"\u013E\x05$\x13\x02\u013A\u013B\x07Q\x02\x02\u013B\u013D\x05$\x13\x02" +
		"\u013C\u013A\x03\x02\x02\x02\u013D\u0140\x03\x02\x02\x02\u013E\u013C\x03" +
		"\x02\x02\x02\u013E\u013F\x03\x02\x02\x02\u013F#\x03\x02\x02\x02\u0140" +
		"\u013E\x03\x02\x02\x02\u0141\u0146\x05&\x14\x02\u0142\u0143\x07O\x02\x02" +
		"\u0143\u0145\x05&\x14\x02\u0144\u0142\x03\x02\x02\x02\u0145\u0148\x03" +
		"\x02\x02\x02\u0146\u0144\x03\x02\x02\x02\u0146\u0147\x03\x02\x02\x02\u0147" +
		"%\x03\x02\x02\x02\u0148\u0146\x03\x02\x02\x02\u0149\u014E\x05(\x15\x02" +
		"\u014A\u014B\t\x03\x02\x02\u014B\u014D\x05(\x15\x02\u014C\u014A\x03\x02" +
		"\x02\x02\u014D\u0150\x03\x02\x02\x02\u014E\u014C\x03\x02\x02\x02\u014E" +
		"\u014F\x03\x02\x02\x02\u014F\'\x03\x02\x02\x02\u0150\u014E\x03\x02\x02" +
		"\x02\u0151\u0156\x05*\x16\x02\u0152\u0153\t\x04\x02\x02\u0153\u0155\x05" +
		"*\x16\x02\u0154\u0152\x03\x02\x02\x02\u0155\u0158\x03\x02\x02\x02\u0156" +
		"\u0154\x03\x02\x02\x02\u0156\u0157\x03\x02\x02\x02\u0157)\x03\x02\x02" +
		"\x02\u0158\u0156\x03\x02\x02\x02\u0159\u015E\x05,\x17\x02\u015A\u015B" +
		"\t\x05\x02\x02\u015B\u015D\x05,\x17\x02\u015C\u015A\x03\x02\x02\x02\u015D" +
		"\u0160\x03\x02\x02\x02\u015E\u015C\x03\x02\x02\x02\u015E\u015F\x03\x02" +
		"\x02\x02\u015F+\x03\x02\x02\x02\u0160\u015E\x03\x02\x02\x02\u0161\u0166" +
		"\x05.\x18\x02\u0162\u0163\t\x06\x02\x02\u0163\u0165\x05.\x18\x02\u0164" +
		"\u0162\x03\x02\x02\x02\u0165\u0168\x03\x02\x02\x02\u0166\u0164\x03\x02" +
		"\x02\x02\u0166\u0167\x03\x02\x02\x02\u0167-\x03\x02\x02\x02\u0168\u0166" +
		"\x03\x02\x02\x02\u0169\u016E\x050\x19\x02\u016A\u016B\t\x07\x02\x02\u016B" +
		"\u016D\x050\x19\x02\u016C\u016A\x03\x02\x02\x02\u016D\u0170\x03\x02\x02" +
		"\x02\u016E\u016C\x03\x02\x02\x02\u016E\u016F\x03\x02\x02\x02\u016F/\x03" +
		"\x02\x02\x02\u0170\u016E\x03\x02\x02\x02\u0171\u0173\t\b\x02\x02\u0172" +
		"\u0171\x03\x02\x02\x02\u0172\u0173\x03\x02\x02\x02\u0173\u0174\x03\x02" +
		"\x02\x02\u0174\u0180\x056\x1C\x02\u0175\u0176\t\t\x02\x02\u0176\u0180" +
		"\x050\x19\x02\u0177\u0178\x07\x1B\x02\x02\u0178\u0179\x07;\x02\x02\u0179" +
		"\u017A\x05\x16\f\x02\u017A\u017B\x07<\x02\x02\u017B\u0180\x03\x02\x02" +
		"\x02\u017C\u017D\x07\x1B\x02\x02\u017D\u0180\x05\x12\n\x02\u017E\u0180" +
		"\x052\x1A\x02\u017F\u0172\x03\x02\x02\x02\u017F\u0175\x03\x02\x02\x02" +
		"\u017F\u0177\x03\x02\x02\x02\u017F\u017C\x03\x02\x02\x02\u017F\u017E\x03" +
		"\x02\x02\x02\u01801\x03\x02\x02\x02\u0181\u0182\x07;\x02\x02\u0182\u0183" +
		"\x054\x1B\x02\u0183\u0184\x07<\x02\x02\u0184\u0185\x050\x19\x02\u0185" +
		"3\x03\x02\x02\x02\u0186\u0187\t\n\x02\x02\u01875\x03\x02\x02\x02\u0188" +
		"\u019F\x05:\x1E\x02\u0189\u018A\t\v\x02\x02\u018A\u0190\x07V\x02\x02\u018B" +
		"\u018D\x07;\x02\x02\u018C\u018E\x058\x1D\x02\u018D\u018C\x03\x02\x02\x02" +
		"\u018D\u018E\x03\x02\x02\x02\u018E\u018F\x03\x02\x02\x02\u018F\u0191\x07" +
		"<\x02\x02\u0190\u018B\x03\x02\x02\x02\u0190\u0191\x03\x02\x02\x02\u0191" +
		"\u019E\x03\x02\x02\x02\u0192\u0194\x07;\x02\x02\u0193\u0195\x058\x1D\x02" +
		"\u0194\u0193\x03\x02\x02\x02\u0194\u0195\x03\x02\x02\x02\u0195\u0196\x03" +
		"\x02\x02\x02\u0196\u019E\x07<\x02\x02\u0197\u0198\x07?\x02\x02\u0198\u0199" +
		"\x05p9\x02\u0199\u019A\x07@\x02\x02\u019A\u019E\x03\x02\x02\x02\u019B" +
		"\u019E\x07,\x02\x02\u019C\u019E\x07-\x02\x02\u019D\u0189\x03\x02\x02\x02" +
		"\u019D\u0192\x03\x02\x02\x02\u019D\u0197\x03\x02\x02\x02\u019D\u019B\x03" +
		"\x02\x02\x02\u019D\u019C\x03\x02\x02\x02\u019E\u01A1\x03\x02\x02\x02\u019F" +
		"\u019D\x03\x02\x02\x02\u019F\u01A0\x03\x02\x02\x02\u01A07\x03\x02\x02" +
		"\x02\u01A1\u019F\x03\x02\x02\x02\u01A2\u01A4\x05\x18\r\x02\u01A3\u01A5" +
		"\x07(\x02\x02\u01A4\u01A3\x03\x02\x02\x02\u01A4\u01A5\x03\x02\x02\x02" +
		"\u01A5\u01AD\x03\x02\x02\x02\u01A6\u01A7\x07:\x02\x02\u01A7\u01A9\x05" +
		"\x18\r\x02\u01A8\u01AA\x07(\x02\x02\u01A9\u01A8\x03\x02\x02\x02\u01A9" +
		"\u01AA\x03\x02\x02\x02\u01AA\u01AC\x03\x02\x02\x02\u01AB\u01A6\x03\x02" +
		"\x02\x02\u01AC\u01AF\x03\x02\x02\x02\u01AD\u01AB\x03\x02\x02\x02\u01AD" +
		"\u01AE\x03\x02\x02\x02\u01AE\u01B1\x03\x02\x02\x02\u01AF\u01AD\x03\x02" +
		"\x02\x02\u01B0\u01B2\x07:\x02\x02\u01B1\u01B0\x03\x02\x02\x02\u01B1\u01B2" +
		"\x03\x02\x02\x02\u01B29\x03\x02\x02\x02\u01B3\u01B4\x078\x02\x02\u01B4" +
		"\u01D2\x07V\x02\x02\u01B5\u01D2\x05<\x1F\x02\u01B6\u01D2\x05`1\x02\u01B7" +
		"\u01D2\x05j6\x02\u01B8\u01B9\x07$\x02\x02\u01B9\u01BB\x07;\x02\x02\u01BA" +
		"\u01BC\x05\f\x07\x02\u01BB\u01BA\x03\x02\x02\x02\u01BB\u01BC\x03\x02\x02" +
		"\x02\u01BC\u01BD\x03\x02\x02\x02\u01BD\u01BE\x07<\x02\x02\u01BE\u01D2" +
		"\x05\x12\n\x02\u01BF\u01D2\x07V\x02\x02\u01C0\u01D2\x07\x03\x02\x02\u01C1" +
		"\u01D2\x07\x04\x02\x02\u01C2\u01D2\x07\x06\x02\x02\u01C3\u01D2\x07\x05" +
		"\x02\x02\u01C4\u01C5\x07;\x02\x02\u01C5\u01C7\x07=\x02\x02\u01C6\u01C8" +
		"\x05J&\x02\u01C7\u01C6\x03\x02\x02\x02\u01C7\u01C8\x03\x02\x02\x02\u01C8" +
		"\u01C9\x03\x02\x02\x02\u01C9\u01CA\x07>\x02\x02\u01CA\u01D2\x07<\x02\x02" +
		"\u01CB\u01CC\x07;\x02\x02\u01CC\u01CD\x05\x16\f\x02\u01CD\u01CE\x07<\x02" +
		"\x02\u01CE\u01D2\x03\x02\x02\x02\u01CF\u01D0\x07\x1C\x02\x02\u01D0\u01D2" +
		"\x07V\x02\x02\u01D1\u01B3\x03\x02\x02\x02\u01D1\u01B5\x03\x02\x02\x02" +
		"\u01D1\u01B6\x03\x02\x02\x02\u01D1\u01B7\x03\x02\x02\x02\u01D1\u01B8\x03" +
		"\x02\x02\x02\u01D1\u01BF\x03\x02\x02\x02\u01D1\u01C0\x03\x02\x02\x02\u01D1" +
		"\u01C1\x03\x02\x02\x02\u01D1\u01C2\x03\x02\x02\x02\u01D1\u01C3\x03\x02" +
		"\x02\x02\u01D1\u01C4\x03\x02\x02\x02\u01D1\u01CB\x03\x02\x02\x02\u01D1" +
		"\u01CF\x03\x02\x02\x02\u01D2;\x03\x02\x02\x02\u01D3\u01D5\x05> \x02\u01D4" +
		"\u01D3\x03\x02\x02\x02\u01D5\u01D6\x03\x02\x02\x02\u01D6\u01D4\x03\x02" +
		"\x02\x02\u01D6\u01D7\x03\x02\x02\x02\u01D7=\x03\x02\x02\x02\u01D8\u01E1" +
		"\x07\x06\x02\x02\u01D9\u01DA\x07V\x02\x02\u01DA\u01DC\x07;\x02\x02\u01DB" +
		"\u01DD\x058\x1D\x02\u01DC\u01DB\x03\x02\x02\x02\u01DC\u01DD\x03\x02\x02" +
		"\x02\u01DD\u01DE\x03\x02\x02\x02\u01DE\u01E1\x07<\x02\x02\u01DF\u01E1" +
		"\x07V\x02\x02\u01E0\u01D8\x03\x02\x02\x02\u01E0\u01D9\x03\x02\x02\x02" +
		"\u01E0\u01DF\x03\x02\x02\x02\u01E1?\x03\x02\x02\x02\u01E2\u01E3\x07\r" +
		"\x02\x02\u01E3\u01E4\x07;\x02\x02\u01E4\u01E5\x05\x16\f\x02\u01E5\u01E6" +
		"\x07<\x02\x02\u01E6\u01E9\x05\x04\x03\x02\u01E7\u01E8\x07\x0E\x02\x02" +
		"\u01E8\u01EA\x05\x04\x03\x02\u01E9\u01E7\x03\x02\x02\x02\u01E9\u01EA\x03" +
		"\x02\x02\x02\u01EAA\x03\x02\x02\x02\u01EB\u01EC\x07\x10\x02\x02\u01EC" +
		"\u01ED\x07;\x02\x02\u01ED\u01EE\x05\x16\f\x02\u01EE\u01EF\x07<\x02\x02" +
		"\u01EF\u01F0\x05\x04\x03\x02\u01F0C\x03\x02\x02\x02\u01F1\u01F2\x07\x11" +
		"\x02\x02\u01F2\u01F3\x05\x04\x03\x02\u01F3\u01F4\x07\x10\x02\x02\u01F4" +
		"\u01F5\x07;\x02";
	private static readonly _serializedATNSegment1: string =
		"\x02\u01F5\u01F6\x05\x16\f\x02\u01F6\u01F7\x07<\x02\x02\u01F7\u01F8\x07" +
		"9\x02\x02\u01F8E\x03\x02\x02\x02\u01F9\u01FA\x07\x0F\x02\x02\u01FA\u01FC" +
		"\x07;\x02\x02\u01FB\u01FD\x05H%\x02\u01FC\u01FB\x03\x02\x02\x02\u01FC" +
		"\u01FD\x03\x02\x02\x02\u01FD\u01FE\x03\x02\x02\x02\u01FE\u0200\x079\x02" +
		"\x02\u01FF\u0201\x05\x16\f\x02\u0200\u01FF\x03\x02\x02\x02\u0200\u0201" +
		"\x03\x02\x02\x02\u0201\u0202\x03\x02\x02\x02\u0202\u0204\x079\x02\x02" +
		"\u0203\u0205\x05J&\x02\u0204\u0203\x03\x02\x02\x02\u0204\u0205\x03\x02" +
		"\x02\x02\u0205\u0206\x03\x02\x02\x02\u0206\u0207\x07<\x02\x02\u0207\u0208" +
		"\x05\x04\x03\x02\u0208G\x03\x02\x02\x02\u0209\u020C\x05\b\x05\x02\u020A" +
		"\u020C\x05J&\x02\u020B\u0209\x03\x02\x02\x02\u020B\u020A\x03\x02\x02\x02" +
		"\u020CI\x03\x02\x02\x02\u020D\u0212\x05\x16\f\x02\u020E\u020F\x07:\x02" +
		"\x02\u020F\u0211\x05\x16\f\x02\u0210\u020E\x03\x02\x02\x02\u0211\u0214" +
		"\x03\x02\x02\x02\u0212\u0210\x03\x02\x02\x02\u0212\u0213\x03\x02\x02\x02" +
		"\u0213\u0216\x03\x02\x02\x02\u0214\u0212\x03\x02\x02\x02\u0215\u0217\x07" +
		":\x02\x02\u0216\u0215\x03\x02\x02\x02\u0216\u0217\x03\x02\x02\x02\u0217" +
		"K\x03\x02\x02\x02\u0218\u0219\x07\x18\x02\x02\u0219\u021A\x07;\x02\x02" +
		"\u021A\u021B\x05N(\x02\u021B\u021C\x07\x1D\x02\x02\u021C\u021D\x05\x16" +
		"\f\x02\u021D\u021E\x07<\x02\x02\u021E\u021F\x05\x04\x03\x02\u021FM\x03" +
		"\x02\x02\x02\u0220\u0223\x05P)\x02\u0221\u0222\x07:\x02\x02\u0222\u0224" +
		"\x05P)\x02\u0223\u0221\x03\x02\x02\x02\u0223\u0224\x03\x02\x02\x02\u0224" +
		"O\x03\x02\x02\x02\u0225\u0227\x05\x10\t\x02\u0226\u0228\x07\x1C\x02\x02" +
		"\u0227\u0226\x03\x02\x02\x02\u0227\u0228\x03\x02\x02\x02\u0228\u022C\x03" +
		"\x02\x02\x02\u0229\u022B\x075\x02\x02\u022A\u0229\x03\x02\x02\x02\u022B" +
		"\u022E\x03\x02\x02\x02\u022C\u022A\x03\x02\x02\x02\u022C\u022D\x03\x02" +
		"\x02\x02\u022D\u022F\x03\x02\x02\x02\u022E\u022C\x03\x02\x02\x02\u022F" +
		"\u0230\x07V\x02\x02\u0230\u0239\x03\x02\x02\x02\u0231\u0233\x075\x02\x02" +
		"\u0232\u0231\x03\x02\x02\x02\u0233\u0236\x03\x02\x02\x02\u0234\u0232\x03" +
		"\x02\x02\x02\u0234\u0235\x03\x02\x02\x02\u0235\u0237\x03\x02\x02\x02\u0236" +
		"\u0234\x03\x02\x02\x02\u0237\u0239\x07V\x02\x02\u0238\u0225\x03\x02\x02" +
		"\x02\u0238\u0234\x03\x02\x02\x02\u0239Q\x03\x02\x02\x02\u023A\u023B\x07" +
		"\x12\x02\x02\u023B\u023C\x07;\x02\x02\u023C\u023D\x05\x16\f\x02\u023D" +
		"\u023E\x07<\x02\x02\u023E\u0242\x07=\x02\x02\u023F\u0241\x05T+\x02\u0240" +
		"\u023F\x03\x02\x02\x02\u0241\u0244\x03\x02\x02\x02\u0242\u0240\x03\x02" +
		"\x02\x02\u0242\u0243\x03\x02\x02\x02\u0243\u0245\x03\x02\x02\x02\u0244" +
		"\u0242\x03\x02\x02\x02\u0245\u0246\x07>\x02\x02\u0246S\x03\x02\x02\x02" +
		"\u0247\u024B\x05V,\x02\u0248\u024A\x05\x04\x03\x02\u0249\u0248\x03\x02" +
		"\x02\x02\u024A\u024D\x03\x02\x02\x02\u024B\u0249\x03\x02\x02\x02\u024B" +
		"\u024C\x03\x02\x02\x02\u024C\u0257\x03\x02\x02\x02\u024D\u024B\x03\x02" +
		"\x02\x02\u024E\u0252\x05V,\x02\u024F\u0251\x05\x04\x03\x02\u0250\u024F" +
		"\x03\x02\x02\x02\u0251\u0254\x03\x02\x02\x02\u0252\u0250\x03\x02\x02\x02" +
		"\u0252\u0253\x03\x02\x02\x02\u0253\u0256\x03\x02\x02\x02\u0254\u0252\x03" +
		"\x02\x02\x02\u0255\u024E\x03\x02\x02\x02\u0256\u0259\x03\x02\x02\x02\u0257" +
		"\u0255\x03\x02\x02\x02\u0257\u0258\x03\x02\x02\x02\u0258U\x03\x02\x02" +
		"\x02\u0259\u0257\x03\x02\x02\x02\u025A\u025B\x07\x13\x02\x02\u025B\u025C" +
		"\x05X-\x02\u025C\u025D\x07B\x02\x02\u025D\u0261\x03\x02\x02\x02\u025E" +
		"\u025F\x07\x14\x02\x02\u025F\u0261\x07B\x02\x02\u0260\u025A\x03\x02\x02" +
		"\x02\u0260\u025E\x03\x02\x02\x02\u0261W\x03\x02\x02\x02\u0262\u0265\x05" +
		"\x16\f\x02\u0263\u0264\x07)\x02\x02\u0264\u0266\x05\x16\f\x02\u0265\u0263" +
		"\x03\x02\x02\x02\u0265\u0266\x03\x02\x02\x02\u0266\u026A\x03\x02\x02\x02" +
		"\u0267\u0268\x07)\x02\x02\u0268\u026A\x05\x16\f\x02\u0269\u0262\x03\x02" +
		"\x02\x02\u0269\u0267\x03\x02\x02\x02\u026AY\x03\x02\x02\x02\u026B\u026C" +
		"\x07\x15\x02\x02\u026C\u026D\x079\x02\x02\u026D[\x03\x02\x02\x02\u026E" +
		"\u026F\x07\x16\x02\x02\u026F\u0270\x079\x02\x02\u0270]\x03\x02\x02\x02" +
		"\u0271\u0273\x07\x17\x02\x02\u0272\u0274\x05\x16\f\x02\u0273\u0272\x03" +
		"\x02\x02\x02\u0273\u0274\x03\x02\x02\x02\u0274\u0275\x03\x02\x02\x02\u0275" +
		"\u0276\x079\x02\x02\u0276_\x03\x02\x02\x02\u0277\u0278\x07;\x02\x02\u0278" +
		"\u027A\x07B\x02\x02\u0279\u027B\x05\x16\f\x02\u027A\u0279\x03\x02\x02" +
		"\x02\u027A\u027B\x03\x02\x02\x02\u027B\u027C\x03\x02\x02\x02\u027C\u027D" +
		"\x07B\x02\x02\u027D\u027E\x07<\x02\x02\u027Ea\x03\x02\x02\x02\u027F\u0280" +
		"\x07\x19\x02\x02\u0280\u0281\x05\x16\f\x02\u0281\u0282\x079\x02\x02\u0282" +
		"c\x03\x02\x02\x02\u0283\u0284\x07\x1A\x02\x02\u0284\u0285\x05\x16\f\x02" +
		"\u0285\u0286\x079\x02\x02\u0286e\x03\x02\x02\x02\u0287\u0288\x07V\x02" +
		"\x02\u0288\u028A\x07;\x02\x02\u0289\u028B\x058\x1D\x02\u028A\u0289\x03" +
		"\x02\x02\x02\u028A\u028B\x03\x02\x02\x02\u028B\u028C\x03\x02\x02\x02\u028C" +
		"\u028D\x07<\x02\x02\u028Dg\x03\x02\x02\x02\u028E\u0290\x07U\x02\x02\u028F" +
		"\u028E\x03\x02\x02\x02\u0290\u0293\x03\x02\x02\x02\u0291\u028F\x03\x02" +
		"\x02\x02\u0291\u0292\x03\x02\x02\x02\u0292\u0295\x03\x02\x02\x02\u0293" +
		"\u0291\x03\x02\x02\x02\u0294\u0296\x05\x10\t\x02\u0295\u0294\x03\x02\x02" +
		"\x02\u0295\u0296\x03\x02\x02\x02\u0296\u029A\x03\x02\x02\x02\u0297\u0299" +
		"\x075\x02\x02\u0298\u0297\x03\x02\x02\x02\u0299\u029C\x03\x02\x02\x02" +
		"\u029A\u0298\x03\x02\x02\x02\u029A\u029B\x03\x02\x02\x02\u029B\u029D\x03" +
		"\x02\x02\x02\u029C\u029A\x03\x02\x02\x02\u029D\u029E\x07V\x02\x02\u029E" +
		"\u02A0\x07;\x02\x02\u029F\u02A1\x05\f\x07\x02\u02A0\u029F\x03\x02\x02" +
		"\x02\u02A0\u02A1\x03\x02\x02\x02\u02A1\u02A2\x03\x02\x02\x02\u02A2\u02A3" +
		"\x07<\x02\x02\u02A3\u02A4\x079\x02\x02\u02A4i\x03\x02\x02\x02\u02A5\u02A6" +
		"\x07;\x02\x02\u02A6\u02A8\x07?\x02\x02\u02A7\u02A9\x05l7\x02\u02A8\u02A7" +
		"\x03\x02\x02\x02\u02A8\u02A9\x03\x02\x02\x02\u02A9\u02AA\x03\x02\x02\x02" +
		"\u02AA\u02AB\x07@\x02\x02\u02AB\u02AC\x07<\x02\x02\u02ACk\x03\x02\x02" +
		"\x02\u02AD\u02B2\x05n8\x02\u02AE\u02AF\x07:\x02\x02\u02AF\u02B1\x05n8" +
		"\x02\u02B0\u02AE\x03\x02\x02\x02\u02B1\u02B4\x03\x02\x02\x02\u02B2\u02B0" +
		"\x03\x02\x02\x02\u02B2\u02B3\x03\x02\x02\x02\u02B3\u02B6\x03\x02\x02\x02" +
		"\u02B4\u02B2\x03\x02\x02\x02\u02B5\u02B7\x07:\x02\x02\u02B6\u02B5\x03" +
		"\x02\x02\x02\u02B6\u02B7\x03\x02\x02\x02\u02B7m\x03\x02\x02\x02\u02B8" +
		"\u02B9\x05\x16\f\x02\u02B9\u02BA\x07B\x02\x02\u02BA\u02BB\x05\x16\f\x02" +
		"\u02BBo\x03\x02\x02\x02\u02BC\u02BD\x07D\x02\x02\u02BD\u02D8\x05\x16\f" +
		"\x02\u02BE\u02BF\x05\x16\f\x02\u02BF\u02C1\x07)\x02\x02\u02C0\u02C2\x07" +
		"D\x02\x02\u02C1\u02C0\x03\x02\x02\x02\u02C1\u02C2\x03\x02\x02\x02\u02C2" +
		"\u02C4\x03\x02\x02\x02\u02C3\u02C5\x05\x16\f\x02\u02C4\u02C3\x03\x02\x02" +
		"\x02\u02C4\u02C5\x03\x02\x02\x02\u02C5\u02D8\x03\x02\x02\x02\u02C6\u02C8" +
		"\x07)\x02\x02\u02C7\u02C9\x07D\x02\x02\u02C8\u02C7\x03\x02\x02\x02\u02C8" +
		"\u02C9\x03\x02\x02\x02\u02C9\u02CB\x03\x02\x02\x02\u02CA\u02CC\x05\x16" +
		"\f\x02\u02CB\u02CA\x03\x02\x02\x02\u02CB\u02CC\x03\x02\x02\x02\u02CC\u02D8" +
		"\x03\x02\x02\x02\u02CD\u02D8\x05\x16\f\x02\u02CE\u02CF\x07D\x02\x02\u02CF" +
		"\u02D0\x05\x16\f\x02\u02D0\u02D2\x07)\x02\x02\u02D1\u02D3\x07D\x02\x02" +
		"\u02D2\u02D1\x03\x02\x02\x02\u02D2\u02D3\x03\x02\x02\x02\u02D3\u02D5\x03" +
		"\x02\x02\x02\u02D4\u02D6\x05\x16\f\x02\u02D5\u02D4\x03\x02\x02\x02\u02D5" +
		"\u02D6\x03\x02\x02\x02\u02D6\u02D8\x03\x02\x02\x02\u02D7\u02BC\x03\x02" +
		"\x02\x02\u02D7\u02BE\x03\x02\x02\x02\u02D7\u02C6\x03\x02\x02\x02\u02D7" +
		"\u02CD\x03\x02\x02\x02\u02D7\u02CE\x03\x02\x02\x02\u02D8q\x03\x02\x02" +
		"\x02Zu\x8E\x93\x97\x9C\xA2\xAA\xB3\xB9\xBF\xC6\xCB\xD0\xD5\xD9\xDE\xE4" +
		"\xE9\xEB\xFB\xFE\u0104\u0111\u0117\u011F\u0126\u012E\u0136\u013E\u0146" +
		"\u014E\u0156\u015E\u0166\u016E\u0172\u017F\u018D\u0190\u0194\u019D\u019F" +
		"\u01A4\u01A9\u01AD\u01B1\u01BB\u01C7\u01D1\u01D6\u01DC\u01E0\u01E9\u01FC" +
		"\u0200\u0204\u020B\u0212\u0216\u0223\u0227\u022C\u0234\u0238\u0242\u024B" +
		"\u0252\u0257\u0260\u0265\u0269\u0273\u027A\u028A\u0291\u0295\u029A\u02A0" +
		"\u02A8\u02B2\u02B6\u02C1\u02C4\u02C8\u02CB\u02D2\u02D5\u02D7";
	public static readonly _serializedATN: string = Utils.join(
		[
			LPCParser._serializedATNSegment0,
			LPCParser._serializedATNSegment1,
		],
		"",
	);
	public static __ATN: ATN;
	public static get _ATN(): ATN {
		if (!LPCParser.__ATN) {
			LPCParser.__ATN = new ATNDeserializer().deserialize(Utils.toCharArray(LPCParser._serializedATN));
		}

		return LPCParser.__ATN;
	}

}

export class SourceFileContext extends ParserRuleContext {
	public EOF(): TerminalNode { return this.getToken(LPCParser.EOF, 0); }
	public statement(): StatementContext[];
	public statement(i: number): StatementContext;
	public statement(i?: number): StatementContext | StatementContext[] {
		if (i === undefined) {
			return this.getRuleContexts(StatementContext);
		} else {
			return this.getRuleContext(i, StatementContext);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_sourceFile; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitSourceFile) {
			return visitor.visitSourceFile(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class StatementContext extends ParserRuleContext {
	public functionDef(): FunctionDefContext | undefined {
		return this.tryGetRuleContext(0, FunctionDefContext);
	}
	public variableDecl(): VariableDeclContext | undefined {
		return this.tryGetRuleContext(0, VariableDeclContext);
	}
	public SEMI(): TerminalNode | undefined { return this.tryGetToken(LPCParser.SEMI, 0); }
	public macroInvoke(): MacroInvokeContext | undefined {
		return this.tryGetRuleContext(0, MacroInvokeContext);
	}
	public ifStatement(): IfStatementContext | undefined {
		return this.tryGetRuleContext(0, IfStatementContext);
	}
	public whileStatement(): WhileStatementContext | undefined {
		return this.tryGetRuleContext(0, WhileStatementContext);
	}
	public forStatement(): ForStatementContext | undefined {
		return this.tryGetRuleContext(0, ForStatementContext);
	}
	public doWhileStatement(): DoWhileStatementContext | undefined {
		return this.tryGetRuleContext(0, DoWhileStatementContext);
	}
	public foreachStatement(): ForeachStatementContext | undefined {
		return this.tryGetRuleContext(0, ForeachStatementContext);
	}
	public switchStatement(): SwitchStatementContext | undefined {
		return this.tryGetRuleContext(0, SwitchStatementContext);
	}
	public breakStatement(): BreakStatementContext | undefined {
		return this.tryGetRuleContext(0, BreakStatementContext);
	}
	public continueStatement(): ContinueStatementContext | undefined {
		return this.tryGetRuleContext(0, ContinueStatementContext);
	}
	public returnStatement(): ReturnStatementContext | undefined {
		return this.tryGetRuleContext(0, ReturnStatementContext);
	}
	public inheritStatement(): InheritStatementContext | undefined {
		return this.tryGetRuleContext(0, InheritStatementContext);
	}
	public includeStatement(): IncludeStatementContext | undefined {
		return this.tryGetRuleContext(0, IncludeStatementContext);
	}
	public block(): BlockContext | undefined {
		return this.tryGetRuleContext(0, BlockContext);
	}
	public exprStatement(): ExprStatementContext | undefined {
		return this.tryGetRuleContext(0, ExprStatementContext);
	}
	public prototypeStatement(): PrototypeStatementContext | undefined {
		return this.tryGetRuleContext(0, PrototypeStatementContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_statement; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitStatement) {
			return visitor.visitStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class FunctionDefContext extends ParserRuleContext {
	public Identifier(): TerminalNode { return this.getToken(LPCParser.Identifier, 0); }
	public LPAREN(): TerminalNode { return this.getToken(LPCParser.LPAREN, 0); }
	public RPAREN(): TerminalNode { return this.getToken(LPCParser.RPAREN, 0); }
	public block(): BlockContext {
		return this.getRuleContext(0, BlockContext);
	}
	public MODIFIER(): TerminalNode[];
	public MODIFIER(i: number): TerminalNode;
	public MODIFIER(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.MODIFIER);
		} else {
			return this.getToken(LPCParser.MODIFIER, i);
		}
	}
	public typeSpec(): TypeSpecContext | undefined {
		return this.tryGetRuleContext(0, TypeSpecContext);
	}
	public STAR(): TerminalNode[];
	public STAR(i: number): TerminalNode;
	public STAR(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.STAR);
		} else {
			return this.getToken(LPCParser.STAR, i);
		}
	}
	public parameterList(): ParameterListContext | undefined {
		return this.tryGetRuleContext(0, ParameterListContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_functionDef; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitFunctionDef) {
			return visitor.visitFunctionDef(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class VariableDeclContext extends ParserRuleContext {
	public typeSpec(): TypeSpecContext {
		return this.getRuleContext(0, TypeSpecContext);
	}
	public variableDeclarator(): VariableDeclaratorContext[];
	public variableDeclarator(i: number): VariableDeclaratorContext;
	public variableDeclarator(i?: number): VariableDeclaratorContext | VariableDeclaratorContext[] {
		if (i === undefined) {
			return this.getRuleContexts(VariableDeclaratorContext);
		} else {
			return this.getRuleContext(i, VariableDeclaratorContext);
		}
	}
	public MODIFIER(): TerminalNode[];
	public MODIFIER(i: number): TerminalNode;
	public MODIFIER(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.MODIFIER);
		} else {
			return this.getToken(LPCParser.MODIFIER, i);
		}
	}
	public COMMA(): TerminalNode[];
	public COMMA(i: number): TerminalNode;
	public COMMA(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.COMMA);
		} else {
			return this.getToken(LPCParser.COMMA, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_variableDecl; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitVariableDecl) {
			return visitor.visitVariableDecl(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class VariableDeclaratorContext extends ParserRuleContext {
	public Identifier(): TerminalNode { return this.getToken(LPCParser.Identifier, 0); }
	public STAR(): TerminalNode[];
	public STAR(i: number): TerminalNode;
	public STAR(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.STAR);
		} else {
			return this.getToken(LPCParser.STAR, i);
		}
	}
	public ASSIGN(): TerminalNode | undefined { return this.tryGetToken(LPCParser.ASSIGN, 0); }
	public expression(): ExpressionContext | undefined {
		return this.tryGetRuleContext(0, ExpressionContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_variableDeclarator; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitVariableDeclarator) {
			return visitor.visitVariableDeclarator(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ParameterListContext extends ParserRuleContext {
	public parameter(): ParameterContext[];
	public parameter(i: number): ParameterContext;
	public parameter(i?: number): ParameterContext | ParameterContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ParameterContext);
		} else {
			return this.getRuleContext(i, ParameterContext);
		}
	}
	public COMMA(): TerminalNode[];
	public COMMA(i: number): TerminalNode;
	public COMMA(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.COMMA);
		} else {
			return this.getToken(LPCParser.COMMA, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_parameterList; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitParameterList) {
			return visitor.visitParameterList(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ParameterContext extends ParserRuleContext {
	public typeSpec(): TypeSpecContext | undefined {
		return this.tryGetRuleContext(0, TypeSpecContext);
	}
	public Identifier(): TerminalNode | undefined { return this.tryGetToken(LPCParser.Identifier, 0); }
	public REF(): TerminalNode | undefined { return this.tryGetToken(LPCParser.REF, 0); }
	public STAR(): TerminalNode[];
	public STAR(i: number): TerminalNode;
	public STAR(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.STAR);
		} else {
			return this.getToken(LPCParser.STAR, i);
		}
	}
	public ELLIPSIS(): TerminalNode | undefined { return this.tryGetToken(LPCParser.ELLIPSIS, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_parameter; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitParameter) {
			return visitor.visitParameter(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class TypeSpecContext extends ParserRuleContext {
	public KW_INT(): TerminalNode | undefined { return this.tryGetToken(LPCParser.KW_INT, 0); }
	public KW_FLOAT(): TerminalNode | undefined { return this.tryGetToken(LPCParser.KW_FLOAT, 0); }
	public KW_STRING(): TerminalNode | undefined { return this.tryGetToken(LPCParser.KW_STRING, 0); }
	public KW_OBJECT(): TerminalNode | undefined { return this.tryGetToken(LPCParser.KW_OBJECT, 0); }
	public KW_MIXED(): TerminalNode | undefined { return this.tryGetToken(LPCParser.KW_MIXED, 0); }
	public KW_MAPPING(): TerminalNode | undefined { return this.tryGetToken(LPCParser.KW_MAPPING, 0); }
	public KW_FUNCTION(): TerminalNode | undefined { return this.tryGetToken(LPCParser.KW_FUNCTION, 0); }
	public KW_BUFFER(): TerminalNode | undefined { return this.tryGetToken(LPCParser.KW_BUFFER, 0); }
	public KW_VOID(): TerminalNode | undefined { return this.tryGetToken(LPCParser.KW_VOID, 0); }
	public KW_STRUCT(): TerminalNode | undefined { return this.tryGetToken(LPCParser.KW_STRUCT, 0); }
	public Identifier(): TerminalNode | undefined { return this.tryGetToken(LPCParser.Identifier, 0); }
	public STAR(): TerminalNode[];
	public STAR(i: number): TerminalNode;
	public STAR(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.STAR);
		} else {
			return this.getToken(LPCParser.STAR, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_typeSpec; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitTypeSpec) {
			return visitor.visitTypeSpec(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class BlockContext extends ParserRuleContext {
	public LBRACE(): TerminalNode { return this.getToken(LPCParser.LBRACE, 0); }
	public RBRACE(): TerminalNode { return this.getToken(LPCParser.RBRACE, 0); }
	public statement(): StatementContext[];
	public statement(i: number): StatementContext;
	public statement(i?: number): StatementContext | StatementContext[] {
		if (i === undefined) {
			return this.getRuleContexts(StatementContext);
		} else {
			return this.getRuleContext(i, StatementContext);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_block; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitBlock) {
			return visitor.visitBlock(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ExprStatementContext extends ParserRuleContext {
	public expression(): ExpressionContext {
		return this.getRuleContext(0, ExpressionContext);
	}
	public SEMI(): TerminalNode { return this.getToken(LPCParser.SEMI, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_exprStatement; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitExprStatement) {
			return visitor.visitExprStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ExpressionContext extends ParserRuleContext {
	public assignmentExpression(): AssignmentExpressionContext[];
	public assignmentExpression(i: number): AssignmentExpressionContext;
	public assignmentExpression(i?: number): AssignmentExpressionContext | AssignmentExpressionContext[] {
		if (i === undefined) {
			return this.getRuleContexts(AssignmentExpressionContext);
		} else {
			return this.getRuleContext(i, AssignmentExpressionContext);
		}
	}
	public COMMA(): TerminalNode[];
	public COMMA(i: number): TerminalNode;
	public COMMA(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.COMMA);
		} else {
			return this.getToken(LPCParser.COMMA, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_expression; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitExpression) {
			return visitor.visitExpression(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class AssignmentExpressionContext extends ParserRuleContext {
	public conditionalExpression(): ConditionalExpressionContext {
		return this.getRuleContext(0, ConditionalExpressionContext);
	}
	public expression(): ExpressionContext | undefined {
		return this.tryGetRuleContext(0, ExpressionContext);
	}
	public ASSIGN(): TerminalNode | undefined { return this.tryGetToken(LPCParser.ASSIGN, 0); }
	public PLUS_ASSIGN(): TerminalNode | undefined { return this.tryGetToken(LPCParser.PLUS_ASSIGN, 0); }
	public MINUS_ASSIGN(): TerminalNode | undefined { return this.tryGetToken(LPCParser.MINUS_ASSIGN, 0); }
	public STAR_ASSIGN(): TerminalNode | undefined { return this.tryGetToken(LPCParser.STAR_ASSIGN, 0); }
	public DIV_ASSIGN(): TerminalNode | undefined { return this.tryGetToken(LPCParser.DIV_ASSIGN, 0); }
	public PERCENT_ASSIGN(): TerminalNode | undefined { return this.tryGetToken(LPCParser.PERCENT_ASSIGN, 0); }
	public BIT_OR_ASSIGN(): TerminalNode | undefined { return this.tryGetToken(LPCParser.BIT_OR_ASSIGN, 0); }
	public BIT_AND_ASSIGN(): TerminalNode | undefined { return this.tryGetToken(LPCParser.BIT_AND_ASSIGN, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_assignmentExpression; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitAssignmentExpression) {
			return visitor.visitAssignmentExpression(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ConditionalExpressionContext extends ParserRuleContext {
	public logicalOrExpression(): LogicalOrExpressionContext {
		return this.getRuleContext(0, LogicalOrExpressionContext);
	}
	public QUESTION(): TerminalNode | undefined { return this.tryGetToken(LPCParser.QUESTION, 0); }
	public expression(): ExpressionContext | undefined {
		return this.tryGetRuleContext(0, ExpressionContext);
	}
	public COLON(): TerminalNode | undefined { return this.tryGetToken(LPCParser.COLON, 0); }
	public conditionalExpression(): ConditionalExpressionContext | undefined {
		return this.tryGetRuleContext(0, ConditionalExpressionContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_conditionalExpression; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitConditionalExpression) {
			return visitor.visitConditionalExpression(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class LogicalOrExpressionContext extends ParserRuleContext {
	public logicalAndExpression(): LogicalAndExpressionContext[];
	public logicalAndExpression(i: number): LogicalAndExpressionContext;
	public logicalAndExpression(i?: number): LogicalAndExpressionContext | LogicalAndExpressionContext[] {
		if (i === undefined) {
			return this.getRuleContexts(LogicalAndExpressionContext);
		} else {
			return this.getRuleContext(i, LogicalAndExpressionContext);
		}
	}
	public OR(): TerminalNode[];
	public OR(i: number): TerminalNode;
	public OR(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.OR);
		} else {
			return this.getToken(LPCParser.OR, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_logicalOrExpression; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitLogicalOrExpression) {
			return visitor.visitLogicalOrExpression(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class LogicalAndExpressionContext extends ParserRuleContext {
	public bitwiseOrExpression(): BitwiseOrExpressionContext[];
	public bitwiseOrExpression(i: number): BitwiseOrExpressionContext;
	public bitwiseOrExpression(i?: number): BitwiseOrExpressionContext | BitwiseOrExpressionContext[] {
		if (i === undefined) {
			return this.getRuleContexts(BitwiseOrExpressionContext);
		} else {
			return this.getRuleContext(i, BitwiseOrExpressionContext);
		}
	}
	public AND(): TerminalNode[];
	public AND(i: number): TerminalNode;
	public AND(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.AND);
		} else {
			return this.getToken(LPCParser.AND, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_logicalAndExpression; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitLogicalAndExpression) {
			return visitor.visitLogicalAndExpression(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class BitwiseOrExpressionContext extends ParserRuleContext {
	public bitwiseXorExpression(): BitwiseXorExpressionContext[];
	public bitwiseXorExpression(i: number): BitwiseXorExpressionContext;
	public bitwiseXorExpression(i?: number): BitwiseXorExpressionContext | BitwiseXorExpressionContext[] {
		if (i === undefined) {
			return this.getRuleContexts(BitwiseXorExpressionContext);
		} else {
			return this.getRuleContext(i, BitwiseXorExpressionContext);
		}
	}
	public BIT_OR(): TerminalNode[];
	public BIT_OR(i: number): TerminalNode;
	public BIT_OR(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.BIT_OR);
		} else {
			return this.getToken(LPCParser.BIT_OR, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_bitwiseOrExpression; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitBitwiseOrExpression) {
			return visitor.visitBitwiseOrExpression(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class BitwiseXorExpressionContext extends ParserRuleContext {
	public bitwiseAndExpression(): BitwiseAndExpressionContext[];
	public bitwiseAndExpression(i: number): BitwiseAndExpressionContext;
	public bitwiseAndExpression(i?: number): BitwiseAndExpressionContext | BitwiseAndExpressionContext[] {
		if (i === undefined) {
			return this.getRuleContexts(BitwiseAndExpressionContext);
		} else {
			return this.getRuleContext(i, BitwiseAndExpressionContext);
		}
	}
	public BIT_XOR(): TerminalNode[];
	public BIT_XOR(i: number): TerminalNode;
	public BIT_XOR(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.BIT_XOR);
		} else {
			return this.getToken(LPCParser.BIT_XOR, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_bitwiseXorExpression; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitBitwiseXorExpression) {
			return visitor.visitBitwiseXorExpression(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class BitwiseAndExpressionContext extends ParserRuleContext {
	public equalityExpression(): EqualityExpressionContext[];
	public equalityExpression(i: number): EqualityExpressionContext;
	public equalityExpression(i?: number): EqualityExpressionContext | EqualityExpressionContext[] {
		if (i === undefined) {
			return this.getRuleContexts(EqualityExpressionContext);
		} else {
			return this.getRuleContext(i, EqualityExpressionContext);
		}
	}
	public BIT_AND(): TerminalNode[];
	public BIT_AND(i: number): TerminalNode;
	public BIT_AND(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.BIT_AND);
		} else {
			return this.getToken(LPCParser.BIT_AND, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_bitwiseAndExpression; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitBitwiseAndExpression) {
			return visitor.visitBitwiseAndExpression(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class EqualityExpressionContext extends ParserRuleContext {
	public relationalExpression(): RelationalExpressionContext[];
	public relationalExpression(i: number): RelationalExpressionContext;
	public relationalExpression(i?: number): RelationalExpressionContext | RelationalExpressionContext[] {
		if (i === undefined) {
			return this.getRuleContexts(RelationalExpressionContext);
		} else {
			return this.getRuleContext(i, RelationalExpressionContext);
		}
	}
	public EQ(): TerminalNode[];
	public EQ(i: number): TerminalNode;
	public EQ(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.EQ);
		} else {
			return this.getToken(LPCParser.EQ, i);
		}
	}
	public NE(): TerminalNode[];
	public NE(i: number): TerminalNode;
	public NE(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.NE);
		} else {
			return this.getToken(LPCParser.NE, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_equalityExpression; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitEqualityExpression) {
			return visitor.visitEqualityExpression(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class RelationalExpressionContext extends ParserRuleContext {
	public shiftExpression(): ShiftExpressionContext[];
	public shiftExpression(i: number): ShiftExpressionContext;
	public shiftExpression(i?: number): ShiftExpressionContext | ShiftExpressionContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ShiftExpressionContext);
		} else {
			return this.getRuleContext(i, ShiftExpressionContext);
		}
	}
	public GT(): TerminalNode[];
	public GT(i: number): TerminalNode;
	public GT(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.GT);
		} else {
			return this.getToken(LPCParser.GT, i);
		}
	}
	public LT(): TerminalNode[];
	public LT(i: number): TerminalNode;
	public LT(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.LT);
		} else {
			return this.getToken(LPCParser.LT, i);
		}
	}
	public GE(): TerminalNode[];
	public GE(i: number): TerminalNode;
	public GE(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.GE);
		} else {
			return this.getToken(LPCParser.GE, i);
		}
	}
	public LE(): TerminalNode[];
	public LE(i: number): TerminalNode;
	public LE(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.LE);
		} else {
			return this.getToken(LPCParser.LE, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_relationalExpression; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitRelationalExpression) {
			return visitor.visitRelationalExpression(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ShiftExpressionContext extends ParserRuleContext {
	public additiveExpression(): AdditiveExpressionContext[];
	public additiveExpression(i: number): AdditiveExpressionContext;
	public additiveExpression(i?: number): AdditiveExpressionContext | AdditiveExpressionContext[] {
		if (i === undefined) {
			return this.getRuleContexts(AdditiveExpressionContext);
		} else {
			return this.getRuleContext(i, AdditiveExpressionContext);
		}
	}
	public SHIFT_LEFT(): TerminalNode[];
	public SHIFT_LEFT(i: number): TerminalNode;
	public SHIFT_LEFT(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.SHIFT_LEFT);
		} else {
			return this.getToken(LPCParser.SHIFT_LEFT, i);
		}
	}
	public SHIFT_RIGHT(): TerminalNode[];
	public SHIFT_RIGHT(i: number): TerminalNode;
	public SHIFT_RIGHT(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.SHIFT_RIGHT);
		} else {
			return this.getToken(LPCParser.SHIFT_RIGHT, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_shiftExpression; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitShiftExpression) {
			return visitor.visitShiftExpression(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class AdditiveExpressionContext extends ParserRuleContext {
	public multiplicativeExpression(): MultiplicativeExpressionContext[];
	public multiplicativeExpression(i: number): MultiplicativeExpressionContext;
	public multiplicativeExpression(i?: number): MultiplicativeExpressionContext | MultiplicativeExpressionContext[] {
		if (i === undefined) {
			return this.getRuleContexts(MultiplicativeExpressionContext);
		} else {
			return this.getRuleContext(i, MultiplicativeExpressionContext);
		}
	}
	public PLUS(): TerminalNode[];
	public PLUS(i: number): TerminalNode;
	public PLUS(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.PLUS);
		} else {
			return this.getToken(LPCParser.PLUS, i);
		}
	}
	public MINUS(): TerminalNode[];
	public MINUS(i: number): TerminalNode;
	public MINUS(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.MINUS);
		} else {
			return this.getToken(LPCParser.MINUS, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_additiveExpression; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitAdditiveExpression) {
			return visitor.visitAdditiveExpression(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class MultiplicativeExpressionContext extends ParserRuleContext {
	public unaryExpression(): UnaryExpressionContext[];
	public unaryExpression(i: number): UnaryExpressionContext;
	public unaryExpression(i?: number): UnaryExpressionContext | UnaryExpressionContext[] {
		if (i === undefined) {
			return this.getRuleContexts(UnaryExpressionContext);
		} else {
			return this.getRuleContext(i, UnaryExpressionContext);
		}
	}
	public STAR(): TerminalNode[];
	public STAR(i: number): TerminalNode;
	public STAR(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.STAR);
		} else {
			return this.getToken(LPCParser.STAR, i);
		}
	}
	public DIV(): TerminalNode[];
	public DIV(i: number): TerminalNode;
	public DIV(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.DIV);
		} else {
			return this.getToken(LPCParser.DIV, i);
		}
	}
	public PERCENT(): TerminalNode[];
	public PERCENT(i: number): TerminalNode;
	public PERCENT(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.PERCENT);
		} else {
			return this.getToken(LPCParser.PERCENT, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_multiplicativeExpression; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitMultiplicativeExpression) {
			return visitor.visitMultiplicativeExpression(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class UnaryExpressionContext extends ParserRuleContext {
	public postfixExpression(): PostfixExpressionContext | undefined {
		return this.tryGetRuleContext(0, PostfixExpressionContext);
	}
	public INC(): TerminalNode | undefined { return this.tryGetToken(LPCParser.INC, 0); }
	public DEC(): TerminalNode | undefined { return this.tryGetToken(LPCParser.DEC, 0); }
	public unaryExpression(): UnaryExpressionContext | undefined {
		return this.tryGetRuleContext(0, UnaryExpressionContext);
	}
	public PLUS(): TerminalNode | undefined { return this.tryGetToken(LPCParser.PLUS, 0); }
	public MINUS(): TerminalNode | undefined { return this.tryGetToken(LPCParser.MINUS, 0); }
	public NOT(): TerminalNode | undefined { return this.tryGetToken(LPCParser.NOT, 0); }
	public BIT_NOT(): TerminalNode | undefined { return this.tryGetToken(LPCParser.BIT_NOT, 0); }
	public STAR(): TerminalNode | undefined { return this.tryGetToken(LPCParser.STAR, 0); }
	public CATCH(): TerminalNode | undefined { return this.tryGetToken(LPCParser.CATCH, 0); }
	public LPAREN(): TerminalNode | undefined { return this.tryGetToken(LPCParser.LPAREN, 0); }
	public expression(): ExpressionContext | undefined {
		return this.tryGetRuleContext(0, ExpressionContext);
	}
	public RPAREN(): TerminalNode | undefined { return this.tryGetToken(LPCParser.RPAREN, 0); }
	public block(): BlockContext | undefined {
		return this.tryGetRuleContext(0, BlockContext);
	}
	public castExpression(): CastExpressionContext | undefined {
		return this.tryGetRuleContext(0, CastExpressionContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_unaryExpression; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitUnaryExpression) {
			return visitor.visitUnaryExpression(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class CastExpressionContext extends ParserRuleContext {
	public LPAREN(): TerminalNode { return this.getToken(LPCParser.LPAREN, 0); }
	public castType(): CastTypeContext {
		return this.getRuleContext(0, CastTypeContext);
	}
	public RPAREN(): TerminalNode { return this.getToken(LPCParser.RPAREN, 0); }
	public unaryExpression(): UnaryExpressionContext {
		return this.getRuleContext(0, UnaryExpressionContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_castExpression; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitCastExpression) {
			return visitor.visitCastExpression(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class CastTypeContext extends ParserRuleContext {
	public KW_INT(): TerminalNode | undefined { return this.tryGetToken(LPCParser.KW_INT, 0); }
	public KW_FLOAT(): TerminalNode | undefined { return this.tryGetToken(LPCParser.KW_FLOAT, 0); }
	public KW_STRING(): TerminalNode | undefined { return this.tryGetToken(LPCParser.KW_STRING, 0); }
	public KW_OBJECT(): TerminalNode | undefined { return this.tryGetToken(LPCParser.KW_OBJECT, 0); }
	public KW_MIXED(): TerminalNode | undefined { return this.tryGetToken(LPCParser.KW_MIXED, 0); }
	public KW_MAPPING(): TerminalNode | undefined { return this.tryGetToken(LPCParser.KW_MAPPING, 0); }
	public KW_FUNCTION(): TerminalNode | undefined { return this.tryGetToken(LPCParser.KW_FUNCTION, 0); }
	public KW_BUFFER(): TerminalNode | undefined { return this.tryGetToken(LPCParser.KW_BUFFER, 0); }
	public KW_VOID(): TerminalNode | undefined { return this.tryGetToken(LPCParser.KW_VOID, 0); }
	public KW_STRUCT(): TerminalNode | undefined { return this.tryGetToken(LPCParser.KW_STRUCT, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_castType; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitCastType) {
			return visitor.visitCastType(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class PostfixExpressionContext extends ParserRuleContext {
	public primary(): PrimaryContext {
		return this.getRuleContext(0, PrimaryContext);
	}
	public LBRACK(): TerminalNode[];
	public LBRACK(i: number): TerminalNode;
	public LBRACK(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.LBRACK);
		} else {
			return this.getToken(LPCParser.LBRACK, i);
		}
	}
	public sliceExpr(): SliceExprContext[];
	public sliceExpr(i: number): SliceExprContext;
	public sliceExpr(i?: number): SliceExprContext | SliceExprContext[] {
		if (i === undefined) {
			return this.getRuleContexts(SliceExprContext);
		} else {
			return this.getRuleContext(i, SliceExprContext);
		}
	}
	public RBRACK(): TerminalNode[];
	public RBRACK(i: number): TerminalNode;
	public RBRACK(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.RBRACK);
		} else {
			return this.getToken(LPCParser.RBRACK, i);
		}
	}
	public INC(): TerminalNode[];
	public INC(i: number): TerminalNode;
	public INC(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.INC);
		} else {
			return this.getToken(LPCParser.INC, i);
		}
	}
	public DEC(): TerminalNode[];
	public DEC(i: number): TerminalNode;
	public DEC(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.DEC);
		} else {
			return this.getToken(LPCParser.DEC, i);
		}
	}
	public Identifier(): TerminalNode[];
	public Identifier(i: number): TerminalNode;
	public Identifier(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.Identifier);
		} else {
			return this.getToken(LPCParser.Identifier, i);
		}
	}
	public LPAREN(): TerminalNode[];
	public LPAREN(i: number): TerminalNode;
	public LPAREN(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.LPAREN);
		} else {
			return this.getToken(LPCParser.LPAREN, i);
		}
	}
	public RPAREN(): TerminalNode[];
	public RPAREN(i: number): TerminalNode;
	public RPAREN(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.RPAREN);
		} else {
			return this.getToken(LPCParser.RPAREN, i);
		}
	}
	public ARROW(): TerminalNode[];
	public ARROW(i: number): TerminalNode;
	public ARROW(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.ARROW);
		} else {
			return this.getToken(LPCParser.ARROW, i);
		}
	}
	public DOT(): TerminalNode[];
	public DOT(i: number): TerminalNode;
	public DOT(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.DOT);
		} else {
			return this.getToken(LPCParser.DOT, i);
		}
	}
	public SCOPE(): TerminalNode[];
	public SCOPE(i: number): TerminalNode;
	public SCOPE(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.SCOPE);
		} else {
			return this.getToken(LPCParser.SCOPE, i);
		}
	}
	public argumentList(): ArgumentListContext[];
	public argumentList(i: number): ArgumentListContext;
	public argumentList(i?: number): ArgumentListContext | ArgumentListContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ArgumentListContext);
		} else {
			return this.getRuleContext(i, ArgumentListContext);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_postfixExpression; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitPostfixExpression) {
			return visitor.visitPostfixExpression(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ArgumentListContext extends ParserRuleContext {
	public assignmentExpression(): AssignmentExpressionContext[];
	public assignmentExpression(i: number): AssignmentExpressionContext;
	public assignmentExpression(i?: number): AssignmentExpressionContext | AssignmentExpressionContext[] {
		if (i === undefined) {
			return this.getRuleContexts(AssignmentExpressionContext);
		} else {
			return this.getRuleContext(i, AssignmentExpressionContext);
		}
	}
	public ELLIPSIS(): TerminalNode[];
	public ELLIPSIS(i: number): TerminalNode;
	public ELLIPSIS(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.ELLIPSIS);
		} else {
			return this.getToken(LPCParser.ELLIPSIS, i);
		}
	}
	public COMMA(): TerminalNode[];
	public COMMA(i: number): TerminalNode;
	public COMMA(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.COMMA);
		} else {
			return this.getToken(LPCParser.COMMA, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_argumentList; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitArgumentList) {
			return visitor.visitArgumentList(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class PrimaryContext extends ParserRuleContext {
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_primary; }
	public copyFrom(ctx: PrimaryContext): void {
		super.copyFrom(ctx);
	}
}
export class ScopeIdentifierContext extends PrimaryContext {
	public SCOPE(): TerminalNode { return this.getToken(LPCParser.SCOPE, 0); }
	public Identifier(): TerminalNode { return this.getToken(LPCParser.Identifier, 0); }
	constructor(ctx: PrimaryContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitScopeIdentifier) {
			return visitor.visitScopeIdentifier(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class StringConcatenationContext extends PrimaryContext {
	public stringConcat(): StringConcatContext {
		return this.getRuleContext(0, StringConcatContext);
	}
	constructor(ctx: PrimaryContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitStringConcatenation) {
			return visitor.visitStringConcatenation(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ClosurePrimaryContext extends PrimaryContext {
	public closureExpr(): ClosureExprContext {
		return this.getRuleContext(0, ClosureExprContext);
	}
	constructor(ctx: PrimaryContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitClosurePrimary) {
			return visitor.visitClosurePrimary(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class MappingLiteralExprContext extends PrimaryContext {
	public mappingLiteral(): MappingLiteralContext {
		return this.getRuleContext(0, MappingLiteralContext);
	}
	constructor(ctx: PrimaryContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitMappingLiteralExpr) {
			return visitor.visitMappingLiteralExpr(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class AnonFunctionContext extends PrimaryContext {
	public KW_FUNCTION(): TerminalNode { return this.getToken(LPCParser.KW_FUNCTION, 0); }
	public LPAREN(): TerminalNode { return this.getToken(LPCParser.LPAREN, 0); }
	public RPAREN(): TerminalNode { return this.getToken(LPCParser.RPAREN, 0); }
	public block(): BlockContext {
		return this.getRuleContext(0, BlockContext);
	}
	public parameterList(): ParameterListContext | undefined {
		return this.tryGetRuleContext(0, ParameterListContext);
	}
	constructor(ctx: PrimaryContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitAnonFunction) {
			return visitor.visitAnonFunction(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class IdentifierPrimaryContext extends PrimaryContext {
	public Identifier(): TerminalNode { return this.getToken(LPCParser.Identifier, 0); }
	constructor(ctx: PrimaryContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitIdentifierPrimary) {
			return visitor.visitIdentifierPrimary(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class IntegerPrimaryContext extends PrimaryContext {
	public INTEGER(): TerminalNode { return this.getToken(LPCParser.INTEGER, 0); }
	constructor(ctx: PrimaryContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitIntegerPrimary) {
			return visitor.visitIntegerPrimary(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class FloatPrimaryContext extends PrimaryContext {
	public FLOAT(): TerminalNode { return this.getToken(LPCParser.FLOAT, 0); }
	constructor(ctx: PrimaryContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitFloatPrimary) {
			return visitor.visitFloatPrimary(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class StringPrimaryContext extends PrimaryContext {
	public STRING_LITERAL(): TerminalNode { return this.getToken(LPCParser.STRING_LITERAL, 0); }
	constructor(ctx: PrimaryContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitStringPrimary) {
			return visitor.visitStringPrimary(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class CharPrimaryContext extends PrimaryContext {
	public CHAR_LITERAL(): TerminalNode { return this.getToken(LPCParser.CHAR_LITERAL, 0); }
	constructor(ctx: PrimaryContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitCharPrimary) {
			return visitor.visitCharPrimary(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ArrayLiteralContext extends PrimaryContext {
	public LPAREN(): TerminalNode { return this.getToken(LPCParser.LPAREN, 0); }
	public LBRACE(): TerminalNode { return this.getToken(LPCParser.LBRACE, 0); }
	public RBRACE(): TerminalNode { return this.getToken(LPCParser.RBRACE, 0); }
	public RPAREN(): TerminalNode { return this.getToken(LPCParser.RPAREN, 0); }
	public expressionList(): ExpressionListContext | undefined {
		return this.tryGetRuleContext(0, ExpressionListContext);
	}
	constructor(ctx: PrimaryContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitArrayLiteral) {
			return visitor.visitArrayLiteral(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ParenExprContext extends PrimaryContext {
	public LPAREN(): TerminalNode { return this.getToken(LPCParser.LPAREN, 0); }
	public expression(): ExpressionContext {
		return this.getRuleContext(0, ExpressionContext);
	}
	public RPAREN(): TerminalNode { return this.getToken(LPCParser.RPAREN, 0); }
	constructor(ctx: PrimaryContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitParenExpr) {
			return visitor.visitParenExpr(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class RefVariableContext extends PrimaryContext {
	public REF(): TerminalNode { return this.getToken(LPCParser.REF, 0); }
	public Identifier(): TerminalNode { return this.getToken(LPCParser.Identifier, 0); }
	constructor(ctx: PrimaryContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitRefVariable) {
			return visitor.visitRefVariable(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class StringConcatContext extends ParserRuleContext {
	public concatItem(): ConcatItemContext[];
	public concatItem(i: number): ConcatItemContext;
	public concatItem(i?: number): ConcatItemContext | ConcatItemContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ConcatItemContext);
		} else {
			return this.getRuleContext(i, ConcatItemContext);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_stringConcat; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitStringConcat) {
			return visitor.visitStringConcat(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ConcatItemContext extends ParserRuleContext {
	public STRING_LITERAL(): TerminalNode | undefined { return this.tryGetToken(LPCParser.STRING_LITERAL, 0); }
	public Identifier(): TerminalNode | undefined { return this.tryGetToken(LPCParser.Identifier, 0); }
	public LPAREN(): TerminalNode | undefined { return this.tryGetToken(LPCParser.LPAREN, 0); }
	public RPAREN(): TerminalNode | undefined { return this.tryGetToken(LPCParser.RPAREN, 0); }
	public argumentList(): ArgumentListContext | undefined {
		return this.tryGetRuleContext(0, ArgumentListContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_concatItem; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitConcatItem) {
			return visitor.visitConcatItem(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class IfStatementContext extends ParserRuleContext {
	public IF(): TerminalNode { return this.getToken(LPCParser.IF, 0); }
	public LPAREN(): TerminalNode { return this.getToken(LPCParser.LPAREN, 0); }
	public expression(): ExpressionContext {
		return this.getRuleContext(0, ExpressionContext);
	}
	public RPAREN(): TerminalNode { return this.getToken(LPCParser.RPAREN, 0); }
	public statement(): StatementContext[];
	public statement(i: number): StatementContext;
	public statement(i?: number): StatementContext | StatementContext[] {
		if (i === undefined) {
			return this.getRuleContexts(StatementContext);
		} else {
			return this.getRuleContext(i, StatementContext);
		}
	}
	public ELSE(): TerminalNode | undefined { return this.tryGetToken(LPCParser.ELSE, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_ifStatement; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitIfStatement) {
			return visitor.visitIfStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class WhileStatementContext extends ParserRuleContext {
	public WHILE(): TerminalNode { return this.getToken(LPCParser.WHILE, 0); }
	public LPAREN(): TerminalNode { return this.getToken(LPCParser.LPAREN, 0); }
	public expression(): ExpressionContext {
		return this.getRuleContext(0, ExpressionContext);
	}
	public RPAREN(): TerminalNode { return this.getToken(LPCParser.RPAREN, 0); }
	public statement(): StatementContext {
		return this.getRuleContext(0, StatementContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_whileStatement; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitWhileStatement) {
			return visitor.visitWhileStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class DoWhileStatementContext extends ParserRuleContext {
	public DO(): TerminalNode { return this.getToken(LPCParser.DO, 0); }
	public statement(): StatementContext {
		return this.getRuleContext(0, StatementContext);
	}
	public WHILE(): TerminalNode { return this.getToken(LPCParser.WHILE, 0); }
	public LPAREN(): TerminalNode { return this.getToken(LPCParser.LPAREN, 0); }
	public expression(): ExpressionContext {
		return this.getRuleContext(0, ExpressionContext);
	}
	public RPAREN(): TerminalNode { return this.getToken(LPCParser.RPAREN, 0); }
	public SEMI(): TerminalNode { return this.getToken(LPCParser.SEMI, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_doWhileStatement; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitDoWhileStatement) {
			return visitor.visitDoWhileStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ForStatementContext extends ParserRuleContext {
	public FOR(): TerminalNode { return this.getToken(LPCParser.FOR, 0); }
	public LPAREN(): TerminalNode { return this.getToken(LPCParser.LPAREN, 0); }
	public SEMI(): TerminalNode[];
	public SEMI(i: number): TerminalNode;
	public SEMI(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.SEMI);
		} else {
			return this.getToken(LPCParser.SEMI, i);
		}
	}
	public RPAREN(): TerminalNode { return this.getToken(LPCParser.RPAREN, 0); }
	public statement(): StatementContext {
		return this.getRuleContext(0, StatementContext);
	}
	public forInit(): ForInitContext | undefined {
		return this.tryGetRuleContext(0, ForInitContext);
	}
	public expression(): ExpressionContext | undefined {
		return this.tryGetRuleContext(0, ExpressionContext);
	}
	public expressionList(): ExpressionListContext | undefined {
		return this.tryGetRuleContext(0, ExpressionListContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_forStatement; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitForStatement) {
			return visitor.visitForStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ForInitContext extends ParserRuleContext {
	public variableDecl(): VariableDeclContext | undefined {
		return this.tryGetRuleContext(0, VariableDeclContext);
	}
	public expressionList(): ExpressionListContext | undefined {
		return this.tryGetRuleContext(0, ExpressionListContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_forInit; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitForInit) {
			return visitor.visitForInit(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ExpressionListContext extends ParserRuleContext {
	public expression(): ExpressionContext[];
	public expression(i: number): ExpressionContext;
	public expression(i?: number): ExpressionContext | ExpressionContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ExpressionContext);
		} else {
			return this.getRuleContext(i, ExpressionContext);
		}
	}
	public COMMA(): TerminalNode[];
	public COMMA(i: number): TerminalNode;
	public COMMA(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.COMMA);
		} else {
			return this.getToken(LPCParser.COMMA, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_expressionList; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitExpressionList) {
			return visitor.visitExpressionList(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ForeachStatementContext extends ParserRuleContext {
	public FOREACH(): TerminalNode { return this.getToken(LPCParser.FOREACH, 0); }
	public LPAREN(): TerminalNode { return this.getToken(LPCParser.LPAREN, 0); }
	public foreachInit(): ForeachInitContext {
		return this.getRuleContext(0, ForeachInitContext);
	}
	public IN(): TerminalNode { return this.getToken(LPCParser.IN, 0); }
	public expression(): ExpressionContext {
		return this.getRuleContext(0, ExpressionContext);
	}
	public RPAREN(): TerminalNode { return this.getToken(LPCParser.RPAREN, 0); }
	public statement(): StatementContext {
		return this.getRuleContext(0, StatementContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_foreachStatement; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitForeachStatement) {
			return visitor.visitForeachStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ForeachInitContext extends ParserRuleContext {
	public foreachVar(): ForeachVarContext[];
	public foreachVar(i: number): ForeachVarContext;
	public foreachVar(i?: number): ForeachVarContext | ForeachVarContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ForeachVarContext);
		} else {
			return this.getRuleContext(i, ForeachVarContext);
		}
	}
	public COMMA(): TerminalNode | undefined { return this.tryGetToken(LPCParser.COMMA, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_foreachInit; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitForeachInit) {
			return visitor.visitForeachInit(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ForeachVarContext extends ParserRuleContext {
	public typeSpec(): TypeSpecContext | undefined {
		return this.tryGetRuleContext(0, TypeSpecContext);
	}
	public Identifier(): TerminalNode { return this.getToken(LPCParser.Identifier, 0); }
	public REF(): TerminalNode | undefined { return this.tryGetToken(LPCParser.REF, 0); }
	public STAR(): TerminalNode[];
	public STAR(i: number): TerminalNode;
	public STAR(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.STAR);
		} else {
			return this.getToken(LPCParser.STAR, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_foreachVar; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitForeachVar) {
			return visitor.visitForeachVar(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class SwitchStatementContext extends ParserRuleContext {
	public SWITCH(): TerminalNode { return this.getToken(LPCParser.SWITCH, 0); }
	public LPAREN(): TerminalNode { return this.getToken(LPCParser.LPAREN, 0); }
	public expression(): ExpressionContext {
		return this.getRuleContext(0, ExpressionContext);
	}
	public RPAREN(): TerminalNode { return this.getToken(LPCParser.RPAREN, 0); }
	public LBRACE(): TerminalNode { return this.getToken(LPCParser.LBRACE, 0); }
	public RBRACE(): TerminalNode { return this.getToken(LPCParser.RBRACE, 0); }
	public switchSection(): SwitchSectionContext[];
	public switchSection(i: number): SwitchSectionContext;
	public switchSection(i?: number): SwitchSectionContext | SwitchSectionContext[] {
		if (i === undefined) {
			return this.getRuleContexts(SwitchSectionContext);
		} else {
			return this.getRuleContext(i, SwitchSectionContext);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_switchStatement; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitSwitchStatement) {
			return visitor.visitSwitchStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class SwitchSectionContext extends ParserRuleContext {
	public switchLabelWithColon(): SwitchLabelWithColonContext[];
	public switchLabelWithColon(i: number): SwitchLabelWithColonContext;
	public switchLabelWithColon(i?: number): SwitchLabelWithColonContext | SwitchLabelWithColonContext[] {
		if (i === undefined) {
			return this.getRuleContexts(SwitchLabelWithColonContext);
		} else {
			return this.getRuleContext(i, SwitchLabelWithColonContext);
		}
	}
	public statement(): StatementContext[];
	public statement(i: number): StatementContext;
	public statement(i?: number): StatementContext | StatementContext[] {
		if (i === undefined) {
			return this.getRuleContexts(StatementContext);
		} else {
			return this.getRuleContext(i, StatementContext);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_switchSection; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitSwitchSection) {
			return visitor.visitSwitchSection(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class SwitchLabelWithColonContext extends ParserRuleContext {
	public CASE(): TerminalNode | undefined { return this.tryGetToken(LPCParser.CASE, 0); }
	public switchLabel(): SwitchLabelContext | undefined {
		return this.tryGetRuleContext(0, SwitchLabelContext);
	}
	public COLON(): TerminalNode { return this.getToken(LPCParser.COLON, 0); }
	public DEFAULT(): TerminalNode | undefined { return this.tryGetToken(LPCParser.DEFAULT, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_switchLabelWithColon; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitSwitchLabelWithColon) {
			return visitor.visitSwitchLabelWithColon(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class SwitchLabelContext extends ParserRuleContext {
	public expression(): ExpressionContext[];
	public expression(i: number): ExpressionContext;
	public expression(i?: number): ExpressionContext | ExpressionContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ExpressionContext);
		} else {
			return this.getRuleContext(i, ExpressionContext);
		}
	}
	public RANGE_OP(): TerminalNode | undefined { return this.tryGetToken(LPCParser.RANGE_OP, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_switchLabel; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitSwitchLabel) {
			return visitor.visitSwitchLabel(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class BreakStatementContext extends ParserRuleContext {
	public BREAK(): TerminalNode { return this.getToken(LPCParser.BREAK, 0); }
	public SEMI(): TerminalNode { return this.getToken(LPCParser.SEMI, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_breakStatement; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitBreakStatement) {
			return visitor.visitBreakStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ContinueStatementContext extends ParserRuleContext {
	public CONTINUE(): TerminalNode { return this.getToken(LPCParser.CONTINUE, 0); }
	public SEMI(): TerminalNode { return this.getToken(LPCParser.SEMI, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_continueStatement; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitContinueStatement) {
			return visitor.visitContinueStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ReturnStatementContext extends ParserRuleContext {
	public RETURN(): TerminalNode { return this.getToken(LPCParser.RETURN, 0); }
	public SEMI(): TerminalNode { return this.getToken(LPCParser.SEMI, 0); }
	public expression(): ExpressionContext | undefined {
		return this.tryGetRuleContext(0, ExpressionContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_returnStatement; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitReturnStatement) {
			return visitor.visitReturnStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ClosureExprContext extends ParserRuleContext {
	public LPAREN(): TerminalNode { return this.getToken(LPCParser.LPAREN, 0); }
	public COLON(): TerminalNode[];
	public COLON(i: number): TerminalNode;
	public COLON(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.COLON);
		} else {
			return this.getToken(LPCParser.COLON, i);
		}
	}
	public RPAREN(): TerminalNode { return this.getToken(LPCParser.RPAREN, 0); }
	public expression(): ExpressionContext | undefined {
		return this.tryGetRuleContext(0, ExpressionContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_closureExpr; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitClosureExpr) {
			return visitor.visitClosureExpr(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class InheritStatementContext extends ParserRuleContext {
	public INHERIT(): TerminalNode { return this.getToken(LPCParser.INHERIT, 0); }
	public expression(): ExpressionContext {
		return this.getRuleContext(0, ExpressionContext);
	}
	public SEMI(): TerminalNode { return this.getToken(LPCParser.SEMI, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_inheritStatement; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitInheritStatement) {
			return visitor.visitInheritStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class IncludeStatementContext extends ParserRuleContext {
	public INCLUDE(): TerminalNode { return this.getToken(LPCParser.INCLUDE, 0); }
	public expression(): ExpressionContext {
		return this.getRuleContext(0, ExpressionContext);
	}
	public SEMI(): TerminalNode { return this.getToken(LPCParser.SEMI, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_includeStatement; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitIncludeStatement) {
			return visitor.visitIncludeStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class MacroInvokeContext extends ParserRuleContext {
	public Identifier(): TerminalNode { return this.getToken(LPCParser.Identifier, 0); }
	public LPAREN(): TerminalNode { return this.getToken(LPCParser.LPAREN, 0); }
	public RPAREN(): TerminalNode { return this.getToken(LPCParser.RPAREN, 0); }
	public argumentList(): ArgumentListContext | undefined {
		return this.tryGetRuleContext(0, ArgumentListContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_macroInvoke; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitMacroInvoke) {
			return visitor.visitMacroInvoke(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class PrototypeStatementContext extends ParserRuleContext {
	public Identifier(): TerminalNode { return this.getToken(LPCParser.Identifier, 0); }
	public LPAREN(): TerminalNode { return this.getToken(LPCParser.LPAREN, 0); }
	public RPAREN(): TerminalNode { return this.getToken(LPCParser.RPAREN, 0); }
	public SEMI(): TerminalNode { return this.getToken(LPCParser.SEMI, 0); }
	public MODIFIER(): TerminalNode[];
	public MODIFIER(i: number): TerminalNode;
	public MODIFIER(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.MODIFIER);
		} else {
			return this.getToken(LPCParser.MODIFIER, i);
		}
	}
	public typeSpec(): TypeSpecContext | undefined {
		return this.tryGetRuleContext(0, TypeSpecContext);
	}
	public STAR(): TerminalNode[];
	public STAR(i: number): TerminalNode;
	public STAR(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.STAR);
		} else {
			return this.getToken(LPCParser.STAR, i);
		}
	}
	public parameterList(): ParameterListContext | undefined {
		return this.tryGetRuleContext(0, ParameterListContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_prototypeStatement; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitPrototypeStatement) {
			return visitor.visitPrototypeStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class MappingLiteralContext extends ParserRuleContext {
	public LPAREN(): TerminalNode { return this.getToken(LPCParser.LPAREN, 0); }
	public LBRACK(): TerminalNode { return this.getToken(LPCParser.LBRACK, 0); }
	public RBRACK(): TerminalNode { return this.getToken(LPCParser.RBRACK, 0); }
	public RPAREN(): TerminalNode { return this.getToken(LPCParser.RPAREN, 0); }
	public mappingPairList(): MappingPairListContext | undefined {
		return this.tryGetRuleContext(0, MappingPairListContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_mappingLiteral; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitMappingLiteral) {
			return visitor.visitMappingLiteral(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class MappingPairListContext extends ParserRuleContext {
	public mappingPair(): MappingPairContext[];
	public mappingPair(i: number): MappingPairContext;
	public mappingPair(i?: number): MappingPairContext | MappingPairContext[] {
		if (i === undefined) {
			return this.getRuleContexts(MappingPairContext);
		} else {
			return this.getRuleContext(i, MappingPairContext);
		}
	}
	public COMMA(): TerminalNode[];
	public COMMA(i: number): TerminalNode;
	public COMMA(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.COMMA);
		} else {
			return this.getToken(LPCParser.COMMA, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_mappingPairList; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitMappingPairList) {
			return visitor.visitMappingPairList(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class MappingPairContext extends ParserRuleContext {
	public expression(): ExpressionContext[];
	public expression(i: number): ExpressionContext;
	public expression(i?: number): ExpressionContext | ExpressionContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ExpressionContext);
		} else {
			return this.getRuleContext(i, ExpressionContext);
		}
	}
	public COLON(): TerminalNode { return this.getToken(LPCParser.COLON, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_mappingPair; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitMappingPair) {
			return visitor.visitMappingPair(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class SliceExprContext extends ParserRuleContext {
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_sliceExpr; }
	public copyFrom(ctx: SliceExprContext): void {
		super.copyFrom(ctx);
	}
}
export class TailIndexOnlyContext extends SliceExprContext {
	public LT(): TerminalNode { return this.getToken(LPCParser.LT, 0); }
	public expression(): ExpressionContext {
		return this.getRuleContext(0, ExpressionContext);
	}
	constructor(ctx: SliceExprContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitTailIndexOnly) {
			return visitor.visitTailIndexOnly(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class HeadRangeContext extends SliceExprContext {
	public expression(): ExpressionContext[];
	public expression(i: number): ExpressionContext;
	public expression(i?: number): ExpressionContext | ExpressionContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ExpressionContext);
		} else {
			return this.getRuleContext(i, ExpressionContext);
		}
	}
	public RANGE_OP(): TerminalNode { return this.getToken(LPCParser.RANGE_OP, 0); }
	public LT(): TerminalNode | undefined { return this.tryGetToken(LPCParser.LT, 0); }
	constructor(ctx: SliceExprContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitHeadRange) {
			return visitor.visitHeadRange(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class OpenRangeContext extends SliceExprContext {
	public RANGE_OP(): TerminalNode { return this.getToken(LPCParser.RANGE_OP, 0); }
	public LT(): TerminalNode | undefined { return this.tryGetToken(LPCParser.LT, 0); }
	public expression(): ExpressionContext | undefined {
		return this.tryGetRuleContext(0, ExpressionContext);
	}
	constructor(ctx: SliceExprContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitOpenRange) {
			return visitor.visitOpenRange(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class SingleIndexContext extends SliceExprContext {
	public expression(): ExpressionContext {
		return this.getRuleContext(0, ExpressionContext);
	}
	constructor(ctx: SliceExprContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitSingleIndex) {
			return visitor.visitSingleIndex(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class TailHeadRangeContext extends SliceExprContext {
	public LT(): TerminalNode[];
	public LT(i: number): TerminalNode;
	public LT(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.LT);
		} else {
			return this.getToken(LPCParser.LT, i);
		}
	}
	public expression(): ExpressionContext[];
	public expression(i: number): ExpressionContext;
	public expression(i?: number): ExpressionContext | ExpressionContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ExpressionContext);
		} else {
			return this.getRuleContext(i, ExpressionContext);
		}
	}
	public RANGE_OP(): TerminalNode { return this.getToken(LPCParser.RANGE_OP, 0); }
	constructor(ctx: SliceExprContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitTailHeadRange) {
			return visitor.visitTailHeadRange(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


