import * as fs from 'fs';
import * as path from 'path';
import { getServerWorkspaceRoots } from './serverHostState';

export class Disposable {
    private readonly onDispose?: () => void;

    public constructor(onDispose?: () => void) {
        this.onDispose = onDispose;
    }

    public dispose(): void {
        this.onDispose?.();
    }

    public static create(onDispose: () => void): Disposable {
        return new Disposable(onDispose);
    }
}

export class Uri {
    public constructor(
        public readonly scheme: string,
        public readonly authority: string,
        public readonly path: string,
        public readonly query: string,
        public readonly fragment: string
    ) {}

    public static parse(value: string): Uri {
        if (value.startsWith('file://')) {
            return Uri.file(fromFileUri(value));
        }

        return new Uri('', '', value, '', '');
    }

    public static file(filePath: string): Uri {
        const normalizedPath = normalizePath(filePath);
        return new Uri('file', '', normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`, '', '');
    }

    public toString(): string {
        if (this.scheme === 'file') {
            return `file://${encodeURI(this.path)}`;
        }

        return this.path;
    }

    public get fsPath(): string {
        return fromFileUri(this.toString());
    }
}

export class Position {
    public constructor(public readonly line: number, public readonly character: number) {}

    public compareTo(other: Position): number {
        if (this.line !== other.line) {
            return this.line - other.line;
        }

        return this.character - other.character;
    }

    public isEqual(other: Position): boolean {
        return this.line === other.line && this.character === other.character;
    }

    public isBefore(other: Position): boolean {
        return this.compareTo(other) < 0;
    }

    public isBeforeOrEqual(other: Position): boolean {
        return this.compareTo(other) <= 0;
    }

    public isAfter(other: Position): boolean {
        return this.compareTo(other) > 0;
    }

    public isAfterOrEqual(other: Position): boolean {
        return this.compareTo(other) >= 0;
    }
}

export class Range {
    public readonly start: Position;
    public readonly end: Position;

    public constructor(
        start: Position | number,
        end: Position | number,
        endLine?: number,
        endCharacter?: number
    ) {
        if (start instanceof Position && end instanceof Position) {
            this.start = start;
            this.end = end;
            return;
        }

        this.start = new Position(start as number, end as number);
        this.end = new Position(endLine ?? start as number, endCharacter ?? end as number);
    }

    public contains(positionOrRange: Position | Range): boolean {
        if (positionOrRange instanceof Range) {
            return this.contains(positionOrRange.start) && this.contains(positionOrRange.end);
        }

        return positionOrRange.isAfterOrEqual(this.start) && positionOrRange.isBeforeOrEqual(this.end);
    }
}

export class Selection extends Range {}

export class Location {
    public constructor(public readonly uri: Uri, public readonly range: Range | Position) {}
}

export class RelativePattern {
    public readonly baseUri: Uri;

    public constructor(base: string | { uri: Uri } | Uri, public readonly pattern: string) {
        if (base instanceof Uri) {
            this.baseUri = base;
            return;
        }

        if (typeof base === 'string') {
            this.baseUri = Uri.file(base);
            return;
        }

        this.baseUri = base.uri;
    }
}

export class MarkdownString {
    public value: string;

    public constructor(value = '') {
        this.value = value;
    }

    public appendMarkdown(markdown: string): MarkdownString {
        this.value += markdown;
        return this;
    }

    public appendCodeblock(code: string, language = ''): MarkdownString {
        this.value += `\`\`\`${language}\n${code}\n\`\`\`\n`;
        return this;
    }
}

export class Hover {
    public constructor(public readonly contents: MarkdownString | MarkdownString[]) {}
}

export class SnippetString {
    public constructor(public readonly value: string) {}
}

export class CompletionItem {
    public detail?: string;
    public documentation?: MarkdownString | string;
    public insertText?: string | SnippetString;
    public sortText?: string;
    public data?: unknown;

    public constructor(
        public readonly label: string,
        public readonly kind?: CompletionItemKind
    ) {}
}

export enum DiagnosticSeverity {
    Error = 0,
    Warning = 1,
    Information = 2,
    Hint = 3
}

export class Diagnostic {
    public code?: string | number;
    public source?: string;
    public relatedInformation?: unknown[];
    public tags?: unknown[];

