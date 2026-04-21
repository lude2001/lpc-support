import { SyntaxKind } from '../../../syntax/types';
import { FormatNode } from '../../model/formatNodes';
import { PrintContext } from '../PrintContext';
import { PrintDelegate, PrinterContext } from '../PrinterContext';
import {
    appendToLastLine,
    normalizeInlineText,
    repeatPointer
} from '../printerUtils';
import { printVariableDeclaration } from './declarationPrinter';

export function printIfStatement(
    node: FormatNode,
    context: PrintContext,
    ctx: PrinterContext
): string {
    const [condition, thenStatement, elseStatement] = node.children;
    const parts = [
        `${context.indent()}if (${condition ? ctx.renderExpression(condition, context) : ''})`,
        ctx.printAttachedStatement(thenStatement, context)
    ];

    if (elseStatement) {
        if (elseStatement.syntaxKind === SyntaxKind.IfStatement) {
            const renderedElseIf = printIfStatement(elseStatement, context, ctx);
            const [firstLine, ...restLines] = renderedElseIf.split('\n');
            parts.push(`${context.indent()}else ${firstLine.trimStart()}`);
            parts.push(...restLines);
        } else {
            parts.push(`${context.indent()}else`);
            parts.push(ctx.printAttachedStatement(elseStatement, context));
        }
    }

    return parts.join('\n');
}

export function printWhileStatement(
    node: FormatNode,
    context: PrintContext,
    ctx: PrinterContext
): string {
    const [condition, body] = node.children;

    return [
        `${context.indent()}while (${condition ? ctx.renderExpression(condition, context) : ''})`,
        ctx.printAttachedStatement(body, context)
    ].join('\n');
}

export function printDoWhileStatement(
    node: FormatNode,
    context: PrintContext,
    ctx: PrinterContext
): string {
    const [body, condition] = node.children;

    return [
        `${context.indent()}do`,
        ctx.printAttachedStatement(body, context),
        `${context.indent()}while (${condition ? ctx.renderExpression(condition, context) : ''});`
    ].join('\n');
}

export function printForStatement(
    node: FormatNode,
    context: PrintContext,
    ctx: PrinterContext
): string {
    const body = node.children[node.children.length - 1];
    const headerParts = node.children.slice(0, -1);
    let initializer: FormatNode | undefined;
    let condition: FormatNode | undefined;
    let increment: FormatNode | undefined;

    if (headerParts.length === 3) {
        [initializer, condition, increment] = headerParts;
    } else if (headerParts.length === 2) {
        if (isForInitializerNode(headerParts[0])) {
            [initializer, condition] = headerParts;
        } else {
            [condition, increment] = headerParts;
        }
    } else if (headerParts.length === 1) {
        if (isForInitializerNode(headerParts[0])) {
            [initializer] = headerParts;
        } else {
            [condition] = headerParts;
        }
    }

    const header = [
        renderForClause(initializer, context, ctx),
        condition ? ctx.renderExpression(condition, context) : '',
        renderForClause(increment, context, ctx)
    ];

    return [
        `${context.indent()}for (${header.join('; ')})`,
        ctx.printAttachedStatement(body, context)
    ].join('\n');
}

export function printForeachStatement(
    node: FormatNode,
    context: PrintContext,
    ctx: PrinterContext
): string {
    const body = node.children[node.children.length - 1];
    const collection = node.children[node.children.length - 2];
    const bindings = node.children.slice(0, -2);
    const header = `${context.indent()}foreach (${bindings.map((binding) => renderForeachBinding(binding, context, ctx)).join(', ')} in ${collection ? ctx.renderExpression(collection, context) : ''})`;

    return [
        header,
        ctx.printAttachedStatement(body, context)
    ].join('\n');
}

export function printSwitchStatement(
    node: FormatNode,
    context: PrintContext,
    ctx: PrinterContext
): string {
    const [expression, ...clauses] = node.children;
    const nestedContext = context.nested();

    return [
        `${context.indent()}switch (${expression ? ctx.renderExpression(expression, context) : ''})`,
        `${context.indent()}{`,
        clauses.map((clause) => ctx.printNode(clause, nestedContext)).join('\n'),
        `${context.indent()}}`
    ].join('\n');
}

