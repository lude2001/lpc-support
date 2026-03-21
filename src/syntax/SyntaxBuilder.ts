import { Token } from 'antlr4ts';
import { ParserRuleContext } from 'antlr4ts/ParserRuleContext';
import * as vscode from 'vscode';
import { ParseTree } from 'antlr4ts/tree/ParseTree';
import { TerminalNode } from 'antlr4ts/tree/TerminalNode';
import {
    AdditiveExpressionContext,
    AnonFunctionContext,
    ArgumentListContext,
    ArrayDelimiterExprContext,
    ArrayDelimiterLiteralContext,
    ArrayDelimiterElementContext,
    ArrayLiteralContext,
    AssignmentExpressionContext,
    BitwiseAndExpressionContext,
    BitwiseOrExpressionContext,
    BitwiseXorExpressionContext,
    BlockContext,
    CastExpressionContext,
    CastTypeContext,
    CharPrimaryContext,
    ClassDefContext,
    ClosureExprContext,
    ClosurePrimaryContext,
    ConcatItemContext,
    ConditionalExpressionContext,
    ContinueStatementContext,
    DollarCallExprContext,
    DoWhileStatementContext,
    EqualityExpressionContext,
    ExprStatementContext,
    ExpressionContext,
    ExpressionListContext,
    FloatPrimaryContext,
    ForStatementContext,
    ForeachStatementContext,
    ForeachVarContext,
    FunctionDefContext,
    IdentifierPrimaryContext,
    IfStatementContext,
    IncludeStatementContext,
    InheritStatementContext,
    IntegerPrimaryContext,
    LogicalAndExpressionContext,
    LogicalOrExpressionContext,
    MacroInvokeContext,
    MappingLiteralExprContext,
    MappingLiteralContext,
    MappingPairContext,
    MultiplicativeExpressionContext,
    NewExpressionPrimaryContext,
    NewExpressionContext,
    ParameterContext,
    ParameterListContext,
    ParameterPlaceholderContext,
    ParenExprContext,
    PostfixExpressionContext,
    PrimaryContext,
    PrototypeStatementContext,
    RefVariableContext,
    RelationalExpressionContext,
    ReturnStatementContext,
    ScopeIdentifierContext,
    ShiftExpressionContext,
    SourceFileContext,
    SpreadElementContext,
    StatementContext,
    StringConcatenationContext,
    StringConcatContext,
    StringPrimaryContext,
    StructDefContext,
    StructInitializerContext,
    StructInitializerListContext,
    StructMemberContext,
    SwitchLabelWithColonContext,
    SwitchSectionContext,
    SwitchStatementContext,
    TypeSpecContext,
    UnaryExpressionContext,
    VariableDeclContext,
    VariableDeclaratorContext,
    WhileStatementContext,
    LPCParser
} from '../antlr/LPCParser';
import { ParsedDocument, Trivia } from '../parser/types';
import {
    createSyntaxDocument,
    createSyntaxNode,
    createTokenRange,
    SourceFileSyntaxNode,
    SyntaxDocument,
    SyntaxKind,
    SyntaxNode
} from './types';
import { SyntaxTrivia, syntaxTriviaFromParsedTrivia } from './trivia';
import {
    buildArgumentList,
    buildArrayDelimiterElement,
    buildArrayDelimiterLiteral,
    buildArrayLiteral,
    buildConcatItem,
    buildExpressionList,
    buildMappingLiteral,
    buildMappingPair,
    buildNewExpression,
    buildSliceExpression,
    buildSpreadElement,
    buildStringConcatenation,
    buildStructInitializer,
    buildStructInitializerList
} from './builders/collectionBuilders';
import {
    buildClassDeclaration,
    buildDirectiveNode,
    buildFunctionDeclaration,
    buildModifierList,
    buildParameter,
    buildParameterList,
    buildPrototypeDeclaration,
    buildStructDeclaration,
    buildStructMembers,
    buildTypeReference,
    buildVariableDeclaration,
    buildVariableDeclarator
} from './builders/declarationBuilders';

type TypeLikeContext = TypeSpecContext | CastTypeContext;

export class SyntaxBuilder {
    private readonly lineStartOffsets: number[];

    constructor(private readonly parsed: ParsedDocument) {
        this.lineStartOffsets = buildLineStartOffsets(parsed.text);
    }

    public build(): SyntaxDocument {
        const root = this.buildSourceFile(this.parsed.tree as SourceFileContext);
        return createSyntaxDocument({
            parsed: this.parsed,
            root
        });
    }

    private buildSourceFile(ctx: SourceFileContext): SourceFileSyntaxNode {
        const children = this.collectNodes(this.asArray(ctx.statement()).map((statement) => this.buildStatement(statement)));
        const range = new vscode.Range(this.positionAt(0), this.positionAt(this.parsed.text.length));
        const tokenRange = this.createSourceFileTokenRange();

        return createSyntaxNode({
            kind: SyntaxKind.SourceFile,
            range,
            tokenRange,
            leadingTrivia: this.collectPlacementTrivia(this.parsed.tokenTriviaIndex.getLeadingTrivia(tokenRange.start), 'leading'),
            trailingTrivia: this.collectPlacementTrivia(this.parsed.tokenTriviaIndex.getTrailingTrivia(tokenRange.end), 'trailing'),
            children
        }) as SourceFileSyntaxNode;
    }

