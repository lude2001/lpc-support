import * as vscode from 'vscode';
import { ParseTreeWalker, ParseTree } from 'antlr4/src/antlr4/tree/Tree';
import { TerminalNode } from 'antlr4/src/antlr4/tree/TerminalNode';
import LPCParser, {
    FunctionDefinitionContext,
    CompoundStatementContext,
    VariableDeclaratorContext,
    ParameterDeclarationContext,
    PrimaryExpressionContext,
    PostfixExpressionContext,
    FunctionCallContext,
    ClassDefinitionContext,    // Added
    DefineDirectiveContext,    // Added
    TypeSpecifierContext       // Added for better type extraction
} from '../../out/parser/LPCParser.js';
import LPCListener from '../../out/parser/LPCListener.js';
import { Scope, LPCSymbol, SymbolKind } from './symbolTable';

export class LPCSymbolTableListener extends LPCListener {
    private diagnostics: vscode.Diagnostic[];
    public globalScope: Scope;
    private currentScope: Scope;
    private parser: LPCParser;

    constructor(parser: LPCParser) {
        super();
        this.diagnostics = [];
        this.parser = parser;
        this.globalScope = new Scope(null, null as any); // Root scope node set by caller (e.g. program context)
        this.currentScope = this.globalScope;
    }

    getDiagnostics(): vscode.Diagnostic[] {
        return this.diagnostics;
    }

    private getFullType(ctx: TypeSpecifierContext | undefined | null): string {
        if (!ctx) return "unknown";
        let typeText = ctx.baseTypeSpecifier()?.getText() || "unknown";
        if (ctx.arraySpecifier()) {
            typeText += ctx.arraySpecifier().getText(); // e.g., "*"
        }
        return typeText;
    }

    // Scope Management
    enterFunctionDefinition = (ctx: FunctionDefinitionContext) => {
        const functionNameNode = ctx.IDENTIFIER();
        const functionName = functionNameNode?.getText();

        if (functionName && functionNameNode) {
            const symbol: LPCSymbol = {
                name: functionName,
                kind: 'function',
                type: this.getFullType(ctx.typeSpecifier()),
                declarationNode: functionNameNode,
                scope: this.currentScope
            };
            this.currentScope.define(symbol);
        }

        const newScope = new Scope(this.currentScope, ctx);
        this.currentScope.addChild(newScope);
        this.currentScope = newScope;
    }

    exitFunctionDefinition = (ctx: FunctionDefinitionContext) => {
        if (this.currentScope.parent) {
            this.currentScope = this.currentScope.parent;
        }
    }

    enterClassDefinition = (ctx: ClassDefinitionContext) => {
        const classNameNode = ctx.IDENTIFIER();
        const className = classNameNode?.getText();

        if (className && classNameNode) {
            const symbol: LPCSymbol = {
                name: className,
                kind: 'class',
                type: className, // Type is the class name itself
                declarationNode: classNameNode,
                scope: this.currentScope
            };
            this.currentScope.define(symbol);
        }
        // Future: Could create a scope for the class if LPC supports nested classes or class-scoped static members easily
        // For now, class members (methods/variables) will be defined in the scope containing the class.
        // If classes have their own scopes for members, new scope logic would be here.
    }

    // Note: No exitClassDefinition needed for scope if class doesn't create one for its members directly.

    enterCompoundStatement = (ctx: CompoundStatementContext) => {
        // Only create a new scope if this compound statement is not directly part of a function definition
        // (as function definition already created a scope for its body) or a class definition.
        if (!(ctx.parentCtx instanceof FunctionDefinitionContext) && !(ctx.parentCtx instanceof ClassDefinitionContext) ) {
            const newScope = new Scope(this.currentScope, ctx);
            this.currentScope.addChild(newScope);
            this.currentScope = newScope;
        }
    }

    exitCompoundStatement = (ctx: CompoundStatementContext) => {
        if (!(ctx.parentCtx instanceof FunctionDefinitionContext) && !(ctx.parentCtx instanceof ClassDefinitionContext)) {
            if (this.currentScope.parent) {
                this.currentScope = this.currentScope.parent;
            }
        }
    }

    // Symbol Definition
    enterParameterDeclaration = (ctx: ParameterDeclarationContext) => {
        const paramNameNode = ctx.IDENTIFIER();
        const paramName = paramNameNode?.getText();
        if (paramName && paramNameNode) {
            const symbol: LPCSymbol = {
                name: paramName,
                kind: 'parameter',
                type: this.getFullType(ctx.typeSpecifier()),
                declarationNode: paramNameNode,
                scope: this.currentScope
            };
            this.currentScope.define(symbol);
        }
    }

