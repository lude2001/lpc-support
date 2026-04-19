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
import type { CallableDoc } from '../../documentation/types';
import { assertAnalysisService } from '../../../semantic/assertAnalysisService';
import type { DocumentAnalysisService } from '../../../semantic/documentAnalysisService';
import { TargetMethodLookup } from '../../../targetMethodLookup';
import { ObjectInferenceService } from '../../../objectInference/ObjectInferenceService';
import type { ScopedMethodResolver } from '../../../objectInference/ScopedMethodResolver';
import type { InferredObjectAccess } from '../../../objectInference/types';
import { MacroManager } from '../../../macroManager';
import type { LpcProjectConfigService } from '../../../projectConfig/LpcProjectConfigService';
import { isOnScopedMethodIdentifier } from './ScopedMethodIdentifierSupport';

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
}

interface MethodDocResult {
    path: string;
    doc: CallableDoc;
    relatedCandidatePaths: string[];
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
    private readonly objectAccessProvider: HoverObjectAccessProvider;
    private readonly methodResolver: HoverMethodResolver;
    private readonly documentationService: FunctionDocumentationService;
    private readonly renderer: CallableDocRenderer;
    private readonly scopedMethodResolver?: ScopedMethodResolver;
    private readonly analysisService?: Pick<DocumentAnalysisService, 'getSyntaxDocument'>;

    public constructor(
        objectInferenceService: ObjectInferenceService,
        macroManager?: MacroManager,
        targetMethodLookup?: TargetMethodLookup,
        projectConfigService?: LpcProjectConfigService,
        dependencies?: HoverServiceDependencies
    ) {
        this.documentAdapter = dependencies?.documentAdapter ?? new VsCodeHoverDocumentAdapter();
        this.objectAccessProvider = dependencies?.objectAccessProvider ?? new VsCodeHoverObjectAccessProvider(objectInferenceService);
        if (dependencies?.methodResolver) {
            this.methodResolver = dependencies.methodResolver;
        } else {
            const resolvedTargetMethodLookup = targetMethodLookup
                ?? new TargetMethodLookup(
                    macroManager,
                    projectConfigService,
                    assertAnalysisService('ObjectInferenceLanguageHoverService', dependencies?.analysisService)
                );
            this.methodResolver = new VsCodeHoverMethodResolver(resolvedTargetMethodLookup);
        }
        this.documentationService = dependencies?.documentationService ?? new FunctionDocumentationService();
        this.renderer = dependencies?.renderer ?? new CallableDocRenderer();
        this.scopedMethodResolver = dependencies?.scopedMethodResolver;
        this.analysisService = dependencies?.analysisService;
    }

    public async provideHover(request: LanguageHoverRequest): Promise<LanguageHoverResult | undefined> {
        const document = this.documentAdapter.fromLanguageDocument(request.context.document);
        const scopedResolution = await this.scopedMethodResolver?.resolveCallAt(
            ensureVsCodeBackedDocument(document),
            toVsCodePosition(request.position)
        );
        const scopedAnalysisService = scopedResolution
            ? assertAnalysisService('ObjectInferenceLanguageHoverService', this.analysisService)
            : undefined;
        if (
            scopedResolution
            && scopedAnalysisService
            && isOnScopedMethodIdentifier(
                ensureVsCodeBackedDocument(document),
                toVsCodePosition(request.position),
                scopedResolution.methodName,
                scopedAnalysisService
            )
        ) {
            if (scopedResolution.status === 'unknown' || scopedResolution.status === 'unsupported') {
                return undefined;
            }

            const renderedDocs = scopedResolution.targets
                .map((target) => this.loadScopedMethodDoc(target.document, target.declarationRange))
                .filter((doc): doc is CallableDoc => Boolean(doc))
                .map((doc) => this.renderer.renderHover(doc));

            return renderedDocs.length > 0
                ? this.createMarkdownHover(renderedDocs.join('\n\n---\n\n'))
                : undefined;
        }

        const objectAccess = await this.objectAccessProvider.inferObjectAccess(request.context, document, request.position);
        if (!objectAccess) {
            return undefined;
        }

        const { inference, memberName } = objectAccess;
        if (inference.status === 'unknown' || inference.status === 'unsupported') {
            return undefined;
        }

        if (!this.isHoveringMemberName(document, request.position, memberName)) {
            return undefined;
        }

        const resolvedDocs = await this.loadMethodDocsFromCandidates(
            request.context,
            document,
            inference.candidates.map((candidate) => candidate.path),
            memberName
        );
        if (resolvedDocs.length === 1 && resolvedDocs[0].relatedCandidatePaths.length === 1) {
            return this.createMarkdownHover(this.renderMethodHover(resolvedDocs[0].doc));
        }

        if (resolvedDocs.length > 0) {
            return this.createMarkdownHover(this.renderResolvedCandidatesHover(resolvedDocs));
        }

        if (inference.candidates.length > 1 || inference.status === 'multiple') {
            return this.createMarkdownHover(
                this.renderMultipleCandidatesHover(memberName, inference.candidates.map((candidate) => candidate.path))
            );
        }

        return undefined;
    }

