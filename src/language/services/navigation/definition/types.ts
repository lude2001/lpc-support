import * as vscode from 'vscode';
import type { LanguageLocation } from '../../../contracts/LanguagePosition';
import { EfunDocsManager } from '../../../../efunDocs';
import { ObjectInferenceService } from '../../../../objectInference/ObjectInferenceService';
import type { ScopedMethodResolver } from '../../../../objectInference/ScopedMethodResolver';
import { TargetMethodLookup } from '../../../../targetMethodLookup';
import type { LpcProjectConfigService } from '../../../../projectConfig/LpcProjectConfigService';
import type { DocumentAnalysisService } from '../../../../semantic/documentAnalysisService';
import type { WorkspaceDocumentPathSupport } from '../../../shared/WorkspaceDocumentPathSupport';

export interface DefinitionRequestState {
    processedFiles: Set<string>;
    functionDefinitions: Map<string, vscode.Location>;
}

export interface VsCodeLocationWithSourceUri extends vscode.Location {
    __languageSourceUri?: string;
}

export interface LanguageDefinitionHost {
    onDidChangeTextDocument(listener: (event: { document: { uri: { fsPath: string } } }) => void): vscode.Disposable;
    openTextDocument(target: string | vscode.Uri): Promise<vscode.TextDocument>;
    findFiles(pattern: vscode.RelativePattern): Promise<readonly vscode.Uri[]>;
    getWorkspaceFolder(uri: vscode.Uri): { uri: { fsPath: string } } | undefined;
    getWorkspaceFolders(): readonly { uri: { fsPath: string } }[] | undefined;
    fileExists(filePath: string): boolean;
}

export interface IncludeStatementLike {
    value: string;
    isSystemInclude: boolean;
    range: vscode.Range | { contains(position: vscode.Position): boolean };
}

export interface DefinitionSemanticAdapter {
    getIncludeStatements?(document: vscode.TextDocument): IncludeStatementLike[];
    getInheritStatements?(document: vscode.TextDocument): string[];
    getExportedFunctionNames?(document: vscode.TextDocument): string[];
    findFunctionLocation?(document: vscode.TextDocument, functionName: string): LanguageLocation | vscode.Location | undefined;
    resolveVisibleVariableLocation?(
        document: vscode.TextDocument,
        variableName: string,
        position: vscode.Position
    ): LanguageLocation | vscode.Location | undefined;
}

export interface DefinitionResolverContext {
    efunDocsManager: EfunDocsManager;
    analysisService: Pick<DocumentAnalysisService, 'getSemanticSnapshot' | 'getBestAvailableSnapshot'>;
    objectInferenceService: ObjectInferenceService;
    targetMethodLookup: TargetMethodLookup;
    projectConfigService?: LpcProjectConfigService;
    pathSupport: WorkspaceDocumentPathSupport;
    host: LanguageDefinitionHost;
    semanticAdapter?: DefinitionSemanticAdapter;
    scopedMethodResolver?: ScopedMethodResolver;
}
