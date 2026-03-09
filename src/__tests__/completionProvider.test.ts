import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ASTManager } from '../ast/astManager';
import { LPCCompletionItemProvider } from '../completionProvider';

function createDocument(fileName: string, content: string, version = 1): vscode.TextDocument {
    const lines = content.split(/\r?\n/);
    const lineStarts = [0];

    for (let index = 0; index < content.length; index += 1) {
        if (content[index] === '\n') {
            lineStarts.push(index + 1);
        }
    }

    const offsetAt = (position: vscode.Position): number => {
        const lineStart = lineStarts[position.line] ?? content.length;
        return Math.min(lineStart + position.character, content.length);
    };

    return {
        uri: vscode.Uri.file(fileName),
        fileName,
        languageId: 'lpc',
        version,
        lineCount: lines.length,
        getText: jest.fn((range?: vscode.Range) => {
            if (!range) {
                return content;
            }

            return content.slice(offsetAt(range.start), offsetAt(range.end));
        }),
        lineAt: jest.fn((lineOrPosition: number | vscode.Position) => {
            const line = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
            return { text: lines[line] ?? '' };
        }),
        positionAt: jest.fn((offset: number) => {
            let line = 0;
            for (let index = 0; index < lineStarts.length; index += 1) {
                if (lineStarts[index] <= offset) {
                    line = index;
                } else {
                    break;
                }
            }

            return new vscode.Position(line, offset - lineStarts[line]);
        }),
        offsetAt: jest.fn((position: vscode.Position) => offsetAt(position))
    } as unknown as vscode.TextDocument;
}

