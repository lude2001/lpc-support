import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync, fork, type ChildProcess } from 'child_process';
import {
    DidChangeTextDocumentNotification,
    DidOpenTextDocumentNotification,
    DefinitionRequest,
    DocumentFormattingRequest,
    HoverRequest,
    ExitNotification,
    InitializeRequest,
    InitializedNotification,
    PrepareRenameRequest,
    PublishDiagnosticsNotification,
    RenameRequest,
    ShutdownRequest,
    type Diagnostic,
    type ProtocolConnection,
    type TextEdit
} from 'vscode-languageserver-protocol/node';
import { IPCMessageReader, IPCMessageWriter } from 'vscode-jsonrpc/node';
import { createProtocolConnection } from 'vscode-languageserver-protocol/node';
import { HealthRequest } from '../shared/protocol/health';
import { WorkspaceConfigSyncNotification } from '../shared/protocol/workspaceConfigSync';

describe('spawned LSP runtime integration', () => {
    let harness: SpawnedServerHarness | undefined;

    afterEach(async () => {
        await harness?.dispose();
        harness = undefined;
    });

    test('supports health, diagnostics, and formatting over the spawned server bundle', async () => {
        const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-spawned-runtime-'));
        const malformedDocumentPath = path.join(workspaceRoot, 'bad name!.c');
        const formatDocumentPath = path.join(workspaceRoot, 'format-me.c');

        fs.writeFileSync(malformedDocumentPath, 'void demo() { return; }', 'utf8');
        fs.writeFileSync(formatDocumentPath, 'void test(){}', 'utf8');

        harness = await SpawnedServerHarness.start(workspaceRoot);

        const health = await harness.connection.sendRequest(HealthRequest.type);
        expect(health.status).toBe('ok');
        expect(typeof health.serverVersion).toBe('string');
        expect(health.documentCount).toBe(0);

        const diagnosticsPromise = harness.waitForDiagnostics(uriFromPath(malformedDocumentPath));
        await harness.openDocument(malformedDocumentPath, 'void demo() { return; }');
        const diagnostics = await diagnosticsPromise;

        expect(diagnostics).not.toHaveLength(0);
        expect(diagnostics.some((diagnostic) => diagnostic.message.includes('文件名应由字母'))).toBe(true);

        await harness.openDocument(formatDocumentPath, 'void test(){}');
        const edits = await harness.connection.sendRequest(DocumentFormattingRequest.type, {
            textDocument: {
                uri: uriFromPath(formatDocumentPath)
            },
            options: {
                tabSize: 4,
                insertSpaces: true
            }
        });

        expect(applyTextEdits('void test(){}', edits ?? [])).toBe([
            'void test()',
            '{',
            '}'
        ].join('\n'));
    }, 30000);

    test('refreshes header-backed definition cache after a didChange on the dependency', async () => {
        const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-spawned-definition-refresh-'));
        const sourceDocumentPath = path.join(workspaceRoot, 'demo.c');
        const headerDocumentPath = path.join(workspaceRoot, 'shared.h');

        fs.writeFileSync(sourceDocumentPath, [
            'include "shared.h";',
            '',
            'void demo() {',
            '    shared_fn();',
            '}'
        ].join('\n'), 'utf8');
        fs.writeFileSync(headerDocumentPath, [
            'void shared_fn();'
        ].join('\n'), 'utf8');

        harness = await SpawnedServerHarness.start(workspaceRoot);

        await harness.openDocument(sourceDocumentPath, fs.readFileSync(sourceDocumentPath, 'utf8'));
        await harness.openDocument(headerDocumentPath, fs.readFileSync(headerDocumentPath, 'utf8'));
        await harness.connection.sendRequest(HealthRequest.type);

        const firstDefinition = await harness.connection.sendRequest(DefinitionRequest.type, {
            textDocument: {
                uri: uriFromPath(sourceDocumentPath)
            },
            position: {
                line: 3,
                character: 10
            }
        });

        expect(normalizeDefinitionLocations(firstDefinition)).toEqual([
            {
                uri: uriFromPath(headerDocumentPath),
                range: {
                    start: { line: 0, character: 5 },
                    end: { line: 0, character: 14 }
                }
            }
        ]);

        await harness.changeDocument(headerDocumentPath, [
            '',
            'void shared_fn();'
        ].join('\n'), 2);

        const secondDefinition = await harness.connection.sendRequest(DefinitionRequest.type, {
            textDocument: {
                uri: uriFromPath(sourceDocumentPath)
            },
            position: {
                line: 3,
                character: 10
            }
        });

        expect(normalizeDefinitionLocations(secondDefinition)).toEqual([
            {
                uri: uriFromPath(headerDocumentPath),
                range: {
                    start: { line: 1, character: 5 },
                    end: { line: 1, character: 14 }
                }
            }
        ]);
    }, 30000);

    test('rejects same-file function rename from the latest in-memory text', async () => {
        const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-spawned-rename-unsaved-'));
        const documentPath = path.join(workspaceRoot, 'rename-me.c');
        const savedText = [
            'int query_id() { return 1; }',
            'int demo() { return query_id(); }'
        ].join('\n');
        const unsavedText = [
            'int query_name() { return 1; }',
            'int demo() { return query_name(); }'
        ].join('\n');

        fs.writeFileSync(documentPath, savedText, 'utf8');
        harness = await SpawnedServerHarness.start(workspaceRoot);

        await harness.openDocument(documentPath, savedText);
        await harness.changeDocument(documentPath, unsavedText, 2);

        const prepareResult = await harness.connection.sendRequest(PrepareRenameRequest.type, {
            textDocument: {
                uri: uriFromPath(documentPath)
            },
            position: {
                line: 0,
                character: 6
            }
        });
        const renameEdit = await harness.connection.sendRequest(RenameRequest.type, {
            textDocument: {
                uri: uriFromPath(documentPath)
            },
            position: {
                line: 0,
                character: 6
            },
            newName: 'query_title'
        });

        expect(prepareResult).toBeNull();
        expect(renameEdit).toEqual({ changes: {} });
    }, 30000);

    test('renames unsaved same-file local-variable edits from the latest in-memory text', async () => {
        const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-spawned-rename-local-'));
        const documentPath = path.join(workspaceRoot, 'rename-local.c');
        const savedText = [
            'void demo() {',
            '    int local_hp = 1;',
            '    local_hp += 1;',
            '}'
        ].join('\n');
        const unsavedText = [
            'void demo() {',
            '    int local_value = 1;',
            '    local_value += 1;',
            '}'
        ].join('\n');

        fs.writeFileSync(documentPath, savedText, 'utf8');
        harness = await SpawnedServerHarness.start(workspaceRoot);

        await harness.openDocument(documentPath, savedText);
        await harness.changeDocument(documentPath, unsavedText, 2);

        const prepareResult = await harness.connection.sendRequest(PrepareRenameRequest.type, {
            textDocument: {
                uri: uriFromPath(documentPath)
            },
            position: {
                line: 2,
                character: 8
            }
        });
        const renameEdit = await harness.connection.sendRequest(RenameRequest.type, {
            textDocument: {
                uri: uriFromPath(documentPath)
            },
            position: {
                line: 2,
                character: 8
            },
            newName: 'local_points'
        });

        expect(prepareResult).toEqual({
            range: {
                start: { line: 2, character: 4 },
                end: { line: 2, character: 15 }
            },
            placeholder: 'local_value'
        });
        expect(renameEdit?.changes?.[uriFromPath(documentPath)]).toBeDefined();
        expect(renameEdit?.changes?.[uriFromPath(documentPath)]).not.toHaveLength(0);
        expect(applyTextEdits(unsavedText, renameEdit?.changes?.[uriFromPath(documentPath)] ?? [])).toBe([
            'void demo() {',
            '    int local_points = 1;',
            '    local_points += 1;',
            '}'
        ].join('\n'));
    }, 30000);

    test('resolves macro definitions from workspace include directories after runtime startup', async () => {
        const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-spawned-macro-definition-'));
        const includeDir = path.join(workspaceRoot, 'include');
        const headerPath = path.join(includeDir, 'defs.h');
        const sourcePath = path.join(workspaceRoot, 'macro-use.c');

        fs.mkdirSync(includeDir, { recursive: true });
        fs.writeFileSync(
            path.join(workspaceRoot, 'lpc-support.json'),
            JSON.stringify({
                version: 1,
                configHellPath: 'config.hell',
                resolved: {
                    includeDirectories: ['include']
                }
            }, null, 2),
            'utf8'
        );
        fs.writeFileSync(headerPath, '#define USER_D "/adm/obj/user"\n', 'utf8');
        fs.writeFileSync(sourcePath, 'void demo() { USER_D->query_name(); }\n', 'utf8');

        harness = await SpawnedServerHarness.start(workspaceRoot);
        await harness.openDocument(sourcePath, fs.readFileSync(sourcePath, 'utf8'));

        const definition = await harness.connection.sendRequest(DefinitionRequest.type, {
            textDocument: {
                uri: uriFromPath(sourcePath)
            },
            position: {
                line: 0,
                character: 14
            }
        });

        expect(normalizeDefinitionLocations(definition)).toEqual([
            {
                uri: uriFromPath(headerPath),
                range: {
                    start: { line: 0, character: 0 },
                    end: { line: 0, character: '#define USER_D "/adm/obj/user"'.length }
                }
            }
        ]);
    }, 30000);

    test('loads simulated efun hover and definition from workspace config after runtime startup', async () => {
        const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-spawned-simulefun-runtime-'));
        const simulPath = path.join(workspaceRoot, 'adm', 'simul_efun.c');
        const sourcePath = path.join(workspaceRoot, 'simul-use.c');

        fs.mkdirSync(path.dirname(simulPath), { recursive: true });
        fs.writeFileSync(
            path.join(workspaceRoot, 'lpc-support.json'),
            JSON.stringify({
                version: 1,
                configHellPath: 'config.hell',
                resolved: {
                    simulatedEfunFile: 'adm/simul_efun'
                }
            }, null, 2),
            'utf8'
        );
        fs.writeFileSync(
            simulPath,
            [
                '/**',
                ' * @brief 发送模拟函数消息。',
                ' */',
                'void message_vision(string msg) {',
                '}'
            ].join('\n'),
            'utf8'
        );
        fs.writeFileSync(
            sourcePath,
            [
                'void demo() {',
                '    message_vision("ok");',
                '}'
            ].join('\n'),
            'utf8'
        );

        harness = await SpawnedServerHarness.start(workspaceRoot);
        await harness.openDocument(sourcePath, fs.readFileSync(sourcePath, 'utf8'));

        const hover = await harness.connection.sendRequest(HoverRequest.type, {
            textDocument: {
                uri: uriFromPath(sourcePath)
            },
            position: {
                line: 1,
                character: 8
            }
        });
        const definition = await harness.connection.sendRequest(DefinitionRequest.type, {
            textDocument: {
                uri: uriFromPath(sourcePath)
            },
            position: {
                line: 1,
                character: 8
            }
        });

        expect(hover).toEqual(expect.objectContaining({
            contents: expect.objectContaining({
                kind: 'markdown',
                value: expect.stringContaining('发送模拟函数消息')
            })
        }));
        expect(normalizeDefinitionLocations(definition)).toEqual([
            {
                uri: uriFromPath(simulPath),
                range: {
                    start: { line: 3, character: 0 },
                    end: { line: 4, character: 1 }
                }
            }
        ]);
    }, 30000);

    test('loads simulated efun docs through included source files when mudlibDirectory is relative to configHellPath', async () => {
        const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-spawned-simulefun-confighell-'));
        const configDir = path.join(workspaceRoot, 'config');
        const lpcSupportPath = path.join(workspaceRoot, 'lpc-support.json');
        const configHellPath = path.join(configDir, 'config.dev');
        const simulEntryPath = path.join(workspaceRoot, 'adm', 'single', 'simul_efun.c');
        const simulMessagePath = path.join(workspaceRoot, 'adm', 'simul_efun', 'message.c');
        const sourcePath = path.join(workspaceRoot, 'simul-use.c');

        fs.mkdirSync(path.dirname(simulEntryPath), { recursive: true });
        fs.mkdirSync(path.dirname(simulMessagePath), { recursive: true });
        fs.mkdirSync(configDir, { recursive: true });
        fs.writeFileSync(
            lpcSupportPath,
            JSON.stringify({
                version: 1,
                configHellPath: path.join('config', 'config.dev')
            }, null, 2),
            'utf8'
        );
        fs.writeFileSync(
            configHellPath,
            [
                'mudlib directory : ../',
                'simulated efun file : /adm/single/simul_efun'
            ].join('\n'),
            'utf8'
        );
        fs.writeFileSync(
            simulEntryPath,
            [
                '#include "/adm/simul_efun/message.c"'
            ].join('\n'),
            'utf8'
        );
        fs.writeFileSync(
            simulMessagePath,
            [
                '/**',
                ' * @brief 从包含文件载入的模拟函数消息。',
                ' */',
                'void message_vision(string msg) {',
                '}'
            ].join('\n'),
            'utf8'
        );
        fs.writeFileSync(
            sourcePath,
            [
                'void demo() {',
                '    message_vision("ok");',
                '}'
            ].join('\n'),
            'utf8'
        );

        harness = await SpawnedServerHarness.start(workspaceRoot);
        await harness.connection.sendNotification(WorkspaceConfigSyncNotification.type, {
            workspaceRoots: [workspaceRoot],
            workspaces: [
                {
                    workspaceRoot,
                    projectConfigPath: lpcSupportPath,
                    configHellPath: path.join('config', 'config.dev'),
                    resolvedConfig: {
                        mudlibDirectory: '../',
                        simulatedEfunFile: '/adm/single/simul_efun'
                    },
                    lastSyncedAt: new Date('2026-04-20T00:00:00.000Z').toISOString()
                }
            ]
        });
        await harness.openDocument(sourcePath, fs.readFileSync(sourcePath, 'utf8'));

        const hover = await harness.connection.sendRequest(HoverRequest.type, {
            textDocument: {
                uri: uriFromPath(sourcePath)
            },
            position: {
                line: 1,
                character: 8
            }
        });
        const definition = await harness.connection.sendRequest(DefinitionRequest.type, {
            textDocument: {
                uri: uriFromPath(sourcePath)
            },
            position: {
                line: 1,
                character: 8
            }
        });

        expect(hover).toEqual(expect.objectContaining({
            contents: expect.objectContaining({
                kind: 'markdown',
                value: expect.stringContaining('从包含文件载入的模拟函数消息')
            })
        }));
        expect(normalizeDefinitionLocations(definition)).toEqual([
            {
                uri: uriFromPath(simulMessagePath),
                range: {
                    start: { line: 3, character: 0 },
                    end: { line: 4, character: 1 }
                }
            }
        ]);
    }, 30000);
});

