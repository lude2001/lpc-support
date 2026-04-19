import * as vscode from 'vscode';
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { ASTManager } from '../../../../ast/astManager';
import { DocumentSemanticSnapshotService } from '../../../../semantic/documentSemanticSnapshotService';
import { EfunDocsManager } from '../../../../efunDocs';
import { FunctionDocCompatMaterializer } from '../../../../efun/FunctionDocCompatMaterializer';
import { FunctionDocLookupBuilder } from '../../../../efun/FunctionDocLookupBuilder';
import { FunctionDocumentationService } from '../../../documentation/FunctionDocumentationService';
import { CallableDocRenderer } from '../../../documentation/CallableDocRenderer';
import { WorkspaceDocumentPathSupport, createVsCodeTextDocumentHost } from '../../../shared/WorkspaceDocumentPathSupport';
import { clearGlobalParsedDocumentService } from '../../../../parser/ParsedDocumentService';
import { ObjectInferenceService } from '../../../../objectInference/ObjectInferenceService';
import {
    configureAstManagerSingletonForTests,
    resetAstManagerSingletonForTests
} from '../../../../__tests__/testAstManagerSingleton';
import type { LanguageCapabilityContext } from '../../../contracts/LanguageCapabilityContext';
import type { CallableDoc } from '../../../documentation/types';
import { TargetMethodLookup } from '../../../../targetMethodLookup';
import { DefaultCallableDocResolver } from '../DefaultCallableDocResolver';
import { DefaultCallableTargetDiscoveryService } from '../DefaultCallableTargetDiscoveryService';
import { createSyntaxAwareCallSiteAnalyzer } from '../SyntaxAwareCallSiteAnalyzer';
import {
    LanguageSignatureHelpService,
    type CallableDiscoveryRequest,
    type CallableDocResolver,
    type CallableTargetDiscoveryService,
    type ResolvedCallableTarget
} from '../LanguageSignatureHelpService';

const originalWorkspaceFolders = vscode.workspace.workspaceFolders;