describe('LPCCompletionItemProvider', () => {
    const efunDocsManager = {
        getAllFunctions: jest.fn(() => ['write']),
        getStandardDoc: jest.fn((name: string) => name === 'write' ? {
            name: 'write',
            syntax: 'void write(string msg)',
            description: 'Writes a message.',
            returnType: 'void'
        } : undefined),
        getAllSimulatedFunctions: jest.fn(() => []),
        getSimulatedDoc: jest.fn(() => undefined)
    };
    const macroManager = {
        getMacro: jest.fn(),
        getAllMacros: jest.fn(() => []),
        getMacroHoverContent: jest.fn(),
        scanMacros: jest.fn(),
        getIncludePath: jest.fn(() => undefined)
    };

    let provider: LPCCompletionItemProvider;
    let fixtureRoot: string;

    beforeEach(() => {
        jest.clearAllMocks();
        fixtureRoot = path.join(process.cwd(), '.tmp-completion-provider');
        fs.rmSync(fixtureRoot, { recursive: true, force: true });
        fs.mkdirSync(path.join(fixtureRoot, 'lib'), { recursive: true });

        (vscode.workspace.getWorkspaceFolder as jest.Mock).mockReturnValue({
            uri: { fsPath: fixtureRoot }
        });
        (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: fixtureRoot } }];

        provider = new LPCCompletionItemProvider(efunDocsManager as any, macroManager as any);
    });

    afterEach(() => {
        ASTManager.getInstance().clearAllCache();
        jest.restoreAllMocks();
        fs.rmSync(fixtureRoot, { recursive: true, force: true });
    });

    test('indexes inherited files on demand without request-time editor I/O', async () => {
        const baseContent = 'int inherited_call() { return 1; }';
        const childContent = 'inherit "/lib/base";\ninhe';
        fs.writeFileSync(path.join(fixtureRoot, 'lib', 'base.c'), baseContent, 'utf8');
        const childDocument = createDocument(path.join(fixtureRoot, 'main.c'), childContent);

        const result = await provider.provideCompletionItems(
            childDocument,
            new vscode.Position(1, 'inhe'.length),
            { isCancellationRequested: false } as vscode.CancellationToken,
            {} as vscode.CompletionContext
        ) as vscode.CompletionItem[];

        const inheritedItem = result.find(item => item.label === 'inherited_call');

        expect(inheritedItem).toBeDefined();
        expect(inheritedItem?.documentation).toBeUndefined();
        expect((inheritedItem as any).data?.candidate.metadata.sourceType).toBe('inherited');
        expect(vscode.workspace.openTextDocument).not.toHaveBeenCalled();
    });

    test('returns member completions via query engine for arrow contexts', async () => {
        const content = [
            'class Payload {',
            '    int hp;',
            '}',
            '',
            'void demo() {',
            '    class Payload payload;',
            '    payload->h',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'main.c'), content);

        const result = await provider.provideCompletionItems(
            document,
            new vscode.Position(6, '    payload->h'.length),
            { isCancellationRequested: false } as vscode.CancellationToken,
            {} as vscode.CompletionContext
        ) as vscode.CompletionItem[];

        expect(result.map(item => item.label)).toContain('hp');
    });

    test('preserves generic object methods for object-style arrow receivers', async () => {
        const content = [
            'object foo() {',
            '    return this_object();',
            '}',
            '',
            'void demo() {',
            '    object ob;',
            '    mixed *arr;',
            '    ob->',
            '    this_object()->',
            '    foo()->',
            '    arr[0]->',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'main.c'), content);

        const expectObjectMethods = async (line: number, prefix: string) => {
            const result = await provider.provideCompletionItems(
                document,
                new vscode.Position(line, prefix.length),
                { isCancellationRequested: false } as vscode.CancellationToken,
                {} as vscode.CompletionContext
            ) as vscode.CompletionItem[];

            expect(result.map(item => item.label)).toEqual(expect.arrayContaining(['query', 'set', 'add', 'delete']));
        };

        await expectObjectMethods(7, '    ob->');
        await expectObjectMethods(8, '    this_object()->');
        await expectObjectMethods(9, '    foo()->');
        await expectObjectMethods(10, '    arr[0]->');
    });

    test('resolves efun documentation lazily', async () => {
        const document = createDocument(path.join(fixtureRoot, 'main.c'), 'wri');

        const result = await provider.provideCompletionItems(
            document,
            new vscode.Position(0, 'wri'.length),
            { isCancellationRequested: false } as vscode.CancellationToken,
            {} as vscode.CompletionContext
        ) as vscode.CompletionItem[];

        const writeItem = result.find(item => item.label === 'write');
        expect(writeItem).toBeDefined();
        expect(writeItem?.documentation).toBeUndefined();

        const resolved = await provider.resolveCompletionItem!(
            writeItem!,
            { isCancellationRequested: false } as vscode.CancellationToken
        );

        expect((resolved.documentation as vscode.MarkdownString).value).toContain('Writes a message.');
        expect((resolved.insertText as vscode.SnippetString).value).toBe('write($1)');
    });

    test('resolves local function documentation lazily', async () => {
        const content = [
            'int local_call(string message) {',
            '    return 1;',
            '}',
            '',
            'loca'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'main.c'), content);

        const result = await provider.provideCompletionItems(
            document,
            new vscode.Position(4, 'loca'.length),
            { isCancellationRequested: false } as vscode.CancellationToken,
            {} as vscode.CompletionContext
        ) as vscode.CompletionItem[];

        const localItem = result.find(item => item.label === 'local_call');
        expect(localItem).toBeDefined();
        expect(localItem?.documentation).toBeUndefined();

        const resolved = await provider.resolveCompletionItem!(
            localItem!,
            { isCancellationRequested: false } as vscode.CancellationToken
        );

        expect((resolved.documentation as vscode.MarkdownString).value).toContain('local_call');
        expect((resolved.insertText as vscode.SnippetString).value).toBe('local_call(${1:message})');
    });

    test('renders variable documentation for the selected declarator only', async () => {
        const content = [
            'void demo() {',
            '    string name, exp, file, *msg;',
            '    ex',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'main.c'), content);

        const result = await provider.provideCompletionItems(
            document,
            new vscode.Position(2, '    ex'.length),
            { isCancellationRequested: false } as vscode.CancellationToken,
            {} as vscode.CompletionContext
        ) as vscode.CompletionItem[];

        const expItem = result.find(item => item.label === 'exp');
        expect(expItem).toBeDefined();
        expect(expItem?.detail).toBe('string exp');

        const resolved = await provider.resolveCompletionItem!(
            expItem!,
            { isCancellationRequested: false } as vscode.CancellationToken
        );

        const documentation = (resolved.documentation as vscode.MarkdownString).value;
        expect(documentation).toContain('string exp;');
        expect(documentation).not.toContain('string name, exp, file, *msg;');
        expect(documentation).not.toContain('stringname,exp,file,*msg');
    });

    test('records staged metrics for completion queries', async () => {
        const content = [
            'int local_call() {',
            '    return 1;',
            '}',
            '',
            'loca'
        ].join('\n');

        const document = createDocument(path.join(fixtureRoot, 'main.c'), content);

        const result = await provider.provideCompletionItems(
            document,
            new vscode.Position(4, 'loca'.length),
            { isCancellationRequested: false } as vscode.CancellationToken,
            { triggerKind: vscode.CompletionTriggerKind.Invoke } as vscode.CompletionContext
        ) as vscode.CompletionItem[];

        const metrics = provider.getInstrumentation().getRecentMetrics();
        expect(result.map(item => item.label)).toContain('local_call');
        expect(metrics).toHaveLength(1);
        expect(metrics[0].documentUri).toBe(document.uri.toString());
        expect(metrics[0].totalCandidates).toBe(result.length);
        expect(metrics[0].stages.map(stage => stage.stage)).toEqual(expect.arrayContaining([
            'context-analysis',
            'snapshot-load',
            'project-index-query',
            'candidate-build',
            'request-total'
        ]));
        expect(metrics[0].stages.find(stage => stage.stage === 'candidate-build')?.candidateCount).toBe(result.length);
    });

    test('records resolve metrics separately for lazy documentation', async () => {
        const content = 'wri';
        const document = createDocument(path.join(fixtureRoot, 'main.c'), content);

        const result = await provider.provideCompletionItems(
            document,
            new vscode.Position(0, content.length),
            { isCancellationRequested: false } as vscode.CancellationToken,
            { triggerKind: vscode.CompletionTriggerKind.Invoke } as vscode.CompletionContext
        ) as vscode.CompletionItem[];
        const writeItem = result.find(item => item.label === 'write');

        await provider.resolveCompletionItem!(
            writeItem!,
            { isCancellationRequested: false } as vscode.CancellationToken
        );

        const metrics = provider.getInstrumentation().getRecentMetrics();
        expect(metrics[0].totalCandidates).toBe(1);
        expect(metrics[0].stages.map(stage => stage.stage)).toEqual(expect.arrayContaining([
            'item-resolve',
            'request-total'
        ]));
        expect(metrics[0].stages.find(stage => stage.stage === 'item-resolve')?.candidateCount).toBe(1);
    });

    test('routes preprocessor and type-position contexts through the provider', async () => {
        (macroManager.getAllMacros as jest.Mock).mockReturnValue([{ name: 'BASE_HEADER', value: '"/sys/header"' }]);

        const preprocessorDocument = createDocument(path.join(fixtureRoot, 'header.c'), '#');
        const preprocessorResult = await provider.provideCompletionItems(
            preprocessorDocument,
            new vscode.Position(0, 1),
            { isCancellationRequested: false } as vscode.CancellationToken,
            {} as vscode.CompletionContext
        ) as vscode.CompletionItem[];

        expect(preprocessorResult.map(item => item.label)).toEqual(expect.arrayContaining(['include', 'BASE_HEADER']));

        const typeDocument = createDocument(
            path.join(fixtureRoot, 'types.c'),
            ['class Payload {', '    int hp;', '}', '', 'class '].join('\n')
        );
        const typeResult = await provider.provideCompletionItems(
            typeDocument,
            new vscode.Position(4, 'class '.length),
            { isCancellationRequested: false } as vscode.CancellationToken,
            {} as vscode.CompletionContext
        ) as vscode.CompletionItem[];

        expect(typeResult.map(item => item.label)).toEqual(expect.arrayContaining(['class Payload', 'int']));
    });
});
