import * as vscode from 'vscode';
import { CharStreams, CommonTokenStream, TerminalNode, ParserRuleContext } from 'antlr4'; // TerminalNode might be from antlr4/tree/Tree depending on antlr4 version
import { ParseTreeWalker } from 'antlr4/src/antlr4/tree/Tree';
import LPCLexer from '../../out/parser/LPCLexer.js';
import LPCParser, {
    FunctionDefinitionContext, VariableDeclaratorContext, ParameterDeclarationContext, ClassIdentifierContext,
    BaseTypeSpecifierContext, PrimaryExpressionContext, FunctionCallContext, MemberAccessContext,
    DefineDirectiveContext, IncludeDirectiveContext, ClassDefinitionContext, TypeModifierContext,
    InheritStatementContext, IfStatementContext, ElseDirectiveContext, SwitchStatementContext, CaseStatementContext, DefaultCaseContext,
    WhileStatementContext, ForStatementContext, DoWhileStatementContext, ForeachStatementContext, ReturnStatementContext,
    BreakStatementContext, ContinueStatementContext, SimpleFunctionPointerLiteralContext, RemoteFunctionPointerSuffixContext,
    ClosureExpressionContext, ExpressionClosureContext, ObjectFunctionClosureContext, ClosureArgsAndBodyContext,
    ClosureArgPlaceholderContext, ClosureCaptureContext, // Added new context types
    PostfixExpressionContext, // Added for context checking
    ProgramContext
} from '../../out/parser/LPCParser.js';
import LPCListener from '../../out/parser/LPCListener.js';

const tokenTypes = [
    'type', 'class', 'parameter', 'variable', 'function',
    'method', 'property', 'macro', 'lpcKeyword', 'modifier', 'keyword',
    'string', 'number', 'operator' // Added 'operator' for things like $, $(
];
const tokenModifiers = [
    'declaration', 'definition', 'readonly', 'static',
    'public', 'private', 'protected', 'defaultLibrary'
];

const legend = new vscode.SemanticTokensLegend(tokenTypes, tokenModifiers);

class LPCSemanticTokenListener extends LPCListener {
    private builder: vscode.SemanticTokensBuilder;

    constructor(builder: vscode.SemanticTokensBuilder, parser: LPCParser) {
        super();
        this.builder = builder;
    }

    private pushToken(node: TerminalNode | undefined | null | ParserRuleContext, type: string, modifiers: string[] = []) {
        if (!node) return;

        let token;
        let textLength;

        if (node instanceof TerminalNode) {
            token = node.getSymbol();
            textLength = token.text?.length ?? 0;
        } else if (node instanceof ParserRuleContext) {
            token = node.start; // Use start token for line/column
            textLength = node.getText()?.length ?? 0; // Use full text of context for length
        } else { // Should not happen if only TerminalNode or ParserRuleContext is passed
            return;
        }

        if (token && textLength > 0) {
            // console.log(`Pushing: ${token.text || node.getText()} (L${token.line}:${token.column}) as ${type} [${modifiers.join(',')}]`);
            this.builder.push(
                new vscode.Range(
                    new vscode.Position(token.line - 1, token.column),
                    new vscode.Position(token.line - 1, token.column + textLength)
                ),
                type,
                modifiers
            );
        }
    }

    // Keywords from specific statements
    enterInheritStatement = (ctx: InheritStatementContext) => this.pushToken(ctx.INHERIT()?.getSymbol(), 'lpcKeyword');
    enterIfStatement = (ctx: IfStatementContext) => {
        this.pushToken(ctx.IF()?.getSymbol(), 'keyword');
        if (ctx.ELSE()) this.pushToken(ctx.ELSE()?.getSymbol(), 'keyword');
    }
    enterSwitchStatement = (ctx: SwitchStatementContext) => this.pushToken(ctx.SWITCH()?.getSymbol(), 'keyword');
    enterCaseStatement = (ctx: CaseStatementContext) => this.pushToken(ctx.CASE()?.getSymbol(), 'keyword'); // Corrected from CaseStatementContext to CaseStatementContext
    enterDefaultCase = (ctx: DefaultCaseContext) => this.pushToken(ctx.DEFAULT()?.getSymbol(), 'keyword');
    enterWhileStatement = (ctx: WhileStatementContext) => this.pushToken(ctx.WHILE()?.getSymbol(), 'keyword');
    enterForStatement = (ctx: ForStatementContext) => this.pushToken(ctx.FOR()?.getSymbol(), 'keyword');
    enterDoWhileStatement = (ctx: DoWhileStatementContext) => {
        this.pushToken(ctx.DO()?.getSymbol(), 'keyword');
        this.pushToken(ctx.WHILE()?.getSymbol(), 'keyword');
    }
    enterForeachStatement = (ctx: ForeachStatementContext) => {
        this.pushToken(ctx.FOREACH()?.getSymbol(), 'keyword');
        if (ctx.IN()) this.pushToken(ctx.IN()?.getSymbol(), 'keyword');
    }
    enterReturnStatement = (ctx: ReturnStatementContext) => this.pushToken(ctx.RETURN()?.getSymbol(), 'keyword');
    enterBreakStatement = (ctx: BreakStatementContext) => this.pushToken(ctx.BREAK()?.getSymbol(), 'keyword');
    enterContinueStatement = (ctx: ContinueStatementContext) => this.pushToken(ctx.CONTINUE()?.getSymbol(), 'keyword');

