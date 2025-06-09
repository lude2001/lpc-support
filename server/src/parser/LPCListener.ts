// Generated from grammar/LPC.g4 by ANTLR 4.9.0-SNAPSHOT


import { ParseTreeListener } from "antlr4ts/tree/ParseTreeListener";

import { PrimaryExprContext } from "./LPCParser";
import { ArrayAccessExprContext } from "./LPCParser";
import { ArraySliceExprContext } from "./LPCParser";
import { FunctionCallExprContext } from "./LPCParser";
import { MemberAccessExprContext } from "./LPCParser";
import { ImplicitConcatExprContext } from "./LPCParser";
import { PreIncrementExprContext } from "./LPCParser";
import { PreDecrementExprContext } from "./LPCParser";
import { PostIncrementExprContext } from "./LPCParser";
import { PostDecrementExprContext } from "./LPCParser";
import { UnaryExprContext } from "./LPCParser";
import { CastExprContext } from "./LPCParser";
import { MultiplicativeExprContext } from "./LPCParser";
import { AdditiveExprContext } from "./LPCParser";
import { ShiftExprContext } from "./LPCParser";
import { RelationalExprContext } from "./LPCParser";
import { EqualityExprContext } from "./LPCParser";
import { BitwiseAndExprContext } from "./LPCParser";
import { BitwiseXorExprContext } from "./LPCParser";
import { BitwiseOrExprContext } from "./LPCParser";
import { LogicalAndExprContext } from "./LPCParser";
import { LogicalOrExprContext } from "./LPCParser";
import { ConditionalExprContext } from "./LPCParser";
import { AssignmentExprContext } from "./LPCParser";
import { ProgramContext } from "./LPCParser";
import { DeclarationContext } from "./LPCParser";
import { StatementContext } from "./LPCParser";
import { BlockContext } from "./LPCParser";
import { ExpressionStatementContext } from "./LPCParser";
import { VariableDeclarationContext } from "./LPCParser";
import { VariableDeclaratorContext } from "./LPCParser";
import { FunctionDeclarationContext } from "./LPCParser";
import { ParameterListContext } from "./LPCParser";
import { ParameterContext } from "./LPCParser";
import { InheritStatementContext } from "./LPCParser";
import { PreprocessorDirectiveContext } from "./LPCParser";
import { PpIncludeContext } from "./LPCParser";
import { PpDefineContext } from "./LPCParser";
import { PpConditionalContext } from "./LPCParser";
import { PpErrorContext } from "./LPCParser";
import { PpPragmaContext } from "./LPCParser";
import { ExpressionContext } from "./LPCParser";
import { CastExpressionContext } from "./LPCParser";
import { ClosureExpressionContext } from "./LPCParser";
import { AssignmentOperatorContext } from "./LPCParser";
import { PrimaryContext } from "./LPCParser";
import { ArgumentListContext } from "./LPCParser";
import { ExpressionOrEllipsisContext } from "./LPCParser";
import { LiteralContext } from "./LPCParser";
import { MappingLiteralContext } from "./LPCParser";
import { MappingElementListContext } from "./LPCParser";
import { MappingElementContext } from "./LPCParser";
import { ArrayLiteralContext } from "./LPCParser";
import { ExpressionListContext } from "./LPCParser";
import { TypeSpecifierContext } from "./LPCParser";
import { TypeNameContext } from "./LPCParser";
import { ModifierContext } from "./LPCParser";
import { IdentifierContext } from "./LPCParser";
import { KeywordIdentifierContext } from "./LPCParser";
import { IfStatementContext } from "./LPCParser";
import { ForStatementContext } from "./LPCParser";
import { WhileStatementContext } from "./LPCParser";
import { DoWhileStatementContext } from "./LPCParser";
import { ForeachStatementContext } from "./LPCParser";
import { SwitchStatementContext } from "./LPCParser";
import { SwitchBlockContext } from "./LPCParser";
import { CaseClauseContext } from "./LPCParser";
import { DefaultClauseContext } from "./LPCParser";
import { ReturnStatementContext } from "./LPCParser";
import { BreakStatementContext } from "./LPCParser";
import { ContinueStatementContext } from "./LPCParser";
import { FallthroughStatementContext } from "./LPCParser";


