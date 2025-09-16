import { CommonTokenStream } from 'antlr4ts';
import { LPCFormattingOptions } from '../types';
import { IExtendedFormattingContext, INodeVisitor } from '../types/interfaces';
import { FormattingContext } from './FormattingContext';
import {
    ExpressionFormatter,
    StatementFormatter,
    LiteralFormatter,
    DeclarationFormatter,
    BlockFormatter
} from '../formatters';

/**
 * 扩展的格式化上下文实现
 * 在基础FormattingContext基础上增加了专用格式化器支持
 * 
 * 特性：
 * - 懒加载专用格式化器
 * - 自动管理格式化器生命周期
 * - 提供格式化器之间的协调机制
 */
export class ExtendedFormattingContext extends FormattingContext implements IExtendedFormattingContext {
    // 格式化选项
    public readonly options: LPCFormattingOptions;

    // 专用格式化器实例（懒加载）
    private _expressionFormatter?: ExpressionFormatter;
    private _statementFormatter?: StatementFormatter;
    private _literalFormatter?: LiteralFormatter;
    private _declarationFormatter?: DeclarationFormatter;
    private _blockFormatter?: BlockFormatter;

    // 节点访问器引用
    private _nodeVisitor?: INodeVisitor;

    /**
     * 构造函数
     * @param tokenStream Token流
     * @param options 格式化选项配置
     */
    constructor(tokenStream: CommonTokenStream, options: LPCFormattingOptions) {
        super(tokenStream, options);
        this.options = options;
    }
    
    /**
     * 设置节点访问器
     * @param visitor 节点访问器实例
     */
    setNodeVisitor(visitor: INodeVisitor): void {
        this._nodeVisitor = visitor;
        // 重置所有格式化器，以便使用新的visitor
        this.resetFormatters();
    }

    /**
     * 获取表达式格式化器（懒加载）
     */
    get expressionFormatter(): ExpressionFormatter {
        if (!this._expressionFormatter && this._nodeVisitor) {
            this._expressionFormatter = new ExpressionFormatter(this, this._nodeVisitor);
        }
        if (!this._expressionFormatter) {
            throw new Error('节点访问器未设置，无法创建表达式格式化器');
        }
        return this._expressionFormatter;
    }

    /**
     * 获取语句格式化器（懒加载）
     */
    get statementFormatter(): StatementFormatter {
        if (!this._statementFormatter && this._nodeVisitor) {
            this._statementFormatter = new StatementFormatter(this, this._nodeVisitor);
        }
        if (!this._statementFormatter) {
            throw new Error('节点访问器未设置，无法创建语句格式化器');
        }
        return this._statementFormatter;
    }

    /**
     * 获取字面量格式化器（懒加载）
     */
    get literalFormatter(): LiteralFormatter {
        if (!this._literalFormatter && this._nodeVisitor) {
            this._literalFormatter = new LiteralFormatter(this, this._nodeVisitor);
        }
        if (!this._literalFormatter) {
            throw new Error('节点访问器未设置，无法创建字面量格式化器');
        }
        return this._literalFormatter;
    }

    /**
     * 获取声明格式化器（懒加载）
     */
    get declarationFormatter(): DeclarationFormatter {
        if (!this._declarationFormatter && this._nodeVisitor) {
            this._declarationFormatter = new DeclarationFormatter(this, this._nodeVisitor);
        }
        if (!this._declarationFormatter) {
            throw new Error('节点访问器未设置，无法创建声明格式化器');
        }
        return this._declarationFormatter;
    }

    /**
     * 获取代码块格式化器（懒加载）
     */
    get blockFormatter(): BlockFormatter {
        if (!this._blockFormatter && this._nodeVisitor) {
            this._blockFormatter = new BlockFormatter(this, this._nodeVisitor);
        }
        if (!this._blockFormatter) {
            throw new Error('节点访问器未设置，无法创建代码块格式化器');
        }
        return this._blockFormatter;
    }

    /**
     * 重写重置方法，同时清理专用格式化器
     */
    resetAll(): void {
        super.resetAll();
        this.resetFormatters();
    }

    /**
     * 重置所有专用格式化器
     * 释放内存并强制重新创建
     */
    resetFormatters(): void {
        this._expressionFormatter = undefined;
        this._statementFormatter = undefined;
        this._literalFormatter = undefined;
        this._declarationFormatter = undefined;
        this._blockFormatter = undefined;
    }


    /**
     * 创建子上下文（扩展版本）
     * @returns 新的扩展格式化上下文
     */
    createChildContext(): ExtendedFormattingContext {
        const childContext = new ExtendedFormattingContext(
            this.tokenUtils.getTokenStream(),
            this.core.getOptions()
        );

        // 同步缩进级别
        childContext.indentManager.setIndentLevel(this.indentManager.getIndentLevel());

        return childContext;
    }

