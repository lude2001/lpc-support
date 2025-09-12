import * as fs from 'fs';
import * as path from 'path';
import { LPCFormatterImpl } from './src/formatting/lpcFormatter';
import { DEFAULT_FORMATTING_OPTIONS } from './src/formatting/types';

async function testFormatterOnFile() {
    const testFilePath = '/mnt/b/lpc_linter/lpc-support/test/yifeng-jian.c';
    
    try {
        // 读取测试文件
        const originalContent = fs.readFileSync(testFilePath, 'utf-8');
        console.log('=== 原始代码长度 ===');
        console.log(`文件大小: ${originalContent.length} 字符`);
        console.log(`行数: ${originalContent.split('\n').length} 行`);

        // 创建格式化器实例
        const formatter = new LPCFormatterImpl();
        
        console.log('\n=== 开始格式化测试 ===');
        const startTime = Date.now();
        
        // 执行格式化
        const result = formatter.formatDocument(originalContent, DEFAULT_FORMATTING_OPTIONS);
        
        const endTime = Date.now();
        console.log(`格式化耗时: ${endTime - startTime}ms`);
        
        // 显示格式化结果
        console.log('\n=== 格式化结果 ===');
        console.log(`格式化后文本长度: ${result.text.length} 字符`);
        console.log(`格式化后行数: ${result.text.split('\n').length} 行`);
        
        if (result.diagnostics && result.diagnostics.length > 0) {
            console.log('\n=== 诊断信息 ===');
            result.diagnostics.forEach((diagnostic, index) => {
                console.log(`${index + 1}. [${diagnostic.severity}] ${diagnostic.message}`);
                if (diagnostic.range) {
                    console.log(`   位置: 行${diagnostic.range.start.line + 1}, 列${diagnostic.range.start.character + 1}`);
                }
            });
        }
        
        // 比较原始文本和格式化后的文本
        const changes = compareTexts(originalContent, result.text);
        console.log('\n=== 变更统计 ===');
        console.log(`总变更行数: ${changes.changedLines}`);
        console.log(`添加的行: ${changes.addedLines}`);
        console.log(`删除的行: ${changes.removedLines}`);
        console.log(`修改的行: ${changes.modifiedLines}`);
        
        // 保存格式化结果到文件（可选）
        if (process.argv.includes('--save')) {
            const outputPath = testFilePath.replace('.c', '.formatted.c');
            fs.writeFileSync(outputPath, result.text, 'utf-8');
            console.log(`\n格式化结果已保存到: ${outputPath}`);
        }
        
        // 显示前几行的对比
        console.log('\n=== 前20行对比 ===');
        showLineComparison(originalContent, result.text, 20);
        
        // 性能统计
        const stats = formatter.getPerformanceStats();
        console.log('\n=== 性能统计 ===');
        console.log(`总请求数: ${stats.totalRequests}`);
        console.log(`缓存命中数: ${stats.cacheHits}`);
        console.log(`缓存命中率: ${stats.cacheHitRate}`);
        console.log(`平均格式化时间: ${stats.averageFormatTime.toFixed(2)}ms`);
        
        // 检查特定问题是否修复
        console.log('\n=== 问题修复检查 ===');
        checkSpecificIssues(originalContent, result.text);
        
    } catch (error) {
        console.error('测试格式化器时出错:', error);
        if (error instanceof Error) {
            console.error('错误堆栈:', error.stack);
        }
    }
}

function compareTexts(original: string, formatted: string) {
    const originalLines = original.split('\n');
    const formattedLines = formatted.split('\n');
    
    let changedLines = 0;
    let addedLines = 0;
    let removedLines = 0;
    let modifiedLines = 0;
    
    const maxLines = Math.max(originalLines.length, formattedLines.length);
    
    for (let i = 0; i < maxLines; i++) {
        const originalLine = originalLines[i] || '';
        const formattedLine = formattedLines[i] || '';
        
        if (originalLine !== formattedLine) {
            changedLines++;
            
            if (!originalLine && formattedLine) {
                addedLines++;
            } else if (originalLine && !formattedLine) {
                removedLines++;
            } else {
                modifiedLines++;
            }
        }
    }
    
    return {
        changedLines,
        addedLines,
        removedLines,
        modifiedLines
    };
}

function showLineComparison(original: string, formatted: string, maxLines: number = 20) {
    const originalLines = original.split('\n');
    const formattedLines = formatted.split('\n');
    
    const linesToShow = Math.min(maxLines, Math.max(originalLines.length, formattedLines.length));
    
    for (let i = 0; i < linesToShow; i++) {
        const originalLine = originalLines[i] || '';
        const formattedLine = formattedLines[i] || '';
        
        if (originalLine !== formattedLine) {
            console.log(`行 ${i + 1}:`);
            console.log(`  原始: "${originalLine}"`);
            console.log(`  格式化: "${formattedLine}"`);
            console.log('');
        }
    }
}

function checkSpecificIssues(original: string, formatted: string) {
    const issues = [];
    
    // 检查字符串语法错误是否修复
    if (original.includes('"NOR,') && !formatted.includes('"NOR,')) {
        issues.push('✅ 修复了字符串结尾缺失引号问题');
    } else if (formatted.includes('"NOR,')) {
        issues.push('❌ 字符串结尾缺失引号问题未修复');
    }
    
    if (original.includes('HIM"') && formatted.includes('"HIM"')) {
        issues.push('✅ 修复了字符串开头缺失引号问题');
    } else if (formatted.includes('HIM"')) {
        issues.push('❌ 字符串开头缺失引号问题未修复');
    }
    
    // 检查缩进一致性
    const formattedLines = formatted.split('\n');
    const inconsistentIndents = formattedLines.filter(line => {
        if (line.trim() === '') return false;
        const leadingSpaces = line.match(/^\\s*/)?.[0].length || 0;
        return leadingSpaces > 0 && leadingSpaces % 4 !== 0;
    });
    
    if (inconsistentIndents.length === 0) {
        issues.push('✅ 缩进一致性问题已修复');
    } else {
        issues.push(`❌ 仍有 ${inconsistentIndents.length} 行缩进不一致`);
    }
    
    // 检查空行处理
    const originalEmptyLines = original.match(/\\n\\n\\n/g)?.length || 0;
    const formattedEmptyLines = formatted.match(/\\n\\n\\n/g)?.length || 0;
    
    if (formattedEmptyLines < originalEmptyLines) {
        issues.push('✅ 清理了多余的空行');
    }
    
    // 检查文件结尾
    if (formatted.endsWith('\\n') && !original.endsWith('\\n')) {
        issues.push('✅ 添加了文件结尾换行符');
    }
    
    issues.forEach(issue => console.log('  ' + issue));
}

// 如果直接运行此脚本
if (require.main === module) {
    testFormatterOnFile().catch(console.error);
}

export { testFormatterOnFile };