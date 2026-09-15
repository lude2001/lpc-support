#!/usr/bin/env node

import { execFileSync, fork, spawn } from 'child_process';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(import.meta.url);
const {
    CompletionRequest,
    DefinitionRequest,
    DidOpenTextDocumentNotification,
    ExitNotification,
    HoverRequest,
    InitializeRequest,
    InitializedNotification,
    PrepareRenameRequest,
    PublishDiagnosticsNotification,
    ReferencesRequest,
    SemanticTokensRequest,
    SignatureHelpRequest,
    ShutdownRequest
} = require('vscode-languageserver-protocol/node');
const { createProtocolConnection } = require('vscode-languageserver-protocol/node');
const {
    IPCMessageReader,
    IPCMessageWriter,
    StreamMessageReader,
    StreamMessageWriter
} = require('vscode-jsonrpc/node');

const WORKSPACE_CONFIG_SYNC_METHOD = 'lpc/workspaceConfigSync';
const HEALTH_METHOD = 'lpc/health';
const DEFAULT_OUTPUT_DIR = path.resolve(process.cwd(), '.tmp', 'lsp-probe');
const DEFAULT_DIAGNOSTIC_TIMEOUT_MS = 2500;
const DEFAULT_REQUEST_TIMEOUT_MS = 5000;

async function main() {
    const probeStartedAt = performance.now();
    const options = parseOptions(process.argv.slice(2), process.env);
    const project = loadProject(options.projectRoot);
    const targetFile = resolveProbeFile(project, options.file);
    if (!fs.existsSync(targetFile)) {
        throw new Error(`Probe target does not exist: ${targetFile}`);
    }

    const source = fs.readFileSync(targetFile, 'utf8');
    const uri = uriFromPath(targetFile);
    const position = options.position
        ? normalizePosition(options.position, source)
        : undefined;

    fs.mkdirSync(options.outputDir, { recursive: true });
    ensureLanguageServer(options.server);

    const serverStartedAt = performance.now();
    const server = await startServer(project, options.server);
    const startupWallMs = performance.now() - serverStartedAt;
    try {
        const diagnosticsPromise = server.waitForDiagnostics(uri, options.diagnosticTimeoutMs);
        const performanceStages = [];
        const runStage = async (name, action, fallback, timeoutMs = options.requestTimeoutMs) => {
            if (!options.perf) {
                return withTimeout(action(), timeoutMs, fallback);
            }

            const measured = await measureStage(server.connection, name, action, timeoutMs, fallback);
            performanceStages.push(measured.stage);
            return measured.result;
        };

        await runStage('didOpen', () => server.connection.sendNotification(DidOpenTextDocumentNotification.type, {
            textDocument: {
                uri,
                languageId: 'lpc',
                version: 1,
                text: source
            }
        }), { timedOut: true });

        let semanticTokens;
        if (options.semanticTokens || (options.perf && position)) {
            semanticTokens = await runStage(
                'semanticTokens',
                () => requestSemanticTokens(server.connection, uri),
                { timedOut: true, dataLength: 0 }
            );
        }

        const definition = position
            ? await runStage(
                'definition',
                () => requestDefinition(server.connection, project, uri, position),
                { timedOut: true, locationCount: 0, locations: [] }
            )
            : undefined;
        const references = position
            ? await runStage(
                'references',
                () => requestReferences(server.connection, project, uri, position),
                { timedOut: true, locationCount: 0, files: [] }
            )
            : undefined;
        const prepareRename = position
            ? await runStage(
                'prepareRename',
                () => requestPrepareRename(server.connection, uri, position),
                { timedOut: true, found: false, hasPlaceholder: false }
            )
            : undefined;
        const hover = position
            ? await runStage(
                'hover',
                () => requestHover(server.connection, uri, position),
                { timedOut: true, found: false, hasRange: false, contentKinds: [] }
            )
            : undefined;
        const signatureHelp = position
            ? await runStage(
                'signatureHelp',
                () => requestSignatureHelp(server.connection, uri, position),
                { timedOut: true, found: false, signatureCount: 0, parameterCounts: [], documentationCount: 0 }
            )
            : undefined;
        const completion = position
            ? await runStage(
                'completion',
                () => requestCompletion(server.connection, uri, position, options.includeCompletionLabels),
                { timedOut: true, itemCount: 0, isIncomplete: false }
            )
            : undefined;
        const functionDocumentation = options.server === 'rust'
            ? await runStage(
                'functionDocumentation',
                () => requestFunctionDocumentation(server.connection, uri),
                { timedOut: true, currentFileCount: 0, inheritedGroupCount: 0, inheritedEntryCount: 0, includeGroupCount: 0, includeEntryCount: 0, documentedEntryCount: 0 }
            )
            : undefined;

        let diagnostics;
        if (options.perf) {
            diagnostics = await runStage(
                'diagnostics.wait',
                () => diagnosticsPromise,
                [],
                options.diagnosticTimeoutMs
            );
        } else {
            diagnostics = await diagnosticsPromise;
        }
        const health = await server.connection.sendRequest(HEALTH_METHOD);
        const performanceBenchmarks = options.perf && position && options.perfIterations > 0
            ? await benchmarkRequests(server.connection, [
                ['semanticTokens', () => requestSemanticTokens(server.connection, uri), { timedOut: true }],
                ['definition', () => requestDefinition(server.connection, project, uri, position), { timedOut: true }],
                ['references', () => requestReferences(server.connection, project, uri, position), { timedOut: true }],
                ['hover', () => requestHover(server.connection, uri, position), { timedOut: true }],
                ['completion', () => requestCompletion(server.connection, uri, position, false), { timedOut: true }]
            ], options.perfIterations, options.requestTimeoutMs)
            : undefined;
        const processCpuTimeMs = readProcessCpuTimeMs(server.child.pid);
        const probeWallMs = performance.now() - probeStartedAt;

        const report = createReport({
            project,
            targetFile,
            position,
            health,
            diagnostics,
            definition,
            references,
            prepareRename,
            hover,
            signatureHelp,
            completion,
            functionDocumentation,
            semanticTokens,
            performanceStages: options.perf ? performanceStages : undefined,
            performanceBenchmarks,
            processMetrics: {
                startupWallMs,
                probeWallMs,
                processCpuTimeMs,
                averageCoreUtilization: Number.isFinite(processCpuTimeMs) && probeWallMs > 0
                    ? processCpuTimeMs / probeWallMs
                    : undefined
            }
        });

        const jsonPath = path.join(options.outputDir, 'latest.json');
        const mdPath = path.join(options.outputDir, 'latest.md');
        fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
        fs.writeFileSync(mdPath, renderMarkdown(report), 'utf8');

        console.log(`LSP probe written: ${jsonPath}`);
        console.log(`Summary written: ${mdPath}`);
        console.log(`Diagnostics: ${report.diagnostics.length}`);
        if (report.requests.definition) {
            console.log(`Definition locations: ${report.requests.definition.locationCount}`);
        }
        if (report.requests.completion) {
            console.log(`Completion items: ${report.requests.completion.itemCount}`);
        }
        if (Array.isArray(report.performance)) {
            for (const stage of report.performance) {
                console.log(
                    `${stage.name}: ${formatDuration(stage.durationMs)}, parse +${stage.parser.count}, semantic +${stage.semantic.count}`
                );
            }
        }
    } finally {
        await server.dispose();
    }
}

