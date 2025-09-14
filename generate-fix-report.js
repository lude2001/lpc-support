#!/usr/bin/env node

/**
 * 格式化程序修复报告生成器
 * 详细分析格式化问题并生成修复报告
 */

const fs = require('fs');
const path = require('path');

async function generateFixReport() {
    console.log('📊 LPC格式化程序修复效果报告');
    console.log('='.repeat(80));
    
    try {
        // 读取测试文件
        const testFilePath = path.join(__dirname, 'test', 'lpc_code', 'yifeng-jian.c');
        if (!fs.existsSync(testFilePath)) {
            console.error('❌ 测试文件不存在:', testFilePath);
            return;
        }
        
        const originalContent = fs.readFileSync(testFilePath, 'utf-8');
        const lines = originalContent.split('\\n');
        
        console.log('📄 测试文件分析');
        console.log('   文件名:', path.basename(testFilePath));
        console.log('   文件大小:', originalContent.length, '字符');
        console.log('   总行数:', lines.length);
        console.log('   代码行数:', lines.filter(line => line.trim()).length);
        console.log('   空行数:', lines.filter(line => !line.trim()).length);
        
        // 详细分析各种问题
        const issues = {
            indent: analyzeIndentIssues(lines),
            operators: analyzeOperatorIssues(lines),
            commas: analyzeCommaIssues(lines),
            mappings: analyzeMappingArrays(lines),
            overall: {}
        };
        
        // 生成报告
        generateIndentReport(issues.indent);
        generateOperatorReport(issues.operators);
        generateCommaReport(issues.commas);
        generateMappingReport(issues.mappings);
        generateOverallReport(issues, lines.length);
        
        // 创建修复前后对比样本
        createComparisonSamples(lines, issues);
        
        console.log('\\n📋 修复建议');
        console.log('-'.repeat(60));
        provideFixRecommendations(issues);
        
    } catch (error) {
        console.error('💥 报告生成失败:', error.message);
        console.error(error.stack);
    }
}

/**
 * 分析缩进问题
 */
function analyzeIndentIssues(lines) {
    const issues = [];
    const stats = {
        total: 0,
        standardIndent: 0,
        nonStandardIndent: 0,
        noIndent: 0,
        indentPatterns: {}
    };
    
    lines.forEach((line, index) => {
        if (line.trim()) {
            stats.total++;
            const leadingSpaces = (line.match(/^ */)?.[0] || '').length;
            
            if (leadingSpaces === 0) {
                stats.noIndent++;
            } else if (leadingSpaces % 4 === 0) {
                stats.standardIndent++;
            } else {
                stats.nonStandardIndent++;
                issues.push({
                    line: index + 1,
                    current: leadingSpaces,
                    expected: Math.round(leadingSpaces / 4) * 4,
                    content: line.trim().substring(0, 40) + '...'
                });
            }
            
            // 记录缩进模式
            stats.indentPatterns[leadingSpaces] = (stats.indentPatterns[leadingSpaces] || 0) + 1;
        }
    });
    
    return { issues, stats };
}

/**
 * 分析运算符空格问题
 */
