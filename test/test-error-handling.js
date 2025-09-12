/**
 * 测试格式化程序的错误处理机制
 * 验证各种边界情况和错误情况下的行为
 */

const fs = require('fs');
const path = require('path');

function testErrorHandling() {
    console.log('LPC 格式化程序错误处理测试');
    console.log('==========================\n');

    // 测试场景 1: 文件大小限制
    console.log('测试 1: 文件大小限制处理');
    console.log('-'.repeat(30));
    
    const maxFileSize = 1000000; // 1MB 默认限制
    const testFile = path.join(__dirname, 'yifeng-jian.c');
    
    if (fs.existsSync(testFile)) {
        const fileStats = fs.statSync(testFile);
        const fileSize = fileStats.size;
        
        console.log(`测试文件大小: ${fileSize} 字节`);
        console.log(`默认大小限制: ${maxFileSize} 字节`);
        console.log(`是否超过限制: ${fileSize > maxFileSize ? '是' : '否'}`);
        
        if (fileSize > maxFileSize) {
            console.log('预期行为: 跳过格式化，返回警告诊断');
        } else {
            console.log('预期行为: 正常处理格式化');
        }
    }
    
    console.log('');

    // 测试场景 2: 语法错误处理
    console.log('测试 2: 语法错误处理');
    console.log('-'.repeat(25));
    
    const syntaxErrorCases = [
        {
            name: '未闭合的大括号',
            content: `
int test_function() {
    int x = 1;
    if (x > 0) {
        return x;
    // 缺少闭合大括号
`
        },
        {
            name: '未闭合的字符串',
            content: `
string test = "这是一个未闭合的字符串
int x = 1;
`
        },
        {
            name: '语法错误的 mapping',
            content: `
mapping test = ([
    "key1" "value1", // 缺少冒号
    "key2": value2,  // value2 应该是字符串
]);
`
        },
        {
            name: '函数参数语法错误',
            content: `
int test_function(int a, string b,) { // 多余的逗号
    return a;
}
`
        }
    ];
    
    syntaxErrorCases.forEach((testCase, index) => {
        console.log(`  案例 ${index + 1}: ${testCase.name}`);
        console.log(`  代码片段:`);
        testCase.content.trim().split('\n').forEach((line, lineIndex) => {
            console.log(`    ${lineIndex + 1}: ${line}`);
        });
        
        // 模拟解析错误检测
        const syntaxErrors = detectSyntaxErrors(testCase.content);
        console.log(`  检测到的语法问题: ${syntaxErrors.length} 个`);
        
        syntaxErrors.forEach((error, errorIndex) => {
            console.log(`    ${errorIndex + 1}. 行 ${error.line}: ${error.message}`);
        });
        
        if (syntaxErrors.length > 10) {
            console.log(`  预期行为: 跳过格式化（错误过多）`);
        } else if (syntaxErrors.length > 0) {
            console.log(`  预期行为: 尝试格式化，但可能效果有限`);
        }
        
        console.log('');
    });

    // 测试场景 3: 格式化访问者错误
    console.log('测试 3: 格式化访问者错误处理');
    console.log('-'.repeat(35));
    
    const visitorErrorCases = [
        {
            name: '节点访问限制',
            description: '超过最大节点访问数量 (10000)',
            scenario: '深度嵌套的代码结构或递归问题'
        },
        {
            name: '未实现的语法结构',
            description: '访问者缺少特定语法的处理方法',
            scenario: '新的 LPC 语法特性或不常见的语法结构'
        },
        {
            name: '空指针或无效上下文',
            description: 'AST 节点为空或包含无效数据',
            scenario: '解析器返回的不完整或损坏的 AST'
        }
    ];
    
    visitorErrorCases.forEach((errorCase, index) => {
        console.log(`  案例 ${index + 1}: ${errorCase.name}`);
        console.log(`  描述: ${errorCase.description}`);
        console.log(`  场景: ${errorCase.scenario}`);
        console.log(`  预期行为: 记录错误，继续处理其他部分`);
        console.log('');
    });

    // 测试场景 4: 缓存错误处理
    console.log('测试 4: 缓存机制错误处理');
    console.log('-'.repeat(30));
    
    console.log('缓存错误场景:');
    console.log('- 内存不足时的缓存清理');
    console.log('- 缓存大小超过限制时的处理');
    console.log('- 缓存哈希冲突的处理');
    console.log('预期行为: 优雅降级，不影响格式化功能');
    console.log('');

    // 测试场景 5: 性能限制和超时
    console.log('测试 5: 性能限制和超时处理');
    console.log('-'.repeat(32));
    
    console.log('性能相关错误:');
    console.log('- 格式化时间过长（超过合理限制）');
    console.log('- 内存使用过高');
    console.log('- CPU 占用过高');
    console.log('预期行为: 中断格式化，返回原始文本');
    console.log('');

    // 分析实际测试文件的潜在错误
    console.log('测试 6: 实际文件的错误处理分析');
    console.log('-'.repeat(37));
    
    if (fs.existsSync(testFile)) {
        const content = fs.readFileSync(testFile, 'utf8');
        const lines = content.split('\n');
        
        console.log(`文件统计:`);
        console.log(`- 总行数: ${lines.length}`);
        console.log(`- 总字符数: ${content.length}`);
        
        // 检查潜在的解析问题
        const potentialIssues = analyzePotentialParsingIssues(lines);
        console.log(`- 潜在解析问题: ${potentialIssues.length} 个`);
        
        potentialIssues.slice(0, 5).forEach((issue, index) => {
            console.log(`  ${index + 1}. 行 ${issue.line}: ${issue.description}`);
        });
        
        if (potentialIssues.length > 5) {
            console.log(`  ... 还有 ${potentialIssues.length - 5} 个其他问题`);
        }
        
        // 估算格式化复杂度
        const complexity = estimateFormattingComplexity(lines);
        console.log(`\n格式化复杂度评估:`);
        console.log(`- 嵌套级别: ${complexity.nestingLevel}`);
        console.log(`- Mapping 字面量数量: ${complexity.mappingLiterals}`);
        console.log(`- 函数定义数量: ${complexity.functionDefinitions}`);
        console.log(`- 复杂表达式数量: ${complexity.complexExpressions}`);
        console.log(`- 总体复杂度: ${complexity.overall}`);
        
        if (complexity.overall > 100) {
            console.log(`警告: 文件复杂度较高，格式化可能耗时较长`);
        }
    }
    
    console.log('');

    // 错误恢复策略总结
    console.log('错误恢复策略总结');
    console.log('================');
    console.log('1. 文件过大: 跳过格式化，显示警告');
    console.log('2. 语法错误过多 (>10): 跳过格式化，保持原文本');
    console.log('3. 格式化错误过多 (>5): 不缓存结果，但返回格式化内容');
    console.log('4. 节点访问限制: 终止递归，记录错误');
    console.log('5. 解析失败: 返回原文本和诊断信息');
    console.log('6. 异常捕获: 记录错误，返回原文本');
    console.log('');
    
    console.log('建议的改进:');
    console.log('1. 添加格式化超时机制');
    console.log('2. 实现增量格式化以提高性能');
    console.log('3. 增加更详细的错误分类和报告');
    console.log('4. 支持部分格式化（跳过有问题的部分）');
}

