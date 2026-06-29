#!/usr/bin/env node

import { execFileSync, fork } from 'child_process';
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
    PublishDiagnosticsNotification,
    SemanticTokensRequest,
    ShutdownRequest
} = require('vscode-languageserver-protocol/node');
const { createProtocolConnection } = require('vscode-languageserver-protocol/node');
const { IPCMessageReader, IPCMessageWriter } = require('vscode-jsonrpc/node');

const WORKSPACE_CONFIG_SYNC_METHOD = 'lpc/workspaceConfigSync';
const HEALTH_METHOD = 'lpc/health';
const DEFAULT_OUTPUT_DIR = path.resolve(process.cwd(), '.tmp', 'lsp-probe');
const DEFAULT_DIAGNOSTIC_TIMEOUT_MS = 2500;
const DEFAULT_REQUEST_TIMEOUT_MS = 5000;

async function main() {
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
    ensureServerBundle();

    const server = await startServer(project, uri);
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
        if (options.perf && position) {
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
        const hover = position
            ? await runStage(
                'hover',
                () => requestHover(server.connection, uri, position),
                { timedOut: true, found: false, hasRange: false, contentKinds: [] }
            )
            : undefined;
        const completion = position
            ? await runStage(
                'completion',
                () => requestCompletion(server.connection, uri, position, options.includeCompletionLabels),
                { timedOut: true, itemCount: 0, isIncomplete: false }
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

        const report = createReport({
            project,
            targetFile,
            position,
            health,
            diagnostics,
            definition,
            hover,
            completion,
            semanticTokens,
            performanceStages: options.perf ? performanceStages : undefined
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
        perf: parseBoolean(values.get('perf') ?? env.LPC_PROBE_PERF)
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

function ensureServerBundle() {
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

async function startServer(project) {
    const serverModule = path.resolve(process.cwd(), 'dist', 'lsp', 'server.js');
    const child = fork(serverModule, ['--node-ipc'], {
        cwd: process.cwd(),
        env: { ...process.env },
        silent: true,
        stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    });

    if (!child.channel) {
        throw new Error('LSP server process did not expose an IPC channel.');
    }

    const stderr = [];
    child.stdout?.on('data', () => undefined);
    child.stderr?.on('data', (chunk) => stderr.push(String(chunk)));

    const connection = createProtocolConnection(
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
        await connection.sendNotification(WORKSPACE_CONFIG_SYNC_METHOD, {
            workspaceRoots: [project.root],
            workspaces: [
                {
                    workspaceRoot: project.root,
                    projectConfigPath: project.configPath,
                    configHellPath: project.configHellPath,
                    instanceResolutionFunctions: project.instanceResolutionFunctions,
                    resolvedConfig: project.resolvedConfig,
                    lastSyncedAt: new Date().toISOString()
                }
            ]
        });
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

async function requestHover(connection, uri, position) {
    const result = await connection.sendRequest(HoverRequest.type, {
        textDocument: { uri },
        position
    });

    return {
        found: Boolean(result),
        hasRange: Boolean(result?.range),
        contentKinds: hoverContentKinds(result?.contents)
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
        isIncomplete: Boolean(!Array.isArray(result) && result?.isIncomplete)
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

async function readPerformanceCounters(connection) {
    const health = await connection.sendRequest(HEALTH_METHOD);
    return {
        parser: {
            count: Number(health?.performance?.parser?.parseCount ?? 0),
            totalTimeMs: Number(health?.performance?.parser?.totalParseTime ?? 0),
            files: normalizeFileCounters(health?.performance?.parser?.parseFiles)
        },
        semantic: {
            count: Number(health?.performance?.semantic?.buildCount ?? 0),
            totalTimeMs: Number(health?.performance?.semantic?.totalBuildTimeMs ?? 0),
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
    hover,
    completion,
    semanticTokens,
    performanceStages
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
        diagnostics: diagnostics.map((diagnostic) => sanitizeDiagnostic(project, diagnostic)),
        requests: {
            semanticTokens,
            definition,
            hover,
            completion
        },
        performance: performanceStages?.map(stage => sanitizePerformanceStage(project, stage))
    };
}

function sanitizeHealthPerformance(performance) {
    if (!performance) {
        return undefined;
    }

    return {
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

    if (report.requests.hover) {
        lines.push(`- Hover found: ${report.requests.hover.found ? 'yes' : 'no'}${report.requests.hover.timedOut ? ' (timed out)' : ''}`);
        lines.push(`- Hover content kinds: ${report.requests.hover.contentKinds.join(', ') || '(none)'}`);
    } else {
        lines.push('- Hover: not requested');
    }

    if (report.requests.completion) {
        lines.push(`- Completion items: ${report.requests.completion.itemCount}${report.requests.completion.timedOut ? ' (timed out)' : ''}`);
        if (report.requests.completion.sampleLabels) {
            lines.push(`- Completion sample labels: ${report.requests.completion.sampleLabels.join(', ') || '(none)'}`);
        }
    } else {
        lines.push('- Completion: not requested');
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

    lines.push('');
    return `${lines.join('\n')}\n`;
}

function formatDuration(value) {
    if (!Number.isFinite(value)) {
        return '0.0ms';
    }

    return `${value.toFixed(1)}ms`;
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
