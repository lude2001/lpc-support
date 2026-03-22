export interface LpcResolvedConfig {
    name?: string;
    mudlibDirectory?: string;
    binaryDirectory?: string;
    includeDirectories?: string[];
    simulatedEfunFile?: string;
    masterFile?: string;
    globalIncludeFile?: string;
}

export interface LpcCompileLocalConfig {
    useSystemCommand?: boolean;
    lpccpPath?: string;
    driverConfigPath?: string;
}

export interface LpcCompileRemoteServer {
    name: string;
    url: string;
    description?: string;
}

export interface LpcCompileRemoteConfig {
    activeServer?: string;
    servers?: LpcCompileRemoteServer[];
}

export interface LpcCompileConfig {
    mode?: 'local' | 'remote';
    local?: LpcCompileLocalConfig;
    remote?: LpcCompileRemoteConfig;
}

export interface LpcProjectConfig {
    version: 1;
    configHellPath: string;
    compile?: LpcCompileConfig;
    resolved?: LpcResolvedConfig;
    lastSyncedAt?: string;
}
