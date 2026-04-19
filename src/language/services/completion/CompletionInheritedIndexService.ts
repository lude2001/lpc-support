import * as fs from 'fs';
import * as vscode from 'vscode';
import type { FileSymbolRecord, InheritedSymbolSet, ResolvedInheritTarget } from '../../../completion/types';
import { normalizeLpcType } from '../../../ast/typeNormalization';
import type { SemanticSnapshot } from '../../../semantic/semanticSnapshot';
import type { DocumentAnalysisService } from '../../../semantic/documentAnalysisService';
import { ProjectSymbolIndex } from '../../../completion/projectSymbolIndex';

export type CompletionIndexAnalysisService = Pick<
    DocumentAnalysisService,
    | 'getSnapshot'
    | 'getBestAvailableSnapshot'
    | 'getSemanticSnapshot'
    | 'getBestAvailableSemanticSnapshot'
    | 'scheduleRefresh'
    | 'clearCache'
    | 'clearAllCache'
>;

export interface CompletionInheritanceReporter {
    clear(): void;
    show(preserveFocus?: boolean): void;
    appendLine(message: string): void;
}

type IndexSnapshot = SemanticSnapshot | ReturnType<DocumentAnalysisService['getSnapshot']>;

export class CompletionInheritedIndexService {
    constructor(
        private readonly analysisService: CompletionIndexAnalysisService,
        private readonly projectSymbolIndex: ProjectSymbolIndex,
        private readonly inheritanceReporter: CompletionInheritanceReporter
    ) {}

    public warmInheritedIndex(document: vscode.TextDocument): void {
        this.refreshInheritedIndex(document);
    }

    public refreshInheritedIndex(document: vscode.TextDocument): IndexSnapshot {
        const indexSnapshot = this.getBestAvailableIndexSnapshot(document);
        this.projectSymbolIndex.updateFromSnapshot(indexSnapshot);
        this.indexMissingInheritedSnapshots(indexSnapshot.uri, new Set<string>([indexSnapshot.uri]));
        return indexSnapshot;
    }

    public getDocumentForUri(uri: string): vscode.TextDocument | undefined {
        return this.getOpenDocument(uri) || this.createReadonlyDocumentFromUri(uri);
    }

    public getRecord(uri: string): FileSymbolRecord | undefined {
        return this.projectSymbolIndex.getRecord(uri);
    }

    public getResolvedInheritTargets(uri: string): ResolvedInheritTarget[] {
        return this.projectSymbolIndex.getResolvedInheritTargets(uri);
    }

    public getInheritedSymbols(uri: string): InheritedSymbolSet {
        return this.projectSymbolIndex.getInheritedSymbols(uri);
    }

    public handleDocumentChange(document: vscode.TextDocument): void {
        this.analysisService.scheduleRefresh(document, () => {
            this.projectSymbolIndex.updateFromSnapshot(this.getBestAvailableIndexSnapshot(document));
        });
    }

    public clearCache(document?: vscode.TextDocument): void {
        if (document) {
            this.analysisService.clearCache(document.uri.toString());
            this.projectSymbolIndex.removeFile(document.uri.toString());
            return;
        }

        this.analysisService.clearAllCache();
        this.projectSymbolIndex.clear();
    }

    public async scanInheritance(document: vscode.TextDocument): Promise<void> {
        this.inheritanceReporter.clear();
        this.inheritanceReporter.show(true);
        this.inheritanceReporter.appendLine(`正在分析文件: ${document.fileName}`);

        try {
            const snapshot = this.getIndexSnapshot(document, false);
            this.projectSymbolIndex.updateFromSnapshot(snapshot);
            this.refreshInheritedIndex(document);

            const inheritedSymbols = this.projectSymbolIndex.getInheritedSymbols(document.uri.toString());
            this.inheritanceReporter.appendLine('解析完成:');
            this.inheritanceReporter.appendLine(`  - 当前文件导出函数: ${snapshot.exportedFunctions.length}`);
            this.inheritanceReporter.appendLine(`  - 当前文件类型定义: ${snapshot.typeDefinitions.length}`);
            this.inheritanceReporter.appendLine(`  - 继承链长度: ${inheritedSymbols.chain.length}`);

            if (snapshot.inheritStatements.length > 0) {
                this.inheritanceReporter.appendLine('\ninherit 列表:');
                snapshot.inheritStatements.forEach(statement => {
                    this.inheritanceReporter.appendLine(`  - ${statement.value} (${statement.expressionKind})`);
                });
            }

            if (inheritedSymbols.functions.length > 0) {
                this.inheritanceReporter.appendLine('\n继承函数:');
                inheritedSymbols.functions.forEach(func => {
                    this.inheritanceReporter.appendLine(`  - ${normalizeLpcType(func.returnType)} ${func.name}()`);
                });
            }

            if (inheritedSymbols.unresolvedTargets.length > 0) {
                this.inheritanceReporter.appendLine('\n未解析继承目标:');
                inheritedSymbols.unresolvedTargets.forEach(target => {
                    this.inheritanceReporter.appendLine(`  - ${target.rawValue}`);
                });
            }
        } catch (error) {
            this.inheritanceReporter.appendLine(`错误: ${error}`);
        }
    }

