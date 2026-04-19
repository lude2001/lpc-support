import * as vscode from 'vscode';
import { normalizeLpcType } from '../../../ast/typeNormalization';
import { ProjectSymbolIndex } from '../../../completion/projectSymbolIndex';
import {
    CompletionCandidate,
    CompletionCandidateSourceType,
    CompletionQueryResult,
    FunctionSummary
} from '../../../completion/types';
import { ObjectInferenceService } from '../../../objectInference/ObjectInferenceService';
import { ScopedMethodDiscoveryService } from '../../../objectInference/ScopedMethodDiscoveryService';
import { ObjectInferenceResult } from '../../../objectInference/types';
import { CompletionInheritedIndexService } from './CompletionInheritedIndexService';
import { ScopedMethodCompletionSupport } from './ScopedMethodCompletionSupport';

export class CompletionCandidateResolver {
    constructor(
        private readonly projectSymbolIndex: ProjectSymbolIndex,
        private readonly objectInferenceService: Pick<ObjectInferenceService, 'inferObjectAccess'>,
        private readonly scopedMethodDiscoveryService: Pick<ScopedMethodDiscoveryService, 'discoverAt'>,
        private readonly scopedCompletionSupport: Pick<ScopedMethodCompletionSupport, 'buildCandidates'>,
        private readonly completionInheritedIndexService: Pick<
            CompletionInheritedIndexService,
            'refreshInheritedIndex' | 'getDocumentForUri'
        >
    ) {}

    public async resolveCompletionCandidates(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: { isCancellationRequested: boolean },
        result: CompletionQueryResult
    ): Promise<CompletionCandidate[]> {
        const baseCandidates = this.appendInheritedFallbackCandidates(document, result);
        if (result.context.kind === 'scoped-member') {
            const discovery = await this.scopedMethodDiscoveryService.discoverAt(document, position);
            if (token.isCancellationRequested) {
                return [];
            }

            return this.scopedCompletionSupport.buildCandidates(
                discovery,
                document,
                result.context.currentWord
            );
        }

        if (result.context.kind !== 'member') {
            return baseCandidates;
        }

        const inferredAccess = await this.objectInferenceService.inferObjectAccess(document, position);
        if (!inferredAccess || token.isCancellationRequested) {
            return baseCandidates;
        }

        const inference = inferredAccess.inference;
        if (inference.status === 'unknown' || inference.status === 'unsupported') {
            return baseCandidates;
        }

        const objectCandidates = await this.buildObjectMemberCandidates(document, result, inference, token);
        if (objectCandidates.length === 0) {
            return baseCandidates;
        }

        if (!result.context.currentWord) {
            return this.mergeCandidatesByLabel(objectCandidates, baseCandidates);
        }

        return objectCandidates;
    }

    private appendInheritedFallbackCandidates(
        document: vscode.TextDocument,
        result: CompletionQueryResult
    ): CompletionCandidate[] {
        if (result.context.kind !== 'identifier' && result.context.kind !== 'type-position') {
            return result.candidates;
        }

        this.completionInheritedIndexService.refreshInheritedIndex(document);

        const inheritedSymbols = this.projectSymbolIndex.getInheritedSymbols(document.uri.toString());
        if (inheritedSymbols.functions.length === 0 && inheritedSymbols.types.length === 0) {
            return result.candidates;
        }

        const normalizedPrefix = result.context.currentWord.toLowerCase();
        const existingLabels = new Set(result.candidates.map(candidate => candidate.label));
        const merged = [...result.candidates];

        for (const func of inheritedSymbols.functions) {
            if (existingLabels.has(func.name)) {
                continue;
            }
            if (normalizedPrefix && !func.name.toLowerCase().startsWith(normalizedPrefix)) {
                continue;
            }

            existingLabels.add(func.name);
            merged.push({
                key: `inherited-function:${func.sourceUri}:${func.name}`,
                label: func.name,
                kind: vscode.CompletionItemKind.Function,
                detail: `${normalizeLpcType(func.returnType)} ${func.name}`,
                sortGroup: 'inherited',
                metadata: {
                    sourceUri: func.sourceUri,
                    sourceType: 'inherited',
                    documentationRef: func.name
                }
            });
        }

        for (const typeDefinition of inheritedSymbols.types) {
            if (existingLabels.has(typeDefinition.name)) {
                continue;
            }
            if (normalizedPrefix && !typeDefinition.name.toLowerCase().startsWith(normalizedPrefix)) {
                continue;
            }

            existingLabels.add(typeDefinition.name);
            merged.push({
                key: `type:${typeDefinition.sourceUri}:${typeDefinition.name}`,
                label: typeDefinition.name,
                kind: typeDefinition.kind === 'class'
                    ? vscode.CompletionItemKind.Class
                    : vscode.CompletionItemKind.Struct,
                detail: `${typeDefinition.kind} ${typeDefinition.name}`,
                sortGroup: 'inherited',
                metadata: {
                    sourceUri: typeDefinition.sourceUri,
                    sourceType: 'inherited'
                }
            });
        }

        return merged;
    }