function readProcessCpuTimeMs(pid) {
    if (!Number.isInteger(pid) || pid <= 0) {
        return undefined;
    }

    try {
        if (process.platform === 'win32') {
            const output = execFileSync('powershell.exe', [
                '-NoProfile',
                '-NonInteractive',
                '-Command',
                `(Get-Process -Id ${pid} -ErrorAction Stop).TotalProcessorTime.TotalMilliseconds.ToString([Globalization.CultureInfo]::InvariantCulture)`
            ], { encoding: 'utf8', windowsHide: true });
            return Number(output.trim());
        }

        if (process.platform === 'linux') {
            const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
            const fields = stat.slice(stat.lastIndexOf(') ') + 2).trim().split(/\s+/);
            const ticksPerSecond = Number(execFileSync('getconf', ['CLK_TCK'], { encoding: 'utf8' }).trim());
            const userTicks = Number(fields[11]);
            const systemTicks = Number(fields[12]);
            return ((userTicks + systemTicks) / ticksPerSecond) * 1000;
        }

        const output = execFileSync('ps', ['-o', 'time=', '-p', String(pid)], { encoding: 'utf8' }).trim();
        const match = /^(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)$/.exec(output);
        if (!match) {
            return undefined;
        }
        const [, days = '0', hours = '0', minutes, seconds] = match;
        return ((((Number(days) * 24) + Number(hours)) * 60 + Number(minutes)) * 60 + Number(seconds)) * 1000;
    } catch {
        return undefined;
    }
}

function parseOptions(args, env) {
    const values = new Map();
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (!arg.startsWith('--')) {
            continue;
        }

        const separatorIndex = arg.indexOf('=');
        if (separatorIndex !== -1) {
            values.set(arg.slice(2, separatorIndex), arg.slice(separatorIndex + 1));
            continue;
        }

        const next = args[index + 1];
        if (next && !next.startsWith('--')) {
            values.set(arg.slice(2), next);
            index += 1;
        } else {
            values.set(arg.slice(2), 'true');
        }
    }

    const projectRoot = values.get('project') ?? env.LPC_PROBE_PROJECT;
    const file = values.get('file') ?? env.LPC_PROBE_FILE;
    if (!projectRoot) {
        throw new Error('Missing project root. Use --project or LPC_PROBE_PROJECT.');
    }
    if (!file) {
        throw new Error('Missing probe file. Use --file or LPC_PROBE_FILE.');
    }

    return {
        projectRoot: path.resolve(projectRoot),
        file,
        position: values.get('position') ?? env.LPC_PROBE_POSITION,
        outputDir: path.resolve(values.get('out') ?? env.LPC_PROBE_OUT ?? DEFAULT_OUTPUT_DIR),
        diagnosticTimeoutMs: Number(values.get('diagnostic-timeout-ms') ?? env.LPC_PROBE_DIAGNOSTIC_TIMEOUT_MS ?? DEFAULT_DIAGNOSTIC_TIMEOUT_MS)
            || DEFAULT_DIAGNOSTIC_TIMEOUT_MS,
        requestTimeoutMs: Number(values.get('request-timeout-ms') ?? env.LPC_PROBE_REQUEST_TIMEOUT_MS ?? DEFAULT_REQUEST_TIMEOUT_MS)
            || DEFAULT_REQUEST_TIMEOUT_MS,
        includeCompletionLabels: parseBoolean(values.get('include-completion-labels') ?? env.LPC_PROBE_INCLUDE_COMPLETION_LABELS),
        perf: parseBoolean(values.get('perf') ?? env.LPC_PROBE_PERF),
        perfIterations: Math.max(0, Number(values.get('perf-iterations') ?? env.LPC_PROBE_PERF_ITERATIONS ?? 0) || 0),
        semanticTokens: parseBoolean(values.get('semantic-tokens') ?? env.LPC_PROBE_SEMANTIC_TOKENS),
        server: values.get('server') ?? env.LPC_PROBE_SERVER ?? 'typescript'
    };
}