    // Type Modifiers
    enterTypeModifier = (ctx: TypeModifierContext) => {
        if (ctx.STATIC()) this.pushToken(ctx.STATIC().getSymbol(), 'modifier', ['static']);
        else if (ctx.NOMASK()) this.pushToken(ctx.NOMASK().getSymbol(), 'modifier');
        else if (ctx.PRIVATE()) this.pushToken(ctx.PRIVATE().getSymbol(), 'modifier', ['private']);
        else if (ctx.PUBLIC()) this.pushToken(ctx.PUBLIC().getSymbol(), 'modifier', ['public']);
        else if (ctx.VARARGS()) this.pushToken(ctx.VARARGS().getSymbol(), 'modifier');
        else if (ctx.NOSAVE()) this.pushToken(ctx.NOSAVE().getSymbol(), 'modifier', ['readonly']);
    }

    // Function Definitions
    enterFunctionDefinition = (ctx: FunctionDefinitionContext) => {
        this.pushToken(ctx.IDENTIFIER()?.getSymbol(), 'function', ['declaration', 'definition']);
    }

    // Variable Declarations
    enterVariableDeclarator = (ctx: VariableDeclaratorContext) => {
        this.pushToken(ctx.IDENTIFIER()?.getSymbol(), 'variable', ['declaration']);
    }

    // Parameter Declarations (also used in closures)
    enterParameterDeclaration = (ctx: ParameterDeclarationContext) => {
        this.pushToken(ctx.IDENTIFIER()?.getSymbol(), 'parameter', ['declaration']);
    }

    enterBaseTypeSpecifier = (ctx: BaseTypeSpecifierContext) => {
        if (ctx.classIdentifier()) return;
        const typeKeywordToken = ctx.children?.[0] as TerminalNode;
        if(typeKeywordToken && typeKeywordToken.getSymbol) {
            const symbol = typeKeywordToken.getSymbol();
            if ([LPCLexer.VOID, LPCLexer.INT, LPCLexer.STRING, LPCLexer.OBJECT, LPCLexer.FLOAT, LPCLexer.MIXED, LPCLexer.STATUS, LPCLexer.BUFFER, LPCLexer.MAPPING, LPCLexer.FUNCTION].includes(symbol.type)) {
                 this.pushToken(symbol, 'type');
            }
        }
    }

    enterClassIdentifier = (ctx: ClassIdentifierContext) => {
        const parentIsClassDefName = ctx.parentCtx instanceof ClassDefinitionContext && (ctx.parentCtx as ClassDefinitionContext).IDENTIFIER()?.getSymbol() === ctx.IDENTIFIER()?.getSymbol();
        const parentIsExtends = ctx.parentCtx instanceof ClassDefinitionContext && (ctx.parentCtx as ClassDefinitionContext).classIdentifier() === ctx;

        if (!parentIsClassDefName) { // Don't re-highlight if it's the class being defined
            this.pushToken(ctx.IDENTIFIER()?.getSymbol(), parentIsExtends ? 'class' : 'type');
        }
    }

    enterClassDefinition = (ctx: ClassDefinitionContext) => {
        this.pushToken(ctx.CLASS()?.getSymbol(), 'keyword');
        this.pushToken(ctx.IDENTIFIER()?.getSymbol(), 'class', ['declaration', 'definition']);
        if (ctx.EXTENDS()) {
            this.pushToken(ctx.EXTENDS().getSymbol(), 'keyword');
            // The extended class name (a classIdentifier) is handled by enterClassIdentifier
        }
    }