class SpawnedServerHarness {
    public static async start(workspaceRoot: string): Promise<SpawnedServerHarness> {
        const serverModule = path.resolve(process.cwd(), 'dist', 'lsp', 'server.js');
        ensureServerBundle(serverModule);
        if (!fs.existsSync(serverModule)) {
            throw new Error(`Spawned runtime integration requires ${serverModule}. Run the build before this test.`);
        }

        const child = fork(serverModule, ['--node-ipc'], {
            cwd: process.cwd(),
            env: {
                ...process.env
            },
            silent: true,
            stdio: ['pipe', 'pipe', 'pipe', 'ipc']
        });

        if (!child.channel) {
            throw new Error('Spawned server process did not expose an IPC channel.');
        }

        const stderr: string[] = [];
        child.stderr?.on('data', (chunk: Buffer | string) => {
            stderr.push(String(chunk));
        });

        const connection = createProtocolConnection(
            new IPCMessageReader(child),
            new IPCMessageWriter(child)
        );

        const harness = new SpawnedServerHarness(child, connection, stderr, workspaceRoot);
        connection.listen();

        try {
            await connection.sendRequest(InitializeRequest.type, {
                processId: process.pid,
                rootUri: uriFromPath(workspaceRoot),
                capabilities: {},
                workspaceFolders: [
                    {
                        uri: uriFromPath(workspaceRoot),
                        name: path.basename(workspaceRoot)
                    }
                ]
            });
            await connection.sendNotification(InitializedNotification.type, {});
            await connection.sendNotification(WorkspaceConfigSyncNotification.type, {
                workspaceRoots: [workspaceRoot],
                workspaces: [
                    {
                        workspaceRoot,
                        projectConfigPath: path.join(workspaceRoot, 'lpc-support.json'),
                        configHellPath: 'config.hell',
                        resolvedConfig: {},
                        lastSyncedAt: new Date('2026-04-11T00:00:00.000Z').toISOString()
                    }
                ]
            });
            return harness;
        } catch (error) {
            await harness.dispose();
            const failureDetails = stderr.join('').trim();
            throw new Error([
                'Failed to start spawned LPC language server.',
                error instanceof Error ? error.message : String(error),
                failureDetails ? `stderr:\n${failureDetails}` : 'stderr: <empty>'
            ].join('\n'));
        }
    }

