const fs = require('fs');

// 读取实际的测试文件
const testFilePath = '/mnt/b/lpc_linter/lpc-support/test/yifeng-jian.c';
const testContent = fs.readFileSync(testFilePath, 'utf-8');

console.log('=== LPC代码格式化测试报告 ===');
console.log(`测试文件: ${testFilePath}`);
console.log(`原始代码长度: ${testContent.length} 字符`);
console.log(`原始代码行数: ${testContent.split('\\n').length} 行`);

console.log('\\n=== 检测到的格式化问题 ===');

const lines = testContent.split('\\n');
const issues = [];
let mappingStartLine = -1;
let mappingEndLine = -1;

lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmedLine = line.trim();
    const leadingSpaces = line.length - line.trimLeft().length;
    
    // 检测mapping数组区域
    if (trimmedLine.includes('mapping *action = ({')) {
        mappingStartLine = lineNum;
    }
    if (mappingStartLine > 0 && trimmedLine === '});') {
        mappingEndLine = lineNum;
    }
    
    // 1. 缩进一致性问题
    if (line.trim() !== '' && leadingSpaces > 0) {
        if (leadingSpaces % 4 !== 0 && leadingSpaces % 8 !== 0) {
            issues.push({
                type: '缩进不一致',
                line: lineNum,
                issue: `当前缩进${leadingSpaces}个空格，不是4的倍数`,
                severity: 'warning',
                content: line.substring(0, 50) + (line.length > 50 ? '...' : '')
            });
        }
    }
    
    // 2. 字符串语法错误
    if (trimmedLine.includes('"NOR,')) {
        issues.push({
            type: '字符串语法错误',
            line: lineNum,
            issue: '字符串结尾缺失引号，"NOR, 应该是 "NOR",',
            severity: 'error',
            content: trimmedLine
        });
    }
    
    if (trimmedLine.match(/^"action"\s*:\s*HIM"/)) {
        issues.push({
            type: '字符串语法错误', 
            line: lineNum,
            issue: '字符串开头缺失引号，HIM" 应该是 "HIM"',
            severity: 'error',
            content: trimmedLine
        });
    }
    
    // 3. 运算符空格问题
    if (trimmedLine.match(/\w<\s*\d+/)) {
        issues.push({
            type: '运算符格式',
            line: lineNum,
            issue: '小于号前缺少空格',
            severity: 'style',
            content: trimmedLine
        });
    }
    
    if (trimmedLine.match(/!="\w+"/)) {
        issues.push({
            type: '运算符格式',
            line: lineNum,
            issue: '不等于运算符周围缺少空格',
            severity: 'style',
            content: trimmedLine
        });
    }
    
    // 4. 冒号空格问题
    if (trimmedLine.includes('":"') || trimmedLine.match(/"\w+":/)) {
        if (!trimmedLine.match(/": /) && !trimmedLine.match(/: "/) && !trimmedLine.includes(' : ')) {
            issues.push({
                type: '冒号格式',
                line: lineNum,
                issue: '冒号周围空格不规范',
                severity: 'style',
                content: trimmedLine
            });
        }
    }
    
    // 5. mapping条目缩进问题
    if (mappingStartLine > 0 && lineNum > mappingStartLine && lineNum < mappingEndLine) {
        if (trimmedLine.startsWith('([') && leadingSpaces === 0) {
            issues.push({
                type: 'mapping格式',
                line: lineNum,
                issue: 'mapping条目应该有适当的缩进',
                severity: 'style',
                content: line
            });
        }
        
        if (trimmedLine.startsWith('"') && leadingSpaces < 4) {
            issues.push({
                type: 'mapping格式',
                line: lineNum,
                issue: 'mapping键值对缩进不足',
                severity: 'style',
                content: line.substring(0, 40) + '...'
            });
        }
    }
    
    // 6. 函数定义括号问题  
    if (trimmedLine.match(/\w+\(/)) {
        const match = trimmedLine.match(/(\w+)\s*\(/);
        if (match && !match[0].includes(' (')) {
            // 这实际上是正确的，LPC函数调用不需要空格
        }
    }
});

// 按严重性分组显示问题
const errorIssues = issues.filter(i => i.severity === 'error');
const warningIssues = issues.filter(i => i.severity === 'warning'); 
const styleIssues = issues.filter(i => i.severity === 'style');

console.log(`\\n🚫 语法错误 (${errorIssues.length} 个):`);
errorIssues.forEach(issue => {
    console.log(`  行 ${issue.line}: ${issue.issue}`);
    console.log(`    内容: ${issue.content}`);
});

console.log(`\\n⚠️  缩进问题 (${warningIssues.length} 个):`);
warningIssues.slice(0, 5).forEach(issue => {  // 只显示前5个
    console.log(`  行 ${issue.line}: ${issue.issue}`);
});
if (warningIssues.length > 5) {
    console.log(`    ... 还有 ${warningIssues.length - 5} 个类似问题`);
}

console.log(`\\n📝 格式问题 (${styleIssues.length} 个):`);
styleIssues.slice(0, 8).forEach(issue => {  // 只显示前8个
    console.log(`  行 ${issue.line}: ${issue.issue}`);
    console.log(`    内容: ${issue.content}`);
});
if (styleIssues.length > 8) {
    console.log(`    ... 还有 ${styleIssues.length - 8} 个类似问题`);
}

console.log('\\n=== 格式化器应该解决的主要问题 ===');

console.log(`
1. 🔧 语法修复 (${errorIssues.length} 处):
   - 修复字符串引号缺失问题
   - 确保语法正确性
   
2. 📐 缩进标准化 (${warningIssues.length} 处):  
   - 统一使用4个空格缩进
   - 正确处理mapping数组的嵌套缩进
   - 函数体内部语句的缩进对齐
   
3. ✨ 代码美化 (${styleIssues.length} 处):
   - 运算符周围添加合适的空格
   - 冒号后的空格标准化  
   - mapping键值对的对齐
   - 清理多余的空行
`);

console.log('\\n=== 预期的格式化效果示例 ===');

// 展示几行修复前后的对比
console.log('\\n修复前的问题行:');
const problemLines = [
    { line: 50, content: '  ([      "action":"$N手中$w斜指苍天，剑芒吞吐，一式「"HIY"飞花落叶"NOR"」，对准$n的$l斜斜击出"NOR,' },
    { line: 68, content: '  ([      "action":HIM"狂风大起,只见花瓣到处飞舞,突然无数花瓣割向$n,$n顿时鲜血直喷"NOR,' },
    { line: 84, content: '        if (me->query_skill("yifeng-jian")< 120 && me->query("family/master_id")!="yao yue")' }
];

problemLines.forEach(p => {
    console.log(`  行 ${p.line}: ${p.content}`);
});

console.log('\\n预期修复后:');
console.log('  行 50:     ([');
console.log('          "action": "$N手中$w斜指苍天，剑芒吞吐，一式「"HIY"飞花落叶"NOR"」，对准$n的$l斜斜击出"NOR",');
console.log('  行 68:     ([');  
console.log('          "action": "HIM"狂风大起,只见花瓣到处飞舞,突然无数花瓣割向$n,$n顶时鲜血直喷"NOR",');
console.log('  行 84:     if (me->query_skill("yifeng-jian") < 120 && me->query("family/master_id") != "yao yue")');

console.log('\\n=== 测试建议 ===');
console.log(`
要验证格式化功能的效果，请:

1. 在VS Code中打开文件: ${testFilePath}
2. 使用格式化快捷键: Shift+Alt+F 或 Ctrl+Shift+I  
3. 检查以下关键改进:
   ✓ 所有缩进都是4的倍数
   ✓ 字符串语法错误已修复 (特别是行50, 68)
   ✓ 运算符周围有合适的空格
   ✓ mapping数组结构清晰对齐
   ✓ 文件末尾有换行符

预计格式化后代码行数可能会略有增加（由于mapping展开），
但整体可读性和维护性会显著提升。
`);

console.log('\\n=== 总结 ===');
console.log(`检测到 ${issues.length} 个格式化问题:`);
console.log(`- ${errorIssues.length} 个语法错误（必须修复）`);
console.log(`- ${warningIssues.length} 个缩进问题`);  
console.log(`- ${styleIssues.length} 个代码风格问题`);
console.log('\\n这些问题都在格式化器的处理范围内。');