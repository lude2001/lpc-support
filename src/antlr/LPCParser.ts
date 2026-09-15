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
	public static readonly ARRAY_DELIMITER_START = 6;
	public static readonly HEREDOC_END = 7;
	public static readonly ARRAY_DELIMITER_END = 8;
	public static readonly WS = 9;
	public static readonly LINE_COMMENT = 10;
	public static readonly BLOCK_COMMENT = 11;
	public static readonly DIRECTIVE = 12;
	public static readonly IF = 13;
	public static readonly ELSE = 14;
	public static readonly FOR = 15;
	public static readonly WHILE = 16;
	public static readonly DO = 17;
	public static readonly SWITCH = 18;
	public static readonly CASE = 19;
	public static readonly DEFAULT = 20;
	public static readonly BREAK = 21;
	public static readonly CONTINUE = 22;
	public static readonly RETURN = 23;
	public static readonly FOREACH = 24;
	public static readonly INHERIT = 25;
	public static readonly INCLUDE = 26;
	public static readonly CATCH = 27;
	public static readonly REF = 28;
	public static readonly IN = 29;
	public static readonly KW_INT = 30;
	public static readonly KW_FLOAT = 31;
	public static readonly KW_STRING = 32;
	public static readonly KW_OBJECT = 33;
	public static readonly KW_MIXED = 34;
	public static readonly KW_MAPPING = 35;
	public static readonly KW_FUNCTION = 36;
	public static readonly KW_BUFFER = 37;
	public static readonly KW_VOID = 38;
	public static readonly KW_STRUCT = 39;
	public static readonly KW_CLASS = 40;
	public static readonly KW_ARRAY = 41;
	public static readonly KW_CLOSURE = 42;
	public static readonly KW_TREE = 43;
	public static readonly KW_NEW = 44;
	public static readonly KW_EFUN = 45;
	public static readonly ELLIPSIS = 46;
	public static readonly RANGE_OP = 47;
	public static readonly ARROW = 48;
	public static readonly DOT = 49;
	public static readonly INC = 50;
	public static readonly DEC = 51;
	public static readonly SHIFT_LEFT_ASSIGN = 52;
	public static readonly SHIFT_RIGHT_ASSIGN = 53;
	public static readonly NULLISH_ASSIGN = 54;
	public static readonly LOGICAL_OR_ASSIGN = 55;
	public static readonly LOGICAL_AND_ASSIGN = 56;
	public static readonly PLUS_ASSIGN = 57;
	public static readonly MINUS_ASSIGN = 58;
	public static readonly STAR_ASSIGN = 59;
	public static readonly DIV_ASSIGN = 60;
	public static readonly PERCENT_ASSIGN = 61;
	public static readonly BIT_XOR_ASSIGN = 62;
	public static readonly PLUS = 63;
	public static readonly MINUS = 64;
	public static readonly STAR = 65;
	public static readonly DIV = 66;
	public static readonly PERCENT = 67;
	public static readonly SCOPE = 68;
	public static readonly SEMI = 69;
	public static readonly COMMA = 70;
	public static readonly LPAREN = 71;
	public static readonly RPAREN = 72;
	public static readonly LBRACE = 73;
	public static readonly RBRACE = 74;
	public static readonly LBRACK = 75;
	public static readonly RBRACK = 76;
	public static readonly NULLISH = 77;
	public static readonly QUESTION = 78;
	public static readonly COLON = 79;
	public static readonly DOLLAR = 80;
	public static readonly GT = 81;
	public static readonly LT = 82;
	public static readonly GE = 83;
	public static readonly LE = 84;
	public static readonly EQ = 85;
	public static readonly NE = 86;
	public static readonly ASSIGN = 87;
	public static readonly NOT = 88;
	public static readonly AND = 89;
	public static readonly OR = 90;
	public static readonly SHIFT_LEFT = 91;
	public static readonly SHIFT_RIGHT = 92;
	public static readonly BIT_AND = 93;
	public static readonly BIT_OR = 94;
	public static readonly BIT_XOR = 95;
	public static readonly BIT_NOT = 96;
	public static readonly BIT_OR_ASSIGN = 97;
	public static readonly BIT_AND_ASSIGN = 98;
	public static readonly MODIFIER = 99;
	public static readonly PARAMETER_PLACEHOLDER = 100;
	public static readonly Identifier = 101;
	public static readonly RULE_sourceFile = 0;
	public static readonly RULE_statement = 1;
	public static readonly RULE_functionDef = 2;
	public static readonly RULE_modifierSection = 3;
	public static readonly RULE_variableDecl = 4;
	public static readonly RULE_variableDeclarator = 5;
	public static readonly RULE_parameterList = 6;
	public static readonly RULE_parameter = 7;
	public static readonly RULE_parameterDefault = 8;
	public static readonly RULE_structDef = 9;
	public static readonly RULE_classDef = 10;
	public static readonly RULE_structMemberList = 11;
	public static readonly RULE_structMember = 12;
	public static readonly RULE_typeSpec = 13;
	public static readonly RULE_block = 14;
	public static readonly RULE_exprStatement = 15;
	public static readonly RULE_expression = 16;
	public static readonly RULE_assignmentExpression = 17;
	public static readonly RULE_conditionalExpression = 18;
	public static readonly RULE_nullishExpression = 19;
	public static readonly RULE_logicalOrExpression = 20;
	public static readonly RULE_logicalAndExpression = 21;
	public static readonly RULE_bitwiseOrExpression = 22;
	public static readonly RULE_bitwiseXorExpression = 23;
	public static readonly RULE_bitwiseAndExpression = 24;
	public static readonly RULE_equalityExpression = 25;
	public static readonly RULE_relationalExpression = 26;
	public static readonly RULE_shiftExpression = 27;
	public static readonly RULE_additiveExpression = 28;
	public static readonly RULE_multiplicativeExpression = 29;
	public static readonly RULE_unaryExpression = 30;
	public static readonly RULE_castExpression = 31;
	public static readonly RULE_castType = 32;
	public static readonly RULE_castBaseType = 33;
	public static readonly RULE_postfixExpression = 34;
	public static readonly RULE_argumentList = 35;
	public static readonly RULE_primary = 36;
	public static readonly RULE_stringConcat = 37;
	public static readonly RULE_concatItem = 38;
	public static readonly RULE_ifStatement = 39;
	public static readonly RULE_whileStatement = 40;
	public static readonly RULE_doWhileStatement = 41;
	public static readonly RULE_forStatement = 42;
	public static readonly RULE_forInit = 43;
	public static readonly RULE_expressionList = 44;
	public static readonly RULE_spreadElement = 45;
	public static readonly RULE_foreachStatement = 46;
	public static readonly RULE_foreachInit = 47;
	public static readonly RULE_foreachVar = 48;
	public static readonly RULE_switchStatement = 49;
	public static readonly RULE_switchSection = 50;
	public static readonly RULE_switchLabelWithColon = 51;
	public static readonly RULE_switchLabel = 52;
	public static readonly RULE_breakStatement = 53;
	public static readonly RULE_continueStatement = 54;
	public static readonly RULE_returnStatement = 55;
	public static readonly RULE_closureExpr = 56;
	public static readonly RULE_closureArgumentList = 57;
	public static readonly RULE_closureArgument = 58;
	public static readonly RULE_inheritStatement = 59;
	public static readonly RULE_includeStatement = 60;
	public static readonly RULE_macroInvoke = 61;
	public static readonly RULE_prototypeStatement = 62;
	public static readonly RULE_mappingLiteral = 63;
	public static readonly RULE_mappingPairList = 64;
	public static readonly RULE_mappingPair = 65;
	public static readonly RULE_newExpression = 66;
	public static readonly RULE_structInitializerList = 67;
	public static readonly RULE_structInitializer = 68;
	public static readonly RULE_sliceExpr = 69;
	public static readonly RULE_arrayDelimiterLiteral = 70;
	public static readonly RULE_arrayDelimiterContent = 71;
	public static readonly RULE_arrayDelimiterElement = 72;
	// tslint:disable:no-trailing-whitespace
	public static readonly ruleNames: string[] = [
		"sourceFile", "statement", "functionDef", "modifierSection", "variableDecl", 
		"variableDeclarator", "parameterList", "parameter", "parameterDefault", 
		"structDef", "classDef", "structMemberList", "structMember", "typeSpec", 
		"block", "exprStatement", "expression", "assignmentExpression", "conditionalExpression", 
		"nullishExpression", "logicalOrExpression", "logicalAndExpression", "bitwiseOrExpression", 
		"bitwiseXorExpression", "bitwiseAndExpression", "equalityExpression", 
		"relationalExpression", "shiftExpression", "additiveExpression", "multiplicativeExpression", 
		"unaryExpression", "castExpression", "castType", "castBaseType", "postfixExpression", 
		"argumentList", "primary", "stringConcat", "concatItem", "ifStatement", 
		"whileStatement", "doWhileStatement", "forStatement", "forInit", "expressionList", 
		"spreadElement", "foreachStatement", "foreachInit", "foreachVar", "switchStatement", 
		"switchSection", "switchLabelWithColon", "switchLabel", "breakStatement", 
		"continueStatement", "returnStatement", "closureExpr", "closureArgumentList", 
		"closureArgument", "inheritStatement", "includeStatement", "macroInvoke", 
		"prototypeStatement", "mappingLiteral", "mappingPairList", "mappingPair", 
		"newExpression", "structInitializerList", "structInitializer", "sliceExpr", 
		"arrayDelimiterLiteral", "arrayDelimiterContent", "arrayDelimiterElement",
	];

	private static readonly _LITERAL_NAMES: Array<string | undefined> = [
		undefined, undefined, undefined, undefined, undefined, undefined, undefined, 
		undefined, undefined, undefined, undefined, undefined, undefined, "'if'", 
		"'else'", "'for'", "'while'", "'do'", "'switch'", "'case'", "'default'", 
		"'break'", "'continue'", "'return'", "'foreach'", "'inherit'", "'include'", 
		"'catch'", "'ref'", "'in'", "'int'", "'float'", "'string'", "'object'", 
		"'mixed'", "'mapping'", "'function'", "'buffer'", "'void'", "'struct'", 
		"'class'", "'array'", "'closure'", "'__TREE__'", "'new'", "'efun'", "'...'", 
		"'..'", "'->'", "'.'", "'++'", "'--'", "'<<='", "'>>='", "'??='", "'||='", 
		"'&&='", "'+='", "'-='", "'*='", "'/='", "'%='", "'^='", "'+'", "'-'", 
		"'*'", "'/'", "'%'", "'::'", "';'", "','", "'('", "')'", "'{'", "'}'", 
		"'['", "']'", "'??'", "'?'", "':'", "'$'", "'>'", "'<'", "'>='", "'<='", 
		"'=='", "'!='", "'='", "'!'", "'&&'", "'||'", "'<<'", "'>>'", "'&'", "'|'", 
		"'^'", "'~'", "'|='", "'&='",
	];
	private static readonly _SYMBOLIC_NAMES: Array<string | undefined> = [
		undefined, "INTEGER", "FLOAT", "CHAR_LITERAL", "STRING_LITERAL", "HEREDOC_START", 
		"ARRAY_DELIMITER_START", "HEREDOC_END", "ARRAY_DELIMITER_END", "WS", "LINE_COMMENT", 
		"BLOCK_COMMENT", "DIRECTIVE", "IF", "ELSE", "FOR", "WHILE", "DO", "SWITCH", 
		"CASE", "DEFAULT", "BREAK", "CONTINUE", "RETURN", "FOREACH", "INHERIT", 
		"INCLUDE", "CATCH", "REF", "IN", "KW_INT", "KW_FLOAT", "KW_STRING", "KW_OBJECT", 
		"KW_MIXED", "KW_MAPPING", "KW_FUNCTION", "KW_BUFFER", "KW_VOID", "KW_STRUCT", 
		"KW_CLASS", "KW_ARRAY", "KW_CLOSURE", "KW_TREE", "KW_NEW", "KW_EFUN", 
		"ELLIPSIS", "RANGE_OP", "ARROW", "DOT", "INC", "DEC", "SHIFT_LEFT_ASSIGN", 
		"SHIFT_RIGHT_ASSIGN", "NULLISH_ASSIGN", "LOGICAL_OR_ASSIGN", "LOGICAL_AND_ASSIGN", 
		"PLUS_ASSIGN", "MINUS_ASSIGN", "STAR_ASSIGN", "DIV_ASSIGN", "PERCENT_ASSIGN", 
		"BIT_XOR_ASSIGN", "PLUS", "MINUS", "STAR", "DIV", "PERCENT", "SCOPE", 
		"SEMI", "COMMA", "LPAREN", "RPAREN", "LBRACE", "RBRACE", "LBRACK", "RBRACK", 
		"NULLISH", "QUESTION", "COLON", "DOLLAR", "GT", "LT", "GE", "LE", "EQ", 
		"NE", "ASSIGN", "NOT", "AND", "OR", "SHIFT_LEFT", "SHIFT_RIGHT", "BIT_AND", 
		"BIT_OR", "BIT_XOR", "BIT_NOT", "BIT_OR_ASSIGN", "BIT_AND_ASSIGN", "MODIFIER", 
		"PARAMETER_PLACEHOLDER", "Identifier",
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
			this.state = 149;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.IF) | (1 << LPCParser.FOR) | (1 << LPCParser.WHILE) | (1 << LPCParser.DO) | (1 << LPCParser.SWITCH) | (1 << LPCParser.BREAK) | (1 << LPCParser.CONTINUE) | (1 << LPCParser.RETURN) | (1 << LPCParser.FOREACH) | (1 << LPCParser.INHERIT) | (1 << LPCParser.INCLUDE) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF) | (1 << LPCParser.KW_INT) | (1 << LPCParser.KW_FLOAT))) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & ((1 << (LPCParser.KW_STRING - 32)) | (1 << (LPCParser.KW_OBJECT - 32)) | (1 << (LPCParser.KW_MIXED - 32)) | (1 << (LPCParser.KW_MAPPING - 32)) | (1 << (LPCParser.KW_FUNCTION - 32)) | (1 << (LPCParser.KW_BUFFER - 32)) | (1 << (LPCParser.KW_VOID - 32)) | (1 << (LPCParser.KW_STRUCT - 32)) | (1 << (LPCParser.KW_CLASS - 32)) | (1 << (LPCParser.KW_ARRAY - 32)) | (1 << (LPCParser.KW_CLOSURE - 32)) | (1 << (LPCParser.KW_TREE - 32)) | (1 << (LPCParser.KW_NEW - 32)) | (1 << (LPCParser.KW_EFUN - 32)) | (1 << (LPCParser.INC - 32)) | (1 << (LPCParser.DEC - 32)) | (1 << (LPCParser.PLUS - 32)))) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & ((1 << (LPCParser.MINUS - 64)) | (1 << (LPCParser.STAR - 64)) | (1 << (LPCParser.SCOPE - 64)) | (1 << (LPCParser.SEMI - 64)) | (1 << (LPCParser.LPAREN - 64)) | (1 << (LPCParser.LBRACE - 64)) | (1 << (LPCParser.DOLLAR - 64)) | (1 << (LPCParser.NOT - 64)))) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & ((1 << (LPCParser.BIT_NOT - 96)) | (1 << (LPCParser.MODIFIER - 96)) | (1 << (LPCParser.PARAMETER_PLACEHOLDER - 96)) | (1 << (LPCParser.Identifier - 96)))) !== 0)) {
				{
				{
				this.state = 146;
				this.statement();
				}
				}
				this.state = 151;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 152;
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
			this.state = 180;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 2, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 154;
				this.functionDef();
				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 155;
				this.modifierSection();
				}
				break;

			case 3:
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 156;
				this.variableDecl();
				this.state = 157;
				this.match(LPCParser.SEMI);
				}
				break;

			case 4:
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 159;
				this.structDef();
				}
				break;

			case 5:
				this.enterOuterAlt(_localctx, 5);
				{
				this.state = 160;
				this.classDef();
				}
				break;

			case 6:
				this.enterOuterAlt(_localctx, 6);
				{
				this.state = 161;
				this.macroInvoke();
				this.state = 163;
				this._errHandler.sync(this);
				switch ( this.interpreter.adaptivePredict(this._input, 1, this._ctx) ) {
				case 1:
					{
					this.state = 162;
					this.match(LPCParser.SEMI);
					}
					break;
				}
				}
				break;

			case 7:
				this.enterOuterAlt(_localctx, 7);
				{
				this.state = 165;
				this.ifStatement();
				}
				break;

			case 8:
				this.enterOuterAlt(_localctx, 8);
				{
				this.state = 166;
				this.whileStatement();
				}
				break;

			case 9:
				this.enterOuterAlt(_localctx, 9);
				{
				this.state = 167;
				this.forStatement();
				}
				break;

			case 10:
				this.enterOuterAlt(_localctx, 10);
				{
				this.state = 168;
				this.doWhileStatement();
				}
				break;

			case 11:
				this.enterOuterAlt(_localctx, 11);
				{
				this.state = 169;
				this.foreachStatement();
				}
				break;

			case 12:
				this.enterOuterAlt(_localctx, 12);
				{
				this.state = 170;
				this.switchStatement();
				}
				break;

			case 13:
				this.enterOuterAlt(_localctx, 13);
				{
				this.state = 171;
				this.breakStatement();
				}
				break;

			case 14:
				this.enterOuterAlt(_localctx, 14);
				{
				this.state = 172;
				this.continueStatement();
				}
				break;

			case 15:
				this.enterOuterAlt(_localctx, 15);
				{
				this.state = 173;
				this.returnStatement();
				}
				break;

			case 16:
				this.enterOuterAlt(_localctx, 16);
				{
				this.state = 174;
				this.inheritStatement();
				}
				break;

			case 17:
				this.enterOuterAlt(_localctx, 17);
				{
				this.state = 175;
				this.includeStatement();
				}
				break;

			case 18:
				this.enterOuterAlt(_localctx, 18);
				{
				this.state = 176;
				this.block();
				}
				break;

			case 19:
				this.enterOuterAlt(_localctx, 19);
				{
				this.state = 177;
				this.exprStatement();
				}
				break;

			case 20:
				this.enterOuterAlt(_localctx, 20);
				{
				this.state = 178;
				this.prototypeStatement();
				}
				break;

			case 21:
				this.enterOuterAlt(_localctx, 21);
				{
				this.state = 179;
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
			this.state = 185;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.MODIFIER) {
				{
				{
				this.state = 182;
				this.match(LPCParser.MODIFIER);
				}
				}
				this.state = 187;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 189;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 4, this._ctx) ) {
			case 1:
				{
				this.state = 188;
				this.typeSpec();
				}
				break;
			}
			this.state = 194;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.STAR) {
				{
				{
				this.state = 191;
				this.match(LPCParser.STAR);
				}
				}
				this.state = 196;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 197;
			this.match(LPCParser.Identifier);
			this.state = 198;
			this.match(LPCParser.LPAREN);
			this.state = 200;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & ((1 << (LPCParser.REF - 28)) | (1 << (LPCParser.KW_INT - 28)) | (1 << (LPCParser.KW_FLOAT - 28)) | (1 << (LPCParser.KW_STRING - 28)) | (1 << (LPCParser.KW_OBJECT - 28)) | (1 << (LPCParser.KW_MIXED - 28)) | (1 << (LPCParser.KW_MAPPING - 28)) | (1 << (LPCParser.KW_FUNCTION - 28)) | (1 << (LPCParser.KW_BUFFER - 28)) | (1 << (LPCParser.KW_VOID - 28)) | (1 << (LPCParser.KW_STRUCT - 28)) | (1 << (LPCParser.KW_CLASS - 28)) | (1 << (LPCParser.KW_ARRAY - 28)) | (1 << (LPCParser.KW_CLOSURE - 28)) | (1 << (LPCParser.KW_TREE - 28)))) !== 0) || _la === LPCParser.STAR || _la === LPCParser.Identifier) {
				{
				this.state = 199;
				this.parameterList();
				}
			}

			this.state = 202;
			this.match(LPCParser.RPAREN);
			this.state = 203;
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
	public modifierSection(): ModifierSectionContext {
		let _localctx: ModifierSectionContext = new ModifierSectionContext(this._ctx, this.state);
		this.enterRule(_localctx, 6, LPCParser.RULE_modifierSection);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 206;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 205;
				this.match(LPCParser.MODIFIER);
				}
				}
				this.state = 208;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while (_la === LPCParser.MODIFIER);
			this.state = 210;
			this.match(LPCParser.COLON);
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
		this.enterRule(_localctx, 8, LPCParser.RULE_variableDecl);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 215;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.MODIFIER) {
				{
				{
				this.state = 212;
				this.match(LPCParser.MODIFIER);
				}
				}
				this.state = 217;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 218;
			this.typeSpec();
			this.state = 219;
			this.variableDeclarator();
			this.state = 224;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.COMMA) {
				{
				{
				this.state = 220;
				this.match(LPCParser.COMMA);
				this.state = 221;
				this.variableDeclarator();
				}
				}
				this.state = 226;
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
		this.enterRule(_localctx, 10, LPCParser.RULE_variableDeclarator);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 230;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.STAR) {
				{
				{
				this.state = 227;
				this.match(LPCParser.STAR);
				}
				}
				this.state = 232;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 233;
			this.match(LPCParser.Identifier);
			this.state = 236;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === LPCParser.ASSIGN) {
				{
				this.state = 234;
				this.match(LPCParser.ASSIGN);
				this.state = 235;
				this.assignmentExpression();
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
		this.enterRule(_localctx, 12, LPCParser.RULE_parameterList);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 238;
			this.parameter();
			this.state = 243;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.COMMA) {
				{
				{
				this.state = 239;
				this.match(LPCParser.COMMA);
				this.state = 240;
				this.parameter();
				}
				}
				this.state = 245;
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
		this.enterRule(_localctx, 14, LPCParser.RULE_parameter);
		let _la: number;
		try {
			this.state = 323;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 29, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 246;
				this.typeSpec();
				this.state = 248;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.REF) {
					{
					this.state = 247;
					this.match(LPCParser.REF);
					}
				}

				this.state = 253;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === LPCParser.STAR) {
					{
					{
					this.state = 250;
					this.match(LPCParser.STAR);
					}
					}
					this.state = 255;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 256;
				this.match(LPCParser.Identifier);
				this.state = 258;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.ELLIPSIS) {
					{
					this.state = 257;
					this.match(LPCParser.ELLIPSIS);
					}
				}

				this.state = 261;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.COLON) {
					{
					this.state = 260;
					this.parameterDefault();
					}
				}

				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 263;
				this.typeSpec();
				this.state = 265;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.REF) {
					{
					this.state = 264;
					this.match(LPCParser.REF);
					}
				}

				this.state = 270;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === LPCParser.STAR) {
					{
					{
					this.state = 267;
					this.match(LPCParser.STAR);
					}
					}
					this.state = 272;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
				break;

			case 3:
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 273;
				this.match(LPCParser.REF);
				this.state = 274;
				this.typeSpec();
				this.state = 278;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === LPCParser.STAR) {
					{
					{
					this.state = 275;
					this.match(LPCParser.STAR);
					}
					}
					this.state = 280;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 281;
				this.match(LPCParser.Identifier);
				this.state = 283;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.ELLIPSIS) {
					{
					this.state = 282;
					this.match(LPCParser.ELLIPSIS);
					}
				}

				this.state = 286;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.COLON) {
					{
					this.state = 285;
					this.parameterDefault();
					}
				}

				}
				break;

			case 4:
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 288;
				this.match(LPCParser.REF);
				this.state = 289;
				this.typeSpec();
				this.state = 293;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === LPCParser.STAR) {
					{
					{
					this.state = 290;
					this.match(LPCParser.STAR);
					}
					}
					this.state = 295;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
				break;

			case 5:
				this.enterOuterAlt(_localctx, 5);
				{
				this.state = 296;
				this.match(LPCParser.REF);
				this.state = 300;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === LPCParser.STAR) {
					{
					{
					this.state = 297;
					this.match(LPCParser.STAR);
					}
					}
					this.state = 302;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 303;
				this.match(LPCParser.Identifier);
				this.state = 305;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.ELLIPSIS) {
					{
					this.state = 304;
					this.match(LPCParser.ELLIPSIS);
					}
				}

				this.state = 308;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.COLON) {
					{
					this.state = 307;
					this.parameterDefault();
					}
				}

				}
				break;

			case 6:
				this.enterOuterAlt(_localctx, 6);
				{
				this.state = 313;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === LPCParser.STAR) {
					{
					{
					this.state = 310;
					this.match(LPCParser.STAR);
					}
					}
					this.state = 315;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 316;
				this.match(LPCParser.Identifier);
				this.state = 318;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.ELLIPSIS) {
					{
					this.state = 317;
					this.match(LPCParser.ELLIPSIS);
					}
				}

				this.state = 321;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.COLON) {
					{
					this.state = 320;
					this.parameterDefault();
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
	public parameterDefault(): ParameterDefaultContext {
		let _localctx: ParameterDefaultContext = new ParameterDefaultContext(this._ctx, this.state);
		this.enterRule(_localctx, 16, LPCParser.RULE_parameterDefault);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 325;
			this.match(LPCParser.COLON);
			this.state = 326;
			this.closureExpr();
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
	public structDef(): StructDefContext {
		let _localctx: StructDefContext = new StructDefContext(this._ctx, this.state);
		this.enterRule(_localctx, 18, LPCParser.RULE_structDef);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 328;
			this.match(LPCParser.KW_STRUCT);
			this.state = 329;
			this.match(LPCParser.Identifier);
			this.state = 330;
			this.match(LPCParser.LBRACE);
			this.state = 332;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 30)) & ~0x1F) === 0 && ((1 << (_la - 30)) & ((1 << (LPCParser.KW_INT - 30)) | (1 << (LPCParser.KW_FLOAT - 30)) | (1 << (LPCParser.KW_STRING - 30)) | (1 << (LPCParser.KW_OBJECT - 30)) | (1 << (LPCParser.KW_MIXED - 30)) | (1 << (LPCParser.KW_MAPPING - 30)) | (1 << (LPCParser.KW_FUNCTION - 30)) | (1 << (LPCParser.KW_BUFFER - 30)) | (1 << (LPCParser.KW_VOID - 30)) | (1 << (LPCParser.KW_STRUCT - 30)) | (1 << (LPCParser.KW_CLASS - 30)) | (1 << (LPCParser.KW_ARRAY - 30)) | (1 << (LPCParser.KW_CLOSURE - 30)) | (1 << (LPCParser.KW_TREE - 30)))) !== 0) || _la === LPCParser.Identifier) {
				{
				this.state = 331;
				this.structMemberList();
				}
			}

			this.state = 334;
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
	public classDef(): ClassDefContext {
		let _localctx: ClassDefContext = new ClassDefContext(this._ctx, this.state);
		this.enterRule(_localctx, 20, LPCParser.RULE_classDef);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 336;
			this.match(LPCParser.KW_CLASS);
			this.state = 337;
			this.match(LPCParser.Identifier);
			this.state = 338;
			this.match(LPCParser.LBRACE);
			this.state = 340;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 30)) & ~0x1F) === 0 && ((1 << (_la - 30)) & ((1 << (LPCParser.KW_INT - 30)) | (1 << (LPCParser.KW_FLOAT - 30)) | (1 << (LPCParser.KW_STRING - 30)) | (1 << (LPCParser.KW_OBJECT - 30)) | (1 << (LPCParser.KW_MIXED - 30)) | (1 << (LPCParser.KW_MAPPING - 30)) | (1 << (LPCParser.KW_FUNCTION - 30)) | (1 << (LPCParser.KW_BUFFER - 30)) | (1 << (LPCParser.KW_VOID - 30)) | (1 << (LPCParser.KW_STRUCT - 30)) | (1 << (LPCParser.KW_CLASS - 30)) | (1 << (LPCParser.KW_ARRAY - 30)) | (1 << (LPCParser.KW_CLOSURE - 30)) | (1 << (LPCParser.KW_TREE - 30)))) !== 0) || _la === LPCParser.Identifier) {
				{
				this.state = 339;
				this.structMemberList();
				}
			}

			this.state = 342;
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
	public structMemberList(): StructMemberListContext {
		let _localctx: StructMemberListContext = new StructMemberListContext(this._ctx, this.state);
		this.enterRule(_localctx, 22, LPCParser.RULE_structMemberList);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 345;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 344;
				this.structMember();
				}
				}
				this.state = 347;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while (((((_la - 30)) & ~0x1F) === 0 && ((1 << (_la - 30)) & ((1 << (LPCParser.KW_INT - 30)) | (1 << (LPCParser.KW_FLOAT - 30)) | (1 << (LPCParser.KW_STRING - 30)) | (1 << (LPCParser.KW_OBJECT - 30)) | (1 << (LPCParser.KW_MIXED - 30)) | (1 << (LPCParser.KW_MAPPING - 30)) | (1 << (LPCParser.KW_FUNCTION - 30)) | (1 << (LPCParser.KW_BUFFER - 30)) | (1 << (LPCParser.KW_VOID - 30)) | (1 << (LPCParser.KW_STRUCT - 30)) | (1 << (LPCParser.KW_CLASS - 30)) | (1 << (LPCParser.KW_ARRAY - 30)) | (1 << (LPCParser.KW_CLOSURE - 30)) | (1 << (LPCParser.KW_TREE - 30)))) !== 0) || _la === LPCParser.Identifier);
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
	public structMember(): StructMemberContext {
		let _localctx: StructMemberContext = new StructMemberContext(this._ctx, this.state);
		this.enterRule(_localctx, 24, LPCParser.RULE_structMember);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 349;
			this.typeSpec();
			this.state = 353;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.STAR) {
				{
				{
				this.state = 350;
				this.match(LPCParser.STAR);
				}
				}
				this.state = 355;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 356;
			this.match(LPCParser.Identifier);
			this.state = 357;
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
	public typeSpec(): TypeSpecContext {
		let _localctx: TypeSpecContext = new TypeSpecContext(this._ctx, this.state);
		this.enterRule(_localctx, 26, LPCParser.RULE_typeSpec);
		try {
			let _alt: number;
			this.state = 384;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 35, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 359;
				this.match(LPCParser.KW_INT);
				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 360;
				this.match(LPCParser.KW_FLOAT);
				}
				break;

			case 3:
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 361;
				this.match(LPCParser.KW_STRING);
				}
				break;

			case 4:
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 362;
				this.match(LPCParser.KW_OBJECT);
				}
				break;

			case 5:
				this.enterOuterAlt(_localctx, 5);
				{
				this.state = 363;
				this.match(LPCParser.KW_MIXED);
				}
				break;

			case 6:
				this.enterOuterAlt(_localctx, 6);
				{
				this.state = 364;
				this.match(LPCParser.KW_MAPPING);
				}
				break;

			case 7:
				this.enterOuterAlt(_localctx, 7);
				{
				this.state = 365;
				this.match(LPCParser.KW_FUNCTION);
				}
				break;

			case 8:
				this.enterOuterAlt(_localctx, 8);
				{
				this.state = 366;
				this.match(LPCParser.KW_BUFFER);
				}
				break;

			case 9:
				this.enterOuterAlt(_localctx, 9);
				{
				this.state = 367;
				this.match(LPCParser.KW_VOID);
				}
				break;

			case 10:
				this.enterOuterAlt(_localctx, 10);
				{
				this.state = 368;
				this.match(LPCParser.KW_STRUCT);
				}
				break;

			case 11:
				this.enterOuterAlt(_localctx, 11);
				{
				this.state = 369;
				this.match(LPCParser.KW_STRUCT);
				this.state = 370;
				this.match(LPCParser.Identifier);
				}
				break;

			case 12:
				this.enterOuterAlt(_localctx, 12);
				{
				this.state = 371;
				this.match(LPCParser.KW_CLASS);
				}
				break;

			case 13:
				this.enterOuterAlt(_localctx, 13);
				{
				this.state = 372;
				this.match(LPCParser.KW_CLASS);
				this.state = 373;
				this.match(LPCParser.Identifier);
				}
				break;

			case 14:
				this.enterOuterAlt(_localctx, 14);
				{
				this.state = 374;
				this.match(LPCParser.KW_ARRAY);
				}
				break;

			case 15:
				this.enterOuterAlt(_localctx, 15);
				{
				this.state = 375;
				this.match(LPCParser.KW_CLOSURE);
				}
				break;

			case 16:
				this.enterOuterAlt(_localctx, 16);
				{
				this.state = 376;
				this.match(LPCParser.KW_TREE);
				}
				break;

			case 17:
				this.enterOuterAlt(_localctx, 17);
				{
				this.state = 377;
				this.match(LPCParser.Identifier);
				this.state = 381;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 34, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 378;
						this.match(LPCParser.STAR);
						}
						}
					}
					this.state = 383;
					this._errHandler.sync(this);
					_alt = this.interpreter.adaptivePredict(this._input, 34, this._ctx);
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
	public block(): BlockContext {
		let _localctx: BlockContext = new BlockContext(this._ctx, this.state);
		this.enterRule(_localctx, 28, LPCParser.RULE_block);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 386;
			this.match(LPCParser.LBRACE);
			this.state = 390;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.IF) | (1 << LPCParser.FOR) | (1 << LPCParser.WHILE) | (1 << LPCParser.DO) | (1 << LPCParser.SWITCH) | (1 << LPCParser.BREAK) | (1 << LPCParser.CONTINUE) | (1 << LPCParser.RETURN) | (1 << LPCParser.FOREACH) | (1 << LPCParser.INHERIT) | (1 << LPCParser.INCLUDE) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF) | (1 << LPCParser.KW_INT) | (1 << LPCParser.KW_FLOAT))) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & ((1 << (LPCParser.KW_STRING - 32)) | (1 << (LPCParser.KW_OBJECT - 32)) | (1 << (LPCParser.KW_MIXED - 32)) | (1 << (LPCParser.KW_MAPPING - 32)) | (1 << (LPCParser.KW_FUNCTION - 32)) | (1 << (LPCParser.KW_BUFFER - 32)) | (1 << (LPCParser.KW_VOID - 32)) | (1 << (LPCParser.KW_STRUCT - 32)) | (1 << (LPCParser.KW_CLASS - 32)) | (1 << (LPCParser.KW_ARRAY - 32)) | (1 << (LPCParser.KW_CLOSURE - 32)) | (1 << (LPCParser.KW_TREE - 32)) | (1 << (LPCParser.KW_NEW - 32)) | (1 << (LPCParser.KW_EFUN - 32)) | (1 << (LPCParser.INC - 32)) | (1 << (LPCParser.DEC - 32)) | (1 << (LPCParser.PLUS - 32)))) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & ((1 << (LPCParser.MINUS - 64)) | (1 << (LPCParser.STAR - 64)) | (1 << (LPCParser.SCOPE - 64)) | (1 << (LPCParser.SEMI - 64)) | (1 << (LPCParser.LPAREN - 64)) | (1 << (LPCParser.LBRACE - 64)) | (1 << (LPCParser.DOLLAR - 64)) | (1 << (LPCParser.NOT - 64)))) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & ((1 << (LPCParser.BIT_NOT - 96)) | (1 << (LPCParser.MODIFIER - 96)) | (1 << (LPCParser.PARAMETER_PLACEHOLDER - 96)) | (1 << (LPCParser.Identifier - 96)))) !== 0)) {
				{
				{
				this.state = 387;
				this.statement();
				}
				}
				this.state = 392;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 393;
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
		this.enterRule(_localctx, 30, LPCParser.RULE_exprStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 395;
			this.expression();
			this.state = 396;
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
		this.enterRule(_localctx, 32, LPCParser.RULE_expression);
		try {
			let _alt: number;
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 398;
			this.assignmentExpression();
			this.state = 403;
			this._errHandler.sync(this);
			_alt = this.interpreter.adaptivePredict(this._input, 37, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 399;
					this.match(LPCParser.COMMA);
					this.state = 400;
					this.assignmentExpression();
					}
					}
				}
				this.state = 405;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 37, this._ctx);
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
		this.enterRule(_localctx, 34, LPCParser.RULE_assignmentExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 406;
			this.conditionalExpression();
			this.state = 409;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 52)) & ~0x1F) === 0 && ((1 << (_la - 52)) & ((1 << (LPCParser.SHIFT_LEFT_ASSIGN - 52)) | (1 << (LPCParser.SHIFT_RIGHT_ASSIGN - 52)) | (1 << (LPCParser.NULLISH_ASSIGN - 52)) | (1 << (LPCParser.LOGICAL_OR_ASSIGN - 52)) | (1 << (LPCParser.LOGICAL_AND_ASSIGN - 52)) | (1 << (LPCParser.PLUS_ASSIGN - 52)) | (1 << (LPCParser.MINUS_ASSIGN - 52)) | (1 << (LPCParser.STAR_ASSIGN - 52)) | (1 << (LPCParser.DIV_ASSIGN - 52)) | (1 << (LPCParser.PERCENT_ASSIGN - 52)) | (1 << (LPCParser.BIT_XOR_ASSIGN - 52)))) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & ((1 << (LPCParser.ASSIGN - 87)) | (1 << (LPCParser.BIT_OR_ASSIGN - 87)) | (1 << (LPCParser.BIT_AND_ASSIGN - 87)))) !== 0)) {
				{
				this.state = 407;
				_la = this._input.LA(1);
				if (!(((((_la - 52)) & ~0x1F) === 0 && ((1 << (_la - 52)) & ((1 << (LPCParser.SHIFT_LEFT_ASSIGN - 52)) | (1 << (LPCParser.SHIFT_RIGHT_ASSIGN - 52)) | (1 << (LPCParser.NULLISH_ASSIGN - 52)) | (1 << (LPCParser.LOGICAL_OR_ASSIGN - 52)) | (1 << (LPCParser.LOGICAL_AND_ASSIGN - 52)) | (1 << (LPCParser.PLUS_ASSIGN - 52)) | (1 << (LPCParser.MINUS_ASSIGN - 52)) | (1 << (LPCParser.STAR_ASSIGN - 52)) | (1 << (LPCParser.DIV_ASSIGN - 52)) | (1 << (LPCParser.PERCENT_ASSIGN - 52)) | (1 << (LPCParser.BIT_XOR_ASSIGN - 52)))) !== 0) || ((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & ((1 << (LPCParser.ASSIGN - 87)) | (1 << (LPCParser.BIT_OR_ASSIGN - 87)) | (1 << (LPCParser.BIT_AND_ASSIGN - 87)))) !== 0))) {
				this._errHandler.recoverInline(this);
				} else {
					if (this._input.LA(1) === Token.EOF) {
						this.matchedEOF = true;
					}

					this._errHandler.reportMatch(this);
					this.consume();
				}
				this.state = 408;
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
		this.enterRule(_localctx, 36, LPCParser.RULE_conditionalExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 411;
			this.nullishExpression();
			this.state = 417;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === LPCParser.QUESTION) {
				{
				this.state = 412;
				this.match(LPCParser.QUESTION);
				this.state = 413;
				this.expression();
				this.state = 414;
				this.match(LPCParser.COLON);
				this.state = 415;
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
	public nullishExpression(): NullishExpressionContext {
		let _localctx: NullishExpressionContext = new NullishExpressionContext(this._ctx, this.state);
		this.enterRule(_localctx, 38, LPCParser.RULE_nullishExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 419;
			this.logicalOrExpression();
			this.state = 424;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.NULLISH) {
				{
				{
				this.state = 420;
				this.match(LPCParser.NULLISH);
				this.state = 421;
				this.logicalOrExpression();
				}
				}
				this.state = 426;
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
	public logicalOrExpression(): LogicalOrExpressionContext {
		let _localctx: LogicalOrExpressionContext = new LogicalOrExpressionContext(this._ctx, this.state);
		this.enterRule(_localctx, 40, LPCParser.RULE_logicalOrExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 427;
			this.logicalAndExpression();
			this.state = 432;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.OR) {
				{
				{
				this.state = 428;
				this.match(LPCParser.OR);
				this.state = 429;
				this.logicalAndExpression();
				}
				}
				this.state = 434;
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
		this.enterRule(_localctx, 42, LPCParser.RULE_logicalAndExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 435;
			this.bitwiseOrExpression();
			this.state = 440;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.AND) {
				{
				{
				this.state = 436;
				this.match(LPCParser.AND);
				this.state = 437;
				this.bitwiseOrExpression();
				}
				}
				this.state = 442;
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
		this.enterRule(_localctx, 44, LPCParser.RULE_bitwiseOrExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 443;
			this.bitwiseXorExpression();
			this.state = 448;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.BIT_OR) {
				{
				{
				this.state = 444;
				this.match(LPCParser.BIT_OR);
				this.state = 445;
				this.bitwiseXorExpression();
				}
				}
				this.state = 450;
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
		this.enterRule(_localctx, 46, LPCParser.RULE_bitwiseXorExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 451;
			this.bitwiseAndExpression();
			this.state = 456;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.BIT_XOR) {
				{
				{
				this.state = 452;
				this.match(LPCParser.BIT_XOR);
				this.state = 453;
				this.bitwiseAndExpression();
				}
				}
				this.state = 458;
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
		this.enterRule(_localctx, 48, LPCParser.RULE_bitwiseAndExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 459;
			this.equalityExpression();
			this.state = 464;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.BIT_AND) {
				{
				{
				this.state = 460;
				this.match(LPCParser.BIT_AND);
				this.state = 461;
				this.equalityExpression();
				}
				}
				this.state = 466;
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
		this.enterRule(_localctx, 50, LPCParser.RULE_equalityExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 467;
			this.relationalExpression();
			this.state = 472;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.EQ || _la === LPCParser.NE) {
				{
				{
				this.state = 468;
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
				this.state = 469;
				this.relationalExpression();
				}
				}
				this.state = 474;
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
		this.enterRule(_localctx, 52, LPCParser.RULE_relationalExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 475;
			this.shiftExpression();
			this.state = 480;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 81)) & ~0x1F) === 0 && ((1 << (_la - 81)) & ((1 << (LPCParser.GT - 81)) | (1 << (LPCParser.LT - 81)) | (1 << (LPCParser.GE - 81)) | (1 << (LPCParser.LE - 81)))) !== 0)) {
				{
				{
				this.state = 476;
				_la = this._input.LA(1);
				if (!(((((_la - 81)) & ~0x1F) === 0 && ((1 << (_la - 81)) & ((1 << (LPCParser.GT - 81)) | (1 << (LPCParser.LT - 81)) | (1 << (LPCParser.GE - 81)) | (1 << (LPCParser.LE - 81)))) !== 0))) {
				this._errHandler.recoverInline(this);
				} else {
					if (this._input.LA(1) === Token.EOF) {
						this.matchedEOF = true;
					}

					this._errHandler.reportMatch(this);
					this.consume();
				}
				this.state = 477;
				this.shiftExpression();
				}
				}
				this.state = 482;
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
		this.enterRule(_localctx, 54, LPCParser.RULE_shiftExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 483;
			this.additiveExpression();
			this.state = 488;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.SHIFT_LEFT || _la === LPCParser.SHIFT_RIGHT) {
				{
				{
				this.state = 484;
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
				this.state = 485;
				this.additiveExpression();
				}
				}
				this.state = 490;
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
		this.enterRule(_localctx, 56, LPCParser.RULE_additiveExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 491;
			this.multiplicativeExpression();
			this.state = 496;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.PLUS || _la === LPCParser.MINUS) {
				{
				{
				this.state = 492;
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
				this.state = 493;
				this.multiplicativeExpression();
				}
				}
				this.state = 498;
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
		this.enterRule(_localctx, 58, LPCParser.RULE_multiplicativeExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 499;
			this.unaryExpression();
			this.state = 504;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 65)) & ~0x1F) === 0 && ((1 << (_la - 65)) & ((1 << (LPCParser.STAR - 65)) | (1 << (LPCParser.DIV - 65)) | (1 << (LPCParser.PERCENT - 65)))) !== 0)) {
				{
				{
				this.state = 500;
				_la = this._input.LA(1);
				if (!(((((_la - 65)) & ~0x1F) === 0 && ((1 << (_la - 65)) & ((1 << (LPCParser.STAR - 65)) | (1 << (LPCParser.DIV - 65)) | (1 << (LPCParser.PERCENT - 65)))) !== 0))) {
				this._errHandler.recoverInline(this);
				} else {
					if (this._input.LA(1) === Token.EOF) {
						this.matchedEOF = true;
					}

					this._errHandler.reportMatch(this);
					this.consume();
				}
				this.state = 501;
				this.unaryExpression();
				}
				}
				this.state = 506;
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
		this.enterRule(_localctx, 60, LPCParser.RULE_unaryExpression);
		let _la: number;
		try {
			this.state = 521;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 52, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 508;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.INC || _la === LPCParser.DEC) {
					{
					this.state = 507;
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

				this.state = 510;
				this.postfixExpression();
				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 511;
				_la = this._input.LA(1);
				if (!(((((_la - 63)) & ~0x1F) === 0 && ((1 << (_la - 63)) & ((1 << (LPCParser.PLUS - 63)) | (1 << (LPCParser.MINUS - 63)) | (1 << (LPCParser.STAR - 63)) | (1 << (LPCParser.NOT - 63)))) !== 0) || _la === LPCParser.BIT_NOT)) {
				this._errHandler.recoverInline(this);
				} else {
					if (this._input.LA(1) === Token.EOF) {
						this.matchedEOF = true;
					}

					this._errHandler.reportMatch(this);
					this.consume();
				}
				this.state = 512;
				this.unaryExpression();
				}
				break;

			case 3:
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 513;
				this.match(LPCParser.CATCH);
				this.state = 514;
				this.match(LPCParser.LPAREN);
				this.state = 515;
				this.expression();
				this.state = 516;
				this.match(LPCParser.RPAREN);
				}
				break;

			case 4:
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 518;
				this.match(LPCParser.CATCH);
				this.state = 519;
				this.block();
				}
				break;

			case 5:
				this.enterOuterAlt(_localctx, 5);
				{
				this.state = 520;
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
		this.enterRule(_localctx, 62, LPCParser.RULE_castExpression);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 523;
			this.match(LPCParser.LPAREN);
			this.state = 524;
			this.castType();
			this.state = 525;
			this.match(LPCParser.RPAREN);
			this.state = 526;
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
		this.enterRule(_localctx, 64, LPCParser.RULE_castType);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 528;
			this.castBaseType();
			this.state = 532;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.STAR) {
				{
				{
				this.state = 529;
				this.match(LPCParser.STAR);
				}
				}
				this.state = 534;
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
	public castBaseType(): CastBaseTypeContext {
		let _localctx: CastBaseTypeContext = new CastBaseTypeContext(this._ctx, this.state);
		this.enterRule(_localctx, 66, LPCParser.RULE_castBaseType);
		try {
			this.state = 553;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 54, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 535;
				this.match(LPCParser.KW_INT);
				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 536;
				this.match(LPCParser.KW_FLOAT);
				}
				break;

			case 3:
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 537;
				this.match(LPCParser.KW_STRING);
				}
				break;

			case 4:
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 538;
				this.match(LPCParser.KW_OBJECT);
				}
				break;

			case 5:
				this.enterOuterAlt(_localctx, 5);
				{
				this.state = 539;
				this.match(LPCParser.KW_MIXED);
				}
				break;

			case 6:
				this.enterOuterAlt(_localctx, 6);
				{
				this.state = 540;
				this.match(LPCParser.KW_MAPPING);
				}
				break;

			case 7:
				this.enterOuterAlt(_localctx, 7);
				{
				this.state = 541;
				this.match(LPCParser.KW_FUNCTION);
				}
				break;

			case 8:
				this.enterOuterAlt(_localctx, 8);
				{
				this.state = 542;
				this.match(LPCParser.KW_BUFFER);
				}
				break;

			case 9:
				this.enterOuterAlt(_localctx, 9);
				{
				this.state = 543;
				this.match(LPCParser.KW_VOID);
				}
				break;

			case 10:
				this.enterOuterAlt(_localctx, 10);
				{
				this.state = 544;
				this.match(LPCParser.KW_STRUCT);
				}
				break;

			case 11:
				this.enterOuterAlt(_localctx, 11);
				{
				this.state = 545;
				this.match(LPCParser.KW_STRUCT);
				this.state = 546;
				this.match(LPCParser.Identifier);
				}
				break;

			case 12:
				this.enterOuterAlt(_localctx, 12);
				{
				this.state = 547;
				this.match(LPCParser.KW_CLASS);
				}
				break;

			case 13:
				this.enterOuterAlt(_localctx, 13);
				{
				this.state = 548;
				this.match(LPCParser.KW_CLASS);
				this.state = 549;
				this.match(LPCParser.Identifier);
				}
				break;

			case 14:
				this.enterOuterAlt(_localctx, 14);
				{
				this.state = 550;
				this.match(LPCParser.KW_ARRAY);
				}
				break;

			case 15:
				this.enterOuterAlt(_localctx, 15);
				{
				this.state = 551;
				this.match(LPCParser.KW_CLOSURE);
				}
				break;

			case 16:
				this.enterOuterAlt(_localctx, 16);
				{
				this.state = 552;
				this.match(LPCParser.KW_TREE);
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
	public postfixExpression(): PostfixExpressionContext {
		let _localctx: PostfixExpressionContext = new PostfixExpressionContext(this._ctx, this.state);
		this.enterRule(_localctx, 68, LPCParser.RULE_postfixExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 555;
			this.primary();
			this.state = 578;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 48)) & ~0x1F) === 0 && ((1 << (_la - 48)) & ((1 << (LPCParser.ARROW - 48)) | (1 << (LPCParser.DOT - 48)) | (1 << (LPCParser.INC - 48)) | (1 << (LPCParser.DEC - 48)) | (1 << (LPCParser.SCOPE - 48)) | (1 << (LPCParser.LPAREN - 48)) | (1 << (LPCParser.LBRACK - 48)))) !== 0)) {
				{
				this.state = 576;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case LPCParser.ARROW:
				case LPCParser.DOT:
				case LPCParser.SCOPE:
					{
					{
					this.state = 556;
					_la = this._input.LA(1);
					if (!(((((_la - 48)) & ~0x1F) === 0 && ((1 << (_la - 48)) & ((1 << (LPCParser.ARROW - 48)) | (1 << (LPCParser.DOT - 48)) | (1 << (LPCParser.SCOPE - 48)))) !== 0))) {
					this._errHandler.recoverInline(this);
					} else {
						if (this._input.LA(1) === Token.EOF) {
							this.matchedEOF = true;
						}

						this._errHandler.reportMatch(this);
						this.consume();
					}
					this.state = 557;
					this.match(LPCParser.Identifier);
					this.state = 563;
					this._errHandler.sync(this);
					switch ( this.interpreter.adaptivePredict(this._input, 56, this._ctx) ) {
					case 1:
						{
						this.state = 558;
						this.match(LPCParser.LPAREN);
						this.state = 560;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & ((1 << (LPCParser.KW_FUNCTION - 36)) | (1 << (LPCParser.KW_NEW - 36)) | (1 << (LPCParser.KW_EFUN - 36)) | (1 << (LPCParser.INC - 36)) | (1 << (LPCParser.DEC - 36)) | (1 << (LPCParser.PLUS - 36)) | (1 << (LPCParser.MINUS - 36)) | (1 << (LPCParser.STAR - 36)))) !== 0) || ((((_la - 68)) & ~0x1F) === 0 && ((1 << (_la - 68)) & ((1 << (LPCParser.SCOPE - 68)) | (1 << (LPCParser.LPAREN - 68)) | (1 << (LPCParser.DOLLAR - 68)) | (1 << (LPCParser.NOT - 68)) | (1 << (LPCParser.BIT_NOT - 68)))) !== 0) || _la === LPCParser.PARAMETER_PLACEHOLDER || _la === LPCParser.Identifier) {
							{
							this.state = 559;
							this.argumentList();
							}
						}

						this.state = 562;
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
					this.state = 565;
					this.match(LPCParser.LPAREN);
					this.state = 567;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & ((1 << (LPCParser.KW_FUNCTION - 36)) | (1 << (LPCParser.KW_NEW - 36)) | (1 << (LPCParser.KW_EFUN - 36)) | (1 << (LPCParser.INC - 36)) | (1 << (LPCParser.DEC - 36)) | (1 << (LPCParser.PLUS - 36)) | (1 << (LPCParser.MINUS - 36)) | (1 << (LPCParser.STAR - 36)))) !== 0) || ((((_la - 68)) & ~0x1F) === 0 && ((1 << (_la - 68)) & ((1 << (LPCParser.SCOPE - 68)) | (1 << (LPCParser.LPAREN - 68)) | (1 << (LPCParser.DOLLAR - 68)) | (1 << (LPCParser.NOT - 68)) | (1 << (LPCParser.BIT_NOT - 68)))) !== 0) || _la === LPCParser.PARAMETER_PLACEHOLDER || _la === LPCParser.Identifier) {
						{
						this.state = 566;
						this.argumentList();
						}
					}

					this.state = 569;
					this.match(LPCParser.RPAREN);
					}
					}
					break;
				case LPCParser.LBRACK:
					{
					this.state = 570;
					this.match(LPCParser.LBRACK);
					this.state = 571;
					this.sliceExpr();
					this.state = 572;
					this.match(LPCParser.RBRACK);
					}
					break;
				case LPCParser.INC:
					{
					this.state = 574;
					this.match(LPCParser.INC);
					}
					break;
				case LPCParser.DEC:
					{
					this.state = 575;
					this.match(LPCParser.DEC);
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 580;
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
		this.enterRule(_localctx, 70, LPCParser.RULE_argumentList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 581;
			this.assignmentExpression();
			this.state = 583;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === LPCParser.ELLIPSIS) {
				{
				this.state = 582;
				this.match(LPCParser.ELLIPSIS);
				}
			}

			this.state = 592;
			this._errHandler.sync(this);
			_alt = this.interpreter.adaptivePredict(this._input, 62, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 585;
					this.match(LPCParser.COMMA);
					this.state = 586;
					this.assignmentExpression();
					this.state = 588;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la === LPCParser.ELLIPSIS) {
						{
						this.state = 587;
						this.match(LPCParser.ELLIPSIS);
						}
					}

					}
					}
				}
				this.state = 594;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 62, this._ctx);
			}
			this.state = 596;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === LPCParser.COMMA) {
				{
				this.state = 595;
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
		this.enterRule(_localctx, 72, LPCParser.RULE_primary);
		let _la: number;
		try {
			this.state = 639;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 66, this._ctx) ) {
			case 1:
				_localctx = new ScopeIdentifierContext(_localctx);
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 598;
				this.match(LPCParser.SCOPE);
				this.state = 599;
				this.match(LPCParser.Identifier);
				}
				break;

			case 2:
				_localctx = new EfunScopeIdentifierContext(_localctx);
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 600;
				this.match(LPCParser.KW_EFUN);
				this.state = 601;
				this.match(LPCParser.SCOPE);
				this.state = 602;
				this.match(LPCParser.Identifier);
				}
				break;

			case 3:
				_localctx = new StringConcatenationContext(_localctx);
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 603;
				this.stringConcat();
				}
				break;

			case 4:
				_localctx = new ClosurePrimaryContext(_localctx);
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 604;
				this.closureExpr();
				}
				break;

			case 5:
				_localctx = new MappingLiteralExprContext(_localctx);
				this.enterOuterAlt(_localctx, 5);
				{
				this.state = 605;
				this.mappingLiteral();
				}
				break;

			case 6:
				_localctx = new ArrayDelimiterExprContext(_localctx);
				this.enterOuterAlt(_localctx, 6);
				{
				this.state = 606;
				this.arrayDelimiterLiteral();
				}
				break;

			case 7:
				_localctx = new NewExpressionPrimaryContext(_localctx);
				this.enterOuterAlt(_localctx, 7);
				{
				this.state = 607;
				this.newExpression();
				}
				break;

			case 8:
				_localctx = new AnonFunctionContext(_localctx);
				this.enterOuterAlt(_localctx, 8);
				{
				this.state = 608;
				this.match(LPCParser.KW_FUNCTION);
				this.state = 609;
				this.match(LPCParser.LPAREN);
				this.state = 611;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & ((1 << (LPCParser.REF - 28)) | (1 << (LPCParser.KW_INT - 28)) | (1 << (LPCParser.KW_FLOAT - 28)) | (1 << (LPCParser.KW_STRING - 28)) | (1 << (LPCParser.KW_OBJECT - 28)) | (1 << (LPCParser.KW_MIXED - 28)) | (1 << (LPCParser.KW_MAPPING - 28)) | (1 << (LPCParser.KW_FUNCTION - 28)) | (1 << (LPCParser.KW_BUFFER - 28)) | (1 << (LPCParser.KW_VOID - 28)) | (1 << (LPCParser.KW_STRUCT - 28)) | (1 << (LPCParser.KW_CLASS - 28)) | (1 << (LPCParser.KW_ARRAY - 28)) | (1 << (LPCParser.KW_CLOSURE - 28)) | (1 << (LPCParser.KW_TREE - 28)))) !== 0) || _la === LPCParser.STAR || _la === LPCParser.Identifier) {
					{
					this.state = 610;
					this.parameterList();
					}
				}

				this.state = 613;
				this.match(LPCParser.RPAREN);
				this.state = 614;
				this.block();
				}
				break;

			case 9:
				_localctx = new DollarCallExprContext(_localctx);
				this.enterOuterAlt(_localctx, 9);
				{
				this.state = 615;
				this.match(LPCParser.DOLLAR);
				this.state = 616;
				this.match(LPCParser.LPAREN);
				this.state = 617;
				this.expression();
				this.state = 618;
				this.match(LPCParser.RPAREN);
				}
				break;

			case 10:
				_localctx = new IdentifierPrimaryContext(_localctx);
				this.enterOuterAlt(_localctx, 10);
				{
				this.state = 620;
				this.match(LPCParser.Identifier);
				}
				break;

			case 11:
				_localctx = new ParameterPlaceholderContext(_localctx);
				this.enterOuterAlt(_localctx, 11);
				{
				this.state = 621;
				this.match(LPCParser.PARAMETER_PLACEHOLDER);
				}
				break;

			case 12:
				_localctx = new IntegerPrimaryContext(_localctx);
				this.enterOuterAlt(_localctx, 12);
				{
				this.state = 622;
				this.match(LPCParser.INTEGER);
				}
				break;

			case 13:
				_localctx = new FloatPrimaryContext(_localctx);
				this.enterOuterAlt(_localctx, 13);
				{
				this.state = 623;
				this.match(LPCParser.FLOAT);
				}
				break;

			case 14:
				_localctx = new StringPrimaryContext(_localctx);
				this.enterOuterAlt(_localctx, 14);
				{
				this.state = 624;
				this.match(LPCParser.STRING_LITERAL);
				}
				break;

			case 15:
				_localctx = new CharPrimaryContext(_localctx);
				this.enterOuterAlt(_localctx, 15);
				{
				this.state = 625;
				this.match(LPCParser.CHAR_LITERAL);
				}
				break;

			case 16:
				_localctx = new ArrayLiteralContext(_localctx);
				this.enterOuterAlt(_localctx, 16);
				{
				this.state = 626;
				this.match(LPCParser.LPAREN);
				this.state = 627;
				this.match(LPCParser.LBRACE);
				this.state = 629;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & ((1 << (LPCParser.KW_FUNCTION - 36)) | (1 << (LPCParser.KW_NEW - 36)) | (1 << (LPCParser.KW_EFUN - 36)) | (1 << (LPCParser.ELLIPSIS - 36)) | (1 << (LPCParser.INC - 36)) | (1 << (LPCParser.DEC - 36)) | (1 << (LPCParser.PLUS - 36)) | (1 << (LPCParser.MINUS - 36)) | (1 << (LPCParser.STAR - 36)))) !== 0) || ((((_la - 68)) & ~0x1F) === 0 && ((1 << (_la - 68)) & ((1 << (LPCParser.SCOPE - 68)) | (1 << (LPCParser.LPAREN - 68)) | (1 << (LPCParser.DOLLAR - 68)) | (1 << (LPCParser.NOT - 68)) | (1 << (LPCParser.BIT_NOT - 68)))) !== 0) || _la === LPCParser.PARAMETER_PLACEHOLDER || _la === LPCParser.Identifier) {
					{
					this.state = 628;
					this.expressionList();
					}
				}

				this.state = 631;
				this.match(LPCParser.RBRACE);
				this.state = 632;
				this.match(LPCParser.RPAREN);
				}
				break;

			case 17:
				_localctx = new ParenExprContext(_localctx);
				this.enterOuterAlt(_localctx, 17);
				{
				this.state = 633;
				this.match(LPCParser.LPAREN);
				this.state = 634;
				this.expression();
				this.state = 635;
				this.match(LPCParser.RPAREN);
				}
				break;

			case 18:
				_localctx = new RefVariableContext(_localctx);
				this.enterOuterAlt(_localctx, 18);
				{
				this.state = 637;
				this.match(LPCParser.REF);
				this.state = 638;
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
		this.enterRule(_localctx, 74, LPCParser.RULE_stringConcat);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 642;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 641;
				this.concatItem();
				}
				}
				this.state = 644;
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
		this.enterRule(_localctx, 76, LPCParser.RULE_concatItem);
		let _la: number;
		try {
			this.state = 654;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 69, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 646;
				this.match(LPCParser.STRING_LITERAL);
				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 647;
				this.match(LPCParser.Identifier);
				this.state = 648;
				this.match(LPCParser.LPAREN);
				this.state = 650;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & ((1 << (LPCParser.KW_FUNCTION - 36)) | (1 << (LPCParser.KW_NEW - 36)) | (1 << (LPCParser.KW_EFUN - 36)) | (1 << (LPCParser.INC - 36)) | (1 << (LPCParser.DEC - 36)) | (1 << (LPCParser.PLUS - 36)) | (1 << (LPCParser.MINUS - 36)) | (1 << (LPCParser.STAR - 36)))) !== 0) || ((((_la - 68)) & ~0x1F) === 0 && ((1 << (_la - 68)) & ((1 << (LPCParser.SCOPE - 68)) | (1 << (LPCParser.LPAREN - 68)) | (1 << (LPCParser.DOLLAR - 68)) | (1 << (LPCParser.NOT - 68)) | (1 << (LPCParser.BIT_NOT - 68)))) !== 0) || _la === LPCParser.PARAMETER_PLACEHOLDER || _la === LPCParser.Identifier) {
					{
					this.state = 649;
					this.argumentList();
					}
				}

				this.state = 652;
				this.match(LPCParser.RPAREN);
				}
				break;

			case 3:
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 653;
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
		this.enterRule(_localctx, 78, LPCParser.RULE_ifStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 656;
			this.match(LPCParser.IF);
			this.state = 657;
			this.match(LPCParser.LPAREN);
			this.state = 658;
			this.expression();
			this.state = 659;
			this.match(LPCParser.RPAREN);
			this.state = 660;
			this.statement();
			this.state = 663;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 70, this._ctx) ) {
			case 1:
				{
				this.state = 661;
				this.match(LPCParser.ELSE);
				this.state = 662;
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
		this.enterRule(_localctx, 80, LPCParser.RULE_whileStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 665;
			this.match(LPCParser.WHILE);
			this.state = 666;
			this.match(LPCParser.LPAREN);
			this.state = 667;
			this.expression();
			this.state = 668;
			this.match(LPCParser.RPAREN);
			this.state = 669;
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
		this.enterRule(_localctx, 82, LPCParser.RULE_doWhileStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 671;
			this.match(LPCParser.DO);
			this.state = 672;
			this.statement();
			this.state = 673;
			this.match(LPCParser.WHILE);
			this.state = 674;
			this.match(LPCParser.LPAREN);
			this.state = 675;
			this.expression();
			this.state = 676;
			this.match(LPCParser.RPAREN);
			this.state = 677;
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
		this.enterRule(_localctx, 84, LPCParser.RULE_forStatement);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 679;
			this.match(LPCParser.FOR);
			this.state = 680;
			this.match(LPCParser.LPAREN);
			this.state = 682;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF) | (1 << LPCParser.KW_INT) | (1 << LPCParser.KW_FLOAT))) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & ((1 << (LPCParser.KW_STRING - 32)) | (1 << (LPCParser.KW_OBJECT - 32)) | (1 << (LPCParser.KW_MIXED - 32)) | (1 << (LPCParser.KW_MAPPING - 32)) | (1 << (LPCParser.KW_FUNCTION - 32)) | (1 << (LPCParser.KW_BUFFER - 32)) | (1 << (LPCParser.KW_VOID - 32)) | (1 << (LPCParser.KW_STRUCT - 32)) | (1 << (LPCParser.KW_CLASS - 32)) | (1 << (LPCParser.KW_ARRAY - 32)) | (1 << (LPCParser.KW_CLOSURE - 32)) | (1 << (LPCParser.KW_TREE - 32)) | (1 << (LPCParser.KW_NEW - 32)) | (1 << (LPCParser.KW_EFUN - 32)) | (1 << (LPCParser.ELLIPSIS - 32)) | (1 << (LPCParser.INC - 32)) | (1 << (LPCParser.DEC - 32)) | (1 << (LPCParser.PLUS - 32)))) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & ((1 << (LPCParser.MINUS - 64)) | (1 << (LPCParser.STAR - 64)) | (1 << (LPCParser.SCOPE - 64)) | (1 << (LPCParser.LPAREN - 64)) | (1 << (LPCParser.DOLLAR - 64)) | (1 << (LPCParser.NOT - 64)))) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & ((1 << (LPCParser.BIT_NOT - 96)) | (1 << (LPCParser.MODIFIER - 96)) | (1 << (LPCParser.PARAMETER_PLACEHOLDER - 96)) | (1 << (LPCParser.Identifier - 96)))) !== 0)) {
				{
				this.state = 681;
				this.forInit();
				}
			}

			this.state = 684;
			this.match(LPCParser.SEMI);
			this.state = 686;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & ((1 << (LPCParser.KW_FUNCTION - 36)) | (1 << (LPCParser.KW_NEW - 36)) | (1 << (LPCParser.KW_EFUN - 36)) | (1 << (LPCParser.INC - 36)) | (1 << (LPCParser.DEC - 36)) | (1 << (LPCParser.PLUS - 36)) | (1 << (LPCParser.MINUS - 36)) | (1 << (LPCParser.STAR - 36)))) !== 0) || ((((_la - 68)) & ~0x1F) === 0 && ((1 << (_la - 68)) & ((1 << (LPCParser.SCOPE - 68)) | (1 << (LPCParser.LPAREN - 68)) | (1 << (LPCParser.DOLLAR - 68)) | (1 << (LPCParser.NOT - 68)) | (1 << (LPCParser.BIT_NOT - 68)))) !== 0) || _la === LPCParser.PARAMETER_PLACEHOLDER || _la === LPCParser.Identifier) {
				{
				this.state = 685;
				this.expression();
				}
			}

			this.state = 688;
			this.match(LPCParser.SEMI);
			this.state = 690;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & ((1 << (LPCParser.KW_FUNCTION - 36)) | (1 << (LPCParser.KW_NEW - 36)) | (1 << (LPCParser.KW_EFUN - 36)) | (1 << (LPCParser.ELLIPSIS - 36)) | (1 << (LPCParser.INC - 36)) | (1 << (LPCParser.DEC - 36)) | (1 << (LPCParser.PLUS - 36)) | (1 << (LPCParser.MINUS - 36)) | (1 << (LPCParser.STAR - 36)))) !== 0) || ((((_la - 68)) & ~0x1F) === 0 && ((1 << (_la - 68)) & ((1 << (LPCParser.SCOPE - 68)) | (1 << (LPCParser.LPAREN - 68)) | (1 << (LPCParser.DOLLAR - 68)) | (1 << (LPCParser.NOT - 68)) | (1 << (LPCParser.BIT_NOT - 68)))) !== 0) || _la === LPCParser.PARAMETER_PLACEHOLDER || _la === LPCParser.Identifier) {
				{
				this.state = 689;
				this.expressionList();
				}
			}

			this.state = 692;
			this.match(LPCParser.RPAREN);
			this.state = 693;
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
		this.enterRule(_localctx, 86, LPCParser.RULE_forInit);
		try {
			this.state = 697;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 74, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 695;
				this.variableDecl();
				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 696;
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
		this.enterRule(_localctx, 88, LPCParser.RULE_expressionList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 699;
			this.spreadElement();
			this.state = 704;
			this._errHandler.sync(this);
			_alt = this.interpreter.adaptivePredict(this._input, 75, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 700;
					this.match(LPCParser.COMMA);
					this.state = 701;
					this.spreadElement();
					}
					}
				}
				this.state = 706;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 75, this._ctx);
			}
			this.state = 708;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === LPCParser.COMMA) {
				{
				this.state = 707;
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
	public spreadElement(): SpreadElementContext {
		let _localctx: SpreadElementContext = new SpreadElementContext(this._ctx, this.state);
		this.enterRule(_localctx, 90, LPCParser.RULE_spreadElement);
		try {
			this.state = 713;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case LPCParser.ELLIPSIS:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 710;
				this.match(LPCParser.ELLIPSIS);
				this.state = 711;
				this.assignmentExpression();
				}
				break;
			case LPCParser.INTEGER:
			case LPCParser.FLOAT:
			case LPCParser.CHAR_LITERAL:
			case LPCParser.STRING_LITERAL:
			case LPCParser.ARRAY_DELIMITER_START:
			case LPCParser.CATCH:
			case LPCParser.REF:
			case LPCParser.KW_FUNCTION:
			case LPCParser.KW_NEW:
			case LPCParser.KW_EFUN:
			case LPCParser.INC:
			case LPCParser.DEC:
			case LPCParser.PLUS:
			case LPCParser.MINUS:
			case LPCParser.STAR:
			case LPCParser.SCOPE:
			case LPCParser.LPAREN:
			case LPCParser.DOLLAR:
			case LPCParser.NOT:
			case LPCParser.BIT_NOT:
			case LPCParser.PARAMETER_PLACEHOLDER:
			case LPCParser.Identifier:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 712;
				this.assignmentExpression();
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
	public foreachStatement(): ForeachStatementContext {
		let _localctx: ForeachStatementContext = new ForeachStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 92, LPCParser.RULE_foreachStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 715;
			this.match(LPCParser.FOREACH);
			this.state = 716;
			this.match(LPCParser.LPAREN);
			this.state = 717;
			this.foreachInit();
			this.state = 718;
			this.match(LPCParser.IN);
			this.state = 719;
			this.expression();
			this.state = 720;
			this.match(LPCParser.RPAREN);
			this.state = 721;
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
		this.enterRule(_localctx, 94, LPCParser.RULE_foreachInit);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 723;
			this.foreachVar();
			this.state = 726;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === LPCParser.COMMA) {
				{
				this.state = 724;
				this.match(LPCParser.COMMA);
				this.state = 725;
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
		this.enterRule(_localctx, 96, LPCParser.RULE_foreachVar);
		let _la: number;
		try {
			this.state = 765;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 84, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 728;
				this.typeSpec();
				this.state = 730;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.REF) {
					{
					this.state = 729;
					this.match(LPCParser.REF);
					}
				}

				this.state = 735;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === LPCParser.STAR) {
					{
					{
					this.state = 732;
					this.match(LPCParser.STAR);
					}
					}
					this.state = 737;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 738;
				this.match(LPCParser.Identifier);
				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 740;
				this.match(LPCParser.REF);
				this.state = 741;
				this.typeSpec();
				this.state = 745;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === LPCParser.STAR) {
					{
					{
					this.state = 742;
					this.match(LPCParser.STAR);
					}
					}
					this.state = 747;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 748;
				this.match(LPCParser.Identifier);
				}
				break;

			case 3:
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 750;
				this.match(LPCParser.REF);
				this.state = 754;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === LPCParser.STAR) {
					{
					{
					this.state = 751;
					this.match(LPCParser.STAR);
					}
					}
					this.state = 756;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 757;
				this.match(LPCParser.Identifier);
				}
				break;

			case 4:
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 761;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === LPCParser.STAR) {
					{
					{
					this.state = 758;
					this.match(LPCParser.STAR);
					}
					}
					this.state = 763;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 764;
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
		this.enterRule(_localctx, 98, LPCParser.RULE_switchStatement);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 767;
			this.match(LPCParser.SWITCH);
			this.state = 768;
			this.match(LPCParser.LPAREN);
			this.state = 769;
			this.expression();
			this.state = 770;
			this.match(LPCParser.RPAREN);
			this.state = 771;
			this.match(LPCParser.LBRACE);
			this.state = 775;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.CASE || _la === LPCParser.DEFAULT) {
				{
				{
				this.state = 772;
				this.switchSection();
				}
				}
				this.state = 777;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 778;
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
		this.enterRule(_localctx, 100, LPCParser.RULE_switchSection);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 780;
			this.switchLabelWithColon();
			this.state = 784;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.IF) | (1 << LPCParser.FOR) | (1 << LPCParser.WHILE) | (1 << LPCParser.DO) | (1 << LPCParser.SWITCH) | (1 << LPCParser.BREAK) | (1 << LPCParser.CONTINUE) | (1 << LPCParser.RETURN) | (1 << LPCParser.FOREACH) | (1 << LPCParser.INHERIT) | (1 << LPCParser.INCLUDE) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF) | (1 << LPCParser.KW_INT) | (1 << LPCParser.KW_FLOAT))) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & ((1 << (LPCParser.KW_STRING - 32)) | (1 << (LPCParser.KW_OBJECT - 32)) | (1 << (LPCParser.KW_MIXED - 32)) | (1 << (LPCParser.KW_MAPPING - 32)) | (1 << (LPCParser.KW_FUNCTION - 32)) | (1 << (LPCParser.KW_BUFFER - 32)) | (1 << (LPCParser.KW_VOID - 32)) | (1 << (LPCParser.KW_STRUCT - 32)) | (1 << (LPCParser.KW_CLASS - 32)) | (1 << (LPCParser.KW_ARRAY - 32)) | (1 << (LPCParser.KW_CLOSURE - 32)) | (1 << (LPCParser.KW_TREE - 32)) | (1 << (LPCParser.KW_NEW - 32)) | (1 << (LPCParser.KW_EFUN - 32)) | (1 << (LPCParser.INC - 32)) | (1 << (LPCParser.DEC - 32)) | (1 << (LPCParser.PLUS - 32)))) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & ((1 << (LPCParser.MINUS - 64)) | (1 << (LPCParser.STAR - 64)) | (1 << (LPCParser.SCOPE - 64)) | (1 << (LPCParser.SEMI - 64)) | (1 << (LPCParser.LPAREN - 64)) | (1 << (LPCParser.LBRACE - 64)) | (1 << (LPCParser.DOLLAR - 64)) | (1 << (LPCParser.NOT - 64)))) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & ((1 << (LPCParser.BIT_NOT - 96)) | (1 << (LPCParser.MODIFIER - 96)) | (1 << (LPCParser.PARAMETER_PLACEHOLDER - 96)) | (1 << (LPCParser.Identifier - 96)))) !== 0)) {
				{
				{
				this.state = 781;
				this.statement();
				}
				}
				this.state = 786;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 796;
			this._errHandler.sync(this);
			_alt = this.interpreter.adaptivePredict(this._input, 88, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 787;
					this.switchLabelWithColon();
					this.state = 791;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.IF) | (1 << LPCParser.FOR) | (1 << LPCParser.WHILE) | (1 << LPCParser.DO) | (1 << LPCParser.SWITCH) | (1 << LPCParser.BREAK) | (1 << LPCParser.CONTINUE) | (1 << LPCParser.RETURN) | (1 << LPCParser.FOREACH) | (1 << LPCParser.INHERIT) | (1 << LPCParser.INCLUDE) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF) | (1 << LPCParser.KW_INT) | (1 << LPCParser.KW_FLOAT))) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & ((1 << (LPCParser.KW_STRING - 32)) | (1 << (LPCParser.KW_OBJECT - 32)) | (1 << (LPCParser.KW_MIXED - 32)) | (1 << (LPCParser.KW_MAPPING - 32)) | (1 << (LPCParser.KW_FUNCTION - 32)) | (1 << (LPCParser.KW_BUFFER - 32)) | (1 << (LPCParser.KW_VOID - 32)) | (1 << (LPCParser.KW_STRUCT - 32)) | (1 << (LPCParser.KW_CLASS - 32)) | (1 << (LPCParser.KW_ARRAY - 32)) | (1 << (LPCParser.KW_CLOSURE - 32)) | (1 << (LPCParser.KW_TREE - 32)) | (1 << (LPCParser.KW_NEW - 32)) | (1 << (LPCParser.KW_EFUN - 32)) | (1 << (LPCParser.INC - 32)) | (1 << (LPCParser.DEC - 32)) | (1 << (LPCParser.PLUS - 32)))) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & ((1 << (LPCParser.MINUS - 64)) | (1 << (LPCParser.STAR - 64)) | (1 << (LPCParser.SCOPE - 64)) | (1 << (LPCParser.SEMI - 64)) | (1 << (LPCParser.LPAREN - 64)) | (1 << (LPCParser.LBRACE - 64)) | (1 << (LPCParser.DOLLAR - 64)) | (1 << (LPCParser.NOT - 64)))) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & ((1 << (LPCParser.BIT_NOT - 96)) | (1 << (LPCParser.MODIFIER - 96)) | (1 << (LPCParser.PARAMETER_PLACEHOLDER - 96)) | (1 << (LPCParser.Identifier - 96)))) !== 0)) {
						{
						{
						this.state = 788;
						this.statement();
						}
						}
						this.state = 793;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					}
					}
				}
				this.state = 798;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 88, this._ctx);
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
		this.enterRule(_localctx, 102, LPCParser.RULE_switchLabelWithColon);
		try {
			this.state = 805;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case LPCParser.CASE:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 799;
				this.match(LPCParser.CASE);
				this.state = 800;
				this.switchLabel();
				this.state = 801;
				this.match(LPCParser.COLON);
				}
				break;
			case LPCParser.DEFAULT:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 803;
				this.match(LPCParser.DEFAULT);
				this.state = 804;
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
		this.enterRule(_localctx, 104, LPCParser.RULE_switchLabel);
		let _la: number;
		try {
			this.state = 816;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case LPCParser.INTEGER:
			case LPCParser.FLOAT:
			case LPCParser.CHAR_LITERAL:
			case LPCParser.STRING_LITERAL:
			case LPCParser.ARRAY_DELIMITER_START:
			case LPCParser.CATCH:
			case LPCParser.REF:
			case LPCParser.KW_FUNCTION:
			case LPCParser.KW_NEW:
			case LPCParser.KW_EFUN:
			case LPCParser.INC:
			case LPCParser.DEC:
			case LPCParser.PLUS:
			case LPCParser.MINUS:
			case LPCParser.STAR:
			case LPCParser.SCOPE:
			case LPCParser.LPAREN:
			case LPCParser.DOLLAR:
			case LPCParser.NOT:
			case LPCParser.BIT_NOT:
			case LPCParser.PARAMETER_PLACEHOLDER:
			case LPCParser.Identifier:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 807;
				this.expression();
				this.state = 812;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.RANGE_OP) {
					{
					this.state = 808;
					this.match(LPCParser.RANGE_OP);
					this.state = 810;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & ((1 << (LPCParser.KW_FUNCTION - 36)) | (1 << (LPCParser.KW_NEW - 36)) | (1 << (LPCParser.KW_EFUN - 36)) | (1 << (LPCParser.INC - 36)) | (1 << (LPCParser.DEC - 36)) | (1 << (LPCParser.PLUS - 36)) | (1 << (LPCParser.MINUS - 36)) | (1 << (LPCParser.STAR - 36)))) !== 0) || ((((_la - 68)) & ~0x1F) === 0 && ((1 << (_la - 68)) & ((1 << (LPCParser.SCOPE - 68)) | (1 << (LPCParser.LPAREN - 68)) | (1 << (LPCParser.DOLLAR - 68)) | (1 << (LPCParser.NOT - 68)) | (1 << (LPCParser.BIT_NOT - 68)))) !== 0) || _la === LPCParser.PARAMETER_PLACEHOLDER || _la === LPCParser.Identifier) {
						{
						this.state = 809;
						this.expression();
						}
					}

					}
				}

				}
				break;
			case LPCParser.RANGE_OP:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 814;
				this.match(LPCParser.RANGE_OP);
				this.state = 815;
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
		this.enterRule(_localctx, 106, LPCParser.RULE_breakStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 818;
			this.match(LPCParser.BREAK);
			this.state = 819;
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
		this.enterRule(_localctx, 108, LPCParser.RULE_continueStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 821;
			this.match(LPCParser.CONTINUE);
			this.state = 822;
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
		this.enterRule(_localctx, 110, LPCParser.RULE_returnStatement);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 824;
			this.match(LPCParser.RETURN);
			this.state = 826;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & ((1 << (LPCParser.KW_FUNCTION - 36)) | (1 << (LPCParser.KW_NEW - 36)) | (1 << (LPCParser.KW_EFUN - 36)) | (1 << (LPCParser.INC - 36)) | (1 << (LPCParser.DEC - 36)) | (1 << (LPCParser.PLUS - 36)) | (1 << (LPCParser.MINUS - 36)) | (1 << (LPCParser.STAR - 36)))) !== 0) || ((((_la - 68)) & ~0x1F) === 0 && ((1 << (_la - 68)) & ((1 << (LPCParser.SCOPE - 68)) | (1 << (LPCParser.LPAREN - 68)) | (1 << (LPCParser.DOLLAR - 68)) | (1 << (LPCParser.NOT - 68)) | (1 << (LPCParser.BIT_NOT - 68)))) !== 0) || _la === LPCParser.PARAMETER_PLACEHOLDER || _la === LPCParser.Identifier) {
				{
				this.state = 825;
				this.expression();
				}
			}

			this.state = 828;
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
		this.enterRule(_localctx, 112, LPCParser.RULE_closureExpr);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 830;
			this.match(LPCParser.LPAREN);
			this.state = 831;
			this.match(LPCParser.COLON);
			this.state = 833;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & ((1 << (LPCParser.KW_FUNCTION - 36)) | (1 << (LPCParser.KW_NEW - 36)) | (1 << (LPCParser.KW_EFUN - 36)) | (1 << (LPCParser.INC - 36)) | (1 << (LPCParser.DEC - 36)) | (1 << (LPCParser.PLUS - 36)) | (1 << (LPCParser.MINUS - 36)) | (1 << (LPCParser.STAR - 36)))) !== 0) || ((((_la - 68)) & ~0x1F) === 0 && ((1 << (_la - 68)) & ((1 << (LPCParser.SCOPE - 68)) | (1 << (LPCParser.LPAREN - 68)) | (1 << (LPCParser.DOLLAR - 68)) | (1 << (LPCParser.NOT - 68)) | (1 << (LPCParser.BIT_NOT - 68)))) !== 0) || _la === LPCParser.PARAMETER_PLACEHOLDER || _la === LPCParser.Identifier) {
				{
				this.state = 832;
				this.closureArgumentList();
				}
			}

			this.state = 835;
			this.match(LPCParser.COLON);
			this.state = 836;
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
	public closureArgumentList(): ClosureArgumentListContext {
		let _localctx: ClosureArgumentListContext = new ClosureArgumentListContext(this._ctx, this.state);
		this.enterRule(_localctx, 114, LPCParser.RULE_closureArgumentList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 838;
			this.closureArgument();
			this.state = 843;
			this._errHandler.sync(this);
			_alt = this.interpreter.adaptivePredict(this._input, 95, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 839;
					this.match(LPCParser.COMMA);
					this.state = 840;
					this.closureArgument();
					}
					}
				}
				this.state = 845;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 95, this._ctx);
			}
			this.state = 847;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === LPCParser.COMMA) {
				{
				this.state = 846;
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
	public closureArgument(): ClosureArgumentContext {
		let _localctx: ClosureArgumentContext = new ClosureArgumentContext(this._ctx, this.state);
		this.enterRule(_localctx, 116, LPCParser.RULE_closureArgument);
		let _la: number;
		try {
			this.state = 860;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 98, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 849;
				this.match(LPCParser.DOLLAR);
				this.state = 850;
				this.match(LPCParser.Identifier);
				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 851;
				this.match(LPCParser.DOLLAR);
				this.state = 852;
				this.match(LPCParser.LPAREN);
				this.state = 853;
				this.expression();
				this.state = 854;
				this.match(LPCParser.RPAREN);
				}
				break;

			case 3:
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 856;
				this.assignmentExpression();
				this.state = 858;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.ELLIPSIS) {
					{
					this.state = 857;
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
	public inheritStatement(): InheritStatementContext {
		let _localctx: InheritStatementContext = new InheritStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 118, LPCParser.RULE_inheritStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 862;
			this.match(LPCParser.INHERIT);
			this.state = 863;
			this.expression();
			this.state = 864;
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
		this.enterRule(_localctx, 120, LPCParser.RULE_includeStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 866;
			this.match(LPCParser.INCLUDE);
			this.state = 867;
			this.expression();
			this.state = 868;
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
		this.enterRule(_localctx, 122, LPCParser.RULE_macroInvoke);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 870;
			this.match(LPCParser.Identifier);
			this.state = 871;
			this.match(LPCParser.LPAREN);
			this.state = 873;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & ((1 << (LPCParser.KW_FUNCTION - 36)) | (1 << (LPCParser.KW_NEW - 36)) | (1 << (LPCParser.KW_EFUN - 36)) | (1 << (LPCParser.INC - 36)) | (1 << (LPCParser.DEC - 36)) | (1 << (LPCParser.PLUS - 36)) | (1 << (LPCParser.MINUS - 36)) | (1 << (LPCParser.STAR - 36)))) !== 0) || ((((_la - 68)) & ~0x1F) === 0 && ((1 << (_la - 68)) & ((1 << (LPCParser.SCOPE - 68)) | (1 << (LPCParser.LPAREN - 68)) | (1 << (LPCParser.DOLLAR - 68)) | (1 << (LPCParser.NOT - 68)) | (1 << (LPCParser.BIT_NOT - 68)))) !== 0) || _la === LPCParser.PARAMETER_PLACEHOLDER || _la === LPCParser.Identifier) {
				{
				this.state = 872;
				this.argumentList();
				}
			}

			this.state = 875;
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
		this.enterRule(_localctx, 124, LPCParser.RULE_prototypeStatement);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 880;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.MODIFIER) {
				{
				{
				this.state = 877;
				this.match(LPCParser.MODIFIER);
				}
				}
				this.state = 882;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 884;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 101, this._ctx) ) {
			case 1:
				{
				this.state = 883;
				this.typeSpec();
				}
				break;
			}
			this.state = 889;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.STAR) {
				{
				{
				this.state = 886;
				this.match(LPCParser.STAR);
				}
				}
				this.state = 891;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 892;
			this.match(LPCParser.Identifier);
			this.state = 893;
			this.match(LPCParser.LPAREN);
			this.state = 895;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 28)) & ~0x1F) === 0 && ((1 << (_la - 28)) & ((1 << (LPCParser.REF - 28)) | (1 << (LPCParser.KW_INT - 28)) | (1 << (LPCParser.KW_FLOAT - 28)) | (1 << (LPCParser.KW_STRING - 28)) | (1 << (LPCParser.KW_OBJECT - 28)) | (1 << (LPCParser.KW_MIXED - 28)) | (1 << (LPCParser.KW_MAPPING - 28)) | (1 << (LPCParser.KW_FUNCTION - 28)) | (1 << (LPCParser.KW_BUFFER - 28)) | (1 << (LPCParser.KW_VOID - 28)) | (1 << (LPCParser.KW_STRUCT - 28)) | (1 << (LPCParser.KW_CLASS - 28)) | (1 << (LPCParser.KW_ARRAY - 28)) | (1 << (LPCParser.KW_CLOSURE - 28)) | (1 << (LPCParser.KW_TREE - 28)))) !== 0) || _la === LPCParser.STAR || _la === LPCParser.Identifier) {
				{
				this.state = 894;
				this.parameterList();
				}
			}

			this.state = 897;
			this.match(LPCParser.RPAREN);
			this.state = 898;
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
		this.enterRule(_localctx, 126, LPCParser.RULE_mappingLiteral);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 900;
			this.match(LPCParser.LPAREN);
			this.state = 901;
			this.match(LPCParser.LBRACK);
			this.state = 903;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & ((1 << (LPCParser.KW_FUNCTION - 36)) | (1 << (LPCParser.KW_NEW - 36)) | (1 << (LPCParser.KW_EFUN - 36)) | (1 << (LPCParser.INC - 36)) | (1 << (LPCParser.DEC - 36)) | (1 << (LPCParser.PLUS - 36)) | (1 << (LPCParser.MINUS - 36)) | (1 << (LPCParser.STAR - 36)))) !== 0) || ((((_la - 68)) & ~0x1F) === 0 && ((1 << (_la - 68)) & ((1 << (LPCParser.SCOPE - 68)) | (1 << (LPCParser.LPAREN - 68)) | (1 << (LPCParser.DOLLAR - 68)) | (1 << (LPCParser.NOT - 68)) | (1 << (LPCParser.BIT_NOT - 68)))) !== 0) || _la === LPCParser.PARAMETER_PLACEHOLDER || _la === LPCParser.Identifier) {
				{
				this.state = 902;
				this.mappingPairList();
				}
			}

			this.state = 905;
			this.match(LPCParser.RBRACK);
			this.state = 906;
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
		this.enterRule(_localctx, 128, LPCParser.RULE_mappingPairList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 908;
			this.mappingPair();
			this.state = 913;
			this._errHandler.sync(this);
			_alt = this.interpreter.adaptivePredict(this._input, 105, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 909;
					this.match(LPCParser.COMMA);
					this.state = 910;
					this.mappingPair();
					}
					}
				}
				this.state = 915;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 105, this._ctx);
			}
			this.state = 917;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === LPCParser.COMMA) {
				{
				this.state = 916;
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
		this.enterRule(_localctx, 130, LPCParser.RULE_mappingPair);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 919;
			this.expression();
			this.state = 920;
			this.match(LPCParser.COLON);
			this.state = 921;
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
	public newExpression(): NewExpressionContext {
		let _localctx: NewExpressionContext = new NewExpressionContext(this._ctx, this.state);
		this.enterRule(_localctx, 132, LPCParser.RULE_newExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 923;
			this.match(LPCParser.KW_NEW);
			this.state = 924;
			this.match(LPCParser.LPAREN);
			this.state = 927;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 107, this._ctx) ) {
			case 1:
				{
				this.state = 925;
				this.typeSpec();
				}
				break;

			case 2:
				{
				this.state = 926;
				this.expression();
				}
				break;
			}
			this.state = 931;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === LPCParser.COMMA) {
				{
				this.state = 929;
				this.match(LPCParser.COMMA);
				this.state = 930;
				this.structInitializerList();
				}
			}

			this.state = 933;
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
	public structInitializerList(): StructInitializerListContext {
		let _localctx: StructInitializerListContext = new StructInitializerListContext(this._ctx, this.state);
		this.enterRule(_localctx, 134, LPCParser.RULE_structInitializerList);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 935;
			this.structInitializer();
			this.state = 940;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.COMMA) {
				{
				{
				this.state = 936;
				this.match(LPCParser.COMMA);
				this.state = 937;
				this.structInitializer();
				}
				}
				this.state = 942;
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
	public structInitializer(): StructInitializerContext {
		let _localctx: StructInitializerContext = new StructInitializerContext(this._ctx, this.state);
		this.enterRule(_localctx, 136, LPCParser.RULE_structInitializer);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 943;
			this.match(LPCParser.Identifier);
			this.state = 944;
			this.match(LPCParser.COLON);
			this.state = 945;
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
		this.enterRule(_localctx, 138, LPCParser.RULE_sliceExpr);
		let _la: number;
		try {
			this.state = 974;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 116, this._ctx) ) {
			case 1:
				_localctx = new TailIndexOnlyContext(_localctx);
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 947;
				this.match(LPCParser.LT);
				this.state = 948;
				this.expression();
				}
				break;

			case 2:
				_localctx = new HeadRangeContext(_localctx);
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 949;
				this.expression();
				this.state = 950;
				this.match(LPCParser.RANGE_OP);
				this.state = 952;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.LT) {
					{
					this.state = 951;
					this.match(LPCParser.LT);
					}
				}

				this.state = 955;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & ((1 << (LPCParser.KW_FUNCTION - 36)) | (1 << (LPCParser.KW_NEW - 36)) | (1 << (LPCParser.KW_EFUN - 36)) | (1 << (LPCParser.INC - 36)) | (1 << (LPCParser.DEC - 36)) | (1 << (LPCParser.PLUS - 36)) | (1 << (LPCParser.MINUS - 36)) | (1 << (LPCParser.STAR - 36)))) !== 0) || ((((_la - 68)) & ~0x1F) === 0 && ((1 << (_la - 68)) & ((1 << (LPCParser.SCOPE - 68)) | (1 << (LPCParser.LPAREN - 68)) | (1 << (LPCParser.DOLLAR - 68)) | (1 << (LPCParser.NOT - 68)) | (1 << (LPCParser.BIT_NOT - 68)))) !== 0) || _la === LPCParser.PARAMETER_PLACEHOLDER || _la === LPCParser.Identifier) {
					{
					this.state = 954;
					this.expression();
					}
				}

				}
				break;

			case 3:
				_localctx = new OpenRangeContext(_localctx);
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 957;
				this.match(LPCParser.RANGE_OP);
				this.state = 959;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.LT) {
					{
					this.state = 958;
					this.match(LPCParser.LT);
					}
				}

				this.state = 962;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & ((1 << (LPCParser.KW_FUNCTION - 36)) | (1 << (LPCParser.KW_NEW - 36)) | (1 << (LPCParser.KW_EFUN - 36)) | (1 << (LPCParser.INC - 36)) | (1 << (LPCParser.DEC - 36)) | (1 << (LPCParser.PLUS - 36)) | (1 << (LPCParser.MINUS - 36)) | (1 << (LPCParser.STAR - 36)))) !== 0) || ((((_la - 68)) & ~0x1F) === 0 && ((1 << (_la - 68)) & ((1 << (LPCParser.SCOPE - 68)) | (1 << (LPCParser.LPAREN - 68)) | (1 << (LPCParser.DOLLAR - 68)) | (1 << (LPCParser.NOT - 68)) | (1 << (LPCParser.BIT_NOT - 68)))) !== 0) || _la === LPCParser.PARAMETER_PLACEHOLDER || _la === LPCParser.Identifier) {
					{
					this.state = 961;
					this.expression();
					}
				}

				}
				break;

			case 4:
				_localctx = new SingleIndexContext(_localctx);
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 964;
				this.expression();
				}
				break;

			case 5:
				_localctx = new TailHeadRangeContext(_localctx);
				this.enterOuterAlt(_localctx, 5);
				{
				this.state = 965;
				this.match(LPCParser.LT);
				this.state = 966;
				this.expression();
				this.state = 967;
				this.match(LPCParser.RANGE_OP);
				this.state = 969;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.LT) {
					{
					this.state = 968;
					this.match(LPCParser.LT);
					}
				}

				this.state = 972;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & ((1 << (LPCParser.KW_FUNCTION - 36)) | (1 << (LPCParser.KW_NEW - 36)) | (1 << (LPCParser.KW_EFUN - 36)) | (1 << (LPCParser.INC - 36)) | (1 << (LPCParser.DEC - 36)) | (1 << (LPCParser.PLUS - 36)) | (1 << (LPCParser.MINUS - 36)) | (1 << (LPCParser.STAR - 36)))) !== 0) || ((((_la - 68)) & ~0x1F) === 0 && ((1 << (_la - 68)) & ((1 << (LPCParser.SCOPE - 68)) | (1 << (LPCParser.LPAREN - 68)) | (1 << (LPCParser.DOLLAR - 68)) | (1 << (LPCParser.NOT - 68)) | (1 << (LPCParser.BIT_NOT - 68)))) !== 0) || _la === LPCParser.PARAMETER_PLACEHOLDER || _la === LPCParser.Identifier) {
					{
					this.state = 971;
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
	// @RuleVersion(0)
	public arrayDelimiterLiteral(): ArrayDelimiterLiteralContext {
		let _localctx: ArrayDelimiterLiteralContext = new ArrayDelimiterLiteralContext(this._ctx, this.state);
		this.enterRule(_localctx, 140, LPCParser.RULE_arrayDelimiterLiteral);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 976;
			this.match(LPCParser.ARRAY_DELIMITER_START);
			this.state = 978;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL))) !== 0) || _la === LPCParser.Identifier) {
				{
				this.state = 977;
				this.arrayDelimiterContent();
				}
			}

			this.state = 980;
			this.match(LPCParser.ARRAY_DELIMITER_END);
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
	public arrayDelimiterContent(): ArrayDelimiterContentContext {
		let _localctx: ArrayDelimiterContentContext = new ArrayDelimiterContentContext(this._ctx, this.state);
		this.enterRule(_localctx, 142, LPCParser.RULE_arrayDelimiterContent);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 983;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 982;
				this.arrayDelimiterElement();
				}
				}
				this.state = 985;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL))) !== 0) || _la === LPCParser.Identifier);
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
	public arrayDelimiterElement(): ArrayDelimiterElementContext {
		let _localctx: ArrayDelimiterElementContext = new ArrayDelimiterElementContext(this._ctx, this.state);
		this.enterRule(_localctx, 144, LPCParser.RULE_arrayDelimiterElement);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 987;
			_la = this._input.LA(1);
			if (!((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL))) !== 0) || _la === LPCParser.Identifier)) {
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

	private static readonly _serializedATNSegments: number = 2;
	private static readonly _serializedATNSegment0: string =
		"\x03\uC91D\uCABA\u058D\uAFBA\u4F53\u0607\uEA8B\uC241\x03g\u03E0\x04\x02" +
		"\t\x02\x04\x03\t\x03\x04\x04\t\x04\x04\x05\t\x05\x04\x06\t\x06\x04\x07" +
		"\t\x07\x04\b\t\b\x04\t\t\t\x04\n\t\n\x04\v\t\v\x04\f\t\f\x04\r\t\r\x04" +
		"\x0E\t\x0E\x04\x0F\t\x0F\x04\x10\t\x10\x04\x11\t\x11\x04\x12\t\x12\x04" +
		"\x13\t\x13\x04\x14\t\x14\x04\x15\t\x15\x04\x16\t\x16\x04\x17\t\x17\x04" +
		"\x18\t\x18\x04\x19\t\x19\x04\x1A\t\x1A\x04\x1B\t\x1B\x04\x1C\t\x1C\x04" +
		"\x1D\t\x1D\x04\x1E\t\x1E\x04\x1F\t\x1F\x04 \t \x04!\t!\x04\"\t\"\x04#" +
		"\t#\x04$\t$\x04%\t%\x04&\t&\x04\'\t\'\x04(\t(\x04)\t)\x04*\t*\x04+\t+" +
		"\x04,\t,\x04-\t-\x04.\t.\x04/\t/\x040\t0\x041\t1\x042\t2\x043\t3\x044" +
		"\t4\x045\t5\x046\t6\x047\t7\x048\t8\x049\t9\x04:\t:\x04;\t;\x04<\t<\x04" +
		"=\t=\x04>\t>\x04?\t?\x04@\t@\x04A\tA\x04B\tB\x04C\tC\x04D\tD\x04E\tE\x04" +
		"F\tF\x04G\tG\x04H\tH\x04I\tI\x04J\tJ\x03\x02\x07\x02\x96\n\x02\f\x02\x0E" +
		"\x02\x99\v\x02\x03\x02\x03\x02\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03" +
		"\x03\x03\x03\x03\x03\x03\x03\x03\x05\x03\xA6\n\x03\x03\x03\x03\x03\x03" +
		"\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03" +
		"\x03\x03\x03\x03\x03\x03\x03\x05\x03\xB7\n\x03\x03\x04\x07\x04\xBA\n\x04" +
		"\f\x04\x0E\x04\xBD\v\x04\x03\x04\x05\x04\xC0\n\x04\x03\x04\x07\x04\xC3" +
		"\n\x04\f\x04\x0E\x04\xC6\v\x04\x03\x04\x03\x04\x03\x04\x05\x04\xCB\n\x04" +
		"\x03\x04\x03\x04\x03\x04\x03\x05\x06\x05\xD1\n\x05\r\x05\x0E\x05\xD2\x03" +
		"\x05\x03\x05\x03\x06\x07\x06\xD8\n\x06\f\x06\x0E\x06\xDB\v\x06\x03\x06" +
		"\x03\x06\x03\x06\x03\x06\x07\x06\xE1\n\x06\f\x06\x0E\x06\xE4\v\x06\x03" +
		"\x07\x07\x07\xE7\n\x07\f\x07\x0E\x07\xEA\v\x07\x03\x07\x03\x07\x03\x07" +
		"\x05\x07\xEF\n\x07\x03\b\x03\b\x03\b\x07\b\xF4\n\b\f\b\x0E\b\xF7\v\b\x03" +
		"\t\x03\t\x05\t\xFB\n\t\x03\t\x07\t\xFE\n\t\f\t\x0E\t\u0101\v\t\x03\t\x03" +
		"\t\x05\t\u0105\n\t\x03\t\x05\t\u0108\n\t\x03\t\x03\t\x05\t\u010C\n\t\x03" +
		"\t\x07\t\u010F\n\t\f\t\x0E\t\u0112\v\t\x03\t\x03\t\x03\t\x07\t\u0117\n" +
		"\t\f\t\x0E\t\u011A\v\t\x03\t\x03\t\x05\t\u011E\n\t\x03\t\x05\t\u0121\n" +
		"\t\x03\t\x03\t\x03\t\x07\t\u0126\n\t\f\t\x0E\t\u0129\v\t\x03\t\x03\t\x07" +
		"\t\u012D\n\t\f\t\x0E\t\u0130\v\t\x03\t\x03\t\x05\t\u0134\n\t\x03\t\x05" +
		"\t\u0137\n\t\x03\t\x07\t\u013A\n\t\f\t\x0E\t\u013D\v\t\x03\t\x03\t\x05" +
		"\t\u0141\n\t\x03\t\x05\t\u0144\n\t\x05\t\u0146\n\t\x03\n\x03\n\x03\n\x03" +
		"\v\x03\v\x03\v\x03\v\x05\v\u014F\n\v\x03\v\x03\v\x03\f\x03\f\x03\f\x03" +
		"\f\x05\f\u0157\n\f\x03\f\x03\f\x03\r\x06\r\u015C\n\r\r\r\x0E\r\u015D\x03" +
		"\x0E\x03\x0E\x07\x0E\u0162\n\x0E\f\x0E\x0E\x0E\u0165\v\x0E\x03\x0E\x03" +
		"\x0E\x03\x0E\x03\x0F\x03\x0F\x03\x0F\x03\x0F\x03\x0F\x03\x0F\x03\x0F\x03" +
		"\x0F\x03\x0F\x03\x0F\x03\x0F\x03\x0F\x03\x0F\x03\x0F\x03\x0F\x03\x0F\x03" +
		"\x0F\x03\x0F\x03\x0F\x03\x0F\x07\x0F\u017E\n\x0F\f\x0F\x0E\x0F\u0181\v" +
		"\x0F\x05\x0F\u0183\n\x0F\x03\x10\x03\x10\x07\x10\u0187\n\x10\f\x10\x0E" +
		"\x10\u018A\v\x10\x03\x10\x03\x10\x03\x11\x03\x11\x03\x11\x03\x12\x03\x12" +
		"\x03\x12\x07\x12\u0194\n\x12\f\x12\x0E\x12\u0197\v\x12\x03\x13\x03\x13" +
		"\x03\x13\x05\x13\u019C\n\x13\x03\x14\x03\x14\x03\x14\x03\x14\x03\x14\x03" +
		"\x14\x05\x14\u01A4\n\x14\x03\x15\x03\x15\x03\x15\x07\x15\u01A9\n\x15\f" +
		"\x15\x0E\x15\u01AC\v\x15\x03\x16\x03\x16\x03\x16\x07\x16\u01B1\n\x16\f" +
		"\x16\x0E\x16\u01B4\v\x16\x03\x17\x03\x17\x03\x17\x07\x17\u01B9\n\x17\f" +
		"\x17\x0E\x17\u01BC\v\x17\x03\x18\x03\x18\x03\x18\x07\x18\u01C1\n\x18\f" +
		"\x18\x0E\x18\u01C4\v\x18\x03\x19\x03\x19\x03\x19\x07\x19\u01C9\n\x19\f" +
		"\x19\x0E\x19\u01CC\v\x19\x03\x1A\x03\x1A\x03\x1A\x07\x1A\u01D1\n\x1A\f" +
		"\x1A\x0E\x1A\u01D4\v\x1A\x03\x1B\x03\x1B\x03\x1B\x07\x1B\u01D9\n\x1B\f" +
		"\x1B\x0E\x1B\u01DC\v\x1B\x03\x1C\x03\x1C\x03\x1C\x07\x1C\u01E1\n\x1C\f" +
		"\x1C\x0E\x1C\u01E4\v\x1C\x03\x1D\x03\x1D\x03\x1D\x07\x1D\u01E9\n\x1D\f" +
		"\x1D\x0E\x1D\u01EC\v\x1D\x03\x1E\x03\x1E\x03\x1E\x07\x1E\u01F1\n\x1E\f" +
		"\x1E\x0E\x1E\u01F4\v\x1E\x03\x1F\x03\x1F\x03\x1F\x07\x1F\u01F9\n\x1F\f" +
		"\x1F\x0E\x1F\u01FC\v\x1F\x03 \x05 \u01FF\n \x03 \x03 \x03 \x03 \x03 \x03" +
		" \x03 \x03 \x03 \x03 \x03 \x05 \u020C\n \x03!\x03!\x03!\x03!\x03!\x03" +
		"\"\x03\"\x07\"\u0215\n\"\f\"\x0E\"\u0218\v\"\x03#\x03#\x03#\x03#\x03#" +
		"\x03#\x03#\x03#\x03#\x03#\x03#\x03#\x03#\x03#\x03#\x03#\x03#\x03#\x05" +
		"#\u022C\n#\x03$\x03$\x03$\x03$\x03$\x05$\u0233\n$\x03$\x05$\u0236\n$\x03" +
		"$\x03$\x05$\u023A\n$\x03$\x03$\x03$\x03$\x03$\x03$\x03$\x07$\u0243\n$" +
		"\f$\x0E$\u0246\v$\x03%\x03%\x05%\u024A\n%\x03%\x03%\x03%\x05%\u024F\n" +
		"%\x07%\u0251\n%\f%\x0E%\u0254\v%\x03%\x05%\u0257\n%\x03&\x03&\x03&\x03" +
		"&\x03&\x03&\x03&\x03&\x03&\x03&\x03&\x03&\x03&\x05&\u0266\n&\x03&\x03" +
		"&\x03&\x03&\x03&\x03&\x03&\x03&\x03&\x03&\x03&\x03&\x03&\x03&\x03&\x03" +
		"&\x05&\u0278\n&\x03&\x03&\x03&\x03&\x03&\x03&\x03&\x03&\x05&\u0282\n&" +
		"\x03\'\x06\'\u0285\n\'\r\'\x0E\'\u0286\x03(\x03(\x03(\x03(\x05(\u028D" +
		"\n(\x03(\x03(\x05(\u0291\n(\x03)\x03)\x03)\x03)\x03)\x03)\x03)\x05)\u029A" +
		"\n)\x03*\x03*\x03*\x03*\x03*\x03*\x03+\x03+\x03+\x03+\x03+\x03+\x03+\x03" +
		"+\x03,\x03,\x03,\x05,\u02AD\n,\x03,\x03,\x05,\u02B1\n,\x03,\x03,\x05," +
		"\u02B5\n,\x03,\x03,\x03,\x03-\x03-\x05-\u02BC\n-\x03.\x03.\x03.\x07.\u02C1" +
		"\n.\f.\x0E.\u02C4\v.\x03.\x05.\u02C7\n.\x03/\x03/\x03/\x05/\u02CC\n/\x03" +
		"0\x030\x030\x030\x030\x030\x030\x030\x031\x031\x031\x051\u02D9\n1\x03" +
		"2\x032\x052\u02DD\n2\x032\x072\u02E0\n2\f2\x0E2\u02E3\v2\x032\x032\x03" +
		"2\x032\x032\x072\u02EA\n2\f2\x0E2\u02ED\v2\x032\x032\x032\x032\x072\u02F3" +
		"\n2\f2\x0E2\u02F6\v2\x032\x032\x072\u02FA\n2\f2\x0E2\u02FD\v2\x032\x05" +
		"2\u0300\n2\x033\x033\x033\x033\x033\x033\x073\u0308\n3\f3\x0E3\u030B\v" +
		"3\x033\x033\x034\x034\x074\u0311\n4\f4\x0E4\u0314\v4\x034\x034\x074\u0318" +
		"\n4\f4\x0E4\u031B\v4\x074\u031D\n4\f4\x0E4\u0320\v4\x035\x035\x035\x03" +
		"5\x035\x035\x055\u0328\n5\x036\x036\x036\x056\u032D\n6\x056\u032F\n6\x03" +
		"6\x036\x056\u0333\n6\x037\x037\x037\x038\x038\x038\x039\x039\x059\u033D" +
		"\n9\x039\x039\x03:\x03:\x03:\x05:\u0344\n:\x03:\x03:\x03:\x03;\x03;\x03" +
		";\x07;\u034C\n;\f;\x0E;\u034F\v;\x03;\x05;\u0352\n;\x03<\x03<\x03<\x03" +
		"<\x03<\x03<\x03<\x03<\x03<\x05<\u035D\n<\x05<\u035F\n<\x03=\x03=\x03=" +
		"\x03=\x03>\x03>\x03>\x03>\x03?\x03?\x03?\x05?\u036C\n?\x03?\x03?\x03@" +
		"\x07@\u0371\n@\f@\x0E@\u0374\v@\x03@\x05@\u0377\n@\x03@\x07@\u037A\n@" +
		"\f@\x0E@\u037D\v@\x03@\x03@\x03@\x05@\u0382\n@\x03@\x03@\x03@\x03A\x03" +
		"A\x03A\x05A\u038A\nA\x03A\x03A\x03A\x03B\x03B\x03B\x07B\u0392\nB\fB\x0E" +
		"B\u0395\vB\x03B\x05B\u0398\nB\x03C\x03C\x03C\x03C\x03D\x03D\x03D\x03D" +
		"\x05D\u03A2\nD\x03D\x03D\x05D\u03A6\nD\x03D\x03D\x03E\x03E\x03E\x07E\u03AD" +
		"\nE\fE\x0EE\u03B0\vE\x03F\x03F\x03F\x03F\x03G\x03G\x03G\x03G\x03G\x05" +
		"G\u03BB\nG\x03G\x05G\u03BE\nG\x03G\x03G\x05G\u03C2\nG\x03G\x05G\u03C5" +
		"\nG\x03G\x03G\x03G\x03G\x03G\x05G\u03CC\nG\x03G\x05G\u03CF\nG\x05G\u03D1" +
		"\nG\x03H\x03H\x05H\u03D5\nH\x03H\x03H\x03I\x06I\u03DA\nI\rI\x0EI\u03DB" +
		"\x03J\x03J\x03J\x02\x02\x02K\x02\x02\x04\x02\x06\x02\b\x02\n\x02\f\x02" +
		"\x0E\x02\x10\x02\x12\x02\x14\x02\x16\x02\x18\x02\x1A\x02\x1C\x02\x1E\x02" +
		" \x02\"\x02$\x02&\x02(\x02*\x02,\x02.\x020\x022\x024\x026\x028\x02:\x02" +
		"<\x02>\x02@\x02B\x02D\x02F\x02H\x02J\x02L\x02N\x02P\x02R\x02T\x02V\x02" +
		"X\x02Z\x02\\\x02^\x02`\x02b\x02d\x02f\x02h\x02j\x02l\x02n\x02p\x02r\x02" +
		"t\x02v\x02x\x02z\x02|\x02~\x02\x80\x02\x82\x02\x84\x02\x86\x02\x88\x02" +
		"\x8A\x02\x8C\x02\x8E\x02\x90\x02\x92\x02\x02\f\x05\x026@YYcd\x03\x02W" +
		"X\x03\x02SV\x03\x02]^\x03\x02AB\x03\x02CE\x03\x0245\x05\x02ACZZbb\x04" +
		"\x0223FF\x04\x02\x03\x06gg\x02\u045E\x02\x97\x03\x02\x02\x02\x04\xB6\x03" +
		"\x02\x02\x02\x06\xBB\x03\x02\x02\x02\b\xD0\x03\x02\x02\x02\n\xD9\x03\x02" +
		"\x02\x02\f\xE8\x03\x02\x02\x02\x0E\xF0\x03\x02\x02\x02\x10\u0145\x03\x02" +
		"\x02\x02\x12\u0147\x03\x02\x02\x02\x14\u014A\x03\x02\x02\x02\x16\u0152" +
		"\x03\x02\x02\x02\x18\u015B\x03\x02\x02\x02\x1A\u015F\x03\x02\x02\x02\x1C" +
		"\u0182\x03\x02\x02\x02\x1E\u0184\x03\x02\x02\x02 \u018D\x03\x02\x02\x02" +
		"\"\u0190\x03\x02\x02\x02$\u0198\x03\x02\x02\x02&\u019D\x03\x02\x02\x02" +
		"(\u01A5\x03\x02\x02\x02*\u01AD\x03\x02\x02\x02,\u01B5\x03\x02\x02\x02" +
		".\u01BD\x03\x02\x02\x020\u01C5\x03\x02\x02\x022\u01CD\x03\x02\x02\x02" +
		"4\u01D5\x03\x02\x02\x026\u01DD\x03\x02\x02\x028\u01E5\x03\x02\x02\x02" +
		":\u01ED\x03\x02\x02\x02<\u01F5\x03\x02\x02\x02>\u020B\x03\x02\x02\x02" +
		"@\u020D\x03\x02\x02\x02B\u0212\x03\x02\x02\x02D\u022B\x03\x02\x02\x02" +
		"F\u022D\x03\x02\x02\x02H\u0247\x03\x02\x02\x02J\u0281\x03\x02\x02\x02" +
		"L\u0284\x03\x02\x02\x02N\u0290\x03\x02\x02\x02P\u0292\x03\x02\x02\x02" +
		"R\u029B\x03\x02\x02\x02T\u02A1\x03\x02\x02\x02V\u02A9\x03\x02\x02\x02" +
		"X\u02BB\x03\x02\x02\x02Z\u02BD\x03\x02\x02\x02\\\u02CB\x03\x02\x02\x02" +
		"^\u02CD\x03\x02\x02\x02`\u02D5\x03\x02\x02\x02b\u02FF\x03\x02\x02\x02" +
		"d\u0301\x03\x02\x02\x02f\u030E\x03\x02\x02\x02h\u0327\x03\x02\x02\x02" +
		"j\u0332\x03\x02\x02\x02l\u0334\x03\x02\x02\x02n\u0337\x03\x02\x02\x02" +
		"p\u033A\x03\x02\x02\x02r\u0340\x03\x02\x02\x02t\u0348\x03\x02\x02\x02" +
		"v\u035E\x03\x02\x02\x02x\u0360\x03\x02\x02\x02z\u0364\x03\x02\x02\x02" +
		"|\u0368\x03\x02\x02\x02~\u0372\x03\x02\x02\x02\x80\u0386\x03\x02\x02\x02" +
		"\x82\u038E\x03\x02\x02\x02\x84\u0399\x03\x02\x02\x02\x86\u039D\x03\x02" +
		"\x02\x02\x88\u03A9\x03\x02\x02\x02\x8A\u03B1\x03\x02\x02\x02\x8C\u03D0" +
		"\x03\x02\x02\x02\x8E\u03D2\x03\x02\x02\x02\x90\u03D9\x03\x02\x02\x02\x92" +
		"\u03DD\x03\x02\x02\x02\x94\x96\x05\x04\x03\x02\x95\x94\x03\x02\x02\x02" +
		"\x96\x99\x03\x02\x02\x02\x97\x95\x03\x02\x02\x02\x97\x98\x03\x02\x02\x02" +
		"\x98\x9A\x03\x02\x02\x02\x99\x97\x03\x02\x02\x02\x9A\x9B\x07\x02\x02\x03" +
		"\x9B\x03\x03\x02\x02\x02\x9C\xB7\x05\x06\x04\x02\x9D\xB7\x05\b\x05\x02" +
		"\x9E\x9F\x05\n\x06\x02\x9F\xA0\x07G\x02\x02\xA0\xB7\x03\x02\x02\x02\xA1" +
		"\xB7\x05\x14\v\x02\xA2\xB7\x05\x16\f\x02\xA3\xA5\x05|?\x02\xA4\xA6\x07" +
		"G\x02\x02\xA5\xA4\x03\x02\x02\x02\xA5\xA6\x03\x02\x02\x02\xA6\xB7\x03" +
		"\x02\x02\x02\xA7\xB7\x05P)\x02\xA8\xB7\x05R*\x02\xA9\xB7\x05V,\x02\xAA" +
		"\xB7\x05T+\x02\xAB\xB7\x05^0\x02\xAC\xB7\x05d3\x02\xAD\xB7\x05l7\x02\xAE" +
		"\xB7\x05n8\x02\xAF\xB7\x05p9\x02\xB0\xB7\x05x=\x02\xB1\xB7\x05z>\x02\xB2" +
		"\xB7\x05\x1E\x10\x02\xB3\xB7\x05 \x11\x02\xB4\xB7\x05~@\x02\xB5\xB7\x07" +
		"G\x02\x02\xB6\x9C\x03\x02\x02\x02\xB6\x9D\x03\x02\x02\x02\xB6\x9E\x03" +
		"\x02\x02\x02\xB6\xA1\x03\x02\x02\x02\xB6\xA2\x03\x02\x02\x02\xB6\xA3\x03" +
		"\x02\x02\x02\xB6\xA7\x03\x02\x02\x02\xB6\xA8\x03\x02\x02\x02\xB6\xA9\x03" +
		"\x02\x02\x02\xB6\xAA\x03\x02\x02\x02\xB6\xAB\x03\x02\x02\x02\xB6\xAC\x03" +
		"\x02\x02\x02\xB6\xAD\x03\x02\x02\x02\xB6\xAE\x03\x02\x02\x02\xB6\xAF\x03" +
		"\x02\x02\x02\xB6\xB0\x03\x02\x02\x02\xB6\xB1\x03\x02\x02\x02\xB6\xB2\x03" +
		"\x02\x02\x02\xB6\xB3\x03\x02\x02\x02\xB6\xB4\x03\x02\x02\x02\xB6\xB5\x03" +
		"\x02\x02\x02\xB7\x05\x03\x02\x02\x02\xB8\xBA\x07e\x02\x02\xB9\xB8\x03" +
		"\x02\x02\x02\xBA\xBD\x03\x02\x02\x02\xBB\xB9\x03\x02\x02\x02\xBB\xBC\x03" +
		"\x02\x02\x02\xBC\xBF\x03\x02\x02\x02\xBD\xBB\x03\x02\x02\x02\xBE\xC0\x05" +
		"\x1C\x0F\x02\xBF\xBE\x03\x02\x02\x02\xBF\xC0\x03\x02\x02\x02\xC0\xC4\x03" +
		"\x02\x02\x02\xC1\xC3\x07C\x02\x02\xC2\xC1\x03\x02\x02\x02\xC3\xC6\x03" +
		"\x02\x02\x02\xC4\xC2\x03\x02\x02\x02\xC4\xC5\x03\x02\x02\x02\xC5\xC7\x03" +
		"\x02\x02\x02\xC6\xC4\x03\x02\x02\x02\xC7\xC8\x07g\x02\x02\xC8\xCA\x07" +
		"I\x02\x02\xC9\xCB\x05\x0E\b\x02\xCA\xC9\x03\x02\x02\x02\xCA\xCB\x03\x02" +
		"\x02\x02\xCB\xCC\x03\x02\x02\x02\xCC\xCD\x07J\x02\x02\xCD\xCE\x05\x1E" +
		"\x10\x02\xCE\x07\x03\x02\x02\x02\xCF\xD1\x07e\x02\x02\xD0\xCF\x03\x02" +
		"\x02\x02\xD1\xD2\x03\x02\x02\x02\xD2\xD0\x03\x02\x02\x02\xD2\xD3\x03\x02" +
		"\x02\x02\xD3\xD4\x03\x02\x02\x02\xD4\xD5\x07Q\x02\x02\xD5\t\x03\x02\x02" +
		"\x02\xD6\xD8\x07e\x02\x02\xD7\xD6\x03\x02\x02\x02\xD8\xDB\x03\x02\x02" +
		"\x02\xD9\xD7\x03\x02\x02\x02\xD9\xDA\x03\x02\x02\x02\xDA\xDC\x03\x02\x02" +
		"\x02\xDB\xD9\x03\x02\x02\x02\xDC\xDD\x05\x1C\x0F\x02\xDD\xE2\x05\f\x07" +
		"\x02\xDE\xDF\x07H\x02\x02\xDF\xE1\x05\f\x07\x02\xE0\xDE\x03\x02\x02\x02" +
		"\xE1\xE4\x03\x02\x02\x02\xE2\xE0\x03\x02\x02\x02\xE2\xE3\x03\x02\x02\x02" +
		"\xE3\v\x03\x02\x02\x02\xE4\xE2\x03\x02\x02\x02\xE5\xE7\x07C\x02\x02\xE6" +
		"\xE5\x03\x02\x02\x02\xE7\xEA\x03\x02\x02\x02\xE8\xE6\x03\x02\x02\x02\xE8" +
		"\xE9\x03\x02\x02\x02\xE9\xEB\x03\x02\x02\x02\xEA\xE8\x03\x02\x02\x02\xEB" +
		"\xEE\x07g\x02\x02\xEC\xED\x07Y\x02\x02\xED\xEF\x05$\x13\x02\xEE\xEC\x03" +
		"\x02\x02\x02\xEE\xEF\x03\x02\x02\x02\xEF\r\x03\x02\x02\x02\xF0\xF5\x05" +
		"\x10\t\x02\xF1\xF2\x07H\x02\x02\xF2\xF4\x05\x10\t\x02\xF3\xF1\x03\x02" +
		"\x02\x02\xF4\xF7\x03\x02\x02\x02\xF5\xF3\x03\x02\x02\x02\xF5\xF6\x03\x02" +
		"\x02\x02\xF6\x0F\x03\x02\x02\x02\xF7\xF5\x03\x02\x02\x02\xF8\xFA\x05\x1C" +
		"\x0F\x02\xF9\xFB\x07\x1E\x02\x02\xFA\xF9\x03\x02\x02\x02\xFA\xFB\x03\x02" +
		"\x02\x02\xFB\xFF\x03\x02\x02\x02\xFC\xFE\x07C\x02\x02\xFD\xFC\x03\x02" +
		"\x02\x02\xFE\u0101\x03\x02\x02\x02\xFF\xFD\x03\x02\x02\x02\xFF\u0100\x03" +
		"\x02\x02\x02\u0100\u0102\x03\x02\x02\x02\u0101\xFF\x03\x02\x02\x02\u0102" +
		"\u0104\x07g\x02\x02\u0103\u0105\x070\x02\x02\u0104\u0103\x03\x02\x02\x02" +
		"\u0104\u0105\x03\x02\x02\x02\u0105\u0107\x03\x02\x02\x02\u0106\u0108\x05" +
		"\x12\n\x02\u0107\u0106\x03\x02\x02\x02\u0107\u0108\x03\x02\x02\x02\u0108" +
		"\u0146\x03\x02\x02\x02\u0109\u010B\x05\x1C\x0F\x02\u010A\u010C\x07\x1E" +
		"\x02\x02\u010B\u010A\x03\x02\x02\x02\u010B\u010C\x03\x02\x02\x02\u010C" +
		"\u0110\x03\x02\x02\x02\u010D\u010F\x07C\x02\x02\u010E\u010D\x03\x02\x02" +
		"\x02\u010F\u0112\x03\x02\x02\x02\u0110\u010E\x03\x02\x02\x02\u0110\u0111" +
		"\x03\x02\x02\x02\u0111\u0146\x03\x02\x02\x02\u0112\u0110\x03\x02\x02\x02" +
		"\u0113\u0114\x07\x1E\x02\x02\u0114\u0118\x05\x1C\x0F\x02\u0115\u0117\x07" +
		"C\x02\x02\u0116\u0115\x03\x02\x02\x02\u0117\u011A\x03\x02\x02\x02\u0118" +
		"\u0116\x03\x02\x02\x02\u0118\u0119\x03\x02\x02\x02\u0119\u011B\x03\x02" +
		"\x02\x02\u011A\u0118\x03\x02\x02\x02\u011B\u011D\x07g\x02\x02\u011C\u011E" +
		"\x070\x02\x02\u011D\u011C\x03\x02\x02\x02\u011D\u011E\x03\x02\x02\x02" +
		"\u011E\u0120\x03\x02\x02\x02\u011F\u0121\x05\x12\n\x02\u0120\u011F\x03" +
		"\x02\x02\x02\u0120\u0121\x03\x02\x02\x02\u0121\u0146\x03\x02\x02\x02\u0122" +
		"\u0123\x07\x1E\x02\x02\u0123\u0127\x05\x1C\x0F\x02\u0124\u0126\x07C\x02" +
		"\x02\u0125\u0124\x03\x02\x02\x02\u0126\u0129\x03\x02\x02\x02\u0127\u0125" +
		"\x03\x02\x02\x02\u0127\u0128\x03\x02\x02\x02\u0128\u0146\x03\x02\x02\x02" +
		"\u0129\u0127\x03\x02\x02\x02\u012A\u012E\x07\x1E\x02\x02\u012B\u012D\x07" +
		"C\x02\x02\u012C\u012B\x03\x02\x02\x02\u012D\u0130\x03\x02\x02\x02\u012E" +
		"\u012C\x03\x02\x02\x02\u012E\u012F\x03\x02\x02\x02\u012F\u0131\x03\x02" +
		"\x02\x02\u0130\u012E\x03\x02\x02\x02\u0131\u0133\x07g\x02\x02\u0132\u0134" +
		"\x070\x02\x02\u0133\u0132\x03\x02\x02\x02\u0133\u0134\x03\x02\x02\x02" +
		"\u0134\u0136\x03\x02\x02\x02\u0135\u0137\x05\x12\n\x02\u0136\u0135\x03" +
		"\x02\x02\x02\u0136\u0137\x03\x02\x02\x02\u0137\u0146\x03\x02\x02\x02\u0138" +
		"\u013A\x07C\x02\x02\u0139\u0138\x03\x02\x02\x02\u013A\u013D\x03\x02\x02" +
		"\x02\u013B\u0139\x03\x02\x02\x02\u013B\u013C\x03\x02\x02\x02\u013C\u013E" +
		"\x03\x02\x02\x02\u013D\u013B\x03\x02\x02\x02\u013E\u0140\x07g\x02\x02" +
		"\u013F\u0141\x070\x02\x02\u0140\u013F\x03\x02\x02\x02\u0140\u0141\x03" +
		"\x02\x02\x02\u0141\u0143\x03\x02\x02\x02\u0142\u0144\x05\x12\n\x02\u0143" +
		"\u0142\x03\x02\x02\x02\u0143\u0144\x03\x02\x02\x02\u0144\u0146\x03\x02" +
		"\x02\x02\u0145\xF8\x03\x02\x02\x02\u0145\u0109\x03\x02\x02\x02\u0145\u0113" +
		"\x03\x02\x02\x02\u0145\u0122\x03\x02\x02\x02\u0145\u012A\x03\x02\x02\x02" +
		"\u0145\u013B\x03\x02\x02\x02\u0146\x11\x03\x02\x02\x02\u0147\u0148\x07" +
		"Q\x02\x02\u0148\u0149\x05r:\x02\u0149\x13\x03\x02\x02\x02\u014A\u014B" +
		"\x07)\x02\x02\u014B\u014C\x07g\x02\x02\u014C\u014E\x07K\x02\x02\u014D" +
		"\u014F\x05\x18\r\x02\u014E\u014D\x03\x02\x02\x02\u014E\u014F\x03\x02\x02" +
		"\x02\u014F\u0150\x03\x02\x02\x02\u0150\u0151\x07L\x02\x02\u0151\x15\x03" +
		"\x02\x02\x02\u0152\u0153\x07*\x02\x02\u0153\u0154\x07g\x02\x02\u0154\u0156" +
		"\x07K\x02\x02\u0155\u0157\x05\x18\r\x02\u0156\u0155\x03\x02\x02\x02\u0156" +
		"\u0157\x03\x02\x02\x02\u0157\u0158\x03\x02\x02\x02\u0158\u0159\x07L\x02" +
		"\x02\u0159\x17\x03\x02\x02\x02\u015A\u015C\x05\x1A\x0E\x02\u015B\u015A" +
		"\x03\x02\x02\x02\u015C\u015D\x03\x02\x02\x02\u015D\u015B\x03\x02\x02\x02" +
		"\u015D\u015E\x03\x02\x02\x02\u015E\x19\x03\x02\x02\x02\u015F\u0163\x05" +
		"\x1C\x0F\x02\u0160\u0162\x07C\x02\x02\u0161\u0160\x03\x02\x02\x02\u0162" +
		"\u0165\x03\x02\x02\x02\u0163\u0161\x03\x02\x02\x02\u0163\u0164\x03\x02" +
		"\x02\x02\u0164\u0166\x03\x02\x02\x02\u0165\u0163\x03\x02\x02\x02\u0166" +
		"\u0167\x07g\x02\x02\u0167\u0168\x07G\x02\x02\u0168\x1B\x03\x02\x02\x02" +
		"\u0169\u0183\x07 \x02\x02\u016A\u0183\x07!\x02\x02\u016B\u0183\x07\"\x02" +
		"\x02\u016C\u0183\x07#\x02\x02\u016D\u0183\x07$\x02\x02\u016E\u0183\x07" +
		"%\x02\x02\u016F\u0183\x07&\x02\x02\u0170\u0183\x07\'\x02\x02\u0171\u0183" +
		"\x07(\x02\x02\u0172\u0183\x07)\x02\x02\u0173\u0174\x07)\x02\x02\u0174" +
		"\u0183\x07g\x02\x02\u0175\u0183\x07*\x02\x02\u0176\u0177\x07*\x02\x02" +
		"\u0177\u0183\x07g\x02\x02\u0178\u0183\x07+\x02\x02\u0179\u0183\x07,\x02" +
		"\x02\u017A\u0183\x07-\x02\x02\u017B\u017F\x07g\x02\x02\u017C\u017E\x07" +
		"C\x02\x02\u017D\u017C\x03\x02\x02\x02\u017E\u0181\x03\x02\x02\x02\u017F" +
		"\u017D\x03\x02\x02\x02\u017F\u0180\x03\x02\x02\x02\u0180\u0183\x03\x02" +
		"\x02\x02\u0181\u017F\x03\x02\x02\x02\u0182\u0169\x03\x02\x02\x02\u0182" +
		"\u016A\x03\x02\x02\x02\u0182\u016B\x03\x02\x02\x02\u0182\u016C\x03\x02" +
		"\x02\x02\u0182\u016D\x03\x02\x02\x02\u0182\u016E\x03\x02\x02\x02\u0182" +
		"\u016F\x03\x02\x02\x02\u0182\u0170\x03\x02\x02\x02\u0182\u0171\x03\x02" +
		"\x02\x02\u0182\u0172\x03\x02\x02\x02\u0182\u0173\x03\x02\x02\x02\u0182" +
		"\u0175\x03\x02\x02\x02\u0182\u0176\x03\x02\x02\x02\u0182\u0178\x03\x02" +
		"\x02\x02\u0182\u0179\x03\x02\x02\x02\u0182\u017A\x03\x02\x02\x02\u0182" +
		"\u017B\x03\x02\x02\x02\u0183\x1D\x03\x02\x02\x02\u0184\u0188\x07K\x02" +
		"\x02\u0185\u0187\x05\x04\x03\x02\u0186\u0185\x03\x02\x02\x02\u0187\u018A" +
		"\x03\x02\x02\x02\u0188\u0186\x03\x02\x02\x02\u0188\u0189\x03\x02\x02\x02" +
		"\u0189\u018B\x03\x02\x02\x02\u018A\u0188\x03\x02\x02\x02\u018B\u018C\x07" +
		"L\x02\x02\u018C\x1F\x03\x02\x02\x02\u018D\u018E\x05\"\x12\x02\u018E\u018F" +
		"\x07G\x02\x02\u018F!\x03\x02\x02\x02\u0190\u0195\x05$\x13\x02\u0191\u0192" +
		"\x07H\x02\x02\u0192\u0194\x05$\x13\x02\u0193\u0191\x03\x02\x02\x02\u0194" +
		"\u0197\x03\x02\x02\x02\u0195\u0193\x03\x02\x02\x02\u0195\u0196\x03\x02" +
		"\x02\x02\u0196#\x03\x02\x02\x02\u0197\u0195\x03\x02\x02\x02\u0198\u019B" +
		"\x05&\x14\x02\u0199\u019A\t\x02\x02\x02\u019A\u019C\x05\"\x12\x02\u019B" +
		"\u0199\x03\x02\x02\x02\u019B\u019C\x03\x02\x02\x02\u019C%\x03\x02\x02" +
		"\x02\u019D\u01A3\x05(\x15\x02\u019E\u019F\x07P\x02\x02\u019F\u01A0\x05" +
		"\"\x12\x02\u01A0\u01A1\x07Q\x02\x02\u01A1\u01A2\x05&\x14\x02\u01A2\u01A4" +
		"\x03\x02\x02\x02\u01A3\u019E\x03\x02\x02\x02\u01A3\u01A4\x03\x02\x02\x02" +
		"\u01A4\'\x03\x02\x02\x02\u01A5\u01AA\x05*\x16\x02\u01A6\u01A7\x07O\x02" +
		"\x02\u01A7\u01A9\x05*\x16\x02\u01A8\u01A6\x03\x02\x02\x02\u01A9\u01AC" +
		"\x03\x02\x02\x02\u01AA\u01A8\x03\x02\x02\x02\u01AA\u01AB\x03\x02\x02\x02" +
		"\u01AB)\x03\x02\x02\x02\u01AC\u01AA\x03\x02\x02\x02\u01AD\u01B2\x05,\x17" +
		"\x02\u01AE\u01AF\x07\\\x02\x02\u01AF\u01B1\x05,\x17\x02\u01B0\u01AE\x03" +
		"\x02\x02\x02\u01B1\u01B4\x03\x02\x02\x02\u01B2\u01B0\x03\x02\x02\x02\u01B2";
	private static readonly _serializedATNSegment1: string =
		"\u01B3\x03\x02\x02\x02\u01B3+\x03\x02\x02\x02\u01B4\u01B2\x03\x02\x02" +
		"\x02\u01B5\u01BA\x05.\x18\x02\u01B6\u01B7\x07[\x02\x02\u01B7\u01B9\x05" +
		".\x18\x02\u01B8\u01B6\x03\x02\x02\x02\u01B9\u01BC\x03\x02\x02\x02\u01BA" +
		"\u01B8\x03\x02\x02\x02\u01BA\u01BB\x03\x02\x02\x02\u01BB-\x03\x02\x02" +
		"\x02\u01BC\u01BA\x03\x02\x02\x02\u01BD\u01C2\x050\x19\x02\u01BE\u01BF" +
		"\x07`\x02\x02\u01BF\u01C1\x050\x19\x02\u01C0\u01BE\x03\x02\x02\x02\u01C1" +
		"\u01C4\x03\x02\x02\x02\u01C2\u01C0\x03\x02\x02\x02\u01C2\u01C3\x03\x02" +
		"\x02\x02\u01C3/\x03\x02\x02\x02\u01C4\u01C2\x03\x02\x02\x02\u01C5\u01CA" +
		"\x052\x1A\x02\u01C6\u01C7\x07a\x02\x02\u01C7\u01C9\x052\x1A\x02\u01C8" +
		"\u01C6\x03\x02\x02\x02\u01C9\u01CC\x03\x02\x02\x02\u01CA\u01C8\x03\x02" +
		"\x02\x02\u01CA\u01CB\x03\x02\x02\x02\u01CB1\x03\x02\x02\x02\u01CC\u01CA" +
		"\x03\x02\x02\x02\u01CD\u01D2\x054\x1B\x02\u01CE\u01CF\x07_\x02\x02\u01CF" +
		"\u01D1\x054\x1B\x02\u01D0\u01CE\x03\x02\x02\x02\u01D1\u01D4\x03\x02\x02" +
		"\x02\u01D2\u01D0\x03\x02\x02\x02\u01D2\u01D3\x03\x02\x02\x02\u01D33\x03" +
		"\x02\x02\x02\u01D4\u01D2\x03\x02\x02\x02\u01D5\u01DA\x056\x1C\x02\u01D6" +
		"\u01D7\t\x03\x02\x02\u01D7\u01D9\x056\x1C\x02\u01D8\u01D6\x03\x02\x02" +
		"\x02\u01D9\u01DC\x03\x02\x02\x02\u01DA\u01D8\x03\x02\x02\x02\u01DA\u01DB" +
		"\x03\x02\x02\x02\u01DB5\x03\x02\x02\x02\u01DC\u01DA\x03\x02\x02\x02\u01DD" +
		"\u01E2\x058\x1D\x02\u01DE\u01DF\t\x04\x02\x02\u01DF\u01E1\x058\x1D\x02" +
		"\u01E0\u01DE\x03\x02\x02\x02\u01E1\u01E4\x03\x02\x02\x02\u01E2\u01E0\x03" +
		"\x02\x02\x02\u01E2\u01E3\x03\x02\x02\x02\u01E37\x03\x02\x02\x02\u01E4" +
		"\u01E2\x03\x02\x02\x02\u01E5\u01EA\x05:\x1E\x02\u01E6\u01E7\t\x05\x02" +
		"\x02\u01E7\u01E9\x05:\x1E\x02\u01E8\u01E6\x03\x02\x02\x02\u01E9\u01EC" +
		"\x03\x02\x02\x02\u01EA\u01E8\x03\x02\x02\x02\u01EA\u01EB\x03\x02\x02\x02" +
		"\u01EB9\x03\x02\x02\x02\u01EC\u01EA\x03\x02\x02\x02\u01ED\u01F2\x05<\x1F" +
		"\x02\u01EE\u01EF\t\x06\x02\x02\u01EF\u01F1\x05<\x1F\x02\u01F0\u01EE\x03" +
		"\x02\x02\x02\u01F1\u01F4\x03\x02\x02\x02\u01F2\u01F0\x03\x02\x02\x02\u01F2" +
		"\u01F3\x03\x02\x02\x02\u01F3;\x03\x02\x02\x02\u01F4\u01F2\x03\x02\x02" +
		"\x02\u01F5\u01FA\x05> \x02\u01F6\u01F7\t\x07\x02\x02\u01F7\u01F9\x05>" +
		" \x02\u01F8\u01F6\x03\x02\x02\x02\u01F9\u01FC\x03\x02\x02\x02\u01FA\u01F8" +
		"\x03\x02\x02\x02\u01FA\u01FB\x03\x02\x02\x02\u01FB=\x03\x02\x02\x02\u01FC" +
		"\u01FA\x03\x02\x02\x02\u01FD\u01FF\t\b\x02\x02\u01FE\u01FD\x03\x02\x02" +
		"\x02\u01FE\u01FF\x03\x02\x02\x02\u01FF\u0200\x03\x02\x02\x02\u0200\u020C" +
		"\x05F$\x02\u0201\u0202\t\t\x02\x02\u0202\u020C\x05> \x02\u0203\u0204\x07" +
		"\x1D\x02\x02\u0204\u0205\x07I\x02\x02\u0205\u0206\x05\"\x12\x02\u0206" +
		"\u0207\x07J\x02\x02\u0207\u020C\x03\x02\x02\x02\u0208\u0209\x07\x1D\x02" +
		"\x02\u0209\u020C\x05\x1E\x10\x02\u020A\u020C\x05@!\x02\u020B\u01FE\x03" +
		"\x02\x02\x02\u020B\u0201\x03\x02\x02\x02\u020B\u0203\x03\x02\x02\x02\u020B" +
		"\u0208\x03\x02\x02\x02\u020B\u020A\x03\x02\x02\x02\u020C?\x03\x02\x02" +
		"\x02\u020D\u020E\x07I\x02\x02\u020E\u020F\x05B\"\x02\u020F\u0210\x07J" +
		"\x02\x02\u0210\u0211\x05> \x02\u0211A\x03\x02\x02\x02\u0212\u0216\x05" +
		"D#\x02\u0213\u0215\x07C\x02\x02\u0214\u0213\x03\x02\x02\x02\u0215\u0218" +
		"\x03\x02\x02\x02\u0216\u0214\x03\x02\x02\x02\u0216\u0217\x03\x02\x02\x02" +
		"\u0217C\x03\x02\x02\x02\u0218\u0216\x03\x02\x02\x02\u0219\u022C\x07 \x02" +
		"\x02\u021A\u022C\x07!\x02\x02\u021B\u022C\x07\"\x02\x02\u021C\u022C\x07" +
		"#\x02\x02\u021D\u022C\x07$\x02\x02\u021E\u022C\x07%\x02\x02\u021F\u022C" +
		"\x07&\x02\x02\u0220\u022C\x07\'\x02\x02\u0221\u022C\x07(\x02\x02\u0222" +
		"\u022C\x07)\x02\x02\u0223\u0224\x07)\x02\x02\u0224\u022C\x07g\x02\x02" +
		"\u0225\u022C\x07*\x02\x02\u0226\u0227\x07*\x02\x02\u0227\u022C\x07g\x02" +
		"\x02\u0228\u022C\x07+\x02\x02\u0229\u022C\x07,\x02\x02\u022A\u022C\x07" +
		"-\x02\x02\u022B\u0219\x03\x02\x02\x02\u022B\u021A\x03\x02\x02\x02\u022B" +
		"\u021B\x03\x02\x02\x02\u022B\u021C\x03\x02\x02\x02\u022B\u021D\x03\x02" +
		"\x02\x02\u022B\u021E\x03\x02\x02\x02\u022B\u021F\x03\x02\x02\x02\u022B" +
		"\u0220\x03\x02\x02\x02\u022B\u0221\x03\x02\x02\x02\u022B\u0222\x03\x02" +
		"\x02\x02\u022B\u0223\x03\x02\x02\x02\u022B\u0225\x03\x02\x02\x02\u022B" +
		"\u0226\x03\x02\x02\x02\u022B\u0228\x03\x02\x02\x02\u022B\u0229\x03\x02" +
		"\x02\x02\u022B\u022A\x03\x02\x02\x02\u022CE\x03\x02\x02\x02\u022D\u0244" +
		"\x05J&\x02\u022E\u022F\t\n\x02\x02\u022F\u0235\x07g\x02\x02\u0230\u0232" +
		"\x07I\x02\x02\u0231\u0233\x05H%\x02\u0232\u0231\x03\x02\x02\x02\u0232" +
		"\u0233\x03\x02\x02\x02\u0233\u0234\x03\x02\x02\x02\u0234\u0236\x07J\x02" +
		"\x02\u0235\u0230\x03\x02\x02\x02\u0235\u0236\x03\x02\x02\x02\u0236\u0243" +
		"\x03\x02\x02\x02\u0237\u0239\x07I\x02\x02\u0238\u023A\x05H%\x02\u0239" +
		"\u0238\x03\x02\x02\x02\u0239\u023A\x03\x02\x02\x02\u023A\u023B\x03\x02" +
		"\x02\x02\u023B\u0243\x07J\x02\x02\u023C\u023D\x07M\x02\x02\u023D\u023E" +
		"\x05\x8CG\x02\u023E\u023F\x07N\x02\x02\u023F\u0243\x03\x02\x02\x02\u0240" +
		"\u0243\x074\x02\x02\u0241\u0243\x075\x02\x02\u0242\u022E\x03\x02\x02\x02" +
		"\u0242\u0237\x03\x02\x02\x02\u0242\u023C\x03\x02\x02\x02\u0242\u0240\x03" +
		"\x02\x02\x02\u0242\u0241\x03\x02\x02\x02\u0243\u0246\x03\x02\x02\x02\u0244" +
		"\u0242\x03\x02\x02\x02\u0244\u0245\x03\x02\x02\x02\u0245G\x03\x02\x02" +
		"\x02\u0246\u0244\x03\x02\x02\x02\u0247\u0249\x05$\x13\x02\u0248\u024A" +
		"\x070\x02\x02\u0249\u0248\x03\x02\x02\x02\u0249\u024A\x03\x02\x02\x02" +
		"\u024A\u0252\x03\x02\x02\x02\u024B\u024C\x07H\x02\x02\u024C\u024E\x05" +
		"$\x13\x02\u024D\u024F\x070\x02\x02\u024E\u024D\x03\x02\x02\x02\u024E\u024F" +
		"\x03\x02\x02\x02\u024F\u0251\x03\x02\x02\x02\u0250\u024B\x03\x02\x02\x02" +
		"\u0251\u0254\x03\x02\x02\x02\u0252\u0250\x03\x02\x02\x02\u0252\u0253\x03" +
		"\x02\x02\x02\u0253\u0256\x03\x02\x02\x02\u0254\u0252\x03\x02\x02\x02\u0255" +
		"\u0257\x07H\x02\x02\u0256\u0255\x03\x02\x02\x02\u0256\u0257\x03\x02\x02" +
		"\x02\u0257I\x03\x02\x02\x02\u0258\u0259\x07F\x02\x02\u0259\u0282\x07g" +
		"\x02\x02\u025A\u025B\x07/\x02\x02\u025B\u025C\x07F\x02\x02\u025C\u0282" +
		"\x07g\x02\x02\u025D\u0282\x05L\'\x02\u025E\u0282\x05r:\x02\u025F\u0282" +
		"\x05\x80A\x02\u0260\u0282\x05\x8EH\x02\u0261\u0282\x05\x86D\x02\u0262" +
		"\u0263\x07&\x02\x02\u0263\u0265\x07I\x02\x02\u0264\u0266\x05\x0E\b\x02" +
		"\u0265\u0264\x03\x02\x02\x02\u0265\u0266\x03\x02\x02\x02\u0266\u0267\x03" +
		"\x02\x02\x02\u0267\u0268\x07J\x02\x02\u0268\u0282\x05\x1E\x10\x02\u0269" +
		"\u026A\x07R\x02\x02\u026A\u026B\x07I\x02\x02\u026B\u026C\x05\"\x12\x02" +
		"\u026C\u026D\x07J\x02\x02\u026D\u0282\x03\x02\x02\x02\u026E\u0282\x07" +
		"g\x02\x02\u026F\u0282\x07f\x02\x02\u0270\u0282\x07\x03\x02\x02\u0271\u0282" +
		"\x07\x04\x02\x02\u0272\u0282\x07\x06\x02\x02\u0273\u0282\x07\x05\x02\x02" +
		"\u0274\u0275\x07I\x02\x02\u0275\u0277\x07K\x02\x02\u0276\u0278\x05Z.\x02" +
		"\u0277\u0276\x03\x02\x02\x02\u0277\u0278\x03\x02\x02\x02\u0278\u0279\x03" +
		"\x02\x02\x02\u0279\u027A\x07L\x02\x02\u027A\u0282\x07J\x02\x02\u027B\u027C" +
		"\x07I\x02\x02\u027C\u027D\x05\"\x12\x02\u027D\u027E\x07J\x02\x02\u027E" +
		"\u0282\x03\x02\x02\x02\u027F\u0280\x07\x1E\x02\x02\u0280\u0282\x07g\x02" +
		"\x02\u0281\u0258\x03\x02\x02\x02\u0281\u025A\x03\x02\x02\x02\u0281\u025D" +
		"\x03\x02\x02\x02\u0281\u025E\x03\x02\x02\x02\u0281\u025F\x03\x02\x02\x02" +
		"\u0281\u0260\x03\x02\x02\x02\u0281\u0261\x03\x02\x02\x02\u0281\u0262\x03" +
		"\x02\x02\x02\u0281\u0269\x03\x02\x02\x02\u0281\u026E\x03\x02\x02\x02\u0281" +
		"\u026F\x03\x02\x02\x02\u0281\u0270\x03\x02\x02\x02\u0281\u0271\x03\x02" +
		"\x02\x02\u0281\u0272\x03\x02\x02\x02\u0281\u0273\x03\x02\x02\x02\u0281" +
		"\u0274\x03\x02\x02\x02\u0281\u027B\x03\x02\x02\x02\u0281\u027F\x03\x02" +
		"\x02\x02\u0282K\x03\x02\x02\x02\u0283\u0285\x05N(\x02\u0284\u0283\x03" +
		"\x02\x02\x02\u0285\u0286\x03\x02\x02\x02\u0286\u0284\x03\x02\x02\x02\u0286" +
		"\u0287\x03\x02\x02\x02\u0287M\x03\x02\x02\x02\u0288\u0291\x07\x06\x02" +
		"\x02\u0289\u028A\x07g\x02\x02\u028A\u028C\x07I\x02\x02\u028B\u028D\x05" +
		"H%\x02\u028C\u028B\x03\x02\x02\x02\u028C\u028D\x03\x02\x02\x02\u028D\u028E" +
		"\x03\x02\x02\x02\u028E\u0291\x07J\x02\x02\u028F\u0291\x07g\x02\x02\u0290" +
		"\u0288\x03\x02\x02\x02\u0290\u0289\x03\x02\x02\x02\u0290\u028F\x03\x02" +
		"\x02\x02\u0291O\x03\x02\x02\x02\u0292\u0293\x07\x0F\x02\x02\u0293\u0294" +
		"\x07I\x02\x02\u0294\u0295\x05\"\x12\x02\u0295\u0296\x07J\x02\x02\u0296" +
		"\u0299\x05\x04\x03\x02\u0297\u0298\x07\x10\x02\x02\u0298\u029A\x05\x04" +
		"\x03\x02\u0299\u0297\x03\x02\x02\x02\u0299\u029A\x03\x02\x02\x02\u029A" +
		"Q\x03\x02\x02\x02\u029B\u029C\x07\x12\x02\x02\u029C\u029D\x07I\x02\x02" +
		"\u029D\u029E\x05\"\x12\x02\u029E\u029F\x07J\x02\x02\u029F\u02A0\x05\x04" +
		"\x03\x02\u02A0S\x03\x02\x02\x02\u02A1\u02A2\x07\x13\x02\x02\u02A2\u02A3" +
		"\x05\x04\x03\x02\u02A3\u02A4\x07\x12\x02\x02\u02A4\u02A5\x07I\x02\x02" +
		"\u02A5\u02A6\x05\"\x12\x02\u02A6\u02A7\x07J\x02\x02\u02A7\u02A8\x07G\x02" +
		"\x02\u02A8U\x03\x02\x02\x02\u02A9\u02AA\x07\x11\x02\x02\u02AA\u02AC\x07" +
		"I\x02\x02\u02AB\u02AD\x05X-\x02\u02AC\u02AB\x03\x02\x02\x02\u02AC\u02AD" +
		"\x03\x02\x02\x02\u02AD\u02AE\x03\x02\x02\x02\u02AE\u02B0\x07G\x02\x02" +
		"\u02AF\u02B1\x05\"\x12\x02\u02B0\u02AF\x03\x02\x02\x02\u02B0\u02B1\x03" +
		"\x02\x02\x02\u02B1\u02B2\x03\x02\x02\x02\u02B2\u02B4\x07G\x02\x02\u02B3" +
		"\u02B5\x05Z.\x02\u02B4\u02B3\x03\x02\x02\x02\u02B4\u02B5\x03\x02\x02\x02" +
		"\u02B5\u02B6\x03\x02\x02\x02\u02B6\u02B7\x07J\x02\x02\u02B7\u02B8\x05" +
		"\x04\x03\x02\u02B8W\x03\x02\x02\x02\u02B9\u02BC\x05\n\x06\x02\u02BA\u02BC" +
		"\x05Z.\x02\u02BB\u02B9\x03\x02\x02\x02\u02BB\u02BA\x03\x02\x02\x02\u02BC" +
		"Y\x03\x02\x02\x02\u02BD\u02C2\x05\\/\x02\u02BE\u02BF\x07H\x02\x02\u02BF" +
		"\u02C1\x05\\/\x02\u02C0\u02BE\x03\x02\x02\x02\u02C1\u02C4\x03\x02\x02" +
		"\x02\u02C2\u02C0\x03\x02\x02\x02\u02C2\u02C3\x03\x02\x02\x02\u02C3\u02C6" +
		"\x03\x02\x02\x02\u02C4\u02C2\x03\x02\x02\x02\u02C5\u02C7\x07H\x02\x02" +
		"\u02C6\u02C5\x03\x02\x02\x02\u02C6\u02C7\x03\x02\x02\x02\u02C7[\x03\x02" +
		"\x02\x02\u02C8\u02C9\x070\x02\x02\u02C9\u02CC\x05$\x13\x02\u02CA\u02CC" +
		"\x05$\x13\x02\u02CB\u02C8\x03\x02\x02\x02\u02CB\u02CA\x03\x02\x02\x02" +
		"\u02CC]\x03\x02\x02\x02\u02CD\u02CE\x07\x1A\x02\x02\u02CE\u02CF\x07I\x02" +
		"\x02\u02CF\u02D0\x05`1\x02\u02D0\u02D1\x07\x1F\x02\x02\u02D1\u02D2\x05" +
		"\"\x12\x02\u02D2\u02D3\x07J\x02\x02\u02D3\u02D4\x05\x04\x03\x02\u02D4" +
		"_\x03\x02\x02\x02\u02D5\u02D8\x05b2\x02\u02D6\u02D7\x07H\x02\x02\u02D7" +
		"\u02D9\x05b2\x02\u02D8\u02D6\x03\x02\x02\x02\u02D8\u02D9\x03\x02\x02\x02" +
		"\u02D9a\x03\x02\x02\x02\u02DA\u02DC\x05\x1C\x0F\x02\u02DB\u02DD\x07\x1E" +
		"\x02\x02\u02DC\u02DB\x03\x02\x02\x02\u02DC\u02DD\x03\x02\x02\x02\u02DD" +
		"\u02E1\x03\x02\x02\x02\u02DE\u02E0\x07C\x02\x02\u02DF\u02DE\x03\x02\x02" +
		"\x02\u02E0\u02E3\x03\x02\x02\x02\u02E1\u02DF\x03\x02\x02\x02\u02E1\u02E2" +
		"\x03\x02\x02\x02\u02E2\u02E4\x03\x02\x02\x02\u02E3\u02E1\x03\x02\x02\x02" +
		"\u02E4\u02E5\x07g\x02\x02\u02E5\u0300\x03\x02\x02\x02\u02E6\u02E7\x07" +
		"\x1E\x02\x02\u02E7\u02EB\x05\x1C\x0F\x02\u02E8\u02EA\x07C\x02\x02\u02E9" +
		"\u02E8\x03\x02\x02\x02\u02EA\u02ED\x03\x02\x02\x02\u02EB\u02E9\x03\x02" +
		"\x02\x02\u02EB\u02EC\x03\x02\x02\x02\u02EC\u02EE\x03\x02\x02\x02\u02ED" +
		"\u02EB\x03\x02\x02\x02\u02EE\u02EF\x07g\x02\x02\u02EF\u0300\x03\x02\x02" +
		"\x02\u02F0\u02F4\x07\x1E\x02\x02\u02F1\u02F3\x07C\x02\x02\u02F2\u02F1" +
		"\x03\x02\x02\x02\u02F3\u02F6\x03\x02\x02\x02\u02F4\u02F2\x03\x02\x02\x02" +
		"\u02F4\u02F5\x03\x02\x02\x02\u02F5\u02F7\x03\x02\x02\x02\u02F6\u02F4\x03" +
		"\x02\x02\x02\u02F7\u0300\x07g\x02\x02\u02F8\u02FA\x07C\x02\x02\u02F9\u02F8" +
		"\x03\x02\x02\x02\u02FA\u02FD\x03\x02\x02\x02\u02FB\u02F9\x03\x02\x02\x02" +
		"\u02FB\u02FC\x03\x02\x02\x02\u02FC\u02FE\x03\x02\x02\x02\u02FD\u02FB\x03" +
		"\x02\x02\x02\u02FE\u0300\x07g\x02\x02\u02FF\u02DA\x03\x02\x02\x02\u02FF" +
		"\u02E6\x03\x02\x02\x02\u02FF\u02F0\x03\x02\x02\x02\u02FF\u02FB\x03\x02" +
		"\x02\x02\u0300c\x03\x02\x02\x02\u0301\u0302\x07\x14\x02\x02\u0302\u0303" +
		"\x07I\x02\x02\u0303\u0304\x05\"\x12\x02\u0304\u0305\x07J\x02\x02\u0305" +
		"\u0309\x07K\x02\x02\u0306\u0308\x05f4\x02\u0307\u0306\x03\x02\x02\x02" +
		"\u0308\u030B\x03\x02\x02\x02\u0309\u0307\x03\x02\x02\x02\u0309\u030A\x03" +
		"\x02\x02\x02\u030A\u030C\x03\x02\x02\x02\u030B\u0309\x03\x02\x02\x02\u030C" +
		"\u030D\x07L\x02\x02\u030De\x03\x02\x02\x02\u030E\u0312\x05h5\x02\u030F" +
		"\u0311\x05\x04\x03\x02\u0310\u030F\x03\x02\x02\x02\u0311\u0314\x03\x02" +
		"\x02\x02\u0312\u0310\x03\x02\x02\x02\u0312\u0313\x03\x02\x02\x02\u0313" +
		"\u031E\x03\x02\x02\x02\u0314\u0312\x03\x02\x02\x02\u0315\u0319\x05h5\x02" +
		"\u0316\u0318\x05\x04\x03\x02\u0317\u0316\x03\x02\x02\x02\u0318\u031B\x03" +
		"\x02\x02\x02\u0319\u0317\x03\x02\x02\x02\u0319\u031A\x03\x02\x02\x02\u031A" +
		"\u031D\x03\x02\x02\x02\u031B\u0319\x03\x02\x02\x02\u031C\u0315\x03\x02" +
		"\x02\x02\u031D\u0320\x03\x02\x02\x02\u031E\u031C\x03\x02\x02\x02\u031E" +
		"\u031F\x03\x02\x02\x02\u031Fg\x03\x02\x02\x02\u0320\u031E\x03\x02\x02" +
		"\x02\u0321\u0322\x07\x15\x02\x02\u0322\u0323\x05j6\x02\u0323\u0324\x07" +
		"Q\x02\x02\u0324\u0328\x03\x02\x02\x02\u0325\u0326\x07\x16\x02\x02\u0326" +
		"\u0328\x07Q\x02\x02\u0327\u0321\x03\x02\x02\x02\u0327\u0325\x03\x02\x02" +
		"\x02\u0328i\x03\x02\x02\x02\u0329\u032E\x05\"\x12\x02\u032A\u032C\x07" +
		"1\x02\x02\u032B\u032D\x05\"\x12\x02\u032C\u032B\x03\x02\x02\x02\u032C" +
		"\u032D\x03\x02\x02\x02\u032D\u032F\x03\x02\x02\x02\u032E\u032A\x03\x02" +
		"\x02\x02\u032E\u032F\x03\x02\x02\x02\u032F\u0333\x03\x02\x02\x02\u0330" +
		"\u0331\x071\x02\x02\u0331\u0333\x05\"\x12\x02\u0332\u0329\x03\x02\x02" +
		"\x02\u0332\u0330\x03\x02\x02\x02\u0333k\x03\x02\x02\x02\u0334\u0335\x07" +
		"\x17\x02\x02\u0335\u0336\x07G\x02\x02\u0336m\x03\x02\x02\x02\u0337\u0338" +
		"\x07\x18\x02\x02\u0338\u0339\x07G\x02\x02\u0339o\x03\x02\x02\x02\u033A" +
		"\u033C\x07\x19\x02\x02\u033B\u033D\x05\"\x12\x02\u033C\u033B\x03\x02\x02" +
		"\x02\u033C\u033D\x03\x02\x02\x02\u033D\u033E\x03\x02\x02\x02\u033E\u033F" +
		"\x07G\x02\x02\u033Fq\x03\x02\x02\x02\u0340\u0341\x07I\x02\x02\u0341\u0343" +
		"\x07Q\x02\x02\u0342\u0344\x05t;\x02\u0343\u0342\x03\x02\x02\x02\u0343" +
		"\u0344\x03\x02\x02\x02\u0344\u0345\x03\x02\x02\x02\u0345\u0346\x07Q\x02" +
		"\x02\u0346\u0347\x07J\x02\x02\u0347s\x03\x02\x02\x02\u0348\u034D\x05v" +
		"<\x02\u0349\u034A\x07H\x02\x02\u034A\u034C\x05v<\x02\u034B\u0349\x03\x02" +
		"\x02\x02\u034C\u034F\x03\x02\x02\x02\u034D\u034B\x03\x02\x02\x02\u034D" +
		"\u034E\x03\x02\x02\x02\u034E\u0351\x03\x02\x02\x02\u034F\u034D\x03\x02" +
		"\x02\x02\u0350\u0352\x07H\x02\x02\u0351\u0350\x03\x02\x02\x02\u0351\u0352" +
		"\x03\x02\x02\x02\u0352u\x03\x02\x02\x02\u0353\u0354\x07R\x02\x02\u0354" +
		"\u035F\x07g\x02\x02\u0355\u0356\x07R\x02\x02\u0356\u0357\x07I\x02\x02" +
		"\u0357\u0358\x05\"\x12\x02\u0358\u0359\x07J\x02\x02\u0359\u035F\x03\x02" +
		"\x02\x02\u035A\u035C\x05$\x13\x02\u035B\u035D\x070\x02\x02\u035C\u035B" +
		"\x03\x02\x02\x02\u035C\u035D\x03\x02\x02\x02\u035D\u035F\x03\x02\x02\x02" +
		"\u035E\u0353\x03\x02\x02\x02\u035E\u0355\x03\x02\x02\x02\u035E\u035A\x03" +
		"\x02\x02\x02\u035Fw\x03\x02\x02\x02\u0360\u0361\x07\x1B\x02\x02\u0361" +
		"\u0362\x05\"\x12\x02\u0362\u0363\x07G\x02\x02\u0363y\x03\x02\x02\x02\u0364" +
		"\u0365\x07\x1C\x02\x02\u0365\u0366\x05\"\x12\x02\u0366\u0367\x07G\x02" +
		"\x02\u0367{\x03\x02\x02\x02\u0368\u0369\x07g\x02\x02\u0369\u036B\x07I" +
		"\x02\x02\u036A\u036C\x05H%\x02\u036B\u036A\x03\x02\x02\x02\u036B\u036C" +
		"\x03\x02\x02\x02\u036C\u036D\x03\x02\x02\x02\u036D\u036E\x07J\x02\x02" +
		"\u036E}\x03\x02\x02\x02\u036F\u0371\x07e\x02\x02\u0370\u036F\x03\x02\x02" +
		"\x02\u0371\u0374\x03\x02\x02\x02\u0372\u0370\x03\x02\x02\x02\u0372\u0373" +
		"\x03\x02\x02\x02\u0373\u0376\x03\x02\x02\x02\u0374\u0372\x03\x02\x02\x02" +
		"\u0375\u0377\x05\x1C\x0F\x02\u0376\u0375\x03\x02\x02\x02\u0376\u0377\x03" +
		"\x02\x02\x02\u0377\u037B\x03\x02\x02\x02\u0378\u037A\x07C\x02\x02\u0379" +
		"\u0378\x03\x02\x02\x02\u037A\u037D\x03\x02\x02\x02\u037B\u0379\x03\x02" +
		"\x02\x02\u037B\u037C\x03\x02\x02\x02\u037C\u037E\x03\x02\x02\x02\u037D" +
		"\u037B\x03\x02\x02\x02\u037E\u037F\x07g\x02\x02\u037F\u0381\x07I\x02\x02" +
		"\u0380\u0382\x05\x0E\b\x02\u0381\u0380\x03\x02\x02\x02\u0381\u0382\x03" +
		"\x02\x02\x02\u0382\u0383\x03\x02\x02\x02\u0383\u0384\x07J\x02\x02\u0384" +
		"\u0385\x07G\x02\x02\u0385\x7F\x03\x02\x02\x02\u0386\u0387\x07I\x02\x02" +
		"\u0387\u0389\x07M\x02\x02\u0388\u038A\x05\x82B\x02\u0389\u0388\x03\x02" +
		"\x02\x02\u0389\u038A\x03\x02\x02\x02\u038A\u038B\x03\x02\x02\x02\u038B" +
		"\u038C\x07N\x02\x02\u038C\u038D\x07J\x02\x02\u038D\x81\x03\x02\x02\x02" +
		"\u038E\u0393\x05\x84C\x02\u038F\u0390\x07H\x02\x02\u0390\u0392\x05\x84" +
		"C\x02\u0391\u038F\x03\x02\x02\x02\u0392\u0395\x03\x02\x02\x02\u0393\u0391" +
		"\x03\x02\x02\x02\u0393\u0394\x03\x02\x02\x02\u0394\u0397\x03\x02\x02\x02" +
		"\u0395\u0393\x03\x02\x02\x02\u0396\u0398\x07H\x02\x02\u0397\u0396\x03" +
		"\x02\x02\x02\u0397\u0398\x03\x02\x02\x02\u0398\x83\x03\x02\x02\x02\u0399" +
		"\u039A\x05\"\x12\x02\u039A\u039B\x07Q\x02\x02\u039B\u039C\x05\"\x12\x02" +
		"\u039C\x85\x03\x02\x02\x02\u039D\u039E\x07.\x02\x02\u039E\u03A1\x07I\x02" +
		"\x02\u039F\u03A2\x05\x1C\x0F\x02\u03A0\u03A2\x05\"\x12\x02\u03A1\u039F" +
		"\x03\x02\x02\x02\u03A1\u03A0\x03\x02\x02\x02\u03A2\u03A5\x03\x02\x02\x02" +
		"\u03A3\u03A4\x07H\x02\x02\u03A4\u03A6\x05\x88E\x02\u03A5\u03A3\x03\x02" +
		"\x02\x02\u03A5\u03A6\x03\x02\x02\x02\u03A6\u03A7\x03\x02\x02\x02\u03A7" +
		"\u03A8\x07J\x02\x02\u03A8\x87\x03\x02\x02\x02\u03A9\u03AE\x05\x8AF\x02" +
		"\u03AA\u03AB\x07H\x02\x02\u03AB\u03AD\x05\x8AF\x02\u03AC\u03AA\x03\x02" +
		"\x02\x02\u03AD\u03B0\x03\x02\x02\x02\u03AE\u03AC\x03\x02\x02\x02\u03AE" +
		"\u03AF\x03\x02\x02\x02\u03AF\x89\x03\x02\x02\x02\u03B0\u03AE\x03\x02\x02" +
		"\x02\u03B1\u03B2\x07g\x02\x02\u03B2\u03B3\x07Q\x02\x02\u03B3\u03B4\x05" +
		"\"\x12\x02\u03B4\x8B\x03\x02\x02\x02\u03B5\u03B6\x07T\x02\x02\u03B6\u03D1" +
		"\x05\"\x12\x02\u03B7\u03B8\x05\"\x12\x02\u03B8\u03BA\x071\x02\x02\u03B9" +
		"\u03BB\x07T\x02\x02\u03BA\u03B9\x03\x02\x02\x02\u03BA\u03BB\x03\x02\x02" +
		"\x02\u03BB\u03BD\x03\x02\x02\x02\u03BC\u03BE\x05\"\x12\x02\u03BD\u03BC" +
		"\x03\x02\x02\x02\u03BD\u03BE\x03\x02\x02\x02\u03BE\u03D1\x03\x02\x02\x02" +
		"\u03BF\u03C1\x071\x02\x02\u03C0\u03C2\x07T\x02\x02\u03C1\u03C0\x03\x02" +
		"\x02\x02\u03C1\u03C2\x03\x02\x02\x02\u03C2\u03C4\x03\x02\x02\x02\u03C3" +
		"\u03C5\x05\"\x12\x02\u03C4\u03C3\x03\x02\x02\x02\u03C4\u03C5\x03\x02\x02" +
		"\x02\u03C5\u03D1\x03\x02\x02\x02\u03C6\u03D1\x05\"\x12\x02\u03C7\u03C8" +
		"\x07T\x02\x02\u03C8\u03C9\x05\"\x12\x02\u03C9\u03CB\x071\x02\x02\u03CA" +
		"\u03CC\x07T\x02\x02\u03CB\u03CA\x03\x02\x02\x02\u03CB\u03CC\x03\x02\x02" +
		"\x02\u03CC\u03CE\x03\x02\x02\x02\u03CD\u03CF\x05\"\x12\x02\u03CE\u03CD" +
		"\x03\x02\x02\x02\u03CE\u03CF\x03\x02\x02\x02\u03CF\u03D1\x03\x02\x02\x02" +
		"\u03D0\u03B5\x03\x02\x02\x02\u03D0\u03B7\x03\x02\x02\x02\u03D0\u03BF\x03" +
		"\x02\x02\x02\u03D0\u03C6\x03\x02\x02\x02\u03D0\u03C7\x03\x02\x02\x02\u03D1" +
		"\x8D\x03\x02\x02\x02\u03D2\u03D4\x07\b\x02\x02\u03D3\u03D5\x05\x90I\x02" +
		"\u03D4\u03D3\x03\x02\x02\x02\u03D4\u03D5\x03\x02\x02\x02\u03D5\u03D6\x03" +
		"\x02\x02\x02\u03D6\u03D7\x07\n\x02\x02\u03D7\x8F\x03\x02\x02\x02\u03D8" +
		"\u03DA\x05\x92J\x02\u03D9\u03D8\x03\x02\x02\x02\u03DA\u03DB\x03\x02\x02" +
		"\x02\u03DB\u03D9\x03\x02\x02\x02\u03DB\u03DC\x03\x02\x02\x02\u03DC\x91" +
		"\x03\x02\x02\x02\u03DD\u03DE\t\v\x02\x02\u03DE\x93\x03\x02\x02\x02y\x97" +
		"\xA5\xB6\xBB\xBF\xC4\xCA\xD2\xD9\xE2\xE8\xEE\xF5\xFA\xFF\u0104\u0107\u010B" +
		"\u0110\u0118\u011D\u0120\u0127\u012E\u0133\u0136\u013B\u0140\u0143\u0145" +
		"\u014E\u0156\u015D\u0163\u017F\u0182\u0188\u0195\u019B\u01A3\u01AA\u01B2" +
		"\u01BA\u01C2\u01CA\u01D2\u01DA\u01E2\u01EA\u01F2\u01FA\u01FE\u020B\u0216" +
		"\u022B\u0232\u0235\u0239\u0242\u0244\u0249\u024E\u0252\u0256\u0265\u0277" +
		"\u0281\u0286\u028C\u0290\u0299\u02AC\u02B0\u02B4\u02BB\u02C2\u02C6\u02CB" +
		"\u02D8\u02DC\u02E1\u02EB\u02F4\u02FB\u02FF\u0309\u0312\u0319\u031E\u0327" +
		"\u032C\u032E\u0332\u033C\u0343\u034D\u0351\u035C\u035E\u036B\u0372\u0376" +
		"\u037B\u0381\u0389\u0393\u0397\u03A1\u03A5\u03AE\u03BA\u03BD\u03C1\u03C4" +
		"\u03CB\u03CE\u03D0\u03D4\u03DB";
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
	public modifierSection(): ModifierSectionContext | undefined {
		return this.tryGetRuleContext(0, ModifierSectionContext);
	}
	public variableDecl(): VariableDeclContext | undefined {
		return this.tryGetRuleContext(0, VariableDeclContext);
	}
	public SEMI(): TerminalNode | undefined { return this.tryGetToken(LPCParser.SEMI, 0); }
	public structDef(): StructDefContext | undefined {
		return this.tryGetRuleContext(0, StructDefContext);
	}
	public classDef(): ClassDefContext | undefined {
		return this.tryGetRuleContext(0, ClassDefContext);
	}
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


export class ModifierSectionContext extends ParserRuleContext {
	public COLON(): TerminalNode { return this.getToken(LPCParser.COLON, 0); }
	public MODIFIER(): TerminalNode[];
	public MODIFIER(i: number): TerminalNode;
	public MODIFIER(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.MODIFIER);
		} else {
			return this.getToken(LPCParser.MODIFIER, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_modifierSection; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitModifierSection) {
			return visitor.visitModifierSection(this);
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
	public assignmentExpression(): AssignmentExpressionContext | undefined {
		return this.tryGetRuleContext(0, AssignmentExpressionContext);
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
	public parameterDefault(): ParameterDefaultContext | undefined {
		return this.tryGetRuleContext(0, ParameterDefaultContext);
	}
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


export class ParameterDefaultContext extends ParserRuleContext {
	public COLON(): TerminalNode { return this.getToken(LPCParser.COLON, 0); }
	public closureExpr(): ClosureExprContext {
		return this.getRuleContext(0, ClosureExprContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_parameterDefault; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitParameterDefault) {
			return visitor.visitParameterDefault(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class StructDefContext extends ParserRuleContext {
	public KW_STRUCT(): TerminalNode { return this.getToken(LPCParser.KW_STRUCT, 0); }
	public Identifier(): TerminalNode { return this.getToken(LPCParser.Identifier, 0); }
	public LBRACE(): TerminalNode { return this.getToken(LPCParser.LBRACE, 0); }
	public RBRACE(): TerminalNode { return this.getToken(LPCParser.RBRACE, 0); }
	public structMemberList(): StructMemberListContext | undefined {
		return this.tryGetRuleContext(0, StructMemberListContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_structDef; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitStructDef) {
			return visitor.visitStructDef(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ClassDefContext extends ParserRuleContext {
	public KW_CLASS(): TerminalNode { return this.getToken(LPCParser.KW_CLASS, 0); }
	public Identifier(): TerminalNode { return this.getToken(LPCParser.Identifier, 0); }
	public LBRACE(): TerminalNode { return this.getToken(LPCParser.LBRACE, 0); }
	public RBRACE(): TerminalNode { return this.getToken(LPCParser.RBRACE, 0); }
	public structMemberList(): StructMemberListContext | undefined {
		return this.tryGetRuleContext(0, StructMemberListContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_classDef; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitClassDef) {
			return visitor.visitClassDef(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class StructMemberListContext extends ParserRuleContext {
	public structMember(): StructMemberContext[];
	public structMember(i: number): StructMemberContext;
	public structMember(i?: number): StructMemberContext | StructMemberContext[] {
		if (i === undefined) {
			return this.getRuleContexts(StructMemberContext);
		} else {
			return this.getRuleContext(i, StructMemberContext);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_structMemberList; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitStructMemberList) {
			return visitor.visitStructMemberList(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class StructMemberContext extends ParserRuleContext {
	public typeSpec(): TypeSpecContext {
		return this.getRuleContext(0, TypeSpecContext);
	}
	public Identifier(): TerminalNode { return this.getToken(LPCParser.Identifier, 0); }
	public SEMI(): TerminalNode { return this.getToken(LPCParser.SEMI, 0); }
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
	public get ruleIndex(): number { return LPCParser.RULE_structMember; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitStructMember) {
			return visitor.visitStructMember(this);
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
	public KW_CLASS(): TerminalNode | undefined { return this.tryGetToken(LPCParser.KW_CLASS, 0); }
	public KW_ARRAY(): TerminalNode | undefined { return this.tryGetToken(LPCParser.KW_ARRAY, 0); }
	public KW_CLOSURE(): TerminalNode | undefined { return this.tryGetToken(LPCParser.KW_CLOSURE, 0); }
	public KW_TREE(): TerminalNode | undefined { return this.tryGetToken(LPCParser.KW_TREE, 0); }
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
	public BIT_XOR_ASSIGN(): TerminalNode | undefined { return this.tryGetToken(LPCParser.BIT_XOR_ASSIGN, 0); }
	public SHIFT_LEFT_ASSIGN(): TerminalNode | undefined { return this.tryGetToken(LPCParser.SHIFT_LEFT_ASSIGN, 0); }
	public SHIFT_RIGHT_ASSIGN(): TerminalNode | undefined { return this.tryGetToken(LPCParser.SHIFT_RIGHT_ASSIGN, 0); }
	public NULLISH_ASSIGN(): TerminalNode | undefined { return this.tryGetToken(LPCParser.NULLISH_ASSIGN, 0); }
	public LOGICAL_OR_ASSIGN(): TerminalNode | undefined { return this.tryGetToken(LPCParser.LOGICAL_OR_ASSIGN, 0); }
	public LOGICAL_AND_ASSIGN(): TerminalNode | undefined { return this.tryGetToken(LPCParser.LOGICAL_AND_ASSIGN, 0); }
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
	public nullishExpression(): NullishExpressionContext {
		return this.getRuleContext(0, NullishExpressionContext);
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


export class NullishExpressionContext extends ParserRuleContext {
	public logicalOrExpression(): LogicalOrExpressionContext[];
	public logicalOrExpression(i: number): LogicalOrExpressionContext;
	public logicalOrExpression(i?: number): LogicalOrExpressionContext | LogicalOrExpressionContext[] {
		if (i === undefined) {
			return this.getRuleContexts(LogicalOrExpressionContext);
		} else {
			return this.getRuleContext(i, LogicalOrExpressionContext);
		}
	}
	public NULLISH(): TerminalNode[];
	public NULLISH(i: number): TerminalNode;
	public NULLISH(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.NULLISH);
		} else {
			return this.getToken(LPCParser.NULLISH, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_nullishExpression; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitNullishExpression) {
			return visitor.visitNullishExpression(this);
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
	public castBaseType(): CastBaseTypeContext {
		return this.getRuleContext(0, CastBaseTypeContext);
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


export class CastBaseTypeContext extends ParserRuleContext {
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
	public KW_CLASS(): TerminalNode | undefined { return this.tryGetToken(LPCParser.KW_CLASS, 0); }
	public KW_ARRAY(): TerminalNode | undefined { return this.tryGetToken(LPCParser.KW_ARRAY, 0); }
	public KW_CLOSURE(): TerminalNode | undefined { return this.tryGetToken(LPCParser.KW_CLOSURE, 0); }
	public KW_TREE(): TerminalNode | undefined { return this.tryGetToken(LPCParser.KW_TREE, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_castBaseType; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitCastBaseType) {
			return visitor.visitCastBaseType(this);
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
export class EfunScopeIdentifierContext extends PrimaryContext {
	public KW_EFUN(): TerminalNode { return this.getToken(LPCParser.KW_EFUN, 0); }
	public SCOPE(): TerminalNode { return this.getToken(LPCParser.SCOPE, 0); }
	public Identifier(): TerminalNode { return this.getToken(LPCParser.Identifier, 0); }
	constructor(ctx: PrimaryContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitEfunScopeIdentifier) {
			return visitor.visitEfunScopeIdentifier(this);
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
export class ArrayDelimiterExprContext extends PrimaryContext {
	public arrayDelimiterLiteral(): ArrayDelimiterLiteralContext {
		return this.getRuleContext(0, ArrayDelimiterLiteralContext);
	}
	constructor(ctx: PrimaryContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitArrayDelimiterExpr) {
			return visitor.visitArrayDelimiterExpr(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class NewExpressionPrimaryContext extends PrimaryContext {
	public newExpression(): NewExpressionContext {
		return this.getRuleContext(0, NewExpressionContext);
	}
	constructor(ctx: PrimaryContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitNewExpressionPrimary) {
			return visitor.visitNewExpressionPrimary(this);
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
export class DollarCallExprContext extends PrimaryContext {
	public DOLLAR(): TerminalNode { return this.getToken(LPCParser.DOLLAR, 0); }
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
		if (visitor.visitDollarCallExpr) {
			return visitor.visitDollarCallExpr(this);
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
export class ParameterPlaceholderContext extends PrimaryContext {
	public PARAMETER_PLACEHOLDER(): TerminalNode { return this.getToken(LPCParser.PARAMETER_PLACEHOLDER, 0); }
	constructor(ctx: PrimaryContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitParameterPlaceholder) {
			return visitor.visitParameterPlaceholder(this);
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
	public spreadElement(): SpreadElementContext[];
	public spreadElement(i: number): SpreadElementContext;
	public spreadElement(i?: number): SpreadElementContext | SpreadElementContext[] {
		if (i === undefined) {
			return this.getRuleContexts(SpreadElementContext);
		} else {
			return this.getRuleContext(i, SpreadElementContext);
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


export class SpreadElementContext extends ParserRuleContext {
	public ELLIPSIS(): TerminalNode | undefined { return this.tryGetToken(LPCParser.ELLIPSIS, 0); }
	public assignmentExpression(): AssignmentExpressionContext {
		return this.getRuleContext(0, AssignmentExpressionContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_spreadElement; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitSpreadElement) {
			return visitor.visitSpreadElement(this);
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
	public closureArgumentList(): ClosureArgumentListContext | undefined {
		return this.tryGetRuleContext(0, ClosureArgumentListContext);
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


export class ClosureArgumentListContext extends ParserRuleContext {
	public closureArgument(): ClosureArgumentContext[];
	public closureArgument(i: number): ClosureArgumentContext;
	public closureArgument(i?: number): ClosureArgumentContext | ClosureArgumentContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ClosureArgumentContext);
		} else {
			return this.getRuleContext(i, ClosureArgumentContext);
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
	public get ruleIndex(): number { return LPCParser.RULE_closureArgumentList; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitClosureArgumentList) {
			return visitor.visitClosureArgumentList(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ClosureArgumentContext extends ParserRuleContext {
	public DOLLAR(): TerminalNode | undefined { return this.tryGetToken(LPCParser.DOLLAR, 0); }
	public Identifier(): TerminalNode | undefined { return this.tryGetToken(LPCParser.Identifier, 0); }
	public LPAREN(): TerminalNode | undefined { return this.tryGetToken(LPCParser.LPAREN, 0); }
	public expression(): ExpressionContext | undefined {
		return this.tryGetRuleContext(0, ExpressionContext);
	}
	public RPAREN(): TerminalNode | undefined { return this.tryGetToken(LPCParser.RPAREN, 0); }
	public assignmentExpression(): AssignmentExpressionContext | undefined {
		return this.tryGetRuleContext(0, AssignmentExpressionContext);
	}
	public ELLIPSIS(): TerminalNode | undefined { return this.tryGetToken(LPCParser.ELLIPSIS, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_closureArgument; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitClosureArgument) {
			return visitor.visitClosureArgument(this);
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


export class NewExpressionContext extends ParserRuleContext {
	public KW_NEW(): TerminalNode { return this.getToken(LPCParser.KW_NEW, 0); }
	public LPAREN(): TerminalNode { return this.getToken(LPCParser.LPAREN, 0); }
	public RPAREN(): TerminalNode { return this.getToken(LPCParser.RPAREN, 0); }
	public typeSpec(): TypeSpecContext | undefined {
		return this.tryGetRuleContext(0, TypeSpecContext);
	}
	public expression(): ExpressionContext | undefined {
		return this.tryGetRuleContext(0, ExpressionContext);
	}
	public COMMA(): TerminalNode | undefined { return this.tryGetToken(LPCParser.COMMA, 0); }
	public structInitializerList(): StructInitializerListContext | undefined {
		return this.tryGetRuleContext(0, StructInitializerListContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_newExpression; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitNewExpression) {
			return visitor.visitNewExpression(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class StructInitializerListContext extends ParserRuleContext {
	public structInitializer(): StructInitializerContext[];
	public structInitializer(i: number): StructInitializerContext;
	public structInitializer(i?: number): StructInitializerContext | StructInitializerContext[] {
		if (i === undefined) {
			return this.getRuleContexts(StructInitializerContext);
		} else {
			return this.getRuleContext(i, StructInitializerContext);
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
	public get ruleIndex(): number { return LPCParser.RULE_structInitializerList; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitStructInitializerList) {
			return visitor.visitStructInitializerList(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class StructInitializerContext extends ParserRuleContext {
	public Identifier(): TerminalNode { return this.getToken(LPCParser.Identifier, 0); }
	public COLON(): TerminalNode { return this.getToken(LPCParser.COLON, 0); }
	public expression(): ExpressionContext {
		return this.getRuleContext(0, ExpressionContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_structInitializer; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitStructInitializer) {
			return visitor.visitStructInitializer(this);
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


export class ArrayDelimiterLiteralContext extends ParserRuleContext {
	public ARRAY_DELIMITER_START(): TerminalNode { return this.getToken(LPCParser.ARRAY_DELIMITER_START, 0); }
	public ARRAY_DELIMITER_END(): TerminalNode { return this.getToken(LPCParser.ARRAY_DELIMITER_END, 0); }
	public arrayDelimiterContent(): ArrayDelimiterContentContext | undefined {
		return this.tryGetRuleContext(0, ArrayDelimiterContentContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_arrayDelimiterLiteral; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitArrayDelimiterLiteral) {
			return visitor.visitArrayDelimiterLiteral(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ArrayDelimiterContentContext extends ParserRuleContext {
	public arrayDelimiterElement(): ArrayDelimiterElementContext[];
	public arrayDelimiterElement(i: number): ArrayDelimiterElementContext;
	public arrayDelimiterElement(i?: number): ArrayDelimiterElementContext | ArrayDelimiterElementContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ArrayDelimiterElementContext);
		} else {
			return this.getRuleContext(i, ArrayDelimiterElementContext);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_arrayDelimiterContent; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitArrayDelimiterContent) {
			return visitor.visitArrayDelimiterContent(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ArrayDelimiterElementContext extends ParserRuleContext {
	public STRING_LITERAL(): TerminalNode | undefined { return this.tryGetToken(LPCParser.STRING_LITERAL, 0); }
	public INTEGER(): TerminalNode | undefined { return this.tryGetToken(LPCParser.INTEGER, 0); }
	public FLOAT(): TerminalNode | undefined { return this.tryGetToken(LPCParser.FLOAT, 0); }
	public CHAR_LITERAL(): TerminalNode | undefined { return this.tryGetToken(LPCParser.CHAR_LITERAL, 0); }
	public Identifier(): TerminalNode | undefined { return this.tryGetToken(LPCParser.Identifier, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_arrayDelimiterElement; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitArrayDelimiterElement) {
			return visitor.visitArrayDelimiterElement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


