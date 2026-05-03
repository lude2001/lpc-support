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
import { AttachedDocComment } from '../language/documentation/types';
import {
    createSyntaxDocument,
    createSyntaxNode,
    createTokenRange,
    SourceFileSyntaxNode,
    SyntaxDocument,
    SyntaxKind,
    SyntaxNode
} from './types';
import { createSyntaxTrivia, SyntaxTrivia, syntaxTriviaFromParsedTrivia } from './trivia';
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
    buildStructDeclaration,
    buildStructMembers,
    buildTypeReference,
    buildVariableDeclaration,
    buildVariableDeclarator
} from './builders/declarationBuilders';
import * as expressionBuilders from './builders/expressionBuilders';
import * as statementBuilders from './builders/statementBuilders';

type TypeLikeContext = TypeSpecContext | CastTypeContext;

export class SyntaxBuilder {
    private readonly lineStartOffsets: number[];
    private readonly originalLineStartOffsets: number[];

    constructor(private readonly parsed: ParsedDocument) {
        this.lineStartOffsets = buildLineStartOffsets(parsed.parseText);
        this.originalLineStartOffsets = buildLineStartOffsets(parsed.text);
    }

    public build(): SyntaxDocument {
        const root = this.buildSourceFile(this.parsed.tree as SourceFileContext);
        return createSyntaxDocument({
            parsed: this.parsed,
            root
        });
    }

