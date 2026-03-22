import { ParserRuleContext } from 'antlr4ts/ParserRuleContext';
import {
    ArgumentListContext,
    ArrayDelimiterElementContext,
    ArrayDelimiterLiteralContext,
    ArrayLiteralContext,
    ConcatItemContext,
    ExpressionListContext,
    MappingLiteralContext,
    MappingPairContext,
    NewExpressionContext,
    SpreadElementContext,
    StringConcatenationContext,
    StructInitializerContext,
    StructInitializerListContext
} from '../../antlr/LPCParser';
import { SyntaxKind, SyntaxNode } from '../types';
import type { SyntaxBuilder } from '../SyntaxBuilder';

export function buildMappingLiteral(b: SyntaxBuilder, ctx: MappingLiteralContext): SyntaxNode {
    const children = ctx.mappingPairList()
        ? b.asArray(ctx.mappingPairList()!.mappingPair()).map((pair) => buildMappingPair(b, pair))
        : [];

    return b.createNode(SyntaxKind.MappingLiteralExpression, ctx, children);
}

export function buildMappingPair(b: SyntaxBuilder, ctx: MappingPairContext): SyntaxNode {
    const children = b.asArray(ctx.expression()).map((expression) => b.buildExpression(expression));
    return b.createNode(SyntaxKind.MappingEntry, ctx, children);
}

export function buildArrayLiteral(b: SyntaxBuilder, ctx: ArrayLiteralContext): SyntaxNode {
    const expressionList = ctx.expressionList();
    const children = expressionList ? [buildExpressionList(b, expressionList)] : [];
    return b.createNode(SyntaxKind.ArrayLiteralExpression, ctx, children);
}

export function buildArrayDelimiterLiteral(b: SyntaxBuilder, ctx: ArrayDelimiterLiteralContext): SyntaxNode {
    const children = ctx.arrayDelimiterContent()
        ? b.asArray(ctx.arrayDelimiterContent()!.arrayDelimiterElement()).map((element) => buildArrayDelimiterElement(b, element))
        : [];

    return b.createNode(SyntaxKind.ArrayDelimiterLiteralExpression, ctx, children);
}

export function buildArrayDelimiterElement(b: SyntaxBuilder, ctx: ArrayDelimiterElementContext): SyntaxNode {
    if (ctx.Identifier()) {
        return b.buildIdentifierNode(ctx.Identifier()!);
    }

    return b.createNode(SyntaxKind.Literal, ctx, [], {
        metadata: { text: b.getNodeText(ctx) }
    });
}

export function buildNewExpression(b: SyntaxBuilder, ctx: NewExpressionContext): SyntaxNode {
    const children: SyntaxNode[] = [];
    const typeReference = ctx.typeSpec() ? b.buildTypeReference(ctx.typeSpec()!) : undefined;
    const expression = ctx.expression() ? b.buildExpression(ctx.expression()!) : undefined;
    const initializerList = ctx.structInitializerList()
        ? buildStructInitializerList(b, ctx.structInitializerList()!)
        : undefined;

    if (typeReference) {
        children.push(typeReference);
    } else if (expression) {
        children.push(expression);
    }

    if (initializerList) {
        children.push(initializerList);
    }

    return b.createNode(SyntaxKind.NewExpression, ctx, children, {
        metadata: { hasInitializerList: Boolean(initializerList) }
    });
}

export function buildStructInitializerList(b: SyntaxBuilder, ctx: StructInitializerListContext): SyntaxNode {
    return b.createNode(
        SyntaxKind.StructInitializerList,
        ctx,
        b.asArray(ctx.structInitializer()).map((initializer) => buildStructInitializer(b, initializer))
    );
}

export function buildStructInitializer(b: SyntaxBuilder, ctx: StructInitializerContext): SyntaxNode {
    return b.createNode(
        SyntaxKind.StructInitializer,
        ctx,
        [
            b.buildIdentifierNode(ctx.Identifier()),
            b.buildExpression(ctx.expression())
        ],
        {
            name: ctx.Identifier().text
        }
    );
}

export function buildStringConcatenation(b: SyntaxBuilder, ctx: StringConcatenationContext): SyntaxNode {
    const items = b.asArray(ctx.stringConcat().concatItem()).map((item) => buildConcatItem(b, item));
    if (items.length === 1) {
        return items[0];
    }

    return b.buildLeftAssociativeBinaryChain(ctx, items, [], 'concat');
}

export function buildConcatItem(b: SyntaxBuilder, ctx: ConcatItemContext): SyntaxNode {
    if (ctx.STRING_LITERAL()) {
        return b.createNode(SyntaxKind.Literal, ctx, [], {
            metadata: { text: ctx.STRING_LITERAL()!.text }
        });
    }

    if (ctx.Identifier() && !ctx.LPAREN()) {
        return b.buildIdentifierNode(ctx.Identifier()!);
    }

    if (ctx.Identifier()) {
        const children: SyntaxNode[] = [b.buildIdentifierNode(ctx.Identifier()!)];
        const argumentList = buildArgumentList(b, ctx.argumentList());

        if (argumentList) {
            children.push(argumentList);
        }

        return b.createNode(SyntaxKind.CallExpression, ctx, children, {
            name: ctx.Identifier()!.text
        });
    }

    return b.createOpaqueNode(ctx, [], { reason: 'concat-item', text: b.getNodeText(ctx) });
}

export function buildArgumentList(b: SyntaxBuilder, ctx: ArgumentListContext | undefined): SyntaxNode | undefined {
    if (!ctx) {
        return undefined;
    }

    return b.createNode(
        SyntaxKind.ArgumentList,
        ctx,
        b.asArray(ctx.assignmentExpression()).map((expression) => b.buildAssignmentExpression(expression)),
        {
            metadata: {
                hasTrailingComma: b.asArray(ctx.COMMA?.()).length >= b.asArray(ctx.assignmentExpression()).length
            }
        }
    );
}

export function buildExpressionList(b: SyntaxBuilder, ctx: ExpressionListContext): SyntaxNode {
    return b.createNode(
        SyntaxKind.ExpressionList,
        ctx,
        b.asArray(ctx.spreadElement()).map((element) => buildSpreadElement(b, element))
    );
}

export function buildSpreadElement(b: SyntaxBuilder, ctx: SpreadElementContext): SyntaxNode {
    const expression = b.buildAssignmentExpression(ctx.assignmentExpression());
    if (!ctx.ELLIPSIS()) {
        return expression;
    }

    return b.createNode(SyntaxKind.SpreadElement, ctx, [expression]);
}

export function buildSliceExpression(b: SyntaxBuilder, ctx: ParserRuleContext): SyntaxNode {
    const expressions = typeof (ctx as any).expression === 'function'
        ? b.asArray((ctx as any).expression()).map((expression) => b.buildExpression(expression))
        : [];
    const hasRange = typeof (ctx as any).RANGE_OP === 'function' && Boolean((ctx as any).RANGE_OP());

    if (!hasRange && expressions.length === 1) {
        return expressions[0];
    }

    return b.createNode(SyntaxKind.ExpressionList, ctx, expressions, {
        metadata: {
            source: 'slice',
            hasRange,
            hasTailQualifier: typeof (ctx as any).LT === 'function' && Boolean((ctx as any).LT())
        }
    });
}
