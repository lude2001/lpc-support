#!/usr/bin/env node

import { fork, spawn } from 'child_process';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { isDeepStrictEqual } from 'util';
import { pathToFileURL } from 'url';

const require = createRequire(import.meta.url);
const {
    createProtocolConnection
} = require('vscode-languageserver-protocol/node');
const {
    IPCMessageReader,
    IPCMessageWriter,
    StreamMessageReader,
    StreamMessageWriter
} = require('vscode-jsonrpc/node');

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const outputDirectory = path.join(repositoryRoot, '.tmp', 'lsp-parity');
const rustExecutable = path.join(
    repositoryRoot,
    'dist',
    'bin',
    process.platform === 'win32' ? 'lpc-language-server.exe' : 'lpc-language-server'
);
const typescriptServer = path.join(repositoryRoot, 'dist', 'lsp', 'server.js');

async function main() {
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-lsp-parity-'));
    const fixture = createFixture(workspaceRoot);
    let typescript;
    let rust;

    try {
        assertExists(typescriptServer, 'Run node esbuild.mjs before the parity matrix.');
        assertExists(rustExecutable, 'Run npm run build:rust before the parity matrix.');
        fs.mkdirSync(outputDirectory, { recursive: true });

        [typescript, rust] = await Promise.all([
            ServerHarness.start('typescript', workspaceRoot),
            ServerHarness.start('rust', workspaceRoot)
        ]);

        const [typescriptResult, rustResult] = await Promise.all([
            collectBehavior(typescript, fixture, workspaceRoot),
            collectBehavior(rust, fixture, workspaceRoot)
        ]);
        const matrix = Object.keys(typescriptResult).map(capability => classifyCapability(
            capability,
            typescriptResult,
            rustResult,
            fixture
        ));
        const report = {
            schemaVersion: 1,
            corpus: fixture.manifest,
            matrix
        };
        const reportPath = path.join(outputDirectory, 'latest.json');
        fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

        const mismatches = matrix.filter(entry => entry.status === 'mismatch');
        const approved = matrix.filter(entry => entry.status === 'approved-difference');
        console.log(`Process-level LSP parity report: ${reportPath}`);
        console.log(`Exact capabilities: ${matrix.length - mismatches.length - approved.length}/${matrix.length}`);
        console.log(`Approved differences: ${approved.length}`);
        for (const entry of mismatches) {
            console.error(`Mismatch: ${entry.capability}`);
        }
        if (mismatches.length > 0) {
            process.exitCode = 1;
        }
    } finally {
        await Promise.allSettled([
            typescript?.dispose(),
            rust?.dispose()
        ]);
        fs.rmSync(workspaceRoot, { recursive: true, force: true });
    }
}

