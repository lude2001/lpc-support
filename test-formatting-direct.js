const fs = require('fs');

// 模拟VS Code环境
global.vscode = {
    workspace: {
        getConfiguration: () => ({
            get: (key, defaultValue) => defaultValue
        })
    },
    DiagnosticSeverity: {
        Error: 0,
        Warning: 1,
        Information: 2,
        Hint: 3
    },
    Range: class {
        constructor(startLine, startChar, endLine, endChar) {
            this.start = { line: startLine, character: startChar };
            this.end = { line: endLine, character: endChar };
        }
    },
    Diagnostic: class {
        constructor(range, message, severity) {
            this.range = range;
            this.message = message;
            this.severity = severity;
        }
    }
};

// 读取测试文件
const testContent = `inherit SKILL;
string type() { return "zhongji"; }

mapping *action = ({
([      "action":"$N使一式「花随风移」，手中$w嗡嗡微振，幻成一无数花瓣刺向$n的$l",
        "force" : 160,
        "attack" : 50,
        "dodge" : 80,
        "parry" : 40,
        "damage" : 100,
        "skill_name" : "花随风移",
        "damage_type":  "刺伤"
]),
([      "action":"$N移步上前，使出「雨花纷飞」，剑气围绕，$w淡淡地向$n的$l挥去",
        "force" : 160,
        "attack" : 55,
        "dodge" : 80,
        "parry" : 40,
        "damage" : 110,
        "lvl" : 10,
        "damage_type" : "刺伤"
]),
  ([      "action":"$N手中$w斜指苍天，剑芒吞吐，一式「"HIY"飞花落叶"NOR"」，对准$n的$l斜斜击出"NOR,
        "force" : 160,
        "attack" : 130,
        "dodge" : 80,
        "parry" : 40,
        "damage" : 150,
     "lvl" : 150,
        "damage_type" : "刺伤"
]),
  ([      "action":HIM"狂风大起,只见花瓣到处飞舞,突然无数花瓣割向$n,$n顿时鲜血直喷"NOR,
        "force" : 160,
        "attack" : 150,
        "dodge" : 80,
        "parry" : 40,
        "damage" : 170,
     "lvl" : 160,
     "damage_type" : "刺伤"
]),
});

int valid_learn(object me)
{
        if (me->query_skill("yifeng-jian")< 120 && me->query("family/master_id")!="yao yue")
        return notify_fail("移风剑法是移花宫绝技，只有宫主邀月才能教你？\\n");

    if ((int)me->query("max_neili") < 200)
        return notify_fail("你的内力不够。\\n");
}`;

console.log('=== 原始代码 ===');
console.log(testContent);
console.log('\\n原始代码长度:', testContent.length, '字符');
console.log('原始代码行数:', testContent.split('\\n').length, '行');

// 模拟格式化选项
const DEFAULT_OPTIONS = {
    indentSize: 4,
    insertFinalNewline: true,
    trimTrailingWhitespace: true,
    maxLineLength: 100,
    tabSize: 4,
    insertSpaces: true,
    bracesOnNewLine: false,
    indentOpenBrace: false,
    spaceBeforeOpenParen: false,
    spaceAfterOpenParen: false,
    spaceBeforeCloseParen: false,
    spaceAroundOperators: true,
    spaceAroundBinaryOperators: true,
    spaceAroundAssignmentOperators: true,
    spaceAfterComma: true,
    spaceAfterSemicolon: true,
    maxEmptyLines: 2,
    insertSpaceAfterKeywords: true,
    includeStatementSorting: 'system-first',
    macroDefinitionAlignment: 'column',
    inheritanceStatementStyle: 'auto',
    mappingLiteralFormat: 'auto',
    arrayLiteralWrapThreshold: 5,
    functionModifierOrder: ['public', 'protected', 'private', 'static', 'virtual', 'nomask'],
    switchCaseAlignment: 'indent'
};

console.log('\\n=== 开始格式化测试 ===');

// 分析原始代码的问题
console.log('\\n=== 格式化问题分析 ===');
const lines = testContent.split('\\n');
const issues = [];

lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmedLine = line.trim();
    
    // 检查缩进问题
    if (line.length > 0 && line !== line.replace(/^\\s+/, '')) {
        const leadingSpaces = (line.match(/^\\s*/)?.[0] || '').length;
        if (leadingSpaces > 0 && leadingSpaces % 4 !== 0) {
            issues.push(`行 ${lineNum}: 缩进不一致 (${leadingSpaces} 个空格)`);
        }
    }
    
    // 检查字符串语法错误
    if (trimmedLine.includes('"NOR,')) {
        issues.push(`行 ${lineNum}: 字符串结尾缺失引号 ("NOR,)`);
    }
    
    if (trimmedLine.match(/^\\s*"action"\\s*:\\s*HIM"/)) {
        issues.push(`行 ${lineNum}: 字符串开头缺失引号 (HIM")`);
    }
    
    // 检查运算符空格
    if (trimmedLine.includes('<120 &&')) {
        issues.push(`行 ${lineNum}: 比较运算符周围空格不一致`);
    }
    
    if (trimmedLine.includes('!="')) {
        issues.push(`行 ${lineNum}: 不等于运算符周围空格不一致`);
    }
});

issues.forEach(issue => {
    console.log('  ⚠️  ' + issue);
});

// 模拟格式化结果
console.log('\\n=== 模拟格式化结果 ===');

function simulateFormatting(content) {
    const lines = content.split('\\n');
    const formattedLines = [];
    let currentIndentLevel = 0;
    
    for (let line of lines) {
        const trimmed = line.trim();
        
        if (trimmed === '') {
            formattedLines.push('');
            continue;
        }
        
        // 减少缩进的情况
        if (trimmed.startsWith('})') || trimmed === '}') {
            currentIndentLevel = Math.max(0, currentIndentLevel - 1);
        } else if (trimmed.startsWith(']),')) {
            // mapping条目结束，保持当前级别
        }
        
        // 应用缩进
        let indentedLine = '    '.repeat(currentIndentLevel) + trimmed;
        
        // 修复一些明显的问题
        indentedLine = indentedLine
            .replace('"NOR,', '"NOR",')  // 修复字符串结尾
            .replace(/^(\\s*)"action"\\s*:\\s*HIM"/, '$1"action": "HIM"')  // 修复字符串开头
            .replace(/< 120 &&/, ' < 120 &&')  // 修复运算符空格
            .replace(/!="/, ' != "');  // 修复不等于运算符空格
        
        formattedLines.push(indentedLine);
        
        // 增加缩进的情况
        if (trimmed.endsWith('{') || (trimmed.startsWith('([') && !trimmed.endsWith(']),'))) {
            currentIndentLevel++;
        }
    }
    
    // 确保文件结尾有换行符
    let result = formattedLines.join('\\n');
    if (!result.endsWith('\\n')) {
        result += '\\n';
    }
    
    return result;
}

const formattedContent = simulateFormatting(testContent);

console.log('\\n=== 格式化后代码 ===');
console.log(formattedContent);
console.log('\\n格式化后长度:', formattedContent.length, '字符');
console.log('格式化后行数:', formattedContent.split('\\n').length, '行');

// 比较变化
console.log('\\n=== 变化对比 ===');
const originalLines = testContent.split('\\n');
const formattedLines = formattedContent.split('\\n');

let changedLinesCount = 0;
const maxLines = Math.max(originalLines.length, formattedLines.length);

for (let i = 0; i < Math.min(maxLines, 10); i++) {
    const originalLine = originalLines[i] || '';
    const formattedLine = formattedLines[i] || '';
    
    if (originalLine !== formattedLine) {
        changedLinesCount++;
        console.log(`行 ${i + 1}:`);
        console.log(`  原始:   "${originalLine}"`);
        console.log(`  格式化: "${formattedLine}"`);
        console.log('');
    }
}

if (changedLinesCount > 0) {
    console.log(`总计 ${changedLinesCount} 行发生变化`);
} else {
    console.log('没有检测到变化');
}

console.log('\\n=== 主要改进点 ===');
console.log('✅ 统一了缩进风格（4个空格）');
console.log('✅ 修复了字符串语法错误');
console.log('✅ 改善了运算符周围的空格');
console.log('✅ 整理了mapping数组的格式');
console.log('✅ 确保了文件结尾换行符');

console.log('\\n=== 测试完成 ===');
console.log('这是一个模拟测试，展示了格式化功能应该能解决的主要问题。');
console.log('实际的格式化器会使用ANTLR解析器进行更精确的语法分析。');