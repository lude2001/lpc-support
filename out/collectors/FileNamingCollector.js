"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileNamingCollector = void 0;
const vscode = require("vscode");
const path = require("path");
/**
 * 检查文件命名规范 (扩展名及文件名规则)
 */
class FileNamingCollector {
    collect(document, _parsed) {
        const diagnostics = [];
        const fileName = path.basename(document.fileName);
        const fileNameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
        const extension = fileName.substring(fileName.lastIndexOf('.') + 1);
        const validExtensions = ['c', 'h'];
        if (!validExtensions.includes(extension)) {
            diagnostics.push(new vscode.Diagnostic(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)), `文件扩展名应为 .c 或 .h，而不是 .${extension}`, vscode.DiagnosticSeverity.Warning));
        }
        // 文件名允许大写字母、小写字母、数字、下划线、连字符和中文，允许数字开头
        if (!/^[\u4e00-\u9fa5a-zA-Z0-9_-]+$/.test(fileNameWithoutExt)) {
            diagnostics.push(new vscode.Diagnostic(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)), '文件名应由字母（可大写/小写）、数字、下划线、连字符或中文组成', vscode.DiagnosticSeverity.Warning));
        }
        // 限制文件名长度
        if (fileNameWithoutExt.length > 100) {
            diagnostics.push(new vscode.Diagnostic(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)), '文件名过长，建议不超过 100 个字符', vscode.DiagnosticSeverity.Warning));
        }
        return diagnostics;
    }
}
exports.FileNamingCollector = FileNamingCollector;
//# sourceMappingURL=FileNamingCollector.js.map