function loadProject(projectRoot) {
    const configPath = path.join(projectRoot, 'lpc-support.json');
    if (!fs.existsSync(configPath)) {
        throw new Error(`Missing lpc-support.json: ${configPath}`);
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const configHellPath = config.configHellPath;
    if (!configHellPath) {
        throw new Error('lpc-support.json must define configHellPath.');
    }

    const configHellAbsolutePath = path.resolve(projectRoot, configHellPath);
    const resolvedConfig = fs.existsSync(configHellAbsolutePath)
        ? parseConfigHell(fs.readFileSync(configHellAbsolutePath, 'utf8'))
        : undefined;
    const mudlibRoot = resolveMudlibRoot(projectRoot, configHellAbsolutePath, resolvedConfig?.mudlibDirectory);

    return {
        root: projectRoot,
        configPath,
        configHellPath,
        configHellAbsolutePath,
        preprocessorDefines: config.preprocessorDefines,
        instanceResolutionFunctions: config.instanceResolutionFunctions,
        resolvedConfig,
        mudlibRoot
    };
}

function parseConfigHell(source) {
    const fieldMap = new Map([
        ['name', 'name'],
        ['mudlib directory', 'mudlibDirectory'],
        ['binary directory', 'binaryDirectory'],
        ['include directories', 'includeDirectories'],
        ['simulated efun file', 'simulatedEfunFile'],
        ['master file', 'masterFile'],
        ['global include file', 'globalIncludeFile']
    ]);
    const result = {};

    for (const rawLine of source.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) {
            continue;
        }

        const separatorIndex = line.indexOf(':');
        if (separatorIndex === -1) {
            continue;
        }

        const key = line.slice(0, separatorIndex).trim().toLowerCase();
        const value = line.slice(separatorIndex + 1).trim();
        const mappedField = fieldMap.get(key);
        if (!mappedField || !value) {
            continue;
        }

        if (mappedField === 'includeDirectories') {
            const directories = value.split(':').map((entry) => entry.trim()).filter(Boolean);
            if (directories.length > 0) {
                result.includeDirectories = directories;
            }
            continue;
        }

        result[mappedField] = value;
    }

    return result;
}

function resolveMudlibRoot(projectRoot, configHellAbsolutePath, mudlibDirectory = '.') {
    if (isAbsolutePath(mudlibDirectory)) {
        return mudlibDirectory;
    }

    return path.resolve(path.dirname(configHellAbsolutePath), mudlibDirectory);
}

function resolveProbeFile(project, file) {
    if (isAbsolutePath(file)) {
        return path.resolve(file);
    }

    if (file.startsWith('/')) {
        return path.join(project.mudlibRoot, file.slice(1));
    }

    return path.resolve(project.root, file);
}

function normalizePosition(rawPosition, source) {
    const match = /^(\d+):(\d+)$/.exec(rawPosition.trim());
    if (!match) {
        throw new Error('Position must use 1-based "line:character", for example 12:8.');
    }

    const line = Number(match[1]) - 1;
    const character = Number(match[2]) - 1;
    const lines = source.split(/\r?\n/);
    if (line < 0 || line >= lines.length) {
        throw new Error(`Position line is outside the file: ${rawPosition}`);
    }
    if (character < 0 || character > (lines[line] ?? '').length) {
        throw new Error(`Position character is outside the line: ${rawPosition}`);
    }

    return { line, character };
}

function ensureLanguageServer(server) {
    if (server === 'rust') {
        const executable = rustServerExecutable();
        if (!fs.existsSync(executable)) {
            execFileSync(process.execPath, ['scripts/build-rust-lsp.mjs'], {
                cwd: process.cwd(),
                stdio: 'inherit'
            });
        }
        return;
    }
    if (server !== 'typescript') {
        throw new Error(`Unsupported LSP server '${server}'. Use 'typescript' or 'rust'.`);
    }

    const serverModule = path.resolve(process.cwd(), 'dist', 'lsp', 'server.js');
    try {
        execFileSync(process.execPath, ['esbuild.mjs'], {
            cwd: process.cwd(),
            stdio: 'pipe'
        });
    } catch (error) {
        const stderr = error && typeof error === 'object' && 'stderr' in error
            ? String(error.stderr ?? '')
            : '';
        throw new Error([
            `Failed to prepare LSP server bundle at ${serverModule}.`,
            stderr || String(error)
        ].join('\n'));
    }
}

