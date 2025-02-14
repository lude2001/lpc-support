import * as vscode from 'vscode';
import { LPCDiagnostics } from './diagnostics';
import { LPCCodeActionProvider } from './codeActions';
import { LPCCompletionItemProvider } from './completionProvider';
import { LPCConfigManager } from './config';
import { LPCCompiler } from './compiler';
import { MacroManager } from './macroManager';
import { LPCDefinitionProvider } from './definitionProvider';

export function activate(context: vscode.ExtensionContext) {
    // 初始化诊断功能
    const macroManager = new MacroManager();
    const diagnostics = new LPCDiagnostics(context, macroManager);

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

    // 注册代码补全提供程序
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            'lpc',
            new LPCCompletionItemProvider(),
            '.', '->', '#' // 触发补全的字符
        )
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

    // 注册定义提供程序
    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider(
            'lpc',
            new LPCDefinitionProvider(macroManager)
        )
    );
}

function formatLPCCode(code: string): string {
    const lines = code.split(/\r?\n/);
    let result: string[] = [];
    let indentLevel = 0;
    const indentSize = 4;
    let inBlockComment = false;
    let inSpecialBlock = false;
    const specialBlockStart = ["@LONG", "@TEXT", "@HELP"];
    const specialBlockEnd = ["LONG", "TEXT", "HELP"];
    let pendingIf = false;
    let pendingElse = false;
    let inMultiLineCondition = false;
    let extraIndent = 0;

    for (let index = 0; index < lines.length; index++) {
        let line = lines[index];
        const trimmed = line.trim();
        const nextTrimmed = index + 1 < lines.length ? lines[index + 1].trim() : '';

        // 增强：处理多行条件语句的缩进对齐
        if (trimmed.match(/^\|\|/)) {
            // 保持与上层条件相同的缩进级别
            extraIndent = 1; // 运算符行额外缩进一级
        }

        // 增强：处理代码块内的花括号对齐
        if (trimmed.startsWith("}") || trimmed.endsWith("{")) {
            extraIndent = Math.max(indentLevel - (trimmed.startsWith("}") ? 1 : 0), 0);
        }

        // 增强：字符串拼接的格式化处理
        if (trimmed.startsWith("\"") && !trimmed.endsWith("\"") && !line.endsWith(";")) {
            // 字符串拼接行保持当前缩进级别
            extraIndent = indentLevel;
        }

        // 修复：仅当当前行不是续行（不以'||'开头）时重置 extraIndent
        if (!trimmed.match(/^\|\|/)) {
            extraIndent = 0;
        }

        if (pendingIf || pendingElse) {
            if (trimmed === "{") {
                // 当前行为 { ，不需要额外缩进，重置 pending 标志
                extraIndent = 0;
                pendingIf = false;
                pendingElse = false;
            } else {
                extraIndent = 1;
                // 仅当下一行不是新条件语句时重置 pending 标志
                if (!/^(if|else|while|for)\b/.test(trimmed)) {
                    pendingIf = false;
                    pendingElse = false;
                }
            }
        }

        // 处理特殊块
        if (!inSpecialBlock) {
            for (const tag of specialBlockStart) {
                if (trimmed.startsWith(tag)) {
                    inSpecialBlock = true;
                    break;
                }
            }
        }
        if (inSpecialBlock) {
            result.push(line);
            for (const tag of specialBlockEnd) {
                if (trimmed === tag || trimmed.endsWith(tag)) {
                    inSpecialBlock = false;
                    break;
                }
            }
            continue;
        }

        // 新增：处理多行条件逻辑
        if (/^(if|else\s+if|else)(\s*\(.*\))?\s*$/g.test(trimmed) && !trimmed.endsWith('{')) {
            pendingIf = !inMultiLineCondition;
            pendingElse = /^else/.test(trimmed);
        }

        // 修改：调整缩进逻辑
        let effectiveIndent = indentLevel;
        if (inMultiLineCondition) {
            effectiveIndent = Math.max(indentLevel - 1, 0);
        } else if (trimmed.startsWith("}")) {
            effectiveIndent = Math.max(indentLevel - 1, 0);
        }

        const indentStr = " ".repeat((effectiveIndent + extraIndent) * indentSize);
        result.push(indentStr + trimmed);

        // 新增：检测多行条件结束
        if (inMultiLineCondition && !trimmed.match(/(\|\||&&)\s*$/)) {
            inMultiLineCondition = false;
            pendingIf = true; // 条件结束后触发缩进
        }

        // 修复：条件语句后的单行语句缩进
        if (/^\s*(return|if|else|me->|target->)/.test(trimmed) && !line.endsWith(";")) {
            extraIndent = 1;
        }

        // 扫描当前行，更新indentLevel
        let inString = false, inChar = false, escapeActive = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            const nextCh = i + 1 < line.length ? line[i + 1] : '';

            if (inBlockComment) {
                if (ch === '*' && nextCh === '/') {
                    inBlockComment = false;
                    i++;
                }
                continue;
            }

            if (!inString && !inChar) {
                if (ch === '/' && nextCh === '*') {
                    inBlockComment = true;
                    i++;
                    continue;
                }
                if (ch === '/' && nextCh === '/') {
                    break; // 单行注释，忽略余下部分
                }
            }

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

            if (inChar) {
                if (!escapeActive && ch === '\\') {
                    escapeActive = true;
                } else if (escapeActive) {
                    escapeActive = false;
                } else if (ch === "'") {
                    inChar = false;
                }
                continue;
            }

            if (!inString && !inChar) {
                if (ch === '"') {
                    inString = true;
                    continue;
                }
                if (ch === "'") {
                    inChar = true;
                    continue;
                }
            }

            // 在非字符串、字符和注释中检测括号，更新缩进
            if (!inString && !inChar && !inBlockComment) {
                if (ch === '{') {
                    indentLevel++;
                } else if (ch === '}') {
                    indentLevel = Math.max(indentLevel - 1, 0);
                }
            }
        }
    }

    // 插入额外的空行以分隔连续的单行 if 语句块
    const formattedLines: string[] = [];
    for (let i = 0; i < result.length; i++) {
        const line = result[i];
        if (line.trim().startsWith("if") && formattedLines.length > 0) {
            // 如果前一行已经是空行，则不再插入
            if (formattedLines[formattedLines.length - 1].trim() !== "") {
                const currentIndentMatch = line.match(/^\s*/);
                const currentIndent = currentIndentMatch ? currentIndentMatch[0].length : 0;
                let j = formattedLines.length - 1;
                while (j >= 0 && formattedLines[j].trim() === "") {
                    j--;
                }
                const lastLine = j >= 0 ? formattedLines[j] : "";
                const previousIndentMatch = lastLine.match(/^\s*/);
                const previousIndent = previousIndentMatch ? previousIndentMatch[0].length : 0;
                if (currentIndent <= previousIndent) {
                    formattedLines.push("");
                }
            }
        }
        formattedLines.push(line);
    }
    return formattedLines.join("\n");
}

// 停用扩展时调用
export function deactivate() {} 