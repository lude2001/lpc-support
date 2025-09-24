/**
 * Mock VS Code API
 * 用于单元测试的VS Code API模拟
 */

export const MockVSCode = {
    // 基本类型
    Uri: {
        parse: (uri: string) => ({ 
            toString: () => uri,
            fsPath: uri.replace('file:///', ''),
            scheme: 'file',
            authority: '',
            path: uri.replace('file:///', '/'),
            query: '',
            fragment: ''
        })
    },
    
    Position: class {
        constructor(public line: number, public character: number) {}
        
        translate(lineDelta?: number, characterDelta?: number): any {
            return new MockVSCode.Position(
                this.line + (lineDelta || 0),
                this.character + (characterDelta || 0)
            );
        }
        
        with(line?: number, character?: number): any {
            return new MockVSCode.Position(
                line !== undefined ? line : this.line,
                character !== undefined ? character : this.character
            );
        }
        
        compareTo(other: any): number {
            if (this.line < other.line) return -1;
            if (this.line > other.line) return 1;
            if (this.character < other.character) return -1;
            if (this.character > other.character) return 1;
            return 0;
        }
        
        isEqual(other: any): boolean {
            return this.line === other.line && this.character === other.character;
        }
        
        isBefore(other: any): boolean {
            return this.compareTo(other) < 0;
        }
        
        isBeforeOrEqual(other: any): boolean {
            return this.compareTo(other) <= 0;
        }
        
        isAfter(other: any): boolean {
            return this.compareTo(other) > 0;
        }
        
        isAfterOrEqual(other: any): boolean {
            return this.compareTo(other) >= 0;
        }
    },
    
    Range: class {
        constructor(public start: any, public end: any) {}
        
        get isEmpty(): boolean {
            return this.start.isEqual(this.end);
        }
        
        get isSingleLine(): boolean {
            return this.start.line === this.end.line;
        }
        
        contains(positionOrRange: any): boolean {
            if (positionOrRange.line !== undefined) {
                // Position
                return positionOrRange.isAfterOrEqual(this.start) && 
                       positionOrRange.isBeforeOrEqual(this.end);
            } else {
                // Range
                return this.contains(positionOrRange.start) && 
                       this.contains(positionOrRange.end);
            }
        }
        
        intersection(range: any): any {
            const start = this.start.isAfter(range.start) ? this.start : range.start;
            const end = this.end.isBefore(range.end) ? this.end : range.end;
            if (start.isAfter(end)) {
                return undefined;
            }
            return new MockVSCode.Range(start, end);
        }
        
        union(other: any): any {
            const start = this.start.isBefore(other.start) ? this.start : other.start;
            const end = this.end.isAfter(other.end) ? this.end : other.end;
            return new MockVSCode.Range(start, end);
        }
        
        with(start?: any, end?: any): any {
            return new MockVSCode.Range(
                start || this.start,
                end || this.end
            );
        }
    },
    
    TextEdit: {
        replace: (range: any, newText: string) => ({
            range,
            newText
        }),
        
        insert: (position: any, newText: string) => ({
            range: new MockVSCode.Range(position, position),
            newText
        }),
        
        delete: (range: any) => ({
            range,
            newText: ''
        })
    },
    
    // 枚举
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
    
    // 窗口管理
    window: {
        showInformationMessage: jest.fn().mockResolvedValue(undefined),
        showWarningMessage: jest.fn().mockResolvedValue(undefined),
        showErrorMessage: jest.fn().mockResolvedValue(undefined),
        showQuickPick: jest.fn().mockResolvedValue(undefined),
        showInputBox: jest.fn().mockResolvedValue(undefined),
        showTextDocument: jest.fn().mockResolvedValue(undefined),
        createTextEditorDecorationType: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        activeTextEditor: undefined,
        onDidChangeActiveTextEditor: jest.fn().mockReturnValue({ dispose: jest.fn() })
    },
    
    // 工作区管理
    workspace: {
        getConfiguration: jest.fn().mockReturnValue({
            get: jest.fn((key: string, defaultValue?: any) => {
                // 返回默认值或预设值
                return defaultValue;
            }),
            update: jest.fn().mockResolvedValue(undefined),
            has: jest.fn().mockReturnValue(true),
            inspect: jest.fn().mockReturnValue({
                key: '',
                defaultValue: undefined,
                globalValue: undefined,
                workspaceValue: undefined,
                workspaceFolderValue: undefined
            })
        }),
        onDidChangeConfiguration: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        onDidChangeTextDocument: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        onDidOpenTextDocument: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        onDidCloseTextDocument: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        openTextDocument: jest.fn().mockResolvedValue(undefined),
        workspaceFolders: [],
        rootPath: undefined,
        name: undefined
    },
    
    // 语言服务
    languages: {
        createDiagnosticCollection: jest.fn().mockReturnValue({
            set: jest.fn(),
            delete: jest.fn(),
            clear: jest.fn(),
            dispose: jest.fn()
        }),
        getDiagnostics: jest.fn().mockReturnValue([]),
        registerCompletionItemProvider: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        registerHoverProvider: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        registerDefinitionProvider: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    },
    
    // 命令
    commands: {
        registerCommand: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        executeCommand: jest.fn().mockResolvedValue(undefined)
    },
    
    // 事件
    EventEmitter: class {
        private listeners: Function[] = [];
        
        get event() {
            return (listener: Function) => {
                this.listeners.push(listener);
                return { dispose: () => {
                    const index = this.listeners.indexOf(listener);
                    if (index >= 0) {
                        this.listeners.splice(index, 1);
                    }
                }};
            };
        }
        
        fire(e: any) {
            this.listeners.forEach(listener => listener(e));
        }
        
        dispose() {
            this.listeners = [];
        }
    },
    
    // 文件系统
    FileType: {
        Unknown: 0,
        File: 1,
        Directory: 2,
        SymbolicLink: 64
    },
    
    // 配置目标
    ConfigurationTarget: {
        Global: 1,
        Workspace: 2,
        WorkspaceFolder: 3
    },
    
    // 显示目标
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
    
    // 任务管理
    Task: class {
        constructor(
            public definition: any,
            public scope: any,
            public name: string,
            public source: string,
            public execution?: any,
            public problemMatchers?: string[]
        ) {}
    },
    
    // 进度指示器
    ProgressLocation: {
        SourceControl: 1,
        Window: 10,
        Notification: 15
    },
    
    // Mock扩展上下文
    ExtensionContext: {
        subscriptions: [],
        workspaceState: {
            get: jest.fn(),
            update: jest.fn()
        },
        globalState: {
            get: jest.fn(),
            update: jest.fn()
        },
        extensionPath: '/mock/extension/path',
        storagePath: '/mock/storage/path',
        globalStoragePath: '/mock/global/storage/path',
        logPath: '/mock/log/path'
    }
};
