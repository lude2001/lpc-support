import * as vscode from 'vscode';
import { FormattingService } from '../formatter/FormattingService';
import { clearGlobalParsedDocumentService } from '../parser/ParsedDocumentService';
import { TestHelper } from './utils/TestHelper';

async function format(source: string): Promise<string> {
    clearGlobalParsedDocumentService();
    const service = new FormattingService();
    const fileName = `integration-${Date.now()}-${Math.random().toString(16).slice(2)}.c`;
    const document = TestHelper.createMockDocument(source, 'lpc', fileName);
    const edits = await service.formatDocument(document);

    return edits[0]?.newText ?? source;
}

describe('formatter integration', () => {
    test('函数原型保留结尾分号', async () => {
        await expect(format('string look_gaoshi();')).resolves.toBe('string look_gaoshi();');
    });

    test('函数原型与后续定义之间不强插空行', async () => {
        await expect(format('string look_gaoshi();\nvoid create(){}')).resolves.toBe([
            'string look_gaoshi();',
            'void create()',
            '{',
            '}'
        ].join('\n'));
    });

    test('new(..., field : value) 按结构化数据块布局', async () => {
        const source = 'object x = new(Item, name:"sword", id:"changjian");';

        await expect(format(source)).resolves.toContain('new(\n');
    });

    test('struct 与 class 定义按成员逐行布局', async () => {
        const source = 'struct Weapon { string name; int damage; }';

        await expect(format(source)).resolves.toContain('struct Weapon\n{\n    string name;');
    });

    test('switch 范围运算保持紧凑', async () => {
        await expect(format('switch(x){case 1..5: foo();}')).resolves.toContain('case 1..5:');
    });

    test('foreach ref 保持类型顺序和关键字位置', async () => {
        await expect(format('void test(){foreach(ref mixed item in arr){foo(item);}}')).resolves.toContain('foreach (ref mixed item in arr)');
    });

    test('formatter 端到端行为符合首版约束', async () => {
        clearGlobalParsedDocumentService();
        const service = new FormattingService();
        const validDocument = TestHelper.createMockDocument('void test(){return;}', 'lpc', 'valid-format.c');
        const invalidDocument = TestHelper.createMockDocument('void broken(){\nint x = ;\n}', 'lpc', 'invalid-format.c');

        await expect(service.formatDocument(validDocument)).resolves.toHaveLength(1);
        await expect(service.formatRange(validDocument, new vscode.Range(0, 0, 0, validDocument.getText().length))).resolves.toHaveLength(1);
        await expect(service.formatDocument(invalidDocument)).resolves.toEqual([]);
    });

    test('真实房间文件片段不会压扁 heredoc、closure 和路径字符串', async () => {
        const source = [
            'inherit ROOM;',
            '',
            'string look_gaoshi();',
            'void create(){',
            'set("long", @LONG',
            '这是苏州府的北城门。',
            'LONG );',
            'set("item_desc", ([',
            '"告示" : (: look_gaoshi :),',
            ']));',
            'set("objects", ([',
            '"/d/city/npc/wujiang" : 1,',
            '"/d/city/npc/bing" : 2,',
            ']));',
            '}'
        ].join('\n');
        const output = await format(source);

        expect(output).toContain('string look_gaoshi();');
        expect(output).toContain('set("long", @LONG\n这是苏州府的北城门。\nLONG');
        expect(output).toContain('"告示" : (: look_gaoshi :)');
        expect(output).toContain('"/d/city/npc/wujiang" : 1');
        expect(output).not.toContain('( : look_gaoshi : )');
        expect(output).not.toContain('" / d / city / npc / wujiang"');
    });
});
