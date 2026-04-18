import * as vscode from 'vscode';
import { Symbol, SymbolTable, SymbolType } from '../ast/symbolTable';
import { composeLpcType } from '../ast/typeNormalization';
import {
    FileGlobalSummary,
    FunctionSummary,
    IncludeDirective,
    InheritDirective,
    ScopeSummary,
    TypeDefinitionSummary
} from '../completion/types';
import { SyntaxDocument, SyntaxKind, SyntaxNode } from '../syntax/types';
import { SemanticSnapshot } from './semanticSnapshot';

interface TraversalState {
    currentFunction?: Symbol;
    enclosingType?: Symbol;
    parentKind?: SyntaxKind;
}

export class SemanticModelBuilder {
    private syntaxDocument!: SyntaxDocument;
    private symbolTable!: SymbolTable;
    private inheritStatements: InheritDirective[] = [];
    private includeStatements: IncludeDirective[] = [];
    private lineStartOffsets: number[] = [];

    public build(syntaxDocument: SyntaxDocument): SemanticSnapshot {
        this.syntaxDocument = syntaxDocument;
        this.symbolTable = new SymbolTable(syntaxDocument.uri);
        this.inheritStatements = [];
        this.includeStatements = [];
        this.lineStartOffsets = buildLineStartOffsets(syntaxDocument.parsed.text);

        this.visitChildren(syntaxDocument.root, {});
        const fileGlobals = this.collectFileGlobals();

        return {
            uri: syntaxDocument.uri,
            version: syntaxDocument.version,
            syntax: syntaxDocument,
            parseDiagnostics: syntaxDocument.parsed.diagnostics.slice(),
            exportedFunctions: this.symbolTable
                .getSymbolsByType(SymbolType.FUNCTION)
                .map((symbol) => this.toFunctionSummary(symbol)),
            localScopes: this.collectScopeSummaries(this.symbolTable.getGlobalScope()),
            typeDefinitions: this.collectTypeDefinitions(),
            fileGlobals,
            inheritStatements: [...this.inheritStatements],
            includeStatements: [...this.includeStatements],
            macroReferences: [],
            symbolTable: this.symbolTable,
            createdAt: Date.now()
        };
    }

    private visitChildren(node: SyntaxNode, state: TraversalState): void {
        for (const child of node.children) {
            this.visitNode(child, {
                ...state,
                parentKind: node.kind
            });
        }
    }

    private visitNode(node: SyntaxNode, state: TraversalState): void {
        switch (node.kind) {
            case SyntaxKind.FunctionDeclaration:
                this.visitFunctionDeclaration(node, state);
                return;
            case SyntaxKind.VariableDeclaration:
                this.visitVariableDeclaration(node);
                return;
            case SyntaxKind.VariableDeclarator:
                if (state.parentKind !== SyntaxKind.VariableDeclaration) {
                    this.visitStandaloneVariableDeclarator(node, state);
                }
                return;
            case SyntaxKind.StructDeclaration:
                this.visitTypeDeclaration(node, SymbolType.STRUCT, 'struct', state);
                return;
            case SyntaxKind.ClassDeclaration:
                this.visitTypeDeclaration(node, SymbolType.CLASS, 'class', state);
                return;
            case SyntaxKind.InheritDirective:
                this.visitInheritDirective(node);
                return;
            case SyntaxKind.IncludeDirective:
                this.visitIncludeDirective(node);
                return;
            case SyntaxKind.Block:
                this.visitScopedNode('block', node, state);
                return;
            case SyntaxKind.IfStatement:
                this.visitScopedNode('if', node, state);
                return;
            case SyntaxKind.WhileStatement:
                this.visitScopedNode('while', node, state);
                return;
            case SyntaxKind.DoWhileStatement:
                this.visitScopedNode('do-while', node, state);
                return;
            case SyntaxKind.ForStatement:
                this.visitScopedNode('for', node, state);
                return;
            case SyntaxKind.ForeachStatement:
                this.visitScopedNode('foreach', node, state);
                return;
            case SyntaxKind.SwitchStatement:
                this.visitScopedNode('switch', node, state);
                return;
            case SyntaxKind.CaseClause:
                this.visitScopedNode('case', node, state);
                return;
            case SyntaxKind.DefaultClause:
                this.visitScopedNode('default', node, state);
                return;
            default:
                this.visitChildren(node, state);
                return;
        }
    }

