import * as fs from 'fs';
import * as vscode from 'vscode';
import type { LanguageCapabilityContext } from '../../contracts/LanguageCapabilityContext';
import type { LanguageLocation, LanguagePosition } from '../../contracts/LanguagePosition';
import { ASTManager } from '../../../ast/astManager';
import { MacroManager } from '../../../macroManager';
import { EfunDocsManager } from '../../../efunDocs';
import { ObjectInferenceService } from '../../../objectInference/ObjectInferenceService';
import type { ScopedMethodResolver } from '../../../objectInference/ScopedMethodResolver';
import { TargetMethodLookup } from '../../../targetMethodLookup';
import type { LpcProjectConfigService } from '../../../projectConfig/LpcProjectConfigService';
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
    host?: LanguageDefinitionHost;
    semanticAdapter?: DefinitionSemanticAdapter;
    scopedMethodResolver?: ScopedMethodResolver;
}

const defaultDefinitionHost: LanguageDefinitionHost = {
    onDidChangeTextDocument: (listener) => vscode.workspace.onDidChangeTextDocument(listener),
    openTextDocument: async (target) => {
        return typeof target === 'string'
            ? vscode.workspace.openTextDocument(target)
            : vscode.workspace.openTextDocument(target);
    },
    findFiles: async (pattern) => vscode.workspace.findFiles(pattern),
    getWorkspaceFolder: (uri) => vscode.workspace.getWorkspaceFolder(uri),
    getWorkspaceFolders: () => vscode.workspace.workspaceFolders,
    fileExists: (filePath: string) => fs.existsSync(filePath)
};

export class AstBackedLanguageDefinitionService implements LanguageDefinitionService {
    private readonly macroManager: MacroManager;
    private readonly efunDocsManager: EfunDocsManager;
    private readonly astManager: ASTManager;
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
        macroManager: MacroManager,
        efunDocsManager: EfunDocsManager,
        objectInferenceService?: ObjectInferenceService,
        targetMethodLookup?: TargetMethodLookup,
        projectConfigService?: LpcProjectConfigService,
        hostOrDependencies: LanguageDefinitionHost | LanguageDefinitionDependencies = defaultDefinitionHost
    ) {
        this.macroManager = macroManager;
        this.efunDocsManager = efunDocsManager;
        this.astManager = ASTManager.getInstance();
        this.projectConfigService = projectConfigService;
        this.objectInferenceService = objectInferenceService ?? new ObjectInferenceService(macroManager, projectConfigService);
        this.targetMethodLookup = targetMethodLookup ?? new TargetMethodLookup(macroManager, projectConfigService);
        const dependencies = this.resolveDependencies(hostOrDependencies);
        this.host = dependencies.host;
        this.semanticAdapter = dependencies.semanticAdapter;
        this.scopedMethodResolver = dependencies.scopedMethodResolver;
        this.support = new DefinitionResolverSupport({
            astManager: this.astManager,
            host: this.host,
            macroManager: this.macroManager,
            projectConfigService: this.projectConfigService,
            semanticAdapter: this.semanticAdapter
        });
        this.scopedDefinitionResolver = new ScopedMethodDefinitionResolver({
            scopedMethodResolver: this.scopedMethodResolver
        });
        this.objectMethodDefinitionResolver = new ObjectMethodDefinitionResolver({
            support: this.support,
            objectInferenceService: this.objectInferenceService,
            targetMethodLookup: this.targetMethodLookup
        });
        this.directSymbolDefinitionResolver = new DirectSymbolDefinitionResolver({
            support: this.support,
            macroManager: this.macroManager,
            efunDocsManager: this.efunDocsManager,
            semanticAdapter: this.semanticAdapter
        });
        this.functionFamilyDefinitionResolver = new FunctionFamilyDefinitionResolver({
            support: this.support,
            semanticAdapter: this.semanticAdapter
        });
    }

    private resolveDependencies(
        hostOrDependencies: LanguageDefinitionHost | LanguageDefinitionDependencies
    ): {
        host: LanguageDefinitionHost;
        semanticAdapter?: DefinitionSemanticAdapter;
        scopedMethodResolver?: ScopedMethodResolver;
    } {
        if ('onDidChangeTextDocument' in hostOrDependencies) {
            return {
                host: hostOrDependencies
            };
        }

        return {
            host: hostOrDependencies.host ?? defaultDefinitionHost,
            semanticAdapter: hostOrDependencies.semanticAdapter,
            scopedMethodResolver: hostOrDependencies.scopedMethodResolver
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