async function collectBehavior(server, fixture, workspaceRoot) {
    const cleanDiagnosticsPromise = server.waitForDiagnostics(fixture.main.uri);
    const arityDiagnosticsPromise = server.waitForDiagnostics(fixture.diagnostic.uri);
    for (const document of fixture.documents) {
        await server.open(document);
    }
    const [cleanDiagnostics, arityDiagnostics] = await Promise.all([
        cleanDiagnosticsPromise,
        arityDiagnosticsPromise
    ]);
    await server.request('lpc/health');

    const semanticTokens = await server.request('textDocument/semanticTokens/full', {
        textDocument: { uri: fixture.main.uri }
    });
    const semantic = semanticFacts(
        semanticTokens?.data ?? [],
        server.semanticTokenLegend,
        fixture.main.text,
        ['helper', 'inherited_add', 'MAX_VALUE']
    );
    const localHover = await server.request('textDocument/hover', {
        textDocument: { uri: fixture.main.uri },
        position: fixture.positions.helperCall
    });
    const inheritedHover = await server.request('textDocument/hover', {
        textDocument: { uri: fixture.main.uri },
        position: fixture.positions.inheritedCall
    });
    const macroHover = await server.request('textDocument/hover', {
        textDocument: { uri: fixture.main.uri },
        position: fixture.positions.macroReference
    });
    const localDefinition = await server.request('textDocument/definition', {
        textDocument: { uri: fixture.main.uri },
        position: fixture.positions.helperCall
    });
    const inheritedDefinition = await server.request('textDocument/definition', {
        textDocument: { uri: fixture.main.uri },
        position: fixture.positions.inheritedCall
    });
    const macroDefinition = await server.request('textDocument/definition', {
        textDocument: { uri: fixture.main.uri },
        position: fixture.positions.macroReference
    });
    const localCompletion = await server.request('textDocument/completion', {
        textDocument: { uri: fixture.completion.uri },
        position: fixture.positions.completion
    });
    const macroCompletion = await server.request('textDocument/completion', {
        textDocument: { uri: fixture.macroCompletion.uri },
        position: fixture.positions.macroCompletion
    });
    const localSignatureHelp = await server.request('textDocument/signatureHelp', {
        textDocument: { uri: fixture.main.uri },
        position: fixture.positions.helperSignature
    });
    const inheritedSignatureHelp = await server.request('textDocument/signatureHelp', {
        textDocument: { uri: fixture.main.uri },
        position: fixture.positions.inheritedSignature
    });
    const references = await server.request('textDocument/references', {
        textDocument: { uri: fixture.main.uri },
        position: fixture.positions.helperCall,
        context: { includeDeclaration: true }
    });
    const rename = await server.request('textDocument/rename', {
        textDocument: { uri: fixture.main.uri },
        position: fixture.positions.helperCall,
        newName: 'renamed_helper'
    });
    const formatting = await server.request('textDocument/formatting', {
        textDocument: { uri: fixture.format.uri },
        options: { tabSize: 4, insertSpaces: true }
    });
    const rangeFormatting = await server.request('textDocument/rangeFormatting', {
        textDocument: { uri: fixture.rangeFormat.uri },
        range: fixture.positions.rangeFormat,
        options: { tabSize: 4, insertSpaces: true }
    });
    const additionalFormatting = {};
    for (const formattingCase of fixture.additionalFormattingCases) {
        const edits = await server.request('textDocument/formatting', {
            textDocument: { uri: formattingCase.uri },
            options: { tabSize: 4, insertSpaces: true }
        });
        additionalFormatting[`formatting.${formattingCase.name}`] = applyTextEdits(
            formattingCase.text,
            edits ?? []
        );
    }

    return {
        'diagnostics.clean': normalizeDiagnostics(cleanDiagnostics),
        'diagnostics.knownArity': normalizeDiagnostics(arityDiagnostics),
        'semanticTokens.localFunction': semantic.helper,
        'semanticTokens.inheritedFunction': semantic.inherited_add,
        'semanticTokens.macro': semantic.MAX_VALUE,
        'hover.localFunction': normalizeHover(localHover, 'helper', ['left', 'right']),
        'hover.inheritedFunction': normalizeHover(inheritedHover, 'inherited_add', ['value']),
        'hover.macro': normalizeHover(macroHover, 'MAX_VALUE'),
        'definition.localFunction': normalizeLocations(localDefinition, workspaceRoot),
        'definition.inheritedFunction': normalizeLocations(inheritedDefinition, workspaceRoot),
        'definition.macro': normalizeLocations(macroDefinition, workspaceRoot),
        'completion.localFunction': normalizeCompletion(localCompletion, ['helper']),
        'completion.macro': normalizeCompletion(macroCompletion, ['MAX_VALUE']),
        'signatureHelp.localFunction': normalizeSignatureHelp(localSignatureHelp),
        'signatureHelp.inheritedFunction': normalizeSignatureHelp(inheritedSignatureHelp),
        'references.localFunction': normalizeLocations(references, workspaceRoot),
        'rename.localFunction': normalizeWorkspaceEdit(rename, workspaceRoot),
        'formatting.document': applyTextEdits(fixture.format.text, formatting ?? []),
        'formatting.range': applyTextEdits(fixture.rangeFormat.text, rangeFormatting ?? []),
        ...additionalFormatting
    };
}

