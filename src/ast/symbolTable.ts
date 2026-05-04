import * as vscode from 'vscode';
export enum SymbolType {
    VARIABLE = 'variable',
    FUNCTION = 'function',
    STRUCT = 'struct',
    CLASS = 'class',
    PARAMETER = 'parameter',
    MEMBER = 'member',
    INHERIT = 'inherit'
}

export interface Symbol {
    name: string;
    type: SymbolType;
    dataType: string;
    range: vscode.Range;
    selectionRange?: vscode.Range;
    scope: Scope;
    documentation?: string;
    definition?: string;
    members?: Symbol[];
    parameters?: Symbol[];
    modifiers?: string[];
    isReference?: boolean;
    isVariadic?: boolean;
    hasDefaultValue?: boolean;
    defaultValueText?: string;
    hasBody?: boolean;
}

export interface Scope {
    name: string;
    range: vscode.Range;
    parent?: Scope;
    children: Scope[];
    symbols: Map<string, Symbol>;
}

export class SymbolTable {
    private globalScope: Scope;
    private currentScope: Scope;
    private scopes: Map<string, Scope> = new Map();

    constructor(documentUri: string) {
        this.globalScope = {
            name: 'global',
            range: new vscode.Range(0, 0, Number.MAX_VALUE, Number.MAX_VALUE),
            children: [],
            symbols: new Map()
        };
        this.currentScope = this.globalScope;
        this.scopes.set(documentUri, this.globalScope);
    }

    // 进入新的作用域
    enterScope(name: string, range: vscode.Range): Scope {
        const newScope: Scope = {
            name,
            range,
            parent: this.currentScope,
            children: [],
            symbols: new Map()
        };
        
        this.currentScope.children.push(newScope);
        this.currentScope = newScope;
        return newScope;
    }

    // 退出当前作用域
    exitScope(): void {
        if (this.currentScope.parent) {
            this.currentScope = this.currentScope.parent;
        }
    }

    // 添加符号到当前作用域
    addSymbol(symbol: Symbol, scope: Scope = this.currentScope): void {
        symbol.scope = scope;
        scope.symbols.set(symbol.name, symbol);
    }

    // 在作用域链中查找符号
    findSymbol(name: string, position?: vscode.Position): Symbol | undefined {
        let scope: Scope | undefined = position ? this.findScopeAt(position) : this.currentScope;
        
        while (scope) {
            const symbol = scope.symbols.get(name);
            if (symbol) {
                return symbol;
            }
            scope = scope.parent;
        }
        
        return undefined;
    }

    // 查找指定位置的作用域
    findScopeAt(position: vscode.Position): Scope {
        return this.findScopeAtRecursive(this.globalScope, position) || this.globalScope;
    }

    private findScopeAtRecursive(scope: Scope, position: vscode.Position): Scope | undefined {
        if (!scope.range.contains(position)) {
            return undefined;
        }

        // 查找最深的匹配作用域
        for (const child of scope.children) {
            const found = this.findScopeAtRecursive(child, position);
            if (found) {
                return found;
            }
        }

        return scope;
    }

    // 获取作用域中的所有符号
    getSymbolsInScope(position: vscode.Position): Symbol[] {
        const symbols: Symbol[] = [];
        let scope: Scope | undefined = this.findScopeAt(position);

        while (scope) {
            for (const symbol of scope.symbols.values()) {
                symbols.push(symbol);
            }
            scope = scope.parent;
        }

        return symbols;
    }

    // 获取特定类型的符号
    getSymbolsByType(symbolType: SymbolType, position?: vscode.Position): Symbol[] {
        const allSymbols = position ? this.getSymbolsInScope(position) : Array.from(this.globalScope.symbols.values());
        return allSymbols.filter(symbol => symbol.type === symbolType);
    }

    // 获取符号表中的所有符号（按作用域树遍历）
    getAllSymbols(): Symbol[] {
        const symbols: Symbol[] = [];
        const queue: Scope[] = [this.globalScope];

        while (queue.length > 0) {
            const currentScope = queue.shift()!;
            symbols.push(...currentScope.symbols.values());
            queue.push(...currentScope.children);
        }

        return symbols;
    }

    // 查找结构体定义
    findStructDefinition(typeName: string): Symbol | undefined {
        return this.findSymbolRecursive(this.globalScope, typeName, SymbolType.STRUCT) ||
               this.findSymbolRecursive(this.globalScope, typeName, SymbolType.CLASS);
    }

    private findSymbolRecursive(scope: Scope, name: string, type: SymbolType): Symbol | undefined {
        for (const symbol of scope.symbols.values()) {
            if (symbol.name === name && symbol.type === type) {
                return symbol;
            }
        }

        for (const child of scope.children) {
            const found = this.findSymbolRecursive(child, name, type);
            if (found) {
                return found;
            }
        }

        return undefined;
    }

    // 清空符号表
    clear(): void {
        this.globalScope.symbols.clear();
        this.globalScope.children = [];
        this.currentScope = this.globalScope;
    }

    // 获取全局作用域
    getGlobalScope(): Scope {
        return this.globalScope;
    }

    // 获取当前作用域
    getCurrentScope(): Scope {
        return this.currentScope;
    }

    // 获取所有继承的文件路径
    getInheritedFiles(): string[] {
        const inheritSymbols = this.getSymbolsByType(SymbolType.INHERIT);
        return inheritSymbols.map(symbol => symbol.name);
    }

    // 检查是否继承了指定文件
    isInheriting(filePath: string): boolean {
        const inheritedFiles = this.getInheritedFiles();
        return inheritedFiles.some(inherited =>
            inherited === filePath ||
            inherited.endsWith('/' + filePath) ||
            filePath.endsWith('/' + inherited)
        );
    }
}
