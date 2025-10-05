import * as vscode from 'vscode';

/**
 * 变量信息
 */
export interface VariableInfo {
    type: string;
    range: vscode.Range;
    declarationIndex: number;
    isArray: boolean;
}

/**
 * 变量分析器
 * 提供变量查找、使用检查等分析功能
 */
export class VariableAnalyzer {
    private excludedIdentifiers: Set<string>;
    private variableDeclarationRegex: RegExp;
    private globalVariableRegex: RegExp;
    private functionDeclRegex: RegExp;

    constructor(lpcTypes: string, modifiers: string, excludedIdentifiers: Set<string>) {
        this.excludedIdentifiers = excludedIdentifiers;

        // 初始化正则表达式
        this.variableDeclarationRegex = new RegExp(
            `^\\s*((?:${modifiers}\\s+)*)(${lpcTypes})\\s+` +
            '(\\*?\\s*[a-zA-Z_][a-zA-Z0-9_]*(?:\\s*,\\s*\\*?\\s*[a-zA-Z_][a-zA-Z0-9_]*)*);',
            'gm'
        );

        this.globalVariableRegex = new RegExp(
            `^\\s*(?:${modifiers}?\\s*)(${lpcTypes})\\s+` +
            '([a-zA-Z_][a-zA-Z0-9_]*)\\s*(?:=\\s*[^;]+)?;',
            'gm'
        );

        this.functionDeclRegex = new RegExp(
            `^\\s*(?:${modifiers}\\s+)*(${lpcTypes})\\s+` +
            '([a-zA-Z_][a-zA-Z0-9_]*)\\s*\\([^)]*\\)\\s*{',
            'gm'
        );
    }

