import * as vscode from 'vscode';
import type { LanguageCapabilityContext } from '../../contracts/LanguageCapabilityContext';
import type { LanguageMarkupContent } from '../../contracts/LanguageMarkup';
import type { LanguageLocation, LanguagePosition, LanguageRange } from '../../contracts/LanguagePosition';
import type { LanguageDefinitionRequest } from './LanguageDefinitionService';
import type { LanguageReferenceRequest } from './LanguageReferenceService';
import type {
    LanguagePrepareRenameRequest,
    LanguagePrepareRenameResult,
    LanguageRenameRequest,
    LanguageWorkspaceEdit
} from './LanguageRenameService';
import type { LanguageDocumentSymbol, LanguageSymbolRequest } from './LanguageSymbolService';
import { CallableDocRenderer } from '../../documentation/CallableDocRenderer';
import { FunctionDocumentationService } from '../../documentation/FunctionDocumentationService';
import { assertDocumentationService } from '../../documentation/assertDocumentationService';
import { assertAnalysisService } from '../../../semantic/assertAnalysisService';
import type { DocumentAnalysisService } from '../../../semantic/documentAnalysisService';
import { TargetMethodLookup } from '../../../targetMethodLookup';
import { ObjectInferenceService } from '../../../objectInference/ObjectInferenceService';
import type { ScopedMethodResolver } from '../../../objectInference/ScopedMethodResolver';
import type { InferredObjectAccess } from '../../../objectInference/types';
import { MacroManager } from '../../../macroManager';
import type { LpcProjectConfigService } from '../../../projectConfig/LpcProjectConfigService';
import { ObjectMethodHoverResolver } from './hover/ObjectMethodHoverResolver';
import { ScopedMethodHoverResolver } from './hover/ScopedMethodHoverResolver';
import { toDocumentationTextDocument } from './hover/HoverDocumentationSupport';

export interface LanguageHoverRequest {
    context: LanguageCapabilityContext;
    position: LanguagePosition;
}

export interface LanguageHoverResult {
    contents: LanguageMarkupContent[];
    range?: LanguageRange;
}

export interface LanguageHoverService {
    provideHover(request: LanguageHoverRequest): Promise<LanguageHoverResult | undefined>;
}

export interface LanguageNavigationService {
    provideHover(request: LanguageHoverRequest): Promise<LanguageHoverResult | undefined>;
    provideDefinition(request: LanguageDefinitionRequest): Promise<LanguageLocation[]>;
    provideReferences(request: LanguageReferenceRequest): Promise<LanguageLocation[]>;
    prepareRename(request: LanguagePrepareRenameRequest): Promise<LanguagePrepareRenameResult | undefined>;
    provideRenameEdits(request: LanguageRenameRequest): Promise<LanguageWorkspaceEdit>;
    provideDocumentSymbols(request: LanguageSymbolRequest): Promise<LanguageDocumentSymbol[]>;
}

interface HoverDocument {
    uri: string;
    path: string;
    version: number;
    getText(range?: LanguageRange): string;
    getWordRangeAtPosition(position: LanguagePosition): LanguageRange | undefined;
}

interface HoverResolvedMethod {
    path: string;
    documentText: string;
    document?: vscode.TextDocument;
}

interface HoverObjectAccessProvider {
    inferObjectAccess(
        context: LanguageCapabilityContext,
        document: HoverDocument,
        position: LanguagePosition
    ): Promise<InferredObjectAccess | undefined>;
}

interface HoverMethodResolver {
    findMethod(
        context: LanguageCapabilityContext,
        document: HoverDocument,
        targetPath: string,
        methodName: string
    ): Promise<HoverResolvedMethod | undefined>;
}

interface HoverDocumentAdapter {
    fromLanguageDocument(document: LanguageCapabilityContext['document']): HoverDocument;
}

export interface HoverServiceDependencies {
    analysisService?: Pick<DocumentAnalysisService, 'getSyntaxDocument' | 'getSemanticSnapshot'>;
    documentAdapter?: HoverDocumentAdapter;
    objectAccessProvider?: HoverObjectAccessProvider;
    methodResolver?: HoverMethodResolver;
    documentationService?: FunctionDocumentationService;
    renderer?: CallableDocRenderer;
    scopedMethodResolver?: ScopedMethodResolver;
    scopedHoverResolver?: Pick<ScopedMethodHoverResolver, 'provideScopedHover'>;
    objectMethodHoverResolver?: Pick<ObjectMethodHoverResolver, 'provideObjectHover'>;
}

interface VsCodeBackedHoverDocument extends HoverDocument {
    raw: vscode.TextDocument;
}

function toVsCodePosition(position: LanguagePosition): vscode.Position {
    return new vscode.Position(position.line, position.character);
}

function toVsCodeRange(range: LanguageRange): vscode.Range {
    return new vscode.Range(range.start.line, range.start.character, range.end.line, range.end.character);
}

function fromVsCodeRange(range: vscode.Range): LanguageRange {
    return {
        start: {
            line: range.start.line,
            character: range.start.character
        },
        end: {
            line: range.end.line,
            character: range.end.character
        }
    };
}

