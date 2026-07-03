import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { ASTManager } from '../ast/astManager';
import { EfunDocsManager as FacadeEfunDocsManager } from '../efun/EfunDocsManager';
import { FunctionDocLookupBuilder } from '../efun/FunctionDocLookupBuilder';
import { SimulatedEfunScanner } from '../efun/SimulatedEfunScanner';
import { EfunDocsManager } from '../efunDocs';
import { createDefaultQueryBackedLanguageCompletionService } from '../language/services/completion/LanguageCompletionService';
import { createDefaultScopedMethodCompletionSupport } from '../language/services/completion/ScopedMethodCompletionSupport';
import { CallableDocRenderer } from '../language/documentation/CallableDocRenderer';
import {
    FunctionDocumentationService,
    createDefaultFunctionDocumentationService
} from '../language/documentation/FunctionDocumentationService';
import { createDefaultScopedMethodDiscoveryService } from '../objectInference/ScopedMethodDiscoveryService';
import { CompletionInstrumentation } from '../completion/completionInstrumentation';
import { CompletionContextAnalyzer } from '../completion/completionContextAnalyzer';
import { InheritanceResolver } from '../completion/inheritanceResolver';
import { ProjectSymbolIndex } from '../completion/projectSymbolIndex';
import {
    WorkspaceDocumentPathSupport,
    createVsCodeTextDocumentHost
} from '../language/shared/WorkspaceDocumentPathSupport';
import { DocumentSemanticSnapshotService } from '../semantic/documentSemanticSnapshotService';
import {
    configureAstManagerSingletonForTests,
    getAstManagerForTests,
    resetAstManagerSingletonForTests
} from './testAstManagerSingleton';
import { TestHelper } from './utils/TestHelper';

function createSimulatedScanner(projectConfigService?: any): SimulatedEfunScanner {
    return new SimulatedEfunScanner(
        projectConfigService,
        DocumentSemanticSnapshotService.getInstance(),
        createDefaultFunctionDocumentationService()
    );
}

function normalizeTestPath(filePath: string): string {
    return path.normalize(filePath)
        .replace(/\\/g, '/')
        .replace(/^\/+([A-Za-z]:\/)/, '$1')
        .toLowerCase();
}

function createLookupBuilder(
    documentationService: FunctionDocumentationService,
    pathSupport: WorkspaceDocumentPathSupport
): FunctionDocLookupBuilder {
    return new FunctionDocLookupBuilder({
        documentationService,
        analysisService: DocumentSemanticSnapshotService.getInstance(),
        pathSupport
    });
}

