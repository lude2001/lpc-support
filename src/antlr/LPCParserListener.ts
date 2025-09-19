// Generated from grammar/LPCParser.g4 by ANTLR 4.9.0-SNAPSHOT


import { ParseTreeListener } from "antlr4ts/tree/ParseTreeListener";

import { ScopeIdentifierContext } from "./LPCParser";
import { StringConcatenationContext } from "./LPCParser";
import { ClosurePrimaryContext } from "./LPCParser";
import { MappingLiteralExprContext } from "./LPCParser";
import { NewExpressionPrimaryContext } from "./LPCParser";
import { AnonFunctionContext } from "./LPCParser";
import { IdentifierPrimaryContext } from "./LPCParser";
import { ParameterPlaceholderContext } from "./LPCParser";
import { IntegerPrimaryContext } from "./LPCParser";
import { FloatPrimaryContext } from "./LPCParser";
import { StringPrimaryContext } from "./LPCParser";
import { CharPrimaryContext } from "./LPCParser";
import { ArrayLiteralContext } from "./LPCParser";
import { ParenExprContext } from "./LPCParser";
import { RefVariableContext } from "./LPCParser";
import { TailIndexOnlyContext } from "./LPCParser";
import { HeadRangeContext } from "./LPCParser";
import { OpenRangeContext } from "./LPCParser";
import { SingleIndexContext } from "./LPCParser";
import { TailHeadRangeContext } from "./LPCParser";
import { SourceFileContext } from "./LPCParser";
import { StatementContext } from "./LPCParser";
import { FunctionDefContext } from "./LPCParser";
import { VariableDeclContext } from "./LPCParser";
import { VariableDeclaratorContext } from "./LPCParser";
import { ParameterListContext } from "./LPCParser";
import { ParameterContext } from "./LPCParser";
import { StructDefContext } from "./LPCParser";
import { ClassDefContext } from "./LPCParser";
import { StructMemberListContext } from "./LPCParser";
import { StructMemberContext } from "./LPCParser";
import { TypeSpecContext } from "./LPCParser";
import { BlockContext } from "./LPCParser";
import { ExprStatementContext } from "./LPCParser";
import { ExpressionContext } from "./LPCParser";
import { AssignmentExpressionContext } from "./LPCParser";
import { ConditionalExpressionContext } from "./LPCParser";
import { LogicalOrExpressionContext } from "./LPCParser";
import { LogicalAndExpressionContext } from "./LPCParser";
import { BitwiseOrExpressionContext } from "./LPCParser";
import { BitwiseXorExpressionContext } from "./LPCParser";
import { BitwiseAndExpressionContext } from "./LPCParser";
import { EqualityExpressionContext } from "./LPCParser";
import { RelationalExpressionContext } from "./LPCParser";
import { ShiftExpressionContext } from "./LPCParser";
import { AdditiveExpressionContext } from "./LPCParser";
import { MultiplicativeExpressionContext } from "./LPCParser";
import { UnaryExpressionContext } from "./LPCParser";
import { CastExpressionContext } from "./LPCParser";
import { CastTypeContext } from "./LPCParser";
import { PostfixExpressionContext } from "./LPCParser";
import { ArgumentListContext } from "./LPCParser";
import { PrimaryContext } from "./LPCParser";
import { StringConcatContext } from "./LPCParser";
import { ConcatItemContext } from "./LPCParser";
import { IfStatementContext } from "./LPCParser";
import { WhileStatementContext } from "./LPCParser";
import { DoWhileStatementContext } from "./LPCParser";
import { ForStatementContext } from "./LPCParser";
import { ForInitContext } from "./LPCParser";
import { ExpressionListContext } from "./LPCParser";
import { ForeachStatementContext } from "./LPCParser";
import { ForeachInitContext } from "./LPCParser";
import { ForeachVarContext } from "./LPCParser";
import { SwitchStatementContext } from "./LPCParser";
import { SwitchSectionContext } from "./LPCParser";
import { SwitchLabelWithColonContext } from "./LPCParser";
import { SwitchLabelContext } from "./LPCParser";
import { BreakStatementContext } from "./LPCParser";
import { ContinueStatementContext } from "./LPCParser";
import { ReturnStatementContext } from "./LPCParser";
import { ClosureExprContext } from "./LPCParser";
import { InheritStatementContext } from "./LPCParser";
import { IncludeStatementContext } from "./LPCParser";
import { MacroInvokeContext } from "./LPCParser";
import { PrototypeStatementContext } from "./LPCParser";
import { MappingLiteralContext } from "./LPCParser";
import { MappingPairListContext } from "./LPCParser";
import { MappingPairContext } from "./LPCParser";
import { NewExpressionContext } from "./LPCParser";
import { StructInitializerListContext } from "./LPCParser";
import { StructInitializerContext } from "./LPCParser";
import { SliceExprContext } from "./LPCParser";


