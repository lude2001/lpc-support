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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LPCCodeActionProvider = void 0;
const vscode = __importStar(require("vscode"));
class LPCCodeActionProvider {
    provideCodeActions(document, range, context) {
        const actions = [];
        // 遍历诊断信息
        for (const diagnostic of context.diagnostics) {
            if (diagnostic.code === LPCCodeActionProvider.unusedVarDiagnosticCode) {
                // 修改删除变量的代码操作
                const removeVarAction = this.createRemoveVariableAction(document, diagnostic);
                if (removeVarAction) {
                    actions.push(removeVarAction);
                }
                // 添加注释未使用的变量的代码操作
                const commentVarAction = this.createCommentVariableAction(document, diagnostic);
                if (commentVarAction) {
                    actions.push(commentVarAction);
                }
                // 创建将变量标记为全局变量的代码操作
                const makeGlobalAction = this.createMakeGlobalAction(document, diagnostic);
                if (makeGlobalAction) {
                    actions.push(makeGlobalAction);
                }
            }
        }
        return actions;
    }
    createRemoveVariableAction(document, diagnostic) {
        const action = new vscode.CodeAction('删除未使用的变量', vscode.CodeActionKind.QuickFix);
        const edit = new vscode.WorkspaceEdit();
        // 获取变量所在的行
        const line = document.lineAt(diagnostic.range.start.line);
        let lineText = line.text;
        // 获取未使用的变量名
        const varText = document.getText(diagnostic.range).trim();
        // 创建匹配变量的正则表达式，处理逗号和空格
        const varPattern = new RegExp(`(\\s*,\\s*${varText}\\b)|(\\b${varText}\\b\\s*,)|(\\b${varText}\\b)`, 'g');
        // 移除未使用的变量
        lineText = lineText.replace(varPattern, (match, p1, p2, p3) => {
            if (p1 || p2) {
                // 变量前或后有逗号，移除变量和逗号
                return '';
            }
            else if (p3) {
                // 唯一的变量，删除整行
                return '';
            }
            return match;
        });
        // 检查处理后的行是否只剩下类型和分号
        if (/^\s*\w+\s*;?\s*$/.test(lineText)) {
            // 行已为空或只剩下类型，删除整行
            edit.delete(document.uri, line.rangeIncludingLineBreak);
        }
        else {
            // 仍有其他变量，替换整行
            edit.replace(document.uri, line.range, lineText);
        }
        action.edit = edit;
        action.diagnostics = [diagnostic];
        action.isPreferred = true;
        return action;
    }
    createCommentVariableAction(document, diagnostic) {
        const action = new vscode.CodeAction('注释未使用的变量', vscode.CodeActionKind.QuickFix);
        const edit = new vscode.WorkspaceEdit();
        // 获取变量所在的行
        const line = document.lineAt(diagnostic.range.start.line);
        let lineText = line.text;
        // 获取未使用的变量名
        const varText = document.getText(diagnostic.range).trim();
        // 创建匹配变量的正则表达式，处理逗号和空格
        const varPattern = new RegExp(`(\\s*,\\s*${varText}\\b)|(\\b${varText}\\b\\s*,)|(\\b${varText}\\b)`, 'g');
        // 检查是否只有一个变量
        if (new RegExp(`^\\s*\\w+\\s+${varText}\\s*;?\\s*$`).test(lineText)) {
            // 只有一个变量，注释整行
            lineText = `/*${lineText}*/`;
        }
        else {
            // 多个变量，注释未使用的变量
            lineText = lineText.replace(varPattern, (match) => `/*${match}*/`);
        }
        edit.replace(document.uri, line.range, lineText);
        action.edit = edit;
        action.diagnostics = [diagnostic];
        return action;
    }
    createMakeGlobalAction(document, diagnostic) {
        const action = new vscode.CodeAction('将变量标记为全局变量', vscode.CodeActionKind.QuickFix);
        const line = document.lineAt(diagnostic.range.start.line);
        const lineText = line.text;
        // 在变量声明前添加 nosave 关键字
        const newText = lineText.replace(/^\s*/, '$&nosave ');
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, line.range, newText);
        action.edit = edit;
        action.diagnostics = [diagnostic];
        return action;
    }
}
exports.LPCCodeActionProvider = LPCCodeActionProvider;
LPCCodeActionProvider.unusedVarDiagnosticCode = 'unusedVar';
//# sourceMappingURL=codeActions.js.map