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
	public static readonly KW_NEW = 41;
	public static readonly KW_SIZEOF = 42;
	public static readonly KW_EFUN = 43;
	public static readonly ELLIPSIS = 44;
	public static readonly RANGE_OP = 45;
	public static readonly ARROW = 46;
	public static readonly DOT = 47;
	public static readonly INC = 48;
	public static readonly DEC = 49;
	public static readonly SHIFT_LEFT_ASSIGN = 50;
	public static readonly SHIFT_RIGHT_ASSIGN = 51;
	public static readonly PLUS_ASSIGN = 52;
	public static readonly MINUS_ASSIGN = 53;
	public static readonly STAR_ASSIGN = 54;
	public static readonly DIV_ASSIGN = 55;
	public static readonly PERCENT_ASSIGN = 56;
	public static readonly BIT_XOR_ASSIGN = 57;
	public static readonly PLUS = 58;
	public static readonly MINUS = 59;
	public static readonly STAR = 60;
	public static readonly DIV = 61;
	public static readonly PERCENT = 62;
	public static readonly SCOPE = 63;
	public static readonly SEMI = 64;
	public static readonly COMMA = 65;
	public static readonly LPAREN = 66;
	public static readonly RPAREN = 67;
	public static readonly LBRACE = 68;
	public static readonly RBRACE = 69;
	public static readonly LBRACK = 70;
	public static readonly RBRACK = 71;
	public static readonly QUESTION = 72;
	public static readonly COLON = 73;
	public static readonly DOLLAR = 74;
	public static readonly GT = 75;
	public static readonly LT = 76;
	public static readonly GE = 77;
	public static readonly LE = 78;
	public static readonly EQ = 79;
	public static readonly NE = 80;
	public static readonly ASSIGN = 81;
	public static readonly NOT = 82;
	public static readonly AND = 83;
	public static readonly OR = 84;
	public static readonly SHIFT_LEFT = 85;
	public static readonly SHIFT_RIGHT = 86;
	public static readonly BIT_AND = 87;
	public static readonly BIT_OR = 88;
	public static readonly BIT_XOR = 89;
	public static readonly BIT_NOT = 90;
	public static readonly BIT_OR_ASSIGN = 91;
	public static readonly BIT_AND_ASSIGN = 92;
	public static readonly MODIFIER = 93;
	public static readonly PARAMETER_PLACEHOLDER = 94;
	public static readonly Identifier = 95;
	public static readonly RULE_sourceFile = 0;
	public static readonly RULE_statement = 1;
	public static readonly RULE_functionDef = 2;
	public static readonly RULE_variableDecl = 3;
	public static readonly RULE_variableDeclarator = 4;
	public static readonly RULE_parameterList = 5;
	public static readonly RULE_parameter = 6;
	public static readonly RULE_parameterDefault = 7;
	public static readonly RULE_structDef = 8;
	public static readonly RULE_classDef = 9;
	public static readonly RULE_structMemberList = 10;
	public static readonly RULE_structMember = 11;
	public static readonly RULE_typeSpec = 12;
	public static readonly RULE_block = 13;
	public static readonly RULE_exprStatement = 14;
	public static readonly RULE_expression = 15;
	public static readonly RULE_assignmentExpression = 16;
	public static readonly RULE_conditionalExpression = 17;
	public static readonly RULE_logicalOrExpression = 18;
	public static readonly RULE_logicalAndExpression = 19;
	public static readonly RULE_bitwiseOrExpression = 20;
	public static readonly RULE_bitwiseXorExpression = 21;
	public static readonly RULE_bitwiseAndExpression = 22;
	public static readonly RULE_equalityExpression = 23;
	public static readonly RULE_relationalExpression = 24;
	public static readonly RULE_shiftExpression = 25;
	public static readonly RULE_additiveExpression = 26;
	public static readonly RULE_multiplicativeExpression = 27;
	public static readonly RULE_unaryExpression = 28;
	public static readonly RULE_sizeofExpression = 29;
	public static readonly RULE_castExpression = 30;
	public static readonly RULE_castType = 31;
	public static readonly RULE_postfixExpression = 32;
	public static readonly RULE_argumentList = 33;
	public static readonly RULE_primary = 34;
	public static readonly RULE_stringConcat = 35;
	public static readonly RULE_concatItem = 36;
	public static readonly RULE_ifStatement = 37;
	public static readonly RULE_whileStatement = 38;
	public static readonly RULE_doWhileStatement = 39;
	public static readonly RULE_forStatement = 40;
	public static readonly RULE_forInit = 41;
	public static readonly RULE_expressionList = 42;
	public static readonly RULE_spreadElement = 43;
	public static readonly RULE_foreachStatement = 44;
	public static readonly RULE_foreachInit = 45;
	public static readonly RULE_foreachVar = 46;
	public static readonly RULE_switchStatement = 47;
	public static readonly RULE_switchSection = 48;
	public static readonly RULE_switchLabelWithColon = 49;
	public static readonly RULE_switchLabel = 50;
	public static readonly RULE_breakStatement = 51;
	public static readonly RULE_continueStatement = 52;
	public static readonly RULE_returnStatement = 53;
	public static readonly RULE_closureExpr = 54;
	public static readonly RULE_closureArgumentList = 55;
	public static readonly RULE_closureArgument = 56;
	public static readonly RULE_inheritStatement = 57;
	public static readonly RULE_includeStatement = 58;
	public static readonly RULE_macroInvoke = 59;
	public static readonly RULE_prototypeStatement = 60;
	public static readonly RULE_mappingLiteral = 61;
	public static readonly RULE_mappingPairList = 62;
	public static readonly RULE_mappingPair = 63;
	public static readonly RULE_newExpression = 64;
	public static readonly RULE_structInitializerList = 65;
	public static readonly RULE_structInitializer = 66;
	public static readonly RULE_sliceExpr = 67;
	public static readonly RULE_arrayDelimiterLiteral = 68;
	public static readonly RULE_arrayDelimiterContent = 69;
	public static readonly RULE_arrayDelimiterElement = 70;
	// tslint:disable:no-trailing-whitespace
	public static readonly ruleNames: string[] = [
		"sourceFile", "statement", "functionDef", "variableDecl", "variableDeclarator", 
		"parameterList", "parameter", "parameterDefault", "structDef", "classDef", 
		"structMemberList", "structMember", "typeSpec", "block", "exprStatement", 
		"expression", "assignmentExpression", "conditionalExpression", "logicalOrExpression", 
		"logicalAndExpression", "bitwiseOrExpression", "bitwiseXorExpression", 
		"bitwiseAndExpression", "equalityExpression", "relationalExpression", 
		"shiftExpression", "additiveExpression", "multiplicativeExpression", "unaryExpression", 
		"sizeofExpression", "castExpression", "castType", "postfixExpression", 
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
		"'class'", "'new'", "'sizeof'", "'efun'", "'...'", "'..'", "'->'", "'.'", 
		"'++'", "'--'", "'<<='", "'>>='", "'+='", "'-='", "'*='", "'/='", "'%='", 
		"'^='", "'+'", "'-'", "'*'", "'/'", "'%'", "'::'", "';'", "','", "'('", 
		"')'", "'{'", "'}'", "'['", "']'", "'?'", "':'", "'$'", "'>'", "'<'", 
		"'>='", "'<='", "'=='", "'!='", "'='", "'!'", "'&&'", "'||'", "'<<'", 
		"'>>'", "'&'", "'|'", "'^'", "'~'", "'|='", "'&='",
	];
	private static readonly _SYMBOLIC_NAMES: Array<string | undefined> = [
		undefined, "INTEGER", "FLOAT", "CHAR_LITERAL", "STRING_LITERAL", "HEREDOC_START", 
		"ARRAY_DELIMITER_START", "HEREDOC_END", "ARRAY_DELIMITER_END", "WS", "LINE_COMMENT", 
		"BLOCK_COMMENT", "DIRECTIVE", "IF", "ELSE", "FOR", "WHILE", "DO", "SWITCH", 
		"CASE", "DEFAULT", "BREAK", "CONTINUE", "RETURN", "FOREACH", "INHERIT", 
		"INCLUDE", "CATCH", "REF", "IN", "KW_INT", "KW_FLOAT", "KW_STRING", "KW_OBJECT", 
		"KW_MIXED", "KW_MAPPING", "KW_FUNCTION", "KW_BUFFER", "KW_VOID", "KW_STRUCT", 
		"KW_CLASS", "KW_NEW", "KW_SIZEOF", "KW_EFUN", "ELLIPSIS", "RANGE_OP", 
		"ARROW", "DOT", "INC", "DEC", "SHIFT_LEFT_ASSIGN", "SHIFT_RIGHT_ASSIGN", 
		"PLUS_ASSIGN", "MINUS_ASSIGN", "STAR_ASSIGN", "DIV_ASSIGN", "PERCENT_ASSIGN", 
		"BIT_XOR_ASSIGN", "PLUS", "MINUS", "STAR", "DIV", "PERCENT", "SCOPE", 
		"SEMI", "COMMA", "LPAREN", "RPAREN", "LBRACE", "RBRACE", "LBRACK", "RBRACK", 
		"QUESTION", "COLON", "DOLLAR", "GT", "LT", "GE", "LE", "EQ", "NE", "ASSIGN", 
		"NOT", "AND", "OR", "SHIFT_LEFT", "SHIFT_RIGHT", "BIT_AND", "BIT_OR", 
		"BIT_XOR", "BIT_NOT", "BIT_OR_ASSIGN", "BIT_AND_ASSIGN", "MODIFIER", "PARAMETER_PLACEHOLDER", 
		"Identifier",
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
			this.state = 145;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.IF) | (1 << LPCParser.FOR) | (1 << LPCParser.WHILE) | (1 << LPCParser.DO) | (1 << LPCParser.SWITCH) | (1 << LPCParser.BREAK) | (1 << LPCParser.CONTINUE) | (1 << LPCParser.RETURN) | (1 << LPCParser.FOREACH) | (1 << LPCParser.INHERIT) | (1 << LPCParser.INCLUDE) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF) | (1 << LPCParser.KW_INT) | (1 << LPCParser.KW_FLOAT))) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & ((1 << (LPCParser.KW_STRING - 32)) | (1 << (LPCParser.KW_OBJECT - 32)) | (1 << (LPCParser.KW_MIXED - 32)) | (1 << (LPCParser.KW_MAPPING - 32)) | (1 << (LPCParser.KW_FUNCTION - 32)) | (1 << (LPCParser.KW_BUFFER - 32)) | (1 << (LPCParser.KW_VOID - 32)) | (1 << (LPCParser.KW_STRUCT - 32)) | (1 << (LPCParser.KW_CLASS - 32)) | (1 << (LPCParser.KW_NEW - 32)) | (1 << (LPCParser.KW_SIZEOF - 32)) | (1 << (LPCParser.KW_EFUN - 32)) | (1 << (LPCParser.INC - 32)) | (1 << (LPCParser.DEC - 32)) | (1 << (LPCParser.PLUS - 32)) | (1 << (LPCParser.MINUS - 32)) | (1 << (LPCParser.STAR - 32)) | (1 << (LPCParser.SCOPE - 32)))) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & ((1 << (LPCParser.SEMI - 64)) | (1 << (LPCParser.LPAREN - 64)) | (1 << (LPCParser.LBRACE - 64)) | (1 << (LPCParser.DOLLAR - 64)) | (1 << (LPCParser.NOT - 64)) | (1 << (LPCParser.BIT_NOT - 64)) | (1 << (LPCParser.MODIFIER - 64)) | (1 << (LPCParser.PARAMETER_PLACEHOLDER - 64)) | (1 << (LPCParser.Identifier - 64)))) !== 0)) {
				{
				{
				this.state = 142;
				this.statement();
				}
				}
				this.state = 147;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 148;
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
			this.state = 175;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 2, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 150;
				this.functionDef();
				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 151;
				this.variableDecl();
				this.state = 152;
				this.match(LPCParser.SEMI);
				}
				break;

			case 3:
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 154;
				this.structDef();
				}
				break;

			case 4:
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 155;
				this.classDef();
				}
				break;

			case 5:
				this.enterOuterAlt(_localctx, 5);
				{
				this.state = 156;
				this.macroInvoke();
				this.state = 158;
				this._errHandler.sync(this);
				switch ( this.interpreter.adaptivePredict(this._input, 1, this._ctx) ) {
				case 1:
					{
					this.state = 157;
					this.match(LPCParser.SEMI);
					}
					break;
				}
				}
				break;

			case 6:
				this.enterOuterAlt(_localctx, 6);
				{
				this.state = 160;
				this.ifStatement();
				}
				break;

			case 7:
				this.enterOuterAlt(_localctx, 7);
				{
				this.state = 161;
				this.whileStatement();
				}
				break;

			case 8:
				this.enterOuterAlt(_localctx, 8);
				{
				this.state = 162;
				this.forStatement();
				}
				break;

			case 9:
				this.enterOuterAlt(_localctx, 9);
				{
				this.state = 163;
				this.doWhileStatement();
				}
				break;

			case 10:
				this.enterOuterAlt(_localctx, 10);
				{
				this.state = 164;
				this.foreachStatement();
				}
				break;

			case 11:
				this.enterOuterAlt(_localctx, 11);
				{
				this.state = 165;
				this.switchStatement();
				}
				break;

			case 12:
				this.enterOuterAlt(_localctx, 12);
				{
				this.state = 166;
				this.breakStatement();
				}
				break;

			case 13:
				this.enterOuterAlt(_localctx, 13);
				{
				this.state = 167;
				this.continueStatement();
				}
				break;

			case 14:
				this.enterOuterAlt(_localctx, 14);
				{
				this.state = 168;
				this.returnStatement();
				}
				break;

			case 15:
				this.enterOuterAlt(_localctx, 15);
				{
				this.state = 169;
				this.inheritStatement();
				}
				break;

			case 16:
				this.enterOuterAlt(_localctx, 16);
				{
				this.state = 170;
				this.includeStatement();
				}
				break;

			case 17:
				this.enterOuterAlt(_localctx, 17);
				{
				this.state = 171;
				this.block();
				}
				break;

			case 18:
				this.enterOuterAlt(_localctx, 18);
				{
				this.state = 172;
				this.exprStatement();
				}
				break;

			case 19:
				this.enterOuterAlt(_localctx, 19);
				{
				this.state = 173;
				this.prototypeStatement();
				}
				break;

			case 20:
				this.enterOuterAlt(_localctx, 20);
				{
				this.state = 174;
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
			this.state = 180;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.MODIFIER) {
				{
				{
				this.state = 177;
				this.match(LPCParser.MODIFIER);
				}
				}
				this.state = 182;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 184;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 4, this._ctx) ) {
			case 1:
				{
				this.state = 183;
				this.typeSpec();
				}
				break;
			}
			this.state = 189;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.STAR) {
				{
				{
				this.state = 186;
				this.match(LPCParser.STAR);
				}
				}
				this.state = 191;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 192;
			this.match(LPCParser.Identifier);
			this.state = 193;
			this.match(LPCParser.LPAREN);
			this.state = 195;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 30)) & ~0x1F) === 0 && ((1 << (_la - 30)) & ((1 << (LPCParser.KW_INT - 30)) | (1 << (LPCParser.KW_FLOAT - 30)) | (1 << (LPCParser.KW_STRING - 30)) | (1 << (LPCParser.KW_OBJECT - 30)) | (1 << (LPCParser.KW_MIXED - 30)) | (1 << (LPCParser.KW_MAPPING - 30)) | (1 << (LPCParser.KW_FUNCTION - 30)) | (1 << (LPCParser.KW_BUFFER - 30)) | (1 << (LPCParser.KW_VOID - 30)) | (1 << (LPCParser.KW_STRUCT - 30)) | (1 << (LPCParser.KW_CLASS - 30)) | (1 << (LPCParser.STAR - 30)))) !== 0) || _la === LPCParser.Identifier) {
				{
				this.state = 194;
				this.parameterList();
				}
			}

			this.state = 197;
			this.match(LPCParser.RPAREN);
			this.state = 198;
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
			this.state = 203;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.MODIFIER) {
				{
				{
				this.state = 200;
				this.match(LPCParser.MODIFIER);
				}
				}
				this.state = 205;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 206;
			this.typeSpec();
			this.state = 207;
			this.variableDeclarator();
			this.state = 212;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.COMMA) {
				{
				{
				this.state = 208;
				this.match(LPCParser.COMMA);
				this.state = 209;
				this.variableDeclarator();
				}
				}
				this.state = 214;
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
			this.state = 218;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.STAR) {
				{
				{
				this.state = 215;
				this.match(LPCParser.STAR);
				}
				}
				this.state = 220;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 221;
			this.match(LPCParser.Identifier);
			this.state = 224;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === LPCParser.ASSIGN) {
				{
				this.state = 222;
				this.match(LPCParser.ASSIGN);
				this.state = 223;
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
			this.state = 226;
			this.parameter();
			this.state = 231;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.COMMA) {
				{
				{
				this.state = 227;
				this.match(LPCParser.COMMA);
				this.state = 228;
				this.parameter();
				}
				}
				this.state = 233;
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
			this.state = 274;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 21, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 234;
				this.typeSpec();
				this.state = 236;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.REF) {
					{
					this.state = 235;
					this.match(LPCParser.REF);
					}
				}

				this.state = 241;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === LPCParser.STAR) {
					{
					{
					this.state = 238;
					this.match(LPCParser.STAR);
					}
					}
					this.state = 243;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 244;
				this.match(LPCParser.Identifier);
				this.state = 246;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.ELLIPSIS) {
					{
					this.state = 245;
					this.match(LPCParser.ELLIPSIS);
					}
				}

				this.state = 249;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.COLON) {
					{
					this.state = 248;
					this.parameterDefault();
					}
				}

				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 251;
				this.typeSpec();
				this.state = 253;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.REF) {
					{
					this.state = 252;
					this.match(LPCParser.REF);
					}
				}

				this.state = 258;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === LPCParser.STAR) {
					{
					{
					this.state = 255;
					this.match(LPCParser.STAR);
					}
					}
					this.state = 260;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
				break;

			case 3:
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 264;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === LPCParser.STAR) {
					{
					{
					this.state = 261;
					this.match(LPCParser.STAR);
					}
					}
					this.state = 266;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 267;
				this.match(LPCParser.Identifier);
				this.state = 269;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.ELLIPSIS) {
					{
					this.state = 268;
					this.match(LPCParser.ELLIPSIS);
					}
				}

				this.state = 272;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.COLON) {
					{
					this.state = 271;
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
		this.enterRule(_localctx, 14, LPCParser.RULE_parameterDefault);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 276;
			this.match(LPCParser.COLON);
			this.state = 277;
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
		this.enterRule(_localctx, 16, LPCParser.RULE_structDef);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 279;
			this.match(LPCParser.KW_STRUCT);
			this.state = 280;
			this.match(LPCParser.Identifier);
			this.state = 281;
			this.match(LPCParser.LBRACE);
			this.state = 283;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 30)) & ~0x1F) === 0 && ((1 << (_la - 30)) & ((1 << (LPCParser.KW_INT - 30)) | (1 << (LPCParser.KW_FLOAT - 30)) | (1 << (LPCParser.KW_STRING - 30)) | (1 << (LPCParser.KW_OBJECT - 30)) | (1 << (LPCParser.KW_MIXED - 30)) | (1 << (LPCParser.KW_MAPPING - 30)) | (1 << (LPCParser.KW_FUNCTION - 30)) | (1 << (LPCParser.KW_BUFFER - 30)) | (1 << (LPCParser.KW_VOID - 30)) | (1 << (LPCParser.KW_STRUCT - 30)) | (1 << (LPCParser.KW_CLASS - 30)))) !== 0) || _la === LPCParser.Identifier) {
				{
				this.state = 282;
				this.structMemberList();
				}
			}

			this.state = 285;
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
		this.enterRule(_localctx, 18, LPCParser.RULE_classDef);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 287;
			this.match(LPCParser.KW_CLASS);
			this.state = 288;
			this.match(LPCParser.Identifier);
			this.state = 289;
			this.match(LPCParser.LBRACE);
			this.state = 291;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 30)) & ~0x1F) === 0 && ((1 << (_la - 30)) & ((1 << (LPCParser.KW_INT - 30)) | (1 << (LPCParser.KW_FLOAT - 30)) | (1 << (LPCParser.KW_STRING - 30)) | (1 << (LPCParser.KW_OBJECT - 30)) | (1 << (LPCParser.KW_MIXED - 30)) | (1 << (LPCParser.KW_MAPPING - 30)) | (1 << (LPCParser.KW_FUNCTION - 30)) | (1 << (LPCParser.KW_BUFFER - 30)) | (1 << (LPCParser.KW_VOID - 30)) | (1 << (LPCParser.KW_STRUCT - 30)) | (1 << (LPCParser.KW_CLASS - 30)))) !== 0) || _la === LPCParser.Identifier) {
				{
				this.state = 290;
				this.structMemberList();
				}
			}

			this.state = 293;
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
		this.enterRule(_localctx, 20, LPCParser.RULE_structMemberList);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 296;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 295;
				this.structMember();
				}
				}
				this.state = 298;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while (((((_la - 30)) & ~0x1F) === 0 && ((1 << (_la - 30)) & ((1 << (LPCParser.KW_INT - 30)) | (1 << (LPCParser.KW_FLOAT - 30)) | (1 << (LPCParser.KW_STRING - 30)) | (1 << (LPCParser.KW_OBJECT - 30)) | (1 << (LPCParser.KW_MIXED - 30)) | (1 << (LPCParser.KW_MAPPING - 30)) | (1 << (LPCParser.KW_FUNCTION - 30)) | (1 << (LPCParser.KW_BUFFER - 30)) | (1 << (LPCParser.KW_VOID - 30)) | (1 << (LPCParser.KW_STRUCT - 30)) | (1 << (LPCParser.KW_CLASS - 30)))) !== 0) || _la === LPCParser.Identifier);
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
		this.enterRule(_localctx, 22, LPCParser.RULE_structMember);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 300;
			this.typeSpec();
			this.state = 304;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.STAR) {
				{
				{
				this.state = 301;
				this.match(LPCParser.STAR);
				}
				}
				this.state = 306;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 307;
			this.match(LPCParser.Identifier);
			this.state = 308;
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
		this.enterRule(_localctx, 24, LPCParser.RULE_typeSpec);
		try {
			let _alt: number;
			this.state = 330;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 27, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 310;
				this.match(LPCParser.KW_INT);
				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 311;
				this.match(LPCParser.KW_FLOAT);
				}
				break;

			case 3:
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 312;
				this.match(LPCParser.KW_STRING);
				}
				break;

			case 4:
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 313;
				this.match(LPCParser.KW_OBJECT);
				}
				break;

			case 5:
				this.enterOuterAlt(_localctx, 5);
				{
				this.state = 314;
				this.match(LPCParser.KW_MIXED);
				}
				break;

			case 6:
				this.enterOuterAlt(_localctx, 6);
				{
				this.state = 315;
				this.match(LPCParser.KW_MAPPING);
				}
				break;

			case 7:
				this.enterOuterAlt(_localctx, 7);
				{
				this.state = 316;
				this.match(LPCParser.KW_FUNCTION);
				}
				break;

			case 8:
				this.enterOuterAlt(_localctx, 8);
				{
				this.state = 317;
				this.match(LPCParser.KW_BUFFER);
				}
				break;

			case 9:
				this.enterOuterAlt(_localctx, 9);
				{
				this.state = 318;
				this.match(LPCParser.KW_VOID);
				}
				break;

			case 10:
				this.enterOuterAlt(_localctx, 10);
				{
				this.state = 319;
				this.match(LPCParser.KW_STRUCT);
				}
				break;

			case 11:
				this.enterOuterAlt(_localctx, 11);
				{
				this.state = 320;
				this.match(LPCParser.KW_CLASS);
				}
				break;

			case 12:
				this.enterOuterAlt(_localctx, 12);
				{
				this.state = 321;
				this.match(LPCParser.KW_CLASS);
				this.state = 322;
				this.match(LPCParser.Identifier);
				}
				break;

			case 13:
				this.enterOuterAlt(_localctx, 13);
				{
				this.state = 323;
				this.match(LPCParser.Identifier);
				this.state = 327;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 26, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 324;
						this.match(LPCParser.STAR);
						}
						}
					}
					this.state = 329;
					this._errHandler.sync(this);
					_alt = this.interpreter.adaptivePredict(this._input, 26, this._ctx);
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
		this.enterRule(_localctx, 26, LPCParser.RULE_block);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 332;
			this.match(LPCParser.LBRACE);
			this.state = 336;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.IF) | (1 << LPCParser.FOR) | (1 << LPCParser.WHILE) | (1 << LPCParser.DO) | (1 << LPCParser.SWITCH) | (1 << LPCParser.BREAK) | (1 << LPCParser.CONTINUE) | (1 << LPCParser.RETURN) | (1 << LPCParser.FOREACH) | (1 << LPCParser.INHERIT) | (1 << LPCParser.INCLUDE) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF) | (1 << LPCParser.KW_INT) | (1 << LPCParser.KW_FLOAT))) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & ((1 << (LPCParser.KW_STRING - 32)) | (1 << (LPCParser.KW_OBJECT - 32)) | (1 << (LPCParser.KW_MIXED - 32)) | (1 << (LPCParser.KW_MAPPING - 32)) | (1 << (LPCParser.KW_FUNCTION - 32)) | (1 << (LPCParser.KW_BUFFER - 32)) | (1 << (LPCParser.KW_VOID - 32)) | (1 << (LPCParser.KW_STRUCT - 32)) | (1 << (LPCParser.KW_CLASS - 32)) | (1 << (LPCParser.KW_NEW - 32)) | (1 << (LPCParser.KW_SIZEOF - 32)) | (1 << (LPCParser.KW_EFUN - 32)) | (1 << (LPCParser.INC - 32)) | (1 << (LPCParser.DEC - 32)) | (1 << (LPCParser.PLUS - 32)) | (1 << (LPCParser.MINUS - 32)) | (1 << (LPCParser.STAR - 32)) | (1 << (LPCParser.SCOPE - 32)))) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & ((1 << (LPCParser.SEMI - 64)) | (1 << (LPCParser.LPAREN - 64)) | (1 << (LPCParser.LBRACE - 64)) | (1 << (LPCParser.DOLLAR - 64)) | (1 << (LPCParser.NOT - 64)) | (1 << (LPCParser.BIT_NOT - 64)) | (1 << (LPCParser.MODIFIER - 64)) | (1 << (LPCParser.PARAMETER_PLACEHOLDER - 64)) | (1 << (LPCParser.Identifier - 64)))) !== 0)) {
				{
				{
				this.state = 333;
				this.statement();
				}
				}
				this.state = 338;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 339;
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
		this.enterRule(_localctx, 28, LPCParser.RULE_exprStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 341;
			this.expression();
			this.state = 342;
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
		this.enterRule(_localctx, 30, LPCParser.RULE_expression);
		try {
			let _alt: number;
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 344;
			this.assignmentExpression();
			this.state = 349;
			this._errHandler.sync(this);
			_alt = this.interpreter.adaptivePredict(this._input, 29, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 345;
					this.match(LPCParser.COMMA);
					this.state = 346;
					this.assignmentExpression();
					}
					}
				}
				this.state = 351;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 29, this._ctx);
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
		this.enterRule(_localctx, 32, LPCParser.RULE_assignmentExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 352;
			this.conditionalExpression();
			this.state = 355;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 50)) & ~0x1F) === 0 && ((1 << (_la - 50)) & ((1 << (LPCParser.SHIFT_LEFT_ASSIGN - 50)) | (1 << (LPCParser.SHIFT_RIGHT_ASSIGN - 50)) | (1 << (LPCParser.PLUS_ASSIGN - 50)) | (1 << (LPCParser.MINUS_ASSIGN - 50)) | (1 << (LPCParser.STAR_ASSIGN - 50)) | (1 << (LPCParser.DIV_ASSIGN - 50)) | (1 << (LPCParser.PERCENT_ASSIGN - 50)) | (1 << (LPCParser.BIT_XOR_ASSIGN - 50)) | (1 << (LPCParser.ASSIGN - 50)))) !== 0) || _la === LPCParser.BIT_OR_ASSIGN || _la === LPCParser.BIT_AND_ASSIGN) {
				{
				this.state = 353;
				_la = this._input.LA(1);
				if (!(((((_la - 50)) & ~0x1F) === 0 && ((1 << (_la - 50)) & ((1 << (LPCParser.SHIFT_LEFT_ASSIGN - 50)) | (1 << (LPCParser.SHIFT_RIGHT_ASSIGN - 50)) | (1 << (LPCParser.PLUS_ASSIGN - 50)) | (1 << (LPCParser.MINUS_ASSIGN - 50)) | (1 << (LPCParser.STAR_ASSIGN - 50)) | (1 << (LPCParser.DIV_ASSIGN - 50)) | (1 << (LPCParser.PERCENT_ASSIGN - 50)) | (1 << (LPCParser.BIT_XOR_ASSIGN - 50)) | (1 << (LPCParser.ASSIGN - 50)))) !== 0) || _la === LPCParser.BIT_OR_ASSIGN || _la === LPCParser.BIT_AND_ASSIGN)) {
				this._errHandler.recoverInline(this);
				} else {
					if (this._input.LA(1) === Token.EOF) {
						this.matchedEOF = true;
					}

					this._errHandler.reportMatch(this);
					this.consume();
				}
				this.state = 354;
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
		this.enterRule(_localctx, 34, LPCParser.RULE_conditionalExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 357;
			this.logicalOrExpression();
			this.state = 363;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === LPCParser.QUESTION) {
				{
				this.state = 358;
				this.match(LPCParser.QUESTION);
				this.state = 359;
				this.expression();
				this.state = 360;
				this.match(LPCParser.COLON);
				this.state = 361;
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
		this.enterRule(_localctx, 36, LPCParser.RULE_logicalOrExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 365;
			this.logicalAndExpression();
			this.state = 370;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.OR) {
				{
				{
				this.state = 366;
				this.match(LPCParser.OR);
				this.state = 367;
				this.logicalAndExpression();
				}
				}
				this.state = 372;
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
		this.enterRule(_localctx, 38, LPCParser.RULE_logicalAndExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 373;
			this.bitwiseOrExpression();
			this.state = 378;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.AND) {
				{
				{
				this.state = 374;
				this.match(LPCParser.AND);
				this.state = 375;
				this.bitwiseOrExpression();
				}
				}
				this.state = 380;
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
		this.enterRule(_localctx, 40, LPCParser.RULE_bitwiseOrExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 381;
			this.bitwiseXorExpression();
			this.state = 386;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.BIT_OR) {
				{
				{
				this.state = 382;
				this.match(LPCParser.BIT_OR);
				this.state = 383;
				this.bitwiseXorExpression();
				}
				}
				this.state = 388;
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
		this.enterRule(_localctx, 42, LPCParser.RULE_bitwiseXorExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 389;
			this.bitwiseAndExpression();
			this.state = 394;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.BIT_XOR) {
				{
				{
				this.state = 390;
				this.match(LPCParser.BIT_XOR);
				this.state = 391;
				this.bitwiseAndExpression();
				}
				}
				this.state = 396;
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
		this.enterRule(_localctx, 44, LPCParser.RULE_bitwiseAndExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 397;
			this.equalityExpression();
			this.state = 402;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.BIT_AND) {
				{
				{
				this.state = 398;
				this.match(LPCParser.BIT_AND);
				this.state = 399;
				this.equalityExpression();
				}
				}
				this.state = 404;
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
		this.enterRule(_localctx, 46, LPCParser.RULE_equalityExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 405;
			this.relationalExpression();
			this.state = 410;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.EQ || _la === LPCParser.NE) {
				{
				{
				this.state = 406;
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
				this.state = 407;
				this.relationalExpression();
				}
				}
				this.state = 412;
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
		this.enterRule(_localctx, 48, LPCParser.RULE_relationalExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 413;
			this.shiftExpression();
			this.state = 418;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 75)) & ~0x1F) === 0 && ((1 << (_la - 75)) & ((1 << (LPCParser.GT - 75)) | (1 << (LPCParser.LT - 75)) | (1 << (LPCParser.GE - 75)) | (1 << (LPCParser.LE - 75)))) !== 0)) {
				{
				{
				this.state = 414;
				_la = this._input.LA(1);
				if (!(((((_la - 75)) & ~0x1F) === 0 && ((1 << (_la - 75)) & ((1 << (LPCParser.GT - 75)) | (1 << (LPCParser.LT - 75)) | (1 << (LPCParser.GE - 75)) | (1 << (LPCParser.LE - 75)))) !== 0))) {
				this._errHandler.recoverInline(this);
				} else {
					if (this._input.LA(1) === Token.EOF) {
						this.matchedEOF = true;
					}

					this._errHandler.reportMatch(this);
					this.consume();
				}
				this.state = 415;
				this.shiftExpression();
				}
				}
				this.state = 420;
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
		this.enterRule(_localctx, 50, LPCParser.RULE_shiftExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 421;
			this.additiveExpression();
			this.state = 426;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.SHIFT_LEFT || _la === LPCParser.SHIFT_RIGHT) {
				{
				{
				this.state = 422;
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
				this.state = 423;
				this.additiveExpression();
				}
				}
				this.state = 428;
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
		this.enterRule(_localctx, 52, LPCParser.RULE_additiveExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 429;
			this.multiplicativeExpression();
			this.state = 434;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.PLUS || _la === LPCParser.MINUS) {
				{
				{
				this.state = 430;
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
				this.state = 431;
				this.multiplicativeExpression();
				}
				}
				this.state = 436;
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
		this.enterRule(_localctx, 54, LPCParser.RULE_multiplicativeExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 437;
			this.unaryExpression();
			this.state = 442;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 60)) & ~0x1F) === 0 && ((1 << (_la - 60)) & ((1 << (LPCParser.STAR - 60)) | (1 << (LPCParser.DIV - 60)) | (1 << (LPCParser.PERCENT - 60)))) !== 0)) {
				{
				{
				this.state = 438;
				_la = this._input.LA(1);
				if (!(((((_la - 60)) & ~0x1F) === 0 && ((1 << (_la - 60)) & ((1 << (LPCParser.STAR - 60)) | (1 << (LPCParser.DIV - 60)) | (1 << (LPCParser.PERCENT - 60)))) !== 0))) {
				this._errHandler.recoverInline(this);
				} else {
					if (this._input.LA(1) === Token.EOF) {
						this.matchedEOF = true;
					}

					this._errHandler.reportMatch(this);
					this.consume();
				}
				this.state = 439;
				this.unaryExpression();
				}
				}
				this.state = 444;
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
		this.enterRule(_localctx, 56, LPCParser.RULE_unaryExpression);
		let _la: number;
		try {
			this.state = 460;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 43, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 446;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.INC || _la === LPCParser.DEC) {
					{
					this.state = 445;
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

				this.state = 448;
				this.postfixExpression();
				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 449;
				_la = this._input.LA(1);
				if (!(((((_la - 58)) & ~0x1F) === 0 && ((1 << (_la - 58)) & ((1 << (LPCParser.PLUS - 58)) | (1 << (LPCParser.MINUS - 58)) | (1 << (LPCParser.STAR - 58)) | (1 << (LPCParser.NOT - 58)))) !== 0) || _la === LPCParser.BIT_NOT)) {
				this._errHandler.recoverInline(this);
				} else {
					if (this._input.LA(1) === Token.EOF) {
						this.matchedEOF = true;
					}

					this._errHandler.reportMatch(this);
					this.consume();
				}
				this.state = 450;
				this.unaryExpression();
				}
				break;

			case 3:
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 451;
				this.sizeofExpression();
				}
				break;

			case 4:
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 452;
				this.match(LPCParser.CATCH);
				this.state = 453;
				this.match(LPCParser.LPAREN);
				this.state = 454;
				this.expression();
				this.state = 455;
				this.match(LPCParser.RPAREN);
				}
				break;

			case 5:
				this.enterOuterAlt(_localctx, 5);
				{
				this.state = 457;
				this.match(LPCParser.CATCH);
				this.state = 458;
				this.block();
				}
				break;

			case 6:
				this.enterOuterAlt(_localctx, 6);
				{
				this.state = 459;
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
	public sizeofExpression(): SizeofExpressionContext {
		let _localctx: SizeofExpressionContext = new SizeofExpressionContext(this._ctx, this.state);
		this.enterRule(_localctx, 58, LPCParser.RULE_sizeofExpression);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 462;
			this.match(LPCParser.KW_SIZEOF);
			this.state = 463;
			this.match(LPCParser.LPAREN);
			this.state = 466;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 44, this._ctx) ) {
			case 1:
				{
				this.state = 464;
				this.expression();
				}
				break;

			case 2:
				{
				this.state = 465;
				this.typeSpec();
				}
				break;
			}
			this.state = 468;
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
	public castExpression(): CastExpressionContext {
		let _localctx: CastExpressionContext = new CastExpressionContext(this._ctx, this.state);
		this.enterRule(_localctx, 60, LPCParser.RULE_castExpression);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 470;
			this.match(LPCParser.LPAREN);
			this.state = 471;
			this.castType();
			this.state = 472;
			this.match(LPCParser.RPAREN);
			this.state = 473;
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
		this.enterRule(_localctx, 62, LPCParser.RULE_castType);
		try {
			this.state = 488;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 45, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 475;
				this.match(LPCParser.KW_INT);
				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 476;
				this.match(LPCParser.KW_FLOAT);
				}
				break;

			case 3:
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 477;
				this.match(LPCParser.KW_STRING);
				}
				break;

			case 4:
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 478;
				this.match(LPCParser.KW_OBJECT);
				}
				break;

			case 5:
				this.enterOuterAlt(_localctx, 5);
				{
				this.state = 479;
				this.match(LPCParser.KW_MIXED);
				}
				break;

			case 6:
				this.enterOuterAlt(_localctx, 6);
				{
				this.state = 480;
				this.match(LPCParser.KW_MAPPING);
				}
				break;

			case 7:
				this.enterOuterAlt(_localctx, 7);
				{
				this.state = 481;
				this.match(LPCParser.KW_FUNCTION);
				}
				break;

			case 8:
				this.enterOuterAlt(_localctx, 8);
				{
				this.state = 482;
				this.match(LPCParser.KW_BUFFER);
				}
				break;

			case 9:
				this.enterOuterAlt(_localctx, 9);
				{
				this.state = 483;
				this.match(LPCParser.KW_VOID);
				}
				break;

			case 10:
				this.enterOuterAlt(_localctx, 10);
				{
				this.state = 484;
				this.match(LPCParser.KW_STRUCT);
				}
				break;

			case 11:
				this.enterOuterAlt(_localctx, 11);
				{
				this.state = 485;
				this.match(LPCParser.KW_CLASS);
				}
				break;

			case 12:
				this.enterOuterAlt(_localctx, 12);
				{
				this.state = 486;
				this.match(LPCParser.KW_CLASS);
				this.state = 487;
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
	public postfixExpression(): PostfixExpressionContext {
		let _localctx: PostfixExpressionContext = new PostfixExpressionContext(this._ctx, this.state);
		this.enterRule(_localctx, 64, LPCParser.RULE_postfixExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 490;
			this.primary();
			this.state = 513;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 46)) & ~0x1F) === 0 && ((1 << (_la - 46)) & ((1 << (LPCParser.ARROW - 46)) | (1 << (LPCParser.DOT - 46)) | (1 << (LPCParser.INC - 46)) | (1 << (LPCParser.DEC - 46)) | (1 << (LPCParser.SCOPE - 46)) | (1 << (LPCParser.LPAREN - 46)) | (1 << (LPCParser.LBRACK - 46)))) !== 0)) {
				{
				this.state = 511;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case LPCParser.ARROW:
				case LPCParser.DOT:
				case LPCParser.SCOPE:
					{
					{
					this.state = 491;
					_la = this._input.LA(1);
					if (!(((((_la - 46)) & ~0x1F) === 0 && ((1 << (_la - 46)) & ((1 << (LPCParser.ARROW - 46)) | (1 << (LPCParser.DOT - 46)) | (1 << (LPCParser.SCOPE - 46)))) !== 0))) {
					this._errHandler.recoverInline(this);
					} else {
						if (this._input.LA(1) === Token.EOF) {
							this.matchedEOF = true;
						}

						this._errHandler.reportMatch(this);
						this.consume();
					}
					this.state = 492;
					this.match(LPCParser.Identifier);
					this.state = 498;
					this._errHandler.sync(this);
					switch ( this.interpreter.adaptivePredict(this._input, 47, this._ctx) ) {
					case 1:
						{
						this.state = 493;
						this.match(LPCParser.LPAREN);
						this.state = 495;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & ((1 << (LPCParser.KW_FUNCTION - 36)) | (1 << (LPCParser.KW_NEW - 36)) | (1 << (LPCParser.KW_SIZEOF - 36)) | (1 << (LPCParser.KW_EFUN - 36)) | (1 << (LPCParser.INC - 36)) | (1 << (LPCParser.DEC - 36)) | (1 << (LPCParser.PLUS - 36)) | (1 << (LPCParser.MINUS - 36)) | (1 << (LPCParser.STAR - 36)) | (1 << (LPCParser.SCOPE - 36)) | (1 << (LPCParser.LPAREN - 36)))) !== 0) || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & ((1 << (LPCParser.DOLLAR - 74)) | (1 << (LPCParser.NOT - 74)) | (1 << (LPCParser.BIT_NOT - 74)) | (1 << (LPCParser.PARAMETER_PLACEHOLDER - 74)) | (1 << (LPCParser.Identifier - 74)))) !== 0)) {
							{
							this.state = 494;
							this.argumentList();
							}
						}

						this.state = 497;
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
					this.state = 500;
					this.match(LPCParser.LPAREN);
					this.state = 502;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & ((1 << (LPCParser.KW_FUNCTION - 36)) | (1 << (LPCParser.KW_NEW - 36)) | (1 << (LPCParser.KW_SIZEOF - 36)) | (1 << (LPCParser.KW_EFUN - 36)) | (1 << (LPCParser.INC - 36)) | (1 << (LPCParser.DEC - 36)) | (1 << (LPCParser.PLUS - 36)) | (1 << (LPCParser.MINUS - 36)) | (1 << (LPCParser.STAR - 36)) | (1 << (LPCParser.SCOPE - 36)) | (1 << (LPCParser.LPAREN - 36)))) !== 0) || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & ((1 << (LPCParser.DOLLAR - 74)) | (1 << (LPCParser.NOT - 74)) | (1 << (LPCParser.BIT_NOT - 74)) | (1 << (LPCParser.PARAMETER_PLACEHOLDER - 74)) | (1 << (LPCParser.Identifier - 74)))) !== 0)) {
						{
						this.state = 501;
						this.argumentList();
						}
					}

					this.state = 504;
					this.match(LPCParser.RPAREN);
					}
					}
					break;
				case LPCParser.LBRACK:
					{
					this.state = 505;
					this.match(LPCParser.LBRACK);
					this.state = 506;
					this.sliceExpr();
					this.state = 507;
					this.match(LPCParser.RBRACK);
					}
					break;
				case LPCParser.INC:
					{
					this.state = 509;
					this.match(LPCParser.INC);
					}
					break;
				case LPCParser.DEC:
					{
					this.state = 510;
					this.match(LPCParser.DEC);
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 515;
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
		this.enterRule(_localctx, 66, LPCParser.RULE_argumentList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 516;
			this.assignmentExpression();
			this.state = 518;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === LPCParser.ELLIPSIS) {
				{
				this.state = 517;
				this.match(LPCParser.ELLIPSIS);
				}
			}

			this.state = 527;
			this._errHandler.sync(this);
			_alt = this.interpreter.adaptivePredict(this._input, 53, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 520;
					this.match(LPCParser.COMMA);
					this.state = 521;
					this.assignmentExpression();
					this.state = 523;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la === LPCParser.ELLIPSIS) {
						{
						this.state = 522;
						this.match(LPCParser.ELLIPSIS);
						}
					}

					}
					}
				}
				this.state = 529;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 53, this._ctx);
			}
			this.state = 531;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === LPCParser.COMMA) {
				{
				this.state = 530;
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
		this.enterRule(_localctx, 68, LPCParser.RULE_primary);
		let _la: number;
		try {
			this.state = 574;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 57, this._ctx) ) {
			case 1:
				_localctx = new ScopeIdentifierContext(_localctx);
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 533;
				this.match(LPCParser.SCOPE);
				this.state = 534;
				this.match(LPCParser.Identifier);
				}
				break;

			case 2:
				_localctx = new EfunScopeIdentifierContext(_localctx);
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 535;
				this.match(LPCParser.KW_EFUN);
				this.state = 536;
				this.match(LPCParser.SCOPE);
				this.state = 537;
				this.match(LPCParser.Identifier);
				}
				break;

			case 3:
				_localctx = new StringConcatenationContext(_localctx);
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 538;
				this.stringConcat();
				}
				break;

			case 4:
				_localctx = new ClosurePrimaryContext(_localctx);
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 539;
				this.closureExpr();
				}
				break;

			case 5:
				_localctx = new MappingLiteralExprContext(_localctx);
				this.enterOuterAlt(_localctx, 5);
				{
				this.state = 540;
				this.mappingLiteral();
				}
				break;

			case 6:
				_localctx = new ArrayDelimiterExprContext(_localctx);
				this.enterOuterAlt(_localctx, 6);
				{
				this.state = 541;
				this.arrayDelimiterLiteral();
				}
				break;

			case 7:
				_localctx = new NewExpressionPrimaryContext(_localctx);
				this.enterOuterAlt(_localctx, 7);
				{
				this.state = 542;
				this.newExpression();
				}
				break;

			case 8:
				_localctx = new AnonFunctionContext(_localctx);
				this.enterOuterAlt(_localctx, 8);
				{
				this.state = 543;
				this.match(LPCParser.KW_FUNCTION);
				this.state = 544;
				this.match(LPCParser.LPAREN);
				this.state = 546;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 30)) & ~0x1F) === 0 && ((1 << (_la - 30)) & ((1 << (LPCParser.KW_INT - 30)) | (1 << (LPCParser.KW_FLOAT - 30)) | (1 << (LPCParser.KW_STRING - 30)) | (1 << (LPCParser.KW_OBJECT - 30)) | (1 << (LPCParser.KW_MIXED - 30)) | (1 << (LPCParser.KW_MAPPING - 30)) | (1 << (LPCParser.KW_FUNCTION - 30)) | (1 << (LPCParser.KW_BUFFER - 30)) | (1 << (LPCParser.KW_VOID - 30)) | (1 << (LPCParser.KW_STRUCT - 30)) | (1 << (LPCParser.KW_CLASS - 30)) | (1 << (LPCParser.STAR - 30)))) !== 0) || _la === LPCParser.Identifier) {
					{
					this.state = 545;
					this.parameterList();
					}
				}

				this.state = 548;
				this.match(LPCParser.RPAREN);
				this.state = 549;
				this.block();
				}
				break;

			case 9:
				_localctx = new DollarCallExprContext(_localctx);
				this.enterOuterAlt(_localctx, 9);
				{
				this.state = 550;
				this.match(LPCParser.DOLLAR);
				this.state = 551;
				this.match(LPCParser.LPAREN);
				this.state = 552;
				this.expression();
				this.state = 553;
				this.match(LPCParser.RPAREN);
				}
				break;

			case 10:
				_localctx = new IdentifierPrimaryContext(_localctx);
				this.enterOuterAlt(_localctx, 10);
				{
				this.state = 555;
				this.match(LPCParser.Identifier);
				}
				break;

			case 11:
				_localctx = new ParameterPlaceholderContext(_localctx);
				this.enterOuterAlt(_localctx, 11);
				{
				this.state = 556;
				this.match(LPCParser.PARAMETER_PLACEHOLDER);
				}
				break;

			case 12:
				_localctx = new IntegerPrimaryContext(_localctx);
				this.enterOuterAlt(_localctx, 12);
				{
				this.state = 557;
				this.match(LPCParser.INTEGER);
				}
				break;

			case 13:
				_localctx = new FloatPrimaryContext(_localctx);
				this.enterOuterAlt(_localctx, 13);
				{
				this.state = 558;
				this.match(LPCParser.FLOAT);
				}
				break;

			case 14:
				_localctx = new StringPrimaryContext(_localctx);
				this.enterOuterAlt(_localctx, 14);
				{
				this.state = 559;
				this.match(LPCParser.STRING_LITERAL);
				}
				break;

			case 15:
				_localctx = new CharPrimaryContext(_localctx);
				this.enterOuterAlt(_localctx, 15);
				{
				this.state = 560;
				this.match(LPCParser.CHAR_LITERAL);
				}
				break;

			case 16:
				_localctx = new ArrayLiteralContext(_localctx);
				this.enterOuterAlt(_localctx, 16);
				{
				this.state = 561;
				this.match(LPCParser.LPAREN);
				this.state = 562;
				this.match(LPCParser.LBRACE);
				this.state = 564;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & ((1 << (LPCParser.KW_FUNCTION - 36)) | (1 << (LPCParser.KW_NEW - 36)) | (1 << (LPCParser.KW_SIZEOF - 36)) | (1 << (LPCParser.KW_EFUN - 36)) | (1 << (LPCParser.ELLIPSIS - 36)) | (1 << (LPCParser.INC - 36)) | (1 << (LPCParser.DEC - 36)) | (1 << (LPCParser.PLUS - 36)) | (1 << (LPCParser.MINUS - 36)) | (1 << (LPCParser.STAR - 36)) | (1 << (LPCParser.SCOPE - 36)) | (1 << (LPCParser.LPAREN - 36)))) !== 0) || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & ((1 << (LPCParser.DOLLAR - 74)) | (1 << (LPCParser.NOT - 74)) | (1 << (LPCParser.BIT_NOT - 74)) | (1 << (LPCParser.PARAMETER_PLACEHOLDER - 74)) | (1 << (LPCParser.Identifier - 74)))) !== 0)) {
					{
					this.state = 563;
					this.expressionList();
					}
				}

				this.state = 566;
				this.match(LPCParser.RBRACE);
				this.state = 567;
				this.match(LPCParser.RPAREN);
				}
				break;

			case 17:
				_localctx = new ParenExprContext(_localctx);
				this.enterOuterAlt(_localctx, 17);
				{
				this.state = 568;
				this.match(LPCParser.LPAREN);
				this.state = 569;
				this.expression();
				this.state = 570;
				this.match(LPCParser.RPAREN);
				}
				break;

			case 18:
				_localctx = new RefVariableContext(_localctx);
				this.enterOuterAlt(_localctx, 18);
				{
				this.state = 572;
				this.match(LPCParser.REF);
				this.state = 573;
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
		this.enterRule(_localctx, 70, LPCParser.RULE_stringConcat);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 577;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 576;
				this.concatItem();
				}
				}
				this.state = 579;
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
		this.enterRule(_localctx, 72, LPCParser.RULE_concatItem);
		let _la: number;
		try {
			this.state = 589;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 60, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 581;
				this.match(LPCParser.STRING_LITERAL);
				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 582;
				this.match(LPCParser.Identifier);
				this.state = 583;
				this.match(LPCParser.LPAREN);
				this.state = 585;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & ((1 << (LPCParser.KW_FUNCTION - 36)) | (1 << (LPCParser.KW_NEW - 36)) | (1 << (LPCParser.KW_SIZEOF - 36)) | (1 << (LPCParser.KW_EFUN - 36)) | (1 << (LPCParser.INC - 36)) | (1 << (LPCParser.DEC - 36)) | (1 << (LPCParser.PLUS - 36)) | (1 << (LPCParser.MINUS - 36)) | (1 << (LPCParser.STAR - 36)) | (1 << (LPCParser.SCOPE - 36)) | (1 << (LPCParser.LPAREN - 36)))) !== 0) || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & ((1 << (LPCParser.DOLLAR - 74)) | (1 << (LPCParser.NOT - 74)) | (1 << (LPCParser.BIT_NOT - 74)) | (1 << (LPCParser.PARAMETER_PLACEHOLDER - 74)) | (1 << (LPCParser.Identifier - 74)))) !== 0)) {
					{
					this.state = 584;
					this.argumentList();
					}
				}

				this.state = 587;
				this.match(LPCParser.RPAREN);
				}
				break;

			case 3:
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 588;
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
		this.enterRule(_localctx, 74, LPCParser.RULE_ifStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 591;
			this.match(LPCParser.IF);
			this.state = 592;
			this.match(LPCParser.LPAREN);
			this.state = 593;
			this.expression();
			this.state = 594;
			this.match(LPCParser.RPAREN);
			this.state = 595;
			this.statement();
			this.state = 598;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 61, this._ctx) ) {
			case 1:
				{
				this.state = 596;
				this.match(LPCParser.ELSE);
				this.state = 597;
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
		this.enterRule(_localctx, 76, LPCParser.RULE_whileStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 600;
			this.match(LPCParser.WHILE);
			this.state = 601;
			this.match(LPCParser.LPAREN);
			this.state = 602;
			this.expression();
			this.state = 603;
			this.match(LPCParser.RPAREN);
			this.state = 604;
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
		this.enterRule(_localctx, 78, LPCParser.RULE_doWhileStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 606;
			this.match(LPCParser.DO);
			this.state = 607;
			this.statement();
			this.state = 608;
			this.match(LPCParser.WHILE);
			this.state = 609;
			this.match(LPCParser.LPAREN);
			this.state = 610;
			this.expression();
			this.state = 611;
			this.match(LPCParser.RPAREN);
			this.state = 612;
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
		this.enterRule(_localctx, 80, LPCParser.RULE_forStatement);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 614;
			this.match(LPCParser.FOR);
			this.state = 615;
			this.match(LPCParser.LPAREN);
			this.state = 617;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF) | (1 << LPCParser.KW_INT) | (1 << LPCParser.KW_FLOAT))) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & ((1 << (LPCParser.KW_STRING - 32)) | (1 << (LPCParser.KW_OBJECT - 32)) | (1 << (LPCParser.KW_MIXED - 32)) | (1 << (LPCParser.KW_MAPPING - 32)) | (1 << (LPCParser.KW_FUNCTION - 32)) | (1 << (LPCParser.KW_BUFFER - 32)) | (1 << (LPCParser.KW_VOID - 32)) | (1 << (LPCParser.KW_STRUCT - 32)) | (1 << (LPCParser.KW_CLASS - 32)) | (1 << (LPCParser.KW_NEW - 32)) | (1 << (LPCParser.KW_SIZEOF - 32)) | (1 << (LPCParser.KW_EFUN - 32)) | (1 << (LPCParser.ELLIPSIS - 32)) | (1 << (LPCParser.INC - 32)) | (1 << (LPCParser.DEC - 32)) | (1 << (LPCParser.PLUS - 32)) | (1 << (LPCParser.MINUS - 32)) | (1 << (LPCParser.STAR - 32)) | (1 << (LPCParser.SCOPE - 32)))) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & ((1 << (LPCParser.LPAREN - 66)) | (1 << (LPCParser.DOLLAR - 66)) | (1 << (LPCParser.NOT - 66)) | (1 << (LPCParser.BIT_NOT - 66)) | (1 << (LPCParser.MODIFIER - 66)) | (1 << (LPCParser.PARAMETER_PLACEHOLDER - 66)) | (1 << (LPCParser.Identifier - 66)))) !== 0)) {
				{
				this.state = 616;
				this.forInit();
				}
			}

			this.state = 619;
			this.match(LPCParser.SEMI);
			this.state = 621;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & ((1 << (LPCParser.KW_FUNCTION - 36)) | (1 << (LPCParser.KW_NEW - 36)) | (1 << (LPCParser.KW_SIZEOF - 36)) | (1 << (LPCParser.KW_EFUN - 36)) | (1 << (LPCParser.INC - 36)) | (1 << (LPCParser.DEC - 36)) | (1 << (LPCParser.PLUS - 36)) | (1 << (LPCParser.MINUS - 36)) | (1 << (LPCParser.STAR - 36)) | (1 << (LPCParser.SCOPE - 36)) | (1 << (LPCParser.LPAREN - 36)))) !== 0) || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & ((1 << (LPCParser.DOLLAR - 74)) | (1 << (LPCParser.NOT - 74)) | (1 << (LPCParser.BIT_NOT - 74)) | (1 << (LPCParser.PARAMETER_PLACEHOLDER - 74)) | (1 << (LPCParser.Identifier - 74)))) !== 0)) {
				{
				this.state = 620;
				this.expression();
				}
			}

			this.state = 623;
			this.match(LPCParser.SEMI);
			this.state = 625;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & ((1 << (LPCParser.KW_FUNCTION - 36)) | (1 << (LPCParser.KW_NEW - 36)) | (1 << (LPCParser.KW_SIZEOF - 36)) | (1 << (LPCParser.KW_EFUN - 36)) | (1 << (LPCParser.ELLIPSIS - 36)) | (1 << (LPCParser.INC - 36)) | (1 << (LPCParser.DEC - 36)) | (1 << (LPCParser.PLUS - 36)) | (1 << (LPCParser.MINUS - 36)) | (1 << (LPCParser.STAR - 36)) | (1 << (LPCParser.SCOPE - 36)) | (1 << (LPCParser.LPAREN - 36)))) !== 0) || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & ((1 << (LPCParser.DOLLAR - 74)) | (1 << (LPCParser.NOT - 74)) | (1 << (LPCParser.BIT_NOT - 74)) | (1 << (LPCParser.PARAMETER_PLACEHOLDER - 74)) | (1 << (LPCParser.Identifier - 74)))) !== 0)) {
				{
				this.state = 624;
				this.expressionList();
				}
			}

			this.state = 627;
			this.match(LPCParser.RPAREN);
			this.state = 628;
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
		this.enterRule(_localctx, 82, LPCParser.RULE_forInit);
		try {
			this.state = 632;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 65, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 630;
				this.variableDecl();
				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 631;
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
		this.enterRule(_localctx, 84, LPCParser.RULE_expressionList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 634;
			this.spreadElement();
			this.state = 639;
			this._errHandler.sync(this);
			_alt = this.interpreter.adaptivePredict(this._input, 66, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 635;
					this.match(LPCParser.COMMA);
					this.state = 636;
					this.spreadElement();
					}
					}
				}
				this.state = 641;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 66, this._ctx);
			}
			this.state = 643;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === LPCParser.COMMA) {
				{
				this.state = 642;
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
		this.enterRule(_localctx, 86, LPCParser.RULE_spreadElement);
		try {
			this.state = 648;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case LPCParser.ELLIPSIS:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 645;
				this.match(LPCParser.ELLIPSIS);
				this.state = 646;
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
			case LPCParser.KW_SIZEOF:
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
				this.state = 647;
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
		this.enterRule(_localctx, 88, LPCParser.RULE_foreachStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 650;
			this.match(LPCParser.FOREACH);
			this.state = 651;
			this.match(LPCParser.LPAREN);
			this.state = 652;
			this.foreachInit();
			this.state = 653;
			this.match(LPCParser.IN);
			this.state = 654;
			this.expression();
			this.state = 655;
			this.match(LPCParser.RPAREN);
			this.state = 656;
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
		this.enterRule(_localctx, 90, LPCParser.RULE_foreachInit);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 658;
			this.foreachVar();
			this.state = 661;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === LPCParser.COMMA) {
				{
				this.state = 659;
				this.match(LPCParser.COMMA);
				this.state = 660;
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
		this.enterRule(_localctx, 92, LPCParser.RULE_foreachVar);
		let _la: number;
		try {
			this.state = 700;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 75, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 663;
				this.typeSpec();
				this.state = 665;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.REF) {
					{
					this.state = 664;
					this.match(LPCParser.REF);
					}
				}

				this.state = 670;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === LPCParser.STAR) {
					{
					{
					this.state = 667;
					this.match(LPCParser.STAR);
					}
					}
					this.state = 672;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 673;
				this.match(LPCParser.Identifier);
				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 675;
				this.match(LPCParser.REF);
				this.state = 676;
				this.typeSpec();
				this.state = 680;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === LPCParser.STAR) {
					{
					{
					this.state = 677;
					this.match(LPCParser.STAR);
					}
					}
					this.state = 682;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 683;
				this.match(LPCParser.Identifier);
				}
				break;

			case 3:
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 685;
				this.match(LPCParser.REF);
				this.state = 689;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === LPCParser.STAR) {
					{
					{
					this.state = 686;
					this.match(LPCParser.STAR);
					}
					}
					this.state = 691;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 692;
				this.match(LPCParser.Identifier);
				}
				break;

			case 4:
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 696;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === LPCParser.STAR) {
					{
					{
					this.state = 693;
					this.match(LPCParser.STAR);
					}
					}
					this.state = 698;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 699;
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
		this.enterRule(_localctx, 94, LPCParser.RULE_switchStatement);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 702;
			this.match(LPCParser.SWITCH);
			this.state = 703;
			this.match(LPCParser.LPAREN);
			this.state = 704;
			this.expression();
			this.state = 705;
			this.match(LPCParser.RPAREN);
			this.state = 706;
			this.match(LPCParser.LBRACE);
			this.state = 710;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.CASE || _la === LPCParser.DEFAULT) {
				{
				{
				this.state = 707;
				this.switchSection();
				}
				}
				this.state = 712;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 713;
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
		this.enterRule(_localctx, 96, LPCParser.RULE_switchSection);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 715;
			this.switchLabelWithColon();
			this.state = 719;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.IF) | (1 << LPCParser.FOR) | (1 << LPCParser.WHILE) | (1 << LPCParser.DO) | (1 << LPCParser.SWITCH) | (1 << LPCParser.BREAK) | (1 << LPCParser.CONTINUE) | (1 << LPCParser.RETURN) | (1 << LPCParser.FOREACH) | (1 << LPCParser.INHERIT) | (1 << LPCParser.INCLUDE) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF) | (1 << LPCParser.KW_INT) | (1 << LPCParser.KW_FLOAT))) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & ((1 << (LPCParser.KW_STRING - 32)) | (1 << (LPCParser.KW_OBJECT - 32)) | (1 << (LPCParser.KW_MIXED - 32)) | (1 << (LPCParser.KW_MAPPING - 32)) | (1 << (LPCParser.KW_FUNCTION - 32)) | (1 << (LPCParser.KW_BUFFER - 32)) | (1 << (LPCParser.KW_VOID - 32)) | (1 << (LPCParser.KW_STRUCT - 32)) | (1 << (LPCParser.KW_CLASS - 32)) | (1 << (LPCParser.KW_NEW - 32)) | (1 << (LPCParser.KW_SIZEOF - 32)) | (1 << (LPCParser.KW_EFUN - 32)) | (1 << (LPCParser.INC - 32)) | (1 << (LPCParser.DEC - 32)) | (1 << (LPCParser.PLUS - 32)) | (1 << (LPCParser.MINUS - 32)) | (1 << (LPCParser.STAR - 32)) | (1 << (LPCParser.SCOPE - 32)))) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & ((1 << (LPCParser.SEMI - 64)) | (1 << (LPCParser.LPAREN - 64)) | (1 << (LPCParser.LBRACE - 64)) | (1 << (LPCParser.DOLLAR - 64)) | (1 << (LPCParser.NOT - 64)) | (1 << (LPCParser.BIT_NOT - 64)) | (1 << (LPCParser.MODIFIER - 64)) | (1 << (LPCParser.PARAMETER_PLACEHOLDER - 64)) | (1 << (LPCParser.Identifier - 64)))) !== 0)) {
				{
				{
				this.state = 716;
				this.statement();
				}
				}
				this.state = 721;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 731;
			this._errHandler.sync(this);
			_alt = this.interpreter.adaptivePredict(this._input, 79, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 722;
					this.switchLabelWithColon();
					this.state = 726;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.IF) | (1 << LPCParser.FOR) | (1 << LPCParser.WHILE) | (1 << LPCParser.DO) | (1 << LPCParser.SWITCH) | (1 << LPCParser.BREAK) | (1 << LPCParser.CONTINUE) | (1 << LPCParser.RETURN) | (1 << LPCParser.FOREACH) | (1 << LPCParser.INHERIT) | (1 << LPCParser.INCLUDE) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF) | (1 << LPCParser.KW_INT) | (1 << LPCParser.KW_FLOAT))) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & ((1 << (LPCParser.KW_STRING - 32)) | (1 << (LPCParser.KW_OBJECT - 32)) | (1 << (LPCParser.KW_MIXED - 32)) | (1 << (LPCParser.KW_MAPPING - 32)) | (1 << (LPCParser.KW_FUNCTION - 32)) | (1 << (LPCParser.KW_BUFFER - 32)) | (1 << (LPCParser.KW_VOID - 32)) | (1 << (LPCParser.KW_STRUCT - 32)) | (1 << (LPCParser.KW_CLASS - 32)) | (1 << (LPCParser.KW_NEW - 32)) | (1 << (LPCParser.KW_SIZEOF - 32)) | (1 << (LPCParser.KW_EFUN - 32)) | (1 << (LPCParser.INC - 32)) | (1 << (LPCParser.DEC - 32)) | (1 << (LPCParser.PLUS - 32)) | (1 << (LPCParser.MINUS - 32)) | (1 << (LPCParser.STAR - 32)) | (1 << (LPCParser.SCOPE - 32)))) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & ((1 << (LPCParser.SEMI - 64)) | (1 << (LPCParser.LPAREN - 64)) | (1 << (LPCParser.LBRACE - 64)) | (1 << (LPCParser.DOLLAR - 64)) | (1 << (LPCParser.NOT - 64)) | (1 << (LPCParser.BIT_NOT - 64)) | (1 << (LPCParser.MODIFIER - 64)) | (1 << (LPCParser.PARAMETER_PLACEHOLDER - 64)) | (1 << (LPCParser.Identifier - 64)))) !== 0)) {
						{
						{
						this.state = 723;
						this.statement();
						}
						}
						this.state = 728;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					}
					}
				}
				this.state = 733;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 79, this._ctx);
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
		this.enterRule(_localctx, 98, LPCParser.RULE_switchLabelWithColon);
		try {
			this.state = 740;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case LPCParser.CASE:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 734;
				this.match(LPCParser.CASE);
				this.state = 735;
				this.switchLabel();
				this.state = 736;
				this.match(LPCParser.COLON);
				}
				break;
			case LPCParser.DEFAULT:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 738;
				this.match(LPCParser.DEFAULT);
				this.state = 739;
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
		this.enterRule(_localctx, 100, LPCParser.RULE_switchLabel);
		let _la: number;
		try {
			this.state = 751;
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
			case LPCParser.KW_SIZEOF:
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
				this.state = 742;
				this.expression();
				this.state = 747;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.RANGE_OP) {
					{
					this.state = 743;
					this.match(LPCParser.RANGE_OP);
					this.state = 745;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & ((1 << (LPCParser.KW_FUNCTION - 36)) | (1 << (LPCParser.KW_NEW - 36)) | (1 << (LPCParser.KW_SIZEOF - 36)) | (1 << (LPCParser.KW_EFUN - 36)) | (1 << (LPCParser.INC - 36)) | (1 << (LPCParser.DEC - 36)) | (1 << (LPCParser.PLUS - 36)) | (1 << (LPCParser.MINUS - 36)) | (1 << (LPCParser.STAR - 36)) | (1 << (LPCParser.SCOPE - 36)) | (1 << (LPCParser.LPAREN - 36)))) !== 0) || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & ((1 << (LPCParser.DOLLAR - 74)) | (1 << (LPCParser.NOT - 74)) | (1 << (LPCParser.BIT_NOT - 74)) | (1 << (LPCParser.PARAMETER_PLACEHOLDER - 74)) | (1 << (LPCParser.Identifier - 74)))) !== 0)) {
						{
						this.state = 744;
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
				this.state = 749;
				this.match(LPCParser.RANGE_OP);
				this.state = 750;
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
		this.enterRule(_localctx, 102, LPCParser.RULE_breakStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 753;
			this.match(LPCParser.BREAK);
			this.state = 754;
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
		this.enterRule(_localctx, 104, LPCParser.RULE_continueStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 756;
			this.match(LPCParser.CONTINUE);
			this.state = 757;
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
		this.enterRule(_localctx, 106, LPCParser.RULE_returnStatement);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 759;
			this.match(LPCParser.RETURN);
			this.state = 761;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & ((1 << (LPCParser.KW_FUNCTION - 36)) | (1 << (LPCParser.KW_NEW - 36)) | (1 << (LPCParser.KW_SIZEOF - 36)) | (1 << (LPCParser.KW_EFUN - 36)) | (1 << (LPCParser.INC - 36)) | (1 << (LPCParser.DEC - 36)) | (1 << (LPCParser.PLUS - 36)) | (1 << (LPCParser.MINUS - 36)) | (1 << (LPCParser.STAR - 36)) | (1 << (LPCParser.SCOPE - 36)) | (1 << (LPCParser.LPAREN - 36)))) !== 0) || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & ((1 << (LPCParser.DOLLAR - 74)) | (1 << (LPCParser.NOT - 74)) | (1 << (LPCParser.BIT_NOT - 74)) | (1 << (LPCParser.PARAMETER_PLACEHOLDER - 74)) | (1 << (LPCParser.Identifier - 74)))) !== 0)) {
				{
				this.state = 760;
				this.expression();
				}
			}

			this.state = 763;
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
		this.enterRule(_localctx, 108, LPCParser.RULE_closureExpr);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 765;
			this.match(LPCParser.LPAREN);
			this.state = 766;
			this.match(LPCParser.COLON);
			this.state = 768;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & ((1 << (LPCParser.KW_FUNCTION - 36)) | (1 << (LPCParser.KW_NEW - 36)) | (1 << (LPCParser.KW_SIZEOF - 36)) | (1 << (LPCParser.KW_EFUN - 36)) | (1 << (LPCParser.INC - 36)) | (1 << (LPCParser.DEC - 36)) | (1 << (LPCParser.PLUS - 36)) | (1 << (LPCParser.MINUS - 36)) | (1 << (LPCParser.STAR - 36)) | (1 << (LPCParser.SCOPE - 36)) | (1 << (LPCParser.LPAREN - 36)))) !== 0) || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & ((1 << (LPCParser.DOLLAR - 74)) | (1 << (LPCParser.NOT - 74)) | (1 << (LPCParser.BIT_NOT - 74)) | (1 << (LPCParser.PARAMETER_PLACEHOLDER - 74)) | (1 << (LPCParser.Identifier - 74)))) !== 0)) {
				{
				this.state = 767;
				this.closureArgumentList();
				}
			}

			this.state = 770;
			this.match(LPCParser.COLON);
			this.state = 771;
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
		this.enterRule(_localctx, 110, LPCParser.RULE_closureArgumentList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 773;
			this.closureArgument();
			this.state = 778;
			this._errHandler.sync(this);
			_alt = this.interpreter.adaptivePredict(this._input, 86, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 774;
					this.match(LPCParser.COMMA);
					this.state = 775;
					this.closureArgument();
					}
					}
				}
				this.state = 780;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 86, this._ctx);
			}
			this.state = 782;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === LPCParser.COMMA) {
				{
				this.state = 781;
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
		this.enterRule(_localctx, 112, LPCParser.RULE_closureArgument);
		let _la: number;
		try {
			this.state = 795;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 89, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 784;
				this.match(LPCParser.DOLLAR);
				this.state = 785;
				this.match(LPCParser.Identifier);
				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 786;
				this.match(LPCParser.DOLLAR);
				this.state = 787;
				this.match(LPCParser.LPAREN);
				this.state = 788;
				this.expression();
				this.state = 789;
				this.match(LPCParser.RPAREN);
				}
				break;

			case 3:
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 791;
				this.assignmentExpression();
				this.state = 793;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.ELLIPSIS) {
					{
					this.state = 792;
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
		this.enterRule(_localctx, 114, LPCParser.RULE_inheritStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 797;
			this.match(LPCParser.INHERIT);
			this.state = 798;
			this.expression();
			this.state = 799;
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
		this.enterRule(_localctx, 116, LPCParser.RULE_includeStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 801;
			this.match(LPCParser.INCLUDE);
			this.state = 802;
			this.expression();
			this.state = 803;
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
		this.enterRule(_localctx, 118, LPCParser.RULE_macroInvoke);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 805;
			this.match(LPCParser.Identifier);
			this.state = 806;
			this.match(LPCParser.LPAREN);
			this.state = 808;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & ((1 << (LPCParser.KW_FUNCTION - 36)) | (1 << (LPCParser.KW_NEW - 36)) | (1 << (LPCParser.KW_SIZEOF - 36)) | (1 << (LPCParser.KW_EFUN - 36)) | (1 << (LPCParser.INC - 36)) | (1 << (LPCParser.DEC - 36)) | (1 << (LPCParser.PLUS - 36)) | (1 << (LPCParser.MINUS - 36)) | (1 << (LPCParser.STAR - 36)) | (1 << (LPCParser.SCOPE - 36)) | (1 << (LPCParser.LPAREN - 36)))) !== 0) || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & ((1 << (LPCParser.DOLLAR - 74)) | (1 << (LPCParser.NOT - 74)) | (1 << (LPCParser.BIT_NOT - 74)) | (1 << (LPCParser.PARAMETER_PLACEHOLDER - 74)) | (1 << (LPCParser.Identifier - 74)))) !== 0)) {
				{
				this.state = 807;
				this.argumentList();
				}
			}

			this.state = 810;
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
		this.enterRule(_localctx, 120, LPCParser.RULE_prototypeStatement);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 815;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.MODIFIER) {
				{
				{
				this.state = 812;
				this.match(LPCParser.MODIFIER);
				}
				}
				this.state = 817;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 819;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 92, this._ctx) ) {
			case 1:
				{
				this.state = 818;
				this.typeSpec();
				}
				break;
			}
			this.state = 824;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.STAR) {
				{
				{
				this.state = 821;
				this.match(LPCParser.STAR);
				}
				}
				this.state = 826;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 827;
			this.match(LPCParser.Identifier);
			this.state = 828;
			this.match(LPCParser.LPAREN);
			this.state = 830;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 30)) & ~0x1F) === 0 && ((1 << (_la - 30)) & ((1 << (LPCParser.KW_INT - 30)) | (1 << (LPCParser.KW_FLOAT - 30)) | (1 << (LPCParser.KW_STRING - 30)) | (1 << (LPCParser.KW_OBJECT - 30)) | (1 << (LPCParser.KW_MIXED - 30)) | (1 << (LPCParser.KW_MAPPING - 30)) | (1 << (LPCParser.KW_FUNCTION - 30)) | (1 << (LPCParser.KW_BUFFER - 30)) | (1 << (LPCParser.KW_VOID - 30)) | (1 << (LPCParser.KW_STRUCT - 30)) | (1 << (LPCParser.KW_CLASS - 30)) | (1 << (LPCParser.STAR - 30)))) !== 0) || _la === LPCParser.Identifier) {
				{
				this.state = 829;
				this.parameterList();
				}
			}

			this.state = 832;
			this.match(LPCParser.RPAREN);
			this.state = 833;
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
		this.enterRule(_localctx, 122, LPCParser.RULE_mappingLiteral);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 835;
			this.match(LPCParser.LPAREN);
			this.state = 836;
			this.match(LPCParser.LBRACK);
			this.state = 838;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & ((1 << (LPCParser.KW_FUNCTION - 36)) | (1 << (LPCParser.KW_NEW - 36)) | (1 << (LPCParser.KW_SIZEOF - 36)) | (1 << (LPCParser.KW_EFUN - 36)) | (1 << (LPCParser.INC - 36)) | (1 << (LPCParser.DEC - 36)) | (1 << (LPCParser.PLUS - 36)) | (1 << (LPCParser.MINUS - 36)) | (1 << (LPCParser.STAR - 36)) | (1 << (LPCParser.SCOPE - 36)) | (1 << (LPCParser.LPAREN - 36)))) !== 0) || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & ((1 << (LPCParser.DOLLAR - 74)) | (1 << (LPCParser.NOT - 74)) | (1 << (LPCParser.BIT_NOT - 74)) | (1 << (LPCParser.PARAMETER_PLACEHOLDER - 74)) | (1 << (LPCParser.Identifier - 74)))) !== 0)) {
				{
				this.state = 837;
				this.mappingPairList();
				}
			}

			this.state = 840;
			this.match(LPCParser.RBRACK);
			this.state = 841;
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
		this.enterRule(_localctx, 124, LPCParser.RULE_mappingPairList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 843;
			this.mappingPair();
			this.state = 848;
			this._errHandler.sync(this);
			_alt = this.interpreter.adaptivePredict(this._input, 96, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 844;
					this.match(LPCParser.COMMA);
					this.state = 845;
					this.mappingPair();
					}
					}
				}
				this.state = 850;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 96, this._ctx);
			}
			this.state = 852;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === LPCParser.COMMA) {
				{
				this.state = 851;
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
		this.enterRule(_localctx, 126, LPCParser.RULE_mappingPair);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 854;
			this.expression();
			this.state = 855;
			this.match(LPCParser.COLON);
			this.state = 856;
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
		this.enterRule(_localctx, 128, LPCParser.RULE_newExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 858;
			this.match(LPCParser.KW_NEW);
			this.state = 859;
			this.match(LPCParser.LPAREN);
			this.state = 862;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 98, this._ctx) ) {
			case 1:
				{
				this.state = 860;
				this.typeSpec();
				}
				break;

			case 2:
				{
				this.state = 861;
				this.expression();
				}
				break;
			}
			this.state = 866;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === LPCParser.COMMA) {
				{
				this.state = 864;
				this.match(LPCParser.COMMA);
				this.state = 865;
				this.structInitializerList();
				}
			}

			this.state = 868;
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
		this.enterRule(_localctx, 130, LPCParser.RULE_structInitializerList);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 870;
			this.structInitializer();
			this.state = 875;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.COMMA) {
				{
				{
				this.state = 871;
				this.match(LPCParser.COMMA);
				this.state = 872;
				this.structInitializer();
				}
				}
				this.state = 877;
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
		this.enterRule(_localctx, 132, LPCParser.RULE_structInitializer);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 878;
			this.match(LPCParser.Identifier);
			this.state = 879;
			this.match(LPCParser.COLON);
			this.state = 880;
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
		this.enterRule(_localctx, 134, LPCParser.RULE_sliceExpr);
		let _la: number;
		try {
			this.state = 909;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 107, this._ctx) ) {
			case 1:
				_localctx = new TailIndexOnlyContext(_localctx);
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 882;
				this.match(LPCParser.LT);
				this.state = 883;
				this.expression();
				}
				break;

			case 2:
				_localctx = new HeadRangeContext(_localctx);
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 884;
				this.expression();
				this.state = 885;
				this.match(LPCParser.RANGE_OP);
				this.state = 887;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.LT) {
					{
					this.state = 886;
					this.match(LPCParser.LT);
					}
				}

				this.state = 890;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & ((1 << (LPCParser.KW_FUNCTION - 36)) | (1 << (LPCParser.KW_NEW - 36)) | (1 << (LPCParser.KW_SIZEOF - 36)) | (1 << (LPCParser.KW_EFUN - 36)) | (1 << (LPCParser.INC - 36)) | (1 << (LPCParser.DEC - 36)) | (1 << (LPCParser.PLUS - 36)) | (1 << (LPCParser.MINUS - 36)) | (1 << (LPCParser.STAR - 36)) | (1 << (LPCParser.SCOPE - 36)) | (1 << (LPCParser.LPAREN - 36)))) !== 0) || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & ((1 << (LPCParser.DOLLAR - 74)) | (1 << (LPCParser.NOT - 74)) | (1 << (LPCParser.BIT_NOT - 74)) | (1 << (LPCParser.PARAMETER_PLACEHOLDER - 74)) | (1 << (LPCParser.Identifier - 74)))) !== 0)) {
					{
					this.state = 889;
					this.expression();
					}
				}

				}
				break;

			case 3:
				_localctx = new OpenRangeContext(_localctx);
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 892;
				this.match(LPCParser.RANGE_OP);
				this.state = 894;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.LT) {
					{
					this.state = 893;
					this.match(LPCParser.LT);
					}
				}

				this.state = 897;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & ((1 << (LPCParser.KW_FUNCTION - 36)) | (1 << (LPCParser.KW_NEW - 36)) | (1 << (LPCParser.KW_SIZEOF - 36)) | (1 << (LPCParser.KW_EFUN - 36)) | (1 << (LPCParser.INC - 36)) | (1 << (LPCParser.DEC - 36)) | (1 << (LPCParser.PLUS - 36)) | (1 << (LPCParser.MINUS - 36)) | (1 << (LPCParser.STAR - 36)) | (1 << (LPCParser.SCOPE - 36)) | (1 << (LPCParser.LPAREN - 36)))) !== 0) || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & ((1 << (LPCParser.DOLLAR - 74)) | (1 << (LPCParser.NOT - 74)) | (1 << (LPCParser.BIT_NOT - 74)) | (1 << (LPCParser.PARAMETER_PLACEHOLDER - 74)) | (1 << (LPCParser.Identifier - 74)))) !== 0)) {
					{
					this.state = 896;
					this.expression();
					}
				}

				}
				break;

			case 4:
				_localctx = new SingleIndexContext(_localctx);
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 899;
				this.expression();
				}
				break;

			case 5:
				_localctx = new TailHeadRangeContext(_localctx);
				this.enterOuterAlt(_localctx, 5);
				{
				this.state = 900;
				this.match(LPCParser.LT);
				this.state = 901;
				this.expression();
				this.state = 902;
				this.match(LPCParser.RANGE_OP);
				this.state = 904;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.LT) {
					{
					this.state = 903;
					this.match(LPCParser.LT);
					}
				}

				this.state = 907;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & ((1 << (LPCParser.KW_FUNCTION - 36)) | (1 << (LPCParser.KW_NEW - 36)) | (1 << (LPCParser.KW_SIZEOF - 36)) | (1 << (LPCParser.KW_EFUN - 36)) | (1 << (LPCParser.INC - 36)) | (1 << (LPCParser.DEC - 36)) | (1 << (LPCParser.PLUS - 36)) | (1 << (LPCParser.MINUS - 36)) | (1 << (LPCParser.STAR - 36)) | (1 << (LPCParser.SCOPE - 36)) | (1 << (LPCParser.LPAREN - 36)))) !== 0) || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & ((1 << (LPCParser.DOLLAR - 74)) | (1 << (LPCParser.NOT - 74)) | (1 << (LPCParser.BIT_NOT - 74)) | (1 << (LPCParser.PARAMETER_PLACEHOLDER - 74)) | (1 << (LPCParser.Identifier - 74)))) !== 0)) {
					{
					this.state = 906;
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
		this.enterRule(_localctx, 136, LPCParser.RULE_arrayDelimiterLiteral);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 911;
			this.match(LPCParser.ARRAY_DELIMITER_START);
			this.state = 913;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL))) !== 0) || _la === LPCParser.Identifier) {
				{
				this.state = 912;
				this.arrayDelimiterContent();
				}
			}

			this.state = 915;
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
		this.enterRule(_localctx, 138, LPCParser.RULE_arrayDelimiterContent);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 918;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 917;
				this.arrayDelimiterElement();
				}
				}
				this.state = 920;
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
		this.enterRule(_localctx, 140, LPCParser.RULE_arrayDelimiterElement);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 922;
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
		"\x03\uC91D\uCABA\u058D\uAFBA\u4F53\u0607\uEA8B\uC241\x03a\u039F\x04\x02" +
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
		"F\tF\x04G\tG\x04H\tH\x03\x02\x07\x02\x92\n\x02\f\x02\x0E\x02\x95\v\x02" +
		"\x03\x02\x03\x02\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03" +
		"\x03\x03\x05\x03\xA1\n\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03" +
		"\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03" +
		"\x03\x05\x03\xB2\n\x03\x03\x04\x07\x04\xB5\n\x04\f\x04\x0E\x04\xB8\v\x04" +
		"\x03\x04\x05\x04\xBB\n\x04\x03\x04\x07\x04\xBE\n\x04\f\x04\x0E\x04\xC1" +
		"\v\x04\x03\x04\x03\x04\x03\x04\x05\x04\xC6\n\x04\x03\x04\x03\x04\x03\x04" +
		"\x03\x05\x07\x05\xCC\n\x05\f\x05\x0E\x05\xCF\v\x05\x03\x05\x03\x05\x03" +
		"\x05\x03\x05\x07\x05\xD5\n\x05\f\x05\x0E\x05\xD8\v\x05\x03\x06\x07\x06" +
		"\xDB\n\x06\f\x06\x0E\x06\xDE\v\x06\x03\x06\x03\x06\x03\x06\x05\x06\xE3" +
		"\n\x06\x03\x07\x03\x07\x03\x07\x07\x07\xE8\n\x07\f\x07\x0E\x07\xEB\v\x07" +
		"\x03\b\x03\b\x05\b\xEF\n\b\x03\b\x07\b\xF2\n\b\f\b\x0E\b\xF5\v\b\x03\b" +
		"\x03\b\x05\b\xF9\n\b\x03\b\x05\b\xFC\n\b\x03\b\x03\b\x05\b\u0100\n\b\x03" +
		"\b\x07\b\u0103\n\b\f\b\x0E\b\u0106\v\b\x03\b\x07\b\u0109\n\b\f\b\x0E\b" +
		"\u010C\v\b\x03\b\x03\b\x05\b\u0110\n\b\x03\b\x05\b\u0113\n\b\x05\b\u0115" +
		"\n\b\x03\t\x03\t\x03\t\x03\n\x03\n\x03\n\x03\n\x05\n\u011E\n\n\x03\n\x03" +
		"\n\x03\v\x03\v\x03\v\x03\v\x05\v\u0126\n\v\x03\v\x03\v\x03\f\x06\f\u012B" +
		"\n\f\r\f\x0E\f\u012C\x03\r\x03\r\x07\r\u0131\n\r\f\r\x0E\r\u0134\v\r\x03" +
		"\r\x03\r\x03\r\x03\x0E\x03\x0E\x03\x0E\x03\x0E\x03\x0E\x03\x0E\x03\x0E" +
		"\x03\x0E\x03\x0E\x03\x0E\x03\x0E\x03\x0E\x03\x0E\x03\x0E\x03\x0E\x07\x0E" +
		"\u0148\n\x0E\f\x0E\x0E\x0E\u014B\v\x0E\x05\x0E\u014D\n\x0E\x03\x0F\x03" +
		"\x0F\x07\x0F\u0151\n\x0F\f\x0F\x0E\x0F\u0154\v\x0F\x03\x0F\x03\x0F\x03" +
		"\x10\x03\x10\x03\x10\x03\x11\x03\x11\x03\x11\x07\x11\u015E\n\x11\f\x11" +
		"\x0E\x11\u0161\v\x11\x03\x12\x03\x12\x03\x12\x05\x12\u0166\n\x12\x03\x13" +
		"\x03\x13\x03\x13\x03\x13\x03\x13\x03\x13\x05\x13\u016E\n\x13\x03\x14\x03" +
		"\x14\x03\x14\x07\x14\u0173\n\x14\f\x14\x0E\x14\u0176\v\x14\x03\x15\x03" +
		"\x15\x03\x15\x07\x15\u017B\n\x15\f\x15\x0E\x15\u017E\v\x15\x03\x16\x03" +
		"\x16\x03\x16\x07\x16\u0183\n\x16\f\x16\x0E\x16\u0186\v\x16\x03\x17\x03" +
		"\x17\x03\x17\x07\x17\u018B\n\x17\f\x17\x0E\x17\u018E\v\x17\x03\x18\x03" +
		"\x18\x03\x18\x07\x18\u0193\n\x18\f\x18\x0E\x18\u0196\v\x18\x03\x19\x03" +
		"\x19\x03\x19\x07\x19\u019B\n\x19\f\x19\x0E\x19\u019E\v\x19\x03\x1A\x03" +
		"\x1A\x03\x1A\x07\x1A\u01A3\n\x1A\f\x1A\x0E\x1A\u01A6\v\x1A\x03\x1B\x03" +
		"\x1B\x03\x1B\x07\x1B\u01AB\n\x1B\f\x1B\x0E\x1B\u01AE\v\x1B\x03\x1C\x03" +
		"\x1C\x03\x1C\x07\x1C\u01B3\n\x1C\f\x1C\x0E\x1C\u01B6\v\x1C\x03\x1D\x03" +
		"\x1D\x03\x1D\x07\x1D\u01BB\n\x1D\f\x1D\x0E\x1D\u01BE\v\x1D\x03\x1E\x05" +
		"\x1E\u01C1\n\x1E\x03\x1E\x03\x1E\x03\x1E\x03\x1E\x03\x1E\x03\x1E\x03\x1E" +
		"\x03\x1E\x03\x1E\x03\x1E\x03\x1E\x03\x1E\x05\x1E\u01CF\n\x1E\x03\x1F\x03" +
		"\x1F\x03\x1F\x03\x1F\x05\x1F\u01D5\n\x1F\x03\x1F\x03\x1F\x03 \x03 \x03" +
		" \x03 \x03 \x03!\x03!\x03!\x03!\x03!\x03!\x03!\x03!\x03!\x03!\x03!\x03" +
		"!\x03!\x05!\u01EB\n!\x03\"\x03\"\x03\"\x03\"\x03\"\x05\"\u01F2\n\"\x03" +
		"\"\x05\"\u01F5\n\"\x03\"\x03\"\x05\"\u01F9\n\"\x03\"\x03\"\x03\"\x03\"" +
		"\x03\"\x03\"\x03\"\x07\"\u0202\n\"\f\"\x0E\"\u0205\v\"\x03#\x03#\x05#" +
		"\u0209\n#\x03#\x03#\x03#\x05#\u020E\n#\x07#\u0210\n#\f#\x0E#\u0213\v#" +
		"\x03#\x05#\u0216\n#\x03$\x03$\x03$\x03$\x03$\x03$\x03$\x03$\x03$\x03$" +
		"\x03$\x03$\x03$\x05$\u0225\n$\x03$\x03$\x03$\x03$\x03$\x03$\x03$\x03$" +
		"\x03$\x03$\x03$\x03$\x03$\x03$\x03$\x03$\x05$\u0237\n$\x03$\x03$\x03$" +
		"\x03$\x03$\x03$\x03$\x03$\x05$\u0241\n$\x03%\x06%\u0244\n%\r%\x0E%\u0245" +
		"\x03&\x03&\x03&\x03&\x05&\u024C\n&\x03&\x03&\x05&\u0250\n&\x03\'\x03\'" +
		"\x03\'\x03\'\x03\'\x03\'\x03\'\x05\'\u0259\n\'\x03(\x03(\x03(\x03(\x03" +
		"(\x03(\x03)\x03)\x03)\x03)\x03)\x03)\x03)\x03)\x03*\x03*\x03*\x05*\u026C" +
		"\n*\x03*\x03*\x05*\u0270\n*\x03*\x03*\x05*\u0274\n*\x03*\x03*\x03*\x03" +
		"+\x03+\x05+\u027B\n+\x03,\x03,\x03,\x07,\u0280\n,\f,\x0E,\u0283\v,\x03" +
		",\x05,\u0286\n,\x03-\x03-\x03-\x05-\u028B\n-\x03.\x03.\x03.\x03.\x03." +
		"\x03.\x03.\x03.\x03/\x03/\x03/\x05/\u0298\n/\x030\x030\x050\u029C\n0\x03" +
		"0\x070\u029F\n0\f0\x0E0\u02A2\v0\x030\x030\x030\x030\x030\x070\u02A9\n" +
		"0\f0\x0E0\u02AC\v0\x030\x030\x030\x030\x070\u02B2\n0\f0\x0E0\u02B5\v0" +
		"\x030\x030\x070\u02B9\n0\f0\x0E0\u02BC\v0\x030\x050\u02BF\n0\x031\x03" +
		"1\x031\x031\x031\x031\x071\u02C7\n1\f1\x0E1\u02CA\v1\x031\x031\x032\x03" +
		"2\x072\u02D0\n2\f2\x0E2\u02D3\v2\x032\x032\x072\u02D7\n2\f2\x0E2\u02DA" +
		"\v2\x072\u02DC\n2\f2\x0E2\u02DF\v2\x033\x033\x033\x033\x033\x033\x053" +
		"\u02E7\n3\x034\x034\x034\x054\u02EC\n4\x054\u02EE\n4\x034\x034\x054\u02F2" +
		"\n4\x035\x035\x035\x036\x036\x036\x037\x037\x057\u02FC\n7\x037\x037\x03" +
		"8\x038\x038\x058\u0303\n8\x038\x038\x038\x039\x039\x039\x079\u030B\n9" +
		"\f9\x0E9\u030E\v9\x039\x059\u0311\n9\x03:\x03:\x03:\x03:\x03:\x03:\x03" +
		":\x03:\x03:\x05:\u031C\n:\x05:\u031E\n:\x03;\x03;\x03;\x03;\x03<\x03<" +
		"\x03<\x03<\x03=\x03=\x03=\x05=\u032B\n=\x03=\x03=\x03>\x07>\u0330\n>\f" +
		">\x0E>\u0333\v>\x03>\x05>\u0336\n>\x03>\x07>\u0339\n>\f>\x0E>\u033C\v" +
		">\x03>\x03>\x03>\x05>\u0341\n>\x03>\x03>\x03>\x03?\x03?\x03?\x05?\u0349" +
		"\n?\x03?\x03?\x03?\x03@\x03@\x03@\x07@\u0351\n@\f@\x0E@\u0354\v@\x03@" +
		"\x05@\u0357\n@\x03A\x03A\x03A\x03A\x03B\x03B\x03B\x03B\x05B\u0361\nB\x03" +
		"B\x03B\x05B\u0365\nB\x03B\x03B\x03C\x03C\x03C\x07C\u036C\nC\fC\x0EC\u036F" +
		"\vC\x03D\x03D\x03D\x03D\x03E\x03E\x03E\x03E\x03E\x05E\u037A\nE\x03E\x05" +
		"E\u037D\nE\x03E\x03E\x05E\u0381\nE\x03E\x05E\u0384\nE\x03E\x03E\x03E\x03" +
		"E\x03E\x05E\u038B\nE\x03E\x05E\u038E\nE\x05E\u0390\nE\x03F\x03F\x05F\u0394" +
		"\nF\x03F\x03F\x03G\x06G\u0399\nG\rG\x0EG\u039A\x03H\x03H\x03H\x02\x02" +
		"\x02I\x02\x02\x04\x02\x06\x02\b\x02\n\x02\f\x02\x0E\x02\x10\x02\x12\x02" +
		"\x14\x02\x16\x02\x18\x02\x1A\x02\x1C\x02\x1E\x02 \x02\"\x02$\x02&\x02" +
		"(\x02*\x02,\x02.\x020\x022\x024\x026\x028\x02:\x02<\x02>\x02@\x02B\x02" +
		"D\x02F\x02H\x02J\x02L\x02N\x02P\x02R\x02T\x02V\x02X\x02Z\x02\\\x02^\x02" +
		"`\x02b\x02d\x02f\x02h\x02j\x02l\x02n\x02p\x02r\x02t\x02v\x02x\x02z\x02" +
		"|\x02~\x02\x80\x02\x82\x02\x84\x02\x86\x02\x88\x02\x8A\x02\x8C\x02\x8E" +
		"\x02\x02\f\x05\x024;SS]^\x03\x02QR\x03\x02MP\x03\x02WX\x03\x02<=\x03\x02" +
		">@\x03\x0223\x05\x02<>TT\\\\\x04\x0201AA\x04\x02\x03\x06aa\x02\u040B\x02" +
		"\x93\x03\x02\x02\x02\x04\xB1\x03\x02\x02\x02\x06\xB6\x03\x02\x02\x02\b" +
		"\xCD\x03\x02\x02\x02\n\xDC\x03\x02\x02\x02\f\xE4\x03\x02\x02\x02\x0E\u0114" +
		"\x03\x02\x02\x02\x10\u0116\x03\x02\x02\x02\x12\u0119\x03\x02\x02\x02\x14" +
		"\u0121\x03\x02\x02\x02\x16\u012A\x03\x02\x02\x02\x18\u012E\x03\x02\x02" +
		"\x02\x1A\u014C\x03\x02\x02\x02\x1C\u014E\x03\x02\x02\x02\x1E\u0157\x03" +
		"\x02\x02\x02 \u015A\x03\x02\x02\x02\"\u0162\x03\x02\x02\x02$\u0167\x03" +
		"\x02\x02\x02&\u016F\x03\x02\x02\x02(\u0177\x03\x02\x02\x02*\u017F\x03" +
		"\x02\x02\x02,\u0187\x03\x02\x02\x02.\u018F\x03\x02\x02\x020\u0197\x03" +
		"\x02\x02\x022\u019F\x03\x02\x02\x024\u01A7\x03\x02\x02\x026\u01AF\x03" +
		"\x02\x02\x028\u01B7\x03\x02\x02\x02:\u01CE\x03\x02\x02\x02<\u01D0\x03" +
		"\x02\x02\x02>\u01D8\x03\x02\x02\x02@\u01EA\x03\x02\x02\x02B\u01EC\x03" +
		"\x02\x02\x02D\u0206\x03\x02\x02\x02F\u0240\x03\x02\x02\x02H\u0243\x03" +
		"\x02\x02\x02J\u024F\x03\x02\x02\x02L\u0251\x03\x02\x02\x02N\u025A\x03" +
		"\x02\x02\x02P\u0260\x03\x02\x02\x02R\u0268\x03\x02\x02\x02T\u027A\x03" +
		"\x02\x02\x02V\u027C\x03\x02\x02\x02X\u028A\x03\x02\x02\x02Z\u028C\x03" +
		"\x02\x02\x02\\\u0294\x03\x02\x02\x02^\u02BE\x03\x02\x02\x02`\u02C0\x03" +
		"\x02\x02\x02b\u02CD\x03\x02\x02\x02d\u02E6\x03\x02\x02\x02f\u02F1\x03" +
		"\x02\x02\x02h\u02F3\x03\x02\x02\x02j\u02F6\x03\x02\x02\x02l\u02F9\x03" +
		"\x02\x02\x02n\u02FF\x03\x02\x02\x02p\u0307\x03\x02\x02\x02r\u031D\x03" +
		"\x02\x02\x02t\u031F\x03\x02\x02\x02v\u0323\x03\x02\x02\x02x\u0327\x03" +
		"\x02\x02\x02z\u0331\x03\x02\x02\x02|\u0345\x03\x02\x02\x02~\u034D\x03" +
		"\x02\x02\x02\x80\u0358\x03\x02\x02\x02\x82\u035C\x03\x02\x02\x02\x84\u0368" +
		"\x03\x02\x02\x02\x86\u0370\x03\x02\x02\x02\x88\u038F\x03\x02\x02\x02\x8A" +
		"\u0391\x03\x02\x02\x02\x8C\u0398\x03\x02\x02\x02\x8E\u039C\x03\x02\x02" +
		"\x02\x90\x92\x05\x04\x03\x02\x91\x90\x03\x02\x02\x02\x92\x95\x03\x02\x02" +
		"\x02\x93\x91\x03\x02\x02\x02\x93\x94\x03\x02\x02\x02\x94\x96\x03\x02\x02" +
		"\x02\x95\x93\x03\x02\x02\x02\x96\x97\x07\x02\x02\x03\x97\x03\x03\x02\x02" +
		"\x02\x98\xB2\x05\x06\x04\x02\x99\x9A\x05\b\x05\x02\x9A\x9B\x07B\x02\x02" +
		"\x9B\xB2\x03\x02\x02\x02\x9C\xB2\x05\x12\n\x02\x9D\xB2\x05\x14\v\x02\x9E" +
		"\xA0\x05x=\x02\x9F\xA1\x07B\x02\x02\xA0\x9F\x03\x02\x02\x02\xA0\xA1\x03" +
		"\x02\x02\x02\xA1\xB2\x03\x02\x02\x02\xA2\xB2\x05L\'\x02\xA3\xB2\x05N(" +
		"\x02\xA4\xB2\x05R*\x02\xA5\xB2\x05P)\x02\xA6\xB2\x05Z.\x02\xA7\xB2\x05" +
		"`1\x02\xA8\xB2\x05h5\x02\xA9\xB2\x05j6\x02\xAA\xB2\x05l7\x02\xAB\xB2\x05" +
		"t;\x02\xAC\xB2\x05v<\x02\xAD\xB2\x05\x1C\x0F\x02\xAE\xB2\x05\x1E\x10\x02" +
		"\xAF\xB2\x05z>\x02\xB0\xB2\x07B\x02\x02\xB1\x98\x03\x02\x02\x02\xB1\x99" +
		"\x03\x02\x02\x02\xB1\x9C\x03\x02\x02\x02\xB1\x9D\x03\x02\x02\x02\xB1\x9E" +
		"\x03\x02\x02\x02\xB1\xA2\x03\x02\x02\x02\xB1\xA3\x03\x02\x02\x02\xB1\xA4" +
		"\x03\x02\x02\x02\xB1\xA5\x03\x02\x02\x02\xB1\xA6\x03\x02\x02\x02\xB1\xA7" +
		"\x03\x02\x02\x02\xB1\xA8\x03\x02\x02\x02\xB1\xA9\x03\x02\x02\x02\xB1\xAA" +
		"\x03\x02\x02\x02\xB1\xAB\x03\x02\x02\x02\xB1\xAC\x03\x02\x02\x02\xB1\xAD" +
		"\x03\x02\x02\x02\xB1\xAE\x03\x02\x02\x02\xB1\xAF\x03\x02\x02\x02\xB1\xB0" +
		"\x03\x02\x02\x02\xB2\x05\x03\x02\x02\x02\xB3\xB5\x07_\x02\x02\xB4\xB3" +
		"\x03\x02\x02\x02\xB5\xB8\x03\x02\x02\x02\xB6\xB4\x03\x02\x02\x02\xB6\xB7" +
		"\x03\x02\x02\x02\xB7\xBA\x03\x02\x02\x02\xB8\xB6\x03\x02\x02\x02\xB9\xBB" +
		"\x05\x1A\x0E\x02\xBA\xB9\x03\x02\x02\x02\xBA\xBB\x03\x02\x02\x02\xBB\xBF" +
		"\x03\x02\x02\x02\xBC\xBE\x07>\x02\x02\xBD\xBC\x03\x02\x02\x02\xBE\xC1" +
		"\x03\x02\x02\x02\xBF\xBD\x03\x02\x02\x02\xBF\xC0\x03\x02\x02\x02\xC0\xC2" +
		"\x03\x02\x02\x02\xC1\xBF\x03\x02\x02\x02\xC2\xC3\x07a\x02\x02\xC3\xC5" +
		"\x07D\x02\x02\xC4\xC6\x05\f\x07\x02\xC5\xC4\x03\x02\x02\x02\xC5\xC6\x03" +
		"\x02\x02\x02\xC6\xC7\x03\x02\x02\x02\xC7\xC8\x07E\x02\x02\xC8\xC9\x05" +
		"\x1C\x0F\x02\xC9\x07\x03\x02\x02\x02\xCA\xCC\x07_\x02\x02\xCB\xCA\x03" +
		"\x02\x02\x02\xCC\xCF\x03\x02\x02\x02\xCD\xCB\x03\x02\x02\x02\xCD\xCE\x03" +
		"\x02\x02\x02\xCE\xD0\x03\x02\x02\x02\xCF\xCD\x03\x02\x02\x02\xD0\xD1\x05" +
		"\x1A\x0E\x02\xD1\xD6\x05\n\x06\x02\xD2\xD3\x07C\x02\x02\xD3\xD5\x05\n" +
		"\x06\x02\xD4\xD2\x03\x02\x02\x02\xD5\xD8\x03\x02\x02\x02\xD6\xD4\x03\x02" +
		"\x02\x02\xD6\xD7\x03\x02\x02\x02\xD7\t\x03\x02\x02\x02\xD8\xD6\x03\x02" +
		"\x02\x02\xD9\xDB\x07>\x02\x02\xDA\xD9\x03\x02\x02\x02\xDB\xDE\x03\x02" +
		"\x02\x02\xDC\xDA\x03\x02\x02\x02\xDC\xDD\x03\x02\x02\x02\xDD\xDF\x03\x02" +
		"\x02\x02\xDE\xDC\x03\x02\x02\x02\xDF\xE2\x07a\x02\x02\xE0\xE1\x07S\x02" +
		"\x02\xE1\xE3\x05 \x11\x02\xE2\xE0\x03\x02\x02\x02\xE2\xE3\x03\x02\x02" +
		"\x02\xE3\v\x03\x02\x02\x02\xE4\xE9\x05\x0E\b\x02\xE5\xE6\x07C\x02\x02" +
		"\xE6\xE8\x05\x0E\b\x02\xE7\xE5\x03\x02\x02\x02\xE8\xEB\x03\x02\x02\x02" +
		"\xE9\xE7\x03\x02\x02\x02\xE9\xEA\x03\x02\x02\x02\xEA\r\x03\x02\x02\x02" +
		"\xEB\xE9\x03\x02\x02\x02\xEC\xEE\x05\x1A\x0E\x02\xED\xEF\x07\x1E\x02\x02" +
		"\xEE\xED\x03\x02\x02\x02\xEE\xEF\x03\x02\x02\x02\xEF\xF3\x03\x02\x02\x02" +
		"\xF0\xF2\x07>\x02\x02\xF1\xF0\x03\x02\x02\x02\xF2\xF5\x03\x02\x02\x02" +
		"\xF3\xF1\x03\x02\x02\x02\xF3\xF4\x03\x02\x02\x02\xF4\xF6\x03\x02\x02\x02" +
		"\xF5\xF3\x03\x02\x02\x02\xF6\xF8\x07a\x02\x02\xF7\xF9\x07.\x02\x02\xF8" +
		"\xF7\x03\x02\x02\x02\xF8\xF9\x03\x02\x02\x02\xF9\xFB\x03\x02\x02\x02\xFA" +
		"\xFC\x05\x10\t\x02\xFB\xFA\x03\x02\x02\x02\xFB\xFC\x03\x02\x02\x02\xFC" +
		"\u0115\x03\x02\x02\x02\xFD\xFF\x05\x1A\x0E\x02\xFE\u0100\x07\x1E\x02\x02" +
		"\xFF\xFE\x03\x02\x02\x02\xFF\u0100\x03\x02\x02\x02\u0100\u0104\x03\x02" +
		"\x02\x02\u0101\u0103\x07>\x02\x02\u0102\u0101\x03\x02\x02\x02\u0103\u0106" +
		"\x03\x02\x02\x02\u0104\u0102\x03\x02\x02\x02\u0104\u0105\x03\x02\x02\x02" +
		"\u0105\u0115\x03\x02\x02\x02\u0106\u0104\x03\x02\x02\x02\u0107\u0109\x07" +
		">\x02\x02\u0108\u0107\x03\x02\x02\x02\u0109\u010C\x03\x02\x02\x02\u010A" +
		"\u0108\x03\x02\x02\x02\u010A\u010B\x03\x02\x02\x02\u010B\u010D\x03\x02" +
		"\x02\x02\u010C\u010A\x03\x02\x02\x02\u010D\u010F\x07a\x02\x02\u010E\u0110" +
		"\x07.\x02\x02\u010F\u010E\x03\x02\x02\x02\u010F\u0110\x03\x02\x02\x02" +
		"\u0110\u0112\x03\x02\x02\x02\u0111\u0113\x05\x10\t\x02\u0112\u0111\x03" +
		"\x02\x02\x02\u0112\u0113\x03\x02\x02\x02\u0113\u0115\x03\x02\x02\x02\u0114" +
		"\xEC\x03\x02\x02\x02\u0114\xFD\x03\x02\x02\x02\u0114\u010A\x03\x02\x02" +
		"\x02\u0115\x0F\x03\x02\x02\x02\u0116\u0117\x07K\x02\x02\u0117\u0118\x05" +
		"n8\x02\u0118\x11\x03\x02\x02\x02\u0119\u011A\x07)\x02\x02\u011A\u011B" +
		"\x07a\x02\x02\u011B\u011D\x07F\x02\x02\u011C\u011E\x05\x16\f\x02\u011D" +
		"\u011C\x03\x02\x02\x02\u011D\u011E\x03\x02\x02\x02\u011E\u011F\x03\x02" +
		"\x02\x02\u011F\u0120\x07G\x02\x02\u0120\x13\x03\x02\x02\x02\u0121\u0122" +
		"\x07*\x02\x02\u0122\u0123\x07a\x02\x02\u0123\u0125\x07F\x02\x02\u0124" +
		"\u0126\x05\x16\f\x02\u0125\u0124\x03\x02\x02\x02\u0125\u0126\x03\x02\x02" +
		"\x02\u0126\u0127\x03\x02\x02\x02\u0127\u0128\x07G\x02\x02\u0128\x15\x03" +
		"\x02\x02\x02\u0129\u012B\x05\x18\r\x02\u012A\u0129\x03\x02\x02\x02\u012B" +
		"\u012C\x03\x02\x02\x02\u012C\u012A\x03\x02\x02\x02\u012C\u012D\x03\x02" +
		"\x02\x02\u012D\x17\x03\x02\x02\x02\u012E\u0132\x05\x1A\x0E\x02\u012F\u0131" +
		"\x07>\x02\x02\u0130\u012F\x03\x02\x02\x02\u0131\u0134\x03\x02\x02\x02" +
		"\u0132\u0130\x03\x02\x02\x02\u0132\u0133\x03\x02\x02\x02\u0133\u0135\x03" +
		"\x02\x02\x02\u0134\u0132\x03\x02\x02\x02\u0135\u0136\x07a\x02\x02\u0136" +
		"\u0137\x07B\x02\x02\u0137\x19\x03\x02\x02\x02\u0138\u014D\x07 \x02\x02" +
		"\u0139\u014D\x07!\x02\x02\u013A\u014D\x07\"\x02\x02\u013B\u014D\x07#\x02" +
		"\x02\u013C\u014D\x07$\x02\x02\u013D\u014D\x07%\x02\x02\u013E\u014D\x07" +
		"&\x02\x02\u013F\u014D\x07\'\x02\x02\u0140\u014D\x07(\x02\x02\u0141\u014D" +
		"\x07)\x02\x02\u0142\u014D\x07*\x02\x02\u0143\u0144\x07*\x02\x02\u0144" +
		"\u014D\x07a\x02\x02\u0145\u0149\x07a\x02\x02\u0146\u0148\x07>\x02\x02" +
		"\u0147\u0146\x03\x02\x02\x02\u0148\u014B\x03\x02\x02\x02\u0149\u0147\x03" +
		"\x02\x02\x02\u0149\u014A\x03\x02\x02\x02\u014A\u014D\x03\x02\x02\x02\u014B" +
		"\u0149\x03\x02\x02\x02\u014C\u0138\x03\x02\x02\x02\u014C\u0139\x03\x02" +
		"\x02\x02\u014C\u013A\x03\x02\x02\x02\u014C\u013B\x03\x02\x02\x02\u014C" +
		"\u013C\x03\x02\x02\x02\u014C\u013D\x03\x02\x02\x02\u014C\u013E\x03\x02" +
		"\x02\x02\u014C\u013F\x03\x02\x02\x02\u014C\u0140\x03\x02\x02\x02\u014C" +
		"\u0141\x03\x02\x02\x02\u014C\u0142\x03\x02\x02\x02\u014C\u0143\x03\x02" +
		"\x02\x02\u014C\u0145\x03\x02\x02\x02\u014D\x1B\x03\x02\x02\x02\u014E\u0152" +
		"\x07F\x02\x02\u014F\u0151\x05\x04\x03\x02\u0150\u014F\x03\x02\x02\x02" +
		"\u0151\u0154\x03\x02\x02\x02\u0152\u0150\x03\x02\x02\x02\u0152\u0153\x03" +
		"\x02\x02\x02\u0153\u0155\x03\x02\x02\x02\u0154\u0152\x03\x02\x02\x02\u0155" +
		"\u0156\x07G\x02\x02\u0156\x1D\x03\x02\x02\x02\u0157\u0158\x05 \x11\x02" +
		"\u0158\u0159\x07B\x02\x02\u0159\x1F\x03\x02\x02\x02\u015A\u015F\x05\"" +
		"\x12\x02\u015B\u015C\x07C\x02\x02\u015C\u015E\x05\"\x12\x02\u015D\u015B" +
		"\x03\x02\x02\x02\u015E\u0161\x03\x02\x02\x02\u015F\u015D\x03\x02\x02\x02" +
		"\u015F\u0160\x03\x02\x02\x02\u0160!\x03\x02\x02\x02\u0161\u015F\x03\x02" +
		"\x02\x02\u0162\u0165\x05$\x13\x02\u0163\u0164\t\x02\x02\x02\u0164\u0166" +
		"\x05 \x11\x02\u0165\u0163\x03\x02\x02\x02\u0165\u0166\x03\x02\x02\x02" +
		"\u0166#\x03\x02\x02\x02\u0167\u016D\x05&\x14\x02\u0168\u0169\x07J\x02" +
		"\x02\u0169\u016A\x05 \x11\x02\u016A\u016B\x07K\x02\x02\u016B\u016C\x05" +
		"$\x13\x02\u016C\u016E\x03\x02\x02\x02\u016D\u0168\x03\x02\x02\x02\u016D" +
		"\u016E\x03\x02\x02\x02\u016E%\x03\x02\x02\x02\u016F\u0174\x05(\x15\x02" +
		"\u0170\u0171\x07V\x02\x02\u0171\u0173\x05(\x15\x02\u0172\u0170\x03\x02" +
		"\x02\x02\u0173\u0176\x03\x02\x02\x02\u0174\u0172\x03\x02\x02\x02\u0174" +
		"\u0175\x03\x02\x02\x02\u0175\'\x03\x02\x02\x02\u0176\u0174\x03\x02\x02" +
		"\x02\u0177\u017C\x05*\x16\x02\u0178\u0179\x07U\x02\x02\u0179\u017B\x05" +
		"*\x16\x02\u017A\u0178\x03\x02\x02\x02\u017B\u017E\x03\x02\x02\x02\u017C" +
		"\u017A\x03\x02\x02\x02\u017C\u017D\x03\x02\x02\x02\u017D)\x03\x02\x02" +
		"\x02\u017E\u017C\x03\x02\x02\x02\u017F\u0184\x05,\x17\x02\u0180\u0181" +
		"\x07Z\x02\x02\u0181\u0183\x05,\x17\x02\u0182\u0180\x03\x02\x02\x02\u0183" +
		"\u0186\x03\x02\x02\x02\u0184\u0182\x03\x02\x02\x02\u0184\u0185\x03\x02" +
		"\x02\x02\u0185+\x03\x02\x02\x02\u0186\u0184\x03\x02\x02\x02\u0187\u018C" +
		"\x05.\x18\x02\u0188\u0189\x07[\x02\x02\u0189\u018B\x05.\x18\x02\u018A" +
		"\u0188\x03\x02\x02\x02\u018B\u018E\x03\x02\x02\x02\u018C\u018A\x03\x02" +
		"\x02\x02\u018C\u018D\x03\x02\x02\x02\u018D-\x03\x02\x02\x02\u018E\u018C" +
		"\x03\x02\x02\x02\u018F\u0194\x050\x19\x02\u0190\u0191\x07Y\x02\x02\u0191" +
		"\u0193\x050\x19\x02\u0192\u0190\x03\x02\x02\x02\u0193\u0196\x03\x02\x02" +
		"\x02\u0194\u0192\x03\x02\x02\x02\u0194\u0195\x03\x02\x02\x02\u0195/\x03" +
		"\x02\x02\x02\u0196\u0194\x03\x02\x02\x02\u0197\u019C\x052\x1A\x02\u0198" +
		"\u0199\t\x03\x02\x02\u0199\u019B\x052\x1A\x02\u019A\u0198\x03\x02\x02" +
		"\x02\u019B\u019E\x03\x02\x02\x02\u019C\u019A\x03\x02\x02\x02\u019C\u019D" +
		"\x03\x02\x02\x02\u019D1\x03\x02\x02\x02\u019E\u019C\x03\x02\x02\x02\u019F" +
		"\u01A4\x054\x1B\x02\u01A0\u01A1\t\x04\x02\x02\u01A1\u01A3\x054\x1B\x02" +
		"\u01A2\u01A0\x03\x02\x02\x02\u01A3\u01A6\x03\x02\x02\x02\u01A4\u01A2\x03" +
		"\x02\x02\x02\u01A4\u01A5\x03\x02\x02\x02\u01A53\x03\x02\x02\x02\u01A6" +
		"\u01A4\x03\x02\x02\x02\u01A7\u01AC\x056\x1C\x02\u01A8\u01A9\t\x05\x02" +
		"\x02\u01A9\u01AB\x056\x1C\x02\u01AA\u01A8\x03\x02\x02\x02\u01AB\u01AE" +
		"\x03\x02\x02\x02\u01AC\u01AA\x03\x02\x02\x02\u01AC\u01AD\x03\x02\x02\x02" +
		"\u01AD5\x03\x02\x02\x02\u01AE\u01AC\x03\x02\x02\x02\u01AF\u01B4\x058\x1D" +
		"\x02\u01B0\u01B1\t\x06\x02\x02\u01B1\u01B3\x058\x1D\x02\u01B2\u01B0\x03" +
		"\x02\x02\x02\u01B3\u01B6\x03\x02\x02\x02\u01B4\u01B2\x03\x02\x02\x02\u01B4" +
		"\u01B5\x03\x02\x02\x02\u01B57\x03\x02\x02\x02\u01B6\u01B4\x03\x02\x02" +
		"\x02\u01B7\u01BC\x05:\x1E\x02\u01B8\u01B9\t\x07\x02\x02\u01B9\u01BB\x05" +
		":\x1E\x02\u01BA\u01B8\x03\x02\x02\x02\u01BB\u01BE\x03\x02\x02\x02\u01BC" +
		"\u01BA\x03\x02\x02\x02\u01BC\u01BD\x03\x02\x02\x02\u01BD9\x03\x02\x02" +
		"\x02\u01BE\u01BC\x03\x02\x02\x02\u01BF\u01C1\t\b\x02\x02\u01C0\u01BF\x03" +
		"\x02\x02\x02\u01C0\u01C1\x03\x02\x02\x02\u01C1\u01C2\x03\x02\x02\x02\u01C2" +
		"\u01CF\x05B\"\x02\u01C3\u01C4\t\t\x02\x02\u01C4\u01CF\x05:\x1E\x02\u01C5" +
		"\u01CF\x05<\x1F\x02\u01C6\u01C7\x07\x1D\x02\x02\u01C7\u01C8\x07D\x02\x02" +
		"\u01C8\u01C9\x05 \x11\x02\u01C9\u01CA\x07E\x02\x02\u01CA\u01CF\x03\x02" +
		"\x02\x02\u01CB\u01CC\x07\x1D\x02\x02\u01CC\u01CF\x05\x1C\x0F\x02\u01CD" +
		"\u01CF\x05> \x02\u01CE\u01C0\x03\x02\x02\x02\u01CE\u01C3\x03\x02\x02\x02";
	private static readonly _serializedATNSegment1: string =
		"\u01CE\u01C5\x03\x02\x02\x02\u01CE\u01C6\x03\x02\x02\x02\u01CE\u01CB\x03" +
		"\x02\x02\x02\u01CE\u01CD\x03\x02\x02\x02\u01CF;\x03\x02\x02\x02\u01D0" +
		"\u01D1\x07,\x02\x02\u01D1\u01D4\x07D\x02\x02\u01D2\u01D5\x05 \x11\x02" +
		"\u01D3\u01D5\x05\x1A\x0E\x02\u01D4\u01D2\x03\x02\x02\x02\u01D4\u01D3\x03" +
		"\x02\x02\x02\u01D5\u01D6\x03\x02\x02\x02\u01D6\u01D7\x07E\x02\x02\u01D7" +
		"=\x03\x02\x02\x02\u01D8\u01D9\x07D\x02\x02\u01D9\u01DA\x05@!\x02\u01DA" +
		"\u01DB\x07E\x02\x02\u01DB\u01DC\x05:\x1E\x02\u01DC?\x03\x02\x02\x02\u01DD" +
		"\u01EB\x07 \x02\x02\u01DE\u01EB\x07!\x02\x02\u01DF\u01EB\x07\"\x02\x02" +
		"\u01E0\u01EB\x07#\x02\x02\u01E1\u01EB\x07$\x02\x02\u01E2\u01EB\x07%\x02" +
		"\x02\u01E3\u01EB\x07&\x02\x02\u01E4\u01EB\x07\'\x02\x02\u01E5\u01EB\x07" +
		"(\x02\x02\u01E6\u01EB\x07)\x02\x02\u01E7\u01EB\x07*\x02\x02\u01E8\u01E9" +
		"\x07*\x02\x02\u01E9\u01EB\x07a\x02\x02\u01EA\u01DD\x03\x02\x02\x02\u01EA" +
		"\u01DE\x03\x02\x02\x02\u01EA\u01DF\x03\x02\x02\x02\u01EA\u01E0\x03\x02" +
		"\x02\x02\u01EA\u01E1\x03\x02\x02\x02\u01EA\u01E2\x03\x02\x02\x02\u01EA" +
		"\u01E3\x03\x02\x02\x02\u01EA\u01E4\x03\x02\x02\x02\u01EA\u01E5\x03\x02" +
		"\x02\x02\u01EA\u01E6\x03\x02\x02\x02\u01EA\u01E7\x03\x02\x02\x02\u01EA" +
		"\u01E8\x03\x02\x02\x02\u01EBA\x03\x02\x02\x02\u01EC\u0203\x05F$\x02\u01ED" +
		"\u01EE\t\n\x02\x02\u01EE\u01F4\x07a\x02\x02\u01EF\u01F1\x07D\x02\x02\u01F0" +
		"\u01F2\x05D#\x02\u01F1\u01F0\x03\x02\x02\x02\u01F1\u01F2\x03\x02\x02\x02" +
		"\u01F2\u01F3\x03\x02\x02\x02\u01F3\u01F5\x07E\x02\x02\u01F4\u01EF\x03" +
		"\x02\x02\x02\u01F4\u01F5\x03\x02\x02\x02\u01F5\u0202\x03\x02\x02\x02\u01F6" +
		"\u01F8\x07D\x02\x02\u01F7\u01F9\x05D#\x02\u01F8\u01F7\x03\x02\x02\x02" +
		"\u01F8\u01F9\x03\x02\x02\x02\u01F9\u01FA\x03\x02\x02\x02\u01FA\u0202\x07" +
		"E\x02\x02\u01FB\u01FC\x07H\x02\x02\u01FC\u01FD\x05\x88E\x02\u01FD\u01FE" +
		"\x07I\x02\x02\u01FE\u0202\x03\x02\x02\x02\u01FF\u0202\x072\x02\x02\u0200" +
		"\u0202\x073\x02\x02\u0201\u01ED\x03\x02\x02\x02\u0201\u01F6\x03\x02\x02" +
		"\x02\u0201\u01FB\x03\x02\x02\x02\u0201\u01FF\x03\x02\x02\x02\u0201\u0200" +
		"\x03\x02\x02\x02\u0202\u0205\x03\x02\x02\x02\u0203\u0201\x03\x02\x02\x02" +
		"\u0203\u0204\x03\x02\x02\x02\u0204C\x03\x02\x02\x02\u0205\u0203\x03\x02" +
		"\x02\x02\u0206\u0208\x05\"\x12\x02\u0207\u0209\x07.\x02\x02\u0208\u0207" +
		"\x03\x02\x02\x02\u0208\u0209\x03\x02\x02\x02\u0209\u0211\x03\x02\x02\x02" +
		"\u020A\u020B\x07C\x02\x02\u020B\u020D\x05\"\x12\x02\u020C\u020E\x07.\x02" +
		"\x02\u020D\u020C\x03\x02\x02\x02\u020D\u020E\x03\x02\x02\x02\u020E\u0210" +
		"\x03\x02\x02\x02\u020F\u020A\x03\x02\x02\x02\u0210\u0213\x03\x02\x02\x02" +
		"\u0211\u020F\x03\x02\x02\x02\u0211\u0212\x03\x02\x02\x02\u0212\u0215\x03" +
		"\x02\x02\x02\u0213\u0211\x03\x02\x02\x02\u0214\u0216\x07C\x02\x02\u0215" +
		"\u0214\x03\x02\x02\x02\u0215\u0216\x03\x02\x02\x02\u0216E\x03\x02\x02" +
		"\x02\u0217\u0218\x07A\x02\x02\u0218\u0241\x07a\x02\x02\u0219\u021A\x07" +
		"-\x02\x02\u021A\u021B\x07A\x02\x02\u021B\u0241\x07a\x02\x02\u021C\u0241" +
		"\x05H%\x02\u021D\u0241\x05n8\x02\u021E\u0241\x05|?\x02\u021F\u0241\x05" +
		"\x8AF\x02\u0220\u0241\x05\x82B\x02\u0221\u0222\x07&\x02\x02\u0222\u0224" +
		"\x07D\x02\x02\u0223\u0225\x05\f\x07\x02\u0224\u0223\x03\x02\x02\x02\u0224" +
		"\u0225\x03\x02\x02\x02\u0225\u0226\x03\x02\x02\x02\u0226\u0227\x07E\x02" +
		"\x02\u0227\u0241\x05\x1C\x0F\x02\u0228\u0229\x07L\x02\x02\u0229\u022A" +
		"\x07D\x02\x02\u022A\u022B\x05 \x11\x02\u022B\u022C\x07E\x02\x02\u022C" +
		"\u0241\x03\x02\x02\x02\u022D\u0241\x07a\x02\x02\u022E\u0241\x07`\x02\x02" +
		"\u022F\u0241\x07\x03\x02\x02\u0230\u0241\x07\x04\x02\x02\u0231\u0241\x07" +
		"\x06\x02\x02\u0232\u0241\x07\x05\x02\x02\u0233\u0234\x07D\x02\x02\u0234" +
		"\u0236\x07F\x02\x02\u0235\u0237\x05V,\x02\u0236\u0235\x03\x02\x02\x02" +
		"\u0236\u0237\x03\x02\x02\x02\u0237\u0238\x03\x02\x02\x02\u0238\u0239\x07" +
		"G\x02\x02\u0239\u0241\x07E\x02\x02\u023A\u023B\x07D\x02\x02\u023B\u023C" +
		"\x05 \x11\x02\u023C\u023D\x07E\x02\x02\u023D\u0241\x03\x02\x02\x02\u023E" +
		"\u023F\x07\x1E\x02\x02\u023F\u0241\x07a\x02\x02\u0240\u0217\x03\x02\x02" +
		"\x02\u0240\u0219\x03\x02\x02\x02\u0240\u021C\x03\x02\x02\x02\u0240\u021D" +
		"\x03\x02\x02\x02\u0240\u021E\x03\x02\x02\x02\u0240\u021F\x03\x02\x02\x02" +
		"\u0240\u0220\x03\x02\x02\x02\u0240\u0221\x03\x02\x02\x02\u0240\u0228\x03" +
		"\x02\x02\x02\u0240\u022D\x03\x02\x02\x02\u0240\u022E\x03\x02\x02\x02\u0240" +
		"\u022F\x03\x02\x02\x02\u0240\u0230\x03\x02\x02\x02\u0240\u0231\x03\x02" +
		"\x02\x02\u0240\u0232\x03\x02\x02\x02\u0240\u0233\x03\x02\x02\x02\u0240" +
		"\u023A\x03\x02\x02\x02\u0240\u023E\x03\x02\x02\x02\u0241G\x03\x02\x02" +
		"\x02\u0242\u0244\x05J&\x02\u0243\u0242\x03\x02\x02\x02\u0244\u0245\x03" +
		"\x02\x02\x02\u0245\u0243\x03\x02\x02\x02\u0245\u0246\x03\x02\x02\x02\u0246" +
		"I\x03\x02\x02\x02\u0247\u0250\x07\x06\x02\x02\u0248\u0249\x07a\x02\x02" +
		"\u0249\u024B\x07D\x02\x02\u024A\u024C\x05D#\x02\u024B\u024A\x03\x02\x02" +
		"\x02\u024B\u024C\x03\x02\x02\x02\u024C\u024D\x03\x02\x02\x02\u024D\u0250" +
		"\x07E\x02\x02\u024E\u0250\x07a\x02\x02\u024F\u0247\x03\x02\x02\x02\u024F" +
		"\u0248\x03\x02\x02\x02\u024F\u024E\x03\x02\x02\x02\u0250K\x03\x02\x02" +
		"\x02\u0251\u0252\x07\x0F\x02\x02\u0252\u0253\x07D\x02\x02\u0253\u0254" +
		"\x05 \x11\x02\u0254\u0255\x07E\x02\x02\u0255\u0258\x05\x04\x03\x02\u0256" +
		"\u0257\x07\x10\x02\x02\u0257\u0259\x05\x04\x03\x02\u0258\u0256\x03\x02" +
		"\x02\x02\u0258\u0259\x03\x02\x02\x02\u0259M\x03\x02\x02\x02\u025A\u025B" +
		"\x07\x12\x02\x02\u025B\u025C\x07D\x02\x02\u025C\u025D\x05 \x11\x02\u025D" +
		"\u025E\x07E\x02\x02\u025E\u025F\x05\x04\x03\x02\u025FO\x03\x02\x02\x02" +
		"\u0260\u0261\x07\x13\x02\x02\u0261\u0262\x05\x04\x03\x02\u0262\u0263\x07" +
		"\x12\x02\x02\u0263\u0264\x07D\x02\x02\u0264\u0265\x05 \x11\x02\u0265\u0266" +
		"\x07E\x02\x02\u0266\u0267\x07B\x02\x02\u0267Q\x03\x02\x02\x02\u0268\u0269" +
		"\x07\x11\x02\x02\u0269\u026B\x07D\x02\x02\u026A\u026C\x05T+\x02\u026B" +
		"\u026A\x03\x02\x02\x02\u026B\u026C\x03\x02\x02\x02\u026C\u026D\x03\x02" +
		"\x02\x02\u026D\u026F\x07B\x02\x02\u026E\u0270\x05 \x11\x02\u026F\u026E" +
		"\x03\x02\x02\x02\u026F\u0270\x03\x02\x02\x02\u0270\u0271\x03\x02\x02\x02" +
		"\u0271\u0273\x07B\x02\x02\u0272\u0274\x05V,\x02\u0273\u0272\x03\x02\x02" +
		"\x02\u0273\u0274\x03\x02\x02\x02\u0274\u0275\x03\x02\x02\x02\u0275\u0276" +
		"\x07E\x02\x02\u0276\u0277\x05\x04\x03\x02\u0277S\x03\x02\x02\x02\u0278" +
		"\u027B\x05\b\x05\x02\u0279\u027B\x05V,\x02\u027A\u0278\x03\x02\x02\x02" +
		"\u027A\u0279\x03\x02\x02\x02\u027BU\x03\x02\x02\x02\u027C\u0281\x05X-" +
		"\x02\u027D\u027E\x07C\x02\x02\u027E\u0280\x05X-\x02\u027F\u027D\x03\x02" +
		"\x02\x02\u0280\u0283\x03\x02\x02\x02\u0281\u027F\x03\x02\x02\x02\u0281" +
		"\u0282\x03\x02\x02\x02\u0282\u0285\x03\x02\x02\x02\u0283\u0281\x03\x02" +
		"\x02\x02\u0284\u0286\x07C\x02\x02\u0285\u0284\x03\x02\x02\x02\u0285\u0286" +
		"\x03\x02\x02\x02\u0286W\x03\x02\x02\x02\u0287\u0288\x07.\x02\x02\u0288" +
		"\u028B\x05\"\x12\x02\u0289\u028B\x05\"\x12\x02\u028A\u0287\x03\x02\x02" +
		"\x02\u028A\u0289\x03\x02\x02\x02\u028BY\x03\x02\x02\x02\u028C\u028D\x07" +
		"\x1A\x02\x02\u028D\u028E\x07D\x02\x02\u028E\u028F\x05\\/\x02\u028F\u0290" +
		"\x07\x1F\x02\x02\u0290\u0291\x05 \x11\x02\u0291\u0292\x07E\x02\x02\u0292" +
		"\u0293\x05\x04\x03\x02\u0293[\x03\x02\x02\x02\u0294\u0297\x05^0\x02\u0295" +
		"\u0296\x07C\x02\x02\u0296\u0298\x05^0\x02\u0297\u0295\x03\x02\x02\x02" +
		"\u0297\u0298\x03\x02\x02\x02\u0298]\x03\x02\x02\x02\u0299\u029B\x05\x1A" +
		"\x0E\x02\u029A\u029C\x07\x1E\x02\x02\u029B\u029A\x03\x02\x02\x02\u029B" +
		"\u029C\x03\x02\x02\x02\u029C\u02A0\x03\x02\x02\x02\u029D\u029F\x07>\x02" +
		"\x02\u029E\u029D\x03\x02\x02\x02\u029F\u02A2\x03\x02\x02\x02\u02A0\u029E" +
		"\x03\x02\x02\x02\u02A0\u02A1\x03\x02\x02\x02\u02A1\u02A3\x03\x02\x02\x02" +
		"\u02A2\u02A0\x03\x02\x02\x02\u02A3\u02A4\x07a\x02\x02\u02A4\u02BF\x03" +
		"\x02\x02\x02\u02A5\u02A6\x07\x1E\x02\x02\u02A6\u02AA\x05\x1A\x0E\x02\u02A7" +
		"\u02A9\x07>\x02\x02\u02A8\u02A7\x03\x02\x02\x02\u02A9\u02AC\x03\x02\x02" +
		"\x02\u02AA\u02A8\x03\x02\x02\x02\u02AA\u02AB\x03\x02\x02\x02\u02AB\u02AD" +
		"\x03\x02\x02\x02\u02AC\u02AA\x03\x02\x02\x02\u02AD\u02AE\x07a\x02\x02" +
		"\u02AE\u02BF\x03\x02\x02\x02\u02AF\u02B3\x07\x1E\x02\x02\u02B0\u02B2\x07" +
		">\x02\x02\u02B1\u02B0\x03\x02\x02\x02\u02B2\u02B5\x03\x02\x02\x02\u02B3" +
		"\u02B1\x03\x02\x02\x02\u02B3\u02B4\x03\x02\x02\x02\u02B4\u02B6\x03\x02" +
		"\x02\x02\u02B5\u02B3\x03\x02\x02\x02\u02B6\u02BF\x07a\x02\x02\u02B7\u02B9" +
		"\x07>\x02\x02\u02B8\u02B7\x03\x02\x02\x02\u02B9\u02BC\x03\x02\x02\x02" +
		"\u02BA\u02B8\x03\x02\x02\x02\u02BA\u02BB\x03\x02\x02\x02\u02BB\u02BD\x03" +
		"\x02\x02\x02\u02BC\u02BA\x03\x02\x02\x02\u02BD\u02BF\x07a\x02\x02\u02BE" +
		"\u0299\x03\x02\x02\x02\u02BE\u02A5\x03\x02\x02\x02\u02BE\u02AF\x03\x02" +
		"\x02\x02\u02BE\u02BA\x03\x02\x02\x02\u02BF_\x03\x02\x02\x02\u02C0\u02C1" +
		"\x07\x14\x02\x02\u02C1\u02C2\x07D\x02\x02\u02C2\u02C3\x05 \x11\x02\u02C3" +
		"\u02C4\x07E\x02\x02\u02C4\u02C8\x07F\x02\x02\u02C5\u02C7\x05b2\x02\u02C6" +
		"\u02C5\x03\x02\x02\x02\u02C7\u02CA\x03\x02\x02\x02\u02C8\u02C6\x03\x02" +
		"\x02\x02\u02C8\u02C9\x03\x02\x02\x02\u02C9\u02CB\x03\x02\x02\x02\u02CA" +
		"\u02C8\x03\x02\x02\x02\u02CB\u02CC\x07G\x02\x02\u02CCa\x03\x02\x02\x02" +
		"\u02CD\u02D1\x05d3\x02\u02CE\u02D0\x05\x04\x03\x02\u02CF\u02CE\x03\x02" +
		"\x02\x02\u02D0\u02D3\x03\x02\x02\x02\u02D1\u02CF\x03\x02\x02\x02\u02D1" +
		"\u02D2\x03\x02\x02\x02\u02D2\u02DD\x03\x02\x02\x02\u02D3\u02D1\x03\x02" +
		"\x02\x02\u02D4\u02D8\x05d3\x02\u02D5\u02D7\x05\x04\x03\x02\u02D6\u02D5" +
		"\x03\x02\x02\x02\u02D7\u02DA\x03\x02\x02\x02\u02D8\u02D6\x03\x02\x02\x02" +
		"\u02D8\u02D9\x03\x02\x02\x02\u02D9\u02DC\x03\x02\x02\x02\u02DA\u02D8\x03" +
		"\x02\x02\x02\u02DB\u02D4\x03\x02\x02\x02\u02DC\u02DF\x03\x02\x02\x02\u02DD" +
		"\u02DB\x03\x02\x02\x02\u02DD\u02DE\x03\x02\x02\x02\u02DEc\x03\x02\x02" +
		"\x02\u02DF\u02DD\x03\x02\x02\x02\u02E0\u02E1\x07\x15\x02\x02\u02E1\u02E2" +
		"\x05f4\x02\u02E2\u02E3\x07K\x02\x02\u02E3\u02E7\x03\x02\x02\x02\u02E4" +
		"\u02E5\x07\x16\x02\x02\u02E5\u02E7\x07K\x02\x02\u02E6\u02E0\x03\x02\x02" +
		"\x02\u02E6\u02E4\x03\x02\x02\x02\u02E7e\x03\x02\x02\x02\u02E8\u02ED\x05" +
		" \x11\x02\u02E9\u02EB\x07/\x02\x02\u02EA\u02EC\x05 \x11\x02\u02EB\u02EA" +
		"\x03\x02\x02\x02\u02EB\u02EC\x03\x02\x02\x02\u02EC\u02EE\x03\x02\x02\x02" +
		"\u02ED\u02E9\x03\x02\x02\x02\u02ED\u02EE\x03\x02\x02\x02\u02EE\u02F2\x03" +
		"\x02\x02\x02\u02EF\u02F0\x07/\x02\x02\u02F0\u02F2\x05 \x11\x02\u02F1\u02E8" +
		"\x03\x02\x02\x02\u02F1\u02EF\x03\x02\x02\x02\u02F2g\x03\x02\x02\x02\u02F3" +
		"\u02F4\x07\x17\x02\x02\u02F4\u02F5\x07B\x02\x02\u02F5i\x03\x02\x02\x02" +
		"\u02F6\u02F7\x07\x18\x02\x02\u02F7\u02F8\x07B\x02\x02\u02F8k\x03\x02\x02" +
		"\x02\u02F9\u02FB\x07\x19\x02\x02\u02FA\u02FC\x05 \x11\x02\u02FB\u02FA" +
		"\x03\x02\x02\x02\u02FB\u02FC\x03\x02\x02\x02\u02FC\u02FD\x03\x02\x02\x02" +
		"\u02FD\u02FE\x07B\x02\x02\u02FEm\x03\x02\x02\x02\u02FF\u0300\x07D\x02" +
		"\x02\u0300\u0302\x07K\x02\x02\u0301\u0303\x05p9\x02\u0302\u0301\x03\x02" +
		"\x02\x02\u0302\u0303\x03\x02\x02\x02\u0303\u0304\x03\x02\x02\x02\u0304" +
		"\u0305\x07K\x02\x02\u0305\u0306\x07E\x02\x02\u0306o\x03\x02\x02\x02\u0307" +
		"\u030C\x05r:\x02\u0308\u0309\x07C\x02\x02\u0309\u030B\x05r:\x02\u030A" +
		"\u0308\x03\x02\x02\x02\u030B\u030E\x03\x02\x02\x02\u030C\u030A\x03\x02" +
		"\x02\x02\u030C\u030D\x03\x02\x02\x02\u030D\u0310\x03\x02\x02\x02\u030E" +
		"\u030C\x03\x02\x02\x02\u030F\u0311\x07C\x02\x02\u0310\u030F\x03\x02\x02" +
		"\x02\u0310\u0311\x03\x02\x02\x02\u0311q\x03\x02\x02\x02\u0312\u0313\x07" +
		"L\x02\x02\u0313\u031E\x07a\x02\x02\u0314\u0315\x07L\x02\x02\u0315\u0316" +
		"\x07D\x02\x02\u0316\u0317\x05 \x11\x02\u0317\u0318\x07E\x02\x02\u0318" +
		"\u031E\x03\x02\x02\x02\u0319\u031B\x05\"\x12\x02\u031A\u031C\x07.\x02" +
		"\x02\u031B\u031A\x03\x02\x02\x02\u031B\u031C\x03\x02\x02\x02\u031C\u031E" +
		"\x03\x02\x02\x02\u031D\u0312\x03\x02\x02\x02\u031D\u0314\x03\x02\x02\x02" +
		"\u031D\u0319\x03\x02\x02\x02\u031Es\x03\x02\x02\x02\u031F\u0320\x07\x1B" +
		"\x02\x02\u0320\u0321\x05 \x11\x02\u0321\u0322\x07B\x02\x02\u0322u\x03" +
		"\x02\x02\x02\u0323\u0324\x07\x1C\x02\x02\u0324\u0325\x05 \x11\x02\u0325" +
		"\u0326\x07B\x02\x02\u0326w\x03\x02\x02\x02\u0327\u0328\x07a\x02\x02\u0328" +
		"\u032A\x07D\x02\x02\u0329\u032B\x05D#\x02\u032A\u0329\x03\x02\x02\x02" +
		"\u032A\u032B\x03\x02\x02\x02\u032B\u032C\x03\x02\x02\x02\u032C\u032D\x07" +
		"E\x02\x02\u032Dy\x03\x02\x02\x02\u032E\u0330\x07_\x02\x02\u032F\u032E" +
		"\x03\x02\x02\x02\u0330\u0333\x03\x02\x02\x02\u0331\u032F\x03\x02\x02\x02" +
		"\u0331\u0332\x03\x02\x02\x02\u0332\u0335\x03\x02\x02\x02\u0333\u0331\x03" +
		"\x02\x02\x02\u0334\u0336\x05\x1A\x0E\x02\u0335\u0334\x03\x02\x02\x02\u0335" +
		"\u0336\x03\x02\x02\x02\u0336\u033A\x03\x02\x02\x02\u0337\u0339\x07>\x02" +
		"\x02\u0338\u0337\x03\x02\x02\x02\u0339\u033C\x03\x02\x02\x02\u033A\u0338" +
		"\x03\x02\x02\x02\u033A\u033B\x03\x02\x02\x02\u033B\u033D\x03\x02\x02\x02" +
		"\u033C\u033A\x03\x02\x02\x02\u033D\u033E\x07a\x02\x02\u033E\u0340\x07" +
		"D\x02\x02\u033F\u0341\x05\f\x07\x02\u0340\u033F\x03\x02\x02\x02\u0340" +
		"\u0341\x03\x02\x02\x02\u0341\u0342\x03\x02\x02\x02\u0342\u0343\x07E\x02" +
		"\x02\u0343\u0344\x07B\x02\x02\u0344{\x03\x02\x02\x02\u0345\u0346\x07D" +
		"\x02\x02\u0346\u0348\x07H\x02\x02\u0347\u0349\x05~@\x02\u0348\u0347\x03" +
		"\x02\x02\x02\u0348\u0349\x03\x02\x02\x02\u0349\u034A\x03\x02\x02\x02\u034A" +
		"\u034B\x07I\x02\x02\u034B\u034C\x07E\x02\x02\u034C}\x03\x02\x02\x02\u034D" +
		"\u0352\x05\x80A\x02\u034E\u034F\x07C\x02\x02\u034F\u0351\x05\x80A\x02" +
		"\u0350\u034E\x03\x02\x02\x02\u0351\u0354\x03\x02\x02\x02\u0352\u0350\x03" +
		"\x02\x02\x02\u0352\u0353\x03\x02\x02\x02\u0353\u0356\x03\x02\x02\x02\u0354" +
		"\u0352\x03\x02\x02\x02\u0355\u0357\x07C\x02\x02\u0356\u0355\x03\x02\x02" +
		"\x02\u0356\u0357\x03\x02\x02\x02\u0357\x7F\x03\x02\x02\x02\u0358\u0359" +
		"\x05 \x11\x02\u0359\u035A\x07K\x02\x02\u035A\u035B\x05 \x11\x02\u035B" +
		"\x81\x03\x02\x02\x02\u035C\u035D\x07+\x02\x02\u035D\u0360\x07D\x02\x02" +
		"\u035E\u0361\x05\x1A\x0E\x02\u035F\u0361\x05 \x11\x02\u0360\u035E\x03" +
		"\x02\x02\x02\u0360\u035F\x03\x02\x02\x02\u0361\u0364\x03\x02\x02\x02\u0362" +
		"\u0363\x07C\x02\x02\u0363\u0365\x05\x84C\x02\u0364\u0362\x03\x02\x02\x02" +
		"\u0364\u0365\x03\x02\x02\x02\u0365\u0366\x03\x02\x02\x02\u0366\u0367\x07" +
		"E\x02\x02\u0367\x83\x03\x02\x02\x02\u0368\u036D\x05\x86D\x02\u0369\u036A" +
		"\x07C\x02\x02\u036A\u036C\x05\x86D\x02\u036B\u0369\x03\x02\x02\x02\u036C" +
		"\u036F\x03\x02\x02\x02\u036D\u036B\x03\x02\x02\x02\u036D\u036E\x03\x02" +
		"\x02\x02\u036E\x85\x03\x02\x02\x02\u036F\u036D\x03\x02\x02\x02\u0370\u0371" +
		"\x07a\x02\x02\u0371\u0372\x07K\x02\x02\u0372\u0373\x05 \x11\x02\u0373" +
		"\x87\x03\x02\x02\x02\u0374\u0375\x07N\x02\x02\u0375\u0390\x05 \x11\x02" +
		"\u0376\u0377\x05 \x11\x02\u0377\u0379\x07/\x02\x02\u0378\u037A\x07N\x02" +
		"\x02\u0379\u0378\x03\x02\x02\x02\u0379\u037A\x03\x02\x02\x02\u037A\u037C" +
		"\x03\x02\x02\x02\u037B\u037D\x05 \x11\x02\u037C\u037B\x03\x02\x02\x02" +
		"\u037C\u037D\x03\x02\x02\x02\u037D\u0390\x03\x02\x02\x02\u037E\u0380\x07" +
		"/\x02\x02\u037F\u0381\x07N\x02\x02\u0380\u037F\x03\x02\x02\x02\u0380\u0381" +
		"\x03\x02\x02\x02\u0381\u0383\x03\x02\x02\x02\u0382\u0384\x05 \x11\x02" +
		"\u0383\u0382\x03\x02\x02\x02\u0383\u0384\x03\x02\x02\x02\u0384\u0390\x03" +
		"\x02\x02\x02\u0385\u0390\x05 \x11\x02\u0386\u0387\x07N\x02\x02\u0387\u0388" +
		"\x05 \x11\x02\u0388\u038A\x07/\x02\x02\u0389\u038B\x07N\x02\x02\u038A" +
		"\u0389\x03\x02\x02\x02\u038A\u038B\x03\x02\x02\x02\u038B\u038D\x03\x02" +
		"\x02\x02\u038C\u038E\x05 \x11\x02\u038D\u038C\x03\x02\x02\x02\u038D\u038E" +
		"\x03\x02\x02\x02\u038E\u0390\x03\x02\x02\x02\u038F\u0374\x03\x02\x02\x02" +
		"\u038F\u0376\x03\x02\x02\x02\u038F\u037E\x03\x02\x02\x02\u038F\u0385\x03" +
		"\x02\x02\x02\u038F\u0386\x03\x02\x02\x02\u0390\x89\x03\x02\x02\x02\u0391" +
		"\u0393\x07\b\x02\x02\u0392\u0394\x05\x8CG\x02\u0393\u0392\x03\x02\x02" +
		"\x02\u0393\u0394\x03\x02\x02\x02\u0394\u0395\x03\x02\x02\x02\u0395\u0396" +
		"\x07\n\x02\x02\u0396\x8B\x03\x02\x02\x02\u0397\u0399\x05\x8EH\x02\u0398" +
		"\u0397\x03\x02\x02\x02\u0399\u039A\x03\x02\x02\x02\u039A\u0398\x03\x02" +
		"\x02\x02\u039A\u039B\x03\x02\x02\x02\u039B\x8D\x03\x02\x02\x02\u039C\u039D" +
		"\t\v\x02\x02\u039D\x8F\x03\x02\x02\x02p\x93\xA0\xB1\xB6\xBA\xBF\xC5\xCD" +
		"\xD6\xDC\xE2\xE9\xEE\xF3\xF8\xFB\xFF\u0104\u010A\u010F\u0112\u0114\u011D" +
		"\u0125\u012C\u0132\u0149\u014C\u0152\u015F\u0165\u016D\u0174\u017C\u0184" +
		"\u018C\u0194\u019C\u01A4\u01AC\u01B4\u01BC\u01C0\u01CE\u01D4\u01EA\u01F1" +
		"\u01F4\u01F8\u0201\u0203\u0208\u020D\u0211\u0215\u0224\u0236\u0240\u0245" +
		"\u024B\u024F\u0258\u026B\u026F\u0273\u027A\u0281\u0285\u028A\u0297\u029B" +
		"\u02A0\u02AA\u02B3\u02BA\u02BE\u02C8\u02D1\u02D8\u02DD\u02E6\u02EB\u02ED" +
		"\u02F1\u02FB\u0302\u030C\u0310\u031B\u031D\u032A\u0331\u0335\u033A\u0340" +
		"\u0348\u0352\u0356\u0360\u0364\u036D\u0379\u037C\u0380\u0383\u038A\u038D" +
		"\u038F\u0393\u039A";
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
	public KW_CLASS(): TerminalNode | undefined { return this.tryGetToken(LPCParser.KW_CLASS, 0); }
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
	public BIT_XOR_ASSIGN(): TerminalNode | undefined { return this.tryGetToken(LPCParser.BIT_XOR_ASSIGN, 0); }
	public SHIFT_LEFT_ASSIGN(): TerminalNode | undefined { return this.tryGetToken(LPCParser.SHIFT_LEFT_ASSIGN, 0); }
	public SHIFT_RIGHT_ASSIGN(): TerminalNode | undefined { return this.tryGetToken(LPCParser.SHIFT_RIGHT_ASSIGN, 0); }
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
	public sizeofExpression(): SizeofExpressionContext | undefined {
		return this.tryGetRuleContext(0, SizeofExpressionContext);
	}
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


export class SizeofExpressionContext extends ParserRuleContext {
	public KW_SIZEOF(): TerminalNode { return this.getToken(LPCParser.KW_SIZEOF, 0); }
	public LPAREN(): TerminalNode { return this.getToken(LPCParser.LPAREN, 0); }
	public RPAREN(): TerminalNode { return this.getToken(LPCParser.RPAREN, 0); }
	public expression(): ExpressionContext | undefined {
		return this.tryGetRuleContext(0, ExpressionContext);
	}
	public typeSpec(): TypeSpecContext | undefined {
		return this.tryGetRuleContext(0, TypeSpecContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_sizeofExpression; }
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitSizeofExpression) {
			return visitor.visitSizeofExpression(this);
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
	public KW_CLASS(): TerminalNode | undefined { return this.tryGetToken(LPCParser.KW_CLASS, 0); }
	public Identifier(): TerminalNode | undefined { return this.tryGetToken(LPCParser.Identifier, 0); }
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


