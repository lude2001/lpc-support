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

import { GLM4Client } from '../glm4Client';

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