function analyzeOperatorIssues(lines) {
    const issues = [];
    const patterns = [
        { name: '赋值运算符', regex: /([^\\s=!<>])=([^=])/, fix: '$1 = $2' },
        { name: '复合赋值', regex: /([^\\s])([+\\-*/%]|\\|\\||&&)=([^\\s])/, fix: '$1 $2 $3' },
        { name: '比较运算符', regex: /([^\\s<>])([<>]=?)([^\\s])/, fix: '$1 $2 $3' },
        { name: '等式运算符', regex: /([^\\s=!])([=!]=)([^\\s])/, fix: '$1 $2 $3' },
        { name: '键值对冒号', regex: /\"([^\"]+)\"\\s*:\\s*(?!\\s)/, fix: '\"$1\" : ' }
    ];
    
    lines.forEach((line, index) => {
        patterns.forEach(pattern => {
            const matches = Array.from(line.matchAll(new RegExp(pattern.regex.source, 'g')));
            matches.forEach(match => {
                issues.push({
                    line: index + 1,
                    type: pattern.name,
                    match: match[0],
                    position: match.index,
                    fix: pattern.fix,
                    context: line.substring(Math.max(0, match.index - 10), match.index + match[0].length + 10)
                });
            });
        });
    });
    
    return issues;
}

/**
 * 分析逗号空格问题
 */
function analyzeCommaIssues(lines) {
    const issues = [];
    
    lines.forEach((line, index) => {
        const commaMatches = Array.from(line.matchAll(/,(?!\\s|$)/g));
        commaMatches.forEach(match => {
            issues.push({
                line: index + 1,
                position: match.index,
                context: line.substring(Math.max(0, match.index - 5), match.index + 6)
            });
        });
    });
    
    return issues;
}

/**
 * 分析映射数组结构
 */
function analyzeMappingArrays(lines) {
    const arrays = [];
    let currentArray = null;
    
    lines.forEach((line, index) => {
        const trimmed = line.trim();
        
        if (trimmed.includes('([')) {
            currentArray = {
                start: index + 1,
                startLine: line,
                elements: [],
                hasIssues: false
            };
        }
        
        if (currentArray) {
            // 检查键值对格式
            if (trimmed.includes(':') && trimmed.includes('\"')) {
                const keyValueMatch = trimmed.match(/\"([^\"]+)\"\\s*:\\s*(.+)/);
                if (keyValueMatch) {
                    currentArray.elements.push({
                        key: keyValueMatch[1],
                        value: keyValueMatch[2],
                        line: index + 1,
                        hasSpaceIssue: !trimmed.match(/\"[^\"]+\"\\s*:\\s+/)
                    });
                }
            }
        }
        
        if (currentArray && trimmed.includes('])')) {
            currentArray.end = index + 1;
            currentArray.endLine = line;
            currentArray.lineCount = currentArray.end - currentArray.start + 1;
            
            // 分析问题
            currentArray.hasIndentIssues = currentArray.elements.some(el => {
                const elLine = lines[el.line - 1];
                const indent = (elLine.match(/^ */)?.[0] || '').length;
                return indent % 4 !== 0;
            });
            
            arrays.push(currentArray);
            currentArray = null;
        }
    });
    
    return arrays;
}

/**
 * 生成缩进问题报告
 */
function generateIndentReport(indentData) {
    console.log('\\n📏 缩进问题分析');
    console.log('-'.repeat(60));
    
    const { issues, stats } = indentData;
    
    console.log(`总代码行数: ${stats.total}`);
    console.log(`标准缩进(4的倍数): ${stats.standardIndent} (${(stats.standardIndent/stats.total*100).toFixed(1)}%)`);
    console.log(`非标准缩进: ${stats.nonStandardIndent} (${(stats.nonStandardIndent/stats.total*100).toFixed(1)}%)`);
    console.log(`无缩进: ${stats.noIndent} (${(stats.noIndent/stats.total*100).toFixed(1)}%)`);
    
    if (Object.keys(stats.indentPatterns).length > 0) {
        console.log('\\n缩进分布:');
        Object.entries(stats.indentPatterns)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .forEach(([indent, count]) => {
                const isStandard = indent === '0' || parseInt(indent) % 4 === 0;
                const status = isStandard ? '✅' : '⚠️';
                console.log(`  ${status} ${indent}空格: ${count}行`);
            });
    }
    
    if (issues.length > 0) {
        console.log(`\\n前5个缩进问题:`);
        issues.slice(0, 5).forEach(issue => {
            console.log(`  第${issue.line}行: ${issue.current}→${issue.expected}空格`);
            console.log(`    ${issue.content}`);
        });
    }
}

/**
 * 生成运算符问题报告
 */
function generateOperatorReport(operatorIssues) {
    console.log('\\n⚡ 运算符空格问题分析');
    console.log('-'.repeat(60));
    
    if (operatorIssues.length === 0) {
        console.log('✅ 未发现运算符空格问题');
        return;
    }
    
    // 按类型统计
    const typeStats = {};
    operatorIssues.forEach(issue => {
        typeStats[issue.type] = (typeStats[issue.type] || 0) + 1;
    });
    
    console.log(`总计发现 ${operatorIssues.length} 个运算符空格问题:`);
    Object.entries(typeStats).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}个`);
    });
    
    console.log('\\n前5个问题示例:');
    operatorIssues.slice(0, 5).forEach((issue, index) => {
        console.log(`  ${index + 1}. 第${issue.line}行 [${issue.type}]:`);
        console.log(`     原文: "${issue.context}"`);
        console.log(`     问题: "${issue.match}" 缺少空格`);
    });
}

/**
 * 生成逗号问题报告
 */
function generateCommaReport(commaIssues) {
    console.log('\\n📝 逗号空格问题分析');
    console.log('-'.repeat(60));
    
    if (commaIssues.length === 0) {
        console.log('✅ 未发现逗号空格问题');
        return;
    }
    
    // 按行统计
    const lineStats = {};
    commaIssues.forEach(issue => {
        lineStats[issue.line] = (lineStats[issue.line] || 0) + 1;
    });
    
    console.log(`总计发现 ${commaIssues.length} 个逗号空格问题，分布在 ${Object.keys(lineStats).length} 行`);
    
    console.log('\\n问题最多的前5行:');
    Object.entries(lineStats)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .forEach(([line, count]) => {
            console.log(`  第${line}行: ${count}个逗号缺少空格`);
        });
    
    console.log('\\n前5个逗号问题示例:');
    commaIssues.slice(0, 5).forEach((issue, index) => {
        console.log(`  ${index + 1}. 第${issue.line}行位置${issue.position}: "${issue.context}"`);
    });
}

/**
 * 生成映射数组报告
 */
function generateMappingReport(mappingArrays) {
    console.log('\\n🗺️ 映射数组结构分析');
    console.log('-'.repeat(60));
    
    if (mappingArrays.length === 0) {
        console.log('ℹ️ 未检测到映射数组结构');
        return;
    }
    
    console.log(`检测到 ${mappingArrays.length} 个映射数组:`);
    
    mappingArrays.forEach((array, index) => {
        console.log(`\\n  数组 #${index + 1} (第${array.start}-${array.end}行, ${array.lineCount}行):`);
        console.log(`    - 元素数量: ${array.elements.length}`);
        console.log(`    - 缩进问题: ${array.hasIndentIssues ? '⚠️ 有' : '✅ 无'}`);
        
        const spaceIssues = array.elements.filter(el => el.hasSpaceIssue).length;
        console.log(`    - 冒号空格问题: ${spaceIssues > 0 ? '⚠️ ' + spaceIssues + '个' : '✅ 无'}`);
        
        if (array.elements.length > 0) {
            console.log(`    - 键示例: ${array.elements.slice(0, 3).map(el => el.key).join(', ')}${array.elements.length > 3 ? '...' : ''}`);
        }
    });
}

