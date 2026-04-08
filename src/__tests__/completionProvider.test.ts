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
        const childContent = 'inherit "/lib/base";\ninherited_call();';
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

    test('does not mix prefix-matching efun candidates into arrow member completions', async () => {
        const getAllFunctions = efunDocsManager.getAllFunctions as jest.Mock;
        getAllFunctions.mockReturnValue(['heal']);

        try {
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
            const document = createDocument(path.join(fixtureRoot, 'member-no-efun.c'), content);

            const result = await provider.provideCompletionItems(
                document,
                new vscode.Position(6, '    payload->h'.length),
                { isCancellationRequested: false } as vscode.CancellationToken,
                {} as vscode.CompletionContext
            ) as vscode.CompletionItem[];

            expect(result.map(item => item.label)).toContain('hp');
            expect(result.map(item => item.label)).not.toContain('heal');
        } finally {
            getAllFunctions.mockReturnValue(['write']);
        }
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
            '    ob->query();',
            '    this_object()->query();',
            '    foo()->query();',
            '    arr[0]->query();',
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

    test('returns the real current-file method for this_object()->query_', async () => {
        const content = [
            'string query_self() {',
            '    return "me";',
            '}',
            '',
            'void demo() {',
            '    this_object()->query_',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'self.c'), content);

        const result = await provider.provideCompletionItems(
            document,
            new vscode.Position(5, '    this_object()->query_'.length),
            { isCancellationRequested: false } as vscode.CancellationToken,
            {} as vscode.CompletionContext
        ) as vscode.CompletionItem[];

        expect(result.map(item => item.label)).toContain('query_self');
        expect(result.map(item => item.label)).not.toContain('query');
    });

    test('returns real methods from the resolved COMBAT_D target file', async () => {
        const combatDaemon = path.join(fixtureRoot, 'system', 'daemons', 'combat_d.c');
        fs.mkdirSync(path.dirname(combatDaemon), { recursive: true });
        fs.writeFileSync(combatDaemon, [
            'string query_enemy() {',
            '    return "orc";',
            '}',
            '',
            'int start_combat() {',
            '    return 1;',
            '}'
        ].join('\n'), 'utf8');
        (macroManager.getMacro as jest.Mock).mockImplementation((name: string) => (
            name === 'COMBAT_D' ? { name: 'COMBAT_D', value: '"/system/daemons/combat_d"' } : undefined
        ));

        const content = [
            'void demo() {',
            '    COMBAT_D->query_',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'combat.c'), content);

        const result = await provider.provideCompletionItems(
            document,
            new vscode.Position(1, '    COMBAT_D->query_'.length),
            { isCancellationRequested: false } as vscode.CancellationToken,
            {} as vscode.CompletionContext
        ) as vscode.CompletionItem[];

        expect(result.map(item => item.label)).toContain('query_enemy');
        expect(result.map(item => item.label)).not.toContain('query');
    });

    test('merged object candidates place shared methods ahead of candidate-specific methods', async () => {
        const objectRoot = path.join(fixtureRoot, 'adm', 'objects');
        fs.mkdirSync(objectRoot, { recursive: true });
        fs.writeFileSync(path.join(objectRoot, 'common.c'), [
            'string query_shared() {',
            '    return "shared";',
            '}'
        ].join('\n'), 'utf8');
        fs.writeFileSync(path.join(objectRoot, 'sword.c'), [
            'inherit "/adm/objects/common";',
            '',
            'string query_sword() {',
            '    return "sword";',
            '}'
        ].join('\n'), 'utf8');
        fs.writeFileSync(path.join(objectRoot, 'shield.c'), [
            'inherit "/adm/objects/common";',
            '',
            'string query_shield() {',
            '    return "shield";',
            '}'
        ].join('\n'), 'utf8');

        const content = [
            'void demo(int flag) {',
            '    object ob;',
            '    if (flag) {',
            '        ob = load_object("/adm/objects/sword");',
            '    } else {',
            '        ob = load_object("/adm/objects/shield");',
            '    }',
            '    ob->query_',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'branch.c'), content);

        const result = await provider.provideCompletionItems(
            document,
            new vscode.Position(7, '    ob->query_'.length),
            { isCancellationRequested: false } as vscode.CancellationToken,
            {} as vscode.CompletionContext
        ) as vscode.CompletionItem[];

        const labels = result.map(item => item.label);
        expect(labels).toEqual(expect.arrayContaining(['query_shared', 'query_sword', 'query_shield']));
        expect(labels.indexOf('query_shared')).toBeGreaterThanOrEqual(0);
        expect(labels.indexOf('query_shared')).toBeLessThan(labels.indexOf('query_sword'));
        expect(labels.indexOf('query_shared')).toBeLessThan(labels.indexOf('query_shield'));
    });

    test('does not duplicate inherited methods overridden in the resolved object chain', async () => {
        const objectRoot = path.join(fixtureRoot, 'adm', 'objects');
        fs.mkdirSync(objectRoot, { recursive: true });
        fs.writeFileSync(path.join(objectRoot, 'base.c'), [
            'string query_name() {',
            '    return "base";',
            '}'
        ].join('\n'), 'utf8');
        fs.writeFileSync(path.join(objectRoot, 'child.c'), [
            'inherit "/adm/objects/base";',
            '',
            'string query_name() {',
            '    return "child";',
            '}',
            '',
            'string query_child_only() {',
            '    return "only";',
            '}'
        ].join('\n'), 'utf8');

        const content = [
            'void demo() {',
            '    object ob;',
            '    ob = load_object("/adm/objects/child");',
            '    ob->query_',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'override.c'), content);

        const result = await provider.provideCompletionItems(
            document,
            new vscode.Position(3, '    ob->query_'.length),
            { isCancellationRequested: false } as vscode.CancellationToken,
            {} as vscode.CompletionContext
        ) as vscode.CompletionItem[];

        const labels = result.map(item => item.label);
        expect(labels.filter(label => label === 'query_name')).toHaveLength(1);
        expect(labels).toContain('query_child_only');
    });

    test('treats same-named methods from merged object candidates as one shared completion', async () => {
        const objectRoot = path.join(fixtureRoot, 'adm', 'objects');
        fs.mkdirSync(objectRoot, { recursive: true });
        fs.writeFileSync(path.join(objectRoot, 'sword.c'), [
            'string query_name() {',
            '    return "sword";',
            '}',
            '',
            'string query_sword() {',
            '    return "sword";',
            '}'
        ].join('\n'), 'utf8');
        fs.writeFileSync(path.join(objectRoot, 'shield.c'), [
            'string query_name() {',
            '    return "shield";',
            '}',
            '',
            'string query_shield() {',
            '    return "shield";',
            '}'
        ].join('\n'), 'utf8');

        const content = [
            'void demo(int flag) {',
            '    object ob;',
            '    if (flag) {',
            '        ob = load_object("/adm/objects/sword");',
            '    } else {',
            '        ob = load_object("/adm/objects/shield");',
            '    }',
            '    ob->query_',
            '}'
        ].join('\n');
        const document = createDocument(path.join(fixtureRoot, 'merged-shared.c'), content);

        const result = await provider.provideCompletionItems(
            document,
            new vscode.Position(7, '    ob->query_'.length),
            { isCancellationRequested: false } as vscode.CancellationToken,
            {} as vscode.CompletionContext
        ) as vscode.CompletionItem[];

        const labels = result.map(item => item.label);
        expect(labels.filter(label => label === 'query_name')).toHaveLength(1);
        expect(labels).toEqual(expect.arrayContaining(['query_name', 'query_sword', 'query_shield']));
        expect(labels.indexOf('query_name')).toBeLessThan(labels.indexOf('query_sword'));
        expect(labels.indexOf('query_name')).toBeLessThan(labels.indexOf('query_shield'));
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
            'local_call();'
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
            '    exp;',
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
            'local_call();'
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
            ['class Payload {', '    int hp;', '}', '', 'void demo() {', '    class Payload value;', '}'].join('\n')
        );
        const typeResult = await provider.provideCompletionItems(
            typeDocument,
            new vscode.Position(5, '    class '.length),
            { isCancellationRequested: false } as vscode.CancellationToken,
            {} as vscode.CompletionContext
        ) as vscode.CompletionItem[];

        expect(typeResult.map(item => item.label)).toEqual(expect.arrayContaining(['class Payload', 'int']));
    });
});
