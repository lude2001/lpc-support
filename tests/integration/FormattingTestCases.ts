/**
 * LPC格式化测试用例集合
 * 
 * 这个文件包含了各种典型LPC代码场景的测试用例，
 * 用于全面测试格式化程序的正确性和鲁棒性。
 */

export interface TestCase {
    name: string;
    description: string;
    input: string;
    expectedPattern?: RegExp;
    shouldFormat: boolean;
    category: 'basic' | 'complex' | 'edge-case' | 'real-world';
}

/**
 * 基础格式化测试用例
 */
export const BASIC_TEST_CASES: TestCase[] = [
    {
        name: 'simple-function',
        description: '简单函数定义格式化',
        input: `int add(int a,int b){
return a+b;
}`,
        shouldFormat: true,
        category: 'basic'
    },
    {
        name: 'variable-declaration',
        description: '变量声明格式化',
        input: `int x=10;\nstring name="test";\nfloat pi=3.14;`,
        shouldFormat: true,
        category: 'basic'
    },
    {
        name: 'if-statement',
        description: 'if语句格式化',
        input: `if(condition){print("true");}else{print("false");}`,
        shouldFormat: true,
        category: 'basic'
    },
    {
        name: 'for-loop',
        description: 'for循环格式化',
        input: `for(int i=0;i<10;i++){print(i);}`,
        shouldFormat: true,
        category: 'basic'
    },
    {
        name: 'while-loop',
        description: 'while循环格式化',
        input: `while(condition){do_something();counter++;}`,
        shouldFormat: true,
        category: 'basic'
    },
    {
        name: 'switch-statement',
        description: 'switch语句格式化',
        input: `switch(value){case 1:print("one");break;case 2:print("two");break;default:print("other");}`,
        shouldFormat: true,
        category: 'basic'
    }
];

/**
 * 复杂结构测试用例
 */
export const COMPLEX_TEST_CASES: TestCase[] = [
    {
        name: 'nested-structures',
        description: '多层嵌套结构格式化',
        input: `void complex_function(){if(condition1){for(int i=0;i<max;i++){if(condition2){while(flag){process_item(i);if(should_break){break;}}}}}else{handle_alternative();}}`,
        shouldFormat: true,
        category: 'complex'
    },
    {
        name: 'mapping-array',
        description: '映射数组格式化',
        input: `mapping data=(["name":"LPC","version":"3.0","features":(["object":"oriented","dynamic":"typing","garbage":"collection",]),"active":1,]);`,
        shouldFormat: true,
        category: 'complex'
    },
    {
        name: 'complex-mapping-array',
        description: '复杂映射数组格式化',
        input: `mapping players=(["player1":(["name":"Alice","level":10,"items":(["sword","shield","potion",]),"stats":(["hp":100,"mp":50,"strength":15,]),]),"player2":(["name":"Bob","level":8,"items":(["bow","arrows",]),"stats":(["hp":80,"mp":30,"agility":20,]),]),]);`,
        shouldFormat: true,
        category: 'complex'
    },
    {
        name: 'function-with-many-parameters',
        description: '多参数函数格式化',
        input: `int complex_function(string name,int level,mapping stats,string *items,mapping config,object environment,int flags){return calculate_result(name,level,stats,items,config,environment,flags);}`,
        shouldFormat: true,
        category: 'complex'
    },
    {
        name: 'inherit-statement',
        description: '继承语句格式化',
        input: `inherit"/lib/base";
inherit"/lib/combat";
inherit"/lib/skills";`,
        shouldFormat: true,
        category: 'complex'
    }
];

/**
 * 边界情况测试用例
 */
export const EDGE_CASE_TEST_CASES: TestCase[] = [
    {
        name: 'empty-file',
        description: '空文件格式化',
        input: '',
        shouldFormat: false,
        category: 'edge-case'
    },
    {
        name: 'only-comments',
        description: '只包含注释的文件',
        input: `// This is a comment\n/* This is a block comment */\n// Another comment`,
        shouldFormat: true,
        category: 'edge-case'
    },
    {
        name: 'malformed-syntax',
        description: '语法错误的代码',
        input: `int func({missing_paren\nreturn;\n}`,
        shouldFormat: false,
        category: 'edge-case'
    },
    {
        name: 'very-long-line',
        description: '超长行格式化',
        input: `int very_long_function_name_that_exceeds_normal_line_length(string very_long_parameter_name_1, int very_long_parameter_name_2, mapping very_long_parameter_name_3, object very_long_parameter_name_4) { return very_long_calculation_expression_that_should_be_wrapped_properly(very_long_parameter_name_1, very_long_parameter_name_2, very_long_parameter_name_3, very_long_parameter_name_4); }`,
        shouldFormat: true,
        category: 'edge-case'
    },
    {
        name: 'string-with-escaped-quotes',
        description: '包含转义引号的字符串',
        input: `string message = "He said: \"Hello, world!\"";\nstring path = "C:\\\\path\\\\to\\\\file";`,
        shouldFormat: true,
        category: 'edge-case'
    },
    {
        name: 'mixed-indentation',
        description: '混合缩进风格',
        input: `void test() {\n\tif (condition) {\n        print("mixed");\n\t\t    return;\n    }\n}`,
        shouldFormat: true,
        category: 'edge-case'
    }
];

