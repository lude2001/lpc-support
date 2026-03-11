import * as vscode from 'vscode';
import { FormattingService } from '../formatter/FormattingService';
import * as parsedDocumentModule from '../parser/ParsedDocumentService';
import { clearGlobalParsedDocumentService, getGlobalParsedDocumentService } from '../parser/ParsedDocumentService';
import * as rangeResolver from '../formatter/range/findFormatTarget';
import { TestHelper } from './utils/TestHelper';

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
});
