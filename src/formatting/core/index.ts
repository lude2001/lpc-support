/**
 * 格式化核心模块导出索引
 * 统一导出所有核心基础设施组件
 */

// 核心实现类
export { ErrorCollector } from './ErrorCollector';
export { IndentManager } from './IndentManager';
export { TokenUtils } from './TokenUtils';
export { LineBreakManager } from './LineBreakManager';
export { FormattingCore } from './FormattingCore';
export { FormattingContext } from './FormattingContext';
export { ExtendedFormattingContext, createExtendedFormattingContext } from './ExtendedFormattingContext';

// 接口和类型定义
export * from '../types/interfaces';

// 便捷工厂函数
import { CommonTokenStream } from 'antlr4ts';
import { LPCFormattingOptions } from '../types';
import { FormattingContext } from './FormattingContext';
import { ExtendedFormattingContext } from './ExtendedFormattingContext';

/**
 * 创建标准的格式化上下文
 * @param tokenStream Token流
 * @param options 格式化选项
 * @returns 格式化上下文实例
 */
export function createFormattingContext(
    tokenStream: CommonTokenStream,
    options: LPCFormattingOptions
): FormattingContext {
    return new FormattingContext(tokenStream, options);
}

/**
 * 创建轻量级的格式化上下文
 * 用于简单的格式化任务，减少内存占用
 * @param tokenStream Token流
 * @param options 格式化选项
 * @returns 轻量级格式化上下文
 */
export function createLightweightFormattingContext(
    tokenStream: CommonTokenStream,
    options: LPCFormattingOptions
): {
    core: import('./FormattingCore').FormattingCore;
    indentManager: import('./IndentManager').IndentManager;
    errorCollector: import('./ErrorCollector').ErrorCollector;
} {
    const core = new (require('./FormattingCore').FormattingCore)(tokenStream, options);
    const indentManager = new (require('./IndentManager').IndentManager)(options);
    const errorCollector = new (require('./ErrorCollector').ErrorCollector)();

    return {
        core,
        indentManager,
        errorCollector
    };
}