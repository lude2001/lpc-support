import { ParserRuleContext } from 'antlr4ts/ParserRuleContext';
import { TerminalNode } from 'antlr4ts/tree/TerminalNode';
import {
    AdditiveExpressionContext,
    AnonFunctionContext,
    ArgumentListContext,
    ArrayDelimiterExprContext,
    ArrayLiteralContext,
    AssignmentExpressionContext,
    BitwiseAndExpressionContext,
    BitwiseOrExpressionContext,
    BitwiseXorExpressionContext,
    CastExpressionContext,
    CharPrimaryContext,
    ClosureExprContext,
    ClosurePrimaryContext,
    ConditionalExpressionContext,
    DollarCallExprContext,
    EqualityExpressionContext,
    ExpressionContext,
    FloatPrimaryContext,
    IdentifierPrimaryContext,
    IntegerPrimaryContext,
    LogicalAndExpressionContext,
    LogicalOrExpressionContext,
    MacroInvokeContext,
    MappingLiteralExprContext,
    MultiplicativeExpressionContext,
    NewExpressionPrimaryContext,
    ParameterPlaceholderContext,
    ParenExprContext,
    PostfixExpressionContext,
    PrimaryContext,
    RefVariableContext,
    RelationalExpressionContext,
    ScopeIdentifierContext,
    ShiftExpressionContext,
    StringConcatenationContext,
    StringPrimaryContext,
    UnaryExpressionContext,
    LPCParser
} from '../../antlr/LPCParser';
import { SyntaxKind, SyntaxNode } from '../types';
import type { SyntaxBuilder } from '../SyntaxBuilder';

export function buildExpression(b: SyntaxBuilder, ctx: ExpressionContext): SyntaxNode {
    const assignments = b.asArray(ctx.assignmentExpression());
    if (assignments.length === 1) {
        return b.buildAssignmentExpression(assignments[0]);
    }

    return b.buildLeftAssociativeBinaryChain(
        ctx,
        assignments.map((assignment) => b.buildAssignmentExpression(assignment)),
        b.asArray(ctx.COMMA?.()).map((token) => token.text),
        'comma'
    );
}

export function buildAssignmentExpression(b: SyntaxBuilder, ctx: AssignmentExpressionContext): SyntaxNode {
    const left = b.buildConditionalExpression(ctx.conditionalExpression());
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

    return b.createNode(SyntaxKind.AssignmentExpression, ctx, [left, b.buildExpression(ctx.expression()!)], {
        metadata: { operator: operator.text }
    });
}

export function buildConditionalExpression(b: SyntaxBuilder, ctx: ConditionalExpressionContext): SyntaxNode {
    const condition = b.buildLogicalOrExpression(ctx.logicalOrExpression());
    if (!ctx.QUESTION() || !ctx.expression() || !ctx.conditionalExpression()) {
        return condition;
    }

    return b.createNode(
        SyntaxKind.ConditionalExpression,
        ctx,
        [condition, b.buildExpression(ctx.expression()!), b.buildConditionalExpression(ctx.conditionalExpression()!)],
        {
            metadata: { operator: '?:' }
        }
    );
}

export function buildLogicalOrExpression(b: SyntaxBuilder, ctx: LogicalOrExpressionContext): SyntaxNode {
    return b.buildBinaryLayer(
        ctx,
        b.asArray(ctx.logicalAndExpression()).map((node) => b.buildLogicalAndExpression(node)),
        b.asArray(ctx.OR?.()).map((token) => token.text)
    );
}

export function buildLogicalAndExpression(b: SyntaxBuilder, ctx: LogicalAndExpressionContext): SyntaxNode {
    return b.buildBinaryLayer(
        ctx,
        b.asArray(ctx.bitwiseOrExpression()).map((node) => b.buildBitwiseOrExpression(node)),
        b.asArray(ctx.AND?.()).map((token) => token.text)
    );
}

export function buildBitwiseOrExpression(b: SyntaxBuilder, ctx: BitwiseOrExpressionContext): SyntaxNode {
    return b.buildBinaryLayer(
        ctx,
        b.asArray(ctx.bitwiseXorExpression()).map((node) => b.buildBitwiseXorExpression(node)),
        b.asArray(ctx.BIT_OR?.()).map((token) => token.text)
    );
}

