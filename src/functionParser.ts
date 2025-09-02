import * as vscode from 'vscode';
import { getParsed } from './parseCache';
import { FunctionDefContext } from './antlr/LPCParser';
import { FunctionInfo } from './types/functionInfo';

export class LPCFunctionParser {
    /**
     * 解析选中的文本，提取函数信息
     */
    public static parseFunctionFromSelection(document: vscode.TextDocument, selection: vscode.Selection): FunctionInfo | null {
        const selectedText = document.getText(selection);
        if (!selectedText.trim()) {
            return null;
        }

        // 使用AST解析选中的文本
        try {
            const { tree } = getParsed(document);
            const startOffset = document.offsetAt(selection.start);
            const endOffset = document.offsetAt(selection.end);
            
            // 查找包含选中文本的函数定义
            const functionCtx = this.findFunctionContainingRange(tree, startOffset, endOffset);
            if (functionCtx) {
                return this.extractFunctionInfo(document, functionCtx);
            }
        } catch (error) {
            console.error('Error parsing function from selection:', error);
        }
        
        return null;
    }

    /**
     * 从光标位置自动检测函数
     */
    public static parseFunctionFromCursor(document: vscode.TextDocument, position: vscode.Position): FunctionInfo | null {
        try {
            const { tree } = getParsed(document);
            const offset = document.offsetAt(position);
            
            // 查找包含光标位置的函数定义
            const functionCtx = this.findFunctionContainingOffset(tree, offset);
            if (functionCtx) {
                return this.extractFunctionInfo(document, functionCtx);
            }
        } catch (error) {
            console.error('Error parsing function from cursor:', error);
        }
        
        return null;
    }

    /**
     * 查找包含指定范围的函数定义
     */
    private static findFunctionContainingRange(tree: any, startOffset: number, endOffset: number): FunctionDefContext | null {
        for (const stmt of tree.statement()) {
            const funcCtx: FunctionDefContext | undefined = stmt.functionDef();
            if (!funcCtx) continue;

            const funcStart = funcCtx.start.startIndex;
            const funcEnd = funcCtx.stop!.stopIndex;
            
            // 检查选中的范围是否在函数内部
            if (startOffset >= funcStart && endOffset <= funcEnd) {
                return funcCtx;
            }
        }
        return null;
    }

    /**
     * 查找包含指定偏移量的函数定义
     */
    private static findFunctionContainingOffset(tree: any, offset: number): FunctionDefContext | null {
        for (const stmt of tree.statement()) {
            const funcCtx: FunctionDefContext | undefined = stmt.functionDef();
            if (!funcCtx) continue;

            const funcStart = funcCtx.start.startIndex;
            const funcEnd = funcCtx.stop!.stopIndex;
            
            // 检查偏移量是否在函数内部
            if (offset >= funcStart && offset <= funcEnd) {
                return funcCtx;
            }
        }
        return null;
    }

    /**
     * 解析文档中的所有函数
     */
    public static parseAllFunctions(document: vscode.TextDocument, source: string = '当前文件', filePath?: string): FunctionInfo[] {
        const functions: FunctionInfo[] = [];
        const text = document.getText();
        const lines = text.split('\n');
        
        try {
            const { tree } = getParsed(document);
            
            const visit = (ctx: any) => {
                if (ctx instanceof FunctionDefContext) {
                    const functionInfo = this.extractFunctionInfo(document, ctx, source, filePath || document.fileName, lines);
                    if (functionInfo) {
                        functions.push(functionInfo);
                    }
                }
                for (let i = 0; i < (ctx.childCount ?? 0); i++) {
                    const child = ctx.getChild(i);
                    if (child && typeof child === 'object' && child.symbol === undefined) {
                        visit(child);
                    }
                }
            };
            visit(tree);
        } catch (error) {
            console.error('Error parsing functions:', error);
        }
        
        return functions;
    }

