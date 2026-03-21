import { FormatterConfigSnapshot } from '../types';
import { normalizeLeadingCommentBlock } from '../comments/commentFormatter';
import { FormatNode } from '../model/formatNodes';
import { PrintContext } from './PrintContext';
import { printVariableDeclaration, registerDeclarationPrinters, renderParameterDeclaration } from './delegates/declarationPrinter';
import { PrintDelegate, PrinterContext } from './PrinterContext';
import {
    appendToLastLine,
    classifyBlockSpacingGroup,
    containsCommentSyntax,
    extractPreservableTrivia,
    hasPreservableTrivia,
    indentTrivia,
    normalizeClosureBody,
    normalizeInlineText,
    prefixMultiline,
    repeatPointer,
    shouldPreserveTerminalNewline,
    trimLeadingIndent,
    trimTrailingWhitespace
} from './printerUtils';
import { SyntaxKind } from '../../syntax/types';

export class FormatPrinter implements PrinterContext {
    private readonly delegates = new Map<SyntaxKind, PrintDelegate>();

    constructor(private readonly config: FormatterConfigSnapshot) {
        registerDeclarationPrinters(this.delegates, this);
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
            case SyntaxKind.IfStatement:
                rendered = this.printIfStatement(node, context);
                break;
            case SyntaxKind.WhileStatement:
                rendered = this.printWhileStatement(node, context);
                break;
            case SyntaxKind.DoWhileStatement:
                rendered = this.printDoWhileStatement(node, context);
                break;
            case SyntaxKind.ForStatement:
                rendered = this.printForStatement(node, context);
                break;
            case SyntaxKind.ExpressionStatement:
                rendered = this.printExpressionStatement(node, context);
                break;
            case SyntaxKind.ReturnStatement:
                rendered = this.printReturnStatement(node, context);
                break;
            case SyntaxKind.SwitchStatement:
                rendered = this.printSwitchStatement(node, context);
                break;
            case SyntaxKind.CaseClause:
                rendered = this.printSwitchClause(node, context);
                break;
            case SyntaxKind.DefaultClause:
                rendered = this.printDefaultClause(node, context);
                break;
            case SyntaxKind.ForeachStatement:
                rendered = this.printForeachStatement(node, context);
                break;
            case SyntaxKind.MappingEntry:
                rendered = this.printMappingEntry(node, context);
                break;
            case SyntaxKind.MappingLiteralExpression:
                rendered = this.printMappingLiteral(node, context);
                break;
            case SyntaxKind.ArrayLiteralExpression:
                rendered = this.printArrayLiteral(node, context);
                break;
            case SyntaxKind.NewExpression:
                rendered = this.printNewExpression(node, context);
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

    private printAnonymousFunction(node: FormatNode, context: PrintContext): string {
        const parameters = node.children.find((child) => child.syntaxKind === SyntaxKind.ParameterList);
        const body = node.children.find((child) => child.syntaxKind === SyntaxKind.Block);

        return this.printHeaderWithBlock(`function(${this.printParameterList(parameters)})`, body, context);
    }

    private printIfStatement(node: FormatNode, context: PrintContext): string {
        const [condition, thenStatement, elseStatement] = node.children;
        const parts = [
            `${context.indent()}if (${condition ? this.renderExpression(condition, context) : ''})`,
            this.printAttachedStatement(thenStatement, context)
        ];

        if (elseStatement) {
            if (elseStatement.syntaxKind === SyntaxKind.IfStatement) {
                const renderedElseIf = this.printIfStatement(elseStatement, context);
                const [firstLine, ...restLines] = renderedElseIf.split('\n');
                parts.push(`${context.indent()}else ${firstLine.trimStart()}`);
                parts.push(...restLines);
            } else {
                parts.push(`${context.indent()}else`);
                parts.push(this.printAttachedStatement(elseStatement, context));
            }
        }

        return parts.join('\n');
    }

    private printWhileStatement(node: FormatNode, context: PrintContext): string {
        const [condition, body] = node.children;

        return [
            `${context.indent()}while (${condition ? this.renderExpression(condition, context) : ''})`,
            this.printAttachedStatement(body, context)
        ].join('\n');
    }

    private printDoWhileStatement(node: FormatNode, context: PrintContext): string {
        const [body, condition] = node.children;

        return [
            `${context.indent()}do`,
            this.printAttachedStatement(body, context),
            `${context.indent()}while (${condition ? this.renderExpression(condition, context) : ''});`
        ].join('\n');
    }

    private printForStatement(node: FormatNode, context: PrintContext): string {
        const body = node.children[node.children.length - 1];
        const headerParts = node.children.slice(0, -1);
        let initializer: FormatNode | undefined;
        let condition: FormatNode | undefined;
        let increment: FormatNode | undefined;

        if (headerParts.length === 3) {
            [initializer, condition, increment] = headerParts;
        } else if (headerParts.length === 2) {
            if (this.isForInitializerNode(headerParts[0])) {
                [initializer, condition] = headerParts;
            } else {
                [condition, increment] = headerParts;
            }
        } else if (headerParts.length === 1) {
            if (this.isForInitializerNode(headerParts[0])) {
                [initializer] = headerParts;
            } else {
                [condition] = headerParts;
            }
        }

        const header = [
            this.renderForClause(initializer, context),
            condition ? this.renderExpression(condition, context) : '',
            this.renderForClause(increment, context)
        ];

        return [
            `${context.indent()}for (${header.join('; ')})`,
            this.printAttachedStatement(body, context)
        ].join('\n');
    }

    private printSwitchStatement(node: FormatNode, context: PrintContext): string {
        const [expression, ...clauses] = node.children;
        const nestedContext = context.nested();

        return [
            `${context.indent()}switch (${expression ? this.renderExpression(expression, context) : ''})`,
            `${context.indent()}{`,
            clauses.map((clause) => this.printNode(clause, nestedContext)).join('\n'),
            `${context.indent()}}`
        ].join('\n');
    }

    private printSwitchClause(node: FormatNode, context: PrintContext): string {
        const expressionCount = Number(node.metadata?.expressionCount ?? 0);
        const expressions = node.children.slice(0, expressionCount);
        const statements = node.children.slice(expressionCount);
        const hasRange = Boolean(node.metadata?.hasRange);
        const label = hasRange && expressions.length >= 2
            ? `case ${this.renderExpression(expressions[0], context)}..${this.renderExpression(expressions[1], context)}:`
            : `case ${expressions.map((expression) => this.renderExpression(expression, context)).join(', ')}:`;

        return [
            `${context.indent()}${label}`,
            ...statements.map((statement) => this.printNode(statement, context.nested()))
        ].join('\n');
    }

    private printDefaultClause(node: FormatNode, context: PrintContext): string {
        const statements = node.children;

        return [
            `${context.indent()}default:`,
            ...statements.map((statement) => this.printNode(statement, context.nested()))
        ].join('\n');
    }

    private printForeachStatement(node: FormatNode, context: PrintContext): string {
        const body = node.children[node.children.length - 1];
        const collection = node.children[node.children.length - 2];
        const bindings = node.children.slice(0, -2);
        const header = `${context.indent()}foreach (${bindings.map((binding) => this.renderForeachBinding(binding)).join(', ')} in ${collection ? this.renderExpression(collection, context) : ''})`;

        return [
            header,
            this.printAttachedStatement(body, context)
        ].join('\n');
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

    private printExpressionStatement(node: FormatNode, context: PrintContext): string {
        const expression = node.children[0];
        const rendered = expression ? this.renderInlineExpression(expression, context) : normalizeInlineText(node.text);
        return appendToLastLine(`${context.indent()}${rendered}`, ';');
    }

    private printReturnStatement(node: FormatNode, context: PrintContext): string {
        const expression = node.children[0];
        if (!expression) {
            return `${context.indent()}return;`;
        }

        return appendToLastLine(`${context.indent()}return ${this.renderInlineExpression(expression, context)}`, ';');
    }

    public printParameterList(node: FormatNode | undefined): string {
        if (!node) {
            return '';
        }

        const parameterContext = new PrintContext(this.config.indentSize);
        return node.children.map((child) => renderParameterDeclaration(child, parameterContext, this)).join(', ');
    }

    public renderStructuredValue(node: FormatNode, context: PrintContext): string {
        const compactArray = this.tryRenderCompactArrayLiteral(node, context);
        if (compactArray) {
            return compactArray;
        }

        return this.renderInlineExpression(node, context);
    }

    private tryRenderCompactArrayLiteral(node: FormatNode, context: PrintContext): string | undefined {
        if (node.syntaxKind !== SyntaxKind.ArrayLiteralExpression || !this.canRenderCompactArrayLiteral(node, context)) {
            return undefined;
        }

        const items = this.getArrayItems(node);
        if (items.length === 0) {
            return '({})';
        }

        return `({ ${items.map((item) => this.renderInlineExpression(item, context)).join(', ')} })`;
    }

    private canRenderCompactArrayLiteral(node: FormatNode, context: PrintContext): boolean {
        if (hasPreservableTrivia(node) || containsCommentSyntax(node.text)) {
            return false;
        }

        return this.getArrayItems(node).every((item) => this.canRenderCompactArrayItem(item, context));
    }

    private canRenderCompactArrayItem(node: FormatNode, context: PrintContext): boolean {
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
            return !this.renderInlineExpression(node, context).includes('\n');
        }
    }

    private getArrayItems(node: FormatNode): readonly FormatNode[] {
        return node.children.find((child) => child.syntaxKind === SyntaxKind.ExpressionList)?.children ?? [];
    }

    private printMappingLiteral(node: FormatNode, context: PrintContext): string {
        const nestedContext = context.nested();
        const lines = node.children
            .filter((child) => child.syntaxKind === SyntaxKind.MappingEntry)
            .map((child) => this.printMappingEntryLine(child, nestedContext));

        return this.wrapCollection('([', lines, '])', context);
    }

    private printMappingEntryLine(node: FormatNode, context: PrintContext): string {
        return this.attachPreservableTrivia(node, this.printMappingEntry(node, context));
    }

    private printMappingEntry(node: FormatNode, context: PrintContext): string {
        const [key, value] = node.children;
        const prefix = `${context.indent()}${key ? this.renderExpression(key, context) : ''} : `;
        return prefixMultiline(prefix, this.renderStructuredValue(value, context), context.indent());
    }

    private printArrayLiteral(node: FormatNode, context: PrintContext): string {
        const nestedContext = context.nested();
        const items = this.getArrayItems(node);
        const lines = items.map((item) => this.printArrayItem(item, nestedContext));

        return this.wrapCollection('({', lines, '})', context);
    }

    private printArrayItem(node: FormatNode, context: PrintContext): string {
        const rendered = this.renderStructuredValue(node, context);
        const base = rendered.includes('\n') ? rendered : `${context.indent()}${rendered}`;

        return this.attachPreservableTrivia(node, base);
    }

    private printNewExpression(node: FormatNode, context: PrintContext): string {
        const nestedContext = context.nested();
        const head = node.children.find((child) => child.syntaxKind !== SyntaxKind.StructInitializerList);
        const initializers = node.children.find((child) => child.syntaxKind === SyntaxKind.StructInitializerList);
        const lines: string[] = [];

        if (head) {
            lines.push(`${nestedContext.indent()}${this.renderExpression(head, nestedContext)}`);
        }

        for (const initializer of initializers?.children ?? []) {
            lines.push(this.printStructInitializer(initializer, nestedContext));
        }

        return this.wrapCollection('new(', lines, ')', context);
    }

    private printStructInitializer(node: FormatNode, context: PrintContext): string {
        const [identifier, value] = node.children;
        const prefix = `${context.indent()}${identifier?.name ?? normalizeInlineText(identifier?.text ?? '')} : `;
        return prefixMultiline(prefix, this.renderStructuredValue(value, context), context.indent());
    }

    private printDefaultNode(node: FormatNode, context: PrintContext): string {
        const normalized = normalizeInlineText(node.text);
        if (!normalized || normalized === ';') {
            return '';
        }

        return `${context.indent()}${normalized}`;
    }

    public wrapCollection(opener: string, lines: string[], closer: string, context: PrintContext): string {
        if (lines.length === 0) {
            return `${context.indent()}${opener}${closer}`;
        }

        return [
            `${context.indent()}${opener}`,
            lines.join(',\n'),
            `${context.indent()}${closer}`
        ].join('\n');
    }

    public renderExpression(node: FormatNode, context: PrintContext): string {
        switch (node.syntaxKind) {
            case SyntaxKind.Identifier:
                return this.renderIdentifier(node);
            case SyntaxKind.Literal:
                return this.renderLiteral(node);
            case SyntaxKind.ParenthesizedExpression:
                return `(${node.children[0] ? this.renderExpression(node.children[0], context) : ''})`;
            case SyntaxKind.UnaryExpression:
                return this.renderUnaryExpression(node, context);
            case SyntaxKind.BinaryExpression:
                return this.renderBinaryExpression(node, context);
            case SyntaxKind.AssignmentExpression:
                return this.renderAssignmentExpression(node, context);
            case SyntaxKind.ConditionalExpression:
                return this.renderConditionalExpression(node, context);
            case SyntaxKind.CallExpression:
                return this.printCallExpression(node, context);
            case SyntaxKind.MemberAccessExpression:
                return this.renderMemberAccessExpression(node, context);
            case SyntaxKind.IndexExpression:
                return this.renderIndexExpression(node, context);
            case SyntaxKind.PostfixExpression:
                return this.renderPostfixExpression(node, context);
            case SyntaxKind.AnonymousFunctionExpression:
                return this.printAnonymousFunction(node, context);
            case SyntaxKind.ClosureExpression:
                return this.renderClosureExpression(node, context);
            case SyntaxKind.MappingLiteralExpression:
                return this.printMappingLiteral(node, context);
            case SyntaxKind.ArrayLiteralExpression:
                return this.printArrayLiteral(node, context);
            case SyntaxKind.ArrayDelimiterLiteralExpression:
                return normalizeInlineText(node.text);
            case SyntaxKind.NewExpression:
                return this.printNewExpression(node, context);
            case SyntaxKind.ExpressionList:
                return this.renderExpressionList(node, context);
            case SyntaxKind.SpreadElement:
                return `...${node.children[0] ? this.renderExpression(node.children[0], context) : ''}`;
            case SyntaxKind.OpaqueExpression:
                return normalizeInlineText(node.text);
            default:
                return normalizeInlineText(node.text);
        }
    }

    private renderIdentifier(node: FormatNode): string {
        const scopeQualifier = typeof node.metadata?.scopeQualifier === 'string'
            ? node.metadata.scopeQualifier
            : '';
        const referencePrefix = node.metadata?.isReference ? 'ref ' : '';
        return `${referencePrefix}${scopeQualifier}${node.name ?? normalizeInlineText(node.text)}`;
    }

    private renderLiteral(node: FormatNode): string {
        return typeof node.metadata?.text === 'string' ? node.metadata.text : node.text;
    }

    private renderUnaryExpression(node: FormatNode, context: PrintContext): string {
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

            return `(${normalizeInlineText(typeReference.text)})${this.renderExpression(operand, context)}`;
        }

        return `${operator}${this.renderExpression(operand, context)}`;
    }

