const fs = require('fs');
const path = require('path');

// 简单的格式化测试
function testFormatter() {
    try {
        // 读取测试文件
        const testFilePath = path.join(__dirname, 'test', 'yifeng-jian.c');
        const content = fs.readFileSync(testFilePath, 'utf8');
        
        console.log('=== 原始文件内容 ===');
        console.log(content.substring(0, 1000) + '...');
        
        // 由于无法直接调用TypeScript模块，我们进行基本的缩进分析
        const lines = content.split('\n');
        let indentAnalysis = {
            inconsistentIndent: [],
            wrongIndent: [],
            totalLines: lines.length
        };
        
        console.log('\n=== 缩进分析 ===');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim() === '') continue;
            
            const leadingSpaces = line.match(/^(\s*)/)[1];
            const spaceCount = leadingSpaces.length;
            
            // 检查是否使用了非4的倍数的缩进
            if (spaceCount % 4 !== 0 && spaceCount > 0) {
                indentAnalysis.inconsistentIndent.push({
                    line: i + 1,
                    content: line.trim(),
                    spaces: spaceCount
                });
            }
        }
        
        console.log(`总行数: ${indentAnalysis.totalLines}`);
        console.log(`不规范缩进: ${indentAnalysis.inconsistentIndent.length} 行`);
        
        if (indentAnalysis.inconsistentIndent.length > 0) {
            console.log('\n=== 缩进问题详情 ===');
            indentAnalysis.inconsistentIndent.forEach(issue => {
                console.log(`第${issue.line}行: ${issue.spaces}个空格 - "${issue.content}"`);
            });
        }
        
        // 检查语法问题
        console.log('\n=== 语法问题检查 ===');
        const syntaxIssues = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // 检查不匹配的引号
            if (line.includes('"NOR,') && !line.includes('"NOR",')) {
                syntaxIssues.push(`第${i + 1}行: 缺少结束引号`);
            }
            
            // 检查缺少引号的字符串
            if (line.includes(':HIM"') || line.includes(':HIY"') || line.includes(':HIG"')) {
                syntaxIssues.push(`第${i + 1}行: 字符串缺少开始引号`);
            }
        }
        
        if (syntaxIssues.length > 0) {
            syntaxIssues.forEach(issue => console.log(issue));
        } else {
            console.log('未发现明显的语法问题');
        }
        
    } catch (error) {
        console.error('测试格式化器时出错:', error.message);
    }
}

testFormatter();