/**
 * 真实世界代码测试用例
 */
export const REAL_WORLD_TEST_CASES: TestCase[] = [
    {
        name: 'npc-class',
        description: 'NPC类定义',
        input: `// NPC base class\ninherit "/lib/character";\n\nvoid create(){::create();set_name("npc");set_id(({"npc"}));set_race("human");set_class("warrior");set_level(1);set_max_hp(100);set_hp(100);set_skill("dodge",50);set_skill("parry",40);}\n\nvoid init(){add_action("kill","do_kill");add_action("look","do_look");}\n\nint do_kill(string str){object target=present(str,environment(this_object()));if(!target){tell_object(this_object(),"Kill who?");return 1;}if(target==this_object()){tell_object(this_object(),"You can't kill yourself!");return 1;}return 0;}`,
        shouldFormat: true,
        category: 'real-world'
    },
    {
        name: 'room-class',
        description: '房间类定义',
        input: `inherit"/lib/room";void create(){::create();set_short("a training room");set_long("This is a spacious training room with wooden floors and mirrored walls. "+"Various training equipment is scattered around the room.");set_property("light",2);set_property("no clean",1);set_items((["floor":"The wooden floor is polished smooth.","walls":"The walls are covered with mirrors.","equipment":"Training dummies, weights, and practice weapons.",]));set_exits((["north":"/domains/town/rooms/courtyard","south":"/domains/town/rooms/armory",]));set_inventory((["training_dummy":1,"wooden_sword":3,"practice_shield":2,]));}`,
        shouldFormat: true,
        category: 'real-world'
    },
    {
        name: 'combat-system',
        description: '战斗系统代码',
        input: `int calculate_damage(object attacker,object defender,object weapon){int base_damage=weapon->query_property("damage");int strength_bonus=attacker->query_skill("strength")/10;int armor_reduction=defender->query_property("armor")/5;int final_damage=base_damage+strength_bonus-armor_reduction;if(random(100)<attacker->query_skill("critical")){final_damage*=2;tell_object(attacker,"Critical hit!");tell_object(defender,"You suffer a critical hit!");}if(final_damage<1)final_damage=1;return final_damage;}`,
        shouldFormat: true,
        category: 'real-world'
    },
    {
        name: 'quest-system',
        description: '任务系统代码',
        input: `mapping quest_data=(["gather_herbs":(["name":"Gather Healing Herbs","description":"The village healer needs 10 healing herbs from the forest.","type":"collection","requirements":(["item":"healing_herb","quantity":10,]),"rewards":(["experience":100,"gold":50,"items":(["health_potion":2,]),]),"status":"available",]),"kill_wolves":(["name":"Eliminate Wolf Pack","description":"A pack of wolves is threatening the village livestock.","type":"elimination","requirements":(["target":"wolf","quantity":5,]),"rewards":(["experience":200,"gold":100,]),"status":"available",]),]);`,
        shouldFormat: true,
        category: 'real-world'
    },
    {
        name: 'macro-definitions',
        description: '宏定义和预处理指令',
        input: `#include <lib.h>\n#include <damage.h>\n#define MAX_LEVEL 100\n#define DEFAULT_HP 50\n#define SKILL_BONUS(skill) ((skill)/10)\n#define COMBAT_ROUND() (2+random(3))\n#ifdef DEBUG\n#define LOG(msg) write("DEBUG: "+msg+"\\n")\n#else\n#define LOG(msg)\n#endif`,
        shouldFormat: true,
        category: 'real-world'
    }
];

/**
 * 所有测试用例的集合
 */
export const ALL_TEST_CASES: TestCase[] = [
    ...BASIC_TEST_CASES,
    ...COMPLEX_TEST_CASES,
    ...EDGE_CASE_TEST_CASES,
    ...REAL_WORLD_TEST_CASES
];

/**
 * 根据类别获取测试用例
 */
export function getTestCasesByCategory(category: TestCase['category']): TestCase[] {
    return ALL_TEST_CASES.filter(testCase => testCase.category === category);
}

/**
 * 根据名称获取测试用例
 */
export function getTestCaseByName(name: string): TestCase | undefined {
    return ALL_TEST_CASES.find(testCase => testCase.name === name);
}

/**
 * 获取所有应该进行格式化的测试用例
 */
export function getFormattableTestCases(): TestCase[] {
    return ALL_TEST_CASES.filter(testCase => testCase.shouldFormat);
}

/**
 * 获取所有不应该进行格式化的测试用例（用于测试错误处理）
 */
export function getNonFormattableTestCases(): TestCase[] {
    return ALL_TEST_CASES.filter(testCase => !testCase.shouldFormat);
}
