import * as fs from 'fs';
import * as path from 'path';
import { FormattingService } from '../formatter/FormattingService';
import { createLanguageFormattingService } from '../language/services/formatting/LanguageFormattingService';
import { clearGlobalParsedDocumentService, getGlobalParsedDocumentService } from '../parser/ParsedDocumentService';
import { SyntaxBuilder } from '../syntax/SyntaxBuilder';
import { TestHelper } from './utils/TestHelper';

const FIXTURE_ROOT = path.resolve(__dirname, '../../test/lpc_code');
const REAL_WORKSPACE_FIXTURE = 'D:\\code\\shuiyuzhengfeng_lpc\\kungfu\\skill\\yifeng-jian.c';
const COLLAPSED_ACTION_SOURCE = `inherit SKILL;
string type() { return "zhongji"; }

mapping *action = ({ (["action" : "$N使一式「花随风移」，手中$w嗡嗡微振，幻成一无数花瓣刺向$n的$l", "force" : 160, "attack" : 50, "dodge" : 80, "parry" : 40, "damage" : 100, "skill_name" : "花随风移", "damage_type" : "刺伤"]), (["action" : "$N移步上前，使出「雨花纷飞」，剑气围绕，$w淡淡地向$n的$l挥去", "force" : 160, "attack" : 55, "dodge" : 80, "parry" : 40, "damage" : 110, "lvl" : 10, "damage_type" : "刺伤"]), (["action" : "$N一式「"HIM"花起剑落"NOR"」，纵身飘开数尺，运发剑气，手中$w遥遥飞向$n的$l", "force" : 160, "attack" : 100, "dodge" : 80, "parry" : 40, "damage" : 120, "lvl" : 120, "damage_type" : "刺伤"]), (["action" : "$N纵身轻轻跃起，一式「"HIC"紫花飞舞"NOR"」，剑光化为紫色，飘向$n的$l", "force" : 160, "attack" : 110, "dodge" : 80, "parry" : 40, "damage" : 130, "lvl" : 130, "damage_type" : "刺伤"]), (["action" : "$N手中$w中宫直进，一式「"HIB"花开花谢"NOR"」，无声无息地对准$n的$l刺出一剑", "force" : 160, "attack" : 120, "dodge" : 80, "parry" : 40, "damage" : 140, "lvl" : 140, "damage_type" : "刺伤"]), (["action" : "$N手中$w斜指苍天，剑芒吞吐，一式「"HIY"飞花落叶"NOR"」，对准$n的$l斜斜击出"NOR, "force" : 160, "attack" : 130, "dodge" : 80, "parry" : 40, "damage" : 150, "lvl" : 150, "damage_type" : "刺伤"]), (["action" : "$N左指凌空虚点，右手$w逼出丈许雪亮剑芒，一式「"HIG"春回大地"NOR"」刺向$n的$l"NOR, "force" : 160, "attack" : 140, "dodge" : 80, "parry" : 40, "damage" : 160, "lvl" : 160, "damage_type" : "刺伤"]), (["action" : HIM"狂风大起, 只见花瓣到处飞舞, 突然无数花瓣割向$n, $n顿时鲜血直喷"NOR, "force" : 160, "attack" : 150, "dodge" : 80, "parry" : 40, "damage" : 170, "lvl" : 160, "damage_type" : "刺伤"]), });
`;

describe('yifeng-jian formatter regression', () => {
    test('shared formatting service keeps the collapsed action mapping block layout', async () => {
        clearGlobalParsedDocumentService();

        const document = TestHelper.createMockDocument(COLLAPSED_ACTION_SOURCE, 'lpc', 'collapsed-yifeng-jian.c');
        const service = createLanguageFormattingService(new FormattingService());
        const edits = await service.formatDocument({
            document: {
                uri: document.uri.toString(),
                version: document.version,
                getText: () => document.getText()
            }
        });
        const output = edits[0]?.newText ?? COLLAPSED_ACTION_SOURCE;

        expect(edits).toHaveLength(1);
        expect(output.replace(/\r\n/g, '\n')).toContain('mapping *action = ({\n([');
    });

    test('keeps action mapping array in block layout for the real fixture', async () => {
        clearGlobalParsedDocumentService();

        const source = fs.readFileSync(path.join(FIXTURE_ROOT, 'yifeng-jian.c'), 'utf8');
        const document = TestHelper.createMockDocument(source, 'lpc', 'yifeng-jian.c');
        const edits = await new FormattingService().formatDocument(document);
        const output = (edits[0]?.newText ?? source).replace(/\r\n/g, '\n');

        expect(edits).toHaveLength(1);
        expect(output).toContain('mapping *action = ({\n([');
        expect(output).toContain('"action" : "$N使一式「花随风移」');
        expect(output).toContain('"damage_type" : "刺伤"\n    ]),\n([');
        expect(output).toContain('"action" : "$N移步上前，使出「雨花纷飞」');
        expect(output).not.toContain('mapping *action = ({ ([');
    });

    test('keeps action mapping array in block layout for the real workspace file', async () => {
        clearGlobalParsedDocumentService();

        const source = fs.readFileSync(REAL_WORKSPACE_FIXTURE, 'utf8');
        const document = TestHelper.createMockDocument(source, 'lpc', REAL_WORKSPACE_FIXTURE);
        const edits = await new FormattingService().formatDocument(document);
        const output = (edits[0]?.newText ?? source).replace(/\r\n/g, '\n');

        expect(edits).toHaveLength(1);
        expect(output).toContain('mapping *action = ({\n([');
        expect(output).toContain('"damage_type" : "刺伤"\n    ]),\n([');
        expect(output).not.toContain(']), ([');
        expect(output).not.toContain('mapping *action = ({ ([');
    });

    test('builds the action initializer as an array literal instead of an opaque expression', () => {
        clearGlobalParsedDocumentService();

        const source = fs.readFileSync(REAL_WORKSPACE_FIXTURE, 'utf8');
        const document = TestHelper.createMockDocument(source, 'lpc', REAL_WORKSPACE_FIXTURE);
        const parsed = getGlobalParsedDocumentService().get(document);
        const syntax = new SyntaxBuilder(parsed).build();
        const actionDeclarator = syntax.nodes.find((node) => node.kind === 'VariableDeclarator' && node.name === 'action');
        const opaqueNodes = syntax.nodes.filter((node) => node.kind === 'OpaqueExpression');

        expect(actionDeclarator).toBeDefined();
        expect(actionDeclarator?.children[1]?.kind).toBe('ArrayLiteralExpression');
        expect(opaqueNodes).toHaveLength(0);
    });

    test('can recover block layout from the collapsed single-line action declaration', async () => {
        clearGlobalParsedDocumentService();

        const document = TestHelper.createMockDocument(COLLAPSED_ACTION_SOURCE, 'lpc', 'collapsed-yifeng-jian.c');
        const edits = await new FormattingService().formatDocument(document);
        const output = (edits[0]?.newText ?? COLLAPSED_ACTION_SOURCE).replace(/\r\n/g, '\n');
        const parsed = getGlobalParsedDocumentService().get(document);
        const syntax = new SyntaxBuilder(parsed).build();

        expect(parsed.diagnostics).toHaveLength(0);
        expect(syntax.nodes.some((node) => node.kind === 'VariableDeclarator' && node.name === 'action')).toBe(true);
        expect(output).toContain('mapping *action = ({\n([');
    });
});
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