    /**
     * 从函数定义节点提取函数信息
     */
    private static extractFunctionInfo(
        document: vscode.TextDocument, 
        funcCtx: FunctionDefContext, 
        source?: string, 
        filePath?: string,
        lines?: string[]
    ): FunctionInfo {
        const idToken = funcCtx.Identifier().symbol;
        const funcName = idToken.text || 'function';
        
        // 获取返回类型
        const retTypeCtx = funcCtx.typeSpec();
        let returnType = 'void';
        if (retTypeCtx) {
            const stopIndex = retTypeCtx.stop?.stopIndex ?? retTypeCtx.start.stopIndex;
            returnType = document.getText(new vscode.Range(
                document.positionAt(retTypeCtx.start.startIndex),
                document.positionAt(stopIndex + 1)
            )).trim();
        }
        
        // 获取参数列表
        const parameters: Array<{ type: string; name: string }> = [];
        let paramText = '()';
        
        // 直接从函数定义中提取完整的参数列表（包括括号）
        const funcStart = funcCtx.start.startIndex;
        const funcEnd = funcCtx.stop!.stopIndex;
        const fullFuncText = document.getText().substring(funcStart, funcEnd + 1);
        
        // 提取函数签名（到第一个 { 或 ; 为止）
        const signatureMatch = fullFuncText.match(/^[^{;]+/);
        let signature = signatureMatch ? signatureMatch[0].trim() : fullFuncText;
        
        // 提取参数列表部分（括号及其内容）
        const paramMatch = signature.match(/\([^)]*\)/);
        if (paramMatch) {
            paramText = paramMatch[0];
        }
        
        // 解析参数用于结构化数据
        const paramList = funcCtx.parameterList();
        if (paramList) {
            for (const param of paramList.parameter()) {
                const paramType = param.typeSpec()?.text || 'mixed';
                const paramName = param.Identifier()?.text || '';
                if (paramName) {
                    parameters.push({ type: paramType, name: paramName });
                }
            }
        }
        
        // 构建函数定义字符串
        const definition = `${returnType} ${funcName}${paramText}`;
        
        // 获取函数体
        const bodyCtx = funcCtx.block();
        const bodyStart = bodyCtx.start.startIndex;
        const bodyEnd = bodyCtx.stop!.stopIndex;
        const body = document.getText().substring(bodyStart, bodyEnd + 1);
        
        // 获取完整函数文本
        const fullStart = funcCtx.start.startIndex;
        const fullEnd = funcCtx.stop!.stopIndex;
        const fullText = document.getText().substring(fullStart, fullEnd + 1);
        
        // 获取行号
        const line = document.positionAt(funcCtx.start.startIndex).line;
        
        // 提取注释
        const comment = this.extractFunctionComment(document, funcCtx, lines);
        
        // 提取简要描述
        const briefDescription = this.extractBriefDescription(comment);
        
        return {
            name: funcName,
            definition,
            returnType,
            parameters,
            body,
            fullText,
            comment,
            briefDescription,
            source,
            filePath,
            line
        };
    }

    /**
     * 提取函数的注释
     */
    private static extractFunctionComment(document: vscode.TextDocument, funcCtx: FunctionDefContext, lines?: string[]): string {
        if (!lines) {
            lines = document.getText().split('\n');
        }
        
        const line = document.positionAt(funcCtx.start.startIndex).line;
        let comment = '';
        let inBlockComment = false;
        let blockCommentLines: string[] = [];
        
        // 向上查找注释（最多查找15行）
        for (let l = line - 1; l >= 0 && line - l <= 15; l--) {
            const lineText = lines[l].trim();
            
            if (lineText.endsWith('*/')) {
                // 找到块注释的结束
                inBlockComment = true;
                blockCommentLines.unshift(lineText);
            } else if (inBlockComment) {
                blockCommentLines.unshift(lineText);
                if (lineText.startsWith('/**') || lineText.startsWith('/*')) {
                    // 找到块注释的开始
                    comment = blockCommentLines.join('\n');
                    break;
                }
            } else if (lineText.startsWith('//')) {
                // 单行注释
                comment = lineText + '\n' + comment;
            } else if (lineText === '') {
                // 空行，继续查找
                continue;
            } else {
                // 遇到非注释行，停止查找
                break;
            }
        }
        
        return comment.trim();
    }

    /**
     * 提取函数的简要描述（用于左侧列表显示）
     */
    private static extractBriefDescription(comment: string): string {
        if (!comment || comment.trim() === '') {
            return '暂无描述';
        }

        // 从JavaDoc风格注释中提取@brief
        const briefMatch = comment.match(/@brief\s+(.+?)(?=\n|$|@)/);
        if (briefMatch && briefMatch[1]) {
            let brief = briefMatch[1].trim();
            // 限制长度为20个字符，超出的用...省略
            if (brief.length > 20) {
                brief = brief.substring(0, 20) + '...';
            }
            return brief;
        }

        // 如果没有@brief，尝试提取第一行非空内容
        let firstLine = '';
        const lines = comment.split('\n');
        for (const line of lines) {
            const cleanLine = line
                .replace(/^\/\*\*?\s*/, '')  // 移除 /** 或 /*
                .replace(/\s*\*\/\s*$/, '')  // 移除 */
                .replace(/^\s*\*\s?/, '')    // 移除行首的 *
                .trim();
            
            if (cleanLine && !cleanLine.startsWith('@')) {
                firstLine = cleanLine;
                break;
            }
        }

        if (firstLine) {
            // 限制长度为20个字符，超出的用...省略
            if (firstLine.length > 20) {
                firstLine = firstLine.substring(0, 20) + '...';
            }
            return firstLine;
        }

        return '暂无描述';
    }

}