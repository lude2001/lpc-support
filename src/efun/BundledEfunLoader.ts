import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { resolveUiLocale, type UiLocale } from '../localization/locale';
import type {
    StructuredEfunDoc,
    StructuredEfunParameter,
    StructuredEfunSignature
} from './types';

const BUNDLED_DOCS_DIR = 'efun-docs';
const BUNDLED_DOCS_SUBDIR = 'docs';
const BUNDLED_CATEGORIES_FILE = 'categories.json';

export class BundledEfunLoader {
    private structuredDocs: Map<string, StructuredEfunDoc> = new Map();
    private categories: Map<string, string[]> = new Map();
    private categoryLabels: Map<string, string> = new Map();

    constructor(private readonly locale: UiLocale = resolveUiLocale(vscode.env.language)) {
    }

    public async load(context: vscode.ExtensionContext): Promise<void> {
        await this.loadBundledDocsAsync(context);
    }

    public getStructuredDoc(name: string): StructuredEfunDoc | undefined {
        return this.structuredDocs.get(name);
    }

    public getAllNames(): string[] {
        return Array.from(this.structuredDocs.keys());
    }

    public getCategories(): Map<string, string[]> {
        return this.categories;
    }

    public getCategoryLabel(categoryId: string): string {
        return this.categoryLabels.get(categoryId) ?? categoryId;
    }

    private async loadBundledDocsAsync(context: vscode.ExtensionContext): Promise<void> {
        const bundledDocsDir = this.getBundledDocsDir(context);
        if (fs.existsSync(bundledDocsDir) && fs.statSync(bundledDocsDir).isDirectory()) {
            await this.loadSplitBundledDocsAsync(bundledDocsDir);
            return;
        }

        console.error(`未找到内置 Efun 文档目录: ${bundledDocsDir}`);
        this.structuredDocs = new Map();
        this.categories = new Map();
    }

    private async loadSplitBundledDocsAsync(bundledDocsDir: string): Promise<void> {
        const categoriesPath = path.join(bundledDocsDir, BUNDLED_CATEGORIES_FILE);
        const docsDir = path.join(bundledDocsDir, BUNDLED_DOCS_SUBDIR);

        if (!fs.existsSync(categoriesPath) || !fs.existsSync(docsDir) || !fs.statSync(docsDir).isDirectory()) {
            console.error(`未找到内置 Efun 拆分文档目录: ${bundledDocsDir}`);
            this.structuredDocs = new Map();
            this.categories = new Map();
            return;
        }

        const [rawCategories, englishCategories, selectedCategories] = await Promise.all([
            readOptionalObject(categoriesPath),
            readOptionalObject(path.join(bundledDocsDir, 'locales', 'en', BUNDLED_CATEGORIES_FILE)),
            this.locale === 'en' ? undefined
                : readOptionalObject(path.join(bundledDocsDir, 'locales', this.locale, BUNDLED_CATEGORIES_FILE))
        ]);
        this.categoryLabels = new Map(Object.keys(rawCategories).map(categoryId => [
            categoryId, selectText(selectedCategories?.[categoryId], englishCategories[categoryId]) ?? categoryId
        ]));

        const structuredDocs = new Map<string, StructuredEfunDoc>();
        const docFiles = fs.readdirSync(docsDir)
            .filter(fileName => fileName.endsWith('.json'))
            .sort((left, right) => left.localeCompare(right));

        const loadedDocs = await Promise.all(
            docFiles.map(async (fileName) => {
                const docKey = path.basename(fileName, '.json');
                const docPath = path.join(docsDir, fileName);

                try {
                    const content = await fs.promises.readFile(docPath, 'utf8');
                    const docValue = JSON.parse(content);
                    const [english, selected] = await Promise.all([
                        readOptionalObject(path.join(bundledDocsDir, 'locales', 'en', fileName)),
                        this.locale === 'en' ? undefined
                            : readOptionalObject(path.join(bundledDocsDir, 'locales', this.locale, fileName))
                    ]);
                    return { docKey, docValue, english, selected };
                } catch (error) {
                    console.warn(`忽略无法加载的 Efun 文档文件: ${docPath}`, error);
                    return null;
                }
            })
        );

        for (const item of loadedDocs) {
            if (!item) {
                continue;
            }

            const normalized = normalizeStructuredDoc(item.docKey, item.docValue, item.english, item.selected,
                categoryId => this.getCategoryLabel(categoryId));
            if (!normalized) {
                continue;
            }

            structuredDocs.set(item.docKey, cloneStructuredDoc(normalized));
        }

        this.structuredDocs = structuredDocs;
        this.categories = this.loadCategories(rawCategories, structuredDocs);
    }