/**
 * 生成总体报告
 */
function generateOverallReport(issues, totalLines) {
    console.log('\\n📊 总体修复效果预测');
    console.log('-'.repeat(60));
    
    const indentIssues = issues.indent.issues.length;
    const operatorIssues = issues.operators.length;
    const commaIssues = issues.commas.length;
    const mappingArrays = issues.mappings.length;
    
    const totalIssues = indentIssues + operatorIssues + commaIssues;
    const affectedLines = new Set([
        ...issues.indent.issues.map(i => i.line),
        ...issues.operators.map(i => i.line),
        ...issues.commas.map(i => i.line)
    ]).size;
    
    console.log(`待修复问题统计:`);
    console.log(`  ├─ 缩进问题: ${indentIssues}行 (${(indentIssues/totalLines*100).toFixed(1)}%)`);
    console.log(`  ├─ 运算符空格: ${operatorIssues}个 (${(operatorIssues/totalLines*100).toFixed(1)}%)`);
    console.log(`  ├─ 逗号空格: ${commaIssues}个 (${(commaIssues/totalLines*100).toFixed(1)}%)`);
    console.log(`  └─ 映射数组: ${mappingArrays}个结构`);
    
    console.log(`\\n影响范围:`);
    console.log(`  - 总问题数: ${totalIssues}个`);
    console.log(`  - 影响行数: ${affectedLines}/${totalLines}行 (${(affectedLines/totalLines*100).toFixed(1)}%)`);
    
    // 预测修复效果
    const improvementLevel = affectedLines / totalLines;
    let expectedEffect;
    if (improvementLevel > 0.3) {
        expectedEffect = '🎉 显著改进';
    } else if (improvementLevel > 0.1) {
        expectedEffect = '✅ 中等改进';
    } else {
        expectedEffect = 'ℹ️ 轻微改进';
    }
    
    console.log(`\\n预期修复效果: ${expectedEffect}`);
}

