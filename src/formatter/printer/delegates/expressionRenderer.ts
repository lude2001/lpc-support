import { SyntaxKind } from '../../../syntax/types';
import { FormatNode } from '../../model/formatNodes';
import { PrintContext } from '../PrintContext';
import { PrinterContext } from '../PrinterContext';
import {
    normalizeClosureBody,
    normalizeInlineText,
    trimLeadingIndent
} from '../printerUtils';
import {
    printArrayLiteral,
    printMappingLiteral,
    printNewExpression
} from './collectionPrinter';

export function renderExpressionDelegate(
    node: FormatNode,
    context: PrintContext,
    ctx: PrinterContext
): string {
    switch (node.syntaxKind) {
    case SyntaxKind.Identifier:
        return renderIdentifier(node);
    case SyntaxKind.Literal:
        return renderLiteral(node);
    case SyntaxKind.ParenthesizedExpression:
        return `(${node.children[0] ? ctx.renderExpression(node.children[0], context) : ''})`;
    case SyntaxKind.UnaryExpression:
        return renderUnaryExpression(node, context, ctx);
    case SyntaxKind.BinaryExpression:
        return renderBinaryExpression(node, context, ctx);
    case SyntaxKind.AssignmentExpression:
        return renderAssignmentExpression(node, context, ctx);
    case SyntaxKind.ConditionalExpression:
        return renderConditionalExpression(node, context, ctx);
    case SyntaxKind.CallExpression:
        return printCallExpression(node, context, ctx);
    case SyntaxKind.MemberAccessExpression:
        return renderMemberAccessExpression(node, context, ctx);
    case SyntaxKind.IndexExpression:
        return renderIndexExpression(node, context, ctx);
    case SyntaxKind.PostfixExpression:
        return renderPostfixExpression(node, context, ctx);
    case SyntaxKind.AnonymousFunctionExpression:
        return printAnonymousFunction(node, context, ctx);
    case SyntaxKind.ClosureExpression:
        return renderClosureExpression(node, context, ctx);
    case SyntaxKind.MappingLiteralExpression:
        return printMappingLiteral(node, context, ctx);
    case SyntaxKind.ArrayLiteralExpression:
        return printArrayLiteral(node, context, ctx);
    case SyntaxKind.ArrayDelimiterLiteralExpression:
        return normalizeInlineText(node.text);
    case SyntaxKind.NewExpression:
        return printNewExpression(node, context, ctx);
    case SyntaxKind.ExpressionList:
        return renderExpressionList(node, context, ctx);
    case SyntaxKind.SpreadElement:
        return `...${node.children[0] ? ctx.renderExpression(node.children[0], context) : ''}`;
    case SyntaxKind.OpaqueExpression:
        return normalizeInlineText(node.text);
    default:
        return normalizeInlineText(node.text);
    }
}

export function renderIdentifier(node: FormatNode): string {
    const scopeQualifier = typeof node.metadata?.scopeQualifier === 'string'
        ? node.metadata.scopeQualifier
        : '';
    const referencePrefix = node.metadata?.isReference ? 'ref ' : '';
    return `${referencePrefix}${scopeQualifier}${node.name ?? normalizeInlineText(node.text)}`;
}

export function renderLiteral(node: FormatNode): string {
    return typeof node.metadata?.text === 'string' ? node.metadata.text : node.text;
}

export function renderUnaryExpression(
    node: FormatNode,
    context: PrintContext,
    ctx: PrinterContext
): string {
    const operator = typeof node.metadata?.operator === 'string' ? node.metadata.operator : '';
    const operand = node.children[node.children.length - 1];
    if (!operand) {
        return normalizeInlineText(node.text);
    }

    if (!operator) {
        return normalizeInlineText(node.text);
    }

    if (operator === 'cast') {
        const typeReference = node.children.find((child) => child.syntaxKind === SyntaxKind.TypeReference);
        if (!typeReference || operand === typeReference) {
            return normalizeInlineText(node.text);
        }

        return `(${normalizeInlineText(typeReference.text)})${ctx.renderExpression(operand, context)}`;
    }

    return `${operator}${ctx.renderExpression(operand, context)}`;
}

export function renderBinaryExpression(
    node: FormatNode,
    context: PrintContext,
    ctx: PrinterContext
): string {
    const [left, right] = node.children;
    const operator = typeof node.metadata?.operator === 'string' ? node.metadata.operator : '';
    if (!left || !right || !operator) {
        return normalizeInlineText(node.text);
    }

    if (operator === 'concat') {
        const renderedLeft = ctx.renderExpression(left, context);
        const renderedRight = ctx.renderExpression(right, context);
        const separator = needsConcatSeparator(renderedLeft, renderedRight) ? ' ' : '';
        return `${renderedLeft}${separator}${renderedRight}`;
    }

    if (operator === ',') {
        return `${ctx.renderExpression(left, context)}, ${ctx.renderExpression(right, context)}`;
    }

    return `${ctx.renderExpression(left, context)} ${operator} ${ctx.renderExpression(right, context)}`;
}