    public buildStatement(ctx: StatementContext): SyntaxNode {
        if (ctx.functionDef()) {
            return buildFunctionDeclaration(this, ctx.functionDef()!);
        }

        if (ctx.variableDecl()) {
            return buildVariableDeclaration(this, ctx.variableDecl()!, ctx);
        }

        if (ctx.structDef()) {
            return buildStructDeclaration(this, ctx.structDef()!);
        }

        if (ctx.classDef()) {
            return buildClassDeclaration(this, ctx.classDef()!);
        }

        if (ctx.inheritStatement()) {
            return buildDirectiveNode(this, SyntaxKind.InheritDirective, ctx.inheritStatement()!);
        }

        if (ctx.includeStatement()) {
            return buildDirectiveNode(this, SyntaxKind.IncludeDirective, ctx.includeStatement()!);
        }

        if (ctx.ifStatement()) {
            return this.buildIfStatement(ctx.ifStatement()!);
        }

        if (ctx.whileStatement()) {
            return this.buildLoopStatement(SyntaxKind.WhileStatement, ctx.whileStatement()!);
        }

        if (ctx.doWhileStatement()) {
            return this.buildDoWhileStatement(ctx.doWhileStatement()!);
        }

        if (ctx.forStatement()) {
            return this.buildForStatement(ctx.forStatement()!);
        }

        if (ctx.foreachStatement()) {
            return this.buildForeachStatement(ctx.foreachStatement()!);
        }

        if (ctx.switchStatement()) {
            return this.buildSwitchStatement(ctx.switchStatement()!);
        }

        if (ctx.breakStatement()) {
            return this.buildLeafNode(SyntaxKind.BreakStatement, ctx.breakStatement()!);
        }

        if (ctx.continueStatement()) {
            return this.buildLeafNode(SyntaxKind.ContinueStatement, ctx.continueStatement()!);
        }

        if (ctx.returnStatement()) {
            return this.buildReturnStatement(ctx.returnStatement()!);
        }

        if (ctx.block()) {
            return this.buildBlock(ctx.block()!);
        }

        if (ctx.exprStatement()) {
            return this.buildExpressionStatement(ctx.exprStatement()!);
        }

        if (ctx.prototypeStatement()) {
            return buildPrototypeDeclaration(this, ctx.prototypeStatement()!);
        }

        if (ctx.macroInvoke()) {
            const expression = this.buildMacroInvokeExpression(ctx.macroInvoke()!);
            return this.createNode(SyntaxKind.ExpressionStatement, ctx, [expression], {
                metadata: { source: 'macro-invoke' }
            });
        }

        return this.createMissingNode(ctx);
    }

    public buildFunctionDeclaration(ctx: FunctionDefContext | PrototypeStatementContext): SyntaxNode {
        return buildFunctionDeclaration(this, ctx);
    }

    public buildPrototypeDeclaration(ctx: PrototypeStatementContext): SyntaxNode {
        return buildPrototypeDeclaration(this, ctx);
    }

    public buildVariableDeclaration(
        ctx: VariableDeclContext,
        rangeContext: ParserRuleContext = ctx
    ): SyntaxNode {
        return buildVariableDeclaration(this, ctx, rangeContext);
    }

    public buildVariableDeclarator(ctx: VariableDeclaratorContext): SyntaxNode {
        return buildVariableDeclarator(this, ctx);
    }

    public buildStructDeclaration(ctx: StructDefContext): SyntaxNode {
        return buildStructDeclaration(this, ctx);
    }

    public buildClassDeclaration(ctx: ClassDefContext): SyntaxNode {
        return buildClassDeclaration(this, ctx);
    }

    public buildStructMembers(members: StructMemberContext[] | StructMemberContext | undefined): SyntaxNode[] {
        return buildStructMembers(this, members);
    }

    public buildDirectiveNode(kind: SyntaxKind.InheritDirective | SyntaxKind.IncludeDirective, ctx: InheritStatementContext | IncludeStatementContext): SyntaxNode {
        return buildDirectiveNode(this, kind, ctx);
    }

    public buildBlock(ctx: BlockContext): SyntaxNode {
        const children = this.collectNodes(this.asArray(ctx.statement()).map((statement) => this.buildStatement(statement)));
        return this.createNode(SyntaxKind.Block, ctx, children);
    }

    private buildExpressionStatement(ctx: ExprStatementContext): SyntaxNode {
        const children = ctx.expression() ? [this.buildExpression(ctx.expression()!)] : [];
        return this.createNode(SyntaxKind.ExpressionStatement, ctx, children);
    }

    private buildIfStatement(ctx: IfStatementContext): SyntaxNode {
        const children: SyntaxNode[] = [this.buildExpression(ctx.expression())];
        const statements = this.asArray(ctx.statement());

        if (statements[0]) {
            children.push(this.buildStatement(statements[0]));
        }
        if (statements[1]) {
            children.push(this.buildStatement(statements[1]));
        }

        return this.createNode(SyntaxKind.IfStatement, ctx, children, {
            metadata: { hasElse: statements.length > 1 }
        });
    }

    private buildLoopStatement(kind: SyntaxKind.WhileStatement, ctx: WhileStatementContext): SyntaxNode {
        return this.createNode(kind, ctx, [this.buildExpression(ctx.expression()), this.buildStatement(ctx.statement())]);
    }