class ServerHarness {
    static async start(kind, workspaceRoot) {
        const child = kind === 'rust'
            ? spawn(rustExecutable, [], {
                cwd: repositoryRoot,
                env: { ...process.env },
                stdio: ['pipe', 'pipe', 'pipe'],
                windowsHide: true
            })
            : fork(typescriptServer, ['--node-ipc'], {
                cwd: repositoryRoot,
                env: { ...process.env },
                silent: true,
                stdio: ['pipe', 'pipe', 'pipe', 'ipc']
            });
        if (kind === 'typescript' && !child.channel) {
            throw new Error('TypeScript LSP did not expose an IPC channel.');
        }
        const stderr = [];
        child.stderr?.on('data', chunk => stderr.push(String(chunk)));
        const connection = kind === 'rust'
            ? createProtocolConnection(
                new StreamMessageReader(child.stdout),
                new StreamMessageWriter(child.stdin)
            )
            : createProtocolConnection(
                new IPCMessageReader(child),
                new IPCMessageWriter(child)
            );
        const harness = new ServerHarness(kind, child, connection, stderr);
        connection.listen();
        connection.onNotification('textDocument/publishDiagnostics', params => {
            harness.publishDiagnostics(params.uri, params.diagnostics ?? []);
        });

        try {
            const initialize = await harness.request('initialize', {
                processId: process.pid,
                rootUri: pathToFileURL(workspaceRoot).toString(),
                capabilities: {},
                workspaceFolders: [{
                    uri: pathToFileURL(workspaceRoot).toString(),
                    name: path.basename(workspaceRoot)
                }]
            });
            harness.semanticTokenLegend = initialize?.capabilities?.semanticTokensProvider?.legend;
            await connection.sendNotification('initialized', {});
            const workspaceConfig = {
                workspaceRoots: [workspaceRoot],
                workspaces: [{
                    workspaceRoot,
                    projectConfigPath: path.join(workspaceRoot, 'lpc-support.json'),
                    configHellPath: 'config.hell',
                    preprocessorDefines: ['PARITY_FEATURE=1'],
                    resolvedConfig: {
                        mudlibDirectory: '.',
                        includeDirectories: ['/include']
                    },
                    lastSyncedAt: '2026-09-16T00:00:00.000Z'
                }]
            };
            await connection.sendNotification('lpc/workspaceConfigSync', workspaceConfig);
            if (kind === 'rust') {
                await harness.request('lpc/workspaceIndex/rebuild', workspaceConfig);
            }
            return harness;
        } catch (error) {
            await harness.dispose();
            throw new Error(`${kind} LSP startup failed: ${formatError(error)}\n${stderr.join('')}`);
        }
    }

    constructor(kind, child, connection, stderr) {
        this.kind = kind;
        this.child = child;
        this.connection = connection;
        this.stderr = stderr;
        this.diagnostics = new Map();
        this.waiters = new Map();
        this.disposed = false;
    }

    async request(method, params) {
        return withTimeout(
            this.connection.sendRequest(method, params),
            15000,
            `${this.kind} ${method}`
        );
    }

    async open(document) {
        await this.connection.sendNotification('textDocument/didOpen', {
            textDocument: {
                uri: document.uri,
                languageId: 'lpc',
                version: 1,
                text: document.text
            }
        });
    }

    waitForDiagnostics(uri) {
        if (this.diagnostics.has(uri)) {
            return Promise.resolve(this.diagnostics.get(uri));
        }
        return withTimeout(new Promise(resolve => {
            const waiters = this.waiters.get(uri) ?? [];
            waiters.push(resolve);
            this.waiters.set(uri, waiters);
        }), 15000, `${this.kind} diagnostics`);
    }

    publishDiagnostics(uri, diagnostics) {
        this.diagnostics.set(uri, diagnostics);
        const waiters = this.waiters.get(uri) ?? [];
        this.waiters.delete(uri);
        for (const resolve of waiters) {
            resolve(diagnostics);
        }
    }

    async dispose() {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        try {
            await withTimeout(this.connection.sendRequest('shutdown'), 5000, `${this.kind} shutdown`);
            await this.connection.sendNotification('exit');
        } catch {
            // Process termination below is the final cleanup path.
        }
        this.connection.dispose();
        if (!this.child.killed) {
            this.child.kill();
        }
    }
}

