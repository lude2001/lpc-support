#!/usr/bin/env node

/**
 * 独立LPC格式化引擎
 *
 * 这是一个简化版的格式化引擎，移除了对VS Code API的依赖
 * 专门用于命令行环境下的独立测试
 */

import * as fs from 'fs';
import * as path from 'path';
import { promises as fsPromises } from 'fs';

// 导入ANTLR解析器
import { CharStreams, CommonTokenStream } from 'antlr4ts';
import { LPCLexer } from './src/antlr/LPCLexer';
import { LPCParser, SourceFileContext } from './src/antlr/LPCParser';
import { FormattingConfig } from './src/formatting/config/FormattingConfig';
import { DEFAULT_FORMATTING_CONFIG } from './src/formatting/config/DefaultConfig';

// 简化的诊断接口（替代VS Code的Diagnostic）
interface SimpleDiagnostic {
    line: number;
    column: number;
    message: string;
    severity: 'error' | 'warning' | 'info';
}

// 简化的格式化结果接口
interface SimpleFormattingResult {
    success: boolean;
    formattedText?: string;
    errors?: string[];
    warnings?: string[];
    duration: number;
}

// 简化的错误监听器
class SimpleErrorListener {
    public diagnostics: SimpleDiagnostic[] = [];

    syntaxError(
        recognizer: any,
        offendingSymbol: any,
        line: number,
        charPositionInLine: number,
        msg: string,
        e: any
    ): void {
        this.diagnostics.push({
            line: line - 1, // ANTLR使用1基数，我们转换为0基数
            column: charPositionInLine,
            message: msg,
            severity: 'error'
        });
    }
}

/**
 * 独立格式化引擎
 */
class StandaloneFormattingEngine {
    private config: FormattingConfig;

    constructor(config: FormattingConfig = DEFAULT_FORMATTING_CONFIG) {
        this.config = config;
    }

    /**
     * 格式化文本内容
     */
    async formatText(text: string, filePath?: string): Promise<SimpleFormattingResult> {
        const startTime = Date.now();

        try {
            // 解析文本
            const parseResult = this.parseText(text);

            if (parseResult.errors && parseResult.errors.length > 0) {
                // 有语法错误，尝试部分格式化
                const partialResult = this.attemptPartialFormatting(text, parseResult.errors);
                return {
                    ...partialResult,
                    duration: Date.now() - startTime
                };
            }

            // 执行格式化
            const formattedText = this.performFormatting(text, parseResult.tree);

            return {
                success: true,
                formattedText,
                duration: Date.now() - startTime
            };

        } catch (error) {
            return {
                success: false,
                errors: [error instanceof Error ? error.message : String(error)],
                duration: Date.now() - startTime
            };
        }
    }

    /**
     * 解析文本
     */
    private parseText(text: string): {
        tree: SourceFileContext;
        tokens: CommonTokenStream;
        errors?: SimpleDiagnostic[];
    } {
        const input = CharStreams.fromString(text);
        const lexer = new LPCLexer(input);
        const tokens = new CommonTokenStream(lexer);
        const parser = new LPCParser(tokens);

        // 添加错误监听器
        const errorListener = new SimpleErrorListener();
        parser.removeErrorListeners();
        parser.addErrorListener(errorListener);

        const tree = parser.sourceFile();

        return {
            tree,
            tokens,
            errors: errorListener.diagnostics.length > 0 ? errorListener.diagnostics : undefined
        };
    }

    /**
     * 执行格式化（简化版）
     */
    private performFormatting(text: string, tree: SourceFileContext): string {
        // 这是一个简化的格式化实现
        // 在真实项目中，这里会使用完整的FormattingVisitor

        let formatted = text;

        // 应用基础格式化规则
        formatted = this.applyBasicFormatting(formatted);

        return formatted;
    }

    /**
     * 应用基础格式化规则
     */
    private applyBasicFormatting(text: string): string {
        let formatted = text;

        // 1. 标准化空格 (避免在字符串内部添加空格)
        if (this.config.spaceAroundOperators) {
            // 保护字符串内容不被修改
            const stringLiterals: string[] = [];
            let stringIndex = 0;

            // 暂时替换字符串字面量
            formatted = formatted.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match) => {
                stringLiterals.push(match);
                return `__STRING_${stringIndex++}__`;
            });

