import * as vscode from 'vscode';
import { LPCFormattingOptions, LPCFormatter, FormattedResult } from './types';
import { CharStreams, CommonTokenStream } from 'antlr4ts';
import { LPCLexer } from '../antlr/LPCLexer';
import { LPCParser } from '../antlr/LPCParser';
import { FormattingVisitor } from './FormattingVisitor';
import { FormattingCache } from './formattingCache';

/**
 * LPC 格式化程序实现类
 * 
 * 核心功能：
 * 1. 文档格式化：格式化整个LPC文档
 * 2. 范围格式化：格式化指定的代码范围  
 * 3. 输入时格式化：在用户输入特定字符时自动格式化
 * 4. 性能优化：使用缓存机制提高格式化速度
 * 5. 错误处理：提供详细的错误信息和诊断
 * 
 * 工作流程：
 * 1. 解析LPC代码生成AST（抽象语法树）
 * 2. 使用FormattingVisitor遍历AST节点
 * 3. 根据配置选项生成格式化后的代码
 * 4. 缓存结果以提高后续格式化性能
 */
export class LPCFormatterImpl implements LPCFormatter {
    private cache: FormattingCache;
    private performanceStats = {
        totalRequests: 0,
        cacheHits: 0,
        averageFormatTime: 0,
        totalFormatTime: 0
    };

    constructor() {
        // 从VS Code配置中读取缓存设置
        // maxCacheSize: 最大缓存条目数量
        // maxCacheMemory: 最大缓存内存使用量（字节）
        const config = vscode.workspace.getConfiguration('lpc.performance');
        const maxCacheSize = config.get('maxCacheSize', 50);
        const maxCacheMemory = config.get('maxCacheMemory', 5000000);
        
        this.cache = new FormattingCache(maxCacheSize, maxCacheMemory);
    }

    /**
     * 格式化整个LPC文档
     * 
     * 处理流程：
     * 1. 性能优化：先检查缓存，如果命中则直接返回缓存结果
     * 2. 安全检查：检查文件大小限制，避免格式化过大文件导致性能问题
     * 3. 语法解析：使用ANTLR解析器将LPC代码解析为AST
     * 4. 错误检查：如果解析错误过多，跳过格式化避免破坏代码结构
     * 5. 格式化处理：使用FormattingVisitor遍历AST并生成格式化代码
     * 6. 结果缓存：将格式化结果缓存以提高后续性能
     * 
     * @param text 待格式化的LPC代码文本
     * @param options 格式化选项配置
     * @returns 格式化结果，包含格式化后的代码和诊断信息
     */
    formatDocument(text: string, options: LPCFormattingOptions): FormattedResult {
        const startTime = Date.now();
        this.performanceStats.totalRequests++;
        const diagnostics: vscode.Diagnostic[] = [];

        try {
            // 步骤1: 输入验证
            const inputValidation = this.validateInput(text, options);
            if (!inputValidation.isValid) {
                return {
                    text: text,
                    diagnostics: inputValidation.diagnostics
                };
            }

            // 步骤2: 检查缓存，提高重复格式化的性能
            const cachedResult = this.cache.get(text, options);
            if (cachedResult) {
                this.performanceStats.cacheHits++;
                return {
                    text: cachedResult,
                    diagnostics: []
                };
            }

            // 步骤3: 检查文件大小限制
            const sizeCheck = this.checkFileSize(text);
            if (!sizeCheck.canFormat) {
                return {
                    text: text,
                    diagnostics: sizeCheck.diagnostics
                };
            }

            // 步骤4: 解析文本并生成抽象语法树(AST)
            const parseResult = this.parseText(text);
            diagnostics.push(...parseResult.diagnostics);
            
            if (!parseResult.tree) {
                return {
                    text: text,
                    diagnostics: [...diagnostics, this.createDiagnostic(
                        'error',
                        '解析失败，无法生成语法树',
                        new vscode.Range(0, 0, 0, 0),
                        'PARSE_FAILED'
                    )]
                };
            }

            // 步骤5: 检查解析错误严重程度
            const errorAnalysis = this.analyzeParseErrors(parseResult.diagnostics);
            if (!errorAnalysis.shouldFormat) {
                diagnostics.push(this.createDiagnostic(
                    'warning',
                    errorAnalysis.reason || 'Parse errors prevent formatting',
                    new vscode.Range(0, 0, 0, 0),
                    'SKIP_FORMAT'
                ));
                return {
                    text: text,
                    diagnostics: diagnostics
                };
            }

            // 步骤6: 格式化处理
            const formatResult = this.performFormatting(text, parseResult, options);
            diagnostics.push(...formatResult.diagnostics);
            
            // 步骤6.5: 后处理 - 缩进标准化和空格优化
            const postProcessedResult = this.postProcessFormatting(formatResult.text, options);
            formatResult.text = postProcessedResult.text;
            diagnostics.push(...postProcessedResult.diagnostics);

            // 步骤7: 质量检查
            const qualityCheck = this.validateFormattedResult(text, formatResult.text);
            if (!qualityCheck.isValid) {
                diagnostics.push(...qualityCheck.diagnostics);
                // 如果格式化结果有严重问题，返回原文本
                if (qualityCheck.severity === 'error') {
                    return {
                        text: text,
                        diagnostics: diagnostics
                    };
                }
            }

            // 步骤8: 缓存结果（只有在质量检查通过时）
            if (qualityCheck.isValid && formatResult.diagnostics.length < 5) {
                this.cache.set(text, options, formatResult.text);
            }

            // 更新性能统计信息
            const formatTime = Date.now() - startTime;
            this.updatePerformanceStats(formatTime);

            return {
                text: formatResult.text,
                diagnostics: diagnostics
            };

        } catch (error) {
            const formatTime = Date.now() - startTime;
            this.updatePerformanceStats(formatTime);
            
            const errorDiagnostic = this.createErrorDiagnostic(error, 'FORMAT_DOCUMENT_ERROR');
            
            return {
                text: text,
                diagnostics: [...diagnostics, errorDiagnostic]
            };
        }
    }

    private updatePerformanceStats(formatTime: number): void {
        this.performanceStats.totalFormatTime += formatTime;
        this.performanceStats.averageFormatTime = 
            this.performanceStats.totalFormatTime / this.performanceStats.totalRequests;
    }

    getPerformanceStats() {
        return {
            ...this.performanceStats,
            cacheStats: this.cache.getStats(),
            cacheHitRate: this.performanceStats.totalRequests > 0 
                ? (this.performanceStats.cacheHits / this.performanceStats.totalRequests * 100).toFixed(2) + '%'
                : '0%'
        };
    }

    clearCache(): void {
        this.cache.clear();
    }

