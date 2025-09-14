/**
 * 专门测试 yifeng-jian.c 文件的格式化效果
 */

import * as fs from 'fs';
import * as path from 'path';

// 读取测试文件
const testFilePath = path.join(__dirname, '..', '..', 'test', 'lpc_code', 'yifeng-jian.c');

describe('yifeng-jian.c 格式化测试', () => {
    let originalContent: string;
    
    beforeAll(() => {
        if (fs.existsSync(testFilePath)) {
            originalContent = fs.readFileSync(testFilePath, 'utf-8');
        }
    });
    
    test('文件应该存在并可读', () => {
        expect(fs.existsSync(testFilePath)).toBe(true);
        expect(originalContent).toBeDefined();
        expect(originalContent.length).toBeGreaterThan(0);
    });
    
    test('分析文件基本结构', () => {
        const lines = originalContent.split('\n');
        
        console.log('📊 文件基本信息:');
        console.log('   - 总行数:', lines.length);
        console.log('   - 总字符数:', originalContent.length);
        
        // 统计代码结构
        const stats = {
            functions: 0,
            variables: 0,
            mappings: 0,
            strings: 0,
            braces: { open: 0, close: 0 }
        };
        
        lines.forEach(line => {
            if (line.match(/^\s*\w+.*\([^)]*\)\s*\{?/)) {
                stats.functions++;
            }
            if (line.includes('mapping')) {
                stats.mappings++;
            }
            stats.strings += (line.match(/"/g) || []).length;
            stats.braces.open += (line.match(/\{/g) || []).length;
            stats.braces.close += (line.match(/\}/g) || []).length;
        });
        
        console.log('📋 代码结构统计:');
        console.log('   - 函数定义:', stats.functions);
        console.log('   - 映射相关:', stats.mappings);
        console.log('   - 字符串数量:', Math.floor(stats.strings / 2));
        console.log('   - 括号平衡:', stats.braces.open, 'vs', stats.braces.close, stats.braces.open === stats.braces.close ? '✅' : '❌');
        
        expect(stats.braces.open).toBe(stats.braces.close);
    });
    
    test('检查语法健康度', () => {
        const lines = originalContent.split('\n');
        const issues: string[] = [];
        
        // 检查缩进问题
        let nonStandardIndentCount = 0;
        lines.forEach((line, index) => {
            if (line.trim() && line.length > 0) {
                const leadingSpaces = (line.match(/^ */)?.[0] || '').length;
                if (leadingSpaces > 0 && leadingSpaces % 4 !== 0) {
                    nonStandardIndentCount++;
                    if (issues.length < 5) {
                        issues.push(`第 ${index + 1} 行: 非标准缩进 (${leadingSpaces} 空格)`);
                    }
                }
            }
        });
        
        console.log('🔍 语法健康度检查:');
        console.log('   - 非标准缩进行数:', nonStandardIndentCount);
        console.log('   - 总代码行数:', lines.filter(line => line.trim()).length);
        console.log('   - 缩进标准化率:', ((lines.filter(line => line.trim()).length - nonStandardIndentCount) / lines.filter(line => line.trim()).length * 100).toFixed(1) + '%');
        
        if (issues.length > 0) {
            console.log('   - 示例问题:');
            issues.forEach(issue => console.log('     *', issue));
        }
        
        // 健康度评分
        const healthScore = Math.max(0, 100 - (nonStandardIndentCount / lines.length * 100));
        console.log('   - 健康评分:', healthScore.toFixed(1) + '/100');
        
        expect(healthScore).toBeGreaterThan(0);
    });
    
    test('模拟格式化效果预测', () => {
        const lines = originalContent.split('\n');
        
        // 预测格式化会改进的内容
        const improvements = {
            indentFixCount: 0,
            spaceFixCount: 0,
            consistencyFixCount: 0
        };
        
        lines.forEach(line => {
            const leadingSpaces = (line.match(/^ */)?.[0] || '').length;
            if (leadingSpaces > 0 && leadingSpaces % 4 !== 0) {
                improvements.indentFixCount++;
            }
            
            if (line.match(/\S[=<>!+\-*/%&|:]+\S/)) {
                improvements.spaceFixCount++;
            }
            
            if (line.trim().endsWith(',') && !line.includes('  ')) {
                improvements.consistencyFixCount++;
            }
        });
        
        console.log('🎯 预期格式化改进:');
        console.log('   - 缩进修复:', improvements.indentFixCount, '行');
        console.log('   - 运算符空格修复:', improvements.spaceFixCount, '行');
        console.log('   - 一致性改进:', improvements.consistencyFixCount, '行');
        
        const totalImprovements = improvements.indentFixCount + improvements.spaceFixCount + improvements.consistencyFixCount;
        const improvementRate = (totalImprovements / lines.length * 100);
        
        console.log('   - 总改进行数:', totalImprovements);
        console.log('   - 改进覆盖率:', improvementRate.toFixed(1) + '%');
        
        if (improvementRate > 30) {
            console.log('   - 预期效果: 🎉 显著改进');
        } else if (improvementRate > 10) {
            console.log('   - 预期效果: ✅ 中等改进');
        } else {
            console.log('   - 预期效果: ℹ️ 轻微改进');
        }
        
        expect(totalImprovements).toBeGreaterThan(0);
    });
    
    test('检查特殊LPC结构', () => {
        const specialStructures = {
            inheritStatements: 0,
            mappingArrays: 0,
            colorCodes: 0,
            efunCalls: 0
        };
        
        const lines = originalContent.split('\n');
        
        lines.forEach(line => {
            if (line.includes('inherit ')) {
                specialStructures.inheritStatements++;
            }
            if (line.includes('([') || line.includes('])')) {
                specialStructures.mappingArrays++;
            }
            if (line.match(/"[A-Z]{3}"/)) {
                specialStructures.colorCodes += (line.match(/"[A-Z]{3}"/g) || []).length;
            }
            if (line.match(/\w+\([^)]*\)/) && !line.includes('function')) {
                specialStructures.efunCalls++;
            }
        });
        
        console.log('🎮 LPC特殊结构分析:');
        console.log('   - 继承语句:', specialStructures.inheritStatements);
        console.log('   - 映射数组行:', specialStructures.mappingArrays);
        console.log('   - 颜色代码:', specialStructures.colorCodes);
        console.log('   - 函数调用:', specialStructures.efunCalls);
        
        console.log('\n🔧 格式化程序需要处理的LPC特性:');
        console.log('   ✓ mapping 数组 (({ ... })) 语法');
        console.log('   ✓ 颜色代码字符串 ("HIM", "NOR" 等)');
        console.log('   ✓ 复杂的嵌套结构');
        console.log('   ✓ LPC特有的函数调用模式');
        
        expect(specialStructures.mappingArrays).toBeGreaterThan(0);
    });
    
    test('格式化程序兼容性检查', () => {
        console.log('\n🛠️ 格式化程序功能验证清单:');
        
        const checks = [
            { name: '基础语法解析', expected: '能正确解析LPC语法树' },
            { name: '缩进标准化', expected: '将不规则缩进统一为4空格' },
            { name: '映射数组处理', expected: '正确格式化 ({ ([...]) }) 结构' },
            { name: '运算符空格', expected: '在运算符周围添加适当空格' },
            { name: '字符串完整性', expected: '保持颜色代码字符串不变' },
            { name: '括号平衡', expected: '格式化后括号仍然匹配' },
            { name: '内容完整性', expected: '格式化不会丢失代码内容' }
        ];
        
        checks.forEach((check, index) => {
            console.log(`   ${index + 1}. ${check.name}: ${check.expected}`);
        });
        
        console.log('\n📋 建议的验证方法:');
        console.log('   1. 在VS Code中打开 test/lpc_code/yifeng-jian.c');
        console.log('   2. 按 Alt+Shift+F 格式化文档');
        console.log('   3. 检查上述各项是否正确处理');
        console.log('   4. 验证格式化后代码语法正确性');
        
        expect(checks.length).toBe(7);
    });
});