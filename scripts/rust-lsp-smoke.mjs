import { spawn } from 'child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
import {
    createMessageConnection,
    StreamMessageReader,
    StreamMessageWriter
} from 'vscode-jsonrpc/node.js';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const executableName = process.platform === 'win32'
    ? 'lpc-language-server.exe'
    : 'lpc-language-server';
const executable = process.env.LPC_RUST_SERVER_PATH
    ? path.resolve(process.env.LPC_RUST_SERVER_PATH)
    : path.join(repositoryRoot, 'dist', 'bin', executableName);

if (!existsSync(executable)) {
    throw new Error(`Rust LSP binary not found at ${executable}. Run npm run build:rust first.`);
}

const child = spawn(executable, [], {
    cwd: repositoryRoot,
    stdio: ['pipe', 'pipe', 'inherit'],
    windowsHide: true
});
const connection = createMessageConnection(
    new StreamMessageReader(child.stdout),
    new StreamMessageWriter(child.stdin)
);
connection.listen();

let latestDiagnostics;
connection.onNotification('textDocument/publishDiagnostics', (params) => {
    latestDiagnostics = params;
});
const smokeWorkspace = mkdtempSync(path.join(tmpdir(), 'lpc-rust-smoke-'));

try {
    const initialize = await connection.sendRequest('initialize', {
        processId: process.pid,
        rootUri: null,
        capabilities: {}
    });
    if (initialize?.serverInfo?.name !== 'lpc-language-server') {
        throw new Error(`Unexpected server info: ${JSON.stringify(initialize?.serverInfo)}`);
    }
    connection.sendNotification('initialized', {});

    writeFileSync(path.join(smokeWorkspace, 'helper.c'), 'int helper() { return 1; }\n');
    writeFileSync(path.join(smokeWorkspace, 'caller.c'), 'int caller() { return helper(); }\n');
    const rebuild = await connection.sendRequest('lpc/workspaceIndex/rebuild', {
        workspaceRoots: [smokeWorkspace],
        workspaces: [{ workspaceRoot: smokeWorkspace, preprocessorDefines: [] }]
    });
    if (rebuild?.status !== 'ready' || rebuild?.indexedFiles !== 2) {
        throw new Error(`Rust server returned unexpected workspace rebuild result: ${JSON.stringify(rebuild)}`);
    }
    const callerUri = pathToFileURL(path.join(smokeWorkspace, 'caller.c')).toString();
    connection.sendNotification('textDocument/didOpen', {
        textDocument: {
            uri: callerUri,
            languageId: 'lpc',
            version: 1,
            text: 'int caller() { return helper(); }\n'
        }
    });
    const crossFileDefinition = await connection.sendRequest('textDocument/definition', {
        textDocument: { uri: callerUri },
        position: { line: 0, character: 23 }
    });
    if (!Array.isArray(crossFileDefinition) || !crossFileDefinition[0]?.uri?.endsWith('helper.c')) {
        throw new Error(`Rust server missed indexed definition: ${JSON.stringify(crossFileDefinition)}`);
    }
    connection.sendNotification('textDocument/didClose', { textDocument: { uri: callerUri } });

    const efunShadowUri = 'file:///std/efun-shadow.c';
    const efunCallerUri = 'file:///efun-shadow-caller.c';
    connection.sendNotification('textDocument/didOpen', {
        textDocument: {
            uri: efunShadowUri,
            languageId: 'lpc',
            version: 1,
            text: 'void write(mixed value) {}\n'
        }
    });
    connection.sendNotification('textDocument/didOpen', {
        textDocument: {
            uri: efunCallerUri,
            languageId: 'lpc',
            version: 1,
            text: 'inherit "/std/efun-shadow";\nvoid demo() { write("x"); }\n'
        }
    });
    const disabledEfunDefinition = await connection.sendRequest('textDocument/definition', {
        textDocument: { uri: efunCallerUri },
        position: { line: 1, character: 15 }
    });
    if (!Array.isArray(disabledEfunDefinition) || disabledEfunDefinition.length !== 0) {
        throw new Error(`Rust server ignored disabled efun inheritance search: ${JSON.stringify(disabledEfunDefinition)}`);
    }

    const uri = 'file:///rust-lsp-smoke.c';
    connection.sendNotification('textDocument/didOpen', {
        textDocument: {
            uri,
            languageId: 'lpc',
            version: 1,
            text: 'int total;\nint demo(int amount) { int local = amount; return local + total; }\nint answer = query(1);\n'
        }
    });
    connection.sendNotification('textDocument/didChange', {
        textDocument: { uri, version: 2 },
        contentChanges: [{
            range: {
                start: { line: 1, character: 4 },
                end: { line: 1, character: 8 }
            },
            text: 'query'
        }]
    });

    const semanticTokens = await connection.sendRequest('textDocument/semanticTokens/full', {
        textDocument: { uri }
    });
    if (!Array.isArray(semanticTokens?.data) || semanticTokens.data.length === 0) {
        throw new Error(`Rust server returned no semantic tokens: ${JSON.stringify(semanticTokens)}`);
    }
    const documentSymbols = await connection.sendRequest('textDocument/documentSymbol', {
        textDocument: { uri }
    });
    if (!Array.isArray(documentSymbols) || !documentSymbols.some(symbol => symbol.name === 'query')) {
        throw new Error(`Rust server returned unexpected document symbols: ${JSON.stringify(documentSymbols)}`);
    }
    const definition = await connection.sendRequest('textDocument/definition', {
        textDocument: { uri },
        position: { line: 1, character: 52 }
    });
    if (!Array.isArray(definition) || definition[0]?.range?.start?.character !== 28) {
        throw new Error(`Rust server returned unexpected definition: ${JSON.stringify(definition)}`);
    }
    const hover = await connection.sendRequest('textDocument/hover', {
        textDocument: { uri },
        position: { line: 1, character: 52 }
    });
    if (!hover?.contents?.value?.includes('int local')) {
        throw new Error(`Rust server returned unexpected hover: ${JSON.stringify(hover)}`);
    }
    const references = await connection.sendRequest('textDocument/references', {
        textDocument: { uri },
        position: { line: 1, character: 52 },
        context: { includeDeclaration: true }
    });
    if (!Array.isArray(references) || references.length !== 2) {
        throw new Error(`Rust server returned unexpected references: ${JSON.stringify(references)}`);
    }
    const prepareRename = await connection.sendRequest('textDocument/prepareRename', {
        textDocument: { uri },
        position: { line: 1, character: 52 }
    });
    if (prepareRename?.start?.character !== 51) {
        throw new Error(`Rust server returned unexpected prepare rename result: ${JSON.stringify(prepareRename)}`);
    }
    const rename = await connection.sendRequest('textDocument/rename', {
        textDocument: { uri },
        position: { line: 1, character: 52 },
        newName: 'result'
    });
    if (rename?.changes?.[uri]?.length !== 2) {
        throw new Error(`Rust server returned unexpected rename edits: ${JSON.stringify(rename)}`);
    }
    const signatureHelp = await connection.sendRequest('textDocument/signatureHelp', {
        textDocument: { uri },
        position: { line: 2, character: 20 }
    });
    if (signatureHelp?.signatures?.[0]?.parameters?.length !== 1) {
        throw new Error(`Rust server returned unexpected signature help: ${JSON.stringify(signatureHelp)}`);
    }
    const completion = await connection.sendRequest('textDocument/completion', {
        textDocument: { uri },
        position: { line: 1, character: 65 }
    });
    if (!Array.isArray(completion) || !completion.some(item => item.label === 'query')) {
        throw new Error(`Rust server returned unexpected completion: ${JSON.stringify(completion)}`);
    }
    const variables = await connection.sendRequest('lpc/documentVariables', {
        textDocument: { uri }
    });
    if (!Array.isArray(variables)
        || !variables.some(item => item.name === 'total' && item.local === false)
        || !variables.some(item => item.name === 'local' && item.local === true)) {
        throw new Error(`Rust server returned unexpected variable inspection data: ${JSON.stringify(variables)}`);
    }
    const enclosingFunction = await connection.sendRequest('lpc/enclosingFunction', {
        textDocument: { uri },
        position: { line: 1, character: 52 }
    });
    if (enclosingFunction?.name !== 'query' || enclosingFunction?.range?.start?.line !== 1) {
        throw new Error(`Rust server returned unexpected enclosing function: ${JSON.stringify(enclosingFunction)}`);
    }
    const functionDocumentation = await connection.sendRequest('lpc/functionDocumentation', {
        textDocument: { uri }
    });
    if (!functionDocumentation?.currentFile?.entries?.some(entry => entry.name === 'query')) {
        throw new Error(`Rust server returned unexpected function documentation: ${JSON.stringify(functionDocumentation)}`);
    }
    const workspaceDiagnostics = await connection.sendRequest('lpc/workspaceDiagnostics', {
        uriPrefix: 'file:///workspace/'
    });
    if (!Array.isArray(workspaceDiagnostics)) {
        throw new Error(`Rust server returned invalid workspace diagnostics: ${JSON.stringify(workspaceDiagnostics)}`);
    }
    const foldingRanges = await connection.sendRequest('textDocument/foldingRange', {
        textDocument: { uri }
    });
    if (!Array.isArray(foldingRanges)) {
        throw new Error(`Rust server returned invalid folding ranges: ${JSON.stringify(foldingRanges)}`);
    }
    const formatting = await connection.sendRequest('textDocument/formatting', {
        textDocument: { uri },
        options: { tabSize: 4, insertSpaces: true }
    });
    if (!Array.isArray(formatting) || !formatting[0]?.newText?.includes('int query(int amount)\n{')) {
        throw new Error(`Rust server returned unexpected formatting edits: ${JSON.stringify(formatting)}`);
    }
    if (!latestDiagnostics || latestDiagnostics.version !== 2 || latestDiagnostics.diagnostics.length !== 0) {
        throw new Error(`Rust server returned unexpected diagnostics: ${JSON.stringify(latestDiagnostics)}`);
    }

    connection.sendNotification('lpc/workspaceConfigSync', {
        workspaceRoots: [],
        workspaces: [{
            enableTypeChecking: true,
            enableUnusedGlobalVarCheck: true,
            enableUnusedParameterCheck: true,
            enforceLocalVariableDeclarationAtBlockStart: true,
            searchEfunDefinitionInInheritanceChain: true,
            formatIndentSize: 2
        }]
    });
    const configuredFormatting = await connection.sendRequest('textDocument/formatting', {
        textDocument: { uri },
        options: { tabSize: 8, insertSpaces: true }
    });
    if (!configuredFormatting?.[0]?.newText?.includes('\n  int local = amount;')) {
        throw new Error(`Rust server ignored configured formatter indentation: ${JSON.stringify(configuredFormatting)}`);
    }
    const enabledEfunDefinition = await connection.sendRequest('textDocument/definition', {
        textDocument: { uri: efunCallerUri },
        position: { line: 1, character: 15 }
    });
    if (!Array.isArray(enabledEfunDefinition) || enabledEfunDefinition[0]?.uri !== efunShadowUri) {
        throw new Error(`Rust server ignored enabled efun inheritance search: ${JSON.stringify(enabledEfunDefinition)}`);
    }
    connection.sendNotification('textDocument/didClose', { textDocument: { uri: efunCallerUri } });
    connection.sendNotification('textDocument/didClose', { textDocument: { uri: efunShadowUri } });
    const configuredDiagnosticsUri = 'file:///rust-lsp-configured-diagnostics.c';
    connection.sendNotification('textDocument/didOpen', {
        textDocument: {
            uri: configuredDiagnosticsUri,
            languageId: 'lpc',
            version: 1,
            text: 'int stale;\nvoid configured(int unused) { write("x"); int late; }\n'
        }
    });
    await connection.sendRequest('lpc/health');
    const configuredCodes = new Set(latestDiagnostics?.diagnostics?.map(item => item.code));
    for (const expectedCode of [
        'unusedGlobalVar',
        'unusedParam',
        'localVariableDeclarationPosition'
    ]) {
        if (!configuredCodes.has(expectedCode)) {
            throw new Error(`Rust server missed configured diagnostic ${expectedCode}: ${JSON.stringify(latestDiagnostics)}`);
        }
    }
    connection.sendNotification('textDocument/didClose', {
        textDocument: { uri: configuredDiagnosticsUri }
    });

    const health = await connection.sendRequest('lpc/health');
    if (health?.status !== 'ok' || health?.mode !== 'rust' || health?.documentCount !== 1) {
        throw new Error(`Unexpected health response: ${JSON.stringify(health)}`);
    }
    if (health?.performance?.documents?.incrementalEditCount !== 1) {
        throw new Error(`Incremental edit was not recorded: ${JSON.stringify(health)}`);
    }
    if (
        health?.performance?.syntax?.fullParseCount < 2
        || health?.performance?.syntax?.incrementalParseCount !== 1
    ) {
        throw new Error(`Incremental syntax parse was not recorded: ${JSON.stringify(health)}`);
    }
    if (health?.performance?.analysisSnapshotBuildCount < 3) {
        throw new Error(`Analysis snapshots were not versioned correctly: ${JSON.stringify(health)}`);
    }

    await connection.sendRequest('shutdown');
    await connection.sendNotification('exit');
    console.log(`Rust LSP smoke test passed (server ${health.serverVersion}).`);
} finally {
    connection.dispose();
    if (!child.killed) {
        child.kill();
    }
    rmSync(smokeWorkspace, { recursive: true, force: true });
}
