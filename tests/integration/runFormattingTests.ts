import * as vscode from 'vscode';
import * as path from 'path';
import { FormattingTestSuite } from './FormattingTestSuite';

/**
 * 格式化测试运行器
 * 
 * 这个脚本提供了一个便捷的方式来运行LPC格式化测试套件，
 * 可以通过VS Code命令面板或者直接在代码中调用来执行测试。
 * 
 * 主要功能：
 * - 预定义的LPC代码测试用例
 * - 快速测试单个功能点
 * - 完整的回归测试
 * - 测试结果展示和分析
 */

/**
 * 运行格式化测试的主入口函数
 */
export async function runFormattingTests(): Promise<void> {
    console.log('🚀 开始运行LPC格式化测试...');
    
    const testSuite = new FormattingTestSuite({
        outputDirectory: path.join(__dirname, '../output/formatting-tests'),
        enableDetailedLogging: true,
        enablePerformanceMonitoring: true,
        enableQualityAnalysis: true
    });
    
    try {
        // 运行完整的测试套件
        const result = await testSuite.runFullTestSuite();
        
        // 显示测试结果
        displayTestResults(result);
        
    } catch (error) {
        console.error('❌ 测试执行失败:', error);
        vscode.window.showErrorMessage(`格式化测试失败: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * 运行基础文档格式化测试
 */
export async function runBasicDocumentFormattingTests(): Promise<void> {
    console.log('📄 运行基础文档格式化测试...');
    
    const testSuite = new FormattingTestSuite();
    
    // 测试用例1: 简单的函数定义
    await testSuite.testDocumentFormatting(
        `int add(int a,int b){
return a+b;
}`,
        'basic-function-definition'
    );
    
    // 测试用例2: 复杂的映射数组
    await testSuite.testDocumentFormatting(
        `mapping data=(["name":"test","value":100,"active":1,]);`,
        'mapping-array-formatting'
    );
    
    // 测试用例3: 多层嵌套结构
    await testSuite.testDocumentFormatting(
        `void test(){if(condition){for(int i=0;i<10;i++){print("test");}}else{return;}}`,
        'nested-structure-formatting'
    );
    
    // 测试用例4: Include语句和宏定义
    await testSuite.testDocumentFormatting(
        `#include <lib.h>
#define MAX_SIZE 100
int array[MAX_SIZE];`,
        'include-and-macro-formatting'
    );
    
    console.log('✅ 基础文档格式化测试完成');
}

/**
 * 运行范围格式化测试
 */
export async function runRangeFormattingTests(): Promise<void> {
    console.log('📐 运行范围格式化测试...');
    
    const testSuite = new FormattingTestSuite();
    
    const testCode = `#include <lib.h>

int unformatted_function(int a,int b){
int result=a+b;
if(result>0){
return result;
}else{
return 0;
}
}

void another_function() {
    // This should not be affected
    print("Hello World");
}`;
    
    // 只格式化第一个函数 (第2-8行)
    await testSuite.testRangeFormatting(
        testCode,
        2, // 开始行
        8, // 结束行
        'range-formatting-single-function'
    );
    
    console.log('✅ 范围格式化测试完成');
}

/**
 * 运行输入时格式化测试
 */
export async function runOnTypeFormattingTests(): Promise<void> {
    console.log('⌨️ 运行输入时格式化测试...');
    
    const testSuite = new FormattingTestSuite();
    
    // 测试1: 输入右大括号后的格式化
    await testSuite.testOnTypeFormatting(
        `void test() {
    if (condition) {
        print("hello");
    }`,
        { line: 3, character: 5 }, // 右大括号位置
        '}',
        'on-type-closing-brace'
    );
    
    // 测试2: 输入分号后的格式化
    await testSuite.testOnTypeFormatting(
        `int result = a + b  ;`,
        { line: 0, character: 21 }, // 分号位置
        ';',
        'on-type-semicolon'
    );
    
    // 测试3: 输入右圆括号后的格式化
    await testSuite.testOnTypeFormatting(
        `if (condition   )`,
        { line: 0, character: 17 }, // 右圆括号位置
        ')',
        'on-type-closing-paren'
    );
    
    console.log('✅ 输入时格式化测试完成');
}

/**
 * 运行性能基准测试
 */
export async function runPerformanceBenchmark(): Promise<void> {
    console.log('⚡ 运行性能基准测试...');
    
    const testSuite = new FormattingTestSuite();
    
    const benchmarkResult = await testSuite.runPerformanceBenchmark();
    
    console.log('📊 性能测试结果:', benchmarkResult);
    
    // 在VS Code中显示性能结果
    const message = `格式化性能测试完成!\n平均性能: ${benchmarkResult.summary.averagePerformance.toFixed(2)} 行/秒`;
    vscode.window.showInformationMessage(message);
}

/**
 * 测试真实LPC文件
 */
export async function testRealLPCFiles(): Promise<void> {
    console.log('📁 测试真实LPC文件...');
    
    // 获取当前工作区中的LPC文件目录
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showWarningMessage('请先打开一个LPC项目工作区');
        return;
    }
    
    const testSuite = new FormattingTestSuite();
    
    // 测试工作区中的LPC文件
    const testDirectory = path.join(workspaceFolders[0].uri.fsPath, 'test', 'lpc_code');
    
    try {
        const results = await testSuite.testLPCFilesInDirectory(testDirectory);
        
        const successCount = results.filter(r => r.success).length;
        const totalCount = results.length;
        
        const message = `LPC文件测试完成!\n成功: ${successCount}/${totalCount} 文件`;
        
        if (successCount === totalCount) {
            vscode.window.showInformationMessage(message);
        } else {
            vscode.window.showWarningMessage(message);
        }
        
        console.log('📈 测试结果详情:', results);
        
    } catch (error) {
        console.error('测试真实文件时出错:', error);
        vscode.window.showErrorMessage(`测试LPC文件失败: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * 快速诊断格式化问题
 * 
 * 这个函数用于快速诊断当前打开文件的格式化问题
 */
export async function quickFormattingDiagnosis(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('请先打开一个LPC文件');
        return;
    }
    
    if (!editor.document.fileName.endsWith('.c') && !editor.document.fileName.endsWith('.h')) {
        vscode.window.showWarningMessage('当前文件不是LPC文件');
        return;
    }
    
    console.log('🔍 开始快速格式化诊断...');
    
    const testSuite = new FormattingTestSuite({
        outputDirectory: path.join(__dirname, '../output/quick-diagnosis'),
        enableDetailedLogging: true,
        enablePerformanceMonitoring: true,
        enableQualityAnalysis: true
    });
    
    const fileName = path.basename(editor.document.fileName);
    const content = editor.document.getText();
    
    try {
        const result = await testSuite.testDocumentFormatting(
            content,
            `quick-diagnosis-${fileName}`,
            {
                // 使用当前编辑器的格式化设置
                tabSize: editor.options.tabSize as number || 4,
                insertSpaces: editor.options.insertSpaces as boolean || true
            }
        );
        
        // 显示诊断结果
        displayQuickDiagnosisResult(result, fileName);
        
    } catch (error) {
        console.error('快速诊断失败:', error);
        vscode.window.showErrorMessage(`格式化诊断失败: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * 显示测试结果
 */
function displayTestResults(result: any): void {
    console.log('📊 测试结果汇总:');
    console.log(`总测试数: ${result.totalTests}`);
    console.log(`通过测试: ${result.passedTests}`);
    console.log(`失败测试: ${result.failedTests}`);
    console.log(`执行时间: ${result.executionTime}ms`);
    
    if (result.success) {
        const successRate = ((result.passedTests / result.totalTests) * 100).toFixed(1);
        vscode.window.showInformationMessage(
            `LPC格式化测试完成! 成功率: ${successRate}% (${result.passedTests}/${result.totalTests})`
        );
    } else {
        vscode.window.showErrorMessage(
            `LPC格式化测试失败! 失败测试: ${result.failedTests}/${result.totalTests}`
        );
    }
}

/**
 * 显示快速诊断结果
 */
function displayQuickDiagnosisResult(result: any, fileName: string): void {
    console.log(`🔍 ${fileName} 格式化诊断结果:`);
    console.log(`质量分数: ${result.qualityScore}/100`);
    console.log(`执行时间: ${result.executionTime}ms`);
    
    if (result.issues && result.issues.length > 0) {
        console.log('发现的问题:');
        result.issues.forEach((issue: any, index: number) => {
            console.log(`  ${index + 1}. [${issue.severity}] ${issue.message}`);
        });
    }
    
    let message: string;
    if (result.success && result.qualityScore >= 80) {
        message = `✅ ${fileName} 格式化质量良好 (${result.qualityScore}/100)`;
        vscode.window.showInformationMessage(message);
    } else if (result.success && result.qualityScore >= 60) {
        message = `⚠️ ${fileName} 格式化质量一般 (${result.qualityScore}/100)`;
        vscode.window.showWarningMessage(message);
    } else {
        message = `❌ ${fileName} 格式化存在问题 (${result.qualityScore}/100)`;
        vscode.window.showErrorMessage(message);
    }
}

// 导出用于VS Code命令的便捷函数
export const FormattingTestCommands = {
    runAllTests: runFormattingTests,
    runBasicTests: runBasicDocumentFormattingTests,
    runRangeTests: runRangeFormattingTests,
    runOnTypeTests: runOnTypeFormattingTests,
    runPerformanceTests: runPerformanceBenchmark,
    testRealFiles: testRealLPCFiles,
    quickDiagnosis: quickFormattingDiagnosis
};