async function startServer(project, serverKind) {
    const child = serverKind === 'rust'
        ? spawn(rustServerExecutable(), [], {
            cwd: process.cwd(),
            env: { ...process.env },
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true
        })
        : fork(path.resolve(process.cwd(), 'dist', 'lsp', 'server.js'), ['--node-ipc'], {
            cwd: process.cwd(),
            env: { ...process.env },
            silent: true,
            stdio: ['pipe', 'pipe', 'pipe', 'ipc']
        });

    if (serverKind === 'typescript' && !child.channel) {
        throw new Error('TypeScript LSP server process did not expose an IPC channel.');
    }

    const stderr = [];
    child.stderr?.on('data', (chunk) => stderr.push(String(chunk)));

    const connection = serverKind === 'rust'
        ? createProtocolConnection(
            new StreamMessageReader(child.stdout),
            new StreamMessageWriter(child.stdin)
        )
        : createProtocolConnection(
            new IPCMessageReader(child),
            new IPCMessageWriter(child)
        );
    const server = new ProbeServer(child, connection, stderr);
    connection.listen();

    try {
        await connection.sendRequest(InitializeRequest.type, {
            processId: process.pid,
            rootUri: uriFromPath(project.root),
            capabilities: {},
            workspaceFolders: [
                {
                    uri: uriFromPath(project.root),
                    name: path.basename(project.root)
                }
            ]
        });
        await connection.sendNotification(InitializedNotification.type, {});
        const workspaceConfig = {
            workspaceRoots: [project.root],
            workspaces: [
                {
                    workspaceRoot: project.root,
                    projectConfigPath: project.configPath,
                    configHellPath: project.configHellPath,
                    preprocessorDefines: project.preprocessorDefines,
                    instanceResolutionFunctions: project.instanceResolutionFunctions,
                    resolvedConfig: project.resolvedConfig,
                    lastSyncedAt: new Date().toISOString()
                }
            ]
        };
        await connection.sendNotification(WORKSPACE_CONFIG_SYNC_METHOD, workspaceConfig);
        if (serverKind === 'rust') {
            await connection.sendRequest('lpc/workspaceIndex/rebuild', workspaceConfig);
        }
        return server;
    } catch (error) {
        await server.dispose();
        throw new Error([
            'Failed to start LPC language server.',
            error instanceof Error ? error.message : String(error),
            stderr.length > 0 ? `stderr:\n${stderr.join('')}` : 'stderr: <empty>'
        ].join('\n'));
    }
}

function rustServerExecutable() {
    const executableName = process.platform === 'win32'
        ? 'lpc-language-server.exe'
        : 'lpc-language-server';
    return path.resolve(process.cwd(), 'dist', 'bin', executableName);
}

class ProbeServer {
    constructor(child, connection, stderr) {
        this.child = child;
        this.connection = connection;
        this.stderr = stderr;
        this.listeners = new Map();
        this.shuttingDown = false;

        this.connection.onNotification(PublishDiagnosticsNotification.type, (params) => {
            const listeners = this.listeners.get(params.uri);
            if (!listeners || listeners.length === 0) {
                return;
            }

            this.listeners.delete(params.uri);
            for (const listener of listeners) {
                listener(params.diagnostics ?? []);
            }
        });
    }

    waitForDiagnostics(uri, timeoutMs) {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                const listeners = this.listeners.get(uri) ?? [];
                this.listeners.set(
                    uri,
                    listeners.filter((listener) => listener !== resolveWithCleanup)
                );
                resolve([]);
            }, timeoutMs);

            const resolveWithCleanup = (diagnostics) => {
                clearTimeout(timeout);
                resolve(diagnostics);
            };

            const listeners = this.listeners.get(uri) ?? [];
            listeners.push(resolveWithCleanup);
            this.listeners.set(uri, listeners);
        });
    }

    async dispose() {
        if (this.shuttingDown) {
            return;
        }

        this.shuttingDown = true;
        try {
            await this.connection.sendRequest(ShutdownRequest.type);
        } catch {
            // The process may already be down.
        }
        try {
            await this.connection.sendNotification(ExitNotification.type);
        } catch {
            // The process may already be down.
        }
        this.connection.dispose();
        await waitForChildExit(this.child, 5000);
    }
}

async function requestDefinition(connection, project, uri, position) {
    const result = await connection.sendRequest(DefinitionRequest.type, {
        textDocument: { uri },
        position
    });
    const locations = normalizeLocations(project, result);
    return {
        locationCount: locations.length,
        locations
    };
}

async function requestReferences(connection, project, uri, position) {
    const result = await connection.sendRequest(ReferencesRequest.type, {
        textDocument: { uri },
        position,
        context: { includeDeclaration: true }
    });
    const locations = normalizeLocations(project, result);
    return {
        locationCount: locations.length,
        files: [...new Set(locations.map((location) => location.file))].sort()
    };
}

async function requestPrepareRename(connection, uri, position) {
    const result = await connection.sendRequest(PrepareRenameRequest.type, {
        textDocument: { uri },
        position
    });
    return {
        found: Boolean(result),
        hasPlaceholder: Boolean(result && !('start' in result) && result.placeholder)
    };
}

async function requestHover(connection, uri, position) {
    const result = await connection.sendRequest(HoverRequest.type, {
        textDocument: { uri },
        position
    });
    const text = hoverText(result?.contents);

    return {
        found: Boolean(result),
        hasRange: Boolean(result?.range),
        contentKinds: hoverContentKinds(result?.contents),
        contentLength: text.length,
        hasProseAfterCodeBlock: /```[\s\S]*?```\s*\S/.test(text)
    };
}

async function requestSignatureHelp(connection, uri, position) {
    const result = await connection.sendRequest(SignatureHelpRequest.type, {
        textDocument: { uri },
        position,
        context: {
            triggerKind: 1,
            isRetrigger: false
        }
    });
    const signatures = result?.signatures ?? [];

    return {
        found: signatures.length > 0,
        signatureCount: signatures.length,
        parameterCounts: signatures.map((signature) => signature.parameters?.length ?? 0),
        documentationCount: signatures.filter((signature) => Boolean(signature.documentation)).length,
        activeSignature: result?.activeSignature,
        activeParameter: result?.activeParameter
    };
}

async function requestFunctionDocumentation(connection, uri) {
    const result = await connection.sendRequest('lpc/functionDocumentation', {
        textDocument: { uri }
    });
    const currentEntries = result?.currentFile?.entries ?? [];
    const inheritedGroups = result?.inheritedGroups ?? [];
    const includeGroups = result?.includeGroups ?? [];
    const allEntries = [
        ...currentEntries,
        ...inheritedGroups.flatMap(group => group.entries ?? []),
        ...includeGroups.flatMap(group => group.entries ?? [])
    ];
    return {
        currentFileCount: currentEntries.length,
        inheritedGroupCount: inheritedGroups.length,
        inheritedEntryCount: inheritedGroups.reduce((total, group) => total + (group.entries?.length ?? 0), 0),
        includeGroupCount: includeGroups.length,
        includeEntryCount: includeGroups.reduce((total, group) => total + (group.entries?.length ?? 0), 0),
        documentedEntryCount: allEntries.filter(entry => Boolean(entry.documentation)).length
    };
}

