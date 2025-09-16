/**
 * E2E测试设置文件  
 * 为端到端测试提供完整的环境模拟
 */

import { jest } from '@jest/globals';
import * as path from 'path';
import * as fs from 'fs';

beforeAll(async () => {
    // E2E测试需要更长的超时时间
    jest.setTimeout(60000);

    // 创建测试数据目录
    const testDataDir = path.join(__dirname, '../data');
    const tempDir = path.join(__dirname, '../temp'); 

    if (!fs.existsSync(testDataDir)) {
        fs.mkdirSync(testDataDir, { recursive: true });
    }
    
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    // 模拟完整的VS Code扩展环境
    (global as any).vscode = {
        ExtensionContext: jest.fn(),
        Uri: {
            file: jest.fn((filePath: string) => ({
                fsPath: filePath,
                path: filePath,
                scheme: 'file',
                authority: '',
                fragment: '',
                query: '',
                toString: () => `file://${filePath}`,
                toJSON: () => ({ scheme: 'file', path: filePath }),
                with: jest.fn()
            })),
            parse: jest.fn()
        },
        Range: jest.fn((start, end) => ({ start, end, isEmpty: false, isSingleLine: false })),
        Position: jest.fn((line, character) => ({ line, character })),
        Selection: jest.fn((anchor, active) => ({ anchor, active, isEmpty: false })),
        workspace: {
            getConfiguration: jest.fn((section?: string) => ({
                get: jest.fn((key: string, defaultValue?: any) => {
                    const fullKey = section ? `${section}.${key}` : key;
                    const configs: any = {
                    };
                    return configs[fullKey] ?? defaultValue;
                }),
                has: jest.fn(),
                inspect: jest.fn(),
                update: jest.fn()
            })),
            openTextDocument: jest.fn((uri) => Promise.resolve({
                uri,
                fileName: uri.fsPath,
                languageId: 'lpc',
                version: 1,
                isDirty: false,
                isUntitled: false,
                lineCount: 10,
                getText: jest.fn(() => 'mock file content'),
                save: jest.fn(),
                eol: 1
            })),
            fs: {
                readFile: jest.fn((uri) => {
                    const content = fs.readFileSync(uri.fsPath, 'utf8');
                    return Promise.resolve(new Uint8Array(Buffer.from(content, 'utf8')));
                }),
                writeFile: jest.fn((uri, content) => {
                    const textContent = Buffer.from(content).toString('utf8');
                    fs.writeFileSync(uri.fsPath, textContent);
                    return Promise.resolve();
                }),
                stat: jest.fn()
            },
            workspaceFolders: [{
                uri: { fsPath: process.cwd() },
                name: 'test-workspace',
                index: 0
            }]
        },
        window: {
            showInformationMessage: jest.fn(),
            showWarningMessage: jest.fn(),
            showErrorMessage: jest.fn(),
            showQuickPick: jest.fn(),
            showInputBox: jest.fn(),
            activeTextEditor: null,
            visibleTextEditors: [],
            showTextDocument: jest.fn(),
            withProgress: jest.fn((options, task) => {
                const progress = {
                    report: jest.fn()
                };
                const token = {
                    isCancellationRequested: false,
                    onCancellationRequested: jest.fn()
                };
                return task(progress, token);
            })
        },
        languages: {
            registerDocumentFormattingProvider: jest.fn((selector, provider) => ({
                dispose: jest.fn()
            })),
            registerDocumentRangeFormattingProvider: jest.fn(),
            createDiagnosticCollection: jest.fn(() => ({
                set: jest.fn(),
                delete: jest.fn(),
                clear: jest.fn(),
                dispose: jest.fn()
            })),
            getDiagnostics: jest.fn(() => [])
        },
        commands: {
            registerCommand: jest.fn((command, callback) => ({
                dispose: jest.fn()
            })),
            executeCommand: jest.fn()
        },
        TextEdit: {
            replace: jest.fn((range, newText) => ({ range, newText })),
            insert: jest.fn(),
            delete: jest.fn()
        },
        WorkspaceEdit: jest.fn(() => ({
            set: jest.fn(),
            insert: jest.fn(),
            replace: jest.fn(),
            delete: jest.fn()
        })),
        DiagnosticSeverity: {
            Error: 0,
            Warning: 1,
            Information: 2,
            Hint: 3
        },
        StatusBarAlignment: {
            Left: 1,
            Right: 2
        },
        ViewColumn: {
            Active: -1,
            Beside: -2,
            One: 1,
            Two: 2,
            Three: 3
        }
    };

    console.log('E2E testing environment initialized');
});

beforeEach(() => {
    jest.clearAllMocks();
});

afterEach(() => {
    jest.restoreAllMocks();
});

afterAll(() => {
    // 清理测试临时文件
    const tempDir = path.join(__dirname, '../temp');
    if (fs.existsSync(tempDir)) {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (error) {
            console.warn('Failed to clean up temp directory:', error);
        }
    }
    
    console.log('E2E testing cleanup completed');
});