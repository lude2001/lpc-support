import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import axios, { type AxiosInstance } from 'axios';

jest.mock('vscode', () => ({
    l10n: jest.requireActual<typeof import('vscode')>('vscode').l10n,
    env: jest.requireActual<typeof import('vscode')>('vscode').env,
    workspace: { getConfiguration: jest.fn() },
    window: {
        showQuickPick: jest.fn<(items: unknown, options?: unknown) => Promise<unknown>>().mockResolvedValue(undefined),
        showInputBox: jest.fn()
    },
    ConfigurationTarget: { Global: 1 }
}));

jest.mock('axios', () => ({
    __esModule: true,
    default: { create: jest.fn(), isAxiosError: jest.fn(() => false) }
}));

import { GLM4Client, validateGeneratedJavadoc } from '../glm4Client';

const showQuickPick = vscode.window.showQuickPick as unknown as jest.Mock<
    (items: unknown, options?: unknown) => Promise<unknown>
>;
const getConfiguration = vscode.workspace.getConfiguration as unknown as jest.Mock;

describe('GLM documentation output language', () => {
    const combinations = ['en', 'zh-cn'].flatMap(uiLanguage => ['en', 'zh-cn'].map(outputLanguage => ({
        uiLanguage, outputLanguage
    })));
    const contract = { name: 'describe_value', parameters: ['value'], returnType: 'string' };
    const source = 'string describe_value(int value) { return "用户原文 /user/path"; }';

    afterEach(() => {
        (vscode.env as { language: string }).language = 'zh-cn';
    });

    function createClient(content: string, finishReason = 'stop'): {
        client: GLM4Client;
        post: jest.Mock<(url: string, payload: unknown) => Promise<unknown>>;
    } {
        const post = jest.fn(async (_url: string, _payload: unknown) => ({
            data: { choices: [{ message: { content }, finish_reason: finishReason }] }
        }));
        jest.mocked(axios.create).mockReturnValue({ post } as unknown as AxiosInstance);
        return {
            client: new GLM4Client({ apiKey: 'fake-key', model: 'fake-model', baseUrl: 'https://unused.invalid', timeout: 1 }),
            post
        };
    }

    test.each(combinations)('requests $outputLanguage comments with $uiLanguage UI and preserves code and contract', async ({ uiLanguage, outputLanguage }) => {
        (vscode.env as { language: string }).language = uiLanguage;
        getConfiguration.mockReturnValue({
            get: (key: string, fallback: unknown) => key === 'documentation.language' ? outputLanguage : fallback
        });
        const comment = outputLanguage === 'en'
            ? '/**\n * @brief Describe the value.\n * @param int value Input value.\n * @return The description.\n */'
            : '/**\n * @brief 说明数值。\n * @param int value 输入值。\n * @return 说明文本。\n */';
        const { client, post } = createClient(comment);

        expect(await client.generateJavadoc(source, contract)).toBe(comment);

        const [url, payload] = post.mock.calls[0] as [string, {
            model: string; messages: Array<{ role: string; content: string }>; stream: boolean;
        }];
        expect(url).toBe('/chat/completions');
        expect(payload).toMatchObject({ model: 'fake-model', stream: false });
        expect(payload.messages.map(message => message.role)).toEqual(['system', 'user']);
        expect(payload.messages[0].content).toContain(outputLanguage === 'en'
            ? 'Generate an English Javadoc-style comment' : '生成中文 Javadoc 风格注释');
        expect(payload.messages[0].content).toContain(outputLanguage === 'en'
            ? 'A void function must not have @return' : 'void 函数不要写 @return');
        expect(payload.messages[0].content).toContain(outputLanguage === 'en'
            ? 'Do not translate existing comment text' : '不要翻译已有注释');
        if (outputLanguage === 'en') expect(payload.messages[0].content).not.toMatch(/\p{Script=Han}/u);
        const userPrompt = payload.messages[1].content;
        expect(userPrompt).toContain(outputLanguage === 'en' ? 'Function name: describe_value' : '函数名：describe_value');
        expect(userPrompt).toContain(outputLanguage === 'en' ? 'Parameter names: value' : '参数名：value');
        expect(userPrompt).toContain(outputLanguage === 'en' ? 'Return type: string' : '返回类型：string');
        expect(userPrompt.endsWith(source)).toBe(true);
        expect(axios.create).toHaveBeenLastCalledWith(expect.objectContaining({ baseURL: 'https://unused.invalid' }));
    });

    test.each(['en', 'zh-cn'] as const)('keeps validation and truncation protection for %s generated comments', async language => {
        const valid = '/**\n * @brief Valid summary.\n * @param int value Valid input.\n * @return Valid result.\n */';
        const truncated = createClient(valid, 'length');
        await expect(truncated.client.generateJavadoc(source, contract, language)).rejects.toThrow(
            '模型输出被截断'
        );
        const fabricated = createClient(valid.replace('@param int value', '@param int invented'));
        await expect(fabricated.client.generateJavadoc(source, contract, language)).rejects.toThrow('@param');
        const noReturn = createClient(valid.replace(' * @return Valid result.\n', ''));
        await expect(noReturn.client.generateJavadoc(source, contract, language)).rejects.toThrow('返回值');
        const prose = createClient('Not a Javadoc comment.');
        await expect(prose.client.generateJavadoc(source, contract, language)).rejects.toThrow('未返回唯一');
    });
});

