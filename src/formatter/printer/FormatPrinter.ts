import { FormatterConfigSnapshot } from '../types';
import { normalizeLeadingCommentBlock } from '../comments/commentFormatter';
import { FormatNode } from '../model/formatNodes';
import { PrintContext } from './PrintContext';
import { registerDeclarationPrinters, renderParameterDeclaration } from './delegates/declarationPrinter';
import {
    registerCollectionPrinters,
    tryRenderCompactArrayLiteral,
    wrapCollection as renderWrappedCollection
} from './delegates/collectionPrinter';
import { renderExpressionDelegate } from './delegates/expressionRenderer';
import { registerStatementPrinters } from './delegates/statementPrinter';
import { PrintDelegate, PrinterContext } from './PrinterContext';
import {
    classifyBlockSpacingGroup,
    extractPreservableTrivia,
    indentTrivia,
    normalizeInlineText,
    shouldPreserveTerminalNewline,
    trimLeadingIndent,
    trimTrailingWhitespace
} from './printerUtils';
import { SyntaxKind } from '../../syntax/types';

export class FormatPrinter implements PrinterContext {
    private readonly delegates = new Map<SyntaxKind, PrintDelegate>();

    constructor(private readonly config: FormatterConfigSnapshot) {
        registerDeclarationPrinters(this.delegates, this);
        registerStatementPrinters(this.delegates, this);
        registerCollectionPrinters(this.delegates, this);
    }

    public print(root: FormatNode): string {
        const rendered = trimTrailingWhitespace(this.printNode(root, new PrintContext(this.config.indentSize))).trim();

        return shouldPreserveTerminalNewline(root.text) ? `${rendered}\n` : rendered;
    }

    public printNode(node: FormatNode, context: PrintContext): string {
        let rendered: string;
        const delegate = this.delegates.get(node.syntaxKind);

        if (delegate) {
            rendered = delegate(node, context);
        } else {
            switch (node.syntaxKind) {
            case SyntaxKind.SourceFile:
                rendered = this.printSourceFile(node, context);
                break;
            case SyntaxKind.Block:
                rendered = this.printBlock(node, context);
                break;
            case SyntaxKind.Missing:
                rendered = '';
                break;
            default:
                rendered = this.printDefaultNode(node, context);
                break;
            }
        }

        if (node.syntaxKind === SyntaxKind.SourceFile) {
            return rendered;
        }

        if (!rendered) {
            return this.renderStandaloneTrivia(node, context);
        }

        return this.attachPreservableTrivia(node, rendered);
    }

    private printSourceFile(node: FormatNode, context: PrintContext): string {
        const parts: string[] = [];
        let previousRenderedNode: FormatNode | undefined;

        for (const child of node.children) {
            const rendered = this.printNode(child, context);
            if (!rendered) {
                continue;
            }

            if (parts.length > 0) {
                parts.push(this.needsBlankLineBetweenTopLevelNodes(previousRenderedNode, child) ? '\n\n' : '\n');
            }

            parts.push(rendered);
            previousRenderedNode = child;
        }

        const renderedBody = parts.join('');
        return !renderedBody
            ? this.attachSourceFileTrivia(node, '')
            : renderedBody;
    }

    public printAttachedStatement(node: FormatNode | undefined, context: PrintContext): string {
        if (!node) {
            return `${context.indent()}{}`;
        }

        if (node.syntaxKind === SyntaxKind.Block) {
            return this.printBlock(node, context);
        }

        return this.printNode(node, context.nested());
    }

    public printBlock(node: FormatNode, context: PrintContext): string {
        const nestedContext = context.nested();
        const parts: string[] = [];
        let previousRenderedNode: FormatNode | undefined;

        for (const child of node.children) {
            const rendered = this.printNode(child, nestedContext);
            if (!rendered) {
                continue;
            }

            if (parts.length > 0) {
                parts.push(this.needsBlankLineBetweenBlockNodes(previousRenderedNode, child) ? '\n\n' : '\n');
            }

            parts.push(rendered);
            previousRenderedNode = child;
        }

        if (parts.length === 0) {
            return `${context.indent()}{\n${context.indent()}}`;
        }

        return [
            `${context.indent()}{`,
            parts.join(''),
            `${context.indent()}}`
        ].join('\n');
    }

    public printHeaderWithBlock(header: string, body: FormatNode | undefined, context: PrintContext): string {
        if (!body) {
            return header;
        }

        return `${header}\n${this.printBlock(body, context)}`;
    }

    public printParameterList(node: FormatNode | undefined): string {
        if (!node) {
            return '';
        }

        const parameterContext = new PrintContext(this.config.indentSize);
        return node.children.map((child) => renderParameterDeclaration(child, parameterContext, this)).join(', ');
    }

