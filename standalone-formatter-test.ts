#!/usr/bin/env node

/**
 * LPC格式化独立测试程序
 *
 * 这是一个独立的TypeScript程序，用于测试LPC格式化功能
 * 不依赖VS Code IDE环境，可以在命令行独立运行
 *
 * 使用方法：
 * 1. 单文件测试：ts-node standalone-formatter-test.ts --file path/to/file.lpc
 * 2. 批量测试：ts-node standalone-formatter-test.ts --dir path/to/directory
 * 3. 内置测试：ts-node standalone-formatter-test.ts --builtin
 * 4. 所有测试：ts-node standalone-formatter-test.ts --all
 */

import * as fs from 'fs';
import * as path from 'path';
import { promises as fsPromises } from 'fs';

// 导入格式化相关模块
import { FormattingEngine } from './src/formatting/engine/FormattingEngine';
import { RuleEngine } from './src/formatting/engine/RuleEngine';
import { DEFAULT_FORMATTING_CONFIG } from './src/formatting/config/DefaultConfig';
import { FormattingConfig, FormattingResult } from './src/formatting/config/FormattingConfig';

// 导入解析器相关模块
import { CharStreams, CommonTokenStream } from 'antlr4ts';
import { LPCLexer } from './src/antlr/LPCLexer';
import { LPCParser } from './src/antlr/LPCParser';

interface TestResult {
    filePath: string;
    success: boolean;
    originalLength: number;
    formattedLength: number;
    duration: number;
    errors?: string[];
    warnings?: string[];
    beforeSample?: string;
    afterSample?: string;
}

interface TestSummary {
    totalFiles: number;
    successCount: number;
    failureCount: number;
    totalDuration: number;
    averageDuration: number;
    results: TestResult[];
    overallSuccess: boolean;
}

class StandaloneFormatterTester {
    private engine: FormattingEngine;
    private config: FormattingConfig;

    constructor(customConfig?: Partial<FormattingConfig>) {
        this.config = { ...DEFAULT_FORMATTING_CONFIG, ...customConfig };
        this.engine = new FormattingEngine(this.config);
    }

    /**
     * 测试单个文件的格式化
     */
    async testFile(filePath: string): Promise<TestResult> {
        const startTime = Date.now();

        try {
            console.log(`\n📄 测试文件: ${filePath}`);

            if (!fs.existsSync(filePath)) {
                throw new Error(`文件不存在: ${filePath}`);
            }

            const content = await fsPromises.readFile(filePath, 'utf-8');
            const originalLength = content.length;

            console.log(`   📏 原始文件大小: ${originalLength} 字符`);
            console.log(`   🔄 开始格式化...`);

            // 执行格式化
            const result = await this.engine.formatText(content, filePath);
            const duration = Date.now() - startTime;

            const formattedLength = result.formattedText?.length || 0;
            const beforeSample = this.getSample(content, 0, 100);
            const afterSample = result.formattedText ? this.getSample(result.formattedText, 0, 100) : '';

            console.log(`   ⏱️  格式化耗时: ${duration}ms`);
            console.log(`   📏 格式化后大小: ${formattedLength} 字符`);
            console.log(`   ✅ 格式化状态: ${result.success ? '成功' : '失败'}`);

            if (result.errors && result.errors.length > 0) {
                console.log(`   ❌ 错误: ${result.errors.join(', ')}`);
            }

            if (result.warnings && result.warnings.length > 0) {
                console.log(`   ⚠️  警告: ${result.warnings.join(', ')}`);
            }

            return {
                filePath,
                success: result.success,
                originalLength,
                formattedLength,
                duration,
                errors: result.errors,
                warnings: result.warnings,
                beforeSample,
                afterSample
            };

        } catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);

            console.log(`   ❌ 测试失败: ${errorMessage}`);

