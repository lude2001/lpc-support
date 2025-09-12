import * as vscode from 'vscode';
import { LPCFormatterImpl } from './lpcFormatter';
import { LPCFormattingOptions, DEFAULT_FORMATTING_OPTIONS } from './types';

/**
 * LPC 格式化提供者类
 * 
 * 这个类是VS Code扩展与LPC格式化器之间的桥接层，实现了VS Code的三种格式化接口：
 * 1. DocumentFormattingEditProvider: 提供整个文档的格式化功能
 * 2. DocumentRangeFormattingEditProvider: 提供选定范围的格式化功能  
 * 3. OnTypeFormattingEditProvider: 提供输入时的自动格式化功能
 * 
 * 主要职责：
 * - 接收VS Code的格式化请求
 * - 转换格式化选项到LPC特定的配置
 * - 调用LPCFormatterImpl执行实际的格式化工作
 * - 将格式化结果转换为VS Code的TextEdit对象
 * - 处理格式化过程中的错误和取消操作
 */
export class LPCFormattingProvider implements 
    vscode.DocumentFormattingEditProvider, 
    vscode.DocumentRangeFormattingEditProvider,
    vscode.OnTypeFormattingEditProvider {
    
    private formatter: LPCFormatterImpl;

    constructor() {
        this.formatter = new LPCFormatterImpl();
    }

    provideDocumentFormattingEdits(
        document: vscode.TextDocument, 
        options: vscode.FormattingOptions, 
        token: vscode.CancellationToken
    ): vscode.TextEdit[] | undefined {
        
        if (token.isCancellationRequested) {
            return undefined;
        }

        try {
            const text = document.getText();
            const formattingOptions = this.getFormattingOptions(options);
            
            const result = this.formatter.formatDocument(text, formattingOptions);
            
            if (result.text !== text) {
                // 返回替换整个文档的编辑
                const lastLine = document.lineAt(document.lineCount - 1);
                const fullRange = new vscode.Range(
                    new vscode.Position(0, 0),
                    new vscode.Position(document.lineCount - 1, lastLine.text.length)
                );
                
                return [{
                    range: fullRange,
                    newText: result.text
                }];
            }

            return [];

        } catch (error) {
            console.error('文档格式化失败:', error);
            vscode.window.showErrorMessage(`格式化失败: ${error instanceof Error ? error.message : '未知错误'}`);
            return [];
        }
    }

    provideDocumentRangeFormattingEdits(
        document: vscode.TextDocument,
        range: vscode.Range,
        options: vscode.FormattingOptions,
        token: vscode.CancellationToken
    ): vscode.TextEdit[] | undefined {
        
        if (token.isCancellationRequested) {
            return undefined;
        }

        try {
            const text = document.getText();
            const formattingOptions = this.getFormattingOptions(options);
            
            return this.formatter.formatRange(text, range, formattingOptions);

        } catch (error) {
            console.error('范围格式化失败:', error);
            vscode.window.showErrorMessage(`范围格式化失败: ${error instanceof Error ? error.message : '未知错误'}`);
            return [];
        }
    }

    provideOnTypeFormattingEdits(
        document: vscode.TextDocument,
        position: vscode.Position,
        ch: string,
        options: vscode.FormattingOptions,
        token: vscode.CancellationToken
    ): vscode.TextEdit[] | undefined {
        
        if (token.isCancellationRequested) {
            return undefined;
        }

        try {
            const text = document.getText();
            const formattingOptions = this.getFormattingOptions(options);
            
            return this.formatter.formatOnType(text, position, ch, formattingOptions);

        } catch (error) {
            console.error('输入时格式化失败:', error);
            return [];
        }
    }

    /**
     * 将VS Code的格式化选项转换为LPC特定的格式化配置
     * 
     * 此方法负责：
     * 1. 合并VS Code提供的基础格式化选项（如缩进、制表符设置）
     * 2. 从用户配置中读取LPC特定的格式化选项
     * 3. 对于未配置的选项使用默认值
     * 
     * 配置优先级：
     * - VS Code格式化选项（tabSize, insertSpaces）优先级最高
     * - 用户自定义配置（lpc.formatting.*）其次
     * - 默认配置（DEFAULT_FORMATTING_OPTIONS）作为后备
     * 
     * @param vscodeOptions VS Code提供的基础格式化选项
     * @returns 完整的LPC格式化配置对象
     */
    private getFormattingOptions(vscodeOptions: vscode.FormattingOptions): LPCFormattingOptions {
        // 读取LPC格式化相关的用户配置
        const config = vscode.workspace.getConfiguration('lpc.formatting');
        
        return {
            // 基础缩进设置：优先使用VS Code传递的选项
            tabSize: vscodeOptions.tabSize || DEFAULT_FORMATTING_OPTIONS.tabSize,
            insertSpaces: vscodeOptions.insertSpaces !== undefined ? vscodeOptions.insertSpaces : DEFAULT_FORMATTING_OPTIONS.insertSpaces,
            
            // 通用格式化选项：从用户配置读取
            indentSize: config.get('indentSize', DEFAULT_FORMATTING_OPTIONS.indentSize),
            insertFinalNewline: config.get('insertFinalNewline', DEFAULT_FORMATTING_OPTIONS.insertFinalNewline),
            trimTrailingWhitespace: config.get('trimTrailingWhitespace', DEFAULT_FORMATTING_OPTIONS.trimTrailingWhitespace),
            maxLineLength: config.get('maxLineLength', DEFAULT_FORMATTING_OPTIONS.maxLineLength),
            
            // 括号风格配置
            bracesOnNewLine: config.get('bracesOnNewLine', DEFAULT_FORMATTING_OPTIONS.bracesOnNewLine),
            indentOpenBrace: DEFAULT_FORMATTING_OPTIONS.indentOpenBrace, // 暂时使用默认值
            spaceBeforeOpenParen: config.get('spaceBeforeOpenParen', DEFAULT_FORMATTING_OPTIONS.spaceBeforeOpenParen),
            spaceAfterOpenParen: DEFAULT_FORMATTING_OPTIONS.spaceAfterOpenParen, // 暂时使用默认值
            spaceBeforeCloseParen: DEFAULT_FORMATTING_OPTIONS.spaceBeforeCloseParen, // 暂时使用默认值
            
            // 运算符间距控制
            spaceAroundOperators: config.get('spaceAroundOperators', DEFAULT_FORMATTING_OPTIONS.spaceAroundOperators),
            spaceAroundBinaryOperators: config.get('spaceAroundBinaryOperators', DEFAULT_FORMATTING_OPTIONS.spaceAroundBinaryOperators),
            spaceAroundAssignmentOperators: config.get('spaceAroundAssignmentOperators', DEFAULT_FORMATTING_OPTIONS.spaceAroundAssignmentOperators),
            spaceAfterComma: config.get('spaceAfterComma', DEFAULT_FORMATTING_OPTIONS.spaceAfterComma),
            spaceAfterSemicolon: DEFAULT_FORMATTING_OPTIONS.spaceAfterSemicolon, // 暂时使用默认值
            
            // 空行和换行控制
            maxEmptyLines: config.get('maxEmptyLines', DEFAULT_FORMATTING_OPTIONS.maxEmptyLines),
            insertSpaceAfterKeywords: config.get('insertSpaceAfterKeywords', DEFAULT_FORMATTING_OPTIONS.insertSpaceAfterKeywords),
            
            // LPC语言特定的格式化选项
            includeStatementSorting: config.get('includeStatementSorting', DEFAULT_FORMATTING_OPTIONS.includeStatementSorting),
            macroDefinitionAlignment: config.get('macroDefinitionAlignment', DEFAULT_FORMATTING_OPTIONS.macroDefinitionAlignment),
            inheritanceStatementStyle: config.get('inheritanceStatementStyle', DEFAULT_FORMATTING_OPTIONS.inheritanceStatementStyle),
            mappingLiteralFormat: config.get('mappingLiteralFormat', DEFAULT_FORMATTING_OPTIONS.mappingLiteralFormat), // 映射字面量格式化策略
            arrayLiteralWrapThreshold: config.get('arrayLiteralWrapThreshold', DEFAULT_FORMATTING_OPTIONS.arrayLiteralWrapThreshold), // 数组换行阈值
            functionModifierOrder: config.get('functionModifierOrder', DEFAULT_FORMATTING_OPTIONS.functionModifierOrder),
            switchCaseAlignment: config.get('switchCaseAlignment', DEFAULT_FORMATTING_OPTIONS.switchCaseAlignment),
            
            // 新增的格式化选项
            arrayOfMappingFormat: config.get('arrayOfMappingFormat', DEFAULT_FORMATTING_OPTIONS.arrayOfMappingFormat), // 映射数组格式化策略
            spaceAfterTypeBeforeStar: config.get('spaceAfterTypeBeforeStar', DEFAULT_FORMATTING_OPTIONS.spaceAfterTypeBeforeStar), // 类型和星号间空格
            starSpacePosition: config.get('starSpacePosition', DEFAULT_FORMATTING_OPTIONS.starSpacePosition), // 星号空格位置
            nestedStructureIndent: config.get('nestedStructureIndent', DEFAULT_FORMATTING_OPTIONS.nestedStructureIndent), // 嵌套结构缩进
            
            // 性能和安全选项
            maxNodeCount: config.get('maxNodeCount', DEFAULT_FORMATTING_OPTIONS.maxNodeCount) // 最大节点访问数量
        };
    }
}