import * as vscode from 'vscode';
import axios, { AxiosInstance } from 'axios';
import { DocCommentTagParser } from './language/documentation/DocCommentTagParser';

export interface GLM4Config {
    apiKey: string;
    model: string;
    baseUrl: string;
    timeout: number;
}

export interface GLM4Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface GLM4Response {
    choices: Array<{
        message: {
            content: string;
        };
        finish_reason?: string;
    }>;
}

export interface JavadocContract {
    name: string;
    parameters: string[];
    returnType?: string;
}

export class GLM4Client {
    private client: AxiosInstance;
    private config: GLM4Config;

    // 可用的模型列表
    public static readonly AVAILABLE_MODELS = [
        { id: 'glm-4', name: 'GLM-4', description: '智谱AI GLM-4 标准版' },
        { id: 'glm-4-flash', name: 'GLM-4-Flash', description: '智谱AI GLM-4 快速版' },
        { id: 'glm-z1-flash', name: 'GLM-Z1-Flash', description: '智谱AI GLM-Z1 快速版' },
        { id: 'GLM-4.5-Flash', name: 'GLM-4.5-Flash', description: '智谱AI GLM-4.5 快速版' },
        { id: 'GLM-4-Flash-250414', name: 'GLM-4-Flash-250414', description: '智谱AI GLM-4 Flash 特定版本' },
        { id: 'custom', name: '自定义模型', description: '用户自定义的模型名称' }
    ];

