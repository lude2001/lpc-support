import * as vscode from 'vscode';
import { MacroManager } from './macroManager';
import { EfunDocsManager } from './efunDocs';
import * as path from 'path';
import * as fs from 'fs';
import { CommonTokenStream, Token } from 'antlr4ts';
import { LPCLexer } from './antlr/LPCLexer';
import { LPCParser, PostfixExpressionContext, IdentifierPrimaryContext, StringPrimaryContext } from './antlr/LPCParser';
import { FunctionDefContext, VariableDeclContext, VariableDeclaratorContext } from './antlr/LPCParser';
import { getParsed } from './parseCache';

interface ObjectAccessInfo {
    objectExpression: string;  // 对象表达式（可能是标识符、字符串字面量等）
    methodName: string;        // 方法名
    isMethodCall: boolean;     // 是否是方法调用（带括号）
    objectIsString: boolean;   // 对象是否是字符串字面量
    objectIsMacro: boolean;    // 对象是否是宏
}

export class LPCDefinitionProvider implements vscode.DefinitionProvider {
    private macroManager: MacroManager;
    private efunDocsManager: EfunDocsManager;
    private processedFiles: Set<string> = new Set();
    private functionDefinitions: Map<string, vscode.Location> = new Map();
    private variableDeclarations: Map<string, { loc: vscode.Location; offset: number }[]> = new Map();
    private includeFileCache = new Map<string, string[]>(); // 缓存文件的include列表

    constructor(macroManager: MacroManager, efunDocsManager: EfunDocsManager) {
        this.macroManager = macroManager;
        this.efunDocsManager = efunDocsManager;
    }

    async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Location | vscode.Location[] | undefined> {
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return undefined;
        }

        const word = document.getText(wordRange);

        // 方案1：跨文件调用 - 使用AST分析对象访问语法（如 FAMILY_D->method）
        const objectAccess = this.analyzeObjectAccessWithAST(document, position, word);
        if (objectAccess) {
            const crossFileResult = await this.handleObjectMethodCall(document, objectAccess);
            if (crossFileResult) {
                return crossFileResult;
            }
        }

        // 方案2：当前文件调用 - 在当前文件上下文中查找

        // 2.1 检查是否是宏定义
        const macro = this.macroManager.getMacro(word);
        if (macro) {
            const uri = vscode.Uri.file(macro.file);
            const startPos = new vscode.Position(macro.line - 1, 0);
            const macroDoc = await vscode.workspace.openTextDocument(uri);
            const macroLine = macroDoc.lineAt(macro.line - 1);
            const endPos = new vscode.Position(macro.line - 1, macroLine.text.length);
            return new vscode.Location(uri, new vscode.Range(startPos, endPos));
        }

        // 2.2 检查是否是模拟函数库中的函数
        const simulatedDoc = this.efunDocsManager.getSimulatedDoc(word);
        if (simulatedDoc) {
            const location = await this.findInSimulatedEfuns(word);
            if (location) {
                return location;
            }
        }

        // 2.3 检查变量声明（缓存优化）
        await this.collectVariableDeclarations(document);

        const varEntries = this.variableDeclarations.get(word);
        if (varEntries) {
            const posOffset = document.offsetAt(position);
            let best: vscode.Location | undefined;
            for (const entry of varEntries) {
                const offset = entry.offset;
                if (offset <= posOffset) {
                    if (!best || offset > document.offsetAt(best.range.start)) {
                        best = entry.loc;
                    }
                }
            }
            if (best) {
                return best;
            }
        }

        // 清除之前的缓存
        this.processedFiles.clear();
        this.functionDefinitions.clear();

        // 2.4 检查当前文件中的函数定义
        await this.findFunctionDefinitions(document);
        
        // 2.5 检查继承文件中的函数定义
        if (!this.functionDefinitions.has(word)) {
            await this.findInheritedFunctionDefinitions(document);
        }
        
        // 2.6 检查当前文件include的文件中的函数定义
        if (!this.functionDefinitions.has(word)) {
            const includeLocation = await this.findFunctionInCurrentFileIncludes(document, word);
            if (includeLocation) {
                return includeLocation;
            }
        }
        
        const functionDef = this.functionDefinitions.get(word);
        if (functionDef) {
            return functionDef;
        }

