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

    test('mapping 与嵌套数组按原始设计强制块状展开', async () => {
        const source = 'mapping data = ([ "name":"sword", "actions":({ "slash", "parry" }) ]);';
        const output = await format(source);

        expect(output).toContain('mapping data = ([');
        expect(output).toContain('    "name" : "sword"');
        expect(output).toContain('    "actions" : ({\n');
        expect(output).toContain('        "slash",\n');
        expect(output).toContain('        "parry"\n');
        expect(output).not.toContain('    "actions" : ({ "slash", "parry" })');
    });

    test('数组内部带注释时保持块状布局并保留注释', async () => {
        const source = 'mixed data = ({ "slash", /* keep */ "parry" });';
        const output = await format(source);

        expect(output).toContain('mixed data = ({');
        expect(output).toContain('/* keep */');
        expect(output).toContain('"slash"');
        expect(output).toContain('"parry"');
        expect(output).not.toContain('mixed data = ({ "slash", "parry" });');
    });

    test('mapping 条目前的行注释会保留在对应条目前', async () => {
        const source = [
            'mapping data = ([',
            '    // keep these names',
            '    // keep first 25 entries',
            '    "foot" : ({ "a", "b" })',
            ']);'
        ].join('\n');
        const output = await format(source);

        expect(output).toContain('// keep these names');
        expect(output).toContain('// keep first 25 entries');
        expect(output).toContain('"foot" : ({\n');
        expect(output).toContain('        "a",\n');
        expect(output).toContain('        "b"\n');
        expect(output).toContain('// keep first 25 entries\n    "foot" : ({\n');
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

    test('强制类型转换前缀不影响成员访问箭头间距', async () => {
        const source = 'void test(){if((int)me -> query_skill("force",1)<20){return;}}';
        const output = await format(source);

        expect(output).toContain('if ((int)me->query_skill("force", 1) < 20)');
        expect(output).not.toContain('me -> query_skill');
    });
});
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
