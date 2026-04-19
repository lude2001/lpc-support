import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { TextDocumentHost } from '../language/shared/WorkspaceDocumentPathSupport';

type AnalyzeDocument = (
    document: vscode.TextDocument,
    showMessage?: boolean
) => Promise<vscode.Diagnostic[]>;

export class FolderScanner {
    constructor(
        private readonly analyzeDocument: AnalyzeDocument,
        private readonly diagnosticCollection: vscode.DiagnosticCollection,
        private readonly textDocumentHost: TextDocumentHost
    ) {}

    public async scanFolder(): Promise<void> {
        const folders = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: '选择要扫描的文件夹'
        });

        if (!folders || folders.length === 0) {
            return;
        }

        const folderPath = folders[0].fsPath;
        const outputChannel = vscode.window.createOutputChannel('LPC 变量检查');
        outputChannel.show();
        outputChannel.appendLine(`开始扫描文件夹: ${folderPath}`);

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: '正在扫描 LPC 文件...',
                cancellable: true
            }, async (progress, token) => {
                const files = await this.findLPCFiles(folderPath);
                const totalFiles = files.length;
                let processedFiles = 0;

                outputChannel.appendLine(`找到 ${totalFiles} 个 LPC 文件`);

                const batchSize = 10;
                const diagnosticsByFile = new Map<string, vscode.Diagnostic[]>();

                for (let i = 0; i < files.length; i += batchSize) {
                    if (token.isCancellationRequested) {
                        outputChannel.appendLine('扫描已取消');
                        return;
                    }

                    const batch = files.slice(i, i + batchSize);

                    await Promise.all(batch.map(async (file) => {
                        progress.report({
                            increment: totalFiles > 0 ? (1 / totalFiles) * 100 : 100,
                            message: `正在检查 ${path.basename(file)} (${++processedFiles}/${totalFiles})`
                        });

                        try {
                            const document = await this.textDocumentHost.openTextDocument(file);
                            const fileDiagnostics = await this.analyzeDocument(document, false);

                            if (fileDiagnostics.length > 0) {
                                diagnosticsByFile.set(file, [...fileDiagnostics]);
                            }
                        } catch (error) {
                            outputChannel.appendLine(`处理文件 ${file} 时出错: ${error}`);
                        }
                    }));
                }

                if (diagnosticsByFile.size > 0) {
                    for (const [file, diagnostics] of diagnosticsByFile.entries()) {
                        outputChannel.appendLine(`\n文件: ${path.relative(folderPath, file)}`);
                        for (const diagnostic of diagnostics) {
                            const line = diagnostic.range.start.line + 1;
                            const character = diagnostic.range.start.character + 1;
                            outputChannel.appendLine(`  [行 ${line}, 列 ${character}] ${diagnostic.message}`);
                        }
                    }
                }

                outputChannel.appendLine('\n扫描完成！');
            });
        } catch (error) {
            outputChannel.appendLine(`发生错误: ${error}`);
            vscode.window.showErrorMessage('扫描过程中发生错误，请查看输出面板了解详情。');
        }
    }

    private async findLPCFiles(folderPath: string): Promise<string[]> {
        const files: string[] = [];
        const fileExtensions = ['.c', '.h'];
        const ignoreDirs = ['node_modules', '.git', '.vscode'];

        const walk = async (dir: string): Promise<void> => {
            let entries: fs.Dirent[];
            try {
                entries = await fs.promises.readdir(dir, { withFileTypes: true });
            } catch (error) {
                console.error(`无法读取目录 ${dir}:`, error);
                return;
            }

            const directories: string[] = [];

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);

                if (entry.isDirectory()) {
                    if (!ignoreDirs.includes(entry.name)) {
                        directories.push(fullPath);
                    }
                } else if (entry.isFile() && fileExtensions.some(ext => entry.name.endsWith(ext))) {
                    files.push(fullPath);
                }
            }

            if (directories.length > 0) {
                await Promise.all(directories.map(walk));
            }
        };

        await walk(folderPath);
        return files;
    }
}
