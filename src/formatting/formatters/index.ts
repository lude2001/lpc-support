/**
 * 专用格式化器模块导出
 * 
 * 这个模块包含了所有专用的格式化器类，每个格式化器负责处理特定类型的AST节点：
 * 
 * - ExpressionFormatter: 处理各种表达式（赋值、算术、逻辑、位运算等）
 * - StatementFormatter: 处理各种语句（if、while、for、switch等）
 * - LiteralFormatter: 处理字面量（数组、映射）
 * - DeclarationFormatter: 处理声明（函数、变量、类型、结构等）
 * - BlockFormatter: 处理代码块
 */

export { ExpressionFormatter } from './ExpressionFormatter';
export { StatementFormatter } from './StatementFormatter';
export { LiteralFormatter } from './LiteralFormatter';
export { DeclarationFormatter } from './DeclarationFormatter';
export { BlockFormatter } from './BlockFormatter';

// 重新导出接口类型（修复：使用 export type 避免 isolatedModules 错误）
export type {
    ISpecializedFormatter,
    IExpressionFormatter,
    IStatementFormatter,
    ILiteralFormatter,
    IDeclarationFormatter,
    IBlockFormatter,
    IExtendedFormattingContext
} from '../types/interfaces';