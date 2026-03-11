import { FormattingService } from '../formatter/FormattingService';
import { clearGlobalParsedDocumentService } from '../parser/ParsedDocumentService';
import { TestHelper } from './utils/TestHelper';

async function format(source: string): Promise<string> {
    clearGlobalParsedDocumentService();
    const service = new FormattingService();
    const fileName = `format-${Date.now()}-${Math.random().toString(16).slice(2)}.c`;
    const document = TestHelper.createMockDocument(source, 'lpc', fileName);
    const edits = await service.formatDocument(document);

    return edits[0]?.newText ?? source;
}

describe('formatter printer', () => {
    test('普通函数与控制流按 Allman 输出', async () => {
        const source = 'void test(){if(x){foo();}else{bar();}}';

        await expect(format(source)).resolves.toBe([
            'void test()',
            '{',
            '    if (x)',
            '    {',
            '        foo();',
            '    }',
            '    else',
            '    {',
            '        bar();',
            '    }',
            '}'
        ].join('\n'));
    });

    test('匿名函数按小型 Allman 函数输出', async () => {
        const source = 'function f = function(int x){return x+1;};';

        await expect(format(source)).resolves.toContain('function(int x)\n{');
    });

    test('mapping 与二维数组强制块状展开且不加尾随逗号', async () => {
        const source = 'mapping data = ([ "name":"sword", "actions":({ "slash", "parry" }) ]);';
        const output = await format(source);

        expect(output).toContain('mapping data = ([');
        expect(output).toContain('    "name" : "sword"');
        expect(output).toContain('    "actions" : ({');
        expect(output).not.toContain(',\n]);');
    });

    test('多字符运算符保持为合法 token', async () => {
        const source = 'void test(){if(a>=b && c==d){value+=1;}}';
        const output = await format(source);

        expect(output).toContain('if (a >= b && c == d)');
        expect(output).toContain('value += 1;');
        expect(output).not.toContain('> =');
        expect(output).not.toContain('& &');
        expect(output).not.toContain('= =');
        expect(output).not.toContain('+ =');
    });
});
