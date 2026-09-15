import * as fs from 'fs';
import * as path from 'path';
import type * as vscode from 'vscode';

export type LanguageServerRuntime =
    | { kind: 'typescript'; module: string }
    | { kind: 'rust'; command: string };

export function resolveLanguageServerRuntime(
    context: Pick<vscode.ExtensionContext, 'asAbsolutePath'>,
    environment: NodeJS.ProcessEnv = process.env,
    platform: NodeJS.Platform = process.platform
): LanguageServerRuntime {
    if (environment.LPC_LANGUAGE_SERVER !== 'rust') {
        return {
            kind: 'typescript',
            module: context.asAbsolutePath(path.join('dist', 'lsp', 'server.js'))
        };
    }

    const executableName = platform === 'win32'
        ? 'lpc-language-server.exe'
        : 'lpc-language-server';
    const command = environment.LPC_RUST_SERVER_PATH
        ? path.resolve(environment.LPC_RUST_SERVER_PATH)
        : context.asAbsolutePath(path.join('dist', 'bin', executableName));

    if (!fs.existsSync(command)) {
        throw new Error(
            `Rust LPC language server was requested but no executable exists at ${command}. `
            + 'Run npm run build:rust or set LPC_RUST_SERVER_PATH.'
        );
    }

    return { kind: 'rust', command };
}
