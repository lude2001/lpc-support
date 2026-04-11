import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Disposable, type DocumentFormattingParams, type DocumentRangeFormattingParams, type InitializeParams, type InitializeResult } from 'vscode-languageserver/node';
import { FormattingService } from '../../formatter/FormattingService';
import { createLanguageFormattingService } from '../../language/services/formatting/LanguageFormattingService';
import { registerCapabilities, type ServerConnection } from '../server/bootstrap/registerCapabilities';
import { registerFormattingHandlers } from '../server/handlers/formatting/registerFormattingHandlers';
import { DocumentStore } from '../server/runtime/DocumentStore';
import { ServerLogger } from '../server/runtime/ServerLogger';
import { WorkspaceSession } from '../server/runtime/WorkspaceSession';
import { TestHelper } from '../../__tests__/utils/TestHelper';
import { clearGlobalParsedDocumentService } from '../../parser/ParsedDocumentService';

const FIXTURE_ROOT = path.resolve(__dirname, '../../../test/lpc_code');
const FIXTURE_NAME = 'meridiand.c';

describe('formatting parity', () => {
    afterEach(() => {
        jest.restoreAllMocks();
        jest.resetModules();
    });

    test('shared formatting service and LSP formatting handlers produce the same document and range output', async () => {
        let initializeHandler: ((params: InitializeParams) => InitializeResult) | undefined;
        let documentFormattingHandler:
            | ((params: DocumentFormattingParams) => Promise<unknown[]> | unknown[])
            | undefined;
        let documentRangeFormattingHandler:
            | ((params: DocumentRangeFormattingParams) => Promise<unknown[]> | unknown[])
            | undefined;

        const formattingService = createLanguageFormattingService(new FormattingService());
        const connection = createConnectionStub({
            onInitialize: jest.fn(handler => {
                initializeHandler = handler;
                return Disposable.create(() => undefined);
            }),
            onDocumentFormatting: jest.fn(handler => {
                documentFormattingHandler = handler;
                return Disposable.create(() => undefined);
            }),
            onDocumentRangeFormatting: jest.fn(handler => {
                documentRangeFormattingHandler = handler;
                return Disposable.create(() => undefined);
            })
        });
        const documentStore = new DocumentStore();
        const workspaceSession = new WorkspaceSession({
            workspaceRoots: ['D:/workspace'],
            featureServices: {
                formattingService
            }
        });
        const logger = new ServerLogger({
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            log: jest.fn()
        });

        const source = fs.readFileSync(path.join(FIXTURE_ROOT, FIXTURE_NAME), 'utf8');
        const document = TestHelper.createMockDocument(source, 'lpc', FIXTURE_NAME);
        const range = new vscode.Range(9, 0, 22, document.lineAt(22).text.length);

        documentStore.open(`file:///${FIXTURE_NAME}`, 1, source);

        registerFormattingHandlers({
            connection,
            documentStore,
            workspaceSession,
            formattingService
        });

        registerCapabilities({
            connection,
            documentStore,
            logger,
            serverVersion: '0.40.0-test',
            workspaceSession,
            formattingService
        });

        expect(initializeHandler?.({} as InitializeParams)).toEqual({
            capabilities: {
                documentFormattingProvider: true,
                documentRangeFormattingProvider: true,
                textDocumentSync: 1
            },
            serverInfo: {
                name: 'lpc-support-phase-a',
                version: '0.40.0-test'
            }
        });

        const sharedDocumentOutput = await applySharedDocumentFormatting(
            formattingService,
            document,
            source
        );
        const lspDocumentOutput = await applyLspDocumentFormatting(
            documentFormattingHandler,
            source,
            `file:///${FIXTURE_NAME}`
        );

        const sharedRangeOutput = await applySharedRangeFormatting(
            formattingService,
            document,
            source,
            range
        );
        const lspRangeOutput = await applyLspRangeFormatting(
            documentRangeFormattingHandler,
            source,
            `file:///${FIXTURE_NAME}`,
            range
        );

        expect(sharedDocumentOutput).toBe(lspDocumentOutput);
        expect(sharedRangeOutput).toBe(lspRangeOutput);
    });
});

async function applySharedDocumentFormatting(
    formattingService: ReturnType<typeof createLanguageFormattingService>,
    document: ReturnType<typeof TestHelper.createMockDocument>,
    source: string
): Promise<string> {
    clearGlobalParsedDocumentService();
    const edits = await formattingService.formatDocument({
        document: {
            uri: document.uri.toString(),
            version: document.version,
            getText: () => document.getText()
        }
    });

    return applyEditsToSource(source, document, edits);
}

