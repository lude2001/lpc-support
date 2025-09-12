/**
 * 单元测试设置文件
 * 为单元测试提供专门的Mock和配置
 */

import { jest } from '@jest/globals';

// 单元测试专用的Mock配置
beforeAll(() => {
    // Mock VS Code API的核心部分
    (global as any).vscode = {
        Uri: {
            file: jest.fn((filePath: string) => ({ fsPath: filePath, path: filePath })),
            parse: jest.fn()
        },
        Range: jest.fn(),
        Position: jest.fn(),
        workspace: {
            getConfiguration: jest.fn(() => ({
                get: jest.fn(),
                has: jest.fn(),
                inspect: jest.fn(),
                update: jest.fn()
            }))
        },
        window: {
            showInformationMessage: jest.fn(),
            showWarningMessage: jest.fn(),
            showErrorMessage: jest.fn()
        }
    };
});

beforeEach(() => {
    // 每个测试前重置Mock
    jest.clearAllMocks();
});

afterEach(() => {
    // 测试后清理
    jest.restoreAllMocks();
});