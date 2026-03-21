import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { extractReturnType } from './docParser';
import type { BundledEfunDocBundle, EfunDoc, LegacyEfunConfig } from './types';

const BUNDLED_DOCS_FILE = 'efun-docs.json';
const LEGACY_CONFIG_FILE = 'lpc-config.json';

export const DEFAULT_EFUN_CATEGORY = '标准 Efun';

export class BundledEfunLoader {
    private docs: Map<string, EfunDoc> = new Map();
    private categories: Map<string, string[]> = new Map();

    constructor(context: vscode.ExtensionContext) {
        this.loadBundledDocs(context);
    }

    public get(name: string): EfunDoc | undefined {
        return this.docs.get(name);
    }

    public getAllNames(): string[] {
        return Array.from(this.docs.keys());
    }

    public getCategories(): Map<string, string[]> {
        return this.categories;
    }

    private loadBundledDocs(context: vscode.ExtensionContext): void {
        for (const basePath of this.getConfigSearchRoots(context)) {
            const bundledDocsPath = path.join(basePath, 'config', BUNDLED_DOCS_FILE);

            try {
                if (!fs.existsSync(bundledDocsPath)) {
                    continue;
                }

                const bundle = JSON.parse(fs.readFileSync(bundledDocsPath, 'utf8')) as BundledEfunDocBundle;
                this.docs = new Map(
                    Object.entries(bundle.docs ?? {}).map(([name, doc]) => [name, { ...doc, name } as EfunDoc])
                );
                this.categories = new Map(
                    Object.entries(bundle.categories ?? {}).map(([category, names]) => [category, [...names]])
                );
                return;
            } catch (error) {
                console.error('加载内置 Efun 文档失败:', error);
            }
        }

        this.loadLegacyBundledDocs(context);
    }

    private loadLegacyBundledDocs(context: vscode.ExtensionContext): void {
        for (const basePath of this.getConfigSearchRoots(context)) {
            const legacyConfigPath = path.join(basePath, 'config', LEGACY_CONFIG_FILE);

            try {
                if (!fs.existsSync(legacyConfigPath)) {
                    continue;
                }

                const config = JSON.parse(fs.readFileSync(legacyConfigPath, 'utf8')) as LegacyEfunConfig;
                const docs = new Map<string, EfunDoc>();
                const categories = new Map<string, string[]>();

                Object.entries(config.efuns ?? {})
                    .sort(([left], [right]) => left.localeCompare(right))
                    .forEach(([name, entry]) => {
                        const category = entry.category?.trim() || DEFAULT_EFUN_CATEGORY;
                        const list = categories.get(category) ?? [];
                        list.push(name);
                        categories.set(category, list);

                        const syntax = this.normalizeSnippet(entry.snippet, name);
                        docs.set(name, {
                            name,
                            syntax,
                            description: entry.description?.trim() || entry.detail?.trim() || `${name} 内置函数`,
                            returnType: extractReturnType(syntax, name),
                            returnValue: this.cleanText(entry.returnValue),
                            details: this.cleanText(entry.details),
                            reference: Array.isArray(entry.reference) ? entry.reference.filter(Boolean) : undefined,
                            category,
                            note: this.cleanText(entry.note)
                        });
                    });

                this.docs = docs;
                this.categories = categories;
                return;
            } catch (error) {
                console.error('加载备用 Efun 文档失败:', error);
            }
        }
    }

    private getConfigSearchRoots(context: vscode.ExtensionContext): string[] {
        const roots = new Set<string>();
        if (context?.extensionPath) {
            roots.add(context.extensionPath);
        }
        roots.add(path.resolve(__dirname, '..', '..'));
        return Array.from(roots);
    }

    private normalizeSnippet(snippet: string | undefined, funcName: string): string {
        const template = (snippet?.trim() || `${funcName}()`)
            .replace(/\$\{\d+\|([^}]+)\|\}/g, (_, options: string) => options.split(',')[0]?.trim() ?? '')
            .replace(/\$\{\d+:([^}]+)\}/g, '$1')
            .replace(/\$\{\d+\}/g, '')
            .replace(/\$\d+/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        return template || `${funcName}()`;
    }

    private cleanText(value: string | undefined): string | undefined {
        const cleaned = value?.trim();
        return cleaned ? cleaned : undefined;
    }
}
