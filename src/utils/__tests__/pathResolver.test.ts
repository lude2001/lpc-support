/**
 * PathResolver 单元测试
 */

import * as path from 'path';

// Mock vscode模块
jest.mock('vscode', () => {
    return {
        Uri: {
            parse: (uri: string) => ({
                toString: () => uri,
                fsPath: uri.replace('file:///', '').replace(/^\/([a-zA-Z]):/, '$1:'),
                scheme: 'file',
                path: uri.replace('file:///', '/')
            }),
            file: (filePath: string) => {
                const normalizedPath = filePath.replace(/\\/g, '/');
                return {
                    toString: () => `file:///${normalizedPath}`,
                    fsPath: filePath,
                    scheme: 'file',
                    path: normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`
                };
            }
        },
        workspace: {
            getConfiguration: jest.fn().mockReturnValue({
                get: jest.fn((key: string, defaultValue?: any) => defaultValue)
            }),
            getWorkspaceFolder: jest.fn(),
            workspaceFolders: []
        }
    };
}, { virtual: true });

// Mock fs模块
jest.mock('fs', () => ({
    promises: {
        stat: jest.fn(),
        readFile: jest.fn()
    },
    existsSync: jest.fn(() => true)
}));

// 在mock之后导入依赖
import { PathResolver } from '../pathResolver';
const vscode = require('vscode');

describe('PathResolver', () => {
    let mockWorkspaceFolder: any;

    beforeEach(() => {
        // 重置mocks
        jest.clearAllMocks();

        // 创建 mock 工作区
        mockWorkspaceFolder = {
            uri: vscode.Uri.file('/workspace/mylib'),
            name: 'mylib',
            index: 0
        };

        vscode.workspace.getWorkspaceFolder = jest.fn(() => mockWorkspaceFolder);
        vscode.workspace.workspaceFolders = [mockWorkspaceFolder];
    });

    describe('路径标准化', () => {
        test('应该标准化路径分隔符', () => {
            expect(PathResolver.normalizePath('path\\to\\file')).toBe('path/to/file');
            expect(PathResolver.normalizePath('path/to/file')).toBe('path/to/file');
        });

        test('应该处理Windows路径分隔符', () => {
            const windowsPath = '\\workspace\\mylib\\system\\user.c';
            const result = PathResolver.normalizePath(windowsPath);
            expect(result).toBe('/workspace/mylib/system/user.c');
        });


        test('应该处理特殊字符路径', () => {
            const specialPath = '/path/with spaces/and@special#chars';
            const normalized = PathResolver.normalizePath(specialPath);
            expect(normalized).toContain('with spaces');
            expect(normalized).toContain('special');
        });
    });

    describe('LPC路径和系统路径转换', () => {
        test('应该转换LPC路径为系统路径', () => {
            const result = PathResolver.lpcPathToSystemPath(
                '/system/user.c',
                mockWorkspaceFolder
            );

            expect(result).toContain('workspace');
            expect(result).toContain('mylib');
            expect(result).toContain('system');
            expect(result).toContain('user.c');
        });

        test('应该转换系统路径为LPC路径', () => {
            const systemPath = path.join('/workspace/mylib', 'system', 'user.c');
            const result = PathResolver.systemPathToLpcPath(
                systemPath,
                mockWorkspaceFolder
            );

            expect(result).toBe('/system/user.c');
        });
    });

    describe('缓存管理', () => {
        test('应该能清除缓存', () => {
            expect(() => PathResolver.clearCache()).not.toThrow();
        });
    });

    describe('路径解析', () => {
        test('应该正确解析相对路径', () => {
            const result = PathResolver.normalizePath('./relative/path.c');
            expect(result).toContain('relative');
            expect(result).toContain('path.c');
        });

        test('应该正确解析绝对路径', () => {
            const result = PathResolver.normalizePath('/absolute/path.c');
            expect(result).toBe('/absolute/path.c');
        });

        test('应该处理路径中的..符号', () => {
            const result = PathResolver.normalizePath('/path/to/../file.c');
            expect(result).toContain('file.c');
        });
    });

    describe('健壮性测试', () => {
        test('应该处理有效的路径转换', () => {
            const validPath = '/valid/path/to/file.c';
            const result = PathResolver.normalizePath(validPath);
            expect(result).toBeDefined();
            expect(typeof result).toBe('string');
        });

        test('normalizePath应该返回字符串或undefined', () => {
            const result = PathResolver.normalizePath('test/path');
            expect(typeof result === 'string' || result === undefined).toBe(true);
        });
    });
});
