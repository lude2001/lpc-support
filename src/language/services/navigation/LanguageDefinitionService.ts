import * as fs from 'fs';
import * as vscode from 'vscode';
import type { LanguageCapabilityContext } from '../../contracts/LanguageCapabilityContext';
import type { LanguageLocation, LanguagePosition } from '../../contracts/LanguagePosition';
import { EfunDocsManager } from '../../../efunDocs';
import { ObjectInferenceService } from '../../../objectInference/ObjectInferenceService';
import type { ScopedMethodResolver } from '../../../objectInference/ScopedMethodResolver';
import { TargetMethodLookup } from '../../../targetMethodLookup';
import type { LpcProjectConfigService } from '../../../projectConfig/LpcProjectConfigService';
import { assertAnalysisService } from '../../../semantic/assertAnalysisService';
import type { DocumentAnalysisService } from '../../../semantic/documentAnalysisService';
import type { WorkspaceDocumentPathSupport } from '../../shared/WorkspaceDocumentPathSupport';
import { DefinitionResolverSupport } from './definition/DefinitionResolverSupport';
import { DirectSymbolDefinitionResolver } from './definition/DirectSymbolDefinitionResolver';
import { FunctionFamilyDefinitionResolver } from './definition/FunctionFamilyDefinitionResolver';
import { ObjectMethodDefinitionResolver } from './definition/ObjectMethodDefinitionResolver';
import { ScopedMethodDefinitionResolver } from './definition/ScopedMethodDefinitionResolver';
import type {
    DefinitionRequestState,
    DefinitionSemanticAdapter,
    LanguageDefinitionHost,
} from './definition/types';

export interface LanguageDefinitionRequest {
    context: LanguageCapabilityContext;
    position: LanguagePosition;
}

export interface LanguageDefinitionService {
    provideDefinition(request: LanguageDefinitionRequest): Promise<LanguageLocation[]>;
}

interface LanguageDefinitionDependencies {
    analysisService?: Pick<DocumentAnalysisService, 'getSemanticSnapshot' | 'getBestAvailableSnapshot' | 'getSyntaxDocument'>;
    host?: LanguageDefinitionHost;
    semanticAdapter?: DefinitionSemanticAdapter;
    scopedMethodResolver?: ScopedMethodResolver;
    pathSupport?: WorkspaceDocumentPathSupport;
}

export class AstBackedLanguageDefinitionService implements LanguageDefinitionService {
    private readonly efunDocsManager: EfunDocsManager;
    private readonly objectInferenceService: ObjectInferenceService;
    private readonly projectConfigService?: LpcProjectConfigService;
    private readonly targetMethodLookup: TargetMethodLookup;
    private readonly host: LanguageDefinitionHost;
    private readonly semanticAdapter?: DefinitionSemanticAdapter;
    private readonly scopedMethodResolver?: ScopedMethodResolver;
    private readonly support: DefinitionResolverSupport;
    private readonly scopedDefinitionResolver: ScopedMethodDefinitionResolver;
    private readonly objectMethodDefinitionResolver: ObjectMethodDefinitionResolver;
    private readonly directSymbolDefinitionResolver: DirectSymbolDefinitionResolver;
    private readonly functionFamilyDefinitionResolver: FunctionFamilyDefinitionResolver;

