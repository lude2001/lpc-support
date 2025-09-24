// Generated from grammar/LPCParser.g4 by ANTLR 4.9.0-SNAPSHOT


import { ParseTreeVisitor } from "antlr4ts/tree/ParseTreeVisitor";

import { ScopeIdentifierContext } from "./LPCParser";
import { StringConcatenationContext } from "./LPCParser";
import { ClosurePrimaryContext } from "./LPCParser";
import { MappingLiteralExprContext } from "./LPCParser";
import { NewExpressionPrimaryContext } from "./LPCParser";
import { AnonFunctionContext } from "./LPCParser";
import { DollarCallExprContext } from "./LPCParser";
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
 * This interface defines a complete generic visitor for a parse tree produced
 * by `LPCParser`.
 *
 * @param <Result> The return type of the visit operation. Use `void` for
 * operations with no return type.
 */
export interface LPCParserVisitor<Result> extends ParseTreeVisitor<Result> {
	/**
	 * Visit a parse tree produced by the `scopeIdentifier`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitScopeIdentifier?: (ctx: ScopeIdentifierContext) => Result;

	/**
	 * Visit a parse tree produced by the `stringConcatenation`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitStringConcatenation?: (ctx: StringConcatenationContext) => Result;

	/**
	 * Visit a parse tree produced by the `closurePrimary`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitClosurePrimary?: (ctx: ClosurePrimaryContext) => Result;

	/**
	 * Visit a parse tree produced by the `mappingLiteralExpr`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitMappingLiteralExpr?: (ctx: MappingLiteralExprContext) => Result;

	/**
	 * Visit a parse tree produced by the `newExpressionPrimary`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitNewExpressionPrimary?: (ctx: NewExpressionPrimaryContext) => Result;

	/**
	 * Visit a parse tree produced by the `anonFunction`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitAnonFunction?: (ctx: AnonFunctionContext) => Result;

	/**
	 * Visit a parse tree produced by the `dollarCallExpr`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitDollarCallExpr?: (ctx: DollarCallExprContext) => Result;

	/**
	 * Visit a parse tree produced by the `identifierPrimary`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitIdentifierPrimary?: (ctx: IdentifierPrimaryContext) => Result;

	/**
	 * Visit a parse tree produced by the `parameterPlaceholder`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitParameterPlaceholder?: (ctx: ParameterPlaceholderContext) => Result;

	/**
	 * Visit a parse tree produced by the `integerPrimary`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitIntegerPrimary?: (ctx: IntegerPrimaryContext) => Result;

	/**
	 * Visit a parse tree produced by the `floatPrimary`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitFloatPrimary?: (ctx: FloatPrimaryContext) => Result;

	/**
	 * Visit a parse tree produced by the `stringPrimary`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitStringPrimary?: (ctx: StringPrimaryContext) => Result;

	/**
	 * Visit a parse tree produced by the `charPrimary`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitCharPrimary?: (ctx: CharPrimaryContext) => Result;

	/**
	 * Visit a parse tree produced by the `arrayLiteral`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitArrayLiteral?: (ctx: ArrayLiteralContext) => Result;

	/**
	 * Visit a parse tree produced by the `parenExpr`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitParenExpr?: (ctx: ParenExprContext) => Result;

	/**
	 * Visit a parse tree produced by the `refVariable`
	 * labeled alternative in `LPCParser.primary`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitRefVariable?: (ctx: RefVariableContext) => Result;

	/**
	 * Visit a parse tree produced by the `tailIndexOnly`
	 * labeled alternative in `LPCParser.sliceExpr`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTailIndexOnly?: (ctx: TailIndexOnlyContext) => Result;

	/**
	 * Visit a parse tree produced by the `headRange`
	 * labeled alternative in `LPCParser.sliceExpr`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitHeadRange?: (ctx: HeadRangeContext) => Result;

	/**
	 * Visit a parse tree produced by the `openRange`
	 * labeled alternative in `LPCParser.sliceExpr`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitOpenRange?: (ctx: OpenRangeContext) => Result;

	/**
	 * Visit a parse tree produced by the `singleIndex`
	 * labeled alternative in `LPCParser.sliceExpr`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitSingleIndex?: (ctx: SingleIndexContext) => Result;

	/**
	 * Visit a parse tree produced by the `tailHeadRange`
	 * labeled alternative in `LPCParser.sliceExpr`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTailHeadRange?: (ctx: TailHeadRangeContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.sourceFile`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitSourceFile?: (ctx: SourceFileContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.statement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitStatement?: (ctx: StatementContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.functionDef`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitFunctionDef?: (ctx: FunctionDefContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.variableDecl`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitVariableDecl?: (ctx: VariableDeclContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.variableDeclarator`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitVariableDeclarator?: (ctx: VariableDeclaratorContext) => Result;

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
	 * Visit a parse tree produced by `LPCParser.structDef`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitStructDef?: (ctx: StructDefContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.classDef`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitClassDef?: (ctx: ClassDefContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.structMemberList`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitStructMemberList?: (ctx: StructMemberListContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.structMember`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitStructMember?: (ctx: StructMemberContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.typeSpec`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitTypeSpec?: (ctx: TypeSpecContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.block`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitBlock?: (ctx: BlockContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.exprStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExprStatement?: (ctx: ExprStatementContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExpression?: (ctx: ExpressionContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.assignmentExpression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitAssignmentExpression?: (ctx: AssignmentExpressionContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.conditionalExpression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitConditionalExpression?: (ctx: ConditionalExpressionContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.logicalOrExpression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitLogicalOrExpression?: (ctx: LogicalOrExpressionContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.logicalAndExpression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitLogicalAndExpression?: (ctx: LogicalAndExpressionContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.bitwiseOrExpression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitBitwiseOrExpression?: (ctx: BitwiseOrExpressionContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.bitwiseXorExpression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitBitwiseXorExpression?: (ctx: BitwiseXorExpressionContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.bitwiseAndExpression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitBitwiseAndExpression?: (ctx: BitwiseAndExpressionContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.equalityExpression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitEqualityExpression?: (ctx: EqualityExpressionContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.relationalExpression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitRelationalExpression?: (ctx: RelationalExpressionContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.shiftExpression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitShiftExpression?: (ctx: ShiftExpressionContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.additiveExpression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitAdditiveExpression?: (ctx: AdditiveExpressionContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.multiplicativeExpression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitMultiplicativeExpression?: (ctx: MultiplicativeExpressionContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.unaryExpression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitUnaryExpression?: (ctx: UnaryExpressionContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.castExpression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitCastExpression?: (ctx: CastExpressionContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.castType`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitCastType?: (ctx: CastTypeContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.postfixExpression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitPostfixExpression?: (ctx: PostfixExpressionContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.argumentList`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitArgumentList?: (ctx: ArgumentListContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.primary`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitPrimary?: (ctx: PrimaryContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.stringConcat`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitStringConcat?: (ctx: StringConcatContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.concatItem`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitConcatItem?: (ctx: ConcatItemContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.ifStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitIfStatement?: (ctx: IfStatementContext) => Result;

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
	 * Visit a parse tree produced by `LPCParser.forStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitForStatement?: (ctx: ForStatementContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.forInit`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitForInit?: (ctx: ForInitContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.expressionList`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExpressionList?: (ctx: ExpressionListContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.foreachStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitForeachStatement?: (ctx: ForeachStatementContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.foreachInit`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitForeachInit?: (ctx: ForeachInitContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.foreachVar`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitForeachVar?: (ctx: ForeachVarContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.switchStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitSwitchStatement?: (ctx: SwitchStatementContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.switchSection`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitSwitchSection?: (ctx: SwitchSectionContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.switchLabelWithColon`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitSwitchLabelWithColon?: (ctx: SwitchLabelWithColonContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.switchLabel`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitSwitchLabel?: (ctx: SwitchLabelContext) => Result;

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
	 * Visit a parse tree produced by `LPCParser.returnStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitReturnStatement?: (ctx: ReturnStatementContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.closureExpr`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitClosureExpr?: (ctx: ClosureExprContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.inheritStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitInheritStatement?: (ctx: InheritStatementContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.includeStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitIncludeStatement?: (ctx: IncludeStatementContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.macroInvoke`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitMacroInvoke?: (ctx: MacroInvokeContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.prototypeStatement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitPrototypeStatement?: (ctx: PrototypeStatementContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.mappingLiteral`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitMappingLiteral?: (ctx: MappingLiteralContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.mappingPairList`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitMappingPairList?: (ctx: MappingPairListContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.mappingPair`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitMappingPair?: (ctx: MappingPairContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.newExpression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitNewExpression?: (ctx: NewExpressionContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.structInitializerList`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitStructInitializerList?: (ctx: StructInitializerListContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.structInitializer`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitStructInitializer?: (ctx: StructInitializerContext) => Result;

	/**
	 * Visit a parse tree produced by `LPCParser.sliceExpr`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitSliceExpr?: (ctx: SliceExprContext) => Result;
}

