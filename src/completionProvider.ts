import * as fs from 'fs';
import * as vscode from 'vscode';
import { ASTManager } from './ast/astManager';
import { MacroManager } from './macroManager';
import { EfunDoc, EfunDocsManager } from './efunDocs';
import { CompletionContextAnalyzer } from './completion/completionContextAnalyzer';
import { CompletionInstrumentation } from './completion/completionInstrumentation';
import { CompletionQueryEngine } from './completion/completionQueryEngine';
import { InheritanceResolver } from './completion/inheritanceResolver';
import { ProjectSymbolIndex } from './completion/projectSymbolIndex';
import { CompletionCandidate, CompletionCandidateSourceType, CompletionQueryResult, FunctionSummary, TypeDefinitionSummary } from './completion/types';
import { SemanticSnapshot } from './semantic/semanticSnapshot';
import { normalizeLpcType } from './ast/typeNormalization';
import { SymbolType } from './ast/symbolTable';

const inheritanceChannel = vscode.window.createOutputChannel('LPC Inheritance');

interface CompletionItemData {
    candidate: CompletionCandidate;
    context: CompletionQueryResult['context'];
    documentUri: string;
    documentVersion: number;
    resolved?: boolean;
}

type IndexSnapshot = SemanticSnapshot | ReturnType<ASTManager['getSnapshot']>;

export class LPCCompletionItemProvider implements vscode.CompletionItemProvider<vscode.CompletionItem> {
    private readonly efunDocsManager: EfunDocsManager;
    private readonly macroManager: MacroManager;
    private readonly astManager: ASTManager;
    private readonly projectSymbolIndex: ProjectSymbolIndex;
    private readonly queryEngine: CompletionQueryEngine;
    private readonly instrumentation: CompletionInstrumentation;
    private readonly staticItems: vscode.CompletionItem[];

    constructor(efunDocsManager: EfunDocsManager, macroManager: MacroManager, instrumentation?: CompletionInstrumentation) {
        this.efunDocsManager = efunDocsManager;
        this.macroManager = macroManager;
        this.astManager = ASTManager.getInstance();
        this.instrumentation = instrumentation ?? new CompletionInstrumentation();
        this.projectSymbolIndex = new ProjectSymbolIndex(new InheritanceResolver(this.macroManager));
        this.queryEngine = new CompletionQueryEngine({
            snapshotProvider: this.astManager,
            projectSymbolIndex: this.projectSymbolIndex,
            contextAnalyzer: new CompletionContextAnalyzer(),
            macroManager: this.macroManager,
            efunProvider: {
                getAllFunctions: () => this.efunDocsManager.getAllFunctions(),
                getAllSimulatedFunctions: () => this.efunDocsManager.getAllSimulatedFunctions()
            }
        });
        this.staticItems = this.buildStaticItems();
    }

    public provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem> {
        const trace = this.instrumentation.startRequest({
            documentUri: document.uri.toString(),
            documentVersion: document.version,
            triggerKind: context.triggerKind,
            triggerCharacter: context.triggerCharacter
        });

        try {
            this.warmInheritedIndex(document);

            const result = this.queryEngine.query(document, position, context, token, trace);
            if (token.isCancellationRequested) {
                trace.complete(result.context.kind, 0);
                return [];
            }

            const candidates = this.appendInheritedFallbackCandidates(document, result);
            const items = candidates.map(candidate => this.createCompletionItem(candidate, result, document));
            trace.complete(result.context.kind, items.length);
            return items;
        } catch (error) {
            console.error('Error providing completions:', error);
            trace.complete('identifier', 0);
            return [];
        }
    }

