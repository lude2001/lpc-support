import * as path from 'path';
import * as vscode from 'vscode';
import { afterEach, describe, expect, test } from '@jest/globals';
import { resolveLanguageServerRuntime } from '../client/languageServerRuntime';

describe('language server runtime selection', () => {
    afterEach(() => { (vscode.env as { language: string }).language = 'zh-cn'; });
    const extensionRoot = path.resolve('D:/extension');
    const context = {
        asAbsolutePath: (relativePath: string) => path.join(extensionRoot, relativePath)
    };

    test('uses the Rust server by default', () => {
        expect(resolveLanguageServerRuntime(context, {
            LPC_RUST_SERVER_PATH: process.execPath
        }, 'win32')).toEqual({
            kind: 'rust',
            command: path.resolve(process.execPath)
        });
    });

    test('no longer honors a legacy TypeScript server override', () => {
        expect(resolveLanguageServerRuntime(context, {
            LPC_LANGUAGE_SERVER: 'typescript',
            LPC_RUST_SERVER_PATH: process.execPath
        }, 'win32')).toEqual({
            kind: 'rust',
            command: path.resolve(process.execPath)
        });
    });

    test.each([
        ['en', 'bundled Rust LPC language server is missing'],
        ['zh-cn', '打包的 Rust LPC 语言服务器缺失']
    ])('rejects an explicitly requested missing Rust server in %s', (language, message) => {
        (vscode.env as { language: string }).language = language;
        expect(() => resolveLanguageServerRuntime(context, {
            LPC_RUST_SERVER_PATH: path.join(extensionRoot, 'missing.exe')
        }, 'win32')).toThrow(message);
    });
});
