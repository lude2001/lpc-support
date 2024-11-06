export interface FluffOSServer {
    name: string;
    url: string;
    description?: string;
    active?: boolean;
}

export interface LPCConfig {
    servers: FluffOSServer[];
    defaultServer?: string;
    includePath?: string;
}

export interface MacroDefinition {
    name: string;
    value: string;
    file: string;
    line: number;
    description?: string;
} 