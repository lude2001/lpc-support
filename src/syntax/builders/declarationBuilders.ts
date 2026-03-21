import { ParserRuleContext } from 'antlr4ts/ParserRuleContext';
import { TerminalNode } from 'antlr4ts/tree/TerminalNode';
import {
    CastTypeContext,
    ClassDefContext,
    FunctionDefContext,
    IncludeStatementContext,
    InheritStatementContext,
    ParameterContext,
    ParameterListContext,
    PrototypeStatementContext,
    StructDefContext,
    StructMemberContext,
    TypeSpecContext,
    VariableDeclContext,
    VariableDeclaratorContext
} from '../../antlr/LPCParser';
import { SyntaxKind, SyntaxNode } from '../types';
import type { SyntaxBuilder } from '../SyntaxBuilder';

type TypeLikeContext = TypeSpecContext | CastTypeContext;

export function buildFunctionDeclaration(
    b: SyntaxBuilder,
    ctx: FunctionDefContext | PrototypeStatementContext
): SyntaxNode {
    const children: SyntaxNode[] = [];
    const modifiers = buildModifierList(b, b.asArray(ctx.MODIFIER?.()));
    const typeReference = buildTypeReference(b, ctx.typeSpec());
    const identifier = b.buildIdentifierNode(ctx.Identifier());
    const parameters = buildParameterList(b, ctx.parameterList());
    const body = 'block' in ctx && typeof ctx.block === 'function' ? ctx.block() : undefined;

    if (modifiers) {
        children.push(modifiers);
    }
    if (typeReference) {
        children.push(typeReference);
    }
    children.push(identifier);
    if (parameters) {
        children.push(parameters);
    }
    if (body) {
        children.push(b.buildBlock(body));
    }

    return b.createNode(SyntaxKind.FunctionDeclaration, ctx, children, {
        name: ctx.Identifier().text,
        metadata: {
            hasBody: Boolean(body),
            pointerCount: b.asArray(ctx.STAR?.()).length
        }
    });
}

export function buildPrototypeDeclaration(b: SyntaxBuilder, ctx: PrototypeStatementContext): SyntaxNode {
    return buildFunctionDeclaration(b, ctx);
}

export function buildVariableDeclaration(
    b: SyntaxBuilder,
    ctx: VariableDeclContext,
    rangeContext: ParserRuleContext = ctx
): SyntaxNode {
    const children: SyntaxNode[] = [];
    const modifiers = buildModifierList(b, b.asArray(ctx.MODIFIER?.()));
    const typeReference = buildTypeReference(b, ctx.typeSpec());

    if (modifiers) {
        children.push(modifiers);
    }
    if (typeReference) {
        children.push(typeReference);
    }

    children.push(...b.asArray(ctx.variableDeclarator()).map((declarator) => buildVariableDeclarator(b, declarator)));

    return b.createNode(SyntaxKind.VariableDeclaration, rangeContext, children);
}

export function buildVariableDeclarator(b: SyntaxBuilder, ctx: VariableDeclaratorContext): SyntaxNode {
    const children: SyntaxNode[] = [b.buildIdentifierNode(ctx.Identifier())];
    const initializer = ctx.expression() ? b.buildExpression(ctx.expression()!) : undefined;

    if (initializer) {
        children.push(initializer);
    }

    return b.createNode(SyntaxKind.VariableDeclarator, ctx, children, {
        name: ctx.Identifier().text,
        metadata: {
            pointerCount: b.asArray(ctx.STAR?.()).length,
            hasInitializer: Boolean(initializer)
        }
    });
}

export function buildStructDeclaration(b: SyntaxBuilder, ctx: StructDefContext): SyntaxNode {
    const children = [
        b.buildIdentifierNode(ctx.Identifier()),
        ...buildStructMembers(b, ctx.structMemberList()?.structMember())
    ];

    return b.createNode(SyntaxKind.StructDeclaration, ctx, children, {
        name: ctx.Identifier().text
    });
}

