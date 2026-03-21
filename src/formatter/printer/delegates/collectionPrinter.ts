import { SyntaxKind } from '../../../syntax/types';
import { FormatNode } from '../../model/formatNodes';
import { PrintContext } from '../PrintContext';
import { PrintDelegate, PrinterContext } from '../PrinterContext';
import {
    containsCommentSyntax,
    hasPreservableTrivia,
    normalizeInlineText,
    prefixMultiline
} from '../printerUtils';

export function printMappingLiteral(
    node: FormatNode,
    context: PrintContext,
    ctx: PrinterContext
): string {
    const nestedContext = context.nested();
    const lines = node.children
        .filter((child) => child.syntaxKind === SyntaxKind.MappingEntry)
        .map((child) => printMappingEntryLine(child, nestedContext, ctx));

    return wrapCollection('([', lines, '])', context);
}

export function printMappingEntryLine(
    node: FormatNode,
    context: PrintContext,
    ctx: PrinterContext
): string {
    return ctx.attachPreservableTrivia(node, printMappingEntry(node, context, ctx));
}

export function printMappingEntry(
    node: FormatNode,
    context: PrintContext,
    ctx: PrinterContext
): string {
    const [key, value] = node.children;
    const prefix = `${context.indent()}${key ? ctx.renderExpression(key, context) : ''} : `;
    return prefixMultiline(prefix, ctx.renderStructuredValue(value, context), context.indent());
}

export function printArrayLiteral(
    node: FormatNode,
    context: PrintContext,
    ctx: PrinterContext
): string {
    const nestedContext = context.nested();
    const items = getArrayItems(node);
    const lines = items.map((item) => printArrayItem(item, nestedContext, ctx));

    return wrapCollection('({', lines, '})', context);
}

export function printArrayItem(
    node: FormatNode,
    context: PrintContext,
    ctx: PrinterContext
): string {
    const rendered = ctx.renderStructuredValue(node, context);
    const base = rendered.includes('\n') ? rendered : `${context.indent()}${rendered}`;

    return ctx.attachPreservableTrivia(node, base);
}

export function printNewExpression(
    node: FormatNode,
    context: PrintContext,
    ctx: PrinterContext
): string {
    const nestedContext = context.nested();
    const head = node.children.find((child) => child.syntaxKind !== SyntaxKind.StructInitializerList);
    const initializers = node.children.find((child) => child.syntaxKind === SyntaxKind.StructInitializerList);
    const lines: string[] = [];

    if (head) {
        lines.push(`${nestedContext.indent()}${ctx.renderExpression(head, nestedContext)}`);
    }

    for (const initializer of initializers?.children ?? []) {
        lines.push(printStructInitializer(initializer, nestedContext, ctx));
    }

    return wrapCollection('new(', lines, ')', context);
}

export function printStructInitializer(
    node: FormatNode,
    context: PrintContext,
    ctx: PrinterContext
): string {
    const [identifier, value] = node.children;
    const prefix = `${context.indent()}${identifier?.name ?? normalizeInlineText(identifier?.text ?? '')} : `;
    return prefixMultiline(prefix, ctx.renderStructuredValue(value, context), context.indent());
}

export function tryRenderCompactArrayLiteral(
    node: FormatNode,
    context: PrintContext,
    ctx: PrinterContext
): string | undefined {
    if (node.syntaxKind !== SyntaxKind.ArrayLiteralExpression || !canRenderCompactArrayLiteral(node, context, ctx)) {
        return undefined;
    }

    const items = getArrayItems(node);
    if (items.length === 0) {
        return '({})';
    }

    return `({ ${items.map((item) => ctx.renderInlineExpression(item, context)).join(', ')} })`;
}

export function canRenderCompactArrayLiteral(
    node: FormatNode,
    context: PrintContext,
    ctx: PrinterContext
): boolean {
    if (hasPreservableTrivia(node) || containsCommentSyntax(node.text)) {
        return false;
    }

    return getArrayItems(node).every((item) => canRenderCompactArrayItem(item, context, ctx));
}

export function canRenderCompactArrayItem(
    node: FormatNode,
    context: PrintContext,
    ctx: PrinterContext
): boolean {
    if (hasPreservableTrivia(node) || containsCommentSyntax(node.text)) {
        return false;
    }

    switch (node.syntaxKind) {
    case SyntaxKind.ArrayLiteralExpression:
    case SyntaxKind.MappingLiteralExpression:
    case SyntaxKind.NewExpression:
    case SyntaxKind.AnonymousFunctionExpression:
        return false;
    default:
        return !ctx.renderInlineExpression(node, context).includes('\n');
    }
}

export function getArrayItems(node: FormatNode): readonly FormatNode[] {
    return node.children.find((child) => child.syntaxKind === SyntaxKind.ExpressionList)?.children ?? [];
}

export function wrapCollection(
    opener: string,
    lines: string[],
    closer: string,
    context: PrintContext
): string {
    if (lines.length === 0) {
        return `${context.indent()}${opener}${closer}`;
    }

    return [
        `${context.indent()}${opener}`,
        lines.join(',\n'),
        `${context.indent()}${closer}`
    ].join('\n');
}

export function registerCollectionPrinters(
    delegates: Map<SyntaxKind, PrintDelegate>,
    ctx: PrinterContext
): void {
    delegates.set(SyntaxKind.MappingLiteralExpression, (node, context) => printMappingLiteral(node, context, ctx));
    delegates.set(SyntaxKind.MappingEntry, (node, context) => printMappingEntry(node, context, ctx));
    delegates.set(SyntaxKind.ArrayLiteralExpression, (node, context) => printArrayLiteral(node, context, ctx));
    delegates.set(SyntaxKind.NewExpression, (node, context) => printNewExpression(node, context, ctx));
}