    private buildSourceFile(ctx: SourceFileContext): SourceFileSyntaxNode {
        const children = [
            ...this.buildPreprocessorDirectiveNodes(),
            ...this.collectNodes(this.asArray(ctx.statement()).map((statement) => this.buildStatement(statement)))
        ].sort((left, right) => {
            if (left.range.start.line !== right.range.start.line) {
                return left.range.start.line - right.range.start.line;
            }

            return left.range.start.character - right.range.start.character;
        });
        const range = new vscode.Range(this.positionAt(0), this.positionAt(this.parsed.parseText.length));
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

    private buildPreprocessorDirectiveNodes(): SyntaxNode[] {
        return this.parsed.frontend?.preprocessor.directives.map((directive) => createSyntaxNode({
            kind: this.getPreprocessorSyntaxKind(directive.kind),
            range: directive.range,
            tokenRange: createTokenRange(0, 0),
            leadingTrivia: this.collectOriginalLeadingCommentsForDirective(directive.startOffset, directive.range.start.line),
            children: [],
            name: directive.kind,
            metadata: {
                directiveKind: directive.kind,
                rawText: directive.rawText,
                body: directive.body
            }
        })) ?? [];
    }

    private getPreprocessorSyntaxKind(kind: string): SyntaxKind {
        switch (kind) {
            case 'include':
                return SyntaxKind.PreprocessorIncludeDirective;
            case 'define':
                return SyntaxKind.MacroDefinitionDirective;
            case 'undef':
                return SyntaxKind.MacroUndefDirective;
            case 'if':
            case 'ifdef':
            case 'ifndef':
            case 'elif':
            case 'else':
            case 'endif':
                return SyntaxKind.ConditionalDirective;
            default:
                return SyntaxKind.PreprocessorDirective;
        }
    }

    public buildStatement(ctx: StatementContext): SyntaxNode {
        return statementBuilders.buildStatement(this, ctx);
    }

    public buildFunctionDeclaration(ctx: FunctionDefContext | PrototypeStatementContext): SyntaxNode {
        const node = buildFunctionDeclaration(this, ctx) as SyntaxNode;
        const attachedDocComment = this.findAttachedDocComment(ctx);

        if (attachedDocComment) {
            node.attachedDocComment = attachedDocComment;
        }

        return node;
    }

    public buildPrototypeDeclaration(ctx: PrototypeStatementContext): SyntaxNode {
        return this.buildFunctionDeclaration(ctx);
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
        return statementBuilders.buildBlock(this, ctx);
    }

    public buildExpressionStatement(ctx: ExprStatementContext): SyntaxNode {
        return statementBuilders.buildExpressionStatement(this, ctx);
    }

    public buildIfStatement(ctx: IfStatementContext): SyntaxNode {
        return statementBuilders.buildIfStatement(this, ctx);
    }

    public buildLoopStatement(kind: SyntaxKind.WhileStatement, ctx: WhileStatementContext): SyntaxNode {
        return statementBuilders.buildLoopStatement(this, kind, ctx);
    }

    public buildDoWhileStatement(ctx: DoWhileStatementContext): SyntaxNode {
        return statementBuilders.buildDoWhileStatement(this, ctx);
    }

    public buildForStatement(ctx: ForStatementContext): SyntaxNode {
        return statementBuilders.buildForStatement(this, ctx);
    }

    public buildForeachStatement(ctx: ForeachStatementContext): SyntaxNode {
        return statementBuilders.buildForeachStatement(this, ctx);
    }

    public buildForeachBinding(ctx: ForeachVarContext): SyntaxNode {
        return statementBuilders.buildForeachBinding(this, ctx);
    }

    public buildSwitchStatement(ctx: SwitchStatementContext): SyntaxNode {
        return statementBuilders.buildSwitchStatement(this, ctx);
    }

    public buildSwitchSection(ctx: SwitchSectionContext): SyntaxNode[] {
        return statementBuilders.buildSwitchSection(this, ctx);
    }

    public buildSwitchClause(ctx: SwitchLabelWithColonContext, statements: SyntaxNode[]): SyntaxNode {
        return statementBuilders.buildSwitchClause(this, ctx, statements);
    }

    public buildReturnStatement(ctx: ReturnStatementContext): SyntaxNode {
        return statementBuilders.buildReturnStatement(this, ctx);
    }

    public buildLeafNode(kind: SyntaxKind.BreakStatement | SyntaxKind.ContinueStatement, ctx: ContinueStatementContext | ParserRuleContext): SyntaxNode {
        return statementBuilders.buildLeafNode(this, kind, ctx);
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
        return expressionBuilders.buildExpression(this, ctx);
    }

    public buildAssignmentExpression(ctx: AssignmentExpressionContext): SyntaxNode {
        return expressionBuilders.buildAssignmentExpression(this, ctx);
    }

    public buildConditionalExpression(ctx: ConditionalExpressionContext): SyntaxNode {
        return expressionBuilders.buildConditionalExpression(this, ctx);
    }

    public buildLogicalOrExpression(ctx: LogicalOrExpressionContext): SyntaxNode {
        return expressionBuilders.buildLogicalOrExpression(this, ctx);
    }

    public buildLogicalAndExpression(ctx: LogicalAndExpressionContext): SyntaxNode {
        return expressionBuilders.buildLogicalAndExpression(this, ctx);
    }

    public buildBitwiseOrExpression(ctx: BitwiseOrExpressionContext): SyntaxNode {
        return expressionBuilders.buildBitwiseOrExpression(this, ctx);
    }

    public buildBitwiseXorExpression(ctx: BitwiseXorExpressionContext): SyntaxNode {
        return expressionBuilders.buildBitwiseXorExpression(this, ctx);
    }

    public buildBitwiseAndExpression(ctx: BitwiseAndExpressionContext): SyntaxNode {
        return expressionBuilders.buildBitwiseAndExpression(this, ctx);
    }

    public buildEqualityExpression(ctx: EqualityExpressionContext): SyntaxNode {
        return expressionBuilders.buildEqualityExpression(this, ctx);
    }

    public buildRelationalExpression(ctx: RelationalExpressionContext): SyntaxNode {
        return expressionBuilders.buildRelationalExpression(this, ctx);
    }

    public buildShiftExpression(ctx: ShiftExpressionContext): SyntaxNode {
        return expressionBuilders.buildShiftExpression(this, ctx);
    }

    public buildAdditiveExpression(ctx: AdditiveExpressionContext): SyntaxNode {
        return expressionBuilders.buildAdditiveExpression(this, ctx);
    }

    public buildMultiplicativeExpression(ctx: MultiplicativeExpressionContext): SyntaxNode {
        return expressionBuilders.buildMultiplicativeExpression(this, ctx);
    }

    public buildUnaryExpression(ctx: UnaryExpressionContext): SyntaxNode {
        return expressionBuilders.buildUnaryExpression(this, ctx);
    }

    public buildCastExpression(ctx: CastExpressionContext): SyntaxNode {
        return expressionBuilders.buildCastExpression(this, ctx);
    }

    public buildPostfixExpression(ctx: PostfixExpressionContext): SyntaxNode {
        return expressionBuilders.buildPostfixExpression(this, ctx);
    }

    public buildPrimary(ctx: PrimaryContext): SyntaxNode {
        return expressionBuilders.buildPrimary(this, ctx);
    }

    public buildMacroInvokeExpression(ctx: MacroInvokeContext): SyntaxNode {
        return expressionBuilders.buildMacroInvokeExpression(this, ctx);
    }

    public buildClosureExpression(ctx: ClosureExprContext): SyntaxNode {
        return expressionBuilders.buildClosureExpression(this, ctx);
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
        const normalizedStopCandidate = this.normalizeStopToken(stopToken, normalizedStart);
        const normalizedStop = normalizedStart
            && normalizedStopCandidate
            && normalizedStopCandidate.tokenIndex < normalizedStart.tokenIndex
            ? normalizedStart
            : normalizedStopCandidate;
        const tokenRange = createTokenRange(
            normalizedStart?.tokenIndex ?? 0,
            normalizedStop?.tokenIndex ?? normalizedStart?.tokenIndex ?? 0
        );

        return createSyntaxNode({
            kind,
            range: this.createRange(normalizedStart, normalizedStop),
            tokenRange,
            leadingTrivia: this.filterLeadingTriviaAcrossPreprocessor(
                this.collectPlacementTrivia(this.parsed.tokenTriviaIndex.getLeadingTrivia(tokenRange.start), 'leading'),
                normalizedStart
            ),
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

        return this.parsed.parseText.slice(
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

    private findAttachedDocComment(ctx: FunctionDefContext | PrototypeStatementContext): AttachedDocComment | undefined {
        const startToken = ctx.start;
        if (!startToken) {
            return undefined;
        }

        const leadingTrivia = this.parsed.tokenTriviaIndex.getLeadingTrivia(startToken.tokenIndex);
        if (leadingTrivia.length === 0) {
            return undefined;
        }

        let candidateIndex = -1;
        for (let index = leadingTrivia.length - 1; index >= 0; index -= 1) {
            const trivia = leadingTrivia[index];

            if (trivia.kind === 'newline' || trivia.kind === 'whitespace') {
                continue;
            }

            if (trivia.kind === 'block-comment' && trivia.text.startsWith('/**')) {
                candidateIndex = index;
            }

            break;
        }

        if (candidateIndex < 0) {
            return undefined;
        }

        const candidate = leadingTrivia[candidateIndex];
        const interveningTrivia = leadingTrivia.slice(candidateIndex + 1);
        if (
            interveningTrivia.some((trivia) => trivia.kind === 'line-comment' || trivia.kind === 'block-comment' || trivia.kind === 'directive')
            || this.hasPreprocessorDirectiveBetween(candidate.range.end, this.createRange(startToken, startToken).start)
        ) {
            return undefined;
        }

        const newlineCount = interveningTrivia.filter((trivia) => trivia.kind === 'newline').length;
        if (newlineCount > 2) {
            return undefined;
        }

        return {
            kind: 'javadoc',
            range: {
                start: {
                    line: candidate.range.start.line,
                    character: candidate.range.start.character
                },
                end: {
                    line: candidate.range.end.line,
                    character: candidate.range.end.character
                }
            },
            text: candidate.text
        };
    }

    public asArray<T>(value: T[] | T | undefined): T[] {
        if (value === undefined || value === null) {
            return [];
        }

        return Array.isArray(value) ? value : [value];
    }

    private positionAt(offset: number): vscode.Position {
        const normalizedOffset = Math.max(0, Math.min(offset, this.parsed.parseText.length));
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

    private offsetAt(position: vscode.Position): number {
        const lineStart = this.lineStartOffsets[position.line] ?? this.parsed.parseText.length;
        return Math.max(0, Math.min(lineStart + position.character, this.parsed.parseText.length));
    }

    private originalPositionAt(offset: number): vscode.Position {
        const normalizedOffset = Math.max(0, Math.min(offset, this.parsed.text.length));
        let low = 0;
        let high = this.originalLineStartOffsets.length - 1;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            if (this.originalLineStartOffsets[mid] > normalizedOffset) {
                high = mid - 1;
            } else {
                low = mid + 1;
            }
        }

        const line = Math.max(0, high);
        return new vscode.Position(line, normalizedOffset - this.originalLineStartOffsets[line]);
    }

    private hasPreprocessorDirectiveBetween(start: vscode.Position, end: vscode.Position): boolean {
        const startOffset = this.offsetAt(start);
        const endOffset = this.offsetAt(end);

        return this.parsed.frontend?.preprocessor.directives.some((directive) => (
            directive.startOffset >= startOffset && directive.startOffset < endOffset
        )) ?? false;
    }

    private collectOriginalLeadingCommentsForDirective(startOffset: number, startLine: number): SyntaxTrivia[] {
        if (startLine <= 0) {
            return [];
        }

        const previousLineStart = this.originalLineStartOffsets[startLine - 1] ?? 0;
        const currentLineStart = this.originalLineStartOffsets[startLine] ?? startOffset;
        const previousLineEnd = Math.max(previousLineStart, currentLineStart - 1);
        const previousLine = this.parsed.text.slice(previousLineStart, previousLineEnd);
        const trimmed = previousLine.trim();

        if (!trimmed.startsWith('//')) {
            return [];
        }

        const commentStart = previousLineStart + previousLine.indexOf('//');
        const commentEnd = previousLineEnd;
        return [createSyntaxTrivia({
            kind: 'line-comment',
            text: this.parsed.text.slice(commentStart, commentEnd),
            range: new vscode.Range(this.originalPositionAt(commentStart), this.originalPositionAt(commentEnd)),
            tokenIndex: 0,
            startOffset: commentStart,
            endOffset: commentEnd,
            placement: 'leading'
        })];
    }

    private filterLeadingTriviaAcrossPreprocessor(leadingTrivia: SyntaxTrivia[], startToken: Token | undefined): SyntaxTrivia[] {
        if (!startToken) {
            return leadingTrivia;
        }

        const nodeStartOffset = this.getTokenStartOffset(startToken);
        const lastDirectiveBeforeNode = this.parsed.frontend?.preprocessor.directives
            .filter((directive) => directive.endOffset <= nodeStartOffset)
            .sort((left, right) => right.endOffset - left.endOffset)[0];

        if (!lastDirectiveBeforeNode) {
            return leadingTrivia;
        }

        return leadingTrivia.filter((trivia) => trivia.startOffset >= lastDirectiveBeforeNode.endOffset);
    }
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
