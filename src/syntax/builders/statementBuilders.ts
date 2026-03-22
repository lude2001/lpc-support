import { ParserRuleContext } from 'antlr4ts/ParserRuleContext';
import {
    BlockContext,
    ContinueStatementContext,
    DoWhileStatementContext,
    ExprStatementContext,
    ForStatementContext,
    ForeachStatementContext,
    ForeachVarContext,
    IfStatementContext,
    ReturnStatementContext,
    StatementContext,
    SwitchLabelWithColonContext,
    SwitchSectionContext,
    SwitchStatementContext,
    WhileStatementContext
} from '../../antlr/LPCParser';
import { SyntaxKind, SyntaxNode } from '../types';
import type { SyntaxBuilder } from '../SyntaxBuilder';

export function buildStatement(b: SyntaxBuilder, ctx: StatementContext): SyntaxNode {
    if (ctx.functionDef()) {
        return b.buildFunctionDeclaration(ctx.functionDef()!);
    }

    if (ctx.variableDecl()) {
        return b.buildVariableDeclaration(ctx.variableDecl()!, ctx);
    }

    if (ctx.structDef()) {
        return b.buildStructDeclaration(ctx.structDef()!);
    }

    if (ctx.classDef()) {
        return b.buildClassDeclaration(ctx.classDef()!);
    }

    if (ctx.inheritStatement()) {
        return b.buildDirectiveNode(SyntaxKind.InheritDirective, ctx.inheritStatement()!);
    }

    if (ctx.includeStatement()) {
        return b.buildDirectiveNode(SyntaxKind.IncludeDirective, ctx.includeStatement()!);
    }

    if (ctx.ifStatement()) {
        return b.buildIfStatement(ctx.ifStatement()!);
    }

    if (ctx.whileStatement()) {
        return b.buildLoopStatement(SyntaxKind.WhileStatement, ctx.whileStatement()!);
    }

    if (ctx.doWhileStatement()) {
        return b.buildDoWhileStatement(ctx.doWhileStatement()!);
    }

    if (ctx.forStatement()) {
        return b.buildForStatement(ctx.forStatement()!);
    }

    if (ctx.foreachStatement()) {
        return b.buildForeachStatement(ctx.foreachStatement()!);
    }

    if (ctx.switchStatement()) {
        return b.buildSwitchStatement(ctx.switchStatement()!);
    }

    if (ctx.breakStatement()) {
        return b.buildLeafNode(SyntaxKind.BreakStatement, ctx.breakStatement()!);
    }

    if (ctx.continueStatement()) {
        return b.buildLeafNode(SyntaxKind.ContinueStatement, ctx.continueStatement()!);
    }

    if (ctx.returnStatement()) {
        return b.buildReturnStatement(ctx.returnStatement()!);
    }

    if (ctx.block()) {
        return b.buildBlock(ctx.block()!);
    }

    if (ctx.exprStatement()) {
        return b.buildExpressionStatement(ctx.exprStatement()!);
    }

    if (ctx.prototypeStatement()) {
        return b.buildPrototypeDeclaration(ctx.prototypeStatement()!);
    }

    if (ctx.macroInvoke()) {
        const expression = b.buildMacroInvokeExpression(ctx.macroInvoke()!);
        return b.createNode(SyntaxKind.ExpressionStatement, ctx, [expression], {
            metadata: { source: 'macro-invoke' }
        });
    }

    return b.createMissingNode(ctx);
}

export function buildBlock(b: SyntaxBuilder, ctx: BlockContext): SyntaxNode {
    const children = b.collectNodes(b.asArray(ctx.statement()).map((statement) => b.buildStatement(statement)));
    return b.createNode(SyntaxKind.Block, ctx, children);
}

export function buildExpressionStatement(b: SyntaxBuilder, ctx: ExprStatementContext): SyntaxNode {
    const children = ctx.expression() ? [b.buildExpression(ctx.expression()!)] : [];
    return b.createNode(SyntaxKind.ExpressionStatement, ctx, children);
}

export function buildIfStatement(b: SyntaxBuilder, ctx: IfStatementContext): SyntaxNode {
    const children: SyntaxNode[] = [b.buildExpression(ctx.expression())];
    const statements = b.asArray(ctx.statement());

    if (statements[0]) {
        children.push(b.buildStatement(statements[0]));
    }
    if (statements[1]) {
        children.push(b.buildStatement(statements[1]));
    }

    return b.createNode(SyntaxKind.IfStatement, ctx, children, {
        metadata: { hasElse: statements.length > 1 }
    });
}

export function buildLoopStatement(
    b: SyntaxBuilder,
    kind: SyntaxKind.WhileStatement,
    ctx: WhileStatementContext
): SyntaxNode {
    return b.createNode(kind, ctx, [b.buildExpression(ctx.expression()), b.buildStatement(ctx.statement())]);
}

