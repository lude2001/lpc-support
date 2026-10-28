import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export type LanguageServerRuntime = { kind: 'rust'; command: string };

export function resolveLanguageServerRuntime(
    context: Pick<vscode.ExtensionContext, 'asAbsolutePath'>,
    environment: NodeJS.ProcessEnv = process.env,
    platform: NodeJS.Platform = process.platform
): LanguageServerRuntime {
    const executableName = platform === 'win32'
        ? 'lpc-language-server.exe'
        : 'lpc-language-server';
    const command = environment.LPC_RUST_SERVER_PATH
        ? path.resolve(environment.LPC_RUST_SERVER_PATH)
        : context.asAbsolutePath(path.join('dist', 'bin', executableName));

    if (!fs.existsSync(command)) {
        throw new Error(
            vscode.l10n.t('The bundled Rust LPC language server is missing at {0}. Reinstall the platform-specific extension package or run npm run build:rust.', command)
        );
    }

    return { kind: 'rust', command };
}