/**
 * This interface defines a complete listener for a parse tree produced by
 * `LPCParser`.
 */
export interface LPCListener extends ParseTreeListener {
	/**
	 * Enter a parse tree produced by the `PrimaryExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	enterPrimaryExpr?: (ctx: PrimaryExprContext) => void;
	/**
	 * Exit a parse tree produced by the `PrimaryExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	exitPrimaryExpr?: (ctx: PrimaryExprContext) => void;

	/**
	 * Enter a parse tree produced by the `ArrayAccessExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	enterArrayAccessExpr?: (ctx: ArrayAccessExprContext) => void;
	/**
	 * Exit a parse tree produced by the `ArrayAccessExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	exitArrayAccessExpr?: (ctx: ArrayAccessExprContext) => void;

	/**
	 * Enter a parse tree produced by the `ArraySliceExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	enterArraySliceExpr?: (ctx: ArraySliceExprContext) => void;
	/**
	 * Exit a parse tree produced by the `ArraySliceExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	exitArraySliceExpr?: (ctx: ArraySliceExprContext) => void;

	/**
	 * Enter a parse tree produced by the `FunctionCallExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	enterFunctionCallExpr?: (ctx: FunctionCallExprContext) => void;
	/**
	 * Exit a parse tree produced by the `FunctionCallExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	exitFunctionCallExpr?: (ctx: FunctionCallExprContext) => void;

	/**
	 * Enter a parse tree produced by the `MemberAccessExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	enterMemberAccessExpr?: (ctx: MemberAccessExprContext) => void;
	/**
	 * Exit a parse tree produced by the `MemberAccessExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	exitMemberAccessExpr?: (ctx: MemberAccessExprContext) => void;

	/**
	 * Enter a parse tree produced by the `ImplicitConcatExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	enterImplicitConcatExpr?: (ctx: ImplicitConcatExprContext) => void;
	/**
	 * Exit a parse tree produced by the `ImplicitConcatExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	exitImplicitConcatExpr?: (ctx: ImplicitConcatExprContext) => void;

	/**
	 * Enter a parse tree produced by the `PreIncrementExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	enterPreIncrementExpr?: (ctx: PreIncrementExprContext) => void;
	/**
	 * Exit a parse tree produced by the `PreIncrementExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	exitPreIncrementExpr?: (ctx: PreIncrementExprContext) => void;

	/**
	 * Enter a parse tree produced by the `PreDecrementExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	enterPreDecrementExpr?: (ctx: PreDecrementExprContext) => void;
	/**
	 * Exit a parse tree produced by the `PreDecrementExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	exitPreDecrementExpr?: (ctx: PreDecrementExprContext) => void;

	/**
	 * Enter a parse tree produced by the `PostIncrementExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	enterPostIncrementExpr?: (ctx: PostIncrementExprContext) => void;
	/**
	 * Exit a parse tree produced by the `PostIncrementExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	exitPostIncrementExpr?: (ctx: PostIncrementExprContext) => void;

	/**
	 * Enter a parse tree produced by the `PostDecrementExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	enterPostDecrementExpr?: (ctx: PostDecrementExprContext) => void;
	/**
	 * Exit a parse tree produced by the `PostDecrementExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	exitPostDecrementExpr?: (ctx: PostDecrementExprContext) => void;

	/**
	 * Enter a parse tree produced by the `UnaryExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	enterUnaryExpr?: (ctx: UnaryExprContext) => void;
	/**
	 * Exit a parse tree produced by the `UnaryExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	exitUnaryExpr?: (ctx: UnaryExprContext) => void;

	/**
	 * Enter a parse tree produced by the `CastExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	enterCastExpr?: (ctx: CastExprContext) => void;
	/**
	 * Exit a parse tree produced by the `CastExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	exitCastExpr?: (ctx: CastExprContext) => void;

	/**
	 * Enter a parse tree produced by the `MultiplicativeExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	enterMultiplicativeExpr?: (ctx: MultiplicativeExprContext) => void;
	/**
	 * Exit a parse tree produced by the `MultiplicativeExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	exitMultiplicativeExpr?: (ctx: MultiplicativeExprContext) => void;

	/**
	 * Enter a parse tree produced by the `AdditiveExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	enterAdditiveExpr?: (ctx: AdditiveExprContext) => void;
	/**
	 * Exit a parse tree produced by the `AdditiveExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	exitAdditiveExpr?: (ctx: AdditiveExprContext) => void;

	/**
	 * Enter a parse tree produced by the `ShiftExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	enterShiftExpr?: (ctx: ShiftExprContext) => void;
	/**
	 * Exit a parse tree produced by the `ShiftExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	exitShiftExpr?: (ctx: ShiftExprContext) => void;

	/**
	 * Enter a parse tree produced by the `RelationalExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	enterRelationalExpr?: (ctx: RelationalExprContext) => void;
	/**
	 * Exit a parse tree produced by the `RelationalExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	exitRelationalExpr?: (ctx: RelationalExprContext) => void;

	/**
	 * Enter a parse tree produced by the `EqualityExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	enterEqualityExpr?: (ctx: EqualityExprContext) => void;
	/**
	 * Exit a parse tree produced by the `EqualityExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	exitEqualityExpr?: (ctx: EqualityExprContext) => void;

	/**
	 * Enter a parse tree produced by the `BitwiseAndExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	enterBitwiseAndExpr?: (ctx: BitwiseAndExprContext) => void;
	/**
	 * Exit a parse tree produced by the `BitwiseAndExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	exitBitwiseAndExpr?: (ctx: BitwiseAndExprContext) => void;

	/**
	 * Enter a parse tree produced by the `BitwiseXorExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	enterBitwiseXorExpr?: (ctx: BitwiseXorExprContext) => void;
	/**
	 * Exit a parse tree produced by the `BitwiseXorExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	exitBitwiseXorExpr?: (ctx: BitwiseXorExprContext) => void;

	/**
	 * Enter a parse tree produced by the `BitwiseOrExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	enterBitwiseOrExpr?: (ctx: BitwiseOrExprContext) => void;
	/**
	 * Exit a parse tree produced by the `BitwiseOrExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	exitBitwiseOrExpr?: (ctx: BitwiseOrExprContext) => void;

	/**
	 * Enter a parse tree produced by the `LogicalAndExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	enterLogicalAndExpr?: (ctx: LogicalAndExprContext) => void;
	/**
	 * Exit a parse tree produced by the `LogicalAndExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	exitLogicalAndExpr?: (ctx: LogicalAndExprContext) => void;

	/**
	 * Enter a parse tree produced by the `LogicalOrExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	enterLogicalOrExpr?: (ctx: LogicalOrExprContext) => void;
	/**
	 * Exit a parse tree produced by the `LogicalOrExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	exitLogicalOrExpr?: (ctx: LogicalOrExprContext) => void;

	/**
	 * Enter a parse tree produced by the `ConditionalExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	enterConditionalExpr?: (ctx: ConditionalExprContext) => void;
	/**
	 * Exit a parse tree produced by the `ConditionalExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	exitConditionalExpr?: (ctx: ConditionalExprContext) => void;

	/**
	 * Enter a parse tree produced by the `AssignmentExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	enterAssignmentExpr?: (ctx: AssignmentExprContext) => void;
	/**
	 * Exit a parse tree produced by the `AssignmentExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 */
	exitAssignmentExpr?: (ctx: AssignmentExprContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.program`.
	 * @param ctx the parse tree
	 */
	enterProgram?: (ctx: ProgramContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.program`.
	 * @param ctx the parse tree
	 */
	exitProgram?: (ctx: ProgramContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.declaration`.
	 * @param ctx the parse tree
	 */
	enterDeclaration?: (ctx: DeclarationContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.declaration`.
	 * @param ctx the parse tree
	 */
	exitDeclaration?: (ctx: DeclarationContext) => void;

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
	 * Enter a parse tree produced by `LPCParser.expressionStatement`.
	 * @param ctx the parse tree
	 */
	enterExpressionStatement?: (ctx: ExpressionStatementContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.expressionStatement`.
	 * @param ctx the parse tree
	 */
	exitExpressionStatement?: (ctx: ExpressionStatementContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.variableDeclaration`.
	 * @param ctx the parse tree
	 */
	enterVariableDeclaration?: (ctx: VariableDeclarationContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.variableDeclaration`.
	 * @param ctx the parse tree
	 */
	exitVariableDeclaration?: (ctx: VariableDeclarationContext) => void;

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
	 * Enter a parse tree produced by `LPCParser.functionDeclaration`.
	 * @param ctx the parse tree
	 */
	enterFunctionDeclaration?: (ctx: FunctionDeclarationContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.functionDeclaration`.
	 * @param ctx the parse tree
	 */
	exitFunctionDeclaration?: (ctx: FunctionDeclarationContext) => void;

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
	 * Enter a parse tree produced by `LPCParser.preprocessorDirective`.
	 * @param ctx the parse tree
	 */
	enterPreprocessorDirective?: (ctx: PreprocessorDirectiveContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.preprocessorDirective`.
	 * @param ctx the parse tree
	 */
	exitPreprocessorDirective?: (ctx: PreprocessorDirectiveContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.ppInclude`.
	 * @param ctx the parse tree
	 */
	enterPpInclude?: (ctx: PpIncludeContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.ppInclude`.
	 * @param ctx the parse tree
	 */
	exitPpInclude?: (ctx: PpIncludeContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.ppDefine`.
	 * @param ctx the parse tree
	 */
	enterPpDefine?: (ctx: PpDefineContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.ppDefine`.
	 * @param ctx the parse tree
	 */
	exitPpDefine?: (ctx: PpDefineContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.ppConditional`.
	 * @param ctx the parse tree
	 */
	enterPpConditional?: (ctx: PpConditionalContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.ppConditional`.
	 * @param ctx the parse tree
	 */
	exitPpConditional?: (ctx: PpConditionalContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.ppError`.
	 * @param ctx the parse tree
	 */
	enterPpError?: (ctx: PpErrorContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.ppError`.
	 * @param ctx the parse tree
	 */
	exitPpError?: (ctx: PpErrorContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.ppPragma`.
	 * @param ctx the parse tree
	 */
	enterPpPragma?: (ctx: PpPragmaContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.ppPragma`.
	 * @param ctx the parse tree
	 */
	exitPpPragma?: (ctx: PpPragmaContext) => void;

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
	 * Enter a parse tree produced by `LPCParser.closureExpression`.
	 * @param ctx the parse tree
	 */
	enterClosureExpression?: (ctx: ClosureExpressionContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.closureExpression`.
	 * @param ctx the parse tree
	 */
	exitClosureExpression?: (ctx: ClosureExpressionContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.assignmentOperator`.
	 * @param ctx the parse tree
	 */
	enterAssignmentOperator?: (ctx: AssignmentOperatorContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.assignmentOperator`.
	 * @param ctx the parse tree
	 */
	exitAssignmentOperator?: (ctx: AssignmentOperatorContext) => void;

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
	 * Enter a parse tree produced by `LPCParser.expressionOrEllipsis`.
	 * @param ctx the parse tree
	 */
	enterExpressionOrEllipsis?: (ctx: ExpressionOrEllipsisContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.expressionOrEllipsis`.
	 * @param ctx the parse tree
	 */
	exitExpressionOrEllipsis?: (ctx: ExpressionOrEllipsisContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.literal`.
	 * @param ctx the parse tree
	 */
	enterLiteral?: (ctx: LiteralContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.literal`.
	 * @param ctx the parse tree
	 */
	exitLiteral?: (ctx: LiteralContext) => void;

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
	 * Enter a parse tree produced by `LPCParser.mappingElementList`.
	 * @param ctx the parse tree
	 */
	enterMappingElementList?: (ctx: MappingElementListContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.mappingElementList`.
	 * @param ctx the parse tree
	 */
	exitMappingElementList?: (ctx: MappingElementListContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.mappingElement`.
	 * @param ctx the parse tree
	 */
	enterMappingElement?: (ctx: MappingElementContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.mappingElement`.
	 * @param ctx the parse tree
	 */
	exitMappingElement?: (ctx: MappingElementContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.arrayLiteral`.
	 * @param ctx the parse tree
	 */
	enterArrayLiteral?: (ctx: ArrayLiteralContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.arrayLiteral`.
	 * @param ctx the parse tree
	 */
	exitArrayLiteral?: (ctx: ArrayLiteralContext) => void;

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
	 * Enter a parse tree produced by `LPCParser.typeSpecifier`.
	 * @param ctx the parse tree
	 */
	enterTypeSpecifier?: (ctx: TypeSpecifierContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.typeSpecifier`.
	 * @param ctx the parse tree
	 */
	exitTypeSpecifier?: (ctx: TypeSpecifierContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.typeName`.
	 * @param ctx the parse tree
	 */
	enterTypeName?: (ctx: TypeNameContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.typeName`.
	 * @param ctx the parse tree
	 */
	exitTypeName?: (ctx: TypeNameContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.modifier`.
	 * @param ctx the parse tree
	 */
	enterModifier?: (ctx: ModifierContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.modifier`.
	 * @param ctx the parse tree
	 */
	exitModifier?: (ctx: ModifierContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.identifier`.
	 * @param ctx the parse tree
	 */
	enterIdentifier?: (ctx: IdentifierContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.identifier`.
	 * @param ctx the parse tree
	 */
	exitIdentifier?: (ctx: IdentifierContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.keywordIdentifier`.
	 * @param ctx the parse tree
	 */
	enterKeywordIdentifier?: (ctx: KeywordIdentifierContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.keywordIdentifier`.
	 * @param ctx the parse tree
	 */
	exitKeywordIdentifier?: (ctx: KeywordIdentifierContext) => void;

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
	 * Enter a parse tree produced by `LPCParser.switchBlock`.
	 * @param ctx the parse tree
	 */
	enterSwitchBlock?: (ctx: SwitchBlockContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.switchBlock`.
	 * @param ctx the parse tree
	 */
	exitSwitchBlock?: (ctx: SwitchBlockContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.caseClause`.
	 * @param ctx the parse tree
	 */
	enterCaseClause?: (ctx: CaseClauseContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.caseClause`.
	 * @param ctx the parse tree
	 */
	exitCaseClause?: (ctx: CaseClauseContext) => void;

	/**
	 * Enter a parse tree produced by `LPCParser.defaultClause`.
	 * @param ctx the parse tree
	 */
	enterDefaultClause?: (ctx: DefaultClauseContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.defaultClause`.
	 * @param ctx the parse tree
	 */
	exitDefaultClause?: (ctx: DefaultClauseContext) => void;

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
	 * Enter a parse tree produced by `LPCParser.fallthroughStatement`.
	 * @param ctx the parse tree
	 */
	enterFallthroughStatement?: (ctx: FallthroughStatementContext) => void;
	/**
	 * Exit a parse tree produced by `LPCParser.fallthroughStatement`.
	 * @param ctx the parse tree
	 */
	exitFallthroughStatement?: (ctx: FallthroughStatementContext) => void;
}

