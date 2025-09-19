/**
 * LPC 格式化配置接口
 */

export interface FormattingConfig {
    // 缩进设置
    indentSize: number;
    useSpaces: boolean;
    
    // 换行设置
    insertFinalNewline: boolean;
    trimTrailingWhitespace: boolean;
    maxLineLength: number;
    
    // 空格设置
    spaceAroundOperators: boolean;
    spaceAfterComma: boolean;
    spaceAfterSemicolon: boolean;
    spaceBeforeOpenParen: boolean;
    spaceInsideParentheses: boolean;
    spaceInsideBraces: boolean;
    spaceInsideBrackets: boolean;
    
    // 换行和对齐设置
    alignParameters: boolean;
    alignArguments: boolean;
    newlineBeforeOpenBrace: boolean;
    newlineAfterOpenBrace: boolean;
    newlineBeforeCloseBrace: boolean;
    
    // LPC特定设置
    formatFunctionPointers: boolean;
    formatMappings: boolean;
    formatArrays: boolean;
    preserveComments: boolean;

    // 高级LPC语法设置
    spaceAfterKeywords: boolean;      // foreach, if, while 等关键字后的空格
    spaceBeforeOpenBrace: boolean;    // 大括号前的空格
    spaceAfterCast: boolean;          // 类型转换后的空格
    formatSwitchRanges: boolean;      // 格式化switch范围匹配
    formatForeachRef: boolean;        // 格式化foreach ref语法
    formatAnonymousFunctions: boolean; // 格式化匿名函数
    formatExpressionPointers: boolean; // 格式化表达式函数指针
    formatVarargs: boolean;           // 格式化变长参数
    formatDefaultParameters: boolean; // 格式化默认参数
    formatRangeOperations: boolean;   // 格式化范围操作
    formatNewExpressions: boolean;    // 格式化new表达式
    formatCastExpressions: boolean;   // 格式化类型转换
    
    // 函数和控制结构
    functionCallStyle: 'compact' | 'expanded';
    functionDefStyle: 'compact' | 'expanded';
    controlStructureStyle: 'compact' | 'expanded';
    
    // 高级设置
    enableIncrementalFormatting: boolean;
    enableParallelProcessing: boolean;
    maxFormatTime: number; // 最大格式化时间（毫秒）
}

export interface FormattingRule {
    name: string;
    priority: number;
    enabled: boolean;
    apply(node: any, config: FormattingConfig): string;
}

export interface FormattingContext {
    indentLevel: number;
    inFunction: boolean;
    inArray: boolean;
    inMapping: boolean;
    inCondition: boolean;
    inSwitch: boolean;        // 在switch语句中
    inForeach: boolean;       // 在foreach循环中
    inAnonymousFunction: boolean; // 在匿名函数中
    inCast: boolean;          // 在类型转换中
    lineLength: number;
    previousToken?: string;
    nextToken?: string;
    currentRule?: string;     // 当前应用的规则名称
}

export interface FormattingResult {
    success: boolean;
    formattedText?: string;
    errors?: string[];
    warnings?: string[];
    duration: number;
}