async function requestCompletion(connection, uri, position, includeLabels) {
    const result = await connection.sendRequest(CompletionRequest.type, {
        textDocument: { uri },
        position,
        context: {
            triggerKind: 1
        }
    });
    const items = Array.isArray(result) ? result : result?.items ?? [];

    const summary = {
        itemCount: items.length,
        isIncomplete: Boolean(!Array.isArray(result) && result?.isIncomplete),
        snippetCount: items.filter((item) => item.insertTextFormat === 2
            || (typeof item.insertText === 'string' && item.insertText.includes('$'))).length,
        documentationCount: items.filter((item) => Boolean(item.documentation)).length
    };

    if (includeLabels) {
        summary.sampleLabels = items.slice(0, 20).map((item) => item.label);
    }

    return summary;
}

async function requestSemanticTokens(connection, uri) {
    const result = await connection.sendRequest(SemanticTokensRequest.type, {
        textDocument: { uri }
    });

    return {
        dataLength: Array.isArray(result?.data) ? result.data.length : 0
    };
}

async function measureStage(connection, name, action, timeoutMs, fallback) {
    const before = await readPerformanceCounters(connection);
    const startedAt = performance.now();
    const result = await withTimeout(action(), timeoutMs, fallback);
    const durationMs = performance.now() - startedAt;
    const after = await readPerformanceCounters(connection);

    return {
        result,
        stage: {
            name,
            durationMs,
            timedOut: Boolean(result?.timedOut),
            parser: diffCounters(before.parser, after.parser),
            semantic: diffCounters(before.semantic, after.semantic)
        }
    };
}

async function benchmarkRequests(connection, requests, iterations, timeoutMs) {
    const reports = [];
    for (const [name, action, fallback] of requests) {
        const before = await readPerformanceCounters(connection);
        const durations = [];
        let timedOut = 0;
        for (let iteration = 0; iteration < iterations; iteration += 1) {
            const startedAt = performance.now();
            const result = await withTimeout(action(), timeoutMs, fallback);
            durations.push(performance.now() - startedAt);
            if (result?.timedOut) {
                timedOut += 1;
            }
        }
        const after = await readPerformanceCounters(connection);
        durations.sort((left, right) => left - right);
        reports.push({
            name,
            iterations,
            timedOut,
            meanMs: durations.reduce((sum, value) => sum + value, 0) / durations.length,
            p50Ms: percentile(durations, 50),
            p95Ms: percentile(durations, 95),
            maxMs: durations.at(-1) ?? 0,
            parser: diffCounters(before.parser, after.parser),
            semantic: diffCounters(before.semantic, after.semantic)
        });
    }
    return reports;
}

function percentile(sorted, value) {
    if (sorted.length === 0) {
        return 0;
    }
    const index = Math.ceil((sorted.length - 1) * value / 100);
    return sorted[index];
}

async function readPerformanceCounters(connection) {
    const health = await connection.sendRequest(HEALTH_METHOD);
    return {
        parser: {
            count: Number(health?.performance?.parser?.parseCount ?? health?.performance?.syntax?.parseCount ?? 0),
            totalTimeMs: Number(
                health?.performance?.parser?.totalParseTime
                ?? (health?.performance?.syntax?.totalParseTimeMicros ?? 0) / 1000
            ),
            files: normalizeFileCounters(health?.performance?.parser?.parseFiles)
        },
        semantic: {
            count: Number(
                health?.performance?.semantic?.buildCount
                ?? health?.performance?.analysisSnapshotBuildCount
                ?? 0
            ),
            totalTimeMs: Number(
                health?.performance?.semantic?.totalBuildTimeMs
                ?? (health?.performance?.analysisTotalBuildTimeMicros ?? 0) / 1000
            ),
            files: normalizeFileCounters(health?.performance?.semantic?.buildFiles)
        }
    };
}

function diffCounters(before, after) {
    return {
        count: after.count - before.count,
        totalTimeMs: after.totalTimeMs - before.totalTimeMs,
        files: diffFileCounters(before.files, after.files)
    };
}

function normalizeFileCounters(files) {
    const result = new Map();
    for (const file of Array.isArray(files) ? files : []) {
        if (!file?.uri) {
            continue;
        }

        result.set(file.uri, {
            uri: file.uri,
            count: Number(file.count ?? 0),
            totalTimeMs: Number(file.totalTimeMs ?? 0)
        });
    }

    return result;
}

function diffFileCounters(before, after) {
    const result = [];
    const uris = new Set([...before.keys(), ...after.keys()]);
    for (const uri of uris) {
        const previous = before.get(uri) ?? { count: 0, totalTimeMs: 0 };
        const next = after.get(uri) ?? { count: 0, totalTimeMs: 0 };
        const count = next.count - previous.count;
        const totalTimeMs = next.totalTimeMs - previous.totalTimeMs;
        if (count <= 0 && totalTimeMs <= 0) {
            continue;
        }

        result.push({ uri, count, totalTimeMs });
    }

    return result.sort((left, right) => right.totalTimeMs - left.totalTimeMs || right.count - left.count);
}

