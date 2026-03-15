import * as vscode from 'vscode';
import { FormattingService } from '../formatter/FormattingService';
import * as parsedDocumentModule from '../parser/ParsedDocumentService';
import { clearGlobalParsedDocumentService, getGlobalParsedDocumentService } from '../parser/ParsedDocumentService';
import * as rangeResolver from '../formatter/range/findFormatTarget';
import { workspace } from '../../tests/mocks/MockVSCode';
import { TestHelper } from './utils/TestHelper';
import * as fs from 'fs';
import * as path from 'path';

const FIXTURE_ROOT = path.resolve(__dirname, '../../test/lpc_code');

function applyEdit(document: ReturnType<typeof TestHelper.createMockDocument>, edit: vscode.TextEdit): string {
    const source = document.getText();
    const startOffset = document.offsetAt(edit.range.start);
    const endOffset = document.offsetAt(edit.range.end);

    return `${source.slice(0, startOffset)}${edit.newText}${source.slice(endOffset)}`;
}

function readFixture(name: string): string {
    return fs.readFileSync(path.join(FIXTURE_ROOT, name), 'utf8');
}

describe('FormattingService range formatting', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('选区不覆盖完整节点时拒绝格式化', async () => {
        jest.spyOn(parsedDocumentModule, 'getGlobalParsedDocumentService').mockReturnValue({
            get: jest.fn().mockReturnValue({
                diagnostics: []
            })
        } as any);
        jest.spyOn(rangeResolver, 'findFormatTarget').mockReturnValue(null);

        const service = new FormattingService();
        const document = TestHelper.createMockDocument('void test(){}');

        await expect(service.formatRange(document, new vscode.Range(0, 2, 0, 6))).resolves.toEqual([]);
    });

    test('选区覆盖完整节点时返回目标范围的原文替换 edit', async () => {
        jest.spyOn(parsedDocumentModule, 'getGlobalParsedDocumentService').mockReturnValue({
            get: jest.fn().mockReturnValue({
                diagnostics: []
            })
        } as any);

        const targetRange = new vscode.Range(0, 0, 0, 13);
        jest.spyOn(rangeResolver, 'findFormatTarget').mockReturnValue({
            kind: 'node',
            range: targetRange
        });

        const service = new FormattingService();
        const source = 'void test(){}';
        const document = TestHelper.createMockDocument(source);

        await expect(service.formatRange(document, new vscode.Range(0, 0, 0, 13))).resolves.toEqual([
            {
                range: targetRange,
                newText: source
            }
        ]);
    });

    test('局部选中 heredoc 正文时直接拒绝格式化', async () => {
        const service = new FormattingService();
        const document = TestHelper.createMockDocument('string msg = @TEXT\nhello\nTEXT;');

        await expect(service.formatRange(document, new vscode.Range(1, 0, 1, 5))).resolves.toEqual([]);
    });

    test('完整节点选区会返回格式化后的文本而不是原文', async () => {
        const service = new FormattingService();
        const source = 'void test(){if(x){foo();}}';
        const document = TestHelper.createMockDocument(source, 'lpc', 'range-format.c');
        const range = new vscode.Range(0, 0, 0, source.length);
        const edits = await service.formatRange(document, range);

        expect(edits).toHaveLength(1);
        expect(edits[0].newText).toContain('if (x)');
        expect(edits[0].newText).not.toBe(source);
    });

    test('整行选区包含尾随换行时仍能命中函数节点', async () => {
        const service = new FormattingService();
        const source = [
            'void test()',
            '{',
            '    if(x){foo();}',
            '}',
            ''
        ].join('\n');
        const document = TestHelper.createMockDocument(source, 'lpc', 'range-lines.c');
        const range = new vscode.Range(0, 0, 4, 0);
        const edits = await service.formatRange(document, range);

        expect(edits).toHaveLength(1);
        expect(edits[0].newText).toContain('if (x)');
    });

    test('整行选区包含行尾注释时不会退回 snippet 格式化', async () => {
        const service = new FormattingService();
        const source = [
            'void test()',
            '{',
            '    foo(); // keep',
            '    bar();',
            '}'
        ].join('\n');
        const document = TestHelper.createMockDocument(source, 'lpc', 'range-inline-comment.c');
        const range = new vscode.Range(2, 0, 3, 0);
        const edits = await service.formatRange(document, range);

        expect(edits).toHaveLength(1);
        expect(applyEdit(document, edits[0])).toBe(source);
    });

    test('多行 mapping 语句的真实选区仍能格式化', async () => {
        const service = new FormattingService();
        const source = [
            'void create()',
            '{',
            '\tset("exits", ([',
            '\t\t"east"      : __DIR__"kedian",',
            '\t\t     "west"      : __DIR__"majiu",',
            '\t\t"north"     : __DIR__"beidajie2",',
            '\t\t   "south"     : __DIR__"canlangting",',
            '\t\t"southwest" : __DIR__"xiyuan",',
            '\t]));',
            '}'
        ].join('\n');
        const document = TestHelper.createMockDocument(source, 'lpc', 'range-mapping.c');
        const range = new vscode.Range(2, 0, 8, 5);
        clearGlobalParsedDocumentService();
        const parsed = getGlobalParsedDocumentService().get(document);
        const edits = await service.formatRange(document, range);

        expect(parsed.diagnostics).toHaveLength(0);
        expect(edits).toHaveLength(1);
        expect(edits[0].newText).toContain('"west" : __DIR__"majiu"');
        expect(edits[0].newText).toContain('"southwest" : __DIR__"xiyuan"');
    });

    test('多行 mapping 选区格式化与整文一致地保留条目前注释和紧凑数组值', async () => {
        const service = new FormattingService();
        const source = [
            'void create()',
            '{',
            '    mapping data = ([',
            '        // keep these names',
            '        // keep first 25 entries',
            '        "foot" : ({ "a", "b" }),',
            '        "hand" : ({ "c", "d" })',
            '    ]);',
            '}'
        ].join('\n');
        const document = TestHelper.createMockDocument(source, 'lpc', 'range-mapping-comments.c');
        const range = new vscode.Range(2, 4, 7, 7);
        const edits = await service.formatRange(document, range);

        expect(edits).toHaveLength(1);
        expect(edits[0].newText).toContain('// keep these names');
        expect(edits[0].newText).toContain('// keep first 25 entries');
        expect(edits[0].newText).toContain('"foot" : ({ "a", "b" })');
        expect(edits[0].newText).toContain('"hand" : ({ "c", "d" })');
        expect(edits[0].newText).not.toContain('"foot" : ({\n');
    });

    test('真实 meridiand 的足三阳经选区格式化保留说明注释和紧凑数组值', async () => {
        const service = new FormattingService();
        const source = readFixture('meridiand.c');
        const document = TestHelper.createMockDocument(source, 'lpc', 'range-meridiand-foot.c');
        const range = new vscode.Range(18, 0, 20, document.lineAt(20).text.length);
        const edits = await service.formatRange(document, range);

        expect(edits).toHaveLength(1);
        expect(edits[0].newText).toContain('//瞳子髎、听会、上关、颔厌');
        expect(edits[0].newText).toContain('//保留前25个穴位');
        expect(edits[0].newText).toContain('"足三阳经" : ({ "瞳子髎", "听会", "上关", "颔厌"');
        expect(edits[0].newText).not.toContain('"足三阳经" : ({\n');
    });

    test('真实 meridiand 的 mapping 选区格式化不会把文件头注释混进结果', async () => {
        const service = new FormattingService();
        const source = readFixture('meridiand.c');
        const document = TestHelper.createMockDocument(source, 'lpc', 'range-meridiand-mapping.c');
        const range = new vscode.Range(9, 0, 22, document.lineAt(22).text.length);
        const edits = await service.formatRange(document, range);

        expect(edits).toHaveLength(1);
        expect(edits[0].newText).toContain('mapping xuewei = ([');
        expect(edits[0].newText).not.toContain('//meridiand.c');
        expect(edits[0].newText).not.toContain('meridian/belt');
        expect(edits[0].newText).not.toContain('//by luoyun 2016.6.27');
    });

    test('多条语句选区在 fallback 中保持 block 语义并保留 heredoc 正文', async () => {
        const service = new FormattingService();
        const source = [
            'void create()',
            '{',
            '\tset("short", "北大街");',
            '\t set("long", @LONG',
            '你走在一条繁忙的街道上，看着操着南腔北调的人们行色',
            '匆匆，许多人都往南边走去，那里有一个热闹的亭子。西南面',
            '是一家戏园子，不时传来叫好声，来自各地的人们进进出出。',
            '在东面是一个客店。西面是一个马厩。',
            'LONG );',
            '}'
        ].join('\n');
        const document = TestHelper.createMockDocument(source, 'lpc', 'range-heredoc-snippet.c');
        const range = new vscode.Range(2, 0, 8, 7);
        const edits = await service.formatRange(document, range);

        expect(edits).toHaveLength(1);
        expect(edits[0].newText).toContain('set("short", "北大街");\n\tset("long", @LONG');
        expect(edits[0].newText).toContain('你走在一条繁忙的街道上');
        expect(edits[0].newText).toContain('\nLONG );');
        expect(edits[0].newText).not.toContain('set("short", "北大街");\n\n\tset("long"');
        expect(edits[0].newText).not.toContain('@LONG\n\t);');
    });

    test('包含 return heredoc 的完整函数选区保留正文', async () => {
        const service = new FormattingService();
        const source = [
            'string help(object me)',
            '{',
            '    return @TEXT',
            'line one',
            'line two',
            'TEXT;',
            '}'
        ].join('\n');
        const document = TestHelper.createMockDocument(source, 'lpc', 'range-return-heredoc.c');
        const range = new vscode.Range(0, 0, 6, 1);
        const edits = await service.formatRange(document, range);

        expect(edits).toHaveLength(1);
        expect(edits[0].newText).toContain('return @TEXT\nline one\nline two\nTEXT;');
        expect(edits[0].newText).not.toContain('return @TEXT\n;');
    });

    test('包含 heredoc 的完整节点在安全格式化失败时保持原文', async () => {
        const service = new FormattingService();
        const source = [
            'string test()',
            '{',
            '    return "prefix" + @TEXT',
            'TEXT should stay body text',
            'line two',
            'TEXT;',
            '}'
        ].join('\n');
        const document = TestHelper.createMockDocument(source, 'lpc', 'range-heredoc-failsafe.c');
        const range = new vscode.Range(0, 0, 6, 1);
        const edits = await service.formatRange(document, range);

        expect(edits).toHaveLength(1);
        expect(edits[0].newText).toBe(source);
    });

    test('fallback range formatting 会遵守 indentSize 配置', async () => {
        const originalGetConfiguration = workspace.getConfiguration();
        (workspace.getConfiguration as jest.Mock).mockReturnValue({
            ...originalGetConfiguration,
            get: jest.fn((key: string, defaultValue?: unknown) => (
                key === 'lpc.format.indentSize' ? 2 : defaultValue
            ))
        });

        const service = new FormattingService();
        const source = [
            'void create()',
            '{',
            '  if(x){foo();}',
            '  bar();',
            '}'
        ].join('\n');
        const document = TestHelper.createMockDocument(source, 'lpc', 'range-indent-two.c');
        const range = new vscode.Range(2, 0, 3, 8);
        const edits = await service.formatRange(document, range);

        expect(edits).toHaveLength(1);
        expect(edits[0].newText).toContain('  if (x)\n  {');
        expect(edits[0].newText).toContain('\n    foo();');
        expect(edits[0].newText).not.toContain('\n      foo();');

        (workspace.getConfiguration as jest.Mock).mockReturnValue(originalGetConfiguration);
    });

    test('块内 if 语句选区格式化后保持原始缩进层级', async () => {
        const service = new FormattingService();
        const source = [
            'void test()',
            '{',
            '    if(x){foo();}',
            '}'
        ].join('\n');
        const document = TestHelper.createMockDocument(source, 'lpc', 'range-nested-if.c');
        const range = new vscode.Range(2, 4, 2, 17);
        const edits = await service.formatRange(document, range);

        expect(edits).toHaveLength(1);
        expect(applyEdit(document, edits[0])).toBe([
            'void test()',
            '{',
            '    if (x)',
            '    {',
            '        foo();',
            '    }',
            '}'
        ].join('\n'));
    });

    test('仅有 foreach(ref) 误报时选区格式化仍可工作', async () => {
        const service = new FormattingService();
        const source = [
            'void test()',
            '{',
            '    foreach(ref mixed item in arr) {',
            '        foo(item);',
            '    }',
            '    if(x){bar();}',
            '}'
        ].join('\n');
        const document = TestHelper.createMockDocument(source, 'lpc', 'range-foreach-ref.c');
        const range = new vscode.Range(5, 4, 5, 17);
        const edits = await service.formatRange(document, range);

        expect(edits).toHaveLength(1);
        expect(applyEdit(document, edits[0])).toBe([
            'void test()',
            '{',
            '    foreach(ref mixed item in arr) {',
            '        foo(item);',
            '    }',
            '    if (x)',
            '    {',
            '        bar();',
            '    }',
            '}'
        ].join('\n'));
    });
});