function createFixture(root) {
    const sources = {
        'include/parity.h': '#define MAX_VALUE 7\n',
        'base.c': [
            '/**',
            ' * Adds one to a value.',
            ' * @param value input value',
            ' * @return incremented value',
            ' */',
            'int inherited_add(int value) { return value + 1; }',
            ''
        ].join('\n'),
        'main.c': [
            '#include <parity.h>',
            'inherit "/base";',
            '',
            '/** Adds two values. */',
            'int helper(int left, int right) {',
            '    return left + right;',
            '}',
            '',
            'int use_helper() {',
            '    return helper(1, inherited_add(MAX_VALUE));',
            '}',
            ''
        ].join('\n'),
        'completion.c': [
            'inherit "/main";',
            'int completion_probe() {',
            '    return hel',
            '}',
            ''
        ].join('\n'),
        'macro-completion.c': [
            '#include <parity.h>',
            'int macro_completion_probe() {',
            '    return MAX_',
            '}',
            ''
        ].join('\n'),
        'diagnostic.c': [
            'inherit "/main";',
            'int arity_probe() {',
            '    return helper(1);',
            '}',
            ''
        ].join('\n'),
        'format.c': 'int messy(){int value=1;if(value){value+=2;}return value;}\n',
        'format-macro.c': [
            '#define MAX(left, right) ((left) > (right) ? (left) : (right))',
            '#define DECLARE(name) int query_##name(){return MAX(1,2);}',
            'DECLARE(score)',
            'int use_macro(){return MAX(3,4);}',
            ''
        ].join('\n'),
        'format-heredoc.c': 'string help(){return @TEXT\n第一行\n  second line\nTEXT;}\n',
        'format-comments.c': [
            '// leading comment',
            'int comments(){/* inline */int value=1;// trailing',
            'return value;}',
            ''
        ].join('\n'),
        'format-yifeng.c': fs.readFileSync(
            path.join(repositoryRoot, 'test', 'lpc_code', 'yifeng-jian.c'),
            'utf8'
        ),
        'format-meridiand.c': fs.readFileSync(
            path.join(repositoryRoot, 'test', 'lpc_code', 'meridiand.c'),
            'utf8'
        ),
        'range-format.c': [
            'int untouched(){return 1;}',
            'int selected(){int value=1;if(value){value+=2;}return value;}',
            ''
        ].join('\n')
    };
    fs.mkdirSync(path.join(root, 'include'), { recursive: true });
    fs.writeFileSync(path.join(root, 'lpc-support.json'), JSON.stringify({
        version: 1,
        configHellPath: 'config.hell',
        preprocessorDefines: ['PARITY_FEATURE=1']
    }, null, 2));
    fs.writeFileSync(path.join(root, 'config.hell'), [
        'mudlib directory : .',
        'include directories : /include'
    ].join('\n'));

    const documents = Object.entries(sources).map(([relativePath, text]) => {
        const absolutePath = path.join(root, relativePath);
        fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
        fs.writeFileSync(absolutePath, text, 'utf8');
        return {
            relativePath: `/${relativePath.replace(/\\/g, '/')}`,
            path: absolutePath,
            uri: pathToFileURL(absolutePath).toString(),
            text
        };
    });
    const byPath = new Map(documents.map(document => [document.relativePath, document]));
    const main = byPath.get('/main.c');
    const completion = byPath.get('/completion.c');
    const macroCompletion = byPath.get('/macro-completion.c');
    const diagnostic = byPath.get('/diagnostic.c');
    const format = byPath.get('/format.c');
    const rangeFormat = byPath.get('/range-format.c');
    const additionalFormattingCases = [
        ['macro', '/format-macro.c'],
        ['heredoc', '/format-heredoc.c'],
        ['comments', '/format-comments.c'],
        ['yifeng', '/format-yifeng.c'],
        ['meridiand', '/format-meridiand.c']
    ].map(([name, relativePath]) => ({
        name,
        ...byPath.get(relativePath)
    }));
    return {
        documents,
        main,
        completion,
        macroCompletion,
        diagnostic,
        format,
        rangeFormat,
        additionalFormattingCases,
        manifest: documents.map(document => document.relativePath),
        positions: {
            helperCall: positionOf(main.text, 'helper(1', 1),
            inheritedCall: positionOf(main.text, 'inherited_add(MAX_VALUE)', 1),
            macroReference: positionOf(main.text, 'MAX_VALUE', 1),
            helperSignature: positionOf(main.text, 'helper(1', 'helper(1,'.length),
            inheritedSignature: positionOf(main.text, 'inherited_add(MAX_VALUE)', 'inherited_add('.length + 1),
            completion: positionOf(completion.text, 'hel', 3),
            macroCompletion: positionOf(macroCompletion.text, 'MAX_', 4),
            rangeFormat: {
                start: { line: 1, character: 0 },
                end: { line: 1, character: rangeFormat.text.split('\n')[1].length }
            }
        }
    };
}