    // Postfix expressions help determine context for IDENTIFIERs in PrimaryExpression
    enterPostfixExpression = (ctx: PostfixExpressionContext) => {
        const primary = ctx.primaryExpression();
        if (primary?.IDENTIFIER()) {
            const identifierToken = primary.IDENTIFIER().getSymbol();
            // Check what follows the primaryExpression IDENTIFIER
            if (ctx.functionCall().length > 0) { // IDENTIFIER LPAREN ...
                this.pushToken(identifierToken, 'function');
            } else if (ctx.memberAccess().length > 0) { // IDENTIFIER ARROW IDENTIFIER
                // This IDENTIFIER is the object, not the member. Member is handled in enterMemberAccess.
                // Could be 'variable' or 'parameter' depending on its declaration.
                // For now, let primaryExpression handle it if no other suffix matches.
            } else if (ctx.remoteFunctionPointerSuffix().length > 0) { // IDENTIFIER ARROW HASH SINGLE_QUOTE IDENTIFIER
                 // This IDENTIFIER is the object part of obj->#'func'
                 this.pushToken(identifierToken, 'variable'); // Or could be more specific if type info available
            }
            // Other cases (arrayAccess, rangeAccess, postfixOperator) mean IDENTIFIER is likely a variable.
            // This logic is now mostly handled in enterPrimaryExpression to avoid double processing.
        }
    }

    enterFunctionCall = (ctx: FunctionCallContext) => {
        // This rule itself is just LPAREN args RPAREN. The actual function name is
        // part of the primaryExpression that precedes this in a postfixExpression.
        // That primaryExpression (if it's an IDENTIFIER) is now handled in enterPostfixExpression / enterPrimaryExpression.
        // If the function call is on a member access, e.g. obj->method(), it's handled by enterMemberAccess.
    }

    enterMemberAccess = (ctx: MemberAccessContext) => {
        let tokenType = 'property'; // Default
        // Check if this member access is immediately followed by a function call
        // e.g. grandparent is postfixExpression, parent is primaryExpression (which is this memberAccess),
        // and the next child of grandparent is functionCall
        const parentPostfix = ctx.parentCtx?.parentCtx; // Should be PostfixExpressionContext
        if (parentPostfix instanceof PostfixExpressionContext) {
            const children = parentPostfix.children;
            if (children) {
                const thisMemberAccessIndex = children.indexOf(ctx.parentCtx); // index of the primaryExpression wrapping this memberAccess
                if (thisMemberAccessIndex !== -1 && thisMemberAccessIndex + 1 < children.length) {
                    if (children[thisMemberAccessIndex + 1] instanceof FunctionCallContext) {
                        tokenType = 'method';
                    }
                }
            }
        }
        this.pushToken(ctx.IDENTIFIER()?.getSymbol(), tokenType);
    }

    enterRemoteFunctionPointerSuffix = (ctx: RemoteFunctionPointerSuffixContext) => {
        this.pushToken(ctx.HASH()?.getSymbol(), 'operator');
        this.pushToken(ctx.SINGLE_QUOTE()?.getSymbol(), 'operator');
        this.pushToken(ctx.IDENTIFIER()?.getSymbol(), 'function');
    }

    enterSimpleFunctionPointerLiteral = (ctx: SimpleFunctionPointerLiteralContext) => {
        this.pushToken(ctx.HASH()?.getSymbol(), 'operator');
        this.pushToken(ctx.SINGLE_QUOTE()?.getSymbol(), 'operator');
        this.pushToken(ctx.IDENTIFIER()?.getSymbol(), 'function');
    }

    enterDefineDirective = (ctx: DefineDirectiveContext) => {
        this.pushToken(ctx.HASH()?.getSymbol(), 'macro');
        this.pushToken(ctx.DEFINE()?.getSymbol(), 'macro');
        this.pushToken(ctx.IDENTIFIER()?.getSymbol(), 'macro', ['declaration']);
    }
    enterIncludeDirective = (ctx: IncludeDirectiveContext) => {
        this.pushToken(ctx.HASH()?.getSymbol(), 'macro');
        this.pushToken(ctx.INCLUDE()?.getSymbol(), 'macro');
    }