    public renderStructuredValue(node: FormatNode, context: PrintContext): string {
        const compactArray = tryRenderCompactArrayLiteral(node, context, this);
        if (compactArray) {
            return compactArray;
        }

        return this.renderInlineExpression(node, context);
    }

    private printDefaultNode(node: FormatNode, context: PrintContext): string {
        const normalized = normalizeInlineText(node.text);
        if (!normalized || normalized === ';') {
            return '';
        }

        return `${context.indent()}${normalized}`;
    }

    public wrapCollection(opener: string, lines: string[], closer: string, context: PrintContext): string {
        return renderWrappedCollection(opener, lines, closer, context);
    }

    public renderExpression(node: FormatNode, context: PrintContext): string {
        return renderExpressionDelegate(node, context, this);
    }

    public renderInlineExpression(node: FormatNode, context: PrintContext): string {
        return trimLeadingIndent(this.renderExpression(node, context), context.indent());
    }

    private needsBlankLineBetweenTopLevelNodes(
        previous: FormatNode | undefined,
        current: FormatNode
    ): boolean {
        if (!previous) {
            return false;
        }

        return !(this.isPrototypeDeclaration(previous) || this.isPrototypeDeclaration(current));
    }

    private isPrototypeDeclaration(node: FormatNode): boolean {
        return node.syntaxKind === SyntaxKind.FunctionDeclaration
            && !node.children.some((child) => child.syntaxKind === SyntaxKind.Block);
    }

    public attachPreservableTrivia(node: FormatNode, rendered: string): string {
        const leadingDirectives = extractPreservableTrivia(node.leadingTrivia);
        let result = rendered;

        if (leadingDirectives.length > 0) {
            const separator = leadingDirectives.some((entry) => entry.startsWith('#')) ? '\n\n' : '\n';
            const indent = rendered.match(/^[ \t]*/)?.[0] ?? '';
            result = result
                ? `${leadingDirectives.map((entry) => indentTrivia(entry, indent)).join('\n')}${separator}${result}`
                : leadingDirectives.map((entry) => indentTrivia(entry, indent)).join('\n');
        }

        return this.attachTrailingTrivia(result, node.trailingTrivia, rendered.match(/^[ \t]*/)?.[0] ?? '');
    }

    private attachSourceFileTrivia(node: FormatNode, rendered: string): string {
        const segments: string[] = [];
        const leading = extractPreservableTrivia(node.leadingTrivia);
        const trailing = extractPreservableTrivia(node.trailingTrivia);

        if (leading.length > 0) {
            segments.push(leading.join('\n'));
        }

        if (rendered) {
            segments.push(rendered);
        }

        if (trailing.length > 0) {
            segments.push(trailing.join('\n'));
        }

        return segments.join('\n\n');
    }

    private renderStandaloneTrivia(node: FormatNode, context: PrintContext): string {
        const entries = [
            ...extractPreservableTrivia(node.leadingTrivia),
            ...extractPreservableTrivia(node.trailingTrivia)
        ];

        if (entries.length === 0) {
            return '';
        }

        return entries
            .map((entry) => indentTrivia(entry, context.indent()))
            .join('\n');
    }

    private attachTrailingTrivia(rendered: string, trailingTrivia: readonly string[], indent: string): string {
        if (!rendered) {
            return rendered;
        }

        let result = rendered;
        let pendingInlineSpace = false;

        for (const entry of trailingTrivia) {
            if (!entry) {
                continue;
            }

            if (/^[ \t]+$/.test(entry)) {
                pendingInlineSpace = true;
                continue;
            }

            if (/^\r?\n$/.test(entry)) {
                break;
            }

            const trimmedEntry = entry.trim();
            if (!trimmedEntry) {
                continue;
            }

            if (!/^(#|\/\/|\/\*)/.test(trimmedEntry)) {
                continue;
            }

            const normalizedEntry = /^\/\*/.test(trimmedEntry)
                ? normalizeLeadingCommentBlock(trimmedEntry)
                : trimmedEntry;

            result = `${result}${pendingInlineSpace ? ' ' : ''}${indentTrivia(normalizedEntry, indent)}`;
            pendingInlineSpace = false;
        }

        return result;
    }

    private needsBlankLineBetweenBlockNodes(
        previous: FormatNode | undefined,
        current: FormatNode
    ): boolean {
        if (!previous) {
            return false;
        }

        const previousGroup = classifyBlockSpacingGroup(previous);
        const currentGroup = classifyBlockSpacingGroup(current);

        if (previousGroup === 'declaration' && currentGroup !== 'declaration') {
            return true;
        }

        if (previousGroup === 'control' && currentGroup === 'control') {
            return previous.syntaxKind !== current.syntaxKind;
        }

        return previousGroup === 'control' || currentGroup === 'control';
    }
}
