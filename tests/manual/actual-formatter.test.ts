/**
 * 实际运行格式化程序测试 yifeng-jian.c 文件
 * 使用真实的LPC格式化程序进行测试
 */

import * as fs from 'fs';
import * as path from 'path';
import { LPCFormatterImpl } from '../../src/formatting/lpcFormatter';
import { DEFAULT_FORMATTING_OPTIONS } from '../../src/formatting/types';

describe('实际格式化程序测试', () => {
    let formatter: LPCFormatterImpl;
    let originalContent: string;
    const testFilePath = path.join(__dirname, '..', '..', 'test', 'lpc_code', 'yifeng-jian.c');

    beforeAll(() => {
        formatter = new LPCFormatterImpl();
        if (fs.existsSync(testFilePath)) {
            originalContent = fs.readFileSync(testFilePath, 'utf-8');
        }
    });

    test('格式化程序应该成功初始化', () => {
        expect(formatter).toBeDefined();
        expect(formatter.formatDocument).toBeDefined();
        expect(formatter.formatRange).toBeDefined();
        expect(formatter.formatOnType).toBeDefined();
    });

    test('测试文件应该存在且可读', () => {
        expect(fs.existsSync(testFilePath)).toBe(true);
        expect(originalContent).toBeDefined();
        expect(originalContent.length).toBeGreaterThan(0);
        
        console.log('📄 测试文件信息:');
        console.log('   - 路径:', testFilePath);
        console.log('   - 大小:', originalContent.length, '字符');
        console.log('   - 行数:', originalContent.split('\n').length);
    });

    test('应该成功格式化整个文档', () => {
        const options = {
            ...DEFAULT_FORMATTING_OPTIONS,
            tabSize: 4,
            insertSpaces: true
        };

        console.log('🎯 开始格式化测试...');
        const startTime = Date.now();

        const result = formatter.formatDocument(originalContent, options);

        const endTime = Date.now();
        const formatTime = endTime - startTime;

        console.log('⏱️ 格式化性能:');
        console.log('   - 格式化耗时:', formatTime, 'ms');
        console.log('   - 诊断信息数量:', result.diagnostics.length);

        // 基本验证
        expect(result).toBeDefined();
        expect(result.text).toBeDefined();
        expect(result.diagnostics).toBeDefined();

        // 格式化应该在合理时间内完成
        expect(formatTime).toBeLessThan(5000); // 5秒内

        console.log('✅ 格式化测试通过');
    });

    test('应该保持代码内容完整性', () => {
        const options = DEFAULT_FORMATTING_OPTIONS;
        const result = formatter.formatDocument(originalContent, options);

        console.log('🔍 内容完整性检查:');
        
        // 检查字符数变化
        const originalLength = originalContent.length;
        const formattedLength = result.text.length;
        const lengthChange = formattedLength - originalLength;
        
        console.log('   - 原始字符数:', originalLength);
        console.log('   - 格式化后字符数:', formattedLength);
        console.log('   - 字符数变化:', lengthChange);

        // 检查行数变化
        const originalLines = originalContent.split('\n').length;
        const formattedLines = result.text.split('\n').length;
        const lineChange = formattedLines - originalLines;
        
        console.log('   - 原始行数:', originalLines);
        console.log('   - 格式化后行数:', formattedLines);
        console.log('   - 行数变化:', lineChange);

        // 检查括号平衡
        const originalBraces = (originalContent.match(/[{}]/g) || []).length;
        const formattedBraces = (result.text.match(/[{}]/g) || []).length;
        
        console.log('   - 原始括号数:', originalBraces);
        console.log('   - 格式化后括号数:', formattedBraces);
        console.log('   - 括号平衡:', originalBraces === formattedBraces ? '✅' : '❌');

        // 验证
        expect(result.text.length).toBeGreaterThan(0);
        expect(originalBraces).toBe(formattedBraces); // 括号数量应该保持一致
        
        // 行数变化应该在合理范围内 (不应该大幅减少或增加)
        expect(formattedLines).toBeGreaterThan(originalLines * 0.5);
        expect(formattedLines).toBeLessThan(originalLines * 3);

        console.log('✅ 内容完整性检查通过');
    });

    test('应该处理诊断信息', () => {
        const options = DEFAULT_FORMATTING_OPTIONS;
        const result = formatter.formatDocument(originalContent, options);

        console.log('📋 诊断信息分析:');
        console.log('   - 诊断信息总数:', result.diagnostics.length);

        if (result.diagnostics.length > 0) {
            const severityCounts = {
                error: 0,
                warning: 0,
                info: 0,
                hint: 0
            };

            result.diagnostics.forEach(diag => {
                switch (diag.severity) {
                    case 0: severityCounts.error++; break;
                    case 1: severityCounts.warning++; break;
                    case 2: severityCounts.info++; break;
                    case 3: severityCounts.hint++; break;
                }
            });

            console.log('   - 错误数量:', severityCounts.error);
            console.log('   - 警告数量:', severityCounts.warning);
            console.log('   - 信息数量:', severityCounts.info);
            console.log('   - 提示数量:', severityCounts.hint);

            // 显示前5个诊断信息
            console.log('   - 前5个诊断信息:');
            result.diagnostics.slice(0, 5).forEach((diag, index) => {
                const severityText = ['Error', 'Warning', 'Info', 'Hint'][diag.severity];
                console.log(`     ${index + 1}. [${severityText}] ${diag.message}`);
            });

            if (result.diagnostics.length > 5) {
                console.log(`     ... 还有 ${result.diagnostics.length - 5} 个诊断信息`);
            }
        } else {
            console.log('   - 无诊断信息');
        }

        expect(result.diagnostics).toBeInstanceOf(Array);
        console.log('✅ 诊断信息处理测试通过');
    });

    test('应该改进代码格式', () => {
        const options = DEFAULT_FORMATTING_OPTIONS;
        const result = formatter.formatDocument(originalContent, options);

        console.log('📊 格式化效果分析:');

        const originalLines = originalContent.split('\n');
        const formattedLines = result.text.split('\n');

        // 检查缩进改进
        let indentImprovements = 0;
        let standardIndentLines = 0;

        formattedLines.forEach(line => {
            if (line.trim() && line.length > 0) {
                const leadingSpaces = (line.match(/^ */)?.[0] || '').length;
                if (leadingSpaces % 4 === 0) {
                    standardIndentLines++;
                }
            }
        });

        originalLines.forEach(line => {
            if (line.trim() && line.length > 0) {
                const leadingSpaces = (line.match(/^ */)?.[0] || '').length;
                if (leadingSpaces > 0 && leadingSpaces % 4 !== 0) {
                    indentImprovements++;
                }
            }
        });

        const codeLineCount = formattedLines.filter(line => line.trim()).length;
        const indentStandardRate = (standardIndentLines / codeLineCount) * 100;

        console.log('   - 格式化后缩进标准化率:', indentStandardRate.toFixed(1) + '%');
        console.log('   - 潜在缩进改进行数:', indentImprovements);

        // 检查内容变化
        let changedLines = 0;
        const maxLines = Math.max(originalLines.length, formattedLines.length);

        for (let i = 0; i < maxLines; i++) {
            const originalLine = originalLines[i] || '';
            const formattedLine = formattedLines[i] || '';
            
            if (originalLine.trim() !== formattedLine.trim()) {
                changedLines++;
            }
        }

        console.log('   - 内容变化行数:', changedLines);
        console.log('   - 变化比例:', ((changedLines / originalLines.length) * 100).toFixed(1) + '%');

        // 验证格式化有实际效果
        if (indentImprovements > 0) {
            expect(indentStandardRate).toBeGreaterThan(90); // 期望90%以上的行有标准缩进
        }

        console.log('✅ 格式化效果分析完成');
    });

    test('保存格式化结果以便人工检查', () => {
        const options = DEFAULT_FORMATTING_OPTIONS;
        const result = formatter.formatDocument(originalContent, options);

        const outputPath = path.join(__dirname, '..', '..', 'formatted-yifeng-jian.c');
        fs.writeFileSync(outputPath, result.text, 'utf-8');

        console.log('💾 格式化结果已保存:');
        console.log('   - 保存路径:', outputPath);
        console.log('   - 文件大小:', result.text.length, '字符');
        
        // 创建对比报告
        const reportPath = path.join(__dirname, '..', '..', 'formatting-report.md');
        const report = generateFormattingReport(originalContent, result);
        fs.writeFileSync(reportPath, report, 'utf-8');
        
        console.log('   - 报告路径:', reportPath);

        expect(fs.existsSync(outputPath)).toBe(true);
        expect(fs.existsSync(reportPath)).toBe(true);

        console.log('✅ 文件保存完成');
    });
});