describe('EfunDocsManager', () => {
    let errorSpy: jest.SpyInstance;
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
        configureAstManagerSingletonForTests();
        jest.clearAllMocks();
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: jest.fn((_: string, defaultValue?: unknown) => defaultValue),
            update: jest.fn().mockResolvedValue(undefined)
        });
        (vscode.workspace.workspaceFolders as unknown[]) = [];
        (vscode.window.activeTextEditor as unknown) = undefined;
        errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        resetAstManagerSingletonForTests();
        errorSpy.mockRestore();
        warnSpy.mockRestore();
    });

    function createContext(extensionPath: string): vscode.ExtensionContext {
        return {
            subscriptions: [],
            extensionPath
        } as unknown as vscode.ExtensionContext;
    }

    async function createManager(extensionPath: string): Promise<EfunDocsManager> {
        const documentationService = createDefaultFunctionDocumentationService();
        const pathSupport = new WorkspaceDocumentPathSupport({
            host: createVsCodeTextDocumentHost()
        });
        const manager = new EfunDocsManager(
            createContext(extensionPath),
            undefined,
            DocumentSemanticSnapshotService.getInstance(),
            documentationService,
            pathSupport,
            createLookupBuilder(documentationService, pathSupport)
        );
        await manager.bundledDocsReady;
        return manager;
    }

    function writeBundleFile(extensionPath: string, value: unknown | string): void {
        const configDir = path.join(extensionPath, 'config');
        fs.mkdirSync(configDir, { recursive: true });
        const serialized = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
        fs.writeFileSync(path.join(configDir, 'efun-docs.json'), serialized, 'utf8');
    }

    function writeSplitBundle(extensionPath: string, bundle: Record<string, unknown>): void {
        const splitDocsDir = path.join(extensionPath, 'config', 'efun-docs', 'docs');
        fs.mkdirSync(splitDocsDir, { recursive: true });

        fs.writeFileSync(
            path.join(extensionPath, 'config', 'efun-docs', 'categories.json'),
            JSON.stringify(bundle.categories ?? {}, null, 2),
            'utf8'
        );

        const docs = bundle.docs as Record<string, unknown> | undefined;
        for (const [name, doc] of Object.entries(docs ?? {})) {
            fs.writeFileSync(path.join(splitDocsDir, `${name}.json`), JSON.stringify(doc, null, 2), 'utf8');
        }
    }

    function createStructuredBundle(overrides?: {
        docs?: Record<string, unknown>;
        categories?: Record<string, string[]>;
    }): Record<string, unknown> {
        return {
            generatedAt: '2026-04-14T00:00:00.000Z',
            categories: overrides?.categories ?? {
                '调用相关函数（Calls）': ['call_out', 'call_other'],
                '数组相关函数（Arrays）': ['allocate', 'minimal_doc']
            },
            docs: overrides?.docs ?? {
                allocate: {
                    name: 'allocate',
                    summary: '分配一个指定大小的数组。',
                    details: '第二个签名允许用固定值或函数初始化元素。',
                    note: '数组大小必须在驱动限制范围内。',
                    reference: ['sizeof', 'allocate_mapping'],
                    category: '数组相关函数（Arrays）',
                    signatures: [
                        {
                            label: 'mixed *allocate(int size)',
                            returnType: 'mixed *',
                            isVariadic: false,
                            parameters: [
                                {
                                    name: 'size',
                                    type: 'int',
                                    description: '数组长度'
                                }
                            ]
                        },
                        {
                            label: 'mixed *allocate(int size, mixed value)',
                            returnType: 'mixed *',
                            isVariadic: false,
                            parameters: [
                                {
                                    name: 'size',
                                    type: 'int',
                                    description: '数组长度'
                                },
                                {
                                    name: 'value',
                                    type: 'mixed',
                                    description: '初始值'
                                }
                            ]
                        }
                    ]
                },
                call_other: {
                    name: 'call_other',
                    summary: '调用另一个对象上的函数。',
                    category: '调用相关函数（Calls）',
                    signatures: [
                        {
                            label: 'mixed call_other(object ob, string func, mixed arg)',
                            returnType: 'mixed',
                            isVariadic: false,
                            parameters: [
                                { name: 'ob', type: 'object', description: '目标对象' },
                                { name: 'func', type: 'string', description: '函数名' },
                                { name: 'arg', type: 'mixed', description: '单个参数' }
                            ]
                        },
                        {
                            label: 'mixed call_other(object ob, string func, mixed ...args)',
                            returnType: 'mixed',
                            isVariadic: true,
                            parameters: [
                                { name: 'ob', type: 'object', description: '目标对象' },
                                { name: 'func', type: 'string', description: '函数名' },
                                { name: 'args', type: 'mixed', description: '附加参数', variadic: true }
                            ]
                        }
                    ]
                },
                call_out: {
                    name: 'call_out',
                    summary: '设置延迟调用。',
                    details: 'delay 支持 int 或 float。',
                    note: '返回的句柄可用于 remove_call_out。',
                    reference: ['remove_call_out', 'find_call_out'],
                    category: '调用相关函数（Calls）',
                    signatures: [
                        {
                            label: 'int call_out(string | function fun, int | float delay, mixed ...args)',
                            returnType: 'int',
                            isVariadic: true,
                            parameters: [
                                { name: 'fun', type: 'string | function', description: '要调用的函数或函数指针' },
                                { name: 'delay', type: 'int | float', description: '延迟秒数' },
                                { name: 'args', type: 'mixed', description: '传递给 fun 的附加参数', variadic: true }
                            ]
                        }
                    ]
                },
                minimal_doc: {
                    name: 'minimal_doc',
                    category: '数组相关函数（Arrays）',
                    signatures: [
                        {
                            label: 'void minimal_doc()',
                            returnType: 'void',
                            isVariadic: false,
                            parameters: []
                        }
                    ]
                },
                orphan_doc: {
                    name: 'orphan_doc',
                    summary: '即使没有分类引用也应该加载。',
                    category: '未引用分类',
                    signatures: [
                        {
                            label: 'int orphan_doc()',
                            returnType: 'int',
                            isVariadic: false,
                            parameters: []
                        }
                    ]
                }
            }
        };
    }

    test('loads structured local efun docs with simple, overloaded, variadic, and minimal entries', async () => {
        const extensionPath = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-efun-structured-'));
        writeBundleFile(extensionPath, createStructuredBundle());

        const manager = await createManager(extensionPath);
        const allocateDoc = manager.getStandardCallableDoc('allocate');
        const callOtherDoc = manager.getStandardCallableDoc('call_other');
        const callOutDoc = manager.getStandardCallableDoc('call_out');
        const minimalDoc = manager.getStandardCallableDoc('minimal_doc');

        expect(manager.getAllFunctions()).toEqual(expect.arrayContaining([
            'allocate',
            'call_other',
            'call_out',
            'minimal_doc',
            'orphan_doc'
        ]));
        expect(manager.getCategories().get('数组相关函数（Arrays）')).toEqual(['allocate', 'minimal_doc']);
        expect(allocateDoc).toMatchObject({
            name: 'allocate',
            sourceKind: 'efun'
        });
        expect(allocateDoc?.signatures.map(signature => signature.label)).toEqual([
            'mixed *allocate(int size)',
            'mixed *allocate(int size, mixed value)'
        ]);
        expect(allocateDoc?.signatures[0].returnType).toBe('mixed *');
        expect(callOtherDoc?.signatures.map(signature => signature.label)).toEqual([
            'mixed call_other(object ob, string func, mixed arg)',
            'mixed call_other(object ob, string func, mixed ...args)'
        ]);
        expect(callOutDoc?.signatures[0].label).toBe('int call_out(string | function fun, int | float delay, mixed ...args)');
        expect(callOutDoc?.summary).toContain('设置延迟调用。');
        expect(callOutDoc?.details).toContain('delay 支持 int 或 float。');
        expect(callOutDoc?.note).toContain('remove_call_out');
        expect(minimalDoc).toMatchObject({
            name: 'minimal_doc',
            signatures: [
                expect.objectContaining({
                    label: 'void minimal_doc()',
                    returnType: 'void'
                })
            ],
            sourceKind: 'efun'
        });
        expect(minimalDoc?.summary).toBeUndefined();
        expect(errorSpy).not.toHaveBeenCalled();
    });

    test('prefers split bundled efun docs over the legacy single bundle', async () => {
        const extensionPath = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-efun-split-'));
        writeBundleFile(extensionPath, createStructuredBundle({
            docs: {
                allocate: {
                    name: 'allocate',
                    summary: 'legacy bundle doc',
                    category: '数组相关函数（Arrays）',
                    signatures: [{
                        label: 'mixed *allocate(int size)',
                        returnType: 'mixed *',
                        isVariadic: false,
                        parameters: [{ name: 'size', type: 'int' }]
                    }]
                }
            }
        }));
        writeSplitBundle(extensionPath, createStructuredBundle({
            docs: {
                allocate: {
                    name: 'allocate',
                    summary: 'split bundle doc',
                    category: '数组相关函数（Arrays）',
                    signatures: [{
                        label: 'mixed *allocate(int size, mixed value)',
                        returnType: 'mixed *',
                        isVariadic: false,
                        arity: {
                            min: 1,
                            max: 2
                        },
                        parameters: [
                            { name: 'size', type: 'int' },
                            { name: 'value', type: 'mixed' }
                        ]
                    }]
                }
            },
            categories: {
                '数组相关函数（Arrays）': ['allocate']
            }
        }));

        const manager = await createManager(extensionPath);
        const allocateDoc = manager.getStandardCallableDoc('allocate');

        expect(allocateDoc?.summary).toBe('split bundle doc');
        expect(allocateDoc?.signatures.map(signature => signature.label)).toEqual([
            'mixed *allocate(int size, mixed value)'
        ]);
        expect(allocateDoc?.signatures[0].arity).toEqual({
            min: 1,
            max: 2
        });
        expect(manager.getCategories().get('数组相关函数（Arrays）')).toEqual(['allocate']);
    });

    test('bundled split efun docs declare explicit arity for every signature', async () => {
        const docsDir = path.join(process.cwd(), 'config', 'efun-docs', 'docs');
        const missingArity: string[] = [];

        for (const fileName of fs.readdirSync(docsDir).filter(name => name.endsWith('.json'))) {
            const doc = JSON.parse(fs.readFileSync(path.join(docsDir, fileName), 'utf8')) as {
                signatures?: Array<{ arity?: { min?: unknown; max?: unknown } }>;
            };
            doc.signatures?.forEach((signature, index) => {
                const arity = signature.arity;
                const hasValidMin = Number.isInteger(arity?.min) && Number(arity?.min) >= 0;
                const hasValidMax = arity?.max === null
                    || arity?.max === undefined
                    || (Number.isInteger(arity.max) && Number(arity.max) >= Number(arity.min));
                if (!arity || !hasValidMin || !hasValidMax) {
                    missingArity.push(`${fileName}#${index}`);
                }
            });
        }

        expect(missingArity).toEqual([]);

        const getDirDoc = JSON.parse(fs.readFileSync(path.join(docsDir, 'get_dir.json'), 'utf8'));
        const jsonDecodeDoc = JSON.parse(fs.readFileSync(path.join(docsDir, 'json_decode.json'), 'utf8'));
        const filterArrayDoc = JSON.parse(fs.readFileSync(path.join(docsDir, 'filter_array.json'), 'utf8'));
        const mapArrayDoc = JSON.parse(fs.readFileSync(path.join(docsDir, 'map_array.json'), 'utf8'));
        const memberArrayDoc = JSON.parse(fs.readFileSync(path.join(docsDir, 'member_array.json'), 'utf8'));
        const newDoc = JSON.parse(fs.readFileSync(path.join(docsDir, 'new.json'), 'utf8'));
        const parseCommandDoc = JSON.parse(fs.readFileSync(path.join(docsDir, 'parse_command.json'), 'utf8'));
        const sscanfDoc = JSON.parse(fs.readFileSync(path.join(docsDir, 'sscanf.json'), 'utf8'));
        const thisPlayerDoc = JSON.parse(fs.readFileSync(path.join(docsDir, 'this_player.json'), 'utf8'));
        const thisUserDoc = JSON.parse(fs.readFileSync(path.join(docsDir, 'this_user.json'), 'utf8'));
        const tellRoomDoc = JSON.parse(fs.readFileSync(path.join(docsDir, 'tell_room.json'), 'utf8'));
        expect(getDirDoc.signatures.map((signature: any) => signature.arity)).toEqual([
            { min: 1, max: 2 }
        ]);
        expect(jsonDecodeDoc.signatures.map((signature: any) => signature.arity)).toEqual([
            { min: 1, max: 1 }
        ]);
        expect(filterArrayDoc.signatures.map((signature: any) => signature.arity)).toEqual([
            { min: 2, max: null },
            { min: 2, max: null }
        ]);
        expect(mapArrayDoc.signatures.map((signature: any) => signature.arity)).toEqual([
            { min: 2, max: null },
            { min: 2, max: null }
        ]);
        expect(memberArrayDoc.signatures.map((signature: any) => signature.arity)).toEqual([
            { min: 2, max: 4 }
        ]);
        expect(newDoc.signatures.map((signature: any) => signature.arity)).toEqual([
            { min: 1, max: null },
            { min: 1, max: null }
        ]);
        expect(parseCommandDoc.signatures.map((signature: any) => signature.arity)).toEqual([
            { min: 3, max: null }
        ]);
        expect(sscanfDoc.signatures.map((signature: any) => signature.arity)).toEqual([
            { min: 2, max: null }
        ]);
        expect(thisPlayerDoc.signatures.map((signature: any) => signature.arity)).toEqual([
            { min: 0, max: 1 },
            { min: 0, max: 1 }
        ]);
        expect(thisUserDoc.signatures.map((signature: any) => signature.arity)).toEqual([
            { min: 0, max: 1 },
            { min: 0, max: 1 }
        ]);
        expect(tellRoomDoc.signatures.map((signature: any) => signature.arity)).toEqual([
            { min: 2, max: 3 }
        ]);
    });

    test('bundled efun docs match FluffOS arity declarations when checkout is available', async () => {
        const fluffosRoot = process.env.FLUFFOS_ROOT ?? 'D:/code/fluffos';
        if (!fs.existsSync(path.join(fluffosRoot, 'src', 'packages'))) {
            return;
        }

        const output = execFileSync(
            process.execPath,
            [
                path.join(process.cwd(), 'scripts', 'audit-efun-arity.mjs'),
                '--fluffos-root',
                fluffosRoot,
                '--json'
            ],
            {
                cwd: process.cwd(),
                encoding: 'utf8'
            }
        );
        const result = JSON.parse(output) as {
            docCount: number;
            specCount: number;
            entries: Array<{
                name: string;
                sources: unknown[];
            }>;
            tooNarrow: unknown[];
            tooBroad: unknown[];
            missingSpec: unknown[];
            missingDoc: unknown[];
        };

        expect(result.docCount).toBe(405);
        expect(result.specCount).toBe(405);
        expect(result.entries).toHaveLength(405);
        expect(result.entries.filter(entry => entry.sources.length === 0)).toEqual([]);
        expect(result.tooNarrow).toEqual([]);
        expect(result.tooBroad).toEqual([]);
        expect(result.missingSpec).toEqual([]);
        expect(result.missingDoc).toEqual([]);
    });

    test('keeps legacy arity on standard callable doc signatures', async () => {
        const extensionPath = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-efun-legacy-arity-'));
        writeBundleFile(extensionPath, createStructuredBundle({
            docs: {
                legacy_arity: {
                    name: 'legacy_arity',
                    category: '调用相关函数（Calls）',
                    signatures: [{
                        label: 'mixed legacy_arity(int size)',
                        returnType: 'mixed',
                        isVariadic: false,
                        arity: {
                            min: 1,
                            max: null
                        },
                        parameters: [{ name: 'size', type: 'int' }]
                    }]
                }
            },
            categories: {
                '调用相关函数（Calls）': ['legacy_arity']
            }
        }));

        const manager = await createManager(extensionPath);

        const legacyDoc = manager.getStandardCallableDoc('legacy_arity');

        expect(legacyDoc?.signatures[0]).toMatchObject({
            label: 'mixed legacy_arity(int size)',
            arity: {
                min: 1,
                max: null
            }
        });
    });

    test('re-export shim exposes the facade manager class', async () => {
        expect(EfunDocsManager).toBe(FacadeEfunDocsManager);
    });

    test('should build bundled efun completion documentation through the shared completion service', async () => {
        const extensionPath = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-efun-completion-'));
        writeBundleFile(extensionPath, createStructuredBundle());
        const manager = await createManager(extensionPath);
        const documentHost = createVsCodeTextDocumentHost();
        const documentationService = createDefaultFunctionDocumentationService();
        const objectInferenceService = { inferObjectAccess: jest.fn() } as any;
        const service = createDefaultQueryBackedLanguageCompletionService({
            efunDocsManager: manager,
            analysisService: DocumentSemanticSnapshotService.getInstance(),
            documentationService,
            objectInferenceService,
            instrumentation: new CompletionInstrumentation(),
            inheritanceReporter: {
                clear: jest.fn(),
                show: jest.fn(),
                appendLine: jest.fn()
            } as any,
            projectSymbolIndex: new ProjectSymbolIndex(new InheritanceResolver()),
            contextAnalyzer: new CompletionContextAnalyzer(),
            scopedMethodDiscoveryService: createDefaultScopedMethodDiscoveryService({
                analysisService: DocumentSemanticSnapshotService.getInstance(),
                host: documentHost
            }),
            scopedCompletionSupport: createDefaultScopedMethodCompletionSupport({
                documentationService,
                documentHost,
                renderer: new CallableDocRenderer()
            })
        });
        const document = TestHelper.createMockDocument('allo');
        const completion = await service.provideCompletion({
            context: {
                document,
                workspace: {
                    workspaceRoot: process.cwd()
                },
                mode: 'lsp',
                cancellation: {
                    isCancellationRequested: false
                }
            },
            position: {
                line: 0,
                character: 4
            },
            triggerKind: vscode.CompletionTriggerKind.Invoke
        });
        const allocateItem = completion.items.find(item => item.label === 'allocate');

        expect(allocateItem).toBeDefined();

        const resolved = await service.resolveCompletionItem?.({
            context: {
                document,
                workspace: {
                    workspaceRoot: process.cwd()
                },
                mode: 'lsp',
                cancellation: {
                    isCancellationRequested: false
                }
            },
            item: allocateItem!
        });

        expect(resolved?.documentation?.value).toContain('mixed *allocate(int size)');
        expect(resolved?.documentation?.value).toContain('mixed *allocate(int size, mixed value)');
        expect(resolved?.documentation?.value).toContain('**Return Type:** `mixed *`');
        expect(resolved?.documentation?.value).toContain('分配一个指定大小的数组。');
    });

    test('returns empty docs and categories when the configured structured bundle is malformed JSON', async () => {
        const extensionPath = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-efun-malformed-'));
        writeBundleFile(extensionPath, '{ invalid json');

        const manager = await createManager(extensionPath);

        expect(manager.getAllFunctions()).toEqual([]);
        expect(manager.getCategories().size).toBe(0);
        expect(manager.getStandardCallableDoc('allocate')).toBeUndefined();
        expect(errorSpy).toHaveBeenCalled();
    });

    test('returns empty docs and categories when docs is missing', async () => {
        const extensionPath = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-efun-missing-docs-'));
        writeBundleFile(extensionPath, {
            generatedAt: '2026-04-14T00:00:00.000Z',
            categories: {
                '调用相关函数（Calls）': ['call_out']
            }
        });

        const manager = await createManager(extensionPath);

        expect(manager.getAllFunctions()).toEqual([]);
        expect(manager.getCategories().size).toBe(0);
        expect(errorSpy).toHaveBeenCalled();
    });

    test('loads docs but returns empty categories when categories is missing', async () => {
        const extensionPath = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-efun-missing-categories-'));
        writeBundleFile(extensionPath, {
            generatedAt: '2026-04-14T00:00:00.000Z',
            docs: {
                call_out: {
                    name: 'call_out',
                    summary: '设置延迟调用。',
                    category: '调用相关函数（Calls）',
                    signatures: [
                        {
                            label: 'int call_out(string fun, int delay, mixed ...args)',
                            returnType: 'int',
                            isVariadic: true,
                            parameters: [
                                { name: 'fun', type: 'string' },
                                { name: 'delay', type: 'int' },
                                { name: 'args', type: 'mixed', variadic: true }
                            ]
                        }
                    ]
                }
            }
        });

        const manager = await createManager(extensionPath);

        expect(manager.getAllFunctions()).toEqual(['call_out']);
        expect(manager.getStandardCallableDoc('call_out')).toMatchObject({
            name: 'call_out',
            signatures: [
                expect.objectContaining({
                    returnType: 'int'
                })
            ]
        });
        expect(manager.getCategories().size).toBe(0);
        expect(errorSpy).toHaveBeenCalled();
    });

    test('ignores missing category references and keeps unreferenced docs loadable', async () => {
        const extensionPath = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-efun-missing-category-ref-'));
        writeBundleFile(extensionPath, createStructuredBundle({
            categories: {
                '调用相关函数（Calls）': ['call_out', 'missing_doc']
            }
        }));

        const manager = await createManager(extensionPath);

        expect(manager.getCategories().get('调用相关函数（Calls）')).toEqual(['call_out']);
        expect(manager.getAllFunctions()).toEqual(expect.arrayContaining(['call_out', 'allocate', 'orphan_doc']));
        expect(manager.getStandardCallableDoc('missing_doc')).toBeUndefined();
        expect(warnSpy).toHaveBeenCalled();
    });

    test('rejects docs whose key does not match the declared name', async () => {
        const extensionPath = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-efun-key-name-mismatch-'));
        writeBundleFile(extensionPath, createStructuredBundle({
            docs: {
                wrong_key: {
                    name: 'actual_name',
                    summary: '名字不一致的条目不应被加载。',
                    category: '调用相关函数（Calls）',
                    signatures: [
                        {
                            label: 'void actual_name()',
                            returnType: 'void',
                            isVariadic: false,
                            parameters: []
                        }
                    ]
                }
            },
            categories: {
                '调用相关函数（Calls）': ['wrong_key']
            }
        }));

        const manager = await createManager(extensionPath);

        expect(manager.getAllFunctions()).toEqual([]);
        expect(manager.getStandardCallableDoc('wrong_key')).toBeUndefined();
        expect(manager.getCategories().get('调用相关函数（Calls）')).toEqual([]);
        expect(warnSpy).toHaveBeenCalled();
    });

    test('structured signatures preserve overloaded return types without a legacy flattened returnType', async () => {
        const extensionPath = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-efun-return-type-structured-'));
        writeBundleFile(extensionPath, createStructuredBundle({
            docs: {
                mixed_returns: {
                    name: 'mixed_returns',
                    summary: '重载返回类型不一致时保留在各自签名上。',
                    category: '调用相关函数（Calls）',
                    signatures: [
                        {
                            label: 'int mixed_returns(int arg)',
                            returnType: 'int',
                            isVariadic: false,
                            parameters: [{ name: 'arg', type: 'int' }]
                        },
                        {
                            label: 'string mixed_returns(string arg)',
                            returnType: 'string',
                            isVariadic: false,
                            parameters: [{ name: 'arg', type: 'string' }]
                        }
                    ]
                },
                late_only_return_type: {
                    name: 'late_only_return_type',
                    summary: '只有后续重载声明返回类型时也不应猜测。',
                    category: '调用相关函数（Calls）',
                    signatures: [
                        {
                            label: 'late_only_return_type()',
                            isVariadic: false,
                            parameters: []
                        },
                        {
                            label: 'int late_only_return_type(int arg)',
                            returnType: 'int',
                            isVariadic: false,
                            parameters: [{ name: 'arg', type: 'int' }]
                        }
                    ]
                }
            },
            categories: {
                '调用相关函数（Calls）': ['mixed_returns', 'late_only_return_type']
            }
        }));

        const manager = await createManager(extensionPath);
        const mixedReturnsDoc = manager.getStandardCallableDoc('mixed_returns');
        const lateOnlyDoc = manager.getStandardCallableDoc('late_only_return_type');

        expect((mixedReturnsDoc as any)?.returnType).toBeUndefined();
        expect((lateOnlyDoc as any)?.returnType).toBeUndefined();
        expect(mixedReturnsDoc?.signatures.map(signature => signature.label)).toEqual([
            'int mixed_returns(int arg)',
            'string mixed_returns(string arg)'
        ]);
        expect(lateOnlyDoc?.signatures.map(signature => signature.returnType)).toEqual([
            undefined,
            'int'
        ]);
    });

    test('drops invalid docs when a signature is missing label', async () => {
        const extensionPath = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-efun-invalid-signature-'));
        writeBundleFile(extensionPath, createStructuredBundle({
            docs: {
                bad_signature: {
                    name: 'bad_signature',
                    category: '调用相关函数（Calls）',
                    signatures: [
                        {
                            returnType: 'void',
                            isVariadic: false,
                            parameters: []
                        }
                    ]
                }
            },
            categories: {
                '调用相关函数（Calls）': ['bad_signature']
            }
        }));

        const manager = await createManager(extensionPath);

        expect(manager.getAllFunctions()).toEqual([]);
        expect(manager.getCategories().get('调用相关函数（Calls）')).toEqual([]);
    });

    test('rejects invalid signature arity and warns', async () => {
        const extensionPath = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-efun-invalid-arity-'));
        writeBundleFile(extensionPath, createStructuredBundle({
            docs: {
                invalid_arity: {
                    name: 'invalid_arity',
                    category: '调用相关函数（Calls）',
                    signatures: [{
                        label: 'void invalid_arity(int size)',
                        returnType: 'void',
                        isVariadic: false,
                        arity: {
                            min: 2,
                            max: 1
                        },
                        parameters: [{ name: 'size', type: 'int' }]
                    }]
                }
            },
            categories: {
                '调用相关函数（Calls）': ['invalid_arity']
            }
        }));

        const manager = await createManager(extensionPath);

        expect(manager.getStandardCallableDoc('invalid_arity')).toBeUndefined();
        expect(manager.getAllFunctions()).toEqual([]);
        expect(warnSpy).toHaveBeenCalled();
    });

    test('drops invalid docs when a parameter is missing name', async () => {
        const extensionPath = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-efun-invalid-param-'));
        writeBundleFile(extensionPath, createStructuredBundle({
            docs: {
                bad_param: {
                    name: 'bad_param',
                    category: '调用相关函数（Calls）',
                    signatures: [
                        {
                            label: 'void bad_param(string value)',
                            returnType: 'void',
                            isVariadic: false,
                            parameters: [
                                {
                                    type: 'string',
                                    description: '缺少参数名'
                                }
                            ]
                        }
                    ]
                }
            },
            categories: {
                '调用相关函数（Calls）': ['bad_param']
            }
        }));

        const manager = await createManager(extensionPath);

        expect(manager.getAllFunctions()).toEqual([]);
        expect(manager.getCategories().get('调用相关函数（Calls）')).toEqual([]);
    });

    test('callable renderer preserves pointer-like parameter types in the table', async () => {
        const markdown = new CallableDocRenderer().renderHover({
            name: 'demo',
            declarationKey: 'test:demo',
            sourceKind: 'efun',
            summary: 'demo description',
            signatures: [{
                label: 'mixed demo(mixed * items, string* label)',
                isVariadic: false,
                parameters: [
                    { name: 'items', type: 'mixed *', description: 'item list' },
                    { name: 'label', type: 'string*', description: 'label text' }
                ]
            }]
        });

        expect(markdown).toContain('| `items` | `mixed *` | item list |');
        expect(markdown).toContain('| `label` | `string*` | label text |');
    });

    test('callable renderer escapes markdown-breaking pipe characters', async () => {
        const markdown = new CallableDocRenderer().renderHover({
            name: 'demo',
            declarationKey: 'test:demo',
            sourceKind: 'efun',
            summary: 'demo description',
            signatures: [{
                label: 'void demo(string value)',
                isVariadic: false,
                parameters: [
                    { name: 'value', type: 'string', description: 'foo | bar' }
                ]
            }]
        });

        expect(markdown).toContain('| `value` | `string` | foo \\| bar |');
    });
});