function createDocument(
    content: string,
    filePath = 'D:/workspace/signature-help.c',
    version = 1
): vscode.TextDocument {
    const normalized = content.replace(/\r\n/g, '\n');
    const lineStarts = [0];

    for (let index = 0; index < normalized.length; index += 1) {
        if (normalized[index] === '\n') {
            lineStarts.push(index + 1);
        }
    }

    const offsetAt = (position: vscode.Position): number => {
        const lineStart = lineStarts[position.line] ?? normalized.length;
        return Math.min(lineStart + position.character, normalized.length);
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

    const getWordRangeAtPosition = (position: vscode.Position): vscode.Range | undefined => {
        const lineText = normalized.split('\n')[position.line] ?? '';
        if (lineText.length === 0) {
            return undefined;
        }

        const isWordCharacter = (char: string | undefined): boolean => Boolean(char && /[A-Za-z0-9_]/.test(char));
        let anchor = Math.max(0, Math.min(position.character, lineText.length - 1));
        if (!isWordCharacter(lineText[anchor]) && position.character > 0 && isWordCharacter(lineText[position.character - 1])) {
            anchor = position.character - 1;
        }

        if (!isWordCharacter(lineText[anchor])) {
            return undefined;
        }

        let start = anchor;
        while (start > 0 && isWordCharacter(lineText[start - 1])) {
            start -= 1;
        }

        let end = anchor + 1;
        while (end < lineText.length && isWordCharacter(lineText[end])) {
            end += 1;
        }

        return new vscode.Range(position.line, start, position.line, end);
    };

    return {
        uri: vscode.Uri.file(filePath),
        fileName: filePath,
        languageId: 'lpc',
        version,
        lineCount: lineStarts.length,
        isDirty: false,
        isClosed: false,
        isUntitled: false,
        eol: vscode.EndOfLine.LF,
        getText: (range?: vscode.Range) => {
            if (!range) {
                return normalized;
            }

            return normalized.slice(offsetAt(range.start), offsetAt(range.end));
        },
        getWordRangeAtPosition,
        lineAt: (line: number) => ({
            text: normalized.split('\n')[line] ?? ''
        }),
        offsetAt,
        positionAt,
        save: async () => true,
        validateRange: (range: vscode.Range) => range,
        validatePosition: (position: vscode.Position) => position
    } as unknown as vscode.TextDocument;
}

function createContext(document: vscode.TextDocument): LanguageCapabilityContext {
    return {
        document: document as unknown as LanguageCapabilityContext['document'],
        workspace: {
            workspaceRoot: 'D:/workspace'
        },
        mode: 'lsp'
    };
}

function positionAfter(source: string, marker: string, occurrence = 1): vscode.Position {
    let fromIndex = 0;
    let index = -1;

    for (let count = 0; count < occurrence; count += 1) {
        index = source.indexOf(marker, fromIndex);
        if (index < 0) {
            throw new Error(`Marker "${marker}" not found in source.`);
        }
        fromIndex = index + marker.length;
    }

    const offset = index + marker.length;
    const prefix = source.slice(0, offset);
    const line = prefix.split('\n').length - 1;
    const lastNewline = prefix.lastIndexOf('\n');
    const character = lastNewline >= 0 ? offset - lastNewline - 1 : offset;
    return new vscode.Position(line, character);
}

function createCallableDoc(
    name: string,
    sourceKind: CallableDoc['sourceKind'],
    declarationKey: string,
    signatures: CallableDoc['signatures'],
    overrides: Partial<CallableDoc> = {}
): CallableDoc {
    return {
        name,
        declarationKey,
        signatures,
        sourceKind,
        ...overrides
    };
}

function createDiscoveryService(
    factories: Partial<Record<'localOrInherited' | 'include' | 'objectMethod' | 'scopedMethod' | 'efun', (
        request: CallableDiscoveryRequest
    ) => Promise<ResolvedCallableTarget[]> | ResolvedCallableTarget[]>>
): CallableTargetDiscoveryService {
    return {
        discoverLocalOrInheritedTargets: jest.fn(async (request) => factories.localOrInherited
            ? factories.localOrInherited(request)
            : []),
        discoverIncludeTargets: jest.fn(async (request) => factories.include
            ? factories.include(request)
            : []),
        discoverObjectMethodTargets: jest.fn(async (request) => factories.objectMethod
            ? factories.objectMethod(request)
            : []),
        discoverScopedMethodTargets: jest.fn(async (request) => factories.scopedMethod
            ? factories.scopedMethod(request)
            : []),
        discoverEfunTargets: jest.fn(async (request) => factories.efun
            ? factories.efun(request)
            : [])
    };
}

function createDocResolver(docsByTargetKey: Record<string, CallableDoc>): CallableDocResolver {
    return {
        resolveFromTarget: jest.fn(async (target) => docsByTargetKey[target.targetKey])
    };
}

describe('LanguageSignatureHelpService', () => {
    const analysisService = DocumentSemanticSnapshotService.getInstance();

    interface SignatureHelpTestDependencies {
        discoveryService?: CallableTargetDiscoveryService;
        docResolver?: CallableDocResolver;
        documentationService?: FunctionDocumentationService;
        efunDocsManager?: EfunDocsManager;
        objectInferenceService?: ObjectInferenceService;
        scopedMethodResolver?: ConstructorParameters<typeof DefaultCallableTargetDiscoveryService>[3];
        targetMethodLookup?: TargetMethodLookup;
        host?: {
            openTextDocument(target: string | vscode.Uri): Promise<vscode.TextDocument>;
        };
        renderer?: ConstructorParameters<typeof LanguageSignatureHelpService>[0]['renderer'];
        callSiteAnalyzer?: ConstructorParameters<typeof LanguageSignatureHelpService>[0]['callSiteAnalyzer'];
    }

    function createSignatureHelpService(
        dependencies: SignatureHelpTestDependencies = {}
    ): LanguageSignatureHelpService {
        const documentationService = dependencies.documentationService ?? new FunctionDocumentationService();
        const host = dependencies.host ?? {
            openTextDocument: jest.fn(async (target: string | vscode.Uri) => {
                const filePath = typeof target === 'string' ? target : target.fsPath;
                return createDocument('', filePath);
            })
        };
        const discoveryService = dependencies.discoveryService ?? new DefaultCallableTargetDiscoveryService(
            dependencies.efunDocsManager,
            dependencies.objectInferenceService,
            dependencies.targetMethodLookup,
            dependencies.scopedMethodResolver
        );
        const docResolver = dependencies.docResolver ?? new DefaultCallableDocResolver(
            documentationService,
            dependencies.efunDocsManager,
            host
        );
        return new LanguageSignatureHelpService({
            discoveryService,
            docResolver,
            renderer: dependencies.renderer ?? new CallableDocRenderer(),
            callSiteAnalyzer: dependencies.callSiteAnalyzer ?? createSyntaxAwareCallSiteAnalyzer(analysisService),
            ...dependencies
        });
    }

    beforeEach(() => {
        configureAstManagerSingletonForTests(analysisService);
    });

    afterEach(() => {
        resetAstManagerSingletonForTests();
        clearGlobalParsedDocumentService();
        (vscode.workspace as any).workspaceFolders = originalWorkspaceFolders;
        jest.restoreAllMocks();
    });

    test('returns signature help for a local function call', async () => {
        const source = 'void test() {\n    local_call(1, 2);\n}';
        const document = createDocument(source);
        const discoveryService = createDiscoveryService({
            localOrInherited: () => [{
                kind: 'local',
                name: 'local_call',
                targetKey: 'decl:local-call',
                documentUri: document.uri.toString(),
                declarationKey: 'decl:local-call',
                sourceLabel: 'current-file',
                priority: 1
            }]
        });
        const docResolver = createDocResolver({
            'decl:local-call': createCallableDoc(
                'local_call',
                'local',
                'decl:local-call',
                [{
                    label: 'int local_call(int left, int right)',
                    returnType: 'int',
                    isVariadic: false,
                    parameters: [
                        { name: 'left', type: 'int', description: 'Left operand' },
                        { name: 'right', type: 'int', description: 'Right operand' }
                    ]
                }],
                {
                    summary: 'Adds two numbers.'
                }
            )
        });
        const service = createSignatureHelpService({
            discoveryService,
            docResolver
        });

        const result = await service.provideSignatureHelp({
            context: createContext(document),
            position: {
                line: 1,
                character: 19
            }
        });

        expect(result).toEqual({
            signatures: [{
                label: 'int local_call(int left, int right)',
                documentation: expect.stringContaining('Source: current-file'),
                sourceLabel: 'current-file',
                parameters: [
                    { label: 'int left', documentation: 'int left: Left operand' },
                    { label: 'int right', documentation: 'int right: Right operand' }
                ]
            }],
            activeSignature: 0,
            activeParameter: 1
        });
    });

    test('supports fully injected discovery and doc resolvers without requiring documentation service', async () => {
        const source = 'void test() {\n    local_call(1);\n}';
        const document = createDocument(source);
        const service = new LanguageSignatureHelpService({
            discoveryService: createDiscoveryService({
                localOrInherited: () => [{
                    kind: 'local',
                    name: 'local_call',
                    targetKey: 'decl:local-call',
                    declarationKey: 'decl:local-call',
                    sourceLabel: 'current-file',
                    priority: 1
                }]
            }),
            docResolver: createDocResolver({
                'decl:local-call': createCallableDoc(
                    'local_call',
                    'local',
                    'decl:local-call',
                    [{
                        label: 'int local_call(int value)',
                        returnType: 'int',
                        isVariadic: false,
                        parameters: [{ name: 'value', type: 'int', description: 'Single value' }]
                    }]
                )
            }),
            renderer: new CallableDocRenderer(),
            callSiteAnalyzer: createSyntaxAwareCallSiteAnalyzer(analysisService)
        });

        const result = await service.provideSignatureHelp({
            context: createContext(document),
            position: positionAfter(source, '1')
        });

        expect(result).toEqual({
            signatures: [{
                label: 'int local_call(int value)',
                documentation: expect.stringContaining('Source: current-file'),
                sourceLabel: 'current-file',
                parameters: [{ label: 'int value', documentation: 'int value: Single value' }]
            }],
            activeSignature: 0,
            activeParameter: 0
        });
    });

    test('prefers the in-file implementation signature help over a leading prototype with the same name', async () => {
        const source = [
            'private mapping execute_command(object actor, string arg);',
            '',
            'void demo() {',
            '    execute_command(this_object(), "go");',
            '}',
            '',
            '/**',
            ' * @brief 执行最小正式突破命令的结构化逻辑。',
            ' */',
            'mapping execute_command(object actor, string arg) {',
            '    return ([]);',
            '}'
        ].join('\n');
        const document = createDocument(source, 'D:/workspace/prototype-signature.c');
        const documentationService = new FunctionDocumentationService();
        const pathSupport = new WorkspaceDocumentPathSupport({
            host: createVsCodeTextDocumentHost()
        });
        const efunDocsManager = new EfunDocsManager({
            subscriptions: [],
            extensionPath: process.cwd()
        } as unknown as vscode.ExtensionContext, undefined, analysisService, undefined, documentationService, pathSupport, new FunctionDocCompatMaterializer(), new FunctionDocLookupBuilder({
            documentationService,
            pathSupport
        }));
        const service = createSignatureHelpService({
            documentationService,
            efunDocsManager,
            host: {
                openTextDocument: jest.fn(async () => document)
            }
        });

        const result = await service.provideSignatureHelp({
            context: createContext(document),
            position: (() => {
                const position = positionAfter(source, '"go"');
                return {
                    line: position.line,
                    character: position.character
                };
            })()
        });

        expect(result?.signatures[0].label).toBe('mapping execute_command(object actor, string arg)');
        expect(result?.signatures[0].documentation).toContain('执行最小正式突破命令的结构化逻辑');
    });

    test('returns signature help for inherited and include-backed calls with their own provenance', async () => {
        const source = [
            'void test() {',
            '    inherited_call(1);',
            '    include_call(2);',
            '}'
        ].join('\n');
        const document = createDocument(source);
        const discoveryService = createDiscoveryService({
            localOrInherited: (request) => request.calleeName === 'inherited_call'
                ? [{
                    kind: 'inherit',
                    name: 'inherited_call',
                    targetKey: 'decl:inherit',
                    documentUri: 'file:///D:/workspace/base.c',
                    declarationKey: 'decl:inherit',
                    sourceLabel: 'inherited',
                    priority: 2
                }]
                : [],
            include: (request) => request.calleeName === 'include_call'
                ? [{
                    kind: 'include',
                    name: 'include_call',
                    targetKey: 'decl:include',
                    documentUri: 'file:///D:/workspace/include/helper.h',
                    declarationKey: 'decl:include',
                    sourceLabel: 'include',
                    priority: 3
                }]
                : []
        });
        const docResolver = createDocResolver({
            'decl:inherit': createCallableDoc('inherited_call', 'inherit', 'decl:inherit', [{
                label: 'void inherited_call(int value)',
                returnType: 'void',
                isVariadic: false,
                parameters: [{ name: 'value', type: 'int', description: 'Inherited value' }]
            }]),
            'decl:include': createCallableDoc('include_call', 'include', 'decl:include', [{
                label: 'void include_call(int value)',
                returnType: 'void',
                isVariadic: false,
                parameters: [{ name: 'value', type: 'int', description: 'Include value' }]
            }])
        });
        const service = createSignatureHelpService({
            discoveryService,
            docResolver
        });

        const inheritedResult = await service.provideSignatureHelp({
            context: createContext(document),
            position: (() => {
                const position = positionAfter(source, '1');
                return {
                    line: position.line,
                    character: position.character
                };
            })()
        });
        const includeResult = await service.provideSignatureHelp({
            context: createContext(document),
            position: (() => {
                const position = positionAfter(source, '2');
                return {
                    line: position.line,
                    character: position.character
                };
            })()
        });

        expect(inheritedResult?.signatures[0]).toEqual(expect.objectContaining({
            label: 'void inherited_call(int value)',
            sourceLabel: 'inherited'
        }));
        expect(includeResult?.signatures[0]).toEqual(expect.objectContaining({
            label: 'void include_call(int value)',
            sourceLabel: 'include'
        }));
    });

    test('default source-backed discovery uses document-keyed lookup instead of ambient hover state', async () => {
        const source = 'void test() {\n    local_call(1);\n}';
        const document = createDocument(source);
        const currentFileDoc = {
            name: 'local_call',
            syntax: 'void local_call(int value)',
            description: 'Local callable',
            sourceFile: document.fileName,
            sourceRange: {
                start: { line: 1, character: 4 },
                end: { line: 1, character: 17 }
            }
        };
        const getCurrentFileDocForDocument = jest.fn(async () => currentFileDoc);
        const getInheritedFileDocForDocument = jest.fn(async () => undefined);
        const getCurrentFileDoc = jest.fn(() => currentFileDoc);
        const getInheritedFileDoc = jest.fn(() => undefined);
        const docResolver = createDocResolver({
            [`${document.uri.toString()}#1:4-1:17`]: createCallableDoc('local_call', 'local', `${document.uri.toString()}#1:4-1:17`, [{
                label: 'void local_call(int value)',
                returnType: 'void',
                isVariadic: false,
                parameters: [{ name: 'value', type: 'int', description: 'Local value' }]
            }])
        });
        const service = createSignatureHelpService({
            efunDocsManager: {
                getCurrentFileDocForDocument,
                getInheritedFileDocForDocument,
                getCurrentFileDoc,
                getInheritedFileDoc,
                getIncludedFileDoc: jest.fn(async () => undefined),
                getSimulatedDoc: jest.fn(() => undefined),
                getStandardCallableDoc: jest.fn(() => undefined)
            } as any,
            docResolver
        });

        const result = await service.provideSignatureHelp({
            context: createContext(document),
            position: {
                line: 1,
                character: 16
            }
        });

        expect(result?.signatures[0]).toEqual(expect.objectContaining({
            label: 'void local_call(int value)',
            sourceLabel: 'current-file'
        }));
        expect(getCurrentFileDocForDocument).toHaveBeenCalledWith(document, 'local_call');
        expect(getInheritedFileDocForDocument).toHaveBeenCalledWith(document, 'local_call', { forceFresh: true });
        expect(getCurrentFileDoc).not.toHaveBeenCalled();
        expect(getInheritedFileDoc).not.toHaveBeenCalled();
    });

    test('returns signature help for simul_efun and standard efun calls', async () => {
        const source = [
            'void test() {',
            '    simul_call(1);',
            '    efun_call(2);',
            '}'
        ].join('\n');
        const document = createDocument(source);
        const discoveryService = createDiscoveryService({
            efun: (request) => {
                if (request.calleeName === 'simul_call') {
                    return [{
                        kind: 'simulEfun',
                        name: 'simul_call',
                        targetKey: 'decl:simul',
                        documentUri: 'file:///D:/workspace/adm/simul_efun.c',
                        declarationKey: 'decl:simul',
                        sourceLabel: 'simul_efun',
                        priority: 5
                    }];
                }

                if (request.calleeName === 'efun_call') {
                    return [{
                        kind: 'efun',
                        name: 'efun_call',
                        targetKey: 'efun:efun_call',
                        sourceLabel: 'efun',
                        priority: 6
                    }];
                }

                return [];
            }
        });
        const docResolver = createDocResolver({
            'decl:simul': createCallableDoc('simul_call', 'simulEfun', 'decl:simul', [{
                label: 'mixed simul_call(int value)',
                returnType: 'mixed',
                isVariadic: false,
                parameters: [{ name: 'value', type: 'int', description: 'Simul value' }]
            }]),
            'efun:efun_call': createCallableDoc('efun_call', 'efun', 'efun:efun_call', [{
                label: 'string efun_call(int value)',
                returnType: 'string',
                isVariadic: false,
                parameters: [{ name: 'value', type: 'int', description: 'Efun value' }]
            }])
        });
        const service = createSignatureHelpService({
            discoveryService,
            docResolver
        });

        const simulResult = await service.provideSignatureHelp({
            context: createContext(document),
            position: (() => {
                const position = positionAfter(source, '1');
                return {
                    line: position.line,
                    character: position.character
                };
            })()
        });
        const efunResult = await service.provideSignatureHelp({
            context: createContext(document),
            position: (() => {
                const position = positionAfter(source, '2');
                return {
                    line: position.line,
                    character: position.character
                };
            })()
        });

        expect(simulResult?.signatures[0]).toEqual(expect.objectContaining({
            label: 'mixed simul_call(int value)',
            sourceLabel: 'simul_efun'
        }));
        expect(efunResult?.signatures[0]).toEqual(expect.objectContaining({
            label: 'string efun_call(int value)',
            sourceLabel: 'efun'
        }));
    });

    test('returns signature help for object-method calls', async () => {
        const source = 'void test(object ob) {\n    ob->query_name(1, 2);\n}';
        const document = createDocument(source);
        const discoveryService = createDiscoveryService({
            objectMethod: (request) => {
                expect(request.callKind).toBe('objectMethod');
                return [{
                    kind: 'objectMethod',
                    name: 'query_name',
                    targetKey: 'decl:object-method',
                    documentUri: 'file:///D:/workspace/obj/npc.c',
                    declarationKey: 'decl:object-method',
                    sourceLabel: 'object-method',
                    priority: 4
                }];
            }
        });
        const docResolver = createDocResolver({
            'decl:object-method': createCallableDoc('query_name', 'objectMethod', 'decl:object-method', [{
                label: 'string query_name(int mode, int flags)',
                returnType: 'string',
                isVariadic: false,
                parameters: [
                    { name: 'mode', type: 'int', description: 'Query mode' },
                    { name: 'flags', type: 'int', description: 'Query flags' }
                ]
            }])
        });
        const service = createSignatureHelpService({
            discoveryService,
            docResolver
        });

        const result = await service.provideSignatureHelp({
            context: createContext(document),
            position: (() => {
                const position = positionAfter(source, '2');
                return {
                    line: position.line,
                    character: position.character
                };
            })()
        });

        expect(result?.signatures[0]).toEqual(expect.objectContaining({
            label: 'string query_name(int mode, int flags)',
            sourceLabel: 'object-method'
        }));
        expect(result?.activeParameter).toBe(1);
    });

    test('scoped method signature help resolves bare ::create()', async () => {
        const source = 'void test() {\n    ::create(1);\n}';
        const document = createDocument(source);
        const targetDocument = createDocument(
            'void create(int mode) {}\n',
            'D:/workspace/std/base_room.c'
        );
        const scopedMethodResolver = {
            resolveCallAt: jest.fn(async () => ({
                status: 'resolved' as const,
                methodName: 'create',
                targets: [{
                    path: 'D:/workspace/std/base_room.c',
                    methodName: 'create',
                    document: targetDocument,
                    location: new vscode.Location(targetDocument.uri, new vscode.Position(0, 0)),
                    declarationRange: new vscode.Range(0, 0, 0, 21),
                    sourceLabel: 'D:/workspace/std/base_room.c'
                }]
            }))
        };
        const docResolver: CallableDocResolver = {
            resolveFromTarget: jest.fn(async (target) => target.kind === 'scopedMethod'
                ? createCallableDoc('create', 'scopedMethod', target.declarationKey!, [{
                    label: 'void create(int mode)',
                    returnType: 'void',
                    isVariadic: false,
                    parameters: [{ name: 'mode', type: 'int', description: 'Creation mode' }]
                }])
                : undefined)
        };
        const service = createSignatureHelpService({
            scopedMethodResolver: scopedMethodResolver as any,
            docResolver
        });

        const result = await service.provideSignatureHelp({
            context: createContext(document),
            position: positionAfter(source, '1')
        });

        expect(result?.signatures[0]).toEqual(expect.objectContaining({
            label: 'void create(int mode)',
            sourceLabel: 'scoped-method'
        }));
        expect(scopedMethodResolver.resolveCallAt).toHaveBeenCalledWith(document, new vscode.Position(1, 4));
        expect(docResolver.resolveFromTarget).toHaveBeenCalledWith(expect.objectContaining({
            kind: 'scopedMethod',
            name: 'create',
            sourceLabel: 'scoped-method'
        }));
    });

    test('scoped method signature help does not fall back when room::init() is ambiguous', async () => {
        const source = 'void test() {\n    room::init();\n}';
        const document = createDocument(source);
        const getStandardCallableDoc = jest.fn(() => createCallableDoc('init', 'efun', 'efun:init', [{
            label: 'void init()',
            returnType: 'void',
            isVariadic: false,
            parameters: []
        }]));
        const scopedMethodResolver = {
            resolveCallAt: jest.fn(async () => ({
                status: 'unknown' as const,
                methodName: 'init',
                qualifier: 'room',
                targets: []
            }))
        };
        const service = createSignatureHelpService({
            scopedMethodResolver: scopedMethodResolver as any,
            efunDocsManager: {
                getCurrentFileDocForDocument: jest.fn(async () => undefined),
                getInheritedFileDocForDocument: jest.fn(async () => undefined),
                getIncludedFileDoc: jest.fn(async () => undefined),
                getSimulatedDoc: jest.fn(() => undefined),
                getStandardCallableDoc
            } as any
        });

        const result = await service.provideSignatureHelp({
            context: createContext(document),
            position: positionAfter(source, 'room::init(')
        });

        expect(result).toBeUndefined();
        expect(scopedMethodResolver.resolveCallAt).toHaveBeenCalledWith(document, new vscode.Position(1, 10));
        expect(getStandardCallableDoc).not.toHaveBeenCalled();
    });

    test('scoped method signature help resolves room::init() through a unique named scope', async () => {
        const source = 'void test() {\n    room::init("x");\n}';
        const document = createDocument(source);
        const targetDocument = createDocument(
            'void init(string arg) {}\n',
            'D:/workspace/std/room.c'
        );
        const scopedMethodResolver = {
            resolveCallAt: jest.fn(async () => ({
                status: 'resolved' as const,
                qualifier: 'room',
                methodName: 'init',
                targets: [{
                    path: 'D:/workspace/std/room.c',
                    methodName: 'init',
                    document: targetDocument,
                    location: new vscode.Location(targetDocument.uri, new vscode.Position(0, 0)),
                    declarationRange: new vscode.Range(0, 0, 0, 22),
                    sourceLabel: 'D:/workspace/std/room.c'
                }]
            }))
        };
        const docResolver: CallableDocResolver = {
            resolveFromTarget: jest.fn(async (target) => target.kind === 'scopedMethod'
                ? createCallableDoc('init', 'scopedMethod', target.declarationKey!, [{
                    label: 'void init(string arg)',
                    returnType: 'void',
                    isVariadic: false,
                    parameters: [{ name: 'arg', type: 'string', description: 'Room argument' }]
                }])
                : undefined)
        };
        const service = createSignatureHelpService({
            scopedMethodResolver: scopedMethodResolver as any,
            docResolver
        });

        const result = await service.provideSignatureHelp({
            context: createContext(document),
            position: positionAfter(source, '"x"')
        });

        expect(result?.signatures[0]).toEqual(expect.objectContaining({
            label: 'void init(string arg)',
            sourceLabel: 'scoped-method'
        }));
        expect(scopedMethodResolver.resolveCallAt).toHaveBeenCalledWith(document, new vscode.Position(1, 10));
    });

    test('returns signature help for file-scope global object inference', async () => {
        const fixtureRoot = path.join(process.cwd(), '.tmp-signature-help-global-object');
        const targetFile = path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c');
        const source = [
            'object COMBAT_D = load_object("/adm/daemons/combat_d");',
            '',
            'void demo() {',
            '    COMBAT_D->query_name(1, 2);',
            '}'
        ].join('\n');
        const document = createDocument(source, path.join(fixtureRoot, 'room', 'global-object-signature-help.c'));
        fs.rmSync(fixtureRoot, { recursive: true, force: true });
        fs.mkdirSync(path.dirname(targetFile), { recursive: true });
        fs.writeFileSync(
            targetFile,
            [
                'string query_name(int mode, int flags) {',
                '    return "combat-d";',
                '}'
            ].join('\n')
        );
        (vscode.workspace.getWorkspaceFolder as jest.Mock).mockReturnValue({
            uri: { fsPath: fixtureRoot }
        });
        (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: fixtureRoot } }];
        (vscode.workspace.openTextDocument as jest.Mock).mockImplementation(async (target: string | vscode.Uri) => {
            const filePath = typeof target === 'string' ? target : target.fsPath;
            return createDocument(fs.readFileSync(filePath, 'utf8'), filePath);
        });
        const documentationService = new FunctionDocumentationService();
        const documentHost = createVsCodeTextDocumentHost();
        const pathSupport = new WorkspaceDocumentPathSupport({
            host: documentHost
        });
        const objectInferenceService = new ObjectInferenceService(
            undefined,
            undefined,
            analysisService,
            documentationService,
            documentHost,
            pathSupport
        );
        const inferObjectAccess = jest.spyOn(objectInferenceService, 'inferObjectAccess');
        const targetMethodLookup = new TargetMethodLookup(analysisService, pathSupport);
        const findMethod = jest.spyOn(targetMethodLookup, 'findMethod');
        const docResolver: CallableDocResolver = {
            resolveFromTarget: jest.fn(async (target) => {
                if (target.kind !== 'objectMethod') {
                    return undefined;
                }

                return createCallableDoc('query_name', 'objectMethod', target.declarationKey ?? 'decl:query_name', [{
                    label: 'string query_name(int mode, int flags)',
                    returnType: 'string',
                    isVariadic: false,
                    parameters: [
                        { name: 'mode', type: 'int', description: 'Mode selector' },
                        { name: 'flags', type: 'int', description: 'Dispatch flags' }
                    ]
                }]);
            })
        };
        const service = createSignatureHelpService({
            documentationService,
            objectInferenceService,
            targetMethodLookup,
            docResolver
        });

        try {
            const result = await service.provideSignatureHelp({
                context: createContext(document),
                position: positionAfter(source, '2')
            });

            expect(result?.signatures[0]).toEqual(expect.objectContaining({
                label: 'string query_name(int mode, int flags)',
                sourceLabel: 'object-method'
            }));
            expect(result?.activeParameter).toBe(1);
            expect(inferObjectAccess).toHaveBeenCalledWith(document, document.positionAt(source.indexOf('query_name')));
            expect(findMethod).toHaveBeenCalledWith(document, targetFile, 'query_name', { useFreshSnapshots: true });
        } finally {
            fs.rmSync(fixtureRoot, { recursive: true, force: true });
        }
    });

    test('returns signature help for inherited file-scope global object inference', async () => {
        const fixtureRoot = path.join(process.cwd(), '.tmp-signature-help-inherited-global-object');
        const targetFile = path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c');
        const source = [
            'inherit "/std/room";',
            '',
            'void demo() {',
            '    COMBAT_D->query_name(1, 2);',
            '}'
        ].join('\n');
        const document = createDocument(source, path.join(fixtureRoot, 'room', 'global-object-signature-help.c'));
        fs.rmSync(fixtureRoot, { recursive: true, force: true });
        fs.mkdirSync(path.dirname(targetFile), { recursive: true });
        fs.mkdirSync(path.join(fixtureRoot, 'std'), { recursive: true });
        fs.writeFileSync(
            path.join(fixtureRoot, 'std', 'room.c'),
            'object COMBAT_D = load_object("/adm/daemons/combat_d");\n'
        );
        fs.writeFileSync(
            targetFile,
            [
                'string query_name(int mode, int flags) {',
                '    return "combat-d";',
                '}'
            ].join('\n')
        );
        (vscode.workspace.getWorkspaceFolder as jest.Mock).mockReturnValue({
            uri: { fsPath: fixtureRoot }
        });
        (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: fixtureRoot } }];
        (vscode.workspace.openTextDocument as jest.Mock).mockImplementation(async (target: string | vscode.Uri) => {
            const filePath = typeof target === 'string' ? target : target.fsPath;
            const normalizedPath = filePath
                .replace(/^[/\\]+([A-Za-z]:[\\/])/, '$1')
                .replace(/\//g, path.sep);
            return createDocument(fs.readFileSync(normalizedPath, 'utf8'), normalizedPath);
        });
        const documentationService = new FunctionDocumentationService();
        const documentHost = createVsCodeTextDocumentHost();
        const pathSupport = new WorkspaceDocumentPathSupport({
            host: documentHost
        });
        const objectInferenceService = new ObjectInferenceService(
            undefined,
            undefined,
            analysisService,
            documentationService,
            documentHost,
            pathSupport
        );
        const inferObjectAccess = jest.spyOn(objectInferenceService, 'inferObjectAccess');
        const targetMethodLookup = new TargetMethodLookup(analysisService, pathSupport);
        const findMethod = jest.spyOn(targetMethodLookup, 'findMethod');
        const docResolver: CallableDocResolver = {
            resolveFromTarget: jest.fn(async (target) => {
                if (target.kind !== 'objectMethod') {
                    return undefined;
                }

                return createCallableDoc('query_name', 'objectMethod', target.declarationKey ?? 'decl:query_name', [{
                    label: 'string query_name(int mode, int flags)',
                    returnType: 'string',
                    isVariadic: false,
                    parameters: [
                        { name: 'mode', type: 'int', description: 'Mode selector' },
                        { name: 'flags', type: 'int', description: 'Dispatch flags' }
                    ]
                }]);
            })
        };
        const service = createSignatureHelpService({
            documentationService,
            objectInferenceService,
            targetMethodLookup,
            docResolver
        });

        try {
            const result = await service.provideSignatureHelp({
                context: createContext(document),
                position: positionAfter(source, '2')
            });

            expect(result?.signatures[0]).toEqual(expect.objectContaining({
                label: 'string query_name(int mode, int flags)',
                sourceLabel: 'object-method'
            }));
            expect(result?.activeParameter).toBe(1);
            expect(inferObjectAccess).toHaveBeenCalledWith(document, document.positionAt(source.indexOf('query_name')));
            expect(findMethod).toHaveBeenCalledWith(document, targetFile, 'query_name', { useFreshSnapshots: true });
        } finally {
            fs.rmSync(fixtureRoot, { recursive: true, force: true });
        }
    });

    test('ignores commas and parens inside comments when computing the active parameter', async () => {
        const source = [
            'void test() {',
            '    tricky_call(1 /* comment, ) */, 2);',
            '}'
        ].join('\n');
        const document = createDocument(source);
        const discoveryService = createDiscoveryService({
            localOrInherited: () => [{
                kind: 'local',
                name: 'tricky_call',
                targetKey: 'decl:tricky-call',
                documentUri: document.uri.toString(),
                declarationKey: 'decl:tricky-call',
                sourceLabel: 'current-file',
                priority: 1
            }]
        });
        const docResolver = createDocResolver({
            'decl:tricky-call': createCallableDoc('tricky_call', 'local', 'decl:tricky-call', [{
                label: 'void tricky_call(int left, int right)',
                returnType: 'void',
                isVariadic: false,
                parameters: [
                    { name: 'left', type: 'int', description: 'First argument' },
                    { name: 'right', type: 'int', description: 'Second argument' }
                ]
            }])
        });
        const service = createSignatureHelpService({
            discoveryService,
            docResolver
        });

        const result = await service.provideSignatureHelp({
            context: createContext(document),
            position: (() => {
                const position = positionAfter(source, '2');
                return {
                    line: position.line,
                    character: position.character
                };
            })()
        });

        expect(result?.activeParameter).toBe(1);
        expect(result?.activeSignature).toBe(0);
    });

    test('dedupes by targetKey, merges identical signature groups, preserves provenance, and chooses active signature by precedence', async () => {
        const source = 'void test() {\n    shared_call(1, 2);\n}';
        const document = createDocument(source);
        const discoveryService = createDiscoveryService({
            localOrInherited: () => [
                {
                    kind: 'local',
                    name: 'shared_call',
                    targetKey: 'decl:primary',
                    documentUri: document.uri.toString(),
                    declarationKey: 'decl:primary',
                    sourceLabel: 'current-file',
                    priority: 1
                },
                {
                    kind: 'inherit',
                    name: 'shared_call',
                    targetKey: 'decl:primary',
                    documentUri: document.uri.toString(),
                    declarationKey: 'decl:primary',
                    sourceLabel: 'mirrored-current',
                    priority: 2
                }
            ],
            include: () => [{
                kind: 'include',
                name: 'shared_call',
                targetKey: 'decl:header',
                documentUri: 'file:///D:/workspace/include/helper.h',
                declarationKey: 'decl:header',
                sourceLabel: 'include',
                priority: 3
            }],
            efun: () => [{
                kind: 'simulEfun',
                name: 'shared_call',
                targetKey: 'decl:simul',
                documentUri: 'file:///D:/workspace/adm/simul_efun.c',
                declarationKey: 'decl:simul',
                sourceLabel: 'simul_efun',
                priority: 5
            }]
        });
        const primaryDoc = createCallableDoc('shared_call', 'local', 'decl:primary', [
            {
                label: 'int shared_call(int value)',
                returnType: 'int',
                isVariadic: false,
                parameters: [{ name: 'value', type: 'int', description: 'Single argument' }]
            },
            {
                label: 'int shared_call(int left, int right)',
                returnType: 'int',
                isVariadic: false,
                parameters: [
                    { name: 'left', type: 'int', description: 'Left input' },
                    { name: 'right', type: 'int', description: 'Right input' }
                ]
            }
        ]);
        const docResolver = createDocResolver({
            'decl:primary': primaryDoc,
            'decl:header': createCallableDoc('shared_call', 'include', 'decl:header', primaryDoc.signatures),
            'decl:simul': createCallableDoc('shared_call', 'simulEfun', 'decl:simul', primaryDoc.signatures)
        });
        const service = createSignatureHelpService({
            discoveryService,
            docResolver
        });

        const result = await service.provideSignatureHelp({
            context: createContext(document),
            position: {
                line: 1,
                character: 20
            }
        });

        expect(docResolver.resolveFromTarget).toHaveBeenCalledTimes(3);
        expect(result).toEqual({
            signatures: [
                {
                    label: 'int shared_call(int value)',
                    documentation: expect.stringContaining('Source: current-file'),
                    sourceLabel: 'current-file',
                    additionalSourceLabels: ['mirrored-current', 'include', 'simul_efun'],
                    parameters: [{ label: 'int value', documentation: 'int value: Single argument' }]
                },
                {
                    label: 'int shared_call(int left, int right)',
                    documentation: expect.stringContaining('Also from: mirrored-current, include, simul_efun'),
                    sourceLabel: 'current-file',
                    additionalSourceLabels: ['mirrored-current', 'include', 'simul_efun'],
                    parameters: [
                        { label: 'int left', documentation: 'int left: Left input' },
                        { label: 'int right', documentation: 'int right: Right input' }
                    ]
                }
            ],
            activeSignature: 1,
            activeParameter: 1
        });
    });

    test('selects the exact overloaded signature before considering variadic fallbacks', async () => {
        const source = 'void test() {\n    overloaded(1, 2);\n}';
        const document = createDocument(source);
        const discoveryService = createDiscoveryService({
            localOrInherited: () => [{
                kind: 'local',
                name: 'overloaded',
                targetKey: 'decl:overloaded',
                documentUri: document.uri.toString(),
                declarationKey: 'decl:overloaded',
                sourceLabel: 'current-file',
                priority: 1
            }]
        });
        const docResolver = createDocResolver({
            'decl:overloaded': createCallableDoc('overloaded', 'local', 'decl:overloaded', [
                {
                    label: 'void overloaded(int value)',
                    returnType: 'void',
                    isVariadic: false,
                    parameters: [{ name: 'value', type: 'int', description: 'One value' }]
                },
                {
                    label: 'void overloaded(int left, int right)',
                    returnType: 'void',
                    isVariadic: false,
                    parameters: [
                        { name: 'left', type: 'int', description: 'Left value' },
                        { name: 'right', type: 'int', description: 'Right value' }
                    ]
                }
            ])
        });
        const service = createSignatureHelpService({
            discoveryService,
            docResolver
        });

        const result = await service.provideSignatureHelp({
            context: createContext(document),
            position: {
                line: 1,
                character: 19
            }
        });

        expect(result?.activeSignature).toBe(1);
        expect(result?.signatures).toHaveLength(2);
    });

    test('selects the first variadic signature that can accept the active parameter', async () => {
        const source = 'void test() {\n    varargs_call(1, 2, 3);\n}';
        const document = createDocument(source);
        const discoveryService = createDiscoveryService({
            localOrInherited: () => [{
                kind: 'local',
                name: 'varargs_call',
                targetKey: 'decl:varargs-call',
                documentUri: document.uri.toString(),
                declarationKey: 'decl:varargs-call',
                sourceLabel: 'current-file',
                priority: 1
            }]
        });
        const docResolver = createDocResolver({
            'decl:varargs-call': createCallableDoc('varargs_call', 'local', 'decl:varargs-call', [
                {
                    label: 'void varargs_call(int left, int right)',
                    returnType: 'void',
                    isVariadic: false,
                    parameters: [
                        { name: 'left', type: 'int' },
                        { name: 'right', type: 'int' }
                    ]
                },
                {
                    label: 'void varargs_call(int head, mixed ...rest)',
                    returnType: 'void',
                    isVariadic: true,
                    parameters: [
                        { name: 'head', type: 'int' },
                        { name: 'rest', type: 'mixed', variadic: true, description: 'Remaining values' }
                    ]
                }
            ])
        });
        const service = createSignatureHelpService({
            discoveryService,
            docResolver
        });

        const result = await service.provideSignatureHelp({
            context: createContext(document),
            position: {
                line: 1,
                character: 22
            }
        });

        expect(result?.activeSignature).toBe(1);
        expect(result?.activeParameter).toBe(2);
    });

    test('computes the active parameter for nested calls using token-aware analysis', async () => {
        const source = [
            'void test() {',
            '    outer(({ 1, 2 }), ([ "x" : inner(10, 20) ]), 30);',
            '}'
        ].join('\n');
        const document = createDocument(source);
        const discoveryService = createDiscoveryService({
            localOrInherited: (request) => {
                expect(request.calleeName).toBe('inner');
                return [{
                    kind: 'local',
                    name: 'inner',
                    targetKey: 'decl:inner',
                    documentUri: document.uri.toString(),
                    declarationKey: 'decl:inner',
                    sourceLabel: 'current-file',
                    priority: 1
                }];
            }
        });
        const docResolver = createDocResolver({
            'decl:inner': createCallableDoc('inner', 'local', 'decl:inner', [{
                label: 'int inner(int left, int right)',
                returnType: 'int',
                isVariadic: false,
                parameters: [
                    { name: 'left', type: 'int' },
                    { name: 'right', type: 'int' }
                ]
            }])
        });
        const service = createSignatureHelpService({
            discoveryService,
            docResolver
        });

        const result = await service.provideSignatureHelp({
            context: createContext(document),
            position: (() => {
                const position = positionAfter(source, '20');
                return {
                    line: position.line,
                    character: position.character
                };
            })()
        });

        expect(result?.activeParameter).toBe(1);
        expect(result?.signatures[0].label).toBe('int inner(int left, int right)');
    });

    test('defers object-method doc materialization until resolver time', async () => {
        const source = 'void test(object ob) {\n    ob->query_name(1, 2);\n}';
        const document = createDocument(source);
        const targetDocument = createDocument(
            '/** @brief object method */\nstring query_name(int mode, int flags) { return "x"; }\n',
            'D:/workspace/obj/npc.c'
        );
        const getDocsByName = jest.fn(() => [{
            name: 'query_name',
            declarationKey: 'file:///D:/workspace/obj/npc.c#1:0-1:33',
            signatures: [{
                label: 'string query_name(int mode, int flags)',
                returnType: 'string',
                isVariadic: false,
                parameters: [
                    { name: 'mode', type: 'int', description: 'Query mode' },
                    { name: 'flags', type: 'int', description: 'Query flags' }
                ]
            }],
            sourceKind: 'local' as const
        }]);
        const getDocForDeclaration = jest.fn(() => createCallableDoc(
            'query_name',
            'local',
            'file:///D:/workspace/obj/npc.c#1:0-1:33',
            [{
                label: 'string query_name(int mode, int flags)',
                returnType: 'string',
                isVariadic: false,
                parameters: [
                    { name: 'mode', type: 'int', description: 'Query mode' },
                    { name: 'flags', type: 'int', description: 'Query flags' }
                ]
            }]
        ));
        const invalidate = jest.fn();
        const findMethod = jest.fn(async () => ({
            path: targetDocument.fileName,
            document: targetDocument,
            location: new vscode.Location(targetDocument.uri, new vscode.Position(1, 0)),
            declarationRange: new vscode.Range(1, 0, 1, 33)
        }));
        const inferObjectAccess = jest.fn(async () => ({
            memberName: 'query_name',
            receiver: 'ob',
            inference: {
                status: 'resolved',
                candidates: [{ path: '/obj/npc.c', source: 'literal' }]
            }
        }));
        const service = createSignatureHelpService({
            documentationService: {
                getDocumentDocs: jest.fn(),
                getDocsByName,
                getDocForDeclaration,
                invalidate,
                clear: jest.fn()
            } as any,
            objectInferenceService: {
                inferObjectAccess
            } as any,
            targetMethodLookup: {
                findMethod
            } as any,
            efunDocsManager: undefined,
            host: {
                openTextDocument: jest.fn(async () => targetDocument)
            }
        });

        const result = await service.provideSignatureHelp({
            context: createContext(document),
            position: (() => {
                const position = positionAfter(source, '2');
                return {
                    line: position.line,
                    character: position.character
                };
            })()
        });

        expect(result?.signatures[0]).toEqual(expect.objectContaining({
            label: 'string query_name(int mode, int flags)',
            sourceLabel: 'object-method'
        }));
        expect(inferObjectAccess).toHaveBeenCalledWith(document, new vscode.Position(1, 8));
        expect(getDocsByName).not.toHaveBeenCalled();
        expect(findMethod).toHaveBeenCalledWith(
            document,
            '/obj/npc.c',
            'query_name',
            { useFreshSnapshots: true }
        );
        expect(invalidate).toHaveBeenCalledWith(targetDocument.uri.toString());
        expect(getDocForDeclaration).toHaveBeenCalledWith(
            targetDocument,
            `${targetDocument.uri.toString()}#1:0-1:33`
        );
    });

    test('uses the called member position for chained object-method signature help discovery', async () => {
        const source = 'void test(object ob) {\n    ob->foo()->bar(1);\n}';
        const document = createDocument(source);
        const inferObjectAccess = jest.fn(async () => ({
            memberName: 'bar',
            receiver: 'ob->foo()',
            inference: {
                status: 'resolved',
                candidates: [{ path: '/obj/npc.c', source: 'literal' }]
            }
        }));
        const docResolver: CallableDocResolver = {
            resolveFromTarget: jest.fn(async () => createCallableDoc('bar', 'objectMethod', 'decl:bar', [{
                label: 'void bar(int value)',
                returnType: 'void',
                isVariadic: false,
                parameters: [{ name: 'value', type: 'int', description: 'Bar value' }]
            }]))
        };
        const service = createSignatureHelpService({
            objectInferenceService: {
                inferObjectAccess
            } as any,
            targetMethodLookup: {
                findMethod: jest.fn(async () => ({
                    path: 'D:/workspace/obj/npc.c',
                    document: createDocument('void bar(int value) {}\n', 'D:/workspace/obj/npc.c'),
                    location: new vscode.Location(vscode.Uri.file('D:/workspace/obj/npc.c'), new vscode.Position(0, 0)),
                    declarationRange: new vscode.Range(0, 0, 0, 19)
                }))
            } as any,
            documentationService: {
                getDocumentDocs: jest.fn(),
                getDocsByName: jest.fn(),
                getDocForDeclaration: jest.fn(() => createCallableDoc('bar', 'local', 'file:///D:/workspace/obj/npc.c#0:0-0:19', [{
                    label: 'void bar(int value)',
                    returnType: 'void',
                    isVariadic: false,
                    parameters: [{ name: 'value', type: 'int', description: 'Bar value' }]
                }])),
                invalidate: jest.fn(),
                clear: jest.fn()
            } as any,
            host: {
                openTextDocument: jest.fn(async (target) => createDocument('void bar(int value) {}\n', 'D:/workspace/obj/npc.c'))
            },
            docResolver
        });

        const result = await service.provideSignatureHelp({
            context: createContext(document),
            position: (() => {
                const position = positionAfter(source, '1');
                return {
                    line: position.line,
                    character: position.character
                };
            })()
        });

        expect(result?.signatures[0]).toEqual(expect.objectContaining({
            label: 'void bar(int value)',
            sourceLabel: 'object-method'
        }));
        expect(inferObjectAccess).toHaveBeenCalledWith(document, new vscode.Position(1, 15));
    });

    test('returns undefined when the callable target cannot be resolved', async () => {
        const source = 'void test() {\n    missing_call(1);\n}';
        const document = createDocument(source);
        const service = createSignatureHelpService({
            discoveryService: createDiscoveryService({}),
            docResolver: createDocResolver({})
        });

        const result = await service.provideSignatureHelp({
            context: createContext(document),
            position: {
                line: 1,
                character: 18
            }
        });

        expect(result).toBeUndefined();
    });
});