/**
 * 生成格式化报告
 */
function generateFormattingReport(original: string, result: any): string {
    const originalLines = original.split('\n');
    const formattedLines = result.text.split('\n');

    let report = '# LPC格式化程序测试报告\n\n';
    report += `## 基本统计\n\n`;
    report += `- **原始文件行数**: ${originalLines.length}\n`;
    report += `- **格式化后行数**: ${formattedLines.length}\n`;
    report += `- **行数变化**: ${formattedLines.length - originalLines.length}\n`;
    report += `- **原始文件字符数**: ${original.length}\n`;
    report += `- **格式化后字符数**: ${result.text.length}\n`;
    report += `- **字符数变化**: ${result.text.length - original.length}\n`;
    report += `- **诊断信息数量**: ${result.diagnostics.length}\n\n`;

    // 诊断信息
    if (result.diagnostics.length > 0) {
        report += `## 诊断信息\n\n`;
        result.diagnostics.forEach((diag: any, index: number) => {
            const severityText = ['Error', 'Warning', 'Info', 'Hint'][diag.severity];
            report += `${index + 1}. **[${severityText}]** ${diag.message}\n`;
        });
        report += '\n';
    }

    // 主要差异
    let changedLines = 0;
    const changes: string[] = [];
    
    for (let i = 0; i < Math.min(originalLines.length, formattedLines.length); i++) {
        if (originalLines[i] !== formattedLines[i] && changes.length < 10) {
            changedLines++;
            changes.push(`**第 ${i + 1} 行**:\n`);
            changes.push(`原始: \`${originalLines[i]}\`\n`);
            changes.push(`格式化: \`${formattedLines[i]}\`\n\n`);
        }
    }

    if (changes.length > 0) {
        report += `## 主要格式化差异（前10个）\n\n`;
        report += changes.join('');
    }

    report += `## 总结\n\n`;
    report += `- **总变化行数**: ${changedLines}\n`;
    report += `- **变化比例**: ${((changedLines / originalLines.length) * 100).toFixed(1)}%\n`;
    report += `- **格式化状态**: ${result.diagnostics.filter((d: any) => d.severity === 0).length === 0 ? '✅ 成功' : '⚠️ 有错误'}\n`;

    return report;
}