            return {
                filePath,
                success: false,
                originalLength: 0,
                formattedLength: 0,
                duration,
                errors: [errorMessage],
                beforeSample: '',
                afterSample: ''
            };
        }
    }

    /**
     * 批量测试目录中的LPC文件
     */
    async testDirectory(dirPath: string): Promise<TestSummary> {
        console.log(`\n📁 批量测试目录: ${dirPath}`);

        if (!fs.existsSync(dirPath)) {
            throw new Error(`目录不存在: ${dirPath}`);
        }

        const lpcFiles = await this.findLPCFiles(dirPath);
        console.log(`   🔍 找到 ${lpcFiles.length} 个LPC文件`);

        const results: TestResult[] = [];
        const startTime = Date.now();

        for (const filePath of lpcFiles) {
            const result = await this.testFile(filePath);
            results.push(result);
        }

        const totalDuration = Date.now() - startTime;
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.length - successCount;

        return {
            totalFiles: results.length,
            successCount,
            failureCount,
            totalDuration,
            averageDuration: results.length > 0 ? totalDuration / results.length : 0,
            results,
            overallSuccess: failureCount === 0
        };
    }

    /**
     * 运行内置测试用例
     */
    async runBuiltinTests(): Promise<TestSummary> {
        console.log(`\n🧪 运行内置测试用例`);

        const testCases = this.getBuiltinTestCases();
        const results: TestResult[] = [];
        const startTime = Date.now();

        for (const testCase of testCases) {
            console.log(`\n📋 测试用例: ${testCase.name}`);
            console.log(`   📝 描述: ${testCase.description}`);

            const testResult = await this.testText(testCase.code, testCase.name);
            results.push(testResult);
        }

        const totalDuration = Date.now() - startTime;
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.length - successCount;

        return {
            totalFiles: results.length,
            successCount,
            failureCount,
            totalDuration,
            averageDuration: results.length > 0 ? totalDuration / results.length : 0,
            results,
            overallSuccess: failureCount === 0
        };
    }

    /**
     * 测试文本内容（用于内置测试用例）
     */
    private async testText(content: string, name: string): Promise<TestResult> {
        const startTime = Date.now();

        try {
            const originalLength = content.length;
            console.log(`   📏 原始内容大小: ${originalLength} 字符`);

            const result = await this.engine.formatText(content);
            const duration = Date.now() - startTime;

            const formattedLength = result.formattedText?.length || 0;
            const beforeSample = this.getSample(content, 0, 150);
            const afterSample = result.formattedText ? this.getSample(result.formattedText, 0, 150) : '';

            console.log(`   ⏱️  格式化耗时: ${duration}ms`);
            console.log(`   ✅ 格式化状态: ${result.success ? '成功' : '失败'}`);

            if (!result.success) {
                console.log(`   ❌ 格式化失败`);
            }

            return {
                filePath: name,
                success: result.success,
                originalLength,
                formattedLength,
                duration,
                errors: result.errors,
                warnings: result.warnings,
                beforeSample,
                afterSample
            };

        } catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);

            console.log(`   ❌ 测试失败: ${errorMessage}`);

            return {
                filePath: name,
                success: false,
                originalLength: content.length,
                formattedLength: 0,
                duration,
                errors: [errorMessage],
                beforeSample: this.getSample(content, 0, 150),
                afterSample: ''
            };
        }
    }

    /**
     * 查找目录中的LPC文件
     */
    private async findLPCFiles(dirPath: string): Promise<string[]> {
        const lpcFiles: string[] = [];
        const lpcExtensions = ['.c', '.h', '.lpc', '.i'];

        async function traverse(currentPath: string) {
            const entries = await fsPromises.readdir(currentPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name);

                if (entry.isDirectory()) {
                    await traverse(fullPath);
                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name).toLowerCase();
                    if (lpcExtensions.includes(ext)) {
                        lpcFiles.push(fullPath);
                    }
                }
            }
        }

        await traverse(dirPath);
        return lpcFiles.sort();
    }

    /**
     * 获取文本样本（用于预览）
     */
    private getSample(text: string, start: number, length: number): string {
        const sample = text.substring(start, start + length);
        return sample.length < text.length ? sample + '...' : sample;
    }

    /**
     * 获取内置测试用例
     */
    private getBuiltinTestCases() {
        return [
            {
                name: "基础变量声明",
                description: "测试简单的变量声明格式化",
                code: "int x=5,y=10;string name=\"test\";"
            },
            {
                name: "函数定义",
                description: "测试函数定义的格式化",
                code: `void test(){
if(x>5){
write("hello");
}
}`
            },
            {
                name: "LPC数组语法",
                description: "测试LPC数组字面量格式化",
                code: `string *arr=({"item1","item2","item3"});`
            },
            {
                name: "LPC映射语法",
                description: "测试LPC映射字面量格式化",
                code: `mapping data=(["key1":"value1","key2":"value2"]);`
            },
            {
                name: "函数指针",
                description: "测试LPC函数指针语法格式化",
                code: `function fp=(:write:);`
            },
            {
                name: "表达式函数指针",
                description: "测试LPC表达式函数指针格式化",
                code: `function calc=(:$1+$2:);`
            },
            {
                name: "foreach循环",
                description: "测试foreach循环格式化",
                code: `foreach(string item in array){write(item);}`
            },
            {
                name: "foreach ref语法",
                description: "测试foreach ref语法格式化",
                code: `foreach(ref string item in array){item=upper_case(item);}`
            },
            {
                name: "switch范围匹配",
                description: "测试switch范围匹配语法格式化",
                code: `switch(x){
case 1..5:
write("range 1-5");
break;
case ..10:
write("up to 10");
break;
case 15..:
write("15 and above");
break;
}`
            },
            {
                name: "继承语句",
                description: "测试inherit语句格式化",
                code: `inherit"/std/object";`
            },
            {
                name: "复杂控制结构",
                description: "测试嵌套的控制结构格式化",
                code: `if(x>0){
for(int i=0;i<10;i++){
if(i%2==0){
continue;
}
write(sprintf("Odd: %d",i));
}
}`
            },
            {
                name: "匿名函数",
                description: "测试匿名函数语法格式化",
                code: `function f=function(int a,int b){return a*b;};`
            }
        ];
    }

    /**
     * 生成详细测试报告
     */
    generateReport(summary: TestSummary): string {
        const report = [];

        report.push('');
        report.push('=' .repeat(60));
        report.push('               📊 LPC 格式化测试报告');
        report.push('=' .repeat(60));
        report.push('');

        // 总体统计
        report.push('📈 总体统计:');
        report.push(`   测试文件总数: ${summary.totalFiles}`);
        report.push(`   成功数量: ${summary.successCount}`);
        report.push(`   失败数量: ${summary.failureCount}`);
        report.push(`   成功率: ${summary.totalFiles > 0 ? ((summary.successCount / summary.totalFiles) * 100).toFixed(1) : 0}%`);
        report.push(`   总耗时: ${summary.totalDuration}ms`);
        report.push(`   平均耗时: ${summary.averageDuration.toFixed(1)}ms`);
        report.push(`   整体状态: ${summary.overallSuccess ? '✅ 全部通过' : '❌ 存在失败'}`);
        report.push('');

        // 性能分析
        if (summary.results.length > 0) {
            const durations = summary.results.map(r => r.duration).sort((a, b) => a - b);
            const medianDuration = durations[Math.floor(durations.length / 2)];
            const maxDuration = Math.max(...durations);
            const minDuration = Math.min(...durations);

            report.push('⚡ 性能分析:');
            report.push(`   最快耗时: ${minDuration}ms`);
            report.push(`   最慢耗时: ${maxDuration}ms`);
            report.push(`   中位数耗时: ${medianDuration}ms`);
            report.push('');
        }

        // 失败详情
        const failures = summary.results.filter(r => !r.success);
        if (failures.length > 0) {
            report.push('❌ 失败详情:');
            failures.forEach((failure, index) => {
                report.push(`   ${index + 1}. ${failure.filePath}`);
                if (failure.errors) {
                    failure.errors.forEach(error => {
                        report.push(`      错误: ${error}`);
                    });
                }
            });
            report.push('');
        }

        // 格式化效果分析
        const successfulResults = summary.results.filter(r => r.success && r.formattedLength > 0);
        if (successfulResults.length > 0) {
            const sizeDiffs = successfulResults.map(r => r.formattedLength - r.originalLength);
            const avgSizeChange = sizeDiffs.reduce((sum, diff) => sum + diff, 0) / sizeDiffs.length;

            report.push('📝 格式化效果:');
            report.push(`   成功格式化文件: ${successfulResults.length}`);
            report.push(`   平均大小变化: ${avgSizeChange > 0 ? '+' : ''}${avgSizeChange.toFixed(1)} 字符`);
            report.push('');
        }

        // 示例对比（仅显示前3个成功的结果）
        const sampleResults = summary.results.filter(r => r.success && r.beforeSample && r.afterSample).slice(0, 3);
        if (sampleResults.length > 0) {
            report.push('🔍 格式化示例:');
            sampleResults.forEach((result, index) => {
                report.push(`   ${index + 1}. ${path.basename(result.filePath)}`);
                report.push(`      格式化前: ${result.beforeSample}`);
                report.push(`      格式化后: ${result.afterSample}`);
                report.push('');
            });
        }

        report.push('=' .repeat(60));

        return report.join('\n');
    }

    /**
     * 清理资源
     */
    dispose(): void {
        this.engine.dispose();
    }
}