export function buildClassDeclaration(b: SyntaxBuilder, ctx: ClassDefContext): SyntaxNode {
    const children = [
        b.buildIdentifierNode(ctx.Identifier()),
        ...buildStructMembers(b, ctx.structMemberList()?.structMember())
    ];

    return b.createNode(SyntaxKind.ClassDeclaration, ctx, children, {
        name: ctx.Identifier().text
    });
}

export function buildStructMembers(
    b: SyntaxBuilder,
    members: StructMemberContext[] | StructMemberContext | undefined
): SyntaxNode[] {
    return b.asArray(members).map((member) => {
        const children: SyntaxNode[] = [];
        const typeReference = buildTypeReference(b, member.typeSpec());

        if (typeReference) {
            children.push(typeReference);
        }
        children.push(b.buildIdentifierNode(member.Identifier()));

        return b.createNode(SyntaxKind.FieldDeclaration, member, children, {
            name: member.Identifier().text,
            metadata: {
                pointerCount: b.asArray(member.STAR?.()).length
            }
        });
    });
}

export function buildDirectiveNode(
    b: SyntaxBuilder,
    kind: SyntaxKind.InheritDirective | SyntaxKind.IncludeDirective,
    ctx: InheritStatementContext | IncludeStatementContext
): SyntaxNode {
    const expression = ctx.expression() ? b.buildExpression(ctx.expression()!) : undefined;
    return b.createNode(kind, ctx, expression ? [expression] : []);
}

export function buildParameterList(b: SyntaxBuilder, ctx: ParameterListContext | undefined): SyntaxNode | undefined {
    if (!ctx) {
        return undefined;
    }

    return b.createNode(SyntaxKind.ParameterList, ctx, b.asArray(ctx.parameter()).map((parameter) => buildParameter(b, parameter)));
}

export function buildParameter(b: SyntaxBuilder, ctx: ParameterContext): SyntaxNode {
    const children: SyntaxNode[] = [];
    const typeReference = ctx.typeSpec() ? buildTypeReference(b, ctx.typeSpec()!) : undefined;

    if (typeReference) {
        children.push(typeReference);
    }
    if (ctx.Identifier()) {
        children.push(b.buildIdentifierNode(ctx.Identifier()!));
    }

    return b.createNode(SyntaxKind.ParameterDeclaration, ctx, children, {
        name: ctx.Identifier()?.text,
        metadata: {
            isReference: Boolean(ctx.REF?.()),
            isVariadic: Boolean(ctx.ELLIPSIS?.()),
            pointerCount: b.asArray(ctx.STAR?.()).length
        }
    });
}

export function buildModifierList(b: SyntaxBuilder, tokens: TerminalNode[] | TerminalNode): SyntaxNode | undefined {
    const modifierTokens = b.asArray(tokens);
    if (modifierTokens.length === 0) {
        return undefined;
    }

    return b.createNodeFromTokens(
        SyntaxKind.ModifierList,
        modifierTokens[0].symbol,
        modifierTokens[modifierTokens.length - 1].symbol,
        modifierTokens.map((token) => b.buildIdentifierNode(token)),
        {
            metadata: {
                modifiers: modifierTokens.map((token) => token.text)
            }
        }
    );
}

export function buildTypeReference(b: SyntaxBuilder, ctx: TypeLikeContext | undefined): SyntaxNode | undefined {
    if (!ctx) {
        return undefined;
    }

    const identifier = typeof ctx.Identifier === 'function' ? ctx.Identifier() : undefined;
    const children = identifier ? [b.buildIdentifierNode(identifier)] : [];

    return b.createNode(SyntaxKind.TypeReference, ctx, children, {
        name: identifier?.text,
        metadata: {
            text: b.getNodeText(ctx),
            pointerCount: b.countExplicitPointerTokens(ctx)
        }
    });
}
