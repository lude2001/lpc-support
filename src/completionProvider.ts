import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { EfunDocsManager } from './efunDocs';

export class LPCCompletionItemProvider implements vscode.CompletionItemProvider {
    private types = ['void', 'int', 'string', 'object', 'mapping', 'mixed', 'float', 'buffer'];
    private modifiers = ['private', 'protected', 'public', 'static', 'nomask', 'varargs'];
    private efunDocsManager: EfunDocsManager;

    constructor(efunDocsManager: EfunDocsManager) {
        this.efunDocsManager = efunDocsManager;
    }

    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        const linePrefix = document.lineAt(position).text.substr(0, position.character);
        const completionItems: vscode.CompletionItem[] = [];

        // 添加类型提示
        this.types.forEach(type => {
            const item = new vscode.CompletionItem(type, vscode.CompletionItemKind.TypeParameter);
            item.detail = `LPC 类型: ${type}`;
            completionItems.push(item);
        });

        // 添加修饰符提示
        this.modifiers.forEach(modifier => {
            const item = new vscode.CompletionItem(modifier, vscode.CompletionItemKind.Keyword);
            item.detail = `LPC 修饰符: ${modifier}`;
            completionItems.push(item);
        });

        // 添加标准函数提示
        const efunFunctions = this.efunDocsManager.getAllFunctions();
        efunFunctions.forEach(funcName => {
            const item = new vscode.CompletionItem(funcName, vscode.CompletionItemKind.Function);
            item.detail = `LPC Efun: ${funcName}`;
            item.documentation = new vscode.MarkdownString(`正在加载 ${funcName} 的文档...`);

            // 异步加载函数文档
            this.efunDocsManager.getEfunDoc(funcName).then(doc => {
                if (doc) {
                    const markdown = new vscode.MarkdownString();
                    if (doc.syntax) {
                        markdown.appendCodeblock(doc.syntax, 'lpc');
                        markdown.appendMarkdown('\n');
                    }
                    if (doc.description) {
                        markdown.appendMarkdown(doc.description);
                    }
                    item.documentation = markdown;
                }
            });

            // 添加基本的代码片段
            item.insertText = new vscode.SnippetString(`${funcName}(\${1})`);
            completionItems.push(item);
        });

        // 添加模拟函数库提示
        const simulatedFunctions = this.efunDocsManager.getAllSimulatedFunctions();
        simulatedFunctions.forEach(funcName => {
            const item = new vscode.CompletionItem(funcName, vscode.CompletionItemKind.Function);
            item.detail = `模拟函数库: ${funcName}`;
            item.documentation = new vscode.MarkdownString(`正在加载 ${funcName} 的文档...`);

            // 获取函数文档
            const doc = this.efunDocsManager.getSimulatedDoc(funcName);
            if (doc) {
                const markdown = new vscode.MarkdownString();
                if (doc.syntax) {
                    markdown.appendCodeblock(doc.syntax, 'lpc');
                    markdown.appendMarkdown('\n');
                }
                if (doc.description) {
                    markdown.appendMarkdown(doc.description);
                }
                item.documentation = markdown;
            }

            // 添加基本的代码片段
            item.insertText = new vscode.SnippetString(`${funcName}(\${1})`);
            completionItems.push(item);
        });

        // 添加特定上下文的提示
        if (linePrefix.endsWith('->')) {
            // 对象方法调用提示
            this.addObjectMethodCompletions(completionItems);
        } else if (linePrefix.match(/^\s*#/)) {
            // 预处理指令提示
            this.addPreprocessorCompletions(completionItems);
        }

        return completionItems;
    }

    private addObjectMethodCompletions(completionItems: vscode.CompletionItem[]): void {
        const commonMethods = [
            { name: 'query', snippet: 'query(${1:prop})', detail: '查询属性值' },
            { name: 'set', snippet: 'set(${1:prop}, ${2:value})', detail: '设置属性值' },
            { name: 'add', snippet: 'add(${1:prop}, ${2:value})', detail: '添加属性值' },
            { name: 'delete', snippet: 'delete(${1:prop})', detail: '删除属性' }
        ];

        commonMethods.forEach(method => {
            const item = new vscode.CompletionItem(method.name, vscode.CompletionItemKind.Method);
            item.detail = method.detail;
            item.insertText = new vscode.SnippetString(method.snippet);
            completionItems.push(item);
        });
    }

    private addPreprocessorCompletions(completionItems: vscode.CompletionItem[]): void {
        const preprocessors = [
            { name: 'include', snippet: 'include <${1:file}>', detail: '包含头文件' },
            { name: 'define', snippet: 'define ${1:MACRO} ${2:value}', detail: '定义宏' },
            { name: 'ifdef', snippet: 'ifdef ${1:MACRO}\n\t${2}\n#endif', detail: '条件编译' },
            { name: 'ifndef', snippet: 'ifndef ${1:MACRO}\n\t${2}\n#endif', detail: '条件编译' },
            { name: 'endif', snippet: 'endif', detail: '结束条件编译' }
        ];

        preprocessors.forEach(prep => {
            const item = new vscode.CompletionItem(prep.name, vscode.CompletionItemKind.Keyword);
            item.detail = prep.detail;
            item.insertText = new vscode.SnippetString(prep.snippet);
            completionItems.push(item);
        });
    }
} 