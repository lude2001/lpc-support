import { CallableDocRenderer } from '../../../documentation/CallableDocRenderer';
import { FunctionDocumentationService } from '../../../documentation/FunctionDocumentationService';
import type { CallableDoc } from '../../../documentation/types';
import type { LanguageCapabilityContext } from '../../../contracts/LanguageCapabilityContext';
import type { LanguagePosition, LanguageRange } from '../../../contracts/LanguagePosition';
import type { LanguageHoverResult } from '../LanguageHoverService';
import type { InferredObjectAccess } from '../../../../objectInference/types';
import { toDocumentationTextDocument, type HoverResolvedMethodDocumentSource } from './HoverDocumentationSupport';

interface HoverDocument {
    uri: string;
    path: string;
    version: number;
    getText(range?: LanguageRange): string;
    getWordRangeAtPosition(position: LanguagePosition): LanguageRange | undefined;
}

interface HoverResolvedMethod extends HoverResolvedMethodDocumentSource {
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

interface MethodDocResult {
    path: string;
    doc: CallableDoc;
    relatedCandidatePaths: string[];
}

interface ObjectMethodHoverDependencies {
    objectAccessProvider: HoverObjectAccessProvider;
    methodResolver: HoverMethodResolver;
    documentationService: Pick<FunctionDocumentationService, 'getDocsByName'>;
    renderer?: CallableDocRenderer;
    documentationSupport?: {
        toDocumentationTextDocument: typeof toDocumentationTextDocument;
    };
}

export class ObjectMethodHoverResolver {
    private readonly renderer: CallableDocRenderer;
    private readonly documentationSupport: {
        toDocumentationTextDocument: typeof toDocumentationTextDocument;
    };

    public constructor(private readonly dependencies: ObjectMethodHoverDependencies) {
        this.renderer = dependencies.renderer ?? new CallableDocRenderer();
        this.documentationSupport = dependencies.documentationSupport ?? { toDocumentationTextDocument };
    }

    public async provideObjectHover(
        context: LanguageCapabilityContext,
        document: HoverDocument,
        position: LanguagePosition
    ): Promise<LanguageHoverResult | undefined> {
        const objectAccess = await this.dependencies.objectAccessProvider.inferObjectAccess(context, document, position);
        if (!objectAccess) {
            return undefined;
        }

        const { inference, memberName } = objectAccess;
        if (inference.status === 'unknown' || inference.status === 'unsupported') {
            return undefined;
        }

        if (!this.isHoveringMemberName(document, position, memberName)) {
            return undefined;
        }

        const resolvedDocs = await this.loadMethodDocsFromCandidates(
            context,
            document,
            inference.candidates.map((candidate) => candidate.path),
            memberName
        );
        if (resolvedDocs.length === 1 && resolvedDocs[0].relatedCandidatePaths.length === 1) {
            return this.createMarkdownHover(this.renderer.renderHover(resolvedDocs[0].doc));
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
            contents: [{
                kind: 'markdown',
                value
            }],
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
            const resolvedMethod = await this.dependencies.methodResolver.findMethod(context, document, candidatePath, memberName);
            if (!resolvedMethod) {
                continue;
            }

            const resolvedDocument = this.documentationSupport.toDocumentationTextDocument(resolvedMethod);
            const methodDoc = this.dependencies.documentationService
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
}