    private buildDoWhileStatement(ctx: DoWhileStatementContext): SyntaxNode {
        return this.createNode(SyntaxKind.DoWhileStatement, ctx, [this.buildStatement(ctx.statement()), this.buildExpression(ctx.expression())]);
    }

    private buildForStatement(ctx: ForStatementContext): SyntaxNode {
        const children: SyntaxNode[] = [];
        const forInit = ctx.forInit();

        if (forInit?.variableDecl()) {
            children.push(this.buildVariableDeclaration(forInit.variableDecl()!));
        } else if (forInit?.expressionList()) {
            children.push(this.buildExpressionList(forInit.expressionList()!));
        }

        if (ctx.expression()) {
            children.push(this.buildExpression(ctx.expression()!));
        }

        if (ctx.expressionList()) {
            children.push(this.buildExpressionList(ctx.expressionList()!));
        }

        children.push(this.buildStatement(ctx.statement()));
        return this.createNode(SyntaxKind.ForStatement, ctx, children);
    }

    private buildForeachStatement(ctx: ForeachStatementContext): SyntaxNode {
        const children = [
            ...this.collectNodes(this.asArray(ctx.foreachInit().foreachVar()).map((foreachVar) => this.buildForeachBinding(foreachVar))),
            this.buildExpression(ctx.expression()),
            this.buildStatement(ctx.statement())
        ];

        return this.createNode(SyntaxKind.ForeachStatement, ctx, children);
    }

    private buildForeachBinding(ctx: ForeachVarContext): SyntaxNode {
        const children: SyntaxNode[] = [];
        const typeReference = ctx.typeSpec() ? this.buildTypeReference(ctx.typeSpec()!) : undefined;

        if (typeReference) {
            children.push(typeReference);
        }
        children.push(this.buildIdentifierNode(ctx.Identifier()));

        return this.createNode(SyntaxKind.VariableDeclarator, ctx, children, {
            name: ctx.Identifier().text,
            metadata: {
                pointerCount: this.asArray(ctx.STAR?.()).length,
                isReference: Boolean(ctx.REF?.())
            }
        });
    }

    private buildSwitchStatement(ctx: SwitchStatementContext): SyntaxNode {
        const children: SyntaxNode[] = [this.buildExpression(ctx.expression())];

        for (const section of this.asArray(ctx.switchSection())) {
            children.push(...this.buildSwitchSection(section));
        }

        return this.createNode(SyntaxKind.SwitchStatement, ctx, children);
    }

    private buildSwitchSection(ctx: SwitchSectionContext): SyntaxNode[] {
        const clauses: SyntaxNode[] = [];
        let currentLabel: SwitchLabelWithColonContext | undefined;
        let currentStatements: SyntaxNode[] = [];

        for (const child of this.getChildren(ctx)) {
            if (this.isRuleContext(child, 'SwitchLabelWithColonContext')) {
                if (currentLabel) {
                    clauses.push(this.buildSwitchClause(currentLabel, currentStatements));
                }

                currentLabel = child as SwitchLabelWithColonContext;
                currentStatements = [];
                continue;
            }

            if (this.isRuleContext(child, 'StatementContext')) {
                currentStatements.push(this.buildStatement(child as StatementContext));
            }
        }

        if (currentLabel) {
            clauses.push(this.buildSwitchClause(currentLabel, currentStatements));
        }

        return clauses;
    }

    private buildSwitchClause(ctx: SwitchLabelWithColonContext, statements: SyntaxNode[]): SyntaxNode {
        const label = ctx.switchLabel();
        const labelChildren = label ? this.asArray(label.expression()).map((expression) => this.buildExpression(expression)) : [];

        return this.createNode(ctx.DEFAULT() ? SyntaxKind.DefaultClause : SyntaxKind.CaseClause, ctx, [...labelChildren, ...statements], {
            metadata: {
                hasRange: Boolean(label?.RANGE_OP()),
                expressionCount: labelChildren.length
            }
        });
    }

    private buildReturnStatement(ctx: ReturnStatementContext): SyntaxNode {
        const children = ctx.expression() ? [this.buildExpression(ctx.expression()!)] : [];
        return this.createNode(SyntaxKind.ReturnStatement, ctx, children);
    }

    private buildLeafNode(kind: SyntaxKind.BreakStatement | SyntaxKind.ContinueStatement, ctx: ContinueStatementContext | ParserRuleContext): SyntaxNode {
        return this.createNode(kind, ctx, []);
    }

    public buildParameterList(ctx: ParameterListContext | undefined): SyntaxNode | undefined {
        return buildParameterList(this, ctx);
    }

    public buildParameter(ctx: ParameterContext): SyntaxNode {
        return buildParameter(this, ctx);
    }

    public buildModifierList(tokens: TerminalNode[] | TerminalNode): SyntaxNode | undefined {
        return buildModifierList(this, tokens);
    }

    public buildTypeReference(ctx: TypeLikeContext | undefined): SyntaxNode | undefined {
        return buildTypeReference(this, ctx);
    }

