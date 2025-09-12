/**
 * 测试范围格式化逻辑
 * 模拟 LPCFormatterImpl.formatRange 的核心逻辑
 */

const fs = require('fs');
const path = require('path');

const TEST_FILE = path.join(__dirname, 'yifeng-jian.c');

function testRangeFormatting() {
    console.log('LPC 范围格式化测试');
    console.log('===================\n');

    if (!fs.existsSync(TEST_FILE)) {
        console.error('测试文件不存在:', TEST_FILE);
        return;
    }

    const content = fs.readFileSync(TEST_FILE, 'utf8');
    const lines = content.split('\n');
    
    console.log(`文件总行数: ${lines.length}\n`);

    // 测试案例：格式化 mapping 数组部分
    const mappingStartLine = 3; // 0-based, mapping *action = ({ 行
    const mappingEndLine = 76;   // }); 行
    
    console.log('测试案例 1: Mapping 数组范围格式化');
    console.log('-'.repeat(40));
    console.log(`选择范围: 行 ${mappingStartLine + 1} 到 ${mappingEndLine + 1}`);
    
    // 模拟扩展范围逻辑
    const expandedRange = expandRangeToCompleteStatements(lines, mappingStartLine, mappingEndLine);
    console.log(`扩展后范围: 行 ${expandedRange.start + 1} 到 ${expandedRange.end + 1}`);
    
    const selectedLines = lines.slice(expandedRange.start, expandedRange.end + 1);
    console.log(`扩展选择的内容 (前3行和后3行):`);
    if (selectedLines.length > 6) {
        selectedLines.slice(0, 3).forEach((line, index) => {
            console.log(`${expandedRange.start + index + 1}: ${line}`);
        });
        console.log('  ... (省略中间部分) ...');
        selectedLines.slice(-3).forEach((line, index) => {
            const lineNum = expandedRange.end - 2 + index + 1;
            console.log(`${lineNum}: ${line}`);
        });
    } else {
        selectedLines.forEach((line, index) => {
            console.log(`${expandedRange.start + index + 1}: ${line}`);
        });
    }
    
    // 分析上下文缩进
    const contextIndent = getContextIndentLevel(lines, expandedRange.start);
    console.log(`\n上下文缩进级别: ${contextIndent} 个空格`);
    
    // 分析选择内容的格式化需求
    analyzeRangeFormattingNeeds(selectedLines);
    
    console.log('\n' + '='.repeat(50));
    
    // 测试案例 2: 单个函数格式化
    const functionStartLine = findFunctionStart(lines, 'valid_learn');
    if (functionStartLine !== -1) {
        const functionEndLine = findFunctionEnd(lines, functionStartLine);
        
        console.log(`\n测试案例 2: 函数范围格式化`);
        console.log('-'.repeat(35));
        console.log(`函数 valid_learn: 行 ${functionStartLine + 1} 到 ${functionEndLine + 1}`);
        
        const funcExpandedRange = expandRangeToCompleteStatements(lines, functionStartLine, functionEndLine);
        console.log(`扩展后范围: 行 ${funcExpandedRange.start + 1} 到 ${funcExpandedRange.end + 1}`);
        
        const funcLines = lines.slice(funcExpandedRange.start, funcExpandedRange.end + 1);
        console.log(`函数内容预览:`);
        funcLines.slice(0, Math.min(5, funcLines.length)).forEach((line, index) => {
            console.log(`${funcExpandedRange.start + index + 1}: ${line}`);
        });
        if (funcLines.length > 5) {
            console.log('  ... (省略部分内容) ...');
        }
        
        analyzeRangeFormattingNeeds(funcLines);
    }
    
    // 测试案例 3: 小范围选择
    console.log(`\n测试案例 3: 小范围表达式格式化`);
    console.log('-'.repeat(38));
    
    // 找一行包含复杂表达式的行
    const complexExprLine = findLineWithPattern(lines, /\s*".*":\s*\d+,?\s*$/);
    if (complexExprLine !== -1) {
        console.log(`选择行 ${complexExprLine + 1}: ${lines[complexExprLine]}`);
        
        const exprRange = expandRangeToCompleteStatements(lines, complexExprLine, complexExprLine);
        console.log(`扩展后范围: 行 ${exprRange.start + 1} 到 ${exprRange.end + 1}`);
        
        if (exprRange.end > exprRange.start) {
            console.log('扩展后的内容:');
            for (let i = exprRange.start; i <= exprRange.end; i++) {
                console.log(`${i + 1}: ${lines[i]}`);
            }
        }
    }
}