    constructor(config: GLM4Config) {
        this.config = config;
        this.client = axios.create({
            baseURL: config.baseUrl,
            timeout: config.timeout,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            }
        });
    }

    public static fromVSCodeConfig(): GLM4Client {
        const config = vscode.workspace.getConfiguration('lpc');
        
        const apiKey = config.get<string>('glm4.apiKey', '');
        if (!apiKey) {
            throw new Error('GLM-4 API密钥未配置，请在设置中配置 lpc.glm4.apiKey');
        }

        return new GLM4Client({
            apiKey,
            model: config.get<string>('glm4.model', 'glm-4'),
            baseUrl: config.get<string>('glm4.baseUrl', 'https://open.bigmodel.cn/api/paas/v4'),
            timeout: config.get<number>('glm4.timeout', 30000)
        });
    }

    /**
     * 创建GLM4Client实例，支持用户选择模型
     * @param selectedModel 用户选择的模型ID，如果为空则使用配置中的默认模型
     * @returns GLM4Client实例
     */
    public static fromVSCodeConfigWithModel(selectedModel?: string): GLM4Client {
        const config = vscode.workspace.getConfiguration('lpc');
        
        const apiKey = config.get<string>('glm4.apiKey', '');
        if (!apiKey) {
            throw new Error('GLM-4 API密钥未配置，请在设置中配置 lpc.glm4.apiKey');
        }

        // 如果用户选择了模型，使用选择的模型，否则使用配置中的默认模型
        const model = selectedModel || config.get<string>('glm4.model', 'glm-4');

        return new GLM4Client({
            apiKey,
            model,
            baseUrl: config.get<string>('glm4.baseUrl', 'https://open.bigmodel.cn/api/paas/v4'),
            timeout: config.get<number>('glm4.timeout', 30000)
        });
    }

    /**
     * 显示模型选择界面，让用户选择要使用的模型
     * @returns 用户选择的模型ID，如果用户取消则返回undefined
     */
    public static async selectModel(): Promise<string | undefined> {
        const config = vscode.workspace.getConfiguration('lpc');
        const currentModel = config.get<string>('glm4.model', 'glm-4');
        const lastSelectedModel = config.get<string>('glm4.lastSelectedModel', '');
        const customModels = config.get<Array<{name: string, id: string, description?: string}>>('glm4.customModels', []);
        const allowCustomModel = config.get<boolean>('glm4.allowCustomModel', true);
        
        // 准备QuickPick选项 - 预设模型
        const items = GLM4Client.AVAILABLE_MODELS
            .filter(model => allowCustomModel || model.id !== 'custom')
            .map(model => ({
                label: model.name,
                description: model.description,
                detail: model.id === currentModel ? '(当前默认)' : (model.id === lastSelectedModel ? '(上次选择)' : ''),
                modelId: model.id
            }));

        // 添加自定义模型
        if (allowCustomModel && customModels.length > 0) {
            items.push({
                label: '$(dash) ────── 自定义模型 ──────',
                description: '',
                detail: '',
                modelId: 'separator'
            });
            
            customModels.forEach(model => {
                items.push({
                    label: `$(star) ${model.name}`,
                    description: model.description || '自定义模型',
                    detail: model.id === lastSelectedModel ? '(上次选择)' : '',
                    modelId: model.id
                });
            });
        }

        // 添加管理选项
        if (allowCustomModel) {
            items.push(
                {
                    label: '$(dash) ────── 管理选项 ──────',
                    description: '',
                    detail: '',
                    modelId: 'separator2'
                },
                {
                    label: '$(edit) 输入自定义模型名称',
                    description: '手动输入模型名称',
                    detail: '',
                    modelId: 'input-custom'
                },
                {
                    label: '$(add) 添加到自定义模型列表',
                    description: '将模型添加到配置中以便重复使用',
                    detail: '',
                    modelId: 'add-custom'
                }
            );
        }

        const selected = await vscode.window.showQuickPick(items.filter(item => item.modelId !== 'separator' && item.modelId !== 'separator2'), {
            placeHolder: '选择要使用的GLM模型',
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (!selected) {
            return undefined;
        }

        // 如果选择了自定义输入
        if (selected.modelId === 'input-custom') {
            const customModel = await vscode.window.showInputBox({
                prompt: '请输入自定义模型名称',
                placeHolder: '例如: gpt-4, claude-3-sonnet-20240229',
                validateInput: (value) => {
                    if (!value || value.trim().length === 0) {
                        return '模型名称不能为空';
                    }
                    return null;
                }
            });
            
            if (customModel?.trim()) {
                // 保存上次选择的模型
                await config.update('glm4.lastSelectedModel', customModel.trim(), vscode.ConfigurationTarget.Global);
            }
            
            return customModel?.trim();
        }

        // 如果选择了添加自定义模型
        if (selected.modelId === 'add-custom') {
            return await GLM4Client.addCustomModel();
        }

        // 保存上次选择的模型
        if (selected.modelId) {
            await config.update('glm4.lastSelectedModel', selected.modelId, vscode.ConfigurationTarget.Global);
        }

        return selected.modelId;
    }

    /**
     * 添加自定义模型到配置中
     * @returns 添加的模型ID，如果用户取消则返回undefined
     */
    public static async addCustomModel(): Promise<string | undefined> {
        const config = vscode.workspace.getConfiguration('lpc');
        
        // 输入模型ID
        const modelId = await vscode.window.showInputBox({
            prompt: '请输入模型ID',
            placeHolder: '例如: gpt-4, claude-3-sonnet-20240229',
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return '模型ID不能为空';
                }
                return null;
            }
        });
        
        if (!modelId?.trim()) {
            return undefined;
        }
        
        // 输入显示名称
        const modelName = await vscode.window.showInputBox({
            prompt: '请输入模型显示名称',
            placeHolder: '例如: GPT-4, Claude 3 Sonnet',
            value: modelId.trim(),
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return '显示名称不能为空';
                }
                return null;
            }
        });
        
        if (!modelName?.trim()) {
            return undefined;
        }
        
        // 输入描述（可选）
        const modelDescription = await vscode.window.showInputBox({
            prompt: '请输入模型描述（可选）',
            placeHolder: '例如: OpenAI GPT-4 模型'
        });
        
        // 获取当前自定义模型列表
        const customModels = config.get<Array<{name: string, id: string, description?: string}>>('glm4.customModels', []);
        
        // 检查是否已存在
        const existingIndex = customModels.findIndex(model => model.id === modelId.trim());
        
        const newModel = {
            name: modelName.trim(),
            id: modelId.trim(),
            description: modelDescription?.trim() || undefined
        };
        
        if (existingIndex >= 0) {
            // 更新现有模型
            customModels[existingIndex] = newModel;
            vscode.window.showInformationMessage(`已更新自定义模型: ${modelName.trim()}`);
        } else {
            // 添加新模型
            customModels.push(newModel);
            vscode.window.showInformationMessage(`已添加自定义模型: ${modelName.trim()}`);
        }
        
        // 保存到配置
        await config.update('glm4.customModels', customModels, vscode.ConfigurationTarget.Global);
        await config.update('glm4.lastSelectedModel', modelId.trim(), vscode.ConfigurationTarget.Global);
        
        return modelId.trim();
    }

    public async generateJavadoc(functionCode: string, contract?: JavadocContract): Promise<string> {
        const systemPrompt = `你是一个专业的LPC语言代码文档生成助手。请为给定的LPC函数生成中文Javadoc风格的注释。

注释格式要求：
1. 使用中文Javadoc风格：/**  */
2. 包含以下标签：
   - @brief 简要描述函数功能
   - @param 参数名 参数描述（如果有参数）
   - @return 返回值描述（如果有返回值）
   - @details 详细说明（如果需要）
3. 只描述能从代码证明的行为、参数与返回值；无法证明时写 TODO，不要猜测运行时效果
4. 使用中文描述
5. 不要包含原始代码，只返回注释
6. 请直接返回一个完整的 /** ... */ 注释块，不要包含代码、Markdown 围栏或思考过程
7. @param 必须使用实际参数名，不要编造参数；void 函数不要写 @return

示例格式：
/**
 * @brief 生成一个绑定物品
 * @param string path 物品路径，必须以 / 开头。
 * @param object owner 物品的拥有者对象。
 * @return object 生成的绑定物品对象，如果创建失败则返回 0。
 * @details 该函数会在 /common/bind_obj/ 目录下查找或创建绑定物品文件。
 */`;

        const signatureFacts = contract
            ? `\n函数名：${contract.name}\n参数名：${contract.parameters.join('、') || '无'}\n返回类型：${contract.returnType || '未知'}\n`
            : '';
        const userPrompt = `请为以下LPC函数生成Javadoc注释：${signatureFacts}

${functionCode}`;

        const messages: GLM4Message[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];

        try {
            const response = await this.client.post<GLM4Response>('/chat/completions', {
                model: this.config.model,
                messages: messages,
                temperature: 0.3, // 较低的温度以获得更一致的输出
                max_tokens: 1000,
                stream: false
            });

            const choice = response.data.choices[0];
            if (choice?.finish_reason === 'length') {
                throw new Error('模型输出被截断，未写入注释；请缩短选区或调整模型。');
            }
            const content = choice?.message?.content;
            if (!content) {
                throw new Error('GLM-4 API返回的内容为空');
            }

            // 过滤掉think内容和其他非注释内容
            return validateGeneratedJavadoc(this.filterThinkContent(content), contract);
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const message = error.response?.data?.error?.message || error.message;
                throw new Error(`GLM-4 API调用失败: ${message}`);
            }
            throw error;
        }
    }

    /**
     * 过滤掉GLM-4响应中的think内容和其他非注释内容
     * @param content GLM-4 API的原始响应内容
     * @returns 清理后的Javadoc注释内容
     */
    private filterThinkContent(content: string): string {
        // 移除各种可能的think标签格式
        return content
            // 移除<think>...</think>标签及其内容
            .replace(/<think[\s\S]*?<\/think>/gi, '')
            // 移除<thinking>...</thinking>标签及其内容
            .replace(/<thinking[\s\S]*?<\/thinking>/gi, '')
            // 移除其他可能的思考标签
            .replace(/\[思考\][\s\S]*?\[\/思考\]/gi, '')
            .replace(/\[thinking\][\s\S]*?\[\/thinking\]/gi, '')
            // 移除可能的思考标记
            .replace(/^思考：[\s\S]*?(?=\/\*\*)/im, '')
            .replace(/^思考过程：[\s\S]*?(?=\/\*\*)/im, '')
            .replace(/^Thinking:[\s\S]*?(?=\/\*\*)/im, '');
    }
}

