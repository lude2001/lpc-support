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
            text: 'void demo() {}\n'
        }
    });
    connection.sendNotification('textDocument/didChange', {
        textDocument: { uri, version: 2 },
        contentChanges: [{
            range: {
                start: { line: 0, character: 5 },
                end: { line: 0, character: 9 }
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

    await connection.sendRequest('shutdown');
    connection.sendNotification('exit');
    console.log(`Rust LSP smoke test passed (server ${health.serverVersion}).`);
} finally {
    connection.dispose();
    if (!child.killed) {
        child.kill();
    }
}