    private async buildObjectMemberCandidates(
        document: vscode.TextDocument,
        result: CompletionQueryResult,
        inference: ObjectInferenceResult,
        token: { isCancellationRequested: boolean }
    ): Promise<CompletionCandidate[]> {
        const currentUri = document.uri.toString();
        const occurrenceCounts = new Map<string, number>();
        const functionsByLabel = new Map<string, FunctionSummary>();

        for (const candidate of inference.candidates) {
            if (token.isCancellationRequested) {
                return [];
            }

            const functions = await this.collectObjectFunctions(document, candidate.path, new Set<string>());
            const visibleFunctions = new Map<string, FunctionSummary>();

            for (const func of functions) {
                if (!visibleFunctions.has(func.name)) {
                    visibleFunctions.set(func.name, func);
                }
            }

            for (const [label, func] of visibleFunctions.entries()) {
                occurrenceCounts.set(label, (occurrenceCounts.get(label) ?? 0) + 1);
                if (!functionsByLabel.has(label)) {
                    functionsByLabel.set(label, func);
                }
            }
        }

        const normalizedPrefix = result.context.currentWord.toLowerCase();
        return Array.from(functionsByLabel.entries())
            .filter(([, func]) => !normalizedPrefix || func.name.toLowerCase().startsWith(normalizedPrefix))
            .sort((left, right) => {
                const leftCount = occurrenceCounts.get(left[0]) ?? 0;
                const rightCount = occurrenceCounts.get(right[0]) ?? 0;
                if (leftCount !== rightCount) {
                    return rightCount - leftCount;
                }

                return left[1].name.localeCompare(right[1].name);
            })
            .map(([label, func]) => {
                const occurrenceCount = occurrenceCounts.get(label) ?? 0;
                const sourceType: CompletionCandidateSourceType = func.sourceUri === currentUri ? 'local' : 'inherited';
                return {
                    key: `object-member:${occurrenceCount > 1 ? 'shared' : 'specific'}:${label}`,
                    label: func.name,
                    kind: vscode.CompletionItemKind.Method,
                    detail: `${normalizeLpcType(func.returnType)} ${func.name}`,
                    insertText: this.buildFunctionSnippet(func.name, func.parameters.map(parameter => parameter.name)),
                    sortGroup: 'inherited',
                    metadata: {
                        sourceUri: func.sourceUri,
                        sourceType,
                        documentationRef: func.name
                    }
                };
            });
    }

    private async collectObjectFunctions(
        ownerDocument: vscode.TextDocument,
        filePath: string,
        visited: Set<string>
    ): Promise<FunctionSummary[]> {
        const targetUri = vscode.Uri.file(filePath).toString();
        if (visited.has(targetUri)) {
            return [];
        }

        visited.add(targetUri);

        let record = this.projectSymbolIndex.getRecord(targetUri);
        if (!record) {
            const targetDocument = targetUri === ownerDocument.uri.toString()
                ? ownerDocument
                : this.completionInheritedIndexService.getDocumentForUri(targetUri);
            if (!targetDocument) {
                return [];
            }

            this.completionInheritedIndexService.refreshInheritedIndex(targetDocument);
            record = this.projectSymbolIndex.getRecord(targetUri);
            if (!record) {
                return [];
            }
        }

        const functions = [...record.exportedFunctions];
        for (const inheritTarget of this.projectSymbolIndex.getResolvedInheritTargets(targetUri)) {
            if (!inheritTarget.resolvedUri) {
                continue;
            }

            functions.push(
                ...await this.collectObjectFunctions(
                    ownerDocument,
                    vscode.Uri.parse(inheritTarget.resolvedUri).fsPath,
                    visited
                )
            );
        }

        return functions;
    }

    private mergeCandidatesByLabel(
        preferredCandidates: CompletionCandidate[],
        fallbackCandidates: CompletionCandidate[]
    ): CompletionCandidate[] {
        const merged = new Map<string, CompletionCandidate>();

        for (const candidate of preferredCandidates) {
            merged.set(candidate.label, candidate);
        }

        for (const candidate of fallbackCandidates) {
            if (!merged.has(candidate.label)) {
                merged.set(candidate.label, candidate);
            }
        }

        return Array.from(merged.values());
    }

    private buildFunctionSnippet(name: string, parameterNames: string[]): string {
        if (parameterNames.length === 0) {
            return `${name}()`;
        }

        const params = parameterNames
            .map((parameterName, index) => `\${${index + 1}:${parameterName}}`)
            .join(', ');
        return `${name}(${params})`;
    }
}
