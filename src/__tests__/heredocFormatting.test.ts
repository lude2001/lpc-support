import { FormattingService } from '../formatter/FormattingService';
import { clearGlobalParsedDocumentService, getGlobalParsedDocumentService } from '../parser/ParsedDocumentService';
import { TestHelper } from './utils/TestHelper';

async function format(source: string): Promise<string> {
    clearGlobalParsedDocumentService();
    const service = new FormattingService();
    const fileName = `heredoc-${Date.now()}-${Math.random().toString(16).slice(2)}.c`;
    const document = TestHelper.createMockDocument(source, 'lpc', fileName);
    const edits = await service.formatDocument(document);

    return edits[0]?.newText ?? source;
}

describe('heredoc formatting', () => {
    test('heredoc 正文不动且结束行保持列 0', async () => {
        const source = 'string msg = @TEXT\nhello\nTEXT;';
        const output = await format(source);

        expect(output).toContain('\nTEXT;');
        expect(output).not.toContain('\n    TEXT;');
    });

    test('包含 heredoc 的文件仍会格式化周围代码', async () => {
        const source = 'void test(){string msg=@TEXT\nhello\nTEXT;\nif(x){foo();}}';
        const output = await format(source);

        expect(output).toContain('string msg = @TEXT\nhello\nTEXT;');
        expect(output).toContain('if (x)');
        expect(output).toContain('foo();');
    });

    test('heredoc 关闭标记后跟随右括号时仍保留正文', async () => {
        const source = 'void test(){set("long", @TEXT\nhello\nTEXT );}';
        const output = await format(source);

        expect(output).toContain('@TEXT\nhello\nTEXT );');
        expect(output).not.toContain('@TEXT\n);');
        expect(output).toContain('set("long",');
    });

    test('文档已被缓存解析后仍使用 masked heredoc 重新格式化', async () => {
        clearGlobalParsedDocumentService();
        const source = 'void test(){set("long", @TEXT\nhello\nTEXT );}';
        const service = new FormattingService();
        const document = TestHelper.createMockDocument(source, 'lpc', 'warm-cache-heredoc.c');

        getGlobalParsedDocumentService().get(document);

        const edits = await service.formatDocument(document);
        const output = edits[0]?.newText ?? source;

        expect(output).toContain('@TEXT\nhello\nTEXT );');
        expect(output).not.toContain('@TEXT\n);');
    });
});