export function buildDoWhileStatement(b: SyntaxBuilder, ctx: DoWhileStatementContext): SyntaxNode {
    return b.createNode(SyntaxKind.DoWhileStatement, ctx, [b.buildStatement(ctx.statement()), b.buildExpression(ctx.expression())]);
}

export function buildForStatement(b: SyntaxBuilder, ctx: ForStatementContext): SyntaxNode {
    const children: SyntaxNode[] = [];
    const forInit = ctx.forInit();

    if (forInit?.variableDecl()) {
        children.push(b.buildVariableDeclaration(forInit.variableDecl()!));
    } else if (forInit?.expressionList()) {
        children.push(b.buildExpressionList(forInit.expressionList()!));
    }

    if (ctx.expression()) {
        children.push(b.buildExpression(ctx.expression()!));
    }

    if (ctx.expressionList()) {
        children.push(b.buildExpressionList(ctx.expressionList()!));
    }

    children.push(b.buildStatement(ctx.statement()));
    return b.createNode(SyntaxKind.ForStatement, ctx, children);
}

export function buildForeachStatement(b: SyntaxBuilder, ctx: ForeachStatementContext): SyntaxNode {
    const children = [
        ...b.collectNodes(b.asArray(ctx.foreachInit().foreachVar()).map((foreachVar) => b.buildForeachBinding(foreachVar))),
        b.buildExpression(ctx.expression()),
        b.buildStatement(ctx.statement())
    ];

    return b.createNode(SyntaxKind.ForeachStatement, ctx, children);
}

export function buildForeachBinding(b: SyntaxBuilder, ctx: ForeachVarContext): SyntaxNode {
    const children: SyntaxNode[] = [];
    const typeReference = ctx.typeSpec() ? b.buildTypeReference(ctx.typeSpec()!) : undefined;

    if (typeReference) {
        children.push(typeReference);
    }
    children.push(b.buildIdentifierNode(ctx.Identifier()));

    return b.createNode(SyntaxKind.VariableDeclarator, ctx, children, {
        name: ctx.Identifier().text,
        metadata: {
            pointerCount: b.asArray(ctx.STAR?.()).length,
            isReference: Boolean(ctx.REF?.())
        }
    });
}

export function buildSwitchStatement(b: SyntaxBuilder, ctx: SwitchStatementContext): SyntaxNode {
    const children: SyntaxNode[] = [b.buildExpression(ctx.expression())];

    for (const section of b.asArray(ctx.switchSection())) {
        children.push(...b.buildSwitchSection(section));
    }

    return b.createNode(SyntaxKind.SwitchStatement, ctx, children);
}

export function buildSwitchSection(b: SyntaxBuilder, ctx: SwitchSectionContext): SyntaxNode[] {
    const clauses: SyntaxNode[] = [];
    let currentLabel: SwitchLabelWithColonContext | undefined;
    let currentStatements: SyntaxNode[] = [];

    for (const child of b.getChildren(ctx)) {
        if (child instanceof SwitchLabelWithColonContext) {
            if (currentLabel) {
                clauses.push(b.buildSwitchClause(currentLabel, currentStatements));
            }

            currentLabel = child;
            currentStatements = [];
            continue;
        }

        if (child instanceof StatementContext) {
            currentStatements.push(b.buildStatement(child));
        }
    }

    if (currentLabel) {
        clauses.push(b.buildSwitchClause(currentLabel, currentStatements));
    }

    return clauses;
}

export function buildSwitchClause(
    b: SyntaxBuilder,
    ctx: SwitchLabelWithColonContext,
    statements: SyntaxNode[]
): SyntaxNode {
    const label = ctx.switchLabel();
    const labelChildren = label ? b.asArray(label.expression()).map((expression) => b.buildExpression(expression)) : [];

    return b.createNode(ctx.DEFAULT() ? SyntaxKind.DefaultClause : SyntaxKind.CaseClause, ctx, [...labelChildren, ...statements], {
        metadata: {
            hasRange: Boolean(label?.RANGE_OP()),
            expressionCount: labelChildren.length
        }
    });
}

export function buildReturnStatement(b: SyntaxBuilder, ctx: ReturnStatementContext): SyntaxNode {
    const children = ctx.expression() ? [b.buildExpression(ctx.expression()!)] : [];
    return b.createNode(SyntaxKind.ReturnStatement, ctx, children);
}

export function buildLeafNode(
    b: SyntaxBuilder,
    kind: SyntaxKind.BreakStatement | SyntaxKind.ContinueStatement,
    ctx: ContinueStatementContext | ParserRuleContext
): SyntaxNode {
    return b.createNode(kind, ctx, []);
}