/**
 * This interface defines a complete listener for a parse tree produced by
 * `LPCParser`.
 */
export interface LPCParserListener extends ParseTreeListener {
	/**
	 * Enter a parse tree produced by the `scopeIdentifier`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 */
	enterScopeIdentifier?: (ctx: ScopeIdentifierContext) => void;
	/**
	 * Exit a parse tree produced by the `scopeIdentifier`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 */
	exitScopeIdentifier?: (ctx: ScopeIdentifierContext) => void;

	/**
	 * Enter a parse tree produced by the `stringConcatenation`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 */
	enterStringConcatenation?: (ctx: StringConcatenationContext) => void;
	/**
	 * Exit a parse tree produced by the `stringConcatenation`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 */
	exitStringConcatenation?: (ctx: StringConcatenationContext) => void;

	/**
	 * Enter a parse tree produced by the `closurePrimary`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 */
	enterClosurePrimary?: (ctx: ClosurePrimaryContext) => void;
	/**
	 * Exit a parse tree produced by the `closurePrimary`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 */
	exitClosurePrimary?: (ctx: ClosurePrimaryContext) => void;

	/**
	 * Enter a parse tree produced by the `mappingLiteralExpr`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 */
	enterMappingLiteralExpr?: (ctx: MappingLiteralExprContext) => void;
	/**
	 * Exit a parse tree produced by the `mappingLiteralExpr`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 */
	exitMappingLiteralExpr?: (ctx: MappingLiteralExprContext) => void;

	/**
	 * Enter a parse tree produced by the `newExpressionPrimary`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 */
	enterNewExpressionPrimary?: (ctx: NewExpressionPrimaryContext) => void;
	/**
	 * Exit a parse tree produced by the `newExpressionPrimary`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 */
	exitNewExpressionPrimary?: (ctx: NewExpressionPrimaryContext) => void;

	/**
	 * Enter a parse tree produced by the `anonFunction`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 */
	enterAnonFunction?: (ctx: AnonFunctionContext) => void;
	/**
	 * Exit a parse tree produced by the `anonFunction`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 */
	exitAnonFunction?: (ctx: AnonFunctionContext) => void;

	/**
	 * Enter a parse tree produced by the `identifierPrimary`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 */
	enterIdentifierPrimary?: (ctx: IdentifierPrimaryContext) => void;
	/**
	 * Exit a parse tree produced by the `identifierPrimary`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 */
	exitIdentifierPrimary?: (ctx: IdentifierPrimaryContext) => void;

	/**
	 * Enter a parse tree produced by the `parameterPlaceholder`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 */
	enterParameterPlaceholder?: (ctx: ParameterPlaceholderContext) => void;
	/**
	 * Exit a parse tree produced by the `parameterPlaceholder`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 */
	exitParameterPlaceholder?: (ctx: ParameterPlaceholderContext) => void;

	/**
	 * Enter a parse tree produced by the `integerPrimary`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 */
	enterIntegerPrimary?: (ctx: IntegerPrimaryContext) => void;
	/**
	 * Exit a parse tree produced by the `integerPrimary`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 */
	exitIntegerPrimary?: (ctx: IntegerPrimaryContext) => void;

	/**
	 * Enter a parse tree produced by the `floatPrimary`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 */
	enterFloatPrimary?: (ctx: FloatPrimaryContext) => void;
	/**
	 * Exit a parse tree produced by the `floatPrimary`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 */
	exitFloatPrimary?: (ctx: FloatPrimaryContext) => void;