    /**
     * 查找文档中的所有全局变量
     */
    findGlobalVariables(document: vscode.TextDocument): Set<string> {
        const text = document.getText();
        const globalVariables = new Set<string>();

        // 首先获取所有函数块的范围
        const functionRanges = this.findFunctionRanges(text);

        // 查找全局变量
        this.globalVariableRegex.lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = this.globalVariableRegex.exec(text))) {
            const matchStart = match.index;

            // 检查这个变量声明是否在任何函数块内
            const isInFunction = functionRanges.some(range =>
                matchStart > range.start && matchStart < range.end
            );

            // 如果不在函数内，这是一个全局变量
            if (!isInFunction) {
                const varName = match[2];
                if (!this.excludedIdentifiers.has(varName)) {
                    globalVariables.add(varName);
                }
            }
        }

        return globalVariables;
    }

    /**
     * 查找文档中的所有局部变量
     */
    findLocalVariables(document: vscode.TextDocument): Map<string, VariableInfo> {
        const text = document.getText();
        const localVars = new Map<string, VariableInfo>();

        this.variableDeclarationRegex.lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = this.variableDeclarationRegex.exec(text)) !== null) {
            const varType = match[2];
            const varDeclarations = match[3];
            const fullMatchStart = match.index;

            // 分割变量声明
            const vars = varDeclarations.split(',');
            let hasArrayInDeclaration = false;

            for (let varDecl of vars) {
                varDecl = varDecl.trim();
                let isArray = false;
                let varName = varDecl;

                // 检查是否是数组声明
                if (varDecl.includes('*')) {
                    isArray = true;
                    hasArrayInDeclaration = true;
                    varName = varDecl.replace('*', '').trim();
                }

                // 如果这个声明中有数组，那么后续的变量都是普通变量
                if (!isArray && hasArrayInDeclaration) {
                    isArray = false;
                }

                if (!this.excludedIdentifiers.has(varName)) {
                    const varRegex = new RegExp(`\\b${varName}\\b`);
                    const varMatch = varRegex.exec(text.slice(fullMatchStart));
                    if (varMatch) {
                        const varIndex = fullMatchStart + varMatch.index;
                        const range = new vscode.Range(
                            document.positionAt(varIndex),
                            document.positionAt(varIndex + varName.length)
                        );
                        localVars.set(varName, {
                            type: isArray ? `${varType}[]` : varType,
                            range,
                            declarationIndex: varIndex,
                            isArray
                        });
                    }
                }
            }
        }

        return localVars;
    }

    /**
     * 查找未使用的变量
     */
    findUnusedVariables(document: vscode.TextDocument, localVars: Map<string, VariableInfo>): Set<string> {
        const text = document.getText();
        const unusedVars = new Set<string>();

        for (const [varName, info] of localVars) {
            // 在变量声明后的代码中查找变量使用
            const afterDeclaration = text.slice(info.declarationIndex + varName.length);
            const isUsed = this.checkVariableUsage(varName, afterDeclaration);
            if (!isUsed) {
                unusedVars.add(varName);
            }
        }

        return unusedVars;
    }

    /**
     * 检查变量是否被使用
     */
    checkVariableUsage(varName: string, code: string): boolean {
        const patterns = this.getVariableUsagePatterns(varName);
        for (const { pattern } of patterns) {
            pattern.lastIndex = 0;
            if (pattern.test(code)) {
                return true;
            }
        }

        // 回退检查
        const usagePattern = new RegExp(`\\b${varName}\\b`, 'g');
        let match: RegExpExecArray | null;

        while ((match = usagePattern.exec(code)) !== null) {
            const index = match.index;
            const postVariableContext = code.substring(index + varName.length);
            const simpleAssignmentLHSRegex = /^\s*=\s*([^=]|$)/;

            if (!simpleAssignmentLHSRegex.test(postVariableContext)) {
                return true;
            }
        }
        return false;
    }

    /**
     * 查找函数范围
     */
    private findFunctionRanges(text: string): Array<{ start: number; end: number }> {
        const functionRanges: Array<{ start: number; end: number }> = [];
        this.functionDeclRegex.lastIndex = 0;
        let funcMatch: RegExpExecArray | null;

        while ((funcMatch = this.functionDeclRegex.exec(text)) !== null) {
            const start = funcMatch.index;
            let bracketCount = 0;
            let inString = false;
            let stringChar = '';
            let currentIndex = start;

            while (currentIndex < text.length) {
                const char = text[currentIndex];
                if (inString) {
                    if (char === stringChar && text[currentIndex - 1] !== '\\') {
                        inString = false;
                    }
                } else {
                    if (char === '"' || char === '\'') {
                        inString = true;
                        stringChar = char;
                    } else if (char === '{') {
                        bracketCount++;
                    } else if (char === '}') {
                        bracketCount--;
                        if (bracketCount === 0) {
                            functionRanges.push({ start, end: currentIndex });
                            break;
                        }
                    }
                }
                currentIndex++;
            }
        }

        return functionRanges;
    }

    /**
     * 获取变量使用模式
     */
    private getVariableUsagePatterns(varName: string): { pattern: RegExp; description: string }[] {
        return [
            {
                pattern: new RegExp(`\\b[a-zA-Z_][a-zA-Z0-9_]*\\s*\\([^)]*\\b${varName}\\b[^)]*\\)`, 'g'),
                description: '函数参数'
            },
            {
                pattern: new RegExp(`\\b(?!${varName}\\s*=[^=])[a-zA-Z_][a-zA-Z0-9_]*\\s*[+\\-*\\/%]?=\\s*.*\\b${varName}\\b.*?;`, 'g'),
                description: '赋值右值'
            },
            {
                pattern: new RegExp(`\\breturn\\s+.*\\b${varName}\\b`, 'g'),
                description: 'return语句'
            },
            {
                pattern: new RegExp(`\\bif\\s*\\([^)]*\\b${varName}\\b[^)]*\\)`, 'g'),
                description: 'if条件'
            },
            {
                pattern: new RegExp(`\\bwhile\\s*\\([^)]*\\b${varName}\\b[^)]*\\)`, 'g'),
                description: 'while循环'
            },
            {
                pattern: new RegExp(`\\bfor\\s*\\([^;]*;[^;]*\\b${varName}\\b[^;]*;[^)]*\\)`, 'g'),
                description: 'for循环'
            },
            {
                pattern: new RegExp(`\\bswitch\\s*\\([^)]*\\b${varName}\\b[^)]*\\)`, 'g'),
                description: 'switch语句'
            },
            {
                pattern: new RegExp(`\\bcase\\s+\\b${varName}\\b`, 'g'),
                description: 'case语句'
            },
            {
                pattern: new RegExp(`\\bforeach\\s*\\([^)]+in\\s+\\b${varName}\\b`, 'g'),
                description: 'foreach集合'
            },
            {
                pattern: new RegExp(`\\b(?:sscanf|input_to|call_other)\\s*\\((?:[^(),]*\\(\\s*[^()]*\\s*\\)[^(),]*|[^(),])*\\b${varName}\\b`, 'g'),
                description: '特殊函数调用'
            },
            {
                pattern: new RegExp(`\\b${varName}\\s*->`, 'g'),
                description: '对象成员访问'
            },
            {
                pattern: new RegExp(`\\b${varName}\\s*(?:\\+=|-=|\\*=|\\/=|%=)\\s*[^;]+`, 'g'),
                description: '复合赋值'
            }
        ];
    }
}