    private visitFunctionDeclaration(node: SyntaxNode, state: TraversalState): void {
        const functionName = this.getNodeName(node);
        if (!functionName) {
            this.visitChildren(node, state);
            return;
        }

        const hasBody = this.hasFunctionBody(node);
        const existingSymbol = this.symbolTable.getCurrentScope().symbols.get(functionName);
        if (!hasBody && existingSymbol?.type === SymbolType.FUNCTION) {
            return;
        }

        const identifier = this.findFirstChild(node, SyntaxKind.Identifier);
        const typeReference = this.findFirstChild(node, SyntaxKind.TypeReference);
        const modifierList = this.findFirstChild(node, SyntaxKind.ModifierList);
        const definition = this.getTrimmedNodeText(node);
        const functionSymbol: Symbol = {
            name: functionName,
            type: SymbolType.FUNCTION,
            dataType: this.resolveDeclaredType(typeReference, this.getPointerCount(node), 'void'),
            range: node.range,
            selectionRange: identifier?.range,
            scope: this.symbolTable.getCurrentScope(),
            modifiers: this.readModifiers(modifierList),
            parameters: [],
            definition: definition || undefined
        };

        this.symbolTable.addSymbol(functionSymbol);

        if (!hasBody) {
            return;
        }

        this.withScope(`function:${functionName}`, node.range, () => {
            for (const child of node.children) {
                if (
                    child.kind === SyntaxKind.ModifierList
                    || child.kind === SyntaxKind.TypeReference
                    || child.kind === SyntaxKind.Identifier
                ) {
                    continue;
                }

                if (child.kind === SyntaxKind.ParameterList) {
                    this.visitParameterList(child, functionSymbol);
                    continue;
                }

                this.visitNode(child, {
                    ...state,
                    currentFunction: functionSymbol,
                    parentKind: node.kind
                });
            }
        });
    }

    private visitParameterList(node: SyntaxNode, currentFunction: Symbol): void {
        for (const child of node.children) {
            if (child.kind !== SyntaxKind.ParameterDeclaration) {
                continue;
            }

            const parameterName = this.getNodeName(child);
            if (!parameterName) {
                continue;
            }

            const identifier = this.findFirstChild(child, SyntaxKind.Identifier);
            const typeReference = this.findFirstChild(child, SyntaxKind.TypeReference);
            const parameterSymbol: Symbol = {
                name: parameterName,
                type: SymbolType.PARAMETER,
                dataType: this.resolveDeclaredType(typeReference, this.getPointerCount(child), 'mixed'),
                range: child.range,
                selectionRange: identifier?.range,
                scope: this.symbolTable.getCurrentScope(),
                definition: this.getTrimmedNodeText(child) || undefined
            };

            this.symbolTable.addSymbol(parameterSymbol);
            currentFunction.parameters = currentFunction.parameters || [];
            currentFunction.parameters.push(parameterSymbol);
        }
    }

    private visitVariableDeclaration(node: SyntaxNode): void {
        const typeReference = this.findFirstChild(node, SyntaxKind.TypeReference);
        const modifierList = this.findFirstChild(node, SyntaxKind.ModifierList);
        const modifiers = this.readModifiers(modifierList);

        for (const child of node.children) {
            if (child.kind !== SyntaxKind.VariableDeclarator) {
                continue;
            }

            const variableName = this.getNodeName(child);
            if (!variableName) {
                continue;
            }

            const identifier = this.findFirstChild(child, SyntaxKind.Identifier);
            const variableSymbol: Symbol = {
                name: variableName,
                type: SymbolType.VARIABLE,
                dataType: this.resolveDeclaredType(typeReference, this.getPointerCount(child), 'mixed'),
                range: child.range,
                selectionRange: identifier?.range,
                scope: this.symbolTable.getCurrentScope(),
                modifiers,
                definition: this.buildVariableDefinition(node, child, typeReference, modifiers) || undefined
            };

            this.symbolTable.addSymbol(variableSymbol);
        }
    }

    private visitStandaloneVariableDeclarator(node: SyntaxNode, state: TraversalState): void {
        const variableName = this.getNodeName(node);
        if (!variableName) {
            this.visitChildren(node, state);
            return;
        }

        const identifier = this.findFirstChild(node, SyntaxKind.Identifier);
        const typeReference = this.findFirstChild(node, SyntaxKind.TypeReference);
        const documentation = state.parentKind === SyntaxKind.ForeachStatement
            ? 'foreach 迭代变量'
            : undefined;
        const variableSymbol: Symbol = {
            name: variableName,
            type: SymbolType.VARIABLE,
            dataType: this.resolveDeclaredType(typeReference, this.getPointerCount(node), 'mixed'),
            range: node.range,
            selectionRange: identifier?.range,
            scope: this.symbolTable.getCurrentScope(),
            definition: this.getTrimmedNodeText(node) || undefined,
            documentation
        };

        this.symbolTable.addSymbol(variableSymbol);
    }

