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

import { LPCParserListener } from "./LPCParserListener";
import { LPCParserVisitor } from "./LPCParserVisitor";


export class LPCParser extends Parser {
	public static readonly IF = 1;
	public static readonly ELSE = 2;
	public static readonly WHILE = 3;
	public static readonly FOR = 4;
	public static readonly DO = 5;
	public static readonly SWITCH = 6;
	public static readonly CASE = 7;
	public static readonly DEFAULT = 8;
	public static readonly BREAK = 9;
	public static readonly CONTINUE = 10;
	public static readonly RETURN = 11;
	public static readonly FOREACH = 12;
	public static readonly IN = 13;
	public static readonly FALLTHROUGH = 14;
	public static readonly INHERIT = 15;
	public static readonly EFUN = 16;
	public static readonly NEW = 17;
	public static readonly CATCH = 18;
	public static readonly SSCANF = 19;
	public static readonly PARSE_COMMAND = 20;
	public static readonly TIME_EXPRESSION = 21;
	public static readonly PRIVATE = 22;
	public static readonly PROTECTED = 23;
	public static readonly PUBLIC = 24;
	public static readonly STATIC = 25;
	public static readonly NOMASK = 26;
	public static readonly VARARGS = 27;
	public static readonly NOSAVE = 28;
	public static readonly REF = 29;
	public static readonly VOID = 30;
	public static readonly INT = 31;
	public static readonly STRING = 32;
	public static readonly OBJECT = 33;
	public static readonly ARRAY = 34;
	public static readonly MAPPING = 35;
	public static readonly FLOAT = 36;
	public static readonly BUFFER = 37;
	public static readonly MIXED = 38;
	public static readonly FUNCTION = 39;
	public static readonly CLASS = 40;
	public static readonly STRUCT = 41;
	public static readonly CLOSURE = 42;
	public static readonly PP_BODY = 43;
	public static readonly PP_INCLUDE = 44;
	public static readonly PP_DEFINE = 45;
	public static readonly PP_IFDEF = 46;
	public static readonly PP_IFNDEF = 47;
	public static readonly PP_IF = 48;
	public static readonly PP_ELSE = 49;
	public static readonly PP_ENDIF = 50;
	public static readonly PP_ERROR = 51;
	public static readonly PP_PRAGMA = 52;
	public static readonly LBRACK = 53;
	public static readonly RBRACK = 54;
	public static readonly LBRACE = 55;
	public static readonly RBRACE = 56;
	public static readonly SEMICOLON = 57;
	public static readonly LPAREN = 58;
	public static readonly RPAREN = 59;
	public static readonly ASSIGN = 60;
	public static readonly PLUS_ASSIGN = 61;
	public static readonly MINUS_ASSIGN = 62;
	public static readonly STAR_ASSIGN = 63;
	public static readonly DIV_ASSIGN = 64;
	public static readonly MOD_ASSIGN = 65;
	public static readonly AND_ASSIGN = 66;
	public static readonly OR_ASSIGN = 67;
	public static readonly XOR_ASSIGN = 68;
	public static readonly LSHIFT_ASSIGN = 69;
	public static readonly RSHIFT_ASSIGN = 70;
	public static readonly COMMA = 71;
	public static readonly QUESTION = 72;
	public static readonly COLON = 73;
	public static readonly SCOPE_RESOLUTION = 74;
	public static readonly RANGE = 75;
	public static readonly ELLIPSIS = 76;
	public static readonly ARROW = 77;
	public static readonly PLUS = 78;
	public static readonly MINUS = 79;
	public static readonly STAR = 80;
	public static readonly DIV = 81;
	public static readonly MOD = 82;
	public static readonly INC = 83;
	public static readonly DEC = 84;
	public static readonly EQ = 85;
	public static readonly NEQ = 86;
	public static readonly GT = 87;
	public static readonly LT = 88;
	public static readonly GTE = 89;
	public static readonly LTE = 90;
	public static readonly NOT = 91;
	public static readonly AND = 92;
	public static readonly OR = 93;
	public static readonly BITWISE_AND = 94;
	public static readonly BITWISE_OR = 95;
	public static readonly BITWISE_XOR = 96;
	public static readonly BITWISE_NOT = 97;
	public static readonly LSHIFT = 98;
	public static readonly RSHIFT = 99;
	public static readonly STRING_LITERAL = 100;
	public static readonly LESS_THAN_PATH = 101;
	public static readonly NUMBER = 102;
	public static readonly IDENTIFIER = 103;
	public static readonly WHITESPACE = 104;
	public static readonly LINE_COMMENT = 105;
	public static readonly BLOCK_COMMENT = 106;
	public static readonly PP_BODY_WS = 107;
	public static readonly PP_ID_WS = 108;
	public static readonly PP_ID_NL = 109;
	public static readonly PP_ID_BODY_WS = 110;
	public static readonly PP_ID_BODY_NL = 111;
	public static readonly RULE_program = 0;
	public static readonly RULE_declaration = 1;
	public static readonly RULE_statement = 2;
	public static readonly RULE_block = 3;
	public static readonly RULE_expressionStatement = 4;
	public static readonly RULE_variableDeclaration = 5;
	public static readonly RULE_variableDeclarator = 6;
	public static readonly RULE_functionDeclaration = 7;
	public static readonly RULE_parameterList = 8;
	public static readonly RULE_parameter = 9;
	public static readonly RULE_inheritStatement = 10;
	public static readonly RULE_preprocessorDirective = 11;
	public static readonly RULE_ppInclude = 12;
	public static readonly RULE_ppDefine = 13;
	public static readonly RULE_ppConditional = 14;
	public static readonly RULE_ppError = 15;
	public static readonly RULE_ppPragma = 16;
	public static readonly RULE_ppBody = 17;
	public static readonly RULE_expression = 18;
	public static readonly RULE_castExpression = 19;
	public static readonly RULE_closureExpression = 20;
	public static readonly RULE_assignmentOperator = 21;
	public static readonly RULE_primary = 22;
	public static readonly RULE_argumentList = 23;
	public static readonly RULE_expressionOrEllipsis = 24;
	public static readonly RULE_literal = 25;
	public static readonly RULE_mappingLiteral = 26;
	public static readonly RULE_mappingElementList = 27;
	public static readonly RULE_mappingElement = 28;
	public static readonly RULE_arrayLiteral = 29;
	public static readonly RULE_expressionList = 30;
	public static readonly RULE_typeSpecifier = 31;
	public static readonly RULE_typeName = 32;
	public static readonly RULE_modifier = 33;
	public static readonly RULE_identifier = 34;
	public static readonly RULE_keywordIdentifier = 35;
	public static readonly RULE_ifStatement = 36;
	public static readonly RULE_forStatement = 37;
	public static readonly RULE_whileStatement = 38;
	public static readonly RULE_doWhileStatement = 39;
	public static readonly RULE_foreachStatement = 40;
	public static readonly RULE_switchStatement = 41;
	public static readonly RULE_switchBlock = 42;
	public static readonly RULE_caseClause = 43;
	public static readonly RULE_defaultClause = 44;
	public static readonly RULE_returnStatement = 45;
	public static readonly RULE_breakStatement = 46;
	public static readonly RULE_continueStatement = 47;
	public static readonly RULE_fallthroughStatement = 48;
	// tslint:disable:no-trailing-whitespace
	public static readonly ruleNames: string[] = [
		"program", "declaration", "statement", "block", "expressionStatement", 
		"variableDeclaration", "variableDeclarator", "functionDeclaration", "parameterList", 
		"parameter", "inheritStatement", "preprocessorDirective", "ppInclude", 
		"ppDefine", "ppConditional", "ppError", "ppPragma", "ppBody", "expression", 
		"castExpression", "closureExpression", "assignmentOperator", "primary", 
		"argumentList", "expressionOrEllipsis", "literal", "mappingLiteral", "mappingElementList", 
		"mappingElement", "arrayLiteral", "expressionList", "typeSpecifier", "typeName", 
		"modifier", "identifier", "keywordIdentifier", "ifStatement", "forStatement", 
		"whileStatement", "doWhileStatement", "foreachStatement", "switchStatement", 
		"switchBlock", "caseClause", "defaultClause", "returnStatement", "breakStatement", 
		"continueStatement", "fallthroughStatement",
	];

