import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
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

    test('真实房间文件的顶部行注释不会重复打印', async () => {
        const source = [
            '// Room: /d/suzhou/beimen.c',
            '// Date: May 31, 98  Java',
            '',
            'inherit ROOM;',
            '',
            'void create(){}'
        ].join('\n');
        const output = await format(source);

        expect(output.match(/\/\/ Room: \/d\/suzhou\/beimen\.c/g) ?? []).toHaveLength(1);
        expect(output.match(/\/\/ Date: May 31, 98  Java/g) ?? []).toHaveLength(1);
    });

    test('带原型和 heredoc 的真实房间文件头注释不会重复打印', async () => {
        const source = [
            '// Room: /d/suzhou/beimen.c',
            '// Date: May 31, 98  Java',
            '',
            'inherit ROOM;',
            '',
            'string look_gaoshi();',
            'void create()',
            '{',
            '\tset("short", "北门");',
            '\tset("long", @LONG',
            '这是苏州府的北城门。出门远远可见西面的虎丘山。放眼',
            '望去尽是绿的田，翠的草和清清的小河。门边官兵身后贴着一',
            '份告示。南北一条笔直的官道。',
            'LONG );',
            '\tset("outdoors", "suzhou");',
            '\tsetup();',
            '}',
            '',
            'string look_gaoshi()',
            '{',
            '\treturn FINGER_D->get_killer() + "\\n苏州知府\\n冯正东\\n";',
            '}'
        ].join('\n');
        const output = await format(source);

        expect(output.match(/\/\/ Room: \/d\/suzhou\/beimen\.c/g) ?? []).toHaveLength(1);
        expect(output.match(/\/\/ Date: May 31, 98  Java/g) ?? []).toHaveLength(1);
    });

    test('磁盘上的 beimen.c 顶部行注释不会重复打印', async () => {
        const source = fs.readFileSync(
            path.resolve(__dirname, '../../test/lpc_code/beimen.c'),
            'utf8'
        );
        const output = await format(source);

        expect(output.match(/\/\/ Room: \/d\/suzhou\/beimen\.c/g) ?? []).toHaveLength(1);
        expect(output.match(/\/\/ Date: May 31, 98  Java/g) ?? []).toHaveLength(1);
    });

    test('真实命令文件保留 include 指令与行尾注释', async () => {
        const source = fs.readFileSync(
            path.resolve(__dirname, '../../test/lpc_code/wusheng_zhenyi.c'),
            'utf8'
        );
        const output = await format(source);

        expect(output).toContain('#include "zhenyi/shengming.h"    // 函数声明');
        expect(output).toContain('#include "zhenyi/interface.h"    // 界面显示');
        expect(output).toContain('#include "zhenyi/scheme.h"       // 方案管理功能');
        expect(output.match(/#include "zhenyi\/shengming\.h"/g) ?? []).toHaveLength(1);
        expect(output.match(/#include "zhenyi\/interface\.h"/g) ?? []).toHaveLength(1);
    });

    test('真实命令文件保留函数前的 Javadoc 注释块', async () => {
        const source = fs.readFileSync(
            path.resolve(__dirname, '../../test/lpc_code/wusheng_zhenyi.c'),
            'utf8'
        );
        const output = await format(source);

        expect(output).toContain('* @brief 武圣真意系统主指令');
        expect(output).toContain('* @param string arg 参数，格式：功能名 [附加参数]');
        expect(output).toContain('int main(object me, string arg)');
        expect(output.match(/\* @brief 武圣真意系统主指令/g) ?? []).toHaveLength(1);
    });

    test('真实命令文件的顶部注释块不会重复打印', async () => {
        const source = fs.readFileSync(
            path.resolve(__dirname, '../../test/lpc_code/wusheng_zhenyi.c'),
            'utf8'
        );
        const output = await format(source);

        expect(output.match(/\* @brief 武圣真意系统用户指令/g) ?? []).toHaveLength(1);
    });

    test('真实命令文件在 include 块与函数定义之间保留空行', async () => {
        const source = fs.readFileSync(
            path.resolve(__dirname, '../../test/lpc_code/wusheng_zhenyi.c'),
            'utf8'
        );
        const output = await format(source);

        expect(output).toContain('#include "zhenyi/scheme.h"       // 方案管理功能\n\nvoid create()');
    });

    test('真实命令文件在声明段、if 链和 switch 之间插入空行', async () => {
        const source = fs.readFileSync(
            path.resolve(__dirname, '../../test/lpc_code/wusheng_zhenyi.c'),
            'utf8'
        );
        const output = await format(source);

        expect(output).toContain('int p1, p2;\n\n    if (!me)');
        expect(output).toContain('return delete_scheme_execute(me, param1);\n\n    switch (arg)');
    });
});