    private createMarkdownHover(value: string, range?: LanguageRange): LanguageHoverResult {
        return {
            contents: [
                {
                    kind: 'markdown',
                    value
                }
            ],
            range
        };
    }

    private isHoveringMemberName(
        document: HoverDocument,
        position: LanguagePosition,
        memberName: string
    ): boolean {
        const wordRange = document.getWordRangeAtPosition(position);
        return Boolean(wordRange) && document.getText(wordRange) === memberName;
    }

    private async loadMethodDocsFromCandidates(
        context: LanguageCapabilityContext,
        document: HoverDocument,
        candidatePaths: string[],
        memberName: string
    ): Promise<MethodDocResult[]> {
        const docsByImplementationPath = new Map<string, MethodDocResult>();

        for (const candidatePath of candidatePaths) {
            const resolvedMethod = await this.methodResolver.findMethod(context, document, candidatePath, memberName);
            if (!resolvedMethod) {
                continue;
            }

            const resolvedDocument = toDocumentationTextDocument(resolvedMethod);
            const methodDoc = this.documentationService
                .getDocsByName(resolvedDocument, memberName)[0];
            if (!methodDoc) {
                continue;
            }

            const existing = docsByImplementationPath.get(resolvedMethod.path);
            if (existing) {
                if (!existing.relatedCandidatePaths.includes(candidatePath)) {
                    existing.relatedCandidatePaths.push(candidatePath);
                }
                continue;
            }

            docsByImplementationPath.set(resolvedMethod.path, {
                path: resolvedMethod.path,
                doc: {
                    ...methodDoc,
                    sourceKind: 'objectMethod',
                    sourcePath: resolvedMethod.path
                },
                relatedCandidatePaths: [candidatePath]
            });
        }

        return [...docsByImplementationPath.values()];
    }

    private renderMethodHover(doc: CallableDoc): string {
        return this.renderer.renderHover(doc);
    }