    private readonly diagnosticsListeners = new Map<string, Array<(diagnostics: Diagnostic[]) => void>>();
    private shuttingDown = false;

    private constructor(
        private readonly child: ChildProcess,
        public readonly connection: ProtocolConnection,
        private readonly stderr: string[],
        private readonly workspaceRoot: string
    ) {
        this.connection.onNotification(PublishDiagnosticsNotification.type, (params) => {
            const listeners = this.diagnosticsListeners.get(params.uri);
            if (!listeners || listeners.length === 0) {
                return;
            }

            this.diagnosticsListeners.delete(params.uri);
            for (const resolve of listeners) {
                resolve(params.diagnostics);
            }
        });
    }

    public async openDocument(documentPath: string, text: string): Promise<void> {
        await this.connection.sendNotification(DidOpenTextDocumentNotification.type, {
            textDocument: {
                uri: uriFromPath(documentPath),
                languageId: 'lpc',
                version: 1,
                text
            }
        });
    }

    public async changeDocument(documentPath: string, text: string, version: number): Promise<void> {
        await this.connection.sendNotification(DidChangeTextDocumentNotification.type, {
            textDocument: {
                uri: uriFromPath(documentPath),
                version
            },
            contentChanges: [
                {
                    text
                }
            ]
        });
    }

