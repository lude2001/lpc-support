import { spawn } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
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
    const completionTriggers = initialize?.capabilities?.completionProvider?.triggerCharacters ?? [];
    for (const trigger of ['.', '>', ':', '#', '"', '<', '/']) {
        if (!completionTriggers.includes(trigger)) {
            throw new Error(`Rust server missed completion trigger ${JSON.stringify(trigger)}: ${JSON.stringify(completionTriggers)}`);
        }
    }
    const signatureRetriggers = initialize?.capabilities?.signatureHelpProvider?.retriggerCharacters ?? [];
    if (!signatureRetriggers.includes(',')) {
        throw new Error(`Rust server missed signature-help retrigger comma: ${JSON.stringify(signatureRetriggers)}`);
    }
    connection.sendNotification('initialized', {});

    const callerSource = '#include "macros.h"\nstring root = ROOT_DIR;\nint package_enabled = __PACKAGE_DB__;\nint private_leak = PRIVATE_FEATURE;\nint caller(mixed value) { return helper() + sizeof(value) + simul_call() + MAX(1, 2); }\n';
    const simulatedDirectory = path.join(smokeWorkspace, 'adm', 'single');
    mkdirSync(simulatedDirectory, { recursive: true });
    writeFileSync(path.join(smokeWorkspace, 'helper.c'), 'int helper() { return 1; }\n');
    writeFileSync(path.join(smokeWorkspace, 'macros.h'), '/** Root directory. */\n#define ROOT_DIR "/data"\n#define MAX(left, right) ((left) > (right) ? (left) : (right))\n');
    writeFileSync(path.join(smokeWorkspace, 'private.h'), '#define PRIVATE_FEATURE 1\n');
    writeFileSync(path.join(smokeWorkspace, 'caller.c'), callerSource);
    writeFileSync(path.join(simulatedDirectory, 'simul_efun.c'), 'int simul_call() { return 1; }\n');
    const rebuild = await connection.sendRequest('lpc/workspaceIndex/rebuild', {
        workspaceRoots: [smokeWorkspace],
        workspaces: [{
            workspaceRoot: smokeWorkspace,
            preprocessorDefines: ['__PACKAGE_DB__=1'],
            resolvedConfig: { simulatedEfunFile: '/adm/single/simul_efun' }
        }]
    });
    if (rebuild?.status !== 'ready' || rebuild?.indexedFiles !== 5) {
        throw new Error(`Rust server returned unexpected workspace rebuild result: ${JSON.stringify(rebuild)}`);
    }
    const callerUri = pathToFileURL(path.join(smokeWorkspace, 'caller.c')).toString();
    connection.sendNotification('textDocument/didOpen', {
        textDocument: {
            uri: callerUri,
            languageId: 'lpc',
            version: 1,
            text: callerSource
        }
    });
    const crossFileDefinition = await connection.sendRequest('textDocument/definition', {
        textDocument: { uri: callerUri },
        position: { line: 4, character: callerSource.split('\n')[4].indexOf('helper') + 1 }
    });
    if (!Array.isArray(crossFileDefinition) || !crossFileDefinition[0]?.uri?.endsWith('helper.c')) {
        throw new Error(`Rust server missed indexed definition: ${JSON.stringify(crossFileDefinition)}`);
    }
    const callerSemanticTokens = await connection.sendRequest('textDocument/semanticTokens/full', {
        textDocument: { uri: callerUri }
    });
    const decodedCallerTokens = decodeSemanticTokens(callerSemanticTokens?.data ?? []);
    const expectedCallTokens = [
        ['helper', 5, 0],
        ['sizeof', 9, 4],
        ['simul_call', 15, 4]
    ];
    for (const [name, tokenType, modifiers] of expectedCallTokens) {
        const character = callerSource.indexOf(name) - callerSource.lastIndexOf('\n', callerSource.indexOf(name)) - 1;
        const line = callerSource.slice(0, callerSource.indexOf(name)).split('\n').length - 1;
        if (!decodedCallerTokens.some(token => token.line === line
            && token.character === character
            && token.length === name.length
            && token.tokenType === tokenType
            && token.modifiers === modifiers)) {
            throw new Error(`Rust server misclassified ${name}: ${JSON.stringify(decodedCallerTokens)}`);
        }
    }
    const sizeofHover = await connection.sendRequest('textDocument/hover', {
        textDocument: { uri: callerUri },
        position: { line: 4, character: callerSource.split('\n')[4].indexOf('sizeof') + 1 }
    });
    if (!sizeofHover?.contents?.value?.includes('sizeof')) {
        throw new Error(`Rust server missed sizeof efun hover: ${JSON.stringify(sizeofHover)}`);
    }
    const expectedMacros = ['ROOT_DIR', '__PACKAGE_DB__', 'MAX'];
    for (const name of expectedMacros) {
        const offset = callerSource.indexOf(name);
        const line = callerSource.slice(0, offset).split('\n').length - 1;
        const character = offset - callerSource.lastIndexOf('\n', offset) - 1;
        if (!decodedCallerTokens.some(token => token.line === line
            && token.character === character
            && token.length === name.length
            && token.tokenType === 8)) {
            throw new Error(`Rust server missed macro semantic token ${name}: ${JSON.stringify(decodedCallerTokens)}`);
        }
    }
    const privateOffset = callerSource.indexOf('PRIVATE_FEATURE');
    const privateLine = callerSource.slice(0, privateOffset).split('\n').length - 1;
    const privateCharacter = privateOffset - callerSource.lastIndexOf('\n', privateOffset) - 1;
    if (decodedCallerTokens.some(token => token.line === privateLine
        && token.character === privateCharacter
        && token.length === 'PRIVATE_FEATURE'.length
        && token.tokenType === 8)) {
        throw new Error(`Rust server highlighted a macro from an unrelated header: ${JSON.stringify(decodedCallerTokens)}`);
    }
    const unrelatedMacroHover = await connection.sendRequest('textDocument/hover', {
        textDocument: { uri: callerUri },
        position: { line: privateLine, character: privateCharacter + 1 }
    });
    if (unrelatedMacroHover) {
        throw new Error(`Rust server returned hover for a macro from an unrelated header: ${JSON.stringify(unrelatedMacroHover)}`);
    }
    const unrelatedMacroCompletion = await connection.sendRequest('textDocument/completion', {
        textDocument: { uri: callerUri },
        position: { line: privateLine, character: privateCharacter + 3 }
    });
    if (Array.isArray(unrelatedMacroCompletion)
        && unrelatedMacroCompletion.some(item => item.label === 'PRIVATE_FEATURE')) {
        throw new Error(`Rust server completed a macro from an unrelated header: ${JSON.stringify(unrelatedMacroCompletion)}`);
    }
    const rootOffset = callerSource.indexOf('ROOT_DIR');
    const rootDefinition = await connection.sendRequest('textDocument/definition', {
        textDocument: { uri: callerUri },
        position: { line: 1, character: rootOffset - callerSource.lastIndexOf('\n', rootOffset) }
    });
    if (!Array.isArray(rootDefinition) || !rootDefinition[0]?.uri?.endsWith('macros.h')) {
        throw new Error(`Rust server missed macro definition: ${JSON.stringify(rootDefinition)}`);
    }
    const rootHover = await connection.sendRequest('textDocument/hover', {
        textDocument: { uri: callerUri },
        position: { line: 1, character: rootOffset - callerSource.lastIndexOf('\n', rootOffset) }
    });
    if (!rootHover?.contents?.value?.includes('#define ROOT_DIR "/data"')
        || !rootHover.contents.value.includes('Root directory')) {
        throw new Error(`Rust server missed macro hover documentation: ${JSON.stringify(rootHover)}`);
    }
    const rootPosition = {
        line: 1,
        character: rootOffset - callerSource.lastIndexOf('\n', rootOffset)
    };
    const rootReferences = await connection.sendRequest('textDocument/references', {
        textDocument: { uri: callerUri },
        position: rootPosition,
        context: { includeDeclaration: true }
    });
    if (!Array.isArray(rootReferences)
        || rootReferences.length !== 2
        || !rootReferences.some(location => location.uri.endsWith('macros.h'))
        || !rootReferences.some(location => location.uri === callerUri)) {
        throw new Error(`Rust server missed macro references: ${JSON.stringify(rootReferences)}`);
    }
    const rootPrepareRename = await connection.sendRequest('textDocument/prepareRename', {
        textDocument: { uri: callerUri },
        position: rootPosition
    });
    if (!rootPrepareRename?.start || !rootPrepareRename?.end) {
        throw new Error(`Rust server rejected macro rename preparation: ${JSON.stringify(rootPrepareRename)}`);
    }
    const rootRename = await connection.sendRequest('textDocument/rename', {
        textDocument: { uri: callerUri },
        position: rootPosition,
        newName: 'DATA_ROOT'
    });
    const macroRenameChanges = rootRename?.changes ?? {};
    if (Object.values(macroRenameChanges).flat().length !== 2) {
        throw new Error(`Rust server missed macro rename edits: ${JSON.stringify(rootRename)}`);
    }
    const macroCompletion = await connection.sendRequest('textDocument/completion', {
        textDocument: { uri: callerUri },
        position: { line: 4, character: callerSource.split('\n')[4].indexOf('MAX') + 1 }
    });
    if (!Array.isArray(macroCompletion)
        || !macroCompletion.some(item => item.label === 'MAX' && item.insertTextFormat === 2)) {
        throw new Error(`Rust server missed macro completion: ${JSON.stringify(macroCompletion)}`);
    }
    const predefinedCompletion = await connection.sendRequest('textDocument/completion', {
        textDocument: { uri: callerUri },
        position: { line: 2, character: callerSource.split('\n')[2].indexOf('__PACKAGE_DB__') + 3 }
    });
    if (!Array.isArray(predefinedCompletion)
        || !predefinedCompletion.some(item => item.label === '__PACKAGE_DB__')) {
        throw new Error(`Rust server missed predefined macro completion: ${JSON.stringify(predefinedCompletion)}`);
    }
    connection.sendNotification('textDocument/didClose', { textDocument: { uri: callerUri } });

    const generatedMacroUri = 'file:///macro-generated.c';
    const generatedMacroSource = '#define RequestType(name, method) string name##_request_type = method;\nRequestType(pay_add, "POST")\nstring read_method() { return pay_add_request_type; }\n';
    connection.sendNotification('textDocument/didOpen', {
        textDocument: {
            uri: generatedMacroUri,
            languageId: 'lpc',
            version: 1,
            text: generatedMacroSource
        }
    });
    const generatedSymbols = await connection.sendRequest('textDocument/documentSymbol', {
        textDocument: { uri: generatedMacroUri }
    });
    if (!Array.isArray(generatedSymbols)
        || !generatedSymbols.some(symbol => symbol.name === 'pay_add_request_type')) {
        throw new Error(`Rust server missed macro-generated document symbol: ${JSON.stringify(generatedSymbols)}`);
    }
    const generatedUsageLine = generatedMacroSource.split('\n')[2];
    const generatedDefinition = await connection.sendRequest('textDocument/definition', {
        textDocument: { uri: generatedMacroUri },
        position: { line: 2, character: generatedUsageLine.indexOf('pay_add_request_type') + 1 }
    });
    if (!Array.isArray(generatedDefinition) || generatedDefinition[0]?.range?.start?.line !== 1) {
        throw new Error(`Rust server missed macro-generated definition: ${JSON.stringify(generatedDefinition)}`);
    }
    const generatedHover = await connection.sendRequest('textDocument/hover', {
        textDocument: { uri: generatedMacroUri },
        position: { line: 2, character: generatedUsageLine.indexOf('pay_add_request_type') + 1 }
    });
    if (!generatedHover?.contents?.value?.includes('pay_add_request_type')) {
        throw new Error(`Rust server missed macro-generated hover: ${JSON.stringify(generatedHover)}`);
    }
    connection.sendNotification('textDocument/didClose', { textDocument: { uri: generatedMacroUri } });

    writeFileSync(path.join(smokeWorkspace, 'feature.h'), '#define INCLUDED_FEATURE 1\n#define RequestType(name, method) \\\n    string name##_request_type = method;\n');
    const importedConditionalUri = pathToFileURL(path.join(smokeWorkspace, 'conditional.c')).toString();
    const importedConditionalSource = '#include "feature.h"\n#if INCLUDED_FEATURE\nint enabled_by_header() { return 1; }\n#else\nint disabled_by_header() { return 0; }\n#endif\nRequestType(imported_route, "GET")\nstring imported_method() { return imported_route_request_type; }\n';
    connection.sendNotification('textDocument/didOpen', {
        textDocument: {
            uri: importedConditionalUri,
            languageId: 'lpc',
            version: 1,
            text: importedConditionalSource
        }
    });
    const importedConditionalSymbols = await connection.sendRequest('textDocument/documentSymbol', {
        textDocument: { uri: importedConditionalUri }
    });
    if (!Array.isArray(importedConditionalSymbols)
        || !importedConditionalSymbols.some(symbol => symbol.name === 'enabled_by_header')
        || importedConditionalSymbols.some(symbol => symbol.name === 'disabled_by_header')
        || !importedConditionalSymbols.some(symbol => symbol.name === 'imported_route_request_type')) {
        throw new Error(`Rust server ignored imported macros in conditional compilation: ${JSON.stringify(importedConditionalSymbols)}`);
    }
    writeFileSync(path.join(smokeWorkspace, 'feature.h'), '#define INCLUDED_FEATURE 0\n#define RequestType(name, method) \\\n    string name##_request_type = method;\n');
    connection.sendNotification('lpc/sourceFileChange', {
        uri: pathToFileURL(path.join(smokeWorkspace, 'feature.h')).toString(),
        type: 'changed'
    });
    const refreshedConditionalSymbols = await connection.sendRequest('textDocument/documentSymbol', {
        textDocument: { uri: importedConditionalUri }
    });
    if (!Array.isArray(refreshedConditionalSymbols)
        || refreshedConditionalSymbols.some(symbol => symbol.name === 'enabled_by_header')
        || !refreshedConditionalSymbols.some(symbol => symbol.name === 'disabled_by_header')) {
        throw new Error(`Rust server kept stale imported macros after a header edit: ${JSON.stringify(refreshedConditionalSymbols)}`);
    }
    connection.sendNotification('textDocument/didClose', { textDocument: { uri: importedConditionalUri } });

    const macroLifecycleUri = 'file:///macro-lifecycle.c';
    const macroLifecycleSource = '#if 0\n#define DISABLED 1\n#endif\n#define LOCAL_FLAG 1\nint before = LOCAL_FLAG;\n#undef LOCAL_FLAG\nint after = LOCAL_FLAG;\nint disabled = DISABLED;\n';
    connection.sendNotification('textDocument/didOpen', {
        textDocument: {
            uri: macroLifecycleUri,
            languageId: 'lpc',
            version: 1,
            text: macroLifecycleSource
        }
    });
    const macroLifecycleTokens = decodeSemanticTokens((await connection.sendRequest(
        'textDocument/semanticTokens/full',
        { textDocument: { uri: macroLifecycleUri } }
    ))?.data ?? []);
    const localFlagTokens = macroLifecycleTokens.filter(token => token.tokenType === 8
        && macroLifecycleSource.split('\n')[token.line]?.slice(token.character, token.character + token.length) === 'LOCAL_FLAG');
    if (localFlagTokens.length !== 3
        || macroLifecycleTokens.some(token => token.tokenType === 8
            && macroLifecycleSource.split('\n')[token.line]?.slice(token.character, token.character + token.length) === 'DISABLED')) {
        throw new Error(`Rust server ignored macro source order or inactive branches: ${JSON.stringify(macroLifecycleTokens)}`);
    }
    const activeMacroHover = await connection.sendRequest('textDocument/hover', {
        textDocument: { uri: macroLifecycleUri },
        position: { line: 4, character: 15 }
    });
    const undefinedMacroHover = await connection.sendRequest('textDocument/hover', {
        textDocument: { uri: macroLifecycleUri },
        position: { line: 6, character: 14 }
    });
    if (!activeMacroHover?.contents?.value?.includes('#define LOCAL_FLAG 1') || undefinedMacroHover) {
        throw new Error(`Rust server returned stale macro hover after undef: ${JSON.stringify({ activeMacroHover, undefinedMacroHover })}`);
    }
    connection.sendNotification('textDocument/didClose', { textDocument: { uri: macroLifecycleUri } });

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

function decodeSemanticTokens(data) {
    let line = 0;
    let character = 0;
    const tokens = [];
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
