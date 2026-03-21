import * as vscode from 'vscode';
import type { EfunDocsManager } from '../efunDocs';
import type { EfunDoc } from './types';

export class EfunHoverProvider implements vscode.HoverProvider {
    public constructor(private readonly efunDocsManager: EfunDocsManager) {}

    public async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<vscode.Hover | undefined> {
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return undefined;
        }

        const word = document.getText(wordRange);

        await this.efunDocsManager.prepareHoverLookup(document);

        // 查找顺序：当前文件 -> 继承文件 -> include文件 -> 模拟函数库 -> 标准 efun
        const currentDoc = this.efunDocsManager.getCurrentFileDoc(word);
        if (currentDoc) {
            return this.createHoverContent(currentDoc);
        }

        const inheritedDoc = this.efunDocsManager.getInheritedFileDoc(word);
        if (inheritedDoc) {
            return this.createHoverContent(inheritedDoc);
        }

        const includeDoc = await this.efunDocsManager.getIncludedFileDoc(document, word);
        if (includeDoc) {
            return this.createHoverContent(includeDoc);
        }

        const simulatedDoc = this.efunDocsManager.getSimulatedDoc(word);
        if (simulatedDoc) {
            return this.createHoverContent(simulatedDoc);
        }

        const efunDoc = await this.efunDocsManager.getEfunDoc(word);
        if (!efunDoc) {
            return undefined;
        }

        return this.createHoverContent(efunDoc);
    }

    public createHoverContent(doc: EfunDoc): vscode.Hover {
        const content = new vscode.MarkdownString();
        content.isTrusted = false;
        content.supportHtml = true;

        if (doc.syntax) {
            content.appendMarkdown(`\`\`\`lpc\n${doc.syntax}\n\`\`\`\n\n`);
        }

        if (doc.returnType) {
            content.appendMarkdown(`**Return Type:** \`${doc.returnType}\`\n\n`);
        }

        if (doc.category) {
            content.appendMarkdown(`<sub>${doc.category}</sub>\n\n`);
        }

        content.appendMarkdown(`---\n\n`);

        if (doc.description) {
            const descLines = doc.description.split('\n');
            const mainDesc: string[] = [];
            const params: string[] = [];
            let inParams = false;

            for (const line of descLines) {
                if (line.trim() === '参数:') {
                    inParams = true;
                    continue;
                }
                if (inParams) {
                    params.push(line);
                } else if (line.trim()) {
                    mainDesc.push(line);
                }
            }

            if (mainDesc.length > 0) {
                content.appendMarkdown(`${mainDesc.join('\n')}\n\n`);
            }

            if (params.length > 0) {
                content.appendMarkdown(`#### Parameters\n\n`);
                content.appendMarkdown(`| Name | Type | Description |\n`);
                content.appendMarkdown(`|------|------|-------------|\n`);

                params.forEach(param => {
                    const cleaned = param.trim();
                    if (cleaned) {
                        const match = cleaned.match(/^(?:(.+?)\s+)?`?([A-Za-z_][A-Za-z0-9_]*)`?\s*:\s*(.+)$/);
                        if (match) {
                            const [, type, name, desc] = match;
                            const normalizedType = type?.trim();
                            const escapedDesc = this.escapeMarkdownTableCell(desc);
                            if (normalizedType) {
                                content.appendMarkdown(`| \`${name}\` | \`${normalizedType}\` | ${escapedDesc} |\n`);
                            } else {
                                content.appendMarkdown(`| \`${name}\` | | ${escapedDesc} |\n`);
                            }
                        } else {
                            content.appendMarkdown(`| ${this.escapeMarkdownTableCell(cleaned)} | | |\n`);
                        }
                    }
                });
                content.appendMarkdown(`\n`);
            }
        }

        if (doc.returnValue) {
            content.appendMarkdown(`#### Returns\n\n${doc.returnValue}\n\n`);
        }

        if (doc.details) {
            content.appendMarkdown(`#### Details\n\n${doc.details}\n\n`);
        }

        if (doc.note) {
            content.appendMarkdown(`> **Note**  \n> ${doc.note.replace(/\n/g, '\n> ')}\n\n`);
        }

        if (doc.reference && doc.reference.length > 0) {
            content.appendMarkdown(`**See also:** ${doc.reference.map(ref => `\`${ref}\``).join(', ')}\n`);
        }

        return new vscode.Hover(content);
    }

    private escapeMarkdownTableCell(value: string): string {
        return value
            .replace(/\\/g, '\\\\')
            .replace(/\|/g, '\\|')
            .replace(/\r?\n/g, '<br>');
    }
}