    private renderBinaryExpression(node: FormatNode, context: PrintContext): string {
        const [left, right] = node.children;
        const operator = typeof node.metadata?.operator === 'string' ? node.metadata.operator : '';
        if (!left || !right || !operator) {
            return normalizeInlineText(node.text);
        }

        if (operator === 'concat') {
            return `${this.renderExpression(left, context)}${this.renderExpression(right, context)}`;
        }

        if (operator === ',') {
            return `${this.renderExpression(left, context)}, ${this.renderExpression(right, context)}`;
        }

        return `${this.renderExpression(left, context)} ${operator} ${this.renderExpression(right, context)}`;
    }

    private renderAssignmentExpression(node: FormatNode, context: PrintContext): string {
        const [left, right] = node.children;
        const operator = typeof node.metadata?.operator === 'string' ? node.metadata.operator : '=';
        if (!left || !right) {
            return normalizeInlineText(node.text);
        }

        return `${this.renderInlineExpression(left, context)} ${operator} ${this.renderInlineExpression(right, context)}`;
    }

    private renderConditionalExpression(node: FormatNode, context: PrintContext): string {
        const [condition, whenTrue, whenFalse] = node.children;
        if (!condition || !whenTrue || !whenFalse) {
            return normalizeInlineText(node.text);
        }

        return [
            this.renderInlineExpression(condition, context),
            '?',
            this.renderInlineExpression(whenTrue, context),
            ':',
            this.renderInlineExpression(whenFalse, context)
        ].join(' ');
    }

