import { AbstractParseTreeVisitor } from 'antlr4ts/tree/AbstractParseTreeVisitor';
import { LPCParserVisitor } from '../../antlr/LPCParserVisitor';
import { FormattingConfig, FormattingContext } from '../config/FormattingConfig';
import { RuleEngine } from './RuleEngine';
import {
    SourceFileContext,
    FunctionDefContext,
    BlockContext,
    StatementContext,
    ExpressionContext,
    VariableDeclContext,
    IfStatementContext,
    WhileStatementContext,
    ForStatementContext,
    ArrayLiteralContext,
    MappingLiteralExprContext,
    PostfixExpressionContext,
    InheritStatementContext,
    ClosurePrimaryContext,
    SwitchStatementContext,
    ForeachStatementContext,
    AnonFunctionContext,
    SliceExprContext,
    NewExpressionContext,
    CastExpressionContext
} from '../../antlr/LPCParser';
import { ParseTree } from 'antlr4ts/tree/ParseTree';
import { TerminalNode } from 'antlr4ts/tree/TerminalNode';
import { FormattingAction, RuleExecutionResult } from '../rules/RuleTypes';

/**
 * LPC 格式化访问者，遍历AST并应用格式化规则
 */
export class FormattingVisitor extends AbstractParseTreeVisitor<string> implements LPCParserVisitor<string> {
    private config: FormattingConfig;
    private ruleEngine: RuleEngine;
    private context: FormattingContext;
    private output: string[] = [];
    private currentLine = '';
    private lineNumber = 1;

    constructor(config: FormattingConfig, ruleEngine: RuleEngine) {
        super();
        this.config = config;
        this.ruleEngine = ruleEngine;
        this.context = {
            indentLevel: 0,
            inFunction: false,
            inArray: false,
            inMapping: false,
            inCondition: false,
            inSwitch: false,
            inForeach: false,
            inAnonymousFunction: false,
            inCast: false,
            lineLength: 0
        };
    }

    /**
     * 获取格式化结果
     */
    getFormattedText(): string {
        let result = this.output.join('');
        
        // 应用最后的清理规则
        if (this.config.trimTrailingWhitespace) {
            result = this.trimTrailingWhitespace(result);
        }
        
        if (this.config.insertFinalNewline && !result.endsWith('\n')) {
            result += '\n';
        }
        
        return result;
    }

    /**
     * 访问源文件节点
     */
    visitSourceFile(ctx: SourceFileContext): string {
        this.resetContext();

        // 如果没有子节点，返回空字符串
        if (ctx.childCount === 0) {
            return '';
        }

        // 遍历所有子节点并收集文本
        for (let i = 0; i < ctx.childCount; i++) {
            const child = ctx.getChild(i);
            if (child) {
                this.visitChild(child);
            }
        }

        return this.getFormattedText();
    }

    /**
     * 访问函数定义节点
     */
    visitFunctionDef(ctx: FunctionDefContext): string {
        const previousInFunction = this.context.inFunction;
        this.context.inFunction = true;

        this.applyRulesAndAppend(ctx);

        this.context.inFunction = previousInFunction;
        return this.defaultResult();
    }

    /**
     * 访问块节点
     */
    visitBlock(ctx: BlockContext): string {
        const previousIndentLevel = this.context.indentLevel;
        
        this.applyRulesAndAppend(ctx);
        this.context.indentLevel++;
        
        // 遍历块内的语句
        for (let i = 0; i < ctx.childCount; i++) {
            const child = ctx.getChild(i);
            if (!(child instanceof TerminalNode) || (child.text !== '{' && child.text !== '}')) {
                this.visit(child);
            }
        }
        
        this.context.indentLevel = previousIndentLevel;
        return this.defaultResult();
    }

    /**
     * 访问变量声明节点
     */
    visitVariableDecl(ctx: VariableDeclContext): string {
        this.applyRulesAndAppend(ctx);
        return this.defaultResult();
    }

    /**
     * 访问条件语句节点
     */
    visitIfStatement(ctx: IfStatementContext): string {
        const previousInCondition = this.context.inCondition;
        this.context.inCondition = true;
        
        this.applyRulesAndAppend(ctx);
        
        this.context.inCondition = previousInCondition;
        return this.defaultResult();
    }

