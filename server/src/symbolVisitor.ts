import { AbstractParseTreeVisitor } from 'antlr4ts/tree/AbstractParseTreeVisitor';
import { DocumentSymbol, SymbolKind } from 'vscode-languageserver/node';
import { FunctionDeclarationContext, ProgramContext } from './parser/LPCParser';
import { LPCVisitor } from './parser/LPCVisitor';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ParseTree } from 'antlr4ts/tree/ParseTree';
import { getIdentifierInfo } from './utils';

export class LpcSymbolVisitor extends AbstractParseTreeVisitor<DocumentSymbol[]> implements LPCVisitor<DocumentSymbol[]> {

    constructor(private readonly document: TextDocument) {
        super();
    }

    protected defaultResult(): DocumentSymbol[] {
        return [];
    }

    protected aggregateResult(aggregate: DocumentSymbol[], nextResult: DocumentSymbol[]): DocumentSymbol[] {
        return aggregate.concat(nextResult);
    }
    
    visitProgram(ctx: ProgramContext): DocumentSymbol[] {
        const symbols: DocumentSymbol[] = [];
        for (const child of ctx.children ?? []) {
            symbols.push(...this.visit(child));
        }
        return symbols;
    }

    visitFunctionDeclaration(ctx: FunctionDeclarationContext): DocumentSymbol[] {
        const identifier = ctx.identifier();
        const info = getIdentifierInfo(identifier);
        if (!info) return [];

        const range = {
            start: this.document.positionAt(ctx.start.startIndex),
            end: this.document.positionAt(ctx.stop!.stopIndex + 1)
        };
        const symbol = DocumentSymbol.create(info.name, 'Function', SymbolKind.Function, range, range);
        return [symbol];
    }
} 