import type {
    EnvironmentSemanticProvider,
    EnvironmentSemanticProviderMatch,
    EnvironmentSemanticRequest
} from './types';

function matchRank(match: EnvironmentSemanticProviderMatch | undefined): number {
    if (match === 'exact') {
        return 2;
    }

    if (match === 'compatible') {
        return 1;
    }

    return 0;
}

export class EnvironmentSemanticRegistry {
    constructor(
        private readonly providers: readonly EnvironmentSemanticProvider[]
    ) {}

    public async evaluate(request: EnvironmentSemanticRequest) {
        const matchedProvider = this.providers
            .map((provider) => ({
                provider,
                match: provider.match(request)
            }))
            .filter((entry) => entry.match)
            .sort((left, right) => matchRank(right.match) - matchRank(left.match))[0]?.provider;

        if (!matchedProvider) {
            return undefined;
        }

        return matchedProvider.evaluate(request);
    }
}