    enterPrimaryExpression = (ctx: PrimaryExpressionContext) => {
        if (ctx.IDENTIFIER()) {
            // Default to 'variable'. If it's part of a function call, enterPostfixExpression will reclassify.
            // This ensures variables used not in function calls are still tokenized.
            // Check if parent PostfixExpression makes it a function call
            let isPartOfFunctionCall = false;
            let isObjectOfRemoteFuncPointer = false;

            if (ctx.parentCtx instanceof PostfixExpressionContext) {
                const postfixCtx = ctx.parentCtx as PostfixExpressionContext;
                const children = postfixCtx.children;
                if (children && children.length > 1 && children[0] === ctx) {
                    if (children[1] instanceof FunctionCallContext) {
                        isPartOfFunctionCall = true;
                    } else if (children[1] instanceof RemoteFunctionPointerSuffixContext) {
                        isObjectOfRemoteFuncPointer = true;
                    }
                }
            }

            if (isPartOfFunctionCall) {
                this.pushToken(ctx.IDENTIFIER().getSymbol(), 'function');
            } else if (!isObjectOfRemoteFuncPointer) { // Avoid double tokenizing if it's obj in obj->#'func'
                this.pushToken(ctx.IDENTIFIER().getSymbol(), 'variable');
            }

        }
        if (ctx.constant()?.STRING_LITERAL()) this.pushToken(ctx.constant().STRING_LITERAL().getSymbol(), 'string');
        if (ctx.constant()?.INTEGER_LITERAL()) this.pushToken(ctx.constant().INTEGER_LITERAL().getSymbol(), 'number');
        if (ctx.constant()?.FLOAT_LITERAL()) this.pushToken(ctx.constant().FLOAT_LITERAL().getSymbol(), 'number');
    }

    // Closures
    enterClosureExpression = (ctx: ClosureExpressionContext) => {
        this.pushToken(ctx.LBRACE_LPAREN()?.getSymbol(), 'operator'); // (:
        this.pushToken(ctx.RBRACE_RPAREN()?.getSymbol(), 'operator'); // :)

        if (ctx.objectFunctionClosure()) {
            const ofc = ctx.objectFunctionClosure() as ObjectFunctionClosureContext;
            if (ofc.STRING_LITERAL()) {
                this.pushToken(ofc.STRING_LITERAL().getSymbol(), 'function');
            } else if (ofc.IDENTIFIER()) {
                this.pushToken(ofc.IDENTIFIER().getSymbol(), 'function');
            }
        }
        // expressionClosure is handled by its constituent parts via enterPrimaryExpression etc.
        // Parameters in closureArgsAndBody are handled by enterParameterDeclaration
        if (ctx.closureArgsAndBody()) {
            const cab = ctx.closureArgsAndBody() as ClosureArgsAndBodyContext;
            if (cab.ARROW()) this.pushToken(cab.ARROW().getSymbol(), 'operator');
            else if (cab.LAMBDA_ARROW()) this.pushToken(cab.LAMBDA_ARROW().getSymbol(), 'operator');
        }
    }

    // New methods for $n and $(expression)
    enterClosureArgPlaceholder = (ctx: ClosureArgPlaceholderContext) => {
        this.pushToken(ctx.DOLLAR()?.getSymbol(), 'operator'); // Or 'parameter' or a new type 'placeholderArgument'
        this.pushToken(ctx.INTEGER_LITERAL()?.getSymbol(), 'parameter'); // Or 'number' if preferred for the digit
    }

    enterClosureCapture = (ctx: ClosureCaptureContext) => {
        this.pushToken(ctx.DOLLAR_LPAREN()?.getSymbol(), 'operator'); // For '$('
        // The 'expression' inside is walked by other rules.
        // We need to find the closing RPAREN if it's part of this rule explicitly in grammar, or get it from context.
        // Assuming RPAREN is explicitly part of ClosureCaptureContext based on `DOLLAR_LPAREN expression RPAREN`
        this.pushToken(ctx.RPAREN()?.getSymbol(), 'operator'); // For ')'
    }
}


export class LPCSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
    async provideDocumentSemanticTokens(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): Promise<vscode.SemanticTokens> {
        // console.log(`LPCSemanticTokensProvider: provideDocumentSemanticTokens for ${document.uri.fsPath}`);

        const builder = new vscode.SemanticTokensBuilder(legend);

        if (token.isCancellationRequested) {
            // console.log("Semantic token request cancelled before parsing.");
            return builder.build();
        }

        try {
            const text = document.getText();
            const inputStream = CharStreams.fromString(text);
            const lexer = new LPCLexer(inputStream);
            lexer.removeErrorListeners();

            const tokenStream = new CommonTokenStream(lexer);
            const parser = new LPCParser(tokenStream);
            parser.removeErrorListeners();

            const tree = parser.program();

            if (tree && !token.isCancellationRequested) {
                const listener = new LPCSemanticTokenListener(builder, parser);
                ParseTreeWalker.DEFAULT.walk(listener, tree);
                // console.log("Semantic token parsing and listener walk completed.");
            } else if (token.isCancellationRequested) {
                // console.log("Semantic token request cancelled during parsing/walking.");
            }
        } catch (error) {
            console.error("Error during semantic token parsing:", error);
        }

        return builder.build();
    }
}

export { legend as lpcSemanticTokenLegend };