    public buildExpression(ctx: ExpressionContext): SyntaxNode {
        const assignments = this.asArray(ctx.assignmentExpression());
        if (assignments.length === 1) {
            return this.buildAssignmentExpression(assignments[0]);
        }

        return this.buildLeftAssociativeBinaryChain(
            ctx,
            assignments.map((assignment) => this.buildAssignmentExpression(assignment)),
            this.asArray(ctx.COMMA?.()).map((token) => token.text),
            'comma'
        );
    }

    public buildAssignmentExpression(ctx: AssignmentExpressionContext): SyntaxNode {
        const left = this.buildConditionalExpression(ctx.conditionalExpression());
        const operator = firstDefined(
            ctx.ASSIGN?.(),
            ctx.PLUS_ASSIGN?.(),
            ctx.MINUS_ASSIGN?.(),
            ctx.STAR_ASSIGN?.(),
            ctx.DIV_ASSIGN?.(),
            ctx.PERCENT_ASSIGN?.(),
            ctx.BIT_OR_ASSIGN?.(),
            ctx.BIT_AND_ASSIGN?.()
        );

        if (!operator || !ctx.expression()) {
            return left;
        }

        return this.createNode(SyntaxKind.AssignmentExpression, ctx, [left, this.buildExpression(ctx.expression()!)], {
            metadata: { operator: operator.text }
        });
    }

    private buildConditionalExpression(ctx: ConditionalExpressionContext): SyntaxNode {
        const condition = this.buildLogicalOrExpression(ctx.logicalOrExpression());
        if (!ctx.QUESTION() || !ctx.expression() || !ctx.conditionalExpression()) {
            return condition;
        }

        return this.createNode(
            SyntaxKind.ConditionalExpression,
            ctx,
            [condition, this.buildExpression(ctx.expression()!), this.buildConditionalExpression(ctx.conditionalExpression()!)],
            {
                metadata: { operator: '?:' }
            }
        );
    }

    private buildLogicalOrExpression(ctx: LogicalOrExpressionContext): SyntaxNode {
        return this.buildBinaryLayer(
            ctx,
            this.asArray(ctx.logicalAndExpression()).map((node) => this.buildLogicalAndExpression(node)),
            this.asArray(ctx.OR?.()).map((token) => token.text)
        );
    }

    private buildLogicalAndExpression(ctx: LogicalAndExpressionContext): SyntaxNode {
        return this.buildBinaryLayer(
            ctx,
            this.asArray(ctx.bitwiseOrExpression()).map((node) => this.buildBitwiseOrExpression(node)),
            this.asArray(ctx.AND?.()).map((token) => token.text)
        );
    }

    private buildBitwiseOrExpression(ctx: BitwiseOrExpressionContext): SyntaxNode {
        return this.buildBinaryLayer(
            ctx,
            this.asArray(ctx.bitwiseXorExpression()).map((node) => this.buildBitwiseXorExpression(node)),
            this.asArray(ctx.BIT_OR?.()).map((token) => token.text)
        );
    }

    private buildBitwiseXorExpression(ctx: BitwiseXorExpressionContext): SyntaxNode {
        return this.buildBinaryLayer(
            ctx,
            this.asArray(ctx.bitwiseAndExpression()).map((node) => this.buildBitwiseAndExpression(node)),
            this.asArray(ctx.BIT_XOR?.()).map((token) => token.text)
        );
    }

    private buildBitwiseAndExpression(ctx: BitwiseAndExpressionContext): SyntaxNode {
        return this.buildBinaryLayer(
            ctx,
            this.asArray(ctx.equalityExpression()).map((node) => this.buildEqualityExpression(node)),
            this.asArray(ctx.BIT_AND?.()).map((token) => token.text)
        );
    }

    private buildEqualityExpression(ctx: EqualityExpressionContext): SyntaxNode {
        return this.buildBinaryLayer(
            ctx,
            this.asArray(ctx.relationalExpression()).map((node) => this.buildRelationalExpression(node)),
            this.collectTokenTexts(ctx.EQ?.(), ctx.NE?.())
        );
    }

    private buildRelationalExpression(ctx: RelationalExpressionContext): SyntaxNode {
        return this.buildBinaryLayer(
            ctx,
            this.asArray(ctx.shiftExpression()).map((node) => this.buildShiftExpression(node)),
            this.collectTokenTexts(ctx.GT?.(), ctx.LT?.(), ctx.GE?.(), ctx.LE?.())
        );
    }

    private buildShiftExpression(ctx: ShiftExpressionContext): SyntaxNode {
        return this.buildBinaryLayer(
            ctx,
            this.asArray(ctx.additiveExpression()).map((node) => this.buildAdditiveExpression(node)),
            this.collectTokenTexts(ctx.SHIFT_LEFT?.(), ctx.SHIFT_RIGHT?.())
        );
    }

    private buildAdditiveExpression(ctx: AdditiveExpressionContext): SyntaxNode {
        return this.buildBinaryLayer(
            ctx,
            this.asArray(ctx.multiplicativeExpression()).map((node) => this.buildMultiplicativeExpression(node)),
            this.collectTokenTexts(ctx.PLUS?.(), ctx.MINUS?.())
        );
    }

    private buildMultiplicativeExpression(ctx: MultiplicativeExpressionContext): SyntaxNode {
        return this.buildBinaryLayer(
            ctx,
            this.asArray(ctx.unaryExpression()).map((node) => this.buildUnaryExpression(node)),
            this.collectTokenTexts(ctx.STAR?.(), ctx.DIV?.(), ctx.PERCENT?.())
        );
    }

