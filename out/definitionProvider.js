"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LPCDefinitionProvider = void 0;
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
class LPCDefinitionProvider {
    constructor(macroManager) {
        this.macroManager = macroManager;
    }
    async provideDefinition(document, position, token) {
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
        // 2. 检查是否是函数定义
        const functionDef = await this.findFunctionDefinition(word, document);
        if (functionDef) {
            return functionDef;
        }
        // 3. 检查是否是变量定义
        const variableDef = await this.findVariableDefinition(word, document, position);
        if (variableDef) {
            return variableDef;
        }
        // 4. 检查是否是继承的对象
        const inheritDef = await this.findInheritDefinition(word, document);
        if (inheritDef) {
            return inheritDef;
        }
        return undefined;
    }
    async findFunctionDefinition(functionName, document) {
        const text = document.getText();
        // 匹配函数定义（不带分号结尾）
        const functionDefRegex = new RegExp(`^\\s*(?:private|public|protected|static|nomask|varargs)?\\s*` +
            `(?:void|int|string|object|mapping|mixed|float|buffer)\\s+` +
            `${functionName}\\s*\\([^;{]*\\{`, 'gm');
        // 首先在当前文件中查找函数定义
        const defMatch = functionDefRegex.exec(text);
        if (defMatch) {
            const startPos = document.positionAt(defMatch.index);
            const endPos = document.positionAt(defMatch.index + defMatch[0].length);
            const range = new vscode.Range(startPos, endPos);
            return new vscode.Location(document.uri, range);
        }
        // 如果在当前文件中没找到，查找所有继承的文件
        const inheritedFiles = await this.findInheritedFiles(document);
        for (const file of inheritedFiles) {
            try {
                const inheritedDoc = await vscode.workspace.openTextDocument(file);
                const inheritedText = inheritedDoc.getText();
                const inheritedMatch = functionDefRegex.exec(inheritedText);
                if (inheritedMatch) {
                    const startPos = inheritedDoc.positionAt(inheritedMatch.index);
                    const endPos = inheritedDoc.positionAt(inheritedMatch.index + inheritedMatch[0].length);
                    const range = new vscode.Range(startPos, endPos);
                    return new vscode.Location(inheritedDoc.uri, range);
                }
            }
            catch (error) {
                console.error(`Error searching in inherited file: ${file}`, error);
            }
        }
        // 如果还是没找到，查找函数声明
        const functionDeclRegex = new RegExp(`^\\s*(?:private|public|protected|static|nomask|varargs)?\\s*` +
            `(?:void|int|string|object|mapping|mixed|float|buffer)\\s+` +
            `${functionName}\\s*\\([^;{]*;`, 'gm');
        const declMatch = functionDeclRegex.exec(text);
        if (declMatch) {
            const startPos = document.positionAt(declMatch.index);
            const endPos = document.positionAt(declMatch.index + declMatch[0].length);
            const range = new vscode.Range(startPos, endPos);
            return new vscode.Location(document.uri, range);
        }
        return undefined;
    }
    async findVariableDefinition(variableName, document, position) {
        const text = document.getText();
        // 1. 首先检查局部变量
        const functionText = this.getFunctionText(text, position);
        if (functionText) {
            const localVarRegex = new RegExp(`\\b(?:int|string|object|mapping|mixed|float|buffer)\\s+` +
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
            `(?:int|string|object|mapping|mixed|float|buffer)\\s+` +
            `(?:\\*\\s*)?${variableName}\\b[^;]*;`, 'gm');
        const globalMatch = globalVarRegex.exec(text);
        if (globalMatch) {
            const startPos = document.positionAt(globalMatch.index);
            const endPos = document.positionAt(globalMatch.index + globalMatch[0].length);
            return new vscode.Location(document.uri, new vscode.Range(startPos, endPos));
        }
        return undefined;
    }
    async findInheritDefinition(className, document) {
        const text = document.getText();
        // 匹配 inherit 语句，支持多种形式
        const inheritRegex = /\binherit\s+([A-Z_][A-Z0-9_]*)\s*;/g;
        let match;
        while ((match = inheritRegex.exec(text)) !== null) {
            const inheritName = match[1];
            if (inheritName === className) {
                // 1. 首先检查是否是宏定义
                const macro = this.macroManager.getMacro(inheritName);
                if (macro) {
                    // 获取宏定义的实际文件路径
                    const macroValue = macro.value.trim().replace(/['"]/g, '');
                    if (macroValue.startsWith('/')) {
                        // 在工作区中查找对应的文件
                        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                        if (workspaceFolder) {
                            const fullPath = path.join(workspaceFolder.uri.fsPath, macroValue + '.c');
                            try {
                                const inheritedDoc = await vscode.workspace.openTextDocument(fullPath);
                                return new vscode.Location(inheritedDoc.uri, new vscode.Position(0, 0));
                            }
                            catch (error) {
                                console.error(`Error opening inherited file: ${fullPath}`, error);
                            }
                        }
                    }
                }
                // 2. 如果不是宏定义，尝试直接查找文件
                const files = await vscode.workspace.findFiles(`**/${className.toLowerCase()}.{c,h}`, '**/node_modules/**');
                if (files.length > 0) {
                    return new vscode.Location(files[0], new vscode.Position(0, 0));
                }
            }
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
            if (line.includes('{')) {
                bracketCount++;
                if (bracketCount === 1) {
                    functionStart = i;
                    break;
                }
            }
            if (line.includes('}')) {
                bracketCount--;
            }
        }
        // 向下查找函数结束
        bracketCount = 0;
        for (let i = position.line; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes('{')) {
                bracketCount++;
            }
            if (line.includes('}')) {
                bracketCount--;
                if (bracketCount === 0) {
                    functionEnd = i;
                    break;
                }
            }
        }
        if (functionStart !== -1 && functionEnd !== -1) {
            const startOffset = lines.slice(0, functionStart).join('\n').length;
            const functionText = lines.slice(functionStart, functionEnd + 1).join('\n');
            return { text: functionText, start: startOffset };
        }
        return undefined;
    }
    async findInheritedFiles(document) {
        const text = document.getText();
        const inheritRegex = /\binherit\s+([A-Z_][A-Z0-9_]*)\s*;/g;
        const files = [];
        let match;
        while ((match = inheritRegex.exec(text)) !== null) {
            const inheritName = match[1];
            // 检查是否是宏定义
            const macro = this.macroManager.getMacro(inheritName);
            if (macro) {
                const macroValue = macro.value.trim().replace(/['"]/g, '');
                if (macroValue.startsWith('/')) {
                    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                    if (workspaceFolder) {
                        const fullPath = path.join(workspaceFolder.uri.fsPath, macroValue + '.c');
                        if (fs.existsSync(fullPath)) {
                            files.push(fullPath);
                        }
                    }
                }
            }
            else {
                // 如果不是宏定义，尝试直接查找文件
                const inheritedFiles = await vscode.workspace.findFiles(`**/${inheritName.toLowerCase()}.{c,h}`, '**/node_modules/**');
                files.push(...inheritedFiles.map(f => f.fsPath));
            }
        }
        return files;
    }
}
exports.LPCDefinitionProvider = LPCDefinitionProvider;
//# sourceMappingURL=definitionProvider.js.map