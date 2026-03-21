import axios from 'axios';
import { extractReturnType } from './docParser';
import type { EfunDoc } from './types';
import { DEFAULT_EFUN_CATEGORY } from './BundledEfunLoader';

const MUD_WIKI_BASE_URL = 'https://mud.wiki';

export class RemoteEfunFetcher {
    public async fetchDoc(funcName: string): Promise<EfunDoc | undefined> {
        for (const title of this.getMudWikiTitleCandidates(funcName)) {
            try {
                const response = await axios.get(`${MUD_WIKI_BASE_URL}/${title}`);
                const doc = this.parseMudWikiDocHtml(funcName, response.data);
                if (doc) {
                    return doc;
                }
            } catch (error) {
                if ((error as { response?: { status?: number } }).response?.status === 404) {
                    continue;
                }

                throw error;
            }
        }

        return undefined;
    }

    private getMudWikiTitleCandidates(funcName: string): string[] {
        const firstLetterUpper = funcName.charAt(0).toUpperCase() + funcName.slice(1);
        const eachSegmentUpper = funcName
            .split('_')
            .map(segment => segment ? segment.charAt(0).toUpperCase() + segment.slice(1) : segment)
            .join('_');

        return Array.from(new Set([firstLetterUpper, eachSegmentUpper, funcName]));
    }

    private parseMudWikiDocHtml(funcName: string, html: string): EfunDoc | undefined {
        const contentMatch = html.match(/id="mw-content-text"[\s\S]*?<div class="printfooter">/u);
        if (!contentMatch) {
            return undefined;
        }

        const content = contentMatch[0];
        const sectionPattern = /<h3[\s\S]*?>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3\b|<div class="printfooter">)/gu;
        const doc: EfunDoc = {
            name: funcName,
            syntax: '',
            description: '',
            category: DEFAULT_EFUN_CATEGORY
        };
        const extraSections: string[] = [];

        for (const match of content.matchAll(sectionPattern)) {
            const title = this.decodeHtmlEntities(this.stripHtmlTags(match[1])).replace(/\[编辑\]$/u, '').trim();
            const sectionHtml = match[2];
            const text = this.decodeHtmlEntities(this.stripHtmlTags(sectionHtml))
                .replace(/\r/g, '')
                .replace(/[ \t]+\n/g, '\n')
                .replace(/\n{3,}/g, '\n\n')
                .trim();

            switch (title) {
                case '名称':
                case '翻译':
                    break;
                case '语法':
                    doc.syntax = text;
                    doc.returnType = extractReturnType(text, funcName);
                    break;
                case '描述':
                    doc.description = text;
                    break;
                case '返回值':
                    doc.returnValue = text;
                    break;
                case '参考':
                    doc.reference = Array.from(new Set(Array.from(sectionHtml.matchAll(/<a [^>]*>(.*?)<\/a>/gu))
                        .map(linkMatch => this.decodeHtmlEntities(this.stripHtmlTags(linkMatch[1])).trim())
                        .map(name => name.replace(/\(\d+\)$/u, '').replace(/\*$/u, '').trim())
                        .filter(Boolean)
                        .filter(name => name !== funcName)));
                    break;
                default:
                    if (text) {
                        extraSections.push(`${title}\n${text}`);
                    }
                    break;
            }
        }

        if (!doc.syntax && !doc.description && !doc.returnValue) {
            return undefined;
        }

        if (extraSections.length > 0) {
            doc.details = extraSections.join('\n\n');
        }

        if (!doc.returnType) {
            doc.returnType = extractReturnType(doc.syntax, funcName);
        }

        return doc;
    }

    private stripHtmlTags(value: string): string {
        return value
            .replace(/<br\s*\/?>/giu, '\n')
            .replace(/<\/p>/giu, '\n')
            .replace(/<[^>]+>/gu, '');
    }

    private decodeHtmlEntities(value: string): string {
        return value
            .replace(/&#(\d+);/gu, (_, code: string) => String.fromCodePoint(Number(code)))
            .replace(/&nbsp;/giu, ' ')
            .replace(/&lt;/giu, '<')
            .replace(/&gt;/giu, '>')
            .replace(/&amp;/giu, '&')
            .replace(/&quot;/giu, '"')
            .replace(/&#39;/giu, '\'');
    }
}