    public getBestAvailableIndexSnapshot(document: vscode.TextDocument): IndexSnapshot {
        return this.getIndexSnapshot(document, true);
    }

    public getIndexSnapshot(document: vscode.TextDocument, bestAvailable: boolean): IndexSnapshot {
        try {
            return bestAvailable
                ? this.analysisService.getBestAvailableSemanticSnapshot(document)
                : this.analysisService.getSemanticSnapshot(document, false);
        } catch {
            return bestAvailable
                ? this.analysisService.getBestAvailableSnapshot(document)
                : this.analysisService.getSnapshot(document, false);
        }
    }

    private indexMissingInheritedSnapshots(sourceUri: string, visited: Set<string>): void {
        const targets = this.projectSymbolIndex.getResolvedInheritTargets(sourceUri);

        for (const target of targets) {
            if (!target.resolvedUri || visited.has(target.resolvedUri)) {
                continue;
            }

            visited.add(target.resolvedUri);

            if (!this.projectSymbolIndex.getRecord(target.resolvedUri)) {
                const inheritedSnapshot = this.loadSnapshotFromUri(target.resolvedUri);
                if (inheritedSnapshot) {
                    this.projectSymbolIndex.updateFromSnapshot(inheritedSnapshot);
                }
            }

            if (this.projectSymbolIndex.getRecord(target.resolvedUri)) {
                this.indexMissingInheritedSnapshots(target.resolvedUri, visited);
            }
        }
    }

    private loadSnapshotFromUri(uri: string): IndexSnapshot | undefined {
        try {
            const document = this.getDocumentForUri(uri);
            if (!document) {
                return undefined;
            }

            return this.getIndexSnapshot(document, false);
        } catch (error) {
            this.inheritanceReporter.appendLine(`Failed to index inherited file ${uri}: ${error}`);
            return undefined;
        }
    }

    private getOpenDocument(uri: string): vscode.TextDocument | undefined {
        const openDocuments = ((vscode.workspace as typeof vscode.workspace) as typeof vscode.workspace & {
            textDocuments?: vscode.TextDocument[];
        }).textDocuments || [];

        return openDocuments.find(document => document.uri.toString() === uri);
    }

    private normalizeFilePath(filePath: string): string {
        return filePath.replace(/^\/+([A-Za-z]:\/)/, '$1');
    }

    private createReadonlyDocumentFromUri(uri: string): vscode.TextDocument | undefined {
        const filePath = this.normalizeFilePath(vscode.Uri.parse(uri).fsPath);
        if (!fs.existsSync(filePath)) {
            return undefined;
        }

        const content = fs.readFileSync(filePath, 'utf8');
        const version = Math.max(1, Math.trunc(fs.statSync(filePath).mtimeMs));
        return this.createReadonlyDocument(filePath, content, version);
    }

    private createReadonlyDocument(fileName: string, content: string, version: number): vscode.TextDocument {
        const lines = content.split(/\r?\n/);
        const lineStarts = [0];

        for (let index = 0; index < content.length; index += 1) {
            if (content[index] === '\n') {
                lineStarts.push(index + 1);
            }
        }

        const offsetAt = (position: vscode.Position): number => {
            const lineStart = lineStarts[position.line] ?? content.length;
            return Math.min(lineStart + position.character, content.length);
        };

        const positionAt = (offset: number): vscode.Position => {
            let line = 0;
            for (let index = 0; index < lineStarts.length; index += 1) {
                if (lineStarts[index] <= offset) {
                    line = index;
                } else {
                    break;
                }
            }

            return new vscode.Position(line, offset - lineStarts[line]);
        };

        return {
            uri: vscode.Uri.file(fileName),
            fileName,
            languageId: 'lpc',
            version,
            lineCount: lines.length,
            getText: (range?: vscode.Range) => {
                if (!range) {
                    return content;
                }

                return content.slice(offsetAt(range.start), offsetAt(range.end));
            },
            lineAt: (lineOrPosition: number | vscode.Position) => {
                const line = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
                return { text: lines[line] ?? '' };
            },
            positionAt,
            offsetAt
        } as vscode.TextDocument;
    }
}