describe('SimulatedEfunScanner', () => {
    beforeEach(() => {
        configureAstManagerSingletonForTests();
        jest.clearAllMocks();
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: jest.fn((_: string, defaultValue?: unknown) => defaultValue),
            update: jest.fn().mockResolvedValue(undefined)
        });
        (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([]);
        (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from(''));
        (vscode.workspace.workspaceFolders as unknown) = [];
    });

    afterEach(() => {
        resetAstManagerSingletonForTests();
    });

    test('reports workspace state as not ready when config.hell is configured but unresolved', async () => {
        const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-simul-unresolved-'));
        const sourceDocument = TestHelper.createMockDocument(
            'void demo() { same_week(); }',
            'lpc',
            path.join(workspaceRoot, 'adm', 'daemons', 'topd.c')
        );
        (sourceDocument as any).uri = vscode.Uri.file(sourceDocument.fileName);
        const scanner = createSimulatedScanner();

        const unresolvedProjectConfig = {
            projectConfigPath: path.join(workspaceRoot, 'lpc-support.json'),
            configHellPath: 'config/config.dev'
        };

        await scanner.ensureWorkspaceStateCurrent(sourceDocument, unresolvedProjectConfig as any);

        expect(scanner.isWorkspaceStateReady(sourceDocument, unresolvedProjectConfig as any)).toBe(false);
        expect(scanner.getAllNames(sourceDocument, unresolvedProjectConfig as any)).toEqual([]);
    });

    test('reports workspace state as ready when no config.hell is configured', async () => {
        const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-simul-no-config-hell-'));
        const sourceDocument = TestHelper.createMockDocument(
            'void demo() {}',
            'lpc',
            path.join(workspaceRoot, 'room.c')
        );
        (sourceDocument as any).uri = vscode.Uri.file(sourceDocument.fileName);
        const scanner = createSimulatedScanner();

        const configWithoutHell = {
            projectConfigPath: path.join(workspaceRoot, 'lpc-support.json')
        };

        await scanner.ensureWorkspaceStateCurrent(sourceDocument, configWithoutHell as any);

        expect(scanner.isWorkspaceStateReady(sourceDocument, configWithoutHell as any)).toBe(true);
        expect(scanner.getAllNames(sourceDocument, configWithoutHell as any)).toEqual([]);
    });

    test('clears previously loaded docs when a later reload cannot scan', async () => {
        const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-simul-clear-'));
        const scanner = createSimulatedScanner();

        fs.writeFileSync(path.join(workspaceRoot, 'lpc-support.json'), JSON.stringify({
            version: 1,
            configHellPath: 'config.hell'
        }, null, 2));
        (vscode.workspace.workspaceFolders as unknown) = [{ uri: { fsPath: workspaceRoot } }];
        const simulFile = path.join(workspaceRoot, 'adm', 'single', 'simul_efun.c');
        fs.mkdirSync(path.dirname(simulFile), { recursive: true });
        fs.writeFileSync(simulFile, [
            '/**',
            ' * @brief simulated helper',
            ' */',
            'int sim_helper() { return 1; }'
        ].join('\n'));
        const scannerWithProjectConfig = createSimulatedScanner({
            getSimulatedEfunFileForWorkspace: jest.fn().mockResolvedValue(simulFile),
            getResolvedForWorkspace: jest.fn().mockResolvedValue({ mudlibDirectory: './' })
        } as any);

        await scannerWithProjectConfig.loadSimulatedEfuns();
        expect(scannerWithProjectConfig.get('sim_helper')).toBeDefined();

        (vscode.workspace.workspaceFolders as unknown) = [];
        await scannerWithProjectConfig.loadSimulatedEfuns();

        expect(scannerWithProjectConfig.get('sim_helper')).toBeUndefined();
        expect(scannerWithProjectConfig.getAllNames()).toEqual([]);
    });

    test('loads simulated efun docs from project config simulatedEfunFile without consulting legacy settings', async () => {
        const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-simul-direct-'));
        const entryDir = path.join(workspaceRoot, 'adm', 'single');
        const entryFile = path.join(entryDir, 'simul_efun.c');
        const projectConfigService = {
            getSimulatedEfunFileForWorkspace: jest.fn().mockResolvedValue(entryFile),
            getResolvedForWorkspace: jest.fn().mockResolvedValue({ mudlibDirectory: './' })
        };
        const scanner = createSimulatedScanner(projectConfigService as any);

        fs.mkdirSync(entryDir, { recursive: true });
        fs.writeFileSync(entryFile, [
            '/**',
            ' * @brief simulated helper',
            ' */',
            'int sim_helper() { return 1; }'
        ].join('\n'));

        (vscode.workspace.workspaceFolders as unknown) = [{ uri: { fsPath: workspaceRoot } }];
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: jest.fn(() => undefined),
            update: jest.fn().mockResolvedValue(undefined)
        });

        await scanner.loadSimulatedEfuns();

        expect(projectConfigService.getSimulatedEfunFileForWorkspace).toHaveBeenCalledWith(workspaceRoot);
        expect(vscode.workspace.findFiles).not.toHaveBeenCalled();
        expect(scanner.get('sim_helper')).toBeDefined();
    });

    test('does not auto-scan legacy simulated efun path when project config has no simulatedEfunFile', async () => {
        const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-simul-no-configured-file-'));
        const scanner = createSimulatedScanner(new (await import('../projectConfig/LpcProjectConfigService')).LpcProjectConfigService());
        fs.writeFileSync(path.join(workspaceRoot, 'lpc-support.json'), JSON.stringify({
            version: 1,
            configHellPath: 'config.hell'
        }, null, 2));

        (vscode.workspace.workspaceFolders as unknown) = [{ uri: { fsPath: workspaceRoot } }];

        await scanner.loadSimulatedEfuns();

        expect(vscode.workspace.findFiles).not.toHaveBeenCalled();
        expect(scanner.getAllNames()).toEqual([]);
    });

    test('configureSimulatedEfuns points users to config.hell instead of persisting generated project facts', async () => {
        const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-simul-configure-project-config-'));
        const entryDir = path.join(workspaceRoot, 'adm', 'single');
        const entryFile = path.join(entryDir, 'simul_efun.c');
        const { LpcProjectConfigService } = await import('../projectConfig/LpcProjectConfigService');
        const projectConfigService = new LpcProjectConfigService();
        const scanner = createSimulatedScanner(projectConfigService);

        fs.mkdirSync(entryDir, { recursive: true });
        fs.writeFileSync(entryFile, 'int sim_helper() { return 1; }');
        fs.writeFileSync(path.join(workspaceRoot, 'lpc-support.json'), JSON.stringify({
            version: 1,
            configHellPath: 'config.hell'
        }, null, 2));

        (vscode.workspace.workspaceFolders as unknown) = [{ uri: { fsPath: workspaceRoot } }];

        await scanner.configureSimulatedEfuns();

        const written = JSON.parse(fs.readFileSync(path.join(workspaceRoot, 'lpc-support.json'), 'utf8'));
        expect(written.resolved).toBeUndefined();
        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(expect.stringContaining('config.hell'));
        expect(vscode.window.showOpenDialog).not.toHaveBeenCalled();
    });

    test('project config simulated efun path without extension should resolve to the real .c file', async () => {
        const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-simul-config-'));
        const configPath = path.join(workspaceRoot, 'lpc-support.json');
        const hellPath = path.join(workspaceRoot, 'config.hell');
        const simulPath = path.join(workspaceRoot, 'adm', 'single');
        const { LpcProjectConfigService } = await import('../projectConfig/LpcProjectConfigService');
        const service = new LpcProjectConfigService();

        fs.mkdirSync(simulPath, { recursive: true });
        fs.writeFileSync(path.join(simulPath, 'simul_efun.c'), 'int sim_helper() { return 1; }');
        fs.writeFileSync(configPath, JSON.stringify({
            version: 1,
            configHellPath: 'config.hell'
        }, null, 2));
        fs.writeFileSync(hellPath, [
            'mudlib directory : ./',
            'simulated efun file : /adm/single/simul_efun'
        ].join('\n'));

        await expect(service.getSimulatedEfunFileForWorkspace(workspaceRoot))
            .resolves.toBe(path.join(simulPath, 'simul_efun.c'));
    });

    test('entry simul_efun file loads docs from included simul efun sources', async () => {
        const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-simul-entry-'));
        const entryDir = path.join(workspaceRoot, 'adm', 'single');
        const includeDir = path.join(workspaceRoot, 'adm', 'simul_efun');
        const entryFile = path.join(entryDir, 'simul_efun.c');

        fs.mkdirSync(entryDir, { recursive: true });
        fs.mkdirSync(includeDir, { recursive: true });
        fs.writeFileSync(entryFile, '#include "/adm/simul_efun/helper.c"\n');
        fs.writeFileSync(path.join(includeDir, 'helper.c'), [
            '/**',
            ' * @brief helper from include',
            ' */',
            'int sim_helper() { return 1; }'
        ].join('\n'));

        const projectConfigService = {
            getSimulatedEfunFileForWorkspace: jest.fn().mockResolvedValue(entryFile),
            getResolvedForWorkspace: jest.fn().mockResolvedValue({ mudlibDirectory: './' })
        };
        const scanner = createSimulatedScanner(projectConfigService as any);

        (vscode.workspace.workspaceFolders as unknown) = [{ uri: { fsPath: workspaceRoot } }];
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: jest.fn(() => undefined),
            update: jest.fn().mockResolvedValue(undefined)
        });

        await scanner.loadSimulatedEfuns();

        expect(scanner.get('sim_helper')).toMatchObject({
            name: 'sim_helper',
            summary: 'helper from include'
        });
    });

    test('realistic simul_efun entry with pragma and multiple includes loads message_vision from message.c', async () => {
        const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-simul-realistic-entry-'));
        const entryDir = path.join(workspaceRoot, 'adm', 'single');
        const includeDir = path.join(workspaceRoot, 'adm', 'simul_efun');
        const entryFile = path.join(entryDir, 'simul_efun.c');

        fs.mkdirSync(entryDir, { recursive: true });
        fs.mkdirSync(includeDir, { recursive: true });
        fs.writeFileSync(entryFile, [
            '#pragma optimize',
            '',
            '',
            '#include "/adm/simul_efun/atoi.c"',
            '#include "/adm/simul_efun/message.c"',
            '',
            'void create()',
            '{',
            '}'
        ].join('\n'));
        fs.writeFileSync(path.join(includeDir, 'atoi.c'), 'int atoi(string value) { return 0; }\n');
        fs.writeFileSync(path.join(includeDir, 'message.c'), [
            '/**',
            ' * @brief 发送动作消息',
            ' * @param string msg 消息模板',
            ' * @param object me 动作发起者',
            ' * @param object you 动作接收者',
            ' */',
            'varargs void message_vision(string msg, object me, object you)',
            '{',
            '}'
        ].join('\n'));

        const projectConfigService = {
            getSimulatedEfunFileForWorkspace: jest.fn().mockResolvedValue(entryFile),
            getResolvedForWorkspace: jest.fn().mockResolvedValue({ mudlibDirectory: './' }),
            getMudlibRootForWorkspace: jest.fn().mockResolvedValue(workspaceRoot)
        };
        const scanner = createSimulatedScanner(projectConfigService as any);

        (vscode.workspace.workspaceFolders as unknown) = [{ uri: { fsPath: workspaceRoot } }];
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: jest.fn(() => undefined),
            update: jest.fn().mockResolvedValue(undefined)
        });

        await scanner.loadSimulatedEfuns();

        expect(scanner.get('message_vision')).toMatchObject({
            name: 'message_vision',
            summary: '发送动作消息'
        });
    });

    test('scans function-level varargs simulated efuns with optional arity', async () => {
        const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-simul-varargs-'));
        const entryDir = path.join(workspaceRoot, 'adm', 'single');
        const includeDir = path.join(workspaceRoot, 'adm', 'simul_efun');
        const entryFile = path.join(entryDir, 'simul_efun.c');

        fs.mkdirSync(entryDir, { recursive: true });
        fs.mkdirSync(includeDir, { recursive: true });
        fs.writeFileSync(entryFile, '#include "/adm/simul_efun/message.c"\n');
        fs.writeFileSync(path.join(includeDir, 'message.c'), [
            '/**',
            ' * @brief send message to room',
            ' */',
            'varargs void tell_room(mixed ob, string str, object *exclude)',
            '{',
            '}'
        ].join('\n'));

        const projectConfigService = {
            getSimulatedEfunFileForWorkspace: jest.fn().mockResolvedValue(entryFile),
            getResolvedForWorkspace: jest.fn().mockResolvedValue({ mudlibDirectory: './' }),
            getMudlibRootForWorkspace: jest.fn().mockResolvedValue(workspaceRoot)
        };
        const scanner = createSimulatedScanner(projectConfigService as any);

        (vscode.workspace.workspaceFolders as unknown) = [{ uri: { fsPath: workspaceRoot } }];
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: jest.fn(() => undefined),
            update: jest.fn().mockResolvedValue(undefined)
        });

        await scanner.loadSimulatedEfuns();

        expect(scanner.get('tell_room')?.signatures[0]).toMatchObject({
            label: 'varargs void tell_room(mixed ob, string str, object *exclude)',
            arity: {
                min: 0,
                max: 3
            }
        });
    });

    test('loads simulated efuns for the workspace that owns the requested document', async () => {
        const unrelatedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-simul-unrelated-root-'));
        const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-simul-document-root-'));
        const entryDir = path.join(workspaceRoot, 'adm', 'single');
        const includeDir = path.join(workspaceRoot, 'adm', 'simul_efun');
        const entryFile = path.join(entryDir, 'simul_efun.c');
        const sourceDocument = TestHelper.createMockDocument(
            'void demo() { new_bind("/x"); chinese_number(1); }',
            'lpc',
            path.join(workspaceRoot, 'adm', 'daemons', 'aoyid.c')
        );
        (sourceDocument as any).uri = vscode.Uri.file(sourceDocument.fileName);

        fs.mkdirSync(entryDir, { recursive: true });
        fs.mkdirSync(includeDir, { recursive: true });
        fs.writeFileSync(entryFile, [
            '#include "/adm/simul_efun/object.c"',
            '#include "/adm/simul_efun/chinese.c"'
        ].join('\n'));
        fs.writeFileSync(path.join(includeDir, 'object.c'), [
            '/**',
            ' * @brief 生成绑定物品',
            ' * @param string path 物品路径',
            ' * @return object 物品',
            ' */',
            'object new_bind(string path) { return new(path); }'
        ].join('\n'));
        fs.writeFileSync(path.join(includeDir, 'chinese.c'), [
            '/**',
            ' * @brief 数字转中文',
            ' * @param int i 数字',
            ' * @return string 中文数字',
            ' */',
            'string chinese_number(int i) { return ""; }'
        ].join('\n'));

        const projectConfigService = {
            getSimulatedEfunFileForWorkspace: jest.fn(async (root: string) =>
                root === workspaceRoot ? entryFile : undefined
            ),
            getResolvedForWorkspace: jest.fn().mockResolvedValue({ mudlibDirectory: './' }),
            getMudlibRootForWorkspace: jest.fn(async (root: string) =>
                root === workspaceRoot ? workspaceRoot : undefined
            )
        };
        const scanner = createSimulatedScanner(projectConfigService as any);

        (vscode.workspace.workspaceFolders as unknown) = [
            { uri: { fsPath: unrelatedRoot } },
            { uri: { fsPath: workspaceRoot } }
        ];
        (vscode.workspace.getWorkspaceFolder as jest.Mock).mockImplementation((uri: vscode.Uri) =>
            normalizeTestPath(uri.fsPath).startsWith(normalizeTestPath(workspaceRoot))
                ? { uri: { fsPath: workspaceRoot } }
                : { uri: { fsPath: unrelatedRoot } }
        );

        await scanner.ensureWorkspaceStateCurrent(sourceDocument);

        expect(projectConfigService.getSimulatedEfunFileForWorkspace).toHaveBeenCalledWith(workspaceRoot);
        expect(scanner.getAllNames()).toEqual(expect.arrayContaining(['new_bind', 'chinese_number']));
    });

    test('reloads simulated efuns from the requested document root after workspace state invalidation', async () => {
        const unrelatedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-simul-invalidate-unrelated-'));
        const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-simul-invalidate-document-'));
        const entryDir = path.join(workspaceRoot, 'adm', 'single');
        const includeDir = path.join(workspaceRoot, 'adm', 'simul_efun');
        const entryFile = path.join(entryDir, 'simul_efun.c');
        const sourceDocument = TestHelper.createMockDocument(
            'void demo() { new_bind("/x"); chinese_number(1); }',
            'lpc',
            path.join(workspaceRoot, 'adm', 'daemons', 'aoyid.c')
        );
        (sourceDocument as any).uri = vscode.Uri.file(sourceDocument.fileName);

        fs.mkdirSync(entryDir, { recursive: true });
        fs.mkdirSync(includeDir, { recursive: true });
        fs.writeFileSync(entryFile, [
            '#include "/adm/simul_efun/object.c"',
            '#include "/adm/simul_efun/chinese.c"'
        ].join('\n'));
        fs.writeFileSync(path.join(includeDir, 'object.c'), [
            '/**',
            ' * @brief 生成绑定物品',
            ' */',
            'object new_bind(string path) { return new(path); }'
        ].join('\n'));
        fs.writeFileSync(path.join(includeDir, 'chinese.c'), [
            '/**',
            ' * @brief 数字转中文',
            ' */',
            'string chinese_number(int i) { return ""; }'
        ].join('\n'));

        const projectConfigService = {
            getSimulatedEfunFileForWorkspace: jest.fn(async (root: string) =>
                root === workspaceRoot ? entryFile : undefined
            ),
            getResolvedForWorkspace: jest.fn().mockResolvedValue({ mudlibDirectory: './' }),
            getMudlibRootForWorkspace: jest.fn(async (root: string) =>
                root === workspaceRoot ? workspaceRoot : undefined
            )
        };
        const scanner = createSimulatedScanner(projectConfigService as any);

        (vscode.workspace.workspaceFolders as unknown) = [
            { uri: { fsPath: unrelatedRoot } },
            { uri: { fsPath: workspaceRoot } }
        ];
        (vscode.workspace.getWorkspaceFolder as jest.Mock).mockImplementation((uri: vscode.Uri) =>
            normalizeTestPath(uri.fsPath).startsWith(normalizeTestPath(workspaceRoot))
                ? { uri: { fsPath: workspaceRoot } }
                : { uri: { fsPath: unrelatedRoot } }
        );

        await scanner.ensureWorkspaceStateCurrent(sourceDocument);
        scanner.invalidateWorkspaceState();
        expect(scanner.getAllNames()).toEqual([]);

        await scanner.ensureWorkspaceStateCurrent(sourceDocument);

        expect(projectConfigService.getSimulatedEfunFileForWorkspace).toHaveBeenLastCalledWith(workspaceRoot);
        expect(scanner.getAllNames()).toEqual(expect.arrayContaining(['new_bind', 'chinese_number']));
    });

    test('keeps simulated efun docs isolated per workspace during interleaved diagnostics', async () => {
        const workspaceRootA = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-simul-workspace-a-'));
        const workspaceRootB = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-simul-workspace-b-'));
        const entryDirA = path.join(workspaceRootA, 'adm', 'single');
        const includeDirA = path.join(workspaceRootA, 'adm', 'simul_efun');
        const entryFileA = path.join(entryDirA, 'simul_efun.c');
        const documentA = TestHelper.createMockDocument(
            'void demo() { new_bind("/x"); chinese_number(1); }',
            'lpc',
            path.join(workspaceRootA, 'adm', 'daemons', 'aoyid.c')
        );
        const documentB = TestHelper.createMockDocument(
            'void demo() { write("plain workspace"); }',
            'lpc',
            path.join(workspaceRootB, 'room.c')
        );
        (documentA as any).uri = vscode.Uri.file(documentA.fileName);
        (documentB as any).uri = vscode.Uri.file(documentB.fileName);

        fs.mkdirSync(entryDirA, { recursive: true });
        fs.mkdirSync(includeDirA, { recursive: true });
        fs.writeFileSync(entryFileA, [
            '#include "/adm/simul_efun/object.c"',
            '#include "/adm/simul_efun/chinese.c"'
        ].join('\n'));
        fs.writeFileSync(path.join(includeDirA, 'object.c'), 'object new_bind(string path) { return new(path); }\n');
        fs.writeFileSync(path.join(includeDirA, 'chinese.c'), 'string chinese_number(int i) { return ""; }\n');

        const projectConfigService = {
            getSimulatedEfunFileForWorkspace: jest.fn(async (root: string) =>
                root === workspaceRootA ? entryFileA : undefined
            ),
            getResolvedForWorkspace: jest.fn().mockResolvedValue({ mudlibDirectory: './' }),
            getMudlibRootForWorkspace: jest.fn(async (root: string) =>
                root === workspaceRootA ? workspaceRootA : root
            )
        };
        const scanner = createSimulatedScanner(projectConfigService as any);

        (vscode.workspace.workspaceFolders as unknown) = [
            { uri: { fsPath: workspaceRootA } },
            { uri: { fsPath: workspaceRootB } }
        ];
        (vscode.workspace.getWorkspaceFolder as jest.Mock).mockImplementation((uri: vscode.Uri) => {
            const normalized = normalizeTestPath(uri.fsPath);
            if (normalized.startsWith(normalizeTestPath(workspaceRootA))) {
                return { uri: { fsPath: workspaceRootA } };
            }
            if (normalized.startsWith(normalizeTestPath(workspaceRootB))) {
                return { uri: { fsPath: workspaceRootB } };
            }
            return undefined;
        });

        await scanner.ensureWorkspaceStateCurrent(documentA);
        expect(scanner.getAllNames(documentA)).toEqual(expect.arrayContaining(['new_bind', 'chinese_number']));

        await scanner.ensureWorkspaceStateCurrent(documentB);

        expect(scanner.getAllNames(documentB)).toEqual([]);
        expect(scanner.getAllNames(documentA)).toEqual(expect.arrayContaining(['new_bind', 'chinese_number']));
        expect(scanner.getForDocument('new_bind', documentA)).toBeDefined();
        expect(scanner.getForDocument('new_bind', documentB)).toBeUndefined();
    });

    test('loading simulated efun docs does not poison parse cache for included sources with single-line if else chains', async () => {
        const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-simul-cache-poison-'));
        const entryDir = path.join(workspaceRoot, 'adm', 'single');
        const includeDir = path.join(workspaceRoot, 'adm', 'simul_efun');
        const entryFile = path.join(entryDir, 'simul_efun.c');
        const helperFile = path.join(includeDir, 'util.c');
        const helperSource = [
            '/**',
            ' * @brief add helper',
            ' */',
            'string add_sub(string s_str, string m_str)',
            '{',
            '    string *slist;',
            '    int i;',
            '',
            '    if (! s_str || is_sub(s_str, m_str))',
            '        return m_str;',
            '',
            '    slist = explode(s_str, ",");',
            '    slist -= ({ "" });',
            '    for (i = 0; i < sizeof(slist); i++)',
            '        if (! is_sub(slist[i], m_str))',
            '            if (m_str == 0 || m_str == "")',
            '                m_str = slist[i];',
            '            else',
            '                m_str += "," + slist[i];',
            '',
            '    return m_str;',
            '}'
        ].join('\n');

        fs.mkdirSync(entryDir, { recursive: true });
        fs.mkdirSync(includeDir, { recursive: true });
        fs.writeFileSync(entryFile, '#include "/adm/simul_efun/util.c"\n');
        fs.writeFileSync(helperFile, helperSource);

        const projectConfigService = {
            getSimulatedEfunFileForWorkspace: jest.fn().mockResolvedValue(entryFile),
            getResolvedForWorkspace: jest.fn().mockResolvedValue({ mudlibDirectory: './' }),
            getMudlibRootForWorkspace: jest.fn().mockResolvedValue(workspaceRoot)
        };
        const scanner = createSimulatedScanner(projectConfigService as any);

        (vscode.workspace.workspaceFolders as unknown) = [{ uri: { fsPath: workspaceRoot } }];
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: jest.fn(() => undefined),
            update: jest.fn().mockResolvedValue(undefined)
        });

        await scanner.loadSimulatedEfuns();

        expect(scanner.get('add_sub')).toMatchObject({
            name: 'add_sub',
            summary: 'add helper'
        });

        const actualDocument = TestHelper.createMockDocument(
            helperSource,
            'lpc',
            helperFile.replace(/\\/g, '/')
        );
        const analysis = DocumentSemanticSnapshotService.getInstance().parseDocument(actualDocument);

        expect(analysis.parseErrors).toEqual([]);
    });

    test('semantic snapshot exposes include directives for simulated efun entry files', async () => {
        const document = TestHelper.createMockDocument('#include "/adm/simul_efun/helper.c"\n', 'lpc', 'simul_efun.c');
        const analysis = getAstManagerForTests().parseDocument(document, false);

        expect(analysis.snapshot.includeStatements.map(statement => statement.value))
            .toEqual(['/adm/simul_efun/helper.c']);
    });

    test('entry simul_efun file also follows inherited simul efun sources', async () => {
        const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-simul-inherit-'));
        const entryDir = path.join(workspaceRoot, 'adm', 'single');
        const inheritDir = path.join(workspaceRoot, 'adm', 'simul_efun');
        const entryFile = path.join(entryDir, 'simul_efun.c');

        fs.mkdirSync(entryDir, { recursive: true });
        fs.mkdirSync(inheritDir, { recursive: true });
        fs.writeFileSync(entryFile, 'inherit "/adm/simul_efun/helper";\n');
        fs.writeFileSync(path.join(inheritDir, 'helper.c'), [
            '/**',
            ' * @brief helper from inherit',
            ' */',
            'int inherited_helper() { return 1; }'
        ].join('\n'));

        const projectConfigService = {
            getSimulatedEfunFileForWorkspace: jest.fn().mockResolvedValue(entryFile),
            getResolvedForWorkspace: jest.fn().mockResolvedValue({ mudlibDirectory: './' })
        };
        const scanner = createSimulatedScanner(projectConfigService as any);

        (vscode.workspace.workspaceFolders as unknown) = [{ uri: { fsPath: workspaceRoot } }];
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: jest.fn(() => undefined),
            update: jest.fn().mockResolvedValue(undefined)
        });

        await scanner.loadSimulatedEfuns();

        expect(scanner.get('inherited_helper')).toMatchObject({
            name: 'inherited_helper',
            summary: 'helper from inherit'
        });
    });
});
