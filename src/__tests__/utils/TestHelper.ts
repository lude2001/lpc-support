/**
 * 测试辅助工具类
 * 提供创建Mock对象和测试数据的工具函数
 */

// 使用静态导入以支持jest的moduleNameMapper
// jest会将vscode模块自动映射到MockVSCode
import * as vscode from 'vscode';

export class TestHelper {
    /**
     * 创建Mock文档对象
     */
    static createMockDocument(content: string, languageId = 'lpc', fileName = 'test.c'): vscode.TextDocument {
        const lines = content.split('\n');

        return {
            fileName,
            languageId,
            uri: vscode.Uri.parse(`file:///${fileName}`),
            version: 1,
            lineCount: lines.length,
            isDirty: false,
            isClosed: false,
            eol: vscode.EndOfLine.LF,

            getText: (range?: vscode.Range) => {
                if (!range) {
                    return content;
                }
                // 简化的范围文本提取
                return content.substring(
                    range.start.character,
                    range.end.character
                );
            },

            lineAt: (line: number) => ({
                lineNumber: line,
                text: lines[line] || '',
                range: new vscode.Range(line, 0, line, (lines[line] || '').length),
                rangeIncludingLineBreak: new vscode.Range(line, 0, line + 1, 0),
                firstNonWhitespaceCharacterIndex: (lines[line] || '').search(/\S/),
                isEmptyOrWhitespace: !/\S/.test(lines[line] || '')
            }),

            positionAt: (offset: number) => {
                let line = 0;
                let character = offset;
                let currentOffset = 0;

                for (let i = 0; i < lines.length; i++) {
                    const lineLength = lines[i].length + 1; // +1 for newline
                    if (currentOffset + lineLength > offset) {
                        line = i;
                        character = offset - currentOffset;
                        break;
                    }
                    currentOffset += lineLength;
                }

                return new vscode.Position(line, character);
            },

            offsetAt: (position: vscode.Position) => {
                let offset = 0;
                for (let i = 0; i < position.line && i < lines.length; i++) {
                    offset += lines[i].length + 1; // +1 for newline
                }
                return offset + position.character;
            },

            save: () => Promise.resolve(true),

            validateRange: (range: vscode.Range) => range,
            validatePosition: (position: vscode.Position) => position
        } as vscode.TextDocument;
    }

    /**
     * 创建Mock位置对象
     */
    static createMockPosition(line: number, character: number): vscode.Position {
        return new vscode.Position(line, character);
    }

    /**
     * 创建Mock范围对象
     */
    static createMockRange(startLine: number, startChar: number, endLine: number, endChar: number): vscode.Range {
        return new vscode.Range(
            new vscode.Position(startLine, startChar),
            new vscode.Position(endLine, endChar)
        );
    }


    /**
     * 等待条件满足
     */
    static async waitForCondition(
        condition: () => boolean,
        timeout = 5000,
        interval = 100
    ): Promise<void> {
        const start = Date.now();
        while (!condition() && Date.now() - start < timeout) {
            await new Promise(resolve => setTimeout(resolve, interval));
        }
        if (!condition()) {
            throw new Error(`Condition not met within ${timeout}ms`);
        }
    }

    /**
     * 创建大型测试文件内容
     */
    static generateLargeCodeFile(lines: number): string {
        const functions = [];
        for (let i = 0; i < lines / 10; i++) {
            functions.push(`
void test_function_${i}() {
    int x = ${i};
    if (x > 0) {
        write(sprintf("Function %d executed", x));
    }
    for (int j = 0; j < x; j++) {
        write(sprintf("Loop %d", j));
    }
    return;
}
`);
        }
        return `inherit OBJECT;

${functions.join('')}`;
    }

    /**
     * 创建带有特定LPC语法的测试代码
     */
    static createLPCTestCode(options: {
        hasInherit?: boolean;
        hasFunctions?: boolean;
        hasArrays?: boolean;
        hasMappings?: boolean;
        hasFunctionPointers?: boolean;
        hasAnonymousFunctions?: boolean;
        hasForEach?: boolean;
        hasSwitchRanges?: boolean;
        hasErrors?: boolean;
    } = {}): string {
        let code = '';

        if (options.hasInherit) {
            code += 'inherit "/std/object";\n\n';
        }

        if (options.hasFunctions) {
            code += `void create() {
    ::create();
    set_name("test object");
}

`;
        }

        if (options.hasArrays) {
            code += `mixed *test_array = ({ "item1", "item2", "item3" });

`;
        }

        if (options.hasMappings) {
            code += `mapping test_mapping = ([ "key1": "value1", "key2": "value2" ]);

`;
        }

        if (options.hasFunctionPointers) {
            code += `void test_function_pointer() {
    function f = (: test_function :);
    evaluate(f);
}

`;
        }

        if (options.hasAnonymousFunctions) {
            code += `void test_anonymous() {
    function f = function(int x) { return x * 2; };
    int result = evaluate(f, 5);
}

`;
        }

        if (options.hasForEach) {
            code += `void test_foreach() {
    mixed *array = ({ 1, 2, 3, 4, 5 });
    foreach (mixed item in array) {
        write(sprintf("Item: %O", item));
    }
    foreach (ref mixed item in array) {
        item *= 2;
    }
}

`;
        }

        if (options.hasSwitchRanges) {
            code += `void test_switch_ranges(int x) {
    switch (x) {
        case 1..5:
            write("Small number");
            break;
        case ..10:
            write("Up to ten");
            break;
        case 15..:
            write("Fifteen or more");
            break;
        default:
            write("Other");
            break;
    }
}

`;
        }

        if (options.hasErrors) {
            code += `void syntax_error() {
    // 缺失分号的语法错误
    int x = 1
    return;
}

`;
        }

        return code;
    }


    /**
     * 提取代码令牌（简化版）
     */
    static extractTokens(code: string): string[] {
        return code
            .replace(/\/\*[\s\S]*?\*\//g, '') // 移除块注释
            .replace(/\/\/.*$/gm, '') // 移除行注释
            .replace(/"[^"]*"/g, '""') // 简化字符串
            .replace(/\s+/g, ' ') // 标准化空白
            .split(/\s+/)
            .filter(token => token.length > 0);
    }

    /**
     * 创建性能测试数据
     */
    static createPerformanceTestData(): {
        small: string;    // < 1KB
        medium: string;   // 1-10KB
        large: string;    // 10-100KB
        xlarge: string;   // > 100KB
    } {
        const baseFunction = `void test_function() {
    int x = random(100);
    if (x > 50) {
        write(sprintf("High value: %d", x));
    } else {
        write(sprintf("Low value: %d", x));
    }
    return;
}

`;

        return {
            small: 'inherit OBJECT;\n\n' + baseFunction,
            medium: 'inherit OBJECT;\n\n' + baseFunction.repeat(20),
            large: 'inherit OBJECT;\n\n' + baseFunction.repeat(200),
            xlarge: 'inherit OBJECT;\n\n' + baseFunction.repeat(2000)
        };
    }
}