    private parseText(text: string): { tree: any, tokenStream: CommonTokenStream, diagnostics: vscode.Diagnostic[] } {
        const diagnostics: vscode.Diagnostic[] = [];

        try {
            // 创建词法分析器
            const inputStream = CharStreams.fromString(text);
            const lexer = new LPCLexer(inputStream);
            
            // 创建语法分析器
            const tokenStream = new CommonTokenStream(lexer);
            const parser = new LPCParser(tokenStream);
            
            // 添加错误监听器
            parser.removeErrorListeners();
            parser.addErrorListener({
                syntaxError: (recognizer, offendingSymbol, line, charPositionInLine, msg, e) => {
                    const diagnostic = new vscode.Diagnostic(
                        new vscode.Range(line - 1, charPositionInLine, line - 1, charPositionInLine + 1),
                        msg,
                        vscode.DiagnosticSeverity.Error
                    );
                    diagnostics.push(diagnostic);
                }
            });

            // 解析源文件
            const tree = parser.sourceFile();

            return { tree, tokenStream, diagnostics };

        } catch (error) {
            console.error('解析文本失败:', error);
            diagnostics.push({
                severity: vscode.DiagnosticSeverity.Error,
                range: new vscode.Range(0, 0, 0, 0),
                message: `解析失败: ${error instanceof Error ? error.message : '未知错误'}`,
                source: 'LPC Parser'
            });
            const lexer = new LPCLexer(CharStreams.fromString(''));
            return { tree: null, tokenStream: new CommonTokenStream(lexer), diagnostics };
        }
    }

    formatRange(text: string, range: vscode.Range, options: LPCFormattingOptions): vscode.TextEdit[] {
        try {
            const lines = text.split('\n');
            const startLine = Math.max(0, range.start.line);
            const endLine = Math.min(lines.length - 1, range.end.line);
            
            // 扩展选择范围以包含完整的语法结构
            const expandedRange = this.expandRangeToCompleteStatements(lines, startLine, endLine);
            const expandedText = lines.slice(expandedRange.start, expandedRange.end + 1).join('\n');
            
            // 获取上下文缩进级别
            const contextIndent = this.getContextIndentLevel(lines, expandedRange.start);
            
            // 格式化扩展的文本
            const formattedResult = this.formatDocument(expandedText, options);
            
            if (formattedResult.text !== expandedText) {
                // 调整格式化结果的缩进以匹配上下文
                const adjustedText = this.adjustIndentToContext(formattedResult.text, contextIndent, options);
                
                // 只返回原始选择范围内的更改
                const originalRangeLines = adjustedText.split('\n');
                const relevantLines = originalRangeLines.slice(
                    startLine - expandedRange.start,
                    endLine - expandedRange.start + 1
                );
                
                const newText = relevantLines.join('\n');
                const originalText = lines.slice(startLine, endLine + 1).join('\n');
                
                if (newText !== originalText) {
                    return [{
                        range: new vscode.Range(startLine, 0, endLine, lines[endLine].length),
                        newText: newText
                    }];
                }
            }
            
            return [];

        } catch (error) {
            console.error('格式化范围时出错:', error);
            return [];
        }
    }

    private expandRangeToCompleteStatements(lines: string[], startLine: number, endLine: number): { start: number, end: number } {
        let expandedStart = startLine;
        let expandedEnd = endLine;
        
        // 向上扩展到完整语句的开始
        while (expandedStart > 0) {
            const line = lines[expandedStart - 1].trim();
            if (line.endsWith(';') || line.endsWith('}') || line.endsWith('{') || line === '') {
                break;
            }
            expandedStart--;
        }
        
        // 向下扩展到完整语句的结束
        while (expandedEnd < lines.length - 1) {
            const line = lines[expandedEnd].trim();
            if (line.endsWith(';') || line.endsWith('}')) {
                break;
            }
            if (line.endsWith('{')) {
                // 找到匹配的闭合括号
                let braceCount = 1;
                for (let i = expandedEnd + 1; i < lines.length; i++) {
                    const nextLine = lines[i];
                    braceCount += (nextLine.match(/\{/g) || []).length;
                    braceCount -= (nextLine.match(/\}/g) || []).length;
                    if (braceCount === 0) {
                        expandedEnd = i;
                        break;
                    }
                }
                break;
            }
            expandedEnd++;
        }
        
        return { start: expandedStart, end: expandedEnd };
    }

    private getContextIndentLevel(lines: string[], lineIndex: number): number {
        for (let i = lineIndex - 1; i >= 0; i--) {
            const line = lines[i];
            if (line.trim() !== '') {
                return this.getLineIndentLevel(line);
            }
        }
        return 0;
    }

    private adjustIndentToContext(text: string, contextIndent: number, options: LPCFormattingOptions): string {
        const lines = text.split('\n');
        const adjustedLines = lines.map((line, index) => {
            if (line.trim() === '') {
                return line;
            }
            
            const currentIndent = this.getLineIndentLevel(line);
            const content = line.substring(currentIndent);
            const newIndent = contextIndent + (currentIndent > 0 ? options.indentSize : 0);
            
            return this.createIndent(newIndent, options) + content;
        });
        
        return adjustedLines.join('\n');
    }

    formatOnType(text: string, position: vscode.Position, character: string, options: LPCFormattingOptions): vscode.TextEdit[] {
        try {
            const lines = text.split('\n');
            const currentLine = lines[position.line];
            
            // 根据输入的字符进行不同的格式化处理
            switch (character) {
                case '}':
                    return this.formatClosingBrace(lines, position, options);
                case ';':
                    return this.formatSemicolon(lines, position, options);
                case ')':
                    return this.formatClosingParen(lines, position, options);
                default:
                    return [];
            }

        } catch (error) {
            console.error('输入时格式化出错:', error);
            return [];
        }
    }

    private formatClosingBrace(lines: string[], position: vscode.Position, options: LPCFormattingOptions): vscode.TextEdit[] {
        const currentLine = lines[position.line];
        const trimmedLine = currentLine.trim();
        
        // 如果当前行只有一个闭合括号，调整其缩进
        if (trimmedLine === '}') {
            const indentLevel = this.calculateBraceIndentLevel(lines, position.line);
            const newIndent = this.createIndent(indentLevel, options);
            const newText = newIndent + '}';
            
            if (currentLine !== newText) {
                return [{
                    range: new vscode.Range(position.line, 0, position.line, currentLine.length),
                    newText: newText
                }];
            }
        }
        
        return [];
    }