/**
 * 创建对比样本
 */
function createComparisonSamples(lines, issues) {
    console.log('\\n📋 修复前后对比样本');
    console.log('-'.repeat(60));
    
    // 选择几行有代表性的问题进行对比
    const problemLines = [
        ...issues.indent.issues.slice(0, 2).map(i => ({ line: i.line, type: '缩进', issue: i })),
        ...issues.operators.slice(0, 2).map(i => ({ line: i.line, type: '运算符', issue: i })),
        ...issues.commas.slice(0, 2).map(i => ({ line: i.line, type: '逗号', issue: i }))
    ].sort((a, b) => a.line - b.line);
    
    problemLines.slice(0, 5).forEach(({ line, type, issue }, index) => {
        const originalLine = lines[line - 1];
        let fixedLine = originalLine;
        
        console.log(`\\n${index + 1}. 第${line}行 [${type}问题]:`);
        console.log(`   修复前: "${originalLine}"`);
        
        // 模拟修复
        if (type === '缩进') {
            const expectedIndent = ' '.repeat(issue.expected);
            fixedLine = expectedIndent + originalLine.trim();
        } else if (type === '运算符') {
            // 简单的运算符空格修复示例
            fixedLine = originalLine
                .replace(/([^\\s=!<>])=([^=])/g, '$1 = $2')
                .replace(/([^\\s<>])([<>]=?)([^\\s])/g, '$1 $2 $3');
        } else if (type === '逗号') {
            fixedLine = originalLine.replace(/,(?!\\s|$)/g, ', ');
        }
        
        console.log(`   修复后: "${fixedLine}"`);
        console.log(`   改进: ${fixedLine !== originalLine ? '✅ 已修复' : 'ℹ️ 无变化'}`);
    });
}

/**
 * 提供修复建议
 */
function provideFixRecommendations(issues) {
    const recommendations = [
        {
            priority: '高',
            issue: '缩进标准化',
            count: issues.indent.issues.length,
            solution: '使用智能缩进检测，将非标准缩进调整为4空格的倍数'
        },
        {
            priority: '高', 
            issue: '运算符空格',
            count: issues.operators.length,
            solution: '在赋值运算符、比较运算符周围添加空格，规范化键值对冒号格式'
        },
        {
            priority: '中',
            issue: '逗号后空格',
            count: issues.commas.length,
            solution: '在所有逗号后添加单个空格，但行尾逗号除外'
        },
        {
            priority: '中',
            issue: '映射数组格式',
            count: issues.mappings.length,
            solution: '优化映射数组的缩进结构，确保键值对对齐'
        }
    ];
    
    console.log('修复优先级建议:');
    recommendations.forEach((rec, index) => {
        const urgency = rec.priority === '高' ? '🔥' : rec.priority === '中' ? '⚡' : 'ℹ️';
        console.log(`  ${index + 1}. ${urgency} [${rec.priority}优先级] ${rec.issue}`);
        console.log(`     问题数量: ${rec.count}个`);
        console.log(`     解决方案: ${rec.solution}`);
        console.log('');
    });
    
    console.log('实施建议:');
    console.log('  1. 首先修复高优先级问题（缩进、运算符空格）');
    console.log('  2. 然后处理中优先级问题（逗号、映射数组）');
    console.log('  3. 确保修复后运行测试验证结果');
    console.log('  4. 考虑在VS Code中提供实时格式化预览');
}

// 运行报告生成
if (require.main === module) {
    generateFixReport().catch(console.error);
}

module.exports = { generateFixReport };