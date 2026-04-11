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
import { parseFunctionDocs } from '../../../efun/docParser';
import { TargetMethodLookup } from '../../../targetMethodLookup';
import { ObjectInferenceService } from '../../../objectInference/ObjectInferenceService';
import type { InferredObjectAccess } from '../../../objectInference/types';
import { MacroManager } from '../../../macroManager';
import type { LpcProjectConfigService } from '../../../projectConfig/LpcProjectConfigService';

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
    documentAdapter?: HoverDocumentAdapter;
    objectAccessProvider?: HoverObjectAccessProvider;
    methodResolver?: HoverMethodResolver;
}

interface MethodDocResult {
    path: string;
    syntax: string;
    description: string;
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
            documentText: resolvedMethod.document.getText()
        };
    }
}

export class ObjectInferenceLanguageHoverService implements LanguageHoverService {
    private readonly documentAdapter: HoverDocumentAdapter;
    private readonly objectAccessProvider: HoverObjectAccessProvider;
    private readonly methodResolver: HoverMethodResolver;

    public constructor(
        objectInferenceService: ObjectInferenceService,
        macroManager?: MacroManager,
        targetMethodLookup?: TargetMethodLookup,
        projectConfigService?: LpcProjectConfigService,
        dependencies?: HoverServiceDependencies
    ) {
        const effectiveLookup = targetMethodLookup ?? new TargetMethodLookup(macroManager, projectConfigService);
        this.documentAdapter = dependencies?.documentAdapter ?? new VsCodeHoverDocumentAdapter();
        this.objectAccessProvider = dependencies?.objectAccessProvider ?? new VsCodeHoverObjectAccessProvider(objectInferenceService);
        this.methodResolver = dependencies?.methodResolver ?? new VsCodeHoverMethodResolver(effectiveLookup);
    }

    public async provideHover(request: LanguageHoverRequest): Promise<LanguageHoverResult | undefined> {
        const document = this.documentAdapter.fromLanguageDocument(request.context.document);
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
            return this.createMarkdownHover(this.renderMethodHover(resolvedDocs[0].syntax, resolvedDocs[0].description));
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

            const methodDoc = parseFunctionDocs(resolvedMethod.documentText, '对象方法').get(memberName);
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
                syntax: methodDoc.syntax,
                description: methodDoc.description,
                relatedCandidatePaths: [candidatePath]
            });
        }

        return [...docsByImplementationPath.values()];
    }

    private renderMethodHover(syntax: string, description: string): string {
        return description
            ? `\`\`\`lpc\n${syntax}\n\`\`\`\n\n${description}`
            : `\`\`\`lpc\n${syntax}\n\`\`\``;
    }

    private renderResolvedCandidatesHover(docs: MethodDocResult[]): string {
        return docs.map((doc) => {
            const parts = [
                `实现：\`${doc.path}\``,
                `\`\`\`lpc\n${doc.syntax}\n\`\`\``
            ];

            if (doc.description) {
                parts.push(doc.description);
            }

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
}
