import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ASTManager } from '../ast/astManager';
import { DiagnosticsOrchestrator } from '../diagnostics/DiagnosticsOrchestrator';
import { createSharedDiagnosticsService } from '../language/services/diagnostics/createSharedDiagnosticsService';
import { createDefaultQueryBackedLanguageCompletionService } from '../language/services/completion/LanguageCompletionService';
import { CallableDocRenderer } from '../language/documentation/CallableDocRenderer';
import {
    createDefaultScopedMethodCompletionSupport
} from '../language/services/completion/ScopedMethodCompletionSupport';
import {
    FunctionDocumentationService,
    createDefaultFunctionDocumentationService
} from '../language/documentation/FunctionDocumentationService';
import {
    WorkspaceDocumentPathSupport,
    createVsCodeTextDocumentHost
} from '../language/shared/WorkspaceDocumentPathSupport';
import { createDefaultSemanticEvaluationService } from '../semanticEvaluation/SemanticEvaluationService';
import { AstBackedLanguageDefinitionService } from '../language/services/navigation/LanguageDefinitionService';
import { DefaultLanguageSemanticTokensService } from '../language/services/structure/LanguageSemanticTokensService';
import {
    ObjectInferenceService,
    createDefaultObjectInferenceService
} from '../objectInference/ObjectInferenceService';
import {
    ScopedMethodResolver,
    createDefaultScopedMethodResolver
} from '../objectInference/ScopedMethodResolver';
import { createDefaultScopedMethodDiscoveryService } from '../objectInference/ScopedMethodDiscoveryService';
import { DocumentSemanticSnapshotService } from '../semantic/documentSemanticSnapshotService';
import { TargetMethodLookup } from '../targetMethodLookup';
import { CompletionInstrumentation } from '../completion/completionInstrumentation';
import { CompletionContextAnalyzer } from '../completion/completionContextAnalyzer';
import { InheritanceResolver } from '../completion/inheritanceResolver';
import { ProjectSymbolIndex } from '../completion/projectSymbolIndex';
import {
    configureAstManagerSingletonForTests,
    getAstManagerForTests,
    resetAstManagerSingletonForTests
} from './testAstManagerSingleton';

function createDocument(fileName: string, content: string, version = 1): vscode.TextDocument {
    const lines = content.split(/\r?\n/);
    const lineStarts = [0];

    for (let index = 0; index < content.length; index += 1) {
        if (content[index] === '\n') {
            lineStarts.push(index + 1);
        }
    }

    const offsetAt = (position: vscode.Position): number => {
        const lineStart = lineStarts[position.line] ?? content.length;
        return Math.min(lineStart + position.character, content.length);
    };

    return {
        uri: vscode.Uri.file(fileName),
        fileName,
        languageId: 'lpc',
        version,
        lineCount: lines.length,
        getText: jest.fn((range?: vscode.Range) => {
            if (!range) {
                return content;
            }

            return content.slice(offsetAt(range.start), offsetAt(range.end));
        }),
        lineAt: jest.fn((lineOrPosition: number | vscode.Position) => {
            const line = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
            return { text: lines[line] ?? '' };
        }),
        positionAt: jest.fn((offset: number) => {
            let line = 0;
            for (let index = 0; index < lineStarts.length; index += 1) {
                if (lineStarts[index] <= offset) {
                    line = index;
                } else {
                    break;
                }
            }

            return new vscode.Position(line, offset - lineStarts[line]);
        }),
        offsetAt: jest.fn((position: vscode.Position) => offsetAt(position)),
        getWordRangeAtPosition: jest.fn((position: vscode.Position) => {
            const lineText = lines[position.line] ?? '';
            const isWordCharacter = (char: string | undefined) => Boolean(char && /[A-Za-z0-9_]/.test(char));

            let start = position.character;
            while (start > 0 && isWordCharacter(lineText[start - 1])) {
                start -= 1;
            }

            let end = position.character;
            while (end < lineText.length && isWordCharacter(lineText[end])) {
                end += 1;
            }

            if (start === end) {
                return undefined;
            }

            return new vscode.Range(position.line, start, position.line, end);
        })
    } as unknown as vscode.TextDocument;
}

function createLanguageContext(
    document: vscode.TextDocument,
    workspaceRoot: string,
    projectConfig?: unknown
) {
    return {
        document,
        workspace: {
            workspaceRoot,
            ...(projectConfig ? { projectConfig } : {})
        },
        mode: 'lsp' as const,
        cancellation: {
            isCancellationRequested: false
        }
    };
}

async function provideDefinition(
    service: AstBackedLanguageDefinitionService,
    document: vscode.TextDocument,
    position: vscode.Position,
    workspaceRoot: string,
    projectConfig?: unknown
) {
    return service.provideDefinition({
        context: createLanguageContext(document, workspaceRoot, projectConfig),
        position: {
            line: position.line,
            character: position.character
        }
    });
}

function positionAtSubstring(document: vscode.TextDocument, source: string, substring: string): vscode.Position {
    const start = source.indexOf(substring);
    if (start === -1) {
        throw new Error(`Substring not found: ${substring}`);
    }

    return document.positionAt(start + 1);
}

function positionAtSubstringEnd(document: vscode.TextDocument, source: string, substring: string): vscode.Position {
    const start = source.indexOf(substring);
    if (start === -1) {
        throw new Error(`Substring not found: ${substring}`);
    }

    return document.positionAt(start + substring.length);
}

