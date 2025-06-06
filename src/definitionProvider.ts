import * as vscode from 'vscode';
import { MacroManager } from './macroManager';
import { EfunDocsManager } from './efunDocs';
import * as path from 'path';
import * as fs from 'fs';

// ANTLR and Symbol Table Imports
import { CharStreams, CommonTokenStream, Token } from 'antlr4';
import { ParseTreeWalker, TerminalNode, ParseTree } from 'antlr4/src/antlr4/tree/Tree';
import LPCLexer from '../../out/parser/LPCLexer.js';
import LPCParser, { ProgramContext } from '../../out/parser/LPCParser.js'; // Assuming ProgramContext is the root
import { LPCSymbolTableListener } from '../parser/lpcSymbolTableListener';
import { LPCSymbol, Scope } from '../parser/symbolTable';


// Helper function to find the ParseTree node at a given offset (simplified)
// Note: In ANTLR, ParseTree is an interface. Common specific types are ParserRuleContext and TerminalNode.
function findNodeAtOffset(node: ParseTree | null, offset: number): ParseTree | null {
    if (!node) return null;

    let nodeStartOffset = -1;
    let nodeEndOffset = -1;

    if (node instanceof TerminalNode) {
        nodeStartOffset = node.getSymbol().start;
        nodeEndOffset = node.getSymbol().stop;
    } else if (node instanceof LPCParser.ruleContexts.ProgramContext || node instanceof LPCParser.ruleContexts.FunctionDefinitionContext /* add other relevant contexts */) {
        // Check if it's a ParserRuleContext, which has start and stop tokens
        const prc = node as any; // Cast to access start/stop if not directly on ParseTree type
        if (prc.start && prc.stop) {
            nodeStartOffset = prc.start.start;
            nodeEndOffset = prc.stop.stop;
        } else if (prc.start) { // For rules that might only have a start token in some cases
            nodeStartOffset = prc.start.start;
            nodeEndOffset = prc.start.stop;
        }
    } else if (node.getPayload && typeof node.getPayload === 'function') {
        // Fallback for other ParseTree types that might have a single token
        const token = node.getPayload() as Token;
        if (token && token.start !== undefined) {
            nodeStartOffset = token.start;
            nodeEndOffset = token.stop;
        }
    }


    if (nodeStartOffset !== -1 && nodeEndOffset !== -1) {
        if (offset >= nodeStartOffset && offset <= nodeEndOffset) {
            if (node.getChildCount && node.getChildCount() > 0) {
                for (let i = 0; i < node.getChildCount(); i++) {
                    const child = node.getChild(i);
                    if (child) { // Ensure child is not null
                        const childResult = findNodeAtOffset(child, offset);
                        if (childResult) return childResult;
                    }
                }
            }
            return node;
        }
    }
    return null;
}


export class LPCDefinitionProvider implements vscode.DefinitionProvider {
    private macroManager: MacroManager;
    private efunDocsManager: EfunDocsManager;
    private processedFiles: Set<string> = new Set();
    private functionDefinitions: Map<string, vscode.Location> = new Map();

    constructor(macroManager: MacroManager, efunDocsManager: EfunDocsManager) {
        this.macroManager = macroManager;
        this.efunDocsManager = efunDocsManager;
    }

    async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Location | vscode.Location[] | undefined> {
        // 获取当前光标所在的单词
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return undefined;
        }

        const word = document.getText(wordRange);
        const line = document.lineAt(position.line).text;