    /**
     * 访问循环语句节点
     */
    visitWhileStatement(ctx: WhileStatementContext): string {
        const previousInCondition = this.context.inCondition;
        this.context.inCondition = true;
        
        this.applyRulesAndAppend(ctx);
        
        this.context.inCondition = previousInCondition;
        return this.defaultResult();
    }

    /**
     * 访问for循环语句节点
     */
    visitForStatement(ctx: ForStatementContext): string {
        const previousInCondition = this.context.inCondition;
        this.context.inCondition = true;
        
        this.applyRulesAndAppend(ctx);
        
        this.context.inCondition = previousInCondition;
        return this.defaultResult();
    }

    /**
     * 访问数组字面量节点
     */
    visitArrayLiteral(ctx: ArrayLiteralContext): string {
        const previousInArray = this.context.inArray;
        this.context.inArray = true;
        
        this.applyRulesAndAppend(ctx);
        
        this.context.inArray = previousInArray;
        return this.defaultResult();
    }

    /**
     * 访问映射字面量节点
     */
    visitMappingLiteralExpr(ctx: MappingLiteralExprContext): string {
        const previousInMapping = this.context.inMapping;
        this.context.inMapping = true;
        
        this.applyRulesAndAppend(ctx);
        
        this.context.inMapping = previousInMapping;
        return this.defaultResult();
    }

    /**
     * 访问后缀表达式节点（包括函数调用）
     */
    visitPostfixExpression(ctx: PostfixExpressionContext): string {
        this.applyRulesAndAppend(ctx);
        return this.defaultResult();
    }

    /**
     * 访问继承语句节点
     */
    visitInheritStatement(ctx: InheritStatementContext): string {
        this.applyRulesAndAppend(ctx);
        return this.defaultResult();
    }

    /**
     * 访问闭包节点（函数指针）
     */
    visitClosurePrimary(ctx: ClosurePrimaryContext): string {
        this.applyRulesAndAppend(ctx);
        return this.defaultResult();
    }

    /**
     * 访问switch语句节点
     */
    visitSwitchStatement(ctx: SwitchStatementContext): string {
        const previousInSwitch = this.context.inSwitch;
        this.context.inSwitch = true;

        this.applyRulesAndAppend(ctx);

        this.context.inSwitch = previousInSwitch;
        return this.defaultResult();
    }

    /**
     * 访问foreach语句节点
     */
    visitForeachStatement(ctx: ForeachStatementContext): string {
        const previousInForeach = this.context.inForeach;
        this.context.inForeach = true;

        this.applyRulesAndAppend(ctx);

        this.context.inForeach = previousInForeach;
        return this.defaultResult();
    }

    /**
     * 访问匿名函数节点
     */
    visitAnonFunction(ctx: AnonFunctionContext): string {
        const previousInAnonymousFunction = this.context.inAnonymousFunction;
        this.context.inAnonymousFunction = true;

        this.applyRulesAndAppend(ctx);

        this.context.inAnonymousFunction = previousInAnonymousFunction;
        return this.defaultResult();
    }

    /**
     * 访问切片表达式节点
     */
    visitSliceExpr(ctx: SliceExprContext): string {
        this.applyRulesAndAppend(ctx);
        return this.defaultResult();
    }

    /**
     * 访问new表达式节点
     */
    visitNewExpression(ctx: NewExpressionContext): string {
        this.applyRulesAndAppend(ctx);
        return this.defaultResult();
    }

    /**
     * 访问类型转换表达式节点
     */
    visitCastExpression(ctx: CastExpressionContext): string {
        const previousInCast = this.context.inCast;
        this.context.inCast = true;

        this.applyRulesAndAppend(ctx);

        this.context.inCast = previousInCast;
        return this.defaultResult();
    }

    /**
     * 访问终端节点
     */
    visitTerminal(node: TerminalNode): string {
        this.applyRulesAndAppend(node);
        return this.defaultResult();
    }

    /**
     * 默认访问器实现
     */
    protected defaultResult(): string {
        return '';
    }