async function applySharedRangeFormatting(
    formattingService: ReturnType<typeof createLanguageFormattingService>,
    document: ReturnType<typeof TestHelper.createMockDocument>,
    source: string,
    range: vscode.Range
): Promise<string> {
    clearGlobalParsedDocumentService();
    const edits = await formattingService.formatRange({
        document: {
            uri: document.uri.toString(),
            version: document.version,
            getText: () => document.getText()
        },
        range: {
            start: { line: range.start.line, character: range.start.character },
            end: { line: range.end.line, character: range.end.character }
        }
    });

    return applyEditsToSource(source, document, edits);
}

async function applyLspDocumentFormatting(
    handler: ((params: DocumentFormattingParams) => Promise<unknown[]> | unknown[]) | undefined,
    source: string,
    uri: string
): Promise<string> {
    clearGlobalParsedDocumentService();
    const edits = await handler?.({
        textDocument: { uri }
    } as DocumentFormattingParams);

    return applyEditsToSource(source, TestHelper.createMockDocument(source, 'lpc', FIXTURE_NAME), edits ?? []);
}

async function applyLspRangeFormatting(
    handler: ((params: DocumentRangeFormattingParams) => Promise<unknown[]> | unknown[]) | undefined,
    source: string,
    uri: string,
    range: vscode.Range
): Promise<string> {
    clearGlobalParsedDocumentService();
    const edits = await handler?.({
        textDocument: { uri },
        range: {
            start: { line: range.start.line, character: range.start.character },
            end: { line: range.end.line, character: range.end.character }
        }
    } as DocumentRangeFormattingParams);

    return applyEditsToSource(source, TestHelper.createMockDocument(source, 'lpc', FIXTURE_NAME), edits ?? []);
}

function applyEditsToSource(
    source: string,
    document: ReturnType<typeof TestHelper.createMockDocument>,
    edits: Array<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; newText: string }>
): string {
    const orderedEdits = edits
        .map((edit) => ({
            startOffset: document.offsetAt(new vscode.Position(edit.range.start.line, edit.range.start.character)),
            endOffset: document.offsetAt(new vscode.Position(edit.range.end.line, edit.range.end.character)),
            newText: edit.newText
        }))
        .sort((left, right) => {
            if (left.startOffset !== right.startOffset) {
                return right.startOffset - left.startOffset;
            }

            return right.endOffset - left.endOffset;
        });

    let output = source;
    for (const edit of orderedEdits) {
        output = `${output.slice(0, edit.startOffset)}${edit.newText}${output.slice(edit.endOffset)}`;
    }

    return output.replace(/\r\n/g, '\n');
}

function createConnectionStub(overrides: Partial<ServerConnection> = {}): ServerConnection {
    return {
        onInitialize: jest.fn(() => Disposable.create(() => undefined)),
        onDidOpenTextDocument: jest.fn(() => Disposable.create(() => undefined)),
        onDidChangeTextDocument: jest.fn(() => Disposable.create(() => undefined)),
        onDidCloseTextDocument: jest.fn(() => Disposable.create(() => undefined)),
        onNotification: jest.fn(() => Disposable.create(() => undefined)),
        onRequest: jest.fn(() => Disposable.create(() => undefined)),
        onCompletion: jest.fn(() => Disposable.create(() => undefined)),
        onCompletionResolve: jest.fn(() => Disposable.create(() => undefined)),
        onHover: jest.fn(() => Disposable.create(() => undefined)),
        onDefinition: jest.fn(() => Disposable.create(() => undefined)),
        onReferences: jest.fn(() => Disposable.create(() => undefined)),
        onPrepareRename: jest.fn(() => Disposable.create(() => undefined)),
        onRenameRequest: jest.fn(() => Disposable.create(() => undefined)),
        onDocumentSymbol: jest.fn(() => Disposable.create(() => undefined)),
        onFoldingRanges: jest.fn(() => Disposable.create(() => undefined)),
        onDocumentFormatting: jest.fn(() => Disposable.create(() => undefined)),
        onDocumentRangeFormatting: jest.fn(() => Disposable.create(() => undefined)),
        languages: {
            semanticTokens: {
                on: jest.fn(() => Disposable.create(() => undefined))
            }
        },
        ...overrides
    };
}