    public async resolveCompletionItem(
        item: vscode.CompletionItem,
        token: vscode.CancellationToken
    ): Promise<vscode.CompletionItem> {
        if (token.isCancellationRequested) {
            return item;
        }

        const data = (item as vscode.CompletionItem & { data?: CompletionItemData }).data;
        if (!data || data.resolved) {
            return item;
        }

        const trace = this.instrumentation.startRequest({
            documentUri: data.documentUri,
            documentVersion: data.documentVersion
        });
        const candidate = data.candidate;

        await trace.measureAsync('item-resolve', async () => {
            if (candidate.insertText) {
                item.insertText = new vscode.SnippetString(candidate.insertText);
            }

            switch (candidate.metadata.sourceType) {
                case 'efun':
                    this.applyEfunDocumentation(item, this.efunDocsManager.getStandardDoc(candidate.label));
                    break;
                case 'simul-efun':
                    this.applyEfunDocumentation(item, this.efunDocsManager.getSimulatedDoc(candidate.label));
                    break;
                case 'macro':
                    this.applyMacroDocumentation(item, candidate.label);
                    break;
                case 'local':
                case 'inherited':
                case 'struct-member':
                    this.applyStructuredDocumentation(item, candidate);
                    break;
                case 'keyword':
                default:
                    this.applyKeywordDocumentation(item, candidate);
                    break;
            }
        }, { candidateCount: 1 });

        data.resolved = true;
        trace.complete(data.context.kind, 1);
        return item;
    }

    public handleDocumentChange(document: vscode.TextDocument): void {
        this.astManager.scheduleSnapshotRefresh(document, () => {
            this.projectSymbolIndex.updateFromSnapshot(this.getBestAvailableIndexSnapshot(document));
        });
    }

    public clearCache(document?: vscode.TextDocument): void {
        if (document) {
            this.astManager.clearCache(document.uri.toString());
            this.projectSymbolIndex.removeFile(document.uri.toString());
            return;
        }

        this.astManager.clearAllCache();
        this.projectSymbolIndex.clear();
    }

    public getInstrumentation(): CompletionInstrumentation {
        return this.instrumentation;
    }
    private appendInheritedFallbackCandidates(
        document: vscode.TextDocument,
        result: CompletionQueryResult
    ): CompletionCandidate[] {
        if (result.context.kind !== 'identifier' && result.context.kind !== 'type-position') {
            return result.candidates;
        }

        const snapshot = this.astManager.getBestAvailableSnapshot(document);
        const indexSnapshot = this.refreshInheritedIndex(document);

        const inheritedSymbols = this.projectSymbolIndex.getInheritedSymbols(snapshot.uri);
        if (inheritedSymbols.functions.length === 0 && inheritedSymbols.types.length === 0) {
            return result.candidates;
        }

        const normalizedPrefix = result.context.currentWord.toLowerCase();
        const existingLabels = new Set(result.candidates.map(candidate => candidate.label));
        const merged = [...result.candidates];

        for (const func of inheritedSymbols.functions) {
            if (existingLabels.has(func.name)) {
                continue;
            }
            if (normalizedPrefix && !func.name.toLowerCase().startsWith(normalizedPrefix)) {
                continue;
            }

            existingLabels.add(func.name);
            merged.push({
                key: `inherited-function:${func.sourceUri}:${func.name}`,
                label: func.name,
                kind: vscode.CompletionItemKind.Function,
                detail: `${normalizeLpcType(func.returnType)} ${func.name}`,
                sortGroup: 'inherited',
                metadata: {
                    sourceUri: func.sourceUri,
                    sourceType: 'inherited',
                    documentationRef: func.name
                }
            });
        }

        for (const typeDefinition of inheritedSymbols.types) {
            if (existingLabels.has(typeDefinition.name)) {
                continue;
            }
            if (normalizedPrefix && !typeDefinition.name.toLowerCase().startsWith(normalizedPrefix)) {
                continue;
            }

            existingLabels.add(typeDefinition.name);
            merged.push({
                key: `type:${typeDefinition.sourceUri}:${typeDefinition.name}`,
                label: typeDefinition.name,
                kind: typeDefinition.kind === 'class'
                    ? vscode.CompletionItemKind.Class
                    : vscode.CompletionItemKind.Struct,
                detail: `${typeDefinition.kind} ${typeDefinition.name}`,
                sortGroup: 'inherited',
                metadata: {
                    sourceUri: typeDefinition.sourceUri,
                    sourceType: 'inherited'
                }
            });
        }

        return merged;
    }

    private warmInheritedIndex(document: vscode.TextDocument): void {
        this.refreshInheritedIndex(document);
    }

