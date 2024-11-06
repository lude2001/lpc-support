"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LPCTypeChecker = void 0;
const vscode = require("vscode");
class LPCTypeChecker {
    constructor() {
        // LPC 基本类型
        this.basicTypes = new Set([
            'void', 'int', 'string', 'object', 'array', 'mapping',
            'float', 'buffer', 'mixed', 'function', 'class', 'struct'
        ]);
        // 类型兼容性映射
        this.typeCompatibility = {
            'int': new Set(['int', 'float', 'mixed']),
            'float': new Set(['float', 'int', 'mixed']),
            'string': new Set(['string', 'mixed']),
            'object': new Set(['object', 'mixed']),
            'array': new Set(['array', 'mixed']),
            'mapping': new Set(['mapping', 'mixed']),
            'mixed': new Set(['mixed', 'int', 'float', 'string', 'object', 'array', 'mapping', 'buffer', 'function']),
            'buffer': new Set(['buffer', 'mixed']),
            'function': new Set(['function', 'mixed'])
        };
    }
    checkTypes(document) {
        const diagnostics = [];
        const text = document.getText();
        // 检查变量赋值
        this.checkVariableAssignments(text, document, diagnostics);
        // 检查函数返回值
        this.checkFunctionReturns(text, document, diagnostics);
        // 检查函数参数
        this.checkFunctionParameters(text, document, diagnostics);
        return diagnostics;
    }
    checkVariableAssignments(text, document, diagnostics) {
        // 首先收集所有变量声明及其类型
        const variableTypes = new Map();
        const varDeclRegex = /\b(int|string|object|array|mapping|float|buffer)\s+([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
        let match;
        while ((match = varDeclRegex.exec(text)) !== null) {
            const [_, declaredType, varName] = match;
            variableTypes.set(varName, declaredType);
        }
        // 然后检查所有赋值操作
        const assignmentRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([^;]+);/g;
        while ((match = assignmentRegex.exec(text)) !== null) {
            const [fullMatch, varName, value] = match;
            const declaredType = variableTypes.get(varName);
            if (declaredType) {
                const valueType = this.inferType(value.trim(), text);
                if (!this.isTypeCompatible(declaredType, valueType)) {
                    const range = new vscode.Range(document.positionAt(match.index), document.positionAt(match.index + fullMatch.length));
                    diagnostics.push(new vscode.Diagnostic(range, `类型不匹配: 变量 '${varName}' 是 ${declaredType} 类型，但被赋值为 ${valueType} 类型`, vscode.DiagnosticSeverity.Error));
                }
            }
        }
    }
    checkFunctionReturns(text, document, diagnostics) {
        // 匹配函数定义和返回语句
        const funcRegex = /\b(int|string|object|array|mapping|float|buffer|void)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)\s*{([^}]*)}/g;
        let match;
        while ((match = funcRegex.exec(text)) !== null) {
            const [fullMatch, returnType, funcName, funcBody] = match;
            // 查找所有return语句
            const returnRegex = /\breturn\s+(.+?);/g;
            let returnMatch;
            while ((returnMatch = returnRegex.exec(funcBody)) !== null) {
                const returnValue = returnMatch[1].trim();
                const actualType = this.inferType(returnValue, text);
                if (!this.isTypeCompatible(returnType, actualType)) {
                    const returnStart = match.index + funcBody.indexOf(returnMatch[0]);
                    const range = new vscode.Range(document.positionAt(returnStart), document.positionAt(returnStart + returnMatch[0].length));
                    diagnostics.push(new vscode.Diagnostic(range, `返回值类型不匹配: 函数 '${funcName}' 声明返回 ${returnType} 类型，但实际返回 ${actualType} 类型`, vscode.DiagnosticSeverity.Error));
                }
            }
        }
    }
    checkFunctionParameters(text, document, diagnostics) {
        // 匹配函数调用
        const funcCallRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\((.*?)\)/g;
        let match;
        while ((match = funcCallRegex.exec(text)) !== null) {
            const [fullMatch, funcName, args] = match;
            // 查找函数定义
            const funcDef = this.findFunctionDefinition(funcName, text);
            if (funcDef) {
                const argTypes = this.parseArgumentTypes(args, text);
                const paramTypes = this.parseParameterTypes(funcDef.params);
                if (argTypes.length !== paramTypes.length) {
                    const range = new vscode.Range(document.positionAt(match.index), document.positionAt(match.index + fullMatch.length));
                    diagnostics.push(new vscode.Diagnostic(range, `参数数量不匹配: 函数 '${funcName}' 需要 ${paramTypes.length} 个参数，但提供了 ${argTypes.length} 个`, vscode.DiagnosticSeverity.Error));
                }
                else {
                    // 检查每个参数的类型
                    for (let i = 0; i < argTypes.length; i++) {
                        if (!this.isTypeCompatible(paramTypes[i], argTypes[i])) {
                            const range = new vscode.Range(document.positionAt(match.index), document.positionAt(match.index + fullMatch.length));
                            diagnostics.push(new vscode.Diagnostic(range, `参数类型不匹配: 函数 '${funcName}' 的第 ${i + 1} 个参数需要 ${paramTypes[i]} 类型，但提供了 ${argTypes[i]} 类型`, vscode.DiagnosticSeverity.Error));
                        }
                    }
                }
            }
        }
    }
    inferType(expression, context) {
        // 改进字符串字面量的检测
        if (/^"[^"]*"$/.test(expression) || /^'[^']*'$/.test(expression) || expression.includes('"') || expression.includes("'")) {
            return 'string';
        }
        // 数字字面量
        if (/^-?\d+(\.\d+)?$/.test(expression)) {
            return expression.includes('.') ? 'float' : 'int';
        }
        // 数组字面量
        if (/^\(\s*\{\s*.*\s*\}\s*\)$/.test(expression)) {
            return 'array';
        }
        // 映射字面量
        if (/^\(\s*\[\s*.*\s*\]\s*\)$/.test(expression)) {
            return 'mapping';
        }
        // 函数调用
        const funcCallMatch = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(.*\)$/.exec(expression);
        if (funcCallMatch) {
            const funcDef = this.findFunctionDefinition(funcCallMatch[1], context);
            return funcDef ? funcDef.returnType : 'mixed';
        }
        // 变量引用
        const varDeclMatch = new RegExp(`\\b(int|string|object|array|mapping|float|buffer)\\s+${expression}\\b`).exec(context);
        if (varDeclMatch) {
            return varDeclMatch[1];
        }
        // 默认为mixed类型
        return 'mixed';
    }
    isTypeCompatible(expectedType, actualType) {
        // 更严格的类型检查
        if (expectedType === actualType) {
            return true;
        }
        if (expectedType === 'mixed') {
            return true;
        }
        // 数字类型的特殊处理
        if (expectedType === 'int' && actualType === 'float') {
            return true;
        }
        const compatibleTypes = this.typeCompatibility[expectedType];
        return compatibleTypes ? compatibleTypes.has(actualType) : false;
    }
    findFunctionDefinition(funcName, text) {
        const funcDefRegex = new RegExp(`\\b(int|string|object|array|mapping|float|buffer|void)\\s+${funcName}\\s*\\(([^)]*)\\)\\s*{`, 'g');
        const match = funcDefRegex.exec(text);
        return match ? { returnType: match[1], params: match[2] } : undefined;
    }
    parseArgumentTypes(args, context) {
        if (!args.trim()) {
            return [];
        }
        return args.split(',').map(arg => this.inferType(arg.trim(), context));
    }
    parseParameterTypes(params) {
        if (!params.trim()) {
            return [];
        }
        return params.split(',').map(param => {
            const parts = param.trim().split(/\s+/);
            return parts[0];
        });
    }
}
exports.LPCTypeChecker = LPCTypeChecker;
//# sourceMappingURL=typeChecker.js.map