function normalizeLocationUri(uri: string): string {
    if (uri.startsWith('file:///')) {
        return uri
            .replace(/^file:\/\/\//, '')
            .replace(/^\/([A-Za-z]:)/, '$1')
            .replace(/\//g, path.sep);
    }

    return uri.replace(/^[/\\]+/, '').replace(/\//g, path.sep);
}

function installWorkspaceOpenTextDocumentFixture(): void {
    (vscode.workspace.openTextDocument as jest.Mock).mockImplementation(async (target: string | vscode.Uri) => {
        const filePath = typeof target === 'string' ? target : target.fsPath;
        const normalizedPath = filePath
            .replace(/^[/\\]+([A-Za-z]:[\\/])/, '$1')
            .replace(/\//g, path.sep);
        return createDocument(normalizedPath, fs.readFileSync(normalizedPath, 'utf8'));
    });
}

describe('language-service integration regression', () => {
    const efunDocsManager = {
        getAllFunctions: jest.fn(() => ['write']),
        getStandardDoc: jest.fn(() => undefined),
        getAllSimulatedFunctions: jest.fn(() => []),
        getSimulatedDoc: jest.fn(() => undefined)
    };
    const macroManager = {
        getMacro: jest.fn(),
        getAllMacros: jest.fn(() => []),
        getMacroHoverContent: jest.fn(),
        scanMacros: jest.fn(),
        getIncludePath: jest.fn(() => undefined),
        canResolveMacro: jest.fn(() => false)
    };

    let fixtureRoot: string;
    let analysisService: DocumentSemanticSnapshotService;
    let documentationService: FunctionDocumentationService;
    let documentHost: ReturnType<typeof createVsCodeTextDocumentHost>;
    let pathSupport: WorkspaceDocumentPathSupport;

    const createObjectInference = (projectConfig?: unknown) => {
        const semanticEvaluationService = createDefaultSemanticEvaluationService({
            analysisService,
            pathSupport,
            projectConfigService: projectConfig as any
        });

        return createDefaultObjectInferenceService({
            macroManager: macroManager as any,
            analysisService,
            documentationService,
            host: documentHost,
            pathSupport,
            semanticEvaluationService
        });
    };

    const createCompletionService = (
        objectInferenceService?: ObjectInferenceService,
        dependencies: Record<string, unknown> = {}
    ) => createDefaultQueryBackedLanguageCompletionService({
        efunDocsManager: efunDocsManager as any,
        macroManager: macroManager as any,
        analysisService,
        documentationService,
        objectInferenceService: objectInferenceService ?? createObjectInference(),
        instrumentation: new CompletionInstrumentation(),
        inheritanceReporter: {
            clear: jest.fn(),
            show: jest.fn(),
            appendLine: jest.fn()
        } as any,
        projectSymbolIndex: new ProjectSymbolIndex(new InheritanceResolver(macroManager as any, [fixtureRoot])),
        contextAnalyzer: new CompletionContextAnalyzer(),
        scopedMethodDiscoveryService: createDefaultScopedMethodDiscoveryService({
            macroManager: macroManager as any,
            workspaceRoots: [fixtureRoot],
            analysisService,
            host: documentHost
        }),
        scopedCompletionSupport: createDefaultScopedMethodCompletionSupport({
            documentationService,
            documentHost,
            renderer: new CallableDocRenderer()
        }),
        ...dependencies
    } as any);
    const createScopedMethodResolver = () =>
        createDefaultScopedMethodResolver({
            macroManager: macroManager as any,
            workspaceRoots: [fixtureRoot],
            analysisService,
            host: documentHost
        });
    const createDefinitionService = (
        objectInferenceService?: unknown,
        targetMethodLookup?: unknown,
        projectConfigService?: unknown,
        hostOrDependencies: Record<string, unknown> = {}
    ) => {
        const resolvedDependencies = 'onDidChangeTextDocument' in hostOrDependencies
            ? {
                host: hostOrDependencies,
                analysisService
            }
            : {
                analysisService,
                host: {
                    onDidChangeTextDocument: jest.fn().mockReturnValue({ dispose: jest.fn() }),
                    openTextDocument: vscode.workspace.openTextDocument as any,
                    findFiles: jest.fn(),
                    getWorkspaceFolder: jest.fn((uri?: { fsPath?: string }) =>
                        uri?.fsPath ? { uri: { fsPath: fixtureRoot } } : undefined
                    ),
                    getWorkspaceFolders: jest.fn(() => [{ uri: { fsPath: fixtureRoot } }]),
                    fileExists: jest.fn((filePath: string) => fs.existsSync(filePath))
                },
                ...hostOrDependencies
            };
        const resolvedPathSupport = new WorkspaceDocumentPathSupport({
            host: resolvedDependencies.host as any,
            macroManager: macroManager as any,
            projectConfigService: projectConfigService as any
        });
        const resolvedObjectInferenceService = objectInferenceService
            ?? createObjectInference(projectConfigService);
        const resolvedTargetMethodLookup = targetMethodLookup
            ?? new TargetMethodLookup(analysisService, resolvedPathSupport);

        return new AstBackedLanguageDefinitionService(
            macroManager as any,
            efunDocsManager as any,
            resolvedObjectInferenceService as any,
            resolvedTargetMethodLookup as any,
            projectConfigService as any,
            {
                ...resolvedDependencies,
                pathSupport: resolvedPathSupport
            } as any
        );
    };

    beforeEach(() => {
        jest.clearAllMocks();
        macroManager.getMacro.mockReset();
        macroManager.getMacro.mockReturnValue(undefined);
        macroManager.getAllMacros.mockReset();
        macroManager.getAllMacros.mockReturnValue([]);
        macroManager.getMacroHoverContent.mockReset();
        macroManager.scanMacros.mockReset();
        macroManager.getIncludePath.mockReset();
        macroManager.getIncludePath.mockReturnValue(undefined);
        macroManager.canResolveMacro.mockReset();
        macroManager.canResolveMacro.mockResolvedValue(false);
        efunDocsManager.getAllFunctions.mockReset();
        efunDocsManager.getAllFunctions.mockReturnValue(['write']);
        efunDocsManager.getStandardDoc.mockReset();
        efunDocsManager.getStandardDoc.mockReturnValue(undefined);
        efunDocsManager.getAllSimulatedFunctions.mockReset();
        efunDocsManager.getAllSimulatedFunctions.mockReturnValue([]);
        efunDocsManager.getSimulatedDoc.mockReset();
        efunDocsManager.getSimulatedDoc.mockReturnValue(undefined);
        analysisService = DocumentSemanticSnapshotService.getInstance();
        documentationService = createDefaultFunctionDocumentationService();
        documentHost = createVsCodeTextDocumentHost();
        pathSupport = new WorkspaceDocumentPathSupport({
            host: documentHost,
            macroManager: macroManager as any
        });
        configureAstManagerSingletonForTests(analysisService);
        fixtureRoot = path.join(process.cwd(), '.tmp-provider-integration');
        fs.rmSync(fixtureRoot, { recursive: true, force: true });
        fs.mkdirSync(path.join(fixtureRoot, 'lib'), { recursive: true });
        (vscode.workspace.getWorkspaceFolder as jest.Mock).mockReturnValue({
            uri: { fsPath: fixtureRoot }
        });
        (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: fixtureRoot } }];
        (vscode.workspace as any).onDidDeleteFiles = jest.fn().mockReturnValue({ dispose: jest.fn() });
    });

    afterEach(() => {
        resetAstManagerSingletonForTests();
        jest.restoreAllMocks();
        fs.rmSync(fixtureRoot, { recursive: true, force: true });
    });

    test('completion requests stay on semantic snapshots instead of any secondary parse facade', async () => {
        const service = createCompletionService();
        const document = createDocument(
            path.join(fixtureRoot, 'completion.c'),
            [
                'int local_call(string message) {',
                '    return 1;',
                '}',
                '',
                'local_call();'
            ].join('\n')
        );

        const result = await service.provideCompletion({
            context: createLanguageContext(document, fixtureRoot),
            position: {
                line: 4,
                character: 'loca'.length
            },
            triggerKind: vscode.CompletionTriggerKind.Invoke
        });

        expect(result.items.map((item) => item.label)).toContain('local_call');
    });

    test('target method lookup keeps full function declaration range for documentation keys', async () => {
        installWorkspaceOpenTextDocumentFixture();
        const targetFile = path.join(fixtureRoot, 'lib', 'npc.c');
        fs.writeFileSync(
            targetFile,
            [
                '/**',
                ' * @brief target query',
                ' */',
                'string query_name(int mode)',
                '{',
                '    return "npc";',
                '}'
            ].join('\n'),
            'utf8'
        );
        const document = createDocument(path.join(fixtureRoot, 'room.c'), 'void test() {}');
        const lookup = new TargetMethodLookup(analysisService, pathSupport);

        const result = await lookup.findMethod(document, targetFile, 'query_name');

        expect(result?.declarationRange).toEqual(new vscode.Range(3, 0, 6, 1));
        expect(result?.location.range).toEqual(new vscode.Range(3, 7, 3, 17));
    });

    test('completion resolves file-scope global object receivers through inferred target files', async () => {
        const targetFile = path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c');
        fs.mkdirSync(path.dirname(targetFile), { recursive: true });
        fs.writeFileSync(
            targetFile,
            [
                'string query_name(int mode, int flags) {',
                '    return "combat-d";',
                '}'
            ].join('\n')
        );

        const source = [
            'object COMBAT_D = load_object("/adm/daemons/combat_d");',
            '',
            'void demo() {',
            '    COMBAT_D->qu',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'global-object-completion.c'), source);
        const objectInferenceService = createObjectInference();
        const inferObjectAccess = jest.spyOn(objectInferenceService, 'inferObjectAccess');
        const service = createCompletionService(objectInferenceService as any);

        const result = await service.provideCompletion({
            context: createLanguageContext(document, fixtureRoot),
            position: positionAtSubstringEnd(document, source, 'COMBAT_D->qu'),
            triggerKind: vscode.CompletionTriggerKind.Invoke
        });

        expect(result.items.map((item) => item.label)).toContain('query_name');
        expect(result.items).toHaveLength(1);
        expect(result.items.find((item) => item.label === 'query_name')?.kind).toBe('method');
        expect(result.items[0].detail).toBe('string query_name');
        expect(inferObjectAccess).toHaveBeenCalledWith(document, expect.any(vscode.Position));
    });

    test('completion resolves inherited file-scope global object receivers through inferred target files', async () => {
        const targetFile = path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c');
        fs.mkdirSync(path.dirname(targetFile), { recursive: true });
        fs.writeFileSync(
            targetFile,
            [
                'string query_name(int mode, int flags) {',
                '    return "combat-d";',
                '}'
            ].join('\n')
        );
        fs.mkdirSync(path.join(fixtureRoot, 'std'), { recursive: true });
        fs.writeFileSync(
            path.join(fixtureRoot, 'std', 'room.c'),
            'object COMBAT_D = load_object("/adm/daemons/combat_d");\n'
        );

        const source = [
            'inherit "/std/room";',
            '',
            'void demo() {',
            '    COMBAT_D->qu',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'inherited-global-completion.c'), source);
        const objectInferenceService = createObjectInference();
        const inferObjectAccess = jest.spyOn(objectInferenceService, 'inferObjectAccess');
        (vscode.workspace.openTextDocument as jest.Mock).mockImplementation(async (target: string | vscode.Uri) => {
            const filePath = typeof target === 'string' ? target : target.fsPath;
            const normalizedPath = filePath
                .replace(/^[/\\]+([A-Za-z]:[\\/])/, '$1')
                .replace(/\//g, path.sep);
            return createDocument(normalizedPath, fs.readFileSync(normalizedPath, 'utf8'));
        });
        const service = createCompletionService(objectInferenceService as any);

        const result = await service.provideCompletion({
            context: createLanguageContext(document, fixtureRoot),
            position: positionAtSubstringEnd(document, source, 'COMBAT_D->qu'),
            triggerKind: vscode.CompletionTriggerKind.Invoke
        });

        expect(result.items.map((item) => item.label)).toContain('query_name');
        expect(result.items).toHaveLength(1);
        expect(result.items.find((item) => item.label === 'query_name')?.kind).toBe('method');
        expect(result.items[0].detail).toBe('string query_name');
        expect(inferObjectAccess).toHaveBeenCalledWith(document, expect.any(vscode.Position));
    });

    test('scoped completion resolves bare ::create through scoped discovery instead of object inference', async () => {
        fs.mkdirSync(path.join(fixtureRoot, 'std'), { recursive: true });
        fs.writeFileSync(
            path.join(fixtureRoot, 'std', 'base_room.c'),
            [
                'object create() {',
                '    return 0;',
                '}'
            ].join('\n')
        );
        installWorkspaceOpenTextDocumentFixture();

        const source = [
            'inherit "/std/base_room";',
            '',
            'void demo() {',
            '    ::cr',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'bare-scoped-completion.c'), source);
        const service = createCompletionService();

        const result = await service.provideCompletion({
            context: createLanguageContext(document, fixtureRoot),
            position: positionAtSubstringEnd(document, source, '::cr'),
            triggerKind: vscode.CompletionTriggerKind.Invoke
        });

        expect(result.items.map((item) => item.label)).toContain('create');
        expect(result.items).toHaveLength(1);
        expect(result.items[0].detail).toBe('object create');
        expect(result.items[0].data?.candidate.metadata.sourceType).toBe('scoped-method');
        expect(result.items[0].data?.candidate.metadata.declarationKey).toBeDefined();
    });

    test('scoped completion resolves room::init from the uniquely matched direct inherit branch only', async () => {
        fs.mkdirSync(path.join(fixtureRoot, 'std'), { recursive: true });
        fs.writeFileSync(
            path.join(fixtureRoot, 'std', 'room.c'),
            [
                'void init() {',
                '}'
            ].join('\n')
        );
        fs.writeFileSync(
            path.join(fixtureRoot, 'std', 'combat.c'),
            [
                'void influence() {',
                '}'
            ].join('\n')
        );
        installWorkspaceOpenTextDocumentFixture();

        const source = [
            'inherit "/std/room";',
            'inherit "/std/combat";',
            '',
            'void demo() {',
            '    room::in',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'named-scoped-completion.c'), source);
        const service = createCompletionService();

        const result = await service.provideCompletion({
            context: createLanguageContext(document, fixtureRoot),
            position: positionAtSubstringEnd(document, source, 'room::in'),
            triggerKind: vscode.CompletionTriggerKind.Invoke
        });

        expect(result.items.map((item) => item.label)).toContain('init');
        expect(result.items.map((item) => item.label)).not.toContain('influence');
        expect(result.items).toHaveLength(1);
        expect(result.items[0].detail).toBe('void init');
    });

    test('scoped completion stays empty when named qualifier is ambiguous', async () => {
        fs.mkdirSync(path.join(fixtureRoot, 'std'), { recursive: true });
        fs.mkdirSync(path.join(fixtureRoot, 'domains'), { recursive: true });
        fs.writeFileSync(path.join(fixtureRoot, 'std', 'room.c'), 'void init() {}\n');
        fs.writeFileSync(path.join(fixtureRoot, 'domains', 'room.c'), 'void init() {}\n');
        installWorkspaceOpenTextDocumentFixture();

        const source = [
            'inherit "/std/room";',
            'inherit "/domains/room";',
            '',
            'void demo() {',
            '    room::in',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'ambiguous-scoped-completion.c'), source);
        const service = createCompletionService();

        const result = await service.provideCompletion({
            context: createLanguageContext(document, fixtureRoot),
            position: positionAtSubstringEnd(document, source, 'room::in'),
            triggerKind: vscode.CompletionTriggerKind.Invoke
        });

        expect(result.items).toHaveLength(0);
    });

    test('scoped completion stays empty when unresolved direct inherit leaves discovery incomplete', async () => {
        const source = [
            'inherit ROOM_BASE;',
            '',
            'void demo() {',
            '    room::in',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'unresolved-scoped-completion.c'), source);
        const service = createCompletionService();

        const result = await service.provideCompletion({
            context: createLanguageContext(document, fixtureRoot),
            position: positionAtSubstringEnd(document, source, 'room::in'),
            triggerKind: vscode.CompletionTriggerKind.Invoke
        });

        expect(result.items).toHaveLength(0);
    });

    test('definition resolves system include files from project config without consulting legacy includePath', async () => {
        const includeDir = path.join(fixtureRoot, 'include');
        const headerFile = path.join(includeDir, 'global.h');
        fs.mkdirSync(includeDir, { recursive: true });
        fs.writeFileSync(headerFile, '#define GLOBAL_HEADER 1\n');

        const projectConfigService = {
            getPrimaryIncludeDirectoryForWorkspace: jest.fn().mockResolvedValue(includeDir)
        };
        const host = {
            onDidChangeTextDocument: jest.fn(() => ({ dispose: jest.fn() })),
            openTextDocument: jest.fn(),
            findFiles: jest.fn(),
            getWorkspaceFolder: jest.fn(() => ({ uri: { fsPath: fixtureRoot } })),
            getWorkspaceFolders: jest.fn(() => [{ uri: { fsPath: fixtureRoot } }]),
            fileExists: jest.fn((targetPath: string) => fs.existsSync(targetPath))
        };

        const analysisService = DocumentSemanticSnapshotService.getInstance();
        const service = createDefinitionService(
            {
                inferObjectAccess: jest.fn().mockResolvedValue(undefined)
            },
            undefined,
            projectConfigService,
            {
                host,
                analysisService: {
                    getSyntaxDocument: analysisService.getSyntaxDocument.bind(analysisService),
                    getBestAvailableSnapshot: analysisService.getBestAvailableSnapshot.bind(analysisService),
                    getSemanticSnapshot: jest.fn().mockReturnValue({
                        includeStatements: [
                            {
                                value: 'global',
                                isSystemInclude: true,
                                range: new vscode.Range(0, 0, 0, 16)
                            }
                        ]
                    })
                }
            }
        );
        const source = 'include anything;\n';
        const document = createDocument(path.join(fixtureRoot, 'include-user.c'), source);

        const definition = await provideDefinition(
            service,
            document,
            new vscode.Position(0, 8),
            fixtureRoot
        );

        expect(definition).toHaveLength(1);
        expect(normalizeLocationUri(definition[0].uri)).toBe(headerFile);
        expect(projectConfigService.getPrimaryIncludeDirectoryForWorkspace).toHaveBeenCalledWith(fixtureRoot);
    });

    test('definition resolves simulated efuns from project config without consulting legacy simulatedEfunsPath scanning', async () => {
        const simulatedEfunFile = path.join(fixtureRoot, 'adm', 'single', 'simul_efun.c');
        fs.mkdirSync(path.dirname(simulatedEfunFile), { recursive: true });
        fs.writeFileSync(simulatedEfunFile, 'void write(string msg) {\n}\n');

        efunDocsManager.getSimulatedDoc.mockImplementation((name: string) => (
            name === 'write' ? { name: 'write' } : undefined
        ));

        const projectConfigService = {
            getSimulatedEfunFileForWorkspace: jest.fn().mockResolvedValue(simulatedEfunFile)
        };
        const host = {
            onDidChangeTextDocument: jest.fn(() => ({ dispose: jest.fn() })),
            openTextDocument: jest.fn(async (target: string | vscode.Uri) => {
                const filePath = typeof target === 'string' ? target : target.fsPath;
                return createDocument(filePath, fs.readFileSync(filePath, 'utf8'));
            }),
            findFiles: jest.fn(),
            getWorkspaceFolder: jest.fn(() => ({ uri: { fsPath: fixtureRoot } })),
            getWorkspaceFolders: jest.fn(() => [{ uri: { fsPath: fixtureRoot } }]),
            fileExists: jest.fn((targetPath: string) => fs.existsSync(targetPath))
        };
        (vscode.workspace.openTextDocument as jest.Mock).mockImplementation(async (target: string | vscode.Uri) => {
            const filePath = typeof target === 'string' ? target : target.fsPath;
            return createDocument(filePath, fs.readFileSync(filePath, 'utf8'));
        });

        const service = createDefinitionService(
            undefined,
            undefined,
            projectConfigService,
            host
        );
        const document = createDocument(
            path.join(fixtureRoot, 'simul-call.c'),
            [
                'void demo() {',
                '    write("ok");',
                '}'
            ].join('\n')
        );

        const definition = await provideDefinition(
            service,
            document,
            new vscode.Position(1, 6),
            fixtureRoot
        );

        expect(definition).toHaveLength(1);
        expect(normalizeLocationUri(definition[0].uri)).toBe(simulatedEfunFile);
        expect(projectConfigService.getSimulatedEfunFileForWorkspace).toHaveBeenCalledWith(fixtureRoot);
        expect(host.findFiles).not.toHaveBeenCalled();
    });

    test('semantic token service reuses ASTManager analysis without falling back to a secondary parse facade', async () => {
        const service = new DefaultLanguageSemanticTokensService(DocumentSemanticSnapshotService.getInstance());
        const document = createDocument(
            path.join(fixtureRoot, 'semantic.c'),
            ['class Payload {', '    int hp;', '}', '', 'void demo() {', '    class Payload payload;', '    payload->hp;', '}'].join('\n')
        );

        const result = await service.provideSemanticTokens({
            context: createLanguageContext(document, fixtureRoot)
        });

        expect(Array.isArray(result.tokens)).toBe(true);
        expect(result.tokens.length).toBeGreaterThan(0);
    });

    test('diagnostics orchestration uses ASTManager analysis and snapshot parse errors instead of direct parse facades', async () => {
        const snapshotDiagnostic = new vscode.Diagnostic(
            new vscode.Range(0, 0, 0, 1),
            'snapshot parse error',
            vscode.DiagnosticSeverity.Error
        );
        const astManager = {
            parseDocument: jest.fn(() => ({
                parsed: {
                    version: 1,
                    tokens: {} as any,
                    tree: {} as any,
                    diagnostics: [],
                    lastAccessed: Date.now(),
                    parseTime: 1,
                    size: 1
                },
                snapshot: { parseDiagnostics: [snapshotDiagnostic] }
            })),
            clearCache: jest.fn(),
            clearAllCache: jest.fn()
        } as unknown as ASTManager;
        const orchestrator = new DiagnosticsOrchestrator(
            { subscriptions: [], extensionPath: process.cwd() } as any,
            {
                diagnosticsService: createSharedDiagnosticsService(astManager, [])
            }
        );
        const document = createDocument(
            path.join(fixtureRoot, 'diagnostics.c'),
            ['int broken(', '{'].join('\n')
        );

        const diagnostics = await (orchestrator as any).collectDiagnostics(document);

        expect(Array.isArray(diagnostics)).toBe(true);
        expect(diagnostics.map((diagnostic: vscode.Diagnostic) => diagnostic.message)).toContain('snapshot parse error');
    });

    test('definition requests use a version-matching semantic snapshot after edits', async () => {
        const service = createDefinitionService();
        const fileName = path.join(fixtureRoot, 'definition.c');
        const initialDocument = createDocument(
            fileName,
            [
                'int first_call() {',
                '    return 1;',
                '}',
                '',
                'void demo() {',
                '    first_call();',
                '}'
            ].join('\n'),
            1
        );

        getAstManagerForTests().getSemanticSnapshot(initialDocument, false);

        const updatedDocument = createDocument(
            fileName,
            [
                'int renamed_call() {',
                '    return 2;',
                '}',
                '',
                'void demo() {',
                '    renamed_call();',
                '}'
            ].join('\n'),
            2
        );

        const definition = await provideDefinition(
            service,
            updatedDocument,
            new vscode.Position(5, 8),
            fixtureRoot
        );

        expect(definition).toHaveLength(1);
        expect(normalizeLocationUri(definition[0].uri)).toBe(path.normalize(updatedDocument.fileName));
        expect(definition[0].range.start.line).toBe(0);
        expect(updatedDocument.lineAt(definition[0].range.start.line).text).toContain('renamed_call');
    });

    test('this_object()->query_self() resolves to the current file definition', async () => {
        const source = [
            'string query_self() {',
            '    return "me";',
            '}',
            '',
            'void demo() {',
            '    this_object()->query_self();',
            '}'
        ].join('\n');
        const fileName = path.join(fixtureRoot, 'self.c');
        const document = createDocument(fileName, source);
        const objectInferenceService = {
            inferObjectAccess: jest.fn().mockResolvedValue({
                receiver: 'this_object()',
                memberName: 'query_self',
                inference: {
                    status: 'resolved',
                    candidates: [{ path: fileName, source: 'builtin-call' }]
                }
            })
        };
        const service = createDefinitionService(
            objectInferenceService,
            {
                findMethod: jest.fn().mockResolvedValue(
                    {
                        path: fileName,
                        location: new vscode.Location(vscode.Uri.file(fileName), new vscode.Position(0, 0))
                    }
                )
            }
        );

        const definition = await provideDefinition(
            service,
            document,
            positionAtSubstring(document, source, 'query_self();'),
            fixtureRoot
        );

        expect(definition).toHaveLength(1);
        expect(normalizeLocationUri(definition[0].uri)).toBe(fileName);
        expect(definition[0].range.start.line).toBe(0);
        expect(objectInferenceService.inferObjectAccess).toHaveBeenCalledWith(document, expect.any(vscode.Position));
    });

    test('this_player()->query_name() resolves through the config-backed semantic provider', async () => {
        const playerFile = path.join(fixtureRoot, 'adm', 'objects', 'player.c');
        fs.mkdirSync(path.dirname(playerFile), { recursive: true });
        fs.writeFileSync(
            playerFile,
            'string query_name() { return "player"; }\n'
        );
        installWorkspaceOpenTextDocumentFixture();

        const projectConfigService = {
            loadForWorkspace: jest.fn(async (workspaceRoot: string) =>
                workspaceRoot === fixtureRoot
                    ? {
                        version: 1 as const,
                        configHellPath: 'config.hell',
                        playerObjectPath: '/adm/objects/player'
                    }
                    : undefined
            )
        };
        const source = [
            'void demo() {',
            '    this_player()->query_name();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'semantic-this-player-definition.c'), source);
        const objectInferenceService = createObjectInference(projectConfigService);
        const targetMethodLookup = new TargetMethodLookup(analysisService, pathSupport);
        const service = createDefinitionService(objectInferenceService, targetMethodLookup, projectConfigService);

        const definition = await provideDefinition(
            service,
            document,
            positionAtSubstring(document, source, 'query_name();'),
            fixtureRoot
        );

        expect(definition).toHaveLength(1);
        expect(normalizeLocationUri(definition[0].uri)).toBe(playerFile);
    });

    test('previous_object() remains non-static at definition level and does not fall back to annotations', async () => {
        installWorkspaceOpenTextDocumentFixture();

        const source = [
            '/**',
            ' * @lpc-return-objects {"/adm/objects/shield"}',
            ' */',
            'object previous_object();',
            '',
            'void demo() {',
            '    previous_object()->query_name();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'semantic-previous-object-definition.c'), source);
        const objectInferenceService = createObjectInference();
        const targetMethodLookup = new TargetMethodLookup(analysisService, pathSupport);
        const service = createDefinitionService(objectInferenceService, targetMethodLookup);

        const definition = await provideDefinition(
            service,
            document,
            positionAtSubstring(document, source, 'query_name();'),
            fixtureRoot
        );

        expect(definition).toHaveLength(0);
    });

    test('semantic evaluation fallback still feeds downstream definition when natural inference stays unknown', async () => {
        const swordFile = path.join(fixtureRoot, 'adm', 'objects', 'sword.c');
        fs.mkdirSync(path.dirname(swordFile), { recursive: true });
        fs.writeFileSync(
            swordFile,
            'string query_name() { return "sword"; }\n'
        );
        installWorkspaceOpenTextDocumentFixture();

        const source = [
            '/**',
            ' * @lpc-return-objects {"/adm/objects/sword"}',
            ' */',
            'object helper(string target) {',
            '    return load_object(target);',
            '}',
            '',
            'void demo(string target) {',
            '    helper(target)->query_name();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'semantic-fallback-definition.c'), source);
        const objectInferenceService = createObjectInference();
        const targetMethodLookup = new TargetMethodLookup(analysisService, pathSupport);
        const service = createDefinitionService(objectInferenceService, targetMethodLookup);

        const definition = await provideDefinition(
            service,
            document,
            positionAtSubstring(document, source, 'query_name();'),
            fixtureRoot
        );

        expect(definition).toHaveLength(1);
        expect(normalizeLocationUri(definition[0].uri)).toBe(swordFile);
    });

    test('semantic evaluation mismatch does not override exact natural definition', async () => {
        const swordFile = path.join(fixtureRoot, 'adm', 'objects', 'sword.c');
        const shieldFile = path.join(fixtureRoot, 'adm', 'objects', 'shield.c');
        fs.mkdirSync(path.dirname(swordFile), { recursive: true });
        fs.writeFileSync(
            swordFile,
            'string query_name() { return "sword"; }\n'
        );
        fs.writeFileSync(
            shieldFile,
            'string query_name() { return "shield"; }\n'
        );
        installWorkspaceOpenTextDocumentFixture();

        const source = [
            '/**',
            ' * @lpc-return-objects {"/adm/objects/shield"}',
            ' */',
            'object helper() {',
            '    return load_object("/adm/objects/sword");',
            '}',
            '',
            'void demo() {',
            '    helper()->query_name();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'semantic-mismatch-definition.c'), source);
        const objectInferenceService = createObjectInference();
        const targetMethodLookup = new TargetMethodLookup(analysisService, pathSupport);
        const service = createDefinitionService(objectInferenceService, targetMethodLookup);

        const definition = await provideDefinition(
            service,
            document,
            positionAtSubstring(document, source, 'query_name();'),
            fixtureRoot
        );

        expect(definition).toHaveLength(1);
        expect(normalizeLocationUri(definition[0].uri)).toBe(swordFile);
    });

    test('definition resolves file-scope global object receivers to the current-file target', async () => {
        const targetFile = path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c');
        fs.mkdirSync(path.dirname(targetFile), { recursive: true });
        fs.writeFileSync(
            targetFile,
            [
                'string query_name(int mode, int flags) {',
                '    return "combat-d";',
                '}'
            ].join('\n')
        );

        const source = [
            'object COMBAT_D = load_object("/adm/daemons/combat_d");',
            '',
            'void demo() {',
            '    COMBAT_D->query_name(1, 2);',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'global-object-definition.c'), source);
        const objectInferenceService = createObjectInference();
        const inferObjectAccess = jest.spyOn(objectInferenceService, 'inferObjectAccess');
        const targetMethodLookup = new TargetMethodLookup(analysisService, pathSupport);
        const findMethod = jest.spyOn(targetMethodLookup, 'findMethod');
        (vscode.workspace.openTextDocument as jest.Mock).mockImplementation(async (target: string | vscode.Uri) => {
            const filePath = typeof target === 'string' ? target : target.fsPath;
            return createDocument(filePath, fs.readFileSync(filePath, 'utf8'));
        });
        const service = createDefinitionService(objectInferenceService, targetMethodLookup);

        const definition = await provideDefinition(
            service,
            document,
            positionAtSubstring(document, source, 'query_name(1, 2);'),
            fixtureRoot
        );

        expect(definition).toHaveLength(1);
        expect(normalizeLocationUri(definition[0].uri)).toBe(targetFile);
        expect(definition[0].range.start.line).toBe(0);
        expect(inferObjectAccess).toHaveBeenCalledWith(document, expect.any(vscode.Position));
        expect(findMethod).toHaveBeenCalledWith(document, targetFile, 'query_name');
    });

    test('definition resolves inherited file-scope global object receivers to the current-file target', async () => {
        const targetFile = path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c');
        fs.mkdirSync(path.dirname(targetFile), { recursive: true });
        fs.writeFileSync(
            targetFile,
            [
                'string query_name(int mode, int flags) {',
                '    return "combat-d";',
                '}'
            ].join('\n')
        );
        fs.mkdirSync(path.join(fixtureRoot, 'std'), { recursive: true });
        fs.writeFileSync(
            path.join(fixtureRoot, 'std', 'room.c'),
            'object COMBAT_D = load_object("/adm/daemons/combat_d");\n'
        );

        const source = [
            'inherit "/std/room";',
            '',
            'void demo() {',
            '    COMBAT_D->query_name(1, 2);',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'inherited-global-definition.c'), source);
        const objectInferenceService = createObjectInference();
        const inferObjectAccess = jest.spyOn(objectInferenceService, 'inferObjectAccess');
        const targetMethodLookup = new TargetMethodLookup(analysisService, pathSupport);
        const findMethod = jest.spyOn(targetMethodLookup, 'findMethod');
        (vscode.workspace.openTextDocument as jest.Mock).mockImplementation(async (target: string | vscode.Uri) => {
            const filePath = typeof target === 'string' ? target : target.fsPath;
            const normalizedPath = filePath
                .replace(/^[/\\]+([A-Za-z]:[\\/])/, '$1')
                .replace(/\//g, path.sep);
            return createDocument(normalizedPath, fs.readFileSync(normalizedPath, 'utf8'));
        });
        const service = createDefinitionService(objectInferenceService, targetMethodLookup);

        const definition = await provideDefinition(
            service,
            document,
            positionAtSubstring(document, source, 'query_name(1, 2);'),
            fixtureRoot
        );

        expect(definition).toHaveLength(1);
        expect(normalizeLocationUri(definition[0].uri)).toBe(targetFile);
        expect(definition[0].range.start.line).toBe(0);
        expect(inferObjectAccess).toHaveBeenCalledWith(document, expect.any(vscode.Position));
        expect(findMethod).toHaveBeenCalledWith(document, targetFile, 'query_name');
    });

    test('definition resolves local receivers initialized from new(CLASSIFY_POP) through macro-backed object inference', async () => {
        const targetFile = path.join(fixtureRoot, 'std', 'classify_pop.c');
        fs.mkdirSync(path.dirname(targetFile), { recursive: true });
        fs.writeFileSync(
            targetFile,
            [
                'void add_data_button(string label, string command) {',
                '}'
            ].join('\n')
        );
        macroManager.getMacro.mockReturnValue({
            name: 'CLASSIFY_POP',
            value: '/std/classify_pop',
            file: path.join(fixtureRoot, 'include', 'globals.h'),
            line: 1
        });
        installWorkspaceOpenTextDocumentFixture();

        const source = [
            'int main(object me, string arg) {',
            '    object classify_pop;',
            '    classify_pop = new(CLASSIFY_POP);',
            '    classify_pop->add_data_button("label", "command");',
            '    return 1;',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'cmds', 'new-classify-pop.c'), source);
        const objectInferenceService = createObjectInference();
        const inferObjectAccess = jest.spyOn(objectInferenceService, 'inferObjectAccess');
        const targetMethodLookup = new TargetMethodLookup(analysisService, pathSupport);
        const findMethod = jest.spyOn(targetMethodLookup, 'findMethod');
        const service = createDefinitionService(objectInferenceService, targetMethodLookup);

        const definition = await provideDefinition(
            service,
            document,
            positionAtSubstring(document, source, 'add_data_button("label", "command");'),
            fixtureRoot
        );

        expect(definition).toHaveLength(1);
        expect(normalizeLocationUri(definition[0].uri)).toBe(targetFile);
        expect(inferObjectAccess).toHaveBeenCalledWith(document, expect.any(vscode.Position));
        expect(findMethod).toHaveBeenCalledWith(document, targetFile, 'add_data_button');
    });

    test('semantic evaluation model_get feeds downstream object-method definition', async () => {
        const protocolFile = path.join(fixtureRoot, 'adm', 'protocol', 'protocol_server.c');
        const loginModelFile = path.join(fixtureRoot, 'adm', 'protocol', 'model', 'login_model.c');
        fs.mkdirSync(path.dirname(loginModelFile), { recursive: true });
        fs.writeFileSync(
            protocolFile,
            [
                '/**',
                ' * @lpc-return-objects {"/adm/protocol/model/login_model", "/adm/protocol/model/classify_popup_model"}',
                ' */',
                'object model_get(string model_name) {',
                '    mapping info;',
                '    mapping registry = query_model_registry();',
                '',
                '    info = registry[model_name];',
                '    if (info["mode"] == "new") {',
                '        return new(info["path"]);',
                '    }',
                '',
                '    return load_object(info["path"]);',
                '}',
                '',
                'mapping query_model_registry() {',
                '    return ([',
                '        "login": ([',
                '            "path": "/adm/protocol/model/login_model",',
                '            "mode": "load",',
                '        ]),',
                '        "classify_popup": ([',
                '            "path": "/adm/protocol/model/classify_popup_model",',
                '            "mode": "new",',
                '        ]),',
                '    ]);',
                '}'
            ].join('\n')
        );
        fs.writeFileSync(
            loginModelFile,
            'void error_result(string message) {}\n'
        );
        fs.writeFileSync(
            path.join(fixtureRoot, 'adm', 'protocol', 'model', 'classify_popup_model.c'),
            'void add_data_button(string label, string command) {}\n'
        );
        installWorkspaceOpenTextDocumentFixture();

        const source = [
            'void demo() {',
            '    object protocol = load_object("/adm/protocol/protocol_server");',
            '    protocol->model_get("login")->error_result("ban");',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room', 'semantic-model-get-definition.c'), source);
        const objectInferenceService = createObjectInference();
        const inferObjectAccess = jest.spyOn(objectInferenceService, 'inferObjectAccess');
        const targetMethodLookup = new TargetMethodLookup(analysisService, pathSupport);
        const findMethod = jest.spyOn(targetMethodLookup, 'findMethod');
        const service = createDefinitionService(objectInferenceService, targetMethodLookup);

        const definition = await provideDefinition(
            service,
            document,
            positionAtSubstring(document, source, 'error_result("ban");'),
            fixtureRoot
        );

        expect(definition).toHaveLength(1);
        expect(normalizeLocationUri(definition[0].uri)).toBe(loginModelFile);
        expect(inferObjectAccess).toHaveBeenCalledWith(document, expect.any(vscode.Position));
        expect(findMethod).toHaveBeenCalledWith(document, loginModelFile, 'error_result');
    });

    test('semantic evaluation model_get resolves macro receivers before return-objects fallback', async () => {
        const protocolFile = path.join(fixtureRoot, 'adm', 'protocol', 'protocol_server.c');
        const navigationModelFile = path.join(fixtureRoot, 'adm', 'protocol', 'model', 'navigation_popup_model.c');
        const equipModelFile = path.join(fixtureRoot, 'adm', 'protocol', 'model', 'equip_ui_model.c');
        fs.mkdirSync(path.dirname(navigationModelFile), { recursive: true });
        fs.writeFileSync(
            protocolFile,
            [
                '/**',
                ' * @lpc-return-objects {"/adm/protocol/model/navigation_popup_model", "/adm/protocol/model/equip_ui_model"}',
                ' */',
                'varargs object model_get(string model_name, mixed init_arg) {',
                '    mapping registry;',
                '    mapping info;',
                '    object model;',
                '',
                '    registry = query_model_registry();',
                '    info = registry[model_name];',
                '    if (!mapp(info))',
                '        return 0;',
                '',
                '    if (info["mode"] == "new")',
                '        model = new(info["path"]);',
                '    else',
                '        model = load_object(info["path"]);',
                '',
                '    if (objectp(model) && stringp(info["init_method"]) && !undefinedp(init_arg))',
                '        call_other(model, info["init_method"], init_arg);',
                '',
                '    return model;',
                '}',
                '',
                'mapping query_model_registry() {',
                '    return ([',
                '        "navigation_popup": ([',
                '            "path": "/adm/protocol/model/navigation_popup_model",',
                '            "mode": "load",',
                '        ]),',
                '        "equip_ui": ([',
                '            "path": "/adm/protocol/model/equip_ui_model",',
                '            "mode": "load",',
                '        ]),',
                '    ]);',
                '}'
            ].join('\n')
        );
        fs.writeFileSync(
            navigationModelFile,
            'mapping create_action(string text, string cmd) { return ([]); }\n'
        );
        fs.writeFileSync(
            equipModelFile,
            'mapping create_action(string cmd, string text) { return ([]); }\n'
        );
        macroManager.getMacro.mockImplementation((name: string) =>
            name === 'PROTOCOL_D'
                ? {
                    name,
                    value: '"/adm/protocol/protocol_server"',
                    file: path.join(fixtureRoot, 'include', 'globals.h'),
                    line: 1
                }
                : undefined
        );
        installWorkspaceOpenTextDocumentFixture();

        const source = [
            'void demo() {',
            '    PROTOCOL_D->model_get("navigation_popup")->create_action("上一页", "new_banghui mb 1");',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'cmds', 'usr', 'new_banghui.c'), source);
        const objectInferenceService = createObjectInference();
        const targetMethodLookup = new TargetMethodLookup(analysisService, pathSupport);
        const findMethod = jest.spyOn(targetMethodLookup, 'findMethod');
        const service = createDefinitionService(objectInferenceService, targetMethodLookup);

        const definition = await provideDefinition(
            service,
            document,
            positionAtSubstring(document, source, 'create_action("上一页"'),
            fixtureRoot
        );

        expect(definition).toHaveLength(1);
        expect(normalizeLocationUri(definition[0].uri)).toBe(navigationModelFile);
        expect(findMethod).toHaveBeenCalledWith(document, navigationModelFile, 'create_action');
        expect(findMethod).not.toHaveBeenCalledWith(document, equipModelFile, 'create_action');
    });

    test('merged candidates from if/else return two locations when each file implements query_name', async () => {
        const swordFile = path.join(fixtureRoot, 'adm', 'objects', 'sword.c');
        const shieldFile = path.join(fixtureRoot, 'adm', 'objects', 'shield.c');
        const source = [
            'void demo(int flag) {',
            '    object ob;',
            '    if (flag) {',
            '        ob = load_object("/adm/objects/sword");',
            '    } else {',
            '        ob = load_object("/adm/objects/shield");',
            '    }',
            '    ob->query_name();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'branch.c'), source);
        const objectInferenceService = {
            inferObjectAccess: jest.fn().mockResolvedValue({
                receiver: 'ob',
                memberName: 'query_name',
                inference: {
                    status: 'multiple',
                    candidates: [
                        { path: swordFile, source: 'builtin-call' },
                        { path: shieldFile, source: 'builtin-call' }
                    ]
                }
            })
        };
        const service = createDefinitionService(
            objectInferenceService,
            {
                findMethod: jest.fn(async (_document: vscode.TextDocument, targetFilePath: string) => {
                    if (targetFilePath === swordFile) {
                        return {
                            path: swordFile,
                            location: new vscode.Location(vscode.Uri.file(swordFile), new vscode.Position(0, 0))
                        };
                    }

                    if (targetFilePath === shieldFile) {
                        return {
                            path: shieldFile,
                            location: new vscode.Location(vscode.Uri.file(shieldFile), new vscode.Position(0, 0))
                        };
                    }

                    return undefined;
                })
            }
        );

        const definition = await provideDefinition(
            service,
            document,
            positionAtSubstring(document, source, 'query_name();'),
            fixtureRoot
        );

        expect(definition).toHaveLength(2);
        expect(definition.map((location) => normalizeLocationUri(location.uri)).sort()).toEqual([
            shieldFile,
            swordFile
        ]);
        expect(objectInferenceService.inferObjectAccess).toHaveBeenCalledWith(document, expect.any(vscode.Position));
    });

    test('definition resolves bare ::create() to the inherited implementation in a real workspace', async () => {
        fs.mkdirSync(path.join(fixtureRoot, 'std'), { recursive: true });
        fs.writeFileSync(path.join(fixtureRoot, 'std', 'base_room.c'), 'void create() {}\n');
        installWorkspaceOpenTextDocumentFixture();

        const source = [
            'inherit "/std/base_room";',
            '',
            'void create() {',
            '    ::create();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room.c'), source);
        const service = createDefinitionService(undefined, undefined, undefined, {
            scopedMethodResolver: createScopedMethodResolver()
        });

        const definition = await provideDefinition(
            service,
            document,
            positionAtSubstring(document, source, 'create();'),
            fixtureRoot
        );

        expect(definition).toHaveLength(1);
        expect(normalizeLocationUri(definition[0].uri)).toBe(path.join(fixtureRoot, 'std', 'base_room.c'));
    });

    test('documented return propagation from ::factory() feeds downstream object-method definition', async () => {
        fs.mkdirSync(path.join(fixtureRoot, 'std'), { recursive: true });
        fs.mkdirSync(path.join(fixtureRoot, 'obj'), { recursive: true });
        fs.writeFileSync(
            path.join(fixtureRoot, 'std', 'base_room.c'),
            [
                '/**',
                ' * @lpc-return-objects {"/obj/sword"}',
                ' */',
                'object factory() {',
                '    return 0;',
                '}'
            ].join('\n')
        );
        fs.writeFileSync(path.join(fixtureRoot, 'obj', 'sword.c'), 'string query_name() { return "sword"; }\n');
        installWorkspaceOpenTextDocumentFixture();

        const source = [
            'inherit "/std/base_room";',
            '',
            'void demo() {',
            '    object ob = ::factory();',
            '    ob->query_name();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'room-scoped-factory.c'), source);
        const service = createDefinitionService(
            createObjectInference(),
            undefined,
            undefined,
            {
                scopedMethodResolver: createScopedMethodResolver()
            }
        );

        const definition = await provideDefinition(
            service,
            document,
            positionAtSubstring(document, source, 'query_name();'),
            fixtureRoot
        );

        expect(definition).toHaveLength(1);
        expect(normalizeLocationUri(definition[0].uri)).toBe(path.join(fixtureRoot, 'obj', 'sword.c'));
    });

    test('documented return propagation from room::factory() feeds downstream object-method definition', async () => {
        fs.mkdirSync(path.join(fixtureRoot, 'std'), { recursive: true });
        fs.mkdirSync(path.join(fixtureRoot, 'obj'), { recursive: true });
        fs.writeFileSync(
            path.join(fixtureRoot, 'std', 'room.c'),
            [
                '/**',
                ' * @lpc-return-objects {"/obj/room_item"}',
                ' */',
                'object factory() {',
                '    return 0;',
                '}'
            ].join('\n')
        );
        fs.writeFileSync(path.join(fixtureRoot, 'std', 'combat.c'), 'object factory() { return 0; }\n');
        fs.writeFileSync(path.join(fixtureRoot, 'obj', 'room_item.c'), 'string query_name() { return "room-item"; }\n');
        installWorkspaceOpenTextDocumentFixture();

        const source = [
            'inherit "/std/room";',
            'inherit "/std/combat";',
            '',
            'void demo() {',
            '    object ob = room::factory();',
            '    ob->query_name();',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'named-room.c'), source);
        const service = createDefinitionService(
            createObjectInference(),
            undefined,
            undefined,
            {
                scopedMethodResolver: createScopedMethodResolver()
            }
        );

        const definition = await provideDefinition(
            service,
            document,
            positionAtSubstring(document, source, 'query_name();'),
            fixtureRoot
        );

        expect(definition).toHaveLength(1);
        expect(normalizeLocationUri(definition[0].uri)).toBe(path.join(fixtureRoot, 'obj', 'room_item.c'));
    });
});