    private renderResolvedCandidatesHover(docs: MethodDocResult[]): string {
        return docs.map((doc) => {
            const parts = [this.renderer.renderHover(doc.doc, { sourceLabel: doc.path })];

            const alternateCandidates = doc.relatedCandidatePaths.filter((candidatePath) => candidatePath !== doc.path);
            if (alternateCandidates.length > 0) {
                parts.push(
                    `部分分支继续沿用该实现：${alternateCandidates.map((candidatePath) => `\`${candidatePath}\``).join('、')}`
                );
            }

            return parts.join('\n\n');
        }).join('\n\n---\n\n');
    }

    private renderMultipleCandidatesHover(memberName: string, paths: string[]): string {
        const summary = paths.length > 0
            ? paths.map((filePath) => `\`${filePath}\``).join('、')
            : '多个对象';
        return `可能来自多个对象的 \`${memberName}\`() 实现：${summary}`;
    }

    private loadScopedMethodDoc(
        document: vscode.TextDocument,
        declarationRange: vscode.Range
    ): CallableDoc | undefined {
        const declarationKey = buildDeclarationKey(document.uri.toString(), fromVsCodeRange(declarationRange));
        const callableDoc = this.documentationService.getDocForDeclaration(document, declarationKey);
        return callableDoc
            ? {
                ...callableDoc,
                sourceKind: 'scopedMethod'
            }
            : undefined;
    }
}

function buildDeclarationKey(uri: string, range: LanguageRange): string {
    return `${uri}#${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`;
}

function toDocumentationTextDocument(resolvedMethod: HoverResolvedMethod): vscode.TextDocument {
    const candidate = resolvedMethod.document as Partial<vscode.TextDocument> | undefined;
    if (isCompleteTextDocument(candidate)) {
        return candidate;
    }

    return createCompletedTextDocumentShim(
        resolvedMethod.path,
        resolvedMethod.documentText,
        candidate
    );
}

function isCompleteTextDocument(document: Partial<vscode.TextDocument> | undefined): document is vscode.TextDocument {
    return Boolean(
        document
        && typeof document.getText === 'function'
        && typeof document.fileName === 'string'
        && typeof document.version === 'number'
        && document.uri
        && typeof document.uri.toString === 'function'
    );
}

function createCompletedTextDocumentShim(
    filePath: string,
    fallbackContent: string,
    baseDocument?: Partial<vscode.TextDocument>
): vscode.TextDocument {
    const rawContent = typeof baseDocument?.getText === 'function'
        ? baseDocument.getText()
        : fallbackContent;
    const normalized = rawContent.replace(/\r\n/g, '\n');
    const lineStarts = [0];
    const lines = normalized.split('\n');
    const hash = createSyntheticDocumentHash(normalized);
    const uri = createSyntheticDocumentationUri(filePath, hash);

    for (let index = 0; index < normalized.length; index += 1) {
        if (normalized[index] === '\n') {
            lineStarts.push(index + 1);
        }
    }

    const offsetAt = (position: vscode.Position): number => {
        const lineStart = lineStarts[position.line] ?? normalized.length;
        return Math.min(lineStart + position.character, normalized.length);
    };

    const positionAt = (offset: number): vscode.Position => {
        let line = 0;
        for (let index = 0; index < lineStarts.length; index += 1) {
            if (lineStarts[index] <= offset) {
                line = index;
            } else {
                break;
            }
        }

        return new vscode.Position(line, offset - lineStarts[line]);
    };

    return {
        uri,
        fileName: filePath,
        languageId: baseDocument?.languageId ?? 'lpc',
        version: typeof baseDocument?.version === 'number' ? baseDocument.version : hash,
        lineCount: lineStarts.length,
        isDirty: false,
        isClosed: false,
        isUntitled: false,
        eol: vscode.EndOfLine.LF,
        getText: (range?: vscode.Range) => {
            if (!range) {
                return normalized;
            }

            return normalized.slice(offsetAt(range.start), offsetAt(range.end));
        },
        lineAt: (line: number) => ({
            text: lines[line] ?? ''
        }),
        positionAt,
        offsetAt,
        save: async () => true,
        validateRange: (range: vscode.Range) => range,
        validatePosition: (position: vscode.Position) => position
    } as unknown as vscode.TextDocument;
}

function createSyntheticDocumentHash(content: string): number {
    let hash = 0;
    for (let index = 0; index < content.length; index += 1) {
        hash = ((hash * 31) + content.charCodeAt(index)) >>> 0;
    }

    return hash;
}

function createSyntheticDocumentationUri(filePath: string, hash: number): vscode.Uri {
    return {
        fsPath: filePath,
        toString: () => `lpc-hover-synthetic://${encodeURIComponent(filePath)}?v=${hash}`
    } as unknown as vscode.Uri;
}
