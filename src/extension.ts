import * as vscode from 'vscode';
import { LPCDiagnostics } from './diagnostics';
import { LPCCodeActionProvider } from './codeActions';
import { LPCCompletionItemProvider } from './completionProvider';
import { LPCConfigManager } from './config';
import { LPCCompiler } from './compiler';
import { MacroManager } from './macroManager';
import { LPCDefinitionProvider } from './definitionProvider';
import { EfunDocsManager } from './efunDocs';

export function activate(context: vscode.ExtensionContext) {
    // 初始化诊断功能
    const macroManager = new MacroManager();
    const diagnostics = new LPCDiagnostics(context, macroManager);

    // 初始化 Efun 文档管理器
    const efunDocsManager = new EfunDocsManager(context);

    // 注册 efun 文档设置命令
    context.subscriptions.push(
        vscode.commands.registerCommand('lpc.efunDocsSettings', async () => {
            const items = [
                {
                    label: "更新 Efun 文档",
                    description: "从在线文档更新 Efun 函数文档",
                    command: 'lpc.updateEfunDocs'
                },
                {
                    label: "配置模拟函数库目录",
                    description: "设置模拟函数库的目录路径",
                    command: 'lpc.configureSimulatedEfuns'
                }
            ];

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'efun文档设置'
            });

            if (selected) {
                vscode.commands.executeCommand(selected.command);
            }
        })
    );

    // 注册代码操作提供程序
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider('lpc', new LPCCodeActionProvider(), {
            providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
        })
    );

    // 注册格式化提供程序
    context.subscriptions.push(
        vscode.languages.registerDocumentFormattingEditProvider('lpc', {
            provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
                const text = document.getText();
                const formatted = formatLPCCode(text);
                const range = new vscode.Range(
                    document.positionAt(0),
                    document.positionAt(text.length)
                );
                return [vscode.TextEdit.replace(range, formatted)];
            }
        })
    );

    // 分析当前打开的文档
    if (vscode.window.activeTextEditor) {
        diagnostics.analyzeDocument(vscode.window.activeTextEditor.document);
    }

    // 注册右键菜单命令
    let disposable = vscode.commands.registerCommand('lpc-support.checkUnusedVariables', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            diagnostics.analyzeDocument(editor.document, true);
            vscode.window.showInformationMessage('已完成未使用变量检查');
        }
    });

    context.subscriptions.push(disposable);

    // 在 activate 函数中添加
    let scanFolderCommand = vscode.commands.registerCommand('lpc.scanFolder', () => {
        diagnostics.scanFolder();
    });
    context.subscriptions.push(scanFolderCommand);

    // 注册批量编译命令
    let compileFolderCommand = vscode.commands.registerCommand('lpc.compileFolder', async (uri?: vscode.Uri) => {
        let targetFolder: string;

        if (uri) {
            // 如果是从右键菜单调用，使用选中的文件夹
            targetFolder = uri.fsPath;
        } else {
            // 如果是从命令面板调用，让用户选择工作区
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                vscode.window.showErrorMessage('请先打开一个工作区');
                return;
            }

            const folders = workspaceFolders.map(folder => ({
                label: folder.name,
                description: folder.uri.fsPath,
                uri: folder.uri
            }));

            // 如果只有一个工作区文件夹，直接使用它
            if (folders.length === 1) {
                targetFolder = folders[0].uri.fsPath;
            } else {
                // 如果有多个工作区文件夹，让用户选择
                const selected = await vscode.window.showQuickPick(folders, {
                    placeHolder: '选择要编译的文件夹'
                });

                if (!selected) {
                    return;
                }
                targetFolder = selected.uri.fsPath;
            }
        }

        await compiler.compileFolder(targetFolder);
    });
    context.subscriptions.push(compileFolderCommand);

    // 初始化代码补全提供程序
    const completionProvider = new LPCCompletionItemProvider(efunDocsManager, macroManager);
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            'lpc',
            completionProvider,
            '.', '->', '#' // 触发补全的字符
        )
    );

    // 注册文档变更事件，自动清除变量缓存
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            if (event.document.languageId === 'lpc') {
                completionProvider.clearVariableCache();
            }
        })
    );

    // 注册清除变量缓存命令
    context.subscriptions.push(
        vscode.commands.registerCommand('lpc.clearVariableCache', () => {
            completionProvider.clearVariableCache();
            vscode.window.showInformationMessage('已清除变量缓存');
        })
    );

    // 注册定义跳转提供程序
    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider(
            'lpc',
            new LPCDefinitionProvider(macroManager, efunDocsManager)
        )
    );

    // 注册扫描继承关系命令
    context.subscriptions.push(
        vscode.commands.registerCommand('lpc.scanInheritance', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'lpc') {
                completionProvider.scanInheritance(editor.document);
            } else {
                vscode.window.showWarningMessage('请在LPC文件中使用此命令');
            }
        })
    );

    // 初始化配置管理器和编译器
    const configManager = new LPCConfigManager(context);
    const compiler = new LPCCompiler(configManager);

    // 注册服务器管理命令
    context.subscriptions.push(
        vscode.commands.registerCommand('lpc.addServer', () => configManager.addServer()),
        vscode.commands.registerCommand('lpc.selectServer', () => configManager.selectServer()),
        vscode.commands.registerCommand('lpc.removeServer', () => configManager.removeServer()),
        vscode.commands.registerCommand('lpc.manageServers', () => configManager.showServerManager())
    );

    // 注册编译命令
    context.subscriptions.push(
        vscode.commands.registerCommand('lpc.compileFile', async () => {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'lpc') {
                await compiler.compileFile(editor.document.fileName);
            }
        })
    );

    // 注册宏相关命令
    context.subscriptions.push(
        vscode.commands.registerCommand('lpc.showMacros', () => macroManager.showMacrosList()),
        vscode.commands.registerCommand('lpc.configureMacroPath', () => macroManager.configurePath())
    );

    // 将宏管理器添加到清理列表
    context.subscriptions.push(macroManager);
}

