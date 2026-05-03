import * as vscode from 'vscode';
import { VariableDeclContext, BlockContext, StatementContext, SourceFileContext } from '../antlr/LPCParser';
import { IDiagnosticCollector } from '../diagnostics/types';
import { ParsedDocument } from '../parser/types';

export class LocalVariableDeclarationCollector implements IDiagnosticCollector {
    public readonly name = 'LocalVariableDeclarationCollector';
    private static readonly ruleConfigKey = 'enforceLocalVariableDeclarationAtBlockStart';

    private diagnostics: vscode.Diagnostic[] = [];
    private document!: vscode.TextDocument;
    private branchDirectiveLines = new Set<number>();

    constructor() {}

    collect(doc: vscode.TextDocument, parsed: ParsedDocument): vscode.Diagnostic[] {
        this.diagnostics = [];
        this.document = doc;
        this.branchDirectiveLines = this.collectBranchDirectiveLines(parsed);

        // FluffOS 新版本允许在代码块任意位置声明局部变量；该规则改为可配置。
        if (!this.isRuleEnabled()) {
            return this.diagnostics;
        }

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

    private isRuleEnabled(): boolean {
        const config = vscode.workspace.getConfiguration('lpc');
        return config.get<boolean>(LocalVariableDeclarationCollector.ruleConfigKey, false);
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