    public constructor(
        efunDocsManager: EfunDocsManager,
        objectInferenceService: ObjectInferenceService,
        targetMethodLookup: TargetMethodLookup,
        projectConfigService?: LpcProjectConfigService,
        dependencies: LanguageDefinitionDependencies = {}
    ) {
        this.efunDocsManager = efunDocsManager;
        this.projectConfigService = projectConfigService;
        const resolvedDependencies = this.resolveDependencies(dependencies);
        this.host = resolvedDependencies.host;
        const analysisService = assertAnalysisService(
            'AstBackedLanguageDefinitionService',
            resolvedDependencies.analysisService
        );
        this.objectInferenceService = objectInferenceService;
        this.targetMethodLookup = targetMethodLookup;
        this.semanticAdapter = resolvedDependencies.semanticAdapter;
        this.scopedMethodResolver = resolvedDependencies.scopedMethodResolver;
        this.support = new DefinitionResolverSupport({
            analysisService,
            host: this.host,
            projectConfigService: this.projectConfigService,
            pathSupport: resolvedDependencies.pathSupport,
            semanticAdapter: this.semanticAdapter
        });
        this.scopedDefinitionResolver = new ScopedMethodDefinitionResolver({
            analysisService,
            scopedMethodResolver: this.scopedMethodResolver
        });
        this.objectMethodDefinitionResolver = new ObjectMethodDefinitionResolver({
            support: this.support,
            objectInferenceService: this.objectInferenceService,
            targetMethodLookup: this.targetMethodLookup
        });
        this.directSymbolDefinitionResolver = new DirectSymbolDefinitionResolver({
            support: this.support,
            efunDocsManager: this.efunDocsManager,
            semanticAdapter: this.semanticAdapter
        });
        this.functionFamilyDefinitionResolver = new FunctionFamilyDefinitionResolver({
            support: this.support,
            semanticAdapter: this.semanticAdapter
        });
    }

    private resolveDependencies(
        dependencies: LanguageDefinitionDependencies
    ): {
        host: LanguageDefinitionHost;
        analysisService?: Pick<DocumentAnalysisService, 'getSemanticSnapshot' | 'getBestAvailableSnapshot' | 'getSyntaxDocument'>;
        semanticAdapter?: DefinitionSemanticAdapter;
        scopedMethodResolver?: ScopedMethodResolver;
        pathSupport: WorkspaceDocumentPathSupport;
    } {
        if (!dependencies.host) {
            throw new Error('AstBackedLanguageDefinitionService requires an injected LanguageDefinitionHost');
        }
        if (!dependencies.pathSupport) {
            throw new Error('AstBackedLanguageDefinitionService requires an injected WorkspaceDocumentPathSupport');
        }

        return {
            host: dependencies.host,
            analysisService: dependencies.analysisService,
            semanticAdapter: dependencies.semanticAdapter,
            scopedMethodResolver: dependencies.scopedMethodResolver,
            pathSupport: dependencies.pathSupport
        };
    }

    public async provideDefinition(request: LanguageDefinitionRequest): Promise<LanguageLocation[]> {
        const document = request.context.document as unknown as vscode.TextDocument;
        const position = new vscode.Position(request.position.line, request.position.character);
        const workspaceRoot = request.context.workspace.workspaceRoot;
        const projectConfig = request.context.workspace.projectConfig;
        const requestState = this.createRequestState();
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return [];
        }

        const word = document.getText(wordRange);
        const scopedDefinition = await this.scopedDefinitionResolver.resolve(document, position);
        if (scopedDefinition !== undefined) {
            return this.toLanguageLocations(scopedDefinition);
        }

        const objectMethodDefinition = await this.objectMethodDefinitionResolver.resolve(document, position, word);
        if (objectMethodDefinition) {
            return this.toLanguageLocations(objectMethodDefinition);
        }

        const directDefinition = await this.directSymbolDefinitionResolver.resolve(
            document,
            position,
            word,
            workspaceRoot,
            projectConfig,
            requestState
        );
        if (directDefinition) {
            return this.toLanguageLocations(directDefinition);
        }

        return this.toLanguageLocations(
            await this.functionFamilyDefinitionResolver.resolve(document, word, requestState)
        );
    }

    private createRequestState(): DefinitionRequestState {
        return this.support.createRequestState();
    }

    private toLanguageLocations(
        result: vscode.Location | vscode.Location[] | undefined
    ): LanguageLocation[] {
        return this.support.toLanguageLocations(result);
    }
}
