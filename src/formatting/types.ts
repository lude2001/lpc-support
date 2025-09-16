import * as vscode from 'vscode';

/**
 * LPC 格式化选项配置接口
 * 定义了所有可用的格式化配置选项，包括通用格式化选项和LPC语言特定选项
 */
export interface LPCFormattingOptions {
    // ===== 基础缩进和空白控制 =====
    /** 缩进大小（空格数） */
    indentSize: number;
    /** 是否在文件末尾插入换行符 */
    insertFinalNewline: boolean;
    /** 是否删除行尾空白字符 */
    trimTrailingWhitespace: boolean;
    /** 最大行长度，用于决定是否换行 */
    maxLineLength: number;
    /** 制表符大小 */
    tabSize: number;
    /** 是否使用空格而不是制表符进行缩进 */
    insertSpaces: boolean;
    
    // ===== 括号风格控制 =====
    /** 是否将开括号放在新行（如函数定义、if语句等） */
    bracesOnNewLine: boolean;
    /** 是否缩进开括号 */
    indentOpenBrace: boolean;
    /** 是否在开括号前添加空格 */
    spaceBeforeOpenParen: boolean;
    /** 是否在开括号后添加空格 */
    spaceAfterOpenParen: boolean;
    /** 是否在闭括号前添加空格 */
    spaceBeforeCloseParen: boolean;
    
    // ===== 运算符间距控制 =====
    /** 是否在运算符周围添加空格（通用设置） */
    spaceAroundOperators: boolean;
    /** 是否在二元运算符周围添加空格（如 +, -, *, / 等） */
    spaceAroundBinaryOperators: boolean;
    /** 是否在赋值运算符周围添加空格（如 =, +=, -= 等） */
    spaceAroundAssignmentOperators: boolean;
    /** 是否在逗号后添加空格 */
    spaceAfterComma: boolean;
    /** 是否在分号后添加空格 */
    spaceAfterSemicolon: boolean;
    
    // ===== 空行和换行控制 =====
    /** 最大连续空行数 */
    maxEmptyLines: number;
    /** 是否在关键字后插入空格（如 if、while、for 等） */
    insertSpaceAfterKeywords: boolean;
    
    // ===== LPC语言特定格式化选项 =====
    
    /** 
     * include语句排序方式
     * - 'none': 不排序，保持原有顺序
     * - 'alphabetical': 按字母顺序排序
     * - 'system-first': 系统头文件优先，然后按字母顺序排序
     */
    includeStatementSorting: 'none' | 'alphabetical' | 'system-first';
    
    /** 
     * 宏定义对齐方式
     * - 'none': 不对齐
     * - 'column': 按列对齐宏名称
     * - 'value': 按列对齐宏值
     */
    macroDefinitionAlignment: 'none' | 'column' | 'value';
    
    /** 
     * 继承语句风格
     * - 'single-line': 强制单行格式
     * - 'multi-line': 强制多行格式
     * - 'auto': 根据长度自动决定
     */
    inheritanceStatementStyle: 'single-line' | 'multi-line' | 'auto';
    
    /** 
     * 映射字面量格式化策略
     * - 'compact': 紧凑格式，所有键值对在一行：([ key1 : value1, key2 : value2 ])
     * - 'expanded': 展开格式，每个键值对一行，带缩进
     * - 'auto': 根据键值对数量自动决定（超过3个则展开）
     */
    mappingLiteralFormat: 'compact' | 'expanded' | 'auto';
    
    /** 数组字面量换行阈值，当元素数量超过此值时自动换行 */
    arrayLiteralWrapThreshold: number;
    
    /** 函数修饰符的排列顺序（如 public, protected, private, static 等） */
    functionModifierOrder: string[];
    
    /** 
     * switch语句中case标签的对齐方式
     * - 'switch': 与switch关键字对齐
     * - 'indent': 相对于switch缩进一级
     */
    switchCaseAlignment: 'switch' | 'indent';
    
    // ===== 新增的格式化选项 =====
    
    /** 
     * 映射数组格式化策略
     * - 'compact': 紧凑格式，映射数组在一行
     * - 'expanded': 展开格式，每个映射元素独立一行
     * - 'auto': 根据数组元素数量和复杂度自动决定
     */
    arrayOfMappingFormat: 'compact' | 'expanded' | 'auto';
    
    /** 
     * 类型名和星号之间是否添加空格
     * true: mapping * arr
     * false: mapping *arr 或 mapping* arr (根据starSpacePosition决定)
     */
    spaceAfterTypeBeforeStar: boolean;
    
    /** 
     * 星号的空格位置
     * - 'before': * arr (星号前有空格，星号后有空格)
     * - 'after': *arr (星号前无空格，星号后无空格) 
     * - 'both': * arr (两侧都有空格，当spaceAfterTypeBeforeStar为true时)
     */
    starSpacePosition: 'before' | 'after' | 'both';
    