async function withTimeout(promise, timeoutMs, fallback) {
    let timeout;
    try {
        return await Promise.race([
            promise,
            new Promise((resolve) => {
                timeout = setTimeout(() => resolve(fallback), timeoutMs);
            })
        ]);
    } finally {
        if (timeout) {
            clearTimeout(timeout);
        }
    }
}

function createReport({
    project,
    targetFile,
    position,
    health,
    diagnostics,
    definition,
    references,
    prepareRename,
    hover,
    signatureHelp,
    completion,
    functionDocumentation,
    semanticTokens,
    performanceStages,
    performanceBenchmarks,
    processMetrics
}) {
    return {
        generatedAt: new Date().toISOString(),
        privacy: {
            sourceTextIncluded: false,
            projectRootIncluded: false,
            snippetsIncluded: false,
            completionLabelsIncluded: Boolean(completion?.sampleLabels)
        },
        project: {
            root: '<redacted-project-root>',
            configPath: toProjectRelativePath(project, project.configPath),
            configHellPath: project.configHellPath,
            preprocessorDefines: sanitizePreprocessorDefines(project.preprocessorDefines),
            mudlibRoot: toProjectRelativePath(project, project.mudlibRoot),
            resolvedConfig: sanitizeResolvedConfig(project)
        },
        target: {
            file: toMudlibPath(project, targetFile),
            position: position ? toOneBasedPosition(position) : undefined
        },
        health: {
            status: health?.status,
            mode: health?.mode,
            serverVersion: health?.serverVersion,
            documentCount: health?.documentCount,
            performance: sanitizeHealthPerformance(health?.performance)
        },
        processMetrics,
        diagnostics: diagnostics.map((diagnostic) => sanitizeDiagnostic(project, diagnostic)),
        requests: {
            semanticTokens,
            definition,
            references,
            prepareRename,
            hover,
            signatureHelp,
            completion,
            functionDocumentation
        },
        performance: performanceStages?.map(stage => sanitizePerformanceStage(project, stage)),
        performanceBenchmarks: performanceBenchmarks?.map(stage => sanitizePerformanceStage(project, stage))
    };
}

function sanitizePreprocessorDefines(defines) {
    return Array.isArray(defines)
        ? defines.filter((define) => typeof define === 'string')
        : [];
}

function sanitizeHealthPerformance(performance) {
    if (!performance) {
        return undefined;
    }

    return {
        documents: performance.documents ? {
            openCount: performance.documents.openCount,
            closeCount: performance.documents.closeCount,
            fullReplacementCount: performance.documents.fullReplacementCount,
            incrementalEditCount: performance.documents.incrementalEditCount,
            rejectedChangeCount: performance.documents.rejectedChangeCount
        } : undefined,
        syntax: performance.syntax ? {
            parseCount: performance.syntax.parseCount,
            fullParseCount: performance.syntax.fullParseCount,
            incrementalParseCount: performance.syntax.incrementalParseCount,
            totalParseTimeMicros: performance.syntax.totalParseTimeMicros
        } : undefined,
        processMemory: performance.processMemory ? {
            residentBytes: performance.processMemory.residentBytes,
            peakResidentBytes: performance.processMemory.peakResidentBytes
        } : undefined,
        analysisSnapshotBuildCount: performance.analysisSnapshotBuildCount,
        analysisQueryCount: performance.analysisQueryCount,
        analysisTotalBuildTimeMicros: performance.analysisTotalBuildTimeMicros,
        indexedFileCount: performance.indexedFileCount,
        parser: performance.parser ? {
            parseCount: performance.parser.parseCount,
            totalParseTime: performance.parser.totalParseTime,
            avgParseTime: performance.parser.avgParseTime
        } : undefined,
        semantic: performance.semantic ? {
            totalSnapshots: performance.semantic.totalSnapshots,
            buildCount: performance.semantic.buildCount,
            totalBuildTimeMs: performance.semantic.totalBuildTimeMs
        } : undefined
    };
}

function sanitizePerformanceStage(project, stage) {
    return {
        ...stage,
        parser: sanitizeCounter(project, stage.parser),
        semantic: sanitizeCounter(project, stage.semantic)
    };
}

function sanitizeCounter(project, counter) {
    return {
        count: counter.count,
        totalTimeMs: counter.totalTimeMs,
        files: counter.files.map(file => ({
            file: uriToSafePath(project, file.uri),
            count: file.count,
            totalTimeMs: file.totalTimeMs
        }))
    };
}

function sanitizeResolvedConfig(project) {
    const config = project.resolvedConfig ?? {};
    return {
        name: config.name ? '<redacted-config-name>' : undefined,
        mudlibDirectory: config.mudlibDirectory,
        includeDirectories: config.includeDirectories,
        simulatedEfunFile: config.simulatedEfunFile,
        masterFile: config.masterFile,
        globalIncludeFile: config.globalIncludeFile
    };
}

function sanitizeDiagnostic(project, diagnostic) {
    return {
        severity: diagnosticSeverityName(diagnostic.severity),
        code: diagnostic.code,
        source: diagnostic.source,
        message: diagnostic.message,
        range: toOneBasedRange(diagnostic.range),
        relatedInformation: (diagnostic.relatedInformation ?? []).map((entry) => ({
            message: entry.message,
            location: {
                file: uriToSafePath(project, entry.location?.uri),
                range: toOneBasedRange(entry.location?.range)
            }
        }))
    };
}

function normalizeLocations(project, result) {
    if (!result) {
        return [];
    }

    const locations = Array.isArray(result) ? result : [result];
    return locations.map((location) => ({
        file: uriToSafePath(project, location.uri),
        range: toOneBasedRange(location.range)
    }));
}