    private printCallExpression(node: FormatNode, context: PrintContext): string {
        const [callee, argumentList] = node.children;
        const renderedCallee = callee ? this.renderExpression(callee, context) : '';
        if (!argumentList || argumentList.syntaxKind !== SyntaxKind.ArgumentList) {
            return `${renderedCallee}()`;
        }

        const renderedArguments = argumentList.children.map((child) => (
            trimLeadingIndent(this.renderExpression(child, context), context.indent())
        ));

        return `${renderedCallee}(${renderedArguments.join(', ')})`;
    }

    private renderMemberAccessExpression(node: FormatNode, context: PrintContext): string {
        const [target, member] = node.children;
        const operator = typeof node.metadata?.operator === 'string' ? node.metadata.operator : '.';
        if (!target || !member) {
            return normalizeInlineText(node.text);
        }

        return `${this.renderExpression(target, context)}${operator}${this.renderExpression(member, context)}`;
    }

    private renderIndexExpression(node: FormatNode, context: PrintContext): string {
        const [target, index] = node.children;
        if (!target || !index) {
            return normalizeInlineText(node.text);
        }

        return `${this.renderExpression(target, context)}[${this.renderExpression(index, context)}]`;
    }

    private renderPostfixExpression(node: FormatNode, context: PrintContext): string {
        const operator = typeof node.metadata?.operator === 'string' ? node.metadata.operator : '';
        const operand = node.children[0];
        if (!operand || !operator) {
            return normalizeInlineText(node.text);
        }

        return `${this.renderExpression(operand, context)}${operator}`;
    }

