import * as vscode from 'vscode';
import type { LanguageCapabilityContext } from '../../contracts/LanguageCapabilityContext';
import type { LanguagePosition } from '../../contracts/LanguagePosition';
import { CallableDocRenderer } from '../../documentation/CallableDocRenderer';
import { FunctionDocumentationService } from '../../documentation/FunctionDocumentationService';
import type { CallableDoc } from '../../documentation/types';
import type { EfunDocsManager } from '../../../efun/EfunDocsManager';
import type { DocumentAnalysisService } from '../../../semantic/documentAnalysisService';
import type { ObjectInferenceService } from '../../../objectInference/ObjectInferenceService';
import type { ScopedMethodResolver } from '../../../objectInference/ScopedMethodResolver';
import type { TargetMethodLookup } from '../../../targetMethodLookup';
import { defaultTextDocumentHost } from '../../shared/WorkspaceDocumentPathSupport';
import {
    type CallSiteAnalyzer,
    countActiveParameterIndex,
    createSyntaxAwareCallSiteAnalyzer
} from './SyntaxAwareCallSiteAnalyzer';
import { DefaultCallableTargetDiscoveryService } from './DefaultCallableTargetDiscoveryService';
import { DefaultCallableDocResolver } from './DefaultCallableDocResolver';
import {
    dedupeTargets,
    flattenMergedGroups,
    mergeCallableDocGroups,
    selectActiveSignature
} from './SignatureHelpPresentationSupport';

export interface LanguageSignatureHelpRequest {
    context: LanguageCapabilityContext;
    position: LanguagePosition;
}

export interface LanguageSignatureHelpResult {
    signatures: Array<{
        label: string;
        documentation?: string;
        sourceLabel: string;
        additionalSourceLabels?: string[];
        parameters: Array<{
            label: string;
            documentation?: string;
        }>;
    }>;
    activeSignature: number;
    activeParameter: number;
}

export interface CallableDiscoveryRequest {
    document: vscode.TextDocument;
    position: vscode.Position;
    callExpressionRange: vscode.Range;
    calleeName: string;
    callKind: 'function' | 'objectMethod' | 'scopedMethod';
    calleeLookupPosition?: vscode.Position;
}

export interface ResolvedCallableTarget {
    kind: 'local' | 'inherit' | 'include' | 'simulEfun' | 'efun' | 'objectMethod' | 'scopedMethod';
    name: string;
    targetKey: string;
    documentUri?: string;
    declarationKey?: string;
    sourceLabel: string;
    priority: number;
}

export interface CallableTargetDiscoveryService {
    discoverLocalOrInheritedTargets(request: CallableDiscoveryRequest): Promise<ResolvedCallableTarget[]>;
    discoverIncludeTargets(request: CallableDiscoveryRequest): Promise<ResolvedCallableTarget[]>;
    discoverObjectMethodTargets(request: CallableDiscoveryRequest): Promise<ResolvedCallableTarget[]>;
    discoverScopedMethodTargets(request: CallableDiscoveryRequest): Promise<ResolvedCallableTarget[]>;
    discoverEfunTargets(request: CallableDiscoveryRequest): Promise<ResolvedCallableTarget[]>;
}

export interface CallableDocResolver {
    resolveFromTarget(target: ResolvedCallableTarget): Promise<CallableDoc | undefined>;
}

export interface SignatureHelpDocumentHost {
    openTextDocument(target: string | vscode.Uri): Promise<vscode.TextDocument>;
}

interface LanguageSignatureHelpDependencies {
    analysisService?: Pick<DocumentAnalysisService, 'getSyntaxDocument'>;
    discoveryService?: CallableTargetDiscoveryService;
    docResolver?: CallableDocResolver;
    renderer?: CallableDocRenderer;
    callSiteAnalyzer?: CallSiteAnalyzer;
    documentationService?: FunctionDocumentationService;
    efunDocsManager?: EfunDocsManager;
    objectInferenceService?: ObjectInferenceService;
    scopedMethodResolver?: ScopedMethodResolver;
    targetMethodLookup?: TargetMethodLookup;
    host?: SignatureHelpDocumentHost;
}

const defaultHost: SignatureHelpDocumentHost = defaultTextDocumentHost;

export class LanguageSignatureHelpService {
    private readonly renderer: CallableDocRenderer;
    private readonly callSiteAnalyzer: CallSiteAnalyzer;
    private readonly discoveryService: CallableTargetDiscoveryService;
    private readonly docResolver: CallableDocResolver;

    public constructor(dependencies: LanguageSignatureHelpDependencies = {}) {
        const documentationService = dependencies.documentationService ?? new FunctionDocumentationService();
        const host = dependencies.host ?? defaultHost;
        this.renderer = dependencies.renderer ?? new CallableDocRenderer();
        this.callSiteAnalyzer = dependencies.callSiteAnalyzer
            ?? createSyntaxAwareCallSiteAnalyzer(dependencies.analysisService);
        this.discoveryService = dependencies.discoveryService
            ?? new DefaultCallableTargetDiscoveryService(
                dependencies.efunDocsManager,
                dependencies.objectInferenceService,
                dependencies.targetMethodLookup,
                dependencies.scopedMethodResolver
            );
        this.docResolver = dependencies.docResolver
            ?? new DefaultCallableDocResolver(documentationService, dependencies.efunDocsManager, host);
    }

    public async provideSignatureHelp(
        request: LanguageSignatureHelpRequest
    ): Promise<LanguageSignatureHelpResult | undefined> {
        const document = request.context.document as unknown as vscode.TextDocument;
        const position = new vscode.Position(request.position.line, request.position.character);
        const analyzedCallSite = this.callSiteAnalyzer.analyze(document, position);
        if (!analyzedCallSite) {
            return undefined;
        }

        const rawTargets = await this.collectTargets(analyzedCallSite);
        if (rawTargets.length === 0) {
            return undefined;
        }

        const dedupedTargets = dedupeTargets(rawTargets);
        const materializedDocs = await Promise.all(
            dedupedTargets.map(async (target) => ({
                target,
                doc: await this.docResolver.resolveFromTarget(target)
            }))
        );
        const groups = mergeCallableDocGroups(
            materializedDocs
                .filter((candidate): candidate is { target: typeof dedupedTargets[number]; doc: CallableDoc } => Boolean(candidate.doc))
                .map((candidate) => ({
                    target: candidate.target,
                    doc: candidate.doc
                }))
        );
        if (groups.length === 0) {
            return undefined;
        }

        const activeParameter = Math.max(0, countActiveParameterIndex(document, position, analyzedCallSite));
        const activeSignature = selectActiveSignature(groups[0].doc, activeParameter);
        const signatures = flattenMergedGroups(groups, this.renderer, activeParameter);

        return {
            signatures,
            activeSignature,
            activeParameter
        };
    }

    private async collectTargets(request: CallableDiscoveryRequest): Promise<ResolvedCallableTarget[]> {
        if (request.callKind === 'scopedMethod') {
            return this.discoveryService.discoverScopedMethodTargets(request);
        }

        const [
            localOrInheritedTargets,
            includeTargets,
            objectMethodTargets,
            efunTargets
        ] = await Promise.all([
            this.discoveryService.discoverLocalOrInheritedTargets(request),
            this.discoveryService.discoverIncludeTargets(request),
            this.discoveryService.discoverObjectMethodTargets(request),
            this.discoveryService.discoverEfunTargets(request)
        ]);

        return [
            ...localOrInheritedTargets,
            ...includeTargets,
            ...objectMethodTargets,
            ...efunTargets
        ];
    }
}
