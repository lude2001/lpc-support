import { RequestType0 } from 'vscode-languageserver/node';

export interface HealthStatusRequest {
}

export interface HealthStatusResponse {
    status: 'ok';
    mode: 'phase-a';
    serverVersion: string;
    documentCount: number;
}

export const HealthRequest = {
    method: 'lpc/health',
    type: new RequestType0<HealthStatusResponse, void>('lpc/health')
} as const;
