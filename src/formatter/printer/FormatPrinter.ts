import { FormatterConfigSnapshot } from '../types';
import { normalizeLeadingCommentBlock } from '../comments/commentFormatter';
import { FormatNode } from '../model/formatNodes';
import { PrintContext } from './PrintContext';
import { SyntaxKind } from '../../syntax/types';

export class FormatPrinter {
    constructor(private readonly config: FormatterConfigSnapshot) {}

    public print(root: FormatNode): string {
        return trimTrailingWhitespace(this.printNode(root, new PrintContext(this.config.indentSize))).trim();
    }

    private printNode(node: FormatNode, context: PrintContext): string {
        const rendered = (() => {
            switch (node.syntaxKind) {
            case SyntaxKind.SourceFile:
                return this.printSourceFile(node, context);
            case SyntaxKind.FunctionDeclaration:
                return this.printFunctionDeclaration(node, context);
            case SyntaxKind.Block:
                return this.printBlock(node, context);
            case SyntaxKind.IfStatement:
                return this.printIfStatement(node, context);
            case SyntaxKind.ExpressionStatement:
                return this.printExpressionStatement(node, context);
            case SyntaxKind.ReturnStatement:
                return this.printReturnStatement(node, context);
            case SyntaxKind.VariableDeclaration:
                return this.printVariableDeclaration(node, context);
            case SyntaxKind.StructDeclaration:
                return this.printStructLike(node, context, 'struct');
            case SyntaxKind.ClassDeclaration:
                return this.printStructLike(node, context, 'class');
            case SyntaxKind.FieldDeclaration:
                return this.printFieldDeclaration(node, context);
            case SyntaxKind.SwitchStatement:
                return this.printSwitchStatement(node, context);
            case SyntaxKind.CaseClause:
                return this.printSwitchClause(node, context);
            case SyntaxKind.DefaultClause:
                return this.printDefaultClause(node, context);
            case SyntaxKind.ForeachStatement:
                return this.printForeachStatement(node, context);
            case SyntaxKind.MappingLiteralExpression:
                return this.printMappingLiteral(node, context);
            case SyntaxKind.ArrayLiteralExpression:
                return this.printArrayLiteral(node, context);
            case SyntaxKind.NewExpression:
                return this.printNewExpression(node, context);
            case SyntaxKind.Missing:
                return '';
            default:
                return this.printDefaultNode(node, context);
            }
        })();

        if (node.syntaxKind === SyntaxKind.SourceFile) {
            return rendered;
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

        return parts.join('');
    }

    private printFunctionDeclaration(node: FormatNode, context: PrintContext): string {
        const body = node.children.find((child) => child.syntaxKind === SyntaxKind.Block);
        const modifier = node.children.find((child) => child.syntaxKind === SyntaxKind.ModifierList);
        const typeReference = node.children.find((child) => child.syntaxKind === SyntaxKind.TypeReference);
        const identifier = node.children.find((child) => child.syntaxKind === SyntaxKind.Identifier);
        const parameters = node.children.find((child) => child.syntaxKind === SyntaxKind.ParameterList);

        const header = [
            modifier ? normalizeInlineText(modifier.text) : '',
            typeReference ? normalizeInlineText(typeReference.text) : '',
            identifier?.name ?? normalizeInlineText(identifier?.text ?? '')
        ].filter(Boolean).join(' ');

        const declaration = `${context.indent()}${header}(${this.printParameterList(parameters)})`;
        if (!body) {
            return `${declaration};`;
        }

        return this.printHeaderWithBlock(declaration, body, context);
    }

    private printVariableDeclaration(node: FormatNode, context: PrintContext): string {
        const modifier = node.children.find((child) => child.syntaxKind === SyntaxKind.ModifierList);
        const typeReference = node.children.find((child) => child.syntaxKind === SyntaxKind.TypeReference);
        const declarators = node.children.filter((child) => child.syntaxKind === SyntaxKind.VariableDeclarator);

        const prefix = [
            modifier ? normalizeInlineText(modifier.text) : '',
            typeReference ? normalizeInlineText(typeReference.text) : ''
        ].filter(Boolean).join(' ');

        const renderedDeclarators = declarators.map((child) => this.printVariableDeclarator(child, context));
        const statement = `${context.indent()}${[prefix, renderedDeclarators.join(', ')].filter(Boolean).join(' ')}`;

        return appendToLastLine(statement, ';');
    }

    private printStructLike(node: FormatNode, context: PrintContext, keyword: 'struct' | 'class'): string {
        const identifier = node.children.find((child) => child.syntaxKind === SyntaxKind.Identifier);
        const fields = node.children.filter((child) => child.syntaxKind === SyntaxKind.FieldDeclaration);
        const nestedContext = context.nested();
        const lines = fields.map((field) => this.printFieldDeclaration(field, nestedContext));

        return [
            `${context.indent()}${keyword} ${identifier?.name ?? normalizeInlineText(identifier?.text ?? '')}`,
            `${context.indent()}{`,
            lines.join('\n'),
            `${context.indent()}}`
        ].join('\n');
    }

    private printFieldDeclaration(node: FormatNode, context: PrintContext): string {
        const typeReference = node.children.find((child) => child.syntaxKind === SyntaxKind.TypeReference);
        const identifier = node.children.find((child) => child.syntaxKind === SyntaxKind.Identifier);
        const fieldText = [
            typeReference ? normalizeInlineText(typeReference.text) : '',
            identifier?.name ?? normalizeInlineText(identifier?.text ?? '')
        ].filter(Boolean).join(' ');

        return `${context.indent()}${fieldText};`;
    }

    private printVariableDeclarator(node: FormatNode, context: PrintContext): string {
        const identifier = node.children.find((child) => child.syntaxKind === SyntaxKind.Identifier);
        const initializer = node.children.find((child) => child.syntaxKind !== SyntaxKind.Identifier);
        const name = identifier?.name ?? normalizeInlineText(identifier?.text ?? node.text);

        if (!initializer) {
            return name;
        }

        return `${name} = ${this.renderStructuredValue(initializer, context)}`;
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
            parts.push(`${context.indent()}else`);
            parts.push(this.printAttachedStatement(elseStatement, context));
        }

        return parts.join('\n');
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
            ? `case ${normalizeInlineText(expressions[0].text)}..${normalizeInlineText(expressions[1].text)}:`
            : `case ${expressions.map((expression) => normalizeInlineText(expression.text)).join(', ')}:`;

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

    private printAttachedStatement(node: FormatNode | undefined, context: PrintContext): string {
        if (!node) {
            return `${context.indent()}{}`;
        }

        if (node.syntaxKind === SyntaxKind.Block) {
            return this.printBlock(node, context);
        }

        return this.printNode(node, context.nested());
    }

    private printBlock(node: FormatNode, context: PrintContext): string {
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

    private printHeaderWithBlock(header: string, body: FormatNode | undefined, context: PrintContext): string {
        if (!body) {
            return header;
        }

        return `${header}\n${this.printBlock(body, context)}`;
    }

    private printExpressionStatement(node: FormatNode, context: PrintContext): string {
        const expression = node.children[0];
        const rendered = expression ? this.renderExpression(expression, context) : normalizeInlineText(node.text);
        return appendToLastLine(`${context.indent()}${rendered}`, ';');
    }

    private printReturnStatement(node: FormatNode, context: PrintContext): string {
        const expression = node.children[0];
        if (!expression) {
            return `${context.indent()}return;`;
        }

        return appendToLastLine(`${context.indent()}return ${this.renderExpression(expression, context)}`, ';');
    }

    private printParameterList(node: FormatNode | undefined): string {
        if (!node) {
            return '';
        }

        return node.children.map((child) => normalizeInlineText(child.text)).join(', ');
    }

    private renderStructuredValue(node: FormatNode, context: PrintContext): string {
        return this.renderExpression(node, context);
    }

    private printMappingLiteral(node: FormatNode, context: PrintContext): string {
        const nestedContext = context.nested();
        const lines = node.children
            .filter((child) => child.syntaxKind === SyntaxKind.MappingEntry)
            .map((child) => this.printMappingEntry(child, nestedContext));

        return this.wrapCollection('([', lines, '])', context);
    }

    private printMappingEntry(node: FormatNode, context: PrintContext): string {
        const [key, value] = node.children;
        const prefix = `${context.indent()}${key ? this.renderExpression(key, context) : ''} : `;
        return prefixMultiline(prefix, this.renderStructuredValue(value, context), context.indent());
    }

    private printArrayLiteral(node: FormatNode, context: PrintContext): string {
        const nestedContext = context.nested();
        const items = node.children.find((child) => child.syntaxKind === SyntaxKind.ExpressionList)?.children ?? [];
        const lines = items.map((item) => {
            const rendered = this.renderStructuredValue(item, nestedContext);
            return rendered.includes('\n') ? rendered : `${nestedContext.indent()}${rendered}`;
        });

        return this.wrapCollection('({', lines, '})', context);
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

    private wrapCollection(opener: string, lines: string[], closer: string, context: PrintContext): string {
        if (lines.length === 0) {
            return `${context.indent()}${opener}${closer}`;
        }

        return [
            `${context.indent()}${opener}`,
            lines.join(',\n'),
            `${context.indent()}${closer}`
        ].join('\n');
    }

    private renderExpression(node: FormatNode, context: PrintContext): string {
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
        const operand = node.children[0];
        if (!operand) {
            return normalizeInlineText(node.text);
        }

        if (!operator || operator === 'cast') {
            return normalizeInlineText(node.text);
        }

        return `${operator}${this.renderExpression(operand, context)}`;
    }

    private renderBinaryExpression(node: FormatNode, context: PrintContext): string {
        const [left, right] = node.children;
        const operator = typeof node.metadata?.operator === 'string' ? node.metadata.operator : '';
        if (!left || !right || !operator || operator === 'concat') {
            return normalizeInlineText(node.text);
        }

        return `${this.renderExpression(left, context)} ${operator} ${this.renderExpression(right, context)}`;
    }

    private renderAssignmentExpression(node: FormatNode, context: PrintContext): string {
        const [left, right] = node.children;
        const operator = typeof node.metadata?.operator === 'string' ? node.metadata.operator : '=';
        if (!left || !right) {
            return normalizeInlineText(node.text);
        }

        return `${this.renderExpression(left, context)} ${operator} ${this.renderExpression(right, context)}`;
    }

    private renderConditionalExpression(node: FormatNode, context: PrintContext): string {
        const [condition, whenTrue, whenFalse] = node.children;
        if (!condition || !whenTrue || !whenFalse) {
            return normalizeInlineText(node.text);
        }

        return [
            this.renderExpression(condition, context),
            '?',
            this.renderExpression(whenTrue, context),
            ':',
            this.renderExpression(whenFalse, context)
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
            return `(: ${this.renderExpression(node.children[0], context)} :)`;
        }

        const identifier = typeof node.metadata?.identifier === 'string' ? node.metadata.identifier : '';
        if (identifier) {
            return `(: ${identifier} :)`;
        }

        return normalizeInlineText(node.text);
    }

    private renderExpressionList(node: FormatNode, context: PrintContext): string {
        const hasRange = Boolean(node.metadata?.hasRange);
        if (!hasRange) {
            return node.children.map((child) => this.renderExpression(child, context)).join(', ');
        }

        const [start, end] = node.children;
        if (start && end) {
            return `${this.renderExpression(start, context)}..${this.renderExpression(end, context)}`;
        }
        if (start) {
            return `${this.renderExpression(start, context)}..`;
        }
        if (end) {
            return `..${this.renderExpression(end, context)}`;
        }

        return '..';
    }

    private renderForeachBinding(node: FormatNode): string {
        const typeReference = node.children.find((child) => child.syntaxKind === SyntaxKind.TypeReference);
        const identifier = node.children.find((child) => child.syntaxKind === SyntaxKind.Identifier);
        const prefix = node.metadata?.isReference ? 'ref ' : '';
        return [
            `${prefix}${typeReference ? normalizeInlineText(typeReference.text) : ''}`.trim(),
            identifier ? this.renderIdentifier(identifier) : ''
        ].filter(Boolean).join(' ');
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

    private attachPreservableTrivia(node: FormatNode, rendered: string): string {
        const leadingDirectives = extractPreservableTrivia(node.leadingTrivia);
        let result = rendered;

        if (leadingDirectives.length > 0) {
            const separator = leadingDirectives.some((entry) => entry.startsWith('#')) ? '\n\n' : '\n';
            result = result
                ? `${leadingDirectives.join('\n')}${separator}${result}`
                : leadingDirectives.join('\n');
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

function normalizeInlineText(text: string): string {
    const placeholders = new Map<string, string>([
        ['__ARROW__', '->'],
        ['__SCOPE__', '::'],
        ['__ELLIPSIS__', '...'],
        ['__RANGE__', '..'],
        ['__INCREMENT__', '++'],
        ['__DECREMENT__', '--'],
        ['__PLUS_ASSIGN__', '+='],
        ['__MINUS_ASSIGN__', '-='],
        ['__STAR_ASSIGN__', '*='],
        ['__DIV_ASSIGN__', '/='],
        ['__PERCENT_ASSIGN__', '%='],
        ['__BIT_OR_ASSIGN__', '|='],
        ['__BIT_AND_ASSIGN__', '&='],
        ['__GE__', '>='],
        ['__LE__', '<='],
        ['__EQ__', '=='],
        ['__NE__', '!='],
        ['__AND__', '&&'],
        ['__OR__', '||'],
        ['__SHIFT_LEFT__', '<<'],
        ['__SHIFT_RIGHT__', '>>']
    ]);

    let normalized = text
        .replace(/\.\.\./g, ' __ELLIPSIS__ ')
        .replace(/->/g, ' __ARROW__ ')
        .replace(/::/g, ' __SCOPE__ ')
        .replace(/\+\+/g, ' __INCREMENT__ ')
        .replace(/--/g, ' __DECREMENT__ ')
        .replace(/\+=/g, ' __PLUS_ASSIGN__ ')
        .replace(/-=/g, ' __MINUS_ASSIGN__ ')
        .replace(/\*=/g, ' __STAR_ASSIGN__ ')
        .replace(/\/=/g, ' __DIV_ASSIGN__ ')
        .replace(/%=/g, ' __PERCENT_ASSIGN__ ')
        .replace(/\|=/g, ' __BIT_OR_ASSIGN__ ')
        .replace(/&=/g, ' __BIT_AND_ASSIGN__ ')
        .replace(/>=/g, ' __GE__ ')
        .replace(/<=/g, ' __LE__ ')
        .replace(/==/g, ' __EQ__ ')
        .replace(/!=/g, ' __NE__ ')
        .replace(/&&/g, ' __AND__ ')
        .replace(/\|\|/g, ' __OR__ ')
        .replace(/<</g, ' __SHIFT_LEFT__ ')
        .replace(/>>/g, ' __SHIFT_RIGHT__ ')
        .replace(/\.\./g, ' __RANGE__ ')
        .replace(/\s+/g, ' ')
        .trim();

    normalized = normalized
        .replace(/\s*,\s*/g, ', ')
        .replace(/\(\s+/g, '(')
        .replace(/\s+\)/g, ')')
        .replace(/\[\s+/g, '[')
        .replace(/\s+\]/g, ']')
        .replace(/\s*([=+\-*/%<>!&|?:])\s*/g, ' $1 ')
        .replace(/\s*;\s*/g, ';')
        .replace(/\s+/g, ' ')
        .trim();

    for (const [placeholder, token] of placeholders.entries()) {
        normalized = normalized.replace(new RegExp(placeholder, 'g'), token);
    }

    return normalized;
}

function appendToLastLine(text: string, suffix: string): string {
    const lastNewline = text.lastIndexOf('\n');
    if (lastNewline === -1) {
        return `${text}${suffix}`;
    }

    return `${text.slice(0, lastNewline + 1)}${text.slice(lastNewline + 1)}${suffix}`;
}

function trimTrailingWhitespace(text: string): string {
    return text.replace(/[ \t]+$/gm, '');
}

function ensureStatementTerminator(text: string): string {
    return text.endsWith(';') ? text : `${text};`;
}

function prefixMultiline(prefix: string, value: string, indent: string): string {
    if (!value.includes('\n')) {
        return `${prefix}${value}`;
    }

    const [firstLine, ...rest] = value.split('\n');
    const normalizedFirstLine = firstLine.startsWith(indent)
        ? firstLine.slice(indent.length)
        : firstLine;

    return [`${prefix}${normalizedFirstLine}`, ...rest].join('\n');
}

function trimLeadingIndent(text: string, indent: string): string {
    if (!indent || !text.startsWith(indent)) {
        return text;
    }

    return `${text.slice(indent.length)}`;
}

function extractPreservableTrivia(trivia: readonly string[]): string[] {
    return trivia
        .map((entry) => entry.trim())
        .filter(Boolean)
        .flatMap((entry) => {
            if (/^#/.test(entry)) {
                return [entry];
            }

            if (/^\/\//.test(entry)) {
                return [entry];
            }

            if (/^\/\*/.test(entry)) {
                return [normalizeLeadingCommentBlock(entry)];
            }

            return [];
        });
}

function classifyBlockSpacingGroup(node: FormatNode): 'declaration' | 'control' | 'other' {
    switch (node.syntaxKind) {
        case SyntaxKind.VariableDeclaration:
            return 'declaration';
        case SyntaxKind.IfStatement:
        case SyntaxKind.SwitchStatement:
        case SyntaxKind.WhileStatement:
        case SyntaxKind.DoWhileStatement:
        case SyntaxKind.ForStatement:
        case SyntaxKind.ForeachStatement:
            return 'control';
        default:
            return 'other';
    }
}