        // 2.7 检查变量定义（详细AST分析）
        const variableDef = await this.findVariableDefinition(word, document, position);
        if (variableDef) {
            return variableDef;
        }
        return undefined;
    }



    /**
     * 现代化AST分析：基于语法树的对象访问检测
     * 支持 OBJECT->method、"path"->method、OBJECT::method 等语法
     */
    private analyzeObjectAccessWithAST(
        document: vscode.TextDocument, 
        position: vscode.Position, 
        targetWord: string
    ): ObjectAccessInfo | undefined {
        try {
            const { tree } = getParsed(document);
            const targetOffset = document.offsetAt(position);
            
            // 遍历AST查找包含目标位置的PostfixExpression
            const visitor = {
                visitPostfixExpression: (ctx: PostfixExpressionContext): ObjectAccessInfo | undefined => {
                    if (!this.containsPosition(ctx, targetOffset)) return undefined;
                    
                    // 获取primary表达式（对象部分）
                    const primaryCtx = ctx.primary();
                    if (!primaryCtx) return undefined;

                    let objectExpression = '';
                    let objectIsString = false;
                    let objectIsMacro = false;

                    // 解析primary表达式
                    const primaryText = primaryCtx.text;
                    if (primaryText.startsWith('"') && primaryText.endsWith('"')) {
                        objectExpression = primaryText;
                        objectIsString = true;
                    } else if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(primaryText)) {
                        objectExpression = primaryText;
                        objectIsMacro = /^[A-Z][A-Z0-9_]*$/.test(objectExpression);
                    } else {
                        return undefined; // 不支持的primary类型
                    }

                    // 检查postfix操作符 - 根据语法 (ARROW | DOT | SCOPE) Identifier ( LPAREN argumentList? RPAREN )?
                    const arrows = ctx.ARROW();
                    const dots = ctx.DOT();
                    const scopes = ctx.SCOPE();
                    const identifiers = ctx.Identifier();

                    if (identifiers && identifiers.length > 0) {
                        // 遍历所有标识符，找到与目标词匹配且位置匹配的
                        for (const identifier of identifiers) {
                            const idStart = identifier.symbol.startIndex;
                            const idEnd = identifier.symbol.stopIndex + 1;
                            
                            if (identifier.text === targetWord && 
                                targetOffset >= idStart && 
                                targetOffset <= idEnd) {
                                
                                // 检查是否有对应的操作符
                                const hasArrow = arrows.length > 0;
                                const hasDot = dots.length > 0;
                                const hasScope = scopes.length > 0;
                                
                                if (hasArrow || hasDot || hasScope) {
                                    // 检查是否是方法调用（后面跟着括号）
                                    const isMethodCall = this.hasFollowingParen(ctx, identifier);
                                    
                                    return {
                                        objectExpression,
                                        methodName: targetWord,
                                        isMethodCall,
                                        objectIsString,
                                        objectIsMacro
                                    };
                                }
                            }
                        }
                    }

                    return undefined;
                }
            };

            // 遍历AST寻找匹配的表达式
            return this.traverseAST(tree, visitor.visitPostfixExpression);
        } catch (error) {
            return undefined;
        }
    }

    /**
     * 检查AST节点是否包含目标位置
     */
    private containsPosition(ctx: any, targetOffset: number): boolean {
        if (!ctx.start || !ctx.stop) return false;
        return targetOffset >= ctx.start.startIndex && targetOffset <= ctx.stop.stopIndex;
    }

    /**
     * 检查标识符后面是否跟着括号
     */
    private hasFollowingParen(ctx: PostfixExpressionContext, identifier: any): boolean {
        const lparens = ctx.LPAREN();
        if (lparens.length === 0) return false;
        
        const idEnd = identifier.symbol.stopIndex;
        return lparens.some(lparen => lparen.symbol.startIndex > idEnd);
    }

    /**
     * 遍历AST查找匹配项
     */
    private traverseAST<T>(node: any, visitor: (ctx: any) => T | undefined): T | undefined {
        if (!node) return undefined;

        // 检查当前节点
        if (node instanceof PostfixExpressionContext) {
            const result = visitor(node);
            if (result) return result;
        }

        // 递归检查子节点
        if (node.childCount) {
            for (let i = 0; i < node.childCount; i++) {
                const child = node.getChild(i);
                const result = this.traverseAST(child, visitor);
                if (result) return result;
            }
        }

        return undefined;
    }

    /**
     * 处理对象方法调用的定义跳转
     */
    private async handleObjectMethodCall(
        document: vscode.TextDocument, 
        objectAccess: ObjectAccessInfo
    ): Promise<vscode.Location | undefined> {
        let targetFilePath: string | undefined;

        if (objectAccess.objectIsString) {
            // 字符串字面量：解析为文件路径
            targetFilePath = this.parseStringPath(objectAccess.objectExpression);
        } else if (objectAccess.objectIsMacro) {
            // 宏：解析宏值为文件路径
            const macro = this.macroManager.getMacro(objectAccess.objectExpression);
            if (macro && macro.value) {
                targetFilePath = this.parseStringPath(macro.value);
            }
        }

        if (targetFilePath) {
            // 查找目标文件中的方法定义
            const location = await this.findMethodInFile(document, targetFilePath, objectAccess.methodName);
            if (location) {
                return location;
            }

            // 查找目标文件include的文件中的方法定义
            const includeLocation = await this.findMethodInIncludedFiles(document, targetFilePath, objectAccess.methodName);
            if (includeLocation) {
                return includeLocation;
            }
        }

        return undefined;
    }

    /**
     * 解析字符串路径
     */
    private parseStringPath(pathString: string): string {
        let cleanPath = pathString.replace(/^"(.*)"$/, '$1');
        if (!cleanPath.endsWith('.c')) {
            cleanPath += '.c';
        }
        return cleanPath;
    }

    /**
     * 在指定文件中查找方法定义
     */
    private async findMethodInFile(
        currentDocument: vscode.TextDocument,
        targetFilePath: string,
        methodName: string
    ): Promise<vscode.Location | undefined> {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(currentDocument.uri);
        if (!workspaceFolder) {
            return undefined;
        }

        // 构建完整的文件路径
        let fullPath = targetFilePath;
        if (targetFilePath.startsWith('/')) {
            fullPath = targetFilePath.substring(1);
        }
        const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, fullPath);

        if (!fs.existsSync(fileUri.fsPath)) {
            return undefined;
        }

        try {
            // 使用AST查找函数定义
            const targetDoc = await vscode.workspace.openTextDocument(fileUri);
            const { tree } = getParsed(targetDoc);
            
            for (const stmt of tree.statement()) {
                const funcCtx: FunctionDefContext | undefined = stmt.functionDef();
                if (!funcCtx) continue;

                const idToken = funcCtx.Identifier();
                if (idToken && idToken.text === methodName) {
                    const namePos = targetDoc.positionAt(idToken.symbol.startIndex);
                    return new vscode.Location(fileUri, namePos);
                }
            }
        } catch (error) {
            // 静默处理错误
        }

        return undefined;
    }

    /**
     * 在包含文件中查找方法定义
     */
    private async findMethodInIncludedFiles(
        currentDocument: vscode.TextDocument,
        targetFilePath: string,
        methodName: string
    ): Promise<vscode.Location | undefined> {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(currentDocument.uri);
        if (!workspaceFolder) {
            return undefined;
        }

        // 构建目标文件的完整路径
        let fullPath = targetFilePath;
        if (targetFilePath.startsWith('/')) {
            fullPath = targetFilePath.substring(1);
        }
        const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, fullPath);

        if (!fs.existsSync(fileUri.fsPath)) {
            return undefined;
        }

        try {
            // 获取或缓存include列表
            const includeFiles = await this.getIncludeFiles(fileUri.fsPath);
            
            // 在每个include文件中查找方法
            for (const includeFile of includeFiles) {
                const location = await this.findMethodInFile(currentDocument, includeFile, methodName);
                if (location) {
                    return location;
                }
            }
        } catch (error) {
            // 静默处理错误
        }

        return undefined;
    }

    /**
     * 获取文件的include列表
     */
    private async getIncludeFiles(filePath: string): Promise<string[]> {
        if (this.includeFileCache.has(filePath)) {
            return this.includeFileCache.get(filePath)!;
        }

        const includeFiles: string[] = [];
        
        try {
            const content = await fs.promises.readFile(filePath, 'utf-8');
            const lines = content.split('\n');

            for (const line of lines) {
                const trimmedLine = line.trim();
                // 匹配 #include "path" 或 #include <path>，允许后面有注释
                const includeMatch = trimmedLine.match(/^#include\s+[<"]([^>"]+)[>"](?:\s*\/\/.*)?$/);
                if (includeMatch) {
                    let includePath = includeMatch[1];
                    if (!includePath.endsWith('.h') && !includePath.endsWith('.c')) {
                        includePath += '.h'; // 默认为头文件
                    }
                    includeFiles.push(includePath);
                }
            }

            this.includeFileCache.set(filePath, includeFiles);
        } catch (error) {
            // 静默处理错误
        }

        return includeFiles;
    }

    /**
     * 在当前文件的include文件中查找函数定义
     */
    private async findFunctionInCurrentFileIncludes(
        document: vscode.TextDocument,
        functionName: string
    ): Promise<vscode.Location | undefined> {
        try {
            // 获取当前文件的include列表
            const includeFiles = await this.getIncludeFiles(document.uri.fsPath);
            
            // 在每个include文件中查找函数
            for (const includeFile of includeFiles) {
                const location = await this.findMethodInFile(document, includeFile, functionName);
                if (location) {
                    return location;
                }
            }
        } catch (error) {
            // 静默处理错误
        }

        return undefined;
    }

    private async findInSimulatedEfuns(word: string): Promise<vscode.Location | undefined> {
        const config = vscode.workspace.getConfiguration();
        const simulatedEfunsPath = config.get<string>('lpc.simulatedEfunsPath');
        if (!simulatedEfunsPath) return undefined;

        const files = await vscode.workspace.findFiles(
            new vscode.RelativePattern(simulatedEfunsPath, '**/*.{c,h}')
        );
        
        for (const file of files) {
            const location = await this.findFunctionInFileByAST(file, word);
            if (location) return location;
        }
        
        return undefined;
    }

    private async findFunctionInFileByAST(fileUri: vscode.Uri, functionName: string): Promise<vscode.Location | undefined> {
        try {
            const document = await vscode.workspace.openTextDocument(fileUri);
            const { tree } = getParsed(document);

            for (const stmt of tree.statement()) {
                const funcCtx: FunctionDefContext | undefined = stmt.functionDef();
                if (!funcCtx) continue;

                const idToken = funcCtx.Identifier();
                if (idToken && idToken.text === functionName) {
                    const namePos = document.positionAt(idToken.symbol.startIndex);
                    return new vscode.Location(fileUri, namePos);
                }
            }
        } catch (error) {
            // 静默处理错误
        }
        return undefined;
    }

    private async findVariableDefinition(
        variableName: string,
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<vscode.Location | undefined> {
        const { tree } = getParsed(document);
        const targetOffset = document.offsetAt(position);

        // 1. 首先查找当前函数内的局部变量和参数
        const localVarLocation = this.findLocalVariableInAST(tree, variableName, targetOffset, document);
        if (localVarLocation) {
            return localVarLocation;
        }

        // 2. 查找全局变量
        const globalVarLocation = this.findGlobalVariableInAST(tree, variableName, document);
        if (globalVarLocation) {
            return globalVarLocation;
        }

        // 3. 检查继承文件中的变量定义
        const inheritedVarDef = await this.findInheritedVariableDefinition(document, variableName);
        if (inheritedVarDef) {
            return inheritedVarDef;
        }

        return undefined;
    }

    /**
     * 在AST中查找局部变量定义（包括函数参数）
     */
    private findLocalVariableInAST(
        tree: any,
        variableName: string,
        targetOffset: number,
        document: vscode.TextDocument
    ): vscode.Location | undefined {
        // 找到包含目标位置的函数
        const containingFunction = this.findContainingFunction(tree, targetOffset);
        if (!containingFunction) {
            return undefined;
        }

        let bestMatch: { location: vscode.Location; offset: number } | undefined;

        // 查找函数参数
        const paramList = containingFunction.parameterList();
        if (paramList) {
            for (const param of paramList.parameter()) {
                const identifier = param.Identifier();
                if (identifier && identifier.text === variableName) {
                    const location = new vscode.Location(
                        document.uri,
                        document.positionAt(identifier.symbol.startIndex)
                    );
                    const offset = identifier.symbol.startIndex;
                    if (offset <= targetOffset && (!bestMatch || offset > bestMatch.offset)) {
                        bestMatch = { location, offset };
                    }
                }
            }
        }

        // 查找函数体内的局部变量声明
        const functionBody = containingFunction.block();
        if (functionBody) {
            bestMatch = this.traverseForVariableDeclarations(functionBody, variableName, targetOffset, document, bestMatch);
        }

        return bestMatch?.location;
    }

    /**
     * 在AST中查找全局变量定义
     */
    private findGlobalVariableInAST(
        tree: any,
        variableName: string,
        document: vscode.TextDocument
    ): vscode.Location | undefined {
        // 遍历顶层语句查找变量声明
        for (const stmt of tree.statement()) {
            const varDecl = stmt.variableDecl();
            if (!varDecl) continue;

            // 检查变量声明器
            for (const declarator of varDecl.variableDeclarator()) {
                const identifier = declarator.Identifier();
                if (identifier && identifier.text === variableName) {
                    return new vscode.Location(
                        document.uri,
                        document.positionAt(identifier.symbol.startIndex)
                    );
                }
            }
        }

        return undefined;
    }

    /**
     * 查找包含目标位置的函数
     */
    private findContainingFunction(tree: any, targetOffset: number): FunctionDefContext | undefined {
        for (const stmt of tree.statement()) {
            const funcDef = stmt.functionDef();
            if (!funcDef) continue;

            // 检查函数是否包含目标位置
            const funcStart = funcDef.start?.startIndex;
            const funcEnd = funcDef.stop?.stopIndex;

            if (funcStart !== undefined && funcEnd !== undefined && 
                targetOffset >= funcStart && targetOffset <= funcEnd) {
                return funcDef;
            }
        }

        return undefined;
    }

    /**
     * 遍历节点查找变量声明
     */
    private traverseForVariableDeclarations(
        node: any,
        variableName: string,
        targetOffset: number,
        document: vscode.TextDocument,
        bestMatch: { location: vscode.Location; offset: number } | undefined
    ): { location: vscode.Location; offset: number } | undefined {
        if (!node) return bestMatch;

        // 检查当前节点是否是变量声明
        if (node instanceof VariableDeclContext) {
            for (const declarator of node.variableDeclarator()) {
                const identifier = declarator.Identifier();
                if (identifier && identifier.text === variableName) {
                    const offset = identifier.symbol.startIndex;
                    // 只考虑在目标位置之前声明的变量
                    if (offset <= targetOffset && (!bestMatch || offset > bestMatch.offset)) {
                        const location = new vscode.Location(
                            document.uri,
                            document.positionAt(offset)
                        );
                        bestMatch = { location, offset };
                    }
                }
            }
        }

        // 递归遍历子节点
        if (node.childCount) {
            for (let i = 0; i < node.childCount; i++) {
                const child = node.getChild(i);
                bestMatch = this.traverseForVariableDeclarations(child, variableName, targetOffset, document, bestMatch);
            }
        }

        return bestMatch;
    }



    private async findInheritedVariableDefinition(
        document: vscode.TextDocument,
        variableName: string
    ): Promise<vscode.Location | undefined> {
        const text = document.getText();
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) return;

        // 支持两种继承语法
        const inheritRegexes = [
            /inherit\s+"([^"]+)"/g,
            /inherit\s+([A-Z_][A-Z0-9_]*)\s*;/g
        ];

        for (const inheritRegex of inheritRegexes) {
            let match;
            while ((match = inheritRegex.exec(text)) !== null) {
                let inheritedFile = match[1] ?? match[2];
                
                // 如果是宏定义形式，尝试解析宏
                if (inheritedFile.match(/^[A-Z_][A-Z0-9_]*$/)) {
                    const macro = this.macroManager.getMacro(inheritedFile);
                    if (macro) {
                        inheritedFile = macro.value.replace(/^"(.*)"$/, '$1');
                    } else {
                        continue;
                    }
                }

                // 处理文件路径
                if (!inheritedFile.endsWith('.c')) {
                    inheritedFile = inheritedFile + '.c';
                }

                // 构建可能的文件路径
                const possiblePaths = [];
                if (inheritedFile.startsWith('/')) {
                    const relativePath = inheritedFile.slice(1);
                    possiblePaths.push(
                        path.join(workspaceFolder.uri.fsPath, relativePath),
                        path.join(workspaceFolder.uri.fsPath, relativePath.replace('.c', ''))
                    );
                } else {
                    possiblePaths.push(
                        path.join(path.dirname(document.uri.fsPath), inheritedFile),
                        path.join(path.dirname(document.uri.fsPath), inheritedFile.replace('.c', '')),
                        path.join(workspaceFolder.uri.fsPath, inheritedFile),
                        path.join(workspaceFolder.uri.fsPath, inheritedFile.replace('.c', ''))
                    );
                }

                for (const filePath of possiblePaths) {
                    if (fs.existsSync(filePath) && !this.processedFiles.has(filePath)) {
                        try {
                            const inheritedDoc = await vscode.workspace.openTextDocument(filePath);
                            const varDef = await this.findVariableDefinition(variableName, inheritedDoc, new vscode.Position(0, 0));
                            if (varDef) {
                                return varDef;
                            }
                            // 递归处理继承的文件
                            const inheritedVarDef = await this.findInheritedVariableDefinition(inheritedDoc, variableName);
                            if (inheritedVarDef) {
                                return inheritedVarDef;
                            }
                                } catch (error) {
            // 静默处理错误
        }
                        break;
                    }
                }
            }
        }

        return undefined;
    }

    private async findFunctionDefinitions(document: vscode.TextDocument): Promise<void> {
        const { tree } = getParsed(document);

        for (const stmt of tree.statement()) {
            const funcCtx: FunctionDefContext | undefined = stmt.functionDef();
            if (!funcCtx) continue;

            const idToken = funcCtx.Identifier().symbol;
            const funcName = idToken.text ?? '';
            const namePos = document.positionAt(idToken.startIndex);
            const location = new vscode.Location(document.uri, namePos);
            this.functionDefinitions.set(funcName, location);
        }
    }

    private async findInheritedFunctionDefinitions(document: vscode.TextDocument): Promise<void> {
        const inherits = this.findInherits(document.getText());
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) return;

        for (const inh of inherits) {
            let path = inh;
            if (!path.endsWith('.c')) path += '.c';
            if (path.startsWith('/')) path = path.substring(1);
            const uri = vscode.Uri.joinPath(workspaceFolder.uri, path);
            if (this.processedFiles.has(uri.fsPath)) continue;
            this.processedFiles.add(uri.fsPath);

            try {
                const doc = await vscode.workspace.openTextDocument(uri);
                await this.findFunctionDefinitions(doc); // 递归解析父文件
            } catch {
                /* ignore */
            }
        }
    }

    private findInherits(text: string): Set<string> {
        const result = new Set<string>();
        const inheritRegex = /inherit\s+(?:"([^"]+)"|([A-Z_][A-Z0-9_]*))\s*;/g;
        let m: RegExpExecArray | null;
        while ((m = inheritRegex.exec(text)) !== null) {
            const file = m[1] ?? m[2];
            if (file) result.add(file);
        }
        return result;
    }

    private async collectVariableDeclarations(document: vscode.TextDocument): Promise<void> {
        if (this.processedFiles.has(document.uri.fsPath)) return;
        this.processedFiles.add(document.uri.fsPath);

        const { tree } = getParsed(document);

        const addVar = (name: string, token: any) => {
            const pos = document.positionAt(token.startIndex);
            const loc = new vscode.Location(document.uri, pos);
            const entry = { loc, offset: token.startIndex };
            if (!this.variableDeclarations.has(name)) this.variableDeclarations.set(name, []);
            this.variableDeclarations.get(name)!.push(entry);
        };

        const traverse = (ctx: any) => {
            if (!ctx) return;
            if (ctx instanceof VariableDeclContext) {
                for (const decl of ctx.variableDeclarator()) {
                    const idToken = decl.Identifier().symbol;
                    addVar(idToken.text ?? '', idToken);
                }
            } else if (ctx instanceof FunctionDefContext) {
                const params = ctx.parameterList()?.parameter() || [];
                for (const p of params) {
                    const idToken = p.Identifier()?.symbol;
                    if (!idToken) continue; // 参数可能没有名字（函数原型）
                    addVar(idToken.text ?? '', idToken);
                }
            }
            for (let i = 0; i < ctx.childCount; i++) {
                const child = ctx.getChild(i);
                traverse(child);
            }
        };

        traverse(tree);
    }
} 