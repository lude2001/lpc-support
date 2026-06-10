import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { InheritanceResolver } from '../../../completion/inheritanceResolver';
import { ProjectSymbolIndex } from '../../../completion/projectSymbolIndex';
import type { FunctionSummary } from '../../../semantic/documentSemanticTypes';
import type { SemanticSnapshot } from '../../../semantic/semanticSnapshot';
import { DocumentSemanticSnapshotService } from '../../../semantic/documentSemanticSnapshotService';
import { DefaultDiagnosticSymbolResolver } from '../DiagnosticSymbolResolver';
import { HeaderOwnerContextService } from '../../../language/shared/HeaderOwnerContextService';

let tempRoot: string | undefined;

function createDocument(filePath: string, content = ''): vscode.TextDocument {
    const lines = content.split(/\r?\n/);
    return {
        uri: vscode.Uri.file(filePath),
        fileName: filePath,
        languageId: 'lpc',
        version: 1,
        lineCount: lines.length,
        getText: () => content,
        lineAt: (line: number) => ({ text: lines[line] ?? '' })
    } as vscode.TextDocument;
}

function createFunction(
    name: string,
    sourceUri: string,
    parameterCount: number
): FunctionSummary {
    return {
        name,
        returnType: 'void',
        parameters: Array.from({ length: parameterCount }, (_, index) => ({
            name: `arg${index}`,
            dataType: 'mixed',
            range: new vscode.Range(0, 0, 0, 0)
        })),
        requiredParameterCount: parameterCount,
        maxParameterCount: parameterCount,
        isVariadic: false,
        modifiers: [],
        sourceUri,
        range: new vscode.Range(0, 0, 0, 0),
        origin: 'local'
    };
}

function createSnapshot(
    document: vscode.TextDocument,
    options: Partial<SemanticSnapshot> = {}
): SemanticSnapshot {
    return {
        uri: document.uri.toString(),
        version: document.version,
        syntax: {} as any,
        parseDiagnostics: [],
        exportedFunctions: [],
        symbols: [],
        localScopes: [],
        typeDefinitions: [],
        fileGlobals: [],
        inheritStatements: [],
        includeStatements: [],
        macroDefinitions: [],
        macroReferences: [],
        symbolTable: {} as any,
        createdAt: Date.now(),
        ...options
    };
}

function normalizeTestPath(filePath: string): string {
    return path.normalize(filePath).replace(/^[\\/]+([A-Za-z]:[\\/])/, '$1');
}