    public constructor(
        public readonly range: Range,
        public readonly message: string,
        public readonly severity: DiagnosticSeverity = DiagnosticSeverity.Error
    ) {}
}

export class TextEdit {
    public constructor(
        public readonly range: Range,
        public readonly newText: string
    ) {}

    public static replace(range: Range, newText: string): TextEdit {
        return new TextEdit(range, newText);
    }
}

export class EventEmitter<T> {
    private listeners: Array<(value: T) => void> = [];

    public readonly event = (listener: (value: T) => void): Disposable => {
        this.listeners.push(listener);
        return Disposable.create(() => {
            this.listeners = this.listeners.filter(candidate => candidate !== listener);
        });
    };

    public fire(value: T): void {
        for (const listener of this.listeners) {
            listener(value);
        }
    }
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

export enum EndOfLine {
    LF = 1,
    CRLF = 2
}

export enum ProgressLocation {
    Window = 10
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

type FileWatcher = Disposable & {
    onDidChange(listener: () => void): Disposable;
    onDidCreate(listener: () => void): Disposable;
    onDidDelete(listener: () => void): Disposable;
};

interface TextLine {
    lineNumber: number;
    text: string;
    range: Range;
    rangeIncludingLineBreak: Range;
    firstNonWhitespaceCharacterIndex: number;
    isEmptyOrWhitespace: boolean;
}

interface TextDocumentLike {
    uri: Uri;
    fileName: string;
    languageId: string;
    version: number;
    lineCount: number;
    isDirty: boolean;
    isClosed: boolean;
    isUntitled: boolean;
    eol: EndOfLine;
    getText(range?: Range): string;
    lineAt(lineOrPosition: number | Position): TextLine;
    positionAt(offset: number): Position;
    offsetAt(position: Position): number;
    getWordRangeAtPosition(position: Position): Range | undefined;
    save(): Promise<boolean>;
    validateRange(range: Range): Range;
    validatePosition(position: Position): Position;
}

const textDocuments = new Map<string, TextDocumentLike>();
const configurationValues = new Map<string, unknown>();
const textDocumentChangedEmitter = new EventEmitter<{ document: TextDocumentLike }>();
const activeEditorChangedEmitter = new EventEmitter<unknown>();

export const window = {
    activeTextEditor: undefined,
    showInformationMessage: async () => undefined,
    showWarningMessage: async () => undefined,
    showErrorMessage: async () => undefined,
    showQuickPick: async () => undefined,
    showInputBox: async () => undefined,
    showOpenDialog: async () => undefined,
    showTextDocument: async () => undefined,
    onDidChangeActiveTextEditor: activeEditorChangedEmitter.event,
    createOutputChannel: () => ({
        appendLine: (_message: string) => undefined,
        clear: () => undefined,
        show: (_preserveFocus?: boolean) => undefined,
        dispose: () => undefined
    }),
    withProgress: async <T>(
        _options: unknown,
        task: (progress: { report(value: { message?: string }): void }) => Promise<T>
    ): Promise<T> => task({
        report: () => undefined
    })
};

export const languages = {
    registerHoverProvider: () => Disposable.create(() => undefined)
};

export const commands = {
    registerCommand: () => Disposable.create(() => undefined)
};

export const workspace = {
    get workspaceFolders(): Array<{ uri: Uri; name: string; index: number }> {
        return getServerWorkspaceRoots().map((workspaceRoot, index) => ({
            uri: Uri.file(workspaceRoot),
            name: path.basename(workspaceRoot) || workspaceRoot,
            index
        }));
    },
    get textDocuments(): TextDocumentLike[] {
        return Array.from(textDocuments.values());
    },
    get rootPath(): string | undefined {
        return getServerWorkspaceRoots()[0];
    },
    get name(): string | undefined {
        return workspace.workspaceFolders[0]?.name;
    },
    fs: {
        readFile: async (target: Uri): Promise<Uint8Array> => {
            const content = await fs.promises.readFile(target.fsPath);
            return new Uint8Array(content);
        }
    },
    getConfiguration: (section?: string) => ({
        get: <T>(key: string, defaultValue?: T): T | undefined => {
            const fullKey = section ? `${section}.${key}` : key;
            return (configurationValues.has(fullKey) ? configurationValues.get(fullKey) : defaultValue) as T | undefined;
        },
        update: async (key: string, value: unknown): Promise<void> => {
            const fullKey = section ? `${section}.${key}` : key;
            configurationValues.set(fullKey, value);
        },
        has: (key: string): boolean => {
            const fullKey = section ? `${section}.${key}` : key;
            return configurationValues.has(fullKey);
        },
        inspect: (key: string) => {
            const fullKey = section ? `${section}.${key}` : key;
            return {
                key: fullKey,
                defaultValue: undefined,
                globalValue: configurationValues.get(fullKey),
                workspaceValue: undefined,
                workspaceFolderValue: undefined
            };
        }
    }),
    getWorkspaceFolder: (target: Uri) => {
        const workspaceRoots = getServerWorkspaceRoots();
        const candidate = normalizePath(target.fsPath);
        const matchedRoot = getLongestPrefixMatch(candidate, workspaceRoots);
        if (!matchedRoot) {
            return undefined;
        }

        return {
            uri: Uri.file(matchedRoot),
            name: path.basename(matchedRoot) || matchedRoot,
            index: workspaceRoots.findIndex(workspaceRoot => normalizePath(workspaceRoot) === normalizePath(matchedRoot))
        };
    },
    onDidChangeTextDocument: textDocumentChangedEmitter.event,
    onDidOpenTextDocument: () => Disposable.create(() => undefined),
    onDidCloseTextDocument: () => Disposable.create(() => undefined),
    onDidDeleteFiles: () => Disposable.create(() => undefined),
    onDidChangeConfiguration: () => Disposable.create(() => undefined),
    createFileSystemWatcher: (): FileWatcher => ({
        onDidChange: () => Disposable.create(() => undefined),
        onDidCreate: () => Disposable.create(() => undefined),
        onDidDelete: () => Disposable.create(() => undefined),
        dispose: () => undefined
    }),
    findFiles: async (
        pattern: RelativePattern | string,
        _exclude?: string,
        maxResults?: number
    ): Promise<Uri[]> => {
        const relativePattern = typeof pattern === 'string'
            ? new RelativePattern(getServerWorkspaceRoots()[0] ?? process.cwd(), pattern)
            : pattern;
        const basePath = relativePattern.baseUri.fsPath;
        if (!basePath || !fs.existsSync(basePath)) {
            return [];
        }

        const expression = globToRegExp(relativePattern.pattern);
        const matches: Uri[] = [];
        const queue = [basePath];

        while (queue.length > 0) {
            const currentPath = queue.shift()!;
            const stats = await fs.promises.stat(currentPath);
            if (stats.isDirectory()) {
                const entries = await fs.promises.readdir(currentPath);
                for (const entry of entries) {
                    queue.push(path.join(currentPath, entry));
                }
                continue;
            }

            const relativePath = normalizePath(path.relative(basePath, currentPath));
            if (expression.test(relativePath)) {
                matches.push(Uri.file(currentPath));
                if (typeof maxResults === 'number' && matches.length >= maxResults) {
                    break;
                }
            }
        }

        return matches;
    },
    openTextDocument: async (target: string | Uri): Promise<TextDocumentLike> => {
        const uri = typeof target === 'string'
            ? (isFileUri(target) ? Uri.parse(target) : Uri.file(target))
            : target;
        const cacheKey = uri.toString();
        const existing = textDocuments.get(cacheKey);
        if (existing) {
            return existing;
        }

        const content = await fs.promises.readFile(uri.fsPath, 'utf8');
        const document = createTextDocument(uri, content, 1);
        textDocuments.set(cacheKey, document);
        return document;
    }
};

export function __setConfigurationValue(key: string, value: unknown): void {
    configurationValues.set(key, value);
}

export function __syncTextDocument(uri: string, text: string, version: number): void {
    const parsedUri = Uri.parse(uri);
    textDocuments.set(parsedUri.toString(), createTextDocument(parsedUri, text, version));
}

export function __emitTextDocumentChange(uri: string): void {
    const document = textDocuments.get(Uri.parse(uri).toString());
    if (!document) {
        return;
    }

    textDocumentChangedEmitter.fire({ document });
}

export function __closeTextDocument(uri: string): void {
    textDocuments.delete(Uri.parse(uri).toString());
}

function createTextDocument(uri: Uri, content: string, version: number): TextDocumentLike {
    const lineStarts = buildLineStarts(content);
    const lines = content.split(/\r?\n/);

    const offsetAt = (position: Position): number => {
        const lineStart = lineStarts[position.line] ?? content.length;
        return Math.min(lineStart + position.character, content.length);
    };

    const positionAt = (offset: number): Position => {
        const safeOffset = Math.max(0, Math.min(offset, content.length));
        let line = 0;

        for (let index = 0; index < lineStarts.length; index += 1) {
            if (lineStarts[index] <= safeOffset) {
                line = index;
            } else {
                break;
            }
        }

        return new Position(line, safeOffset - lineStarts[line]);
    };

    return {
        uri,
        fileName: uri.fsPath,
        languageId: 'lpc',
        version,
        lineCount: lines.length,
        isDirty: false,
        isClosed: false,
        isUntitled: false,
        eol: EndOfLine.LF,
        getText: (range?: Range) => {
            if (!range) {
                return content;
            }

            return content.slice(offsetAt(range.start), offsetAt(range.end));
        },
        lineAt: (lineOrPosition: number | Position): TextLine => {
            const line = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
            const text = lines[line] ?? '';
            const range = new Range(new Position(line, 0), new Position(line, text.length));
            return {
                lineNumber: line,
                text,
                range,
                rangeIncludingLineBreak: range,
                firstNonWhitespaceCharacterIndex: text.search(/\S|$/),
                isEmptyOrWhitespace: text.trim().length === 0
            };
        },
        positionAt,
        offsetAt,
        getWordRangeAtPosition: (position: Position): Range | undefined => {
            const lineText = lines[position.line] ?? '';
            if (lineText.length === 0) {
                return undefined;
            }

            let anchor = Math.max(0, Math.min(position.character, lineText.length - 1));
            if (!isWordCharacter(lineText[anchor]) && position.character > 0 && isWordCharacter(lineText[position.character - 1])) {
                anchor = position.character - 1;
            }

            if (!isWordCharacter(lineText[anchor])) {
                return undefined;
            }

            let start = anchor;
            while (start > 0 && isWordCharacter(lineText[start - 1])) {
                start -= 1;
            }

            let end = anchor + 1;
            while (end < lineText.length && isWordCharacter(lineText[end])) {
                end += 1;
            }

            return new Range(new Position(position.line, start), new Position(position.line, end));
        },
        save: async () => true,
        validateRange: (range: Range) => range,
        validatePosition: (position: Position) => position
    };
}

function buildLineStarts(text: string): number[] {
    const lineStarts = [0];
    for (let index = 0; index < text.length; index += 1) {
        if (text[index] === '\n') {
            lineStarts.push(index + 1);
        }
    }
    return lineStarts;
}

function globToRegExp(glob: string): RegExp {
    const normalized = normalizePath(glob)
        .replace(/\./g, '\\.')
        .replace(/\*\*/g, '::DOUBLE_STAR::')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '.')
        .replace(/\{([^}]+)\}/g, (_, group: string) => `(${group.split(',').map((part) => part.trim()).join('|')})`)
        .replace(/::DOUBLE_STAR::/g, '.*');
    return new RegExp(`^${normalized}$`);
}

function getLongestPrefixMatch(candidatePath: string, roots: readonly string[]): string | undefined {
    return roots.reduce<string | undefined>((bestMatch, root) => {
        const normalizedRoot = normalizePath(root);
        if (candidatePath !== normalizedRoot && !candidatePath.startsWith(`${normalizedRoot}/`)) {
            return bestMatch;
        }

        if (!bestMatch) {
            return root;
        }

        return normalizedRoot.length > normalizePath(bestMatch).length ? root : bestMatch;
    }, undefined);
}

function normalizePath(targetPath: string): string {
    return targetPath.replace(/\\/g, '/').replace(/\/+$/, '');
}

function fromFileUri(uri: string): string {
    if (!isFileUri(uri)) {
        return uri;
    }

    const decoded = decodeURIComponent(uri.replace(/^file:\/\/+/, '/'));
    return decoded.replace(/^\/([A-Za-z]:\/)/, '$1');
}

function isFileUri(value: string): boolean {
    return value.startsWith('file://');
}

function isWordCharacter(char: string | undefined): boolean {
    return Boolean(char && /[A-Za-z0-9_]/.test(char));
}
