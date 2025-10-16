import * as vscode from 'vscode';

/**
 * LPC 折叠提供程序
 * 支持注释块、函数、结构体等代码块的折叠
 */
export class LPCFoldingRangeProvider implements vscode.FoldingRangeProvider {
    provideFoldingRanges(
        document: vscode.TextDocument,
        context: vscode.FoldingContext,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.FoldingRange[]> {
        const foldingRanges: vscode.FoldingRange[] = [];

        // 收集所有折叠区域
        this.collectCommentFolding(document, foldingRanges);
        this.collectBraceFolding(document, foldingRanges);

        return foldingRanges;
    }

    /**
     * 收集注释块折叠
     */
    private collectCommentFolding(document: vscode.TextDocument, ranges: vscode.FoldingRange[]): void {
        let inBlockComment = false;
        let blockCommentStart = -1;

        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const text = line.text.trim();

            // 检测块注释开始
            if (!inBlockComment && text.includes('/*')) {
                inBlockComment = true;
                blockCommentStart = i;
            }

            // 检测块注释结束
            if (inBlockComment && text.includes('*/')) {
                inBlockComment = false;

                // 只有多行注释才创建折叠
                if (i > blockCommentStart) {
                    ranges.push(new vscode.FoldingRange(
                        blockCommentStart,
                        i,
                        vscode.FoldingRangeKind.Comment
                    ));
                }
            }
        }
    }

    /**
     * 收集大括号块折叠（函数、结构体、if/for/while等）
     */
    private collectBraceFolding(document: vscode.TextDocument, ranges: vscode.FoldingRange[]): void {
        const stack: { line: number; kind: vscode.FoldingRangeKind }[] = [];

        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const text = line.text;

            // 跳过注释行
            if (this.isInComment(text)) {
                continue;
            }

            // 统计大括号
            const openBraces = (text.match(/\{/g) || []).length;
            const closeBraces = (text.match(/\}/g) || []).length;

            // 判断块类型
            let kind = vscode.FoldingRangeKind.Region;
            const trimmedText = text.trim();

            // 函数定义
            if (this.isFunctionDefinition(trimmedText)) {
                kind = vscode.FoldingRangeKind.Region;
            }

            // 添加开始大括号到栈
            for (let j = 0; j < openBraces; j++) {
                stack.push({ line: i, kind });
            }

            // 匹配闭合大括号
            for (let j = 0; j < closeBraces; j++) {
                if (stack.length > 0) {
                    const start = stack.pop()!;
                    // 只有多行块才创建折叠
                    if (i > start.line) {
                        ranges.push(new vscode.FoldingRange(
                            start.line,
                            i,
                            start.kind
                        ));
                    }
                }
            }
        }
    }

    /**
     * 检查文本是否在注释中
     */
    private isInComment(text: string): boolean {
        const trimmed = text.trim();
        return trimmed.startsWith('//') || trimmed.startsWith('*');
    }

    /**
     * 检查是否是函数定义
     */
    private isFunctionDefinition(text: string): boolean {
        // 匹配函数定义模式: [modifiers] type function_name(params)
        const functionPattern = /^\s*(private|protected|public|static|nomask|varargs)?\s*(void|int|string|object|mixed|mapping|float|buffer|struct|class|\w+)\s+(\*\s*)?\w+\s*\([^)]*\)\s*\{/;
        return functionPattern.test(text);
    }
}
