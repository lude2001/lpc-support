import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const currentFilePath = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFilePath), '..');
const legacyConfigPath = path.join(rootDir, 'config', 'lpc-config.json');
const outputPath = path.join(rootDir, 'config', 'efun-docs.json');
const listUrl = 'https://mud.wiki/Lpc:Efun';
const baseUrl = 'https://mud.wiki';
const maxConcurrency = 8;
const defaultCategory = '标准 Efun';

function normalizeText(value) {
    return value
        .replace(/\u00a0/g, ' ')
        .replace(/\r/g, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function cleanSectionTitle(value) {
    return normalizeText(value).replace(/\[编辑\]$/u, '');
}

function normalizeFunctionName(value) {
    return normalizeText(value)
        .replace(/\(\d+\)$/u, '')
        .replace(/\*$/u, '')
        .trim();
}

function normalizeSnippet(snippet, funcName) {
    const template = (snippet?.trim() || `${funcName}()`)
        .replace(/\$\{\d+\|([^}]+)\|\}/g, (_, options) => options.split(',')[0]?.trim() ?? '')
        .replace(/\$\{\d+:([^}]+)\}/g, '$1')
        .replace(/\$\{\d+\}/g, '')
        .replace(/\$\d+/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    return template || `${funcName}()`;
}

function extractReturnType(syntax, funcName) {
    if (!syntax) {
        return undefined;
    }

    const firstLine = syntax
        .split('\n')
        .map(line => line.trim())
        .find(Boolean);

    if (!firstLine) {
        return undefined;
    }

    const escapedName = funcName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = firstLine.match(new RegExp(`\\b${escapedName}\\s*\\(`));
    if (!match || match.index === undefined) {
        return undefined;
    }

    let prefix = firstLine.slice(0, match.index).trim().replace(/^varargs\s+/i, '');
    if (!prefix) {
        return undefined;
    }

    if (prefix.includes('=')) {
        prefix = prefix.slice(0, prefix.lastIndexOf('=')).trim();
        prefix = prefix.replace(/\s+[A-Za-z_][A-Za-z0-9_]*$/u, '').trim();
    }

    return prefix || undefined;
}

function cleanText(value) {
    const cleaned = typeof value === 'string' ? value.trim() : '';
    return cleaned || undefined;
}

function loadLegacyFallback() {
    const legacyConfig = JSON.parse(fs.readFileSync(legacyConfigPath, 'utf8'));
    const docs = new Map();

    for (const [name, entry] of Object.entries(legacyConfig.efuns ?? {})) {
        docs.set(name, {
            name,
            syntax: normalizeSnippet(entry.snippet, name),
            description: cleanText(entry.description) || cleanText(entry.detail) || `${name} 内置函数`,
            returnType: extractReturnType(normalizeSnippet(entry.snippet, name), name),
            returnValue: cleanText(entry.returnValue),
            details: cleanText(entry.details),
            reference: Array.isArray(entry.reference) ? entry.reference.filter(Boolean) : undefined,
            category: cleanText(entry.category) || defaultCategory,
            note: cleanText(entry.note)
        });
    }

    return docs;
}

async function fetchHtml(url) {
    const response = await fetch(url, {
        headers: {
            'user-agent': 'lpc-support-doc-generator'
        }
    });

    if (!response.ok) {
        throw new Error(`Request failed with ${response.status}: ${url}`);
    }

    return response.text();
}

function parseEfunList(html) {
    const $ = cheerio.load(html);
    const root = $('#mw-content-text .mw-parser-output');
    const categories = {};
    const items = [];
    const seen = new Set();

    root.children('h2').each((_, heading) => {
        const category = cleanSectionTitle($(heading).text());
        const functionNames = [];

        $(heading)
            .nextUntil('h2')
            .find('a[href^="/"]')
            .each((__, link) => {
                const href = $(link).attr('href');
                const label = normalizeText($(link).text());
                const name = normalizeFunctionName(label);

                if (!href || !name || !/^[A-Za-z_][A-Za-z0-9_]*$/u.test(name)) {
                    return;
                }

                if (!functionNames.includes(name)) {
                    functionNames.push(name);
                }

                if (seen.has(name)) {
                    return;
                }

                seen.add(name);
                items.push({
                    name,
                    href,
                    category,
                    optional: /\*$/u.test(label),
                    missingPage: href.includes('redlink=1')
                });
            });

        if (functionNames.length > 0) {
            categories[category] = functionNames;
        }
    });

    return { categories, items };
}

function extractSectionText($, heading) {
    const blocks = $(heading).nextUntil('h3');
    if (blocks.length === 0) {
        return '';
    }

    const preferredText = blocks
        .map((_, node) => normalizeText($(node).text()))
        .get()
        .filter(Boolean)
        .join('\n\n');

    return normalizeText(preferredText);
}

function parseReferenceSection($, heading, currentName) {
    const links = $(heading)
        .nextUntil('h3')
        .find('a[href^="/"]')
        .map((_, link) => normalizeFunctionName($(link).text()))
        .get()
        .filter(name => name && name !== currentName);

    return Array.from(new Set(links));
}

function appendOptionalNote(existingNote) {
    const note = '该函数在 MudWiki 列表页中被标记为可选 PACKAGE 函数，默认驱动可能不可用。';
    return existingNote ? `${existingNote}\n${note}` : note;
}

function mergeDoc(siteDoc, fallbackDoc) {
    return {
        name: siteDoc.name,
        syntax: siteDoc.syntax || fallbackDoc?.syntax || `${siteDoc.name}()`,
        description: siteDoc.description || fallbackDoc?.description || `${siteDoc.name} 内置函数`,
        returnType: siteDoc.returnType || fallbackDoc?.returnType || extractReturnType(siteDoc.syntax || fallbackDoc?.syntax, siteDoc.name),
        returnValue: siteDoc.returnValue || fallbackDoc?.returnValue,
        details: siteDoc.details || fallbackDoc?.details,
        reference: siteDoc.reference?.length ? siteDoc.reference : fallbackDoc?.reference,
        category: siteDoc.category || fallbackDoc?.category || defaultCategory,
        note: siteDoc.note || fallbackDoc?.note
    };
}

async function parseEfunDoc(item, fallbackDocs) {
    const url = `${baseUrl}${item.href}`;
    const fallbackDoc = fallbackDocs.get(item.name);

    if (item.missingPage) {
        if (fallbackDoc) {
            return {
                ...fallbackDoc,
                category: item.category || fallbackDoc.category || defaultCategory,
                note: item.optional ? appendOptionalNote(fallbackDoc.note) : fallbackDoc.note
            };
        }

        return {
            name: item.name,
            syntax: `${item.name}()`,
            description: 'MudWiki 列表包含该函数，但详情页尚未提供内容。',
            category: item.category || defaultCategory,
            note: item.optional ? appendOptionalNote(undefined) : undefined
        };
    }

    try {
        const html = await fetchHtml(url);
        const $ = cheerio.load(html);
        const root = $('#mw-content-text .mw-parser-output');
        const doc = {
            name: item.name,
            category: item.category || fallbackDoc?.category || defaultCategory
        };
        const extraSections = [];

        root.children('h3').each((_, heading) => {
            const section = cleanSectionTitle($(heading).text());
            const text = extractSectionText($, heading);

            switch (section) {
                case '名称':
                    break;
                case '语法':
                    doc.syntax = text;
                    doc.returnType = extractReturnType(text, item.name);
                    break;
                case '描述':
                    doc.description = text;
                    break;
                case '返回值':
                    doc.returnValue = text;
                    break;
                case '参考':
                    doc.reference = parseReferenceSection($, heading, item.name);
                    break;
                case '翻译':
                    break;
                default:
                    if (text) {
                        extraSections.push(`${section}\n${text}`);
                    }
                    break;
            }
        });

        if (extraSections.length > 0) {
            doc.details = extraSections.join('\n\n');
        }

        if (item.optional) {
            doc.note = appendOptionalNote(doc.note || fallbackDoc?.note);
        }

        return mergeDoc(doc, fallbackDoc);
    } catch (error) {
        console.warn(`Failed to fetch ${item.name} from ${url}: ${error.message}`);

        if (fallbackDoc) {
            return {
                ...fallbackDoc,
                category: item.category || fallbackDoc.category || defaultCategory,
                note: item.optional ? appendOptionalNote(fallbackDoc.note) : fallbackDoc.note
            };
        }

        return {
            name: item.name,
            syntax: `${item.name}()`,
            description: 'MudWiki 文档抓取失败。',
            category: item.category || defaultCategory,
            note: item.optional ? appendOptionalNote(undefined) : undefined
        };
    }
}

async function mapWithConcurrency(items, mapper) {
    const results = new Array(items.length);
    let index = 0;

    async function worker() {
        while (index < items.length) {
            const currentIndex = index++;
            results[currentIndex] = await mapper(items[currentIndex], currentIndex);
        }
    }

    const workerCount = Math.min(maxConcurrency, items.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return results;
}

async function main() {
    const fallbackDocs = loadLegacyFallback();
    const listHtml = await fetchHtml(listUrl);
    const { categories, items } = parseEfunList(listHtml);

    console.log(`Discovered ${items.length} efun pages from ${listUrl}`);

    const docsArray = await mapWithConcurrency(items, async (item, index) => {
        if ((index + 1) % 25 === 0 || index === items.length - 1) {
            console.log(`Fetched ${index + 1}/${items.length}`);
        }
        return parseEfunDoc(item, fallbackDocs);
    });

    const docs = {};
    for (const doc of docsArray.sort((left, right) => left.name.localeCompare(right.name))) {
        docs[doc.name] = doc;
    }

    const bundle = {
        generatedAt: new Date().toISOString(),
        source: listUrl,
        categories,
        docs
    };

    fs.writeFileSync(outputPath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
    console.log(`Generated ${outputPath}`);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
