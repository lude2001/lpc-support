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
	public static readonly ELLIPSIS = 42;
	public static readonly RANGE_OP = 43;
	public static readonly ARROW = 44;
	public static readonly DOT = 45;
	public static readonly INC = 46;
	public static readonly DEC = 47;
	public static readonly PLUS_ASSIGN = 48;
	public static readonly MINUS_ASSIGN = 49;
	public static readonly STAR_ASSIGN = 50;
	public static readonly DIV_ASSIGN = 51;
	public static readonly PERCENT_ASSIGN = 52;
	public static readonly PLUS = 53;
	public static readonly MINUS = 54;
	public static readonly STAR = 55;
	public static readonly DIV = 56;
	public static readonly PERCENT = 57;
	public static readonly SCOPE = 58;
	public static readonly SEMI = 59;
	public static readonly COMMA = 60;
	public static readonly LPAREN = 61;
	public static readonly RPAREN = 62;
	public static readonly LBRACE = 63;
	public static readonly RBRACE = 64;
	public static readonly LBRACK = 65;
	public static readonly RBRACK = 66;
	public static readonly QUESTION = 67;
	public static readonly COLON = 68;
	public static readonly DOLLAR = 69;
	public static readonly GT = 70;
	public static readonly LT = 71;
	public static readonly GE = 72;
	public static readonly LE = 73;
	public static readonly EQ = 74;
	public static readonly NE = 75;
	public static readonly ASSIGN = 76;
	public static readonly NOT = 77;
	public static readonly AND = 78;
	public static readonly OR = 79;
	public static readonly SHIFT_LEFT = 80;
	public static readonly SHIFT_RIGHT = 81;
	public static readonly BIT_AND = 82;
	public static readonly BIT_OR = 83;
	public static readonly BIT_XOR = 84;
	public static readonly BIT_NOT = 85;
	public static readonly BIT_OR_ASSIGN = 86;
	public static readonly BIT_AND_ASSIGN = 87;
	public static readonly MODIFIER = 88;
	public static readonly PARAMETER_PLACEHOLDER = 89;
	public static readonly Identifier = 90;
	public static readonly RULE_sourceFile = 0;
	public static readonly RULE_statement = 1;
	public static readonly RULE_functionDef = 2;
	public static readonly RULE_variableDecl = 3;
	public static readonly RULE_variableDeclarator = 4;
	public static readonly RULE_parameterList = 5;
	public static readonly RULE_parameter = 6;
	public static readonly RULE_structDef = 7;
	public static readonly RULE_classDef = 8;
	public static readonly RULE_structMemberList = 9;
	public static readonly RULE_structMember = 10;
	public static readonly RULE_typeSpec = 11;
	public static readonly RULE_block = 12;
	public static readonly RULE_exprStatement = 13;
	public static readonly RULE_expression = 14;
	public static readonly RULE_assignmentExpression = 15;
	public static readonly RULE_conditionalExpression = 16;
	public static readonly RULE_logicalOrExpression = 17;
	public static readonly RULE_logicalAndExpression = 18;
	public static readonly RULE_bitwiseOrExpression = 19;
	public static readonly RULE_bitwiseXorExpression = 20;
	public static readonly RULE_bitwiseAndExpression = 21;
	public static readonly RULE_equalityExpression = 22;
	public static readonly RULE_relationalExpression = 23;
	public static readonly RULE_shiftExpression = 24;
	public static readonly RULE_additiveExpression = 25;
	public static readonly RULE_multiplicativeExpression = 26;
	public static readonly RULE_unaryExpression = 27;
	public static readonly RULE_castExpression = 28;
	public static readonly RULE_castType = 29;
	public static readonly RULE_postfixExpression = 30;
	public static readonly RULE_argumentList = 31;
	public static readonly RULE_primary = 32;
	public static readonly RULE_stringConcat = 33;
	public static readonly RULE_concatItem = 34;
	public static readonly RULE_ifStatement = 35;
	public static readonly RULE_whileStatement = 36;
	public static readonly RULE_doWhileStatement = 37;
	public static readonly RULE_forStatement = 38;
	public static readonly RULE_forInit = 39;
	public static readonly RULE_expressionList = 40;
	public static readonly RULE_spreadElement = 41;
	public static readonly RULE_foreachStatement = 42;
	public static readonly RULE_foreachInit = 43;
	public static readonly RULE_foreachVar = 44;
	public static readonly RULE_switchStatement = 45;
	public static readonly RULE_switchSection = 46;
	public static readonly RULE_switchLabelWithColon = 47;
	public static readonly RULE_switchLabel = 48;
	public static readonly RULE_breakStatement = 49;
	public static readonly RULE_continueStatement = 50;
	public static readonly RULE_returnStatement = 51;
	public static readonly RULE_closureExpr = 52;
	public static readonly RULE_inheritStatement = 53;
	public static readonly RULE_includeStatement = 54;
	public static readonly RULE_macroInvoke = 55;
	public static readonly RULE_prototypeStatement = 56;
	public static readonly RULE_mappingLiteral = 57;
	public static readonly RULE_mappingPairList = 58;
	public static readonly RULE_mappingPair = 59;
	public static readonly RULE_newExpression = 60;
	public static readonly RULE_structInitializerList = 61;
	public static readonly RULE_structInitializer = 62;
	public static readonly RULE_sliceExpr = 63;
	public static readonly RULE_arrayDelimiterLiteral = 64;
	public static readonly RULE_arrayDelimiterContent = 65;
	public static readonly RULE_arrayDelimiterElement = 66;
	// tslint:disable:no-trailing-whitespace
	public static readonly ruleNames: string[] = [
		"sourceFile", "statement", "functionDef", "variableDecl", "variableDeclarator", 
		"parameterList", "parameter", "structDef", "classDef", "structMemberList", 
		"structMember", "typeSpec", "block", "exprStatement", "expression", "assignmentExpression", 
		"conditionalExpression", "logicalOrExpression", "logicalAndExpression", 
		"bitwiseOrExpression", "bitwiseXorExpression", "bitwiseAndExpression", 
		"equalityExpression", "relationalExpression", "shiftExpression", "additiveExpression", 
		"multiplicativeExpression", "unaryExpression", "castExpression", "castType", 
		"postfixExpression", "argumentList", "primary", "stringConcat", "concatItem", 
		"ifStatement", "whileStatement", "doWhileStatement", "forStatement", "forInit", 
		"expressionList", "spreadElement", "foreachStatement", "foreachInit", 
		"foreachVar", "switchStatement", "switchSection", "switchLabelWithColon", 
		"switchLabel", "breakStatement", "continueStatement", "returnStatement", 
		"closureExpr", "inheritStatement", "includeStatement", "macroInvoke", 
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
		"'class'", "'new'", "'...'", "'..'", "'->'", "'.'", "'++'", "'--'", "'+='", 
		"'-='", "'*='", "'/='", "'%='", "'+'", "'-'", "'*'", "'/'", "'%'", "'::'", 
		"';'", "','", "'('", "')'", "'{'", "'}'", "'['", "']'", "'?'", "':'", 
		"'$'", "'>'", "'<'", "'>='", "'<='", "'=='", "'!='", "'='", "'!'", "'&&'", 
		"'||'", "'<<'", "'>>'", "'&'", "'|'", "'^'", "'~'", "'|='", "'&='",
	];
	private static readonly _SYMBOLIC_NAMES: Array<string | undefined> = [
		undefined, "INTEGER", "FLOAT", "CHAR_LITERAL", "STRING_LITERAL", "HEREDOC_START", 
		"ARRAY_DELIMITER_START", "HEREDOC_END", "ARRAY_DELIMITER_END", "WS", "LINE_COMMENT", 
		"BLOCK_COMMENT", "DIRECTIVE", "IF", "ELSE", "FOR", "WHILE", "DO", "SWITCH", 
		"CASE", "DEFAULT", "BREAK", "CONTINUE", "RETURN", "FOREACH", "INHERIT", 
		"INCLUDE", "CATCH", "REF", "IN", "KW_INT", "KW_FLOAT", "KW_STRING", "KW_OBJECT", 
		"KW_MIXED", "KW_MAPPING", "KW_FUNCTION", "KW_BUFFER", "KW_VOID", "KW_STRUCT", 
		"KW_CLASS", "KW_NEW", "ELLIPSIS", "RANGE_OP", "ARROW", "DOT", "INC", "DEC", 
		"PLUS_ASSIGN", "MINUS_ASSIGN", "STAR_ASSIGN", "DIV_ASSIGN", "PERCENT_ASSIGN", 
		"PLUS", "MINUS", "STAR", "DIV", "PERCENT", "SCOPE", "SEMI", "COMMA", "LPAREN", 
		"RPAREN", "LBRACE", "RBRACE", "LBRACK", "RBRACK", "QUESTION", "COLON", 
		"DOLLAR", "GT", "LT", "GE", "LE", "EQ", "NE", "ASSIGN", "NOT", "AND", 
		"OR", "SHIFT_LEFT", "SHIFT_RIGHT", "BIT_AND", "BIT_OR", "BIT_XOR", "BIT_NOT", 
		"BIT_OR_ASSIGN", "BIT_AND_ASSIGN", "MODIFIER", "PARAMETER_PLACEHOLDER", 
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
			this.state = 137;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.IF) | (1 << LPCParser.FOR) | (1 << LPCParser.WHILE) | (1 << LPCParser.DO) | (1 << LPCParser.SWITCH) | (1 << LPCParser.BREAK) | (1 << LPCParser.CONTINUE) | (1 << LPCParser.RETURN) | (1 << LPCParser.FOREACH) | (1 << LPCParser.INHERIT) | (1 << LPCParser.INCLUDE) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF) | (1 << LPCParser.KW_INT) | (1 << LPCParser.KW_FLOAT))) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & ((1 << (LPCParser.KW_STRING - 32)) | (1 << (LPCParser.KW_OBJECT - 32)) | (1 << (LPCParser.KW_MIXED - 32)) | (1 << (LPCParser.KW_MAPPING - 32)) | (1 << (LPCParser.KW_FUNCTION - 32)) | (1 << (LPCParser.KW_BUFFER - 32)) | (1 << (LPCParser.KW_VOID - 32)) | (1 << (LPCParser.KW_STRUCT - 32)) | (1 << (LPCParser.KW_CLASS - 32)) | (1 << (LPCParser.KW_NEW - 32)) | (1 << (LPCParser.INC - 32)) | (1 << (LPCParser.DEC - 32)) | (1 << (LPCParser.PLUS - 32)) | (1 << (LPCParser.MINUS - 32)) | (1 << (LPCParser.STAR - 32)) | (1 << (LPCParser.SCOPE - 32)) | (1 << (LPCParser.SEMI - 32)) | (1 << (LPCParser.LPAREN - 32)) | (1 << (LPCParser.LBRACE - 32)))) !== 0) || ((((_la - 69)) & ~0x1F) === 0 && ((1 << (_la - 69)) & ((1 << (LPCParser.DOLLAR - 69)) | (1 << (LPCParser.NOT - 69)) | (1 << (LPCParser.BIT_NOT - 69)) | (1 << (LPCParser.MODIFIER - 69)) | (1 << (LPCParser.PARAMETER_PLACEHOLDER - 69)) | (1 << (LPCParser.Identifier - 69)))) !== 0)) {
				{
				{
				this.state = 134;
				this.statement();
				}
				}
				this.state = 139;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 140;
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
			this.state = 164;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 1, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 142;
				this.functionDef();
				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 143;
				this.variableDecl();
				this.state = 144;
				this.match(LPCParser.SEMI);
				}
				break;

			case 3:
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 146;
				this.structDef();
				}
				break;

			case 4:
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 147;
				this.classDef();
				}
				break;

			case 5:
				this.enterOuterAlt(_localctx, 5);
				{
				this.state = 148;
				this.macroInvoke();
				}
				break;

			case 6:
				this.enterOuterAlt(_localctx, 6);
				{
				this.state = 149;
				this.ifStatement();
				}
				break;

			case 7:
				this.enterOuterAlt(_localctx, 7);
				{
				this.state = 150;
				this.whileStatement();
				}
				break;

			case 8:
				this.enterOuterAlt(_localctx, 8);
				{
				this.state = 151;
				this.forStatement();
				}
				break;

			case 9:
				this.enterOuterAlt(_localctx, 9);
				{
				this.state = 152;
				this.doWhileStatement();
				}
				break;

			case 10:
				this.enterOuterAlt(_localctx, 10);
				{
				this.state = 153;
				this.foreachStatement();
				}
				break;

			case 11:
				this.enterOuterAlt(_localctx, 11);
				{
				this.state = 154;
				this.switchStatement();
				}
				break;

			case 12:
				this.enterOuterAlt(_localctx, 12);
				{
				this.state = 155;
				this.breakStatement();
				}
				break;

			case 13:
				this.enterOuterAlt(_localctx, 13);
				{
				this.state = 156;
				this.continueStatement();
				}
				break;

			case 14:
				this.enterOuterAlt(_localctx, 14);
				{
				this.state = 157;
				this.returnStatement();
				}
				break;

			case 15:
				this.enterOuterAlt(_localctx, 15);
				{
				this.state = 158;
				this.inheritStatement();
				}
				break;

			case 16:
				this.enterOuterAlt(_localctx, 16);
				{
				this.state = 159;
				this.includeStatement();
				}
				break;

			case 17:
				this.enterOuterAlt(_localctx, 17);
				{
				this.state = 160;
				this.block();
				}
				break;

			case 18:
				this.enterOuterAlt(_localctx, 18);
				{
				this.state = 161;
				this.exprStatement();
				}
				break;

			case 19:
				this.enterOuterAlt(_localctx, 19);
				{
				this.state = 162;
				this.prototypeStatement();
				}
				break;

			case 20:
				this.enterOuterAlt(_localctx, 20);
				{
				this.state = 163;
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
			this.state = 169;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.MODIFIER) {
				{
				{
				this.state = 166;
				this.match(LPCParser.MODIFIER);
				}
				}
				this.state = 171;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 173;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 3, this._ctx) ) {
			case 1:
				{
				this.state = 172;
				this.typeSpec();
				}
				break;
			}
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
			this.state = 182;
			this.match(LPCParser.LPAREN);
			this.state = 184;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 30)) & ~0x1F) === 0 && ((1 << (_la - 30)) & ((1 << (LPCParser.KW_INT - 30)) | (1 << (LPCParser.KW_FLOAT - 30)) | (1 << (LPCParser.KW_STRING - 30)) | (1 << (LPCParser.KW_OBJECT - 30)) | (1 << (LPCParser.KW_MIXED - 30)) | (1 << (LPCParser.KW_MAPPING - 30)) | (1 << (LPCParser.KW_FUNCTION - 30)) | (1 << (LPCParser.KW_BUFFER - 30)) | (1 << (LPCParser.KW_VOID - 30)) | (1 << (LPCParser.KW_STRUCT - 30)) | (1 << (LPCParser.KW_CLASS - 30)) | (1 << (LPCParser.STAR - 30)))) !== 0) || _la === LPCParser.Identifier) {
				{
				this.state = 183;
				this.parameterList();
				}
			}

			this.state = 186;
			this.match(LPCParser.RPAREN);
			this.state = 187;
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
			this.state = 192;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.MODIFIER) {
				{
				{
				this.state = 189;
				this.match(LPCParser.MODIFIER);
				}
				}
				this.state = 194;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 195;
			this.typeSpec();
			this.state = 196;
			this.variableDeclarator();
			this.state = 201;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.COMMA) {
				{
				{
				this.state = 197;
				this.match(LPCParser.COMMA);
				this.state = 198;
				this.variableDeclarator();
				}
				}
				this.state = 203;
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
			this.state = 207;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.STAR) {
				{
				{
				this.state = 204;
				this.match(LPCParser.STAR);
				}
				}
				this.state = 209;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 210;
			this.match(LPCParser.Identifier);
			this.state = 213;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === LPCParser.ASSIGN) {
				{
				this.state = 211;
				this.match(LPCParser.ASSIGN);
				this.state = 212;
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
			this.state = 215;
			this.parameter();
			this.state = 220;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.COMMA) {
				{
				{
				this.state = 216;
				this.match(LPCParser.COMMA);
				this.state = 217;
				this.parameter();
				}
				}
				this.state = 222;
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
			this.state = 257;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 18, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 223;
				this.typeSpec();
				this.state = 225;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.REF) {
					{
					this.state = 224;
					this.match(LPCParser.REF);
					}
				}

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
				this.state = 235;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.ELLIPSIS) {
					{
					this.state = 234;
					this.match(LPCParser.ELLIPSIS);
					}
				}

				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 237;
				this.typeSpec();
				this.state = 239;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.REF) {
					{
					this.state = 238;
					this.match(LPCParser.REF);
					}
				}

				this.state = 244;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === LPCParser.STAR) {
					{
					{
					this.state = 241;
					this.match(LPCParser.STAR);
					}
					}
					this.state = 246;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
				break;

			case 3:
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 250;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === LPCParser.STAR) {
					{
					{
					this.state = 247;
					this.match(LPCParser.STAR);
					}
					}
					this.state = 252;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 253;
				this.match(LPCParser.Identifier);
				this.state = 255;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.ELLIPSIS) {
					{
					this.state = 254;
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
	public structDef(): StructDefContext {
		let _localctx: StructDefContext = new StructDefContext(this._ctx, this.state);
		this.enterRule(_localctx, 14, LPCParser.RULE_structDef);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 259;
			this.match(LPCParser.KW_STRUCT);
			this.state = 260;
			this.match(LPCParser.Identifier);
			this.state = 261;
			this.match(LPCParser.LBRACE);
			this.state = 263;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 30)) & ~0x1F) === 0 && ((1 << (_la - 30)) & ((1 << (LPCParser.KW_INT - 30)) | (1 << (LPCParser.KW_FLOAT - 30)) | (1 << (LPCParser.KW_STRING - 30)) | (1 << (LPCParser.KW_OBJECT - 30)) | (1 << (LPCParser.KW_MIXED - 30)) | (1 << (LPCParser.KW_MAPPING - 30)) | (1 << (LPCParser.KW_FUNCTION - 30)) | (1 << (LPCParser.KW_BUFFER - 30)) | (1 << (LPCParser.KW_VOID - 30)) | (1 << (LPCParser.KW_STRUCT - 30)) | (1 << (LPCParser.KW_CLASS - 30)))) !== 0) || _la === LPCParser.Identifier) {
				{
				this.state = 262;
				this.structMemberList();
				}
			}

			this.state = 265;
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
		this.enterRule(_localctx, 16, LPCParser.RULE_classDef);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 267;
			this.match(LPCParser.KW_CLASS);
			this.state = 268;
			this.match(LPCParser.Identifier);
			this.state = 269;
			this.match(LPCParser.LBRACE);
			this.state = 271;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 30)) & ~0x1F) === 0 && ((1 << (_la - 30)) & ((1 << (LPCParser.KW_INT - 30)) | (1 << (LPCParser.KW_FLOAT - 30)) | (1 << (LPCParser.KW_STRING - 30)) | (1 << (LPCParser.KW_OBJECT - 30)) | (1 << (LPCParser.KW_MIXED - 30)) | (1 << (LPCParser.KW_MAPPING - 30)) | (1 << (LPCParser.KW_FUNCTION - 30)) | (1 << (LPCParser.KW_BUFFER - 30)) | (1 << (LPCParser.KW_VOID - 30)) | (1 << (LPCParser.KW_STRUCT - 30)) | (1 << (LPCParser.KW_CLASS - 30)))) !== 0) || _la === LPCParser.Identifier) {
				{
				this.state = 270;
				this.structMemberList();
				}
			}

			this.state = 273;
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
		this.enterRule(_localctx, 18, LPCParser.RULE_structMemberList);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 276;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 275;
				this.structMember();
				}
				}
				this.state = 278;
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
		this.enterRule(_localctx, 20, LPCParser.RULE_structMember);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 280;
			this.typeSpec();
			this.state = 284;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.STAR) {
				{
				{
				this.state = 281;
				this.match(LPCParser.STAR);
				}
				}
				this.state = 286;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 287;
			this.match(LPCParser.Identifier);
			this.state = 288;
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
		this.enterRule(_localctx, 22, LPCParser.RULE_typeSpec);
		try {
			let _alt: number;
			this.state = 310;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 24, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 290;
				this.match(LPCParser.KW_INT);
				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 291;
				this.match(LPCParser.KW_FLOAT);
				}
				break;

			case 3:
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 292;
				this.match(LPCParser.KW_STRING);
				}
				break;

			case 4:
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 293;
				this.match(LPCParser.KW_OBJECT);
				}
				break;

			case 5:
				this.enterOuterAlt(_localctx, 5);
				{
				this.state = 294;
				this.match(LPCParser.KW_MIXED);
				}
				break;

			case 6:
				this.enterOuterAlt(_localctx, 6);
				{
				this.state = 295;
				this.match(LPCParser.KW_MAPPING);
				}
				break;

			case 7:
				this.enterOuterAlt(_localctx, 7);
				{
				this.state = 296;
				this.match(LPCParser.KW_FUNCTION);
				}
				break;

			case 8:
				this.enterOuterAlt(_localctx, 8);
				{
				this.state = 297;
				this.match(LPCParser.KW_BUFFER);
				}
				break;

			case 9:
				this.enterOuterAlt(_localctx, 9);
				{
				this.state = 298;
				this.match(LPCParser.KW_VOID);
				}
				break;

			case 10:
				this.enterOuterAlt(_localctx, 10);
				{
				this.state = 299;
				this.match(LPCParser.KW_STRUCT);
				}
				break;

			case 11:
				this.enterOuterAlt(_localctx, 11);
				{
				this.state = 300;
				this.match(LPCParser.KW_CLASS);
				}
				break;

			case 12:
				this.enterOuterAlt(_localctx, 12);
				{
				this.state = 301;
				this.match(LPCParser.KW_CLASS);
				this.state = 302;
				this.match(LPCParser.Identifier);
				}
				break;

			case 13:
				this.enterOuterAlt(_localctx, 13);
				{
				this.state = 303;
				this.match(LPCParser.Identifier);
				this.state = 307;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 23, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 304;
						this.match(LPCParser.STAR);
						}
						}
					}
					this.state = 309;
					this._errHandler.sync(this);
					_alt = this.interpreter.adaptivePredict(this._input, 23, this._ctx);
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
		this.enterRule(_localctx, 24, LPCParser.RULE_block);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 312;
			this.match(LPCParser.LBRACE);
			this.state = 316;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.IF) | (1 << LPCParser.FOR) | (1 << LPCParser.WHILE) | (1 << LPCParser.DO) | (1 << LPCParser.SWITCH) | (1 << LPCParser.BREAK) | (1 << LPCParser.CONTINUE) | (1 << LPCParser.RETURN) | (1 << LPCParser.FOREACH) | (1 << LPCParser.INHERIT) | (1 << LPCParser.INCLUDE) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF) | (1 << LPCParser.KW_INT) | (1 << LPCParser.KW_FLOAT))) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & ((1 << (LPCParser.KW_STRING - 32)) | (1 << (LPCParser.KW_OBJECT - 32)) | (1 << (LPCParser.KW_MIXED - 32)) | (1 << (LPCParser.KW_MAPPING - 32)) | (1 << (LPCParser.KW_FUNCTION - 32)) | (1 << (LPCParser.KW_BUFFER - 32)) | (1 << (LPCParser.KW_VOID - 32)) | (1 << (LPCParser.KW_STRUCT - 32)) | (1 << (LPCParser.KW_CLASS - 32)) | (1 << (LPCParser.KW_NEW - 32)) | (1 << (LPCParser.INC - 32)) | (1 << (LPCParser.DEC - 32)) | (1 << (LPCParser.PLUS - 32)) | (1 << (LPCParser.MINUS - 32)) | (1 << (LPCParser.STAR - 32)) | (1 << (LPCParser.SCOPE - 32)) | (1 << (LPCParser.SEMI - 32)) | (1 << (LPCParser.LPAREN - 32)) | (1 << (LPCParser.LBRACE - 32)))) !== 0) || ((((_la - 69)) & ~0x1F) === 0 && ((1 << (_la - 69)) & ((1 << (LPCParser.DOLLAR - 69)) | (1 << (LPCParser.NOT - 69)) | (1 << (LPCParser.BIT_NOT - 69)) | (1 << (LPCParser.MODIFIER - 69)) | (1 << (LPCParser.PARAMETER_PLACEHOLDER - 69)) | (1 << (LPCParser.Identifier - 69)))) !== 0)) {
				{
				{
				this.state = 313;
				this.statement();
				}
				}
				this.state = 318;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 319;
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
		this.enterRule(_localctx, 26, LPCParser.RULE_exprStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 321;
			this.expression();
			this.state = 322;
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
		this.enterRule(_localctx, 28, LPCParser.RULE_expression);
		try {
			let _alt: number;
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 324;
			this.assignmentExpression();
			this.state = 329;
			this._errHandler.sync(this);
			_alt = this.interpreter.adaptivePredict(this._input, 26, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 325;
					this.match(LPCParser.COMMA);
					this.state = 326;
					this.assignmentExpression();
					}
					}
				}
				this.state = 331;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 26, this._ctx);
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
		this.enterRule(_localctx, 30, LPCParser.RULE_assignmentExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 332;
			this.conditionalExpression();
			this.state = 335;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 48)) & ~0x1F) === 0 && ((1 << (_la - 48)) & ((1 << (LPCParser.PLUS_ASSIGN - 48)) | (1 << (LPCParser.MINUS_ASSIGN - 48)) | (1 << (LPCParser.STAR_ASSIGN - 48)) | (1 << (LPCParser.DIV_ASSIGN - 48)) | (1 << (LPCParser.PERCENT_ASSIGN - 48)) | (1 << (LPCParser.ASSIGN - 48)))) !== 0) || _la === LPCParser.BIT_OR_ASSIGN || _la === LPCParser.BIT_AND_ASSIGN) {
				{
				this.state = 333;
				_la = this._input.LA(1);
				if (!(((((_la - 48)) & ~0x1F) === 0 && ((1 << (_la - 48)) & ((1 << (LPCParser.PLUS_ASSIGN - 48)) | (1 << (LPCParser.MINUS_ASSIGN - 48)) | (1 << (LPCParser.STAR_ASSIGN - 48)) | (1 << (LPCParser.DIV_ASSIGN - 48)) | (1 << (LPCParser.PERCENT_ASSIGN - 48)) | (1 << (LPCParser.ASSIGN - 48)))) !== 0) || _la === LPCParser.BIT_OR_ASSIGN || _la === LPCParser.BIT_AND_ASSIGN)) {
				this._errHandler.recoverInline(this);
				} else {
					if (this._input.LA(1) === Token.EOF) {
						this.matchedEOF = true;
					}

					this._errHandler.reportMatch(this);
					this.consume();
				}
				this.state = 334;
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
		this.enterRule(_localctx, 32, LPCParser.RULE_conditionalExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 337;
			this.logicalOrExpression();
			this.state = 343;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === LPCParser.QUESTION) {
				{
				this.state = 338;
				this.match(LPCParser.QUESTION);
				this.state = 339;
				this.expression();
				this.state = 340;
				this.match(LPCParser.COLON);
				this.state = 341;
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
		this.enterRule(_localctx, 34, LPCParser.RULE_logicalOrExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 345;
			this.logicalAndExpression();
			this.state = 350;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.OR) {
				{
				{
				this.state = 346;
				this.match(LPCParser.OR);
				this.state = 347;
				this.logicalAndExpression();
				}
				}
				this.state = 352;
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
		this.enterRule(_localctx, 36, LPCParser.RULE_logicalAndExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 353;
			this.bitwiseOrExpression();
			this.state = 358;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.AND) {
				{
				{
				this.state = 354;
				this.match(LPCParser.AND);
				this.state = 355;
				this.bitwiseOrExpression();
				}
				}
				this.state = 360;
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
		this.enterRule(_localctx, 38, LPCParser.RULE_bitwiseOrExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 361;
			this.bitwiseXorExpression();
			this.state = 366;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.BIT_OR) {
				{
				{
				this.state = 362;
				this.match(LPCParser.BIT_OR);
				this.state = 363;
				this.bitwiseXorExpression();
				}
				}
				this.state = 368;
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
		this.enterRule(_localctx, 40, LPCParser.RULE_bitwiseXorExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 369;
			this.bitwiseAndExpression();
			this.state = 374;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.BIT_XOR) {
				{
				{
				this.state = 370;
				this.match(LPCParser.BIT_XOR);
				this.state = 371;
				this.bitwiseAndExpression();
				}
				}
				this.state = 376;
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
		this.enterRule(_localctx, 42, LPCParser.RULE_bitwiseAndExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 377;
			this.equalityExpression();
			this.state = 382;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.BIT_AND) {
				{
				{
				this.state = 378;
				this.match(LPCParser.BIT_AND);
				this.state = 379;
				this.equalityExpression();
				}
				}
				this.state = 384;
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
		this.enterRule(_localctx, 44, LPCParser.RULE_equalityExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 385;
			this.relationalExpression();
			this.state = 390;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.EQ || _la === LPCParser.NE) {
				{
				{
				this.state = 386;
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
				this.state = 387;
				this.relationalExpression();
				}
				}
				this.state = 392;
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
		this.enterRule(_localctx, 46, LPCParser.RULE_relationalExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 393;
			this.shiftExpression();
			this.state = 398;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 70)) & ~0x1F) === 0 && ((1 << (_la - 70)) & ((1 << (LPCParser.GT - 70)) | (1 << (LPCParser.LT - 70)) | (1 << (LPCParser.GE - 70)) | (1 << (LPCParser.LE - 70)))) !== 0)) {
				{
				{
				this.state = 394;
				_la = this._input.LA(1);
				if (!(((((_la - 70)) & ~0x1F) === 0 && ((1 << (_la - 70)) & ((1 << (LPCParser.GT - 70)) | (1 << (LPCParser.LT - 70)) | (1 << (LPCParser.GE - 70)) | (1 << (LPCParser.LE - 70)))) !== 0))) {
				this._errHandler.recoverInline(this);
				} else {
					if (this._input.LA(1) === Token.EOF) {
						this.matchedEOF = true;
					}

					this._errHandler.reportMatch(this);
					this.consume();
				}
				this.state = 395;
				this.shiftExpression();
				}
				}
				this.state = 400;
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
		this.enterRule(_localctx, 48, LPCParser.RULE_shiftExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 401;
			this.additiveExpression();
			this.state = 406;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.SHIFT_LEFT || _la === LPCParser.SHIFT_RIGHT) {
				{
				{
				this.state = 402;
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
				this.state = 403;
				this.additiveExpression();
				}
				}
				this.state = 408;
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
		this.enterRule(_localctx, 50, LPCParser.RULE_additiveExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 409;
			this.multiplicativeExpression();
			this.state = 414;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.PLUS || _la === LPCParser.MINUS) {
				{
				{
				this.state = 410;
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
				this.state = 411;
				this.multiplicativeExpression();
				}
				}
				this.state = 416;
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
		this.enterRule(_localctx, 52, LPCParser.RULE_multiplicativeExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 417;
			this.unaryExpression();
			this.state = 422;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 55)) & ~0x1F) === 0 && ((1 << (_la - 55)) & ((1 << (LPCParser.STAR - 55)) | (1 << (LPCParser.DIV - 55)) | (1 << (LPCParser.PERCENT - 55)))) !== 0)) {
				{
				{
				this.state = 418;
				_la = this._input.LA(1);
				if (!(((((_la - 55)) & ~0x1F) === 0 && ((1 << (_la - 55)) & ((1 << (LPCParser.STAR - 55)) | (1 << (LPCParser.DIV - 55)) | (1 << (LPCParser.PERCENT - 55)))) !== 0))) {
				this._errHandler.recoverInline(this);
				} else {
					if (this._input.LA(1) === Token.EOF) {
						this.matchedEOF = true;
					}

					this._errHandler.reportMatch(this);
					this.consume();
				}
				this.state = 419;
				this.unaryExpression();
				}
				}
				this.state = 424;
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
		this.enterRule(_localctx, 54, LPCParser.RULE_unaryExpression);
		let _la: number;
		try {
			this.state = 439;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 40, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 426;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.INC || _la === LPCParser.DEC) {
					{
					this.state = 425;
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

				this.state = 428;
				this.postfixExpression();
				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 429;
				_la = this._input.LA(1);
				if (!(((((_la - 53)) & ~0x1F) === 0 && ((1 << (_la - 53)) & ((1 << (LPCParser.PLUS - 53)) | (1 << (LPCParser.MINUS - 53)) | (1 << (LPCParser.STAR - 53)) | (1 << (LPCParser.NOT - 53)))) !== 0) || _la === LPCParser.BIT_NOT)) {
				this._errHandler.recoverInline(this);
				} else {
					if (this._input.LA(1) === Token.EOF) {
						this.matchedEOF = true;
					}

					this._errHandler.reportMatch(this);
					this.consume();
				}
				this.state = 430;
				this.unaryExpression();
				}
				break;

			case 3:
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 431;
				this.match(LPCParser.CATCH);
				this.state = 432;
				this.match(LPCParser.LPAREN);
				this.state = 433;
				this.expression();
				this.state = 434;
				this.match(LPCParser.RPAREN);
				}
				break;

			case 4:
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 436;
				this.match(LPCParser.CATCH);
				this.state = 437;
				this.block();
				}
				break;

			case 5:
				this.enterOuterAlt(_localctx, 5);
				{
				this.state = 438;
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
		this.enterRule(_localctx, 56, LPCParser.RULE_castExpression);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 441;
			this.match(LPCParser.LPAREN);
			this.state = 442;
			this.castType();
			this.state = 443;
			this.match(LPCParser.RPAREN);
			this.state = 444;
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
		this.enterRule(_localctx, 58, LPCParser.RULE_castType);
		try {
			this.state = 459;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 41, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 446;
				this.match(LPCParser.KW_INT);
				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 447;
				this.match(LPCParser.KW_FLOAT);
				}
				break;

			case 3:
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 448;
				this.match(LPCParser.KW_STRING);
				}
				break;

			case 4:
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 449;
				this.match(LPCParser.KW_OBJECT);
				}
				break;

			case 5:
				this.enterOuterAlt(_localctx, 5);
				{
				this.state = 450;
				this.match(LPCParser.KW_MIXED);
				}
				break;

			case 6:
				this.enterOuterAlt(_localctx, 6);
				{
				this.state = 451;
				this.match(LPCParser.KW_MAPPING);
				}
				break;

			case 7:
				this.enterOuterAlt(_localctx, 7);
				{
				this.state = 452;
				this.match(LPCParser.KW_FUNCTION);
				}
				break;

			case 8:
				this.enterOuterAlt(_localctx, 8);
				{
				this.state = 453;
				this.match(LPCParser.KW_BUFFER);
				}
				break;

			case 9:
				this.enterOuterAlt(_localctx, 9);
				{
				this.state = 454;
				this.match(LPCParser.KW_VOID);
				}
				break;

			case 10:
				this.enterOuterAlt(_localctx, 10);
				{
				this.state = 455;
				this.match(LPCParser.KW_STRUCT);
				}
				break;

			case 11:
				this.enterOuterAlt(_localctx, 11);
				{
				this.state = 456;
				this.match(LPCParser.KW_CLASS);
				}
				break;

			case 12:
				this.enterOuterAlt(_localctx, 12);
				{
				this.state = 457;
				this.match(LPCParser.KW_CLASS);
				this.state = 458;
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
		this.enterRule(_localctx, 60, LPCParser.RULE_postfixExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 461;
			this.primary();
			this.state = 484;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 44)) & ~0x1F) === 0 && ((1 << (_la - 44)) & ((1 << (LPCParser.ARROW - 44)) | (1 << (LPCParser.DOT - 44)) | (1 << (LPCParser.INC - 44)) | (1 << (LPCParser.DEC - 44)) | (1 << (LPCParser.SCOPE - 44)) | (1 << (LPCParser.LPAREN - 44)) | (1 << (LPCParser.LBRACK - 44)))) !== 0)) {
				{
				this.state = 482;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case LPCParser.ARROW:
				case LPCParser.DOT:
				case LPCParser.SCOPE:
					{
					{
					this.state = 462;
					_la = this._input.LA(1);
					if (!(((((_la - 44)) & ~0x1F) === 0 && ((1 << (_la - 44)) & ((1 << (LPCParser.ARROW - 44)) | (1 << (LPCParser.DOT - 44)) | (1 << (LPCParser.SCOPE - 44)))) !== 0))) {
					this._errHandler.recoverInline(this);
					} else {
						if (this._input.LA(1) === Token.EOF) {
							this.matchedEOF = true;
						}

						this._errHandler.reportMatch(this);
						this.consume();
					}
					this.state = 463;
					this.match(LPCParser.Identifier);
					this.state = 469;
					this._errHandler.sync(this);
					switch ( this.interpreter.adaptivePredict(this._input, 43, this._ctx) ) {
					case 1:
						{
						this.state = 464;
						this.match(LPCParser.LPAREN);
						this.state = 466;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & ((1 << (LPCParser.KW_FUNCTION - 36)) | (1 << (LPCParser.KW_NEW - 36)) | (1 << (LPCParser.INC - 36)) | (1 << (LPCParser.DEC - 36)) | (1 << (LPCParser.PLUS - 36)) | (1 << (LPCParser.MINUS - 36)) | (1 << (LPCParser.STAR - 36)) | (1 << (LPCParser.SCOPE - 36)) | (1 << (LPCParser.LPAREN - 36)))) !== 0) || ((((_la - 69)) & ~0x1F) === 0 && ((1 << (_la - 69)) & ((1 << (LPCParser.DOLLAR - 69)) | (1 << (LPCParser.NOT - 69)) | (1 << (LPCParser.BIT_NOT - 69)) | (1 << (LPCParser.PARAMETER_PLACEHOLDER - 69)) | (1 << (LPCParser.Identifier - 69)))) !== 0)) {
							{
							this.state = 465;
							this.argumentList();
							}
						}

						this.state = 468;
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
					this.state = 471;
					this.match(LPCParser.LPAREN);
					this.state = 473;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & ((1 << (LPCParser.KW_FUNCTION - 36)) | (1 << (LPCParser.KW_NEW - 36)) | (1 << (LPCParser.INC - 36)) | (1 << (LPCParser.DEC - 36)) | (1 << (LPCParser.PLUS - 36)) | (1 << (LPCParser.MINUS - 36)) | (1 << (LPCParser.STAR - 36)) | (1 << (LPCParser.SCOPE - 36)) | (1 << (LPCParser.LPAREN - 36)))) !== 0) || ((((_la - 69)) & ~0x1F) === 0 && ((1 << (_la - 69)) & ((1 << (LPCParser.DOLLAR - 69)) | (1 << (LPCParser.NOT - 69)) | (1 << (LPCParser.BIT_NOT - 69)) | (1 << (LPCParser.PARAMETER_PLACEHOLDER - 69)) | (1 << (LPCParser.Identifier - 69)))) !== 0)) {
						{
						this.state = 472;
						this.argumentList();
						}
					}

					this.state = 475;
					this.match(LPCParser.RPAREN);
					}
					}
					break;
				case LPCParser.LBRACK:
					{
					this.state = 476;
					this.match(LPCParser.LBRACK);
					this.state = 477;
					this.sliceExpr();
					this.state = 478;
					this.match(LPCParser.RBRACK);
					}
					break;
				case LPCParser.INC:
					{
					this.state = 480;
					this.match(LPCParser.INC);
					}
					break;
				case LPCParser.DEC:
					{
					this.state = 481;
					this.match(LPCParser.DEC);
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 486;
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
		this.enterRule(_localctx, 62, LPCParser.RULE_argumentList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 487;
			this.assignmentExpression();
			this.state = 489;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === LPCParser.ELLIPSIS) {
				{
				this.state = 488;
				this.match(LPCParser.ELLIPSIS);
				}
			}

			this.state = 498;
			this._errHandler.sync(this);
			_alt = this.interpreter.adaptivePredict(this._input, 49, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 491;
					this.match(LPCParser.COMMA);
					this.state = 492;
					this.assignmentExpression();
					this.state = 494;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la === LPCParser.ELLIPSIS) {
						{
						this.state = 493;
						this.match(LPCParser.ELLIPSIS);
						}
					}

					}
					}
				}
				this.state = 500;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 49, this._ctx);
			}
			this.state = 502;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === LPCParser.COMMA) {
				{
				this.state = 501;
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
		this.enterRule(_localctx, 64, LPCParser.RULE_primary);
		let _la: number;
		try {
			this.state = 542;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 53, this._ctx) ) {
			case 1:
				_localctx = new ScopeIdentifierContext(_localctx);
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 504;
				this.match(LPCParser.SCOPE);
				this.state = 505;
				this.match(LPCParser.Identifier);
				}
				break;

			case 2:
				_localctx = new StringConcatenationContext(_localctx);
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 506;
				this.stringConcat();
				}
				break;

			case 3:
				_localctx = new ClosurePrimaryContext(_localctx);
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 507;
				this.closureExpr();
				}
				break;

			case 4:
				_localctx = new MappingLiteralExprContext(_localctx);
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 508;
				this.mappingLiteral();
				}
				break;

			case 5:
				_localctx = new ArrayDelimiterExprContext(_localctx);
				this.enterOuterAlt(_localctx, 5);
				{
				this.state = 509;
				this.arrayDelimiterLiteral();
				}
				break;

			case 6:
				_localctx = new NewExpressionPrimaryContext(_localctx);
				this.enterOuterAlt(_localctx, 6);
				{
				this.state = 510;
				this.newExpression();
				}
				break;

			case 7:
				_localctx = new AnonFunctionContext(_localctx);
				this.enterOuterAlt(_localctx, 7);
				{
				this.state = 511;
				this.match(LPCParser.KW_FUNCTION);
				this.state = 512;
				this.match(LPCParser.LPAREN);
				this.state = 514;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 30)) & ~0x1F) === 0 && ((1 << (_la - 30)) & ((1 << (LPCParser.KW_INT - 30)) | (1 << (LPCParser.KW_FLOAT - 30)) | (1 << (LPCParser.KW_STRING - 30)) | (1 << (LPCParser.KW_OBJECT - 30)) | (1 << (LPCParser.KW_MIXED - 30)) | (1 << (LPCParser.KW_MAPPING - 30)) | (1 << (LPCParser.KW_FUNCTION - 30)) | (1 << (LPCParser.KW_BUFFER - 30)) | (1 << (LPCParser.KW_VOID - 30)) | (1 << (LPCParser.KW_STRUCT - 30)) | (1 << (LPCParser.KW_CLASS - 30)) | (1 << (LPCParser.STAR - 30)))) !== 0) || _la === LPCParser.Identifier) {
					{
					this.state = 513;
					this.parameterList();
					}
				}

				this.state = 516;
				this.match(LPCParser.RPAREN);
				this.state = 517;
				this.block();
				}
				break;

			case 8:
				_localctx = new DollarCallExprContext(_localctx);
				this.enterOuterAlt(_localctx, 8);
				{
				this.state = 518;
				this.match(LPCParser.DOLLAR);
				this.state = 519;
				this.match(LPCParser.LPAREN);
				this.state = 520;
				this.expression();
				this.state = 521;
				this.match(LPCParser.RPAREN);
				}
				break;

			case 9:
				_localctx = new IdentifierPrimaryContext(_localctx);
				this.enterOuterAlt(_localctx, 9);
				{
				this.state = 523;
				this.match(LPCParser.Identifier);
				}
				break;

			case 10:
				_localctx = new ParameterPlaceholderContext(_localctx);
				this.enterOuterAlt(_localctx, 10);
				{
				this.state = 524;
				this.match(LPCParser.PARAMETER_PLACEHOLDER);
				}
				break;

			case 11:
				_localctx = new IntegerPrimaryContext(_localctx);
				this.enterOuterAlt(_localctx, 11);
				{
				this.state = 525;
				this.match(LPCParser.INTEGER);
				}
				break;

			case 12:
				_localctx = new FloatPrimaryContext(_localctx);
				this.enterOuterAlt(_localctx, 12);
				{
				this.state = 526;
				this.match(LPCParser.FLOAT);
				}
				break;

			case 13:
				_localctx = new StringPrimaryContext(_localctx);
				this.enterOuterAlt(_localctx, 13);
				{
				this.state = 527;
				this.match(LPCParser.STRING_LITERAL);
				}
				break;

			case 14:
				_localctx = new CharPrimaryContext(_localctx);
				this.enterOuterAlt(_localctx, 14);
				{
				this.state = 528;
				this.match(LPCParser.CHAR_LITERAL);
				}
				break;

			case 15:
				_localctx = new ArrayLiteralContext(_localctx);
				this.enterOuterAlt(_localctx, 15);
				{
				this.state = 529;
				this.match(LPCParser.LPAREN);
				this.state = 530;
				this.match(LPCParser.LBRACE);
				this.state = 532;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & ((1 << (LPCParser.KW_FUNCTION - 36)) | (1 << (LPCParser.KW_NEW - 36)) | (1 << (LPCParser.ELLIPSIS - 36)) | (1 << (LPCParser.INC - 36)) | (1 << (LPCParser.DEC - 36)) | (1 << (LPCParser.PLUS - 36)) | (1 << (LPCParser.MINUS - 36)) | (1 << (LPCParser.STAR - 36)) | (1 << (LPCParser.SCOPE - 36)) | (1 << (LPCParser.LPAREN - 36)))) !== 0) || ((((_la - 69)) & ~0x1F) === 0 && ((1 << (_la - 69)) & ((1 << (LPCParser.DOLLAR - 69)) | (1 << (LPCParser.NOT - 69)) | (1 << (LPCParser.BIT_NOT - 69)) | (1 << (LPCParser.PARAMETER_PLACEHOLDER - 69)) | (1 << (LPCParser.Identifier - 69)))) !== 0)) {
					{
					this.state = 531;
					this.expressionList();
					}
				}

				this.state = 534;
				this.match(LPCParser.RBRACE);
				this.state = 535;
				this.match(LPCParser.RPAREN);
				}
				break;

			case 16:
				_localctx = new ParenExprContext(_localctx);
				this.enterOuterAlt(_localctx, 16);
				{
				this.state = 536;
				this.match(LPCParser.LPAREN);
				this.state = 537;
				this.expression();
				this.state = 538;
				this.match(LPCParser.RPAREN);
				}
				break;

			case 17:
				_localctx = new RefVariableContext(_localctx);
				this.enterOuterAlt(_localctx, 17);
				{
				this.state = 540;
				this.match(LPCParser.REF);
				this.state = 541;
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
		this.enterRule(_localctx, 66, LPCParser.RULE_stringConcat);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 545;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 544;
				this.concatItem();
				}
				}
				this.state = 547;
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
		this.enterRule(_localctx, 68, LPCParser.RULE_concatItem);
		let _la: number;
		try {
			this.state = 557;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 56, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 549;
				this.match(LPCParser.STRING_LITERAL);
				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 550;
				this.match(LPCParser.Identifier);
				this.state = 551;
				this.match(LPCParser.LPAREN);
				this.state = 553;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & ((1 << (LPCParser.KW_FUNCTION - 36)) | (1 << (LPCParser.KW_NEW - 36)) | (1 << (LPCParser.INC - 36)) | (1 << (LPCParser.DEC - 36)) | (1 << (LPCParser.PLUS - 36)) | (1 << (LPCParser.MINUS - 36)) | (1 << (LPCParser.STAR - 36)) | (1 << (LPCParser.SCOPE - 36)) | (1 << (LPCParser.LPAREN - 36)))) !== 0) || ((((_la - 69)) & ~0x1F) === 0 && ((1 << (_la - 69)) & ((1 << (LPCParser.DOLLAR - 69)) | (1 << (LPCParser.NOT - 69)) | (1 << (LPCParser.BIT_NOT - 69)) | (1 << (LPCParser.PARAMETER_PLACEHOLDER - 69)) | (1 << (LPCParser.Identifier - 69)))) !== 0)) {
					{
					this.state = 552;
					this.argumentList();
					}
				}

				this.state = 555;
				this.match(LPCParser.RPAREN);
				}
				break;

			case 3:
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 556;
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
		this.enterRule(_localctx, 70, LPCParser.RULE_ifStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 559;
			this.match(LPCParser.IF);
			this.state = 560;
			this.match(LPCParser.LPAREN);
			this.state = 561;
			this.expression();
			this.state = 562;
			this.match(LPCParser.RPAREN);
			this.state = 563;
			this.statement();
			this.state = 566;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 57, this._ctx) ) {
			case 1:
				{
				this.state = 564;
				this.match(LPCParser.ELSE);
				this.state = 565;
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
		this.enterRule(_localctx, 72, LPCParser.RULE_whileStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 568;
			this.match(LPCParser.WHILE);
			this.state = 569;
			this.match(LPCParser.LPAREN);
			this.state = 570;
			this.expression();
			this.state = 571;
			this.match(LPCParser.RPAREN);
			this.state = 572;
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
		this.enterRule(_localctx, 74, LPCParser.RULE_doWhileStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 574;
			this.match(LPCParser.DO);
			this.state = 575;
			this.statement();
			this.state = 576;
			this.match(LPCParser.WHILE);
			this.state = 577;
			this.match(LPCParser.LPAREN);
			this.state = 578;
			this.expression();
			this.state = 579;
			this.match(LPCParser.RPAREN);
			this.state = 580;
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
		this.enterRule(_localctx, 76, LPCParser.RULE_forStatement);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 582;
			this.match(LPCParser.FOR);
			this.state = 583;
			this.match(LPCParser.LPAREN);
			this.state = 585;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF) | (1 << LPCParser.KW_INT) | (1 << LPCParser.KW_FLOAT))) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & ((1 << (LPCParser.KW_STRING - 32)) | (1 << (LPCParser.KW_OBJECT - 32)) | (1 << (LPCParser.KW_MIXED - 32)) | (1 << (LPCParser.KW_MAPPING - 32)) | (1 << (LPCParser.KW_FUNCTION - 32)) | (1 << (LPCParser.KW_BUFFER - 32)) | (1 << (LPCParser.KW_VOID - 32)) | (1 << (LPCParser.KW_STRUCT - 32)) | (1 << (LPCParser.KW_CLASS - 32)) | (1 << (LPCParser.KW_NEW - 32)) | (1 << (LPCParser.ELLIPSIS - 32)) | (1 << (LPCParser.INC - 32)) | (1 << (LPCParser.DEC - 32)) | (1 << (LPCParser.PLUS - 32)) | (1 << (LPCParser.MINUS - 32)) | (1 << (LPCParser.STAR - 32)) | (1 << (LPCParser.SCOPE - 32)) | (1 << (LPCParser.LPAREN - 32)))) !== 0) || ((((_la - 69)) & ~0x1F) === 0 && ((1 << (_la - 69)) & ((1 << (LPCParser.DOLLAR - 69)) | (1 << (LPCParser.NOT - 69)) | (1 << (LPCParser.BIT_NOT - 69)) | (1 << (LPCParser.MODIFIER - 69)) | (1 << (LPCParser.PARAMETER_PLACEHOLDER - 69)) | (1 << (LPCParser.Identifier - 69)))) !== 0)) {
				{
				this.state = 584;
				this.forInit();
				}
			}

			this.state = 587;
			this.match(LPCParser.SEMI);
			this.state = 589;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & ((1 << (LPCParser.KW_FUNCTION - 36)) | (1 << (LPCParser.KW_NEW - 36)) | (1 << (LPCParser.INC - 36)) | (1 << (LPCParser.DEC - 36)) | (1 << (LPCParser.PLUS - 36)) | (1 << (LPCParser.MINUS - 36)) | (1 << (LPCParser.STAR - 36)) | (1 << (LPCParser.SCOPE - 36)) | (1 << (LPCParser.LPAREN - 36)))) !== 0) || ((((_la - 69)) & ~0x1F) === 0 && ((1 << (_la - 69)) & ((1 << (LPCParser.DOLLAR - 69)) | (1 << (LPCParser.NOT - 69)) | (1 << (LPCParser.BIT_NOT - 69)) | (1 << (LPCParser.PARAMETER_PLACEHOLDER - 69)) | (1 << (LPCParser.Identifier - 69)))) !== 0)) {
				{
				this.state = 588;
				this.expression();
				}
			}

			this.state = 591;
			this.match(LPCParser.SEMI);
			this.state = 593;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & ((1 << (LPCParser.KW_FUNCTION - 36)) | (1 << (LPCParser.KW_NEW - 36)) | (1 << (LPCParser.ELLIPSIS - 36)) | (1 << (LPCParser.INC - 36)) | (1 << (LPCParser.DEC - 36)) | (1 << (LPCParser.PLUS - 36)) | (1 << (LPCParser.MINUS - 36)) | (1 << (LPCParser.STAR - 36)) | (1 << (LPCParser.SCOPE - 36)) | (1 << (LPCParser.LPAREN - 36)))) !== 0) || ((((_la - 69)) & ~0x1F) === 0 && ((1 << (_la - 69)) & ((1 << (LPCParser.DOLLAR - 69)) | (1 << (LPCParser.NOT - 69)) | (1 << (LPCParser.BIT_NOT - 69)) | (1 << (LPCParser.PARAMETER_PLACEHOLDER - 69)) | (1 << (LPCParser.Identifier - 69)))) !== 0)) {
				{
				this.state = 592;
				this.expressionList();
				}
			}

			this.state = 595;
			this.match(LPCParser.RPAREN);
			this.state = 596;
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
		this.enterRule(_localctx, 78, LPCParser.RULE_forInit);
		try {
			this.state = 600;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 61, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 598;
				this.variableDecl();
				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 599;
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
		this.enterRule(_localctx, 80, LPCParser.RULE_expressionList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 602;
			this.spreadElement();
			this.state = 607;
			this._errHandler.sync(this);
			_alt = this.interpreter.adaptivePredict(this._input, 62, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 603;
					this.match(LPCParser.COMMA);
					this.state = 604;
					this.spreadElement();
					}
					}
				}
				this.state = 609;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 62, this._ctx);
			}
			this.state = 611;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === LPCParser.COMMA) {
				{
				this.state = 610;
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
		this.enterRule(_localctx, 82, LPCParser.RULE_spreadElement);
		try {
			this.state = 616;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case LPCParser.ELLIPSIS:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 613;
				this.match(LPCParser.ELLIPSIS);
				this.state = 614;
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
				this.state = 615;
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
		this.enterRule(_localctx, 84, LPCParser.RULE_foreachStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 618;
			this.match(LPCParser.FOREACH);
			this.state = 619;
			this.match(LPCParser.LPAREN);
			this.state = 620;
			this.foreachInit();
			this.state = 621;
			this.match(LPCParser.IN);
			this.state = 622;
			this.expression();
			this.state = 623;
			this.match(LPCParser.RPAREN);
			this.state = 624;
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
		this.enterRule(_localctx, 86, LPCParser.RULE_foreachInit);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 626;
			this.foreachVar();
			this.state = 629;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === LPCParser.COMMA) {
				{
				this.state = 627;
				this.match(LPCParser.COMMA);
				this.state = 628;
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
		this.enterRule(_localctx, 88, LPCParser.RULE_foreachVar);
		let _la: number;
		try {
			this.state = 650;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 69, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 631;
				this.typeSpec();
				this.state = 633;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.REF) {
					{
					this.state = 632;
					this.match(LPCParser.REF);
					}
				}

				this.state = 638;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === LPCParser.STAR) {
					{
					{
					this.state = 635;
					this.match(LPCParser.STAR);
					}
					}
					this.state = 640;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 641;
				this.match(LPCParser.Identifier);
				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 646;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === LPCParser.STAR) {
					{
					{
					this.state = 643;
					this.match(LPCParser.STAR);
					}
					}
					this.state = 648;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 649;
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
		this.enterRule(_localctx, 90, LPCParser.RULE_switchStatement);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 652;
			this.match(LPCParser.SWITCH);
			this.state = 653;
			this.match(LPCParser.LPAREN);
			this.state = 654;
			this.expression();
			this.state = 655;
			this.match(LPCParser.RPAREN);
			this.state = 656;
			this.match(LPCParser.LBRACE);
			this.state = 660;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.CASE || _la === LPCParser.DEFAULT) {
				{
				{
				this.state = 657;
				this.switchSection();
				}
				}
				this.state = 662;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 663;
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
		this.enterRule(_localctx, 92, LPCParser.RULE_switchSection);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 665;
			this.switchLabelWithColon();
			this.state = 669;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.IF) | (1 << LPCParser.FOR) | (1 << LPCParser.WHILE) | (1 << LPCParser.DO) | (1 << LPCParser.SWITCH) | (1 << LPCParser.BREAK) | (1 << LPCParser.CONTINUE) | (1 << LPCParser.RETURN) | (1 << LPCParser.FOREACH) | (1 << LPCParser.INHERIT) | (1 << LPCParser.INCLUDE) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF) | (1 << LPCParser.KW_INT) | (1 << LPCParser.KW_FLOAT))) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & ((1 << (LPCParser.KW_STRING - 32)) | (1 << (LPCParser.KW_OBJECT - 32)) | (1 << (LPCParser.KW_MIXED - 32)) | (1 << (LPCParser.KW_MAPPING - 32)) | (1 << (LPCParser.KW_FUNCTION - 32)) | (1 << (LPCParser.KW_BUFFER - 32)) | (1 << (LPCParser.KW_VOID - 32)) | (1 << (LPCParser.KW_STRUCT - 32)) | (1 << (LPCParser.KW_CLASS - 32)) | (1 << (LPCParser.KW_NEW - 32)) | (1 << (LPCParser.INC - 32)) | (1 << (LPCParser.DEC - 32)) | (1 << (LPCParser.PLUS - 32)) | (1 << (LPCParser.MINUS - 32)) | (1 << (LPCParser.STAR - 32)) | (1 << (LPCParser.SCOPE - 32)) | (1 << (LPCParser.SEMI - 32)) | (1 << (LPCParser.LPAREN - 32)) | (1 << (LPCParser.LBRACE - 32)))) !== 0) || ((((_la - 69)) & ~0x1F) === 0 && ((1 << (_la - 69)) & ((1 << (LPCParser.DOLLAR - 69)) | (1 << (LPCParser.NOT - 69)) | (1 << (LPCParser.BIT_NOT - 69)) | (1 << (LPCParser.MODIFIER - 69)) | (1 << (LPCParser.PARAMETER_PLACEHOLDER - 69)) | (1 << (LPCParser.Identifier - 69)))) !== 0)) {
				{
				{
				this.state = 666;
				this.statement();
				}
				}
				this.state = 671;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 681;
			this._errHandler.sync(this);
			_alt = this.interpreter.adaptivePredict(this._input, 73, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 672;
					this.switchLabelWithColon();
					this.state = 676;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.IF) | (1 << LPCParser.FOR) | (1 << LPCParser.WHILE) | (1 << LPCParser.DO) | (1 << LPCParser.SWITCH) | (1 << LPCParser.BREAK) | (1 << LPCParser.CONTINUE) | (1 << LPCParser.RETURN) | (1 << LPCParser.FOREACH) | (1 << LPCParser.INHERIT) | (1 << LPCParser.INCLUDE) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF) | (1 << LPCParser.KW_INT) | (1 << LPCParser.KW_FLOAT))) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & ((1 << (LPCParser.KW_STRING - 32)) | (1 << (LPCParser.KW_OBJECT - 32)) | (1 << (LPCParser.KW_MIXED - 32)) | (1 << (LPCParser.KW_MAPPING - 32)) | (1 << (LPCParser.KW_FUNCTION - 32)) | (1 << (LPCParser.KW_BUFFER - 32)) | (1 << (LPCParser.KW_VOID - 32)) | (1 << (LPCParser.KW_STRUCT - 32)) | (1 << (LPCParser.KW_CLASS - 32)) | (1 << (LPCParser.KW_NEW - 32)) | (1 << (LPCParser.INC - 32)) | (1 << (LPCParser.DEC - 32)) | (1 << (LPCParser.PLUS - 32)) | (1 << (LPCParser.MINUS - 32)) | (1 << (LPCParser.STAR - 32)) | (1 << (LPCParser.SCOPE - 32)) | (1 << (LPCParser.SEMI - 32)) | (1 << (LPCParser.LPAREN - 32)) | (1 << (LPCParser.LBRACE - 32)))) !== 0) || ((((_la - 69)) & ~0x1F) === 0 && ((1 << (_la - 69)) & ((1 << (LPCParser.DOLLAR - 69)) | (1 << (LPCParser.NOT - 69)) | (1 << (LPCParser.BIT_NOT - 69)) | (1 << (LPCParser.MODIFIER - 69)) | (1 << (LPCParser.PARAMETER_PLACEHOLDER - 69)) | (1 << (LPCParser.Identifier - 69)))) !== 0)) {
						{
						{
						this.state = 673;
						this.statement();
						}
						}
						this.state = 678;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					}
					}
				}
				this.state = 683;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 73, this._ctx);
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
		this.enterRule(_localctx, 94, LPCParser.RULE_switchLabelWithColon);
		try {
			this.state = 690;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case LPCParser.CASE:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 684;
				this.match(LPCParser.CASE);
				this.state = 685;
				this.switchLabel();
				this.state = 686;
				this.match(LPCParser.COLON);
				}
				break;
			case LPCParser.DEFAULT:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 688;
				this.match(LPCParser.DEFAULT);
				this.state = 689;
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
		this.enterRule(_localctx, 96, LPCParser.RULE_switchLabel);
		let _la: number;
		try {
			this.state = 701;
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
				this.state = 692;
				this.expression();
				this.state = 697;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.RANGE_OP) {
					{
					this.state = 693;
					this.match(LPCParser.RANGE_OP);
					this.state = 695;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & ((1 << (LPCParser.KW_FUNCTION - 36)) | (1 << (LPCParser.KW_NEW - 36)) | (1 << (LPCParser.INC - 36)) | (1 << (LPCParser.DEC - 36)) | (1 << (LPCParser.PLUS - 36)) | (1 << (LPCParser.MINUS - 36)) | (1 << (LPCParser.STAR - 36)) | (1 << (LPCParser.SCOPE - 36)) | (1 << (LPCParser.LPAREN - 36)))) !== 0) || ((((_la - 69)) & ~0x1F) === 0 && ((1 << (_la - 69)) & ((1 << (LPCParser.DOLLAR - 69)) | (1 << (LPCParser.NOT - 69)) | (1 << (LPCParser.BIT_NOT - 69)) | (1 << (LPCParser.PARAMETER_PLACEHOLDER - 69)) | (1 << (LPCParser.Identifier - 69)))) !== 0)) {
						{
						this.state = 694;
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
				this.state = 699;
				this.match(LPCParser.RANGE_OP);
				this.state = 700;
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
		this.enterRule(_localctx, 98, LPCParser.RULE_breakStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 703;
			this.match(LPCParser.BREAK);
			this.state = 704;
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
		this.enterRule(_localctx, 100, LPCParser.RULE_continueStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 706;
			this.match(LPCParser.CONTINUE);
			this.state = 707;
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
		this.enterRule(_localctx, 102, LPCParser.RULE_returnStatement);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 709;
			this.match(LPCParser.RETURN);
			this.state = 711;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & ((1 << (LPCParser.KW_FUNCTION - 36)) | (1 << (LPCParser.KW_NEW - 36)) | (1 << (LPCParser.INC - 36)) | (1 << (LPCParser.DEC - 36)) | (1 << (LPCParser.PLUS - 36)) | (1 << (LPCParser.MINUS - 36)) | (1 << (LPCParser.STAR - 36)) | (1 << (LPCParser.SCOPE - 36)) | (1 << (LPCParser.LPAREN - 36)))) !== 0) || ((((_la - 69)) & ~0x1F) === 0 && ((1 << (_la - 69)) & ((1 << (LPCParser.DOLLAR - 69)) | (1 << (LPCParser.NOT - 69)) | (1 << (LPCParser.BIT_NOT - 69)) | (1 << (LPCParser.PARAMETER_PLACEHOLDER - 69)) | (1 << (LPCParser.Identifier - 69)))) !== 0)) {
				{
				this.state = 710;
				this.expression();
				}
			}

			this.state = 713;
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
		this.enterRule(_localctx, 104, LPCParser.RULE_closureExpr);
		let _la: number;
		try {
			this.state = 737;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 80, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 715;
				this.match(LPCParser.LPAREN);
				this.state = 716;
				this.match(LPCParser.COLON);
				this.state = 718;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & ((1 << (LPCParser.KW_FUNCTION - 36)) | (1 << (LPCParser.KW_NEW - 36)) | (1 << (LPCParser.INC - 36)) | (1 << (LPCParser.DEC - 36)) | (1 << (LPCParser.PLUS - 36)) | (1 << (LPCParser.MINUS - 36)) | (1 << (LPCParser.STAR - 36)) | (1 << (LPCParser.SCOPE - 36)) | (1 << (LPCParser.LPAREN - 36)))) !== 0) || ((((_la - 69)) & ~0x1F) === 0 && ((1 << (_la - 69)) & ((1 << (LPCParser.DOLLAR - 69)) | (1 << (LPCParser.NOT - 69)) | (1 << (LPCParser.BIT_NOT - 69)) | (1 << (LPCParser.PARAMETER_PLACEHOLDER - 69)) | (1 << (LPCParser.Identifier - 69)))) !== 0)) {
					{
					this.state = 717;
					this.expression();
					}
				}

				this.state = 720;
				this.match(LPCParser.COLON);
				this.state = 721;
				this.match(LPCParser.RPAREN);
				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 722;
				this.match(LPCParser.LPAREN);
				this.state = 723;
				this.match(LPCParser.COLON);
				this.state = 724;
				this.match(LPCParser.DOLLAR);
				this.state = 725;
				this.match(LPCParser.Identifier);
				this.state = 726;
				this.match(LPCParser.COLON);
				this.state = 727;
				this.match(LPCParser.RPAREN);
				}
				break;

			case 3:
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 728;
				this.match(LPCParser.LPAREN);
				this.state = 729;
				this.match(LPCParser.COLON);
				this.state = 730;
				this.match(LPCParser.DOLLAR);
				this.state = 731;
				this.match(LPCParser.LPAREN);
				this.state = 732;
				this.expression();
				this.state = 733;
				this.match(LPCParser.RPAREN);
				this.state = 734;
				this.match(LPCParser.COLON);
				this.state = 735;
				this.match(LPCParser.RPAREN);
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
		this.enterRule(_localctx, 106, LPCParser.RULE_inheritStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 739;
			this.match(LPCParser.INHERIT);
			this.state = 740;
			this.expression();
			this.state = 741;
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
		this.enterRule(_localctx, 108, LPCParser.RULE_includeStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 743;
			this.match(LPCParser.INCLUDE);
			this.state = 744;
			this.expression();
			this.state = 745;
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
		this.enterRule(_localctx, 110, LPCParser.RULE_macroInvoke);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 747;
			this.match(LPCParser.Identifier);
			this.state = 748;
			this.match(LPCParser.LPAREN);
			this.state = 750;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & ((1 << (LPCParser.KW_FUNCTION - 36)) | (1 << (LPCParser.KW_NEW - 36)) | (1 << (LPCParser.INC - 36)) | (1 << (LPCParser.DEC - 36)) | (1 << (LPCParser.PLUS - 36)) | (1 << (LPCParser.MINUS - 36)) | (1 << (LPCParser.STAR - 36)) | (1 << (LPCParser.SCOPE - 36)) | (1 << (LPCParser.LPAREN - 36)))) !== 0) || ((((_la - 69)) & ~0x1F) === 0 && ((1 << (_la - 69)) & ((1 << (LPCParser.DOLLAR - 69)) | (1 << (LPCParser.NOT - 69)) | (1 << (LPCParser.BIT_NOT - 69)) | (1 << (LPCParser.PARAMETER_PLACEHOLDER - 69)) | (1 << (LPCParser.Identifier - 69)))) !== 0)) {
				{
				this.state = 749;
				this.argumentList();
				}
			}

			this.state = 752;
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
		this.enterRule(_localctx, 112, LPCParser.RULE_prototypeStatement);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 757;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.MODIFIER) {
				{
				{
				this.state = 754;
				this.match(LPCParser.MODIFIER);
				}
				}
				this.state = 759;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 761;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 83, this._ctx) ) {
			case 1:
				{
				this.state = 760;
				this.typeSpec();
				}
				break;
			}
			this.state = 766;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.STAR) {
				{
				{
				this.state = 763;
				this.match(LPCParser.STAR);
				}
				}
				this.state = 768;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 769;
			this.match(LPCParser.Identifier);
			this.state = 770;
			this.match(LPCParser.LPAREN);
			this.state = 772;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 30)) & ~0x1F) === 0 && ((1 << (_la - 30)) & ((1 << (LPCParser.KW_INT - 30)) | (1 << (LPCParser.KW_FLOAT - 30)) | (1 << (LPCParser.KW_STRING - 30)) | (1 << (LPCParser.KW_OBJECT - 30)) | (1 << (LPCParser.KW_MIXED - 30)) | (1 << (LPCParser.KW_MAPPING - 30)) | (1 << (LPCParser.KW_FUNCTION - 30)) | (1 << (LPCParser.KW_BUFFER - 30)) | (1 << (LPCParser.KW_VOID - 30)) | (1 << (LPCParser.KW_STRUCT - 30)) | (1 << (LPCParser.KW_CLASS - 30)) | (1 << (LPCParser.STAR - 30)))) !== 0) || _la === LPCParser.Identifier) {
				{
				this.state = 771;
				this.parameterList();
				}
			}

			this.state = 774;
			this.match(LPCParser.RPAREN);
			this.state = 775;
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
		this.enterRule(_localctx, 114, LPCParser.RULE_mappingLiteral);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 777;
			this.match(LPCParser.LPAREN);
			this.state = 778;
			this.match(LPCParser.LBRACK);
			this.state = 780;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & ((1 << (LPCParser.KW_FUNCTION - 36)) | (1 << (LPCParser.KW_NEW - 36)) | (1 << (LPCParser.INC - 36)) | (1 << (LPCParser.DEC - 36)) | (1 << (LPCParser.PLUS - 36)) | (1 << (LPCParser.MINUS - 36)) | (1 << (LPCParser.STAR - 36)) | (1 << (LPCParser.SCOPE - 36)) | (1 << (LPCParser.LPAREN - 36)))) !== 0) || ((((_la - 69)) & ~0x1F) === 0 && ((1 << (_la - 69)) & ((1 << (LPCParser.DOLLAR - 69)) | (1 << (LPCParser.NOT - 69)) | (1 << (LPCParser.BIT_NOT - 69)) | (1 << (LPCParser.PARAMETER_PLACEHOLDER - 69)) | (1 << (LPCParser.Identifier - 69)))) !== 0)) {
				{
				this.state = 779;
				this.mappingPairList();
				}
			}

			this.state = 782;
			this.match(LPCParser.RBRACK);
			this.state = 783;
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
		this.enterRule(_localctx, 116, LPCParser.RULE_mappingPairList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 785;
			this.mappingPair();
			this.state = 790;
			this._errHandler.sync(this);
			_alt = this.interpreter.adaptivePredict(this._input, 87, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 786;
					this.match(LPCParser.COMMA);
					this.state = 787;
					this.mappingPair();
					}
					}
				}
				this.state = 792;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 87, this._ctx);
			}
			this.state = 794;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === LPCParser.COMMA) {
				{
				this.state = 793;
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
		this.enterRule(_localctx, 118, LPCParser.RULE_mappingPair);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 796;
			this.expression();
			this.state = 797;
			this.match(LPCParser.COLON);
			this.state = 798;
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
		this.enterRule(_localctx, 120, LPCParser.RULE_newExpression);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 800;
			this.match(LPCParser.KW_NEW);
			this.state = 801;
			this.match(LPCParser.LPAREN);
			this.state = 804;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 89, this._ctx) ) {
			case 1:
				{
				this.state = 802;
				this.typeSpec();
				}
				break;

			case 2:
				{
				this.state = 803;
				this.expression();
				}
				break;
			}
			this.state = 808;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === LPCParser.COMMA) {
				{
				this.state = 806;
				this.match(LPCParser.COMMA);
				this.state = 807;
				this.structInitializerList();
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
	public structInitializerList(): StructInitializerListContext {
		let _localctx: StructInitializerListContext = new StructInitializerListContext(this._ctx, this.state);
		this.enterRule(_localctx, 122, LPCParser.RULE_structInitializerList);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 812;
			this.structInitializer();
			this.state = 817;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.COMMA) {
				{
				{
				this.state = 813;
				this.match(LPCParser.COMMA);
				this.state = 814;
				this.structInitializer();
				}
				}
				this.state = 819;
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
		this.enterRule(_localctx, 124, LPCParser.RULE_structInitializer);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 820;
			this.match(LPCParser.Identifier);
			this.state = 821;
			this.match(LPCParser.COLON);
			this.state = 822;
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
		this.enterRule(_localctx, 126, LPCParser.RULE_sliceExpr);
		let _la: number;
		try {
			this.state = 851;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 98, this._ctx) ) {
			case 1:
				_localctx = new TailIndexOnlyContext(_localctx);
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 824;
				this.match(LPCParser.LT);
				this.state = 825;
				this.expression();
				}
				break;

			case 2:
				_localctx = new HeadRangeContext(_localctx);
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 826;
				this.expression();
				this.state = 827;
				this.match(LPCParser.RANGE_OP);
				this.state = 829;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.LT) {
					{
					this.state = 828;
					this.match(LPCParser.LT);
					}
				}

				this.state = 832;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & ((1 << (LPCParser.KW_FUNCTION - 36)) | (1 << (LPCParser.KW_NEW - 36)) | (1 << (LPCParser.INC - 36)) | (1 << (LPCParser.DEC - 36)) | (1 << (LPCParser.PLUS - 36)) | (1 << (LPCParser.MINUS - 36)) | (1 << (LPCParser.STAR - 36)) | (1 << (LPCParser.SCOPE - 36)) | (1 << (LPCParser.LPAREN - 36)))) !== 0) || ((((_la - 69)) & ~0x1F) === 0 && ((1 << (_la - 69)) & ((1 << (LPCParser.DOLLAR - 69)) | (1 << (LPCParser.NOT - 69)) | (1 << (LPCParser.BIT_NOT - 69)) | (1 << (LPCParser.PARAMETER_PLACEHOLDER - 69)) | (1 << (LPCParser.Identifier - 69)))) !== 0)) {
					{
					this.state = 831;
					this.expression();
					}
				}

				}
				break;

			case 3:
				_localctx = new OpenRangeContext(_localctx);
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 834;
				this.match(LPCParser.RANGE_OP);
				this.state = 836;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.LT) {
					{
					this.state = 835;
					this.match(LPCParser.LT);
					}
				}

				this.state = 839;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & ((1 << (LPCParser.KW_FUNCTION - 36)) | (1 << (LPCParser.KW_NEW - 36)) | (1 << (LPCParser.INC - 36)) | (1 << (LPCParser.DEC - 36)) | (1 << (LPCParser.PLUS - 36)) | (1 << (LPCParser.MINUS - 36)) | (1 << (LPCParser.STAR - 36)) | (1 << (LPCParser.SCOPE - 36)) | (1 << (LPCParser.LPAREN - 36)))) !== 0) || ((((_la - 69)) & ~0x1F) === 0 && ((1 << (_la - 69)) & ((1 << (LPCParser.DOLLAR - 69)) | (1 << (LPCParser.NOT - 69)) | (1 << (LPCParser.BIT_NOT - 69)) | (1 << (LPCParser.PARAMETER_PLACEHOLDER - 69)) | (1 << (LPCParser.Identifier - 69)))) !== 0)) {
					{
					this.state = 838;
					this.expression();
					}
				}

				}
				break;

			case 4:
				_localctx = new SingleIndexContext(_localctx);
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 841;
				this.expression();
				}
				break;

			case 5:
				_localctx = new TailHeadRangeContext(_localctx);
				this.enterOuterAlt(_localctx, 5);
				{
				this.state = 842;
				this.match(LPCParser.LT);
				this.state = 843;
				this.expression();
				this.state = 844;
				this.match(LPCParser.RANGE_OP);
				this.state = 846;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.LT) {
					{
					this.state = 845;
					this.match(LPCParser.LT);
					}
				}

				this.state = 849;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL) | (1 << LPCParser.ARRAY_DELIMITER_START) | (1 << LPCParser.CATCH) | (1 << LPCParser.REF))) !== 0) || ((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & ((1 << (LPCParser.KW_FUNCTION - 36)) | (1 << (LPCParser.KW_NEW - 36)) | (1 << (LPCParser.INC - 36)) | (1 << (LPCParser.DEC - 36)) | (1 << (LPCParser.PLUS - 36)) | (1 << (LPCParser.MINUS - 36)) | (1 << (LPCParser.STAR - 36)) | (1 << (LPCParser.SCOPE - 36)) | (1 << (LPCParser.LPAREN - 36)))) !== 0) || ((((_la - 69)) & ~0x1F) === 0 && ((1 << (_la - 69)) & ((1 << (LPCParser.DOLLAR - 69)) | (1 << (LPCParser.NOT - 69)) | (1 << (LPCParser.BIT_NOT - 69)) | (1 << (LPCParser.PARAMETER_PLACEHOLDER - 69)) | (1 << (LPCParser.Identifier - 69)))) !== 0)) {
					{
					this.state = 848;
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
		this.enterRule(_localctx, 128, LPCParser.RULE_arrayDelimiterLiteral);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 853;
			this.match(LPCParser.ARRAY_DELIMITER_START);
			this.state = 855;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INTEGER) | (1 << LPCParser.FLOAT) | (1 << LPCParser.CHAR_LITERAL) | (1 << LPCParser.STRING_LITERAL))) !== 0) || _la === LPCParser.Identifier) {
				{
				this.state = 854;
				this.arrayDelimiterContent();
				}
			}

			this.state = 857;
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
		this.enterRule(_localctx, 130, LPCParser.RULE_arrayDelimiterContent);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 860;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 859;
				this.arrayDelimiterElement();
				}
				}
				this.state = 862;
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
		this.enterRule(_localctx, 132, LPCParser.RULE_arrayDelimiterElement);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 864;
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
		"\x03\uC91D\uCABA\u058D\uAFBA\u4F53\u0607\uEA8B\uC241\x03\\\u0365\x04\x02" +
		"\t\x02\x04\x03\t\x03\x04\x04\t\x04\x04\x05\t\x05\x04\x06\t\x06\x04\x07" +
		"\t\x07\x04\b\t\b\x04\t\t\t\x04\n\t\n\x04\v\t\v\x04\f\t\f\x04\r\t\r\x04" +
		"\x0E\t\x0E\x04\x0F\t\x0F\x04\x10\t\x10\x04\x11\t\x11\x04\x12\t\x12\x04" +
		"\x13\t\x13\x04\x14\t\x14\x04\x15\t\x15\x04\x16\t\x16\x04\x17\t\x17\x04" +
		"\x18\t\x18\x04\x19\t\x19\x04\x1A\t\x1A\x04\x1B\t\x1B\x04\x1C\t\x1C\x04" +
		"\x1D\t\x1D\x04\x1E\t\x1E\x04\x1F\t\x1F\x04 \t \x04!\t!\x04\"\t\"\x04#" +
		"\t#\x04$\t$\x04%\t%\x04&\t&\x04\'\t\'\x04(\t(\x04)\t)\x04*\t*\x04+\t+" +
		"\x04,\t,\x04-\t-\x04.\t.\x04/\t/\x040\t0\x041\t1\x042\t2\x043\t3\x044" +
		"\t4\x045\t5\x046\t6\x047\t7\x048\t8\x049\t9\x04:\t:\x04;\t;\x04<\t<\x04" +
		"=\t=\x04>\t>\x04?\t?\x04@\t@\x04A\tA\x04B\tB\x04C\tC\x04D\tD\x03\x02\x07" +
		"\x02\x8A\n\x02\f\x02\x0E\x02\x8D\v\x02\x03\x02\x03\x02\x03\x03\x03\x03" +
		"\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03" +
		"\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03" +
		"\x03\x03\x03\x03\x05\x03\xA7\n\x03\x03\x04\x07\x04\xAA\n\x04\f\x04\x0E" +
		"\x04\xAD\v\x04\x03\x04\x05\x04\xB0\n\x04\x03\x04\x07\x04\xB3\n\x04\f\x04" +
		"\x0E\x04\xB6\v\x04\x03\x04\x03\x04\x03\x04\x05\x04\xBB\n\x04\x03\x04\x03" +
		"\x04\x03\x04\x03\x05\x07\x05\xC1\n\x05\f\x05\x0E\x05\xC4\v\x05\x03\x05" +
		"\x03\x05\x03\x05\x03\x05\x07\x05\xCA\n\x05\f\x05\x0E\x05\xCD\v\x05\x03" +
		"\x06\x07\x06\xD0\n\x06\f\x06\x0E\x06\xD3\v\x06\x03\x06\x03\x06\x03\x06" +
		"\x05\x06\xD8\n\x06\x03\x07\x03\x07\x03\x07\x07\x07\xDD\n\x07\f\x07\x0E" +
		"\x07\xE0\v\x07\x03\b\x03\b\x05\b\xE4\n\b\x03\b\x07\b\xE7\n\b\f\b\x0E\b" +
		"\xEA\v\b\x03\b\x03\b\x05\b\xEE\n\b\x03\b\x03\b\x05\b\xF2\n\b\x03\b\x07" +
		"\b\xF5\n\b\f\b\x0E\b\xF8\v\b\x03\b\x07\b\xFB\n\b\f\b\x0E\b\xFE\v\b\x03" +
		"\b\x03\b\x05\b\u0102\n\b\x05\b\u0104\n\b\x03\t\x03\t\x03\t\x03\t\x05\t" +
		"\u010A\n\t\x03\t\x03\t\x03\n\x03\n\x03\n\x03\n\x05\n\u0112\n\n\x03\n\x03" +
		"\n\x03\v\x06\v\u0117\n\v\r\v\x0E\v\u0118\x03\f\x03\f\x07\f\u011D\n\f\f" +
		"\f\x0E\f\u0120\v\f\x03\f\x03\f\x03\f\x03\r\x03\r\x03\r\x03\r\x03\r\x03" +
		"\r\x03\r\x03\r\x03\r\x03\r\x03\r\x03\r\x03\r\x03\r\x03\r\x07\r\u0134\n" +
		"\r\f\r\x0E\r\u0137\v\r\x05\r\u0139\n\r\x03\x0E\x03\x0E\x07\x0E\u013D\n" +
		"\x0E\f\x0E\x0E\x0E\u0140\v\x0E\x03\x0E\x03\x0E\x03\x0F\x03\x0F\x03\x0F" +
		"\x03\x10\x03\x10\x03\x10\x07\x10\u014A\n\x10\f\x10\x0E\x10\u014D\v\x10" +
		"\x03\x11\x03\x11\x03\x11\x05\x11\u0152\n\x11\x03\x12\x03\x12\x03\x12\x03" +
		"\x12\x03\x12\x03\x12\x05\x12\u015A\n\x12\x03\x13\x03\x13\x03\x13\x07\x13" +
		"\u015F\n\x13\f\x13\x0E\x13\u0162\v\x13\x03\x14\x03\x14\x03\x14\x07\x14" +
		"\u0167\n\x14\f\x14\x0E\x14\u016A\v\x14\x03\x15\x03\x15\x03\x15\x07\x15" +
		"\u016F\n\x15\f\x15\x0E\x15\u0172\v\x15\x03\x16\x03\x16\x03\x16\x07\x16" +
		"\u0177\n\x16\f\x16\x0E\x16\u017A\v\x16\x03\x17\x03\x17\x03\x17\x07\x17" +
		"\u017F\n\x17\f\x17\x0E\x17\u0182\v\x17\x03\x18\x03\x18\x03\x18\x07\x18" +
		"\u0187\n\x18\f\x18\x0E\x18\u018A\v\x18\x03\x19\x03\x19\x03\x19\x07\x19" +
		"\u018F\n\x19\f\x19\x0E\x19\u0192\v\x19\x03\x1A\x03\x1A\x03\x1A\x07\x1A" +
		"\u0197\n\x1A\f\x1A\x0E\x1A\u019A\v\x1A\x03\x1B\x03\x1B\x03\x1B\x07\x1B" +
		"\u019F\n\x1B\f\x1B\x0E\x1B\u01A2\v\x1B\x03\x1C\x03\x1C\x03\x1C\x07\x1C" +
		"\u01A7\n\x1C\f\x1C\x0E\x1C\u01AA\v\x1C\x03\x1D\x05\x1D\u01AD\n\x1D\x03" +
		"\x1D\x03\x1D\x03\x1D\x03\x1D\x03\x1D\x03\x1D\x03\x1D\x03\x1D\x03\x1D\x03" +
		"\x1D\x03\x1D\x05\x1D\u01BA\n\x1D\x03\x1E\x03\x1E\x03\x1E\x03\x1E\x03\x1E" +
		"\x03\x1F\x03\x1F\x03\x1F\x03\x1F\x03\x1F\x03\x1F\x03\x1F\x03\x1F\x03\x1F" +
		"\x03\x1F\x03\x1F\x03\x1F\x03\x1F\x05\x1F\u01CE\n\x1F\x03 \x03 \x03 \x03" +
		" \x03 \x05 \u01D5\n \x03 \x05 \u01D8\n \x03 \x03 \x05 \u01DC\n \x03 \x03" +
		" \x03 \x03 \x03 \x03 \x03 \x07 \u01E5\n \f \x0E \u01E8\v \x03!\x03!\x05" +
		"!\u01EC\n!\x03!\x03!\x03!\x05!\u01F1\n!\x07!\u01F3\n!\f!\x0E!\u01F6\v" +
		"!\x03!\x05!\u01F9\n!\x03\"\x03\"\x03\"\x03\"\x03\"\x03\"\x03\"\x03\"\x03" +
		"\"\x03\"\x05\"\u0205\n\"\x03\"\x03\"\x03\"\x03\"\x03\"\x03\"\x03\"\x03" +
		"\"\x03\"\x03\"\x03\"\x03\"\x03\"\x03\"\x03\"\x03\"\x05\"\u0217\n\"\x03" +
		"\"\x03\"\x03\"\x03\"\x03\"\x03\"\x03\"\x03\"\x05\"\u0221\n\"\x03#\x06" +
		"#\u0224\n#\r#\x0E#\u0225\x03$\x03$\x03$\x03$\x05$\u022C\n$\x03$\x03$\x05" +
		"$\u0230\n$\x03%\x03%\x03%\x03%\x03%\x03%\x03%\x05%\u0239\n%\x03&\x03&" +
		"\x03&\x03&\x03&\x03&\x03\'\x03\'\x03\'\x03\'\x03\'\x03\'\x03\'\x03\'\x03" +
		"(\x03(\x03(\x05(\u024C\n(\x03(\x03(\x05(\u0250\n(\x03(\x03(\x05(\u0254" +
		"\n(\x03(\x03(\x03(\x03)\x03)\x05)\u025B\n)\x03*\x03*\x03*\x07*\u0260\n" +
		"*\f*\x0E*\u0263\v*\x03*\x05*\u0266\n*\x03+\x03+\x03+\x05+\u026B\n+\x03" +
		",\x03,\x03,\x03,\x03,\x03,\x03,\x03,\x03-\x03-\x03-\x05-\u0278\n-\x03" +
		".\x03.\x05.\u027C\n.\x03.\x07.\u027F\n.\f.\x0E.\u0282\v.\x03.\x03.\x03" +
		".\x07.\u0287\n.\f.\x0E.\u028A\v.\x03.\x05.\u028D\n.\x03/\x03/\x03/\x03" +
		"/\x03/\x03/\x07/\u0295\n/\f/\x0E/\u0298\v/\x03/\x03/\x030\x030\x070\u029E" +
		"\n0\f0\x0E0\u02A1\v0\x030\x030\x070\u02A5\n0\f0\x0E0\u02A8\v0\x070\u02AA" +
		"\n0\f0\x0E0\u02AD\v0\x031\x031\x031\x031\x031\x031\x051\u02B5\n1\x032" +
		"\x032\x032\x052\u02BA\n2\x052\u02BC\n2\x032\x032\x052\u02C0\n2\x033\x03" +
		"3\x033\x034\x034\x034\x035\x035\x055\u02CA\n5\x035\x035\x036\x036\x03" +
		"6\x056\u02D1\n6\x036\x036\x036\x036\x036\x036\x036\x036\x036\x036\x03" +
		"6\x036\x036\x036\x036\x036\x036\x056\u02E4\n6\x037\x037\x037\x037\x03" +
		"8\x038\x038\x038\x039\x039\x039\x059\u02F1\n9\x039\x039\x03:\x07:\u02F6" +
		"\n:\f:\x0E:\u02F9\v:\x03:\x05:\u02FC\n:\x03:\x07:\u02FF\n:\f:\x0E:\u0302" +
		"\v:\x03:\x03:\x03:\x05:\u0307\n:\x03:\x03:\x03:\x03;\x03;\x03;\x05;\u030F" +
		"\n;\x03;\x03;\x03;\x03<\x03<\x03<\x07<\u0317\n<\f<\x0E<\u031A\v<\x03<" +
		"\x05<\u031D\n<\x03=\x03=\x03=\x03=\x03>\x03>\x03>\x03>\x05>\u0327\n>\x03" +
		">\x03>\x05>\u032B\n>\x03>\x03>\x03?\x03?\x03?\x07?\u0332\n?\f?\x0E?\u0335" +
		"\v?\x03@\x03@\x03@\x03@\x03A\x03A\x03A\x03A\x03A\x05A\u0340\nA\x03A\x05" +
		"A\u0343\nA\x03A\x03A\x05A\u0347\nA\x03A\x05A\u034A\nA\x03A\x03A\x03A\x03" +
		"A\x03A\x05A\u0351\nA\x03A\x05A\u0354\nA\x05A\u0356\nA\x03B\x03B\x05B\u035A" +
		"\nB\x03B\x03B\x03C\x06C\u035F\nC\rC\x0EC\u0360\x03D\x03D\x03D\x02\x02" +
		"\x02E\x02\x02\x04\x02\x06\x02\b\x02\n\x02\f\x02\x0E\x02\x10\x02\x12\x02" +
		"\x14\x02\x16\x02\x18\x02\x1A\x02\x1C\x02\x1E\x02 \x02\"\x02$\x02&\x02" +
		"(\x02*\x02,\x02.\x020\x022\x024\x026\x028\x02:\x02<\x02>\x02@\x02B\x02" +
		"D\x02F\x02H\x02J\x02L\x02N\x02P\x02R\x02T\x02V\x02X\x02Z\x02\\\x02^\x02" +
		"`\x02b\x02d\x02f\x02h\x02j\x02l\x02n\x02p\x02r\x02t\x02v\x02x\x02z\x02" +
		"|\x02~\x02\x80\x02\x82\x02\x84\x02\x86\x02\x02\f\x05\x0226NNXY\x03\x02" +
		"LM\x03\x02HK\x03\x02RS\x03\x0278\x03\x029;\x03\x0201\x05\x0279OOWW\x04" +
		"\x02./<<\x04\x02\x03\x06\\\\\x02\u03C8\x02\x8B\x03\x02\x02\x02\x04\xA6" +
		"\x03\x02\x02\x02\x06\xAB\x03\x02\x02\x02\b\xC2\x03\x02\x02\x02\n\xD1\x03" +
		"\x02\x02\x02\f\xD9\x03\x02\x02\x02\x0E\u0103\x03\x02\x02\x02\x10\u0105" +
		"\x03\x02\x02\x02\x12\u010D\x03\x02\x02\x02\x14\u0116\x03\x02\x02\x02\x16" +
		"\u011A\x03\x02\x02\x02\x18\u0138\x03\x02\x02\x02\x1A\u013A\x03\x02\x02" +
		"\x02\x1C\u0143\x03\x02\x02\x02\x1E\u0146\x03\x02\x02\x02 \u014E\x03\x02" +
		"\x02\x02\"\u0153\x03\x02\x02\x02$\u015B\x03\x02\x02\x02&\u0163\x03\x02" +
		"\x02\x02(\u016B\x03\x02\x02\x02*\u0173\x03\x02\x02\x02,\u017B\x03\x02" +
		"\x02\x02.\u0183\x03\x02\x02\x020\u018B\x03\x02\x02\x022\u0193\x03\x02" +
		"\x02\x024\u019B\x03\x02\x02\x026\u01A3\x03\x02\x02\x028\u01B9\x03\x02" +
		"\x02\x02:\u01BB\x03\x02\x02\x02<\u01CD\x03\x02\x02\x02>\u01CF\x03\x02" +
		"\x02\x02@\u01E9\x03\x02\x02\x02B\u0220\x03\x02\x02\x02D\u0223\x03\x02" +
		"\x02\x02F\u022F\x03\x02\x02\x02H\u0231\x03\x02\x02\x02J\u023A\x03\x02" +
		"\x02\x02L\u0240\x03\x02\x02\x02N\u0248\x03\x02\x02\x02P\u025A\x03\x02" +
		"\x02\x02R\u025C\x03\x02\x02\x02T\u026A\x03\x02\x02\x02V\u026C\x03\x02" +
		"\x02\x02X\u0274\x03\x02\x02\x02Z\u028C\x03\x02\x02\x02\\\u028E\x03\x02" +
		"\x02\x02^\u029B\x03\x02\x02\x02`\u02B4\x03\x02\x02\x02b\u02BF\x03\x02" +
		"\x02\x02d\u02C1\x03\x02\x02\x02f\u02C4\x03\x02\x02\x02h\u02C7\x03\x02" +
		"\x02\x02j\u02E3\x03\x02\x02\x02l\u02E5\x03\x02\x02\x02n\u02E9\x03\x02" +
		"\x02\x02p\u02ED\x03\x02\x02\x02r\u02F7\x03\x02\x02\x02t\u030B\x03\x02" +
		"\x02\x02v\u0313\x03\x02\x02\x02x\u031E\x03\x02\x02\x02z\u0322\x03\x02" +
		"\x02\x02|\u032E\x03\x02\x02\x02~\u0336\x03\x02\x02\x02\x80\u0355\x03\x02" +
		"\x02\x02\x82\u0357\x03\x02\x02\x02\x84\u035E\x03\x02\x02\x02\x86\u0362" +
		"\x03\x02\x02\x02\x88\x8A\x05\x04\x03\x02\x89\x88\x03\x02\x02\x02\x8A\x8D" +
		"\x03\x02\x02\x02\x8B\x89\x03\x02\x02\x02\x8B\x8C\x03\x02\x02\x02\x8C\x8E" +
		"\x03\x02\x02\x02\x8D\x8B\x03\x02\x02\x02\x8E\x8F\x07\x02\x02\x03\x8F\x03" +
		"\x03\x02\x02\x02\x90\xA7\x05\x06\x04\x02\x91\x92\x05\b\x05\x02\x92\x93" +
		"\x07=\x02\x02\x93\xA7\x03\x02\x02\x02\x94\xA7\x05\x10\t\x02\x95\xA7\x05" +
		"\x12\n\x02\x96\xA7\x05p9\x02\x97\xA7\x05H%\x02\x98\xA7\x05J&\x02\x99\xA7" +
		"\x05N(\x02\x9A\xA7\x05L\'\x02\x9B\xA7\x05V,\x02\x9C\xA7\x05\\/\x02\x9D" +
		"\xA7\x05d3\x02\x9E\xA7\x05f4\x02\x9F\xA7\x05h5\x02\xA0\xA7\x05l7\x02\xA1" +
		"\xA7\x05n8\x02\xA2\xA7\x05\x1A\x0E\x02\xA3\xA7\x05\x1C\x0F\x02\xA4\xA7" +
		"\x05r:\x02\xA5\xA7\x07=\x02\x02\xA6\x90\x03\x02\x02\x02\xA6\x91\x03\x02" +
		"\x02\x02\xA6\x94\x03\x02\x02\x02\xA6\x95\x03\x02\x02\x02\xA6\x96\x03\x02" +
		"\x02\x02\xA6\x97\x03\x02\x02\x02\xA6\x98\x03\x02\x02\x02\xA6\x99\x03\x02" +
		"\x02\x02\xA6\x9A\x03\x02\x02\x02\xA6\x9B\x03\x02\x02\x02\xA6\x9C\x03\x02" +
		"\x02\x02\xA6\x9D\x03\x02\x02\x02\xA6\x9E\x03\x02\x02\x02\xA6\x9F\x03\x02" +
		"\x02\x02\xA6\xA0\x03\x02\x02\x02\xA6\xA1\x03\x02\x02\x02\xA6\xA2\x03\x02" +
		"\x02\x02\xA6\xA3\x03\x02\x02\x02\xA6\xA4\x03\x02\x02\x02\xA6\xA5\x03\x02" +
		"\x02\x02\xA7\x05\x03\x02\x02\x02\xA8\xAA\x07Z\x02\x02\xA9\xA8\x03\x02" +
		"\x02\x02\xAA\xAD\x03\x02\x02\x02\xAB\xA9\x03\x02\x02\x02\xAB\xAC\x03\x02" +
		"\x02\x02\xAC\xAF\x03\x02\x02\x02\xAD\xAB\x03\x02\x02\x02\xAE\xB0\x05\x18" +
		"\r\x02\xAF\xAE\x03\x02\x02\x02\xAF\xB0\x03\x02\x02\x02\xB0\xB4\x03\x02" +
		"\x02\x02\xB1\xB3\x079\x02\x02\xB2\xB1\x03\x02\x02\x02\xB3\xB6\x03\x02" +
		"\x02\x02\xB4\xB2\x03\x02\x02\x02\xB4\xB5\x03\x02\x02\x02\xB5\xB7\x03\x02" +
		"\x02\x02\xB6\xB4\x03\x02\x02\x02\xB7\xB8\x07\\\x02\x02\xB8\xBA\x07?\x02" +
		"\x02\xB9\xBB\x05\f\x07\x02\xBA\xB9\x03\x02\x02\x02\xBA\xBB\x03\x02\x02" +
		"\x02\xBB\xBC\x03\x02\x02\x02\xBC\xBD\x07@\x02\x02\xBD\xBE\x05\x1A\x0E" +
		"\x02\xBE\x07\x03\x02\x02\x02\xBF\xC1\x07Z\x02\x02\xC0\xBF\x03\x02\x02" +
		"\x02\xC1\xC4\x03\x02\x02\x02\xC2\xC0\x03\x02\x02\x02\xC2\xC3\x03\x02\x02" +
		"\x02\xC3\xC5\x03\x02\x02\x02\xC4\xC2\x03\x02\x02\x02\xC5\xC6\x05\x18\r" +
		"\x02\xC6\xCB\x05\n\x06\x02\xC7\xC8\x07>\x02\x02\xC8\xCA\x05\n\x06\x02" +
		"\xC9\xC7\x03\x02\x02\x02\xCA\xCD\x03\x02\x02\x02\xCB\xC9\x03\x02\x02\x02" +
		"\xCB\xCC\x03\x02\x02\x02\xCC\t\x03\x02\x02\x02\xCD\xCB\x03\x02\x02\x02" +
		"\xCE\xD0\x079\x02\x02\xCF\xCE\x03\x02\x02\x02\xD0\xD3\x03\x02\x02\x02" +
		"\xD1\xCF\x03\x02\x02\x02\xD1\xD2\x03\x02\x02\x02\xD2\xD4\x03\x02\x02\x02" +
		"\xD3\xD1\x03\x02\x02\x02\xD4\xD7\x07\\\x02\x02\xD5\xD6\x07N\x02\x02\xD6" +
		"\xD8\x05\x1E\x10\x02\xD7\xD5\x03\x02\x02\x02\xD7\xD8\x03\x02\x02\x02\xD8" +
		"\v\x03\x02\x02\x02\xD9\xDE\x05\x0E\b\x02\xDA\xDB\x07>\x02\x02\xDB\xDD" +
		"\x05\x0E\b\x02\xDC\xDA\x03\x02\x02\x02\xDD\xE0\x03\x02\x02\x02\xDE\xDC" +
		"\x03\x02\x02\x02\xDE\xDF\x03\x02\x02\x02\xDF\r\x03\x02\x02\x02\xE0\xDE" +
		"\x03\x02\x02\x02\xE1\xE3\x05\x18\r\x02\xE2\xE4\x07\x1E\x02\x02\xE3\xE2" +
		"\x03\x02\x02\x02\xE3\xE4\x03\x02\x02\x02\xE4\xE8\x03\x02\x02\x02\xE5\xE7" +
		"\x079\x02\x02\xE6\xE5\x03\x02\x02\x02\xE7\xEA\x03\x02\x02\x02\xE8\xE6" +
		"\x03\x02\x02\x02\xE8\xE9\x03\x02\x02\x02\xE9\xEB\x03\x02\x02\x02\xEA\xE8" +
		"\x03\x02\x02\x02\xEB\xED\x07\\\x02\x02\xEC\xEE\x07,\x02\x02\xED\xEC\x03" +
		"\x02\x02\x02\xED\xEE\x03\x02\x02\x02\xEE\u0104\x03\x02\x02\x02\xEF\xF1" +
		"\x05\x18\r\x02\xF0\xF2\x07\x1E\x02\x02\xF1\xF0\x03\x02\x02\x02\xF1\xF2" +
		"\x03\x02\x02\x02\xF2\xF6\x03\x02\x02\x02\xF3\xF5\x079\x02\x02\xF4\xF3" +
		"\x03\x02\x02\x02\xF5\xF8\x03\x02\x02\x02\xF6\xF4\x03\x02\x02\x02\xF6\xF7" +
		"\x03\x02\x02\x02\xF7\u0104\x03\x02\x02\x02\xF8\xF6\x03\x02\x02\x02\xF9" +
		"\xFB\x079\x02\x02\xFA\xF9\x03\x02\x02\x02\xFB\xFE\x03\x02\x02\x02\xFC" +
		"\xFA\x03\x02\x02\x02\xFC\xFD\x03\x02\x02\x02\xFD\xFF\x03\x02\x02\x02\xFE" +
		"\xFC\x03\x02\x02\x02\xFF\u0101\x07\\\x02\x02\u0100\u0102\x07,\x02\x02" +
		"\u0101\u0100\x03\x02\x02\x02\u0101\u0102\x03\x02\x02\x02\u0102\u0104\x03" +
		"\x02\x02\x02\u0103\xE1\x03\x02\x02\x02\u0103\xEF\x03\x02\x02\x02\u0103" +
		"\xFC\x03\x02\x02\x02\u0104\x0F\x03\x02\x02\x02\u0105\u0106\x07)\x02\x02" +
		"\u0106\u0107\x07\\\x02\x02\u0107\u0109\x07A\x02\x02\u0108\u010A\x05\x14" +
		"\v\x02\u0109\u0108\x03\x02\x02\x02\u0109\u010A\x03\x02\x02\x02\u010A\u010B" +
		"\x03\x02\x02\x02\u010B\u010C\x07B\x02\x02\u010C\x11\x03\x02\x02\x02\u010D" +
		"\u010E\x07*\x02\x02\u010E\u010F\x07\\\x02\x02\u010F\u0111\x07A\x02\x02" +
		"\u0110\u0112\x05\x14\v\x02\u0111\u0110\x03\x02\x02\x02\u0111\u0112\x03" +
		"\x02\x02\x02\u0112\u0113\x03\x02\x02\x02\u0113\u0114\x07B\x02\x02\u0114" +
		"\x13\x03\x02\x02\x02\u0115\u0117\x05\x16\f\x02\u0116\u0115\x03\x02\x02" +
		"\x02\u0117\u0118\x03\x02\x02\x02\u0118\u0116\x03\x02\x02\x02\u0118\u0119" +
		"\x03\x02\x02\x02\u0119\x15\x03\x02\x02\x02\u011A\u011E\x05\x18\r\x02\u011B" +
		"\u011D\x079\x02\x02\u011C\u011B\x03\x02\x02\x02\u011D\u0120\x03\x02\x02" +
		"\x02\u011E\u011C\x03\x02\x02\x02\u011E\u011F\x03\x02\x02\x02\u011F\u0121" +
		"\x03\x02\x02\x02\u0120\u011E\x03\x02\x02\x02\u0121\u0122\x07\\\x02\x02" +
		"\u0122\u0123\x07=\x02\x02\u0123\x17\x03\x02\x02\x02\u0124\u0139\x07 \x02" +
		"\x02\u0125\u0139\x07!\x02\x02\u0126\u0139\x07\"\x02\x02\u0127\u0139\x07" +
		"#\x02\x02\u0128\u0139\x07$\x02\x02\u0129\u0139\x07%\x02\x02\u012A\u0139" +
		"\x07&\x02\x02\u012B\u0139\x07\'\x02\x02\u012C\u0139\x07(\x02\x02\u012D" +
		"\u0139\x07)\x02\x02\u012E\u0139\x07*\x02\x02\u012F\u0130\x07*\x02\x02" +
		"\u0130\u0139\x07\\\x02\x02\u0131\u0135\x07\\\x02\x02\u0132\u0134\x079" +
		"\x02\x02\u0133\u0132\x03\x02\x02\x02\u0134\u0137\x03\x02\x02\x02\u0135" +
		"\u0133\x03\x02\x02\x02\u0135\u0136\x03\x02\x02\x02\u0136\u0139\x03\x02" +
		"\x02\x02\u0137\u0135\x03\x02\x02\x02\u0138\u0124\x03\x02\x02\x02\u0138" +
		"\u0125\x03\x02\x02\x02\u0138\u0126\x03\x02\x02\x02\u0138\u0127\x03\x02" +
		"\x02\x02\u0138\u0128\x03\x02\x02\x02\u0138\u0129\x03\x02\x02\x02\u0138" +
		"\u012A\x03\x02\x02\x02\u0138\u012B\x03\x02\x02\x02\u0138\u012C\x03\x02" +
		"\x02\x02\u0138\u012D\x03\x02\x02\x02\u0138\u012E\x03\x02\x02\x02\u0138" +
		"\u012F\x03\x02\x02\x02\u0138\u0131\x03\x02\x02\x02\u0139\x19\x03\x02\x02" +
		"\x02\u013A\u013E\x07A\x02\x02\u013B\u013D\x05\x04\x03\x02\u013C\u013B" +
		"\x03\x02\x02\x02\u013D\u0140\x03\x02\x02\x02\u013E\u013C\x03\x02\x02\x02" +
		"\u013E\u013F\x03\x02\x02\x02\u013F\u0141\x03\x02\x02\x02\u0140\u013E\x03" +
		"\x02\x02\x02\u0141\u0142\x07B\x02\x02\u0142\x1B\x03\x02\x02\x02\u0143" +
		"\u0144\x05\x1E\x10\x02\u0144\u0145\x07=\x02\x02\u0145\x1D\x03\x02\x02" +
		"\x02\u0146\u014B\x05 \x11\x02\u0147\u0148\x07>\x02\x02\u0148\u014A\x05" +
		" \x11\x02\u0149\u0147\x03\x02\x02\x02\u014A\u014D\x03\x02\x02\x02\u014B" +
		"\u0149\x03\x02\x02\x02\u014B\u014C\x03\x02\x02\x02\u014C\x1F\x03\x02\x02" +
		"\x02\u014D\u014B\x03\x02\x02\x02\u014E\u0151\x05\"\x12\x02\u014F\u0150" +
		"\t\x02\x02\x02\u0150\u0152\x05\x1E\x10\x02\u0151\u014F\x03\x02\x02\x02" +
		"\u0151\u0152\x03\x02\x02\x02\u0152!\x03\x02\x02\x02\u0153\u0159\x05$\x13" +
		"\x02\u0154\u0155\x07E\x02\x02\u0155\u0156\x05\x1E\x10\x02\u0156\u0157" +
		"\x07F\x02\x02\u0157\u0158\x05\"\x12\x02\u0158\u015A\x03\x02\x02\x02\u0159" +
		"\u0154\x03\x02\x02\x02\u0159\u015A\x03\x02\x02\x02\u015A#\x03\x02\x02" +
		"\x02\u015B\u0160\x05&\x14\x02\u015C\u015D\x07Q\x02\x02\u015D\u015F\x05" +
		"&\x14\x02\u015E\u015C\x03\x02\x02\x02\u015F\u0162\x03\x02\x02\x02\u0160" +
		"\u015E\x03\x02\x02\x02\u0160\u0161\x03\x02\x02\x02\u0161%\x03\x02\x02" +
		"\x02\u0162\u0160\x03\x02\x02\x02\u0163\u0168\x05(\x15\x02\u0164\u0165" +
		"\x07P\x02\x02\u0165\u0167\x05(\x15\x02\u0166\u0164\x03\x02\x02\x02\u0167" +
		"\u016A\x03\x02\x02\x02\u0168\u0166\x03\x02\x02\x02\u0168\u0169\x03\x02" +
		"\x02\x02\u0169\'\x03\x02\x02\x02\u016A\u0168\x03\x02\x02\x02\u016B\u0170" +
		"\x05*\x16\x02\u016C\u016D\x07U\x02\x02\u016D\u016F\x05*\x16\x02\u016E" +
		"\u016C\x03\x02\x02\x02\u016F\u0172\x03\x02\x02\x02\u0170\u016E\x03\x02" +
		"\x02\x02\u0170\u0171\x03\x02\x02\x02\u0171)\x03\x02\x02\x02\u0172\u0170" +
		"\x03\x02\x02\x02\u0173\u0178\x05,\x17\x02\u0174\u0175\x07V\x02\x02\u0175" +
		"\u0177\x05,\x17\x02\u0176\u0174\x03\x02\x02\x02\u0177\u017A\x03\x02\x02" +
		"\x02\u0178\u0176\x03\x02\x02\x02\u0178\u0179\x03\x02\x02\x02\u0179+\x03" +
		"\x02\x02\x02\u017A\u0178\x03\x02\x02\x02\u017B\u0180\x05.\x18\x02\u017C" +
		"\u017D\x07T\x02\x02\u017D\u017F\x05.\x18\x02\u017E\u017C\x03\x02\x02\x02" +
		"\u017F\u0182\x03\x02\x02\x02\u0180\u017E\x03\x02\x02\x02\u0180\u0181\x03" +
		"\x02\x02\x02\u0181-\x03\x02\x02\x02\u0182\u0180\x03\x02\x02\x02\u0183" +
		"\u0188\x050\x19\x02\u0184\u0185\t\x03\x02\x02\u0185\u0187\x050\x19\x02" +
		"\u0186\u0184\x03\x02\x02\x02\u0187\u018A\x03\x02\x02\x02\u0188\u0186\x03" +
		"\x02\x02\x02\u0188\u0189\x03\x02\x02\x02\u0189/\x03\x02\x02\x02\u018A" +
		"\u0188\x03\x02\x02\x02\u018B\u0190\x052\x1A\x02\u018C\u018D\t\x04\x02" +
		"\x02\u018D\u018F\x052\x1A\x02\u018E\u018C\x03\x02\x02\x02\u018F\u0192" +
		"\x03\x02\x02\x02\u0190\u018E\x03\x02\x02\x02\u0190\u0191\x03\x02\x02\x02" +
		"\u01911\x03\x02\x02\x02\u0192\u0190\x03\x02\x02\x02\u0193\u0198\x054\x1B" +
		"\x02\u0194\u0195\t\x05\x02\x02\u0195\u0197\x054\x1B\x02\u0196\u0194\x03" +
		"\x02\x02\x02\u0197\u019A\x03\x02\x02\x02\u0198\u0196\x03\x02\x02\x02\u0198" +
		"\u0199\x03\x02\x02\x02\u01993\x03\x02\x02\x02\u019A\u0198\x03\x02\x02" +
		"\x02\u019B\u01A0\x056\x1C\x02\u019C\u019D\t\x06\x02\x02\u019D\u019F\x05" +
		"6\x1C\x02\u019E\u019C\x03\x02\x02\x02\u019F\u01A2\x03\x02\x02\x02\u01A0" +
		"\u019E\x03\x02\x02\x02\u01A0\u01A1\x03\x02\x02\x02\u01A15\x03\x02\x02" +
		"\x02\u01A2\u01A0\x03\x02\x02\x02\u01A3\u01A8\x058\x1D\x02\u01A4\u01A5" +
		"\t\x07\x02\x02\u01A5\u01A7\x058\x1D\x02\u01A6\u01A4\x03\x02\x02\x02\u01A7" +
		"\u01AA\x03\x02\x02\x02\u01A8\u01A6\x03\x02\x02\x02\u01A8\u01A9\x03\x02" +
		"\x02\x02\u01A97\x03\x02\x02\x02\u01AA\u01A8\x03\x02\x02\x02\u01AB\u01AD" +
		"\t\b\x02\x02\u01AC\u01AB\x03\x02\x02\x02\u01AC\u01AD\x03\x02\x02\x02\u01AD" +
		"\u01AE\x03\x02\x02\x02\u01AE\u01BA\x05> \x02\u01AF\u01B0\t\t\x02\x02\u01B0" +
		"\u01BA\x058\x1D\x02\u01B1\u01B2\x07\x1D\x02\x02\u01B2\u01B3\x07?\x02\x02" +
		"\u01B3\u01B4\x05\x1E\x10\x02\u01B4\u01B5\x07@\x02\x02\u01B5\u01BA\x03" +
		"\x02\x02\x02\u01B6\u01B7\x07\x1D\x02\x02\u01B7\u01BA\x05\x1A\x0E\x02\u01B8" +
		"\u01BA\x05:\x1E\x02\u01B9\u01AC\x03\x02\x02\x02\u01B9\u01AF\x03\x02\x02" +
		"\x02\u01B9\u01B1\x03\x02\x02\x02\u01B9\u01B6\x03\x02\x02\x02\u01B9\u01B8" +
		"\x03\x02\x02\x02\u01BA9\x03\x02\x02\x02\u01BB\u01BC\x07?\x02\x02\u01BC" +
		"\u01BD\x05<\x1F\x02\u01BD\u01BE\x07@\x02\x02\u01BE\u01BF\x058\x1D\x02" +
		"\u01BF;\x03\x02\x02\x02\u01C0\u01CE\x07 \x02\x02\u01C1\u01CE\x07!\x02" +
		"\x02\u01C2\u01CE\x07\"\x02\x02\u01C3\u01CE\x07#\x02\x02\u01C4\u01CE\x07" +
		"$\x02\x02\u01C5\u01CE\x07%\x02\x02\u01C6\u01CE\x07&\x02\x02\u01C7\u01CE" +
		"\x07\'\x02\x02\u01C8\u01CE\x07(\x02\x02\u01C9\u01CE\x07)\x02\x02\u01CA" +
		"\u01CE\x07*\x02\x02\u01CB\u01CC\x07*\x02\x02\u01CC\u01CE\x07\\\x02\x02" +
		"\u01CD\u01C0\x03\x02\x02\x02\u01CD\u01C1\x03\x02\x02\x02\u01CD\u01C2\x03" +
		"\x02\x02\x02\u01CD\u01C3\x03\x02\x02\x02\u01CD\u01C4\x03\x02\x02\x02\u01CD" +
		"\u01C5\x03\x02\x02\x02\u01CD\u01C6\x03\x02\x02\x02\u01CD\u01C7\x03\x02" +
		"\x02\x02\u01CD\u01C8\x03\x02\x02\x02\u01CD\u01C9\x03\x02\x02\x02\u01CD" +
		"\u01CA\x03\x02\x02\x02\u01CD\u01CB\x03\x02\x02\x02\u01CE=\x03\x02\x02" +
		"\x02\u01CF\u01E6\x05B\"\x02\u01D0\u01D1\t\n\x02\x02\u01D1\u01D7\x07\\" +
		"\x02\x02\u01D2\u01D4\x07?\x02\x02\u01D3\u01D5\x05@!\x02\u01D4\u01D3\x03" +
		"\x02\x02\x02\u01D4\u01D5\x03\x02\x02\x02\u01D5\u01D6\x03\x02";
	private static readonly _serializedATNSegment1: string =
		"\x02\x02\u01D6\u01D8\x07@\x02\x02\u01D7\u01D2\x03\x02\x02\x02\u01D7\u01D8" +
		"\x03\x02\x02\x02\u01D8\u01E5\x03\x02\x02\x02\u01D9\u01DB\x07?\x02\x02" +
		"\u01DA\u01DC\x05@!\x02\u01DB\u01DA\x03\x02\x02\x02\u01DB\u01DC\x03\x02" +
		"\x02\x02\u01DC\u01DD\x03\x02\x02\x02\u01DD\u01E5\x07@\x02\x02\u01DE\u01DF" +
		"\x07C\x02\x02\u01DF\u01E0\x05\x80A\x02\u01E0\u01E1\x07D\x02\x02\u01E1" +
		"\u01E5\x03\x02\x02\x02\u01E2\u01E5\x070\x02\x02\u01E3\u01E5\x071\x02\x02" +
		"\u01E4\u01D0\x03\x02\x02\x02\u01E4\u01D9\x03\x02\x02\x02\u01E4\u01DE\x03" +
		"\x02\x02\x02\u01E4\u01E2\x03\x02\x02\x02\u01E4\u01E3\x03\x02\x02\x02\u01E5" +
		"\u01E8\x03\x02\x02\x02\u01E6\u01E4\x03\x02\x02\x02\u01E6\u01E7\x03\x02" +
		"\x02\x02\u01E7?\x03\x02\x02\x02\u01E8\u01E6\x03\x02\x02\x02\u01E9\u01EB" +
		"\x05 \x11\x02\u01EA\u01EC\x07,\x02\x02\u01EB\u01EA\x03\x02\x02\x02\u01EB" +
		"\u01EC\x03\x02\x02\x02\u01EC\u01F4\x03\x02\x02\x02\u01ED\u01EE\x07>\x02" +
		"\x02\u01EE\u01F0\x05 \x11\x02\u01EF\u01F1\x07,\x02\x02\u01F0\u01EF\x03" +
		"\x02\x02\x02\u01F0\u01F1\x03\x02\x02\x02\u01F1\u01F3\x03\x02\x02\x02\u01F2" +
		"\u01ED\x03\x02\x02\x02\u01F3\u01F6\x03\x02\x02\x02\u01F4\u01F2\x03\x02" +
		"\x02\x02\u01F4\u01F5\x03\x02\x02\x02\u01F5\u01F8\x03\x02\x02\x02\u01F6" +
		"\u01F4\x03\x02\x02\x02\u01F7\u01F9\x07>\x02\x02\u01F8\u01F7\x03\x02\x02" +
		"\x02\u01F8\u01F9\x03\x02\x02\x02\u01F9A\x03\x02\x02\x02\u01FA\u01FB\x07" +
		"<\x02\x02\u01FB\u0221\x07\\\x02\x02\u01FC\u0221\x05D#\x02\u01FD\u0221" +
		"\x05j6\x02\u01FE\u0221\x05t;\x02\u01FF\u0221\x05\x82B\x02\u0200\u0221" +
		"\x05z>\x02\u0201\u0202\x07&\x02\x02\u0202\u0204\x07?\x02\x02\u0203\u0205" +
		"\x05\f\x07\x02\u0204\u0203\x03\x02\x02\x02\u0204\u0205\x03\x02\x02\x02" +
		"\u0205\u0206\x03\x02\x02\x02\u0206\u0207\x07@\x02\x02\u0207\u0221\x05" +
		"\x1A\x0E\x02\u0208\u0209\x07G\x02\x02\u0209\u020A\x07?\x02\x02\u020A\u020B" +
		"\x05\x1E\x10\x02\u020B\u020C\x07@\x02\x02\u020C\u0221\x03\x02\x02\x02" +
		"\u020D\u0221\x07\\\x02\x02\u020E\u0221\x07[\x02\x02\u020F\u0221\x07\x03" +
		"\x02\x02\u0210\u0221\x07\x04\x02\x02\u0211\u0221\x07\x06\x02\x02\u0212" +
		"\u0221\x07\x05\x02\x02\u0213\u0214\x07?\x02\x02\u0214\u0216\x07A\x02\x02" +
		"\u0215\u0217\x05R*\x02\u0216\u0215\x03\x02\x02\x02\u0216\u0217\x03\x02" +
		"\x02\x02\u0217\u0218\x03\x02\x02\x02\u0218\u0219\x07B\x02\x02\u0219\u0221" +
		"\x07@\x02\x02\u021A\u021B\x07?\x02\x02\u021B\u021C\x05\x1E\x10\x02\u021C" +
		"\u021D\x07@\x02\x02\u021D\u0221\x03\x02\x02\x02\u021E\u021F\x07\x1E\x02" +
		"\x02\u021F\u0221\x07\\\x02\x02\u0220\u01FA\x03\x02\x02\x02\u0220\u01FC" +
		"\x03\x02\x02\x02\u0220\u01FD\x03\x02\x02\x02\u0220\u01FE\x03\x02\x02\x02" +
		"\u0220\u01FF\x03\x02\x02\x02\u0220\u0200\x03\x02\x02\x02\u0220\u0201\x03" +
		"\x02\x02\x02\u0220\u0208\x03\x02\x02\x02\u0220\u020D\x03\x02\x02\x02\u0220" +
		"\u020E\x03\x02\x02\x02\u0220\u020F\x03\x02\x02\x02\u0220\u0210\x03\x02" +
		"\x02\x02\u0220\u0211\x03\x02\x02\x02\u0220\u0212\x03\x02\x02\x02\u0220" +
		"\u0213\x03\x02\x02\x02\u0220\u021A\x03\x02\x02\x02\u0220\u021E\x03\x02" +
		"\x02\x02\u0221C\x03\x02\x02\x02\u0222\u0224\x05F$\x02\u0223\u0222\x03" +
		"\x02\x02\x02\u0224\u0225\x03\x02\x02\x02\u0225\u0223\x03\x02\x02\x02\u0225" +
		"\u0226\x03\x02\x02\x02\u0226E\x03\x02\x02\x02\u0227\u0230\x07\x06\x02" +
		"\x02\u0228\u0229\x07\\\x02\x02\u0229\u022B\x07?\x02\x02\u022A\u022C\x05" +
		"@!\x02\u022B\u022A\x03\x02\x02\x02\u022B\u022C\x03\x02\x02\x02\u022C\u022D" +
		"\x03\x02\x02\x02\u022D\u0230\x07@\x02\x02\u022E\u0230\x07\\\x02\x02\u022F" +
		"\u0227\x03\x02\x02\x02\u022F\u0228\x03\x02\x02\x02\u022F\u022E\x03\x02" +
		"\x02\x02\u0230G\x03\x02\x02\x02\u0231\u0232\x07\x0F\x02\x02\u0232\u0233" +
		"\x07?\x02\x02\u0233\u0234\x05\x1E\x10\x02\u0234\u0235\x07@\x02\x02\u0235" +
		"\u0238\x05\x04\x03\x02\u0236\u0237\x07\x10\x02\x02\u0237\u0239\x05\x04" +
		"\x03\x02\u0238\u0236\x03\x02\x02\x02\u0238\u0239\x03\x02\x02\x02\u0239" +
		"I\x03\x02\x02\x02\u023A\u023B\x07\x12\x02\x02\u023B\u023C\x07?\x02\x02" +
		"\u023C\u023D\x05\x1E\x10\x02\u023D\u023E\x07@\x02\x02\u023E\u023F\x05" +
		"\x04\x03\x02\u023FK\x03\x02\x02\x02\u0240\u0241\x07\x13\x02\x02\u0241" +
		"\u0242\x05\x04\x03\x02\u0242\u0243\x07\x12\x02\x02\u0243\u0244\x07?\x02" +
		"\x02\u0244\u0245\x05\x1E\x10\x02\u0245\u0246\x07@\x02\x02\u0246\u0247" +
		"\x07=\x02\x02\u0247M\x03\x02\x02\x02\u0248\u0249\x07\x11\x02\x02\u0249" +
		"\u024B\x07?\x02\x02\u024A\u024C\x05P)\x02\u024B\u024A\x03\x02\x02\x02" +
		"\u024B\u024C\x03\x02\x02\x02\u024C\u024D\x03\x02\x02\x02\u024D\u024F\x07" +
		"=\x02\x02\u024E\u0250\x05\x1E\x10\x02\u024F\u024E\x03\x02\x02\x02\u024F" +
		"\u0250\x03\x02\x02\x02\u0250\u0251\x03\x02\x02\x02\u0251\u0253\x07=\x02" +
		"\x02\u0252\u0254\x05R*\x02\u0253\u0252\x03\x02\x02\x02\u0253\u0254\x03" +
		"\x02\x02\x02\u0254\u0255\x03\x02\x02\x02\u0255\u0256\x07@\x02\x02\u0256" +
		"\u0257\x05\x04\x03\x02\u0257O\x03\x02\x02\x02\u0258\u025B\x05\b\x05\x02" +
		"\u0259\u025B\x05R*\x02\u025A\u0258\x03\x02\x02\x02\u025A\u0259\x03\x02" +
		"\x02\x02\u025BQ\x03\x02\x02\x02\u025C\u0261\x05T+\x02\u025D\u025E\x07" +
		">\x02\x02\u025E\u0260\x05T+\x02\u025F\u025D\x03\x02\x02\x02\u0260\u0263" +
		"\x03\x02\x02\x02\u0261\u025F\x03\x02\x02\x02\u0261\u0262\x03\x02\x02\x02" +
		"\u0262\u0265\x03\x02\x02\x02\u0263\u0261\x03\x02\x02\x02\u0264\u0266\x07" +
		">\x02\x02\u0265\u0264\x03\x02\x02\x02\u0265\u0266\x03\x02\x02\x02\u0266" +
		"S\x03\x02\x02\x02\u0267\u0268\x07,\x02\x02\u0268\u026B\x05 \x11\x02\u0269" +
		"\u026B\x05 \x11\x02\u026A\u0267\x03\x02\x02\x02\u026A\u0269\x03\x02\x02" +
		"\x02\u026BU\x03\x02\x02\x02\u026C\u026D\x07\x1A\x02\x02\u026D\u026E\x07" +
		"?\x02\x02\u026E\u026F\x05X-\x02\u026F\u0270\x07\x1F\x02\x02\u0270\u0271" +
		"\x05\x1E\x10\x02\u0271\u0272\x07@\x02\x02\u0272\u0273\x05\x04\x03\x02" +
		"\u0273W\x03\x02\x02\x02\u0274\u0277\x05Z.\x02\u0275\u0276\x07>\x02\x02" +
		"\u0276\u0278\x05Z.\x02\u0277\u0275\x03\x02\x02\x02\u0277\u0278\x03\x02" +
		"\x02\x02\u0278Y\x03\x02\x02\x02\u0279\u027B\x05\x18\r\x02\u027A\u027C" +
		"\x07\x1E\x02\x02\u027B\u027A\x03\x02\x02\x02\u027B\u027C\x03\x02\x02\x02" +
		"\u027C\u0280\x03\x02\x02\x02\u027D\u027F\x079\x02\x02\u027E\u027D\x03" +
		"\x02\x02\x02\u027F\u0282\x03\x02\x02\x02\u0280\u027E\x03\x02\x02\x02\u0280" +
		"\u0281\x03\x02\x02\x02\u0281\u0283\x03\x02\x02\x02\u0282\u0280\x03\x02" +
		"\x02\x02\u0283\u0284\x07\\\x02\x02\u0284\u028D\x03\x02\x02\x02\u0285\u0287" +
		"\x079\x02\x02\u0286\u0285\x03\x02\x02\x02\u0287\u028A\x03\x02\x02\x02" +
		"\u0288\u0286\x03\x02\x02\x02\u0288\u0289\x03\x02\x02\x02\u0289\u028B\x03" +
		"\x02\x02\x02\u028A\u0288\x03\x02\x02\x02\u028B\u028D\x07\\\x02\x02\u028C" +
		"\u0279\x03\x02\x02\x02\u028C\u0288\x03\x02\x02\x02\u028D[\x03\x02\x02" +
		"\x02\u028E\u028F\x07\x14\x02\x02\u028F\u0290\x07?\x02\x02\u0290\u0291" +
		"\x05\x1E\x10\x02\u0291\u0292\x07@\x02\x02\u0292\u0296\x07A\x02\x02\u0293" +
		"\u0295\x05^0\x02\u0294\u0293\x03\x02\x02\x02\u0295\u0298\x03\x02\x02\x02" +
		"\u0296\u0294\x03\x02\x02\x02\u0296\u0297\x03\x02\x02\x02\u0297\u0299\x03" +
		"\x02\x02\x02\u0298\u0296\x03\x02\x02\x02\u0299\u029A\x07B\x02\x02\u029A" +
		"]\x03\x02\x02\x02\u029B\u029F\x05`1\x02\u029C\u029E\x05\x04\x03\x02\u029D" +
		"\u029C\x03\x02\x02\x02\u029E\u02A1\x03\x02\x02\x02\u029F\u029D\x03\x02" +
		"\x02\x02\u029F\u02A0\x03\x02\x02\x02\u02A0\u02AB\x03\x02\x02\x02\u02A1" +
		"\u029F\x03\x02\x02\x02\u02A2\u02A6\x05`1\x02\u02A3\u02A5\x05\x04\x03\x02" +
		"\u02A4\u02A3\x03\x02\x02\x02\u02A5\u02A8\x03\x02\x02\x02\u02A6\u02A4\x03" +
		"\x02\x02\x02\u02A6\u02A7\x03\x02\x02\x02\u02A7\u02AA\x03\x02\x02\x02\u02A8" +
		"\u02A6\x03\x02\x02\x02\u02A9\u02A2\x03\x02\x02\x02\u02AA\u02AD\x03\x02" +
		"\x02\x02\u02AB\u02A9\x03\x02\x02\x02\u02AB\u02AC\x03\x02\x02\x02\u02AC" +
		"_\x03\x02\x02\x02\u02AD\u02AB\x03\x02\x02\x02\u02AE\u02AF\x07\x15\x02" +
		"\x02\u02AF\u02B0\x05b2\x02\u02B0\u02B1\x07F\x02\x02\u02B1\u02B5\x03\x02" +
		"\x02\x02\u02B2\u02B3\x07\x16\x02\x02\u02B3\u02B5\x07F\x02\x02\u02B4\u02AE" +
		"\x03\x02\x02\x02\u02B4\u02B2\x03\x02\x02\x02\u02B5a\x03\x02\x02\x02\u02B6" +
		"\u02BB\x05\x1E\x10\x02\u02B7\u02B9\x07-\x02\x02\u02B8\u02BA\x05\x1E\x10" +
		"\x02\u02B9\u02B8\x03\x02\x02\x02\u02B9\u02BA\x03\x02\x02\x02\u02BA\u02BC" +
		"\x03\x02\x02\x02\u02BB\u02B7\x03\x02\x02\x02\u02BB\u02BC\x03\x02\x02\x02" +
		"\u02BC\u02C0\x03\x02\x02\x02\u02BD\u02BE\x07-\x02\x02\u02BE\u02C0\x05" +
		"\x1E\x10\x02\u02BF\u02B6\x03\x02\x02\x02\u02BF\u02BD\x03\x02\x02\x02\u02C0" +
		"c\x03\x02\x02\x02\u02C1\u02C2\x07\x17\x02\x02\u02C2\u02C3\x07=\x02\x02" +
		"\u02C3e\x03\x02\x02\x02\u02C4\u02C5\x07\x18\x02\x02\u02C5\u02C6\x07=\x02" +
		"\x02\u02C6g\x03\x02\x02\x02\u02C7\u02C9\x07\x19\x02\x02\u02C8\u02CA\x05" +
		"\x1E\x10\x02\u02C9\u02C8\x03\x02\x02\x02\u02C9\u02CA\x03\x02\x02\x02\u02CA" +
		"\u02CB\x03\x02\x02\x02\u02CB\u02CC\x07=\x02\x02\u02CCi\x03\x02\x02\x02" +
		"\u02CD\u02CE\x07?\x02\x02\u02CE\u02D0\x07F\x02\x02\u02CF\u02D1\x05\x1E" +
		"\x10\x02\u02D0\u02CF\x03\x02\x02\x02\u02D0\u02D1\x03\x02\x02\x02\u02D1" +
		"\u02D2\x03\x02\x02\x02\u02D2\u02D3\x07F\x02\x02\u02D3\u02E4\x07@\x02\x02" +
		"\u02D4\u02D5\x07?\x02\x02\u02D5\u02D6\x07F\x02\x02\u02D6\u02D7\x07G\x02" +
		"\x02\u02D7\u02D8\x07\\\x02\x02\u02D8\u02D9\x07F\x02\x02\u02D9\u02E4\x07" +
		"@\x02\x02\u02DA\u02DB\x07?\x02\x02\u02DB\u02DC\x07F\x02\x02\u02DC\u02DD" +
		"\x07G\x02\x02\u02DD\u02DE\x07?\x02\x02\u02DE\u02DF\x05\x1E\x10\x02\u02DF" +
		"\u02E0\x07@\x02\x02\u02E0\u02E1\x07F\x02\x02\u02E1\u02E2\x07@\x02\x02" +
		"\u02E2\u02E4\x03\x02\x02\x02\u02E3\u02CD\x03\x02\x02\x02\u02E3\u02D4\x03" +
		"\x02\x02\x02\u02E3\u02DA\x03\x02\x02\x02\u02E4k\x03\x02\x02\x02\u02E5" +
		"\u02E6\x07\x1B\x02\x02\u02E6\u02E7\x05\x1E\x10\x02\u02E7\u02E8\x07=\x02" +
		"\x02\u02E8m\x03\x02\x02\x02\u02E9\u02EA\x07\x1C\x02\x02\u02EA\u02EB\x05" +
		"\x1E\x10\x02\u02EB\u02EC\x07=\x02\x02\u02ECo\x03\x02\x02\x02\u02ED\u02EE" +
		"\x07\\\x02\x02\u02EE\u02F0\x07?\x02\x02\u02EF\u02F1\x05@!\x02\u02F0\u02EF" +
		"\x03\x02\x02\x02\u02F0\u02F1\x03\x02\x02\x02\u02F1\u02F2\x03\x02\x02\x02" +
		"\u02F2\u02F3\x07@\x02\x02\u02F3q\x03\x02\x02\x02\u02F4\u02F6\x07Z\x02" +
		"\x02\u02F5\u02F4\x03\x02\x02\x02\u02F6\u02F9\x03\x02\x02\x02\u02F7\u02F5" +
		"\x03\x02\x02\x02\u02F7\u02F8\x03\x02\x02\x02\u02F8\u02FB\x03\x02\x02\x02" +
		"\u02F9\u02F7\x03\x02\x02\x02\u02FA\u02FC\x05\x18\r\x02\u02FB\u02FA\x03" +
		"\x02\x02\x02\u02FB\u02FC\x03\x02\x02\x02\u02FC\u0300\x03\x02\x02\x02\u02FD" +
		"\u02FF\x079\x02\x02\u02FE\u02FD\x03\x02\x02\x02\u02FF\u0302\x03\x02\x02" +
		"\x02\u0300\u02FE\x03\x02\x02\x02\u0300\u0301\x03\x02\x02\x02\u0301\u0303" +
		"\x03\x02\x02\x02\u0302\u0300\x03\x02\x02\x02\u0303\u0304\x07\\\x02\x02" +
		"\u0304\u0306\x07?\x02\x02\u0305\u0307\x05\f\x07\x02\u0306\u0305\x03\x02" +
		"\x02\x02\u0306\u0307\x03\x02\x02\x02\u0307\u0308\x03\x02\x02\x02\u0308" +
		"\u0309\x07@\x02\x02\u0309\u030A\x07=\x02\x02\u030As\x03\x02\x02\x02\u030B" +
		"\u030C\x07?\x02\x02\u030C\u030E\x07C\x02\x02\u030D\u030F\x05v<\x02\u030E" +
		"\u030D\x03\x02\x02\x02\u030E\u030F\x03\x02\x02\x02\u030F\u0310\x03\x02" +
		"\x02\x02\u0310\u0311\x07D\x02\x02\u0311\u0312\x07@\x02\x02\u0312u\x03" +
		"\x02\x02\x02\u0313\u0318\x05x=\x02\u0314\u0315\x07>\x02\x02\u0315\u0317" +
		"\x05x=\x02\u0316\u0314\x03\x02\x02\x02\u0317\u031A\x03\x02\x02\x02\u0318" +
		"\u0316\x03\x02\x02\x02\u0318\u0319\x03\x02\x02\x02\u0319\u031C\x03\x02" +
		"\x02\x02\u031A\u0318\x03\x02\x02\x02\u031B\u031D\x07>\x02\x02\u031C\u031B" +
		"\x03\x02\x02\x02\u031C\u031D\x03\x02\x02\x02\u031Dw\x03\x02\x02\x02\u031E" +
		"\u031F\x05\x1E\x10\x02\u031F\u0320\x07F\x02\x02\u0320\u0321\x05\x1E\x10" +
		"\x02\u0321y\x03\x02\x02\x02\u0322\u0323\x07+\x02\x02\u0323\u0326\x07?" +
		"\x02\x02\u0324\u0327\x05\x18\r\x02\u0325\u0327\x05\x1E\x10\x02\u0326\u0324" +
		"\x03\x02\x02\x02\u0326\u0325\x03\x02\x02\x02\u0327\u032A\x03\x02\x02\x02" +
		"\u0328\u0329\x07>\x02\x02\u0329\u032B\x05|?\x02\u032A\u0328\x03\x02\x02" +
		"\x02\u032A\u032B\x03\x02\x02\x02\u032B\u032C\x03\x02\x02\x02\u032C\u032D" +
		"\x07@\x02\x02\u032D{\x03\x02\x02\x02\u032E\u0333\x05~@\x02\u032F\u0330" +
		"\x07>\x02\x02\u0330\u0332\x05~@\x02\u0331\u032F\x03\x02\x02\x02\u0332" +
		"\u0335\x03\x02\x02\x02\u0333\u0331\x03\x02\x02\x02\u0333\u0334\x03\x02" +
		"\x02\x02\u0334}\x03\x02\x02\x02\u0335\u0333\x03\x02\x02\x02\u0336\u0337" +
		"\x07\\\x02\x02\u0337\u0338\x07F\x02\x02\u0338\u0339\x05\x1E\x10\x02\u0339" +
		"\x7F\x03\x02\x02\x02\u033A\u033B\x07I\x02\x02\u033B\u0356\x05\x1E\x10" +
		"\x02\u033C\u033D\x05\x1E\x10\x02\u033D\u033F\x07-\x02\x02\u033E\u0340" +
		"\x07I\x02\x02\u033F\u033E\x03\x02\x02\x02\u033F\u0340\x03\x02\x02\x02" +
		"\u0340\u0342\x03\x02\x02\x02\u0341\u0343\x05\x1E\x10\x02\u0342\u0341\x03" +
		"\x02\x02\x02\u0342\u0343\x03\x02\x02\x02\u0343\u0356\x03\x02\x02\x02\u0344" +
		"\u0346\x07-\x02\x02\u0345\u0347\x07I\x02\x02\u0346\u0345\x03\x02\x02\x02" +
		"\u0346\u0347\x03\x02\x02\x02\u0347\u0349\x03\x02\x02\x02\u0348\u034A\x05" +
		"\x1E\x10\x02\u0349\u0348\x03\x02\x02\x02\u0349\u034A\x03\x02\x02\x02\u034A" +
		"\u0356\x03\x02\x02\x02\u034B\u0356\x05\x1E\x10\x02\u034C\u034D\x07I\x02" +
		"\x02\u034D\u034E\x05\x1E\x10\x02\u034E\u0350\x07-\x02\x02\u034F\u0351" +
		"\x07I\x02\x02\u0350\u034F\x03\x02\x02\x02\u0350\u0351\x03\x02\x02\x02" +
		"\u0351\u0353\x03\x02\x02\x02\u0352\u0354\x05\x1E\x10\x02\u0353\u0352\x03" +
		"\x02\x02\x02\u0353\u0354\x03\x02\x02\x02\u0354\u0356\x03\x02\x02\x02\u0355" +
		"\u033A\x03\x02\x02\x02\u0355\u033C\x03\x02\x02\x02\u0355\u0344\x03\x02" +
		"\x02\x02\u0355\u034B\x03\x02\x02\x02\u0355\u034C\x03\x02\x02\x02\u0356" +
		"\x81\x03\x02\x02\x02\u0357\u0359\x07\b\x02\x02\u0358\u035A\x05\x84C\x02" +
		"\u0359\u0358\x03\x02\x02\x02\u0359\u035A\x03\x02\x02\x02\u035A\u035B\x03" +
		"\x02\x02\x02\u035B\u035C\x07\n\x02\x02\u035C\x83\x03\x02\x02\x02\u035D" +
		"\u035F\x05\x86D\x02\u035E\u035D\x03\x02\x02\x02\u035F\u0360\x03\x02\x02" +
		"\x02\u0360\u035E\x03\x02\x02\x02\u0360\u0361\x03\x02\x02\x02\u0361\x85" +
		"\x03\x02\x02\x02\u0362\u0363\t\v\x02\x02\u0363\x87\x03\x02\x02\x02g\x8B" +
		"\xA6\xAB\xAF\xB4\xBA\xC2\xCB\xD1\xD7\xDE\xE3\xE8\xED\xF1\xF6\xFC\u0101" +
		"\u0103\u0109\u0111\u0118\u011E\u0135\u0138\u013E\u014B\u0151\u0159\u0160" +
		"\u0168\u0170\u0178\u0180\u0188\u0190\u0198\u01A0\u01A8\u01AC\u01B9\u01CD" +
		"\u01D4\u01D7\u01DB\u01E4\u01E6\u01EB\u01F0\u01F4\u01F8\u0204\u0216\u0220" +
		"\u0225\u022B\u022F\u0238\u024B\u024F\u0253\u025A\u0261\u0265\u026A\u0277" +
		"\u027B\u0280\u0288\u028C\u0296\u029F\u02A6\u02AB\u02B4\u02B9\u02BB\u02BF" +
		"\u02C9\u02D0\u02E3\u02F0\u02F7\u02FB\u0300\u0306\u030E\u0318\u031C\u0326" +
		"\u032A\u0333\u033F\u0342\u0346\u0349\u0350\u0353\u0355\u0359\u0360";
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
	public LPAREN(): TerminalNode[];
	public LPAREN(i: number): TerminalNode;
	public LPAREN(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.LPAREN);
		} else {
			return this.getToken(LPCParser.LPAREN, i);
		}
	}
	public COLON(): TerminalNode[];
	public COLON(i: number): TerminalNode;
	public COLON(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.COLON);
		} else {
			return this.getToken(LPCParser.COLON, i);
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
	public expression(): ExpressionContext | undefined {
		return this.tryGetRuleContext(0, ExpressionContext);
	}
	public DOLLAR(): TerminalNode | undefined { return this.tryGetToken(LPCParser.DOLLAR, 0); }
	public Identifier(): TerminalNode | undefined { return this.tryGetToken(LPCParser.Identifier, 0); }
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


