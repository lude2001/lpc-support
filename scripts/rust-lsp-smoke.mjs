import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
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
    const foldingRanges = await connection.sendRequest('textDocument/foldingRange', {
        textDocument: { uri }
    });
    if (!Array.isArray(foldingRanges)) {
        throw new Error(`Rust server returned invalid folding ranges: ${JSON.stringify(foldingRanges)}`);
    }
    if (!latestDiagnostics || latestDiagnostics.version !== 2 || latestDiagnostics.diagnostics.length !== 0) {
        throw new Error(`Rust server returned unexpected diagnostics: ${JSON.stringify(latestDiagnostics)}`);
    }

    const health = await connection.sendRequest('lpc/health');
    if (health?.status !== 'ok' || health?.mode !== 'rust' || health?.documentCount !== 1) {
        throw new Error(`Unexpected health response: ${JSON.stringify(health)}`);
    }
    if (health?.performance?.documents?.incrementalEditCount !== 1) {
        throw new Error(`Incremental edit was not recorded: ${JSON.stringify(health)}`);
    }
    if (
        health?.performance?.syntax?.fullParseCount !== 1
        || health?.performance?.syntax?.incrementalParseCount !== 1
    ) {
        throw new Error(`Incremental syntax parse was not recorded: ${JSON.stringify(health)}`);
    }
    if (health?.performance?.analysisSnapshotBuildCount !== 2) {
        throw new Error(`Analysis snapshots were not versioned correctly: ${JSON.stringify(health)}`);
    }

    await connection.sendRequest('shutdown');
    connection.sendNotification('exit');
    console.log(`Rust LSP smoke test passed (server ${health.serverVersion}).`);
} finally {
    connection.dispose();
    if (!child.killed) {
        child.kill();
    }
}