// 主程序入口
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log(`
🚀 LPC格式化独立测试程序

使用方法:
  --file <path>     测试单个文件
  --dir <path>      批量测试目录中的所有LPC文件
  --builtin         运行内置测试用例
  --all             运行所有测试（内置用例 + 项目文件）
  --help            显示帮助信息

示例:
  ts-node standalone-formatter-test.ts --file test-files/test-formatting.c
  ts-node standalone-formatter-test.ts --dir test-files
  ts-node standalone-formatter-test.ts --builtin
  ts-node standalone-formatter-test.ts --all
        `);
        return;
    }

    const tester = new StandaloneFormatterTester();

    try {
        if (args.includes('--help')) {
            console.log('详细帮助信息已显示在上方');
            return;
        }

        if (args.includes('--file') && args.length >= 2) {
            const filePath = args[args.indexOf('--file') + 1];
            const result = await tester.testFile(filePath);

            const summary: TestSummary = {
                totalFiles: 1,
                successCount: result.success ? 1 : 0,
                failureCount: result.success ? 0 : 1,
                totalDuration: result.duration,
                averageDuration: result.duration,
                results: [result],
                overallSuccess: result.success
            };

            console.log(tester.generateReport(summary));

        } else if (args.includes('--dir') && args.length >= 2) {
            const dirPath = args[args.indexOf('--dir') + 1];
            const summary = await tester.testDirectory(dirPath);
            console.log(tester.generateReport(summary));

        } else if (args.includes('--builtin')) {
            const summary = await tester.runBuiltinTests();
            console.log(tester.generateReport(summary));

        } else if (args.includes('--all')) {
            console.log('🔄 开始全面测试...');

            // 1. 运行内置测试
            const builtinSummary = await tester.runBuiltinTests();

            // 2. 测试项目中的测试文件
            const testFilesPaths = [
                'test-files',
                'test-format.lpc'
            ];

            let allResults: TestResult[] = [...builtinSummary.results];
            let totalDuration = builtinSummary.totalDuration;

            for (const testPath of testFilesPaths) {
                if (fs.existsSync(testPath)) {
                    if (fs.statSync(testPath).isDirectory()) {
                        const dirSummary = await tester.testDirectory(testPath);
                        allResults = [...allResults, ...dirSummary.results];
                        totalDuration += dirSummary.totalDuration;
                    } else {
                        const result = await tester.testFile(testPath);
                        allResults.push(result);
                        totalDuration += result.duration;
                    }
                }
            }

            const successCount = allResults.filter(r => r.success).length;
            const finalSummary: TestSummary = {
                totalFiles: allResults.length,
                successCount,
                failureCount: allResults.length - successCount,
                totalDuration,
                averageDuration: allResults.length > 0 ? totalDuration / allResults.length : 0,
                results: allResults,
                overallSuccess: successCount === allResults.length
            };

            console.log(tester.generateReport(finalSummary));

        } else {
            console.log('❌ 无效的参数。使用 --help 查看使用方法。');
        }

    } catch (error) {
        console.error('❌ 程序执行失败:', error instanceof Error ? error.message : String(error));
        process.exit(1);
    } finally {
        tester.dispose();
    }
}

// 运行主程序
if (require.main === module) {
    main().catch(error => {
        console.error('💥 未处理的错误:', error);
        process.exit(1);
    });
}

export { StandaloneFormatterTester };
export type { TestResult, TestSummary };