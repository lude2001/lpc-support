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
    documentAdapter: HoverDocumentAdapter;
    scopedHoverResolver?: Pick<ScopedMethodHoverResolver, 'provideScopedHover'>;
    objectMethodHoverResolver: Pick<ObjectMethodHoverResolver, 'provideObjectHover'>;
}

export interface DefaultObjectInferenceHoverServiceDependencies {
    documentAdapter: HoverDocumentAdapter;
    objectAccessProvider: HoverObjectAccessProvider;
    methodResolver: HoverMethodResolver;
    analysisService?: Pick<DocumentAnalysisService, 'getSyntaxDocument' | 'getSemanticSnapshot'>;
    documentationService?: FunctionDocumentationService;
    renderer: CallableDocRenderer;
    scopedMethodResolver?: ScopedMethodResolver;
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

export class VsCodeHoverDocumentAdapter implements HoverDocumentAdapter {
    public fromLanguageDocument(document: LanguageCapabilityContext['document']): HoverDocument {
        return toHoverDocument(document as unknown as vscode.TextDocument);
    }
}

export class VsCodeHoverObjectAccessProvider implements HoverObjectAccessProvider {
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

export class VsCodeHoverMethodResolver implements HoverMethodResolver {
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
        dependencies: HoverServiceDependencies
    ) {
        this.documentAdapter = dependencies.documentAdapter;
        this.scopedHoverResolver = dependencies.scopedHoverResolver;
        this.objectMethodHoverResolver = dependencies.objectMethodHoverResolver;
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

export function createDefaultObjectInferenceLanguageHoverService(
    _objectInferenceService: ObjectInferenceService,
    _targetMethodLookup: TargetMethodLookup | undefined,
    dependencies: DefaultObjectInferenceHoverServiceDependencies
): ObjectInferenceLanguageHoverService {
    const documentationService = assertDocumentationService(
        'ObjectInferenceLanguageHoverService',
        dependencies.documentationService
    );
    const scopedHoverResolver = dependencies.scopedMethodResolver
        ? new ScopedMethodHoverResolver({
            scopedMethodResolver: dependencies.scopedMethodResolver,
            documentationService,
            renderer: dependencies.renderer,
            analysisService: assertAnalysisService('ObjectInferenceLanguageHoverService', dependencies.analysisService)
        })
        : undefined;
    const objectMethodHoverResolver = new ObjectMethodHoverResolver({
        objectAccessProvider: dependencies.objectAccessProvider,
        methodResolver: dependencies.methodResolver,
        documentationService,
        renderer: dependencies.renderer,
        documentationSupport: {
            toDocumentationTextDocument
        }
    });

    return new ObjectInferenceLanguageHoverService({
        documentAdapter: dependencies.documentAdapter,
        scopedHoverResolver,
        objectMethodHoverResolver
    });
}