    public waitForDiagnostics(uri: string, timeoutMs = 15000): Promise<Diagnostic[]> {
        return new Promise<Diagnostic[]>((resolve, reject) => {
            const timeout = setTimeout(() => {
                const listeners = this.diagnosticsListeners.get(uri) ?? [];
                this.diagnosticsListeners.set(
                    uri,
                    listeners.filter((listener) => listener !== resolveWithCleanup)
                );
                reject(new Error([
                    `Timed out waiting for diagnostics for ${uri}.`,
                    this.stderr.length > 0 ? `stderr:\n${this.stderr.join('')}` : 'stderr: <empty>'
                ].join('\n')));
            }, timeoutMs);

            const resolveWithCleanup = (diagnostics: Diagnostic[]) => {
                clearTimeout(timeout);
                resolve(diagnostics);
            };

            const listeners = this.diagnosticsListeners.get(uri) ?? [];
            listeners.push(resolveWithCleanup);
            this.diagnosticsListeners.set(uri, listeners);
        });
    }

    public async dispose(): Promise<void> {
        if (this.shuttingDown) {
            return;
        }

        this.shuttingDown = true;

        try {
            await this.connection.sendRequest(ShutdownRequest.type);
        } catch {
            // Ignore shutdown failures so we can still attempt process cleanup.
        }

        try {
            await this.connection.sendNotification(ExitNotification.type);
        } catch {
            // Ignore exit notification failures when the process is already gone.
        }

        this.connection.dispose();
        try {
            await waitForChildExit(this.child, 5000);
        } finally {
            fs.rmSync(this.workspaceRoot, {
                recursive: true,
                force: true
            });
        }
    }
}

