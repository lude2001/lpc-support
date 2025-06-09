import { AbstractParseTreeVisitor } from 'antlr4ts/tree/AbstractParseTreeVisitor';
import { SemanticTokens, SemanticTokensBuilder } from 'vscode-languageserver/node';
import { FunctionDeclarationContext, IdentifierContext, PreprocessorDirectiveContext } from './parser/LPCParser';
import { LPCVisitor } from './parser/LPCVisitor';
import { ParseTree } from 'antlr4ts/tree/ParseTree';
import { TerminalNode } from 'antlr4ts/tree/TerminalNode';
import { LPCLexer } from './parser/LPCLexer';
import { getIdentifierInfo } from './utils';

// --- Token-Type Mapping ---
const tokenTypeMap = new Map<number, string>();

function initializeTokenTypeMap() {
    const keywordTypes = [
        LPCLexer.IF, LPCLexer.ELSE, LPCLexer.WHILE, LPCLexer.FOR, LPCLexer.DO, LPCLexer.SWITCH,
        LPCLexer.CASE, LPCLexer.DEFAULT, LPCLexer.BREAK, LPCLexer.CONTINUE, LPCLexer.RETURN,
        LPCLexer.FOREACH, LPCLexer.INHERIT, LPCLexer.IN, LPCLexer.EFUN, LPCLexer.NEW,
        LPCLexer.CATCH, LPCLexer.SSCANF, LPCLexer.PARSE_COMMAND, LPCLexer.TIME_EXPRESSION
    ];
    for (const type of keywordTypes) {
        tokenTypeMap.set(type, 'keyword');
    }

    const modifierTypes = [
        LPCLexer.PRIVATE, LPCLexer.PROTECTED, LPCLexer.PUBLIC,
        LPCLexer.STATIC, LPCLexer.NOMASK, LPCLexer.VARARGS, LPCLexer.NOSAVE, LPCLexer.REF
    ];
    for (const type of modifierTypes) {
        tokenTypeMap.set(type, 'modifier');
    }

    const preprocessorTypes = [
        LPCLexer.PP_INCLUDE, LPCLexer.PP_DEFINE, LPCLexer.PP_IFDEF, LPCLexer.PP_IFNDEF,
        LPCLexer.PP_IF, LPCLexer.PP_ELSE, LPCLexer.PP_ENDIF, LPCLexer.PP_ERROR, LPCLexer.PP_PRAGMA
    ];
    for (const type of preprocessorTypes) {
        tokenTypeMap.set(type, 'preprocessor');
    }

    const typeKeywordTypes = [
        LPCLexer.VOID, LPCLexer.INT, LPCLexer.STRING, LPCLexer.OBJECT, LPCLexer.ARRAY,
        LPCLexer.MAPPING, LPCLexer.FLOAT, LPCLexer.BUFFER, LPCLexer.MIXED, LPCLexer.FUNCTION,
        LPCLexer.CLASS, LPCLexer.STRUCT, LPCLexer.CLOSURE
    ];
    for (const type of typeKeywordTypes) {
        tokenTypeMap.set(type, 'type');
    }
}

initializeTokenTypeMap();
// --- End Mapping ---


export class LpcSemanticTokensVisitor extends AbstractParseTreeVisitor<void> implements LPCVisitor<void> {
    private builder: SemanticTokensBuilder;

    constructor(private readonly legend: { tokenTypes: string[], tokenModifiers: string[] }) {
        super();
        this.builder = new SemanticTokensBuilder();
    }

    protected defaultResult(): void {
        return;
    }
    
    visitTerminal(node: TerminalNode): void {
        const tokenTypeName = tokenTypeMap.get(node.symbol.type);
        if (tokenTypeName) {
            const tokenTypeIndex = this.legend.tokenTypes.indexOf(tokenTypeName);
            
            if (tokenTypeIndex >= 0) {
                 this.builder.push(
                    node.symbol.line - 1,
                    node.symbol.charPositionInLine,
                    node.text.length,
                    tokenTypeIndex,
                    0 // No modifiers for keywords/types for now
                );
            }
        }
    }

    visitFunctionDeclaration(ctx: FunctionDeclarationContext): void {
        const identifier = ctx.identifier();
        const info = getIdentifierInfo(identifier);

        if (info) {
            const tokenTypeIndex = this.legend.tokenTypes.indexOf('function');
            const tokenModifierIndex = this.legend.tokenModifiers.indexOf('declaration');
            const tokenModifiers = tokenModifierIndex >= 0 ? 1 << tokenModifierIndex : 0;

            if (tokenTypeIndex >= 0) {
                this.builder.push(
                    info.token.line - 1,
                    info.token.charPositionInLine,
                    info.name.length,
                    tokenTypeIndex,
                    tokenModifiers
                );
            }
        }

        this.visitChildren(ctx);
    }

    visitPreprocessorDirective(ctx: PreprocessorDirectiveContext): void {
        const ppDefine = ctx.ppDefine();
        if (ppDefine) {
            const identifier = ppDefine.IDENTIFIER();
            
            if (identifier) {
                const tokenTypeIndex = this.legend.tokenTypes.indexOf('macro');
                if (tokenTypeIndex >= 0) {
                    this.builder.push(
                        identifier.symbol.line - 1,
                        identifier.symbol.charPositionInLine,
                        identifier.text.length,
                        tokenTypeIndex,
                        0 // No modifiers for now
                    );
                }
            }
        }
        this.visitChildren(ctx);
    }
    
    // Override visitChildren to ensure we don't double-visit identifiers
    visitChildren(node: ParseTree): void {
        for (let i = 0; i < node.childCount; i++) {
            const child = node.getChild(i);
            // Don't visit identifiers that are handled by other visitor methods
            if (!(child instanceof IdentifierContext)) {
                this.visit(child);
            }
        }
    }

    getTokens(): SemanticTokens {
        return this.builder.build();
    }
} 