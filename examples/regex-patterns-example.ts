/**
 * RegexPatterns 工具类使用示例
 *
 * 本文件展示了如何在实际场景中使用 RegexPatterns 工具类
 * 包括性能优化前后的对比和最佳实践
 */

import * as vscode from 'vscode';
import { getRegexPatterns } from '../src/utils/regexPatterns';

// ============================================================================
// 示例 1: 对象访问检测（优化前 vs 优化后）
// ============================================================================

/**
 * ❌ 性能差的实现：在循环中重复创建正则
 */
function collectObjectAccessBad(text: string): string[] {
    const results: string[] = [];
    const lines = text.split('\n');

    // 问题：每次循环都创建新的正则对象
    for (const line of lines) {
        const regex = /\b([A-Z_][A-Z0-9_]*)\s*(->|\.)\s*([a-zA-Z_][a-zA-Z0-9_]*)/g;
        let match;
        while ((match = regex.exec(line)) !== null) {
            results.push(`${match[1]}${match[2]}${match[3]}`);
        }
    }

    return results;
}

/**
 * ✅ 性能好的实现：使用预编译的正则
 */
function collectObjectAccessGood(text: string): string[] {
    const results: string[] = [];
    const patterns = getRegexPatterns();
    const regex = patterns.objectAccess;

    // 只创建一次正则对象，重复使用
    patterns.resetRegex(regex);
    let match;
    while ((match = regex.exec(text)) !== null) {
        results.push(`${match[1]}${match[2]}${match[3]}`);
    }

    return results;
}

// ============================================================================
// 示例 2: 诊断收集器实现
// ============================================================================

/**
 * 使用 RegexPatterns 实现高效的诊断收集器
 */
class ObjectAccessDiagnosticsCollector {
    private patterns = getRegexPatterns();

    collect(document: vscode.TextDocument): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        const text = document.getText();
        const regex = this.patterns.objectAccess;

        // 重置正则状态
        this.patterns.resetRegex(regex);

        let match;
        while ((match = regex.exec(text)) !== null) {
            const [fullMatch, object, accessor, member, isFunction] = match;
            const startPos = match.index;

            // 检查对象命名规范
            if (!this.patterns.test(this.patterns.objectNaming, object)) {
                const range = new vscode.Range(
                    document.positionAt(startPos),
                    document.positionAt(startPos + object.length)
                );
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    '对象名应该使用大写字母和下划线，例如: USER_OB',
                    vscode.DiagnosticSeverity.Warning
                ));
            }

            // 检查宏定义
            if (this.patterns.test(this.patterns.macroNaming, object)) {
                // 这是一个宏定义，进行特殊处理
                diagnostics.push(...this.checkMacroUsage(object, startPos, document));
            }

            // 检查成员命名规范
            if (!this.patterns.test(this.patterns.memberNaming, member)) {
                const memberStartPos = startPos + object.length + accessor.length;
                const range = new vscode.Range(
                    document.positionAt(memberStartPos),
                    document.positionAt(memberStartPos + member.length)
                );
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    '成员名应该使用小写字母开头的驼峰命名法',
                    vscode.DiagnosticSeverity.Information
                ));
            }
        }

        return diagnostics;
    }

    private checkMacroUsage(
        macroName: string,
        position: number,
        document: vscode.TextDocument
    ): vscode.Diagnostic[] {
        // 宏使用检查的实现
        return [];
    }
}

// ============================================================================
// 示例 3: 变量使用检测
// ============================================================================

/**
 * 检测变量是否在代码中被使用（排除仅赋值的情况）
 */
class VariableUsageChecker {
    private patterns = getRegexPatterns();

    /**
     * 检查变量是否被使用
     *
     * @param varName 变量名
     * @param code 要检查的代码
     * @returns 是否被使用，以及使用场景
     */
    checkUsage(varName: string, code: string): { isUsed: boolean; contexts: string[] } {
        const contexts: string[] = [];
        const usagePatterns = this.patterns.createVariableUsagePatterns(varName);

        for (const { pattern, description } of usagePatterns) {
            this.patterns.resetRegex(pattern);
            if (pattern.test(code)) {
                contexts.push(description);
            }
        }

        // 如果没有匹配到特定模式，使用通用检测
        if (contexts.length === 0) {
            const generalPattern = new RegExp(`\\b${varName}\\b`, 'g');
            this.patterns.resetRegex(generalPattern);

            let match;
            while ((match = generalPattern.exec(code)) !== null) {
                const index = match.index;
                const afterVar = code.substring(index + varName.length);

                // 检查是否是简单赋值的左值
                if (!this.patterns.test(this.patterns.simpleAssignmentLHS, afterVar)) {
                    contexts.push('表达式中使用');
                    break;
                }
            }
        }

        return {
            isUsed: contexts.length > 0,
            contexts
        };
    }