function uriToSafePath(project, uri) {
    if (!uri) {
        return undefined;
    }

    const filePath = pathFromUri(uri);
    if (!filePath) {
        return '<non-file-uri>';
    }

    return toMudlibPath(project, filePath);
}

function hoverContentKinds(contents) {
    if (!contents) {
        return [];
    }

    const entries = Array.isArray(contents) ? contents : [contents];
    return entries.map((entry) => {
        if (typeof entry === 'string') {
            return 'string';
        }
        return entry.kind ?? 'unknown';
    });
}

function hoverText(contents) {
    if (!contents) {
        return '';
    }

    const entries = Array.isArray(contents) ? contents : [contents];
    return entries.map((entry) => {
        if (typeof entry === 'string') {
            return entry;
        }
        return typeof entry.value === 'string' ? entry.value : '';
    }).join('\n');
}

function renderMarkdown(report) {
    const lines = [
        '# LSP Probe Report',
        '',
        `- Generated: ${report.generatedAt}`,
        `- Project: ${report.project.root}`,
        `- Config: ${report.project.configHellPath}`,
        `- Target: ${report.target.file}`,
        `- Position: ${report.target.position ? `${report.target.position.line}:${report.target.position.character}` : '(not requested)'}`,
        `- Source included: ${report.privacy.sourceTextIncluded ? 'yes' : 'no'}`,
        `- Completion labels included: ${report.privacy.completionLabelsIncluded ? 'yes' : 'no'}`,
        '',
        '## Health',
        '',
        `- Status: ${report.health.status ?? '(unknown)'}`,
        `- Server version: ${report.health.serverVersion ?? '(unknown)'}`,
        `- Documents: ${report.health.documentCount ?? '(unknown)'}`,
        `- Resident memory: ${formatBytes(report.health.performance?.processMemory?.residentBytes)}`,
        `- Peak resident memory: ${formatBytes(report.health.performance?.processMemory?.peakResidentBytes)}`,
        `- Workspace startup wall time: ${formatDuration(report.processMetrics?.startupWallMs)}`,
        `- Probe process CPU time: ${formatOptionalDuration(report.processMetrics?.processCpuTimeMs)}`,
        `- Average server core utilization: ${formatRatio(report.processMetrics?.averageCoreUtilization)}`,
        '',
        '## Diagnostics',
        ''
    ];

    if (report.diagnostics.length === 0) {
        lines.push('- No diagnostics reported before timeout.');
    } else {
        for (const diagnostic of report.diagnostics) {
            lines.push(`- ${diagnostic.severity} ${formatRange(diagnostic.range)} ${diagnostic.message}`);
        }
    }

    lines.push('', '## Requests', '');
    if (report.requests.semanticTokens) {
        lines.push(`- Semantic tokens data length: ${report.requests.semanticTokens.dataLength ?? 0}${report.requests.semanticTokens.timedOut ? ' (timed out)' : ''}`);
    } else {
        lines.push('- Semantic tokens: not requested');
    }

    if (report.requests.definition) {
        lines.push(`- Definition locations: ${report.requests.definition.locationCount}${report.requests.definition.timedOut ? ' (timed out)' : ''}`);
        for (const location of report.requests.definition.locations) {
            lines.push(`  - ${location.file} ${formatRange(location.range)}`);
        }
    } else {
        lines.push('- Definition: not requested');
    }

    if (report.requests.references) {
        lines.push(`- References: ${report.requests.references.locationCount}${report.requests.references.timedOut ? ' (timed out)' : ''}`);
        lines.push(`- Reference files: ${report.requests.references.files.join(', ') || '(none)'}`);
    } else {
        lines.push('- References: not requested');
    }

    if (report.requests.prepareRename) {
        lines.push(`- Prepare rename: ${report.requests.prepareRename.found ? 'yes' : 'no'}${report.requests.prepareRename.timedOut ? ' (timed out)' : ''}`);
    } else {
        lines.push('- Prepare rename: not requested');
    }

    if (report.requests.hover) {
        lines.push(`- Hover found: ${report.requests.hover.found ? 'yes' : 'no'}${report.requests.hover.timedOut ? ' (timed out)' : ''}`);
        lines.push(`- Hover content kinds: ${report.requests.hover.contentKinds.join(', ') || '(none)'}`);
        lines.push(`- Hover content length: ${report.requests.hover.contentLength ?? 0}; prose after code block: ${report.requests.hover.hasProseAfterCodeBlock ? 'yes' : 'no'}`);
    } else {
        lines.push('- Hover: not requested');
    }

    if (report.requests.signatureHelp) {
        lines.push(`- Signature help found: ${report.requests.signatureHelp.found ? 'yes' : 'no'}${report.requests.signatureHelp.timedOut ? ' (timed out)' : ''}`);
        lines.push(`- Signatures: ${report.requests.signatureHelp.signatureCount}; parameters: ${report.requests.signatureHelp.parameterCounts.join(', ') || '(none)'}; documented: ${report.requests.signatureHelp.documentationCount}`);
    } else {
        lines.push('- Signature help: not requested');
    }

    if (report.requests.completion) {
        lines.push(`- Completion items: ${report.requests.completion.itemCount}${report.requests.completion.timedOut ? ' (timed out)' : ''}`);
        lines.push(`- Completion snippets: ${report.requests.completion.snippetCount ?? 0}; documented: ${report.requests.completion.documentationCount ?? 0}`);
        if (report.requests.completion.sampleLabels) {
            lines.push(`- Completion sample labels: ${report.requests.completion.sampleLabels.join(', ') || '(none)'}`);
        }
    } else {
        lines.push('- Completion: not requested');
    }

    if (report.requests.functionDocumentation) {
        const docs = report.requests.functionDocumentation;
        lines.push(`- Function docs: local ${docs.currentFileCount}; inherit ${docs.inheritedGroupCount} groups/${docs.inheritedEntryCount} entries; include ${docs.includeGroupCount} groups/${docs.includeEntryCount} entries; documented ${docs.documentedEntryCount}${docs.timedOut ? ' (timed out)' : ''}`);
    } else {
        lines.push('- Function docs: not requested');
    }

    if (Array.isArray(report.performance) && report.performance.length > 0) {
        lines.push('', '## Performance', '');
        for (const stage of report.performance) {
            lines.push(
                `- ${stage.name}: ${formatDuration(stage.durationMs)}; parse +${stage.parser.count} (${formatDuration(stage.parser.totalTimeMs)}); semantic +${stage.semantic.count} (${formatDuration(stage.semantic.totalTimeMs)})${stage.timedOut ? ' (timed out)' : ''}`
            );
            for (const file of summarizePerformanceFiles(stage)) {
                lines.push(`  - ${file.kind}: ${file.file} +${file.count} (${formatDuration(file.totalTimeMs)})`);
            }
        }
    }

    if (Array.isArray(report.performanceBenchmarks) && report.performanceBenchmarks.length > 0) {
        lines.push('', '## Warm request benchmark', '');
        for (const stage of report.performanceBenchmarks) {
            lines.push(
                `- ${stage.name}: n=${stage.iterations}; mean ${formatDuration(stage.meanMs)}; p50 ${formatDuration(stage.p50Ms)}; p95 ${formatDuration(stage.p95Ms)}; max ${formatDuration(stage.maxMs)}; timeouts ${stage.timedOut}; parse +${stage.parser.count}; semantic +${stage.semantic.count}`
            );
        }
    }

    lines.push('');
    return `${lines.join('\n')}\n`;
}