export function printSwitchClause(
    node: FormatNode,
    context: PrintContext,
    ctx: PrinterContext
): string {
    const expressionCount = Number(node.metadata?.expressionCount ?? 0);
    const expressions = node.children.slice(0, expressionCount);
    const statements = node.children.slice(expressionCount);
    const hasRange = Boolean(node.metadata?.hasRange);
    const label = hasRange && expressions.length >= 2
        ? `case ${ctx.renderExpression(expressions[0], context)}..${ctx.renderExpression(expressions[1], context)}:`
        : `case ${expressions.map((expression) => ctx.renderExpression(expression, context)).join(', ')}:`;

    return [
        `${context.indent()}${label}`,
        ...statements.map((statement) => ctx.printNode(statement, context.nested()))
    ].join('\n');
}

export function printDefaultClause(
    node: FormatNode,
    context: PrintContext,
    ctx: PrinterContext
): string {
    const statements = node.children;

    return [
        `${context.indent()}default:`,
        ...statements.map((statement) => ctx.printNode(statement, context.nested()))
    ].join('\n');
}

export function printExpressionStatement(
    node: FormatNode,
    context: PrintContext,
    ctx: PrinterContext
): string {
    const expression = node.children[0];
    const rendered = expression ? ctx.renderInlineExpression(expression, context) : normalizeInlineText(node.text);
    return appendToLastLine(`${context.indent()}${rendered}`, ';');
}

export function printEmptyStatement(
    node: FormatNode,
    context: PrintContext
): string {
    return `${context.indent()};`;
}

export function printReturnStatement(
    node: FormatNode,
    context: PrintContext,
    ctx: PrinterContext
): string {
    const expression = node.children[0];
    if (!expression) {
        return `${context.indent()}return;`;
    }

    return appendToLastLine(`${context.indent()}return ${ctx.renderInlineExpression(expression, context)}`, ';');
}

export function renderForClause(
    node: FormatNode | undefined,
    context: PrintContext,
    ctx: PrinterContext
): string {
    if (!node) {
        return '';
    }

    if (node.syntaxKind === SyntaxKind.VariableDeclaration) {
        const rendered = printVariableDeclaration(node, context, ctx);
        return rendered.startsWith(context.indent())
            ? rendered.slice(context.indent().length, -1)
            : rendered.slice(0, -1);
    }

    return ctx.renderExpression(node, context);
}

export function isForInitializerNode(node: FormatNode): boolean {
    return node.syntaxKind === SyntaxKind.VariableDeclaration || node.syntaxKind === SyntaxKind.ExpressionList;
}

export function renderForeachBinding(
    node: FormatNode,
    context: PrintContext,
    ctx: PrinterContext
): string {
    const typeReference = node.children.find((child) => child.syntaxKind === SyntaxKind.TypeReference);
    const identifier = node.children.find((child) => child.syntaxKind === SyntaxKind.Identifier);
    const prefix = node.metadata?.isReference ? 'ref ' : '';
    const pointerPrefix = repeatPointer(Number(node.metadata?.pointerCount ?? 0));
    return [
        `${prefix}${typeReference ? normalizeInlineText(typeReference.text) : ''}`.trim(),
        identifier ? `${pointerPrefix}${ctx.renderExpression(identifier, context)}` : ''
    ].filter(Boolean).join(' ');
}

export function registerStatementPrinters(
    delegates: Map<SyntaxKind, PrintDelegate>,
    ctx: PrinterContext
): void {
    delegates.set(SyntaxKind.IfStatement, (node, context) => printIfStatement(node, context, ctx));
    delegates.set(SyntaxKind.WhileStatement, (node, context) => printWhileStatement(node, context, ctx));
    delegates.set(SyntaxKind.DoWhileStatement, (node, context) => printDoWhileStatement(node, context, ctx));
    delegates.set(SyntaxKind.ForStatement, (node, context) => printForStatement(node, context, ctx));
    delegates.set(SyntaxKind.ForeachStatement, (node, context) => printForeachStatement(node, context, ctx));
    delegates.set(SyntaxKind.SwitchStatement, (node, context) => printSwitchStatement(node, context, ctx));
    delegates.set(SyntaxKind.CaseClause, (node, context) => printSwitchClause(node, context, ctx));
    delegates.set(SyntaxKind.DefaultClause, (node, context) => printDefaultClause(node, context, ctx));
    delegates.set(SyntaxKind.ExpressionStatement, (node, context) => printExpressionStatement(node, context, ctx));
    delegates.set(SyntaxKind.EmptyStatement, (node, context) => printEmptyStatement(node, context));
    delegates.set(SyntaxKind.ReturnStatement, (node, context) => printReturnStatement(node, context, ctx));
}
