"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LPCDefinitionProvider = void 0;
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
class LPCDefinitionProvider {
    constructor(macroManager) {
        this.processedFiles = new Set();
        this.functionDefinitions = new Map();
        this.macroManager = macroManager;
    }
    async provideDefinition(document, position, token) {
        // 获取当前光标所在的单词
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return undefined;
        }
        const word = document.getText(wordRange);
        const line = document.lineAt(position.line).text;
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
        // 清除之前的缓存
        this.processedFiles.clear();
        this.functionDefinitions.clear();
        // 2. 检查是否是函数定义
        await this.findFunctionDefinitions(document);
        if (!this.functionDefinitions.has(word)) {
            await this.findInheritedFunctionDefinitions(document);
        }
        const functionDef = this.functionDefinitions.get(word);
        if (functionDef) {
            return functionDef;
        }
        // 3. 检查是否是变量定义
        const variableDef = await this.findVariableDefinition(word, document, position);
        if (variableDef) {
            return variableDef;
        }
        return undefined;
    }
    async findVariableDefinition(variableName, document, position) {
        const text = document.getText();
        const lines = text.split('\n');
        // 1. 首先检查局部变量
        const functionText = this.getFunctionText(text, position);
        if (functionText) {
            // 匹配局部变量定义，支持所有LPC类型和数组声明
            const localVarRegex = new RegExp(`\\b(?:int|string|object|mapping|mixed|float|buffer|array)\\s+` +
                `(?:\\*\\s*)?${variableName}\\b[^;]*;`, 'g');
            const match = localVarRegex.exec(functionText.text);
            if (match) {
                const startPos = document.positionAt(functionText.start + match.index);
                const endPos = document.positionAt(functionText.start + match.index + match[0].length);
                return new vscode.Location(document.uri, new vscode.Range(startPos, endPos));
            }
        }
        // 2. 检查全局变量
        const globalVarRegex = new RegExp(`^\\s*(?:private|public|protected|nosave)?\\s*` +
            `(?:int|string|object|mapping|mixed|float|buffer|array)\\s+` +
            `(?:\\*\\s*)?${variableName}\\b[^;]*;`, 'gm');
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
    getFunctionText(text, position) {
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
        if (functionStart === -1)
            return undefined;
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
    async findInheritedVariableDefinition(document, variableName) {
        const text = document.getText();
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder)
            return;
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
                    }
                    else {
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
                    possiblePaths.push(path.join(workspaceFolder.uri.fsPath, relativePath), path.join(workspaceFolder.uri.fsPath, relativePath.replace('.c', '')));
                }
                else {
                    possiblePaths.push(path.join(path.dirname(document.uri.fsPath), inheritedFile), path.join(path.dirname(document.uri.fsPath), inheritedFile.replace('.c', '')), path.join(workspaceFolder.uri.fsPath, inheritedFile), path.join(workspaceFolder.uri.fsPath, inheritedFile.replace('.c', '')));
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
                        }
                        catch (error) {
                            console.error(`Error reading inherited file: ${filePath}`, error);
                        }
                        break;
                    }
                }
            }
        }
        return undefined;
    }
    async findFunctionDefinitions(document) {
        const text = document.getText();
        // 匹配函数定义，支持各种修饰符和返回类型
        const functionRegex = /(?:(?:private|public|protected|static|nomask|varargs)\s+)*(?:void|int|string|object|mapping|mixed|float|buffer)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)/g;
        let match;
        while ((match = functionRegex.exec(text)) !== null) {
            const functionName = match[1];
            const startPos = document.positionAt(match.index);
            const endPos = document.positionAt(match.index + match[0].length);
            this.functionDefinitions.set(functionName, new vscode.Location(document.uri, new vscode.Range(startPos, endPos)));
        }
    }
    async findInheritedFunctionDefinitions(document) {
        const text = document.getText();
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder)
            return;
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
                    }
                    else {
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
                    possiblePaths.push(path.join(workspaceFolder.uri.fsPath, relativePath), path.join(workspaceFolder.uri.fsPath, relativePath.replace('.c', '')));
                }
                else {
                    possiblePaths.push(path.join(path.dirname(document.uri.fsPath), inheritedFile), path.join(path.dirname(document.uri.fsPath), inheritedFile.replace('.c', '')), path.join(workspaceFolder.uri.fsPath, inheritedFile), path.join(workspaceFolder.uri.fsPath, inheritedFile.replace('.c', '')));
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
                        }
                        catch (error) {
                            console.error(`Error reading inherited file: ${filePath}`, error);
                        }
                        break;
                    }
                }
            }
        }
    }
}
exports.LPCDefinitionProvider = LPCDefinitionProvider;
//# sourceMappingURL=definitionProvider.js.map