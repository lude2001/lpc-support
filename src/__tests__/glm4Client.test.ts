import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const showQuickPick = jest.fn<(items: unknown) => Promise<unknown>>().mockResolvedValue(undefined);
const getConfiguration = jest.fn();

jest.mock('vscode', () => ({
    workspace: { getConfiguration },
    window: {
        showQuickPick,
        showInputBox: jest.fn()
    },
    ConfigurationTarget: { Global: 1 }
}));

jest.mock('axios', () => ({
    __esModule: true,
    default: { create: jest.fn() }
}));

import { GLM4Client, validateGeneratedJavadoc } from '../glm4Client';

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