export function buildBitwiseXorExpression(b: SyntaxBuilder, ctx: BitwiseXorExpressionContext): SyntaxNode {
    return b.buildBinaryLayer(
        ctx,
        b.asArray(ctx.bitwiseAndExpression()).map((node) => b.buildBitwiseAndExpression(node)),
        b.asArray(ctx.BIT_XOR?.()).map((token) => token.text)
    );
}

export function buildBitwiseAndExpression(b: SyntaxBuilder, ctx: BitwiseAndExpressionContext): SyntaxNode {
    return b.buildBinaryLayer(
        ctx,
        b.asArray(ctx.equalityExpression()).map((node) => b.buildEqualityExpression(node)),
        b.asArray(ctx.BIT_AND?.()).map((token) => token.text)
    );
}

export function buildEqualityExpression(b: SyntaxBuilder, ctx: EqualityExpressionContext): SyntaxNode {
    return b.buildBinaryLayer(
        ctx,
        b.asArray(ctx.relationalExpression()).map((node) => b.buildRelationalExpression(node)),
        b.collectTokenTexts(ctx.EQ?.(), ctx.NE?.())
    );
}

export function buildRelationalExpression(b: SyntaxBuilder, ctx: RelationalExpressionContext): SyntaxNode {
    return b.buildBinaryLayer(
        ctx,
        b.asArray(ctx.shiftExpression()).map((node) => b.buildShiftExpression(node)),
        b.collectTokenTexts(ctx.GT?.(), ctx.LT?.(), ctx.GE?.(), ctx.LE?.())
    );
}

export function buildShiftExpression(b: SyntaxBuilder, ctx: ShiftExpressionContext): SyntaxNode {
    return b.buildBinaryLayer(
        ctx,
        b.asArray(ctx.additiveExpression()).map((node) => b.buildAdditiveExpression(node)),
        b.collectTokenTexts(ctx.SHIFT_LEFT?.(), ctx.SHIFT_RIGHT?.())
    );
}

export function buildAdditiveExpression(b: SyntaxBuilder, ctx: AdditiveExpressionContext): SyntaxNode {
    return b.buildBinaryLayer(
        ctx,
        b.asArray(ctx.multiplicativeExpression()).map((node) => b.buildMultiplicativeExpression(node)),
        b.collectTokenTexts(ctx.PLUS?.(), ctx.MINUS?.())
    );
}

export function buildMultiplicativeExpression(b: SyntaxBuilder, ctx: MultiplicativeExpressionContext): SyntaxNode {
    return b.buildBinaryLayer(
        ctx,
        b.asArray(ctx.unaryExpression()).map((node) => b.buildUnaryExpression(node)),
        b.collectTokenTexts(ctx.STAR?.(), ctx.DIV?.(), ctx.PERCENT?.())
    );
}

export function buildUnaryExpression(b: SyntaxBuilder, ctx: UnaryExpressionContext): SyntaxNode {
    if (ctx.postfixExpression()) {
        const operand = b.buildPostfixExpression(ctx.postfixExpression()!);
        const operator = firstDefined(ctx.INC?.(), ctx.DEC?.());

        if (!operator) {
            return operand;
        }

        return b.createNode(SyntaxKind.UnaryExpression, ctx, [operand], {
            metadata: { operator: operator.text, position: 'prefix' }
        });
    }

    if (ctx.unaryExpression()) {
        const operator = firstDefined(ctx.PLUS?.(), ctx.MINUS?.(), ctx.NOT?.(), ctx.BIT_NOT?.(), ctx.STAR?.());
        if (operator) {
            return b.createNode(SyntaxKind.UnaryExpression, ctx, [b.buildUnaryExpression(ctx.unaryExpression()!)], {
                metadata: { operator: operator.text, position: 'prefix' }
            });
        }
    }

    if (ctx.CATCH()) {
        const child = ctx.expression()
            ? b.buildExpression(ctx.expression()!)
            : ctx.block()
                ? b.buildBlock(ctx.block()!)
                : b.createMissingNode(ctx);

        return b.createNode(SyntaxKind.UnaryExpression, ctx, [child], {
            metadata: { operator: 'catch', position: 'prefix' }
        });
    }

    if (ctx.castExpression()) {
        return b.buildCastExpression(ctx.castExpression()!);
    }

    return b.createOpaqueNode(ctx, [], { reason: 'unary-fallback' });
}