    private formatSemicolon(lines: string[], position: vscode.Position, options: LPCFormattingOptions): vscode.TextEdit[] {
        const currentLine = lines[position.line];
        const edits: vscode.TextEdit[] = [];
        
        // 删除分号前的多余空格
        const beforeSemicolon = currentLine.substring(0, position.character - 1);
        const afterSemicolon = currentLine.substring(position.character);
        
        // 移除分号前的空格
        const trimmedBefore = beforeSemicolon.replace(/\s+$/, '');
        if (trimmedBefore !== beforeSemicolon) {
            edits.push({
                range: new vscode.Range(
                    position.line, 
                    trimmedBefore.length, 
                    position.line, 
                    position.character - 1
                ),
                newText: ''
            });
        }
        
        // 检查是否需要在分号后添加空格（如果不是行尾）
        if (afterSemicolon.trim() !== '' && !afterSemicolon.startsWith(' ') && options.spaceAfterSemicolon) {
            edits.push({
                range: new vscode.Range(position.line, position.character, position.line, position.character),
                newText: ' '
            });
        }
        
        return edits;
    }

    private formatClosingParen(lines: string[], position: vscode.Position, options: LPCFormattingOptions): vscode.TextEdit[] {
        const currentLine = lines[position.line];
        const edits: vscode.TextEdit[] = [];
        
        // 如果配置了在闭合括号前不要空格，则删除多余空格
        if (!options.spaceBeforeCloseParen) {
            const beforeParen = currentLine.substring(0, position.character - 1);
            const trimmedBefore = beforeParen.replace(/\s+$/, '');
            
            if (trimmedBefore !== beforeParen) {
                edits.push({
                    range: new vscode.Range(
                        position.line,
                        trimmedBefore.length,
                        position.line,
                        position.character - 1
                    ),
                    newText: ''
                });
            }
        }
        
        // 检查是否是函数调用或控制结构的结束，可能需要添加空格
        const afterParen = currentLine.substring(position.character).trim();
        if (afterParen.startsWith('{') && options.spaceBeforeOpenParen) {
            const immediateAfter = currentLine.substring(position.character);
            if (!immediateAfter.startsWith(' ')) {
                edits.push({
                    range: new vscode.Range(position.line, position.character, position.line, position.character),
                    newText: ' '
                });
            }
        }
        
        return edits;
    }

    private calculateBraceIndentLevel(lines: string[], lineIndex: number): number {
        let braceCount = 0;
        let indentLevel = 0;
        
        // 从当前行向上扫描，计算应有的缩进级别
        for (let i = lineIndex - 1; i >= 0; i--) {
            const line = lines[i].trim();
            
            if (line.includes('{')) {
                braceCount++;
                if (braceCount > 0) {
                    indentLevel = this.getLineIndentLevel(lines[i]);
                    break;
                }
            }
            
            if (line.includes('}')) {
                braceCount--;
            }
        }
        
        return indentLevel;
    }

    private getLineIndentLevel(line: string): number {
        let indent = 0;
        for (const char of line) {
            if (char === ' ') {
                indent++;
            } else if (char === '\t') {
                indent += 4; // 假设一个tab等于4个空格
            } else {
                break;
            }
        }
        return indent;
    }

    /**
     * 基于token流的格式化方法，保留注释和所有代码内容
     * 这个方法遍历所有token（包括隐藏通道中的注释），重新组织格式
     * 增加字符串引号修复和缩进标准化功能
     */
    private formatUsingTokenStream(originalText: string, tokenStream: CommonTokenStream, options: LPCFormattingOptions): string {
        // 获取所有token，包括隐藏通道的注释
        const tokens = tokenStream.getTokens();
        if (!tokens || tokens.length === 0) {
            return originalText;
        }

        let result = '';
        let currentIndent = 0;
        let needsNewline = false;
        let lastTokenWasNewline = false;
        let emptyLineCount = 0;
        let inMappingArray = false;
        let mappingArrayDepth = 0;

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            const tokenType = token.type;
            const tokenText = token.text;
            
            if (!tokenText) continue;

            // 检查隐藏通道中的注释
            const hiddenTokens = this.getHiddenTokensToLeft(tokenStream, i);
            for (const hiddenToken of hiddenTokens) {
                if (hiddenToken.type === this.getCommentTokenType() || 
                    hiddenToken.type === this.getLineCommentTokenType()) {
                    // 处理注释
                    if (needsNewline && !lastTokenWasNewline) {
                        result += '\n';
                        lastTokenWasNewline = true;
                    }
                    if (lastTokenWasNewline) {
                        result += this.createIndent(currentIndent, options);
                    }
                    result += hiddenToken.text;
                    if (hiddenToken.type === this.getLineCommentTokenType()) {
                        result += '\n';
                        lastTokenWasNewline = true;
                    }
                }
            }

            // 处理主要token
            switch (tokenType) {
                case -1: // EOF
                    break;
                    
                case this.getLeftBraceTokenType():
                    if (options.bracesOnNewLine && !lastTokenWasNewline) {
                        result += '\n' + this.createIndent(currentIndent, options);
                    } else if (!options.bracesOnNewLine && result.trim() !== '') {
                        result += options.spaceBeforeOpenParen ? ' ' : '';
                    }
                    result += tokenText;
                    currentIndent += options.indentSize;
                    needsNewline = true;
                    break;
                    
                case this.getLeftParenTokenType():
                    // 检查是否是映射数组开始 ([)
                    if (i < tokens.length - 1 && tokens[i + 1].type === this.getLeftBracketTokenType()) {
                        inMappingArray = true;
                        mappingArrayDepth++;
                    }
                    result += tokenText;
                    break;
                    
                case this.getLeftBracketTokenType():
                    if (inMappingArray && i > 0 && tokens[i - 1].type === this.getLeftParenTokenType()) {
                        // 映射数组开始，添加换行和缩进
                        result += tokenText + '\n';
                        currentIndent += options.indentSize;
                        needsNewline = false;
                        lastTokenWasNewline = true;
                    } else {
                        result += tokenText;
                    }
                    break;
                    
                case this.getRightBracketTokenType():
                    if (inMappingArray) {
                        if (needsNewline && !lastTokenWasNewline) {
                            result += '\n';
                        }
                        if (lastTokenWasNewline) {
                            currentIndent = Math.max(0, currentIndent - options.indentSize);
                            result += this.createIndent(currentIndent, options);
                        }
                        result += tokenText;
                        lastTokenWasNewline = false;
                    } else {
                        result += tokenText;
                    }
                    break;
                    
                case this.getRightParenTokenType():
                    // 检查是否是映射数组结束 ])
                    if (inMappingArray && i > 0 && tokens[i - 1].type === this.getRightBracketTokenType()) {
                        mappingArrayDepth--;
                        if (mappingArrayDepth === 0) {
                            inMappingArray = false;
                        }
                    }
                    result += tokenText;
                    break;
                    
                case this.getRightBraceTokenType():
                    currentIndent = Math.max(0, currentIndent - options.indentSize);
                    if (needsNewline && !lastTokenWasNewline) {
                        result += '\n';
                    }
                    if (lastTokenWasNewline || needsNewline) {
                        result += this.createIndent(currentIndent, options);
                    }
                    result += tokenText;
                    needsNewline = true;
                    break;
                    
                case this.getSemicolonTokenType():
                    result += tokenText;
                    needsNewline = true;
                    break;
                    
                case this.getCommaTokenType():
                    result += tokenText;
                    if (inMappingArray) {
                        // 映射数组中的逗号后换行
                        result += '\n';
                        needsNewline = false;
                        lastTokenWasNewline = true;
                    } else if (options.spaceAfterComma) {
                        result += ' ';
                    }
                    break;
                    
                case this.getColonTokenType():
                    result += tokenText;
                    // 在冒号后添加空格（用于键值对格式化，如 "key": value）
                    if (options.spaceAroundOperators) {
                        result += ' ';
                    }
                    break;
                    
                case this.getStringLiteralTokenType():
                    // 修复字符串引号不匹配问题
                    let fixedString = this.fixStringQuotes(tokenText);
                    result += fixedString;
                    break;
                    
                default:
                    // 🔥 修复关键问题：正确处理所有token类型的换行需求
                    
                    // 检查是否需要在此token前换行
                    const needsLineBreakBefore = this.tokenNeedsLineBreakBefore(tokenType, tokenText, i, tokens);
                    if (needsLineBreakBefore && !lastTokenWasNewline) {
                        result += '\n';
                        lastTokenWasNewline = true;
                        emptyLineCount = 0;
                    }
                    
                    // 在新行开始时添加缩进
                    if (lastTokenWasNewline) {
                        const standardIndent = this.standardizeIndent(currentIndent, options);
                        result += this.createIndent(standardIndent, options);
                        lastTokenWasNewline = false;
                    }
                    
                    // 添加token文本
                    result += tokenText;
                    
                    // 检查是否需要在此token后换行
                    const needsLineBreakAfter = this.tokenNeedsLineBreakAfter(tokenType, tokenText, i, tokens);
                    if (needsLineBreakAfter) {
                        needsNewline = true;
                    }
                    break;
            }
            
            // 🔥 修复状态管理：正确重置换行标志
            // 仅在没有显式设置 needsNewline 时重置
            if (!needsNewline) {
                // 对于大多数token，重置换行标志
                if (tokenType !== this.getSemicolonTokenType() && 
                    tokenType !== this.getLeftBraceTokenType() && 
                    tokenType !== this.getRightBraceTokenType()) {
                    // lastTokenWasNewline 仅在实际添加换行后设置为true，在上面已经处理
                }
            }
        }