    private buildUnaryExpression(ctx: UnaryExpressionContext): SyntaxNode {
        if (ctx.postfixExpression()) {
            const operand = this.buildPostfixExpression(ctx.postfixExpression()!);
            const operator = firstDefined(ctx.INC?.(), ctx.DEC?.());

            if (!operator) {
                return operand;
            }

            return this.createNode(SyntaxKind.UnaryExpression, ctx, [operand], {
                metadata: { operator: operator.text, position: 'prefix' }
            });
        }

        if (ctx.unaryExpression()) {
            const operator = firstDefined(ctx.PLUS?.(), ctx.MINUS?.(), ctx.NOT?.(), ctx.BIT_NOT?.(), ctx.STAR?.());
            if (operator) {
                return this.createNode(SyntaxKind.UnaryExpression, ctx, [this.buildUnaryExpression(ctx.unaryExpression()!)], {
                    metadata: { operator: operator.text, position: 'prefix' }
                });
            }
        }

        if (ctx.CATCH()) {
            const child = ctx.expression()
                ? this.buildExpression(ctx.expression()!)
                : ctx.block()
                    ? this.buildBlock(ctx.block()!)
                    : this.createMissingNode(ctx);

            return this.createNode(SyntaxKind.UnaryExpression, ctx, [child], {
                metadata: { operator: 'catch', position: 'prefix' }
            });
        }

        if (ctx.castExpression()) {
            return this.buildCastExpression(ctx.castExpression()!);
        }

        return this.createOpaqueNode(ctx, [], { reason: 'unary-fallback' });
    }

    private buildCastExpression(ctx: CastExpressionContext): SyntaxNode {
        const children: SyntaxNode[] = [];
        const typeReference = this.buildTypeReference(ctx.castType());

        if (typeReference) {
            children.push(typeReference);
        }
        children.push(this.buildUnaryExpression(ctx.unaryExpression()));

        return this.createNode(SyntaxKind.UnaryExpression, ctx, children, {
            metadata: { operator: 'cast', position: 'prefix' }
        });
    }

    private buildPostfixExpression(ctx: PostfixExpressionContext): SyntaxNode {
        let current = this.buildPrimary(ctx.primary());
        const children = this.getChildren(ctx);
        let index = 1;

        while (index < children.length) {
            const child = children[index];

            if (this.isTerminal(child, LPCParser.LPAREN)) {
                const argumentList = this.isRuleContext(children[index + 1], 'ArgumentListContext')
                    ? this.buildArgumentList(children[index + 1] as ArgumentListContext)
                    : undefined;
                const endBoundary = argumentList ? children[index + 2] : children[index + 1];
                const callChildren = argumentList ? [current, argumentList] : [current];

                current = this.createNodeBetween(SyntaxKind.CallExpression, current, endBoundary, callChildren);
                index += argumentList ? 3 : 2;
                continue;
            }

            if (this.isTerminal(child, LPCParser.ARROW) || this.isTerminal(child, LPCParser.DOT) || this.isTerminal(child, LPCParser.SCOPE)) {
                const memberToken = children[index + 1] as TerminalNode;
                let memberAccess = this.createNodeBetween(
                    SyntaxKind.MemberAccessExpression,
                    current,
                    memberToken,
                    [current, this.buildIdentifierNode(memberToken)],
                    {
                        metadata: { operator: (child as TerminalNode).text }
                    }
                );
                index += 2;

                if (this.isTerminal(children[index], LPCParser.LPAREN)) {
                    const argumentList = this.isRuleContext(children[index + 1], 'ArgumentListContext')
                        ? this.buildArgumentList(children[index + 1] as ArgumentListContext)
                        : undefined;
                    const endBoundary = argumentList ? children[index + 2] : children[index + 1];
                    const callChildren = argumentList ? [memberAccess, argumentList] : [memberAccess];

                    memberAccess = this.createNodeBetween(SyntaxKind.CallExpression, memberAccess, endBoundary, callChildren);
                    index += argumentList ? 3 : 2;
                }

                current = memberAccess;
                continue;
            }

            if (this.isTerminal(child, LPCParser.LBRACK)) {
                const sliceExpr = children[index + 1] instanceof ParserRuleContext
                    ? this.buildSliceExpression(children[index + 1] as ParserRuleContext)
                    : this.createMissingNode(ctx);
                const endBoundary = children[index + 2];

                current = this.createNodeBetween(SyntaxKind.IndexExpression, current, endBoundary, [current, sliceExpr]);
                index += 3;
                continue;
            }

            if (this.isTerminal(child, LPCParser.INC) || this.isTerminal(child, LPCParser.DEC)) {
                current = this.createNodeBetween(SyntaxKind.PostfixExpression, current, child, [current], {
                    metadata: { operator: (child as TerminalNode).text, position: 'postfix' }
                });
                index += 1;
                continue;
            }

            index += 1;
        }

        return current;
    }

