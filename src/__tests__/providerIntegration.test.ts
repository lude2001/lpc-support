import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ASTManager } from '../ast/astManager';
import { DiagnosticsOrchestrator } from '../diagnostics/DiagnosticsOrchestrator';
import { createSharedDiagnosticsService } from '../language/services/diagnostics/createSharedDiagnosticsService';
import { QueryBackedLanguageCompletionService } from '../language/services/completion/LanguageCompletionService';
import { AstBackedLanguageDefinitionService } from '../language/services/navigation/LanguageDefinitionService';
import { configureScopedMethodIdentifierAnalysisService } from '../language/services/navigation/ScopedMethodIdentifierSupport';
import { DefaultLanguageSemanticTokensService } from '../language/services/structure/LanguageSemanticTokensService';
import { ObjectInferenceService } from '../objectInference/ObjectInferenceService';
import { ScopedMethodResolver } from '../objectInference/ScopedMethodResolver';
import { DocumentSemanticSnapshotService } from '../semantic/documentSemanticSnapshotService';
import { configureSimulatedEfunScannerAnalysisService } from '../efun/SimulatedEfunScanner';
import { TargetMethodLookup, configureTargetMethodLookupAnalysisService } from '../targetMethodLookup';

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

    beforeEach(() => {
        jest.clearAllMocks();
        const analysisService = DocumentSemanticSnapshotService.getInstance();
        configureTargetMethodLookupAnalysisService(analysisService);
        configureSimulatedEfunScannerAnalysisService(analysisService);
        configureScopedMethodIdentifierAnalysisService(analysisService);
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
        ASTManager.getInstance().clearAllCache();
        configureTargetMethodLookupAnalysisService(undefined);
        configureSimulatedEfunScannerAnalysisService(undefined);
        configureScopedMethodIdentifierAnalysisService(undefined);
        jest.restoreAllMocks();
        fs.rmSync(fixtureRoot, { recursive: true, force: true });
    });

    test('completion requests stay on semantic snapshots instead of any secondary parse facade', async () => {
        const service = new QueryBackedLanguageCompletionService(efunDocsManager as any, macroManager as any);
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
        const objectInferenceService = new ObjectInferenceService(macroManager as any);
        const inferObjectAccess = jest.spyOn(objectInferenceService, 'inferObjectAccess');
        const service = new QueryBackedLanguageCompletionService(
            efunDocsManager as any,
            macroManager as any,
            undefined,
            objectInferenceService as any,
            {
                clear: jest.fn(),
                show: jest.fn(),
                appendLine: jest.fn()
            }
        );

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
        const objectInferenceService = new ObjectInferenceService(macroManager as any);
        const inferObjectAccess = jest.spyOn(objectInferenceService, 'inferObjectAccess');
        (vscode.workspace.openTextDocument as jest.Mock).mockImplementation(async (target: string | vscode.Uri) => {
            const filePath = typeof target === 'string' ? target : target.fsPath;
            const normalizedPath = filePath
                .replace(/^[/\\]+([A-Za-z]:[\\/])/, '$1')
                .replace(/\//g, path.sep);
            return createDocument(normalizedPath, fs.readFileSync(normalizedPath, 'utf8'));
        });
        const service = new QueryBackedLanguageCompletionService(
            efunDocsManager as any,
            macroManager as any,
            undefined,
            objectInferenceService as any,
            {
                clear: jest.fn(),
                show: jest.fn(),
                appendLine: jest.fn()
            }
        );

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
        const service = new QueryBackedLanguageCompletionService(efunDocsManager as any, macroManager as any);

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
        const service = new QueryBackedLanguageCompletionService(efunDocsManager as any, macroManager as any);

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
        const service = new QueryBackedLanguageCompletionService(efunDocsManager as any, macroManager as any);

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
        const service = new QueryBackedLanguageCompletionService(efunDocsManager as any, macroManager as any);

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

        const service = new AstBackedLanguageDefinitionService(
            macroManager as any,
            efunDocsManager as any,
            {
                inferObjectAccess: jest.fn().mockResolvedValue(undefined)
            } as any,
            undefined,
            projectConfigService as any,
            host as any
        );
        jest.spyOn(ASTManager.getInstance(), 'getSemanticSnapshot').mockReturnValue({
            includeStatements: [
                {
                    value: 'global',
                    isSystemInclude: true,
                    range: new vscode.Range(0, 0, 0, 16)
                }
            ]
        } as any);
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

        const service = new AstBackedLanguageDefinitionService(
            macroManager as any,
            efunDocsManager as any,
            undefined,
            undefined,
            projectConfigService as any,
            host as any
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
        jest.spyOn(ASTManager, 'getInstance').mockReturnValue({
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
        } as unknown as ASTManager);
        const orchestrator = new DiagnosticsOrchestrator(
            { subscriptions: [], extensionPath: process.cwd() } as any,
            {
                diagnosticsService: createSharedDiagnosticsService(ASTManager.getInstance(), [])
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
        const service = new AstBackedLanguageDefinitionService(macroManager as any, efunDocsManager as any);
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

        ASTManager.getInstance().getSemanticSnapshot(initialDocument, false);

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
        const service = new AstBackedLanguageDefinitionService(
            macroManager as any,
            efunDocsManager as any,
            objectInferenceService as any,
            {
                findMethod: jest.fn().mockResolvedValue(
                    {
                        path: fileName,
                        location: new vscode.Location(vscode.Uri.file(fileName), new vscode.Position(0, 0))
                    }
                )
            } as any
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
        const objectInferenceService = new ObjectInferenceService(macroManager as any);
        const inferObjectAccess = jest.spyOn(objectInferenceService, 'inferObjectAccess');
        const targetMethodLookup = new TargetMethodLookup(macroManager as any);
        const findMethod = jest.spyOn(targetMethodLookup, 'findMethod');
        (vscode.workspace.openTextDocument as jest.Mock).mockImplementation(async (target: string | vscode.Uri) => {
            const filePath = typeof target === 'string' ? target : target.fsPath;
            return createDocument(filePath, fs.readFileSync(filePath, 'utf8'));
        });
        const service = new AstBackedLanguageDefinitionService(
            macroManager as any,
            efunDocsManager as any,
            objectInferenceService as any,
            targetMethodLookup as any
        );

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
        const objectInferenceService = new ObjectInferenceService(macroManager as any);
        const inferObjectAccess = jest.spyOn(objectInferenceService, 'inferObjectAccess');
        const targetMethodLookup = new TargetMethodLookup(macroManager as any);
        const findMethod = jest.spyOn(targetMethodLookup, 'findMethod');
        (vscode.workspace.openTextDocument as jest.Mock).mockImplementation(async (target: string | vscode.Uri) => {
            const filePath = typeof target === 'string' ? target : target.fsPath;
            const normalizedPath = filePath
                .replace(/^[/\\]+([A-Za-z]:[\\/])/, '$1')
                .replace(/\//g, path.sep);
            return createDocument(normalizedPath, fs.readFileSync(normalizedPath, 'utf8'));
        });
        const service = new AstBackedLanguageDefinitionService(
            macroManager as any,
            efunDocsManager as any,
            objectInferenceService as any,
            targetMethodLookup as any
        );

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
        const service = new AstBackedLanguageDefinitionService(
            macroManager as any,
            efunDocsManager as any,
            objectInferenceService as any,
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
            } as any
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
        const service = new AstBackedLanguageDefinitionService(
            macroManager as any,
            efunDocsManager as any,
            undefined,
            undefined,
            undefined,
            {
                scopedMethodResolver: new ScopedMethodResolver(macroManager as any, [fixtureRoot])
            } as any
        );

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
        const service = new AstBackedLanguageDefinitionService(
            macroManager as any,
            efunDocsManager as any,
            new ObjectInferenceService(macroManager as any) as any,
            undefined,
            undefined,
            {
                scopedMethodResolver: new ScopedMethodResolver(macroManager as any, [fixtureRoot])
            } as any
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
        const service = new AstBackedLanguageDefinitionService(
            macroManager as any,
            efunDocsManager as any,
            new ObjectInferenceService(macroManager as any) as any,
            undefined,
            undefined,
            {
                scopedMethodResolver: new ScopedMethodResolver(macroManager as any, [fixtureRoot])
            } as any
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