    private renderClosureExpression(node: FormatNode, context: PrintContext): string {
        if (node.children[0]) {
            return `(: ${normalizeClosureBody(this.renderInlineExpression(node.children[0], context))} :)`;
        }

        const identifier = typeof node.metadata?.identifier === 'string' ? node.metadata.identifier : '';
        if (identifier) {
            return `(: ${identifier} :)`;
        }

        return normalizeInlineText(node.text);
    }

    private renderExpressionList(node: FormatNode, context: PrintContext): string {
        const hasRange = Boolean(node.metadata?.hasRange);
        const rangeOperator = Boolean(node.metadata?.hasTailQualifier) ? '..<' : '..';
        if (!hasRange) {
            return node.children.map((child) => this.renderExpression(child, context)).join(', ');
        }

        const [start, end] = node.children;
        if (start && end) {
            return `${this.renderExpression(start, context)}${rangeOperator}${this.renderExpression(end, context)}`;
        }
        if (start) {
            return `${this.renderExpression(start, context)}${rangeOperator}`;
        }
        if (end) {
            return `${rangeOperator}${this.renderExpression(end, context)}`;
        }

        return rangeOperator;
    }

    private renderForeachBinding(node: FormatNode): string {
        const typeReference = node.children.find((child) => child.syntaxKind === SyntaxKind.TypeReference);
        const identifier = node.children.find((child) => child.syntaxKind === SyntaxKind.Identifier);
        const prefix = node.metadata?.isReference ? 'ref ' : '';
        const pointerPrefix = repeatPointer(Number(node.metadata?.pointerCount ?? 0));
        return [
            `${prefix}${typeReference ? normalizeInlineText(typeReference.text) : ''}`.trim(),
            identifier ? `${pointerPrefix}${this.renderIdentifier(identifier)}` : ''
        ].filter(Boolean).join(' ');
    }

    public renderInlineExpression(node: FormatNode, context: PrintContext): string {
        return trimLeadingIndent(this.renderExpression(node, context), context.indent());
    }

    private isForInitializerNode(node: FormatNode): boolean {
        return node.syntaxKind === SyntaxKind.VariableDeclaration || node.syntaxKind === SyntaxKind.ExpressionList;
    }

    private renderForClause(node: FormatNode | undefined, context: PrintContext): string {
        if (!node) {
            return '';
        }

        if (node.syntaxKind === SyntaxKind.VariableDeclaration) {
            const rendered = printVariableDeclaration(node, context, this);
            return rendered.startsWith(context.indent())
                ? rendered.slice(context.indent().length, -1)
                : rendered.slice(0, -1);
        }

        return this.renderExpression(node, context);
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