    private loadCategories(
        rawCategories: unknown,
        docs: Map<string, StructuredEfunDoc>
    ): Map<string, string[]> {
        if (!isRecord(rawCategories)) {
            console.error('加载内置 Efun 文档失败: 缺少合法的 categories 对象');
            return new Map();
        }

        const categories = new Map<string, string[]>();
        for (const [category, refs] of Object.entries(rawCategories)) {
            if (!Array.isArray(refs)) {
                console.warn(`忽略非法的 Efun 分类引用列表: ${category}`);
                categories.set(category, []);
                continue;
            }

            const validRefs = refs.filter((docKey): docKey is string => {
                if (typeof docKey !== 'string' || !docs.has(docKey)) {
                    console.warn(`忽略不存在的 Efun 分类引用: ${category} -> ${String(docKey)}`);
                    return false;
                }
                return true;
            });

            categories.set(category, validRefs);
        }

        return categories;
    }

    private getBundledDocsDir(context: vscode.ExtensionContext): string {
        if (context?.extensionPath) {
            return path.join(context.extensionPath, 'config', BUNDLED_DOCS_DIR);
        }

        return path.join(path.resolve(__dirname, '..', '..'), 'config', BUNDLED_DOCS_DIR);
    }
}

async function readOptionalObject(filename: string): Promise<Record<string, unknown>> {
    try {
        const value: unknown = JSON.parse(await fs.promises.readFile(filename, 'utf8'));
        if (isRecord(value)) {
            return value;
        }
    } catch (error) {
        console.warn(`Cannot load optional Efun text resource: ${filename}`, error);
    }
    // Translation failure must never remove the independent signature facts.
    return {};
}

function selectText(selected: unknown, english: unknown): string | undefined {
    const usable = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
    // Preserve body bytes, including code indentation and trailing newlines.
    return usable(selected) ? selected : usable(english) ? english : undefined;
}

function normalizeStructuredDoc(
    docKey: string, value: unknown, english: Record<string, unknown>, selected: Record<string, unknown> | undefined,
    categoryLabel: (categoryId: string) => string
): StructuredEfunDoc | undefined {
    if (!isRecord(value)) {
        console.warn(`忽略非法的 Efun 文档条目: ${docKey}`);
        return undefined;
    }

    if (typeof value.name !== 'string' || !value.name.trim()) {
        console.warn(`忽略缺少 name 的 Efun 文档条目: ${docKey}`);
        return undefined;
    }

    if (value.name.trim() !== docKey) {
        console.warn(`忽略 key 与 name 不一致的 Efun 文档条目: ${docKey} -> ${value.name.trim()}`);
        return undefined;
    }

    if (typeof value.categoryId !== 'string' || !value.categoryId.trim()) {
        console.warn(`忽略缺少 categoryId 的 Efun 文档条目: ${docKey}`);
        return undefined;
    }

    if (!Array.isArray(value.signatures) || value.signatures.length === 0) {
        console.warn(`忽略缺少 signatures 的 Efun 文档条目: ${docKey}`);
        return undefined;
    }

    const signatures: StructuredEfunSignature[] = [];
    for (const signature of value.signatures) {
        const normalizedSignature = normalizeSignature(docKey, signature);
        if (!normalizedSignature) {
            return undefined;
        }
        signatures.push(normalizedSignature);
    }

    return {
        name: value.name.trim(),
        summary: selectText(selected?.summary, english.summary),
        details: selectText(selected?.details, english.details),
        note: selectText(selected?.note, english.note),
        reference: Array.isArray(value.reference)
            ? value.reference
                .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
                .map((item) => item.trim())
            : undefined,
        categoryId: value.categoryId,
        category: categoryLabel(value.categoryId),
        signatures
    };
}