function toHoverDocument(document: vscode.TextDocument): VsCodeBackedHoverDocument {
    const fallbackPath = document.fileName ?? '';
    const fallbackUri = typeof (document as Partial<vscode.TextDocument>).uri?.toString === 'function'
        ? (document as Partial<vscode.TextDocument>).uri!.toString()
        : fallbackPath;
    return {
        uri: fallbackUri,
        path: document.uri?.fsPath ?? fallbackPath,
        version: document.version ?? 0,
        raw: document,
        getText: (range?: LanguageRange) => range ? document.getText(toVsCodeRange(range)) : document.getText(),
        getWordRangeAtPosition: (position: LanguagePosition) => {
            const range = document.getWordRangeAtPosition(toVsCodePosition(position));
            return range ? fromVsCodeRange(range) : undefined;
        }
    };
}

function ensureVsCodeBackedDocument(document: HoverDocument): vscode.TextDocument {
    return (document as VsCodeBackedHoverDocument).raw;
}

function isVsCodeBackedHoverDocument(document: HoverDocument): document is VsCodeBackedHoverDocument {
    return Boolean((document as Partial<VsCodeBackedHoverDocument>).raw);
}

class VsCodeHoverDocumentAdapter implements HoverDocumentAdapter {
    public fromLanguageDocument(document: LanguageCapabilityContext['document']): HoverDocument {
        return toHoverDocument(document as unknown as vscode.TextDocument);
    }
}

class VsCodeHoverObjectAccessProvider implements HoverObjectAccessProvider {
    public constructor(private readonly objectInferenceService: ObjectInferenceService) {}

    public async inferObjectAccess(
        _context: LanguageCapabilityContext,
        document: HoverDocument,
        position: LanguagePosition
    ): Promise<InferredObjectAccess | undefined> {
        return this.objectInferenceService.inferObjectAccess(
            ensureVsCodeBackedDocument(document),
            toVsCodePosition(position)
        );
    }
}

class VsCodeHoverMethodResolver implements HoverMethodResolver {
    public constructor(private readonly targetMethodLookup: TargetMethodLookup) {}

    public async findMethod(
        _context: LanguageCapabilityContext,
        document: HoverDocument,
        targetPath: string,
        methodName: string
    ): Promise<HoverResolvedMethod | undefined> {
        const resolvedMethod = await this.targetMethodLookup.findMethod(
            ensureVsCodeBackedDocument(document),
            targetPath,
            methodName
        );
        if (!resolvedMethod) {
            return undefined;
        }

        return {
            path: resolvedMethod.path,
            documentText: resolvedMethod.document.getText(),
            document: resolvedMethod.document
        };
    }
}

export class ObjectInferenceLanguageHoverService implements LanguageHoverService {
    private readonly documentAdapter: HoverDocumentAdapter;
    private readonly scopedHoverResolver?: Pick<ScopedMethodHoverResolver, 'provideScopedHover'>;
    private readonly objectMethodHoverResolver: Pick<ObjectMethodHoverResolver, 'provideObjectHover'>;

    public constructor(
        objectInferenceService: ObjectInferenceService,
        macroManager?: MacroManager,
        targetMethodLookup?: TargetMethodLookup,
        projectConfigService?: LpcProjectConfigService,
        dependencies?: HoverServiceDependencies
    ) {
        this.documentAdapter = dependencies?.documentAdapter ?? new VsCodeHoverDocumentAdapter();
        const renderer = dependencies?.renderer ?? new CallableDocRenderer();
        const requiresDocumentationService = !dependencies?.objectMethodHoverResolver
            || (!dependencies?.scopedHoverResolver && Boolean(dependencies?.scopedMethodResolver));
        const documentationService = requiresDocumentationService
            ? assertDocumentationService(
                'ObjectInferenceLanguageHoverService',
                dependencies?.documentationService
            )
            : dependencies?.documentationService;

        this.scopedHoverResolver = dependencies?.scopedHoverResolver
            ?? (dependencies?.scopedMethodResolver
                ? new ScopedMethodHoverResolver({
                    scopedMethodResolver: dependencies.scopedMethodResolver,
                    documentationService: documentationService!,
                    renderer,
                    analysisService: assertAnalysisService('ObjectInferenceLanguageHoverService', dependencies?.analysisService)
                })
                : undefined);
        this.objectMethodHoverResolver = dependencies?.objectMethodHoverResolver
            ?? new ObjectMethodHoverResolver({
                objectAccessProvider: dependencies?.objectAccessProvider
                    ?? new VsCodeHoverObjectAccessProvider(objectInferenceService),
                methodResolver: dependencies?.methodResolver
                    ?? new VsCodeHoverMethodResolver(
                        targetMethodLookup
                        ?? new TargetMethodLookup(
                            macroManager,
                            projectConfigService,
                            assertAnalysisService('ObjectInferenceLanguageHoverService', dependencies?.analysisService)
                        )
                    ),
                documentationService: documentationService!,
                renderer,
                documentationSupport: {
                    toDocumentationTextDocument
                }
            });
    }

    public async provideHover(request: LanguageHoverRequest): Promise<LanguageHoverResult | undefined> {
        const document = this.documentAdapter.fromLanguageDocument(request.context.document);
        if (this.scopedHoverResolver && isVsCodeBackedHoverDocument(document)) {
            const scopedHover = await this.scopedHoverResolver.provideScopedHover(
                ensureVsCodeBackedDocument(document),
                toVsCodePosition(request.position)
            );
            if (scopedHover) {
                return scopedHover;
            }
        }

        return this.objectMethodHoverResolver.provideObjectHover(
            request.context,
            document,
            request.position
        );
    }
}