	private static readonly _LITERAL_NAMES: Array<string | undefined> = [
		undefined, "'if'", "'else'", "'while'", "'for'", "'do'", "'switch'", "'case'", 
		"'default'", "'break'", "'continue'", "'return'", "'foreach'", "'in'", 
		"'fallthrough'", "'inherit'", "'efun'", "'new'", "'catch'", "'sscanf'", 
		"'parse_command'", "'time_expression'", "'private'", "'protected'", "'public'", 
		"'static'", "'nomask'", "'varargs'", "'nosave'", "'ref'", "'void'", "'int'", 
		"'string'", "'object'", "'array'", "'mapping'", "'float'", "'buffer'", 
		"'mixed'", "'function'", "'class'", "'struct'", "'closure'", undefined, 
		"'#include'", "'#define'", "'#ifdef'", "'#ifndef'", "'#if'", "'#else'", 
		"'#endif'", "'#error'", "'#pragma'", "'['", "']'", "'{'", "'}'", "';'", 
		"'('", "')'", "'='", "'+='", "'-='", "'*='", "'/='", "'%='", "'&='", "'|='", 
		"'^='", "'<<='", "'>>='", "','", "'?'", "':'", "'::'", "'..'", "'...'", 
		"'->'", "'+'", "'-'", "'*'", "'/'", "'%'", "'++'", "'--'", "'=='", "'!='", 
		"'>'", "'<'", "'>='", "'<='", "'!'", "'&&'", "'||'", "'&'", "'|'", "'^'", 
		"'~'", "'<<'", "'>>'",
	];
	private static readonly _SYMBOLIC_NAMES: Array<string | undefined> = [
		undefined, "IF", "ELSE", "WHILE", "FOR", "DO", "SWITCH", "CASE", "DEFAULT", 
		"BREAK", "CONTINUE", "RETURN", "FOREACH", "IN", "FALLTHROUGH", "INHERIT", 
		"EFUN", "NEW", "CATCH", "SSCANF", "PARSE_COMMAND", "TIME_EXPRESSION", 
		"PRIVATE", "PROTECTED", "PUBLIC", "STATIC", "NOMASK", "VARARGS", "NOSAVE", 
		"REF", "VOID", "INT", "STRING", "OBJECT", "ARRAY", "MAPPING", "FLOAT", 
		"BUFFER", "MIXED", "FUNCTION", "CLASS", "STRUCT", "CLOSURE", "PP_BODY", 
		"PP_INCLUDE", "PP_DEFINE", "PP_IFDEF", "PP_IFNDEF", "PP_IF", "PP_ELSE", 
		"PP_ENDIF", "PP_ERROR", "PP_PRAGMA", "LBRACK", "RBRACK", "LBRACE", "RBRACE", 
		"SEMICOLON", "LPAREN", "RPAREN", "ASSIGN", "PLUS_ASSIGN", "MINUS_ASSIGN", 
		"STAR_ASSIGN", "DIV_ASSIGN", "MOD_ASSIGN", "AND_ASSIGN", "OR_ASSIGN", 
		"XOR_ASSIGN", "LSHIFT_ASSIGN", "RSHIFT_ASSIGN", "COMMA", "QUESTION", "COLON", 
		"SCOPE_RESOLUTION", "RANGE", "ELLIPSIS", "ARROW", "PLUS", "MINUS", "STAR", 
		"DIV", "MOD", "INC", "DEC", "EQ", "NEQ", "GT", "LT", "GTE", "LTE", "NOT", 
		"AND", "OR", "BITWISE_AND", "BITWISE_OR", "BITWISE_XOR", "BITWISE_NOT", 
		"LSHIFT", "RSHIFT", "STRING_LITERAL", "LESS_THAN_PATH", "NUMBER", "IDENTIFIER", 
		"WHITESPACE", "LINE_COMMENT", "BLOCK_COMMENT", "PP_BODY_WS", "PP_ID_WS", 
		"PP_ID_NL", "PP_ID_BODY_WS", "PP_ID_BODY_NL",
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
	public program(): ProgramContext {
		let _localctx: ProgramContext = new ProgramContext(this._ctx, this.state);
		this.enterRule(_localctx, 0, LPCParser.RULE_program);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 101;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INHERIT) | (1 << LPCParser.PRIVATE) | (1 << LPCParser.PROTECTED) | (1 << LPCParser.PUBLIC) | (1 << LPCParser.STATIC) | (1 << LPCParser.NOMASK) | (1 << LPCParser.VARARGS) | (1 << LPCParser.NOSAVE) | (1 << LPCParser.REF) | (1 << LPCParser.VOID) | (1 << LPCParser.INT))) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & ((1 << (LPCParser.STRING - 32)) | (1 << (LPCParser.OBJECT - 32)) | (1 << (LPCParser.ARRAY - 32)) | (1 << (LPCParser.MAPPING - 32)) | (1 << (LPCParser.FLOAT - 32)) | (1 << (LPCParser.BUFFER - 32)) | (1 << (LPCParser.MIXED - 32)) | (1 << (LPCParser.FUNCTION - 32)) | (1 << (LPCParser.CLASS - 32)) | (1 << (LPCParser.STRUCT - 32)) | (1 << (LPCParser.CLOSURE - 32)) | (1 << (LPCParser.PP_INCLUDE - 32)) | (1 << (LPCParser.PP_DEFINE - 32)) | (1 << (LPCParser.PP_IFDEF - 32)) | (1 << (LPCParser.PP_IFNDEF - 32)) | (1 << (LPCParser.PP_IF - 32)) | (1 << (LPCParser.PP_ERROR - 32)) | (1 << (LPCParser.PP_PRAGMA - 32)))) !== 0)) {
				{
				{
				this.state = 98;
				this.declaration();
				}
				}
				this.state = 103;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 104;
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
	public declaration(): DeclarationContext {
		let _localctx: DeclarationContext = new DeclarationContext(this._ctx, this.state);
		this.enterRule(_localctx, 2, LPCParser.RULE_declaration);
		try {
			this.state = 110;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 1, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 106;
				this.preprocessorDirective();
				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 107;
				this.inheritStatement();
				}
				break;

			case 3:
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 108;
				this.functionDeclaration();
				}
				break;

			case 4:
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 109;
				this.variableDeclaration();
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
	public statement(): StatementContext {
		let _localctx: StatementContext = new StatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 4, LPCParser.RULE_statement);
		try {
			this.state = 125;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case LPCParser.LBRACE:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 112;
				this.block();
				}
				break;
			case LPCParser.PRIVATE:
			case LPCParser.PROTECTED:
			case LPCParser.PUBLIC:
			case LPCParser.STATIC:
			case LPCParser.NOMASK:
			case LPCParser.VARARGS:
			case LPCParser.NOSAVE:
			case LPCParser.REF:
			case LPCParser.VOID:
			case LPCParser.INT:
			case LPCParser.STRING:
			case LPCParser.OBJECT:
			case LPCParser.ARRAY:
			case LPCParser.MAPPING:
			case LPCParser.FLOAT:
			case LPCParser.BUFFER:
			case LPCParser.MIXED:
			case LPCParser.FUNCTION:
			case LPCParser.CLASS:
			case LPCParser.STRUCT:
			case LPCParser.CLOSURE:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 113;
				this.variableDeclaration();
				}
				break;
			case LPCParser.EFUN:
			case LPCParser.NEW:
			case LPCParser.CATCH:
			case LPCParser.SSCANF:
			case LPCParser.PARSE_COMMAND:
			case LPCParser.TIME_EXPRESSION:
			case LPCParser.LPAREN:
			case LPCParser.SCOPE_RESOLUTION:
			case LPCParser.MINUS:
			case LPCParser.INC:
			case LPCParser.DEC:
			case LPCParser.NOT:
			case LPCParser.BITWISE_NOT:
			case LPCParser.STRING_LITERAL:
			case LPCParser.NUMBER:
			case LPCParser.IDENTIFIER:
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 114;
				this.expressionStatement();
				}
				break;
			case LPCParser.RETURN:
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 115;
				this.returnStatement();
				}
				break;
			case LPCParser.IF:
				this.enterOuterAlt(_localctx, 5);
				{
				this.state = 116;
				this.ifStatement();
				}
				break;
			case LPCParser.FOR:
				this.enterOuterAlt(_localctx, 6);
				{
				this.state = 117;
				this.forStatement();
				}
				break;
			case LPCParser.FOREACH:
				this.enterOuterAlt(_localctx, 7);
				{
				this.state = 118;
				this.foreachStatement();
				}
				break;
			case LPCParser.WHILE:
				this.enterOuterAlt(_localctx, 8);
				{
				this.state = 119;
				this.whileStatement();
				}
				break;
			case LPCParser.DO:
				this.enterOuterAlt(_localctx, 9);
				{
				this.state = 120;
				this.doWhileStatement();
				}
				break;
			case LPCParser.SWITCH:
				this.enterOuterAlt(_localctx, 10);
				{
				this.state = 121;
				this.switchStatement();
				}
				break;
			case LPCParser.BREAK:
				this.enterOuterAlt(_localctx, 11);
				{
				this.state = 122;
				this.breakStatement();
				}
				break;
			case LPCParser.CONTINUE:
				this.enterOuterAlt(_localctx, 12);
				{
				this.state = 123;
				this.continueStatement();
				}
				break;
			case LPCParser.FALLTHROUGH:
				this.enterOuterAlt(_localctx, 13);
				{
				this.state = 124;
				this.fallthroughStatement();
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
		this.enterRule(_localctx, 6, LPCParser.RULE_block);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 127;
			this.match(LPCParser.LBRACE);
			this.state = 131;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.IF) | (1 << LPCParser.WHILE) | (1 << LPCParser.FOR) | (1 << LPCParser.DO) | (1 << LPCParser.SWITCH) | (1 << LPCParser.BREAK) | (1 << LPCParser.CONTINUE) | (1 << LPCParser.RETURN) | (1 << LPCParser.FOREACH) | (1 << LPCParser.FALLTHROUGH) | (1 << LPCParser.EFUN) | (1 << LPCParser.NEW) | (1 << LPCParser.CATCH) | (1 << LPCParser.SSCANF) | (1 << LPCParser.PARSE_COMMAND) | (1 << LPCParser.TIME_EXPRESSION) | (1 << LPCParser.PRIVATE) | (1 << LPCParser.PROTECTED) | (1 << LPCParser.PUBLIC) | (1 << LPCParser.STATIC) | (1 << LPCParser.NOMASK) | (1 << LPCParser.VARARGS) | (1 << LPCParser.NOSAVE) | (1 << LPCParser.REF) | (1 << LPCParser.VOID) | (1 << LPCParser.INT))) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & ((1 << (LPCParser.STRING - 32)) | (1 << (LPCParser.OBJECT - 32)) | (1 << (LPCParser.ARRAY - 32)) | (1 << (LPCParser.MAPPING - 32)) | (1 << (LPCParser.FLOAT - 32)) | (1 << (LPCParser.BUFFER - 32)) | (1 << (LPCParser.MIXED - 32)) | (1 << (LPCParser.FUNCTION - 32)) | (1 << (LPCParser.CLASS - 32)) | (1 << (LPCParser.STRUCT - 32)) | (1 << (LPCParser.CLOSURE - 32)) | (1 << (LPCParser.LBRACE - 32)) | (1 << (LPCParser.LPAREN - 32)))) !== 0) || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & ((1 << (LPCParser.SCOPE_RESOLUTION - 74)) | (1 << (LPCParser.MINUS - 74)) | (1 << (LPCParser.INC - 74)) | (1 << (LPCParser.DEC - 74)) | (1 << (LPCParser.NOT - 74)) | (1 << (LPCParser.BITWISE_NOT - 74)) | (1 << (LPCParser.STRING_LITERAL - 74)) | (1 << (LPCParser.NUMBER - 74)) | (1 << (LPCParser.IDENTIFIER - 74)))) !== 0)) {
				{
				{
				this.state = 128;
				this.statement();
				}
				}
				this.state = 133;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 134;
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
	public expressionStatement(): ExpressionStatementContext {
		let _localctx: ExpressionStatementContext = new ExpressionStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 8, LPCParser.RULE_expressionStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 136;
			this.expression(0);
			this.state = 137;
			this.match(LPCParser.SEMICOLON);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public variableDeclaration(): VariableDeclarationContext {
		let _localctx: VariableDeclarationContext = new VariableDeclarationContext(this._ctx, this.state);
		this.enterRule(_localctx, 10, LPCParser.RULE_variableDeclaration);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 139;
			this.typeSpecifier();
			this.state = 140;
			this.variableDeclarator();
			this.state = 145;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.COMMA) {
				{
				{
				this.state = 141;
				this.match(LPCParser.COMMA);
				this.state = 142;
				this.variableDeclarator();
				}
				}
				this.state = 147;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 148;
			this.match(LPCParser.SEMICOLON);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(_localctx, 12, LPCParser.RULE_variableDeclarator);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 153;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.STAR) {
				{
				{
				this.state = 150;
				this.match(LPCParser.STAR);
				}
				}
				this.state = 155;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 156;
			this.identifier();
			this.state = 159;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === LPCParser.ASSIGN) {
				{
				this.state = 157;
				this.match(LPCParser.ASSIGN);
				this.state = 158;
				this.expression(0);
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
	public functionDeclaration(): FunctionDeclarationContext {
		let _localctx: FunctionDeclarationContext = new FunctionDeclarationContext(this._ctx, this.state);
		this.enterRule(_localctx, 14, LPCParser.RULE_functionDeclaration);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 161;
			this.typeSpecifier();
			this.state = 162;
			this.identifier();
			this.state = 163;
			this.match(LPCParser.LPAREN);
			this.state = 165;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 22)) & ~0x1F) === 0 && ((1 << (_la - 22)) & ((1 << (LPCParser.PRIVATE - 22)) | (1 << (LPCParser.PROTECTED - 22)) | (1 << (LPCParser.PUBLIC - 22)) | (1 << (LPCParser.STATIC - 22)) | (1 << (LPCParser.NOMASK - 22)) | (1 << (LPCParser.VARARGS - 22)) | (1 << (LPCParser.NOSAVE - 22)) | (1 << (LPCParser.REF - 22)) | (1 << (LPCParser.VOID - 22)) | (1 << (LPCParser.INT - 22)) | (1 << (LPCParser.STRING - 22)) | (1 << (LPCParser.OBJECT - 22)) | (1 << (LPCParser.ARRAY - 22)) | (1 << (LPCParser.MAPPING - 22)) | (1 << (LPCParser.FLOAT - 22)) | (1 << (LPCParser.BUFFER - 22)) | (1 << (LPCParser.MIXED - 22)) | (1 << (LPCParser.FUNCTION - 22)) | (1 << (LPCParser.CLASS - 22)) | (1 << (LPCParser.STRUCT - 22)) | (1 << (LPCParser.CLOSURE - 22)))) !== 0) || _la === LPCParser.ELLIPSIS) {
				{
				this.state = 164;
				this.parameterList();
				}
			}

			this.state = 167;
			this.match(LPCParser.RPAREN);
			this.state = 170;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case LPCParser.LBRACE:
				{
				this.state = 168;
				this.block();
				}
				break;
			case LPCParser.SEMICOLON:
				{
				this.state = 169;
				this.match(LPCParser.SEMICOLON);
				}
				break;
			default:
				throw new NoViableAltException(this);
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
		this.enterRule(_localctx, 16, LPCParser.RULE_parameterList);
		let _la: number;
		try {
			let _alt: number;
			this.state = 185;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case LPCParser.PRIVATE:
			case LPCParser.PROTECTED:
			case LPCParser.PUBLIC:
			case LPCParser.STATIC:
			case LPCParser.NOMASK:
			case LPCParser.VARARGS:
			case LPCParser.NOSAVE:
			case LPCParser.REF:
			case LPCParser.VOID:
			case LPCParser.INT:
			case LPCParser.STRING:
			case LPCParser.OBJECT:
			case LPCParser.ARRAY:
			case LPCParser.MAPPING:
			case LPCParser.FLOAT:
			case LPCParser.BUFFER:
			case LPCParser.MIXED:
			case LPCParser.FUNCTION:
			case LPCParser.CLASS:
			case LPCParser.STRUCT:
			case LPCParser.CLOSURE:
				this.enterOuterAlt(_localctx, 1);
				{
				{
				this.state = 172;
				this.parameter();
				this.state = 177;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 9, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 173;
						this.match(LPCParser.COMMA);
						this.state = 174;
						this.parameter();
						}
						}
					}
					this.state = 179;
					this._errHandler.sync(this);
					_alt = this.interpreter.adaptivePredict(this._input, 9, this._ctx);
				}
				this.state = 182;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.COMMA) {
					{
					this.state = 180;
					this.match(LPCParser.COMMA);
					this.state = 181;
					this.match(LPCParser.ELLIPSIS);
					}
				}

				}
				}
				break;
			case LPCParser.ELLIPSIS:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 184;
				this.match(LPCParser.ELLIPSIS);
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
	public parameter(): ParameterContext {
		let _localctx: ParameterContext = new ParameterContext(this._ctx, this.state);
		this.enterRule(_localctx, 18, LPCParser.RULE_parameter);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 187;
			this.typeSpecifier();
			this.state = 191;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.STAR) {
				{
				{
				this.state = 188;
				this.match(LPCParser.STAR);
				}
				}
				this.state = 193;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 194;
			this.identifier();
			this.state = 197;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === LPCParser.ASSIGN) {
				{
				this.state = 195;
				this.match(LPCParser.ASSIGN);
				this.state = 196;
				this.expression(0);
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
	public inheritStatement(): InheritStatementContext {
		let _localctx: InheritStatementContext = new InheritStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 20, LPCParser.RULE_inheritStatement);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 199;
			this.match(LPCParser.INHERIT);
			this.state = 200;
			_la = this._input.LA(1);
			if (!(_la === LPCParser.STRING_LITERAL || _la === LPCParser.IDENTIFIER)) {
			this._errHandler.recoverInline(this);
			} else {
				if (this._input.LA(1) === Token.EOF) {
					this.matchedEOF = true;
				}

				this._errHandler.reportMatch(this);
				this.consume();
			}
			this.state = 201;
			this.match(LPCParser.SEMICOLON);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public preprocessorDirective(): PreprocessorDirectiveContext {
		let _localctx: PreprocessorDirectiveContext = new PreprocessorDirectiveContext(this._ctx, this.state);
		this.enterRule(_localctx, 22, LPCParser.RULE_preprocessorDirective);
		try {
			this.state = 208;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case LPCParser.PP_INCLUDE:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 203;
				this.ppInclude();
				}
				break;
			case LPCParser.PP_DEFINE:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 204;
				this.ppDefine();
				}
				break;
			case LPCParser.PP_ERROR:
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 205;
				this.ppError();
				}
				break;
			case LPCParser.PP_PRAGMA:
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 206;
				this.ppPragma();
				}
				break;
			case LPCParser.PP_IFDEF:
			case LPCParser.PP_IFNDEF:
			case LPCParser.PP_IF:
				this.enterOuterAlt(_localctx, 5);
				{
				this.state = 207;
				this.ppConditional();
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
	public ppInclude(): PpIncludeContext {
		let _localctx: PpIncludeContext = new PpIncludeContext(this._ctx, this.state);
		this.enterRule(_localctx, 24, LPCParser.RULE_ppInclude);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 210;
			this.match(LPCParser.PP_INCLUDE);
			this.state = 211;
			_la = this._input.LA(1);
			if (!(_la === LPCParser.STRING_LITERAL || _la === LPCParser.LESS_THAN_PATH)) {
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
	public ppDefine(): PpDefineContext {
		let _localctx: PpDefineContext = new PpDefineContext(this._ctx, this.state);
		this.enterRule(_localctx, 26, LPCParser.RULE_ppDefine);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 213;
			this.match(LPCParser.PP_DEFINE);
			this.state = 214;
			this.match(LPCParser.IDENTIFIER);
			this.state = 216;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === LPCParser.PP_BODY) {
				{
				this.state = 215;
				this.ppBody();
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
	public ppConditional(): PpConditionalContext {
		let _localctx: PpConditionalContext = new PpConditionalContext(this._ctx, this.state);
		this.enterRule(_localctx, 28, LPCParser.RULE_ppConditional);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 224;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case LPCParser.PP_IFDEF:
			case LPCParser.PP_IFNDEF:
				{
				this.state = 218;
				_la = this._input.LA(1);
				if (!(_la === LPCParser.PP_IFDEF || _la === LPCParser.PP_IFNDEF)) {
				this._errHandler.recoverInline(this);
				} else {
					if (this._input.LA(1) === Token.EOF) {
						this.matchedEOF = true;
					}

					this._errHandler.reportMatch(this);
					this.consume();
				}
				this.state = 219;
				this.match(LPCParser.IDENTIFIER);
				}
				break;
			case LPCParser.PP_IF:
				{
				this.state = 220;
				this.match(LPCParser.PP_IF);
				this.state = 222;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.PP_BODY) {
					{
					this.state = 221;
					this.ppBody();
					}
				}

				}
				break;
			default:
				throw new NoViableAltException(this);
			}
			this.state = 229;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INHERIT) | (1 << LPCParser.PRIVATE) | (1 << LPCParser.PROTECTED) | (1 << LPCParser.PUBLIC) | (1 << LPCParser.STATIC) | (1 << LPCParser.NOMASK) | (1 << LPCParser.VARARGS) | (1 << LPCParser.NOSAVE) | (1 << LPCParser.REF) | (1 << LPCParser.VOID) | (1 << LPCParser.INT))) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & ((1 << (LPCParser.STRING - 32)) | (1 << (LPCParser.OBJECT - 32)) | (1 << (LPCParser.ARRAY - 32)) | (1 << (LPCParser.MAPPING - 32)) | (1 << (LPCParser.FLOAT - 32)) | (1 << (LPCParser.BUFFER - 32)) | (1 << (LPCParser.MIXED - 32)) | (1 << (LPCParser.FUNCTION - 32)) | (1 << (LPCParser.CLASS - 32)) | (1 << (LPCParser.STRUCT - 32)) | (1 << (LPCParser.CLOSURE - 32)) | (1 << (LPCParser.PP_INCLUDE - 32)) | (1 << (LPCParser.PP_DEFINE - 32)) | (1 << (LPCParser.PP_IFDEF - 32)) | (1 << (LPCParser.PP_IFNDEF - 32)) | (1 << (LPCParser.PP_IF - 32)) | (1 << (LPCParser.PP_ERROR - 32)) | (1 << (LPCParser.PP_PRAGMA - 32)))) !== 0)) {
				{
				{
				this.state = 226;
				this.declaration();
				}
				}
				this.state = 231;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 242;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === LPCParser.PP_ELSE) {
				{
				this.state = 232;
				this.match(LPCParser.PP_ELSE);
				this.state = 234;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === LPCParser.PP_BODY) {
					{
					this.state = 233;
					this.ppBody();
					}
				}

				this.state = 239;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.INHERIT) | (1 << LPCParser.PRIVATE) | (1 << LPCParser.PROTECTED) | (1 << LPCParser.PUBLIC) | (1 << LPCParser.STATIC) | (1 << LPCParser.NOMASK) | (1 << LPCParser.VARARGS) | (1 << LPCParser.NOSAVE) | (1 << LPCParser.REF) | (1 << LPCParser.VOID) | (1 << LPCParser.INT))) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & ((1 << (LPCParser.STRING - 32)) | (1 << (LPCParser.OBJECT - 32)) | (1 << (LPCParser.ARRAY - 32)) | (1 << (LPCParser.MAPPING - 32)) | (1 << (LPCParser.FLOAT - 32)) | (1 << (LPCParser.BUFFER - 32)) | (1 << (LPCParser.MIXED - 32)) | (1 << (LPCParser.FUNCTION - 32)) | (1 << (LPCParser.CLASS - 32)) | (1 << (LPCParser.STRUCT - 32)) | (1 << (LPCParser.CLOSURE - 32)) | (1 << (LPCParser.PP_INCLUDE - 32)) | (1 << (LPCParser.PP_DEFINE - 32)) | (1 << (LPCParser.PP_IFDEF - 32)) | (1 << (LPCParser.PP_IFNDEF - 32)) | (1 << (LPCParser.PP_IF - 32)) | (1 << (LPCParser.PP_ERROR - 32)) | (1 << (LPCParser.PP_PRAGMA - 32)))) !== 0)) {
					{
					{
					this.state = 236;
					this.declaration();
					}
					}
					this.state = 241;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 244;
			this.match(LPCParser.PP_ENDIF);
			this.state = 246;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === LPCParser.PP_BODY) {
				{
				this.state = 245;
				this.ppBody();
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
	public ppError(): PpErrorContext {
		let _localctx: PpErrorContext = new PpErrorContext(this._ctx, this.state);
		this.enterRule(_localctx, 30, LPCParser.RULE_ppError);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 248;
			this.match(LPCParser.PP_ERROR);
			this.state = 250;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === LPCParser.PP_BODY) {
				{
				this.state = 249;
				this.ppBody();
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
	public ppPragma(): PpPragmaContext {
		let _localctx: PpPragmaContext = new PpPragmaContext(this._ctx, this.state);
		this.enterRule(_localctx, 32, LPCParser.RULE_ppPragma);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 252;
			this.match(LPCParser.PP_PRAGMA);
			this.state = 254;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === LPCParser.PP_BODY) {
				{
				this.state = 253;
				this.ppBody();
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
	public ppBody(): PpBodyContext {
		let _localctx: PpBodyContext = new PpBodyContext(this._ctx, this.state);
		this.enterRule(_localctx, 34, LPCParser.RULE_ppBody);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 256;
			this.match(LPCParser.PP_BODY);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}

	public expression(): ExpressionContext;
	public expression(_p: number): ExpressionContext;
	// @RuleVersion(0)
	public expression(_p?: number): ExpressionContext {
		if (_p === undefined) {
			_p = 0;
		}

		let _parentctx: ParserRuleContext = this._ctx;
		let _parentState: number = this.state;
		let _localctx: ExpressionContext = new ExpressionContext(this._ctx, _parentState);
		let _prevctx: ExpressionContext = _localctx;
		let _startState: number = 36;
		this.enterRecursionRule(_localctx, 36, LPCParser.RULE_expression, _p);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 267;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 25, this._ctx) ) {
			case 1:
				{
				_localctx = new PrimaryExprContext(_localctx);
				this._ctx = _localctx;
				_prevctx = _localctx;

				this.state = 259;
				this.primary();
				}
				break;

			case 2:
				{
				_localctx = new PreIncrementExprContext(_localctx);
				this._ctx = _localctx;
				_prevctx = _localctx;
				this.state = 260;
				this.match(LPCParser.INC);
				this.state = 261;
				this.expression(17);
				}
				break;

			case 3:
				{
				_localctx = new PreDecrementExprContext(_localctx);
				this._ctx = _localctx;
				_prevctx = _localctx;
				this.state = 262;
				this.match(LPCParser.DEC);
				this.state = 263;
				this.expression(16);
				}
				break;

			case 4:
				{
				_localctx = new UnaryExprContext(_localctx);
				this._ctx = _localctx;
				_prevctx = _localctx;
				this.state = 264;
				_la = this._input.LA(1);
				if (!(((((_la - 79)) & ~0x1F) === 0 && ((1 << (_la - 79)) & ((1 << (LPCParser.MINUS - 79)) | (1 << (LPCParser.NOT - 79)) | (1 << (LPCParser.BITWISE_NOT - 79)))) !== 0))) {
				this._errHandler.recoverInline(this);
				} else {
					if (this._input.LA(1) === Token.EOF) {
						this.matchedEOF = true;
					}

					this._errHandler.reportMatch(this);
					this.consume();
				}
				this.state = 265;
				this.expression(15);
				}
				break;

			case 5:
				{
				_localctx = new CastExprContext(_localctx);
				this._ctx = _localctx;
				_prevctx = _localctx;
				this.state = 266;
				this.castExpression();
				}
				break;
			}
			this._ctx._stop = this._input.tryLT(-1);
			this.state = 338;
			this._errHandler.sync(this);
			_alt = this.interpreter.adaptivePredict(this._input, 28, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = _localctx;
					{
					this.state = 336;
					this._errHandler.sync(this);
					switch ( this.interpreter.adaptivePredict(this._input, 27, this._ctx) ) {
					case 1:
						{
						_localctx = new MultiplicativeExprContext(new ExpressionContext(_parentctx, _parentState));
						this.pushNewRecursionContext(_localctx, _startState, LPCParser.RULE_expression);
						this.state = 269;
						if (!(this.precpred(this._ctx, 13))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 13)");
						}
						this.state = 270;
						_la = this._input.LA(1);
						if (!(((((_la - 80)) & ~0x1F) === 0 && ((1 << (_la - 80)) & ((1 << (LPCParser.STAR - 80)) | (1 << (LPCParser.DIV - 80)) | (1 << (LPCParser.MOD - 80)))) !== 0))) {
						this._errHandler.recoverInline(this);
						} else {
							if (this._input.LA(1) === Token.EOF) {
								this.matchedEOF = true;
							}

							this._errHandler.reportMatch(this);
							this.consume();
						}
						this.state = 271;
						this.expression(14);
						}
						break;

					case 2:
						{
						_localctx = new AdditiveExprContext(new ExpressionContext(_parentctx, _parentState));
						this.pushNewRecursionContext(_localctx, _startState, LPCParser.RULE_expression);
						this.state = 272;
						if (!(this.precpred(this._ctx, 12))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 12)");
						}
						this.state = 273;
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
						this.state = 274;
						this.expression(13);
						}
						break;

					case 3:
						{
						_localctx = new ShiftExprContext(new ExpressionContext(_parentctx, _parentState));
						this.pushNewRecursionContext(_localctx, _startState, LPCParser.RULE_expression);
						this.state = 275;
						if (!(this.precpred(this._ctx, 11))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 11)");
						}
						this.state = 276;
						_la = this._input.LA(1);
						if (!(_la === LPCParser.LSHIFT || _la === LPCParser.RSHIFT)) {
						this._errHandler.recoverInline(this);
						} else {
							if (this._input.LA(1) === Token.EOF) {
								this.matchedEOF = true;
							}

							this._errHandler.reportMatch(this);
							this.consume();
						}
						this.state = 277;
						this.expression(12);
						}
						break;

					case 4:
						{
						_localctx = new RelationalExprContext(new ExpressionContext(_parentctx, _parentState));
						this.pushNewRecursionContext(_localctx, _startState, LPCParser.RULE_expression);
						this.state = 278;
						if (!(this.precpred(this._ctx, 10))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 10)");
						}
						this.state = 279;
						_la = this._input.LA(1);
						if (!(((((_la - 87)) & ~0x1F) === 0 && ((1 << (_la - 87)) & ((1 << (LPCParser.GT - 87)) | (1 << (LPCParser.LT - 87)) | (1 << (LPCParser.GTE - 87)) | (1 << (LPCParser.LTE - 87)))) !== 0))) {
						this._errHandler.recoverInline(this);
						} else {
							if (this._input.LA(1) === Token.EOF) {
								this.matchedEOF = true;
							}

							this._errHandler.reportMatch(this);
							this.consume();
						}
						this.state = 280;
						this.expression(11);
						}
						break;

					case 5:
						{
						_localctx = new EqualityExprContext(new ExpressionContext(_parentctx, _parentState));
						this.pushNewRecursionContext(_localctx, _startState, LPCParser.RULE_expression);
						this.state = 281;
						if (!(this.precpred(this._ctx, 9))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 9)");
						}
						this.state = 282;
						_la = this._input.LA(1);
						if (!(_la === LPCParser.EQ || _la === LPCParser.NEQ)) {
						this._errHandler.recoverInline(this);
						} else {
							if (this._input.LA(1) === Token.EOF) {
								this.matchedEOF = true;
							}

							this._errHandler.reportMatch(this);
							this.consume();
						}
						this.state = 283;
						this.expression(10);
						}
						break;

					case 6:
						{
						_localctx = new BitwiseAndExprContext(new ExpressionContext(_parentctx, _parentState));
						this.pushNewRecursionContext(_localctx, _startState, LPCParser.RULE_expression);
						this.state = 284;
						if (!(this.precpred(this._ctx, 8))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 8)");
						}
						this.state = 285;
						this.match(LPCParser.BITWISE_AND);
						this.state = 286;
						this.expression(9);
						}
						break;

					case 7:
						{
						_localctx = new BitwiseXorExprContext(new ExpressionContext(_parentctx, _parentState));
						this.pushNewRecursionContext(_localctx, _startState, LPCParser.RULE_expression);
						this.state = 287;
						if (!(this.precpred(this._ctx, 7))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 7)");
						}
						this.state = 288;
						this.match(LPCParser.BITWISE_XOR);
						this.state = 289;
						this.expression(8);
						}
						break;

					case 8:
						{
						_localctx = new BitwiseOrExprContext(new ExpressionContext(_parentctx, _parentState));
						this.pushNewRecursionContext(_localctx, _startState, LPCParser.RULE_expression);
						this.state = 290;
						if (!(this.precpred(this._ctx, 6))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 6)");
						}
						this.state = 291;
						this.match(LPCParser.BITWISE_OR);
						this.state = 292;
						this.expression(7);
						}
						break;

					case 9:
						{
						_localctx = new LogicalAndExprContext(new ExpressionContext(_parentctx, _parentState));
						this.pushNewRecursionContext(_localctx, _startState, LPCParser.RULE_expression);
						this.state = 293;
						if (!(this.precpred(this._ctx, 4))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 4)");
						}
						this.state = 294;
						this.match(LPCParser.AND);
						this.state = 295;
						this.expression(4);
						}
						break;

					case 10:
						{
						_localctx = new LogicalOrExprContext(new ExpressionContext(_parentctx, _parentState));
						this.pushNewRecursionContext(_localctx, _startState, LPCParser.RULE_expression);
						this.state = 296;
						if (!(this.precpred(this._ctx, 3))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 3)");
						}
						this.state = 297;
						this.match(LPCParser.OR);
						this.state = 298;
						this.expression(3);
						}
						break;

					case 11:
						{
						_localctx = new ConditionalExprContext(new ExpressionContext(_parentctx, _parentState));
						this.pushNewRecursionContext(_localctx, _startState, LPCParser.RULE_expression);
						this.state = 299;
						if (!(this.precpred(this._ctx, 2))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 2)");
						}
						this.state = 300;
						this.match(LPCParser.QUESTION);
						this.state = 301;
						this.expression(0);
						this.state = 302;
						this.match(LPCParser.COLON);
						this.state = 303;
						this.expression(2);
						}
						break;

					case 12:
						{
						_localctx = new AssignmentExprContext(new ExpressionContext(_parentctx, _parentState));
						this.pushNewRecursionContext(_localctx, _startState, LPCParser.RULE_expression);
						this.state = 305;
						if (!(this.precpred(this._ctx, 1))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 1)");
						}
						this.state = 306;
						this.assignmentOperator();
						this.state = 307;
						this.expression(1);
						}
						break;

					case 13:
						{
						_localctx = new ArrayAccessExprContext(new ExpressionContext(_parentctx, _parentState));
						this.pushNewRecursionContext(_localctx, _startState, LPCParser.RULE_expression);
						this.state = 309;
						if (!(this.precpred(this._ctx, 23))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 23)");
						}
						this.state = 310;
						this.match(LPCParser.LBRACK);
						this.state = 311;
						this.expression(0);
						this.state = 312;
						this.match(LPCParser.RBRACK);
						}
						break;

					case 14:
						{
						_localctx = new ArraySliceExprContext(new ExpressionContext(_parentctx, _parentState));
						this.pushNewRecursionContext(_localctx, _startState, LPCParser.RULE_expression);
						this.state = 314;
						if (!(this.precpred(this._ctx, 22))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 22)");
						}
						this.state = 315;
						this.match(LPCParser.LBRACK);
						this.state = 316;
						this.expression(0);
						this.state = 317;
						this.match(LPCParser.RANGE);
						this.state = 318;
						this.expression(0);
						this.state = 319;
						this.match(LPCParser.RBRACK);
						}
						break;

					case 15:
						{
						_localctx = new FunctionCallExprContext(new ExpressionContext(_parentctx, _parentState));
						this.pushNewRecursionContext(_localctx, _startState, LPCParser.RULE_expression);
						this.state = 321;
						if (!(this.precpred(this._ctx, 21))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 21)");
						}
						this.state = 322;
						this.match(LPCParser.LPAREN);
						this.state = 324;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.EFUN) | (1 << LPCParser.NEW) | (1 << LPCParser.CATCH) | (1 << LPCParser.SSCANF) | (1 << LPCParser.PARSE_COMMAND) | (1 << LPCParser.TIME_EXPRESSION))) !== 0) || ((((_la - 58)) & ~0x1F) === 0 && ((1 << (_la - 58)) & ((1 << (LPCParser.LPAREN - 58)) | (1 << (LPCParser.SCOPE_RESOLUTION - 58)) | (1 << (LPCParser.ELLIPSIS - 58)) | (1 << (LPCParser.MINUS - 58)) | (1 << (LPCParser.INC - 58)) | (1 << (LPCParser.DEC - 58)))) !== 0) || ((((_la - 91)) & ~0x1F) === 0 && ((1 << (_la - 91)) & ((1 << (LPCParser.NOT - 91)) | (1 << (LPCParser.BITWISE_NOT - 91)) | (1 << (LPCParser.STRING_LITERAL - 91)) | (1 << (LPCParser.NUMBER - 91)) | (1 << (LPCParser.IDENTIFIER - 91)))) !== 0)) {
							{
							this.state = 323;
							this.argumentList();
							}
						}

						this.state = 326;
						this.match(LPCParser.RPAREN);
						}
						break;

					case 16:
						{
						_localctx = new MemberAccessExprContext(new ExpressionContext(_parentctx, _parentState));
						this.pushNewRecursionContext(_localctx, _startState, LPCParser.RULE_expression);
						this.state = 327;
						if (!(this.precpred(this._ctx, 20))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 20)");
						}
						this.state = 328;
						this.match(LPCParser.ARROW);
						this.state = 329;
						this.identifier();
						}
						break;

					case 17:
						{
						_localctx = new PostIncrementExprContext(new ExpressionContext(_parentctx, _parentState));
						this.pushNewRecursionContext(_localctx, _startState, LPCParser.RULE_expression);
						this.state = 330;
						if (!(this.precpred(this._ctx, 19))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 19)");
						}
						this.state = 331;
						this.match(LPCParser.INC);
						}
						break;

					case 18:
						{
						_localctx = new PostDecrementExprContext(new ExpressionContext(_parentctx, _parentState));
						this.pushNewRecursionContext(_localctx, _startState, LPCParser.RULE_expression);
						this.state = 332;
						if (!(this.precpred(this._ctx, 18))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 18)");
						}
						this.state = 333;
						this.match(LPCParser.DEC);
						}
						break;

					case 19:
						{
						_localctx = new ImplicitConcatExprContext(new ExpressionContext(_parentctx, _parentState));
						this.pushNewRecursionContext(_localctx, _startState, LPCParser.RULE_expression);
						this.state = 334;
						if (!(this.precpred(this._ctx, 5))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 5)");
						}
						this.state = 335;
						this.primary();
						}
						break;
					}
					}
				}
				this.state = 340;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 28, this._ctx);
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
			this.unrollRecursionContexts(_parentctx);
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public castExpression(): CastExpressionContext {
		let _localctx: CastExpressionContext = new CastExpressionContext(this._ctx, this.state);
		this.enterRule(_localctx, 38, LPCParser.RULE_castExpression);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 341;
			this.match(LPCParser.LPAREN);
			this.state = 342;
			this.typeSpecifier();
			this.state = 343;
			this.match(LPCParser.RPAREN);
			this.state = 344;
			this.primary();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public closureExpression(): ClosureExpressionContext {
		let _localctx: ClosureExpressionContext = new ClosureExpressionContext(this._ctx, this.state);
		this.enterRule(_localctx, 40, LPCParser.RULE_closureExpression);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 346;
			this.match(LPCParser.LPAREN);
			this.state = 347;
			this.match(LPCParser.COLON);
			this.state = 348;
			this.expression(0);
			this.state = 352;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case LPCParser.COLON:
				{
				this.state = 349;
				this.match(LPCParser.COLON);
				this.state = 350;
				this.match(LPCParser.RPAREN);
				}
				break;
			case LPCParser.RPAREN:
				{
				this.state = 351;
				this.match(LPCParser.RPAREN);
				}
				break;
			default:
				throw new NoViableAltException(this);
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
	public assignmentOperator(): AssignmentOperatorContext {
		let _localctx: AssignmentOperatorContext = new AssignmentOperatorContext(this._ctx, this.state);
		this.enterRule(_localctx, 42, LPCParser.RULE_assignmentOperator);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 354;
			_la = this._input.LA(1);
			if (!(((((_la - 60)) & ~0x1F) === 0 && ((1 << (_la - 60)) & ((1 << (LPCParser.ASSIGN - 60)) | (1 << (LPCParser.PLUS_ASSIGN - 60)) | (1 << (LPCParser.MINUS_ASSIGN - 60)) | (1 << (LPCParser.STAR_ASSIGN - 60)) | (1 << (LPCParser.DIV_ASSIGN - 60)) | (1 << (LPCParser.MOD_ASSIGN - 60)) | (1 << (LPCParser.AND_ASSIGN - 60)) | (1 << (LPCParser.OR_ASSIGN - 60)) | (1 << (LPCParser.XOR_ASSIGN - 60)) | (1 << (LPCParser.LSHIFT_ASSIGN - 60)) | (1 << (LPCParser.RSHIFT_ASSIGN - 60)))) !== 0))) {
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
	public primary(): PrimaryContext {
		let _localctx: PrimaryContext = new PrimaryContext(this._ctx, this.state);
		this.enterRule(_localctx, 44, LPCParser.RULE_primary);
		try {
			this.state = 369;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 30, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 356;
				this.match(LPCParser.LPAREN);
				this.state = 357;
				this.expression(0);
				this.state = 358;
				this.match(LPCParser.RPAREN);
				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 360;
				this.literal();
				}
				break;

			case 3:
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 361;
				this.identifier();
				}
				break;

			case 4:
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 362;
				this.mappingLiteral();
				}
				break;

			case 5:
				this.enterOuterAlt(_localctx, 5);
				{
				this.state = 363;
				this.arrayLiteral();
				}
				break;

			case 6:
				this.enterOuterAlt(_localctx, 6);
				{
				this.state = 364;
				this.closureExpression();
				}
				break;

			case 7:
				this.enterOuterAlt(_localctx, 7);
				{
				this.state = 365;
				this.match(LPCParser.SCOPE_RESOLUTION);
				this.state = 366;
				this.identifier();
				}
				break;

			case 8:
				this.enterOuterAlt(_localctx, 8);
				{
				this.state = 367;
				this.match(LPCParser.IDENTIFIER);
				this.state = 368;
				this.match(LPCParser.STRING_LITERAL);
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
	public argumentList(): ArgumentListContext {
		let _localctx: ArgumentListContext = new ArgumentListContext(this._ctx, this.state);
		this.enterRule(_localctx, 46, LPCParser.RULE_argumentList);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 371;
			this.expressionOrEllipsis();
			this.state = 376;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === LPCParser.COMMA) {
				{
				{
				this.state = 372;
				this.match(LPCParser.COMMA);
				this.state = 373;
				this.expressionOrEllipsis();
				}
				}
				this.state = 378;
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
	public expressionOrEllipsis(): ExpressionOrEllipsisContext {
		let _localctx: ExpressionOrEllipsisContext = new ExpressionOrEllipsisContext(this._ctx, this.state);
		this.enterRule(_localctx, 48, LPCParser.RULE_expressionOrEllipsis);
		try {
			this.state = 381;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case LPCParser.EFUN:
			case LPCParser.NEW:
			case LPCParser.CATCH:
			case LPCParser.SSCANF:
			case LPCParser.PARSE_COMMAND:
			case LPCParser.TIME_EXPRESSION:
			case LPCParser.LPAREN:
			case LPCParser.SCOPE_RESOLUTION:
			case LPCParser.MINUS:
			case LPCParser.INC:
			case LPCParser.DEC:
			case LPCParser.NOT:
			case LPCParser.BITWISE_NOT:
			case LPCParser.STRING_LITERAL:
			case LPCParser.NUMBER:
			case LPCParser.IDENTIFIER:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 379;
				this.expression(0);
				}
				break;
			case LPCParser.ELLIPSIS:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 380;
				this.match(LPCParser.ELLIPSIS);
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
	public literal(): LiteralContext {
		let _localctx: LiteralContext = new LiteralContext(this._ctx, this.state);
		this.enterRule(_localctx, 50, LPCParser.RULE_literal);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 383;
			_la = this._input.LA(1);
			if (!(_la === LPCParser.STRING_LITERAL || _la === LPCParser.NUMBER)) {
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
	public mappingLiteral(): MappingLiteralContext {
		let _localctx: MappingLiteralContext = new MappingLiteralContext(this._ctx, this.state);
		this.enterRule(_localctx, 52, LPCParser.RULE_mappingLiteral);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 385;
			this.match(LPCParser.LPAREN);
			this.state = 386;
			this.match(LPCParser.LBRACK);
			this.state = 388;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.EFUN) | (1 << LPCParser.NEW) | (1 << LPCParser.CATCH) | (1 << LPCParser.SSCANF) | (1 << LPCParser.PARSE_COMMAND) | (1 << LPCParser.TIME_EXPRESSION))) !== 0) || ((((_la - 58)) & ~0x1F) === 0 && ((1 << (_la - 58)) & ((1 << (LPCParser.LPAREN - 58)) | (1 << (LPCParser.SCOPE_RESOLUTION - 58)) | (1 << (LPCParser.MINUS - 58)) | (1 << (LPCParser.INC - 58)) | (1 << (LPCParser.DEC - 58)))) !== 0) || ((((_la - 91)) & ~0x1F) === 0 && ((1 << (_la - 91)) & ((1 << (LPCParser.NOT - 91)) | (1 << (LPCParser.BITWISE_NOT - 91)) | (1 << (LPCParser.STRING_LITERAL - 91)) | (1 << (LPCParser.NUMBER - 91)) | (1 << (LPCParser.IDENTIFIER - 91)))) !== 0)) {
				{
				this.state = 387;
				this.mappingElementList();
				}
			}

			this.state = 390;
			this.match(LPCParser.RBRACK);
			this.state = 391;
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
	public mappingElementList(): MappingElementListContext {
		let _localctx: MappingElementListContext = new MappingElementListContext(this._ctx, this.state);
		this.enterRule(_localctx, 54, LPCParser.RULE_mappingElementList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 393;
			this.mappingElement();
			this.state = 398;
			this._errHandler.sync(this);
			_alt = this.interpreter.adaptivePredict(this._input, 34, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 394;
					this.match(LPCParser.COMMA);
					this.state = 395;
					this.mappingElement();
					}
					}
				}
				this.state = 400;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 34, this._ctx);
			}
			this.state = 402;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === LPCParser.COMMA) {
				{
				this.state = 401;
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
	public mappingElement(): MappingElementContext {
		let _localctx: MappingElementContext = new MappingElementContext(this._ctx, this.state);
		this.enterRule(_localctx, 56, LPCParser.RULE_mappingElement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 404;
			this.expression(0);
			this.state = 405;
			this.match(LPCParser.COLON);
			this.state = 406;
			this.expression(0);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public arrayLiteral(): ArrayLiteralContext {
		let _localctx: ArrayLiteralContext = new ArrayLiteralContext(this._ctx, this.state);
		this.enterRule(_localctx, 58, LPCParser.RULE_arrayLiteral);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 408;
			this.match(LPCParser.LPAREN);
			this.state = 409;
			this.match(LPCParser.LBRACE);
			this.state = 411;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.EFUN) | (1 << LPCParser.NEW) | (1 << LPCParser.CATCH) | (1 << LPCParser.SSCANF) | (1 << LPCParser.PARSE_COMMAND) | (1 << LPCParser.TIME_EXPRESSION))) !== 0) || ((((_la - 58)) & ~0x1F) === 0 && ((1 << (_la - 58)) & ((1 << (LPCParser.LPAREN - 58)) | (1 << (LPCParser.SCOPE_RESOLUTION - 58)) | (1 << (LPCParser.MINUS - 58)) | (1 << (LPCParser.INC - 58)) | (1 << (LPCParser.DEC - 58)))) !== 0) || ((((_la - 91)) & ~0x1F) === 0 && ((1 << (_la - 91)) & ((1 << (LPCParser.NOT - 91)) | (1 << (LPCParser.BITWISE_NOT - 91)) | (1 << (LPCParser.STRING_LITERAL - 91)) | (1 << (LPCParser.NUMBER - 91)) | (1 << (LPCParser.IDENTIFIER - 91)))) !== 0)) {
				{
				this.state = 410;
				this.expressionList();
				}
			}

			this.state = 413;
			this.match(LPCParser.RBRACE);
			this.state = 414;
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
	public expressionList(): ExpressionListContext {
		let _localctx: ExpressionListContext = new ExpressionListContext(this._ctx, this.state);
		this.enterRule(_localctx, 60, LPCParser.RULE_expressionList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 416;
			this.expression(0);
			this.state = 421;
			this._errHandler.sync(this);
			_alt = this.interpreter.adaptivePredict(this._input, 37, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 417;
					this.match(LPCParser.COMMA);
					this.state = 418;
					this.expression(0);
					}
					}
				}
				this.state = 423;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 37, this._ctx);
			}
			this.state = 425;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === LPCParser.COMMA) {
				{
				this.state = 424;
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
	public typeSpecifier(): TypeSpecifierContext {
		let _localctx: TypeSpecifierContext = new TypeSpecifierContext(this._ctx, this.state);
		this.enterRule(_localctx, 62, LPCParser.RULE_typeSpecifier);
		let _la: number;
		try {
			this.state = 451;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 43, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 428;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 427;
					this.modifier();
					}
					}
					this.state = 430;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.PRIVATE) | (1 << LPCParser.PROTECTED) | (1 << LPCParser.PUBLIC) | (1 << LPCParser.STATIC) | (1 << LPCParser.NOMASK) | (1 << LPCParser.VARARGS) | (1 << LPCParser.NOSAVE) | (1 << LPCParser.REF))) !== 0));
				this.state = 432;
				this.typeName();
				this.state = 436;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.PRIVATE) | (1 << LPCParser.PROTECTED) | (1 << LPCParser.PUBLIC) | (1 << LPCParser.STATIC) | (1 << LPCParser.NOMASK) | (1 << LPCParser.VARARGS) | (1 << LPCParser.NOSAVE) | (1 << LPCParser.REF))) !== 0)) {
					{
					{
					this.state = 433;
					this.modifier();
					}
					}
					this.state = 438;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 439;
				this.typeName();
				this.state = 443;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.PRIVATE) | (1 << LPCParser.PROTECTED) | (1 << LPCParser.PUBLIC) | (1 << LPCParser.STATIC) | (1 << LPCParser.NOMASK) | (1 << LPCParser.VARARGS) | (1 << LPCParser.NOSAVE) | (1 << LPCParser.REF))) !== 0)) {
					{
					{
					this.state = 440;
					this.modifier();
					}
					}
					this.state = 445;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
				break;

			case 3:
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 447;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 446;
					this.modifier();
					}
					}
					this.state = 449;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.PRIVATE) | (1 << LPCParser.PROTECTED) | (1 << LPCParser.PUBLIC) | (1 << LPCParser.STATIC) | (1 << LPCParser.NOMASK) | (1 << LPCParser.VARARGS) | (1 << LPCParser.NOSAVE) | (1 << LPCParser.REF))) !== 0));
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
	public typeName(): TypeNameContext {
		let _localctx: TypeNameContext = new TypeNameContext(this._ctx, this.state);
		this.enterRule(_localctx, 64, LPCParser.RULE_typeName);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 453;
			_la = this._input.LA(1);
			if (!(((((_la - 30)) & ~0x1F) === 0 && ((1 << (_la - 30)) & ((1 << (LPCParser.VOID - 30)) | (1 << (LPCParser.INT - 30)) | (1 << (LPCParser.STRING - 30)) | (1 << (LPCParser.OBJECT - 30)) | (1 << (LPCParser.ARRAY - 30)) | (1 << (LPCParser.MAPPING - 30)) | (1 << (LPCParser.FLOAT - 30)) | (1 << (LPCParser.BUFFER - 30)) | (1 << (LPCParser.MIXED - 30)) | (1 << (LPCParser.FUNCTION - 30)) | (1 << (LPCParser.CLASS - 30)) | (1 << (LPCParser.STRUCT - 30)) | (1 << (LPCParser.CLOSURE - 30)))) !== 0))) {
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
	public modifier(): ModifierContext {
		let _localctx: ModifierContext = new ModifierContext(this._ctx, this.state);
		this.enterRule(_localctx, 66, LPCParser.RULE_modifier);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 455;
			_la = this._input.LA(1);
			if (!((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.PRIVATE) | (1 << LPCParser.PROTECTED) | (1 << LPCParser.PUBLIC) | (1 << LPCParser.STATIC) | (1 << LPCParser.NOMASK) | (1 << LPCParser.VARARGS) | (1 << LPCParser.NOSAVE) | (1 << LPCParser.REF))) !== 0))) {
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
	public identifier(): IdentifierContext {
		let _localctx: IdentifierContext = new IdentifierContext(this._ctx, this.state);
		this.enterRule(_localctx, 68, LPCParser.RULE_identifier);
		try {
			this.state = 459;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case LPCParser.IDENTIFIER:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 457;
				this.match(LPCParser.IDENTIFIER);
				}
				break;
			case LPCParser.EFUN:
			case LPCParser.NEW:
			case LPCParser.CATCH:
			case LPCParser.SSCANF:
			case LPCParser.PARSE_COMMAND:
			case LPCParser.TIME_EXPRESSION:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 458;
				this.keywordIdentifier();
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
	public keywordIdentifier(): KeywordIdentifierContext {
		let _localctx: KeywordIdentifierContext = new KeywordIdentifierContext(this._ctx, this.state);
		this.enterRule(_localctx, 70, LPCParser.RULE_keywordIdentifier);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 461;
			_la = this._input.LA(1);
			if (!((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.EFUN) | (1 << LPCParser.NEW) | (1 << LPCParser.CATCH) | (1 << LPCParser.SSCANF) | (1 << LPCParser.PARSE_COMMAND) | (1 << LPCParser.TIME_EXPRESSION))) !== 0))) {
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
	public ifStatement(): IfStatementContext {
		let _localctx: IfStatementContext = new IfStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 72, LPCParser.RULE_ifStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 463;
			this.match(LPCParser.IF);
			this.state = 464;
			this.match(LPCParser.LPAREN);
			this.state = 465;
			this.expression(0);
			this.state = 466;
			this.match(LPCParser.RPAREN);
			this.state = 467;
			this.statement();
			this.state = 470;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 45, this._ctx) ) {
			case 1:
				{
				this.state = 468;
				this.match(LPCParser.ELSE);
				this.state = 469;
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
	public forStatement(): ForStatementContext {
		let _localctx: ForStatementContext = new ForStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 74, LPCParser.RULE_forStatement);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 472;
			this.match(LPCParser.FOR);
			this.state = 473;
			this.match(LPCParser.LPAREN);
			this.state = 476;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case LPCParser.PRIVATE:
			case LPCParser.PROTECTED:
			case LPCParser.PUBLIC:
			case LPCParser.STATIC:
			case LPCParser.NOMASK:
			case LPCParser.VARARGS:
			case LPCParser.NOSAVE:
			case LPCParser.REF:
			case LPCParser.VOID:
			case LPCParser.INT:
			case LPCParser.STRING:
			case LPCParser.OBJECT:
			case LPCParser.ARRAY:
			case LPCParser.MAPPING:
			case LPCParser.FLOAT:
			case LPCParser.BUFFER:
			case LPCParser.MIXED:
			case LPCParser.FUNCTION:
			case LPCParser.CLASS:
			case LPCParser.STRUCT:
			case LPCParser.CLOSURE:
				{
				this.state = 474;
				this.variableDeclaration();
				}
				break;
			case LPCParser.EFUN:
			case LPCParser.NEW:
			case LPCParser.CATCH:
			case LPCParser.SSCANF:
			case LPCParser.PARSE_COMMAND:
			case LPCParser.TIME_EXPRESSION:
			case LPCParser.LPAREN:
			case LPCParser.SCOPE_RESOLUTION:
			case LPCParser.MINUS:
			case LPCParser.INC:
			case LPCParser.DEC:
			case LPCParser.NOT:
			case LPCParser.BITWISE_NOT:
			case LPCParser.STRING_LITERAL:
			case LPCParser.NUMBER:
			case LPCParser.IDENTIFIER:
				{
				this.state = 475;
				this.expression(0);
				}
				break;
			case LPCParser.SEMICOLON:
				break;
			default:
				break;
			}
			this.state = 478;
			this.match(LPCParser.SEMICOLON);
			this.state = 480;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.EFUN) | (1 << LPCParser.NEW) | (1 << LPCParser.CATCH) | (1 << LPCParser.SSCANF) | (1 << LPCParser.PARSE_COMMAND) | (1 << LPCParser.TIME_EXPRESSION))) !== 0) || ((((_la - 58)) & ~0x1F) === 0 && ((1 << (_la - 58)) & ((1 << (LPCParser.LPAREN - 58)) | (1 << (LPCParser.SCOPE_RESOLUTION - 58)) | (1 << (LPCParser.MINUS - 58)) | (1 << (LPCParser.INC - 58)) | (1 << (LPCParser.DEC - 58)))) !== 0) || ((((_la - 91)) & ~0x1F) === 0 && ((1 << (_la - 91)) & ((1 << (LPCParser.NOT - 91)) | (1 << (LPCParser.BITWISE_NOT - 91)) | (1 << (LPCParser.STRING_LITERAL - 91)) | (1 << (LPCParser.NUMBER - 91)) | (1 << (LPCParser.IDENTIFIER - 91)))) !== 0)) {
				{
				this.state = 479;
				this.expression(0);
				}
			}

			this.state = 482;
			this.match(LPCParser.SEMICOLON);
			this.state = 484;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.EFUN) | (1 << LPCParser.NEW) | (1 << LPCParser.CATCH) | (1 << LPCParser.SSCANF) | (1 << LPCParser.PARSE_COMMAND) | (1 << LPCParser.TIME_EXPRESSION))) !== 0) || ((((_la - 58)) & ~0x1F) === 0 && ((1 << (_la - 58)) & ((1 << (LPCParser.LPAREN - 58)) | (1 << (LPCParser.SCOPE_RESOLUTION - 58)) | (1 << (LPCParser.MINUS - 58)) | (1 << (LPCParser.INC - 58)) | (1 << (LPCParser.DEC - 58)))) !== 0) || ((((_la - 91)) & ~0x1F) === 0 && ((1 << (_la - 91)) & ((1 << (LPCParser.NOT - 91)) | (1 << (LPCParser.BITWISE_NOT - 91)) | (1 << (LPCParser.STRING_LITERAL - 91)) | (1 << (LPCParser.NUMBER - 91)) | (1 << (LPCParser.IDENTIFIER - 91)))) !== 0)) {
				{
				this.state = 483;
				this.expression(0);
				}
			}

			this.state = 486;
			this.match(LPCParser.RPAREN);
			this.state = 487;
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
	public whileStatement(): WhileStatementContext {
		let _localctx: WhileStatementContext = new WhileStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 76, LPCParser.RULE_whileStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 489;
			this.match(LPCParser.WHILE);
			this.state = 490;
			this.match(LPCParser.LPAREN);
			this.state = 491;
			this.expression(0);
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
		this.enterRule(_localctx, 78, LPCParser.RULE_doWhileStatement);
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
			this.expression(0);
			this.state = 500;
			this.match(LPCParser.RPAREN);
			this.state = 501;
			this.match(LPCParser.SEMICOLON);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(_localctx, 80, LPCParser.RULE_foreachStatement);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 503;
			this.match(LPCParser.FOREACH);
			this.state = 504;
			this.match(LPCParser.LPAREN);
			this.state = 506;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 22)) & ~0x1F) === 0 && ((1 << (_la - 22)) & ((1 << (LPCParser.PRIVATE - 22)) | (1 << (LPCParser.PROTECTED - 22)) | (1 << (LPCParser.PUBLIC - 22)) | (1 << (LPCParser.STATIC - 22)) | (1 << (LPCParser.NOMASK - 22)) | (1 << (LPCParser.VARARGS - 22)) | (1 << (LPCParser.NOSAVE - 22)) | (1 << (LPCParser.REF - 22)) | (1 << (LPCParser.VOID - 22)) | (1 << (LPCParser.INT - 22)) | (1 << (LPCParser.STRING - 22)) | (1 << (LPCParser.OBJECT - 22)) | (1 << (LPCParser.ARRAY - 22)) | (1 << (LPCParser.MAPPING - 22)) | (1 << (LPCParser.FLOAT - 22)) | (1 << (LPCParser.BUFFER - 22)) | (1 << (LPCParser.MIXED - 22)) | (1 << (LPCParser.FUNCTION - 22)) | (1 << (LPCParser.CLASS - 22)) | (1 << (LPCParser.STRUCT - 22)) | (1 << (LPCParser.CLOSURE - 22)))) !== 0)) {
				{
				this.state = 505;
				this.typeSpecifier();
				}
			}

			this.state = 508;
			this.identifier();
			this.state = 509;
			this.match(LPCParser.IN);
			this.state = 510;
			this.expression(0);
			this.state = 511;
			this.match(LPCParser.RPAREN);
			this.state = 512;
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
	public switchStatement(): SwitchStatementContext {
		let _localctx: SwitchStatementContext = new SwitchStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 82, LPCParser.RULE_switchStatement);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 514;
			this.match(LPCParser.SWITCH);
			this.state = 515;
			this.match(LPCParser.LPAREN);
			this.state = 516;
			this.expression(0);
			this.state = 517;
			this.match(LPCParser.RPAREN);
			this.state = 518;
			this.match(LPCParser.LBRACE);
			this.state = 520;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === LPCParser.CASE || _la === LPCParser.DEFAULT) {
				{
				this.state = 519;
				this.switchBlock();
				}
			}

			this.state = 522;
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
	public switchBlock(): SwitchBlockContext {
		let _localctx: SwitchBlockContext = new SwitchBlockContext(this._ctx, this.state);
		this.enterRule(_localctx, 84, LPCParser.RULE_switchBlock);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 526;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				this.state = 526;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case LPCParser.CASE:
					{
					this.state = 524;
					this.caseClause();
					}
					break;
				case LPCParser.DEFAULT:
					{
					this.state = 525;
					this.defaultClause();
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 528;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while (_la === LPCParser.CASE || _la === LPCParser.DEFAULT);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public caseClause(): CaseClauseContext {
		let _localctx: CaseClauseContext = new CaseClauseContext(this._ctx, this.state);
		this.enterRule(_localctx, 86, LPCParser.RULE_caseClause);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 530;
			this.match(LPCParser.CASE);
			this.state = 531;
			this.expression(0);
			this.state = 532;
			this.match(LPCParser.COLON);
			this.state = 536;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.IF) | (1 << LPCParser.WHILE) | (1 << LPCParser.FOR) | (1 << LPCParser.DO) | (1 << LPCParser.SWITCH) | (1 << LPCParser.BREAK) | (1 << LPCParser.CONTINUE) | (1 << LPCParser.RETURN) | (1 << LPCParser.FOREACH) | (1 << LPCParser.FALLTHROUGH) | (1 << LPCParser.EFUN) | (1 << LPCParser.NEW) | (1 << LPCParser.CATCH) | (1 << LPCParser.SSCANF) | (1 << LPCParser.PARSE_COMMAND) | (1 << LPCParser.TIME_EXPRESSION) | (1 << LPCParser.PRIVATE) | (1 << LPCParser.PROTECTED) | (1 << LPCParser.PUBLIC) | (1 << LPCParser.STATIC) | (1 << LPCParser.NOMASK) | (1 << LPCParser.VARARGS) | (1 << LPCParser.NOSAVE) | (1 << LPCParser.REF) | (1 << LPCParser.VOID) | (1 << LPCParser.INT))) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & ((1 << (LPCParser.STRING - 32)) | (1 << (LPCParser.OBJECT - 32)) | (1 << (LPCParser.ARRAY - 32)) | (1 << (LPCParser.MAPPING - 32)) | (1 << (LPCParser.FLOAT - 32)) | (1 << (LPCParser.BUFFER - 32)) | (1 << (LPCParser.MIXED - 32)) | (1 << (LPCParser.FUNCTION - 32)) | (1 << (LPCParser.CLASS - 32)) | (1 << (LPCParser.STRUCT - 32)) | (1 << (LPCParser.CLOSURE - 32)) | (1 << (LPCParser.LBRACE - 32)) | (1 << (LPCParser.LPAREN - 32)))) !== 0) || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & ((1 << (LPCParser.SCOPE_RESOLUTION - 74)) | (1 << (LPCParser.MINUS - 74)) | (1 << (LPCParser.INC - 74)) | (1 << (LPCParser.DEC - 74)) | (1 << (LPCParser.NOT - 74)) | (1 << (LPCParser.BITWISE_NOT - 74)) | (1 << (LPCParser.STRING_LITERAL - 74)) | (1 << (LPCParser.NUMBER - 74)) | (1 << (LPCParser.IDENTIFIER - 74)))) !== 0)) {
				{
				{
				this.state = 533;
				this.statement();
				}
				}
				this.state = 538;
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
	public defaultClause(): DefaultClauseContext {
		let _localctx: DefaultClauseContext = new DefaultClauseContext(this._ctx, this.state);
		this.enterRule(_localctx, 88, LPCParser.RULE_defaultClause);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 539;
			this.match(LPCParser.DEFAULT);
			this.state = 540;
			this.match(LPCParser.COLON);
			this.state = 544;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.IF) | (1 << LPCParser.WHILE) | (1 << LPCParser.FOR) | (1 << LPCParser.DO) | (1 << LPCParser.SWITCH) | (1 << LPCParser.BREAK) | (1 << LPCParser.CONTINUE) | (1 << LPCParser.RETURN) | (1 << LPCParser.FOREACH) | (1 << LPCParser.FALLTHROUGH) | (1 << LPCParser.EFUN) | (1 << LPCParser.NEW) | (1 << LPCParser.CATCH) | (1 << LPCParser.SSCANF) | (1 << LPCParser.PARSE_COMMAND) | (1 << LPCParser.TIME_EXPRESSION) | (1 << LPCParser.PRIVATE) | (1 << LPCParser.PROTECTED) | (1 << LPCParser.PUBLIC) | (1 << LPCParser.STATIC) | (1 << LPCParser.NOMASK) | (1 << LPCParser.VARARGS) | (1 << LPCParser.NOSAVE) | (1 << LPCParser.REF) | (1 << LPCParser.VOID) | (1 << LPCParser.INT))) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & ((1 << (LPCParser.STRING - 32)) | (1 << (LPCParser.OBJECT - 32)) | (1 << (LPCParser.ARRAY - 32)) | (1 << (LPCParser.MAPPING - 32)) | (1 << (LPCParser.FLOAT - 32)) | (1 << (LPCParser.BUFFER - 32)) | (1 << (LPCParser.MIXED - 32)) | (1 << (LPCParser.FUNCTION - 32)) | (1 << (LPCParser.CLASS - 32)) | (1 << (LPCParser.STRUCT - 32)) | (1 << (LPCParser.CLOSURE - 32)) | (1 << (LPCParser.LBRACE - 32)) | (1 << (LPCParser.LPAREN - 32)))) !== 0) || ((((_la - 74)) & ~0x1F) === 0 && ((1 << (_la - 74)) & ((1 << (LPCParser.SCOPE_RESOLUTION - 74)) | (1 << (LPCParser.MINUS - 74)) | (1 << (LPCParser.INC - 74)) | (1 << (LPCParser.DEC - 74)) | (1 << (LPCParser.NOT - 74)) | (1 << (LPCParser.BITWISE_NOT - 74)) | (1 << (LPCParser.STRING_LITERAL - 74)) | (1 << (LPCParser.NUMBER - 74)) | (1 << (LPCParser.IDENTIFIER - 74)))) !== 0)) {
				{
				{
				this.state = 541;
				this.statement();
				}
				}
				this.state = 546;
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
	public returnStatement(): ReturnStatementContext {
		let _localctx: ReturnStatementContext = new ReturnStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 90, LPCParser.RULE_returnStatement);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 547;
			this.match(LPCParser.RETURN);
			this.state = 549;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << LPCParser.EFUN) | (1 << LPCParser.NEW) | (1 << LPCParser.CATCH) | (1 << LPCParser.SSCANF) | (1 << LPCParser.PARSE_COMMAND) | (1 << LPCParser.TIME_EXPRESSION))) !== 0) || ((((_la - 58)) & ~0x1F) === 0 && ((1 << (_la - 58)) & ((1 << (LPCParser.LPAREN - 58)) | (1 << (LPCParser.SCOPE_RESOLUTION - 58)) | (1 << (LPCParser.MINUS - 58)) | (1 << (LPCParser.INC - 58)) | (1 << (LPCParser.DEC - 58)))) !== 0) || ((((_la - 91)) & ~0x1F) === 0 && ((1 << (_la - 91)) & ((1 << (LPCParser.NOT - 91)) | (1 << (LPCParser.BITWISE_NOT - 91)) | (1 << (LPCParser.STRING_LITERAL - 91)) | (1 << (LPCParser.NUMBER - 91)) | (1 << (LPCParser.IDENTIFIER - 91)))) !== 0)) {
				{
				this.state = 548;
				this.expression(0);
				}
			}

			this.state = 551;
			this.match(LPCParser.SEMICOLON);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(_localctx, 92, LPCParser.RULE_breakStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 553;
			this.match(LPCParser.BREAK);
			this.state = 554;
			this.match(LPCParser.SEMICOLON);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
		this.enterRule(_localctx, 94, LPCParser.RULE_continueStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 556;
			this.match(LPCParser.CONTINUE);
			this.state = 557;
			this.match(LPCParser.SEMICOLON);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public fallthroughStatement(): FallthroughStatementContext {
		let _localctx: FallthroughStatementContext = new FallthroughStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 96, LPCParser.RULE_fallthroughStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 559;
			this.match(LPCParser.FALLTHROUGH);
			this.state = 560;
			this.match(LPCParser.SEMICOLON);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}

	public sempred(_localctx: RuleContext, ruleIndex: number, predIndex: number): boolean {
		switch (ruleIndex) {
		case 18:
			return this.expression_sempred(_localctx as ExpressionContext, predIndex);
		}
		return true;
	}
	private expression_sempred(_localctx: ExpressionContext, predIndex: number): boolean {
		switch (predIndex) {
		case 0:
			return this.precpred(this._ctx, 13);

		case 1:
			return this.precpred(this._ctx, 12);

		case 2:
			return this.precpred(this._ctx, 11);

		case 3:
			return this.precpred(this._ctx, 10);

		case 4:
			return this.precpred(this._ctx, 9);

		case 5:
			return this.precpred(this._ctx, 8);

		case 6:
			return this.precpred(this._ctx, 7);

		case 7:
			return this.precpred(this._ctx, 6);

		case 8:
			return this.precpred(this._ctx, 4);

		case 9:
			return this.precpred(this._ctx, 3);

		case 10:
			return this.precpred(this._ctx, 2);

		case 11:
			return this.precpred(this._ctx, 1);

		case 12:
			return this.precpred(this._ctx, 23);

		case 13:
			return this.precpred(this._ctx, 22);

		case 14:
			return this.precpred(this._ctx, 21);

		case 15:
			return this.precpred(this._ctx, 20);

		case 16:
			return this.precpred(this._ctx, 19);

		case 17:
			return this.precpred(this._ctx, 18);

		case 18:
			return this.precpred(this._ctx, 5);
		}
		return true;
	}

	private static readonly _serializedATNSegments: number = 2;
	private static readonly _serializedATNSegment0: string =
		"\x03\uC91D\uCABA\u058D\uAFBA\u4F53\u0607\uEA8B\uC241\x03q\u0235\x04\x02" +
		"\t\x02\x04\x03\t\x03\x04\x04\t\x04\x04\x05\t\x05\x04\x06\t\x06\x04\x07" +
		"\t\x07\x04\b\t\b\x04\t\t\t\x04\n\t\n\x04\v\t\v\x04\f\t\f\x04\r\t\r\x04" +
		"\x0E\t\x0E\x04\x0F\t\x0F\x04\x10\t\x10\x04\x11\t\x11\x04\x12\t\x12\x04" +
		"\x13\t\x13\x04\x14\t\x14\x04\x15\t\x15\x04\x16\t\x16\x04\x17\t\x17\x04" +
		"\x18\t\x18\x04\x19\t\x19\x04\x1A\t\x1A\x04\x1B\t\x1B\x04\x1C\t\x1C\x04" +
		"\x1D\t\x1D\x04\x1E\t\x1E\x04\x1F\t\x1F\x04 \t \x04!\t!\x04\"\t\"\x04#" +
		"\t#\x04$\t$\x04%\t%\x04&\t&\x04\'\t\'\x04(\t(\x04)\t)\x04*\t*\x04+\t+" +
		"\x04,\t,\x04-\t-\x04.\t.\x04/\t/\x040\t0\x041\t1\x042\t2\x03\x02\x07\x02" +
		"f\n\x02\f\x02\x0E\x02i\v\x02\x03\x02\x03\x02\x03\x03\x03\x03\x03\x03\x03" +
		"\x03\x05\x03q\n\x03\x03\x04\x03\x04\x03\x04\x03\x04\x03\x04\x03\x04\x03" +
		"\x04\x03\x04\x03\x04\x03\x04\x03\x04\x03\x04\x03\x04\x05\x04\x80\n\x04" +
		"\x03\x05\x03\x05\x07\x05\x84\n\x05\f\x05\x0E\x05\x87\v\x05\x03\x05\x03" +
		"\x05\x03\x06\x03\x06\x03\x06\x03\x07\x03\x07\x03\x07\x03\x07\x07\x07\x92" +
		"\n\x07\f\x07\x0E\x07\x95\v\x07\x03\x07\x03\x07\x03\b\x07\b\x9A\n\b\f\b" +
		"\x0E\b\x9D\v\b\x03\b\x03\b\x03\b\x05\b\xA2\n\b\x03\t\x03\t\x03\t\x03\t" +
		"\x05\t\xA8\n\t\x03\t\x03\t\x03\t\x05\t\xAD\n\t\x03\n\x03\n\x03\n\x07\n" +
		"\xB2\n\n\f\n\x0E\n\xB5\v\n\x03\n\x03\n\x05\n\xB9\n\n\x03\n\x05\n\xBC\n" +
		"\n\x03\v\x03\v\x07\v\xC0\n\v\f\v\x0E\v\xC3\v\v\x03\v\x03\v\x03\v\x05\v" +
		"\xC8\n\v\x03\f\x03\f\x03\f\x03\f\x03\r\x03\r\x03\r\x03\r\x03\r\x05\r\xD3" +
		"\n\r\x03\x0E\x03\x0E\x03\x0E\x03\x0F\x03\x0F\x03\x0F\x05\x0F\xDB\n\x0F" +
		"\x03\x10\x03\x10\x03\x10\x03\x10\x05\x10\xE1\n\x10\x05\x10\xE3\n\x10\x03" +
		"\x10\x07\x10\xE6\n\x10\f\x10\x0E\x10\xE9\v\x10\x03\x10\x03\x10\x05\x10" +
		"\xED\n\x10\x03\x10\x07\x10\xF0\n\x10\f\x10\x0E\x10\xF3\v\x10\x05\x10\xF5" +
		"\n\x10\x03\x10\x03\x10\x05\x10\xF9\n\x10\x03\x11\x03\x11\x05\x11\xFD\n" +
		"\x11\x03\x12\x03\x12\x05\x12\u0101\n\x12\x03\x13\x03\x13\x03\x14\x03\x14" +
		"\x03\x14\x03\x14\x03\x14\x03\x14\x03\x14\x03\x14\x03\x14\x05\x14\u010E" +
		"\n\x14\x03\x14\x03\x14\x03\x14\x03\x14\x03\x14\x03\x14\x03\x14\x03\x14" +
		"\x03\x14\x03\x14\x03\x14\x03\x14\x03\x14\x03\x14\x03\x14\x03\x14\x03\x14" +
		"\x03\x14\x03\x14\x03\x14\x03\x14\x03\x14\x03\x14\x03\x14\x03\x14\x03\x14" +
		"\x03\x14\x03\x14\x03\x14\x03\x14\x03\x14\x03\x14\x03\x14\x03\x14\x03\x14" +
		"\x03\x14\x03\x14\x03\x14\x03\x14\x03\x14\x03\x14\x03\x14\x03\x14\x03\x14" +
		"\x03\x14\x03\x14\x03\x14\x03\x14\x03\x14\x03\x14\x03\x14\x03\x14\x03\x14" +
		"\x03\x14\x03\x14\x05\x14\u0147\n\x14\x03\x14\x03\x14\x03\x14\x03\x14\x03" +
		"\x14\x03\x14\x03\x14\x03\x14\x03\x14\x03\x14\x07\x14\u0153\n\x14\f\x14" +
		"\x0E\x14\u0156\v\x14\x03\x15\x03\x15\x03\x15\x03\x15\x03\x15\x03\x16\x03" +
		"\x16\x03\x16\x03\x16\x03\x16\x03\x16\x05\x16\u0163\n\x16\x03\x17\x03\x17" +
		"\x03\x18\x03\x18\x03\x18\x03\x18\x03\x18\x03\x18\x03\x18\x03\x18\x03\x18" +
		"\x03\x18\x03\x18\x03\x18\x03\x18\x05\x18\u0174\n\x18\x03\x19\x03\x19\x03" +
		"\x19\x07\x19\u0179\n\x19\f\x19\x0E\x19\u017C\v\x19\x03\x1A\x03\x1A\x05" +
		"\x1A\u0180\n\x1A\x03\x1B\x03\x1B\x03\x1C\x03\x1C\x03\x1C\x05\x1C\u0187" +
		"\n\x1C\x03\x1C\x03\x1C\x03\x1C\x03\x1D\x03\x1D\x03\x1D\x07\x1D\u018F\n" +
		"\x1D\f\x1D\x0E\x1D\u0192\v\x1D\x03\x1D\x05\x1D\u0195\n\x1D\x03\x1E\x03" +
		"\x1E\x03\x1E\x03\x1E\x03\x1F\x03\x1F\x03\x1F\x05\x1F\u019E\n\x1F\x03\x1F" +
		"\x03\x1F\x03\x1F\x03 \x03 \x03 \x07 \u01A6\n \f \x0E \u01A9\v \x03 \x05" +
		" \u01AC\n \x03!\x06!\u01AF\n!\r!\x0E!\u01B0\x03!\x03!\x07!\u01B5\n!\f" +
		"!\x0E!\u01B8\v!\x03!\x03!\x07!\u01BC\n!\f!\x0E!\u01BF\v!\x03!\x06!\u01C2" +
		"\n!\r!\x0E!\u01C3\x05!\u01C6\n!\x03\"\x03\"\x03#\x03#\x03$\x03$\x05$\u01CE" +
		"\n$\x03%\x03%\x03&\x03&\x03&\x03&\x03&\x03&\x03&\x05&\u01D9\n&\x03\'\x03" +
		"\'\x03\'\x03\'\x05\'\u01DF\n\'\x03\'\x03\'\x05\'\u01E3\n\'\x03\'\x03\'" +
		"\x05\'\u01E7\n\'\x03\'\x03\'\x03\'\x03(\x03(\x03(\x03(\x03(\x03(\x03)" +
		"\x03)\x03)\x03)\x03)\x03)\x03)\x03)\x03*\x03*\x03*\x05*\u01FD\n*\x03*" +
		"\x03*\x03*\x03*\x03*\x03*\x03+\x03+\x03+\x03+\x03+\x03+\x05+\u020B\n+" +
		"\x03+\x03+\x03,\x03,\x06,\u0211\n,\r,\x0E,\u0212\x03-\x03-\x03-\x03-\x07" +
		"-\u0219\n-\f-\x0E-\u021C\v-\x03.\x03.\x03.\x07.\u0221\n.\f.\x0E.\u0224" +
		"\v.\x03/\x03/\x05/\u0228\n/\x03/\x03/\x030\x030\x030\x031\x031\x031\x03" +
		"2\x032\x032\x032\x02\x02\x03&3\x02\x02\x04\x02\x06\x02\b\x02\n\x02\f\x02" +
		"\x0E\x02\x10\x02\x12\x02\x14\x02\x16\x02\x18\x02\x1A\x02\x1C\x02\x1E\x02" +
		" \x02\"\x02$\x02&\x02(\x02*\x02,\x02.\x020\x022\x024\x026\x028\x02:\x02" +
		"<\x02>\x02@\x02B\x02D\x02F\x02H\x02J\x02L\x02N\x02P\x02R\x02T\x02V\x02" +
		"X\x02Z\x02\\\x02^\x02`\x02b\x02\x02\x10\x04\x02ffii\x03\x02fg\x03\x02" +
		"01\x05\x02QQ]]cc\x03\x02RT\x03\x02PQ\x03\x02de\x03\x02Y\\\x03\x02WX\x03" +
		"\x02>H\x04\x02ffhh\x03\x02 ,\x03\x02\x18\x1F\x03\x02\x12\x17\x02\u0267" +
		"\x02g\x03\x02\x02\x02\x04p\x03\x02\x02\x02\x06\x7F\x03\x02\x02\x02\b\x81" +
		"\x03\x02\x02\x02\n\x8A\x03\x02\x02\x02\f\x8D\x03\x02\x02\x02\x0E\x9B\x03" +
		"\x02\x02\x02\x10\xA3\x03\x02\x02\x02\x12\xBB\x03\x02\x02\x02\x14\xBD\x03" +
		"\x02\x02\x02\x16\xC9\x03\x02\x02\x02\x18\xD2\x03\x02\x02\x02\x1A\xD4\x03" +
		"\x02\x02\x02\x1C\xD7\x03\x02\x02\x02\x1E\xE2\x03\x02\x02\x02 \xFA\x03" +
		"\x02\x02\x02\"\xFE\x03\x02\x02\x02$\u0102\x03\x02\x02\x02&\u010D\x03\x02" +
		"\x02\x02(\u0157\x03\x02\x02\x02*\u015C\x03\x02\x02\x02,\u0164\x03\x02" +
		"\x02\x02.\u0173\x03\x02\x02\x020\u0175\x03\x02\x02\x022\u017F\x03\x02" +
		"\x02\x024\u0181\x03\x02\x02\x026\u0183\x03\x02\x02\x028\u018B\x03\x02" +
		"\x02\x02:\u0196\x03\x02\x02\x02<\u019A\x03\x02\x02\x02>\u01A2\x03\x02" +
		"\x02\x02@\u01C5\x03\x02\x02\x02B\u01C7\x03\x02\x02\x02D\u01C9\x03\x02" +
		"\x02\x02F\u01CD\x03\x02\x02\x02H\u01CF\x03\x02\x02\x02J\u01D1\x03\x02" +
		"\x02\x02L\u01DA\x03\x02\x02\x02N\u01EB\x03\x02\x02\x02P\u01F1\x03\x02" +
		"\x02\x02R\u01F9\x03\x02\x02\x02T\u0204\x03\x02\x02\x02V\u0210\x03\x02" +
		"\x02\x02X\u0214\x03\x02\x02\x02Z\u021D\x03\x02\x02\x02\\\u0225\x03\x02" +
		"\x02\x02^\u022B\x03\x02\x02\x02`\u022E\x03\x02\x02\x02b\u0231\x03\x02" +
		"\x02\x02df\x05\x04\x03\x02ed\x03\x02\x02\x02fi\x03\x02\x02\x02ge\x03\x02" +
		"\x02\x02gh\x03\x02\x02\x02hj\x03\x02\x02\x02ig\x03\x02\x02\x02jk\x07\x02" +
		"\x02\x03k\x03\x03\x02\x02\x02lq\x05\x18\r\x02mq\x05\x16\f\x02nq\x05\x10" +
		"\t\x02oq\x05\f\x07\x02pl\x03\x02\x02\x02pm\x03\x02\x02\x02pn\x03\x02\x02" +
		"\x02po\x03\x02\x02\x02q\x05\x03\x02\x02\x02r\x80\x05\b\x05\x02s\x80\x05" +
		"\f\x07\x02t\x80\x05\n\x06\x02u\x80\x05\\/\x02v\x80\x05J&\x02w\x80\x05" +
		"L\'\x02x\x80\x05R*\x02y\x80\x05N(\x02z\x80\x05P)\x02{\x80\x05T+\x02|\x80" +
		"\x05^0\x02}\x80\x05`1\x02~\x80\x05b2\x02\x7Fr\x03\x02\x02\x02\x7Fs\x03" +
		"\x02\x02\x02\x7Ft\x03\x02\x02\x02\x7Fu\x03\x02\x02\x02\x7Fv\x03\x02\x02" +
		"\x02\x7Fw\x03\x02\x02\x02\x7Fx\x03\x02\x02\x02\x7Fy\x03\x02\x02\x02\x7F" +
		"z\x03\x02\x02\x02\x7F{\x03\x02\x02\x02\x7F|\x03\x02\x02\x02\x7F}\x03\x02" +
		"\x02\x02\x7F~\x03\x02\x02\x02\x80\x07\x03\x02\x02\x02\x81\x85\x079\x02" +
		"\x02\x82\x84\x05\x06\x04\x02\x83\x82\x03\x02\x02\x02\x84\x87\x03\x02\x02" +
		"\x02\x85\x83\x03\x02\x02\x02\x85\x86\x03\x02\x02\x02\x86\x88\x03\x02\x02" +
		"\x02\x87\x85\x03\x02\x02\x02\x88\x89\x07:\x02\x02\x89\t\x03\x02\x02\x02" +
		"\x8A\x8B\x05&\x14\x02\x8B\x8C\x07;\x02\x02\x8C\v\x03\x02\x02\x02\x8D\x8E" +
		"\x05@!\x02\x8E\x93\x05\x0E\b\x02\x8F\x90\x07I\x02\x02\x90\x92\x05\x0E" +
		"\b\x02\x91\x8F\x03\x02\x02\x02\x92\x95\x03\x02\x02\x02\x93\x91\x03\x02" +
		"\x02\x02\x93\x94\x03\x02\x02\x02\x94\x96\x03\x02\x02\x02\x95\x93\x03\x02" +
		"\x02\x02\x96\x97\x07;\x02\x02\x97\r\x03\x02\x02\x02\x98\x9A\x07R\x02\x02" +
		"\x99\x98\x03\x02\x02\x02\x9A\x9D\x03\x02\x02\x02\x9B\x99\x03\x02\x02\x02" +
		"\x9B\x9C\x03\x02\x02\x02\x9C\x9E\x03\x02\x02\x02\x9D\x9B\x03\x02\x02\x02" +
		"\x9E\xA1\x05F$\x02\x9F\xA0\x07>\x02\x02\xA0\xA2\x05&\x14\x02\xA1\x9F\x03" +
		"\x02\x02\x02\xA1\xA2\x03\x02\x02\x02\xA2\x0F\x03\x02\x02\x02\xA3\xA4\x05" +
		"@!\x02\xA4\xA5\x05F$\x02\xA5\xA7\x07<\x02\x02\xA6\xA8\x05\x12\n\x02\xA7" +
		"\xA6\x03\x02\x02\x02\xA7\xA8\x03\x02\x02\x02\xA8\xA9\x03\x02\x02\x02\xA9" +
		"\xAC\x07=\x02\x02\xAA\xAD\x05\b\x05\x02\xAB\xAD\x07;\x02\x02\xAC\xAA\x03" +
		"\x02\x02\x02\xAC\xAB\x03\x02\x02\x02\xAD\x11\x03\x02\x02\x02\xAE\xB3\x05" +
		"\x14\v\x02\xAF\xB0\x07I\x02\x02\xB0\xB2\x05\x14\v\x02\xB1\xAF\x03\x02" +
		"\x02\x02\xB2\xB5\x03\x02\x02\x02\xB3\xB1\x03\x02\x02\x02\xB3\xB4\x03\x02" +
		"\x02\x02\xB4\xB8\x03\x02\x02\x02\xB5\xB3\x03\x02\x02\x02\xB6\xB7\x07I" +
		"\x02\x02\xB7\xB9\x07N\x02\x02\xB8\xB6\x03\x02\x02\x02\xB8\xB9\x03\x02" +
		"\x02\x02\xB9\xBC\x03\x02\x02\x02\xBA\xBC\x07N\x02\x02\xBB\xAE\x03\x02" +
		"\x02\x02\xBB\xBA\x03\x02\x02\x02\xBC\x13\x03\x02\x02\x02\xBD\xC1\x05@" +
		"!\x02\xBE\xC0\x07R\x02\x02\xBF\xBE\x03\x02\x02\x02\xC0\xC3\x03\x02\x02" +
		"\x02\xC1\xBF\x03\x02\x02\x02\xC1\xC2\x03\x02\x02\x02\xC2\xC4\x03\x02\x02" +
		"\x02\xC3\xC1\x03\x02\x02\x02\xC4\xC7\x05F$\x02\xC5\xC6\x07>\x02\x02\xC6" +
		"\xC8\x05&\x14\x02\xC7\xC5\x03\x02\x02\x02\xC7\xC8\x03\x02\x02\x02\xC8" +
		"\x15\x03\x02\x02\x02\xC9\xCA\x07\x11\x02\x02\xCA\xCB\t\x02\x02\x02\xCB" +
		"\xCC\x07;\x02\x02\xCC\x17\x03\x02\x02\x02\xCD\xD3\x05\x1A\x0E\x02\xCE" +
		"\xD3\x05\x1C\x0F\x02\xCF\xD3\x05 \x11\x02\xD0\xD3\x05\"\x12\x02\xD1\xD3" +
		"\x05\x1E\x10\x02\xD2\xCD\x03\x02\x02\x02\xD2\xCE\x03\x02\x02\x02\xD2\xCF" +
		"\x03\x02\x02\x02\xD2\xD0\x03\x02\x02\x02\xD2\xD1\x03\x02\x02\x02\xD3\x19" +
		"\x03\x02\x02\x02\xD4\xD5\x07.\x02\x02\xD5\xD6\t\x03\x02\x02\xD6\x1B\x03" +
		"\x02\x02\x02\xD7\xD8\x07/\x02\x02\xD8\xDA\x07i\x02\x02\xD9\xDB\x05$\x13" +
		"\x02\xDA\xD9\x03\x02\x02\x02\xDA\xDB\x03\x02\x02\x02\xDB\x1D\x03\x02\x02" +
		"\x02\xDC\xDD\t\x04\x02\x02\xDD\xE3\x07i\x02\x02\xDE\xE0\x072\x02\x02\xDF" +
		"\xE1\x05$\x13\x02\xE0\xDF\x03\x02\x02\x02\xE0\xE1\x03\x02\x02\x02\xE1" +
		"\xE3\x03\x02\x02\x02\xE2\xDC\x03\x02\x02\x02\xE2\xDE\x03\x02\x02\x02\xE3" +
		"\xE7\x03\x02\x02\x02\xE4\xE6\x05\x04\x03\x02\xE5\xE4\x03\x02\x02\x02\xE6" +
		"\xE9\x03\x02\x02\x02\xE7\xE5\x03\x02\x02\x02\xE7\xE8\x03\x02\x02\x02\xE8" +
		"\xF4\x03\x02\x02\x02\xE9\xE7\x03\x02\x02\x02\xEA\xEC\x073\x02\x02\xEB" +
		"\xED\x05$\x13\x02\xEC\xEB\x03\x02\x02\x02\xEC\xED\x03\x02\x02\x02\xED" +
		"\xF1\x03\x02\x02\x02\xEE\xF0\x05\x04\x03\x02\xEF\xEE\x03\x02\x02\x02\xF0" +
		"\xF3\x03\x02\x02\x02\xF1\xEF\x03\x02\x02\x02\xF1\xF2\x03\x02\x02\x02\xF2" +
		"\xF5\x03\x02\x02\x02\xF3\xF1\x03\x02\x02\x02\xF4\xEA\x03\x02\x02\x02\xF4" +
		"\xF5\x03\x02\x02\x02\xF5\xF6\x03\x02\x02\x02\xF6\xF8\x074\x02\x02\xF7" +
		"\xF9\x05$\x13\x02\xF8\xF7\x03\x02\x02\x02\xF8\xF9\x03\x02\x02\x02\xF9" +
		"\x1F\x03\x02\x02\x02\xFA\xFC\x075\x02\x02\xFB\xFD\x05$\x13\x02\xFC\xFB" +
		"\x03\x02\x02\x02\xFC\xFD\x03\x02\x02\x02\xFD!\x03\x02\x02\x02\xFE\u0100" +
		"\x076\x02\x02\xFF\u0101\x05$\x13\x02\u0100\xFF\x03\x02\x02\x02\u0100\u0101" +
		"\x03\x02\x02\x02\u0101#\x03\x02\x02\x02\u0102\u0103\x07-\x02\x02\u0103" +
		"%\x03\x02\x02\x02\u0104\u0105\b\x14\x01\x02\u0105\u010E\x05.\x18\x02\u0106" +
		"\u0107\x07U\x02\x02\u0107\u010E\x05&\x14\x13\u0108\u0109\x07V\x02\x02" +
		"\u0109\u010E\x05&\x14\x12\u010A\u010B\t\x05\x02\x02\u010B\u010E\x05&\x14" +
		"\x11\u010C\u010E\x05(\x15\x02\u010D\u0104\x03\x02\x02\x02\u010D\u0106" +
		"\x03\x02\x02\x02\u010D\u0108\x03\x02\x02\x02\u010D\u010A\x03\x02\x02\x02" +
		"\u010D\u010C\x03\x02\x02\x02\u010E\u0154\x03\x02\x02\x02\u010F\u0110\f" +
		"\x0F\x02\x02\u0110\u0111\t\x06\x02\x02\u0111\u0153\x05&\x14\x10\u0112" +
		"\u0113\f\x0E\x02\x02\u0113\u0114\t\x07\x02\x02\u0114\u0153\x05&\x14\x0F" +
		"\u0115\u0116\f\r\x02\x02\u0116\u0117\t\b\x02\x02\u0117\u0153\x05&\x14" +
		"\x0E\u0118\u0119\f\f\x02\x02\u0119\u011A\t\t\x02\x02\u011A\u0153\x05&" +
		"\x14\r\u011B\u011C\f\v\x02\x02\u011C\u011D\t\n\x02\x02\u011D\u0153\x05" +
		"&\x14\f\u011E\u011F\f\n\x02\x02\u011F\u0120\x07`\x02\x02\u0120\u0153\x05" +
		"&\x14\v\u0121\u0122\f\t\x02\x02\u0122\u0123\x07b\x02\x02\u0123\u0153\x05" +
		"&\x14\n\u0124\u0125\f\b\x02\x02\u0125\u0126\x07a\x02\x02\u0126\u0153\x05" +
		"&\x14\t\u0127\u0128\f\x06\x02\x02\u0128\u0129\x07^\x02\x02\u0129\u0153" +
		"\x05&\x14\x06\u012A\u012B\f\x05\x02\x02\u012B\u012C\x07_\x02\x02\u012C" +
		"\u0153\x05&\x14\x05\u012D\u012E\f\x04\x02\x02\u012E\u012F\x07J\x02\x02" +
		"\u012F\u0130\x05&\x14\x02\u0130\u0131\x07K\x02\x02\u0131\u0132\x05&\x14" +
		"\x04\u0132\u0153\x03\x02\x02\x02\u0133\u0134\f\x03\x02\x02\u0134\u0135" +
		"\x05,\x17\x02\u0135\u0136\x05&\x14\x03\u0136\u0153\x03\x02\x02\x02\u0137" +
		"\u0138\f\x19\x02\x02\u0138\u0139\x077\x02\x02\u0139\u013A\x05&\x14\x02" +
		"\u013A\u013B\x078\x02\x02\u013B\u0153\x03\x02\x02\x02\u013C\u013D\f\x18" +
		"\x02\x02\u013D\u013E\x077\x02\x02\u013E\u013F\x05&\x14\x02\u013F\u0140" +
		"\x07M\x02\x02\u0140\u0141\x05&\x14\x02\u0141\u0142\x078\x02\x02\u0142" +
		"\u0153\x03\x02\x02\x02\u0143\u0144\f\x17\x02\x02\u0144\u0146\x07<\x02" +
		"\x02\u0145\u0147\x050\x19\x02\u0146\u0145\x03\x02\x02\x02\u0146\u0147" +
		"\x03\x02\x02\x02\u0147\u0148\x03\x02\x02\x02\u0148\u0153\x07=\x02\x02" +
		"\u0149\u014A\f\x16\x02\x02\u014A\u014B\x07O\x02\x02\u014B\u0153\x05F$" +
		"\x02\u014C\u014D\f\x15\x02\x02\u014D\u0153\x07U\x02\x02\u014E\u014F\f" +
		"\x14\x02\x02\u014F\u0153\x07V\x02\x02\u0150\u0151\f\x07\x02\x02\u0151" +
		"\u0153\x05.\x18\x02\u0152\u010F\x03\x02\x02\x02\u0152\u0112\x03\x02\x02" +
		"\x02\u0152\u0115\x03\x02\x02\x02\u0152\u0118\x03\x02\x02\x02\u0152\u011B" +
		"\x03\x02\x02\x02\u0152\u011E\x03\x02\x02\x02\u0152\u0121\x03\x02\x02\x02" +
		"\u0152\u0124\x03\x02\x02\x02\u0152\u0127\x03\x02\x02\x02\u0152\u012A\x03" +
		"\x02\x02\x02\u0152\u012D\x03\x02\x02\x02\u0152\u0133\x03\x02\x02\x02\u0152" +
		"\u0137\x03\x02\x02\x02\u0152\u013C\x03\x02\x02\x02\u0152\u0143\x03\x02" +
		"\x02\x02\u0152\u0149\x03\x02\x02\x02\u0152\u014C\x03\x02\x02\x02\u0152" +
		"\u014E\x03\x02\x02\x02\u0152\u0150\x03\x02\x02\x02\u0153\u0156\x03\x02" +
		"\x02\x02\u0154\u0152\x03\x02\x02\x02\u0154\u0155\x03\x02\x02\x02\u0155" +
		"\'\x03\x02\x02\x02\u0156\u0154\x03\x02\x02\x02\u0157\u0158\x07<\x02\x02" +
		"\u0158\u0159\x05@!\x02\u0159\u015A\x07=\x02\x02\u015A\u015B\x05.\x18\x02" +
		"\u015B)\x03\x02\x02\x02\u015C\u015D\x07<\x02\x02\u015D\u015E\x07K\x02" +
		"\x02\u015E\u0162\x05&\x14\x02\u015F\u0160\x07K\x02\x02\u0160\u0163\x07" +
		"=\x02\x02\u0161\u0163\x07=\x02\x02\u0162\u015F\x03\x02\x02\x02\u0162\u0161" +
		"\x03\x02\x02\x02\u0163+\x03\x02\x02\x02\u0164\u0165\t\v\x02\x02\u0165" +
		"-\x03\x02\x02\x02\u0166\u0167\x07<\x02\x02\u0167\u0168\x05&\x14\x02\u0168" +
		"\u0169\x07=\x02\x02\u0169\u0174\x03\x02\x02\x02\u016A\u0174\x054\x1B\x02" +
		"\u016B\u0174\x05F$\x02\u016C\u0174\x056\x1C\x02\u016D\u0174\x05<\x1F\x02" +
		"\u016E\u0174\x05*\x16\x02\u016F\u0170\x07L\x02\x02\u0170\u0174\x05F$\x02" +
		"\u0171\u0172\x07i\x02\x02\u0172\u0174\x07f\x02\x02\u0173\u0166\x03\x02" +
		"\x02\x02\u0173\u016A\x03\x02\x02\x02\u0173\u016B\x03\x02\x02\x02\u0173" +
		"\u016C\x03\x02\x02\x02\u0173\u016D\x03\x02\x02\x02\u0173\u016E\x03\x02" +
		"\x02\x02\u0173\u016F\x03\x02\x02\x02\u0173\u0171\x03\x02\x02\x02\u0174" +
		"/\x03\x02\x02\x02\u0175\u017A\x052\x1A\x02\u0176\u0177\x07I\x02\x02\u0177" +
		"\u0179\x052\x1A\x02\u0178\u0176\x03\x02\x02\x02\u0179\u017C\x03\x02\x02" +
		"\x02\u017A\u0178\x03\x02\x02\x02\u017A\u017B\x03\x02\x02\x02\u017B1\x03" +
		"\x02\x02\x02\u017C\u017A\x03\x02\x02\x02\u017D\u0180\x05&\x14\x02\u017E" +
		"\u0180\x07N\x02\x02\u017F\u017D\x03\x02\x02\x02\u017F\u017E\x03\x02\x02" +
		"\x02\u01803\x03\x02\x02\x02\u0181\u0182\t\f\x02\x02\u01825\x03\x02\x02" +
		"\x02\u0183\u0184\x07<\x02\x02\u0184\u0186\x077\x02\x02\u0185\u0187\x05" +
		"8\x1D\x02\u0186\u0185\x03\x02\x02\x02\u0186\u0187\x03\x02\x02\x02\u0187" +
		"\u0188\x03\x02\x02\x02\u0188\u0189\x078\x02\x02\u0189\u018A\x07=\x02\x02" +
		"\u018A7\x03\x02\x02\x02\u018B\u0190\x05:\x1E\x02\u018C\u018D\x07I\x02" +
		"\x02\u018D\u018F\x05:\x1E\x02\u018E\u018C\x03\x02\x02\x02\u018F\u0192" +
		"\x03\x02\x02\x02\u0190\u018E\x03\x02\x02\x02\u0190\u0191\x03\x02\x02\x02" +
		"\u0191\u0194\x03\x02\x02\x02\u0192\u0190\x03\x02\x02\x02\u0193\u0195\x07" +
		"I\x02\x02\u0194\u0193\x03\x02\x02\x02\u0194\u0195\x03\x02\x02\x02\u0195" +
		"9\x03\x02\x02\x02\u0196\u0197\x05&\x14\x02\u0197\u0198\x07K\x02\x02\u0198" +
		"\u0199\x05&\x14\x02\u0199;\x03\x02\x02\x02\u019A\u019B\x07<\x02\x02\u019B" +
		"\u019D\x079\x02\x02\u019C\u019E\x05> \x02\u019D\u019C\x03\x02\x02\x02" +
		"\u019D\u019E\x03\x02\x02\x02\u019E\u019F\x03\x02\x02\x02\u019F\u01A0\x07" +
		":\x02\x02\u01A0\u01A1\x07=\x02\x02\u01A1=\x03\x02\x02\x02\u01A2\u01A7" +
		"\x05&\x14\x02\u01A3\u01A4\x07I\x02\x02\u01A4\u01A6\x05&\x14\x02\u01A5" +
		"\u01A3\x03\x02\x02\x02\u01A6\u01A9\x03\x02\x02\x02\u01A7\u01A5\x03\x02" +
		"\x02\x02\u01A7\u01A8\x03\x02\x02\x02\u01A8\u01AB\x03\x02\x02\x02\u01A9" +
		"\u01A7\x03\x02\x02\x02\u01AA\u01AC\x07I\x02\x02\u01AB\u01AA\x03\x02\x02" +
		"\x02\u01AB\u01AC\x03\x02\x02\x02\u01AC?\x03\x02\x02\x02\u01AD\u01AF\x05" +
		"D#\x02\u01AE\u01AD\x03\x02\x02\x02\u01AF\u01B0\x03\x02\x02\x02\u01B0\u01AE" +
		"\x03\x02\x02\x02\u01B0\u01B1\x03\x02\x02\x02\u01B1\u01B2\x03\x02\x02\x02" +
		"\u01B2\u01B6\x05B\"\x02\u01B3\u01B5\x05D#\x02\u01B4\u01B3\x03\x02\x02" +
		"\x02\u01B5\u01B8\x03\x02\x02\x02\u01B6\u01B4\x03\x02\x02\x02\u01B6\u01B7" +
		"\x03\x02\x02\x02\u01B7\u01C6\x03\x02\x02\x02\u01B8\u01B6\x03\x02\x02\x02" +
		"\u01B9\u01BD\x05B\"\x02\u01BA\u01BC\x05D#\x02\u01BB\u01BA\x03\x02\x02" +
		"\x02\u01BC\u01BF\x03\x02\x02\x02\u01BD\u01BB\x03\x02\x02\x02\u01BD\u01BE" +
		"\x03\x02\x02\x02\u01BE\u01C6\x03\x02\x02\x02\u01BF\u01BD\x03\x02\x02\x02" +
		"\u01C0\u01C2\x05D#\x02\u01C1\u01C0\x03\x02\x02\x02\u01C2\u01C3\x03\x02" +
		"\x02\x02\u01C3\u01C1\x03\x02\x02\x02\u01C3\u01C4\x03\x02\x02\x02\u01C4" +
		"\u01C6\x03\x02\x02\x02\u01C5\u01AE\x03\x02\x02\x02\u01C5\u01B9\x03\x02" +
		"\x02\x02\u01C5\u01C1\x03\x02\x02\x02\u01C6A\x03\x02\x02\x02\u01C7\u01C8" +
		"\t\r\x02\x02\u01C8C\x03\x02\x02\x02\u01C9\u01CA\t\x0E\x02\x02\u01CAE\x03" +
		"\x02\x02\x02\u01CB\u01CE\x07i\x02\x02\u01CC\u01CE\x05H%\x02\u01CD\u01CB" +
		"\x03\x02\x02\x02\u01CD\u01CC\x03\x02\x02\x02\u01CEG\x03\x02\x02\x02\u01CF" +
		"\u01D0\t\x0F\x02\x02\u01D0I\x03\x02\x02\x02\u01D1\u01D2\x07\x03\x02\x02" +
		"\u01D2\u01D3\x07<\x02\x02\u01D3\u01D4\x05&\x14\x02\u01D4\u01D5\x07=\x02" +
		"\x02\u01D5\u01D8\x05\x06\x04\x02\u01D6\u01D7\x07\x04\x02\x02\u01D7\u01D9" +
		"\x05\x06\x04\x02\u01D8\u01D6\x03\x02\x02\x02\u01D8\u01D9\x03\x02\x02\x02" +
		"\u01D9K\x03\x02\x02\x02\u01DA\u01DB\x07\x06\x02\x02\u01DB\u01DE\x07<\x02" +
		"\x02\u01DC\u01DF\x05\f\x07\x02\u01DD\u01DF\x05&\x14\x02\u01DE\u01DC\x03" +
		"\x02\x02\x02\u01DE\u01DD\x03\x02\x02\x02\u01DE\u01DF\x03\x02\x02\x02\u01DF" +
		"\u01E0\x03\x02\x02\x02\u01E0\u01E2\x07;\x02\x02\u01E1\u01E3\x05&\x14\x02" +
		"\u01E2\u01E1\x03\x02\x02\x02\u01E2\u01E3\x03\x02\x02\x02\u01E3\u01E4\x03" +
		"\x02\x02\x02\u01E4\u01E6\x07;\x02\x02\u01E5\u01E7\x05&\x14\x02\u01E6\u01E5" +
		"\x03\x02\x02\x02\u01E6\u01E7\x03\x02\x02\x02\u01E7\u01E8\x03\x02\x02\x02" +
		"\u01E8\u01E9\x07=\x02\x02\u01E9\u01EA\x05\x06\x04\x02\u01EAM\x03\x02\x02" +
		"\x02\u01EB\u01EC\x07\x05\x02\x02\u01EC\u01ED\x07<\x02\x02\u01ED\u01EE" +
		"\x05&\x14\x02\u01EE\u01EF\x07=\x02\x02\u01EF\u01F0\x05\x06\x04\x02\u01F0" +
		"O\x03\x02\x02\x02\u01F1\u01F2\x07\x07\x02\x02\u01F2\u01F3\x05\x06\x04" +
		"\x02\u01F3\u01F4\x07\x05\x02\x02\u01F4\u01F5\x07<\x02\x02\u01F5\u01F6" +
		"\x05&\x14\x02\u01F6\u01F7\x07=\x02\x02\u01F7\u01F8\x07;\x02\x02\u01F8" +
		"Q\x03\x02\x02\x02\u01F9\u01FA\x07\x0E\x02\x02\u01FA\u01FC\x07<\x02\x02" +
		"\u01FB\u01FD\x05@!\x02\u01FC\u01FB\x03\x02\x02\x02\u01FC\u01FD\x03\x02" +
		"\x02\x02\u01FD\u01FE\x03\x02\x02\x02\u01FE\u01FF\x05F$\x02\u01FF\u0200" +
		"\x07\x0F\x02\x02\u0200\u0201\x05&\x14\x02\u0201\u0202\x07=\x02\x02\u0202" +
		"\u0203\x05\x06\x04\x02\u0203S\x03\x02\x02\x02\u0204\u0205\x07\b\x02\x02" +
		"\u0205\u0206\x07<\x02\x02\u0206\u0207\x05&\x14\x02\u0207\u0208\x07=\x02" +
		"\x02\u0208\u020A\x079\x02\x02\u0209\u020B\x05V,\x02\u020A\u0209\x03\x02" +
		"\x02\x02\u020A\u020B\x03\x02\x02\x02\u020B\u020C\x03\x02\x02\x02\u020C" +
		"\u020D\x07:\x02\x02\u020DU\x03\x02\x02\x02\u020E\u0211\x05X-\x02\u020F" +
		"\u0211\x05Z.\x02\u0210\u020E\x03\x02\x02\x02\u0210\u020F\x03\x02\x02\x02" +
		"\u0211\u0212\x03\x02\x02\x02\u0212\u0210\x03\x02\x02\x02\u0212\u0213\x03" +
		"\x02\x02\x02\u0213W\x03\x02\x02\x02\u0214\u0215\x07\t\x02\x02\u0215\u0216" +
		"\x05&\x14\x02\u0216\u021A\x07K\x02\x02\u0217\u0219\x05\x06\x04\x02\u0218" +
		"\u0217\x03\x02\x02\x02\u0219\u021C\x03\x02\x02\x02\u021A\u0218\x03\x02" +
		"\x02\x02\u021A\u021B\x03\x02\x02\x02\u021BY\x03\x02\x02\x02\u021C\u021A" +
		"\x03\x02\x02\x02\u021D\u021E\x07\n\x02\x02\u021E\u0222\x07K\x02\x02\u021F" +
		"\u0221\x05\x06\x04\x02\u0220\u021F\x03\x02\x02\x02\u0221\u0224\x03\x02" +
		"\x02\x02\u0222\u0220\x03\x02\x02\x02\u0222\u0223\x03\x02\x02\x02\u0223" +
		"[\x03\x02\x02\x02\u0224\u0222\x03\x02\x02\x02\u0225\u0227\x07\r\x02\x02" +
		"\u0226\u0228\x05&\x14\x02\u0227\u0226\x03\x02\x02\x02\u0227\u0228\x03" +
		"\x02\x02\x02\u0228\u0229\x03\x02\x02\x02\u0229\u022A\x07;\x02\x02";
	private static readonly _serializedATNSegment1: string =
		"\u022A]\x03\x02\x02\x02\u022B\u022C\x07\v\x02\x02\u022C\u022D\x07;\x02" +
		"\x02\u022D_\x03\x02\x02\x02\u022E\u022F\x07\f\x02\x02\u022F\u0230\x07" +
		";\x02\x02\u0230a\x03\x02\x02\x02\u0231\u0232\x07\x10\x02\x02\u0232\u0233" +
		"\x07;\x02\x02\u0233c\x03\x02\x02\x02:gp\x7F\x85\x93\x9B\xA1\xA7\xAC\xB3" +
		"\xB8\xBB\xC1\xC7\xD2\xDA\xE0\xE2\xE7\xEC\xF1\xF4\xF8\xFC\u0100\u010D\u0146" +
		"\u0152\u0154\u0162\u0173\u017A\u017F\u0186\u0190\u0194\u019D\u01A7\u01AB" +
		"\u01B0\u01B6\u01BD\u01C3\u01C5\u01CD\u01D8\u01DE\u01E2\u01E6\u01FC\u020A" +
		"\u0210\u0212\u021A\u0222\u0227";
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

export class ProgramContext extends ParserRuleContext {
	public EOF(): TerminalNode { return this.getToken(LPCParser.EOF, 0); }
	public declaration(): DeclarationContext[];
	public declaration(i: number): DeclarationContext;
	public declaration(i?: number): DeclarationContext | DeclarationContext[] {
		if (i === undefined) {
			return this.getRuleContexts(DeclarationContext);
		} else {
			return this.getRuleContext(i, DeclarationContext);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_program; }
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterProgram) {
			listener.enterProgram(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitProgram) {
			listener.exitProgram(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitProgram) {
			return visitor.visitProgram(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class DeclarationContext extends ParserRuleContext {
	public preprocessorDirective(): PreprocessorDirectiveContext | undefined {
		return this.tryGetRuleContext(0, PreprocessorDirectiveContext);
	}
	public inheritStatement(): InheritStatementContext | undefined {
		return this.tryGetRuleContext(0, InheritStatementContext);
	}
	public functionDeclaration(): FunctionDeclarationContext | undefined {
		return this.tryGetRuleContext(0, FunctionDeclarationContext);
	}
	public variableDeclaration(): VariableDeclarationContext | undefined {
		return this.tryGetRuleContext(0, VariableDeclarationContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_declaration; }
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterDeclaration) {
			listener.enterDeclaration(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitDeclaration) {
			listener.exitDeclaration(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitDeclaration) {
			return visitor.visitDeclaration(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class StatementContext extends ParserRuleContext {
	public block(): BlockContext | undefined {
		return this.tryGetRuleContext(0, BlockContext);
	}
	public variableDeclaration(): VariableDeclarationContext | undefined {
		return this.tryGetRuleContext(0, VariableDeclarationContext);
	}
	public expressionStatement(): ExpressionStatementContext | undefined {
		return this.tryGetRuleContext(0, ExpressionStatementContext);
	}
	public returnStatement(): ReturnStatementContext | undefined {
		return this.tryGetRuleContext(0, ReturnStatementContext);
	}
	public ifStatement(): IfStatementContext | undefined {
		return this.tryGetRuleContext(0, IfStatementContext);
	}
	public forStatement(): ForStatementContext | undefined {
		return this.tryGetRuleContext(0, ForStatementContext);
	}
	public foreachStatement(): ForeachStatementContext | undefined {
		return this.tryGetRuleContext(0, ForeachStatementContext);
	}
	public whileStatement(): WhileStatementContext | undefined {
		return this.tryGetRuleContext(0, WhileStatementContext);
	}
	public doWhileStatement(): DoWhileStatementContext | undefined {
		return this.tryGetRuleContext(0, DoWhileStatementContext);
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
	public fallthroughStatement(): FallthroughStatementContext | undefined {
		return this.tryGetRuleContext(0, FallthroughStatementContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_statement; }
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterStatement) {
			listener.enterStatement(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitStatement) {
			listener.exitStatement(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitStatement) {
			return visitor.visitStatement(this);
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
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterBlock) {
			listener.enterBlock(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitBlock) {
			listener.exitBlock(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitBlock) {
			return visitor.visitBlock(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ExpressionStatementContext extends ParserRuleContext {
	public expression(): ExpressionContext {
		return this.getRuleContext(0, ExpressionContext);
	}
	public SEMICOLON(): TerminalNode { return this.getToken(LPCParser.SEMICOLON, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_expressionStatement; }
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterExpressionStatement) {
			listener.enterExpressionStatement(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitExpressionStatement) {
			listener.exitExpressionStatement(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitExpressionStatement) {
			return visitor.visitExpressionStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class VariableDeclarationContext extends ParserRuleContext {
	public typeSpecifier(): TypeSpecifierContext {
		return this.getRuleContext(0, TypeSpecifierContext);
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
	public SEMICOLON(): TerminalNode { return this.getToken(LPCParser.SEMICOLON, 0); }
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
	public get ruleIndex(): number { return LPCParser.RULE_variableDeclaration; }
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterVariableDeclaration) {
			listener.enterVariableDeclaration(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitVariableDeclaration) {
			listener.exitVariableDeclaration(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitVariableDeclaration) {
			return visitor.visitVariableDeclaration(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class VariableDeclaratorContext extends ParserRuleContext {
	public identifier(): IdentifierContext {
		return this.getRuleContext(0, IdentifierContext);
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
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterVariableDeclarator) {
			listener.enterVariableDeclarator(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitVariableDeclarator) {
			listener.exitVariableDeclarator(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitVariableDeclarator) {
			return visitor.visitVariableDeclarator(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class FunctionDeclarationContext extends ParserRuleContext {
	public typeSpecifier(): TypeSpecifierContext {
		return this.getRuleContext(0, TypeSpecifierContext);
	}
	public identifier(): IdentifierContext {
		return this.getRuleContext(0, IdentifierContext);
	}
	public LPAREN(): TerminalNode { return this.getToken(LPCParser.LPAREN, 0); }
	public RPAREN(): TerminalNode { return this.getToken(LPCParser.RPAREN, 0); }
	public block(): BlockContext | undefined {
		return this.tryGetRuleContext(0, BlockContext);
	}
	public SEMICOLON(): TerminalNode | undefined { return this.tryGetToken(LPCParser.SEMICOLON, 0); }
	public parameterList(): ParameterListContext | undefined {
		return this.tryGetRuleContext(0, ParameterListContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_functionDeclaration; }
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterFunctionDeclaration) {
			listener.enterFunctionDeclaration(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitFunctionDeclaration) {
			listener.exitFunctionDeclaration(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitFunctionDeclaration) {
			return visitor.visitFunctionDeclaration(this);
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
	public ELLIPSIS(): TerminalNode | undefined { return this.tryGetToken(LPCParser.ELLIPSIS, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_parameterList; }
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterParameterList) {
			listener.enterParameterList(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitParameterList) {
			listener.exitParameterList(this);
		}
	}
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
	public typeSpecifier(): TypeSpecifierContext {
		return this.getRuleContext(0, TypeSpecifierContext);
	}
	public identifier(): IdentifierContext {
		return this.getRuleContext(0, IdentifierContext);
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
	public ASSIGN(): TerminalNode | undefined { return this.tryGetToken(LPCParser.ASSIGN, 0); }
	public expression(): ExpressionContext | undefined {
		return this.tryGetRuleContext(0, ExpressionContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_parameter; }
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterParameter) {
			listener.enterParameter(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitParameter) {
			listener.exitParameter(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitParameter) {
			return visitor.visitParameter(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class InheritStatementContext extends ParserRuleContext {
	public INHERIT(): TerminalNode { return this.getToken(LPCParser.INHERIT, 0); }
	public SEMICOLON(): TerminalNode { return this.getToken(LPCParser.SEMICOLON, 0); }
	public STRING_LITERAL(): TerminalNode | undefined { return this.tryGetToken(LPCParser.STRING_LITERAL, 0); }
	public IDENTIFIER(): TerminalNode | undefined { return this.tryGetToken(LPCParser.IDENTIFIER, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_inheritStatement; }
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterInheritStatement) {
			listener.enterInheritStatement(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitInheritStatement) {
			listener.exitInheritStatement(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitInheritStatement) {
			return visitor.visitInheritStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class PreprocessorDirectiveContext extends ParserRuleContext {
	public ppInclude(): PpIncludeContext | undefined {
		return this.tryGetRuleContext(0, PpIncludeContext);
	}
	public ppDefine(): PpDefineContext | undefined {
		return this.tryGetRuleContext(0, PpDefineContext);
	}
	public ppError(): PpErrorContext | undefined {
		return this.tryGetRuleContext(0, PpErrorContext);
	}
	public ppPragma(): PpPragmaContext | undefined {
		return this.tryGetRuleContext(0, PpPragmaContext);
	}
	public ppConditional(): PpConditionalContext | undefined {
		return this.tryGetRuleContext(0, PpConditionalContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_preprocessorDirective; }
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterPreprocessorDirective) {
			listener.enterPreprocessorDirective(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitPreprocessorDirective) {
			listener.exitPreprocessorDirective(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitPreprocessorDirective) {
			return visitor.visitPreprocessorDirective(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class PpIncludeContext extends ParserRuleContext {
	public PP_INCLUDE(): TerminalNode { return this.getToken(LPCParser.PP_INCLUDE, 0); }
	public STRING_LITERAL(): TerminalNode | undefined { return this.tryGetToken(LPCParser.STRING_LITERAL, 0); }
	public LESS_THAN_PATH(): TerminalNode | undefined { return this.tryGetToken(LPCParser.LESS_THAN_PATH, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_ppInclude; }
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterPpInclude) {
			listener.enterPpInclude(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitPpInclude) {
			listener.exitPpInclude(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitPpInclude) {
			return visitor.visitPpInclude(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class PpDefineContext extends ParserRuleContext {
	public PP_DEFINE(): TerminalNode { return this.getToken(LPCParser.PP_DEFINE, 0); }
	public IDENTIFIER(): TerminalNode { return this.getToken(LPCParser.IDENTIFIER, 0); }
	public ppBody(): PpBodyContext | undefined {
		return this.tryGetRuleContext(0, PpBodyContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_ppDefine; }
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterPpDefine) {
			listener.enterPpDefine(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitPpDefine) {
			listener.exitPpDefine(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitPpDefine) {
			return visitor.visitPpDefine(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class PpConditionalContext extends ParserRuleContext {
	public PP_ENDIF(): TerminalNode { return this.getToken(LPCParser.PP_ENDIF, 0); }
	public IDENTIFIER(): TerminalNode | undefined { return this.tryGetToken(LPCParser.IDENTIFIER, 0); }
	public PP_IF(): TerminalNode | undefined { return this.tryGetToken(LPCParser.PP_IF, 0); }
	public PP_IFDEF(): TerminalNode | undefined { return this.tryGetToken(LPCParser.PP_IFDEF, 0); }
	public PP_IFNDEF(): TerminalNode | undefined { return this.tryGetToken(LPCParser.PP_IFNDEF, 0); }
	public declaration(): DeclarationContext[];
	public declaration(i: number): DeclarationContext;
	public declaration(i?: number): DeclarationContext | DeclarationContext[] {
		if (i === undefined) {
			return this.getRuleContexts(DeclarationContext);
		} else {
			return this.getRuleContext(i, DeclarationContext);
		}
	}
	public PP_ELSE(): TerminalNode | undefined { return this.tryGetToken(LPCParser.PP_ELSE, 0); }
	public ppBody(): PpBodyContext[];
	public ppBody(i: number): PpBodyContext;
	public ppBody(i?: number): PpBodyContext | PpBodyContext[] {
		if (i === undefined) {
			return this.getRuleContexts(PpBodyContext);
		} else {
			return this.getRuleContext(i, PpBodyContext);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_ppConditional; }
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterPpConditional) {
			listener.enterPpConditional(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitPpConditional) {
			listener.exitPpConditional(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitPpConditional) {
			return visitor.visitPpConditional(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class PpErrorContext extends ParserRuleContext {
	public PP_ERROR(): TerminalNode { return this.getToken(LPCParser.PP_ERROR, 0); }
	public ppBody(): PpBodyContext | undefined {
		return this.tryGetRuleContext(0, PpBodyContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_ppError; }
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterPpError) {
			listener.enterPpError(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitPpError) {
			listener.exitPpError(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitPpError) {
			return visitor.visitPpError(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class PpPragmaContext extends ParserRuleContext {
	public PP_PRAGMA(): TerminalNode { return this.getToken(LPCParser.PP_PRAGMA, 0); }
	public ppBody(): PpBodyContext | undefined {
		return this.tryGetRuleContext(0, PpBodyContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_ppPragma; }
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterPpPragma) {
			listener.enterPpPragma(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitPpPragma) {
			listener.exitPpPragma(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitPpPragma) {
			return visitor.visitPpPragma(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class PpBodyContext extends ParserRuleContext {
	public PP_BODY(): TerminalNode { return this.getToken(LPCParser.PP_BODY, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_ppBody; }
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterPpBody) {
			listener.enterPpBody(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitPpBody) {
			listener.exitPpBody(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitPpBody) {
			return visitor.visitPpBody(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ExpressionContext extends ParserRuleContext {
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_expression; }
	public copyFrom(ctx: ExpressionContext): void {
		super.copyFrom(ctx);
	}
}
export class PrimaryExprContext extends ExpressionContext {
	public primary(): PrimaryContext {
		return this.getRuleContext(0, PrimaryContext);
	}
	constructor(ctx: ExpressionContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterPrimaryExpr) {
			listener.enterPrimaryExpr(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitPrimaryExpr) {
			listener.exitPrimaryExpr(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitPrimaryExpr) {
			return visitor.visitPrimaryExpr(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ArrayAccessExprContext extends ExpressionContext {
	public expression(): ExpressionContext[];
	public expression(i: number): ExpressionContext;
	public expression(i?: number): ExpressionContext | ExpressionContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ExpressionContext);
		} else {
			return this.getRuleContext(i, ExpressionContext);
		}
	}
	public LBRACK(): TerminalNode { return this.getToken(LPCParser.LBRACK, 0); }
	public RBRACK(): TerminalNode { return this.getToken(LPCParser.RBRACK, 0); }
	constructor(ctx: ExpressionContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterArrayAccessExpr) {
			listener.enterArrayAccessExpr(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitArrayAccessExpr) {
			listener.exitArrayAccessExpr(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitArrayAccessExpr) {
			return visitor.visitArrayAccessExpr(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ArraySliceExprContext extends ExpressionContext {
	public expression(): ExpressionContext[];
	public expression(i: number): ExpressionContext;
	public expression(i?: number): ExpressionContext | ExpressionContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ExpressionContext);
		} else {
			return this.getRuleContext(i, ExpressionContext);
		}
	}
	public LBRACK(): TerminalNode { return this.getToken(LPCParser.LBRACK, 0); }
	public RANGE(): TerminalNode { return this.getToken(LPCParser.RANGE, 0); }
	public RBRACK(): TerminalNode { return this.getToken(LPCParser.RBRACK, 0); }
	constructor(ctx: ExpressionContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterArraySliceExpr) {
			listener.enterArraySliceExpr(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitArraySliceExpr) {
			listener.exitArraySliceExpr(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitArraySliceExpr) {
			return visitor.visitArraySliceExpr(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class FunctionCallExprContext extends ExpressionContext {
	public expression(): ExpressionContext {
		return this.getRuleContext(0, ExpressionContext);
	}
	public LPAREN(): TerminalNode { return this.getToken(LPCParser.LPAREN, 0); }
	public RPAREN(): TerminalNode { return this.getToken(LPCParser.RPAREN, 0); }
	public argumentList(): ArgumentListContext | undefined {
		return this.tryGetRuleContext(0, ArgumentListContext);
	}
	constructor(ctx: ExpressionContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterFunctionCallExpr) {
			listener.enterFunctionCallExpr(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitFunctionCallExpr) {
			listener.exitFunctionCallExpr(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitFunctionCallExpr) {
			return visitor.visitFunctionCallExpr(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class MemberAccessExprContext extends ExpressionContext {
	public expression(): ExpressionContext {
		return this.getRuleContext(0, ExpressionContext);
	}
	public ARROW(): TerminalNode { return this.getToken(LPCParser.ARROW, 0); }
	public identifier(): IdentifierContext {
		return this.getRuleContext(0, IdentifierContext);
	}
	constructor(ctx: ExpressionContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterMemberAccessExpr) {
			listener.enterMemberAccessExpr(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitMemberAccessExpr) {
			listener.exitMemberAccessExpr(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitMemberAccessExpr) {
			return visitor.visitMemberAccessExpr(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class PostIncrementExprContext extends ExpressionContext {
	public expression(): ExpressionContext {
		return this.getRuleContext(0, ExpressionContext);
	}
	public INC(): TerminalNode { return this.getToken(LPCParser.INC, 0); }
	constructor(ctx: ExpressionContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterPostIncrementExpr) {
			listener.enterPostIncrementExpr(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitPostIncrementExpr) {
			listener.exitPostIncrementExpr(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitPostIncrementExpr) {
			return visitor.visitPostIncrementExpr(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class PostDecrementExprContext extends ExpressionContext {
	public expression(): ExpressionContext {
		return this.getRuleContext(0, ExpressionContext);
	}
	public DEC(): TerminalNode { return this.getToken(LPCParser.DEC, 0); }
	constructor(ctx: ExpressionContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterPostDecrementExpr) {
			listener.enterPostDecrementExpr(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitPostDecrementExpr) {
			listener.exitPostDecrementExpr(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitPostDecrementExpr) {
			return visitor.visitPostDecrementExpr(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class PreIncrementExprContext extends ExpressionContext {
	public INC(): TerminalNode { return this.getToken(LPCParser.INC, 0); }
	public expression(): ExpressionContext {
		return this.getRuleContext(0, ExpressionContext);
	}
	constructor(ctx: ExpressionContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterPreIncrementExpr) {
			listener.enterPreIncrementExpr(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitPreIncrementExpr) {
			listener.exitPreIncrementExpr(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitPreIncrementExpr) {
			return visitor.visitPreIncrementExpr(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class PreDecrementExprContext extends ExpressionContext {
	public DEC(): TerminalNode { return this.getToken(LPCParser.DEC, 0); }
	public expression(): ExpressionContext {
		return this.getRuleContext(0, ExpressionContext);
	}
	constructor(ctx: ExpressionContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterPreDecrementExpr) {
			listener.enterPreDecrementExpr(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitPreDecrementExpr) {
			listener.exitPreDecrementExpr(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitPreDecrementExpr) {
			return visitor.visitPreDecrementExpr(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class UnaryExprContext extends ExpressionContext {
	public expression(): ExpressionContext {
		return this.getRuleContext(0, ExpressionContext);
	}
	public MINUS(): TerminalNode | undefined { return this.tryGetToken(LPCParser.MINUS, 0); }
	public NOT(): TerminalNode | undefined { return this.tryGetToken(LPCParser.NOT, 0); }
	public BITWISE_NOT(): TerminalNode | undefined { return this.tryGetToken(LPCParser.BITWISE_NOT, 0); }
	constructor(ctx: ExpressionContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterUnaryExpr) {
			listener.enterUnaryExpr(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitUnaryExpr) {
			listener.exitUnaryExpr(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitUnaryExpr) {
			return visitor.visitUnaryExpr(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class CastExprContext extends ExpressionContext {
	public castExpression(): CastExpressionContext {
		return this.getRuleContext(0, CastExpressionContext);
	}
	constructor(ctx: ExpressionContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterCastExpr) {
			listener.enterCastExpr(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitCastExpr) {
			listener.exitCastExpr(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitCastExpr) {
			return visitor.visitCastExpr(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class MultiplicativeExprContext extends ExpressionContext {
	public expression(): ExpressionContext[];
	public expression(i: number): ExpressionContext;
	public expression(i?: number): ExpressionContext | ExpressionContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ExpressionContext);
		} else {
			return this.getRuleContext(i, ExpressionContext);
		}
	}
	public STAR(): TerminalNode | undefined { return this.tryGetToken(LPCParser.STAR, 0); }
	public DIV(): TerminalNode | undefined { return this.tryGetToken(LPCParser.DIV, 0); }
	public MOD(): TerminalNode | undefined { return this.tryGetToken(LPCParser.MOD, 0); }
	constructor(ctx: ExpressionContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterMultiplicativeExpr) {
			listener.enterMultiplicativeExpr(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitMultiplicativeExpr) {
			listener.exitMultiplicativeExpr(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitMultiplicativeExpr) {
			return visitor.visitMultiplicativeExpr(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class AdditiveExprContext extends ExpressionContext {
	public expression(): ExpressionContext[];
	public expression(i: number): ExpressionContext;
	public expression(i?: number): ExpressionContext | ExpressionContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ExpressionContext);
		} else {
			return this.getRuleContext(i, ExpressionContext);
		}
	}
	public PLUS(): TerminalNode | undefined { return this.tryGetToken(LPCParser.PLUS, 0); }
	public MINUS(): TerminalNode | undefined { return this.tryGetToken(LPCParser.MINUS, 0); }
	constructor(ctx: ExpressionContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterAdditiveExpr) {
			listener.enterAdditiveExpr(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitAdditiveExpr) {
			listener.exitAdditiveExpr(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitAdditiveExpr) {
			return visitor.visitAdditiveExpr(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ShiftExprContext extends ExpressionContext {
	public expression(): ExpressionContext[];
	public expression(i: number): ExpressionContext;
	public expression(i?: number): ExpressionContext | ExpressionContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ExpressionContext);
		} else {
			return this.getRuleContext(i, ExpressionContext);
		}
	}
	public LSHIFT(): TerminalNode | undefined { return this.tryGetToken(LPCParser.LSHIFT, 0); }
	public RSHIFT(): TerminalNode | undefined { return this.tryGetToken(LPCParser.RSHIFT, 0); }
	constructor(ctx: ExpressionContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterShiftExpr) {
			listener.enterShiftExpr(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitShiftExpr) {
			listener.exitShiftExpr(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitShiftExpr) {
			return visitor.visitShiftExpr(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class RelationalExprContext extends ExpressionContext {
	public expression(): ExpressionContext[];
	public expression(i: number): ExpressionContext;
	public expression(i?: number): ExpressionContext | ExpressionContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ExpressionContext);
		} else {
			return this.getRuleContext(i, ExpressionContext);
		}
	}
	public LT(): TerminalNode | undefined { return this.tryGetToken(LPCParser.LT, 0); }
	public GT(): TerminalNode | undefined { return this.tryGetToken(LPCParser.GT, 0); }
	public LTE(): TerminalNode | undefined { return this.tryGetToken(LPCParser.LTE, 0); }
	public GTE(): TerminalNode | undefined { return this.tryGetToken(LPCParser.GTE, 0); }
	constructor(ctx: ExpressionContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterRelationalExpr) {
			listener.enterRelationalExpr(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitRelationalExpr) {
			listener.exitRelationalExpr(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitRelationalExpr) {
			return visitor.visitRelationalExpr(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class EqualityExprContext extends ExpressionContext {
	public expression(): ExpressionContext[];
	public expression(i: number): ExpressionContext;
	public expression(i?: number): ExpressionContext | ExpressionContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ExpressionContext);
		} else {
			return this.getRuleContext(i, ExpressionContext);
		}
	}
	public EQ(): TerminalNode | undefined { return this.tryGetToken(LPCParser.EQ, 0); }
	public NEQ(): TerminalNode | undefined { return this.tryGetToken(LPCParser.NEQ, 0); }
	constructor(ctx: ExpressionContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterEqualityExpr) {
			listener.enterEqualityExpr(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitEqualityExpr) {
			listener.exitEqualityExpr(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitEqualityExpr) {
			return visitor.visitEqualityExpr(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class BitwiseAndExprContext extends ExpressionContext {
	public expression(): ExpressionContext[];
	public expression(i: number): ExpressionContext;
	public expression(i?: number): ExpressionContext | ExpressionContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ExpressionContext);
		} else {
			return this.getRuleContext(i, ExpressionContext);
		}
	}
	public BITWISE_AND(): TerminalNode { return this.getToken(LPCParser.BITWISE_AND, 0); }
	constructor(ctx: ExpressionContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterBitwiseAndExpr) {
			listener.enterBitwiseAndExpr(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitBitwiseAndExpr) {
			listener.exitBitwiseAndExpr(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitBitwiseAndExpr) {
			return visitor.visitBitwiseAndExpr(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class BitwiseXorExprContext extends ExpressionContext {
	public expression(): ExpressionContext[];
	public expression(i: number): ExpressionContext;
	public expression(i?: number): ExpressionContext | ExpressionContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ExpressionContext);
		} else {
			return this.getRuleContext(i, ExpressionContext);
		}
	}
	public BITWISE_XOR(): TerminalNode { return this.getToken(LPCParser.BITWISE_XOR, 0); }
	constructor(ctx: ExpressionContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterBitwiseXorExpr) {
			listener.enterBitwiseXorExpr(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitBitwiseXorExpr) {
			listener.exitBitwiseXorExpr(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitBitwiseXorExpr) {
			return visitor.visitBitwiseXorExpr(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class BitwiseOrExprContext extends ExpressionContext {
	public expression(): ExpressionContext[];
	public expression(i: number): ExpressionContext;
	public expression(i?: number): ExpressionContext | ExpressionContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ExpressionContext);
		} else {
			return this.getRuleContext(i, ExpressionContext);
		}
	}
	public BITWISE_OR(): TerminalNode { return this.getToken(LPCParser.BITWISE_OR, 0); }
	constructor(ctx: ExpressionContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterBitwiseOrExpr) {
			listener.enterBitwiseOrExpr(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitBitwiseOrExpr) {
			listener.exitBitwiseOrExpr(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitBitwiseOrExpr) {
			return visitor.visitBitwiseOrExpr(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ImplicitConcatExprContext extends ExpressionContext {
	public expression(): ExpressionContext {
		return this.getRuleContext(0, ExpressionContext);
	}
	public primary(): PrimaryContext {
		return this.getRuleContext(0, PrimaryContext);
	}
	constructor(ctx: ExpressionContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterImplicitConcatExpr) {
			listener.enterImplicitConcatExpr(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitImplicitConcatExpr) {
			listener.exitImplicitConcatExpr(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitImplicitConcatExpr) {
			return visitor.visitImplicitConcatExpr(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class LogicalAndExprContext extends ExpressionContext {
	public expression(): ExpressionContext[];
	public expression(i: number): ExpressionContext;
	public expression(i?: number): ExpressionContext | ExpressionContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ExpressionContext);
		} else {
			return this.getRuleContext(i, ExpressionContext);
		}
	}
	public AND(): TerminalNode { return this.getToken(LPCParser.AND, 0); }
	constructor(ctx: ExpressionContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterLogicalAndExpr) {
			listener.enterLogicalAndExpr(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitLogicalAndExpr) {
			listener.exitLogicalAndExpr(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitLogicalAndExpr) {
			return visitor.visitLogicalAndExpr(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class LogicalOrExprContext extends ExpressionContext {
	public expression(): ExpressionContext[];
	public expression(i: number): ExpressionContext;
	public expression(i?: number): ExpressionContext | ExpressionContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ExpressionContext);
		} else {
			return this.getRuleContext(i, ExpressionContext);
		}
	}
	public OR(): TerminalNode { return this.getToken(LPCParser.OR, 0); }
	constructor(ctx: ExpressionContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterLogicalOrExpr) {
			listener.enterLogicalOrExpr(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitLogicalOrExpr) {
			listener.exitLogicalOrExpr(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitLogicalOrExpr) {
			return visitor.visitLogicalOrExpr(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ConditionalExprContext extends ExpressionContext {
	public expression(): ExpressionContext[];
	public expression(i: number): ExpressionContext;
	public expression(i?: number): ExpressionContext | ExpressionContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ExpressionContext);
		} else {
			return this.getRuleContext(i, ExpressionContext);
		}
	}
	public QUESTION(): TerminalNode { return this.getToken(LPCParser.QUESTION, 0); }
	public COLON(): TerminalNode { return this.getToken(LPCParser.COLON, 0); }
	constructor(ctx: ExpressionContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterConditionalExpr) {
			listener.enterConditionalExpr(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitConditionalExpr) {
			listener.exitConditionalExpr(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitConditionalExpr) {
			return visitor.visitConditionalExpr(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class AssignmentExprContext extends ExpressionContext {
	public expression(): ExpressionContext[];
	public expression(i: number): ExpressionContext;
	public expression(i?: number): ExpressionContext | ExpressionContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ExpressionContext);
		} else {
			return this.getRuleContext(i, ExpressionContext);
		}
	}
	public assignmentOperator(): AssignmentOperatorContext {
		return this.getRuleContext(0, AssignmentOperatorContext);
	}
	constructor(ctx: ExpressionContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterAssignmentExpr) {
			listener.enterAssignmentExpr(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitAssignmentExpr) {
			listener.exitAssignmentExpr(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitAssignmentExpr) {
			return visitor.visitAssignmentExpr(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class CastExpressionContext extends ParserRuleContext {
	public LPAREN(): TerminalNode { return this.getToken(LPCParser.LPAREN, 0); }
	public typeSpecifier(): TypeSpecifierContext {
		return this.getRuleContext(0, TypeSpecifierContext);
	}
	public RPAREN(): TerminalNode { return this.getToken(LPCParser.RPAREN, 0); }
	public primary(): PrimaryContext {
		return this.getRuleContext(0, PrimaryContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_castExpression; }
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterCastExpression) {
			listener.enterCastExpression(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitCastExpression) {
			listener.exitCastExpression(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitCastExpression) {
			return visitor.visitCastExpression(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ClosureExpressionContext extends ParserRuleContext {
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
	public expression(): ExpressionContext {
		return this.getRuleContext(0, ExpressionContext);
	}
	public RPAREN(): TerminalNode | undefined { return this.tryGetToken(LPCParser.RPAREN, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_closureExpression; }
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterClosureExpression) {
			listener.enterClosureExpression(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitClosureExpression) {
			listener.exitClosureExpression(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitClosureExpression) {
			return visitor.visitClosureExpression(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class AssignmentOperatorContext extends ParserRuleContext {
	public ASSIGN(): TerminalNode | undefined { return this.tryGetToken(LPCParser.ASSIGN, 0); }
	public PLUS_ASSIGN(): TerminalNode | undefined { return this.tryGetToken(LPCParser.PLUS_ASSIGN, 0); }
	public MINUS_ASSIGN(): TerminalNode | undefined { return this.tryGetToken(LPCParser.MINUS_ASSIGN, 0); }
	public STAR_ASSIGN(): TerminalNode | undefined { return this.tryGetToken(LPCParser.STAR_ASSIGN, 0); }
	public DIV_ASSIGN(): TerminalNode | undefined { return this.tryGetToken(LPCParser.DIV_ASSIGN, 0); }
	public MOD_ASSIGN(): TerminalNode | undefined { return this.tryGetToken(LPCParser.MOD_ASSIGN, 0); }
	public AND_ASSIGN(): TerminalNode | undefined { return this.tryGetToken(LPCParser.AND_ASSIGN, 0); }
	public OR_ASSIGN(): TerminalNode | undefined { return this.tryGetToken(LPCParser.OR_ASSIGN, 0); }
	public XOR_ASSIGN(): TerminalNode | undefined { return this.tryGetToken(LPCParser.XOR_ASSIGN, 0); }
	public LSHIFT_ASSIGN(): TerminalNode | undefined { return this.tryGetToken(LPCParser.LSHIFT_ASSIGN, 0); }
	public RSHIFT_ASSIGN(): TerminalNode | undefined { return this.tryGetToken(LPCParser.RSHIFT_ASSIGN, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_assignmentOperator; }
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterAssignmentOperator) {
			listener.enterAssignmentOperator(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitAssignmentOperator) {
			listener.exitAssignmentOperator(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitAssignmentOperator) {
			return visitor.visitAssignmentOperator(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class PrimaryContext extends ParserRuleContext {
	public LPAREN(): TerminalNode | undefined { return this.tryGetToken(LPCParser.LPAREN, 0); }
	public expression(): ExpressionContext | undefined {
		return this.tryGetRuleContext(0, ExpressionContext);
	}
	public RPAREN(): TerminalNode | undefined { return this.tryGetToken(LPCParser.RPAREN, 0); }
	public literal(): LiteralContext | undefined {
		return this.tryGetRuleContext(0, LiteralContext);
	}
	public identifier(): IdentifierContext | undefined {
		return this.tryGetRuleContext(0, IdentifierContext);
	}
	public mappingLiteral(): MappingLiteralContext | undefined {
		return this.tryGetRuleContext(0, MappingLiteralContext);
	}
	public arrayLiteral(): ArrayLiteralContext | undefined {
		return this.tryGetRuleContext(0, ArrayLiteralContext);
	}
	public closureExpression(): ClosureExpressionContext | undefined {
		return this.tryGetRuleContext(0, ClosureExpressionContext);
	}
	public SCOPE_RESOLUTION(): TerminalNode | undefined { return this.tryGetToken(LPCParser.SCOPE_RESOLUTION, 0); }
	public IDENTIFIER(): TerminalNode | undefined { return this.tryGetToken(LPCParser.IDENTIFIER, 0); }
	public STRING_LITERAL(): TerminalNode | undefined { return this.tryGetToken(LPCParser.STRING_LITERAL, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_primary; }
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterPrimary) {
			listener.enterPrimary(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitPrimary) {
			listener.exitPrimary(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitPrimary) {
			return visitor.visitPrimary(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ArgumentListContext extends ParserRuleContext {
	public expressionOrEllipsis(): ExpressionOrEllipsisContext[];
	public expressionOrEllipsis(i: number): ExpressionOrEllipsisContext;
	public expressionOrEllipsis(i?: number): ExpressionOrEllipsisContext | ExpressionOrEllipsisContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ExpressionOrEllipsisContext);
		} else {
			return this.getRuleContext(i, ExpressionOrEllipsisContext);
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
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterArgumentList) {
			listener.enterArgumentList(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitArgumentList) {
			listener.exitArgumentList(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitArgumentList) {
			return visitor.visitArgumentList(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ExpressionOrEllipsisContext extends ParserRuleContext {
	public expression(): ExpressionContext | undefined {
		return this.tryGetRuleContext(0, ExpressionContext);
	}
	public ELLIPSIS(): TerminalNode | undefined { return this.tryGetToken(LPCParser.ELLIPSIS, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_expressionOrEllipsis; }
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterExpressionOrEllipsis) {
			listener.enterExpressionOrEllipsis(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitExpressionOrEllipsis) {
			listener.exitExpressionOrEllipsis(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitExpressionOrEllipsis) {
			return visitor.visitExpressionOrEllipsis(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class LiteralContext extends ParserRuleContext {
	public STRING_LITERAL(): TerminalNode | undefined { return this.tryGetToken(LPCParser.STRING_LITERAL, 0); }
	public NUMBER(): TerminalNode | undefined { return this.tryGetToken(LPCParser.NUMBER, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_literal; }
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterLiteral) {
			listener.enterLiteral(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitLiteral) {
			listener.exitLiteral(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitLiteral) {
			return visitor.visitLiteral(this);
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
	public mappingElementList(): MappingElementListContext | undefined {
		return this.tryGetRuleContext(0, MappingElementListContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_mappingLiteral; }
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterMappingLiteral) {
			listener.enterMappingLiteral(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitMappingLiteral) {
			listener.exitMappingLiteral(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitMappingLiteral) {
			return visitor.visitMappingLiteral(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class MappingElementListContext extends ParserRuleContext {
	public mappingElement(): MappingElementContext[];
	public mappingElement(i: number): MappingElementContext;
	public mappingElement(i?: number): MappingElementContext | MappingElementContext[] {
		if (i === undefined) {
			return this.getRuleContexts(MappingElementContext);
		} else {
			return this.getRuleContext(i, MappingElementContext);
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
	public get ruleIndex(): number { return LPCParser.RULE_mappingElementList; }
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterMappingElementList) {
			listener.enterMappingElementList(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitMappingElementList) {
			listener.exitMappingElementList(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitMappingElementList) {
			return visitor.visitMappingElementList(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class MappingElementContext extends ParserRuleContext {
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
	public get ruleIndex(): number { return LPCParser.RULE_mappingElement; }
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterMappingElement) {
			listener.enterMappingElement(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitMappingElement) {
			listener.exitMappingElement(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitMappingElement) {
			return visitor.visitMappingElement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ArrayLiteralContext extends ParserRuleContext {
	public LPAREN(): TerminalNode { return this.getToken(LPCParser.LPAREN, 0); }
	public LBRACE(): TerminalNode { return this.getToken(LPCParser.LBRACE, 0); }
	public RBRACE(): TerminalNode { return this.getToken(LPCParser.RBRACE, 0); }
	public RPAREN(): TerminalNode { return this.getToken(LPCParser.RPAREN, 0); }
	public expressionList(): ExpressionListContext | undefined {
		return this.tryGetRuleContext(0, ExpressionListContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_arrayLiteral; }
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterArrayLiteral) {
			listener.enterArrayLiteral(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitArrayLiteral) {
			listener.exitArrayLiteral(this);
		}
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
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterExpressionList) {
			listener.enterExpressionList(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitExpressionList) {
			listener.exitExpressionList(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitExpressionList) {
			return visitor.visitExpressionList(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class TypeSpecifierContext extends ParserRuleContext {
	public typeName(): TypeNameContext | undefined {
		return this.tryGetRuleContext(0, TypeNameContext);
	}
	public modifier(): ModifierContext[];
	public modifier(i: number): ModifierContext;
	public modifier(i?: number): ModifierContext | ModifierContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ModifierContext);
		} else {
			return this.getRuleContext(i, ModifierContext);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_typeSpecifier; }
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterTypeSpecifier) {
			listener.enterTypeSpecifier(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitTypeSpecifier) {
			listener.exitTypeSpecifier(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitTypeSpecifier) {
			return visitor.visitTypeSpecifier(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class TypeNameContext extends ParserRuleContext {
	public VOID(): TerminalNode | undefined { return this.tryGetToken(LPCParser.VOID, 0); }
	public INT(): TerminalNode | undefined { return this.tryGetToken(LPCParser.INT, 0); }
	public STRING(): TerminalNode | undefined { return this.tryGetToken(LPCParser.STRING, 0); }
	public OBJECT(): TerminalNode | undefined { return this.tryGetToken(LPCParser.OBJECT, 0); }
	public ARRAY(): TerminalNode | undefined { return this.tryGetToken(LPCParser.ARRAY, 0); }
	public MAPPING(): TerminalNode | undefined { return this.tryGetToken(LPCParser.MAPPING, 0); }
	public FLOAT(): TerminalNode | undefined { return this.tryGetToken(LPCParser.FLOAT, 0); }
	public BUFFER(): TerminalNode | undefined { return this.tryGetToken(LPCParser.BUFFER, 0); }
	public MIXED(): TerminalNode | undefined { return this.tryGetToken(LPCParser.MIXED, 0); }
	public FUNCTION(): TerminalNode | undefined { return this.tryGetToken(LPCParser.FUNCTION, 0); }
	public CLASS(): TerminalNode | undefined { return this.tryGetToken(LPCParser.CLASS, 0); }
	public STRUCT(): TerminalNode | undefined { return this.tryGetToken(LPCParser.STRUCT, 0); }
	public CLOSURE(): TerminalNode | undefined { return this.tryGetToken(LPCParser.CLOSURE, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_typeName; }
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterTypeName) {
			listener.enterTypeName(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitTypeName) {
			listener.exitTypeName(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitTypeName) {
			return visitor.visitTypeName(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ModifierContext extends ParserRuleContext {
	public STATIC(): TerminalNode | undefined { return this.tryGetToken(LPCParser.STATIC, 0); }
	public NOMASK(): TerminalNode | undefined { return this.tryGetToken(LPCParser.NOMASK, 0); }
	public PRIVATE(): TerminalNode | undefined { return this.tryGetToken(LPCParser.PRIVATE, 0); }
	public PROTECTED(): TerminalNode | undefined { return this.tryGetToken(LPCParser.PROTECTED, 0); }
	public PUBLIC(): TerminalNode | undefined { return this.tryGetToken(LPCParser.PUBLIC, 0); }
	public VARARGS(): TerminalNode | undefined { return this.tryGetToken(LPCParser.VARARGS, 0); }
	public NOSAVE(): TerminalNode | undefined { return this.tryGetToken(LPCParser.NOSAVE, 0); }
	public REF(): TerminalNode | undefined { return this.tryGetToken(LPCParser.REF, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_modifier; }
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterModifier) {
			listener.enterModifier(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitModifier) {
			listener.exitModifier(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitModifier) {
			return visitor.visitModifier(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class IdentifierContext extends ParserRuleContext {
	public IDENTIFIER(): TerminalNode | undefined { return this.tryGetToken(LPCParser.IDENTIFIER, 0); }
	public keywordIdentifier(): KeywordIdentifierContext | undefined {
		return this.tryGetRuleContext(0, KeywordIdentifierContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_identifier; }
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterIdentifier) {
			listener.enterIdentifier(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitIdentifier) {
			listener.exitIdentifier(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitIdentifier) {
			return visitor.visitIdentifier(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class KeywordIdentifierContext extends ParserRuleContext {
	public EFUN(): TerminalNode | undefined { return this.tryGetToken(LPCParser.EFUN, 0); }
	public NEW(): TerminalNode | undefined { return this.tryGetToken(LPCParser.NEW, 0); }
	public SSCANF(): TerminalNode | undefined { return this.tryGetToken(LPCParser.SSCANF, 0); }
	public CATCH(): TerminalNode | undefined { return this.tryGetToken(LPCParser.CATCH, 0); }
	public PARSE_COMMAND(): TerminalNode | undefined { return this.tryGetToken(LPCParser.PARSE_COMMAND, 0); }
	public TIME_EXPRESSION(): TerminalNode | undefined { return this.tryGetToken(LPCParser.TIME_EXPRESSION, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_keywordIdentifier; }
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterKeywordIdentifier) {
			listener.enterKeywordIdentifier(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitKeywordIdentifier) {
			listener.exitKeywordIdentifier(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitKeywordIdentifier) {
			return visitor.visitKeywordIdentifier(this);
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
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterIfStatement) {
			listener.enterIfStatement(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitIfStatement) {
			listener.exitIfStatement(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitIfStatement) {
			return visitor.visitIfStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ForStatementContext extends ParserRuleContext {
	public FOR(): TerminalNode { return this.getToken(LPCParser.FOR, 0); }
	public LPAREN(): TerminalNode { return this.getToken(LPCParser.LPAREN, 0); }
	public SEMICOLON(): TerminalNode[];
	public SEMICOLON(i: number): TerminalNode;
	public SEMICOLON(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(LPCParser.SEMICOLON);
		} else {
			return this.getToken(LPCParser.SEMICOLON, i);
		}
	}
	public RPAREN(): TerminalNode { return this.getToken(LPCParser.RPAREN, 0); }
	public statement(): StatementContext {
		return this.getRuleContext(0, StatementContext);
	}
	public variableDeclaration(): VariableDeclarationContext | undefined {
		return this.tryGetRuleContext(0, VariableDeclarationContext);
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
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_forStatement; }
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterForStatement) {
			listener.enterForStatement(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitForStatement) {
			listener.exitForStatement(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitForStatement) {
			return visitor.visitForStatement(this);
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
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterWhileStatement) {
			listener.enterWhileStatement(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitWhileStatement) {
			listener.exitWhileStatement(this);
		}
	}
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
	public SEMICOLON(): TerminalNode { return this.getToken(LPCParser.SEMICOLON, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_doWhileStatement; }
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterDoWhileStatement) {
			listener.enterDoWhileStatement(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitDoWhileStatement) {
			listener.exitDoWhileStatement(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitDoWhileStatement) {
			return visitor.visitDoWhileStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ForeachStatementContext extends ParserRuleContext {
	public FOREACH(): TerminalNode { return this.getToken(LPCParser.FOREACH, 0); }
	public LPAREN(): TerminalNode { return this.getToken(LPCParser.LPAREN, 0); }
	public identifier(): IdentifierContext {
		return this.getRuleContext(0, IdentifierContext);
	}
	public IN(): TerminalNode { return this.getToken(LPCParser.IN, 0); }
	public expression(): ExpressionContext {
		return this.getRuleContext(0, ExpressionContext);
	}
	public RPAREN(): TerminalNode { return this.getToken(LPCParser.RPAREN, 0); }
	public statement(): StatementContext {
		return this.getRuleContext(0, StatementContext);
	}
	public typeSpecifier(): TypeSpecifierContext | undefined {
		return this.tryGetRuleContext(0, TypeSpecifierContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_foreachStatement; }
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterForeachStatement) {
			listener.enterForeachStatement(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitForeachStatement) {
			listener.exitForeachStatement(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitForeachStatement) {
			return visitor.visitForeachStatement(this);
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
	public switchBlock(): SwitchBlockContext | undefined {
		return this.tryGetRuleContext(0, SwitchBlockContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_switchStatement; }
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterSwitchStatement) {
			listener.enterSwitchStatement(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitSwitchStatement) {
			listener.exitSwitchStatement(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitSwitchStatement) {
			return visitor.visitSwitchStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class SwitchBlockContext extends ParserRuleContext {
	public caseClause(): CaseClauseContext[];
	public caseClause(i: number): CaseClauseContext;
	public caseClause(i?: number): CaseClauseContext | CaseClauseContext[] {
		if (i === undefined) {
			return this.getRuleContexts(CaseClauseContext);
		} else {
			return this.getRuleContext(i, CaseClauseContext);
		}
	}
	public defaultClause(): DefaultClauseContext[];
	public defaultClause(i: number): DefaultClauseContext;
	public defaultClause(i?: number): DefaultClauseContext | DefaultClauseContext[] {
		if (i === undefined) {
			return this.getRuleContexts(DefaultClauseContext);
		} else {
			return this.getRuleContext(i, DefaultClauseContext);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_switchBlock; }
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterSwitchBlock) {
			listener.enterSwitchBlock(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitSwitchBlock) {
			listener.exitSwitchBlock(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitSwitchBlock) {
			return visitor.visitSwitchBlock(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class CaseClauseContext extends ParserRuleContext {
	public CASE(): TerminalNode { return this.getToken(LPCParser.CASE, 0); }
	public expression(): ExpressionContext {
		return this.getRuleContext(0, ExpressionContext);
	}
	public COLON(): TerminalNode { return this.getToken(LPCParser.COLON, 0); }
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
	public get ruleIndex(): number { return LPCParser.RULE_caseClause; }
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterCaseClause) {
			listener.enterCaseClause(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitCaseClause) {
			listener.exitCaseClause(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitCaseClause) {
			return visitor.visitCaseClause(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class DefaultClauseContext extends ParserRuleContext {
	public DEFAULT(): TerminalNode { return this.getToken(LPCParser.DEFAULT, 0); }
	public COLON(): TerminalNode { return this.getToken(LPCParser.COLON, 0); }
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
	public get ruleIndex(): number { return LPCParser.RULE_defaultClause; }
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterDefaultClause) {
			listener.enterDefaultClause(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitDefaultClause) {
			listener.exitDefaultClause(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitDefaultClause) {
			return visitor.visitDefaultClause(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ReturnStatementContext extends ParserRuleContext {
	public RETURN(): TerminalNode { return this.getToken(LPCParser.RETURN, 0); }
	public SEMICOLON(): TerminalNode { return this.getToken(LPCParser.SEMICOLON, 0); }
	public expression(): ExpressionContext | undefined {
		return this.tryGetRuleContext(0, ExpressionContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_returnStatement; }
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterReturnStatement) {
			listener.enterReturnStatement(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitReturnStatement) {
			listener.exitReturnStatement(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitReturnStatement) {
			return visitor.visitReturnStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class BreakStatementContext extends ParserRuleContext {
	public BREAK(): TerminalNode { return this.getToken(LPCParser.BREAK, 0); }
	public SEMICOLON(): TerminalNode { return this.getToken(LPCParser.SEMICOLON, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_breakStatement; }
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterBreakStatement) {
			listener.enterBreakStatement(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitBreakStatement) {
			listener.exitBreakStatement(this);
		}
	}
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
	public SEMICOLON(): TerminalNode { return this.getToken(LPCParser.SEMICOLON, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_continueStatement; }
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterContinueStatement) {
			listener.enterContinueStatement(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitContinueStatement) {
			listener.exitContinueStatement(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitContinueStatement) {
			return visitor.visitContinueStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class FallthroughStatementContext extends ParserRuleContext {
	public FALLTHROUGH(): TerminalNode { return this.getToken(LPCParser.FALLTHROUGH, 0); }
	public SEMICOLON(): TerminalNode { return this.getToken(LPCParser.SEMICOLON, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return LPCParser.RULE_fallthroughStatement; }
	// @Override
	public enterRule(listener: LPCParserListener): void {
		if (listener.enterFallthroughStatement) {
			listener.enterFallthroughStatement(this);
		}
	}
	// @Override
	public exitRule(listener: LPCParserListener): void {
		if (listener.exitFallthroughStatement) {
			listener.exitFallthroughStatement(this);
		}
	}
	// @Override
	public accept<Result>(visitor: LPCParserVisitor<Result>): Result {
		if (visitor.visitFallthroughStatement) {
			return visitor.visitFallthroughStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


