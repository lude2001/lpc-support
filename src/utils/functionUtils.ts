/**
 * 函数文档相关的工具函数
 * 统一处理函数解析和显示相关的通用逻辑
 */
export class FunctionUtils {
    /**
     * 从函数定义中提取返回类型
     */
    public static getReturnType(definition: string): string {
        if (!definition) return '';
        const match = definition.match(/^\s*(\w+(?:\s*\*)?)/); 
        return match ? match[1] : '';
    }

    /**
     * 获取分组类型
     */
    public static getGroupType(source: string): string {
        if (source.includes('包含文件')) return 'included';
        return 'inherited';
    }

    /**
     * 清理ID字符串，用于HTML元素ID
     */
    public static sanitizeId(str: string): string {
        return str.replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-');
    }

    /**
     * HTML转义
     */
    public static escapeHtml(text: string): string {
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