function formatDuration(value) {
    if (!Number.isFinite(value)) {
        return '0.0ms';
    }

    return `${value.toFixed(1)}ms`;
}

function formatOptionalDuration(value) {
    return Number.isFinite(value) ? formatDuration(value) : '(unavailable)';
}

function formatBytes(value) {
    if (!Number.isFinite(value) || value <= 0) {
        return '(unavailable)';
    }
    return `${(value / 1024 / 1024).toFixed(1)} MiB`;
}

function formatRatio(value) {
    if (!Number.isFinite(value) || value < 0) {
        return '(unavailable)';
    }
    return `${(value * 100).toFixed(1)}% of one logical core`;
}

function summarizePerformanceFiles(stage) {
    const files = [];
    for (const file of stage.parser.files ?? []) {
        files.push({ ...file, kind: 'parse' });
    }
    for (const file of stage.semantic.files ?? []) {
        files.push({ ...file, kind: 'semantic' });
    }

    return files
        .sort((left, right) => right.totalTimeMs - left.totalTimeMs || right.count - left.count)
        .slice(0, 8);
}

function formatRange(range) {
    if (!range) {
        return '';
    }

    return `${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`;
}

function toOneBasedRange(range) {
    if (!range) {
        return undefined;
    }

    return {
        start: toOneBasedPosition(range.start),
        end: toOneBasedPosition(range.end)
    };
}

function toOneBasedPosition(position) {
    return {
        line: position.line + 1,
        character: position.character + 1
    };
}

function diagnosticSeverityName(severity) {
    switch (severity) {
        case 1:
            return 'error';
        case 2:
            return 'warning';
        case 3:
            return 'information';
        case 4:
            return 'hint';
        default:
            return 'unknown';
    }
}

function parseBoolean(value) {
    if (value === undefined) {
        return false;
    }

    return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function toProjectRelativePath(project, targetPath) {
    const relative = path.relative(project.root, targetPath);
    if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
        return normalizeSlash(relative || '.');
    }

    return '<outside-project>';
}

function toMudlibPath(project, targetPath) {
    const relativeToMudlib = path.relative(project.mudlibRoot, targetPath);
    if (!relativeToMudlib.startsWith('..') && !path.isAbsolute(relativeToMudlib)) {
        return `/${normalizeSlash(relativeToMudlib)}`;
    }

    const relativeToProject = path.relative(project.root, targetPath);
    if (!relativeToProject.startsWith('..') && !path.isAbsolute(relativeToProject)) {
        return normalizeSlash(relativeToProject);
    }

    return '<outside-project>';
}

function normalizeSlash(value) {
    return value.replace(/\\/g, '/');
}

function uriFromPath(filePath) {
    const normalizedPath = filePath.replace(/\\/g, '/');
    return normalizedPath.startsWith('/')
        ? `file://${encodeURI(normalizedPath)}`
        : `file:///${encodeURI(normalizedPath)}`;
}

function pathFromUri(uri) {
    if (!uri.startsWith('file://')) {
        return undefined;
    }

    const url = new URL(uri);
    let pathname = decodeURIComponent(url.pathname);
    if (os.platform() === 'win32' && /^\/[A-Za-z]:\//.test(pathname)) {
        pathname = pathname.slice(1);
    }

    return pathname.replace(/\//g, path.sep);
}

function isAbsolutePath(targetPath) {
    return /^[A-Za-z]:[\\/]/.test(targetPath) || targetPath.startsWith('\\\\');
}

async function waitForChildExit(child, timeoutMs) {
    if (child.exitCode !== null || child.killed) {
        return;
    }

    await new Promise((resolve) => {
        const timeout = setTimeout(() => {
            child.kill();
            resolve();
        }, timeoutMs);

        child.once('exit', () => {
            clearTimeout(timeout);
            resolve();
        });
        child.once('error', () => {
            clearTimeout(timeout);
            resolve();
        });
    });
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
