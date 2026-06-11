import * as fs from 'fs';
import * as path from 'path';
import type { LanguageWorkspaceProjectConfig } from '../language/contracts/LanguageWorkspaceContext';

export interface DiagnosticsEnablePolicyContext {
    workspaceRoot?: string;
    projectConfig?: LanguageWorkspaceProjectConfig;
}

export function shouldRunProjectDiagnostics(
    context: DiagnosticsEnablePolicyContext,
    fileExists: (filePath: string) => boolean = fs.existsSync
): boolean {
    if (context.projectConfig?.configHellPath || context.projectConfig?.resolvedConfig) {
        return true;
    }

    if (!context.workspaceRoot) {
        return false;
    }

    return fileExists(path.join(context.workspaceRoot, 'lpc-support.json'));
}