function expandRangeToCompleteStatements(lines, startLine, endLine) {
    let expandedStart = startLine;
    let expandedEnd = endLine;
    
    // 向上扩展到完整语句的开始
    while (expandedStart > 0) {
        const line = lines[expandedStart - 1].trim();
        if (line.endsWith(';') || line.endsWith('}') || line.endsWith('{') || line === '') {
            break;
        }
        expandedStart--;
    }
    
    // 向下扩展到完整语句的结束
    while (expandedEnd < lines.length - 1) {
        const line = lines[expandedEnd].trim();
        if (line.endsWith(';') || line.endsWith('}')) {
            break;
        }
        if (line.endsWith('{')) {
            // 找到匹配的闭合括号
            let braceCount = 1;
            for (let i = expandedEnd + 1; i < lines.length; i++) {
                const nextLine = lines[i];
                braceCount += (nextLine.match(/\{/g) || []).length;
                braceCount -= (nextLine.match(/\}/g) || []).length;
                if (braceCount === 0) {
                    expandedEnd = i;
                    break;
                }
            }
            break;
        }
        expandedEnd++;
    }
    
    return { start: expandedStart, end: expandedEnd };
}

function getContextIndentLevel(lines, lineIndex) {
    for (let i = lineIndex - 1; i >= 0; i--) {
        const line = lines[i];
        if (line.trim() !== '') {
            return getLineIndentLevel(line);
        }
    }
    return 0;
}

function getLineIndentLevel(line) {
    let indent = 0;
    for (const char of line) {
        if (char === ' ') {
            indent++;
        } else if (char === '\t') {
            indent += 4; // 假设一个tab等于4个空格
        } else {
            break;
        }
    }
    return indent;
}

function analyzeRangeFormattingNeeds(lines) {
    console.log('\n范围格式化需求分析:');
    
    let indentIssues = 0;
    let spaceIssues = 0;
    let braceIssues = 0;
    
    const indentLevels = new Set();
    
    lines.forEach((line, index) => {
        if (line.trim() === '') return;
        
        const indent = getLineIndentLevel(line);
        indentLevels.add(indent);
        
        // 检查缩进一致性
        if (indent > 0 && indent % 4 !== 0) {
            indentIssues++;
        }
        
        // 检查操作符空格
        const operators = [':', '=', ','];
        operators.forEach(op => {
            const regex = new RegExp(`\\S${op}\\S`, 'g');
            if (regex.test(line)) {
                spaceIssues++;
            }
        });
        
        // 检查括号
        if (line.includes('([') || line.includes('])')) {
            const beforeBracket = line.indexOf('([');
            const afterBracket = line.indexOf('])');
            if (beforeBracket > 0 && !line[beforeBracket - 1].match(/\s/)) {
                braceIssues++;
            }
        }
    });
    
    console.log(`- 缩进级别种类: ${indentLevels.size} (${Array.from(indentLevels).sort((a,b) => a-b).join(', ')})`);
    console.log(`- 潜在缩进问题: ${indentIssues} 行`);
    console.log(`- 操作符空格问题: ${spaceIssues} 行`);
    console.log(`- 括号格式问题: ${braceIssues} 行`);
    
    // 推荐的格式化策略
    console.log('\n推荐格式化策略:');
    if (indentLevels.size > 2) {
        console.log('- 统一缩进到4的倍数');
    }
    if (spaceIssues > 0) {
        console.log('- 在操作符周围添加空格');
    }
    if (braceIssues > 0) {
        console.log('- 调整括号间距');
    }
}

function findFunctionStart(lines, functionName) {
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(functionName) && lines[i].includes('(')) {
            return i;
        }
    }
    return -1;
}

function findFunctionEnd(lines, startLine) {
    let braceCount = 0;
    let foundOpenBrace = false;
    
    for (let i = startLine; i < lines.length; i++) {
        const line = lines[i];
        
        braceCount += (line.match(/\{/g) || []).length;
        braceCount -= (line.match(/\}/g) || []).length;
        
        if (braceCount > 0) foundOpenBrace = true;
        if (foundOpenBrace && braceCount === 0) {
            return i;
        }
    }
    
    return startLine; // 如果找不到结束，就返回开始行
}

function findLineWithPattern(lines, pattern) {
    for (let i = 0; i < lines.length; i++) {
        if (pattern.test(lines[i])) {
            return i;
        }
    }
    return -1;
}

// 运行测试
testRangeFormatting();