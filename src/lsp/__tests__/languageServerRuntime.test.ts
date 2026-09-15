import * as path from 'path';
import { resolveLanguageServerRuntime } from '../client/languageServerRuntime';

describe('language server runtime selection', () => {
    const extensionRoot = path.resolve('D:/extension');
    const context = {
        asAbsolutePath: (relativePath: string) => path.join(extensionRoot, relativePath)
    };

    test('keeps the TypeScript server as the default during migration', () => {
        expect(resolveLanguageServerRuntime(context, {}, 'win32')).toEqual({
            kind: 'typescript',
            module: path.join(extensionRoot, 'dist', 'lsp', 'server.js')
        });
    });

    test('rejects an explicitly requested missing Rust server', () => {
        expect(() => resolveLanguageServerRuntime(context, {
            LPC_LANGUAGE_SERVER: 'rust',
            LPC_RUST_SERVER_PATH: path.join(extensionRoot, 'missing.exe')
        }, 'win32')).toThrow('Rust LPC language server was requested');
    });
});
