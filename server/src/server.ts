import {
	createConnection,
	TextDocuments,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	TextDocumentSyncKind,
	InitializeResult,
	Diagnostic,
	DiagnosticSeverity,
	SemanticTokensBuilder,
	TextDocumentPositionParams,
	CompletionItem
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

import { CharStreams, CommonTokenStream } from 'antlr4ts';
import { LPCLexer } from './parser/LPCLexer';
import { LPCParser } from './parser/LPCParser';
import { LpcErrorListener } from './diagnostics';
import { LpcSymbolVisitor } from './symbolVisitor';
import { LpcSemanticTokensVisitor } from './semanticTokensVisitor';
import { LpcSemanticDiagnosticsVisitor } from './semanticDiagnosticsVisitor';
import { LpcCompletionVisitor } from './completion';

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

// The global settings, used when so declared in the client capabilities
interface ExampleSettings {
	maxNumberOfProblems: number;
}

// The global settings, used when -workspace/configuration is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
let globalSettings: ExampleSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

const legend = {
	tokenTypes: ['function', 'variable', 'string', 'comment', 'keyword', 'number', 'operator', 'type', 'class'],
	tokenModifiers: ['declaration', 'readonly']
};

connection.onInitialize((params: InitializeParams) => {
	const capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we fall back using global settings.
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
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

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	const text = textDocument.getText();
	const inputStream = CharStreams.fromString(text);
	const lexer = new LPCLexer(inputStream);
	const tokenStream = new CommonTokenStream(lexer);
	const parser = new LPCParser(tokenStream);

	const errorListener = new LpcErrorListener(textDocument);
	parser.removeErrorListeners();
	parser.addErrorListener(errorListener);

	const tree = parser.program();

	let diagnostics: Diagnostic[] = [];

	diagnostics = diagnostics.concat(errorListener.getDiagnostics());

	const semanticVisitor = new LpcSemanticDiagnosticsVisitor(textDocument);
	semanticVisitor.runPrePass(tree);
	semanticVisitor.visit(tree);
	diagnostics = diagnostics.concat(semanticVisitor.getDiagnostics());

	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
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
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
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
	} else {
		globalSettings = <ExampleSettings>(
			(change.settings.lpcLanguageServer || defaultSettings)
		);
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
	const inputStream = CharStreams.fromString(text);
	const lexer = new LPCLexer(inputStream);
	const tokenStream = new CommonTokenStream(lexer);
	const parser = new LPCParser(tokenStream);
	const tree = parser.program();

	const visitor = new LpcSymbolVisitor(document);
	return visitor.visit(tree);
});

connection.languages.semanticTokens.on((params) => {
	const document = documents.get(params.textDocument.uri);
	if (!document) {
		return { data: [] };
	}
	const tokens = CharStreams.fromString(document.getText());
	const lexer = new LPCLexer(tokens);
	const tokenStream = new CommonTokenStream(lexer);
	const parser = new LPCParser(tokenStream);
	parser.removeErrorListeners(); // Don't need errors here
	const tree = parser.program();

	const visitor = new LpcSemanticTokensVisitor(legend);
	visitor.visit(tree);
	return visitor.getTokens();
});

// --- Completion Handlers ---

connection.onCompletion(
	async (textDocumentPosition: TextDocumentPositionParams): Promise<CompletionItem[]> => {
		const document = documents.get(textDocumentPosition.textDocument.uri);
		if (!document) {
			return [];
		}

		const text = document.getText();
		const inputStream = CharStreams.fromString(text);
		const lexer = new LPCLexer(inputStream);
		const tokenStream = new CommonTokenStream(lexer);
		const parser = new LPCParser(tokenStream);
		parser.removeErrorListeners();
		const tree = parser.program();

		const completionVisitor = new LpcCompletionVisitor(document, textDocumentPosition.position, tree);
		return completionVisitor.getCompletions();
	}
);

connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		return item;
	}
);

// Make the text document manager listen on the connection
documents.listen(connection);

// Start listening for connections
connection.listen(); 