    private refreshInheritedIndex(document: vscode.TextDocument): IndexSnapshot {
        const indexSnapshot = this.getBestAvailableIndexSnapshot(document);
        this.projectSymbolIndex.updateFromSnapshot(indexSnapshot);
        this.indexMissingInheritedSnapshots(indexSnapshot.uri, new Set<string>([indexSnapshot.uri]));
        return indexSnapshot;
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
            inheritanceChannel.appendLine(`Failed to index inherited file ${uri}: ${error}`);
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

    public async scanInheritance(document: vscode.TextDocument): Promise<void> {
        inheritanceChannel.clear();
        inheritanceChannel.show(true);
        inheritanceChannel.appendLine(`正在分析文件: ${document.fileName}`);

        try {
            const snapshot = this.getIndexSnapshot(document, false);
            this.projectSymbolIndex.updateFromSnapshot(snapshot);
            this.indexMissingInheritedSnapshots(snapshot.uri, new Set<string>([snapshot.uri]));

            const inheritedSymbols = this.projectSymbolIndex.getInheritedSymbols(document.uri.toString());
            inheritanceChannel.appendLine(`解析完成:`);
            inheritanceChannel.appendLine(`  - 当前文件导出函数: ${snapshot.exportedFunctions.length}`);
            inheritanceChannel.appendLine(`  - 当前文件类型定义: ${snapshot.typeDefinitions.length}`);
            inheritanceChannel.appendLine(`  - 继承链长度: ${inheritedSymbols.chain.length}`);

            if (snapshot.inheritStatements.length > 0) {
                inheritanceChannel.appendLine(`\ninherit 列表:`);
                snapshot.inheritStatements.forEach(statement => {
                    inheritanceChannel.appendLine(`  - ${statement.value} (${statement.expressionKind})`);
                });
            }

            if (inheritedSymbols.functions.length > 0) {
                inheritanceChannel.appendLine(`\n继承函数:`);
                inheritedSymbols.functions.forEach(func => {
                    inheritanceChannel.appendLine(`  - ${normalizeLpcType(func.returnType)} ${func.name}()`);
                });
            }

            if (inheritedSymbols.unresolvedTargets.length > 0) {
                inheritanceChannel.appendLine(`\n未解析继承目标:`);
                inheritedSymbols.unresolvedTargets.forEach(target => {
                    inheritanceChannel.appendLine(`  - ${target.rawValue}`);
                });
            }
        } catch (error) {
            inheritanceChannel.appendLine(`错误: ${error}`);
        }
    }

    private getDocumentForUri(uri: string): vscode.TextDocument | undefined {
        return this.getOpenDocument(uri) || this.createReadonlyDocumentFromUri(uri);
    }

    private getBestAvailableIndexSnapshot(document: vscode.TextDocument): IndexSnapshot {
        return this.getIndexSnapshot(document, true);
    }

    private getIndexSnapshot(document: vscode.TextDocument, bestAvailable: boolean): IndexSnapshot {
        try {
            return bestAvailable
                ? this.astManager.getBestAvailableSemanticSnapshot(document)
                : this.astManager.getSemanticSnapshot(document, false);
        } catch {
            return bestAvailable
                ? this.astManager.getBestAvailableSnapshot(document)
                : this.astManager.getSnapshot(document, false);
        }
    }

    private createCompletionItem(candidate: CompletionCandidate, result: CompletionQueryResult, document: vscode.TextDocument): vscode.CompletionItem {
        const item = new vscode.CompletionItem(candidate.label, candidate.kind);
        item.detail = candidate.detail;
        item.sortText = `${this.getSortPrefix(candidate.sortGroup)}_${candidate.label}`;
        (item as vscode.CompletionItem & { data?: CompletionItemData }).data = {
            candidate,
            context: result.context,
            documentUri: document.uri.toString(),
            documentVersion: document.version,
            resolved: false
        };

        return item;
    }

    private buildStaticItems(): vscode.CompletionItem[] {
        return this.efunDocsManager.getAllFunctions().map((name) => {
            const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Function);
            this.applyEfunDocumentation(item, this.efunDocsManager.getStandardDoc(name));
            return item;
        });
    }

    private getSortPrefix(group: CompletionCandidate['sortGroup']): string {
        switch (group) {
            case 'scope': return '0';
            case 'type-member': return '1';
            case 'inherited': return '2';
            case 'builtin': return '3';
            case 'keyword': return '4';
            default: return '9';
        }
    }

