import { FormattingService } from '../formatter/FormattingService';
import { clearGlobalParsedDocumentService, getGlobalParsedDocumentService } from '../parser/ParsedDocumentService';
import { TestHelper } from './utils/TestHelper';
import * as vscode from 'vscode';

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

    test('return heredoc 在整文格式化中保留正文', async () => {
        const source = 'string help(object me){return @TEXT\nline one\nline two\nTEXT;}';
        const output = await format(source);

        expect(output).toContain('return @TEXT\nline one\nline two\nTEXT;');
        expect(output).not.toContain('return @TEXT\n;');
    });

    test('正文里以结束 tag 开头但后跟文本时不会被误判为关闭符', async () => {
        const source = 'string msg = @TEXT\nTEXT should stay body text\nline two\nTEXT;';
        const output = await format(source);

        expect(output).toContain('@TEXT\nTEXT should stay body text\nline two\nTEXT;');
        expect(output).not.toContain('@TEXT\nTEXT;');
    });

    test('关闭标记同行尾注释时仍会保留 heredoc 正文', async () => {
        const source = 'string msg = @TEXT\nhello\nTEXT; // trailing note';
        const output = await format(source);

        expect(output).toContain('@TEXT\nhello\nTEXT; // trailing note');
        expect(output).not.toContain('TEXT; // trailing note;');
    });

    test('关闭标记后跟右括号和行尾注释时仍会保留 heredoc 正文', async () => {
        const source = 'void test(){set("long", @TEXT\nhello\nTEXT ); // trailing note\n}';
        const output = await format(source);

        expect(output).toContain('@TEXT\nhello\nTEXT ); // trailing note');
        expect(output).not.toContain('@TEXT\n); // trailing note');
    });

    test('表达式运算符后面的 heredoc 也会被正确保护', async () => {
        const source = 'string msg = "prefix" + @TEXT\nhello\nTEXT;';
        const output = await format(source);

        expect(output).toContain('"prefix" + @TEXT\nhello\nTEXT;');
        expect(output).not.toContain('"prefix" + @TEXT\n;');
    });

    test('逻辑表达式后面的 heredoc 也会被正确保护', async () => {
        const source = 'mixed msg = flag && @TEXT\nhello\nTEXT;';
        const output = await format(source);

        expect(output).toContain('flag && @TEXT\nhello\nTEXT;');
        expect(output).not.toContain('flag && @TEXT\n;');
    });

    test('Javadoc 标签不会被误识别为 heredoc opener', async () => {
        const source = [
            '/**',
            ' * @param mixed value 参数',
            ' * @return string 返回值',
            ' */',
            'string test(mixed value){return "ok";}'
        ].join('\n');
        const output = await format(source);

        expect(output).toContain('* @param mixed value 参数');
        expect(output).toContain('* @return string 返回值');
        expect(output).not.toContain('__LPC_DELIMITED_TEXT_');
    });

    test('第二个 heredoc 正文选区也会被拒绝格式化', async () => {
        const service = new FormattingService();
        const source = [
            'void test()',
            '{',
            '    string first = @ONE',
            'first body',
            'ONE;',
            '    string second = @TWO',
            'second body',
            'TWO;',
            '}'
        ].join('\n');
        const document = TestHelper.createMockDocument(source, 'lpc', 'multi-heredoc-range.c');
        const edits = await service.formatRange(document, new vscode.Range(6, 0, 6, 11));

        expect(edits).toEqual([]);
    });
});