    /**
     * 查找未使用的变量
     */
    findUnusedVariables(document: vscode.TextDocument): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        const text = document.getText();

        // 使用动态生成的变量声明模式
        const varPattern = this.patterns.createVariableDeclPattern(
            ['int', 'string', 'object', 'mapping', 'mixed', 'void'],
            ['private', 'protected', 'public', 'static', 'nosave']
        );

        this.patterns.resetRegex(varPattern);
        let match;

        while ((match = varPattern.exec(text)) !== null) {
            const varDeclarations = match[3];
            const vars = varDeclarations.split(',').map(v => v.trim().replace(/^\*/, ''));

            for (const varName of vars) {
                const declarationIndex = match.index;
                const codeAfterDeclaration = text.slice(declarationIndex + match[0].length);

                const { isUsed, contexts } = this.checkUsage(varName, codeAfterDeclaration);

                if (!isUsed) {
                    const range = new vscode.Range(
                        document.positionAt(declarationIndex),
                        document.positionAt(declarationIndex + match[0].length)
                    );

                    diagnostics.push(new vscode.Diagnostic(
                        range,
                        `变量 '${varName}' 已声明但未使用`,
                        vscode.DiagnosticSeverity.Hint
                    ));
                } else {
                    console.log(`变量 ${varName} 在以下场景使用: ${contexts.join(', ')}`);
                }
            }
        }

        return diagnostics;
    }
}

// ============================================================================
// 示例 4: 函数和全局变量收集
// ============================================================================

/**
 * 收集文档中的函数和全局变量
 */
class SymbolCollector {
    private patterns = getRegexPatterns();

    collectSymbols(document: vscode.TextDocument) {
        const text = document.getText();
        const symbols = {
            functions: [] as Array<{ name: string; returnType: string; position: vscode.Position }>,
            globals: [] as Array<{ name: string; type: string; position: vscode.Position }>
        };

        // 收集函数
        const funcPattern = this.patterns.createFunctionDeclPattern(
            ['int', 'void', 'string', 'object', 'mapping', 'mixed'],
            ['static', 'private', 'public', 'protected', 'nomask', 'varargs']
        );

        this.patterns.resetRegex(funcPattern);
        let match;

        while ((match = funcPattern.exec(text)) !== null) {
            const returnType = match[2];
            const funcName = match[3];
            const position = document.positionAt(match.index);

            symbols.functions.push({ name: funcName, returnType, position });
        }

        // 收集全局变量
        const globalPattern = this.patterns.createGlobalVariablePattern(
            ['int', 'string', 'object', 'mapping', 'mixed'],
            ['private', 'nosave', 'protected']
        );

        // 需要排除函数内的局部变量
        const functionRanges = this.getFunctionRanges(text);

        this.patterns.resetRegex(globalPattern);

        while ((match = globalPattern.exec(text)) !== null) {
            const matchStart = match.index;

            // 检查是否在函数内
            const isInFunction = functionRanges.some(
                range => matchStart > range.start && matchStart < range.end
            );

            if (!isInFunction) {
                const varType = match[1];
                const varName = match[2];
                const position = document.positionAt(matchStart);

                symbols.globals.push({ name: varName, type: varType, position });
            }
        }

        return symbols;
    }

    private getFunctionRanges(text: string): Array<{ start: number; end: number }> {
        const ranges: Array<{ start: number; end: number }> = [];
        const funcPattern = this.patterns.createFunctionDeclPattern(
            ['int', 'void', 'string', 'object', 'mapping', 'mixed'],
            ['static', 'private', 'public', 'protected', 'nomask', 'varargs']
        );

        this.patterns.resetRegex(funcPattern);
        let match;

        while ((match = funcPattern.exec(text)) !== null) {
            const start = match.index;
            let bracketCount = 0;
            let currentIndex = start;

            // 找到函数块的结束位置
            while (currentIndex < text.length) {
                const char = text[currentIndex];
                if (char === '{') {
                    bracketCount++;
                } else if (char === '}') {
                    bracketCount--;
                    if (bracketCount === 0) {
                        ranges.push({ start, end: currentIndex });
                        break;
                    }
                }
                currentIndex++;
            }
        }

        return ranges;
    }
}