export function buildCastExpression(b: SyntaxBuilder, ctx: CastExpressionContext): SyntaxNode {
    const children: SyntaxNode[] = [];
    const typeReference = b.buildTypeReference(ctx.castType());

    if (typeReference) {
        children.push(typeReference);
    }
    children.push(b.buildUnaryExpression(ctx.unaryExpression()));

    return b.createNode(SyntaxKind.UnaryExpression, ctx, children, {
        metadata: { operator: 'cast', position: 'prefix' }
    });
}

export function buildPostfixExpression(b: SyntaxBuilder, ctx: PostfixExpressionContext): SyntaxNode {
    let current = b.buildPrimary(ctx.primary());
    const children = b.getChildren(ctx);
    let index = 1;

    while (index < children.length) {
        const child = children[index];

        if (b.isTerminal(child, LPCParser.LPAREN)) {
            const argumentList = b.isRuleContext(children[index + 1], 'ArgumentListContext')
                ? b.buildArgumentList(children[index + 1] as ArgumentListContext)
                : undefined;
            const endBoundary = argumentList ? children[index + 2] : children[index + 1];
            const callChildren = argumentList ? [current, argumentList] : [current];

            current = b.createNodeBetween(SyntaxKind.CallExpression, current, endBoundary, callChildren);
            index += argumentList ? 3 : 2;
            continue;
        }

        if (b.isTerminal(child, LPCParser.ARROW) || b.isTerminal(child, LPCParser.DOT) || b.isTerminal(child, LPCParser.SCOPE)) {
            const memberToken = children[index + 1] as TerminalNode;
            let memberAccess = b.createNodeBetween(
                SyntaxKind.MemberAccessExpression,
                current,
                memberToken,
                [current, b.buildIdentifierNode(memberToken)],
                {
                    metadata: { operator: (child as TerminalNode).text }
                }
            );
            index += 2;

            if (b.isTerminal(children[index], LPCParser.LPAREN)) {
                const argumentList = b.isRuleContext(children[index + 1], 'ArgumentListContext')
                    ? b.buildArgumentList(children[index + 1] as ArgumentListContext)
                    : undefined;
                const endBoundary = argumentList ? children[index + 2] : children[index + 1];
                const callChildren = argumentList ? [memberAccess, argumentList] : [memberAccess];

                memberAccess = b.createNodeBetween(SyntaxKind.CallExpression, memberAccess, endBoundary, callChildren);
                index += argumentList ? 3 : 2;
            }

            current = memberAccess;
            continue;
        }

        if (b.isTerminal(child, LPCParser.LBRACK)) {
            const sliceExpr = children[index + 1] instanceof ParserRuleContext
                ? b.buildSliceExpression(children[index + 1] as ParserRuleContext)
                : b.createMissingNode(ctx);
            const endBoundary = children[index + 2];

            current = b.createNodeBetween(SyntaxKind.IndexExpression, current, endBoundary, [current, sliceExpr]);
            index += 3;
            continue;
        }

        if (b.isTerminal(child, LPCParser.INC) || b.isTerminal(child, LPCParser.DEC)) {
            current = b.createNodeBetween(SyntaxKind.PostfixExpression, current, child, [current], {
                metadata: { operator: (child as TerminalNode).text, position: 'postfix' }
            });
            index += 1;
            continue;
        }

        index += 1;
    }

    return current;
}