    private visitTypeDeclaration(
        node: SyntaxNode,
        symbolType: SymbolType.STRUCT | SymbolType.CLASS,
        scopePrefix: 'struct' | 'class',
        state: TraversalState
    ): void {
        const typeName = this.getNodeName(node);
        if (!typeName) {
            this.visitChildren(node, state);
            return;
        }

        const identifier = this.findFirstChild(node, SyntaxKind.Identifier);
        const typeSymbol: Symbol = {
            name: typeName,
            type: symbolType,
            dataType: typeName,
            range: node.range,
            selectionRange: identifier?.range,
            scope: this.symbolTable.getCurrentScope(),
            members: [],
            definition: this.getTrimmedNodeText(node) || undefined
        };

        this.symbolTable.addSymbol(typeSymbol);

        this.withScope(`${scopePrefix}:${typeName}`, node.range, () => {
            for (const child of node.children) {
                if (child.kind === SyntaxKind.FieldDeclaration) {
                    this.visitFieldDeclaration(child, typeSymbol);
                    continue;
                }

                if (child.kind === SyntaxKind.Identifier) {
                    continue;
                }

                this.visitNode(child, {
                    ...state,
                    enclosingType: typeSymbol,
                    parentKind: node.kind
                });
            }
        });
    }

    private visitFieldDeclaration(node: SyntaxNode, parentType: Symbol): void {
        const memberName = this.getNodeName(node);
        if (!memberName) {
            return;
        }

        const identifier = this.findFirstChild(node, SyntaxKind.Identifier);
        const typeReference = this.findFirstChild(node, SyntaxKind.TypeReference);
        const memberSymbol: Symbol = {
            name: memberName,
            type: SymbolType.MEMBER,
            dataType: this.resolveDeclaredType(typeReference, this.getPointerCount(node), 'mixed'),
            range: node.range,
            selectionRange: identifier?.range,
            scope: this.symbolTable.getCurrentScope(),
            definition: this.getTrimmedNodeText(node) || undefined
        };

        parentType.members = parentType.members || [];
        parentType.members.push(memberSymbol);
        this.symbolTable.addSymbol(memberSymbol);
    }

    private visitInheritDirective(node: SyntaxNode): void {
        const expression = node.children[0];
        if (!expression) {
            return;
        }

        const value = this.extractDirectiveValue(expression);
        if (!value) {
            return;
        }

        const rawText = this.getTrimmedNodeText(node);
        const directive: InheritDirective = {
            rawText,
            expressionKind: this.getDirectiveExpressionKind(expression, value),
            value,
            range: node.range,
            resolvedUri: undefined,
            isResolved: false
        };

        this.inheritStatements.push(directive);
        this.symbolTable.addSymbol({
            name: value,
            type: SymbolType.INHERIT,
            dataType: 'inherit',
            range: node.range,
            scope: this.symbolTable.getCurrentScope(),
            definition: rawText || undefined,
            documentation: `继承自: ${value}`
        });
    }

    private visitIncludeDirective(node: SyntaxNode): void {
        const expression = node.children[0];
        if (!expression) {
            return;
        }

        const value = this.extractDirectiveValue(expression);
        if (!value) {
            return;
        }

        const rawText = this.getTrimmedNodeText(node);
        this.includeStatements.push({
            rawText,
            value,
            range: node.range,
            isSystemInclude: rawText.includes('<') && rawText.includes('>'),
            resolvedUri: undefined
        });
    }

    private visitScopedNode(name: string, node: SyntaxNode, state: TraversalState): void {
        this.withScope(name, node.range, () => {
            this.visitChildren(node, state);
        });
    }

    private withScope(name: string, range: vscode.Range, work: () => void): void {
        this.symbolTable.enterScope(name, range);
        try {
            work();
        } finally {
            this.symbolTable.exitScope();
        }
    }

    private collectScopeSummaries(rootScope: import('../ast/symbolTable').Scope): ScopeSummary[] {
        const summaries: ScopeSummary[] = [];
        const queue = [rootScope];

        while (queue.length > 0) {
            const currentScope = queue.shift()!;
            summaries.push({
                name: currentScope.name,
                range: currentScope.range,
                symbolNames: Array.from(currentScope.symbols.keys()),
                childScopes: currentScope.children.map((child) => child.name),
                parentScopeName: currentScope.parent?.name
            });
            queue.push(...currentScope.children);
        }

        return summaries;
    }