function createResolver(snapshots: Map<string, SemanticSnapshot>, root: string): {
    resolver: DefaultDiagnosticSymbolResolver;
    pathSupport: any;
    analysisService: any;
} {
    const snapshotsByFsPath = new Map(
        Array.from(snapshots.entries()).map(([uri, snapshot]) => [normalizeTestPath(vscode.Uri.parse(uri).fsPath), snapshot] as const)
    );
    const documents = new Map(
        Array.from(snapshots.keys()).map((uri) => {
            const parsed = vscode.Uri.parse(uri);
            return [normalizeTestPath(parsed.fsPath), createDocument(normalizeTestPath(parsed.fsPath))] as const;
        })
    );
    const pathSupport = {
        getWorkspaceFolderRoot: jest.fn(() => root),
        resolveIncludeFilePaths: jest.fn(async (_document, includeValue: string) => {
            const relativePath = includeValue.replace(/^\/+/, '');
            return [path.join(root, relativePath)];
        }),
        resolveInheritedFilePath: jest.fn((_document, inheritValue: string) => {
            const relativePath = inheritValue.replace(/^\/+/, '');
            return path.join(root, relativePath.endsWith('.c') ? relativePath : `${relativePath}.c`);
        }),
        tryOpenTextDocument: jest.fn(async (target: string | vscode.Uri) => {
            const filePath = typeof target === 'string' ? target : target.fsPath;
            const document = documents.get(normalizeTestPath(filePath));
            if (!document) {
                const normalizedPath = normalizeTestPath(filePath);
                if (!fs.existsSync(normalizedPath)) {
                    return undefined;
                }
                return createDocument(normalizedPath, fs.readFileSync(normalizedPath, 'utf8'));
            }
            return document;
        }),
        fileExists: (filePath: string) => fs.existsSync(normalizeTestPath(filePath))
    };
    const getSnapshot = (document: vscode.TextDocument): SemanticSnapshot => {
        const snapshot = snapshots.get(document.uri.toString()) ?? snapshotsByFsPath.get(normalizeTestPath(document.uri.fsPath));
        if (!snapshot) {
            return DocumentSemanticSnapshotService.getInstance().parseDocument(document, false).semantic;
        }
        return snapshot;
    };
    const analysisService = {
        getSemanticSnapshot: jest.fn(getSnapshot),
        getBestAvailableSemanticSnapshot: jest.fn(getSnapshot)
    };

    return {
        resolver: new DefaultDiagnosticSymbolResolver({
        analysisService,
        pathSupport: pathSupport as any,
        projectSymbolIndex: new ProjectSymbolIndex(new InheritanceResolver([root])),
        efunDocsManager: {
            getAllFunctions: () => ['write'],
            getAllSimulatedFunctions: () => ['simul_log'],
            getStandardCallableDoc: (name) => name === 'write'
                ? {
                    name,
                    declarationKey: 'efun:write',
                    signatures: [{
                        label: 'void write(string message)',
                        parameters: [{ name: 'message', type: 'string' }],
                        isVariadic: false
                    }],
                    sourceKind: 'efun'
                }
                : undefined,
            getSimulatedDoc: (name) => name === 'simul_log'
                ? {
                    name,
                    declarationKey: 'simul:simul_log',
                    signatures: [{
                        label: 'void simul_log(string message, mixed *rest...)',
                        parameters: [
                            { name: 'message', type: 'string' },
                            { name: 'rest', type: 'mixed *', variadic: true }
                        ],
                        isVariadic: true
                    }],
                    sourceKind: 'simulEfun'
                }
                : undefined
        }
        }),
        pathSupport,
        analysisService
    };
}

