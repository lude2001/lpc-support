/**
 * 函数信息接口定义
 * 统一的函数信息结构，用于不同模块间的数据交换
 */
export interface FunctionInfo {
    // 基本信息
    name: string;
    
    // 函数定义相关
    definition?: string;          // 完整的函数定义字符串（用于文档显示）
    returnType?: string;          // 返回类型（用于解析）
    parameters?: Array<{          // 参数列表（用于解析）
        type: string;
        name: string;
    }>;
    
    // 函数体和源码
    body?: string;                // 函数体内容
    fullText?: string;            // 完整的函数文本
    
    // 文档和注释
    comment?: string;             // 函数注释
    briefDescription?: string;    // 简要描述（用于左侧列表显示）
    
    // 位置和来源信息
    source?: string;              // 来源标识（current/inherited等）
    filePath?: string;            // 文件路径
    line?: number;                // 行号（用于跳转）
}

/**
 * 函数参数信息接口
 */
export interface FunctionParameter {
    type: string;
    name: string;
}