export function validateGeneratedJavadoc(content: string, contract?: JavadocContract): string {
    const blocks = content.match(/\/\*\*[\s\S]*?\*\//gu) ?? [];
    if (blocks.length !== 1) {
        throw new Error('模型未返回唯一的 Javadoc 注释块，未写入源码。');
    }
    const comment = blocks[0].replace(/\r\n/gu, '\n').trim();
    const bodyLines = comment.split('\n').slice(1, -1);
    if (bodyLines.some((line) => line.trim() && !/^\s*\*(?:\s|$)/u.test(line))) {
        throw new Error('模型返回的 Javadoc 格式不完整，未写入源码。');
    }
    const parsed = new DocCommentTagParser().parse({
        kind: 'javadoc',
        text: comment,
        range: {
            start: { line: 0, character: 0 },
            end: { line: bodyLines.length + 1, character: 2 }
        }
    }, contract?.returnType);
    if (!parsed.summary?.trim() || parsed.malformedParamTagCount > 0 || parsed.duplicateReturnTagCount > 0) {
        throw new Error('模型返回的 Javadoc 缺少摘要或包含无效标签，未写入源码。');
    }
    if (contract) {
        const expected = new Set(contract.parameters);
        const actual = parsed.params.map((parameter) => parameter.name);
        if (actual.length !== expected.size
            || new Set(actual).size !== actual.length
            || actual.some((name) => !expected.has(name))
            || parsed.params.some((parameter) => !parameter.description?.trim())) {
            throw new Error('模型生成的 @param 与当前函数签名不一致，未写入源码。');
        }
        if (contract.returnType === 'void' && parsed.returns) {
            throw new Error('void 函数的注释包含 @return，未写入源码。');
        }
        if (contract.returnType && contract.returnType !== 'void' && !parsed.returns?.description?.trim()) {
            throw new Error('模型生成的注释缺少返回值说明，未写入源码。');
        }
    }
    return comment;
}
