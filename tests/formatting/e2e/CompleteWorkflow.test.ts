/**
 * 端到端测试套件
 * 模拟用户完整的LPC代码格式化工作流程
 */

import { FormattingController } from '../../../src/formatting/controller/FormattingController';
import { TestHelper } from '../../utils/TestHelper';
import { MockVSCode } from '../../mocks/MockVSCode';

// Mock VS Code API
jest.mock('vscode', () => MockVSCode);

// 扩展E2E测试的超时时间
jest.setTimeout(60000);

describe('端到端测试 - 完整工作流程', () => {
    let controller: FormattingController;

    beforeEach(() => {
        controller = new FormattingController();
    });

    afterEach(() => {
        controller.dispose();
    });

    describe('新项目开发流程', () => {
        test('应该支持从空白到完整LPC项目的格式化', async () => {
            // 模拟用户创建新的LPC文件
            const stages = [
                // 第一阶段：基本文件结构
                'inherit "/std/object";',
                
                // 第二阶段：添加函数
                `inherit "/std/object";

void create() {
::create();
}`,
                
                // 第三阶段：添加更多功能
                `inherit "/std/object";

void create() {
::create();
set_name("test object");
set_id(({"test","object"}));
}

void init() {
if(!random(10)) {
destruct(this_object());
}
}`,
                
                // 第四阶段：复杂逻辑
                `inherit "/std/object";

mapping data;

void create() {
::create();
set_name("test object");
set_id(({"test","object"}));
data = ([]);
}

void init() {
if(!random(10)) {
destruct(this_object());
}
}

mixed query_data(string key) {
if(!data) return 0;
return data[key];
}

void set_data(string key,mixed value) {
if(!data) data = ([]);
data[key] = value;
}`
            ];
            
            for (let i = 0; i < stages.length; i++) {
                const stage = stages[i];
                const document = TestHelper.createMockDocument(stage, 'lpc');
                
                console.log(`\n=== 测试阶段 ${i + 1} ===`);
                
                const startTime = Date.now();
                const edits = await controller.formatDocument(document);
                const duration = Date.now() - startTime;
                
                expect(edits).toBeDefined();
                expect(Array.isArray(edits)).toBe(true);
                
                console.log(`阶段 ${i + 1} 格式化时间: ${duration}ms`);
                
                if (edits.length > 0) {
                    const formattedText = edits[0].newText;
                    expect(formattedText).toBeDefined();
                    expect(formattedText.length).toBeGreaterThan(0);
                    
                    // 验证格式化结果的正确性
                    const validation = TestHelper.validateFormattedCode(stage, formattedText);
                    if (!validation.isValid) {
                        console.error(`阶段 ${i + 1} 验证失败:`, validation.issues);
                    }
                    expect(validation.isValid).toBe(true);
                }
            }
        });
    });

    describe('代码重构流程', () => {
        test('应该支持代码重构过程中的格式化', async () => {
            // 原始代码（格式不规范）
            const originalCode = `inherit "/std/weapon";

void create(){::create();set_name("long sword");set_id(({"sword","weapon","long sword"}));set_weight(3);set_value(100);set_property("magic",1);set_property("enchantment",2);set_wield((: this_object(), "wield_func" :));set_unwield((: this_object(), "unwield_func" :));set_hit((: this_object(), "weapon_hit" :));}int wield_func(object who){if(!who) return 0;if(who->query_level()<5){tell_object(who,"You are not experienced enough to wield this weapon.");return 0;}tell_object(who,"You feel the power of the sword.");return 1;}int unwield_func(object who){if(!who) return 0;tell_object(who,"The power fades.");return 1;}int weapon_hit(object attacker){if(!attacker) return 0;if(random(10)<3){tell_object(attacker,"Your sword glows with magical energy!");return random(5)+1;}return 0;}`;
            
            const document = TestHelper.createMockDocument(originalCode, 'lpc');
            
            console.log('\n=== 代码重构测试 ===');
            console.log('原始代码长度:', originalCode.length);
            
            const startTime = Date.now();
            const edits = await controller.formatDocument(document);
            const duration = Date.now() - startTime;
            
            expect(edits).toBeDefined();
            expect(Array.isArray(edits)).toBe(true);
            expect(edits.length).toBeGreaterThan(0);
            
            const formattedCode = edits[0].newText;
            expect(formattedCode).toBeDefined();
            
            console.log('格式化后代码长度:', formattedCode.length);
            console.log('格式化时间:', duration + 'ms');
            
            // 验证重构结果
            const validation = TestHelper.validateFormattedCode(originalCode, formattedCode);
            expect(validation.isValid).toBe(true);
            
            // 验证格式化效果
            expect(formattedCode).toContain('void create()'); // 函数定义应该格式化
            expect(formattedCode).toContain('::create();'); // 继承调用应该保持
            expect(formattedCode.split('\n').length).toBeGreaterThan(originalCode.split('\n').length); // 应该有更多行
        });
    });

    describe('团队协作流程', () => {
        test('应该支持不同编码风格的统一', async () => {
            // 模拟不同开发者的编码风格
            const developerStyles = [
                // 开发者A：紧凑风格
                `inherit "/std/room";
void create(){
::create();
set_short("a test room");
set_long("This is a test room.");
set_property("light",2);
set_exits((["north":"/domains/town/rooms/square"]));
}`,
                
                // 开发者B：松散风格
                `inherit "/std/room";

void create() {
    ::create();
    
    set_short( "a test room" );
    set_long( "This is a test room." );
    set_property( "light", 2 );
    set_exits( ([ "north" : "/domains/town/rooms/square" ]) );
}`,
                
                // 开发者C：混合风格
                `inherit "/std/room";
void create()  {
::create();
  set_short("a test room");
    set_long(  "This is a test room."  );
      set_property("light",2);
set_exits(([ "north":"/domains/town/rooms/square"  ]));
}`
            ];
            
            const formattedResults: string[] = [];
            
            for (let i = 0; i < developerStyles.length; i++) {
                const code = developerStyles[i];
                const document = TestHelper.createMockDocument(code, 'lpc');
                
                console.log(`\n=== 开发者 ${String.fromCharCode(65 + i)} 的代码 ===`);
                
                const edits = await controller.formatDocument(document);
                expect(edits).toBeDefined();
                expect(edits.length).toBeGreaterThan(0);
                
                const formattedCode = edits[0].newText;
                formattedResults.push(formattedCode);
                
                console.log('原始代码行数:', code.split('\n').length);
                console.log('格式化后行数:', formattedCode.split('\n').length);
            }
            
            // 验证所有格式化结果应该相似或一致
            const firstResult = formattedResults[0];
            for (let i = 1; i < formattedResults.length; i++) {
                const currentResult = formattedResults[i];
                
                // 比较的核心结构应该一致
                const firstTokens = TestHelper.extractTokens(firstResult);
                const currentTokens = TestHelper.extractTokens(currentResult);
                
                expect(currentTokens).toEqual(firstTokens);
            }
            
            console.log('\n\u6240有开发者的代码都被统一成相同的格式');
        });
    });

    describe('项目维护流程', () => {
        test('应该支持遗留代码的现代化', async () => {
            // 模拟老版本LPC代码
            const legacyCode = `// Legacy MUD code from 1995
inherit LIB_OBJECT;

void eventCreate() {
object *users;
int i;
object tp;
::eventCreate();
SetShort("an old artifact");
SetLong("This is an ancient artifact from the old days. "+
"It seems to pulse with mysterious energy.");
SetMass(100);
SetValue(1000);
SetProperty("magic", 1);
users = users();
for(i = 0; i < sizeof(users); i++) {
tp = users[i];
if(!tp) continue;
if(tp->GetLevel() > 20) {
message("info", "You sense a powerful presence.", tp);
}
}
}

int eventDestroy() {
write("The artifact crumbles to dust.");
return ::eventDestroy();
}

int CanGet(object who) {
if(!who) return 0;
if(who->GetLevel() < 10) {
write("The artifact is too powerful for you.");
return 0;
}
return 1;
}

void heart_beat() {
object *obs;
int i;
if(!environment()) return;
obs = all_inventory(environment());
for(i = 0; i < sizeof(obs); i++) {
if(!obs[i]) continue;
if(!living(obs[i])) continue;
if(random(100) < 5) {
tell_object(obs[i], "The artifact glows briefly.");
}
}
}`;
            
            const document = TestHelper.createMockDocument(legacyCode, 'lpc');
            
            console.log('\n=== 遗留代码现代化测试 ===');
            console.log('原始代码行数:', legacyCode.split('\n').length);
            
            const startTime = Date.now();
            const edits = await controller.formatDocument(document);
            const duration = Date.now() - startTime;
            
            expect(edits).toBeDefined();
            expect(edits.length).toBeGreaterThan(0);
            
            const modernizedCode = edits[0].newText;
            expect(modernizedCode).toBeDefined();
            
            console.log('现代化后行数:', modernizedCode.split('\n').length);
            console.log('现代化时间:', duration + 'ms');
            
            // 验证现代化结果
            const validation = TestHelper.validateFormattedCode(legacyCode, modernizedCode);
            expect(validation.isValid).toBe(true);
            
            // 验证关键功能保持
            expect(modernizedCode).toContain('eventCreate');
            expect(modernizedCode).toContain('eventDestroy');
            expect(modernizedCode).toContain('CanGet');
            expect(modernizedCode).toContain('heart_beat');
        });
    });

    describe('大型项目测试', () => {
        test('应该处理大型复杂的LPC项目文件', async () => {
            // 模拟大型项目文件（如MUD的主城区域）
            const largeProjectFile = TestHelper.createLPCTestCode({
                hasInherit: true,
                hasFunctions: true,
                hasArrays: true,
                hasMappings: true,
                hasFunctionPointers: true,
                hasAnonymousFunctions: true,
                hasForEach: true,
                hasSwitchRanges: true
            }) + `

// Additional complex functionality
mapping room_data;
mixed *npc_list;
function *event_handlers;

void create() {
    ::create();
    room_data = ([]);
    npc_list = ({});
    event_handlers = ({});
    
    initialize_room_data();
    setup_npcs();
    register_events();
}

void initialize_room_data() {
    string *directions = ({ "north", "south", "east", "west", "up", "down" });
    
    foreach (string dir in directions) {
        if (random(2)) {
            room_data[dir] = sprintf("/domains/town/rooms/%s_%d", dir, random(100));
        }
    }
    
    room_data["items"] = ([
        "table": "A wooden table with carved legs.",
        "chair": "A comfortable looking chair.",
        "book": "An old leather-bound book."
    ]);
}

void setup_npcs() {
    mixed *npc_configs = ({
        ([ "file": "/domains/town/npcs/guard", "count": 2 ]),
        ([ "file": "/domains/town/npcs/merchant", "count": 1 ]),
        ([ "file": "/domains/town/npcs/citizen", "count": random(3) + 1 ])
    });
    
    foreach (mapping config in npc_configs) {
        for (int i = 0; i < config["count"]; i++) {
            object npc = new(config["file"]);
            if (npc) {
                npc->move(this_object());
                npc_list += ({ npc });
            }
        }
    }
}

void register_events() {
    event_handlers += ({
        (: handle_player_enter :),
        (: handle_player_leave :),
        (: handle_combat_start :),
        function(object *args) {
            if (sizeof(args) > 0 && args[0]) {
                tell_object(args[0], "Something mysterious happens...");
            }
        }
    });
}

void handle_player_enter(object player) {
    if (!player || !living(player)) return;
    
    tell_object(player, "You enter a bustling area.");
    
    if (sizeof(npc_list) > 0) {
        object random_npc = npc_list[random(sizeof(npc_list))];
        if (random_npc && random(10) < 3) {
            switch (random(3)) {
                case 0:
                    tell_object(player, sprintf("%s nods at you.", random_npc->query_cap_name()));
                    break;
                case 1:
                    tell_object(player, sprintf("%s smiles.", random_npc->query_cap_name()));
                    break;
                case 2:
                    tell_object(player, sprintf("%s waves.", random_npc->query_cap_name()));
                    break;
            }
        }
    }
}

void handle_player_leave(object player) {
    if (!player) return;
    tell_room(this_object(), sprintf("%s leaves.", player->query_cap_name()), ({ player }));
}

void handle_combat_start(object attacker, object target) {
    if (!attacker || !target) return;
    
    tell_room(this_object(), "A fight breaks out!", ({ attacker, target }));
    
    // Notify all NPCs about combat
    foreach (object npc in npc_list) {
        if (npc && !npc->query_property("no_clean")) {
            npc->do_action("flee");
        }
    }
}`;
            
            const document = TestHelper.createMockDocument(largeProjectFile, 'lpc');
            
            console.log('\n=== 大型项目文件测试 ===');
            console.log('原始代码大小:', largeProjectFile.length, '字符');
            console.log('原始代码行数:', largeProjectFile.split('\n').length);
            
            const startTime = Date.now();
            const edits = await controller.formatDocument(document);
            const duration = Date.now() - startTime;
            
            expect(edits).toBeDefined();
            expect(edits.length).toBeGreaterThan(0);
            
            const formattedCode = edits[0].newText;
            expect(formattedCode).toBeDefined();
            
            console.log('格式化后大小:', formattedCode.length, '字符');
            console.log('格式化后行数:', formattedCode.split('\n').length);
            console.log('格式化时间:', duration + 'ms');
            
            // 性能要求：大型文件应在5秒内完成
            expect(duration).toBeLessThan(5000);
            
            // 验证格式化结果
            const validation = TestHelper.validateFormattedCode(largeProjectFile, formattedCode);
            expect(validation.isValid).toBe(true);
        });
    });

    describe('性能和稳定性测试', () => {
        test('应该在连续使用中保持性能稳定', async () => {
            const testCode = TestHelper.createLPCTestCode({
                hasFunctions: true,
                hasArrays: true,
                hasMappings: true
            });
            
            const document = TestHelper.createMockDocument(testCode, 'lpc');
            const durations: number[] = [];
            
            console.log('\n=== 连续使用性能测试 ===');
            
            // 连续执行20次格式化
            for (let i = 0; i < 20; i++) {
                const startTime = Date.now();
                const edits = await controller.formatDocument(document);
                const duration = Date.now() - startTime;
                
                expect(edits).toBeDefined();
                durations.push(duration);
                
                if (i % 5 === 4) {
                    const recentAvg = durations.slice(-5).reduce((a, b) => a + b, 0) / 5;
                    console.log(`第${i + 1}次，近5次平均: ${recentAvg.toFixed(2)}ms`);
                }
            }
            
            // 分析性能趋势
            const firstFive = durations.slice(0, 5);
            const lastFive = durations.slice(-5);
            
            const firstAvg = firstFive.reduce((a, b) => a + b, 0) / firstFive.length;
            const lastAvg = lastFive.reduce((a, b) => a + b, 0) / lastFive.length;
            
            console.log(`初始5次平均: ${firstAvg.toFixed(2)}ms`);
            console.log(`最后5次平均: ${lastAvg.toFixed(2)}ms`);
            
            // 由于缓存的存在，后期应该更快
            expect(lastAvg).toBeLessThanOrEqual(firstAvg);
        });

        test('应该在内存压力下保持稳定', async () => {
            const initialMemory = process.memoryUsage();
            
            console.log('\n=== 内存压力测试 ===');
            console.log('初始内存使用:', Math.round(initialMemory.heapUsed / 1024 / 1024), 'MB');
            
            // 创建多个大文件进行格式化
            for (let i = 0; i < 10; i++) {
                const largeCode = TestHelper.generateLargeCodeFile(500);
                const document = TestHelper.createMockDocument(largeCode, 'lpc');
                
                const edits = await controller.formatDocument(document);
                expect(edits).toBeDefined();
                
                const currentMemory = process.memoryUsage();
                const memoryIncrease = currentMemory.heapUsed - initialMemory.heapUsed;
                
                console.log(`第${i + 1}个大文件处理后，内存增长: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
                
                // 内存增长不应该超过100MB
                expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
            }
            
            const finalMemory = process.memoryUsage();
            const totalIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
            
            console.log('总内存增长:', Math.round(totalIncrease / 1024 / 1024), 'MB');
        });
    });

    describe('错误恢复测试', () => {
        test('应该从各种错误中恢复', async () => {
            const errorCases = [
                // 语法错误
                'void test( { invalid }',
                // 缺失括号
                'if (x > 0 { write("test"); }',
                // 不完整的字符串
                'write("unclosed string',
                // 未知符号
                'void test() { £¤¥¦§; }'
            ];
            
            console.log('\n=== 错误恢复测试 ===');
            
            for (let i = 0; i < errorCases.length; i++) {
                const errorCode = errorCases[i];
                const document = TestHelper.createMockDocument(errorCode, 'lpc');
                
                console.log(`测试错误案例 ${i + 1}:`, errorCode.substring(0, 30) + '...');
                
                const edits = await controller.formatDocument(document);
                
                // 即使有错误，也应该返回结果，不应该崩溃
                expect(edits).toBeDefined();
                expect(Array.isArray(edits)).toBe(true);
                
                console.log(`错误案例 ${i + 1} 处理完成`);
            }
        });
    });
});

// 辅助函数：提取代码中的主要结构元素
function extractCodeStructure(code: string): {
    functions: string[];
    variables: string[];
    keywords: string[];
} {
    const functions = (code.match(/\b\w+\s*\(/g) || []).map(m => m.replace(/\s*\(/, ''));
    const variables = (code.match(/\b(?:int|string|mixed|object|mapping)\s+\w+/g) || [])
        .map(m => m.split(/\s+/)[1]);
    const keywords = (code.match(/\b(?:if|else|for|while|switch|case|break|return|inherit)\b/g) || []);
    
    return { functions, variables, keywords };
}
