export function assertAnalysisService<T>(
    owner: string,
    analysisService: T | undefined
): T {
    if (!analysisService) {
        throw new Error(`${owner} requires an injected analysisService`);
    }

    return analysisService;
}