export function buildPrimary(b: SyntaxBuilder, ctx: PrimaryContext): SyntaxNode {
    switch (ctx.constructor.name) {
        case 'IdentifierPrimaryContext':
            return b.buildIdentifierNode((ctx as IdentifierPrimaryContext).Identifier());
        case 'ScopeIdentifierContext':
            return b.createNode(SyntaxKind.Identifier, ctx, [], {
                name: (ctx as ScopeIdentifierContext).Identifier().text,
                metadata: { scopeQualifier: (ctx as ScopeIdentifierContext).SCOPE().text }
            });
        case 'RefVariableContext':
            return b.createNode(SyntaxKind.Identifier, ctx, [], {
                name: (ctx as RefVariableContext).Identifier().text,
                metadata: { isReference: true }
            });
        case 'ParameterPlaceholderContext':
            return b.createNode(SyntaxKind.Identifier, ctx, [], {
                name: (ctx as ParameterPlaceholderContext).PARAMETER_PLACEHOLDER().text,
                metadata: { placeholder: true }
            });
        case 'IntegerPrimaryContext':
        case 'FloatPrimaryContext':
        case 'StringPrimaryContext':
        case 'CharPrimaryContext':
            return b.createNode(SyntaxKind.Literal, ctx, [], {
                metadata: { text: b.getNodeText(ctx) }
            });
        case 'ParenExprContext':
            return b.createNode(SyntaxKind.ParenthesizedExpression, ctx, [b.buildExpression((ctx as ParenExprContext).expression())]);
        case 'DollarCallExprContext':
            return b.createNode(SyntaxKind.CallExpression, ctx, [b.buildExpression((ctx as DollarCallExprContext).expression())], {
                metadata: { source: 'dollar-call' }
            });
        case 'StringConcatenationContext':
            return b.buildStringConcatenation(ctx as StringConcatenationContext);
        case 'AnonFunctionContext': {
            const anonFunction = ctx as AnonFunctionContext;
            const children: SyntaxNode[] = [];
            const parameters = b.buildParameterList(anonFunction.parameterList());

            if (parameters) {
                children.push(parameters);
            }
            children.push(b.buildBlock(anonFunction.block()));

            return b.createNode(SyntaxKind.AnonymousFunctionExpression, ctx, children, {
                metadata: { source: 'anonymous-function' }
            });
        }
        case 'ClosurePrimaryContext':
            return b.buildClosureExpression((ctx as ClosurePrimaryContext).closureExpr());
        case 'MappingLiteralExprContext':
            return b.buildMappingLiteral((ctx as MappingLiteralExprContext).mappingLiteral());
        case 'ArrayDelimiterExprContext':
            return b.buildArrayDelimiterLiteral((ctx as ArrayDelimiterExprContext).arrayDelimiterLiteral());
        case 'NewExpressionPrimaryContext':
            return b.buildNewExpression((ctx as NewExpressionPrimaryContext).newExpression());
        case 'ArrayLiteralContext':
            return b.buildArrayLiteral(ctx as ArrayLiteralContext);
        default:
            break;
    }

    const primaryContext = ctx as any;
    if (typeof primaryContext.Identifier === 'function' && typeof primaryContext.expression !== 'function') {
        return b.buildIdentifierNode(primaryContext.Identifier());
    }

    return b.createOpaqueNode(ctx, [], { reason: 'primary-fallback', text: b.getNodeText(ctx) });
}

export function buildMacroInvokeExpression(b: SyntaxBuilder, ctx: MacroInvokeContext): SyntaxNode {
    const children: SyntaxNode[] = [b.buildIdentifierNode(ctx.Identifier())];
    const argumentList = b.buildArgumentList(ctx.argumentList());

    if (argumentList) {
        children.push(argumentList);
    }

    return b.createNode(SyntaxKind.CallExpression, ctx, children, {
        name: ctx.Identifier().text,
        metadata: { source: 'macro-invoke' }
    });
}

export function buildClosureExpression(b: SyntaxBuilder, ctx: ClosureExprContext): SyntaxNode {
    const children = ctx.expression() ? [b.buildExpression(ctx.expression()!)] : [];
    return b.createNode(SyntaxKind.ClosureExpression, ctx, children, {
        metadata: {
            hasDollarIdentifier: Boolean(ctx.DOLLAR()),
            identifier: ctx.Identifier()?.text
        }
    });
}

function firstDefined<T>(...values: Array<T | undefined>): T | undefined {
    return values.find((value) => value !== undefined);
}
