import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ASTManager } from '../ast/astManager';
import { EfunDocsManager as FacadeEfunDocsManager } from '../efun/EfunDocsManager';
import { FunctionDocCompatMaterializer } from '../efun/FunctionDocCompatMaterializer';
import { FunctionDocLookupBuilder } from '../efun/FunctionDocLookupBuilder';
import { buildEfunHoverMarkdown, createEfunHover } from '../efun/EfunHoverContent';
import { SimulatedEfunScanner } from '../efun/SimulatedEfunScanner';
import { EfunDocsManager } from '../efunDocs';
import { QueryBackedLanguageCompletionService } from '../language/services/completion/LanguageCompletionService';
import { ScopedMethodCompletionSupport } from '../language/services/completion/ScopedMethodCompletionSupport';
import { FunctionDocumentationService } from '../language/documentation/FunctionDocumentationService';
import { ScopedMethodDiscoveryService } from '../objectInference/ScopedMethodDiscoveryService';
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
        new FunctionDocumentationService(),
        new FunctionDocCompatMaterializer()
    );
}

function createCompatMaterializer(): FunctionDocCompatMaterializer {
    return new FunctionDocCompatMaterializer();
}

function createLookupBuilder(
    documentationService: FunctionDocumentationService,
    pathSupport: WorkspaceDocumentPathSupport
): FunctionDocLookupBuilder {
    return new FunctionDocLookupBuilder({
        documentationService,
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

    function createManager(extensionPath: string): EfunDocsManager {
        const documentationService = new FunctionDocumentationService();
        const pathSupport = new WorkspaceDocumentPathSupport({
            host: createVsCodeTextDocumentHost()
        });
        return new EfunDocsManager(
            createContext(extensionPath),
            undefined,
            DocumentSemanticSnapshotService.getInstance(),
            undefined,
            documentationService,
            pathSupport,
            createCompatMaterializer(),
            createLookupBuilder(documentationService, pathSupport)
        );
    }

    function writeBundleFile(extensionPath: string, value: unknown | string): void {
        const configDir = path.join(extensionPath, 'config');
        fs.mkdirSync(configDir, { recursive: true });
        const serialized = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
        fs.writeFileSync(path.join(configDir, 'efun-docs.json'), serialized, 'utf8');
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

        const manager = createManager(extensionPath);
        const allocateDoc = manager.getStandardDoc('allocate');
        const callOtherDoc = manager.getStandardDoc('call_other');
        const callOutDoc = manager.getStandardDoc('call_out');
        const minimalDoc = manager.getStandardDoc('minimal_doc');

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
            returnType: 'mixed *',
            category: '数组相关函数（Arrays）'
        });
        expect(allocateDoc?.syntax).toContain('mixed *allocate(int size)');
        expect(allocateDoc?.syntax).toContain('mixed *allocate(int size, mixed value)');
        expect(callOtherDoc?.syntax).toContain('mixed call_other(object ob, string func, mixed arg)');
        expect(callOtherDoc?.syntax).toContain('mixed call_other(object ob, string func, mixed ...args)');
        expect(callOutDoc?.syntax).toBe('int call_out(string | function fun, int | float delay, mixed ...args)');
        expect(callOutDoc?.description).toContain('设置延迟调用。');
        expect(callOutDoc?.details).toContain('delay 支持 int 或 float。');
        expect(callOutDoc?.note).toContain('remove_call_out');
        expect(callOutDoc?.reference).toEqual(['remove_call_out', 'find_call_out']);
        expect(minimalDoc).toMatchObject({
            name: 'minimal_doc',
            syntax: 'void minimal_doc()',
            returnType: 'void',
            category: '数组相关函数（Arrays）'
        });
        expect(minimalDoc?.description).toBe('');
        expect(errorSpy).not.toHaveBeenCalled();
    });

    test('re-export shim exposes the facade manager class', () => {
        expect(EfunDocsManager).toBe(FacadeEfunDocsManager);
    });

    test('should build bundled efun completion documentation through the shared completion service', async () => {
        const extensionPath = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-efun-completion-'));
        writeBundleFile(extensionPath, createStructuredBundle());
        const manager = createManager(extensionPath);
        const documentHost = createVsCodeTextDocumentHost();
        const documentationService = new FunctionDocumentationService();
        const objectInferenceService = { inferObjectAccess: jest.fn() } as any;
        const service = new QueryBackedLanguageCompletionService(manager, {
            getMacro: jest.fn(),
            getAllMacros: jest.fn(() => []),
            getMacroHoverContent: jest.fn(),
            scanMacros: jest.fn().mockResolvedValue(undefined),
            getIncludePath: jest.fn()
        } as any, undefined, objectInferenceService, undefined, {
            analysisService: DocumentSemanticSnapshotService.getInstance(),
            documentationService,
            scopedMethodDiscoveryService: new ScopedMethodDiscoveryService(
                undefined,
                undefined,
                DocumentSemanticSnapshotService.getInstance(),
                documentHost
            ),
            scopedCompletionSupport: new ScopedMethodCompletionSupport({
                documentationService,
                documentHost
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

        const manager = createManager(extensionPath);

        expect(manager.getAllFunctions()).toEqual([]);
        expect(manager.getCategories().size).toBe(0);
        expect(manager.getStandardDoc('allocate')).toBeUndefined();
        expect(errorSpy).toHaveBeenCalled();
    });

    test('returns empty docs and categories when docs is missing', () => {
        const extensionPath = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-efun-missing-docs-'));
        writeBundleFile(extensionPath, {
            generatedAt: '2026-04-14T00:00:00.000Z',
            categories: {
                '调用相关函数（Calls）': ['call_out']
            }
        });

        const manager = createManager(extensionPath);

        expect(manager.getAllFunctions()).toEqual([]);
        expect(manager.getCategories().size).toBe(0);
        expect(errorSpy).toHaveBeenCalled();
    });

    test('loads docs but returns empty categories when categories is missing', () => {
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

        const manager = createManager(extensionPath);

        expect(manager.getAllFunctions()).toEqual(['call_out']);
        expect(manager.getStandardDoc('call_out')).toMatchObject({
            name: 'call_out',
            returnType: 'int'
        });
        expect(manager.getCategories().size).toBe(0);
        expect(errorSpy).toHaveBeenCalled();
    });

    test('ignores missing category references and keeps unreferenced docs loadable', () => {
        const extensionPath = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-efun-missing-category-ref-'));
        writeBundleFile(extensionPath, createStructuredBundle({
            categories: {
                '调用相关函数（Calls）': ['call_out', 'missing_doc']
            }
        }));

        const manager = createManager(extensionPath);

        expect(manager.getCategories().get('调用相关函数（Calls）')).toEqual(['call_out']);
        expect(manager.getAllFunctions()).toEqual(expect.arrayContaining(['call_out', 'allocate', 'orphan_doc']));
        expect(manager.getStandardDoc('missing_doc')).toBeUndefined();
        expect(warnSpy).toHaveBeenCalled();
    });

    test('rejects docs whose key does not match the declared name', () => {
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

        const manager = createManager(extensionPath);

        expect(manager.getAllFunctions()).toEqual([]);
        expect(manager.getStandardDoc('wrong_key')).toBeUndefined();
        expect(manager.getCategories().get('调用相关函数（Calls）')).toEqual([]);
        expect(warnSpy).toHaveBeenCalled();
    });

    test('compatibility returnType is omitted when overloaded signatures disagree or are incomplete', async () => {
        const extensionPath = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-efun-return-type-compat-'));
        writeBundleFile(extensionPath, createStructuredBundle({
            docs: {
                mixed_returns: {
                    name: 'mixed_returns',
                    summary: '重载返回类型不一致时不暴露兼容 returnType。',
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

        const manager = createManager(extensionPath);
        const mixedReturnsDoc = manager.getStandardDoc('mixed_returns');
        const lateOnlyDoc = manager.getStandardDoc('late_only_return_type');

        expect(mixedReturnsDoc?.returnType).toBeUndefined();
        expect(lateOnlyDoc?.returnType).toBeUndefined();
        expect(mixedReturnsDoc?.syntax).toContain('int mixed_returns(int arg)');
        expect(mixedReturnsDoc?.syntax).toContain('string mixed_returns(string arg)');
    });

    test('drops invalid docs when a signature is missing label', () => {
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

        const manager = createManager(extensionPath);

        expect(manager.getAllFunctions()).toEqual([]);
        expect(manager.getCategories().get('调用相关函数（Calls）')).toEqual([]);
    });

    test('drops invalid docs when a parameter is missing name', () => {
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

        const manager = createManager(extensionPath);

        expect(manager.getAllFunctions()).toEqual([]);
        expect(manager.getCategories().get('调用相关函数（Calls）')).toEqual([]);
    });

    test('hover markdown is not trusted and preserves pointer-like parameter types in the table', () => {
        const hover = createEfunHover(buildEfunHoverMarkdown({
            name: 'demo',
            syntax: 'mixed demo(mixed * items, string* label)',
            description: 'demo description\n\n参数:\nmixed * items: item list\nstring* label: label text'
        }));

        const content = hover.contents as vscode.MarkdownString;
        expect(content.isTrusted).toBe(false);
        expect(content.value).toContain('| `items` | `mixed *` | item list |');
        expect(content.value).toContain('| `label` | `string*` | label text |');
    });

    test('hover parameter table escapes markdown-breaking pipe characters', () => {
        const hover = createEfunHover(buildEfunHoverMarkdown({
            name: 'demo',
            syntax: 'void demo(string value)',
            description: 'demo description\n\n参数:\nstring value: foo | bar'
        }));

        const content = hover.contents as vscode.MarkdownString;
        expect(content.value).toContain('| `value` | `string` | foo \\| bar |');
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
            'int sim_helper()'
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
            'int sim_helper()'
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

    test('configureSimulatedEfuns persists simulatedEfunFile into lpc-support.json', async () => {
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
        (vscode.window.showOpenDialog as jest.Mock).mockResolvedValue([
            { fsPath: entryFile }
        ]);

        await scanner.configureSimulatedEfuns();

        const written = JSON.parse(fs.readFileSync(path.join(workspaceRoot, 'lpc-support.json'), 'utf8'));
        expect(written.resolved?.simulatedEfunFile).toBe(path.join('adm', 'single', 'simul_efun.c'));
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
            'int sim_helper()'
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
            description: 'helper from include'
        });
    });

    test('parser trivia exposes include directives for simulated efun entry files', () => {
        const document = TestHelper.createMockDocument('#include "/adm/simul_efun/helper.c"\n', 'lpc', 'simul_efun.c');
        const parsed = getAstManagerForTests().parseDocument(document, false).parsed;

        expect(parsed?.tokenTriviaIndex.getAllTrivia().filter(trivia => trivia.kind === 'directive').map(trivia => trivia.text.trim()))
            .toEqual(['#include "/adm/simul_efun/helper.c"']);
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
            'int inherited_helper()'
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
            description: 'helper from inherit'
        });
    });
});
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
