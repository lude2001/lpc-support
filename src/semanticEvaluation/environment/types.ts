import * as vscode from 'vscode';
import type { WorkspaceDocumentPathSupport } from '../../language/shared/WorkspaceDocumentPathSupport';
import type { LpcProjectConfigService } from '../../projectConfig/LpcProjectConfigService';
import type { SemanticValue } from '../types';

export type EnvironmentSemanticProviderMatch = 'exact' | 'compatible';

export interface EnvironmentSemanticRequest {
    document: vscode.TextDocument;
    calleeName: string;
    argumentCount: number;
    workspaceRoot?: string;
    pathSupport: Pick<WorkspaceDocumentPathSupport, 'resolveObjectFilePath'>;
    playerObjectPathOrProjectConfig?: string | LpcProjectConfigService;
}

export interface EnvironmentSemanticProvider {
    readonly id: string;
    match(request: EnvironmentSemanticRequest): EnvironmentSemanticProviderMatch | undefined;
    evaluate(request: EnvironmentSemanticRequest): Promise<SemanticValue>;
}
