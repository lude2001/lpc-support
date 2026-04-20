import { nonStaticValue } from '../valueFactories';
import type { EnvironmentSemanticProvider, EnvironmentSemanticRequest } from './types';

export class RuntimeNonStaticProvider implements EnvironmentSemanticProvider {
    public readonly id = 'runtime-non-static';

    public match(request: EnvironmentSemanticRequest): 'exact' | undefined {
        if (request.calleeName !== 'previous_object' || request.argumentCount !== 0) {
            return undefined;
        }

        return 'exact';
    }

    public async evaluate(_request: EnvironmentSemanticRequest) {
        return nonStaticValue('previous_object() depends on runtime call stack');
    }
}