function needsConcatSeparator(left: string, right: string): boolean {
    if (!left || !right) {
        return false;
    }

    return /[A-Za-z0-9_]$/.test(left) && /^[A-Za-z_]/.test(right);
}

export function renderAssignmentExpression(
    node: FormatNode,
    context: PrintContext,
    ctx: PrinterContext
): string {
    const [left, right] = node.children;
    const operator = typeof node.metadata?.operator === 'string' ? node.metadata.operator : '=';
    if (!left || !right) {
        return normalizeInlineText(node.text);
    }

    return `${ctx.renderInlineExpression(left, context)} ${operator} ${ctx.renderInlineExpression(right, context)}`;
}

export function renderConditionalExpression(
    node: FormatNode,
    context: PrintContext,
    ctx: PrinterContext
): string {
    const [condition, whenTrue, whenFalse] = node.children;
    if (!condition || !whenTrue || !whenFalse) {
        return normalizeInlineText(node.text);
    }

    return [
        ctx.renderInlineExpression(condition, context),
        '?',
        ctx.renderInlineExpression(whenTrue, context),
        ':',
        ctx.renderInlineExpression(whenFalse, context)
    ].join(' ');
}

export function printCallExpression(
    node: FormatNode,
    context: PrintContext,
    ctx: PrinterContext
): string {
    const [callee, argumentList] = node.children;
    const renderedCallee = callee ? ctx.renderExpression(callee, context) : '';
    if (!argumentList || argumentList.syntaxKind !== SyntaxKind.ArgumentList) {
        return `${renderedCallee}()`;
    }

    const renderedArguments = argumentList.children.map((child) => (
        trimLeadingIndent(ctx.renderExpression(child, context), context.indent())
    ));

    return `${renderedCallee}(${renderedArguments.join(', ')})`;
}

export function renderMemberAccessExpression(
    node: FormatNode,
    context: PrintContext,
    ctx: PrinterContext
): string {
    const [target, member] = node.children;
    const operator = typeof node.metadata?.operator === 'string' ? node.metadata.operator : '.';
    if (!target || !member) {
        return normalizeInlineText(node.text);
    }

    return `${ctx.renderExpression(target, context)}${operator}${ctx.renderExpression(member, context)}`;
}

export function renderIndexExpression(
    node: FormatNode,
    context: PrintContext,
    ctx: PrinterContext
): string {
    const [target, index] = node.children;
    if (!target || !index) {
        return normalizeInlineText(node.text);
    }

    return `${ctx.renderExpression(target, context)}[${ctx.renderExpression(index, context)}]`;
}

export function renderPostfixExpression(
    node: FormatNode,
    context: PrintContext,
    ctx: PrinterContext
): string {
    const operator = typeof node.metadata?.operator === 'string' ? node.metadata.operator : '';
    const operand = node.children[0];
    if (!operand || !operator) {
        return normalizeInlineText(node.text);
    }

    return `${ctx.renderExpression(operand, context)}${operator}`;
}

export function renderClosureExpression(
    node: FormatNode,
    context: PrintContext,
    ctx: PrinterContext
): string {
    if (node.children[0]) {
        return `(: ${normalizeClosureBody(ctx.renderInlineExpression(node.children[0], context))} :)`;
    }

    const identifier = typeof node.metadata?.identifier === 'string' ? node.metadata.identifier : '';
    if (identifier) {
        return `(: ${identifier} :)`;
    }

    return normalizeInlineText(node.text);
}

export function renderExpressionList(
    node: FormatNode,
    context: PrintContext,
    ctx: PrinterContext
): string {
    const hasRange = Boolean(node.metadata?.hasRange);
    const rangeOperator = Boolean(node.metadata?.hasTailQualifier) ? '..<' : '..';
    if (!hasRange) {
        return node.children.map((child) => ctx.renderExpression(child, context)).join(', ');
    }

    const [start, end] = node.children;
    if (start && end) {
        return `${ctx.renderExpression(start, context)}${rangeOperator}${ctx.renderExpression(end, context)}`;
    }

    if (start) {
        return `${ctx.renderExpression(start, context)}${rangeOperator}`;
    }

    if (end) {
        return `${rangeOperator}${ctx.renderExpression(end, context)}`;
    }

    return rangeOperator;
}

function printAnonymousFunction(
    node: FormatNode,
    context: PrintContext,
    ctx: PrinterContext
): string {
    const parameters = node.children.find((child) => child.syntaxKind === SyntaxKind.ParameterList);
    const body = node.children.find((child) => child.syntaxKind === SyntaxKind.Block);

    return ctx.printHeaderWithBlock(`function(${ctx.printParameterList(parameters)})`, body, context);
}