function normalizeDiagnostics(diagnostics) {
    return diagnostics.map(diagnostic => ({
        code: String(diagnostic.code ?? ''),
        severity: diagnostic.severity,
        range: diagnostic.range
    })).sort(compareJson);
}

function semanticFacts(data, legend, source, names) {
    const tokens = decodeSemanticTokens(data);
    const tokenTypes = legend?.tokenTypes ?? [];
    const tokenModifiers = legend?.tokenModifiers ?? [];
    return Object.fromEntries(names.map(name => {
        const position = positionOf(source, name, 1);
        const token = tokens.find(candidate => candidate.line === position.line
            && candidate.character <= position.character
            && position.character < candidate.character + candidate.length);
        return [name, {
            type: token ? tokenTypes[token.tokenType] : undefined,
            modifiers: token
                ? tokenModifiers.filter((_, index) => (token.modifiers & (1 << index)) !== 0)
                : []
        }];
    }));
}

function decodeSemanticTokens(data) {
    const tokens = [];
    let line = 0;
    let character = 0;
    for (let index = 0; index + 4 < data.length; index += 5) {
        line += data[index];
        character = data[index] === 0 ? character + data[index + 1] : data[index + 1];
        tokens.push({
            line,
            character,
            length: data[index + 2],
            tokenType: data[index + 3],
            modifiers: data[index + 4]
        });
    }
    return tokens;
}

function normalizeHover(hover, symbol, parameters = []) {
    if (!hover) {
        return { found: false };
    }
    const contents = Array.isArray(hover.contents) ? hover.contents : [hover.contents];
    const text = contents.map(content => typeof content === 'string' ? content : content?.value ?? '').join('\n');
    return {
        found: true,
        range: hover.range,
        symbol: new RegExp(`\\b${symbol}\\b`).test(text),
        parameters: parameters.filter(parameter => new RegExp(`\\b${parameter}\\b`).test(text))
    };
}

function normalizeLocations(locations, root) {
    const values = !locations ? [] : Array.isArray(locations) ? locations : [locations];
    return values.map(location => ({
        file: relativeUri(location.uri, root),
        range: location.range
    })).sort(compareJson);
}

function normalizeCompletion(completion, labels) {
    const items = Array.isArray(completion) ? completion : completion?.items ?? [];
    return items
        .filter(item => labels.includes(typeof item.label === 'string' ? item.label : item.label?.label))
        .map(item => ({
            label: typeof item.label === 'string' ? item.label : item.label?.label,
            kind: item.kind
        }))
        .sort(compareJson);
}

function normalizeSignatureHelp(help) {
    if (!help) {
        return { found: false };
    }
    return {
        found: true,
        activeSignature: help.activeSignature ?? 0,
        activeParameter: help.activeParameter ?? 0,
        signatures: (help.signatures ?? []).map(signature => ({
            label: signature.label,
            parameterCount: signature.parameters?.length ?? 0
        }))
    };
}

function normalizeWorkspaceEdit(edit, root) {
    return Object.entries(edit?.changes ?? {}).map(([uri, edits]) => ({
        file: relativeUri(uri, root),
        edits: edits.map(item => ({ range: item.range, newText: item.newText })).sort(compareJson)
    })).sort(compareJson);
}

function applyTextEdits(source, edits) {
    const lineStarts = [0];
    for (let index = 0; index < source.length; index += 1) {
        if (source[index] === '\n') {
            lineStarts.push(index + 1);
        }
    }
    const offsetAt = position => (lineStarts[position.line] ?? source.length) + position.character;
    let output = source;
    for (const edit of [...edits].sort((left, right) => offsetAt(right.range.start) - offsetAt(left.range.start))) {
        output = `${output.slice(0, offsetAt(edit.range.start))}${edit.newText}${output.slice(offsetAt(edit.range.end))}`;
    }
    return output;
}