    enterVariableDeclarator = (ctx: VariableDeclaratorContext) => {
        const varNameNode = ctx.IDENTIFIER();
        const varName = varNameNode?.getText();

        if (varName && varNameNode) {
            let varType = "unknown";
            // VariableDeclaratorContext -> VariableDeclaratorListContext -> DeclarationContext
            const declarationCtx = ctx.parentCtx?.parentCtx as LPCParser.DeclarationContext;
            if (declarationCtx && declarationCtx.typeSpecifier) {
                 varType = this.getFullType(declarationCtx.typeSpecifier());
            }

            const symbol: LPCSymbol = {
                name: varName,
                kind: 'variable',
                type: varType,
                declarationNode: varNameNode,
                scope: this.currentScope
            };
            this.currentScope.define(symbol);
        }
    }

    enterDefineDirective = (ctx: DefineDirectiveContext) => {
        const macroNameNode = ctx.IDENTIFIER();
        const macroName = macroNameNode?.getText();
        if (macroName && macroNameNode) {
            // Type for macros is not strictly defined, can use 'macro' or a representation of its value
            let macroValue = "";
            if (ctx.preprocessorTokenSequence()) { // Check if preprocessorTokenSequence exists
                macroValue = ctx.preprocessorTokenSequence()?.getText() || "";
            }

            const symbol: LPCSymbol = {
                name: macroName,
                kind: 'macro',
                type: macroValue.trim() ? `defined as: ${macroValue}` : 'defined', // Simplified type/value display
                declarationNode: macroNameNode,
                scope: this.globalScope // Macros are typically global
            };
            this.globalScope.define(symbol); // Define macros in global scope
        }
    }


    // Symbol Usage Check
    enterPrimaryExpression = (ctx: PrimaryExpressionContext) => {
        const idNode = ctx.IDENTIFIER();
        if (idNode) {
            const varName = idNode.getText();

            let isDeclaration = false;
            let currentRule: ParseTree | null = ctx;
            while(currentRule) {
                if (currentRule instanceof VariableDeclaratorContext ||
                    currentRule instanceof ParameterDeclarationContext ||
                    (currentRule instanceof FunctionDefinitionContext && currentRule.IDENTIFIER() === idNode) ||
                    (currentRule instanceof ClassDefinitionContext && currentRule.IDENTIFIER() === idNode) ||
                    (currentRule instanceof DefineDirectiveContext && currentRule.IDENTIFIER() === idNode)
                    ) {
                    isDeclaration = true;
                    break;
                }
                currentRule = currentRule.parentCtx;
            }
            if (isDeclaration) return;

            let isFunctionOrMethodName = false;
            const parentPostfix = ctx.parentCtx;
            if (parentPostfix instanceof PostfixExpressionContext) {
                const children = parentPostfix.children;
                if (children && children.length > 1 && children[0] === ctx) {
                    if (children[1] instanceof FunctionCallContext) {
                        isFunctionOrMethodName = true;
                    }
                }
            }

            if (ctx.parentCtx instanceof LPCParser.MemberAccessContext && (ctx.parentCtx as LPCParser.MemberAccessContext).IDENTIFIER() === idNode) {
                return;
            }
            if (ctx.parentCtx instanceof LPCParser.ClassIdentifierContext && ctx.parentCtx.parentCtx instanceof LPCParser.ClassConstructorCallContext) {
                return;
            }
            if (ctx.parentCtx instanceof LPCParser.RemoteFunctionPointerSuffixContext && (ctx.parentCtx as LPCParser.RemoteFunctionPointerSuffixContext).IDENTIFIER() === idNode) {
                return; // This is a function name in a remote function pointer, not a variable
            }
             if (ctx.parentCtx instanceof LPCParser.SimpleFunctionPointerLiteralContext && (ctx.parentCtx as LPCParser.SimpleFunctionPointerLiteralContext).IDENTIFIER() === idNode) {
                return; // This is a function name in a simple function pointer, not a variable
            }


            if (!isFunctionOrMethodName) {
                const symbol = this.currentScope.resolve(varName);
                if (!symbol) {
                    const token = idNode.getSymbol();
                    const diagnostic = new vscode.Diagnostic(
                        new vscode.Range(
                            new vscode.Position(token.line - 1, token.column),
                            new vscode.Position(token.line - 1, token.column + varName.length)
                        ),
                        `Undefined identifier: '${varName}'`, // Changed message to 'identifier'
                        vscode.DiagnosticSeverity.Error
                    );
                    this.diagnostics.push(diagnostic);
                }
            }
        }
    }
}