    private collectTypeDefinitions(): TypeDefinitionSummary[] {
        const structDefinitions = this.symbolTable
            .getSymbolsByType(SymbolType.STRUCT)
            .map((symbol) => this.toTypeDefinitionSummary(symbol, 'struct'));
        const classDefinitions = this.symbolTable
            .getSymbolsByType(SymbolType.CLASS)
            .map((symbol) => this.toTypeDefinitionSummary(symbol, 'class'));

        return [...structDefinitions, ...classDefinitions];
    }

    private collectFileGlobals(): FileGlobalSummary[] {
        return Array.from(this.symbolTable.getGlobalScope().symbols.values())
            .filter((symbol) => symbol.type === SymbolType.VARIABLE)
            .map((symbol) => ({
                name: symbol.name,
                dataType: symbol.dataType,
                sourceUri: this.syntaxDocument.uri,
                range: symbol.range,
                selectionRange: symbol.selectionRange
            }));
    }

    private toFunctionSummary(symbol: Symbol): FunctionSummary {
        return {
            name: symbol.name,
            returnType: symbol.dataType,
            parameters: (symbol.parameters || []).map((parameter) => ({
                name: parameter.name,
                dataType: parameter.dataType,
                range: parameter.range,
                documentation: parameter.documentation
            })),
            modifiers: symbol.modifiers || [],
            sourceUri: this.syntaxDocument.uri,
            range: symbol.range,
            origin: 'local',
            documentation: symbol.documentation,
            definition: symbol.definition
        };
    }

    private toTypeDefinitionSummary(
        symbol: Symbol,
        kind: TypeDefinitionSummary['kind']
    ): TypeDefinitionSummary {
        return {
            name: symbol.name,
            kind,
            members: (symbol.members || []).map((member) => ({
                name: member.name,
                dataType: member.dataType,
                range: member.range,
                documentation: member.documentation,
                definition: member.definition,
                parameters: member.parameters?.map((parameter) => ({
                    name: parameter.name,
                    dataType: parameter.dataType,
                    range: parameter.range,
                    documentation: parameter.documentation
                })),
                sourceScopeName: member.scope?.name
            })),
            sourceUri: this.syntaxDocument.uri,
            range: symbol.range,
            definition: symbol.definition
        };
    }

    private resolveDeclaredType(
        typeReference: SyntaxNode | undefined,
        additionalPointers: number,
        fallback: string
    ): string {
        const baseType = this.extractTypeText(typeReference) || fallback;
        return composeLpcType(baseType, Math.max(0, additionalPointers));
    }

    private extractTypeText(typeReference: SyntaxNode | undefined): string | undefined {
        if (!typeReference) {
            return undefined;
        }

        const metadataText = typeReference.metadata?.text;
        if (typeof metadataText === 'string' && metadataText.trim()) {
            return metadataText.trim().replace(/\s+/g, ' ');
        }

        if (typeof typeReference.name === 'string' && typeReference.name.trim()) {
            return typeReference.name.trim();
        }

        const rawText = this.getTrimmedNodeText(typeReference);
        return rawText || undefined;
    }

    private extractDirectiveValue(expression: SyntaxNode): string | null {
        const literal = this.findFirstDescendant(expression, (node) => node.kind === SyntaxKind.Literal);
        if (literal) {
            const literalText = this.getLiteralText(literal);
            if (literalText) {
                return this.unquote(literalText);
            }
        }

        const identifier = this.findFirstDescendant(expression, (node) => node.kind === SyntaxKind.Identifier);
        if (identifier) {
            const identifierName = this.getNodeName(identifier);
            if (identifierName) {
                return identifierName;
            }
        }

        const rawText = this.getTrimmedNodeText(expression);
        if (!rawText) {
            return null;
        }

        return this.isQuoted(rawText) ? this.unquote(rawText) : rawText;
    }

    private getDirectiveExpressionKind(
        expression: SyntaxNode,
        value: string
    ): InheritDirective['expressionKind'] {
        const literal = this.findFirstDescendant(expression, (node) => node.kind === SyntaxKind.Literal);
        if (literal) {
            const literalText = this.getLiteralText(literal);
            if (literalText && this.isQuoted(literalText)) {
                return 'string';
            }
        }

        const identifier = this.findFirstDescendant(expression, (node) => node.kind === SyntaxKind.Identifier);
        const identifierName = identifier ? this.getNodeName(identifier) : undefined;
        if (identifierName && /^[A-Z_][A-Z0-9_]*$/.test(identifierName)) {
            return 'macro';
        }

        const rawText = this.getTrimmedNodeText(expression);
        if (this.isQuoted(rawText)) {
            return 'string';
        }
        if (/^[A-Z_][A-Z0-9_]*$/.test(value)) {
            return 'macro';
        }

        return 'unknown';
    }

