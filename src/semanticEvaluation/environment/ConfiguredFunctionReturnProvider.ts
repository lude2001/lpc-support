import { getDocumentWorkspaceProjectConfig } from '../../language/shared/documentWorkspaceConfig';
import type {
    InstanceResolutionFunctionMap,
    LpcResolvedConfig
} from '../../projectConfig/LpcProjectConfig';
import { configuredCandidateSetValue, objectValue, unknownValue } from '../valueFactories';
import type {
    EnvironmentSemanticProvider,
    EnvironmentSemanticProviderMatch,
    EnvironmentSemanticRequest
} from './types';

export interface ConfiguredFunctionReturnProjectConfig {
    instanceResolutionFunctions?: InstanceResolutionFunctionMap;
    resolvedConfig?: LpcResolvedConfig;
}

export interface ConfiguredFunctionReturnProjectConfigProvider {
    getWorkspaceProjectConfig(workspaceRoot: string): ConfiguredFunctionReturnProjectConfig | undefined;
}

const OBJECT_ARRAY_RETURN_EFUNS = new Set([
    'all_previous_objects',
    'users',
    'livings',
    'named_livings',
    'all_inventory',
    'deep_inventory',
    'children',
    'objects',
    'heart_beats',
    'get_garbage'
]);

const CONFIGURABLE_EFUN_ARITIES = new Map<string, { min: number; max: number }>([
    ['master', { min: 0, max: 0 }],
    ['this_player', { min: 0, max: 1 }],
    ['this_user', { min: 0, max: 1 }],
    ['this_interactive', { min: 0, max: 1 }],
    ['environment', { min: 0, max: 1 }],
    ['present', { min: 1, max: 2 }],
    ['find_player', { min: 1, max: 1 }],
    ['find_living', { min: 1, max: 1 }],
    ['first_inventory', { min: 0, max: 1 }],
    ['next_inventory', { min: 0, max: 1 }],
    ['query_shadowing', { min: 1, max: 1 }],
    ['query_snoop', { min: 1, max: 1 }],
    ['query_snooping', { min: 1, max: 1 }],
    ['shadow', { min: 1, max: 2 }],
    ['snoop', { min: 1, max: 2 }],
    ['function_owner', { min: 1, max: 1 }]
]);

export interface ConfiguredFunctionReturnProviderDependencies {
    instanceResolutionFunctions?: InstanceResolutionFunctionMap;
    projectConfigProvider?: ConfiguredFunctionReturnProjectConfigProvider;
}

export class ConfiguredFunctionReturnProvider implements EnvironmentSemanticProvider {
    public readonly id = 'configured-function-return';

    constructor(
        private readonly dependencies: ConfiguredFunctionReturnProviderDependencies = {}
    ) {}

    public match(request: EnvironmentSemanticRequest): EnvironmentSemanticProviderMatch | undefined {
        if (OBJECT_ARRAY_RETURN_EFUNS.has(request.calleeName)) {
            return undefined;
        }

        const documentConfig = getDocumentWorkspaceProjectConfig(request.document);
        if (this.dependencies.instanceResolutionFunctions?.[request.calleeName]?.length
            || documentConfig?.instanceResolutionFunctions?.[request.calleeName]?.length) {
            return 'exact';
        }

        const projectConfig = this.getWorkspaceProjectConfig(request);
        if (projectConfig?.instanceResolutionFunctions?.[request.calleeName]?.length) {
            return 'exact';
        }

        if (CONFIGURABLE_EFUN_ARITIES.has(request.calleeName)) {
            return 'exact';
        }

        return undefined;
    }

    public async evaluate(request: EnvironmentSemanticRequest) {
        const configuredPaths = await this.resolveConfiguredObjectPaths(request);
        if (!configuredPaths.length) {
            return unknownValue();
        }

        const values = configuredPaths
            .map((objectPath) => request.pathSupport.resolveObjectFilePath(
                request.document,
                toObjectPathExpression(objectPath)
            ))
            .filter((resolvedPath): resolvedPath is string => Boolean(resolvedPath))
            .map((resolvedPath) => objectValue(resolvedPath));

        return values.length > 0
            ? configuredCandidateSetValue(`${this.id}:${request.calleeName}`, values)
            : unknownValue();
    }

    private async resolveConfiguredObjectPaths(request: EnvironmentSemanticRequest): Promise<string[]> {
        if (OBJECT_ARRAY_RETURN_EFUNS.has(request.calleeName)
            || !isValidConfiguredEfunArity(request)) {
            return [];
        }

        const directPaths = this.dependencies.instanceResolutionFunctions?.[request.calleeName];
        if (directPaths?.length) {
            return directPaths;
        }

        const documentConfig = getDocumentWorkspaceProjectConfig(request.document);
        const documentPaths = documentConfig?.instanceResolutionFunctions?.[request.calleeName];
        if (documentPaths?.length) {
            return documentPaths;
        }

        const projectConfig = this.getWorkspaceProjectConfig(request);
        const projectPaths = projectConfig?.instanceResolutionFunctions?.[request.calleeName];
        if (projectPaths?.length) {
            return projectPaths;
        }

        const resolvedConfig = projectConfig?.resolvedConfig ?? documentConfig?.resolvedConfig;
        const resolvedMasterPath = resolveMasterFunctionPath(request.calleeName, resolvedConfig);
        return resolvedMasterPath ? [resolvedMasterPath] : [];
    }

    private getWorkspaceProjectConfig(
        request: EnvironmentSemanticRequest
    ): ConfiguredFunctionReturnProjectConfig | undefined {
        if (!this.dependencies.projectConfigProvider || !request.workspaceRoot) {
            return undefined;
        }

        return this.dependencies.projectConfigProvider.getWorkspaceProjectConfig(request.workspaceRoot);
    }
}

function isValidConfiguredEfunArity(request: EnvironmentSemanticRequest): boolean {
    const arity = CONFIGURABLE_EFUN_ARITIES.get(request.calleeName);
    return !arity || (request.argumentCount >= arity.min && request.argumentCount <= arity.max);
}

function resolveMasterFunctionPath(
    calleeName: string,
    resolvedConfig: LpcResolvedConfig | undefined
): string | undefined {
    return calleeName === 'master'
        ? resolvedConfig?.masterFile
        : undefined;
}

function toObjectPathExpression(objectPath: string): string {
    return objectPath.length >= 2 && objectPath.startsWith('"') && objectPath.endsWith('"')
        ? objectPath
        : `"${objectPath}"`;
}
