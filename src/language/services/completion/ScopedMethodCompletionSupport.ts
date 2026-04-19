import * as vscode from 'vscode';
import { normalizeLpcType } from '../../../ast/typeNormalization';
import type { CompletionCandidate } from '../../../completion/types';
import { CallableDocRenderer } from '../../documentation/CallableDocRenderer';
import { FunctionDocumentationService } from '../../documentation/FunctionDocumentationService';
import type { CallableDoc } from '../../documentation/types';
import type { LanguageMarkupContent } from '../../contracts/LanguageMarkup';
import type { ScopedMethodDiscoveryResult } from '../../../objectInference/ScopedMethodDiscoveryService';
import type { LanguageCompletionItem } from './LanguageCompletionService';
import { buildFunctionSnippet } from './completionSnippetUtils';

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

    constructor(dependencies: ScopedMethodCompletionSupportDependencies = {}) {
        this.documentationService = dependencies.documentationService ?? new FunctionDocumentationService();
        this.documentLoader = dependencies.documentLoader ?? createDefaultDocumentLoader();
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
        const matchingMethods = discovery.methods.filter((method) => !normalizedPrefix || method.name.toLowerCase().startsWith(normalizedPrefix));
        const labelCounts = new Map<string, number>();
        for (const method of matchingMethods) {
            labelCounts.set(method.name, (labelCounts.get(method.name) ?? 0) + 1);
        }

        const candidatesByLabel = new Map<string, CompletionCandidate>();
        for (const method of matchingMethods) {
            const candidate = (labelCounts.get(method.name) ?? 0) > 1
                ? this.buildAmbiguousCandidate(method)
                : this.buildUniqueCandidate(method);
            const existing = candidatesByLabel.get(candidate.label);
            if (!existing) {
                candidatesByLabel.set(candidate.label, candidate);
                continue;
            }

            if (!candidate.metadata.declarationKey) {
                candidatesByLabel.set(candidate.label, candidate);
                continue;
            }

            if (candidate.metadata.sourceUri === currentUri && existing.metadata.sourceUri !== currentUri) {
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

    private buildUniqueCandidate(method: ScopedMethodDiscoveryResult['methods'][number]): CompletionCandidate {
        return {
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
    }

    private buildAmbiguousCandidate(method: ScopedMethodDiscoveryResult['methods'][number]): CompletionCandidate {
        return {
            key: `scoped-method:multiple:${method.name}`,
            label: method.name,
            kind: vscode.CompletionItemKind.Method,
            detail: `${normalizeLpcType(method.returnType ?? 'mixed')} ${method.name}`.trim(),
            insertText: buildFunctionSnippet(method.name, method.parameters),
            sortGroup: 'inherited',
            metadata: {
                sourceType: 'scoped-method'
            }
        };
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

