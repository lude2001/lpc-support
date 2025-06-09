// Generated from grammar/LPC.g4 by ANTLR 4.9.0-SNAPSHOT


import { ParseTreeVisitor } from "antlr4ts/tree/ParseTreeVisitor";

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
 * This interface defines a complete generic visitor for a parse tree produced
 * by `LPCParser`.
 *
 * @param <Result> The return type of the visit operation. Use `void` for
 * operations with no return type.
 */
export interface LPCVisitor<Result> extends ParseTreeVisitor<Result> {
	/**
	 * Visit a parse tree produced by the `PrimaryExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitPrimaryExpr?: (ctx: PrimaryExprContext) => Result;

	/**
	 * Visit a parse tree produced by the `ArrayAccessExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitArrayAccessExpr?: (ctx: ArrayAccessExprContext) => Result;

	/**
	 * Visit a parse tree produced by the `ArraySliceExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitArraySliceExpr?: (ctx: ArraySliceExprContext) => Result;

	/**
	 * Visit a parse tree produced by the `FunctionCallExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitFunctionCallExpr?: (ctx: FunctionCallExprContext) => Result;

	/**
	 * Visit a parse tree produced by the `MemberAccessExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitMemberAccessExpr?: (ctx: MemberAccessExprContext) => Result;

	/**
	 * Visit a parse tree produced by the `ImplicitConcatExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitImplicitConcatExpr?: (ctx: ImplicitConcatExprContext) => Result;

	/**
	 * Visit a parse tree produced by the `PreIncrementExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitPreIncrementExpr?: (ctx: PreIncrementExprContext) => Result;

	/**
	 * Visit a parse tree produced by the `PreDecrementExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitPreDecrementExpr?: (ctx: PreDecrementExprContext) => Result;

	/**
	 * Visit a parse tree produced by the `PostIncrementExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitPostIncrementExpr?: (ctx: PostIncrementExprContext) => Result;

	/**
	 * Visit a parse tree produced by the `PostDecrementExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitPostDecrementExpr?: (ctx: PostDecrementExprContext) => Result;

	/**
	 * Visit a parse tree produced by the `UnaryExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitUnaryExpr?: (ctx: UnaryExprContext) => Result;

	/**
	 * Visit a parse tree produced by the `CastExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitCastExpr?: (ctx: CastExprContext) => Result;

	/**
	 * Visit a parse tree produced by the `MultiplicativeExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitMultiplicativeExpr?: (ctx: MultiplicativeExprContext) => Result;

	/**
	 * Visit a parse tree produced by the `AdditiveExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitAdditiveExpr?: (ctx: AdditiveExprContext) => Result;

	/**
	 * Visit a parse tree produced by the `ShiftExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitShiftExpr?: (ctx: ShiftExprContext) => Result;

	/**
	 * Visit a parse tree produced by the `RelationalExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitRelationalExpr?: (ctx: RelationalExprContext) => Result;

	/**
	 * Visit a parse tree produced by the `EqualityExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitEqualityExpr?: (ctx: EqualityExprContext) => Result;

	/**
	 * Visit a parse tree produced by the `BitwiseAndExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitBitwiseAndExpr?: (ctx: BitwiseAndExprContext) => Result;

	/**
	 * Visit a parse tree produced by the `BitwiseXorExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitBitwiseXorExpr?: (ctx: BitwiseXorExprContext) => Result;

	/**
	 * Visit a parse tree produced by the `BitwiseOrExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitBitwiseOrExpr?: (ctx: BitwiseOrExprContext) => Result;

	/**
	 * Visit a parse tree produced by the `LogicalAndExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitLogicalAndExpr?: (ctx: LogicalAndExprContext) => Result;

	/**
	 * Visit a parse tree produced by the `LogicalOrExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitLogicalOrExpr?: (ctx: LogicalOrExprContext) => Result;

	/**
	 * Visit a parse tree produced by the `ConditionalExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitConditionalExpr?: (ctx: ConditionalExprContext) => Result;

	/**
	 * Visit a parse tree produced by the `AssignmentExpr`
	 * labeled alternative in `LPCParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitAssignmentExpr?: (ctx: AssignmentExprContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.program`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitProgram?: (ctx: ProgramContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.declaration`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitDeclaration?: (ctx: DeclarationContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.statement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitStatement?: (ctx: StatementContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.block`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitBlock?: (ctx: BlockContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.expressionStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExpressionStatement?: (ctx: ExpressionStatementContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.variableDeclaration`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitVariableDeclaration?: (ctx: VariableDeclarationContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.variableDeclarator`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitVariableDeclarator?: (ctx: VariableDeclaratorContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.functionDeclaration`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitFunctionDeclaration?: (ctx: FunctionDeclarationContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.parameterList`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitParameterList?: (ctx: ParameterListContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.parameter`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitParameter?: (ctx: ParameterContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.inheritStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitInheritStatement?: (ctx: InheritStatementContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.preprocessorDirective`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitPreprocessorDirective?: (ctx: PreprocessorDirectiveContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.ppInclude`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitPpInclude?: (ctx: PpIncludeContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.ppDefine`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitPpDefine?: (ctx: PpDefineContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.ppConditional`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitPpConditional?: (ctx: PpConditionalContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.ppError`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitPpError?: (ctx: PpErrorContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.ppPragma`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitPpPragma?: (ctx: PpPragmaContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExpression?: (ctx: ExpressionContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.castExpression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitCastExpression?: (ctx: CastExpressionContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.closureExpression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitClosureExpression?: (ctx: ClosureExpressionContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.assignmentOperator`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitAssignmentOperator?: (ctx: AssignmentOperatorContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.primary`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitPrimary?: (ctx: PrimaryContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.argumentList`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitArgumentList?: (ctx: ArgumentListContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.expressionOrEllipsis`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExpressionOrEllipsis?: (ctx: ExpressionOrEllipsisContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.literal`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitLiteral?: (ctx: LiteralContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.mappingLiteral`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitMappingLiteral?: (ctx: MappingLiteralContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.mappingElementList`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitMappingElementList?: (ctx: MappingElementListContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.mappingElement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitMappingElement?: (ctx: MappingElementContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.arrayLiteral`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitArrayLiteral?: (ctx: ArrayLiteralContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.expressionList`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExpressionList?: (ctx: ExpressionListContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.typeSpecifier`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTypeSpecifier?: (ctx: TypeSpecifierContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.typeName`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTypeName?: (ctx: TypeNameContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.modifier`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitModifier?: (ctx: ModifierContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.identifier`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitIdentifier?: (ctx: IdentifierContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.keywordIdentifier`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitKeywordIdentifier?: (ctx: KeywordIdentifierContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.ifStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitIfStatement?: (ctx: IfStatementContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.forStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitForStatement?: (ctx: ForStatementContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.whileStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitWhileStatement?: (ctx: WhileStatementContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.doWhileStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitDoWhileStatement?: (ctx: DoWhileStatementContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.foreachStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitForeachStatement?: (ctx: ForeachStatementContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.switchStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitSwitchStatement?: (ctx: SwitchStatementContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.switchBlock`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitSwitchBlock?: (ctx: SwitchBlockContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.caseClause`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitCaseClause?: (ctx: CaseClauseContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.defaultClause`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitDefaultClause?: (ctx: DefaultClauseContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.returnStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitReturnStatement?: (ctx: ReturnStatementContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.breakStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitBreakStatement?: (ctx: BreakStatementContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.continueStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitContinueStatement?: (ctx: ContinueStatementContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.fallthroughStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitFallthroughStatement?: (ctx: FallthroughStatementContext) => Result;
}

