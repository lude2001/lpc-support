import {
    CompletionItem,
    CompletionItemKind,
    CompletionParams,
    Position,
    TextDocumentPositionParams
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { LPCVisitor } from './parser/LPCVisitor';
import { AbstractParseTreeVisitor } from 'antlr4ts/tree/AbstractParseTreeVisitor';
import { ParseTree } from 'antlr4ts/tree/ParseTree';
import { RuleContext } from 'antlr4ts';
import { FunctionDeclarationContext } from './parser/LPCParser';
import { getIdentifierInfo } from './utils';

export class LpcCompletionVisitor extends AbstractParseTreeVisitor<CompletionItem[]> implements LPCVisitor<CompletionItem[]> {

    private allFunctionNames: Set<string> = new Set();
    private completions: CompletionItem[] = [];
    private cursorNode: ParseTree | undefined;
    private cursorOffset: number;

    constructor(
        private readonly document: TextDocument,
        private readonly position: Position,
        tree: ParseTree
    ) {
        super();
        this.cursorOffset = this.document.offsetAt(this.position);
        this.collectAllFunctions(tree);
        this.findCursorNode(tree, this.cursorOffset);
    }
    
    protected defaultResult(): CompletionItem[] {
        return [];
    }

    protected aggregateResult(aggregate: CompletionItem[], nextResult: CompletionItem[]): CompletionItem[] {
        return aggregate.concat(nextResult);
    }
    
    // We'll implement visit methods later to get context-aware completions.
    
    private collectAllFunctions(tree: ParseTree): void {
        const visitor = new (class extends AbstractParseTreeVisitor<void> implements LPCVisitor<void> {
            constructor(private functions: Set<string>) {
                super();
            }
            visitFunctionDeclaration(ctx: any): void { // any for now
                const identifier = ctx.identifier();
                if (identifier) {
                    this.functions.add(identifier.text);
                }
            }
            protected defaultResult() {}
        })(this.allFunctionNames);
        visitor.visit(tree);
    }
    
    private findCursorNode(tree: ParseTree, offset: number): void {
        const stack: ParseTree[] = [tree];
        let foundNode: ParseTree | undefined;

        while(stack.length > 0) {
            const node = stack.pop()!;
            
            if (node instanceof RuleContext) {
                const ruleNode = node as any;
                if (ruleNode.start.startIndex <= offset && (ruleNode.stop?.stopIndex ?? -1) >= offset) {
                     foundNode = node;
                     for (let i = node.childCount - 1; i >= 0; i--) {
                        stack.push(node.getChild(i));
                    }
                }
            }
        }
        this.cursorNode = foundNode;
    }
    
    public getCompletions(): CompletionItem[] {
        if (this.cursorNode) {
            this.visit(this.cursorNode);
        }

        let results: CompletionItem[] = [];

        // 1. Add keywords
        const keywords = ['if', 'else', 'while', 'for', 'return', 'inherit', 'int', 'string', 'void'];
        const keywordCompletions: CompletionItem[] = keywords.map(kw => ({
            label: kw,
            kind: CompletionItemKind.Keyword
        }));
        results = results.concat(keywordCompletions);

        // 2. Add function names
        const functionCompletions: CompletionItem[] = Array.from(this.allFunctionNames).map(name => ({
            label: name,
            kind: CompletionItemKind.Function
        }));
        results = results.concat(functionCompletions);

        this.completions = this.completions.concat(keywordCompletions);
        this.completions = this.completions.concat(functionCompletions);

        return this.completions;
    }

    // New visit method to get local variables
    visitFunctionDeclaration(ctx: FunctionDeclarationContext): CompletionItem[] {
        const variables: CompletionItem[] = [];
        const paramList = ctx.parameterList();
        if (paramList) {
            for (const param of paramList.parameter()) {
                const identifier = param.identifier();
                // Ensure the variable is declared before the cursor
                if (identifier.start.stopIndex < this.cursorOffset) {
                    variables.push({
                        label: identifier.text,
                        kind: CompletionItemKind.Variable,
                    });
                }
            }
        }
        this.completions.push(...variables);
        return []; // We handle results via the class member
    }
} 