            // 在操作符周围添加空格 (更精确的正则表达式)
            formatted = formatted.replace(/(\w)=([^=\s])/g, '$1 = $2');
            formatted = formatted.replace(/(\w)==([^\s])/g, '$1 == $2');
            formatted = formatted.replace(/(\w)!=([^\s])/g, '$1 != $2');
            formatted = formatted.replace(/(\w)<([^=\s])/g, '$1 < $2');
            formatted = formatted.replace(/(\w)>([^=\s])/g, '$1 > $2');
            formatted = formatted.replace(/(\w)<=([^\s])/g, '$1 <= $2');
            formatted = formatted.replace(/(\w)>=([^\s])/g, '$1 >= $2');
            formatted = formatted.replace(/(\w|\$\d+)\+([\w\$])/g, '$1 + $2');
            formatted = formatted.replace(/(\w|\$\d+)-([\w\$])/g, '$1 - $2');
            formatted = formatted.replace(/(\w|\$\d+)\*([\w\$])/g, '$1 * $2');
            formatted = formatted.replace(/(\w|\$\d+)\/([\w\$])/g, '$1 / $2');
            formatted = formatted.replace(/(\w|\$\d+)%([\w\$])/g, '$1 % $2');

            // 恢复字符串字面量
            stringLiterals.forEach((str, index) => {
                formatted = formatted.replace(`__STRING_${index}__`, str);
            });
        }

        // 2. 逗号后添加空格
        if (this.config.spaceAfterComma) {
            formatted = formatted.replace(/,([^\s])/g, ', $1');
        }

        // 3. 分号后添加空格（在for循环中）
        if (this.config.spaceAfterSemicolon) {
            formatted = formatted.replace(/;([^\s\n}])/g, '; $1');
        }

        // 4. 处理LPC特有语法
        if (this.config.formatArrays) {
            // 格式化数组字面量
            formatted = formatted.replace(/\(\{([^}]+)\}\)/g, (match, content) => {
                const items = content.split(',').map((item: string) => item.trim());
                return `({ ${items.join(', ')} })`;
            });
        }

        // 修复指针类型声明的空格问题
        formatted = formatted.replace(/(\w)\s\s+\*(\s+\w)/g, '$1 *$2');
        // 确保指针符号和变量名之间有一个空格
        formatted = formatted.replace(/(\w)\s*\*(\w)/g, '$1 *$2');
        formatted = formatted.replace(/(\w)\*([\s]+\w)/g, '$1 * $2');

        if (this.config.formatMappings) {
            // 格式化映射字面量
            formatted = formatted.replace(/\(\[([^\]]+)\]\)/g, (match, content) => {
                const pairs = content.split(',').map((pair: string) => {
                    const [key, value] = pair.split(':').map((s: string) => s.trim());
                    return `${key}: ${value}`;
                });
                return `([ ${pairs.join(', ')} ])`;
            });
        }

        if (this.config.formatFunctionPointers) {
            // 格式化函数指针
            formatted = formatted.replace(/\(:\s*([^:]+)\s*:\)/g, '(: $1 :)');
        }

        // 5. 关键字后添加空格
        if (this.config.spaceAfterKeywords) {
            formatted = formatted.replace(/\b(if|while|for|foreach|switch|catch|return)\(/g, '$1 (');
            // inherit语句特殊处理
            formatted = formatted.replace(/\binherit"([^"]+)"/g, 'inherit "$1"');
            formatted = formatted.replace(/\binherit\s+"([^"]+)"/g, 'inherit "$1"');
        }

        // 修复在函数指针中的过度格式化
        formatted = formatted.replace(/\(:\s*(\$\d+)\s*\+\s*(\$\d+)\s*:\)/g, '(: $1 + $2 :)');

        // 6. 大括号前添加空格
        if (this.config.spaceBeforeOpenBrace) {
            formatted = formatted.replace(/([^\s])\{/g, '$1 {');
        }

        // 最后清理多余的空格
        formatted = formatted.replace(/\s+/g, ' ');
        formatted = formatted.replace(/\s+;/g, ';');
        formatted = formatted.replace(/\s+,/g, ',');
        formatted = formatted.replace(/,([^\s])/g, ', $1');
        formatted = formatted.replace(/;([^\s\n}])/g, '; $1');

        // 7. 移除行尾空白
        if (this.config.trimTrailingWhitespace) {
            formatted = formatted.replace(/[ \t]+$/gm, '');
        }

        // 8. 添加文件末尾换行符
        if (this.config.insertFinalNewline && !formatted.endsWith('\n')) {
            formatted += '\n';
        }

        return formatted;
    }

    /**
     * 尝试部分格式化（当有语法错误时）
     */
    private attemptPartialFormatting(text: string, errors: SimpleDiagnostic[]): SimpleFormattingResult {
        try {
            const lines = text.split('\n');
            const errorLines = new Set(errors.map(err => err.line));

            // 只格式化没有语法错误的行
            const formattedLines = lines.map((line, index) => {
                if (errorLines.has(index)) {
                    return line; // 保持有错误的行不变
                }
                return this.applyBasicFormatting(line);
            });

            return {
                success: true,
                formattedText: formattedLines.join('\n'),
                warnings: [`格式化时跳过了 ${errorLines.size} 行语法错误`],
                duration: 0
            };

        } catch (error) {
            return {
                success: false,
                errors: [`部分格式化失败: ${error instanceof Error ? error.message : String(error)}`],
                duration: 0
            };
        }
    }

    /**
     * 更新配置
     */
    updateConfig(config: Partial<FormattingConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * 获取当前配置
     */
    getConfig(): FormattingConfig {
        return { ...this.config };
    }
}