    /**
     * 合并子上下文的结果（扩展版本）
     * @param childContext 扩展的子上下文
     */
    mergeChildContext(childContext: ExtendedFormattingContext): void {
        super.mergeChildContext(childContext);

        // 可以在这里添加专用格式化器相关的合并逻辑
        // 例如：统计每个格式化器的使用情况等
    }

    /**
     * 获取格式化器使用统计
     * @returns 格式化器使用统计信息
     */
    getFormatterUsageStats(): {
        expressionFormatterLoaded: boolean;
        statementFormatterLoaded: boolean;
        literalFormatterLoaded: boolean;
        declarationFormatterLoaded: boolean;
        blockFormatterLoaded: boolean;
        loadedFormattersCount: number;
        totalFormattersCount: number;
    } {
        const stats = {
            expressionFormatterLoaded: !!this._expressionFormatter,
            statementFormatterLoaded: !!this._statementFormatter,
            literalFormatterLoaded: !!this._literalFormatter,
            declarationFormatterLoaded: !!this._declarationFormatter,
            blockFormatterLoaded: !!this._blockFormatter,
            loadedFormattersCount: 0,
            totalFormattersCount: 5
        };

        // 计算已加载的格式化器数量
        stats.loadedFormattersCount = Object.values(stats)
            .slice(0, 5) // 只计算前5个boolean值
            .filter(loaded => loaded).length;

        return stats;
    }

    /**
     * 获取扩展的调试信息
     * @returns 包含格式化器信息的调试字符串
     */
    getDebugInfo(): string {
        const baseDebugInfo = super.getDebugInfo();
        const formatterStats = this.getFormatterUsageStats();

        const formatterInfo = [
            '\n=== 专用格式化器状态 ===',
            `已加载: ${formatterStats.loadedFormattersCount}/${formatterStats.totalFormattersCount}`,
            `表达式格式化器: ${formatterStats.expressionFormatterLoaded ? '已加载' : '未加载'}`,
            `语句格式化器: ${formatterStats.statementFormatterLoaded ? '已加载' : '未加载'}`,
            `字面量格式化器: ${formatterStats.literalFormatterLoaded ? '已加载' : '未加载'}`,
            `声明格式化器: ${formatterStats.declarationFormatterLoaded ? '已加载' : '未加载'}`,
            `代码块格式化器: ${formatterStats.blockFormatterLoaded ? '已加载' : '未加载'}`
        ].join('\n');

        return baseDebugInfo + formatterInfo;
    }

    /**
     * 预加载所有格式化器
     * 在已知会大量使用时可以调用此方法来避免懒加载开销
     */
    preloadAllFormatters(): void {
        if (!this._nodeVisitor) {
            throw new Error('节点访问器未设置，无法预加载格式化器');
        }
        // 触发所有getter以创建格式化器实例
        this.expressionFormatter;
        this.statementFormatter;
        this.literalFormatter;
        this.declarationFormatter;
        this.blockFormatter;
    }

    /**
     * 检查特定格式化器是否已加载
     * @param formatterType 格式化器类型
     * @returns 是否已加载
     */
    isFormatterLoaded(formatterType: 'expression' | 'statement' | 'literal' | 'declaration' | 'block'): boolean {
        switch (formatterType) {
            case 'expression': return !!this._expressionFormatter;
            case 'statement': return !!this._statementFormatter;
            case 'literal': return !!this._literalFormatter;
            case 'declaration': return !!this._declarationFormatter;
            case 'block': return !!this._blockFormatter;
            default: return false;
        }
    }

    /**
     * 强制重新创建特定格式化器
     * @param formatterType 格式化器类型
     */
    recreateFormatter(formatterType: 'expression' | 'statement' | 'literal' | 'declaration' | 'block'): void {
        switch (formatterType) {
            case 'expression':
                this._expressionFormatter = undefined;
                break;
            case 'statement':
                this._statementFormatter = undefined;
                break;
            case 'literal':
                this._literalFormatter = undefined;
                break;
            case 'declaration':
                this._declarationFormatter = undefined;
                break;
            case 'block':
                this._blockFormatter = undefined;
                break;
        }
    }
}

/**
 * 创建扩展格式化上下文的工厂函数
 * @param tokenStream Token流
 * @param options 格式化选项
 * @returns 新的扩展格式化上下文实例
 */
export function createExtendedFormattingContext(
    tokenStream: CommonTokenStream,
    options: LPCFormattingOptions
): ExtendedFormattingContext {
    return new ExtendedFormattingContext(tokenStream, options);
}