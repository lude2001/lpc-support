"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LPCDefinitionProvider = void 0;
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const LPCParser_1 = require("./antlr/LPCParser");
const parseCache_1 = require("./parseCache");
class LPCDefinitionProvider {
    constructor(macroManager, efunDocsManager) {
        this.processedFiles = new Set();
        this.functionDefinitions = new Map();
        this.variableDeclarations = new Map();
        this.macroManager = macroManager;
        this.efunDocsManager = efunDocsManager;
    }
    async provideDefinition(document, position, token) {
        // 获取当前光标所在的单词
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return undefined;
        }
        const word = document.getText(wordRange);
        const line = document.lineAt(position.line).text;
        // Check for "->" operator
        if (line.includes('->')) {
            const regex = new RegExp(`(.*?)->\\s*${word}`);
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
                        const fullPathUri = vscode.Uri.joinPath(workspaceFolder.uri, extractedPath.startsWith('/') ? extractedPath.substring(1) : extractedPath);
                        if (fs.existsSync(fullPathUri.fsPath)) {
                            try {
                                const fileContent = await vscode.workspace.fs.readFile(fullPathUri);
                                const text = Buffer.from(fileContent).toString('utf8');
                                // Search for the functionName in the text
                                // Ensure word in regex is properly escaped if it can contain special characters.
                                // For simplicity, assuming 'word' is a simple identifier.
                                const functionRegex = new RegExp(`(?:(?:private|public|protected|static|nomask|varargs)\\s+)*` +
                                    `(?:void|int|string|object|mapping|mixed|float|buffer)\\s+` +
                                    `${functionName}\\s*\\([^)]*\\)`, // Using functionName (word) directly
                                'g');
                                const location = await this._findFunctionInFile(fullPathUri, functionName);
                                if (location) {
                                    return location;
                                }
                            }
                            catch (error) {
                                console.error(`Error processing file for "->" operator: ${fullPathUri.fsPath}`, error);
                                // Fall through to other checks if file processing fails
                            }
                        }
                    }
                }
                else if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(targetObject)) {
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
                                }
                                catch (error) {
                                    console.error(`Error processing file from macro for "->" operator: ${fullPathUri.fsPath}`, error);
                                }
                            }
                        }
                    }
                }
                else {
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
            const simulatedEfunsPath = config.get('lpc.simulatedEfunsPath');
            if (simulatedEfunsPath) {
                const files = await vscode.workspace.findFiles(new vscode.RelativePattern(simulatedEfunsPath, '**/*.{c,h}'));
                for (const file of files) {
                    const content = await vscode.workspace.fs.readFile(file);
                    const text = Buffer.from(content).toString('utf8');
                    // 查找函数定义
                    const functionRegex = new RegExp(`(?:(?:private|public|protected|static|nomask|varargs)\\s+)*` +
                        `(?:void|int|string|object|mapping|mixed|float|buffer)\\s+` +
                        `(?:\\*\\s*)?${word}\\s*\\([^)]*\\)`, 'g');
                    const match = functionRegex.exec(text);
                    if (match) {
                        const startPos = new vscode.Position(text.substring(0, match.index).split('\n').length - 1, 0);
                        const endPos = new vscode.Position(text.substring(0, match.index + match[0].length).split('\n').length - 1, match[0].length);
                        return new vscode.Location(file, new vscode.Range(startPos, endPos));
                    }
                }
            }
        }
        // 解析并缓存变量声明
        await this.collectVariableDeclarations(document);
        const varEntries = this.variableDeclarations.get(word);
        if (varEntries) {
            // 找到距离当前位置最近且在之前的声明
            const posOffset = document.offsetAt(position);
            let best;
            for (const entry of varEntries) {
                const offset = entry.offset;
                if (offset <= posOffset) {
                    if (!best || offset > document.offsetAt(best.range.start)) {
                        best = entry.loc;
                    }
                }
            }
            if (best)
                return best;
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
    _offsetToPosition(docText, offset) {
        const before = docText.substring(0, offset);
        const lines = before.split('\n');
        const line = lines.length - 1;
        const character = lines[line].length;
        return new vscode.Position(line, character);
    }
    async _findFunctionInFile(fileUri, functionName) {
        try {
            const fileContent = await vscode.workspace.fs.readFile(fileUri);
            const text = Buffer.from(fileContent).toString('utf8');
            const functionRegex = new RegExp(`(?:(?:private|public|protected|static|nomask|varargs)\\s+)*` +
                `(?:void|int|string|object|mapping|mixed|float|buffer)\\s+` +
                `${functionName}\\s*\\([^)]*\\)`, 'g');
            const funcMatch = functionRegex.exec(text);
            if (funcMatch) {
                const defStartPos = this._offsetToPosition(text, funcMatch.index);
                const defEndPos = this._offsetToPosition(text, funcMatch.index + funcMatch[0].length);
                return new vscode.Location(fileUri, new vscode.Range(defStartPos, defEndPos));
            }
        }
        catch (error) {
            console.error(`Error reading or processing file ${fileUri.fsPath}:`, error);
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
                let inheritedFile = match[1] ?? match[2];
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
        const { tree } = (0, parseCache_1.getParsed)(document);
        for (const stmt of tree.statement()) {
            const funcCtx = stmt.functionDef();
            if (!funcCtx)
                continue;
            const idToken = funcCtx.Identifier().symbol;
            const funcName = idToken.text ?? '';
            const namePos = document.positionAt(idToken.startIndex);
            const location = new vscode.Location(document.uri, namePos);
            this.functionDefinitions.set(funcName, location);
        }
    }
    async findInheritedFunctionDefinitions(document) {
        const inherits = this.findInherits(document.getText());
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder)
            return;
        for (const inh of inherits) {
            let path = inh;
            if (!path.endsWith('.c'))
                path += '.c';
            if (path.startsWith('/'))
                path = path.substring(1);
            const uri = vscode.Uri.joinPath(workspaceFolder.uri, path);
            if (this.processedFiles.has(uri.fsPath))
                continue;
            this.processedFiles.add(uri.fsPath);
            try {
                const doc = await vscode.workspace.openTextDocument(uri);
                await this.findFunctionDefinitions(doc); // 递归解析父文件
            }
            catch {
                /* ignore */
            }
        }
    }
    findInherits(text) {
        const result = new Set();
        const inheritRegex = /inherit\s+(?:"([^"]+)"|([A-Z_][A-Z0-9_]*))\s*;/g;
        let m;
        while ((m = inheritRegex.exec(text)) !== null) {
            const file = m[1] ?? m[2];
            if (file)
                result.add(file);
        }
        return result;
    }
    async collectVariableDeclarations(document) {
        if (this.processedFiles.has(document.uri.fsPath))
            return;
        this.processedFiles.add(document.uri.fsPath);
        const { tree } = (0, parseCache_1.getParsed)(document);
        const addVar = (name, token) => {
            const pos = document.positionAt(token.startIndex);
            const loc = new vscode.Location(document.uri, pos);
            const entry = { loc, offset: token.startIndex };
            if (!this.variableDeclarations.has(name))
                this.variableDeclarations.set(name, []);
            this.variableDeclarations.get(name).push(entry);
        };
        const traverse = (ctx) => {
            if (!ctx)
                return;
            if (ctx instanceof LPCParser_1.VariableDeclContext) {
                for (const decl of ctx.variableDeclarator()) {
                    const idToken = decl.Identifier().symbol;
                    addVar(idToken.text ?? '', idToken);
                }
            }
            else if (ctx instanceof LPCParser_1.FunctionDefContext) {
                const params = ctx.parameterList()?.parameter() || [];
                for (const p of params) {
                    const idToken = p.Identifier()?.symbol;
                    if (!idToken)
                        continue; // 参数可能没有名字（函数原型）
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
exports.LPCDefinitionProvider = LPCDefinitionProvider;
//# sourceMappingURL=definitionProvider.js.map