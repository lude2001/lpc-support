import * as vscode from 'vscode';
import axios, { AxiosInstance } from 'axios';
import { DocCommentTagParser } from './language/documentation/DocCommentTagParser';
import { getDocumentationLanguage } from './localization/documentationLanguage';
import type { UiLocale } from './localization/locale';

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
        { id: 'glm-4', name: 'GLM-4', description: vscode.l10n.t('Zhipu AI GLM-4 standard model') },
        { id: 'glm-4-flash', name: 'GLM-4-Flash', description: vscode.l10n.t('Zhipu AI GLM-4 fast model') },
        { id: 'glm-z1-flash', name: 'GLM-Z1-Flash', description: vscode.l10n.t('Zhipu AI GLM-Z1 fast model') },
        { id: 'GLM-4.5-Flash', name: 'GLM-4.5-Flash', description: vscode.l10n.t('Zhipu AI GLM-4.5 fast model') },
        { id: 'GLM-4-Flash-250414', name: 'GLM-4-Flash-250414', description: vscode.l10n.t('Zhipu AI GLM-4 Flash version 250414') },
        { id: 'custom', name: vscode.l10n.t('Custom model'), description: vscode.l10n.t('User-defined model name') }
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
            throw new Error(vscode.l10n.t('The GLM-4 API key is not configured. Set lpc.glm4.apiKey in Settings.'));
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
            throw new Error(vscode.l10n.t('The GLM-4 API key is not configured. Set lpc.glm4.apiKey in Settings.'));
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
                detail: model.id === currentModel ? vscode.l10n.t('(Current default)') : (model.id === lastSelectedModel ? vscode.l10n.t('(Last selected)') : ''),
                modelId: model.id
            }));

        // 添加自定义模型
        if (allowCustomModel && customModels.length > 0) {
            items.push({
                label: `$(dash) ────── ${vscode.l10n.t('Custom models')} ──────`,
                description: '',
                detail: '',
                modelId: 'separator'
            });
            
            customModels.forEach(model => {
                items.push({
                    label: `$(star) ${model.name}`,
                    description: model.description || vscode.l10n.t('Custom model'),
                    detail: model.id === lastSelectedModel ? vscode.l10n.t('(Last selected)') : '',
                    modelId: model.id
                });
            });
        }

        // 添加管理选项
        if (allowCustomModel) {
            items.push(
                {
                    label: `$(dash) ────── ${vscode.l10n.t('Management options')} ──────`,
                    description: '',
                    detail: '',
                    modelId: 'separator2'
                },
                {
                    label: `$(edit) ${vscode.l10n.t('Enter a custom model name')}`,
                    description: vscode.l10n.t('Enter a model name manually'),
                    detail: '',
                    modelId: 'input-custom'
                },
                {
                    label: `$(add) ${vscode.l10n.t('Add to custom models')}`,
                    description: vscode.l10n.t('Save a model in Settings for reuse'),
                    detail: '',
                    modelId: 'add-custom'
                }
            );
        }

        const selected = await vscode.window.showQuickPick(items.filter(item => item.modelId !== 'separator' && item.modelId !== 'separator2'), {
            placeHolder: vscode.l10n.t('Select a GLM model'),
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (!selected) {
            return undefined;
        }

        // 如果选择了自定义输入
        if (selected.modelId === 'input-custom') {
            const customModel = await vscode.window.showInputBox({
                prompt: vscode.l10n.t('Enter a custom model name'),
                placeHolder: vscode.l10n.t('For example: gpt-4, claude-3-sonnet-20240229'),
                validateInput: (value) => {
                    if (!value || value.trim().length === 0) {
                        return vscode.l10n.t('Model name cannot be empty');
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
            prompt: vscode.l10n.t('Enter the model ID'),
            placeHolder: vscode.l10n.t('For example: gpt-4, claude-3-sonnet-20240229'),
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return vscode.l10n.t('Model ID cannot be empty');
                }
                return null;
            }
        });
        
        if (!modelId?.trim()) {
            return undefined;
        }
        
        // 输入显示名称
        const modelName = await vscode.window.showInputBox({
            prompt: vscode.l10n.t('Enter the model display name'),
            placeHolder: vscode.l10n.t('For example: GPT-4, Claude 3 Sonnet'),
            value: modelId.trim(),
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return vscode.l10n.t('Display name cannot be empty');
                }
                return null;
            }
        });
        
        if (!modelName?.trim()) {
            return undefined;
        }
        
        // 输入描述（可选）
        const modelDescription = await vscode.window.showInputBox({
            prompt: vscode.l10n.t('Enter a model description (optional)'),
            placeHolder: vscode.l10n.t('For example: OpenAI GPT-4 model')
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
            vscode.window.showInformationMessage(vscode.l10n.t('Updated custom model: {0}', modelName.trim()));
        } else {
            // 添加新模型
            customModels.push(newModel);
            vscode.window.showInformationMessage(vscode.l10n.t('Added custom model: {0}', modelName.trim()));
        }
        
        // 保存到配置
        await config.update('glm4.customModels', customModels, vscode.ConfigurationTarget.Global);
        await config.update('glm4.lastSelectedModel', modelId.trim(), vscode.ConfigurationTarget.Global);
        
        return modelId.trim();
    }

    public async generateJavadoc(
        functionCode: string,
        contract?: JavadocContract,
        language: UiLocale = getDocumentationLanguage()
    ): Promise<string> {
        const systemPrompt = language === 'en'
            ? `You are an LPC code documentation assistant. Generate an English Javadoc-style comment for the supplied function.

Comment requirements:
1. Return exactly one complete /** ... */ comment block, without source code, Markdown fences, or reasoning.
2. Use @brief for a concise summary, @param for each actual parameter, @return for a non-void return value, and @details when needed.
3. Describe only behavior, parameters, and return values supported by the code. Write TODO where facts cannot be proven; do not guess runtime effects.
4. Write new descriptions in English. Preserve LPC identifiers, type names, paths, macros, Javadoc tags, code examples, and user-provided text verbatim. Do not translate existing comment text.
5. @param names must match the actual signature exactly; do not invent parameters. A void function must not have @return.

Example format (use the actual function's parameters and return contract):
/**
 * @brief TODO: Describe the function's purpose.
 * @param int value TODO: Describe value.
 * @return TODO: Describe the return value.
 */`
            : `你是一个专业的 LPC 代码文档生成助手。请为给定的函数生成中文 Javadoc 风格注释。

注释要求：
1. 只返回一个完整的 /** ... */ 注释块，不要包含源码、Markdown 围栏或思考过程。
2. 使用 @brief 简要说明函数，@param 说明每个实际参数，@return 说明非 void 返回值，必要时使用 @details。
3. 只描述能从代码证明的行为、参数与返回值；无法证明时写 TODO，不要猜测运行时效果。
4. 新增说明使用中文。LPC 标识符、类型名、路径、宏名、Javadoc 标签、代码示例和用户提供的正文保持原文；不要翻译已有注释。
5. @param 必须使用实际参数名，不要编造参数；void 函数不要写 @return。

示例格式（须按实际函数的参数与返回契约调整）：
/**
 * @brief TODO: 说明函数的用途。
 * @param int value TODO: 说明 value。
 * @return TODO: 说明返回值。
 */`;

        const signatureFacts = contract
            ? language === 'en'
                ? `\nFunction name: ${contract.name}\nParameter names: ${contract.parameters.join(', ') || '(none)'}\nReturn type: ${contract.returnType || '(unknown)'}\n`
                : `\n函数名：${contract.name}\n参数名：${contract.parameters.join('、') || '无'}\n返回类型：${contract.returnType || '未知'}\n`
            : '';
        const userPrompt = `${language === 'en'
            ? 'Generate a Javadoc comment for the following LPC function:'
            : '请为以下 LPC 函数生成 Javadoc 注释：'}${signatureFacts}\n\n${functionCode}`;

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
                throw new Error(vscode.l10n.t('The model output was truncated. No comment was inserted. Shorten the selection or choose another model.'));
            }
            const content = choice?.message?.content;
            if (!content) {
                throw new Error(vscode.l10n.t('The GLM-4 API returned empty content'));
            }

            // 过滤掉think内容和其他非注释内容
            return validateGeneratedJavadoc(this.filterThinkContent(content), contract);
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const message = error.response?.data?.error?.message || error.message;
                throw new Error(vscode.l10n.t('GLM-4 API request failed: {0}', message));
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
        throw new Error(vscode.l10n.t('The model did not return exactly one Javadoc comment block. Source code was not changed.'));
    }
    const comment = blocks[0].replace(/\r\n/gu, '\n').trim();
    const bodyLines = comment.split('\n').slice(1, -1);
    if (bodyLines.some((line) => line.trim() && !/^\s*\*(?:\s|$)/u.test(line))) {
        throw new Error(vscode.l10n.t('The model returned an incomplete Javadoc comment. Source code was not changed.'));
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
        throw new Error(vscode.l10n.t('The Javadoc comment has no summary or contains invalid tags. Source code was not changed.'));
    }
    if (contract) {
        const expected = new Set(contract.parameters);
        const actual = parsed.params.map((parameter) => parameter.name);
        if (actual.length !== expected.size
            || new Set(actual).size !== actual.length
            || actual.some((name) => !expected.has(name))
            || parsed.params.some((parameter) => !parameter.description?.trim())) {
            throw new Error(vscode.l10n.t('The generated @param tags do not match the current function signature. Source code was not changed.'));
        }
        if (contract.returnType === 'void' && parsed.returns) {
            throw new Error(vscode.l10n.t('The comment for a void function contains @return. Source code was not changed.'));
        }
        if (contract.returnType && contract.returnType !== 'void' && !parsed.returns?.description?.trim()) {
            throw new Error(vscode.l10n.t('The generated comment has no return value description. Source code was not changed.'));
        }
    }
    return comment;
}
