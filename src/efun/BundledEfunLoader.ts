import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type {
    StructuredEfunDoc,
    StructuredEfunDocBundle,
    StructuredEfunParameter,
    StructuredEfunSignature
} from './types';

const BUNDLED_DOCS_DIR = 'efun-docs';
const BUNDLED_DOCS_SUBDIR = 'docs';
const BUNDLED_CATEGORIES_FILE = 'categories.json';
const LEGACY_BUNDLED_DOCS_FILE = 'efun-docs.json';

export const DEFAULT_EFUN_CATEGORY = '标准 Efun';

export class BundledEfunLoader {
    private structuredDocs: Map<string, StructuredEfunDoc> = new Map();
    private categories: Map<string, string[]> = new Map();

    constructor(context: vscode.ExtensionContext) {
        this.loadBundledDocs(context);
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

    private loadBundledDocs(context: vscode.ExtensionContext): void {
        const bundledDocsDir = this.getBundledDocsDir(context);
        if (fs.existsSync(bundledDocsDir) && fs.statSync(bundledDocsDir).isDirectory()) {
            this.loadSplitBundledDocs(bundledDocsDir);
            return;
        }

        this.loadLegacyBundledDocs(this.getLegacyBundledDocsPath(context));
    }

    private loadSplitBundledDocs(bundledDocsDir: string): void {
        const categoriesPath = path.join(bundledDocsDir, BUNDLED_CATEGORIES_FILE);
        const docsDir = path.join(bundledDocsDir, BUNDLED_DOCS_SUBDIR);

        if (!fs.existsSync(categoriesPath) || !fs.existsSync(docsDir) || !fs.statSync(docsDir).isDirectory()) {
            console.error(`未找到内置 Efun 拆分文档目录: ${bundledDocsDir}`);
            this.structuredDocs = new Map();
            this.categories = new Map();
            return;
        }

        let rawCategories: unknown;
        try {
            rawCategories = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'));
        } catch (error) {
            console.error('加载内置 Efun 分类失败: JSON 解析错误', error);
            this.structuredDocs = new Map();
            this.categories = new Map();
            return;
        }

        const structuredDocs = new Map<string, StructuredEfunDoc>();
        const docFiles = fs.readdirSync(docsDir)
            .filter(fileName => fileName.endsWith('.json'))
            .sort((left, right) => left.localeCompare(right));

        for (const fileName of docFiles) {
            const docKey = path.basename(fileName, '.json');
            const docPath = path.join(docsDir, fileName);

            let docValue: unknown;
            try {
                docValue = JSON.parse(fs.readFileSync(docPath, 'utf8'));
            } catch (error) {
                console.warn(`忽略无法加载的 Efun 文档文件: ${docPath}`, error);
                continue;
            }

            const normalized = normalizeStructuredDoc(docKey, docValue);
            if (!normalized) {
                continue;
            }

            structuredDocs.set(docKey, cloneStructuredDoc(normalized));
        }

        this.structuredDocs = structuredDocs;
        this.categories = this.loadCategories(rawCategories, structuredDocs);
    }

    private loadLegacyBundledDocs(bundledDocsPath: string): void {

        if (!fs.existsSync(bundledDocsPath)) {
            console.error(`未找到内置 Efun 文档文件: ${bundledDocsPath}`);
            this.structuredDocs = new Map();
            this.categories = new Map();
            return;
        }

        let parsedBundle: unknown;
        try {
            parsedBundle = JSON.parse(fs.readFileSync(bundledDocsPath, 'utf8'));
        } catch (error) {
            console.error('加载内置 Efun 文档失败: JSON 解析错误', error);
            this.structuredDocs = new Map();
            this.categories = new Map();
            return;
        }

        if (!isRecord(parsedBundle) || !isRecord(parsedBundle.docs)) {
            console.error('加载内置 Efun 文档失败: 缺少合法的 docs 对象');
            this.structuredDocs = new Map();
            this.categories = new Map();
            return;
        }

        const bundle = parsedBundle as StructuredEfunDocBundle;
        const structuredDocs = new Map<string, StructuredEfunDoc>();

        for (const [docKey, docValue] of Object.entries(bundle.docs)) {
            const normalized = normalizeStructuredDoc(docKey, docValue);
            if (!normalized) {
                continue;
            }

            structuredDocs.set(docKey, cloneStructuredDoc(normalized));
        }

        this.structuredDocs = structuredDocs;
        this.categories = this.loadCategories(bundle.categories, structuredDocs);
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

    private getLegacyBundledDocsPath(context: vscode.ExtensionContext): string {
        if (context?.extensionPath) {
            return path.join(context.extensionPath, 'config', LEGACY_BUNDLED_DOCS_FILE);
        }

        return path.join(path.resolve(__dirname, '..', '..'), 'config', LEGACY_BUNDLED_DOCS_FILE);
    }
}

function normalizeStructuredDoc(docKey: string, value: unknown): StructuredEfunDoc | undefined {
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

    if (typeof value.category !== 'string' || !value.category.trim()) {
        console.warn(`忽略缺少 category 的 Efun 文档条目: ${docKey}`);
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
        summary: normalizeOptionalText(value.summary),
        details: normalizeOptionalText(value.details),
        note: normalizeOptionalText(value.note),
        reference: Array.isArray(value.reference)
            ? value.reference
                .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
                .map((item) => item.trim())
            : undefined,
        category: value.category.trim() || DEFAULT_EFUN_CATEGORY,
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
