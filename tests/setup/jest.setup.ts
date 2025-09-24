/**
 * Jest 设置文件
 * 在测试运行之前设置全局mock和配置
 */

// Mock VS Code API
const mockVSCode = {
    Uri: {
        parse: jest.fn((uri: string) => ({
            toString: () => uri,
            fsPath: uri.replace('file:///', ''),
            scheme: 'file',
            authority: '',
            path: uri.replace('file:///', '/'),
            query: '',
            fragment: ''
        }))
    },
    
    Position: jest.fn((line: number, character: number) => ({
        line,
        character,
        translate: jest.fn(),
        with: jest.fn(),
        compareTo: jest.fn(),
        isEqual: jest.fn(),
        isBefore: jest.fn(),
        isBeforeOrEqual: jest.fn(),
        isAfter: jest.fn(),
        isAfterOrEqual: jest.fn()
    })),
    
    Range: jest.fn((start: any, end: any) => ({
        start,
        end,
        isEmpty: false,
        isSingleLine: true,
        contains: jest.fn(),
        intersection: jest.fn(),
        union: jest.fn(),
        with: jest.fn()
    })),
    
    TextEdit: {
        replace: jest.fn((range: any, newText: string) => ({ range, newText })),
        insert: jest.fn((position: any, newText: string) => ({ range: { start: position, end: position }, newText })),
        delete: jest.fn((range: any) => ({ range, newText: '' }))
    },
    
    EndOfLine: {
        LF: 1,
        CRLF: 2
    },
    
    DiagnosticSeverity: {
        Error: 0,
        Warning: 1,
        Information: 2,
        Hint: 3
    },
    
    window: {
        showInformationMessage: jest.fn(),
        showWarningMessage: jest.fn(),
        showErrorMessage: jest.fn(),
        showQuickPick: jest.fn(),
        showInputBox: jest.fn(),
        showTextDocument: jest.fn(),
        createTextEditorDecorationType: jest.fn(),
        activeTextEditor: undefined,
        onDidChangeActiveTextEditor: jest.fn()
    },
    
    workspace: {
        getConfiguration: jest.fn(() => ({
            get: jest.fn((key: string, defaultValue?: any) => {
                return defaultValue;
            }),
            update: jest.fn(),
            has: jest.fn(() => true),
            inspect: jest.fn(() => ({
                key: '',
                defaultValue: undefined,
                globalValue: undefined,
                workspaceValue: undefined,
                workspaceFolderValue: undefined
            }))
        })),
        onDidChangeConfiguration: jest.fn(() => ({ dispose: jest.fn() })),
        onDidChangeTextDocument: jest.fn(() => ({ dispose: jest.fn() })),
        onDidOpenTextDocument: jest.fn(() => ({ dispose: jest.fn() })),
        onDidCloseTextDocument: jest.fn(() => ({ dispose: jest.fn() })),
        openTextDocument: jest.fn(),
        workspaceFolders: [],
        rootPath: undefined,
        name: undefined
    },
    
    languages: {
        createDiagnosticCollection: jest.fn(() => ({
            set: jest.fn(),
            delete: jest.fn(),
            clear: jest.fn(),
            dispose: jest.fn()
        })),
        getDiagnostics: jest.fn(() => []),
        registerCompletionItemProvider: jest.fn(() => ({ dispose: jest.fn() })),
        registerHoverProvider: jest.fn(() => ({ dispose: jest.fn() })),
        registerDefinitionProvider: jest.fn(() => ({ dispose: jest.fn() })),
    },
    
    commands: {
        registerCommand: jest.fn(() => ({ dispose: jest.fn() })),
        executeCommand: jest.fn()
    },
    
    EventEmitter: jest.fn(() => ({
        event: jest.fn(),
        fire: jest.fn(),
        dispose: jest.fn()
    })),
    
    FileType: {
        Unknown: 0,
        File: 1,
        Directory: 2,
        SymbolicLink: 64
    },
    
    ConfigurationTarget: {
        Global: 1,
        Workspace: 2,
        WorkspaceFolder: 3
    },
    
    ViewColumn: {
        Active: -1,
        Beside: -2,
        One: 1,
        Two: 2,
        Three: 3,
        Four: 4,
        Five: 5,
        Six: 6,
        Seven: 7,
        Eight: 8,
        Nine: 9
    },
    
    ProgressLocation: {
        SourceControl: 1,
        Window: 10,
        Notification: 15
    }
};

// 设置全局mock
jest.doMock('vscode', () => mockVSCode);

// 设置环境变量
process.env.NODE_ENV = 'test';
process.env.VSCODE_TEST_DATA_PATH = './test-data';

// 扩展期望函数
expect.extend({
    toBeWithinRange(received: number, floor: number, ceiling: number) {
        const pass = received >= floor && received <= ceiling;
        if (pass) {
            return {
                message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
                pass: true
            };
        } else {
            return {
                message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
                pass: false
            };
        }
    }
});

// 扩展全局类型
declare global {
    namespace jest {
        interface Matchers<R> {
            toBeWithinRange(floor: number, ceiling: number): R;
        }
    }
}