function positionOf(source, needle, characterOffset = 1) {
    const offset = source.indexOf(needle);
    if (offset === -1) {
        throw new Error(`Fixture token not found: ${needle}`);
    }
    const prefix = source.slice(0, offset);
    const lines = prefix.split('\n');
    return {
        line: lines.length - 1,
        character: lines[lines.length - 1].length + characterOffset
    };
}

function relativeUri(uri, root) {
    const pathname = decodeURIComponent(new URL(uri).pathname).replace(/^\/([A-Za-z]:\/)/, '$1');
    return `/${path.relative(root, pathname).replace(/\\/g, '/')}`;
}

function compareJson(left, right) {
    return JSON.stringify(left).localeCompare(JSON.stringify(right));
}

function classifyCapability(capability, typescriptResult, rustResult, fixture) {
    const typescript = typescriptResult[capability];
    const rust = rustResult[capability];
    if (isDeepStrictEqual(typescript, rust)) {
        return { capability, status: 'exact', typescript, rust };
    }
    if (capability === 'rename.localFunction'
        && typescript.length === 0
        && renameMatchesReferences(
            rust,
            rustResult['references.localFunction'],
            'renamed_helper'
        )) {
        return {
            capability,
            status: 'approved-difference',
            rationale: 'The legacy TypeScript server conservatively returned no edit; Rust renames exactly the resolved declaration and reference set.',
            typescript,
            rust
        };
    }
    if (capability === 'definition.macro'
        && isMorePreciseMacroDefinition(typescript, rust, '/include/parity.h')) {
        return {
            capability,
            status: 'approved-difference',
            rationale: 'Rust narrows macro definition navigation from the entire directive to the macro identifier.',
            typescript,
            rust
        };
    }
    if (capability === 'completion.macro'
        && typescript.length === 0
        && isDeepStrictEqual(rust, [{ label: 'MAX_VALUE', kind: 21 }])) {
        return {
            capability,
            status: 'approved-difference',
            rationale: 'Rust intentionally adds include-backed macro completion that the legacy TypeScript server did not provide.',
            typescript,
            rust
        };
    }
    if (capability === 'references.localFunction'
        && locationsAreStrictSuperset(rust, typescript, '/diagnostic.c')) {
        return {
            capability,
            status: 'approved-difference',
            rationale: 'Rust intentionally includes an inherited cross-file call that the legacy TypeScript server omitted.',
            typescript,
            rust
        };
    }
    if (capability.startsWith('formatting.')) {
        const name = capability.slice('formatting.'.length);
        const formattingCase = fixture.additionalFormattingCases.find(item => item.name === name);
        const preservation = formattingCase
            ? lexicalPreservationEvidence(formattingCase.text, rust)
            : undefined;
        if (preservation?.preserved) {
            return {
                capability,
                status: 'approved-difference',
                rationale: name === 'macro'
                    ? 'Rust preserves macro definitions and invocations instead of formatting their expansions; code tokens and comments remain unchanged.'
                    : 'Rust formatting differs stylistically while preserving the complete code-token stream and normalized comment multiset.',
                typescript,
                rust
            };
        }
        if (preservation) {
            return { capability, status: 'mismatch', preservation, typescript, rust };
        }
    }
    return { capability, status: 'mismatch', typescript, rust };
}

function lexicalPreservationEvidence(source, formatted) {
    const before = lexicalFacts(source);
    const after = lexicalFacts(formatted);
    const sourceTokens = withoutOptionalCollectionTrailingCommas(before.tokens);
    const formattedTokens = withoutOptionalCollectionTrailingCommas(after.tokens);
    const tokenMismatch = firstDifference(sourceTokens, formattedTokens);
    const sourceComments = before.comments.sort();
    const formattedComments = after.comments.sort();
    const commentMismatch = firstDifference(sourceComments, formattedComments);
    return {
        preserved: !tokenMismatch && !commentMismatch,
        sourceTokenCount: sourceTokens.length,
        formattedTokenCount: formattedTokens.length,
        tokenMismatch,
        sourceCommentCount: sourceComments.length,
        formattedCommentCount: formattedComments.length,
        commentMismatch
    };
}

function withoutOptionalCollectionTrailingCommas(tokens) {
    return tokens.filter((token, index) => token !== ','
        || !((tokens[index + 1] === '}' || tokens[index + 1] === ']')
            && tokens[index + 2] === ')'));
}