describe('GLM4Client model selection configuration', () => {
    beforeEach(() => {
        showQuickPick.mockClear();
        getConfiguration.mockReturnValue({
            get: (key: string, defaultValue: unknown) =>
                key === 'glm4.allowCustomModel' ? false : defaultValue,
            update: jest.fn()
        });
    });

    test('hides custom model entry points when custom models are disabled', async () => {
        await GLM4Client.selectModel();

        const items = showQuickPick.mock.calls[0][0] as Array<{ modelId: string }>;
        expect(items.map(item => item.modelId)).not.toContain('custom');
        expect(items.map(item => item.modelId)).not.toContain('input-custom');
        expect(items.map(item => item.modelId)).not.toContain('add-custom');
    });

    test.each(['en', 'zh-cn'])('localizes model selection in %s while preserving model IDs and user descriptions', async (language) => {
        let localizationEnv: { language: string } | undefined;
        let localizedClient!: typeof GLM4Client;
        const update = jest.fn();
        const selectedModelId = 'GLM-4.5-Flash';
        const customModel = { name: 'User model name', id: 'user-model-id', description: '用户填写的原始说明' };
        getConfiguration.mockReturnValue({
            get: (key: string, defaultValue: unknown) => {
                if (key === 'glm4.allowCustomModel') return true;
                if (key === 'glm4.model') return 'glm-4';
                if (key === 'glm4.customModels') return [customModel];
                return defaultValue;
            },
            update
        });
        showQuickPick.mockResolvedValueOnce({ modelId: selectedModelId });

        try {
            jest.isolateModules(() => {
                localizationEnv = jest.requireMock<typeof import('vscode')>('vscode').env as { language: string };
                localizationEnv.language = language;
                localizedClient = (require('../glm4Client') as typeof import('../glm4Client')).GLM4Client;
            });
            const selected = await localizedClient.selectModel();
            const items = showQuickPick.mock.calls[0][0] as Array<{
                modelId: string; label: string; description: string; detail: string;
            }>;

            expect(items.map(item => item.modelId)).toEqual([
                'glm-4', 'glm-4-flash', 'glm-z1-flash', 'GLM-4.5-Flash', 'GLM-4-Flash-250414',
                'custom', 'user-model-id', 'input-custom', 'add-custom'
            ]);
            expect(items.find(item => item.modelId === 'glm-4')).toMatchObject({
                label: 'GLM-4',
                description: language === 'en' ? 'Zhipu AI GLM-4 standard model' : '智谱 AI GLM-4 标准版',
                detail: language === 'en' ? '(Current default)' : '（当前默认）'
            });
            expect(items.find(item => item.modelId === 'input-custom')?.label).toBe(
                language === 'en' ? '$(edit) Enter a custom model name' : '$(edit) 输入自定义模型名称'
            );
            expect(items.find(item => item.modelId === customModel.id)).toMatchObject({
                label: '$(star) User model name', description: customModel.description
            });
            expect(showQuickPick.mock.calls[0][1]).toEqual(expect.objectContaining({
                placeHolder: language === 'en' ? 'Select a GLM model' : '选择要使用的 GLM 模型'
            }));
            expect(selected).toBe(selectedModelId);
            expect(update).toHaveBeenCalledWith('glm4.lastSelectedModel', selectedModelId, 1);
        } finally {
            if (localizationEnv) localizationEnv.language = 'zh-cn';
        }
    });
});

describe('generated Javadoc validation', () => {
    const contract = { name: 'chinese_number', parameters: ['value'], returnType: 'string' };

    test('accepts one complete comment with the Rust signature parameters', () => {
        const comment = '/**\n * @brief 将数字转换为中文。\n * @param int value 待转换的数字。\n * @return 中文数字文本。\n */';
        expect(validateGeneratedJavadoc(`\`\`\`lpc\n${comment}\n\`\`\``, contract)).toBe(comment);
    });

    test('rejects prose, fabricated parameters, and incomplete return documentation', () => {
        expect(() => validateGeneratedJavadoc('无法生成注释', contract)).toThrow('未返回唯一');
        expect(() => validateGeneratedJavadoc(
            '/**\n * @brief 转换数字。\n * @param int count 数字。\n * @return 文本。\n */', contract
        )).toThrow('@param');
        expect(() => validateGeneratedJavadoc(
            '/**\n * @brief 转换数字。\n * @param int value 数字。\n */', contract
        )).toThrow('返回值');
    });

    test('rejects return tags on void functions', () => {
        expect(() => validateGeneratedJavadoc(
            '/**\n * @brief 执行操作。\n * @return 结果。\n */',
            { name: 'run', parameters: [], returnType: 'void' }
        )).toThrow('void');
    });
});
