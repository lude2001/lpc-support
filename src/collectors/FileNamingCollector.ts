import * as vscode from 'vscode';
import * as path from 'path';
import { ParsedDoc } from '../parseCache';

/**
 * 检查文件命名规范 (扩展名及文件名规则)
 */
export class FileNamingCollector {
    collect(document: vscode.TextDocument, _parsed: ParsedDoc): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        const fileName = path.basename(document.fileName);
        const fileNameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
        const extension = fileName.substring(fileName.lastIndexOf('.') + 1);

        const validExtensions = ['c', 'h'];
        if (!validExtensions.includes(extension)) {
            diagnostics.push(new vscode.Diagnostic(
                new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)),
                `文件扩展名应为 .c 或 .h，而不是 .${extension}`,
                vscode.DiagnosticSeverity.Warning
            ));
        }

        // 文件名必须由小写字母、数字和下划线组成，且不能以数字开头
        if (!/^[a-z_][a-z0-9_-]*$/.test(fileNameWithoutExt)) {
            diagnostics.push(new vscode.Diagnostic(
                new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)),
                '文件名应由小写字母、数字、下划线和连字符组成，且不能以数字开头',
                vscode.DiagnosticSeverity.Warning
            ));
        }

        // 限制文件名长度
        if (fileNameWithoutExt.length > 30) {
            diagnostics.push(new vscode.Diagnostic(
                new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)),
                '文件名过长，建议不超过 30 个字符',
                vscode.DiagnosticSeverity.Warning
            ));
        }

        return diagnostics;
    }
} 