function firstDifference(left, right) {
    const length = Math.max(left.length, right.length);
    for (let index = 0; index < length; index += 1) {
        if (left[index] !== right[index]) {
            return { index, source: left[index] ?? null, formatted: right[index] ?? null };
        }
    }
    return null;
}

function lexicalFacts(source) {
    const tokens = [];
    const comments = [];
    const operators = [
        '<<=', '>>=', '??=', '...', '->', '::', '(:', ':)', '++', '--', '+=', '-=',
        '*=', '/=', '%=', '==', '!=', '>=', '<=', '&&', '||', '<<', '>>', '..'
    ];
    let index = 0;
    while (index < source.length) {
        if (/\s/u.test(source[index])) {
            index += 1;
            continue;
        }
        if (source.startsWith('//', index)) {
            const end = source.indexOf('\n', index);
            const finish = end === -1 ? source.length : end;
            comments.push(normalizeComment(source.slice(index, finish)));
            index = finish;
            continue;
        }
        if (source.startsWith('/*', index)) {
            const end = source.indexOf('*/', index + 2);
            const finish = end === -1 ? source.length : end + 2;
            comments.push(normalizeComment(source.slice(index, finish)));
            index = finish;
            continue;
        }
        if (source[index] === '"' || source[index] === "'") {
            const quote = source[index];
            let end = index + 1;
            while (end < source.length) {
                if (source[end] === '\\') {
                    end += 2;
                } else if (source[end] === quote) {
                    end += 1;
                    break;
                } else {
                    end += 1;
                }
            }
            tokens.push(source.slice(index, end));
            index = end;
            continue;
        }
        if (/[\p{L}\p{N}_]/u.test(source[index])) {
            let end = index + 1;
            while (end < source.length && /[\p{L}\p{N}_]/u.test(source[end])) {
                end += 1;
            }
            tokens.push(source.slice(index, end));
            index = end;
            continue;
        }
        const operator = operators.find(candidate => source.startsWith(candidate, index));
        if (operator) {
            tokens.push(operator);
            index += operator.length;
        } else {
            tokens.push(source[index]);
            index += 1;
        }
    }
    return { tokens, comments };
}

function normalizeComment(comment) {
    return comment.replace(/\s+/gu, ' ').trim();
}

function isMorePreciseMacroDefinition(typescript, rust, expectedFile) {
    if (typescript.length !== 1 || rust.length !== 1 || rust[0].file !== expectedFile
        || typescript[0].file !== expectedFile) {
        return false;
    }
    const broad = typescript[0].range;
    const precise = rust[0].range;
    return broad.start.line === precise.start.line
        && broad.end.line === precise.end.line
        && broad.start.character <= precise.start.character
        && precise.end.character <= broad.end.character
        && (broad.start.character !== precise.start.character
            || broad.end.character !== precise.end.character);
}

function locationsAreStrictSuperset(superset, subset, expectedExtraFile) {
    if (superset.length <= subset.length
        || !superset.some(location => location.file === expectedExtraFile)) {
        return false;
    }
    return subset.every(location => superset.some(candidate => isDeepStrictEqual(candidate, location)));
}

function renameMatchesReferences(rename, references, newName) {
    const edits = rename.flatMap(file => file.edits.map(edit => ({
        file: file.file,
        range: edit.range,
        newText: edit.newText
    }))).sort(compareJson);
    const expected = references.map(reference => ({
        file: reference.file,
        range: reference.range,
        newText: newName
    })).sort(compareJson);
    return edits.length > 0 && isDeepStrictEqual(edits, expected);
}

function withTimeout(promise, timeoutMs, label) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(
            () => reject(new Error(`Timed out after ${timeoutMs} ms: ${label}`)),
            timeoutMs
        );
        Promise.resolve(promise).then(
            value => {
                clearTimeout(timer);
                resolve(value);
            },
            error => {
                clearTimeout(timer);
                reject(error);
            }
        );
    });
}

function assertExists(filePath, guidance) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Missing ${filePath}. ${guidance}`);
    }
}

function formatError(error) {
    return error instanceof Error ? error.stack ?? error.message : String(error);
}

await main();
