import { nonStaticValue } from '../valueFactories';
import type { EnvironmentSemanticProvider, EnvironmentSemanticRequest } from './types';

const RUNTIME_OBJECT_EFUNS = new Set([
    'previous_object',
    'all_previous_objects',
    'environment',
    'present',
    'find_player',
    'find_living',
    'users',
    'livings',
    'named_livings',
    'all_inventory',
    'deep_inventory',
    'first_inventory',
    'next_inventory',
    'children',
    'objects',
    'query_shadowing',
    'query_snoop',
    'query_snooping',
    'shadow',
    'snoop',
    'heart_beats',
    'get_garbage',
    'function_owner',
    'this_player',
    'this_user',
    'this_interactive'
]);

export class RuntimeNonStaticProvider implements EnvironmentSemanticProvider {
    public readonly id = 'runtime-non-static';

    public match(request: EnvironmentSemanticRequest): 'exact' | undefined {
        if (!RUNTIME_OBJECT_EFUNS.has(request.calleeName)) {
            return undefined;
        }

        return 'exact';
    }

    public async evaluate(request: EnvironmentSemanticRequest) {
        return nonStaticValue(getRuntimeReason(request.calleeName));
    }
}

function getRuntimeReason(calleeName: string): string {
    return calleeName === 'previous_object'
        ? 'previous_object() depends on runtime call stack'
        : `${calleeName}() depends on runtime object state`;
}