function ensureServerBundle(serverModule: string): void {
    try {
        execFileSync(process.execPath, ['esbuild.mjs'], {
            cwd: process.cwd(),
            stdio: 'pipe'
        });
    } catch (error) {
        const stderr = error instanceof Error && 'stderr' in error
            ? String((error as NodeJS.ErrnoException & { stderr?: Buffer | string }).stderr ?? '')
            : '';
        throw new Error([
            `Failed to prepare spawned LSP server bundle at ${serverModule}.`,
            stderr || String(error)
        ].join('\n'));
    }
}

function uriFromPath(filePath: string): string {
    const normalizedPath = filePath.replace(/\\/g, '/');
    return normalizedPath.startsWith('/')
        ? `file://${encodeURI(normalizedPath)}`
        : `file:///${encodeURI(normalizedPath)}`;
}

function applyTextEdits(source: string, edits: readonly TextEdit[]): string {
    if (edits.length === 0) {
        return source;
    }

    const lineStarts = computeLineStarts(source);
    let output = source;
    const sortedEdits = [...edits].sort((left, right) => {
        const leftOffset = offsetAt(lineStarts, left.range.start.line, left.range.start.character);
        const rightOffset = offsetAt(lineStarts, right.range.start.line, right.range.start.character);
        return rightOffset - leftOffset;
    });

    for (const edit of sortedEdits) {
        const start = offsetAt(lineStarts, edit.range.start.line, edit.range.start.character);
        const end = offsetAt(lineStarts, edit.range.end.line, edit.range.end.character);
        output = `${output.slice(0, start)}${edit.newText}${output.slice(end)}`;
    }

    return output;
}