    private buildPrimary(ctx: PrimaryContext): SyntaxNode {
        switch (ctx.constructor.name) {
            case 'IdentifierPrimaryContext':
                return this.buildIdentifierNode((ctx as IdentifierPrimaryContext).Identifier());
            case 'ScopeIdentifierContext':
                return this.createNode(SyntaxKind.Identifier, ctx, [], {
                    name: (ctx as ScopeIdentifierContext).Identifier().text,
                    metadata: { scopeQualifier: (ctx as ScopeIdentifierContext).SCOPE().text }
                });
            case 'RefVariableContext':
                return this.createNode(SyntaxKind.Identifier, ctx, [], {
                    name: (ctx as RefVariableContext).Identifier().text,
                    metadata: { isReference: true }
                });
            case 'ParameterPlaceholderContext':
                return this.createNode(SyntaxKind.Identifier, ctx, [], {
                    name: (ctx as ParameterPlaceholderContext).PARAMETER_PLACEHOLDER().text,
                    metadata: { placeholder: true }
                });
            case 'IntegerPrimaryContext':
            case 'FloatPrimaryContext':
            case 'StringPrimaryContext':
            case 'CharPrimaryContext':
                return this.createNode(SyntaxKind.Literal, ctx, [], {
                    metadata: { text: this.getNodeText(ctx) }
                });
            case 'ParenExprContext':
                return this.createNode(SyntaxKind.ParenthesizedExpression, ctx, [this.buildExpression((ctx as ParenExprContext).expression())]);
            case 'DollarCallExprContext':
                return this.createNode(SyntaxKind.CallExpression, ctx, [this.buildExpression((ctx as DollarCallExprContext).expression())], {
                    metadata: { source: 'dollar-call' }
                });
            case 'StringConcatenationContext':
                return buildStringConcatenation(this, ctx as StringConcatenationContext);
            case 'AnonFunctionContext': {
                const anonFunction = ctx as AnonFunctionContext;
                const children: SyntaxNode[] = [];
                const parameters = buildParameterList(this, anonFunction.parameterList());

                if (parameters) {
                    children.push(parameters);
                }
                children.push(this.buildBlock(anonFunction.block()));

                return this.createNode(SyntaxKind.AnonymousFunctionExpression, ctx, children, {
                    metadata: { source: 'anonymous-function' }
                });
            }
            case 'ClosurePrimaryContext':
                return this.buildClosureExpression((ctx as ClosurePrimaryContext).closureExpr());
            case 'MappingLiteralExprContext':
                return buildMappingLiteral(this, (ctx as MappingLiteralExprContext).mappingLiteral());
            case 'ArrayDelimiterExprContext':
                return buildArrayDelimiterLiteral(this, (ctx as ArrayDelimiterExprContext).arrayDelimiterLiteral());
            case 'NewExpressionPrimaryContext':
                return buildNewExpression(this, (ctx as NewExpressionPrimaryContext).newExpression());
            case 'ArrayLiteralContext':
                return buildArrayLiteral(this, ctx as ArrayLiteralContext);
            default:
                break;
        }

        const primaryContext = ctx as any;
        if (typeof primaryContext.Identifier === 'function' && typeof primaryContext.expression !== 'function') {
            return this.buildIdentifierNode(primaryContext.Identifier());
        }

        return this.createOpaqueNode(ctx, [], { reason: 'primary-fallback', text: this.getNodeText(ctx) });
    }

    private buildMacroInvokeExpression(ctx: MacroInvokeContext): SyntaxNode {
        const children: SyntaxNode[] = [this.buildIdentifierNode(ctx.Identifier())];
        const argumentList = buildArgumentList(this, ctx.argumentList());

        if (argumentList) {
            children.push(argumentList);
        }

        return this.createNode(SyntaxKind.CallExpression, ctx, children, {
            name: ctx.Identifier().text,
            metadata: { source: 'macro-invoke' }
        });
    }

    private buildClosureExpression(ctx: ClosureExprContext): SyntaxNode {
        const children = ctx.expression() ? [this.buildExpression(ctx.expression()!)] : [];
        return this.createNode(SyntaxKind.ClosureExpression, ctx, children, {
            metadata: {
                hasDollarIdentifier: Boolean(ctx.DOLLAR()),
                identifier: ctx.Identifier()?.text
            }
        });
    }

    public buildMappingLiteral(ctx: MappingLiteralContext): SyntaxNode {
        return buildMappingLiteral(this, ctx);
    }

    public buildMappingPair(ctx: MappingPairContext): SyntaxNode {
        return buildMappingPair(this, ctx);
    }

    public buildArrayLiteral(ctx: ArrayLiteralContext): SyntaxNode {
        return buildArrayLiteral(this, ctx);
    }

    public buildArrayDelimiterLiteral(ctx: ArrayDelimiterLiteralContext): SyntaxNode {
        return buildArrayDelimiterLiteral(this, ctx);
    }

    public buildArrayDelimiterElement(ctx: ArrayDelimiterElementContext): SyntaxNode {
        return buildArrayDelimiterElement(this, ctx);
    }

    public buildNewExpression(ctx: NewExpressionContext): SyntaxNode {
        return buildNewExpression(this, ctx);
    }

    public buildStructInitializerList(ctx: StructInitializerListContext): SyntaxNode {
        return buildStructInitializerList(this, ctx);
    }

    public buildStructInitializer(ctx: StructInitializerContext): SyntaxNode {
        return buildStructInitializer(this, ctx);
    }

    public buildStringConcatenation(ctx: StringConcatenationContext): SyntaxNode {
        return buildStringConcatenation(this, ctx);
    }