    private getLiteralText(node: SyntaxNode): string | undefined {
        const metadataText = node.metadata?.text;
        if (typeof metadataText === 'string' && metadataText.trim()) {
            return metadataText.trim();
        }

        const rawText = this.getTrimmedNodeText(node);
        return rawText || undefined;
    }

    private buildVariableDefinition(
        declaration: SyntaxNode,
        declarator: SyntaxNode,
        typeReference: SyntaxNode | undefined,
        modifiers: string[]
    ): string {
        const typeText = this.extractTypeText(typeReference) || '';
        const declaratorText = this.getTrimmedNodeText(declarator);
        const prefix = [...modifiers, typeText].filter(Boolean).join(' ').trim();

        if (!prefix) {
            return declaratorText ? `${declaratorText};` : '';
        }

        if (declaratorText) {
            return `${prefix} ${declaratorText};`;
        }

        const declarationText = this.getTrimmedNodeText(declaration);
        return declarationText || `${prefix};`;
    }

    private readModifiers(node: SyntaxNode | undefined): string[] {
        if (!node) {
            return [];
        }

        const metadataModifiers = node.metadata?.modifiers;
        if (Array.isArray(metadataModifiers)) {
            return metadataModifiers.filter((modifier): modifier is string => typeof modifier === 'string');
        }

        const modifiers: string[] = [];
        for (const child of node.children) {
            const modifierName = this.getNodeName(child);
            if (modifierName) {
                modifiers.push(modifierName);
            }
        }

        return modifiers;
    }

    private getNodeName(node: SyntaxNode): string | undefined {
        if (typeof node.name === 'string' && node.name.trim()) {
            return node.name.trim();
        }

        const identifier = this.findFirstChild(node, SyntaxKind.Identifier);
        if (identifier?.name) {
            return identifier.name;
        }

        return undefined;
    }

    private getPointerCount(node: SyntaxNode): number {
        const pointerCount = node.metadata?.pointerCount;
        return typeof pointerCount === 'number' && Number.isFinite(pointerCount) && pointerCount > 0
            ? pointerCount
            : 0;
    }

    private hasFunctionBody(node: SyntaxNode): boolean {
        return node.metadata?.hasBody === true || this.findFirstChild(node, SyntaxKind.Block) !== undefined;
    }

    private findFirstChild(node: SyntaxNode, kind: SyntaxKind): SyntaxNode | undefined {
        return node.children.find((child) => child.kind === kind);
    }

    private findFirstDescendant(
        root: SyntaxNode,
        predicate: (node: SyntaxNode) => boolean
    ): SyntaxNode | undefined {
        const stack: SyntaxNode[] = [root];

        while (stack.length > 0) {
            const current = stack.pop()!;
            if (predicate(current)) {
                return current;
            }

            for (let index = current.children.length - 1; index >= 0; index -= 1) {
                stack.push(current.children[index]);
            }
        }

        return undefined;
    }

    private getTrimmedNodeText(node: SyntaxNode): string {
        return this.getNodeText(node).trim();
    }

    private getNodeText(node: SyntaxNode): string {
        const text = this.syntaxDocument.parsed.text;
        const startOffset = this.offsetAt(node.range.start);
        const endOffset = this.offsetAt(node.range.end);

        if (endOffset <= startOffset) {
            return '';
        }

        return text.slice(startOffset, endOffset);
    }

    private offsetAt(position: vscode.Position): number {
        const textLength = this.syntaxDocument.parsed.text.length;
        if (position.line < 0) {
            return 0;
        }

        if (position.line >= this.lineStartOffsets.length) {
            return textLength;
        }

        const lineStart = this.lineStartOffsets[position.line];
        const offset = lineStart + Math.max(0, position.character);
        return Math.max(0, Math.min(offset, textLength));
    }

    private isQuoted(value: string): boolean {
        return (
            (value.startsWith('"') && value.endsWith('"'))
            || (value.startsWith('\'') && value.endsWith('\''))
        );
    }

    private unquote(value: string): string {
        return this.isQuoted(value) ? value.slice(1, -1) : value;
    }
}

function buildLineStartOffsets(text: string): number[] {
    const offsets = [0];

    for (let index = 0; index < text.length; index += 1) {
        if (text[index] === '\n') {
            offsets.push(index + 1);
        }
    }

    return offsets;
}
