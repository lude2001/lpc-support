import { FormattingConfig } from './FormattingConfig';

/**
 * LPC 格式化默认配置
 */
export const DEFAULT_FORMATTING_CONFIG: FormattingConfig = {
    // 缩进设置
    indentSize: 4,
    useSpaces: true,
    
    // 换行设置
    insertFinalNewline: true,
    trimTrailingWhitespace: true,
    maxLineLength: 120,
    
    // 空格设置
    spaceAroundOperators: true,
    spaceAfterComma: true,
    spaceAfterSemicolon: true,
    spaceBeforeOpenParen: false,
    spaceInsideParentheses: false,
    spaceInsideBraces: true,
    spaceInsideBrackets: false,
    
    // 换行和对齐设置
    alignParameters: true,
    alignArguments: false,
    newlineBeforeOpenBrace: false,
    newlineAfterOpenBrace: true,
    newlineBeforeCloseBrace: true,
    
    // LPC特定设置
    formatFunctionPointers: true,
    formatMappings: true,
    formatArrays: true,
    preserveComments: true,

    // 高级LPC语法设置
    spaceAfterKeywords: true,
    spaceBeforeOpenBrace: true,
    spaceAfterCast: true,
    formatSwitchRanges: true,
    formatForeachRef: true,
    formatAnonymousFunctions: true,
    formatExpressionPointers: true,
    formatVarargs: true,
    formatDefaultParameters: true,
    formatRangeOperations: true,
    formatNewExpressions: true,
    formatCastExpressions: true,
    
    // 函数和控制结构
    functionCallStyle: 'compact',
    functionDefStyle: 'expanded',
    controlStructureStyle: 'compact',
    
    // 高级设置
    enableIncrementalFormatting: true,
    enableParallelProcessing: false,
    maxFormatTime: 5000 // 5秒
};

/**
 * 从VS Code配置加载格式化设置
 */
export function loadFormattingConfig(): FormattingConfig {
    const vscode = require('vscode');
    const config = vscode.workspace.getConfiguration('lpc.formatting');
    
    return {
        // 从VS Code配置读取，如果没有则使用默认值
        indentSize: config.get('indentSize', DEFAULT_FORMATTING_CONFIG.indentSize),
        useSpaces: config.get('useSpaces', DEFAULT_FORMATTING_CONFIG.useSpaces),
        
        insertFinalNewline: config.get('insertFinalNewline', DEFAULT_FORMATTING_CONFIG.insertFinalNewline),
        trimTrailingWhitespace: config.get('trimTrailingWhitespace', DEFAULT_FORMATTING_CONFIG.trimTrailingWhitespace),
        maxLineLength: config.get('maxLineLength', DEFAULT_FORMATTING_CONFIG.maxLineLength),
        
        spaceAroundOperators: config.get('spaceAroundOperators', DEFAULT_FORMATTING_CONFIG.spaceAroundOperators),
        spaceAfterComma: config.get('spaceAfterComma', DEFAULT_FORMATTING_CONFIG.spaceAfterComma),
        spaceAfterSemicolon: config.get('spaceAfterSemicolon', DEFAULT_FORMATTING_CONFIG.spaceAfterSemicolon),
        spaceBeforeOpenParen: config.get('spaceBeforeOpenParen', DEFAULT_FORMATTING_CONFIG.spaceBeforeOpenParen),
        spaceInsideParentheses: config.get('spaceInsideParentheses', DEFAULT_FORMATTING_CONFIG.spaceInsideParentheses),
        spaceInsideBraces: config.get('spaceInsideBraces', DEFAULT_FORMATTING_CONFIG.spaceInsideBraces),
        spaceInsideBrackets: config.get('spaceInsideBrackets', DEFAULT_FORMATTING_CONFIG.spaceInsideBrackets),
        
        alignParameters: config.get('alignParameters', DEFAULT_FORMATTING_CONFIG.alignParameters),
        alignArguments: config.get('alignArguments', DEFAULT_FORMATTING_CONFIG.alignArguments),
        newlineBeforeOpenBrace: config.get('newlineBeforeOpenBrace', DEFAULT_FORMATTING_CONFIG.newlineBeforeOpenBrace),
        newlineAfterOpenBrace: config.get('newlineAfterOpenBrace', DEFAULT_FORMATTING_CONFIG.newlineAfterOpenBrace),
        newlineBeforeCloseBrace: config.get('newlineBeforeCloseBrace', DEFAULT_FORMATTING_CONFIG.newlineBeforeCloseBrace),
        
        formatFunctionPointers: config.get('formatFunctionPointers', DEFAULT_FORMATTING_CONFIG.formatFunctionPointers),
        formatMappings: config.get('formatMappings', DEFAULT_FORMATTING_CONFIG.formatMappings),
        formatArrays: config.get('formatArrays', DEFAULT_FORMATTING_CONFIG.formatArrays),
        preserveComments: config.get('preserveComments', DEFAULT_FORMATTING_CONFIG.preserveComments),

        spaceAfterKeywords: config.get('spaceAfterKeywords', DEFAULT_FORMATTING_CONFIG.spaceAfterKeywords),
        spaceBeforeOpenBrace: config.get('spaceBeforeOpenBrace', DEFAULT_FORMATTING_CONFIG.spaceBeforeOpenBrace),
        spaceAfterCast: config.get('spaceAfterCast', DEFAULT_FORMATTING_CONFIG.spaceAfterCast),
        formatSwitchRanges: config.get('formatSwitchRanges', DEFAULT_FORMATTING_CONFIG.formatSwitchRanges),
        formatForeachRef: config.get('formatForeachRef', DEFAULT_FORMATTING_CONFIG.formatForeachRef),
        formatAnonymousFunctions: config.get('formatAnonymousFunctions', DEFAULT_FORMATTING_CONFIG.formatAnonymousFunctions),
        formatExpressionPointers: config.get('formatExpressionPointers', DEFAULT_FORMATTING_CONFIG.formatExpressionPointers),
        formatVarargs: config.get('formatVarargs', DEFAULT_FORMATTING_CONFIG.formatVarargs),
        formatDefaultParameters: config.get('formatDefaultParameters', DEFAULT_FORMATTING_CONFIG.formatDefaultParameters),
        formatRangeOperations: config.get('formatRangeOperations', DEFAULT_FORMATTING_CONFIG.formatRangeOperations),
        formatNewExpressions: config.get('formatNewExpressions', DEFAULT_FORMATTING_CONFIG.formatNewExpressions),
        formatCastExpressions: config.get('formatCastExpressions', DEFAULT_FORMATTING_CONFIG.formatCastExpressions),
        
        functionCallStyle: config.get('functionCallStyle', DEFAULT_FORMATTING_CONFIG.functionCallStyle),
        functionDefStyle: config.get('functionDefStyle', DEFAULT_FORMATTING_CONFIG.functionDefStyle),
        controlStructureStyle: config.get('controlStructureStyle', DEFAULT_FORMATTING_CONFIG.controlStructureStyle),
        
        enableIncrementalFormatting: config.get('enableIncrementalFormatting', DEFAULT_FORMATTING_CONFIG.enableIncrementalFormatting),
        enableParallelProcessing: config.get('enableParallelProcessing', DEFAULT_FORMATTING_CONFIG.enableParallelProcessing),
        maxFormatTime: config.get('maxFormatTime', DEFAULT_FORMATTING_CONFIG.maxFormatTime)
    };
}