function detectSyntaxErrors(content) {
    const errors = [];
    const lines = content.split('\n');
    
    let braceStack = [];
    let stringState = false;
    
    lines.forEach((line, lineIndex) => {
        const lineNum = lineIndex + 1;
        
        // 简单的大括号检查
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"' && !stringState) {
                stringState = true;
            } else if (char === '"' && stringState) {
                // 检查是否是转义的引号
                if (i === 0 || line[i-1] !== '\\') {
                    stringState = false;
                }
            }
            
            if (!stringState) {
                if (char === '{') {
                    braceStack.push({ type: 'brace', line: lineNum, char: i });
                } else if (char === '}') {
                    if (braceStack.length === 0 || braceStack[braceStack.length - 1].type !== 'brace') {
                        errors.push({
                            line: lineNum,
                            message: '多余的闭合大括号'
                        });
                    } else {
                        braceStack.pop();
                    }
                }
            }
        }
        
        // 检查行末的字符串状态
        if (stringState && !line.endsWith('\\')) {
            // 可能的未闭合字符串
            if (!line.includes('"', line.lastIndexOf('"') + 1)) {
                errors.push({
                    line: lineNum,
                    message: '可能的未闭合字符串'
                });
            }
        }
        
        // 重置字符串状态（简单的单行处理）
        stringState = false;
        
        // 检查语法模式
        if (line.includes(':') && !line.includes('"')) {
            // mapping 中的键值对应该在引号内或是标识符
            const colonIndex = line.indexOf(':');
            const beforeColon = line.substring(0, colonIndex).trim();
            if (beforeColon && !beforeColon.match(/^["'].*["']$|^[a-zA-Z_]\w*$/)) {
                errors.push({
                    line: lineNum,
                    message: 'mapping 键的语法可能有误'
                });
            }
        }
    });
    
    // 检查未闭合的大括号
    if (braceStack.length > 0) {
        braceStack.forEach(brace => {
            errors.push({
                line: brace.line,
                message: `未闭合的${brace.type === 'brace' ? '大括号' : '括号'}`
            });
        });
    }
    
    return errors;
}