    /**
     * 访问子节点（通用方法）
     */
    private visitChild(child: ParseTree): void {
        if (!child) {
            return;
        }

        // 如果是终端节点，直接添加文本
        if (child instanceof TerminalNode) {
            this.appendText(child.text);
            return;
        }

        // 尝试用特定的visit方法
        const result = this.visit(child);

        // 如果visit方法返回了文本，添加到输出
        if (result && typeof result === 'string') {
            this.appendText(result);
        } else {
            // 作为备选，遍历子节点
            for (let i = 0; i < child.childCount; i++) {
                this.visitChild(child.getChild(i));
            }
        }
    }

    /**
     * 应用规则并附加到输出
     */
    private applyRulesAndAppend(node: ParseTree): void {
        try {
            const result = this.ruleEngine.executeRules(node, this.config, this.context);

            if (result.applied && result.actions.length > 0) {
                // 应用格式化操作
                for (const action of result.actions) {
                    this.applyFormattingAction(action);
                }
            } else {
                // 没有规则应用时，遍历子节点而不是使用node.text
                if (node instanceof TerminalNode) {
                    this.appendText(node.text);
                } else {
                    // 对于非终端节点，遍历子节点
                    for (let i = 0; i < node.childCount; i++) {
                        this.visitChild(node.getChild(i));
                    }
                }
            }

            // 记录警告和错误
            if (result.warnings) {
                console.warn('Formatting warnings:', result.warnings);
            }

            if (result.errors) {
                console.error('Formatting errors:', result.errors);
            }

        } catch (error) {
            console.error('Error applying formatting rules:', error);
            // 发生错误时，遍历子节点保持原始文本结构
            if (node instanceof TerminalNode) {
                this.appendText(node.text);
            } else {
                for (let i = 0; i < node.childCount; i++) {
                    this.visitChild(node.getChild(i));
                }
            }
        }
    }

    /**
     * 应用格式化操作
     */
    private applyFormattingAction(action: FormattingAction): void {
        switch (action.type) {
            case 'preserve':
                if (typeof action.value === 'string') {
                    this.appendText(action.value);
                }
                break;
            case 'indent':
                this.appendIndent();
                break;
            case 'space':
                if (typeof action.value === 'string') {
                    this.appendText(action.value);
                } else {
                    this.appendText(' ');
                }
                break;
            case 'newline':
                this.appendNewline();
                break;
            case 'remove':
                // 不进行任何操作，相当于删除
                break;
        }
    }

    /**
     * 附加文本
     */
    private appendText(text: string): void {
        if (!text) return;
        
        const lines = text.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            if (i > 0) {
                this.finishCurrentLine();
                this.startNewLine();
            }
            
            this.currentLine += lines[i];
            this.context.lineLength = this.currentLine.length;
        }
    }

    /**
     * 附加缩进
     */
    private appendIndent(): void {
        const indent = this.getIndentString();
        this.currentLine += indent;
        this.context.lineLength = this.currentLine.length;
    }

    /**
     * 附加换行
     */
    private appendNewline(): void {
        this.finishCurrentLine();
        this.startNewLine();
    }

    /**
     * 完成当前行
     */
    private finishCurrentLine(): void {
        this.output.push(this.currentLine);
        this.output.push('\n');
    }

    /**
     * 开始新行
     */
    private startNewLine(): void {
        this.currentLine = '';
        this.context.lineLength = 0;
        this.lineNumber++;
    }

    /**
     * 获取缩进字符串
     */
    private getIndentString(): string {
        const unit = this.config.useSpaces ? ' '.repeat(this.config.indentSize) : '\t';
        return unit.repeat(this.context.indentLevel);
    }

    /**
     * 重置上下文
     */
    private resetContext(): void {
        this.context = {
            indentLevel: 0,
            inFunction: false,
            inArray: false,
            inMapping: false,
            inCondition: false,
            inSwitch: false,
            inForeach: false,
            inAnonymousFunction: false,
            inCast: false,
            lineLength: 0
        };
        this.output = [];
        this.currentLine = '';
        this.lineNumber = 1;
    }

    /**
     * 清理尾随空格
     */
    private trimTrailingWhitespace(text: string): string {
        return text.split('\n').map(line => line.trimRight()).join('\n');
    }

    /**
     * 获取当前上下文信息
     */
    getContext(): FormattingContext {
        return { ...this.context };
    }

    /**
     * 设置上下文信息
     */
    setContext(context: Partial<FormattingContext>): void {
        this.context = { ...this.context, ...context };
    }
}