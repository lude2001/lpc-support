"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LPCDefinitionProvider = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const web_tree_sitter_1 = __importDefault(require("web-tree-sitter"));
// Module-level variable to hold the loaded language
let LpcLanguage = undefined;
const FUNCTION_DEFINITION_QUERY = `
(function_definition
  name: (identifier) @function.name
) @function.definition
`;
const INHERIT_STATEMENT_QUERY = `
(inherit_statement
  path: (string_literal) @inherit.path
) @inherit.statement
`;
class LPCDefinitionProvider {
    // private processedFiles: Set<string> = new Set(); // Will be managed by visitedFiles in recursive calls
    // private functionDefinitions: Map<string, vscode.Location> = new Map(); // Will be replaced by AST lookups
    constructor(macroManager, efunDocsManager) {
        this.macroManager = macroManager;
        this.efunDocsManager = efunDocsManager;
        if (LpcLanguage) {
            this.parser = new web_tree_sitter_1.default();
            this.parser.setLanguage(LpcLanguage);
            console.log("LPCDefinitionProvider: Parser initialized in constructor.");
        }
        else {
            console.warn("LPCDefinitionProvider: LpcLanguage not available at construction. Parser will be initialized on demand or when language is set.");
        }
    }
    static setLanguage(lang) {
        LpcLanguage = lang;
        console.log("LPCDefinitionProvider: LpcLanguage static field has been set.");
        // Note: Existing instances might need to re-check LpcLanguage or be re-created
        // if they were constructed before this was called. The provideDefinition method
        // will also attempt to initialize the parser if it's missing.
    }
    nodeToLocation(node, uri, documentText) {
        // Helper to convert AST node start/end byte offsets to vscode.Position
        const startPosition = this._offsetToPosition(documentText, node.startIndex);
        const endPosition = this._offsetToPosition(documentText, node.endIndex);
        return new vscode.Location(uri, new vscode.Range(startPosition, endPosition));
    }
    // Reusable helper for converting byte offset to Position
    _offsetToPosition(docText, offset) {
        const before = docText.substring(0, offset);
        const lines = before.split('\n');
        const line = lines.length - 1;
        const character = lines[line].length; // Corrected: length of the last line segment
        return new vscode.Position(line, character);
    }
    findFunctionDefinitionInAst(tree, functionName, documentUri, documentText) {
        if (!LpcLanguage || !this.parser)
            return undefined;
        // Ensure FUNCTION_DEFINITION_QUERY is defined at the top of the file or passed in
        const query = LpcLanguage.query(FUNCTION_DEFINITION_QUERY);
        const matches = query.matches(tree.rootNode);
        for (const match of matches) {
            const nameNode = match.captures.find(c => c.name === 'function.name')?.node;
            if (nameNode && nameNode.text === functionName) {
                return this.nodeToLocation(nameNode, documentUri, documentText);
            }
        }
        return undefined;
    }
    async _findFunctionInAstFile(fileUri, functionName) {
        if (!this.parser) {
            if (LpcLanguage) { // Try to initialize parser if language is available
                this.parser = new web_tree_sitter_1.default();
                this.parser.setLanguage(LpcLanguage);
            }
            else {
                console.warn("LPCDefinitionProvider: Parser not initialized in _findFunctionInAstFile.");
                return undefined;
            }
        }
        try {
            const fileContentBytes = await vscode.workspace.fs.readFile(fileUri);
            const fileText = Buffer.from(fileContentBytes).toString('utf8');
            const tree = this.parser.parse(fileText);
            if (tree) {
                return this.findFunctionDefinitionInAst(tree, functionName, fileUri, fileText);
            }
        }
        catch (e) {
            console.error(`Error reading/parsing ${fileUri.fsPath} for AST function search:`, e);
        }
        return undefined;
    }
    async findFunctionDefinitionInInheritedAsts(currentDocumentUri, currentDocumentText, functionName, workspaceFolderUri, visitedFiles) {
        if (!LpcLanguage || !this.parser || !workspaceFolderUri) {
            console.warn("LPCDefinitionProvider: Prerequisites for inheritance check not met.");
            return undefined;
        }
        if (visitedFiles.has(currentDocumentUri.fsPath)) {
            return undefined;
        }
        visitedFiles.add(currentDocumentUri.fsPath);
        let currentTree;
        try {
            currentTree = this.parser.parse(currentDocumentText);
        }
        catch (e) {
            console.error(`Error parsing ${currentDocumentUri.fsPath} for inherits:`, e);
            return undefined;
        }
        if (!currentTree) {
            return undefined;
        }
        // Ensure INHERIT_STATEMENT_QUERY is defined at the top of the file or passed in
        const inheritQuery = LpcLanguage.query(INHERIT_STATEMENT_QUERY);
        const inheritMatches = inheritQuery.matches(currentTree.rootNode);
        for (const match of inheritMatches) {
            const pathNode = match.captures.find(c => c.name === 'inherit.path')?.node;
            if (pathNode) {
                let inheritedPath = pathNode.text.slice(1, -1); // Remove quotes
                if (!inheritedPath.endsWith(".c")) {
                    inheritedPath += ".c";
                }
                let resolvedUri;
                if (inheritedPath.startsWith('/')) {
                    resolvedUri = vscode.Uri.joinPath(workspaceFolderUri, inheritedPath.substring(1));
                }
                else {
                    const currentDir = vscode.Uri.joinPath(currentDocumentUri, '..');
                    resolvedUri = vscode.Uri.joinPath(currentDir, inheritedPath);
                }
                if (resolvedUri && fs.existsSync(resolvedUri.fsPath)) {
                    if (visitedFiles.has(resolvedUri.fsPath))
                        continue;
                    try {
                        const inheritedContentBytes = await vscode.workspace.fs.readFile(resolvedUri);
                        const inheritedText = Buffer.from(inheritedContentBytes).toString('utf8');
                        // No need to parse here, _findFunctionInAstFile will parse
                        const location = await this._findFunctionInAstFile(resolvedUri, functionName);
                        if (location)
                            return location;
                        if (visitedFiles.size < 10) { // Limit recursion depth
                            const deeperLocation = await this.findFunctionDefinitionInInheritedAsts(resolvedUri, inheritedText, functionName, workspaceFolderUri, visitedFiles);
                            if (deeperLocation)
                                return deeperLocation;
                        }
                    }
                    catch (e) {
                        console.error(`Error reading/parsing inherited file ${resolvedUri.fsPath}:`, e);
                    }
                }
            }
        }
        return undefined;
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
        // 清除之前的缓存 -- This old cache logic is no longer needed for AST-based func defs
        // this.processedFiles.clear();
        // this.functionDefinitions.clear();
        // 3. AST-based function definition search (current file then inherited)
        // Ensure parser is initialized (it might have been set late via setLanguage)
        if (!this.parser && LpcLanguage) {
            this.parser = new web_tree_sitter_1.default();
            this.parser.setLanguage(LpcLanguage);
            console.log("LPCDefinitionProvider: Parser initialized on-demand in provideDefinition (AST path).");
        }
        if (this.parser) {
            const documentText = document.getText();
            let astTree;
            try {
                astTree = this.parser.parse(documentText);
                let astLocation = this.findFunctionDefinitionInAst(astTree, word, document.uri, documentText);
                if (astLocation)
                    return astLocation;
                const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
                astLocation = await this.findFunctionDefinitionInInheritedAsts(document.uri, documentText, word, workspaceFolder?.uri, new Set());
                if (astLocation)
                    return astLocation;
            }
            catch (e) {
                console.error("Error during AST-based definition search:", e);
                // Fall through to old logic if AST parsing/search fails
            }
        }
        else {
            console.warn("LPCDefinitionProvider: Parser not available for AST-based function search.");
            // Fallback to old regex logic if parser isn't ready
            // (The old logic for findFunctionDefinitions and findInheritedFunctionDefinitions is currently commented out below)
        }
        // Old regex-based function definition search (can be removed once AST is fully trusted)
        // await this.findFunctionDefinitions(document);
        // if (!this.functionDefinitions.has(word)) {
        //     await this.findInheritedFunctionDefinitions(document);
        // }
        // const functionDef = this.functionDefinitions.get(word);
        // if (functionDef) {
        //     return functionDef;
        // }
        // 4. 检查是否是变量定义 (Using existing regex-based logic for variables for now)
        const variableDef = await this.findVariableDefinition(word, document, position, new Set());
        if (variableDef) {
            return variableDef;
        }
        return undefined;
    }
    // Removed duplicate _offsetToPosition
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
    async findVariableDefinition(variableName, document, position, // position is not used here, but kept for signature consistency if needed later
    visitedFiles) {
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
        const inheritedVarDef = await this.findInheritedVariableDefinition(document, variableName, visitedFiles);
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
    async findInheritedVariableDefinition(document, variableName, visitedFiles) {
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
                    if (fs.existsSync(filePath) && !visitedFiles.has(filePath)) {
                        visitedFiles.add(filePath); // Mark as visited before processing
                        try {
                            const inheritedDoc = await vscode.workspace.openTextDocument(filePath);
                            // Pass the visitedFiles set in the recursive call
                            const varDef = await this.findVariableDefinition(variableName, inheritedDoc, new vscode.Position(0, 0), visitedFiles);
                            if (varDef) {
                                return varDef;
                            }
                            // Recursive call to findInheritedVariableDefinition is implicitly handled by the above findVariableDefinition call
                            // as it will call findInheritedVariableDefinition itself if var is not found locally.
                            // So no need for: const inheritedVarDef = await this.findInheritedVariableDefinition(inheritedDoc, variableName, visitedFiles);
                        }
                        catch (error) {
                            console.error(`Error reading inherited file: ${filePath}`, error);
                        }
                        // Removed break here to check all possible paths if the first one doesn't yield a result, though typically the first found is taken.
                        // Consider if only the first valid path should be explored or all. For now, let's assume first valid path is enough.
                        // If we found a valid file and processed it, we should probably break.
                        break;
                    }
                }
            }
        }
        return undefined;
    }
}
exports.LPCDefinitionProvider = LPCDefinitionProvider;
//# sourceMappingURL=definitionProvider.js.map