describe('DefaultDiagnosticSymbolResolver', () => {
    afterEach(() => {
        DocumentSemanticSnapshotService.getInstance().clearAllCache();
        if (tempRoot) {
            fs.rmSync(tempRoot, { recursive: true, force: true });
            tempRoot = undefined;
        }
    });

    test('resolves include, inherit, efun, and simul-efun callable signatures', async () => {
        tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-basic-diagnostics-'));
        const mainPath = path.join(tempRoot, 'room.c');
        const includePath = path.join(tempRoot, 'include', 'helper.h');
        const inheritPath = path.join(tempRoot, 'inherit', 'base.c');
        fs.mkdirSync(path.dirname(includePath), { recursive: true });
        fs.mkdirSync(path.dirname(inheritPath), { recursive: true });
        fs.writeFileSync(mainPath, '', 'utf8');
        fs.writeFileSync(includePath, '', 'utf8');
        fs.writeFileSync(inheritPath, '', 'utf8');

        const mainDocument = createDocument(mainPath);
        const includeDocument = createDocument(includePath);
        const inheritDocument = createDocument(inheritPath);
        const snapshots = new Map<string, SemanticSnapshot>();
        snapshots.set(mainDocument.uri.toString(), createSnapshot(mainDocument, {
            includeStatements: [{
                rawText: '#include "/include/helper.h"',
                value: '/include/helper.h',
                range: new vscode.Range(0, 0, 0, 0),
                isSystemInclude: false
            }],
            inheritStatements: [{
                rawText: 'inherit "inherit/base";',
                expressionKind: 'string',
                value: 'inherit/base',
                range: new vscode.Range(1, 0, 1, 0),
                isResolved: false
            }]
        }));
        snapshots.set(includeDocument.uri.toString(), createSnapshot(includeDocument, {
            exportedFunctions: [createFunction('include_helper', includeDocument.uri.toString(), 1)]
        }));
        snapshots.set(inheritDocument.uri.toString(), createSnapshot(inheritDocument, {
            exportedFunctions: [createFunction('inherited_helper', inheritDocument.uri.toString(), 2)]
        }));

        const { resolver } = createResolver(snapshots, tempRoot);
        const visible = await resolver.resolveVisibleSymbols(
            mainDocument,
            snapshots.get(mainDocument.uri.toString())!
        );

        expect(visible.hasUnresolvedDependencies).toBe(false);
        expect(visible.callableSignatures.map((signature) => signature.name)).toEqual(expect.arrayContaining([
            'include_helper',
            'inherited_helper',
            'write',
            'simul_log'
        ]));
        expect(visible.callableSignatures.find((signature) => signature.name === 'include_helper')).toMatchObject({
            requiredParameterCount: 1,
            maxParameterCount: 1
        });
        expect(visible.callableSignatures.find((signature) => signature.name === 'inherited_helper')).toMatchObject({
            requiredParameterCount: 2,
            maxParameterCount: 2
        });
        expect(visible.callableSignatures.find((signature) => signature.name === 'simul_log')).toMatchObject({
            requiredParameterCount: 1,
            isVariadic: true
        });
    });

    test('uses workspace project config when resolving inherited diagnostics dependencies', async () => {
        tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-basic-diagnostics-'));
        const mainPath = path.join(tempRoot, 'obj', 'room.c');
        const inheritedPath = path.join(tempRoot, 'mudlib', 'std', 'room.c');
        fs.mkdirSync(path.dirname(mainPath), { recursive: true });
        fs.mkdirSync(path.dirname(inheritedPath), { recursive: true });
        fs.writeFileSync(mainPath, '', 'utf8');
        fs.writeFileSync(inheritedPath, '', 'utf8');

        const mainDocument = createDocument(mainPath);
        const inheritedDocument = createDocument(inheritedPath);
        const snapshots = new Map<string, SemanticSnapshot>();
        snapshots.set(mainDocument.uri.toString(), createSnapshot(mainDocument, {
            inheritStatements: [{
                rawText: 'inherit "/std/room";',
                expressionKind: 'string',
                value: '/std/room',
                range: new vscode.Range(0, 0, 0, 0),
                isResolved: false
            }]
        }));
        snapshots.set(inheritedDocument.uri.toString(), createSnapshot(inheritedDocument, {
            exportedFunctions: [createFunction('inherited_helper', inheritedDocument.uri.toString(), 0)]
        }));
        const { resolver, pathSupport } = createResolver(snapshots, tempRoot);
        pathSupport.resolveInheritedFilePath = jest.fn((_document, _inheritValue, _workspaceRoot, projectConfig) =>
            path.join(tempRoot!, projectConfig?.resolvedConfig?.mudlibDirectory ?? '', 'std', 'room.c')
        );

        const visible = await resolver.resolveVisibleSymbols(mainDocument, snapshots.get(mainDocument.uri.toString())!, {
            workspaceRoot: tempRoot,
            projectConfig: {
                projectConfigPath: path.join(tempRoot, 'lpc-support.json'),
                configHellPath: 'config/config.dev',
                resolvedConfig: {
                    mudlibDirectory: 'mudlib'
                }
            }
        });

        expect(pathSupport.resolveInheritedFilePath).toHaveBeenCalledWith(
            mainDocument,
            '/std/room',
            tempRoot,
            expect.objectContaining({
                resolvedConfig: expect.objectContaining({
                    mudlibDirectory: 'mudlib'
                })
            })
        );
        expect(visible.callableSignatures.map((signature) => signature.name)).toContain('inherited_helper');
    });

    test('uses explicit callable arity for efun diagnostics', async () => {
        tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-basic-diagnostics-'));
        const mainPath = path.join(tempRoot, 'room.c');
        fs.writeFileSync(mainPath, '', 'utf8');
        const mainDocument = createDocument(mainPath);
        const mainSnapshot = createSnapshot(mainDocument);
        const { resolver } = createResolver(new Map([[mainDocument.uri.toString(), mainSnapshot]]), tempRoot);
        (resolver as any).options.efunDocsManager = {
            getAllFunctions: () => ['member_array'],
            getAllSimulatedFunctions: () => [],
            getStandardCallableDoc: (name: string) => name === 'member_array'
                ? {
                    name,
                    declarationKey: 'efun:member_array',
                    signatures: [{
                        label: 'int member_array(mixed item, string | mixed *arr, void | int start, void | int)',
                        arity: {
                            min: 2,
                            max: 4
                        },
                        parameters: [
                            { name: 'item', type: 'mixed' },
                            { name: 'arr', type: 'string | mixed *' },
                            { name: 'start', type: 'void | int' },
                            { name: 'int', type: 'void |' }
                        ],
                        isVariadic: false
                    }],
                    sourceKind: 'efun'
                }
                : undefined,
            getSimulatedDoc: () => undefined
        };

        const visible = await resolver.resolveVisibleSymbols(mainDocument, mainSnapshot);

        expect(visible.callableSignatures.find((signature) => signature.name === 'member_array')).toMatchObject({
            requiredParameterCount: 2,
            maxParameterCount: 4
        });
    });

    test('keeps simul-efun docs without signatures visible as unknown-arity callables', async () => {
        tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-basic-diagnostics-'));
        const mainPath = path.join(tempRoot, 'room.c');
        fs.writeFileSync(mainPath, '', 'utf8');
        const mainDocument = createDocument(mainPath);
        const mainSnapshot = createSnapshot(mainDocument);
        const { resolver } = createResolver(new Map([[mainDocument.uri.toString(), mainSnapshot]]), tempRoot);
        (resolver as any).options.efunDocsManager = {
            getAllFunctions: () => [],
            getAllSimulatedFunctions: () => ['new_bind'],
            getStandardCallableDoc: () => undefined,
            getSimulatedDoc: (name: string) => name === 'new_bind'
                ? {
                    name,
                    declarationKey: 'simul:new_bind',
                    signatures: [],
                    sourceKind: 'simulEfun'
                }
                : undefined
        };

        const visible = await resolver.resolveVisibleSymbols(mainDocument, mainSnapshot);

        expect(visible.callableSignatures.find((signature) => signature.name === 'new_bind')).toMatchObject({
            requiredParameterCount: 0,
            maxParameterCount: undefined,
            isVariadic: true,
            source: 'simul-efun'
        });
    });

    test('waits for simulated efun workspace state before collecting callable signatures', async () => {
        tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-basic-diagnostics-'));
        const mainPath = path.join(tempRoot, 'room.c');
        fs.writeFileSync(mainPath, '', 'utf8');
        const mainDocument = createDocument(mainPath);
        const mainSnapshot = createSnapshot(mainDocument);
        const { resolver } = createResolver(new Map([[mainDocument.uri.toString(), mainSnapshot]]), tempRoot);
        let loaded = false;
        const ensureWorkspaceStateCurrent = jest.fn(async () => {
            loaded = true;
        });
        (resolver as any).options.efunDocsManager = {
            ensureWorkspaceStateCurrent,
            getAllFunctions: () => [],
            getAllSimulatedFunctions: jest.fn(() => loaded ? ['new_bind', 'chinese_number'] : []),
            getStandardCallableDoc: () => undefined,
            getSimulatedDoc: jest.fn((name: string) => ({
                name,
                declarationKey: `simul:${name}`,
                signatures: [{
                    label: name === 'new_bind'
                        ? 'object new_bind(string path)'
                        : 'string chinese_number(int i)',
                    parameters: [{
                        name: name === 'new_bind' ? 'path' : 'i',
                        type: name === 'new_bind' ? 'string' : 'int'
                    }],
                    isVariadic: false
                }],
                sourceKind: 'simulEfun'
            }))
        };

        const visible = await resolver.resolveVisibleSymbols(mainDocument, mainSnapshot);

        expect(ensureWorkspaceStateCurrent).toHaveBeenCalledWith(mainDocument);
        expect((resolver as any).options.efunDocsManager.getAllSimulatedFunctions)
            .toHaveBeenCalledWith(mainDocument);
        expect((resolver as any).options.efunDocsManager.getSimulatedDoc)
            .toHaveBeenCalledWith('new_bind', mainDocument);
        expect((resolver as any).options.efunDocsManager.getSimulatedDoc)
            .toHaveBeenCalledWith('chinese_number', mainDocument);
        expect(visible.callableSignatures.map((signature) => signature.name)).toEqual(expect.arrayContaining([
            'new_bind',
            'chinese_number'
        ]));
    });

    test('adds macros from the unique owner translation unit before a header include', async () => {
        tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-header-owner-'));
        const ownerPath = path.join(tempRoot, 'adm', 'daemons', 'combatd.c');
        const headerPath = path.join(tempRoot, 'adm', 'daemons', 'combat', 'combat_other_power.h');
        fs.mkdirSync(path.dirname(ownerPath), { recursive: true });
        fs.mkdirSync(path.dirname(headerPath), { recursive: true });
        fs.writeFileSync(ownerPath, [
            '#define AOYI_D "/adm/daemons/aoyid"',
            '#include "/adm/daemons/combat/combat_other_power.h"'
        ].join('\n'), 'utf8');
        fs.writeFileSync(headerPath, 'void demo() { AOYI_D->query_family_aoyi_name("x"); }\n', 'utf8');

        const headerDocument = createDocument(headerPath, fs.readFileSync(headerPath, 'utf8'));
        const headerSnapshot = createSnapshot(headerDocument);
        const { resolver, pathSupport, analysisService } = createResolver(new Map([[headerDocument.uri.toString(), headerSnapshot]]), tempRoot);
        (resolver as any).options.headerOwnerContextResolver = new HeaderOwnerContextService(pathSupport as any, analysisService);

        const visible = await resolver.resolveVisibleSymbols(headerDocument, headerSnapshot);

        expect(visible.hasUnresolvedDependencies).toBe(false);
        expect(visible.macros.find((macro) => macro.name === 'AOYI_D')).toMatchObject({
            value: '"/adm/daemons/aoyid"'
        });
    });

    test('does not cache owner prefix analysis as the real owner document snapshot', async () => {
        tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-header-owner-cache-'));
        const ownerPath = path.join(tempRoot, 'adm', 'daemons', 'combatd.c');
        const headerPath = path.join(tempRoot, 'adm', 'daemons', 'combat', 'combat_do_attack.h');
        fs.mkdirSync(path.dirname(ownerPath), { recursive: true });
        fs.mkdirSync(path.dirname(headerPath), { recursive: true });
        const ownerText = [
            '#define AOYI_D "/adm/daemons/aoyid"',
            '#include "/adm/daemons/combat/combat_do_attack.h"',
            'int owner_after_header() { return 1; }'
        ].join('\n');
        fs.writeFileSync(ownerPath, ownerText, 'utf8');
        fs.writeFileSync(headerPath, 'void demo() { AOYI_D->query_family_aoyi_name("x"); }\n', 'utf8');

        const headerDocument = createDocument(headerPath, fs.readFileSync(headerPath, 'utf8'));
        const ownerDocument = createDocument(ownerPath, ownerText);
        const analysisService = DocumentSemanticSnapshotService.getInstance();
        const { pathSupport } = createResolver(new Map(), tempRoot);
        const service = new HeaderOwnerContextService(pathSupport as any, analysisService);

        const context = await service.resolveOwnerContext(headerDocument);
        const ownerSnapshot = analysisService.getBestAvailableSemanticSnapshot(ownerDocument);

        expect(context.isAmbiguous).toBe(false);
        expect(ownerSnapshot.uri).toBe(ownerDocument.uri.toString());
        expect(ownerSnapshot.exportedFunctions.map((func) => func.name)).toContain('owner_after_header');
        service.dispose();
    });

    test('does not expose owner macros defined after the header include', async () => {
        tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-header-owner-'));
        const ownerPath = path.join(tempRoot, 'adm', 'daemons', 'combatd.c');
        const headerPath = path.join(tempRoot, 'adm', 'daemons', 'combat', 'combat_other_power.h');
        fs.mkdirSync(path.dirname(ownerPath), { recursive: true });
        fs.mkdirSync(path.dirname(headerPath), { recursive: true });
        fs.writeFileSync(ownerPath, [
            '#include "/adm/daemons/combat/combat_other_power.h"',
            '#define AOYI_D "/adm/daemons/aoyid"'
        ].join('\n'), 'utf8');
        fs.writeFileSync(headerPath, 'void demo() { AOYI_D->query_family_aoyi_name("x"); }\n', 'utf8');

        const headerDocument = createDocument(headerPath, fs.readFileSync(headerPath, 'utf8'));
        const headerSnapshot = createSnapshot(headerDocument);
        const { resolver, pathSupport, analysisService } = createResolver(new Map([[headerDocument.uri.toString(), headerSnapshot]]), tempRoot);
        (resolver as any).options.headerOwnerContextResolver = new HeaderOwnerContextService(pathSupport as any, analysisService);

        const visible = await resolver.resolveVisibleSymbols(headerDocument, headerSnapshot);

        expect(visible.hasUnresolvedDependencies).toBe(false);
        expect(visible.macros.some((macro) => macro.name === 'AOYI_D')).toBe(false);
    });

    test('keeps duplicate includes in the same owner translation unit unambiguous', async () => {
        tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-header-owner-'));
        const ownerPath = path.join(tempRoot, 'adm', 'daemons', 'combatd.c');
        const headerPath = path.join(tempRoot, 'adm', 'daemons', 'combat', 'combat_other_power.h');
        fs.mkdirSync(path.dirname(ownerPath), { recursive: true });
        fs.mkdirSync(path.dirname(headerPath), { recursive: true });
        fs.writeFileSync(ownerPath, [
            '#define AOYI_D "/adm/daemons/aoyid"',
            '#include "/adm/daemons/combat/combat_other_power.h"',
            '#include "/adm/daemons/combat/combat_other_power.h"'
        ].join('\n'), 'utf8');
        fs.writeFileSync(headerPath, 'void demo() { AOYI_D->query_family_aoyi_name("x"); }\n', 'utf8');

        const headerDocument = createDocument(headerPath, fs.readFileSync(headerPath, 'utf8'));
        const headerSnapshot = createSnapshot(headerDocument);
        const { resolver, pathSupport, analysisService } = createResolver(new Map([[headerDocument.uri.toString(), headerSnapshot]]), tempRoot);
        (resolver as any).options.headerOwnerContextResolver = new HeaderOwnerContextService(pathSupport as any, analysisService);

        const visible = await resolver.resolveVisibleSymbols(headerDocument, headerSnapshot);

        expect(visible.hasUnresolvedDependencies).toBe(false);
        expect(visible.macros.find((macro) => macro.name === 'AOYI_D')).toMatchObject({
            value: '"/adm/daemons/aoyid"'
        });
    });

    test('invalidates cached header owner index when an owner document changes', async () => {
        const originalOnDidChangeTextDocument = (vscode.workspace as any).onDidChangeTextDocument;
        const originalOnDidSaveTextDocument = (vscode.workspace as any).onDidSaveTextDocument;
        const originalCreateFileSystemWatcher = (vscode.workspace as any).createFileSystemWatcher;
        let changeListener: ((event: { document: vscode.TextDocument }) => void) | undefined;
        (vscode.workspace as any).onDidChangeTextDocument = jest.fn((listener: (event: { document: vscode.TextDocument }) => void) => {
            changeListener = listener;
            return { dispose: jest.fn() };
        });
        (vscode.workspace as any).onDidSaveTextDocument = undefined;
        (vscode.workspace as any).createFileSystemWatcher = undefined;

        try {
            tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-header-owner-'));
            const ownerPath = path.join(tempRoot, 'adm', 'daemons', 'combatd.c');
            const firstHeaderPath = path.join(tempRoot, 'adm', 'daemons', 'combat', 'first.h');
            const secondHeaderPath = path.join(tempRoot, 'adm', 'daemons', 'combat', 'second.h');
            fs.mkdirSync(path.dirname(ownerPath), { recursive: true });
            fs.mkdirSync(path.dirname(firstHeaderPath), { recursive: true });
            fs.writeFileSync(ownerPath, [
                '#define AOYI_D "/adm/daemons/aoyid"',
                '#include "/adm/daemons/combat/first.h"'
            ].join('\n'), 'utf8');
            fs.writeFileSync(firstHeaderPath, 'void demo() { AOYI_D->query_family_aoyi_name("x"); }\n', 'utf8');
            fs.writeFileSync(secondHeaderPath, 'void demo() { AOYI_D->query_family_aoyi_name("x"); }\n', 'utf8');

            const firstHeaderDocument = createDocument(firstHeaderPath, fs.readFileSync(firstHeaderPath, 'utf8'));
            const secondHeaderDocument = createDocument(secondHeaderPath, fs.readFileSync(secondHeaderPath, 'utf8'));
            const { pathSupport, analysisService } = createResolver(new Map(), tempRoot);
            const service = new HeaderOwnerContextService(pathSupport as any, analysisService);

            const firstContext = await service.resolveOwnerContext(firstHeaderDocument);
            expect(firstContext.isAmbiguous).toBe(false);

            const updatedOwnerText = [
                '#define AOYI_D "/adm/daemons/aoyid"',
                '#include "/adm/daemons/combat/second.h"'
            ].join('\n');
            fs.writeFileSync(ownerPath, updatedOwnerText, 'utf8');
            changeListener?.({ document: createDocument(ownerPath, updatedOwnerText) });

            const secondContext = await service.resolveOwnerContext(secondHeaderDocument);

            expect(secondContext.isAmbiguous).toBe(false);
            expect(secondContext.macros.find((macro) => macro.name === 'AOYI_D')).toMatchObject({
                value: '"/adm/daemons/aoyid"'
            });
            service.dispose();
        } finally {
            (vscode.workspace as any).onDidChangeTextDocument = originalOnDidChangeTextDocument;
            (vscode.workspace as any).onDidSaveTextDocument = originalOnDidSaveTextDocument;
            (vscode.workspace as any).createFileSystemWatcher = originalCreateFileSystemWatcher;
        }
    });

    test('adds functions and globals from owner prefix includes before a header include', async () => {
        tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-header-owner-'));
        const ownerPath = path.join(tempRoot, 'adm', 'daemons', 'combatd.c');
        const statusPath = path.join(tempRoot, 'adm', 'daemons', 'combat', 'combat_status_msg.h');
        const powerPath = path.join(tempRoot, 'adm', 'daemons', 'combat', 'combat_attack_power.h');
        const headerPath = path.join(tempRoot, 'adm', 'daemons', 'combat', 'combat_do_attack.h');
        fs.mkdirSync(path.dirname(ownerPath), { recursive: true });
        fs.mkdirSync(path.dirname(headerPath), { recursive: true });
        fs.writeFileSync(ownerPath, [
            'int apply_family_aoyi_damage_bonus(object me, string martial_skill, int damage);',
            '#include "/adm/daemons/combat/combat_status_msg.h"',
            '#include "/adm/daemons/combat/combat_attack_power.h"',
            '#include "/adm/daemons/combat/combat_do_attack.h"'
        ].join('\n'), 'utf8');
        fs.writeFileSync(statusPath, [
            'string *winner_msg = ({});',
            'string eff_status_msg(int ratio) { return ""; }'
        ].join('\n'), 'utf8');
        fs.writeFileSync(powerPath, 'int calculate_hit_power(object me) { return 1; }\n', 'utf8');
        fs.writeFileSync(headerPath, [
            'void demo(object me) {',
            '    calculate_hit_power(me);',
            '    eff_status_msg(50);',
            '    winner_msg[random(sizeof(winner_msg))];',
            '    apply_family_aoyi_damage_bonus(me, "x", 1);',
            '}'
        ].join('\n'), 'utf8');

        const headerDocument = createDocument(headerPath, fs.readFileSync(headerPath, 'utf8'));
        const headerSnapshot = createSnapshot(headerDocument);
        const snapshots = new Map([[headerDocument.uri.toString(), headerSnapshot]]);
        const { resolver, pathSupport, analysisService } = createResolver(snapshots, tempRoot);
        (resolver as any).options.headerOwnerContextResolver = new HeaderOwnerContextService(pathSupport as any, analysisService);

        const visible = await resolver.resolveVisibleSymbols(headerDocument, headerSnapshot);

        expect(visible.hasUnresolvedDependencies).toBe(false);
        expect(visible.callableSignatures.map((signature) => signature.name)).toEqual(expect.arrayContaining([
            'calculate_hit_power',
            'eff_status_msg',
            'apply_family_aoyi_damage_bonus'
        ]));
        expect(visible.fileGlobals.map((global) => global.name)).toContain('winner_msg');
    });

    test('marks header owner context ambiguous when multiple translation units include the same header', async () => {
        tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-header-owner-'));
        const ownerAPath = path.join(tempRoot, 'adm', 'daemons', 'combatd.c');
        const ownerBPath = path.join(tempRoot, 'adm', 'daemons', 'otherd.c');
        const headerPath = path.join(tempRoot, 'adm', 'daemons', 'combat', 'combat_other_power.h');
        fs.mkdirSync(path.dirname(ownerAPath), { recursive: true });
        fs.mkdirSync(path.dirname(headerPath), { recursive: true });
        fs.writeFileSync(ownerAPath, '#include "/adm/daemons/combat/combat_other_power.h"\n', 'utf8');
        fs.writeFileSync(ownerBPath, '#include "/adm/daemons/combat/combat_other_power.h"\n', 'utf8');
        fs.writeFileSync(headerPath, 'void demo() { AOYI_D->query_family_aoyi_name("x"); }\n', 'utf8');

        const headerDocument = createDocument(headerPath, fs.readFileSync(headerPath, 'utf8'));
        const headerSnapshot = createSnapshot(headerDocument);
        const { resolver, pathSupport, analysisService } = createResolver(new Map([[headerDocument.uri.toString(), headerSnapshot]]), tempRoot);
        (resolver as any).options.headerOwnerContextResolver = new HeaderOwnerContextService(pathSupport as any, analysisService);

        const visible = await resolver.resolveVisibleSymbols(headerDocument, headerSnapshot);

        expect(visible.hasUnresolvedDependencies).toBe(true);
        expect(visible.macros.some((macro) => macro.name === 'AOYI_D')).toBe(false);
    });

    test('marks unresolved include dependencies so undefined diagnostics can stay quiet', async () => {
        tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-basic-diagnostics-'));
        const mainPath = path.join(tempRoot, 'room.c');
        fs.writeFileSync(mainPath, '', 'utf8');
        const mainDocument = createDocument(mainPath);
        const mainSnapshot = createSnapshot(mainDocument, {
            includeStatements: [{
                rawText: '#include "/include/missing.h"',
                value: '/include/missing.h',
                range: new vscode.Range(0, 0, 0, 0),
                isSystemInclude: false
            }]
        });
        const { resolver } = createResolver(new Map([[mainDocument.uri.toString(), mainSnapshot]]), tempRoot);

        const visible = await resolver.resolveVisibleSymbols(mainDocument, mainSnapshot);

        expect(visible.hasUnresolvedDependencies).toBe(true);
    });
});
