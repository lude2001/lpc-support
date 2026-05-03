import { SyntaxKind } from '../../../syntax/types';
import { FormatNode } from '../../model/formatNodes';
import { PrintContext } from '../PrintContext';
import { PrintDelegate, PrinterContext } from '../PrinterContext';
import {
    appendToLastLine,
    normalizeInlineText,
    repeatPointer
} from '../printerUtils';

export function printFunctionDeclaration(
    node: FormatNode,
    context: PrintContext,
    ctx: PrinterContext
): string {
    const body = node.children.find((child) => child.syntaxKind === SyntaxKind.Block);
    const modifier = node.children.find((child) => child.syntaxKind === SyntaxKind.ModifierList);
    const typeReference = node.children.find((child) => child.syntaxKind === SyntaxKind.TypeReference);
    const identifier = node.children.find((child) => child.syntaxKind === SyntaxKind.Identifier);
    const parameters = node.children.find((child) => child.syntaxKind === SyntaxKind.ParameterList);
    const pointerPrefix = repeatPointer(Number(node.metadata?.pointerCount ?? 0));
    const renderedIdentifier = `${pointerPrefix}${identifier?.name ?? normalizeInlineText(identifier?.text ?? '')}`;

    const header = [
        modifier ? normalizeInlineText(modifier.text) : '',
        typeReference ? normalizeInlineText(typeReference.text) : '',
        renderedIdentifier
    ].filter(Boolean).join(' ');

    const declaration = `${context.indent()}${header}(${ctx.printParameterList(parameters)})`;
    if (!body) {
        return `${declaration};`;
    }

    return ctx.printHeaderWithBlock(declaration, body, context);
}

export function printVariableDeclaration(
    node: FormatNode,
    context: PrintContext,
    ctx: PrinterContext
): string {
    const modifier = node.children.find((child) => child.syntaxKind === SyntaxKind.ModifierList);
    const typeReference = node.children.find((child) => child.syntaxKind === SyntaxKind.TypeReference);
    const declarators = node.children.filter((child) => child.syntaxKind === SyntaxKind.VariableDeclarator);

    const prefix = [
        modifier ? normalizeInlineText(modifier.text) : '',
        typeReference ? normalizeInlineText(typeReference.text) : ''
    ].filter(Boolean).join(' ');

    const renderedDeclarators = declarators.map((child) => printVariableDeclarator(child, context, ctx));
    const statement = `${context.indent()}${[prefix, renderedDeclarators.join(', ')].filter(Boolean).join(' ')}`;

    return appendToLastLine(statement, ';');
}

export function printVariableDeclarator(
    node: FormatNode,
    context: PrintContext,
    ctx: PrinterContext
): string {
    const identifier = node.children.find((child) => child.syntaxKind === SyntaxKind.Identifier);
    const initializer = node.children.find((child) => child.syntaxKind !== SyntaxKind.Identifier);
    const pointerPrefix = repeatPointer(Number(node.metadata?.pointerCount ?? 0));
    const name = `${pointerPrefix}${identifier?.name ?? normalizeInlineText(identifier?.text ?? node.text)}`;

    if (!initializer) {
        return name;
    }

    return `${name} = ${ctx.renderStructuredValue(initializer, context)}`;
}

export function printStructLike(
    node: FormatNode,
    context: PrintContext,
    ctx: PrinterContext,
    keyword: 'struct' | 'class'
): string {
    const identifier = node.children.find((child) => child.syntaxKind === SyntaxKind.Identifier);
    const fields = node.children.filter((child) => child.syntaxKind === SyntaxKind.FieldDeclaration);
    const nestedContext = context.nested();
    const lines = fields.map((field) => printFieldDeclaration(field, nestedContext, ctx));

    return [
        `${context.indent()}${keyword} ${identifier?.name ?? normalizeInlineText(identifier?.text ?? '')}`,
        `${context.indent()}{`,
        lines.join('\n'),
        `${context.indent()}}`
    ].join('\n');
}

export function printFieldDeclaration(
    node: FormatNode,
    context: PrintContext,
    _ctx: PrinterContext
): string {
    const typeReference = node.children.find((child) => child.syntaxKind === SyntaxKind.TypeReference);
    const identifier = node.children.find((child) => child.syntaxKind === SyntaxKind.Identifier);
    const pointerPrefix = repeatPointer(Number(node.metadata?.pointerCount ?? 0));
    const fieldText = [
        typeReference ? normalizeInlineText(typeReference.text) : '',
        `${pointerPrefix}${identifier?.name ?? normalizeInlineText(identifier?.text ?? '')}`
    ].filter(Boolean).join(' ');

    return `${context.indent()}${fieldText};`;
}

export function renderParameterDeclaration(
    node: FormatNode,
    context: PrintContext,
    ctx: PrinterContext
): string {
    if (node.syntaxKind !== SyntaxKind.ParameterDeclaration) {
        return normalizeInlineText(node.text);
    }

    const typeReference = node.children.find((child) => child.syntaxKind === SyntaxKind.TypeReference);
    const identifier = node.children.find((child) => child.syntaxKind === SyntaxKind.Identifier);
    const defaultValue = node.children.find((child) => child.syntaxKind === SyntaxKind.ClosureExpression);
    const isReference = Boolean(node.metadata?.isReference);
    const isVariadic = Boolean(node.metadata?.isVariadic);
    const pointerPrefix = repeatPointer(Number(node.metadata?.pointerCount ?? 0));
    const typeText = typeReference ? normalizeInlineText(typeReference.text) : '';
    const name = identifier ? `${pointerPrefix}${ctx.renderExpression(identifier, context)}` : '';
    const prefix = isReference ? 'ref ' : '';
    const declaration = [
        `${prefix}${typeText}`.trim(),
        name,
        isVariadic ? '...' : ''
    ].filter(Boolean).join(' ');

    if (!defaultValue) {
        return declaration;
    }

    return `${declaration} : ${ctx.renderExpression(defaultValue, context)}`;
}

export function registerDeclarationPrinters(
    delegates: Map<SyntaxKind, PrintDelegate>,
    ctx: PrinterContext
): void {
    delegates.set(SyntaxKind.FunctionDeclaration, (node, context) => printFunctionDeclaration(node, context, ctx));
    delegates.set(SyntaxKind.VariableDeclaration, (node, context) => printVariableDeclaration(node, context, ctx));
    delegates.set(SyntaxKind.StructDeclaration, (node, context) => printStructLike(node, context, ctx, 'struct'));
    delegates.set(SyntaxKind.ClassDeclaration, (node, context) => printStructLike(node, context, ctx, 'class'));
    delegates.set(SyntaxKind.FieldDeclaration, (node, context) => printFieldDeclaration(node, context, ctx));
}