    public buildConcatItem(ctx: ConcatItemContext): SyntaxNode {
        return buildConcatItem(this, ctx);
    }

    public buildArgumentList(ctx: ArgumentListContext | undefined): SyntaxNode | undefined {
        return buildArgumentList(this, ctx);
    }

    public buildExpressionList(ctx: ExpressionListContext): SyntaxNode {
        return buildExpressionList(this, ctx);
    }

    public buildSpreadElement(ctx: SpreadElementContext): SyntaxNode {
        return buildSpreadElement(this, ctx);
    }

    public buildSliceExpression(ctx: ParserRuleContext): SyntaxNode {
        return buildSliceExpression(this, ctx);
    }

    public buildBinaryLayer(ctx: ParserRuleContext, operands: SyntaxNode[], operators: string[]): SyntaxNode {
        if (operands.length === 1) {
            return operands[0];
        }

        return this.buildLeftAssociativeBinaryChain(ctx, operands, operators);
    }

    public buildLeftAssociativeBinaryChain(
        ctx: ParserRuleContext,
        operands: SyntaxNode[],
        operators: string[],
        fallbackOperator?: string
    ): SyntaxNode {
        let current = operands[0];

        for (let index = 1; index < operands.length; index += 1) {
            const right = operands[index];
            current = this.createNodeBetween(SyntaxKind.BinaryExpression, current, right, [current, right], {
                metadata: {
                    operator: operators[index - 1] ?? fallbackOperator ?? 'unknown'
                }
            });
        }

        return current;
    }

    public createNode(
        kind: SyntaxKind,
        ctx: ParserRuleContext,
        children: SyntaxNode[],
        options: Partial<Pick<SyntaxNode, 'name' | 'metadata'>> = {}
    ): SyntaxNode {
        const { startToken, stopToken } = this.getRuleBoundaryTokens(ctx);
        return this.createNodeFromTokens(kind, startToken, stopToken, children, options);
    }

    public createNodeBetween(
        kind: SyntaxKind,
        startNode: SyntaxNode,
        endBoundary: SyntaxNode | ParseTree | undefined,
        children: SyntaxNode[],
        options: Partial<Pick<SyntaxNode, 'name' | 'metadata'>> = {}
    ): SyntaxNode {
        const startToken = this.resolveTokenByIndex(startNode.tokenRange.start);
        const stopToken = this.getBoundaryStopToken(endBoundary) ?? startToken;
        return this.createNodeFromTokens(kind, startToken, stopToken, children, options);
    }

    public createNodeFromTokens(
        kind: SyntaxKind,
        startToken: Token | undefined,
        stopToken: Token | undefined,
        children: SyntaxNode[],
        options: Partial<Pick<SyntaxNode, 'name' | 'metadata'>> = {}
    ): SyntaxNode {
        const normalizedStart = this.normalizeStartToken(startToken, stopToken);
        const normalizedStop = this.normalizeStopToken(stopToken, normalizedStart);
        const tokenRange = createTokenRange(
            normalizedStart?.tokenIndex ?? 0,
            normalizedStop?.tokenIndex ?? normalizedStart?.tokenIndex ?? 0
        );

        return createSyntaxNode({
            kind,
            range: this.createRange(normalizedStart, normalizedStop),
            tokenRange,
            leadingTrivia: this.collectPlacementTrivia(this.parsed.tokenTriviaIndex.getLeadingTrivia(tokenRange.start), 'leading'),
            trailingTrivia: this.collectPlacementTrivia(this.parsed.tokenTriviaIndex.getTrailingTrivia(tokenRange.end), 'trailing'),
            children,
            name: options.name,
            metadata: options.metadata
        });
    }

    public createOpaqueNode(ctx: ParserRuleContext, children: SyntaxNode[], metadata: Record<string, unknown>): SyntaxNode {
        return {
            ...this.createNode(SyntaxKind.OpaqueExpression, ctx, children, { metadata }),
            isOpaque: true
        };
    }

    public createMissingNode(ctx: ParserRuleContext): SyntaxNode {
        return {
            ...this.createNode(SyntaxKind.Missing, ctx, []),
            isMissing: true,
            metadata: { reason: 'unsupported' }
        };
    }

    public buildIdentifierNode(node: TerminalNode): SyntaxNode {
        return this.createNodeFromTokens(SyntaxKind.Identifier, node.symbol, node.symbol, [], {
            name: node.text
        });
    }

    private createSourceFileTokenRange() {
        const firstVisible = this.parsed.visibleTokens[0];
        const lastVisible = this.parsed.visibleTokens[this.parsed.visibleTokens.length - 1];

        if (!firstVisible || !lastVisible) {
            return createTokenRange(0, 0);
        }

        return createTokenRange(firstVisible.tokenIndex, lastVisible.tokenIndex);
    }

    public getRuleBoundaryTokens(ctx: ParserRuleContext): { startToken: Token | undefined; stopToken: Token | undefined } {
        const startToken = this.normalizeStartToken(ctx.start, ctx.stop);
        const stopToken = this.normalizeStopToken(ctx.stop, startToken);
        return { startToken, stopToken };
    }

