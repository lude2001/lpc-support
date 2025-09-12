const fs = require('fs');

// 读取实际的测试文件
const testFilePath = '/mnt/b/lpc_linter/lpc-support/test/yifeng-jian.c';
const testContent = fs.readFileSync(testFilePath, 'utf-8');

console.log('=== LPC 代码格式化问题分析 ===');
console.log(`测试文件: ${testFilePath}`);
console.log(`文件大小: ${testContent.length} 字符`);

const lines = testContent.split('\n');
console.log(`总行数: ${lines.length} 行`);

console.log('\n=== 逐行问题检测 ===');

const issues = [];

lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmedLine = line.trim();
    const leadingSpaces = line.length - line.trimLeft().length;
    
    // 跳过空行
    if (trimmedLine === '') return;
    
    // 1. 缩进问题检测
    if (leadingSpaces > 0 && leadingSpaces % 4 !== 0 && leadingSpaces % 8 !== 0) {
        issues.push({
            line: lineNum,
            type: '缩进不规范',
            severity: 'warning',
            details: `当前缩进 ${leadingSpaces} 个空格，不是4的倍数`,
            content: line.substring(0, 60) + (line.length > 60 ? '...' : '')
        });
    }
    
    // 2. 字符串语法错误
    if (line.includes('"NOR,')) {
        issues.push({
            line: lineNum,
            type: '字符串语法错误',
            severity: 'error',
            details: '字符串结尾缺失引号: "NOR, → "NOR",',
            content: trimmedLine
        });
    }
    
    if (line.match(/:\s*HIM"/)) {
        issues.push({
            line: lineNum,
            type: '字符串语法错误',
            severity: 'error', 
            details: '字符串开头缺失引号: HIM" → "HIM"',
            content: trimmedLine
        });
    }
    
    // 3. 运算符空格问题
    if (line.match(/\w<\d/) || line.includes('jian)<')) {
        issues.push({
            line: lineNum,
            type: '运算符格式',
            severity: 'style',
            details: '小于号前后缺少空格',
            content: trimmedLine
        });
    }
    
    if (line.includes('!="') && !line.includes(' != "')) {
        issues.push({
            line: lineNum,
            type: '运算符格式',
            severity: 'style', 
            details: '不等于运算符周围缺少空格',
            content: trimmedLine
        });
    }
    
    // 4. mapping 条目格式问题
    if (line.includes('([') && leadingSpaces === 2) {
        issues.push({
            line: lineNum,
            type: 'mapping格式',
            severity: 'style',
            details: 'mapping条目缩进应该是4个空格的倍数',
            content: line.substring(0, 50) + '...'
        });
    }
    
    // 5. 键值对格式问题
    if (line.includes('":"') && !line.includes('": "') && !line.includes('" : "')) {
        issues.push({
            line: lineNum,
            type: '键值对格式',
            severity: 'style',
            details: '冒号后建议添加空格以提高可读性',
            content: trimmedLine.substring(0, 80) + '...'
        });
    }
    
    // 6. 缩进级别异常检测（特定行）
    if (line.includes('"lvl"') && leadingSpaces === 5) {
        issues.push({
            line: lineNum,
            type: '缩进异常',
            severity: 'warning',
            details: '该行缩进5个空格，应该对齐到4或8个空格',
            content: trimmedLine
        });
    }
});

// 按严重程度分类
const errorIssues = issues.filter(i => i.severity === 'error');
const warningIssues = issues.filter(i => i.severity === 'warning');
const styleIssues = issues.filter(i => i.severity === 'style');

console.log(`\n🚫 语法错误 (${errorIssues.length} 个):`);
errorIssues.forEach(issue => {
    console.log(`  行 ${issue.line}: ${issue.details}`);
    console.log(`    问题: ${issue.content}`);
    console.log('');
});

console.log(`⚠️  缩进/格式警告 (${warningIssues.length} 个):`);
warningIssues.slice(0, 8).forEach(issue => {
    console.log(`  行 ${issue.line}: ${issue.details}`);
});
if (warningIssues.length > 8) {
    console.log(`    ... 还有 ${warningIssues.length - 8} 个类似问题`);
}

console.log(`\n📝 代码风格建议 (${styleIssues.length} 个):`);
styleIssues.slice(0, 10).forEach(issue => {
    console.log(`  行 ${issue.line}: ${issue.details}`);
});
if (styleIssues.length > 10) {
    console.log(`    ... 还有 ${styleIssues.length - 10} 个类似问题`);
}

// 显示几个具体的问题行
console.log('\n=== 关键问题行示例 ===');

const problemLines = [50, 59, 68, 84];
problemLines.forEach(num => {
    if (num <= lines.length) {
        const line = lines[num - 1];
        console.log(`行 ${num}:`);
        console.log(`  原始: "${line}"`);
        
        // 简单的修复建议
        let fixed = line;
        if (line.includes('"NOR,')) {
            fixed = fixed.replace('"NOR,', '"NOR",');
        }
        if (line.match(/:\s*HIM"/)) {
            fixed = fixed.replace(/:\s*HIM"/, ': "HIM"');
        }
        if (line.includes('jian)<')) {
            fixed = fixed.replace('jian)<', 'jian") <');
        }
        if (line.includes('!="')) {
            fixed = fixed.replace('!="', ' != "');
        }
        
        if (fixed !== line) {
            console.log(`  建议: "${fixed}"`);
        }
        console.log('');
    }
});

console.log('=== 格式化器预期改进 ===');

console.log(`
📊 问题统计:
- 语法错误: ${errorIssues.length} 个 (需要修复)
- 缩进问题: ${warningIssues.length} 个 (影响可读性)  
- 格式建议: ${styleIssues.length} 个 (代码美化)

🔧 主要改进点:
1. 修复字符串语法错误 (特别是引号缺失)
2. 统一缩进风格为4个空格
3. 规范运算符周围的空格
4. 整理mapping数组的对齐和格式
5. 标准化键值对的格式

📈 格式化后预期效果:
- 代码结构更清晰
- 语法错误得到修复
- 缩进完全一致
- 可读性显著提升
- 符合LPC编码规范
`);

console.log('\n=== 测试格式化功能 ===');
console.log(`
要测试格式化功能的实际效果:

1. 打开VS Code
2. 加载文件: ${testFilePath}
3. 使用格式化快捷键: Shift+Alt+F
4. 对比改进效果

关键验证点:
✓ 行 50, 59, 68 的字符串语法错误已修复
✓ 所有缩进都是4的倍数
✓ mapping数组结构清晰对齐
✓ 运算符空格规范一致
✓ 文件结尾有换行符

如果格式化器工作正常，这些问题都应该被自动修复。
`);

console.log(`\n总计发现 ${issues.length} 个可改进的格式化问题。`);

module.exports = { issues, errorIssues, warningIssues, styleIssues };