function formatLPCCode(code: string): string {
    const lines = code.split(/\r?\n/);
    const result: string[] = [];
    let indentLevel = 0;
    const indentSize = 4;
    const state = {
        inBlockComment: false,
        inSpecialBlock: false,
        inString: false,
        inChar: false,
        escapeActive: false,
        inMultiLineCondition: false,
        pendingIf: false,
        pendingElse: false,
        inFunctionDeclaration: false,
        inFunctionParams: false,
        inSwitchBlock: false,
        inCaseBlock: false,
        inMapping: false,
        inArray: false,
        inMultiLineString: false,
        inInheritBlock: false,
        extraIndent: 0
    };

    const specialBlocks = {
        start: new Set(["@LONG", "@TEXT", "@HELP"]),
        end: new Set(["LONG", "TEXT", "HELP"])
    };

    // 预处理：检测函数声明
    const functionPattern = /^([\w\*]+\s+)+[\w_]+\s*\(/;
    const inheritPattern = /^\s*inherit\s+/;
    const includePattern = /^\s*#include\s+/;
    const definePattern = /^\s*#define\s+/;
    const mappingPattern = /\bmapping\s*\(/;
    const arrayPattern = /\(\{\s*$/;
    const switchPattern = /\bswitch\s*\(/;
    const casePattern = /^\s*case\s+/;
    const defaultPattern = /^\s*default\s*:/;
    const inheritBlockPattern = /^\s*::\s*\{/;
    const arrowPattern = /->/;

    // 处理连续空行
    let consecutiveEmptyLines = 0;
    const maxConsecutiveEmptyLines = 2;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        const nextTrimmed = i + 1 < lines.length ? lines[i + 1].trim() : '';

        // 处理特殊块（如@LONG...LONG）
        if (!state.inSpecialBlock && specialBlocks.start.has(trimmed)) {
            state.inSpecialBlock = true;
            result.push(line);
            continue;
        }
        if (state.inSpecialBlock) {
            result.push(line);
            if (specialBlocks.end.has(trimmed)) {
                state.inSpecialBlock = false;
            }
            continue;
        }

        // 处理空行
        if (trimmed === '') {
            // 限制连续空行数量
            if (consecutiveEmptyLines < maxConsecutiveEmptyLines) {
                result.push('');
                consecutiveEmptyLines++;
            }
            continue;
        } else {
            consecutiveEmptyLines = 0;
        }

        // 处理注释行
        if (trimmed.startsWith("//")) {
            const indentStr = " ".repeat(indentLevel * indentSize);
            result.push(indentStr + trimmed);
            continue;
        }

        // 处理预处理指令（#include, #define等）
        if (includePattern.test(trimmed) || definePattern.test(trimmed)) {
            result.push(trimmed);
            continue;
        }

        // 处理inherit语句
        if (inheritPattern.test(trimmed)) {
            const indentStr = " ".repeat(indentLevel * indentSize);
            result.push(indentStr + trimmed);
            continue;
        }

        // 处理::继承块
        if (inheritBlockPattern.test(trimmed)) {
            state.inInheritBlock = true;
            const indentStr = " ".repeat(indentLevel * indentSize);
            result.push(indentStr + trimmed);
            indentLevel++;
            continue;
        }

        // 处理多行字符串
        if (state.inMultiLineString) {
            if (trimmed.includes('"') && !trimmed.startsWith('\\')) {
                state.inMultiLineString = false;
                // 多行字符串结束行使用当前缩进
                const indentStr = " ".repeat(indentLevel * indentSize);
                result.push(indentStr + trimmed);
            } else {
                // 多行字符串内容保持原样或增加一级缩进
                const indentStr = " ".repeat((indentLevel + 1) * indentSize);
                result.push(indentStr + trimmed);
            }
            continue;
        }

        // 检测多行字符串开始
        if (trimmed.startsWith('"') && !trimmed.endsWith('"') && 
            !trimmed.endsWith('\\') && !trimmed.endsWith(';')) {
            state.inMultiLineString = true;
            const indentStr = " ".repeat(indentLevel * indentSize);
            result.push(indentStr + trimmed);
            continue;
        }

        // 处理函数声明
        if (functionPattern.test(trimmed) && !trimmed.endsWith(";")) {
            state.inFunctionDeclaration = true;
            
            // 检查是否有函数参数
            if (trimmed.includes('(') && !trimmed.includes(')')) {
                state.inFunctionParams = true;
            }
        }

        // 处理函数参数
        if (state.inFunctionParams) {
            if (trimmed.includes(')')) {
                state.inFunctionParams = false;
            }
            
            // 函数参数使用特殊缩进
            if (!trimmed.startsWith('(')) {
                const indentStr = " ".repeat((indentLevel + 1) * indentSize);
                result.push(indentStr + trimmed);
                continue;
            }
        }

        // 处理switch语句
        if (switchPattern.test(trimmed)) {
            state.inSwitchBlock = true;
        }

        // 处理case语句
        if (state.inSwitchBlock && (casePattern.test(trimmed) || defaultPattern.test(trimmed))) {
            state.inCaseBlock = true;
            // case语句缩进比switch少一级
            const indentStr = " ".repeat((indentLevel - 1) * indentSize);
            result.push(indentStr + trimmed);
            continue;
        }

        // 处理mapping和数组
        if (mappingPattern.test(trimmed)) {
            state.inMapping = true;
        }
        if (arrayPattern.test(trimmed)) {
            state.inArray = true;
        }

        // 计算缩进
        let effectiveIndent = indentLevel;

        // 处理大括号缩进
        if (trimmed.startsWith("}")) {
            effectiveIndent = Math.max(0, indentLevel - 1);
            
            // 结束各种块
            if (state.inSwitchBlock && !trimmed.endsWith(";")) {
                state.inSwitchBlock = false;
            }
            if (state.inCaseBlock) {
                state.inCaseBlock = false;
            }
            if (state.inMapping) {
                state.inMapping = false;
            }
            if (state.inArray) {
                state.inArray = false;
            }
            if (state.inFunctionDeclaration) {
                state.inFunctionDeclaration = false;
            }
            if (state.inInheritBlock) {
                state.inInheritBlock = false;
            }
        }

        // 处理case块内的语句
        if (state.inCaseBlock && !casePattern.test(trimmed) && !defaultPattern.test(trimmed)) {
            effectiveIndent = indentLevel;
        }

        // 处理mapping和数组内的元素
        if ((state.inMapping || state.inArray) && !trimmed.startsWith('mapping') && 
            !trimmed.startsWith('({') && !trimmed.startsWith('}') && !trimmed.startsWith(')')) {
            effectiveIndent = indentLevel + 1;
        }

        // 处理->箭头操作符的链式调用
        if (arrowPattern.test(trimmed) && trimmed.startsWith('->')) {
            effectiveIndent = indentLevel + 1;
        }

        // 应用缩进
        const indentStr = " ".repeat(effectiveIndent * indentSize);
        
        // 不要修改多行字符串的内容
        if (state.inString && !state.escapeActive && trimmed.indexOf('"') === -1) {
            result.push(line); // 保持原样
            continue;
        } else {
            // 格式化操作符周围的空格
            let formattedLine = trimmed;
            
            // 格式化->操作符（前后各一个空格）
            formattedLine = formattedLine.replace(/\s*->\s*/g, ' -> ');
            
            // 格式化::操作符（前后各一个空格）
            formattedLine = formattedLine.replace(/\s*::\s*/g, ' :: ');
            
            // 格式化算术操作符（+, -, *, /, %）
            formattedLine = formattedLine.replace(/\s*(\+|\-|\*|\/|%)\s*/g, ' $1 ');
            
            // 格式化比较操作符（==, !=, >, <, >=, <=）
            formattedLine = formattedLine.replace(/\s*(==|!=|>=|<=|>|<)\s*/g, ' $1 ');
            
            // 格式化逻辑操作符（&&, ||）
            formattedLine = formattedLine.replace(/\s*(&&|\|\|)\s*/g, ' $1 ');
            
            // 格式化赋值操作符（=, +=, -=, *=, /=, %=）
            formattedLine = formattedLine.replace(/\s*(=|\+=|\-=|\*=|\/=|%=)\s*/g, ' $1 ');
            
            // 修复逗号后面的空格
            formattedLine = formattedLine.replace(/,\s*/g, ', ');
            
            // 修复分号前的空格
            formattedLine = formattedLine.replace(/\s*;/g, ';');
            
            // 修复括号内外的空格
            formattedLine = formattedLine.replace(/\(\s+/g, '(');
            formattedLine = formattedLine.replace(/\s+\)/g, ')');
            
            // 修复方括号内外的空格
            formattedLine = formattedLine.replace(/\[\s+/g, '[');
            formattedLine = formattedLine.replace(/\s+\]/g, ']');
            
            result.push(indentStr + formattedLine);
        }

        // 更新状态和缩进级别
        indentLevel = updateIndentLevel(trimmed, state, indentLevel);
    }

    return result.join('\n');
}

function updateIndentLevel(line: string, state: any, indentLevel: number): number {
    let newLevel = indentLevel;
    
    // 处理多行注释
    if (line.includes("/*") && !line.includes("*/")) {
        state.inBlockComment = true;
        return newLevel;
    }
    
    if (state.inBlockComment) {
        if (line.includes("*/")) {
            state.inBlockComment = false;
        }
        return newLevel;
    }
    
    // 跳过单行注释
    if (line.trim().startsWith("//")) {
        return newLevel;
    }
    
    // 处理字符串和字符
    let inString = false;
    let inChar = false;
    let escapeActive = false;
    
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        const nextCh = i + 1 < line.length ? line[i + 1] : '';
        
        // 跳过注释内容
        if (!inString && !inChar) {
            if (ch === '/' && nextCh === '/') {
                break; // 跳过行内剩余部分
            }
            if (ch === '/' && nextCh === '*') {
                state.inBlockComment = true;
                i++;
                continue;
            }
        }
        
        if (state.inBlockComment) {
            if (ch === '*' && nextCh === '/') {
                state.inBlockComment = false;
                i++;
            }
            continue;
        }
        
        // 处理字符串
        if (inString) {
            if (!escapeActive && ch === '\\') {
                escapeActive = true;
            } else if (escapeActive) {
                escapeActive = false;
            } else if (ch === '"') {
                inString = false;
            }
            continue;
        }
        
        if (!inString && !inChar && ch === '"') {
            inString = true;
            continue;
        }
        
        // 处理字符
        if (inChar) {
            if (!escapeActive && ch === '\\') {
                escapeActive = true;
            } else if (escapeActive) {
                escapeActive = false;
            } else if (ch === '\'') {
                inChar = false;
            }
            continue;
        }
        
        if (!inString && !inChar && ch === '\'') {
            inChar = true;
            continue;
        }
        
        // 处理缩进
        if (!inString && !inChar) {
            if (ch === '{') {
                newLevel++;
            } else if (ch === '}') {
                newLevel = Math.max(0, newLevel - 1);
            }
        }
    }
    
    // 处理特殊情况
    const trimmed = line.trim();
    
    // 处理::继承块
    if (/^\s*::\s*\{/.test(trimmed)) {
        state.inInheritBlock = true;
        newLevel++;
    }
    
    // 如果行以 "if", "else if", "else", "for", "while", "foreach", "switch" 开头但不以 '{' 结尾
    // 且不以 ';' 结尾（表示不是单行语句），则增加缩进
    if (/^(if|else\s+if|else|for|while|foreach|switch)\s*\(.*\)\s*$/.test(trimmed) && 
        !trimmed.endsWith("{") && !trimmed.endsWith(";")) {
        newLevel++;
    }
    
    // 处理do-while结构
    if (/^do\s*$/.test(trimmed) || /^do\s*\{/.test(trimmed)) {
        if (!trimmed.endsWith("{")) {
            newLevel++;
        }
    }
    
    // 处理case语句
    if (/^case\s+.*:/.test(trimmed) || /^default\s*:/.test(trimmed)) {
        if (state.inSwitchBlock) {
            // case语句后的代码块需要缩进
            newLevel++;
        }
    }
    
    // 处理多行条件
    if ((trimmed.endsWith("&&") || trimmed.endsWith("||")) && 
        !trimmed.startsWith("if") && !trimmed.startsWith("while") && !trimmed.startsWith("for")) {
        state.inMultiLineCondition = true;
    } else if (state.inMultiLineCondition && 
              !trimmed.endsWith("&&") && !trimmed.endsWith("||")) {
        state.inMultiLineCondition = false;
    }
    
    // 处理函数参数
    if (trimmed.includes('(') && !trimmed.includes(')') && 
        /^([\w\*]+\s+)+[\w_]+\s*\(/.test(trimmed)) {
        state.inFunctionParams = true;
    } else if (state.inFunctionParams && trimmed.includes(')')) {
        state.inFunctionParams = false;
    }
    
    // 处理mapping和数组
    if (trimmed.includes("mapping") && trimmed.includes("(") && !trimmed.includes(")")) {
        state.inMapping = true;
    } else if (state.inMapping && trimmed.includes(")")) {
        state.inMapping = false;
    }
    
    if (trimmed.includes("({") && !trimmed.includes("})")) {
        state.inArray = true;
    } else if (state.inArray && trimmed.includes("})")) {
        state.inArray = false;
    }
    
    return newLevel;
}

// 停用扩展时调用
export function deactivate() {} 