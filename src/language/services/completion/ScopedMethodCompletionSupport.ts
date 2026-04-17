import * as vscode from 'vscode';
import { normalizeLpcType } from '../../../ast/typeNormalization';
import type { CompletionCandidate, ParameterSummary } from '../../../completion/types';
import { CallableDocRenderer } from '../../documentation/CallableDocRenderer';
import { FunctionDocumentationService } from '../../documentation/FunctionDocumentationService';
import type { CallableDoc } from '../../documentation/types';
import type { LanguageMarkupContent } from '../../contracts/LanguageMarkup';
import type { ScopedMethodDiscoveryResult } from '../../../objectInference/ScopedMethodDiscoveryService';
import type { LanguageCompletionItem } from './LanguageCompletionService';

type DeclarationDocProvider = Pick<FunctionDocumentationService, 'getDocForDeclaration'>;
type ScopedDocumentLoader = (uri: string) => Promise<vscode.TextDocument | undefined>;

export interface ScopedDocumentationReference {
    documentUri?: string;
    declarationKey?: string;
}

export interface ScopedMethodCompletionSupportDependencies {
    documentationService?: DeclarationDocProvider;
    documentLoader?: ScopedDocumentLoader;
}

export class ScopedMethodCompletionSupport {
    private readonly documentationService: DeclarationDocProvider;
    private readonly documentLoader: ScopedDocumentLoader;
    private readonly renderer = new CallableDocRenderer();

    constructor(
        documentationServiceOrDependencies?: DeclarationDocProvider | ScopedMethodCompletionSupportDependencies,
        documentLoader?: ScopedDocumentLoader
    ) {
        if (this.isDependencyBag(documentationServiceOrDependencies)) {
            this.documentationService = documentationServiceOrDependencies.documentationService
                ?? new FunctionDocumentationService();
            this.documentLoader = documentationServiceOrDependencies.documentLoader
                ?? createDefaultDocumentLoader();
            return;
        }

        this.documentationService = documentationServiceOrDependencies ?? new FunctionDocumentationService();
        this.documentLoader = documentLoader ?? createDefaultDocumentLoader();
    }

    public buildCandidates(
        discovery: ScopedMethodDiscoveryResult,
        currentDocumentOrUri: vscode.TextDocument | string,
        prefix: string
    ): CompletionCandidate[] {
        if (discovery.status !== 'resolved' && discovery.status !== 'multiple') {
            return [];
        }

        const currentUri = typeof currentDocumentOrUri === 'string'
            ? currentDocumentOrUri
            : currentDocumentOrUri.uri.toString();
        const normalizedPrefix = prefix.toLowerCase();

        const candidatesByLabel = new Map<string, CompletionCandidate>();
        for (const method of discovery.methods) {
            if (normalizedPrefix && !method.name.toLowerCase().startsWith(normalizedPrefix)) {
                continue;
            }

            const candidate: CompletionCandidate = {
                key: `scoped-method:${method.documentUri}:${method.name}:${this.buildDeclarationKey(method.documentUri, method.declarationRange)}`,
                label: method.name,
                kind: vscode.CompletionItemKind.Method,
                detail: `${normalizeLpcType(method.returnType ?? 'mixed')} ${method.name}`.trim(),
                insertText: buildFunctionSnippet(method.name, method.parameters),
                sortGroup: 'inherited',
                metadata: {
                    sourceUri: method.documentUri,
                    sourceType: 'scoped-method',
                    declarationKey: this.buildDeclarationKey(method.documentUri, method.declarationRange),
                    documentationRef: method.name
                }
            };
            const existing = candidatesByLabel.get(candidate.label);
            if (!existing || (candidate.metadata.sourceUri === currentUri && existing.metadata.sourceUri !== currentUri)) {
                candidatesByLabel.set(candidate.label, candidate);
            }
        }

        return Array.from(candidatesByLabel.values())
            .sort((left, right) => {
                const leftIsCurrent = left.metadata.sourceUri === currentUri ? 0 : 1;
                const rightIsCurrent = right.metadata.sourceUri === currentUri ? 0 : 1;
                if (leftIsCurrent !== rightIsCurrent) {
                    return leftIsCurrent - rightIsCurrent;
                }

                return left.label.localeCompare(right.label);
            });
    }

    public async applyScopedDocumentation(
        item: LanguageCompletionItem,
        candidate: CompletionCandidate
    ): Promise<LanguageCompletionItem> {
        const documentation = await this.resolveScopedDocumentation({
            documentUri: candidate.metadata.sourceUri,
            declarationKey: candidate.metadata.declarationKey
        });

        if (documentation) {
            item.documentation = documentation;
        }

        return item;
    }

    public async resolveScopedDocumentation(
        reference: ScopedDocumentationReference
    ): Promise<LanguageMarkupContent | undefined> {
        if (!reference.documentUri || !reference.declarationKey) {
            return undefined;
        }

        const targetDocument = await this.documentLoader(reference.documentUri);
        if (!targetDocument) {
            return undefined;
        }

        const callableDoc = this.documentationService.getDocForDeclaration(targetDocument, reference.declarationKey);
        if (!callableDoc) {
            return undefined;
        }

        return {
            kind: 'markdown',
            value: this.renderer.renderHover(this.materializeScopedCallableDoc(callableDoc))
        };
    }

    private buildDeclarationKey(uri: string, range: vscode.Range): string {
        return `${uri}#${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`;
    }

    private materializeScopedCallableDoc(callableDoc: CallableDoc): CallableDoc {
        const maybeLegacyDoc = callableDoc as CallableDoc & {
            signature?: string;
            documentation?: string;
        };

        return {
            ...callableDoc,
            signatures: callableDoc.signatures?.length
                ? callableDoc.signatures
                : [{
                    label: maybeLegacyDoc.signature ?? callableDoc.name,
                    parameters: [],
                    isVariadic: false
                }],
            summary: callableDoc.summary ?? maybeLegacyDoc.documentation,
            sourceKind: 'scopedMethod'
        };
    }

    private isDependencyBag(
        value: DeclarationDocProvider | ScopedMethodCompletionSupportDependencies | undefined
    ): value is ScopedMethodCompletionSupportDependencies {
        return Boolean(
            value
            && (Object.prototype.hasOwnProperty.call(value, 'documentationService')
                || Object.prototype.hasOwnProperty.call(value, 'documentLoader'))
        );
    }
}

function createDefaultDocumentLoader(): ScopedDocumentLoader {
    return async (uri: string) => {
        try {
            return await vscode.workspace.openTextDocument(vscode.Uri.parse(uri));
        } catch {
            return undefined;
        }
    };
}

function buildFunctionSnippet(name: string, parameters: ParameterSummary[]): string {
    if (parameters.length === 0) {
        return `${name}()`;
    }

    const placeholders = parameters
        .map((parameter, index) => `\${${index + 1}:${parameter.name}}`)
        .join(', ');
    return `${name}(${placeholders})`;
}
