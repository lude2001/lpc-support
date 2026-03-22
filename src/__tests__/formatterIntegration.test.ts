import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { FormattingService } from '../formatter/FormattingService';
import { clearGlobalParsedDocumentService, getGlobalParsedDocumentService } from '../parser/ParsedDocumentService';
import { TestHelper } from './utils/TestHelper';

const FIXTURE_ROOT = path.resolve(__dirname, '../../test/lpc_code');

async function format(source: string): Promise<string> {
    clearGlobalParsedDocumentService();
    const service = new FormattingService();
    const fileName = `integration-${Date.now()}-${Math.random().toString(16).slice(2)}.c`;
    const document = TestHelper.createMockDocument(source, 'lpc', fileName);
    const edits = await service.formatDocument(document);

    return edits[0]?.newText ?? source;
}

function readFixture(name: string): string {
    return fs.readFileSync(path.join(FIXTURE_ROOT, name), 'utf8');
}

function countMatches(text: string, pattern: RegExp): number {
    return text.match(pattern)?.length ?? 0;
}

function normalizeLineEndings(text: string): string {
    return text.replace(/\r\n/g, '\n');
}

describe('formatter integration', () => {
    test('仅包含 include 指令的文件不会被格式化清空', async () => {
        const source = '#include "/sys/test.h"\n';

        await expect(format(source)).resolves.toBe(source);
    });

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

    test('仅有 foreach(ref) 误报时仍会继续格式化整文', async () => {
        const source = 'void test(){foreach(ref mixed item in arr){if(x){foo(item);}}}';

        await expect(format(source)).resolves.toBe([
            'void test()',
            '{',
            '    foreach (ref mixed item in arr)',
            '    {',
            '        if (x)',
            '        {',
            '            foo(item);',
            '        }',
            '    }',
            '}'
        ].join('\n'));
    });

    test('define 开头但包含正常 LPC 代码的文件仍会继续格式化后续代码', async () => {
        const source = '#define FOO 1\nvoid create(){if(x){foo();}}';
        const output = await format(source);

        expect(output).toContain('#define FOO 1');
        expect(output).toContain('void create()');
        expect(output).toContain('if (x)');
    });

    test('带 foreach(ref) 且存在其他语法错误的文件不会触发 fallback 改写', async () => {
        clearGlobalParsedDocumentService();
        const service = new FormattingService();
        const invalidDocument = TestHelper.createMockDocument([
            'void test()',
            '{',
            '    foreach(ref mixed item in arr) {',
            '        foo(item);',
            '    }',
            '    int x = ;',
            '}'
        ].join('\n'), 'lpc', 'invalid-foreach-fallback.c');

        await expect(service.formatDocument(invalidDocument)).resolves.toEqual([]);
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

    test('语法错误文件即使带前置 Javadoc 也会拒绝整文格式化', async () => {
        clearGlobalParsedDocumentService();
        const service = new FormattingService();
        const invalidDocument = TestHelper.createMockDocument([
            '/**',
            '* demo',
            '*/',
            'void broken(){',
            'int x = ;',
            '}'
        ].join('\n'), 'lpc', 'invalid-javadoc-format.c');

        await expect(service.formatDocument(invalidDocument)).resolves.toEqual([]);
    });

    test('格式化会保留原文件尾部换行', async () => {
        await expect(format('void test(){}\n')).resolves.toBe([
            'void test()',
            '{',
            '}',
            ''
        ].join('\n'));
    });

    test('CRLF 文件格式化后保留原始换行符', async () => {
        await expect(format('void test(){}\r\n')).resolves.toBe('void test()\r\n{\r\n}\r\n');
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
        const source = readFixture('beimen.c');
        const output = await format(source);

        expect(countMatches(output, /\/\/ Room: \/d\/suzhou\/beimen\.c/g)).toBe(1);
        expect(countMatches(output, /\/\/ Date: May 31, 98  Java/g)).toBe(1);
    });

    test('真实命令文件保留 include 指令与行尾注释', async () => {
        const source = readFixture('wusheng_zhenyi.c');
        const output = await format(source);

        expect(output).toContain('#include "zhenyi/shengming.h"    // 函数声明');
        expect(output).toContain('#include "zhenyi/interface.h"    // 界面显示');
        expect(output).toContain('#include "zhenyi/scheme.h"       // 方案管理功能');
        expect(countMatches(output, /#include "zhenyi\/shengming\.h"/g)).toBe(1);
        expect(countMatches(output, /#include "zhenyi\/interface\.h"/g)).toBe(1);
    });

    test('真实命令文件保留函数前的 Javadoc 注释块', async () => {
        const source = readFixture('wusheng_zhenyi.c');
        const output = await format(source);

        expect(output).toContain('* @brief 武圣真意系统主指令');
        expect(output).toContain('* @param string arg 参数，格式：功能名 [附加参数]');
        expect(output).toContain('int main(object me, string arg)');
        expect(countMatches(output, /\* @brief 武圣真意系统主指令/g)).toBe(1);
    });

    test('真实命令文件的顶部注释块不会重复打印', async () => {
        const source = readFixture('wusheng_zhenyi.c');
        const output = await format(source);

        expect(countMatches(output, /\* @brief 武圣真意系统用户指令/g)).toBe(1);
    });

    test('真实命令文件在 include 块与函数定义之间保留空行', async () => {
        const source = readFixture('wusheng_zhenyi.c');
        const output = normalizeLineEndings(await format(source));

        expect(output).toContain('#include "zhenyi/scheme.h"       // 方案管理功能\n\nvoid create()');
    });

    test('真实命令文件在声明段、if 链和 switch 之间插入空行', async () => {
        const source = readFixture('wusheng_zhenyi.c');
        const output = normalizeLineEndings(await format(source));

        expect(output).toContain('int p1, p2;\n\n    if (!me)');
        expect(output).toContain('return delete_scheme_execute(me, param1);\n\n    switch (arg)');
    });

    test('真实 meridiand 文件保留指针返回类型与指针变量声明', async () => {
        const source = readFixture('meridiand.c');
        const output = await format(source);

        expect(output).toContain('string *query_xue(string arg)');
        expect(output).toContain('string *completed = ({');
        expect(output).toContain('string *strin;');
    });

    test('真实 meridiand 文件保留 for 循环结构和循环内注释', async () => {
        const source = readFixture('meridiand.c');
        const output = await format(source);

        expect(output).toContain('for (i = 0; i < size; i++)');
        expect(output).toContain('    //不是一个数字类型，conti');
        expect(output).toContain('        if (!intp(me->query("meridian/" + strin[i])))');
    });

    test('真实 meridiand 文件保留字符串拼接中的格式占位符', async () => {
        const source = readFixture('meridiand.c');
        const output = await format(source);

        expect(output).toContain('感觉%s经脉已尽数贯通');
        expect(output).toContain('增加%d点。');
        expect(output).not.toContain('% s');
        expect(output).not.toContain('% d');
    });

    test('真实 meridiand 文件保持 else if 链紧凑', async () => {
        const source = readFixture('meridiand.c');
        const output = await format(source);

        expect(output).toContain('else if (name == "带脉" || name == "奇经总脉")');
        expect(output).toContain('else if (name == "阳维脉")');
    });

    test('相邻独立 if 语句之间会插入空行但不影响注释归属', async () => {
        const source = [
            'mixed hit_ob(object me, object victim, int damage_bonus)',
            '{',
            '    if (me->query_skill("yifeng-jian", 1) > 150) {',
            '        victim->receive_damage("qi", (damage_bonus) * 2 / 3, me);',
            '        return CYN"$N的移风剑法已入返璞归真境界，随意一剑带出一阵剑气扑向$n！！！！！\\n"NOR;',
            '    }',
            '    // 第二等级的伤气',
            '    if (me->query_skill("yifeng-jian", 1) > 120) {',
            '        victim->receive_damage("qi", (damage_bonus) * 2 / 3, me);',
            '        return RED"$N的移风剑法已初有小成,每出一剑都带着强烈"HIR"剑气"HIW"扑向$n！！\\n"NOR;',
            '    }',
            '}'
        ].join('\n');
        const output = normalizeLineEndings(await format(source));

        expect(output).toContain([
            '    }',
            '',
            '    // 第二等级的伤气',
            '    if (me->query_skill("yifeng-jian", 1) > 120)'
        ].join('\n'));
    });

    test('字符串拼接中的相邻宏标识符会保留必要空格避免词法粘连', async () => {
        const source = [
            'string query_description()',
            '{',
            '    string msg;',
            '    msg += HIC "  柔情媚影 (meiying)" ZJBR NOR;',
            '    return msg;',
            '}'
        ].join('\n');
        const output = await format(source);

        expect(output).toContain('msg += HIC"  柔情媚影 (meiying)"ZJBR NOR;');
        expect(output).not.toContain('ZJBRNOR');
    });

    test('真实 meridiand 文件在赋值与 return 中不注入结构化值前导缩进', async () => {
        const source = readFixture('meridiand.c');
        const output = await format(source);

        expect(output).toContain('completed += ({');
        expect(output).not.toContain('completed +=             ({');
        expect(output).not.toContain('return         ({');
    });

    test('真实 meridiand 文件的经脉 mapping 保持逐项布局且穴位数组按原始设计块状展开', async () => {
        const source = readFixture('meridiand.c');
        const output = normalizeLineEndings(await format(source));

        expect(output).toContain('mapping xuewei = ([\n');
        expect(output).toContain('"带脉" : ({\n');
        expect(output).toContain('        "带脉",\n');
        expect(output).toContain('"冲脉" : ({\n');
        expect(output).toContain('        "会阴",\n');
    });

    test('真实 meridiand 文件保留足三阳经前的说明注释', async () => {
        const source = readFixture('meridiand.c');
        const output = normalizeLineEndings(await format(source));

        expect(output).toContain('//瞳子髎、听会、上关、颔厌、悬颅、悬厘、曲鬓、率谷、天冲、浮白、头窍阴、完骨、本神、阳白、头临泣、目窗、正营、承灵、脑空、风池、肩井、渊液、辄筋、日月、京门、带脉、五枢、维道、居髎、环跳、风市、中渎、膝阳关、阳陵泉、阳交、外丘、光明、阳辅、悬钟、丘墟、足临泣、地五会、侠溪、足窍阴');
        expect(output).toContain('//保留前25个穴位');
        expect(output).toContain('//保留前25个穴位\n    "足三阳经" : ({\n');
    });

    test('真实 meridiand 文件保留 closure 参数列表的紧凑逗号间距', async () => {
        const source = readFixture('meridiand.c');
        const output = await format(source);

        expect(output).toContain('(: call_other, me, "force_me", "beat " + name + " with " + dname :)');
        expect(output).not.toContain('call_other , me , "force_me"');
    });

    test('真实 json 文件保留 switch case 中的字符与字符串字面量', async () => {
        const source = readFixture('json.c');
        const output = await format(source);

        expect(output).toContain("case '-':");
        expect(output).toContain("case '+':");
        expect(output).toContain('case ",":');
        expect(output).toContain('case ":":');
        expect(output).not.toContain("case ' - ':");
        expect(output).not.toContain("case ' + ':");
        expect(output).not.toContain('case ", ":');
        expect(output).not.toContain('case " : ":');
    });

    test('真实 json 文件保留带尾限定符的切片表达式', async () => {
        const source = readFixture('json.c');
        const output = await format(source);

        expect(output).toContain('result = result[0..<1] + "\\n" + make_indent_spaces(indent_str, --indent) + char;');
        expect(output).not.toContain('result = result[0..1]');
    });

    test('真实 json 文件保留文件尾部的注释块且不会搬到文件头', async () => {
        const source = readFixture('json.c');
        const output = await format(source);

        expect(output.startsWith('// }')).toBe(false);
        expect(output).toContain('// //bean 转 json');
        expect(output.trimEnd().endsWith('// }')).toBe(true);
    });

    test('真实 json 文件格式化后不会新增解析诊断', async () => {
        const source = readFixture('json.c');
        const output = await format(source);

        clearGlobalParsedDocumentService();
        const sourceDocument = TestHelper.createMockDocument(source, 'lpc', 'json-source.c');
        const outputDocument = TestHelper.createMockDocument(output, 'lpc', 'json-output.c');
        const parser = getGlobalParsedDocumentService();
        const sourceDiagnostics = parser.get(sourceDocument).diagnostics;
        const outputDiagnostics = parser.get(outputDocument).diagnostics;

        expect(outputDiagnostics.length).toBeLessThanOrEqual(sourceDiagnostics.length);
    });

    test('真实 json 文件保留复杂 for 头部结构', async () => {
        const source = readFixture('json.c');
        const output = await format(source);

        expect(output).toContain('for (i = start, j = strlen(token); i < j; i++)');
        expect(output).toContain('for (; ; )');
        expect(output).not.toContain('for (i = start , j = strlen(token); i < j; i++)');
    });

    test('真实 json 文件保留反斜杠与引号敏感字面量', async () => {
        const source = readFixture('json.c');
        const output = await format(source);

        expect(output).toContain("case '\\\\':");
        expect(output).toContain('value = replace_string(value, "\\\\", "\\\\\\\\");');
        expect(output).toContain('if (char == "\\"" && json_str[i - 1..i - 1] != "\\\\")');
    });
});
