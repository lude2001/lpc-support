export interface LpcResolvedConfig {
    name?: string;
    mudlibDirectory?: string;
    binaryDirectory?: string;
    includeDirectories?: string[];
    simulatedEfunFile?: string;
    masterFile?: string;
    globalIncludeFile?: string;
}

export interface LpcProjectConfig {
    version: 1;
    configHellPath: string;
    resolved?: LpcResolvedConfig;
    lastSyncedAt?: string;
}
