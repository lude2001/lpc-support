import { RequestType0 } from 'vscode-languageserver/node';

export interface HealthStatusRequest {
}

export interface HealthStatusResponse {
    status: 'ok';
    mode: 'phase-a';
    serverVersion: string;
    documentCount: number;
    performance?: {
        parser?: {
            parseCount?: number;
            totalParseTime?: number;
            avgParseTime?: number;
            parseFiles?: Array<{
                uri: string;
                count: number;
                totalTimeMs: number;
            }>;
        };
        semantic?: {
            totalSnapshots?: number;
            buildCount?: number;
            totalBuildTimeMs?: number;
            buildFiles?: Array<{
                uri: string;
                count: number;
                totalTimeMs: number;
            }>;
        };
    };
}

export const HealthRequest = {
    method: 'lpc/health',
    type: new RequestType0<HealthStatusResponse, void>('lpc/health')
} as const;
