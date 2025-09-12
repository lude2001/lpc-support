/**
 * 分析测试文件的格式化需求
 * 不依赖 VS Code API，纯 Node.js 环境
 */

const fs = require('fs');
const path = require('path');

const TEST_FILE = path.join(__dirname, 'yifeng-jian.c');

function analyzeFormattingNeeds() {
    console.log('LPC 格式化需求分析');
    console.log('===================\n');

    if (!fs.existsSync(TEST_FILE)) {
        console.error('测试文件不存在:', TEST_FILE);
        return;
    }

    const content = fs.readFileSync(TEST_FILE, 'utf8');
    const lines = content.split('\n');
    
    console.log(`文件基本信息:`);
    console.log(`- 总行数: ${lines.length}`);
    console.log(`- 总字符数: ${content.length}`);
    console.log(`- 非空行数: ${lines.filter(l => l.trim()).length}`);
    console.log('');

    // 分析缩进情况
    console.log('1. 缩进分析:');
    console.log('-'.repeat(20));
    
    const indentPatterns = {};
    let mixedIndentLines = 0;
    let noIndentLines = 0;
    
    lines.forEach((line, index) => {
        if (line.trim() === '') return; // 跳过空行
        
        const leading = line.match(/^(\s*)/)[1];
        if (leading.length === 0) {
            noIndentLines++;
            return;
        }
        
        // 检查混合缩进
        const hasSpaces = leading.includes(' ');
        const hasTabs = leading.includes('\t');
        if (hasSpaces && hasTabs) {
            mixedIndentLines++;
        }
        
        // 统计缩进模式
        const pattern = leading.replace(/\t/g, 'T').replace(/ /g, 'S');
        indentPatterns[pattern] = (indentPatterns[pattern] || 0) + 1;
    });
    
    console.log(`缩进模式统计 (前10种):`);
    const sortedPatterns = Object.entries(indentPatterns)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    sortedPatterns.forEach(([pattern, count]) => {
        const display = pattern.length > 20 ? pattern.substring(0, 20) + '...' : pattern;
        console.log(`  "${display}": ${count} 行`);
    });
    
    console.log(`混合缩进行数: ${mixedIndentLines}`);
    console.log(`无缩进行数: ${noIndentLines}`);
    console.log('');

    // 分析 mapping 字面量格式
    console.log('2. Mapping 字面量分析:');
    console.log('-'.repeat(25));
    
    let inMapping = false;
    let mappingStartLine = -1;
    let mappingLines = [];
    
    lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('mapping *action = ({')) {
            inMapping = true;
            mappingStartLine = index + 1;
            mappingLines = [];
        } else if (inMapping) {
            if (trimmed === '});') {
                inMapping = false;
                analyzeMappingBlock(mappingStartLine, mappingLines);
            } else {
                mappingLines.push({ lineNum: index + 1, content: line, trimmed });
            }
        }
    });

    // 分析运算符空格
    console.log('3. 运算符空格分析:');
    console.log('-'.repeat(23));
    
    const operators = ['=', '==', '!=', '>', '<', '>=', '<=', '+', '-', '*', '/', '%'];
    let totalOperators = 0;
    let properlySpaced = 0;
    let noSpaceBefore = 0;
    let noSpaceAfter = 0;
    
    lines.forEach((line, index) => {
        operators.forEach(op => {
            const regex = new RegExp(`\\S(${op.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\S`, 'g');
            const matches = line.match(regex);
            if (matches) {
                totalOperators += matches.length;
                noSpaceBefore += matches.filter(m => !m.match(new RegExp(`\\s${op}\\S`))).length;
                noSpaceAfter += matches.filter(m => !m.match(new RegExp(`\\S${op}\\s`))).length;
            }
            
            const goodRegex = new RegExp(`\\s(${op.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\s`, 'g');
            const goodMatches = line.match(goodRegex);
            if (goodMatches) {
                properlySpaced += goodMatches.length;
            }
        });
    });
    
    console.log(`总运算符数: ${totalOperators}`);
    console.log(`正确空格的: ${properlySpaced}`);
    console.log(`前面缺空格: ${noSpaceBefore}`);
    console.log(`后面缺空格: ${noSpaceAfter}`);
    if (totalOperators > 0) {
        console.log(`正确率: ${(properlySpaced / totalOperators * 100).toFixed(1)}%`);
    }
    console.log('');

    // 分析括号和大括号
    console.log('4. 括号对齐分析:');
    console.log('-'.repeat(18));
    
    let braceBalance = 0;
    let parenBalance = 0;
    let bracketBalance = 0;
    let unbalancedLines = [];
    
    lines.forEach((line, index) => {
        const lineNum = index + 1;
        let localBraceChange = 0;
        let localParenChange = 0;
        let localBracketChange = 0;
        
        for (const char of line) {
            switch (char) {
                case '{': braceBalance++; localBraceChange++; break;
                case '}': braceBalance--; localBraceChange--; break;
                case '(': parenBalance++; localParenChange++; break;
                case ')': parenBalance--; localParenChange--; break;
                case '[': bracketBalance++; localBracketChange++; break;
                case ']': bracketBalance--; localBracketChange--; break;
            }
        }
        
        // 检查行内是否有不平衡的括号
        if (localBraceChange !== 0 || localParenChange !== 0 || localBracketChange !== 0) {
            unbalancedLines.push({
                line: lineNum,
                braces: localBraceChange,
                parens: localParenChange,
                brackets: localBracketChange
            });
        }
    });
    
    console.log(`大括号平衡: ${braceBalance === 0 ? '是' : '否 (' + braceBalance + ')'}`);
    console.log(`小括号平衡: ${parenBalance === 0 ? '是' : '否 (' + parenBalance + ')'}`);
    console.log(`方括号平衡: ${bracketBalance === 0 ? '是' : '否 (' + bracketBalance + ')'}`);
    console.log(`不平衡行数: ${unbalancedLines.length}`);
    console.log('');

    // 分析字符串和注释
    console.log('5. 字符串和注释分析:');
    console.log('-'.repeat(23));
    
    let inString = false;
    let inComment = false;
    let stringLines = 0;
    let commentLines = 0;
    let possibleStringErrors = 0;
    
    lines.forEach((line, index) => {
        if (line.includes('"')) {
            stringLines++;
            // 简单检查引号配对
            const quotes = (line.match(/"/g) || []).length;
            if (quotes % 2 !== 0) {
                possibleStringErrors++;
            }
        }
        
        if (line.includes('//') || line.trim().startsWith('/*') || line.includes('*/')) {
            commentLines++;
        }
    });
    
    console.log(`包含字符串的行: ${stringLines}`);
    console.log(`包含注释的行: ${commentLines}`);
    console.log(`可能的字符串错误: ${possibleStringErrors}`);
    console.log('');

    // 生成格式化建议
    console.log('6. 格式化建议:');
    console.log('-'.repeat(16));
    
    console.log('建议的格式化操作:');
    if (mixedIndentLines > 0) {
        console.log(`- 统一缩进格式 (影响 ${mixedIndentLines} 行)`);
    }
    
    if (totalOperators > properlySpaced) {
        console.log(`- 规范运算符空格 (影响约 ${totalOperators - properlySpaced} 个运算符)`);
    }
    
    console.log(`- 格式化 mapping 字面量 (约 ${mappingLines.length || 0} 行)`);
    console.log(`- 调整括号对齐和缩进`);
    
    if (possibleStringErrors > 0) {
        console.log(`- 检查字符串引号配对 (${possibleStringErrors} 个可能错误)`);
    }
    
    console.log('\n推荐格式化配置:');
    console.log('- indentSize: 4');
    console.log('- insertSpaces: true');
    console.log('- spaceAroundOperators: true'); 
    console.log('- mappingLiteralFormat: "expanded"');
    console.log('- trimTrailingWhitespace: true');
}

function analyzeMappingBlock(startLine, mappingLines) {
    console.log(`发现 mapping 块 (行 ${startLine}-${startLine + mappingLines.length}):`);
    
    let inconsistentIndent = 0;
    let expectedIndent = -1;
    
    mappingLines.forEach(lineInfo => {
        if (lineInfo.trimmed.startsWith('([') || lineInfo.trimmed.startsWith('"')) {
            const indent = lineInfo.content.length - lineInfo.content.trimLeft().length;
            
            if (expectedIndent === -1) {
                expectedIndent = indent;
            } else if (indent !== expectedIndent) {
                inconsistentIndent++;
            }
        }
    });
    
    console.log(`  - 总行数: ${mappingLines.length}`);
    console.log(`  - 不一致缩进: ${inconsistentIndent} 行`);
    console.log(`  - 期望缩进: ${expectedIndent} 空格`);
}

// 运行分析
analyzeFormattingNeeds();