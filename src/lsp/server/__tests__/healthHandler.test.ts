import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import {
    Disposable,
    NotificationType,
    TextDocumentSyncKind,
    type DidChangeTextDocumentParams,
    type DidCloseTextDocumentParams,
    type DidOpenTextDocumentParams,
    type InitializeParams,
    type InitializeResult
} from 'vscode-languageserver/node';
import { HealthRequest } from '../../shared/protocol/health';
import { WorkspaceConfigSyncNotification, type WorkspaceConfigSyncPayload } from '../../shared/protocol/workspaceConfigSync';
import { registerCapabilities, type ServerConnection } from '../bootstrap/registerCapabilities';
import { createHealthHandler } from '../handlers/health/healthHandler';
import { DocumentStore } from '../runtime/DocumentStore';
import { ServerLogger } from '../runtime/ServerLogger';
import { WorkspaceSession } from '../runtime/WorkspaceSession';

describe('createHealthHandler', () => {
    test('returns a deterministic phase-a payload', async () => {
        const store = new DocumentStore();
        const handleHealth = createHealthHandler({
            documentStore: store,
            serverVersion: '0.40.0-test'
        });

        const result = await handleHealth();

        expect(result).toEqual({
            status: 'ok',
            mode: 'phase-a',
            serverVersion: '0.40.0-test',
            documentCount: 0
        });
    });
});

describe('registerCapabilities', () => {
    test('registers initialize, full text sync, document lifecycle, and health request', async () => {
        let initializeHandler: ((params: InitializeParams) => InitializeResult) | undefined;
        let openHandler: ((params: DidOpenTextDocumentParams) => void) | undefined;
        let changeHandler: ((params: DidChangeTextDocumentParams) => void) | undefined;
        let closeHandler: ((params: DidCloseTextDocumentParams) => void) | undefined;
        let workspaceConfigSyncHandler: ((payload: WorkspaceConfigSyncPayload) => void) | undefined;
        let registeredHealthHandler: (() => Promise<unknown>) | undefined;

        const connection: ServerConnection = {
            onInitialize: jest.fn(handler => {
                initializeHandler = handler;
                return Disposable.create(() => undefined);
            }),
            onDidOpenTextDocument: jest.fn(handler => {
                openHandler = handler;
                return Disposable.create(() => undefined);
            }),
            onDidChangeTextDocument: jest.fn(handler => {
                changeHandler = handler;
                return Disposable.create(() => undefined);
            }),
            onDidCloseTextDocument: jest.fn(handler => {
                closeHandler = handler;
                return Disposable.create(() => undefined);
            }),
            onNotification: jest.fn((type, handler) => {
                expect(type).toBe(WorkspaceConfigSyncNotification.type as NotificationType<WorkspaceConfigSyncPayload>);
                workspaceConfigSyncHandler = handler;
                return Disposable.create(() => undefined);
            }),
            onRequest: jest.fn((type, handler) => {
                expect(type).toBe(HealthRequest.type);
                registeredHealthHandler = handler as () => Promise<unknown>;
                return Disposable.create(() => undefined);
            })
        };
        const documentStore = new DocumentStore();
        const workspaceSession = new WorkspaceSession();
        const logger = new ServerLogger({
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            log: jest.fn()
        });

        registerCapabilities({
            connection,
            documentStore,
            logger,
            serverVersion: '0.40.0-test',
            workspaceSession
        });

        expect(initializeHandler?.({} as InitializeParams)).toEqual({
            capabilities: {
                textDocumentSync: TextDocumentSyncKind.Full
            },
            serverInfo: {
                name: 'lpc-support-phase-a',
                version: '0.40.0-test'
            }
        });

        workspaceConfigSyncHandler?.({
            workspaceRoots: ['D:/workspace'],
            workspaces: [
                {
                    workspaceRoot: 'D:/workspace',
                    projectConfigPath: 'D:/workspace/lpc-support.json',
                    configHellPath: 'config.hell',
                    resolvedConfig: {
                        includeDirectories: ['include']
                    },
                    lastSyncedAt: '2026-04-10T00:00:00.000Z'
                }
            ]
        });
        expect(workspaceSession.getWorkspaceRoots()).toEqual(['D:/workspace']);
        expect(workspaceSession.getWorkspaceConfig('D:/workspace')).toEqual({
            projectConfigPath: 'D:/workspace/lpc-support.json',
            configHellPath: 'config.hell',
            resolvedConfig: {
                includeDirectories: ['include']
            },
            lastSyncedAt: '2026-04-10T00:00:00.000Z'
        });

        openHandler?.({
            textDocument: {
                uri: 'file:///phase-a-test.c',
                languageId: 'lpc',
                version: 1,
                text: 'one'
            }
        });
        expect(documentStore.get('file:///phase-a-test.c')).toEqual({
            uri: 'file:///phase-a-test.c',
            version: 1,
            text: 'one'
        });

        changeHandler?.({
            textDocument: {
                uri: 'file:///phase-a-test.c',
                version: 2
            },
            contentChanges: [
                {
                    text: 'two'
                }
            ]
        });
        expect(documentStore.get('file:///phase-a-test.c')).toEqual({
            uri: 'file:///phase-a-test.c',
            version: 2,
            text: 'two'
        });

        expect(await registeredHealthHandler?.()).toEqual({
            status: 'ok',
            mode: 'phase-a',
            serverVersion: '0.40.0-test',
            documentCount: 1
        });

        closeHandler?.({
            textDocument: {
                uri: 'file:///phase-a-test.c'
            }
        });
        expect(documentStore.get('file:///phase-a-test.c')).toBeUndefined();
    });
});
