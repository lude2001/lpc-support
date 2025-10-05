/**
 * Mock VS Code API
 * 用于单元测试的VS Code API模拟
 */

// 基本类型
export class Uri {
    constructor(
        public scheme: string,
        public authority: string,
        public path: string,
        public query: string,
        public fragment: string
    ) {}

    static parse(uri: string): Uri {
        return new Uri(
            'file',
            '',
            uri.replace('file:///', '/'),
            '',
            ''
        );
    }

    static file(path: string): Uri {
        // 规范化路径
        const normalizedPath = path.replace(/\\/g, '/');
        return new Uri(
            'file',
            '',
            normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`,
            '',
            ''
        );
    }

    toString(): string {
        return `${this.scheme}:///${this.path}`;
    }

    get fsPath(): string {
        return this.path;
    }
}

export class Position {
    constructor(public line: number, public character: number) {}

    translate(lineDelta?: number, characterDelta?: number): Position {
        return new Position(
            this.line + (lineDelta || 0),
            this.character + (characterDelta || 0)
        );
    }

    with(line?: number, character?: number): Position {
        return new Position(
            line !== undefined ? line : this.line,
            character !== undefined ? character : this.character
        );
    }

    compareTo(other: Position): number {
        if (this.line < other.line) return -1;
        if (this.line > other.line) return 1;
        if (this.character < other.character) return -1;
        if (this.character > other.character) return 1;
        return 0;
    }

    isEqual(other: Position): boolean {
        return this.line === other.line && this.character === other.character;
    }

    isBefore(other: Position): boolean {
        return this.compareTo(other) < 0;
    }

    isBeforeOrEqual(other: Position): boolean {
        return this.compareTo(other) <= 0;
    }

    isAfter(other: Position): boolean {
        return this.compareTo(other) > 0;
    }

    isAfterOrEqual(other: Position): boolean {
        return this.compareTo(other) >= 0;
    }
}

export class Range {
    constructor(public start: Position, public end: Position) {}

    get isEmpty(): boolean {
        return this.start.isEqual(this.end);
    }

    get isSingleLine(): boolean {
        return this.start.line === this.end.line;
    }

    contains(positionOrRange: Position | Range): boolean {
        if (positionOrRange instanceof Position) {
            return positionOrRange.isAfterOrEqual(this.start) &&
                   positionOrRange.isBeforeOrEqual(this.end);
        } else {
            return this.contains(positionOrRange.start) &&
                   this.contains(positionOrRange.end);
        }
    }

    intersection(range: Range): Range | undefined {
        const start = this.start.isAfter(range.start) ? this.start : range.start;
        const end = this.end.isBefore(range.end) ? this.end : range.end;
        if (start.isAfter(end)) {
            return undefined;
        }
        return new Range(start, end);
    }

    union(other: Range): Range {
        const start = this.start.isBefore(other.start) ? this.start : other.start;
        const end = this.end.isAfter(other.end) ? this.end : other.end;
        return new Range(start, end);
    }

    with(start?: Position, end?: Position): Range {
        return new Range(
            start || this.start,
            end || this.end
        );
    }
}

export const TextEdit = {
    replace: (range: Range, newText: string) => ({
        range,
        newText
    }),

    insert: (position: Position, newText: string) => ({
        range: new Range(position, position),
        newText
    }),

    delete: (range: Range) => ({
        range,
        newText: ''
    })
};

// 枚举
export enum EndOfLine {
    LF = 1,
    CRLF = 2
}

export enum DiagnosticSeverity {
    Error = 0,
    Warning = 1,
    Information = 2,
    Hint = 3
}

export enum ConfigurationTarget {
    Global = 1,
    Workspace = 2,
    WorkspaceFolder = 3
}

export enum ViewColumn {
    Active = -1,
    Beside = -2,
    One = 1,
    Two = 2,
    Three = 3,
    Four = 4,
    Five = 5,
    Six = 6,
    Seven = 7,
    Eight = 8,
    Nine = 9
}

export enum FileType {
    Unknown = 0,
    File = 1,
    Directory = 2,
    SymbolicLink = 64
}

export enum ProgressLocation {
    SourceControl = 1,
    Window = 10,
    Notification = 15
}

// 窗口管理
export const window = {
    showInformationMessage: jest.fn().mockResolvedValue(undefined),
    showWarningMessage: jest.fn().mockResolvedValue(undefined),
    showErrorMessage: jest.fn().mockResolvedValue(undefined),
    showQuickPick: jest.fn().mockResolvedValue(undefined),
    showInputBox: jest.fn().mockResolvedValue(undefined),
    showTextDocument: jest.fn().mockResolvedValue(undefined),
    createTextEditorDecorationType: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    activeTextEditor: undefined,
    onDidChangeActiveTextEditor: jest.fn().mockReturnValue({ dispose: jest.fn() })
};

// 工作区管理
export const workspace = {
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
    getWorkspaceFolder: jest.fn(),
    onDidChangeConfiguration: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    onDidChangeTextDocument: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    onDidOpenTextDocument: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    onDidCloseTextDocument: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    openTextDocument: jest.fn().mockResolvedValue(undefined),
    workspaceFolders: [],
    rootPath: undefined,
    name: undefined
};

// 语言服务
export const languages = {
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
};

// 命令
export const commands = {
    registerCommand: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    executeCommand: jest.fn().mockResolvedValue(undefined)
};

// 事件
export class EventEmitter {
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
}

// 任务管理
export class Task {
    constructor(
        public definition: any,
        public scope: any,
        public name: string,
        public source: string,
        public execution?: any,
        public problemMatchers?: string[]
    ) {}
}

// Mock扩展上下文
export const ExtensionContext = {
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
};

// 类型定义
export interface TextDocument {
    uri: Uri;
    fileName: string;
    languageId: string;
    version: number;
    lineCount: number;
    isDirty: boolean;
    isClosed: boolean;
    eol: EndOfLine;
    getText(range?: Range): string;
    lineAt(line: number): any;
    positionAt(offset: number): Position;
    offsetAt(position: Position): number;
    save(): Promise<boolean>;
    validateRange(range: Range): Range;
    validatePosition(position: Position): Position;
}