    public getBoundaryStopToken(boundary: SyntaxNode | ParseTree | undefined): Token | undefined {
        if (!boundary) {
            return undefined;
        }

        if ('tokenRange' in (boundary as SyntaxNode)) {
            return this.resolveTokenByIndex((boundary as SyntaxNode).tokenRange.end);
        }

        if (boundary instanceof TerminalNode) {
            return boundary.symbol;
        }

        if (boundary instanceof ParserRuleContext) {
            return this.normalizeStopToken(boundary.stop, boundary.start);
        }

        return undefined;
    }

    public normalizeStartToken(startToken: Token | undefined, stopToken: Token | undefined): Token | undefined {
        if (startToken && startToken.type !== Token.EOF) {
            return startToken;
        }

        return stopToken && stopToken.type !== Token.EOF ? stopToken : this.parsed.visibleTokens[0];
    }

    public normalizeStopToken(stopToken: Token | undefined, startToken: Token | undefined): Token | undefined {
        if (stopToken && stopToken.type !== Token.EOF) {
            return stopToken;
        }

        return startToken && startToken.type !== Token.EOF
            ? startToken
            : this.parsed.visibleTokens[this.parsed.visibleTokens.length - 1];
    }

    public resolveTokenByIndex(tokenIndex: number): Token | undefined {
        return this.parsed.allTokens.find((token) => token.tokenIndex === tokenIndex);
    }

    public createRange(startToken: Token | undefined, stopToken: Token | undefined): vscode.Range {
        if (!startToken || !stopToken) {
            return new vscode.Range(this.positionAt(0), this.positionAt(0));
        }

        return new vscode.Range(
            this.positionAt(this.getTokenStartOffset(startToken)),
            this.positionAt(this.getTokenEndOffset(stopToken))
        );
    }

    public getTokenStartOffset(token: Token): number {
        if (typeof token.startIndex === 'number' && token.startIndex >= 0) {
            return token.startIndex;
        }

        return this.offsetFromLineAndCharacter(token.line, token.charPositionInLine);
    }

    public getTokenEndOffset(token: Token): number {
        if (typeof token.stopIndex === 'number' && token.stopIndex >= 0) {
            return token.stopIndex + 1;
        }

        return this.getTokenStartOffset(token) + Math.max((token.text ?? '').length, 1);
    }

    public getNodeText(node: ParserRuleContext): string {
        const { startToken, stopToken } = this.getRuleBoundaryTokens(node);

        if (!startToken || !stopToken) {
            return node.text ?? '';
        }

        return this.parsed.text.slice(
            this.getTokenStartOffset(startToken),
            this.getTokenEndOffset(stopToken)
        );
    }

    public countExplicitPointerTokens(ctx: TypeLikeContext): number {
        return (this.getNodeText(ctx).match(/\*/g) || []).length;
    }

    public collectTokenTexts(...groups: Array<TerminalNode[] | TerminalNode | undefined>): string[] {
        return groups.flatMap((group) => this.asArray(group).map((token) => token.text));
    }

    public getChildren(node: ParseTree): ParseTree[] {
        const childCount = typeof (node as { childCount?: number }).childCount === 'number'
            ? (node as { childCount: number }).childCount
            : 0;
        const children: ParseTree[] = [];

        for (let index = 0; index < childCount; index += 1) {
            children.push((node as ParserRuleContext).getChild(index));
        }

        return children;
    }

    public isTerminal(node: ParseTree | undefined, tokenType: number): node is TerminalNode {
        return Boolean(node && (node as TerminalNode).symbol && (node as TerminalNode).symbol.type === tokenType);
    }

    public isRuleContext(node: ParseTree | undefined, constructorName: string): boolean {
        return Boolean(node && node.constructor && node.constructor.name === constructorName);
    }

    public collectPlacementTrivia(trivia: Trivia[], placement: 'leading' | 'trailing'): SyntaxTrivia[] {
        return trivia.map((entry) => syntaxTriviaFromParsedTrivia(entry, placement));
    }

    public collectNodes(nodes: Array<SyntaxNode | undefined>): SyntaxNode[] {
        return nodes.filter((node): node is SyntaxNode => Boolean(node));
    }

    public asArray<T>(value: T[] | T | undefined): T[] {
        if (value === undefined || value === null) {
            return [];
        }

        return Array.isArray(value) ? value : [value];
    }

    private positionAt(offset: number): vscode.Position {
        const normalizedOffset = Math.max(0, Math.min(offset, this.parsed.text.length));
        let low = 0;
        let high = this.lineStartOffsets.length - 1;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            if (this.lineStartOffsets[mid] > normalizedOffset) {
                high = mid - 1;
            } else {
                low = mid + 1;
            }
        }

        const line = Math.max(0, high);
        return new vscode.Position(line, normalizedOffset - this.lineStartOffsets[line]);
    }

    private offsetFromLineAndCharacter(line: number, character: number): number {
        const normalizedLine = Math.max(0, (line || 1) - 1);
        const lineStart = this.lineStartOffsets[normalizedLine] ?? 0;
        return lineStart + Math.max(0, character || 0);
    }
}

function firstDefined<T>(...values: Array<T | undefined>): T | undefined {
    return values.find((value) => value !== undefined);
}

function buildLineStartOffsets(text: string): number[] {
    const offsets = [0];

    for (let index = 0; index < text.length; index += 1) {
        if (text[index] === '\n') {
            offsets.push(index + 1);
        }
    }

    return offsets;
}
