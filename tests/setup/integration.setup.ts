/**
 * 集成测试设置文件
 * 为集成测试提供更完整的环境模拟
 */

import { jest } from '@jest/globals';

// 集成测试需要更完整的Mock
beforeAll(() => {
    // 模拟完整的VS Code环境
    (global as any).vscode = {
        Uri: {
            file: jest.fn((filePath: string) => ({ 
                fsPath: filePath, 
                path: filePath,
                scheme: 'file',
                authority: '',
                fragment: '',
                query: '',
                toString: () => `file://${filePath}`
            })),
            parse: jest.fn()
        },
        Range: jest.fn((start, end) => ({ start, end })),
        Position: jest.fn((line, character) => ({ line, character })),
        workspace: {
            getConfiguration: jest.fn(() => ({
                get: jest.fn((key, defaultValue) => {
                    // 返回合理的默认配置
                    const configs: any = {
                    };
                    return configs[key] || defaultValue;
                }),
                has: jest.fn(),
                inspect: jest.fn(),
                update: jest.fn()
            })),
            openTextDocument: jest.fn(),
            fs: {
                readFile: jest.fn(),
                writeFile: jest.fn()
            }
        },
        window: {
            showInformationMessage: jest.fn(),
            showWarningMessage: jest.fn(),
            showErrorMessage: jest.fn(),
            activeTextEditor: null
        },
        languages: {
            getDiagnostics: jest.fn(() => [])
        }
    };

    // 模拟Node.js环境
    if (!(global as any).process) {
        (global as any).process = {
            env: { NODE_ENV: 'test' },
            memoryUsage: jest.fn(() => ({
                rss: 50 * 1024 * 1024,
                heapTotal: 30 * 1024 * 1024,
                heapUsed: 20 * 1024 * 1024,
                external: 5 * 1024 * 1024,
                arrayBuffers: 1 * 1024 * 1024
            }))
        };
    }
});

beforeEach(() => {
    jest.clearAllMocks();
});

afterEach(() => {
    // 集成测试后的清理可能更复杂
    jest.restoreAllMocks();
    
    // 清理可能的全局状态
    if (global.gc) {
        global.gc();
    }
});