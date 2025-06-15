import * as vscode from 'vscode';
import { VariableDeclContext, BlockContext, FunctionDefContext, StatementContext, SourceFileContext, IfStatementContext, WhileStatementContext, ForStatementContext, DoWhileStatementContext, ForeachStatementContext, SwitchStatementContext } from '../antlr/LPCParser';
import { getParsed } from '../parseCache';

export class LocalVariableDeclarationCollector {
    private diagnostics: vscode.Diagnostic[] = [];
    private document!: vscode.TextDocument;

    constructor() {}

    collect(doc: vscode.TextDocument, parsed: ReturnType<typeof getParsed>): vscode.Diagnostic[] {
        this.diagnostics = [];
        this.document = doc;

        const sourceFile = parsed.tree as SourceFileContext;
        // Traverse the source file
        sourceFile.statement().forEach(stmt => {
            // Only process top-level function definitions; other global statements不用管
            const funcDef = stmt.functionDef();
            if (funcDef) {
                this.processBlock(funcDef.block());
            }
        });

        return this.diagnostics;
    }

    private processBlock(block: BlockContext) {
        let hasExecutable = false;
        let lastExecutableLine = -1;

        block.statement().forEach(stmt => {
            const stmtStart = this.document.positionAt(stmt.start.startIndex);

            if (stmt.variableDecl()) {
                if (hasExecutable) {
                    // 检查执行语句与变量声明之间是否存在预处理指令 (#ifdef/#else 等)，如果存在则视为新的代码分支，允许重新声明变量。
                    const varDeclStartLine = stmtStart.line;
                    const containsDirective = this.containsPreprocessorDirectiveBetween(lastExecutableLine + 1, varDeclStartLine);

                    if (!containsDirective) {
                        this.reportVariableDeclViolation(stmt.variableDecl()!);
                    } else {
                        // 遇到新的分支，重置 executable 标记
                        hasExecutable = false;
                    }
                }
                // 变量声明自身不会设置 hasExecutable
            } else {
                // 其他语句均视为可执行语句
                hasExecutable = true;
                lastExecutableLine = stmtStart.line;
            }

            // 递归检查嵌套块及函数
            this.recurseIntoStatement(stmt);
        });
    }

    private recurseIntoStatement(stmt: StatementContext) {
        // Check nested block directly under this statement
        if (stmt.block()) {
            this.processBlock(stmt.block()!);
        }

        // Nested function definitions (unlikely but for completeness)
        if (stmt.functionDef()) {
            this.processBlock(stmt.functionDef()!.block());
        }

        // if / while / for / doWhile / foreach / switch etc. each contains nested statement(s) or blocks
        const ifStmt = stmt.ifStatement();
        if (ifStmt) {
            ifStmt.statement().forEach(s => this.recurseIntoStatement(s));
        }

        const whileStmt = stmt.whileStatement();
        if (whileStmt) {
            this.recurseIntoStatement(whileStmt.statement());
        }

        const doWhileStmt = stmt.doWhileStatement();
        if (doWhileStmt) {
            this.recurseIntoStatement(doWhileStmt.statement());
        }

        const forStmt = stmt.forStatement();
        if (forStmt) {
            this.recurseIntoStatement(forStmt.statement());
        }

        const foreachStmt = stmt.foreachStatement();
        if (foreachStmt) {
            this.recurseIntoStatement(foreachStmt.statement());
        }

        const switchStmt = stmt.switchStatement();
        if (switchStmt) {
            switchStmt.switchSection().forEach(section => {
                section.statement().forEach(secStmt => this.recurseIntoStatement(secStmt));
            });
        }
    }

    private reportVariableDeclViolation(varDecl: VariableDeclContext) {
        const start = this.document.positionAt(varDecl.start.startIndex);
        const end = this.document.positionAt(varDecl.stop!.stopIndex + 1);
        const range = new vscode.Range(start, end);
        this.diagnostics.push(this.createDiagnostic(
            range,
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

    /**
     * 检查给定行区间内是否存在以 # 开头的预处理指令（忽略空白行 & 注释）。
     */
    private containsPreprocessorDirectiveBetween(startLine: number, endLine: number): boolean {
        if (startLine < 0 || endLine <= startLine) {
            return false;
        }

        for (let line = startLine; line <= endLine; line++) {
            const text = this.document.lineAt(line).text.trim();
            if (text.startsWith('#')) {
                // 常见的 LPC/C 预处理关键字
                if (/^#\s*(if|ifdef|ifndef|elif|else|endif)/.test(text)) {
                    return true;
                }
            }
        }
        return false;
    }
} 