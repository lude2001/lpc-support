import { configuredCandidateSetValue, objectValue, unknownValue } from '../valueFactories';
import type { EnvironmentSemanticProvider, EnvironmentSemanticRequest } from './types';
import type { LpcProjectConfigService } from '../../projectConfig/LpcProjectConfigService';

export interface ThisPlayerProviderDependencies {
    playerObjectPath?: string;
    projectConfigService?: Pick<LpcProjectConfigService, 'loadForWorkspace'>;
}

export class ThisPlayerProvider implements EnvironmentSemanticProvider {
    public readonly id = 'this_player';

    constructor(
        private readonly dependencies: ThisPlayerProviderDependencies = {}
    ) {}

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
        if (this.dependencies.playerObjectPath) {
            return this.dependencies.playerObjectPath;
        }

        if (!this.dependencies.projectConfigService || !request.workspaceRoot) {
            return undefined;
        }

        const projectConfig = await this.dependencies.projectConfigService.loadForWorkspace(request.workspaceRoot);
        return projectConfig?.playerObjectPath;
    }

    private toObjectPathExpression(objectPath: string): string {
        return objectPath.length >= 2 && objectPath.startsWith('"') && objectPath.endsWith('"')
            ? objectPath
            : `"${objectPath}"`;
    }
}
