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
    public start: Position;
    public end: Position;

    constructor(start: Position | number, end: Position | number, endLine?: number, endCharacter?: number) {
        if (start instanceof Position && end instanceof Position) {
            this.start = start;
            this.end = end;
            return;
        }

        this.start = new Position(start as number, end as number);
        this.end = new Position(endLine ?? start as number, endCharacter ?? end as number);
    }

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

export class Location {
    constructor(public uri: Uri, public range: Range) {}
}

export class WorkspaceEdit {
    private readonly replacements = new Map<string, Array<{ range: Range; newText: string }>>();

    replace(uri: Uri, range: Range, newText: string): void {
        const key = uri.toString();
        const existing = this.replacements.get(key) || [];
        existing.push({ range, newText });
        this.replacements.set(key, existing);
    }

    entries(): Array<[Uri, Array<{ range: Range; newText: string }>]> {
        return Array.from(this.replacements.entries()).map(([key, edits]) => [Uri.parse(key), edits]);
    }
}

export class Diagnostic {
    public code?: string | number;
    public source?: string;
    public relatedInformation?: any[];
    public tags?: any[];

    constructor(
        public range: Range,
        public message: string,
        public severity: DiagnosticSeverity = DiagnosticSeverity.Error
    ) {}
}

export class ThemeIcon {
    static readonly File = new ThemeIcon('file');

    constructor(public id: string) {}
}

export class TreeItem {
    public tooltip?: string;
    public description?: string;
    public iconPath?: any;
    public contextValue?: string;
    public command?: any;

    constructor(
        public label: string,
        public collapsibleState: TreeItemCollapsibleState = TreeItemCollapsibleState.None
    ) {}
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

export class Selection extends Range {
    constructor(anchor: Position, active: Position) {
        super(anchor, active);
    }
}

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

export enum TreeItemCollapsibleState {
    None = 0,
    Collapsed = 1,
    Expanded = 2
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

export enum CompletionItemKind {
    Text = 0,
    Method = 1,
    Function = 2,
    Constructor = 3,
    Field = 4,
    Variable = 5,
    Class = 6,
    Interface = 7,
    Module = 8,
    Property = 9,
    Unit = 10,
    Value = 11,
    Enum = 12,
    Keyword = 13,
    Snippet = 14,
    Color = 15,
    File = 16,
    Reference = 17,
    Folder = 18,
    EnumMember = 19,
    Constant = 20,
    Struct = 21,
    Event = 22,
    Operator = 23,
    TypeParameter = 24
}

export enum CompletionTriggerKind {
    Invoke = 0,
    TriggerCharacter = 1,
    TriggerForIncompleteCompletions = 2
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

export enum StatusBarAlignment {
    Left = 1,
    Right = 2
}

export enum TextEditorRevealType {
    Default = 0,
    InCenter = 1,
    InCenterIfOutsideViewport = 2,
    AtTop = 3
}

export const CodeActionKind = {
    QuickFix: 'quickfix'
};

export class MarkdownString {
    public value: string;
    public isTrusted = false;
    public supportHtml = false;

    constructor(value = '') {
        this.value = value;
    }

    appendMarkdown(markdown: string): MarkdownString {
        this.value += markdown;
        return this;
    }

    appendCodeblock(code: string, language = ''): MarkdownString {
        this.value += `\`\`\`${language}\n${code}\n\`\`\`\n`;
        return this;
    }
}

export class Hover {
    constructor(public contents: MarkdownString | MarkdownString[]) {}
}

export class SnippetString {
    constructor(public value: string) {}
}

export class CompletionItem {
    public detail?: string;
    public documentation?: MarkdownString | string;
    public insertText?: string | SnippetString;
    public sortText?: string;
    public data?: any;

    constructor(
        public label: string,
        public kind?: CompletionItemKind
    ) {}
}

export class SemanticTokensLegend {
    constructor(
        public tokenTypes: string[],
        public tokenModifiers: string[]
    ) {}
}

export class SemanticTokensBuilder {
    private data: Array<{ line: number; char: number; length: number; tokenType: number; tokenModifiers: number }> = [];

    constructor(public legend?: SemanticTokensLegend) {}

    push(line: number, char: number, length: number, tokenType: number, tokenModifiers: number): void {
        this.data.push({ line, char, length, tokenType, tokenModifiers });
    }

    build(): { data: Array<{ line: number; char: number; length: number; tokenType: number; tokenModifiers: number }> } {
        return { data: this.data };
    }
}

export class RelativePattern {
    constructor(
        public baseUri: string,
        public pattern: string
    ) {}
}

// 窗口管理
export const window = {
    showInformationMessage: jest.fn().mockResolvedValue(undefined),
    showWarningMessage: jest.fn().mockResolvedValue(undefined),
    showErrorMessage: jest.fn().mockResolvedValue(undefined),
    setStatusBarMessage: jest.fn(),
    showQuickPick: jest.fn().mockResolvedValue(undefined),
    showInputBox: jest.fn().mockResolvedValue(undefined),
    showOpenDialog: jest.fn().mockResolvedValue(undefined),
    showTextDocument: jest.fn().mockResolvedValue(undefined),
    createTextEditorDecorationType: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    createOutputChannel: jest.fn().mockReturnValue({
        appendLine: jest.fn(),
        clear: jest.fn(),
        show: jest.fn(),
        dispose: jest.fn()
    }),
    createTreeView: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    createStatusBarItem: jest.fn().mockReturnValue({
        show: jest.fn(),
        hide: jest.fn(),
        dispose: jest.fn(),
        text: '',
        tooltip: '',
        command: undefined
    }),
    createTerminal: jest.fn().mockReturnValue({
        sendText: jest.fn(),
        show: jest.fn(),
        dispose: jest.fn()
    }),
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
    onDidDeleteFiles: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    findFiles: jest.fn().mockResolvedValue([]),
    fs: {
        readFile: jest.fn().mockResolvedValue(Buffer.from(''))
    },
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
    registerCodeActionsProvider: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    registerCompletionItemProvider: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    registerHoverProvider: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    registerDefinitionProvider: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    registerDocumentSemanticTokensProvider: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    registerDocumentFormattingEditProvider: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    registerDocumentRangeFormattingEditProvider: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    registerDocumentSymbolProvider: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    registerReferenceProvider: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    registerRenameProvider: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    registerFoldingRangeProvider: jest.fn().mockReturnValue({ dispose: jest.fn() }),
};

// 命令
export const commands = {
    registerCommand: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    executeCommand: jest.fn().mockResolvedValue(undefined)
};

export const env = {
    clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined)
    }
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