    /** 
     * 嵌套结构的额外缩进量
     * 当映射或数组嵌套时，内部结构相对于外部结构的额外缩进
     */
    nestedStructureIndent: number;
    
    // ===== 性能和安全选项 =====
    
    /** 
     * 最大节点访问数量
     * 防止在格式化过程中无限递归或处理过大文件
     */
    maxNodeCount: number;
}

/**
 * 格式化结果接口
 * 包含格式化后的文本和可能的编辑操作及诊断信息
 */
export interface FormattedResult {
    /** 格式化后的文本内容 */
    text: string;
    /** 可选的编辑操作列表，用于增量更新 */
    edits?: vscode.TextEdit[];
    /** 格式化过程中产生的诊断信息（警告、错误等） */
    diagnostics?: vscode.Diagnostic[];
}

/**
 * LPC格式化器接口
 * 定义了格式化器必须实现的三种核心格式化功能
 */
export interface LPCFormatter {
    /**
     * 格式化整个文档
     * @param text 待格式化的完整文本
     * @param options 格式化选项配置
     * @returns 格式化结果，包含新文本和诊断信息
     */
    formatDocument(text: string, options: LPCFormattingOptions): FormattedResult;
    
    /**
     * 格式化指定文本范围
     * @param text 完整的文档文本
     * @param range 需要格式化的文本范围
     * @param options 格式化选项配置
     * @returns 文本编辑操作列表
     */
    formatRange(text: string, range: vscode.Range, options: LPCFormattingOptions): vscode.TextEdit[];
    
    /**
     * 输入时自动格式化
     * 当用户输入特定字符（如 }、;、) 等）时触发
     * @param text 完整的文档文本
     * @param position 输入字符的位置
     * @param character 输入的字符
     * @param options 格式化选项配置
     * @returns 文本编辑操作列表
     */
    formatOnType(text: string, position: vscode.Position, character: string, options: LPCFormattingOptions): vscode.TextEdit[];
}

/**
 * LPC格式化器的默认配置选项
 * 
 * 这些默认值经过精心设计，符合大多数LPC项目的代码风格：
 * - 使用4空格缩进，符合现代代码风格
 * - 启用行尾空白清理和文件结尾换行
 * - 在运算符周围添加空格以提高可读性
 * - 映射和数组使用智能格式化（auto模式）
 * - include语句按系统头文件优先排序
 */
export const DEFAULT_FORMATTING_OPTIONS: LPCFormattingOptions = {
    // 基础缩进：使用4空格缩进，符合现代代码风格
    indentSize: 4,
    insertFinalNewline: true,        // 文件末尾添加换行符
    trimTrailingWhitespace: true,    // 清理行尾空白
    maxLineLength: 100,              // 行长度限制为100字符
    tabSize: 4,                      // 制表符宽度为4
    insertSpaces: true,              // 优先使用空格而非制表符
    
    // 括号风格：紧凑风格，开括号不换行
    bracesOnNewLine: false,          // 开括号跟在语句后，不换行
    indentOpenBrace: false,          // 开括号不缩进
    spaceBeforeOpenParen: false,     // 函数调用时括号前不加空格
    spaceAfterOpenParen: false,      // 开括号后不加空格
    spaceBeforeCloseParen: false,    // 闭括号前不加空格
    
    // 运算符间距：启用空格以提高可读性
    spaceAroundOperators: true,           // 运算符周围加空格
    spaceAroundBinaryOperators: true,     // 二元运算符（+, -, *, /）周围加空格
    spaceAroundAssignmentOperators: true, // 赋值运算符（=, +=）周围加空格
    spaceAfterComma: true,               // 逗号后加空格
    spaceAfterSemicolon: true,           // 分号后加空格
    
    // 空行控制
    maxEmptyLines: 2,                // 最多2行连续空行
    insertSpaceAfterKeywords: true,  // 关键字后加空格（如 if (condition)）
    
    // LPC特定选项：智能化配置
    includeStatementSorting: 'system-first',    // 系统头文件优先排序
    macroDefinitionAlignment: 'column',          // 宏定义按列对齐
    inheritanceStatementStyle: 'auto',          // 继承语句自动换行
    mappingLiteralFormat: 'auto',               // 映射字面量智能格式化（3个以上键值对换行）
    arrayLiteralWrapThreshold: 5,               // 数组元素超过5个时换行
    functionModifierOrder: ['public', 'protected', 'private', 'static', 'virtual', 'nomask'], // 函数修饰符标准顺序
    switchCaseAlignment: 'indent',              // case标签相对于switch缩进
    
    // 新增的格式化选项默认值
    arrayOfMappingFormat: 'auto',               // 映射数组智能格式化
    spaceAfterTypeBeforeStar: true,             // 类型名和星号间加空格：mapping *
    starSpacePosition: 'after',                 // 星号紧跟类型名：mapping*arr
    nestedStructureIndent: 4,                   // 嵌套结构额外缩进4空格
    
    // 性能和安全选项默认值
    maxNodeCount: 10000                         // 最大节点访问数量
};