	/**
	 * Enter a parse tree produced by the `stringPrimary`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 */
	enterStringPrimary?: (ctx: StringPrimaryContext) => void;
	/**
	 * Exit a parse tree produced by the `stringPrimary`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 */
	exitStringPrimary?: (ctx: StringPrimaryContext) => void;

	/**
	 * Enter a parse tree produced by the `charPrimary`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 */
	enterCharPrimary?: (ctx: CharPrimaryContext) => void;
	/**
	 * Exit a parse tree produced by the `charPrimary`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 */
	exitCharPrimary?: (ctx: CharPrimaryContext) => void;

	/**
	 * Enter a parse tree produced by the `arrayLiteral`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 */
	enterArrayLiteral?: (ctx: ArrayLiteralContext) => void;
	/**
	 * Exit a parse tree produced by the `arrayLiteral`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 */
	exitArrayLiteral?: (ctx: ArrayLiteralContext) => void;

	/**
	 * Enter a parse tree produced by the `parenExpr`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 */
	enterParenExpr?: (ctx: ParenExprContext) => void;
	/**
	 * Exit a parse tree produced by the `parenExpr`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 */
	exitParenExpr?: (ctx: ParenExprContext) => void;

	/**
	 * Enter a parse tree produced by the `refVariable`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 */
	enterRefVariable?: (ctx: RefVariableContext) => void;
	/**
	 * Exit a parse tree produced by the `refVariable`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 */
	exitRefVariable?: (ctx: RefVariableContext) => void;

	/**
	 * Enter a parse tree produced by the `tailIndexOnly`
	 * labeled alternative in `LPCParser.sliceExpr`.
	 * @param ctx the parse tree
	 */
	enterTailIndexOnly?: (ctx: TailIndexOnlyContext) => void;
	/**
	 * Exit a parse tree produced by the `tailIndexOnly`
	 * labeled alternative in `LPCParser.sliceExpr`.
	 * @param ctx the parse tree
	 */
	exitTailIndexOnly?: (ctx: TailIndexOnlyContext) => void;

	/**
	 * Enter a parse tree produced by the `headRange`
	 * labeled alternative in `LPCParser.sliceExpr`.
	 * @param ctx the parse tree
	 */
	enterHeadRange?: (ctx: HeadRangeContext) => void;
	/**
	 * Exit a parse tree produced by the `headRange`
	 * labeled alternative in `LPCParser.sliceExpr`.
	 * @param ctx the parse tree
	 */
	exitHeadRange?: (ctx: HeadRangeContext) => void;

	/**
	 * Enter a parse tree produced by the `openRange`
	 * labeled alternative in `LPCParser.sliceExpr`.
	 * @param ctx the parse tree
	 */
	enterOpenRange?: (ctx: OpenRangeContext) => void;
	/**
	 * Exit a parse tree produced by the `openRange`
	 * labeled alternative in `LPCParser.sliceExpr`.
	 * @param ctx the parse tree
	 */
	exitOpenRange?: (ctx: OpenRangeContext) => void;

	/**
	 * Enter a parse tree produced by the `singleIndex`
	 * labeled alternative in `LPCParser.sliceExpr`.
	 * @param ctx the parse tree
	 */
	enterSingleIndex?: (ctx: SingleIndexContext) => void;
	/**
	 * Exit a parse tree produced by the `singleIndex`
	 * labeled alternative in `LPCParser.sliceExpr`.
	 * @param ctx the parse tree
	 */
	exitSingleIndex?: (ctx: SingleIndexContext) => void;

