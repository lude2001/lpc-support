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
        // 文件名必须由小写字母、数字和下划线组成，且不能以数字开头
        if (!/^[a-z_][a-z0-9_-]*$/.test(fileNameWithoutExt)) {
            diagnostics.push(new vscode.Diagnostic(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)), '文件名应由小写字母、数字、下划线和连字符组成，且不能以数字开头', vscode.DiagnosticSeverity.Warning));
        }
        // 限制文件名长度
        if (fileNameWithoutExt.length > 30) {
            diagnostics.push(new vscode.Diagnostic(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)), '文件名过长，建议不超过 30 个字符', vscode.DiagnosticSeverity.Warning));
        }
        return diagnostics;
    }
}
exports.FileNamingCollector = FileNamingCollector;
//# sourceMappingURL=FileNamingCollector.js.map