// 测试相关接口和类
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

/**
 * 独立格式化测试器
 */
class StandaloneFormatterTester {
    private engine: StandaloneFormattingEngine;

    constructor(customConfig?: Partial<FormattingConfig>) {
        const config = { ...DEFAULT_FORMATTING_CONFIG, ...customConfig };
        this.engine = new StandaloneFormattingEngine(config);
    }

    /**
     * 测试单个文件
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
     * 批量测试目录
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

        return {
            totalFiles: results.length,
            successCount,
            failureCount: results.length - successCount,
            totalDuration,
            averageDuration: results.length > 0 ? totalDuration / results.length : 0,
            results,
            overallSuccess: successCount === results.length
        };
    }

    /**
     * 运行内置测试
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

        return {
            totalFiles: results.length,
            successCount,
            failureCount: results.length - successCount,
            totalDuration,
            averageDuration: results.length > 0 ? totalDuration / results.length : 0,
            results,
            overallSuccess: successCount === results.length
        };
    }

    /**
     * 测试文本内容
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

            // 显示格式化前后对比
            if (result.success && result.formattedText) {
                console.log(`   🔍 格式化效果:`);
                console.log(`     格式化前: ${beforeSample.replace(/\n/g, '\\n')}`);
                console.log(`     格式化后: ${afterSample.replace(/\n/g, '\\n')}`);
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
     * 查找LPC文件
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
     * 获取文本样本
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
                code: `void test(){if(x>5){write("hello");}}`
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
                name: "继承语句",
                description: "测试inherit语句格式化",
                code: `inherit"/std/object";`
            },
            {
                name: "复杂表达式",
                description: "测试复杂表达式格式化",
                code: `result=a+b*c-d/e%f;`
            },
            {
                name: "控制结构",
                description: "测试控制结构格式化",
                code: `if(x>0)write("positive");else write("non-positive");`
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

        // 示例对比
        const sampleResults = summary.results.filter(r => r.success && r.beforeSample && r.afterSample).slice(0, 3);
        if (sampleResults.length > 0) {
            report.push('🔍 格式化示例:');
            sampleResults.forEach((result, index) => {
                report.push(`   ${index + 1}. ${path.basename(result.filePath)}`);
                report.push(`      格式化前: ${(result.beforeSample || '').replace(/\n/g, '\\n')}`);
                report.push(`      格式化后: ${(result.afterSample || '').replace(/\n/g, '\\n')}`);
                report.push('');
            });
        }

        report.push('=' .repeat(60));
        return report.join('\n');
    }
}

// 主程序入口
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log(`
🚀 LPC格式化独立测试程序 (简化版)

使用方法:
  --file <path>     测试单个文件
  --dir <path>      批量测试目录中的所有LPC文件
  --builtin         运行内置测试用例
  --all             运行所有测试（内置用例 + 项目文件）
  --help            显示帮助信息

示例:
  ts-node standalone-formatter.ts --file test-files/test-formatting.c
  ts-node standalone-formatter.ts --dir test-files
  ts-node standalone-formatter.ts --builtin
  ts-node standalone-formatter.ts --all
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
    }
}

// 运行主程序
if (require.main === module) {
    main().catch(error => {
        console.error('💥 未处理的错误:', error);
        process.exit(1);
    });
}

export { StandaloneFormattingEngine, StandaloneFormatterTester };
export type { TestResult, TestSummary };