    private applyEfunDocumentation(item: vscode.CompletionItem, doc?: EfunDoc): void {
        if (!doc) {
            return;
        }

        const markdown = new vscode.MarkdownString();
        if (doc.syntax) {
            markdown.appendCodeblock(doc.syntax, 'lpc');
        }
        if (doc.returnType) {
            markdown.appendMarkdown(`**Return Type:** \`${doc.returnType}\`\n\n`);
        }
        if (doc.description) {
            markdown.appendMarkdown(doc.description);
        }
        if (doc.example) {
            markdown.appendMarkdown(`\n\n**Example**\n`);
            markdown.appendCodeblock(doc.example, 'lpc');
        }

        item.documentation = markdown;
        item.detail = doc.returnType ? `${doc.returnType} ${item.label}` : item.detail;
        item.insertText = new vscode.SnippetString(`${item.label}($1)`);
    }

    private applyMacroDocumentation(item: vscode.CompletionItem, macroName: string): void {
        const macro = this.macroManager.getMacro(macroName);
        if (!macro) {
            return;
        }

        item.documentation = this.macroManager.getMacroHoverContent(macro);
    }

    private applyStructuredDocumentation(item: vscode.CompletionItem, candidate: CompletionCandidate): void {
        const markdown = new vscode.MarkdownString();
        const record = candidate.metadata.sourceUri ? this.projectSymbolIndex.getRecord(candidate.metadata.sourceUri) : undefined;
        const symbol = candidate.metadata.symbol;

        if (symbol?.definition) {
            markdown.appendCodeblock(symbol.definition, 'lpc');
        } else {
            markdown.appendCodeblock(candidate.detail, 'lpc');
        }

        if (symbol?.documentation) {
            markdown.appendMarkdown(`\n\n${symbol.documentation}`);
        }

        if (candidate.metadata.sourceType === 'inherited' && candidate.metadata.sourceUri) {
            markdown.appendMarkdown(`\n\n*Inherited from* \`${vscode.Uri.parse(candidate.metadata.sourceUri).fsPath}\``);
        }

        if (candidate.metadata.sourceType === 'struct-member' && candidate.metadata.sourceUri) {
            const member = this.findMemberDefinition(candidate.label, record?.typeDefinitions || []);
            if (member?.definition) {
                markdown.appendMarkdown(`\n\n**Member Definition**`);
                markdown.appendCodeblock(member.definition, 'lpc');
            }
        }

        item.documentation = markdown;

        if (symbol?.type === SymbolType.FUNCTION && symbol.parameters && symbol.parameters.length > 0) {
            item.insertText = new vscode.SnippetString(this.buildFunctionSnippet(symbol.name, symbol.parameters.map(parameter => parameter.name)));
        }

        if (candidate.metadata.sourceType === 'inherited') {
            const inheritedFunction = record?.exportedFunctions.find(func => func.name === candidate.label);
            if (inheritedFunction) {
                item.insertText = new vscode.SnippetString(
                    this.buildFunctionSnippet(inheritedFunction.name, inheritedFunction.parameters.map(parameter => parameter.name))
                );
            }
        }
    }

    private applyKeywordDocumentation(item: vscode.CompletionItem, candidate: CompletionCandidate): void {
        const markdown = new vscode.MarkdownString();
        markdown.appendCodeblock(candidate.label, 'lpc');
        markdown.appendMarkdown(`\n\n${candidate.detail}`);
        item.documentation = markdown;

        if (candidate.label === 'new') {
            item.insertText = new vscode.SnippetString('new(${1:struct_type}${2:, ${3:field1}: ${4:value1}})');
        }
    }

    private buildFunctionSnippet(name: string, parameterNames: string[]): string {
        if (parameterNames.length === 0) {
            return `${name}()`;
        }

        const params = parameterNames
            .map((parameterName, index) => `\${${index + 1}:${parameterName}}`)
            .join(', ');
        return `${name}(${params})`;
    }

    private findMemberDefinition(
        memberName: string,
        definitions: TypeDefinitionSummary[]
    ): TypeDefinitionSummary['members'][number] | undefined {
        for (const definition of definitions) {
            const member = definition.members.find(candidate => candidate.name === memberName);
            if (member) {
                return member;
            }
        }

        return undefined;
    }
}
