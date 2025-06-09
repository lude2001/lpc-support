"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_1 = require("vscode-languageserver/node");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const antlr4ts_1 = require("antlr4ts");
const LPCLexer_1 = require("./parser/LPCLexer");
const LPCParser_1 = require("./parser/LPCParser");
const diagnostics_1 = require("./diagnostics");
const symbolVisitor_1 = require("./symbolVisitor");
const semanticTokensVisitor_1 = require("./semanticTokensVisitor");
const semanticDiagnosticsVisitor_1 = require("./semanticDiagnosticsVisitor");
const completion_1 = require("./completion");
// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = (0, node_1.createConnection)(node_1.ProposedFeatures.all);
// Create a simple text document manager.
const documents = new node_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;
// The global settings, used when -workspace/configuration is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings = { maxNumberOfProblems: 1000 };
let globalSettings = defaultSettings;
// Cache the settings of all open documents
const documentSettings = new Map();
const legend = {
    tokenTypes: ['function', 'variable', 'string', 'comment', 'keyword', 'number', 'operator', 'type', 'class'],
    tokenModifiers: ['declaration', 'readonly']
};
connection.onInitialize((params) => {
    const capabilities = params.capabilities;
    // Does the client support the `workspace/configuration` request?
    // If not, we fall back using global settings.
    hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
    hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);
    hasDiagnosticRelatedInformationCapability = !!(capabilities.textDocument &&
        capabilities.textDocument.publishDiagnostics &&
        capabilities.textDocument.publishDiagnostics.relatedInformation);
    const result = {
        capabilities: {
            textDocumentSync: node_1.TextDocumentSyncKind.Incremental,
            documentSymbolProvider: true,
            semanticTokensProvider: {
                legend,
                full: true
            }
        }
    };
    if (hasWorkspaceFolderCapability) {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true
            }
        };
    }
    return result;
});
// The content of a text document has changed. This event is emitted
// when the text document is first opened or when its content has changed.
documents.onDidChangeContent(change => {
    validateTextDocument(change.document);
});
function validateTextDocument(textDocument) {
    return __awaiter(this, void 0, void 0, function* () {
        const text = textDocument.getText();
        const inputStream = antlr4ts_1.CharStreams.fromString(text);
        const lexer = new LPCLexer_1.LPCLexer(inputStream);
        const tokenStream = new antlr4ts_1.CommonTokenStream(lexer);
        const parser = new LPCParser_1.LPCParser(tokenStream);
        const errorListener = new diagnostics_1.LpcErrorListener(textDocument);
        parser.removeErrorListeners();
        parser.addErrorListener(errorListener);
        const tree = parser.program();
        let diagnostics = [];
        diagnostics = diagnostics.concat(errorListener.getDiagnostics());
        const semanticVisitor = new semanticDiagnosticsVisitor_1.LpcSemanticDiagnosticsVisitor(textDocument);
        semanticVisitor.runPrePass(tree);
        semanticVisitor.visit(tree);
        diagnostics = diagnostics.concat(semanticVisitor.getDiagnostics());
        connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
    });
}
function getDocumentSettings(resource) {
    if (!hasConfigurationCapability) {
        return Promise.resolve(globalSettings);
    }
    let result = documentSettings.get(resource);
    if (!result) {
        result = connection.workspace.getConfiguration({
            scopeUri: resource,
            section: 'lpcLanguageServer'
        });
        documentSettings.set(resource, result);
    }
    return result;
}
connection.onInitialized(() => {
    if (hasConfigurationCapability) {
        // Register for all configuration changes.
        connection.client.register(node_1.DidChangeConfigurationNotification.type, undefined);
    }
    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders(_event => {
            connection.console.log('Workspace folder change event received.');
        });
    }
});
connection.onDidChangeConfiguration(change => {
    if (hasConfigurationCapability) {
        // Reset all cached document settings
        documentSettings.clear();
    }
    else {
        globalSettings = ((change.settings.lpcLanguageServer || defaultSettings));
    }
    // Revalidate all open text documents
    documents.all().forEach(validateTextDocument);
});
connection.onDocumentSymbol((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return undefined;
    }
    // Here, we can reuse the parsing logic from validateTextDocument,
    // or create a more optimized service to cache the AST.
    // For now, we'll re-parse.
    const text = document.getText();
    const inputStream = antlr4ts_1.CharStreams.fromString(text);
    const lexer = new LPCLexer_1.LPCLexer(inputStream);
    const tokenStream = new antlr4ts_1.CommonTokenStream(lexer);
    const parser = new LPCParser_1.LPCParser(tokenStream);
    const tree = parser.program();
    const visitor = new symbolVisitor_1.LpcSymbolVisitor(document);
    return visitor.visit(tree);
});
connection.languages.semanticTokens.on((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return { data: [] };
    }
    const tokens = antlr4ts_1.CharStreams.fromString(document.getText());
    const lexer = new LPCLexer_1.LPCLexer(tokens);
    const tokenStream = new antlr4ts_1.CommonTokenStream(lexer);
    const parser = new LPCParser_1.LPCParser(tokenStream);
    parser.removeErrorListeners(); // Don't need errors here
    const tree = parser.program();
    const visitor = new semanticTokensVisitor_1.LpcSemanticTokensVisitor(legend);
    visitor.visit(tree);
    return visitor.getTokens();
});
// --- Completion Handlers ---
connection.onCompletion((textDocumentPosition) => __awaiter(void 0, void 0, void 0, function* () {
    const document = documents.get(textDocumentPosition.textDocument.uri);
    if (!document) {
        return [];
    }
    const text = document.getText();
    const inputStream = antlr4ts_1.CharStreams.fromString(text);
    const lexer = new LPCLexer_1.LPCLexer(inputStream);
    const tokenStream = new antlr4ts_1.CommonTokenStream(lexer);
    const parser = new LPCParser_1.LPCParser(tokenStream);
    parser.removeErrorListeners();
    const tree = parser.program();
    const completionVisitor = new completion_1.LpcCompletionVisitor(document, textDocumentPosition.position, tree);
    return completionVisitor.getCompletions();
}));
connection.onCompletionResolve((item) => {
    return item;
});
// Make the text document manager listen on the connection
documents.listen(connection);
// Start listening for connections
connection.listen();
//# sourceMappingURL=server.js.map