// ============================================================================
// 示例 5: 性能比较测试
// ============================================================================

/**
 * 性能测试：对比使用 RegexPatterns 前后的性能差异
 */
async function performanceTest() {
    const testCode = `
        USER_OB->query_name();
        WEAPON_OB->set_damage(10);
        NPC_OB->move_to(ROOM_OB);
    `.repeat(1000); // 重复1000次，模拟大文件

    console.log('=== 性能测试开始 ===\n');

    // 测试旧方法
    const oldStart = Date.now();
    const oldResult = collectObjectAccessBad(testCode);
    const oldTime = Date.now() - oldStart;
    console.log(`❌ 旧方法（重复创建正则）：${oldTime}ms`);
    console.log(`   找到 ${oldResult.length} 个匹配项\n`);

    // 测试新方法
    const newStart = Date.now();
    const newResult = collectObjectAccessGood(testCode);
    const newTime = Date.now() - newStart;
    console.log(`✅ 新方法（预编译正则）：${newTime}ms`);
    console.log(`   找到 ${newResult.length} 个匹配项\n`);

    // 计算性能提升
    const improvement = ((oldTime - newTime) / oldTime * 100).toFixed(2);
    console.log(`⚡ 性能提升：${improvement}%`);
    console.log(`   速度提升：${(oldTime / newTime).toFixed(2)}x`);

    console.log('\n=== 性能测试结束 ===');
}

// ============================================================================
// 示例 6: 批量处理优化
// ============================================================================

/**
 * 批量处理文档时的优化策略
 */
class BatchDiagnosticsProcessor {
    private patterns = getRegexPatterns();

    /**
     * 高效地处理多个文档
     */
    async processBatch(documents: vscode.TextDocument[]): Promise<Map<string, vscode.Diagnostic[]>> {
        const results = new Map<string, vscode.Diagnostic[]>();

        // 预先准备所有需要的正则模式
        const regexes = [
            this.patterns.objectAccess,
            this.patterns.inheritStatement,
            this.patterns.includeStatement
        ];

        for (const document of documents) {
            // 批量重置所有正则状态
            this.patterns.resetAllRegexes(regexes);

            const diagnostics: vscode.Diagnostic[] = [];
            const text = document.getText();

            // 处理对象访问
            let match;
            while ((match = this.patterns.objectAccess.exec(text)) !== null) {
                // 处理匹配结果
            }

            // 处理继承语句
            while ((match = this.patterns.inheritStatement.exec(text)) !== null) {
                // 处理匹配结果
            }

            // 处理包含语句
            while ((match = this.patterns.includeStatement.exec(text)) !== null) {
                // 处理匹配结果
            }

            results.set(document.uri.toString(), diagnostics);
        }

        return results;
    }
}

// ============================================================================
// 示例 7: 缓存管理
// ============================================================================

/**
 * 配置管理器：演示如何在配置更改时管理缓存
 */
class ConfigurationManager {
    private patterns = getRegexPatterns();
    private currentConfig: { types: string[]; modifiers: string[] } | null = null;

    /**
     * 更新配置并清理缓存
     */
    updateConfiguration(types: string[], modifiers: string[]) {
        // 检查配置是否真的变化
        const configChanged =
            !this.currentConfig ||
            JSON.stringify(this.currentConfig.types) !== JSON.stringify(types) ||
            JSON.stringify(this.currentConfig.modifiers) !== JSON.stringify(modifiers);

        if (configChanged) {
            console.log('配置已更改，清除正则缓存...');

            // 清除旧缓存
            this.patterns.clearCache();

            // 保存新配置
            this.currentConfig = { types, modifiers };

            console.log(`缓存已清除，当前缓存大小: ${this.patterns.getCacheSize()}`);
        }
    }

    /**
     * 监控缓存大小
     */
    monitorCacheSize() {
        const size = this.patterns.getCacheSize();
        console.log(`当前缓存的正则模式数量: ${size}`);

        // 如果缓存过大，可以考虑清理
        if (size > 100) {
            console.warn('缓存过大，建议清理');
            this.patterns.clearCache();
        }
    }
}

// ============================================================================
// 导出示例类和函数
// ============================================================================

export {
    ObjectAccessDiagnosticsCollector,
    VariableUsageChecker,
    SymbolCollector,
    BatchDiagnosticsProcessor,
    ConfigurationManager,
    performanceTest
};
