import * as vscode from 'vscode';
import type { LpcProjectConfigService } from '../../projectConfig/LpcProjectConfigService';
import { configuredCandidateSetValue, objectValue, unknownValue } from '../valueFactories';
import type { EnvironmentSemanticProvider, EnvironmentSemanticRequest } from './types';

export class ThisPlayerProvider implements EnvironmentSemanticProvider {
    public readonly id = 'this_player';

    public match(request: EnvironmentSemanticRequest): 'exact' | undefined {
        if (request.calleeName !== 'this_player' || request.argumentCount !== 0) {
            return undefined;
        }

        return 'exact';
    }

    public async evaluate(request: EnvironmentSemanticRequest) {
        const playerObjectPath = await this.resolveConfiguredPlayerObjectPath(request);
        if (!playerObjectPath) {
            return unknownValue();
        }

        const resolvedPath = request.pathSupport.resolveObjectFilePath(
            request.document,
            this.toObjectPathExpression(playerObjectPath)
        );
        if (!resolvedPath) {
            return unknownValue();
        }

        return configuredCandidateSetValue(this.id, [objectValue(resolvedPath)]);
    }

    private async resolveConfiguredPlayerObjectPath(
        request: EnvironmentSemanticRequest
    ): Promise<string | undefined> {
        const configured = request.playerObjectPathOrProjectConfig;
        if (typeof configured === 'string') {
            return configured;
        }

        if (!configured) {
            return undefined;
        }

        const workspaceRoot = request.workspaceRoot
            ?? vscode.workspace.getWorkspaceFolder(request.document.uri)?.uri.fsPath;
        if (!workspaceRoot) {
            return undefined;
        }

        const projectConfig = await configured.loadForWorkspace(workspaceRoot);
        return projectConfig?.playerObjectPath;
    }

    private toObjectPathExpression(objectPath: string): string {
        return objectPath.length >= 2 && objectPath.startsWith('"') && objectPath.endsWith('"')
            ? objectPath
            : `"${objectPath}"`;
    }
}