function computeLineStarts(text: string): number[] {
    const lineStarts = [0];
    for (let index = 0; index < text.length; index += 1) {
        if (text[index] === '\n') {
            lineStarts.push(index + 1);
        }
    }

    return lineStarts;
}

function offsetAt(lineStarts: readonly number[], line: number, character: number): number {
    const lineStart = lineStarts[line] ?? lineStarts[lineStarts.length - 1] ?? 0;
    return lineStart + character;
}

function normalizeDefinitionLocations(
    definition: Awaited<ReturnType<ProtocolConnection['sendRequest']>>
): Array<{ uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } }> {
    if (!definition) {
        return [];
    }

    const locations = Array.isArray(definition) ? definition : [definition];
    return locations.map((location) => ({
        uri: location.uri,
        range: {
            start: {
                line: location.range.start.line,
                character: location.range.start.character
            },
            end: {
                line: location.range.end.line,
                character: location.range.end.character
            }
        }
    }));
}

async function waitForChildExit(child: ChildProcess, timeoutMs: number): Promise<void> {
    if (child.exitCode !== null || child.killed) {
        return;
    }

    await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
            child.kill();
            reject(new Error(`Timed out waiting ${timeoutMs}ms for spawned server to exit.`));
        }, timeoutMs);

        child.once('exit', () => {
            clearTimeout(timeout);
            resolve();
        });
        child.once('error', (error) => {
            clearTimeout(timeout);
            reject(error);
        });
    });
}