        // Check for "->" operator
        if (line.includes('->')) {
            const regex = new RegExp(`([a-zA-Z_][a-zA-Z0-9_]*|\\"(?:\\\\.|[^\\"])*\\")\\s*->\\s*${word}`);
            const match = regex.exec(line);
            if (match) {
                const targetObject = match[1].trim();
                const functionName = word; // functionName is the 'word' clicked on

                // Check if targetObject is a string literal (file path)
                const stringLiteralRegex = /^"(.*)"$/;
                const stringMatch = stringLiteralRegex.exec(targetObject);

                if (stringMatch) {
                    let extractedPath = stringMatch[1];

                    // Normalize path: append .c if not present
                    if (!extractedPath.endsWith('.c')) {
                        extractedPath += '.c';
                    }

                    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
                    if (workspaceFolder) {
                        // Handle both /path/file and path/file as relative to workspace root
                        const fullPathUri = vscode.Uri.joinPath(
                            workspaceFolder.uri,
                            extractedPath.startsWith('/') ? extractedPath.substring(1) : extractedPath
                        );

                        if (fs.existsSync(fullPathUri.fsPath)) {
                            try {
                                const fileContent = await vscode.workspace.fs.readFile(fullPathUri);
                                const text = Buffer.from(fileContent).toString('utf8');

                                // Search for the functionName in the text
                                // Ensure word in regex is properly escaped if it can contain special characters.
                                // For simplicity, assuming 'word' is a simple identifier.
                                const functionRegex = new RegExp(
                                    `(?:(?:private|public|protected|static|nomask|varargs)\\s+)*` +
                                    `(?:void|int|string|object|mapping|mixed|float|buffer)\\s+` +
                                    `${functionName}\\s*\\([^)]*\\)`, // Using functionName (word) directly
                                    'g'
                                );

                                const location = await this._findFunctionInFile(fullPathUri, functionName);
                                if (location) {
                                    return location;
                                }
                            } catch (error) {
                                console.error(`Error processing file for "->" operator: ${fullPathUri.fsPath}`, error);
                                // Fall through to other checks if file processing fails
                            }
                        }
                    }
                } else if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(targetObject)) {
                    // targetObject is an identifier, possibly a macro
                    const macro = this.macroManager.getMacro(targetObject);
                    if (macro && macro.value) {
                        let macroPath = macro.value.replace(/^"(.*)"$/, '$1'); // Remove quotes

                        if (!macroPath.endsWith('.c')) {
                            macroPath += '.c';
                        }

                        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
                        if (workspaceFolder) {
                            let resolvedPath = macroPath;
                            // If macroPath looks absolute (e.g. "/include/foo.c"), treat it as relative to workspace root
                            if (resolvedPath.startsWith('/')) {
                                resolvedPath = resolvedPath.substring(1);
                            }
                            const fullPathUri = vscode.Uri.joinPath(workspaceFolder.uri, resolvedPath);

                            if (fs.existsSync(fullPathUri.fsPath)) {
                                try {
                                    const location = await this._findFunctionInFile(fullPathUri, functionName);
                                    if (location) {
                                        return location;
                                    }
                                } catch (error) {
                                    console.error(`Error processing file from macro for "->" operator: ${fullPathUri.fsPath}`, error);
                                }
                            }
                        }
                    }
                } else {
                    // If targetObject is not a string literal or a recognized identifier (macro),
                    // or if any step above failed, log and fall through.
                    console.log(`Found "->" operator. Target object: ${targetObject}, Function name: ${functionName}. No definition found via string or macro path.`);
                }
            }
        }

        // 1. 检查是否是宏定义
        const macro = this.macroManager.getMacro(word);
        if (macro) {
            const uri = vscode.Uri.file(macro.file);
            const startPos = new vscode.Position(macro.line - 1, 0);
            // 获取整行内容以创建高亮范围
            const macroDoc = await vscode.workspace.openTextDocument(uri);
            const macroLine = macroDoc.lineAt(macro.line - 1);
            const endPos = new vscode.Position(macro.line - 1, macroLine.text.length);
            return new vscode.Location(uri, new vscode.Range(startPos, endPos));
        }

        // 2. 检查是否是模拟函数库中的函数
        const simulatedDoc = this.efunDocsManager.getSimulatedDoc(word);
        if (simulatedDoc) {
            const config = vscode.workspace.getConfiguration();
            const simulatedEfunsPath = config.get<string>('lpc.simulatedEfunsPath');
            if (simulatedEfunsPath) {
                const files = await vscode.workspace.findFiles(
                    new vscode.RelativePattern(simulatedEfunsPath, '**/*.{c,h}')
                );
                
                for (const file of files) {
                    const content = await vscode.workspace.fs.readFile(file);
                    const text = Buffer.from(content).toString('utf8');
                    
                    // 查找函数定义
                    const functionRegex = new RegExp(
                        `(?:(?:private|public|protected|static|nomask|varargs)\\s+)*` +
                        `(?:void|int|string|object|mapping|mixed|float|buffer)\\s+` +
                        `(?:\\*\\s*)?${word}\\s*\\([^)]*\\)`,
                        'g'
                    );
                    
                    const match = functionRegex.exec(text);
                    if (match) {
                        const startPos = new vscode.Position(
                            text.substring(0, match.index).split('\n').length - 1,
                            0
                        );
                        const endPos = new vscode.Position(
                            text.substring(0, match.index + match[0].length).split('\n').length - 1,
                            match[0].length
                        );
                        return new vscode.Location(file, new vscode.Range(startPos, endPos));
                    }
                }
            }
        }

        // 清除之前的缓存
        this.processedFiles.clear();
        this.functionDefinitions.clear();

        // 3. 检查是否是函数定义
        await this.findFunctionDefinitions(document);
        if (!this.functionDefinitions.has(word)) {
            await this.findInheritedFunctionDefinitions(document);
        }
        const functionDef = this.functionDefinitions.get(word);
        if (functionDef) {
            return functionDef;
        }

        // 4. 检查是否是变量定义
        const variableDef = await this.findVariableDefinition(word, document, position);
        if (variableDef) {
            return variableDef;
        }

        return undefined;
    }

    // Helper to find the most specific scope at a given text offset
    private findScopeAtOffset(startingScope: Scope, offset: number): Scope {
        let bestMatch: Scope = startingScope;

        function findRecursive(currentScope: Scope) {
            const scopeNode = currentScope.scopeNode; // This is a ParseTree
            let nodeStartOffset = -1;
            let nodeEndOffset = -1;

            if (scopeNode instanceof AntlrParserRuleContext) { // Generic ANTLR ParserRuleContext
                if (scopeNode.start && scopeNode.stop) {
                    nodeStartOffset = scopeNode.start.start;
                    nodeEndOffset = scopeNode.stop.stop;
                } else if (scopeNode.start) {
                    nodeStartOffset = scopeNode.start.start;
                    nodeEndOffset = scopeNode.start.stop;
                }
            } else if (scopeNode instanceof TerminalNode) {
                nodeStartOffset = scopeNode.getSymbol().start;
                nodeEndOffset = scopeNode.getSymbol().stop;
            }

            if (nodeStartOffset !== -1 && nodeEndOffset !== -1 && offset >= nodeStartOffset && offset <= nodeEndOffset) {
                bestMatch = currentScope;
                for (const childScope of currentScope.children) {
                    findRecursive(childScope);
                }
            }
        }

        if (startingScope.scopeNode) {
            findRecursive(startingScope);
        }
        return bestMatch;
    }

    private _offsetToPosition(docText: string, offset: number): vscode.Position {
        const before = docText.substring(0, offset);
        const lines = before.split('\n');
        const line = lines.length - 1;
        const character = lines[line].length;
        return new vscode.Position(line, character);
    }

    private async _findFunctionInFile(fileUri: vscode.Uri, functionName: string): Promise<vscode.Location | undefined> {
        try {
            const fileContent = await vscode.workspace.fs.readFile(fileUri);
            const text = Buffer.from(fileContent).toString('utf8');

            const functionRegex = new RegExp(
                `(?:(?:private|public|protected|static|nomask|varargs)\\s+)*` +
                `(?:void|int|string|object|mapping|mixed|float|buffer)\\s+` +
                `${functionName}\\s*\\([^)]*\\)`,
                'g'
            );

            const funcMatch = functionRegex.exec(text);
            if (funcMatch) {
                const defStartPos = this._offsetToPosition(text, funcMatch.index);
                const defEndPos = this._offsetToPosition(text, funcMatch.index + funcMatch[0].length);
                return new vscode.Location(fileUri, new vscode.Range(defStartPos, defEndPos));
            }
        } catch (error) {
            console.error(`Error reading or processing file ${fileUri.fsPath}:`, error);
        }
        return undefined;
    }

    private async findVariableDefinition(
        variableName: string,
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<vscode.Location | undefined> {
        const text = document.getText();
        const lines = text.split('\n');

        // 1. 首先检查局部变量
        const functionText = this.getFunctionText(text, position);
        if (functionText) {
            // 匹配局部变量定义，支持所有LPC类型和数组声明
            const localVarRegex = new RegExp(
                `\\b(?:int|string|object|mapping|mixed|float|buffer|array)\\s+` +
                `(?:\\*\\s*)?${variableName}\\b[^;]*;`,
                'g'
            );
            const match = localVarRegex.exec(functionText.text);
            if (match) {
                const startPos = document.positionAt(functionText.start + match.index);
                const endPos = document.positionAt(functionText.start + match.index + match[0].length);
                return new vscode.Location(document.uri, new vscode.Range(startPos, endPos));
            }
        }

        // 2. 检查全局变量
        const globalVarRegex = new RegExp(
            `^\\s*(?:private|public|protected|nosave)?\\s*` +
            `(?:int|string|object|mapping|mixed|float|buffer|array)\\s+` +
            `(?:\\*\\s*)?${variableName}\\b[^;]*;`,
            'gm'
        );
        const globalMatch = globalVarRegex.exec(text);
        if (globalMatch) {
            const startPos = document.positionAt(globalMatch.index);
            const endPos = document.positionAt(globalMatch.index + globalMatch[0].length);
            return new vscode.Location(document.uri, new vscode.Range(startPos, endPos));
        }

        // 3. 检查继承文件中的变量定义
        const inheritedVarDef = await this.findInheritedVariableDefinition(document, variableName);
        if (inheritedVarDef) {
            return inheritedVarDef;
        }

        return undefined;
    }

    private getFunctionText(text: string, position: vscode.Position): { text: string, start: number } | undefined {
        const lines = text.split('\n');
        let bracketCount = 0;
        let functionStart = -1;
        let functionEnd = -1;

        // 向上查找函数开始
        for (let i = position.line; i >= 0; i--) {
            const line = lines[i];
            const openCount = (line.match(/{/g) || []).length;
            const closeCount = (line.match(/}/g) || []).length;
            bracketCount += openCount - closeCount;

            if (bracketCount === 1 && openCount > 0) {
                functionStart = i;
                break;
            }
        }

        if (functionStart === -1) return undefined;

        // 向下查找函数结束
        bracketCount = 1;
        for (let i = functionStart + 1; i < lines.length; i++) {
            const line = lines[i];
            const openCount = (line.match(/{/g) || []).length;
            const closeCount = (line.match(/}/g) || []).length;
            bracketCount += openCount - closeCount;

            if (bracketCount === 0) {
                functionEnd = i;
                break;
            }
        }

        if (functionStart !== -1 && functionEnd !== -1) {
            const startOffset = lines.slice(0, functionStart).join('\n').length;
            const functionText = lines.slice(functionStart, functionEnd + 1).join('\n');
            return { text: functionText, start: startOffset };
        }

        return undefined;
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
                let inheritedFile = match[1];
                
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
                            console.error(`Error reading inherited file: ${filePath}`, error);
                        }
                        break;
                    }
                }
            }
        }

        return undefined;
    }

    private async findFunctionDefinitions(document: vscode.TextDocument): Promise<void> {
        const text = document.getText();
        
        // 匹配函数定义，支持各种修饰符和返回类型
        const functionRegex = /(?:(?:private|public|protected|static|nomask|varargs)\s+)*(?:void|int|string|object|mapping|mixed|float|buffer)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)/g;
        
        let match;
        while ((match = functionRegex.exec(text)) !== null) {
            const functionName = match[1];
            const startPos = document.positionAt(match.index);
            const endPos = document.positionAt(match.index + match[0].length);
            
            this.functionDefinitions.set(functionName, new vscode.Location(
                document.uri,
                new vscode.Range(startPos, endPos)
            ));
        }
    }

    private async findInheritedFunctionDefinitions(document: vscode.TextDocument): Promise<void> {
        const text = document.getText();
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) return;

        // 如果这个文件已经处理过，就跳过
        if (this.processedFiles.has(document.uri.fsPath)) {
            return;
        }
        this.processedFiles.add(document.uri.fsPath);

        // 支持两种继承语法
        const inheritRegexes = [
            /inherit\s+"([^"]+)"/g,
            /inherit\s+([A-Z_][A-Z0-9_]*)\s*;/g
        ];

        for (const inheritRegex of inheritRegexes) {
            let match;
            while ((match = inheritRegex.exec(text)) !== null) {
                let inheritedFile = match[1];
                
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

                // 去重路径
                const uniquePaths = [...new Set(possiblePaths)];

                for (const filePath of uniquePaths) {
                    if (fs.existsSync(filePath) && !this.processedFiles.has(filePath)) {
                        try {
                            const inheritedDoc = await vscode.workspace.openTextDocument(filePath);
                            await this.findFunctionDefinitions(inheritedDoc);
                            // 递归处理继承的文件
                            await this.findInheritedFunctionDefinitions(inheritedDoc);
                        } catch (error) {
                            console.error(`Error reading inherited file: ${filePath}`, error);
                        }
                        break;
                    }
                }
            }
        }
    }
} 