        // 确保文件以换行结尾
        if (options.insertFinalNewline && !result.endsWith('\n')) {
            result += '\n';
        }

        return result;
    }

    /**
     * 获取指定token左侧的隐藏token（注释等）
     * 改进版本，更准确地获取隐藏通道中的token
     */
    private getHiddenTokensToLeft(tokenStream: CommonTokenStream, tokenIndex: number): any[] {
        const hiddenTokens: any[] = [];
        
        try {
            // 获取当前token
            if (tokenIndex <= 0) return hiddenTokens;
            
            const currentToken = tokenStream.get(tokenIndex);
            const previousToken = tokenStream.get(tokenIndex - 1);
            
            if (!currentToken || !previousToken) return hiddenTokens;
            
            // 使用ANTLR的getHiddenTokensToLeft方法（如果可用）
            if ((tokenStream as any).getHiddenTokensToLeft) {
                const hidden = (tokenStream as any).getHiddenTokensToLeft(tokenIndex, 1); // channel 1 = HIDDEN
                if (hidden) {
                    hiddenTokens.push(...hidden);
                }
            } else {
                // 回退方法：遍历token流寻找隐藏token
                for (let i = tokenIndex - 1; i >= 0; i--) {
                    const token = tokenStream.get(i);
                    if (!token) break;
                    
                    // 如果token在隐藏通道中，添加到结果
                    if (token.channel === 1) { // HIDDEN channel
                        const tokenType = token.type;
                        if (tokenType === this.getCommentTokenType() || 
                            tokenType === this.getLineCommentTokenType()) {
                            hiddenTokens.unshift(token); // 保持原有顺序
                        }
                    } else {
                        // 遇到非隐藏token，停止搜索
                        break;
                    }
                }
            }
        } catch (error) {
            console.warn('获取隐藏token时出错:', error);
        }
        
        return hiddenTokens;
    }

    /**
     * 改进的token流格式化预处理
     * 先提取所有注释和空白，然后进行格式化
     */
    private preprocessTokenStream(tokenStream: CommonTokenStream): {
        mainTokens: any[];
        comments: Map<number, any[]>;
        originalText: string;
    } {
        const mainTokens: any[] = [];
        const comments = new Map<number, any[]>();
        let originalText = '';
        
        try {
            const allTokens = tokenStream.getTokens();
            
            for (let i = 0; i < allTokens.length; i++) {
                const token = allTokens[i];
                
                if (token.channel === 0) { // DEFAULT channel
                    mainTokens.push(token);
                } else if (token.channel === 1) { // HIDDEN channel
                    const tokenType = token.type;
                    if (tokenType === this.getCommentTokenType() || 
                        tokenType === this.getLineCommentTokenType()) {
                        
                        // 将注释关联到最近的主token
                        const nearestMainTokenIndex = this.findNearestMainToken(allTokens, i);
                        if (nearestMainTokenIndex >= 0) {
                            if (!comments.has(nearestMainTokenIndex)) {
                                comments.set(nearestMainTokenIndex, []);
                            }
                            comments.get(nearestMainTokenIndex)!.push(token);
                        }
                    }
                }
            }
        } catch (error) {
            console.warn('预处理token流时出错:', error);
        }
        
        return { mainTokens, comments, originalText };
    }

    /**
     * 查找距离指定索引最近的主token索引
     */
    private findNearestMainToken(allTokens: any[], hiddenTokenIndex: number): number {
        // 向前查找主token
        for (let i = hiddenTokenIndex - 1; i >= 0; i--) {
            if (allTokens[i].channel === 0) {
                return i;
            }
        }
        
        // 向后查找主token
        for (let i = hiddenTokenIndex + 1; i < allTokens.length; i++) {
            if (allTokens[i].channel === 0) {
                return i;
            }
        }
        
        return -1;
    }

    /**
     * 输入验证
     */
    private validateInput(text: string, options: LPCFormattingOptions): {
        isValid: boolean;
        diagnostics: vscode.Diagnostic[];
    } {
        const diagnostics: vscode.Diagnostic[] = [];

        // 检查文本是否为空
        if (!text || text.trim().length === 0) {
            return {
                isValid: false,
                diagnostics: [this.createDiagnostic(
                    'warning',
                    '文件内容为空，无需格式化',
                    new vscode.Range(0, 0, 0, 0),
                    'EMPTY_FILE'
                )]
            };
        }

        // 检查选项有效性
        if (!options || typeof options !== 'object') {
            diagnostics.push(this.createDiagnostic(
                'error',
                '格式化选项无效',
                new vscode.Range(0, 0, 0, 0),
                'INVALID_OPTIONS'
            ));
        }

        return { isValid: diagnostics.length === 0, diagnostics };
    }

    /**
     * 文件大小检查
     */
    private checkFileSize(text: string): {
        canFormat: boolean;
        diagnostics: vscode.Diagnostic[];
    } {
        const config = vscode.workspace.getConfiguration('lpc.performance');
        const maxFileSize = config.get('maxFormatFileSize', 1000000);

        if (text.length > maxFileSize) {
            return {
                canFormat: false,
                diagnostics: [this.createDiagnostic(
                    'warning',
                    `文件过大 (${text.length} 字符)，跳过格式化。可在设置中调整 lpc.performance.maxFormatFileSize (当前: ${maxFileSize})。`,
                    new vscode.Range(0, 0, 0, 0),
                    'FILE_TOO_LARGE'
                )]
            };
        }

        return { canFormat: true, diagnostics: [] };
    }

    /**
     * 分析解析错误的严重程度
     */
    private analyzeParseErrors(diagnostics: vscode.Diagnostic[]): {
        shouldFormat: boolean;
        reason?: string;
        errorCount: number;
        warningCount: number;
    } {
        const errors = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);
        const warnings = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Warning);

        const errorCount = errors.length;
        const warningCount = warnings.length;

        // 如果错误太多，跳过格式化
        if (errorCount > 10) {
            return {
                shouldFormat: false,
                reason: `代码包含过多解析错误 (${errorCount} 个)，跳过格式化以避免意外修改`,
                errorCount,
                warningCount
            };
        }

        // 如果有致命错误，也跳过格式化
        const hasFatalError = errors.some(e => 
            e.message.includes('语法错误') || 
            e.message.includes('unexpected token') ||
            e.message.includes('missing')
        );

        if (hasFatalError && errorCount > 3) {
            return {
                shouldFormat: false,
                reason: `代码包含致命语法错误，跳过格式化以保护代码完整性`,
                errorCount,
                warningCount
            };
        }

        return {
            shouldFormat: true,
            errorCount,
            warningCount
        };
    }

    /**
     * 执行格式化处理
     */
    private performFormatting(
        originalText: string,
        parseResult: { tree: any, tokenStream: CommonTokenStream, diagnostics: vscode.Diagnostic[] },
        options: LPCFormattingOptions
    ): {
        text: string;
        diagnostics: vscode.Diagnostic[];
    } {
        const diagnostics: vscode.Diagnostic[] = [];
        let formattedText: string;

        try {
            // 🚨 临时安全措施：检测换行符丢失风险后回退到AST访问者方法
            if (this.hasNewlineRisk(originalText, options)) {
                // 直接使用AST访问者方法避免token流格式化问题
                const visitor = new FormattingVisitor(parseResult.tokenStream, options);
                formattedText = visitor.visit(parseResult.tree);
                
                diagnostics.push(this.createDiagnostic(
                    'warning',
                    '检测到换行符丢失风险，使用安全的AST访问者方法',
                    new vscode.Range(0, 0, 0, 0),
                    'NEWLINE_RISK_FALLBACK'
                ));
            } else {
                // 原有的token流格式化方法
                formattedText = this.formatUsingTokenStream(originalText, parseResult.tokenStream, options);
                
                diagnostics.push(this.createDiagnostic(
                    'info',
                    '使用token流格式化成功',
                    new vscode.Range(0, 0, 0, 0),
                    'TOKEN_STREAM_FORMAT'
                ));
            }
        } catch (tokenStreamError) {
            // 回退到AST访问者方法
            try {
                const visitor = new FormattingVisitor(parseResult.tokenStream, options);
                formattedText = visitor.visit(parseResult.tree);
                
                const visitorErrors = visitor.getErrors();
                visitorErrors.forEach(error => {
                    diagnostics.push(this.createDiagnostic(
                        'warning',
                        `格式化警告: ${error}`,
                        new vscode.Range(0, 0, 0, 0),
                        'AST_VISITOR_WARNING'
                    ));
                });

                diagnostics.push(this.createDiagnostic(
                    'info',
                    'Token流格式化失败，已回退到AST访问者方法',
                    new vscode.Range(0, 0, 0, 0),
                    'FALLBACK_AST_VISITOR'
                ));
            } catch (astError) {
                // 使用改进的错误恢复机制
                try {
                    formattedText = this.recoverFromTokenStreamError(originalText, tokenStreamError, options);
                    
                    diagnostics.push(this.createDiagnostic(
                        'warning',
                        `主要格式化失败，已使用回退机制进行基本格式化`,
                        new vscode.Range(0, 0, 0, 0),
                        'FALLBACK_TEXT_FORMAT'
                    ));
                } catch (fallbackError) {
                    // 最后的回退：返回原文本
                    formattedText = originalText;
                    
                    diagnostics.push(this.createDiagnostic(
                        'error',
                        `所有格式化方法均失败: Token流错误: ${tokenStreamError instanceof Error ? tokenStreamError.message : '未知错误'}, AST错误: ${astError instanceof Error ? astError.message : '未知错误'}, 回退错误: ${fallbackError instanceof Error ? fallbackError.message : '未知错误'}`,
                        new vscode.Range(0, 0, 0, 0),
                        'ALL_FORMATS_FAILED'
                    ));
                }
            }
        }

        return { text: formattedText, diagnostics };
    }

    /**
     * 验证格式化结果的质量
     */
    private validateFormattedResult(originalText: string, formattedText: string): {
        isValid: boolean;
        severity?: 'error' | 'warning' | 'info';
        diagnostics: vscode.Diagnostic[];
    } {
        const diagnostics: vscode.Diagnostic[] = [];

        // 基本完整性检查
        if (!formattedText || formattedText.length === 0) {
            return {
                isValid: false,
                severity: 'error',
                diagnostics: [this.createDiagnostic(
                    'error',
                    '格式化结果为空',
                    new vscode.Range(0, 0, 0, 0),
                    'EMPTY_RESULT'
                )]
            };
        }

        // 长度变化检查（如果变化太大可能有问题）
        const lengthChange = Math.abs(formattedText.length - originalText.length) / originalText.length;
        if (lengthChange > 0.5) { // 长度变化超过50%
            diagnostics.push(this.createDiagnostic(
                'warning',
                `格式化后文本长度变化较大 (${(lengthChange * 100).toFixed(1)}%)，请检查结果`,
                new vscode.Range(0, 0, 0, 0),
                'SIGNIFICANT_LENGTH_CHANGE'
            ));
        }

        // 语法结构完整性检查（基本的括号匹配）
        const balanceCheck = this.checkBraceBalance(formattedText);
        if (!balanceCheck.isBalanced) {
            return {
                isValid: false,
                severity: 'error',
                diagnostics: [...diagnostics, this.createDiagnostic(
                    'error',
                    `格式化后括号不匹配: ${balanceCheck.error}`,
                    new vscode.Range(0, 0, 0, 0),
                    'BRACE_IMBALANCE'
                )]
            };
        }

        return {
            isValid: true,
            diagnostics
        };
    }

    /**
     * 检查括号平衡
     */
    private checkBraceBalance(text: string): {
        isBalanced: boolean;
        error?: string;
    } {
        const stack: string[] = [];
        const pairs: { [key: string]: string } = { '(': ')', '[': ']', '{': '}' };
        const opening = Object.keys(pairs);
        const closing = Object.values(pairs);

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            
            if (opening.includes(char)) {
                stack.push(char);
            } else if (closing.includes(char)) {
                const last = stack.pop();
                if (!last || pairs[last] !== char) {
                    return {
                        isBalanced: false,
                        error: `第 ${i + 1} 位置的 '${char}' 没有匹配的开括号`
                    };
                }
            }
        }

        if (stack.length > 0) {
            return {
                isBalanced: false,
                error: `有 ${stack.length} 个未关闭的括号: ${stack.join(', ')}`
            };
        }

        return { isBalanced: true };
    }

    /**
     * 创建标准化诊断信息
     */
    private createDiagnostic(
        severity: 'error' | 'warning' | 'info',
        message: string,
        range: vscode.Range,
        code?: string
    ): vscode.Diagnostic {
        const severityMap = {
            'error': vscode.DiagnosticSeverity.Error,
            'warning': vscode.DiagnosticSeverity.Warning,
            'info': vscode.DiagnosticSeverity.Information
        };

        const diagnostic = new vscode.Diagnostic(
            range,
            message,
            severityMap[severity]
        );

        diagnostic.source = 'LPC Formatter';
        if (code) {
            diagnostic.code = code;
        }

        return diagnostic;
    }

    /**
     * 创建错误诊断信息
     */
    private createErrorDiagnostic(error: unknown, code: string): vscode.Diagnostic {
        let message: string;
        
        if (error instanceof Error) {
            message = `格式化失败: ${error.message}`;
            if (error.stack) {
                console.error('格式化错误堆栈:', error.stack);
            }
        } else {
            message = `格式化失败: ${String(error)}`;
        }

        return this.createDiagnostic(
            'error',
            message,
            new vscode.Range(0, 0, 0, 0),
            code
        );
    }

    // Token类型获取方法（根据生成的LPCLexer）
    private getCommentTokenType(): number { return LPCLexer.BLOCK_COMMENT; }  // BLOCK_COMMENT
    private getLineCommentTokenType(): number { return LPCLexer.LINE_COMMENT; } // LINE_COMMENT  
    private getLeftBraceTokenType(): number { return LPCLexer.LBRACE; } // LBRACE
    private getRightBraceTokenType(): number { return LPCLexer.RBRACE; } // RBRACE
    private getSemicolonTokenType(): number { return LPCLexer.SEMI; } // SEMI
    private getCommaTokenType(): number { return LPCLexer.COMMA; } // COMMA
    private getColonTokenType(): number { return LPCLexer.COLON; } // COLON
    private getStringLiteralTokenType(): number { return LPCLexer.STRING_LITERAL; } // STRING_LITERAL
    private getLeftParenTokenType(): number { return LPCLexer.LPAREN; } // LPAREN
    private getRightParenTokenType(): number { return LPCLexer.RPAREN; } // RPAREN
    private getLeftBracketTokenType(): number { return LPCLexer.LBRACK; } // LBRACK
    private getRightBracketTokenType(): number { return LPCLexer.RBRACK; } // RBRACK

    private createIndent(level: number, options: LPCFormattingOptions): string {
        if (options.insertSpaces) {
            return ' '.repeat(level);
        } else {
            const tabs = Math.floor(level / options.tabSize);
            const spaces = level % options.tabSize;
            return '\t'.repeat(tabs) + ' '.repeat(spaces);
        }
    }

    /**
     * 修复字符串中的引号不匹配问题
     * 处理常见的引号配对错误，如 "text"color"text" -> "text\"color\"text"
     */
    private fixStringQuotes(tokenText: string): string {
        if (!tokenText.startsWith('"') || !tokenText.endsWith('"')) {
            return tokenText;
        }

        let content = tokenText.slice(1, -1); // 移除开头和结尾的引号
        let fixed = '';
        let i = 0;
        
        while (i < content.length) {
            const char = content[i];
            
            if (char === '"') {
                // 检查是否已经是转义的引号
                if (i === 0 || content[i - 1] !== '\\') {
                    // 检查是否是颜色代码模式，如"HIM"、"NOR"等
                    const colorCodeMatch = content.substring(i).match(/^"([A-Z]{3})"/);
                    if (colorCodeMatch) {
                        // 保持颜色代码不变
                        fixed += colorCodeMatch[0];
                        i += colorCodeMatch[0].length;
                        continue;
                    } else {
                        // 转义普通引号
                        fixed += '\\"';
                    }
                } else {
                    fixed += char;
                }
            } else {
                fixed += char;
            }
            i++;
        }
        
        return '"' + fixed + '"';
    }

    /**
     * 标准化缩进级别，确保是indentSize的倍数
     * 将非标准缩进（如2, 5, 6空格）调整为标准缩进（4, 8空格）
     */
    private standardizeIndent(currentIndent: number, options: LPCFormattingOptions): number {
        const indentSize = options.indentSize;
        
        // 如果已经是标准缩进，直接返回
        if (currentIndent % indentSize === 0) {
            return currentIndent;
        }
        
        // 计算最接近的标准缩进级别
        const level = Math.round(currentIndent / indentSize);
        return Math.max(0, level * indentSize);
    }

    /**
     * 改进的缩进检测和修复方法
     * 直接对文本的每一行进行缩进修复
     */
    private standardizeAllIndentation(text: string, options: LPCFormattingOptions): string {
        const lines = text.split('\n');
        const indentSize = options.indentSize;
        const formattedLines: string[] = [];
        let contextIndentLevel = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();
            
            if (trimmedLine === '') {
                formattedLines.push('');
                continue;
            }

            // 计算预期缩进级别
            const expectedIndent = this.calculateExpectedIndent(lines, i, contextIndentLevel, indentSize);
            
            // 生成正确的缩进字符串
            const correctIndent = this.createIndent(expectedIndent, options);
            
            // 重构行
            formattedLines.push(correctIndent + trimmedLine);
            
            // 更新上下文缩进级别（用于下一行的计算）
            contextIndentLevel = this.updateContextIndentLevel(trimmedLine, expectedIndent / indentSize);
        }

        return formattedLines.join('\n');
    }

    /**
     * 计算预期的缩进级别
     */
    private calculateExpectedIndent(lines: string[], currentLineIndex: number, contextIndentLevel: number, indentSize: number): number {
        const currentLine = lines[currentLineIndex].trim();
        
        // 特殊情况处理
        if (currentLine.startsWith('}') || currentLine.startsWith('])')) {
            // 关闭括号应该与对应的开放括号对齐
            return Math.max(0, (contextIndentLevel - 1) * indentSize);
        }
        
        // 映射数组特殊处理
        if (currentLine.startsWith('([')) {
            // 映射数组元素的开始，相对父级缩进
            return contextIndentLevel * indentSize;
        }
        
        // 映射数组内部的内容
        if (this.isInsideMappingArray(lines, currentLineIndex)) {
            // 检查是否是键值对的第一个属性
            if (currentLine.startsWith('"') && currentLine.includes('":')) {
                return (contextIndentLevel + 1) * indentSize;
            } else {
                // 继续的属性行
                return (contextIndentLevel + 2) * indentSize;
            }
        }
        
        return contextIndentLevel * indentSize;
    }

    /**
     * 判断是否在映射数组内部
     */
    private isInsideMappingArray(lines: string[], currentLineIndex: number): boolean {
        let depth = 0;
        
        // 向上搜索，找到最近的映射数组结构
        for (let i = currentLineIndex - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (line.includes('])') || line.includes('})')) {
                depth--;
            }
            if (line.includes('({') || line.includes('([')) {
                depth++;
                if (depth > 0 && line.includes('([')) {
                    return true;
                }
            }
        }
        
        return false;
    }

    /**
     * 更新上下文缩进级别
     */
    private updateContextIndentLevel(line: string, currentLevel: number): number {
        let newLevel = currentLevel;
        
        // 计算开放括号和关闭括号的数量
        const openBraces = (line.match(/[{\(\[]/g) || []).length;
        const closeBraces = (line.match(/[}\)\]]/g) || []).length;
        
        newLevel += openBraces - closeBraces;
        
        return Math.max(0, newLevel);
    }

    /**
     * 改进的映射数组格式化
     * 为映射数组提供更好的格式化支持
     */
    private formatMappingArrayEntry(content: string, options: LPCFormattingOptions): string {
        const lines = content.split('\n');
        const formattedLines: string[] = [];
        let currentIndent = options.indentSize;
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) {
                formattedLines.push('');
                continue;
            }
            
            // 识别键值对并对齐
            const keyValueMatch = trimmed.match(/^"(\w+)"\s*:\s*(.+),?$/);
            if (keyValueMatch) {
                const key = keyValueMatch[1];
                const value = keyValueMatch[2];
                const comma = trimmed.endsWith(',') ? ',' : '';
                
                // 创建对齐的键值对
                const indent = this.createIndent(currentIndent, options);
                const alignedEntry = `${indent}"${key}" : ${value}${comma}`;
                formattedLines.push(alignedEntry);
            } else {
                // 非键值对行，保持原有缩进结构
                const indent = this.createIndent(currentIndent, options);
                formattedLines.push(indent + trimmed);
            }
        }
        
        return formattedLines.join('\n');
    }

    /**
     * 改进的错误恢复机制
     * 当token流处理遇到问题时提供更好的错误处理
     */
    private recoverFromTokenStreamError(originalText: string, error: any, options: LPCFormattingOptions): string {
        console.warn('Token流格式化失败，使用文本处理回退方案:', error);
        
        try {
            // 基本的文本格式化：标准化缩进和修复明显的问题
            return this.fallbackTextFormatting(originalText, options);
        } catch (fallbackError) {
            console.error('回退格式化也失败:', fallbackError);
            return originalText;
        }
    }

    /**
     * 回退文本格式化方法
     * 基于文本处理的简单格式化，用于错误恢复
     */
    private fallbackTextFormatting(text: string, options: LPCFormattingOptions): string {
        const lines = text.split('\n');
        const formattedLines: string[] = [];
        
        for (const line of lines) {
            if (line.trim() === '') {
                formattedLines.push('');
                continue;
            }
            
            // 标准化缩进
            const currentIndent = this.getLineIndentLevel(line);
            const standardIndent = this.standardizeIndent(currentIndent, options);
            const content = line.trim();
            
            // 重建行
            const newLine = this.createIndent(standardIndent, options) + content;
            formattedLines.push(newLine);
        }
        
        return formattedLines.join('\n');
    }

    /**
     * 🚨 检测换行符丢失风险：临时安全措施
     * 检测文本是否具有会导致token流格式化丢失换行符的特征
     */
    private hasNewlineRisk(text: string, options: LPCFormattingOptions): boolean {
        // 检测1: 文本是否包含大量的映射数组结构（因为这是之前发现问题的特征）
        const mappingArrayMatches = text.match(/\(\s*\[\s*\{/g);
        if (mappingArrayMatches && mappingArrayMatches.length > 0) {
            return true;
        }

        // 检测2: 文本行数较多且包含复杂结构
        const lines = text.split('\n');
        if (lines.length > 100) {
            const complexStructures = text.match(/[{}\[\]();]/g);
            if (complexStructures && complexStructures.length > lines.length * 2) {
                return true;
            }
        }

        // 检测3: 包含大量的字符串和逗号（这种组合可能导致换行失败）
        const stringLiterals = text.match(/"[^"]*"/g);
        const commas = text.match(/,/g);
        if (stringLiterals && commas && stringLiterals.length > 20 && commas.length > 50) {
            return true;
        }

        return false;
    }

    /**
     * 🔥 新增：检测 token 是否需要在前面换行
     */
    private tokenNeedsLineBreakBefore(tokenType: number, tokenText: string, index: number, tokens: any[]): boolean {
        // 关键字通常需要在前面换行
        if (this.isKeywordToken(tokenType)) {
            return true;
        }
        
        // 标识符在某些情况下需要换行（如函数名、变量声明等）
        if (this.isIdentifierToken(tokenType)) {
            const prevToken = index > 0 ? tokens[index - 1] : null;
            if (prevToken) {
                const prevType = prevToken.type;
                // 在类型关键字后的标识符（如 "int main"）
                if (this.isTypeKeywordToken(prevType)) {
                    return false; // 同一行
                }
                // 在分号后的标识符需要换行
                if (prevType === this.getSemicolonTokenType()) {
                    return true;
                }
            }
        }
        
        return false;
    }

    /**
     * 🔥 新增：检测 token 是否需要在后面换行
     */
    private tokenNeedsLineBreakAfter(tokenType: number, tokenText: string, index: number, tokens: any[]): boolean {
        // 分号后总是需要换行
        if (tokenType === this.getSemicolonTokenType()) {
            return true;
        }
        
        // 左大括号后需要换行
        if (tokenType === this.getLeftBraceTokenType()) {
            return true;
        }
        
        // 右大括号后需要换行
        if (tokenType === this.getRightBraceTokenType()) {
            return true;
        }
        
        // 逗号在映射数组中后需要换行
        if (tokenType === this.getCommaTokenType()) {
            // 检测是否在映射数组中
            return this.isInMappingArray(index, tokens);
        }
        
        return false;
    }

    /**
     * 🔥 新增：检测是否为关键字token
     */
    private isKeywordToken(tokenType: number): boolean {
        // 这里需要根据实际的LPCLexer定义来设置
        // 临时实现，后续可以完善
        return false;
    }

    /**
     * 🔥 新增：检测是否为标识符token
     */
    private isIdentifierToken(tokenType: number): boolean {
        // 这里需要根据实际的LPCLexer定义来设置
        // 临时实现，后续可以完善
        return false;
    }

    /**
     * 🔥 新增：检测是否为类型关键字token
     */
    private isTypeKeywordToken(tokenType: number): boolean {
        // 这里需要根据实际的LPCLexer定义来设置
        // 临时实现，后续可以完善
        return false;
    }

    /**
     * 🔥 新增：检测当前位置是否在映射数组中
     */
    private isInMappingArray(index: number, tokens: any[]): boolean {
        // 简化的实现：向后查找是否在 ({ ... }) 结构中
        let braceCount = 0;
        let bracketCount = 0;
        let parenCount = 0;
        
        for (let i = index; i >= 0; i--) {
            const token = tokens[i];
            const tokenType = token.type;
            
            if (tokenType === this.getRightBraceTokenType()) braceCount++;
            else if (tokenType === this.getLeftBraceTokenType()) braceCount--;
            else if (tokenType === this.getRightBracketTokenType()) bracketCount++;
            else if (tokenType === this.getLeftBracketTokenType()) bracketCount--;
            else if (tokenType === this.getRightParenTokenType()) parenCount++;
            else if (tokenType === this.getLeftParenTokenType()) parenCount--;
            
            // 如果找到 ({ 结构，则在映射数组中
            if (braceCount === 0 && bracketCount === 0 && parenCount === 0) {
                if (i > 0 && 
                    tokens[i].type === this.getLeftBraceTokenType() && 
                    tokens[i-1].type === this.getLeftBracketTokenType()) {
                    return true;
                }
            }
        }
        
        return false;
    }

    /**
     * 后处理格式化结果
     * 进行缩进标准化和空格优化
     */
    private postProcessFormatting(
        text: string,
        options: LPCFormattingOptions
    ): {
        text: string;
        diagnostics: vscode.Diagnostic[];
    } {
        const diagnostics: vscode.Diagnostic[] = [];
        let processedText = text;
        
        try {
            // 1. 缩进标准化
            const indentFixedText = this.standardizeAllIndentation(processedText, options);
            if (indentFixedText !== processedText) {
                diagnostics.push(this.createDiagnostic(
                    'info',
                    '已修复非标准缩进',
                    new vscode.Range(0, 0, 0, 0),
                    'INDENT_STANDARDIZED'
                ));
                processedText = indentFixedText;
            }
            
            // 2. 运算符空格优化
            const operatorFixedText = this.fixOperatorSpacing(processedText, options);
            if (operatorFixedText !== processedText) {
                diagnostics.push(this.createDiagnostic(
                    'info',
                    '已修复运算符空格',
                    new vscode.Range(0, 0, 0, 0),
                    'OPERATOR_SPACING_FIXED'
                ));
                processedText = operatorFixedText;
            }
            
            // 3. 逗号空格优化
            const commaFixedText = this.fixCommaSpacing(processedText, options);
            if (commaFixedText !== processedText) {
                diagnostics.push(this.createDiagnostic(
                    'info',
                    '已修复逗号空格',
                    new vscode.Range(0, 0, 0, 0),
                    'COMMA_SPACING_FIXED'
                ));
                processedText = commaFixedText;
            }
            
        } catch (error) {
            diagnostics.push(this.createDiagnostic(
                'warning',
                `后处理格式化遇到问题: ${error instanceof Error ? error.message : '未知错误'}`,
                new vscode.Range(0, 0, 0, 0),
                'POST_PROCESS_WARNING'
            ));
        }
        
        return {
            text: processedText,
            diagnostics
        };
    }

    /**
     * 修复运算符周围的空格
     */
    private fixOperatorSpacing(text: string, options: LPCFormattingOptions): string {
        if (!options.spaceAroundOperators) {
            return text;
        }
        
        let result = text;
        
        // 修复赋值运算符
        result = result.replace(/([^\s=!<>])=([^=])/g, '$1 = $2');
        result = result.replace(/([^\s])\+=([^\s])/g, '$1 += $2');
        result = result.replace(/([^\s])-=([^\s])/g, '$1 -= $2');
        
        // 修复比较运算符
        result = result.replace(/([^\s<>])([<>]=?)([^\s])/g, '$1 $2 $3');
        result = result.replace(/([^\s=!])([=!]=)([^\s])/g, '$1 $2 $3');
        
        // 修复冒号空格（仅在键值对中）
        result = result.replace(/"\s*([^"]+)"\s*:\s*/g, '"$1" : ');
        
        return result;
    }

    /**
     * 修复逗号后的空格
     */
    private fixCommaSpacing(text: string, options: LPCFormattingOptions): string {
        if (!options.spaceAfterComma) {
            return text;
        }
        
        // 逗号后添加空格（但不在行尾）
        return text.replace(/,(?!\s|$)/g, ', ');
    }
}