/**
 * JavaDoc注释处理工具类
 * 统一处理JavaDoc格式的注释，避免重复实现
 */
export class JavaDocProcessor {
    /**
     * 处理JavaDoc注释，返回HTML格式
     */
    public static processToHtml(comment: string): string {
        if (!comment) return '';
        
        // 移除注释标记，保留原始行结构
        let processed = comment
            .replace(/^\/\*\*\s*/, '')  // 移除开头的 /**
            .replace(/\s*\*\/$/, '')    // 移除结尾的 */
            .replace(/^\s*\*\s?/gm, '') // 移除每行开头的 * 和空格
            .trim();
        
        let lines = processed.split('\n').map(line => line.trim());
        
        let html = '';
        let currentSection = '';
        let brief = '';
        let details: string[] = [];
        let paramStarted = false;
        let exampleContent: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            if (line.startsWith('@brief')) {
                brief = line.replace('@brief', '').trim();
                currentSection = '';
            } else if (line.startsWith('@details')) {
                currentSection = 'details';
                const detailText = line.replace('@details', '').trim();
                if (detailText) {
                    details.push(detailText);
                }
            } else if (line.startsWith('@param')) {
                // 结束details收集
                if (currentSection === 'details') {
                    currentSection = '';
                }
                // 开始参数部分
                if (!paramStarted) {
                    html += '<h4>参数</h4><ul class="param-list">';
                    paramStarted = true;
                }
                const paramMatch = line.match(/@param\s+(\w+)\s+(\w+)\s+(.*)/);
                if (paramMatch) {
                    const [, type, name, desc] = paramMatch;
                    html += `<li><strong>${this.escapeHtml(type)}</strong> <code>${this.escapeHtml(name)}</code>: ${this.escapeHtml(desc)}</li>`;
                } else {
                    // 兼容旧格式 @param name description
                    const simpleMatch = line.match(/@param\s+(\S+)\s+(.*)/);
                    if (simpleMatch) {
                        html += `<li><code>${this.escapeHtml(simpleMatch[1])}</code>: ${this.escapeHtml(simpleMatch[2])}</li>`;
                    }
                }
            } else if (line.startsWith('@return')) {
                // 结束参数列表
                if (paramStarted) {
                    html += '</ul>';
                    paramStarted = false;
                }
                currentSection = '';
                html += '<h4>返回值</h4>';
                const returnMatch = line.match(/@return\s+(\w+)\s+(.*)/);
                if (returnMatch) {
                    const [, type, desc] = returnMatch;
                    html += `<p><strong>${this.escapeHtml(type)}</strong> ${this.escapeHtml(desc)}</p>`;
                } else {
                    html += '<p>' + this.escapeHtml(line.replace('@return', '').trim()) + '</p>';
                }
            } else if (line.startsWith('@example')) {
                // 结束参数列表
                if (paramStarted) {
                    html += '</ul>';
                    paramStarted = false;
                }
                currentSection = 'example';
                html += '<h4>示例</h4><pre><code>';
                const exampleText = line.replace('@example', '').trim();
                if (exampleText) {
                    exampleContent.push(exampleText);
                }
            } else if (currentSection === 'example') {
                if (line.startsWith('@')) {
                    // 结束示例部分
                    html += exampleContent.join('\n') + '</code></pre>';
                    exampleContent = [];
                    currentSection = '';
                    // 重新处理这一行
                    i--;
                    continue;
                } else {
                    exampleContent.push(line);
                }
            } else if (currentSection === 'details') {
                if (line.startsWith('@')) {
                    currentSection = '';
                    // 重新处理这一行
                    i--;
                    continue;
                } else if (line.trim()) {
                    details.push(line);
                }
            } else if (!line.startsWith('@') && line.trim()) {
                // 普通描述文本
                if (!currentSection && !brief && !details.length) {
                    html += '<p>' + this.escapeHtml(line) + '</p>';
                }
            }
        }

        // 处理未结束的部分
        if (currentSection === 'example' && exampleContent.length > 0) {
            html += exampleContent.join('\n') + '</code></pre>';
        }
        if (paramStarted) {
            html += '</ul>';
        }

        // 构建最终结果
        let result = '';
        if (brief) {
            result += `<h4>简要描述</h4><p>${this.escapeHtml(brief)}</p>`;
        }
        if (details.length > 0) {
            result += `<h4>详细描述</h4><p>${this.escapeHtml(details.join(' '))}</p>`;
        }
        result += html;

        return result;
    }

    /**
     * 处理JavaDoc注释，返回Markdown格式
     */
    public static processToMarkdown(comment: string): string {
        if (!comment) return '';
        
        // 移除注释标记和多余的空格
        let lines = comment
            .replace(/\/\*\*|\*\/|\*/g, '')
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        let markdown = '';
        let currentSection = '';
        let brief = '';
        let details: string[] = [];

        for (const line of lines) {
            if (line.startsWith('@brief')) {
                brief = line.replace('@brief', '').trim();
            } else if (line.startsWith('@details')) {
                currentSection = 'details';
                const detailText = line.replace('@details', '').trim();
                if (detailText) {
                    details.push(detailText);
                }
            } else if (line.startsWith('@param')) {
                currentSection = '';
                if (!markdown.includes('### 参数')) {
                    markdown += '\n### 参数\n';
                }
                const paramMatch = line.match(/@param\s+(\S+)\s+(.*)/);
                if (paramMatch) {
                    markdown += `- \`${paramMatch[1]}\`: ${paramMatch[2]}\n`;
                }
            } else if (line.startsWith('@return')) {
                currentSection = '';
                markdown += '\n### 返回值\n';
                markdown += line.replace('@return', '').trim() + '\n';
            } else if (line.startsWith('@example')) {
                currentSection = 'example';
                markdown += '\n### 示例\n```lpc\n';
            } else if (currentSection === 'example') {
                if (line.startsWith('@')) {
                    markdown += '```\n';
                    currentSection = '';
                } else {
                    markdown += line + '\n';
                }
            } else if (currentSection === 'details') {
                if (line.startsWith('@')) {
                    currentSection = '';
                } else {
                    details.push(line);
                }
            } else if (!line.startsWith('@')) {
                if (!currentSection) {
                    markdown += line + '\n';
                }
            }
        }

        if (currentSection === 'example') {
            markdown += '```\n';
        }

        // 将 brief 和 details 添加到开头
        let result = '';
        if (brief) {
            result += `### 简要描述\n${brief}\n\n`;
        }
        if (details.length > 0) {
            result += `### 详细描述\n${details.join(' ')}\n\n`;
        }
        result += markdown;

        return result;
    }

    /**
     * HTML转义
     */
    private static escapeHtml(text: string): string {
        const div = document?.createElement?.('div');
        if (div) {
            div.textContent = text;
            return div.innerHTML;
        }
        // 服务器端或没有DOM的环境
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}