function analyzePotentialParsingIssues(lines) {
    const issues = [];
    
    lines.forEach((line, index) => {
        const lineNum = index + 1;
        
        // 检查异常的字符组合
        if (line.match(/[^\\]"[^"]*$/) && !line.includes('\\n')) {
            issues.push({
                line: lineNum,
                description: '可能的未闭合字符串'
            });
        }
        
        // 检查异常的运算符组合
        if (line.match(/[=!<>]{3,}/)) {
            issues.push({
                line: lineNum,
                description: '异常的运算符序列'
            });
        }
        
        // 检查不平衡的括号
        const openParens = (line.match(/\(/g) || []).length;
        const closeParens = (line.match(/\)/g) || []).length;
        const openBrackets = (line.match(/\[/g) || []).length;
        const closeBrackets = (line.match(/\]/g) || []).length;
        
        if (openParens !== closeParens) {
            issues.push({
                line: lineNum,
                description: `小括号不平衡 (${openParens} 开, ${closeParens} 闭)`
            });
        }
        
        if (openBrackets !== closeBrackets) {
            issues.push({
                line: lineNum,
                description: `方括号不平衡 (${openBrackets} 开, ${closeBrackets} 闭)`
            });
        }
        
        // 检查可疑的控制字符
        if (line.match(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/)) {
            issues.push({
                line: lineNum,
                description: '包含可疑的控制字符'
            });
        }
    });
    
    return issues;
}

function estimateFormattingComplexity(lines) {
    let nestingLevel = 0;
    let maxNesting = 0;
    let mappingLiterals = 0;
    let functionDefinitions = 0;
    let complexExpressions = 0;
    
    lines.forEach(line => {
        // 计算嵌套级别
        const openBraces = (line.match(/\{/g) || []).length;
        const closeBraces = (line.match(/\}/g) || []).length;
        nestingLevel += openBraces - closeBraces;
        maxNesting = Math.max(maxNesting, nestingLevel);
        
        // 统计 mapping 字面量
        if (line.includes('([') || line.includes('mapping')) {
            mappingLiterals++;
        }
        
        // 统计函数定义
        if (line.match(/^\s*\w+\s+\w+\s*\([^)]*\)\s*\{?/)) {
            functionDefinitions++;
        }
        
        // 统计复杂表达式
        const operators = (line.match(/[+\-*/=!<>&|]+/g) || []).length;
        if (operators > 3) {
            complexExpressions++;
        }
    });
    
    const overall = maxNesting * 10 + mappingLiterals * 5 + 
                   functionDefinitions * 2 + complexExpressions;
    
    return {
        nestingLevel: maxNesting,
        mappingLiterals,
        functionDefinitions,
        complexExpressions,
        overall
    };
}

// 运行测试
testErrorHandling();