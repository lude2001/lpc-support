import * as vscode from 'vscode';
import { DiagnosticContext, IDiagnosticCollector } from '../diagnostics/types';
import { ParsedDocument } from '../parser/types';
import { SyntaxDocument, SyntaxKind, SyntaxNode } from '../syntax/types';

export class LocalVariableDeclarationCollector implements IDiagnosticCollector {
    public readonly name = 'LocalVariableDeclarationCollector';
    private static readonly ruleConfigKey = 'enforceLocalVariableDeclarationAtBlockStart';

    private diagnostics: vscode.Diagnostic[] = [];
    private document!: vscode.TextDocument;
    private branchDirectiveLines = new Set<number>();

    constructor() {}

    collect(doc: vscode.TextDocument, parsed: ParsedDocument, context?: DiagnosticContext): vscode.Diagnostic[] {
        this.diagnostics = [];
        this.document = doc;
        this.branchDirectiveLines = this.collectBranchDirectiveLines(parsed);

        // FluffOS 新版本允许在代码块任意位置声明局部变量；该规则改为可配置。
        if (!this.isRuleEnabled()) {
            return this.diagnostics;
        }

        const syntax = context?.syntax;
        if (!syntax) {
            return this.diagnostics;
        }

        this.processFunctionBlocks(syntax);

        return this.diagnostics;
    }

    private isRuleEnabled(): boolean {
        const config = vscode.workspace.getConfiguration('lpc');
        return config.get<boolean>(LocalVariableDeclarationCollector.ruleConfigKey, false);
    }

    private processFunctionBlocks(syntax: SyntaxDocument): void {
        for (const node of syntax.nodes) {
            if (node.kind !== SyntaxKind.FunctionDeclaration) {
                continue;
            }

            const block = node.children.find((child) => child.kind === SyntaxKind.Block);
            if (block) {
                this.processBlock(block);
            }
        }
    }

    private processBlock(block: SyntaxNode): void {
        let hasExecutable = false;
        let lastExecutableLine = -1;

        for (const stmt of block.children) {
            const stmtStart = stmt.range.start;

            if (stmt.kind === SyntaxKind.VariableDeclaration) {
                if (hasExecutable) {
                    // 检查执行语句与变量声明之间是否存在预处理指令 (#ifdef/#else 等)，如果存在则视为新的代码分支，允许重新声明变量。
                    const varDeclStartLine = stmtStart.line;
                    const containsDirective = this.containsPreprocessorDirectiveBetween(lastExecutableLine + 1, varDeclStartLine);

                    if (!containsDirective) {
                        this.reportVariableDeclViolation(stmt);
                    } else {
                        // 遇到新的分支，重置 executable 标记
                        hasExecutable = false;
                    }
                }
                // 变量声明自身不会设置 hasExecutable
            } else if (this.isExecutableStatement(stmt)) {
                // 其他语句均视为可执行语句
                hasExecutable = true;
                lastExecutableLine = stmtStart.line;
            }

            // 递归检查嵌套块及函数
            this.recurseIntoStatement(stmt);
        }
    }

    private recurseIntoStatement(stmt: SyntaxNode): void {
        for (const child of stmt.children) {
            if (child.kind === SyntaxKind.Block) {
                this.processBlock(child);
                continue;
            }

            if (this.hasNestedStatementChildren(child)) {
                this.recurseIntoStatement(child);
            }
        }
    }

    private reportVariableDeclViolation(varDecl: SyntaxNode): void {
        this.diagnostics.push(this.createDiagnostic(
            varDecl.range,
            "局部变量定义必须在可执行语句或代码块的开头。",
            vscode.DiagnosticSeverity.Error,
            "localVariableDeclarationPosition"
        ));
    }

    private createDiagnostic(
        range: vscode.Range,
        message: string,
        severity: vscode.DiagnosticSeverity,
        code?: string
    ): vscode.Diagnostic {
        const diagnostic = new vscode.Diagnostic(range, message, severity);
        if (code) {
            diagnostic.code = code;
        }
        return diagnostic;
    }

    private isExecutableStatement(node: SyntaxNode): boolean {
        return node.category === 'statement'
            || node.category === 'expression'
            || node.kind === SyntaxKind.FunctionDeclaration;
    }

    private hasNestedStatementChildren(node: SyntaxNode): boolean {
        switch (node.kind) {
            case SyntaxKind.IfStatement:
            case SyntaxKind.WhileStatement:
            case SyntaxKind.DoWhileStatement:
            case SyntaxKind.ForStatement:
            case SyntaxKind.ForeachStatement:
            case SyntaxKind.SwitchStatement:
            case SyntaxKind.CaseClause:
            case SyntaxKind.DefaultClause:
                return true;
            default:
                return false;
        }
    }

    /**
     * 检查给定行区间内是否存在以 # 开头的预处理指令（忽略空白行 & 注释）。
     */
    private containsPreprocessorDirectiveBetween(startLine: number, endLine: number): boolean {
        if (startLine < 0 || endLine <= startLine) {
            return false;
        }

        for (let line = startLine; line <= endLine; line++) {
            if (this.branchDirectiveLines.has(line)) {
                return true;
            }
        }
        return false;
    }

    private collectBranchDirectiveLines(parsed: ParsedDocument): Set<number> {
        const lines = new Set<number>();
        const branchKinds = new Set(['if', 'ifdef', 'ifndef', 'elif', 'else', 'endif']);

        for (const directive of parsed.frontend?.preprocessor.directives ?? []) {
            if (branchKinds.has(directive.kind)) {
                lines.add(directive.range.start.line);
            }
        }

        return lines;
    }
}