	/**
	 * Enter a parse tree produced by the `tailHeadRange`
	 * labeled alternative in `LPCParser.sliceExpr`.
	 * @param ctx the parse tree
	 */
	enterTailHeadRange?: (ctx: TailHeadRangeContext) => void;
	/**
	 * Exit a parse tree produced by the `tailHeadRange`
	 * labeled alternative in `LPCParser.sliceExpr`.
	 * @param ctx the parse tree
	 */
	exitTailHeadRange?: (ctx: TailHeadRangeContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.sourceFile`.
	 * @param ctx the parse tree
	 */
	enterSourceFile?: (ctx: SourceFileContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.sourceFile`.
	 * @param ctx the parse tree
	 */
	exitSourceFile?: (ctx: SourceFileContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.statement`.
	 * @param ctx the parse tree
	 */
	enterStatement?: (ctx: StatementContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.statement`.
	 * @param ctx the parse tree
	 */
	exitStatement?: (ctx: StatementContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.functionDef`.
	 * @param ctx the parse tree
	 */
	enterFunctionDef?: (ctx: FunctionDefContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.functionDef`.
	 * @param ctx the parse tree
	 */
	exitFunctionDef?: (ctx: FunctionDefContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.variableDecl`.
	 * @param ctx the parse tree
	 */
	enterVariableDecl?: (ctx: VariableDeclContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.variableDecl`.
	 * @param ctx the parse tree
	 */
	exitVariableDecl?: (ctx: VariableDeclContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.variableDeclarator`.
	 * @param ctx the parse tree
	 */
	enterVariableDeclarator?: (ctx: VariableDeclaratorContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.variableDeclarator`.
	 * @param ctx the parse tree
	 */
	exitVariableDeclarator?: (ctx: VariableDeclaratorContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.parameterList`.
	 * @param ctx the parse tree
	 */
	enterParameterList?: (ctx: ParameterListContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.parameterList`.
	 * @param ctx the parse tree
	 */
	exitParameterList?: (ctx: ParameterListContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.parameter`.
	 * @param ctx the parse tree
	 */
	enterParameter?: (ctx: ParameterContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.parameter`.
	 * @param ctx the parse tree
	 */
	exitParameter?: (ctx: ParameterContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.structDef`.
	 * @param ctx the parse tree
	 */
	enterStructDef?: (ctx: StructDefContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.structDef`.
	 * @param ctx the parse tree
	 */
	exitStructDef?: (ctx: StructDefContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.classDef`.
	 * @param ctx the parse tree
	 */
	enterClassDef?: (ctx: ClassDefContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.classDef`.
	 * @param ctx the parse tree
	 */
	exitClassDef?: (ctx: ClassDefContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.structMemberList`.
	 * @param ctx the parse tree
	 */
	enterStructMemberList?: (ctx: StructMemberListContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.structMemberList`.
	 * @param ctx the parse tree
	 */
	exitStructMemberList?: (ctx: StructMemberListContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.structMember`.
	 * @param ctx the parse tree
	 */
	enterStructMember?: (ctx: StructMemberContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.structMember`.
	 * @param ctx the parse tree
	 */
	exitStructMember?: (ctx: StructMemberContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.typeSpec`.
	 * @param ctx the parse tree
	 */
	enterTypeSpec?: (ctx: TypeSpecContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.typeSpec`.
	 * @param ctx the parse tree
	 */
	exitTypeSpec?: (ctx: TypeSpecContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.block`.
	 * @param ctx the parse tree
	 */
	enterBlock?: (ctx: BlockContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.block`.
	 * @param ctx the parse tree
	 */
	exitBlock?: (ctx: BlockContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.exprStatement`.
	 * @param ctx the parse tree
	 */
	enterExprStatement?: (ctx: ExprStatementContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.exprStatement`.
	 * @param ctx the parse tree
	 */
	exitExprStatement?: (ctx: ExprStatementContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	enterExpression?: (ctx: ExpressionContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	exitExpression?: (ctx: ExpressionContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.assignmentExpression`.
	 * @param ctx the parse tree
	 */
	enterAssignmentExpression?: (ctx: AssignmentExpressionContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.assignmentExpression`.
	 * @param ctx the parse tree
	 */
	exitAssignmentExpression?: (ctx: AssignmentExpressionContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.conditionalExpression`.
	 * @param ctx the parse tree
	 */
	enterConditionalExpression?: (ctx: ConditionalExpressionContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.conditionalExpression`.
	 * @param ctx the parse tree
	 */
	exitConditionalExpression?: (ctx: ConditionalExpressionContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.logicalOrExpression`.
	 * @param ctx the parse tree
	 */
	enterLogicalOrExpression?: (ctx: LogicalOrExpressionContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.logicalOrExpression`.
	 * @param ctx the parse tree
	 */
	exitLogicalOrExpression?: (ctx: LogicalOrExpressionContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.logicalAndExpression`.
	 * @param ctx the parse tree
	 */
	enterLogicalAndExpression?: (ctx: LogicalAndExpressionContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.logicalAndExpression`.
	 * @param ctx the parse tree
	 */
	exitLogicalAndExpression?: (ctx: LogicalAndExpressionContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.bitwiseOrExpression`.
	 * @param ctx the parse tree
	 */
	enterBitwiseOrExpression?: (ctx: BitwiseOrExpressionContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.bitwiseOrExpression`.
	 * @param ctx the parse tree
	 */
	exitBitwiseOrExpression?: (ctx: BitwiseOrExpressionContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.bitwiseXorExpression`.
	 * @param ctx the parse tree
	 */
	enterBitwiseXorExpression?: (ctx: BitwiseXorExpressionContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.bitwiseXorExpression`.
	 * @param ctx the parse tree
	 */
	exitBitwiseXorExpression?: (ctx: BitwiseXorExpressionContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.bitwiseAndExpression`.
	 * @param ctx the parse tree
	 */
	enterBitwiseAndExpression?: (ctx: BitwiseAndExpressionContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.bitwiseAndExpression`.
	 * @param ctx the parse tree
	 */
	exitBitwiseAndExpression?: (ctx: BitwiseAndExpressionContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.equalityExpression`.
	 * @param ctx the parse tree
	 */
	enterEqualityExpression?: (ctx: EqualityExpressionContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.equalityExpression`.
	 * @param ctx the parse tree
	 */
	exitEqualityExpression?: (ctx: EqualityExpressionContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.relationalExpression`.
	 * @param ctx the parse tree
	 */
	enterRelationalExpression?: (ctx: RelationalExpressionContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.relationalExpression`.
	 * @param ctx the parse tree
	 */
	exitRelationalExpression?: (ctx: RelationalExpressionContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.shiftExpression`.
	 * @param ctx the parse tree
	 */
	enterShiftExpression?: (ctx: ShiftExpressionContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.shiftExpression`.
	 * @param ctx the parse tree
	 */
	exitShiftExpression?: (ctx: ShiftExpressionContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.additiveExpression`.
	 * @param ctx the parse tree
	 */
	enterAdditiveExpression?: (ctx: AdditiveExpressionContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.additiveExpression`.
	 * @param ctx the parse tree
	 */
	exitAdditiveExpression?: (ctx: AdditiveExpressionContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.multiplicativeExpression`.
	 * @param ctx the parse tree
	 */
	enterMultiplicativeExpression?: (ctx: MultiplicativeExpressionContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.multiplicativeExpression`.
	 * @param ctx the parse tree
	 */
	exitMultiplicativeExpression?: (ctx: MultiplicativeExpressionContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.unaryExpression`.
	 * @param ctx the parse tree
	 */
	enterUnaryExpression?: (ctx: UnaryExpressionContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.unaryExpression`.
	 * @param ctx the parse tree
	 */
	exitUnaryExpression?: (ctx: UnaryExpressionContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.castExpression`.
	 * @param ctx the parse tree
	 */
	enterCastExpression?: (ctx: CastExpressionContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.castExpression`.
	 * @param ctx the parse tree
	 */
	exitCastExpression?: (ctx: CastExpressionContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.castType`.
	 * @param ctx the parse tree
	 */
	enterCastType?: (ctx: CastTypeContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.castType`.
	 * @param ctx the parse tree
	 */
	exitCastType?: (ctx: CastTypeContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.postfixExpression`.
	 * @param ctx the parse tree
	 */
	enterPostfixExpression?: (ctx: PostfixExpressionContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.postfixExpression`.
	 * @param ctx the parse tree
	 */
	exitPostfixExpression?: (ctx: PostfixExpressionContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.argumentList`.
	 * @param ctx the parse tree
	 */
	enterArgumentList?: (ctx: ArgumentListContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.argumentList`.
	 * @param ctx the parse tree
	 */
	exitArgumentList?: (ctx: ArgumentListContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.primary`.
	 * @param ctx the parse tree
	 */
	enterPrimary?: (ctx: PrimaryContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.primary`.
	 * @param ctx the parse tree
	 */
	exitPrimary?: (ctx: PrimaryContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.stringConcat`.
	 * @param ctx the parse tree
	 */
	enterStringConcat?: (ctx: StringConcatContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.stringConcat`.
	 * @param ctx the parse tree
	 */
	exitStringConcat?: (ctx: StringConcatContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.concatItem`.
	 * @param ctx the parse tree
	 */
	enterConcatItem?: (ctx: ConcatItemContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.concatItem`.
	 * @param ctx the parse tree
	 */
	exitConcatItem?: (ctx: ConcatItemContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.ifStatement`.
	 * @param ctx the parse tree
	 */
	enterIfStatement?: (ctx: IfStatementContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.ifStatement`.
	 * @param ctx the parse tree
	 */
	exitIfStatement?: (ctx: IfStatementContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.whileStatement`.
	 * @param ctx the parse tree
	 */
	enterWhileStatement?: (ctx: WhileStatementContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.whileStatement`.
	 * @param ctx the parse tree
	 */
	exitWhileStatement?: (ctx: WhileStatementContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.doWhileStatement`.
	 * @param ctx the parse tree
	 */
	enterDoWhileStatement?: (ctx: DoWhileStatementContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.doWhileStatement`.
	 * @param ctx the parse tree
	 */
	exitDoWhileStatement?: (ctx: DoWhileStatementContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.forStatement`.
	 * @param ctx the parse tree
	 */
	enterForStatement?: (ctx: ForStatementContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.forStatement`.
	 * @param ctx the parse tree
	 */
	exitForStatement?: (ctx: ForStatementContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.forInit`.
	 * @param ctx the parse tree
	 */
	enterForInit?: (ctx: ForInitContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.forInit`.
	 * @param ctx the parse tree
	 */
	exitForInit?: (ctx: ForInitContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.expressionList`.
	 * @param ctx the parse tree
	 */
	enterExpressionList?: (ctx: ExpressionListContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.expressionList`.
	 * @param ctx the parse tree
	 */
	exitExpressionList?: (ctx: ExpressionListContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.foreachStatement`.
	 * @param ctx the parse tree
	 */
	enterForeachStatement?: (ctx: ForeachStatementContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.foreachStatement`.
	 * @param ctx the parse tree
	 */
	exitForeachStatement?: (ctx: ForeachStatementContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.foreachInit`.
	 * @param ctx the parse tree
	 */
	enterForeachInit?: (ctx: ForeachInitContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.foreachInit`.
	 * @param ctx the parse tree
	 */
	exitForeachInit?: (ctx: ForeachInitContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.foreachVar`.
	 * @param ctx the parse tree
	 */
	enterForeachVar?: (ctx: ForeachVarContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.foreachVar`.
	 * @param ctx the parse tree
	 */
	exitForeachVar?: (ctx: ForeachVarContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.switchStatement`.
	 * @param ctx the parse tree
	 */
	enterSwitchStatement?: (ctx: SwitchStatementContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.switchStatement`.
	 * @param ctx the parse tree
	 */
	exitSwitchStatement?: (ctx: SwitchStatementContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.switchSection`.
	 * @param ctx the parse tree
	 */
	enterSwitchSection?: (ctx: SwitchSectionContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.switchSection`.
	 * @param ctx the parse tree
	 */
	exitSwitchSection?: (ctx: SwitchSectionContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.switchLabelWithColon`.
	 * @param ctx the parse tree
	 */
	enterSwitchLabelWithColon?: (ctx: SwitchLabelWithColonContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.switchLabelWithColon`.
	 * @param ctx the parse tree
	 */
	exitSwitchLabelWithColon?: (ctx: SwitchLabelWithColonContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.switchLabel`.
	 * @param ctx the parse tree
	 */
	enterSwitchLabel?: (ctx: SwitchLabelContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.switchLabel`.
	 * @param ctx the parse tree
	 */
	exitSwitchLabel?: (ctx: SwitchLabelContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.breakStatement`.
	 * @param ctx the parse tree
	 */
	enterBreakStatement?: (ctx: BreakStatementContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.breakStatement`.
	 * @param ctx the parse tree
	 */
	exitBreakStatement?: (ctx: BreakStatementContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.continueStatement`.
	 * @param ctx the parse tree
	 */
	enterContinueStatement?: (ctx: ContinueStatementContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.continueStatement`.
	 * @param ctx the parse tree
	 */
	exitContinueStatement?: (ctx: ContinueStatementContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.returnStatement`.
	 * @param ctx the parse tree
	 */
	enterReturnStatement?: (ctx: ReturnStatementContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.returnStatement`.
	 * @param ctx the parse tree
	 */
	exitReturnStatement?: (ctx: ReturnStatementContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.closureExpr`.
	 * @param ctx the parse tree
	 */
	enterClosureExpr?: (ctx: ClosureExprContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.closureExpr`.
	 * @param ctx the parse tree
	 */
	exitClosureExpr?: (ctx: ClosureExprContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.inheritStatement`.
	 * @param ctx the parse tree
	 */
	enterInheritStatement?: (ctx: InheritStatementContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.inheritStatement`.
	 * @param ctx the parse tree
	 */
	exitInheritStatement?: (ctx: InheritStatementContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.includeStatement`.
	 * @param ctx the parse tree
	 */
	enterIncludeStatement?: (ctx: IncludeStatementContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.includeStatement`.
	 * @param ctx the parse tree
	 */
	exitIncludeStatement?: (ctx: IncludeStatementContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.macroInvoke`.
	 * @param ctx the parse tree
	 */
	enterMacroInvoke?: (ctx: MacroInvokeContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.macroInvoke`.
	 * @param ctx the parse tree
	 */
	exitMacroInvoke?: (ctx: MacroInvokeContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.prototypeStatement`.
	 * @param ctx the parse tree
	 */
	enterPrototypeStatement?: (ctx: PrototypeStatementContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.prototypeStatement`.
	 * @param ctx the parse tree
	 */
	exitPrototypeStatement?: (ctx: PrototypeStatementContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.mappingLiteral`.
	 * @param ctx the parse tree
	 */
	enterMappingLiteral?: (ctx: MappingLiteralContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.mappingLiteral`.
	 * @param ctx the parse tree
	 */
	exitMappingLiteral?: (ctx: MappingLiteralContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.mappingPairList`.
	 * @param ctx the parse tree
	 */
	enterMappingPairList?: (ctx: MappingPairListContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.mappingPairList`.
	 * @param ctx the parse tree
	 */
	exitMappingPairList?: (ctx: MappingPairListContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.mappingPair`.
	 * @param ctx the parse tree
	 */
	enterMappingPair?: (ctx: MappingPairContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.mappingPair`.
	 * @param ctx the parse tree
	 */
	exitMappingPair?: (ctx: MappingPairContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.newExpression`.
	 * @param ctx the parse tree
	 */
	enterNewExpression?: (ctx: NewExpressionContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.newExpression`.
	 * @param ctx the parse tree
	 */
	exitNewExpression?: (ctx: NewExpressionContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.structInitializerList`.
	 * @param ctx the parse tree
	 */
	enterStructInitializerList?: (ctx: StructInitializerListContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.structInitializerList`.
	 * @param ctx the parse tree
	 */
	exitStructInitializerList?: (ctx: StructInitializerListContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.structInitializer`.
	 * @param ctx the parse tree
	 */
	enterStructInitializer?: (ctx: StructInitializerContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.structInitializer`.
	 * @param ctx the parse tree
	 */
	exitStructInitializer?: (ctx: StructInitializerContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.sliceExpr`.
	 * @param ctx the parse tree
	 */
	enterSliceExpr?: (ctx: SliceExprContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.sliceExpr`.
	 * @param ctx the parse tree
	 */
	exitSliceExpr?: (ctx: SliceExprContext) => void;
}