function normalizeSignature(docKey: string, value: unknown): StructuredEfunSignature | undefined {
    if (!isRecord(value)) {
        console.warn(`忽略非法的 Efun 签名条目: ${docKey}`);
        return undefined;
    }

    if (typeof value.label !== 'string' || !value.label.trim()) {
        console.warn(`忽略缺少 label 的 Efun 文档条目: ${docKey}`);
        return undefined;
    }

    if (typeof value.isVariadic !== 'boolean') {
        console.warn(`忽略缺少 isVariadic 的 Efun 文档条目: ${docKey}`);
        return undefined;
    }

    if (!Array.isArray(value.parameters)) {
        console.warn(`忽略缺少 parameters 的 Efun 文档条目: ${docKey}`);
        return undefined;
    }

    const parameters: StructuredEfunParameter[] = [];
    for (const parameter of value.parameters) {
        const normalizedParameter = normalizeParameter(docKey, parameter);
        if (!normalizedParameter) {
            return undefined;
        }
        parameters.push(normalizedParameter);
    }

    const arity = normalizeArity(docKey, value);
    if (arity === undefined && Object.prototype.hasOwnProperty.call(value, 'arity')) {
        return undefined;
    }

    return {
        label: value.label.trim(),
        returnType: normalizeOptionalText(value.returnType),
        isVariadic: value.isVariadic,
        arity,
        parameters
    };
}

function normalizeParameter(docKey: string, value: unknown): StructuredEfunParameter | undefined {
    if (!isRecord(value)) {
        console.warn(`忽略非法的 Efun 参数条目: ${docKey}`);
        return undefined;
    }

    if (typeof value.name !== 'string' || !value.name.trim()) {
        console.warn(`忽略缺少 name 的 Efun 参数条目: ${docKey}`);
        return undefined;
    }

    return {
        name: value.name.trim(),
        type: normalizeOptionalText(value.type),
        description: normalizeOptionalText(value.description),
        optional: value.optional === true ? true : undefined,
        variadic: value.variadic === true ? true : undefined
    };
}

function cloneStructuredDoc(structuredDoc: StructuredEfunDoc): StructuredEfunDoc {
    return {
        name: structuredDoc.name,
        summary: structuredDoc.summary,
        details: structuredDoc.details,
        note: structuredDoc.note,
        reference: structuredDoc.reference ? [...structuredDoc.reference] : undefined,
        categoryId: structuredDoc.categoryId,
        category: structuredDoc.category,
        signatures: structuredDoc.signatures.map(cloneStructuredSignature)
    };
}

function cloneStructuredSignature(signature: StructuredEfunSignature): StructuredEfunSignature {
    return {
        label: signature.label,
        returnType: signature.returnType,
        isVariadic: signature.isVariadic,
        arity: signature.arity
            ? {
                min: signature.arity.min,
                max: signature.arity.max
            }
            : undefined,
        parameters: signature.parameters.map(parameter => ({
            name: parameter.name,
            type: parameter.type,
            description: parameter.description,
            optional: parameter.optional,
            variadic: parameter.variadic
        }))
    };
}

function normalizeOptionalText(value: unknown): string | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
}

function normalizeArity(docKey: string, docValue: Record<string, any>): { min: number; max?: number | null } | undefined {
    if (!Object.prototype.hasOwnProperty.call(docValue, 'arity')) {
        return undefined;
    }

    const arityValue = docValue.arity;
    if (!isRecord(arityValue)) {
        console.warn(`忽略非法的 Efun 签名 arity: ${docKey}`);
        return undefined;
    }

    if (!isNonNegativeInteger(arityValue.min)) {
        console.warn(`忽略非法的 Efun 签名 arity.min: ${docKey}`);
        return undefined;
    }

    if (Object.prototype.hasOwnProperty.call(arityValue, 'max')) {
        if (arityValue.max === null) {
            return { min: arityValue.min, max: null };
        }

        if (!isNonNegativeInteger(arityValue.max) || arityValue.max < arityValue.min) {
            console.warn(`忽略非法的 Efun 签名 arity.max: ${docKey}`);
            return undefined;
        }

        return {
            min: arityValue.min,
            max: arityValue.max
        };
    }

    return {
        min: arityValue.min
    };
}

function isNonNegativeInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isRecord(value: unknown): value is Record<string, any> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
