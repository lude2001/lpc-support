import { FormatNode } from '../model/formatNodes';
import { PrintContext } from './PrintContext';

export type PrintDelegate = (node: FormatNode, context: PrintContext) => string;

export interface PrinterContext {
    printNode(node: FormatNode, context: PrintContext): string;
    renderExpression(node: FormatNode, context: PrintContext): string;
    renderInlineExpression(node: FormatNode, context: PrintContext): string;
    renderStructuredValue(node: FormatNode, context: PrintContext): string;
    printAttachedStatement(node: FormatNode | undefined, context: PrintContext): string;
    printBlock(node: FormatNode, context: PrintContext): string;
    printParameterList(node: FormatNode | undefined): string;
    printHeaderWithBlock(header: string, body: FormatNode | undefined, context: PrintContext): string;
    attachPreservableTrivia(node: FormatNode, rendered: string): string;
    wrapCollection(opener: string, lines: string[], closer: string, context: PrintContext): string;
}
