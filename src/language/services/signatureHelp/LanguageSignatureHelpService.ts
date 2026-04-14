import * as vscode from 'vscode';
import type { LanguageCapabilityContext } from '../../contracts/LanguageCapabilityContext';
import type { LanguagePosition, LanguageRange } from '../../contracts/LanguagePosition';
import { CallableDocRenderer } from '../../documentation/CallableDocRenderer';
import { FunctionDocumentationService } from '../../documentation/FunctionDocumentationService';
import type { CallableDoc, CallableParameter } from '../../documentation/types';
import type { EfunDoc } from '../../../efun/types';
import type { EfunDocsManager } from '../../../efun/EfunDocsManager';
import { ASTManager } from '../../../ast/astManager';
import { SyntaxKind, type SyntaxNode } from '../../../syntax/types';
import type { InferredObjectAccess } from '../../../objectInference/types';
import type { ObjectInferenceService } from '../../../objectInference/ObjectInferenceService';
import type { TargetMethodLookup } from '../../../targetMethodLookup';

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
    callKind: 'function' | 'objectMethod';
    calleeLookupPosition?: vscode.Position;
}

export interface ResolvedCallableTarget {
    kind: 'local' | 'inherit' | 'include' | 'simulEfun' | 'efun' | 'objectMethod';
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
    discoverEfunTargets(request: CallableDiscoveryRequest): Promise<ResolvedCallableTarget[]>;
}

export interface CallableDocResolver {
    resolveFromTarget(target: ResolvedCallableTarget): Promise<CallableDoc | undefined>;
}

interface CallSiteAnalyzer {
    analyze(document: vscode.TextDocument, position: vscode.Position): AnalyzedCallSite | undefined;
}

interface SignatureHelpDocumentHost {
    openTextDocument(target: string | vscode.Uri): Promise<vscode.TextDocument>;
}

interface LanguageSignatureHelpDependencies {
    discoveryService?: CallableTargetDiscoveryService;
    docResolver?: CallableDocResolver;
    renderer?: CallableDocRenderer;
    callSiteAnalyzer?: CallSiteAnalyzer;
    documentationService?: FunctionDocumentationService;
    efunDocsManager?: EfunDocsManager;
    objectInferenceService?: ObjectInferenceService;
    targetMethodLookup?: TargetMethodLookup;
    host?: SignatureHelpDocumentHost;
}

interface DedupedCallableTarget extends ResolvedCallableTarget {
    additionalSourceLabels: string[];
}

interface MergedCallableDocGroup {
    doc: CallableDoc;
    sourceLabel: string;
    additionalSourceLabels: string[];
}

interface AnalyzedCallSite extends CallableDiscoveryRequest {
    parsed: ReturnType<typeof getParsedDocument>;
    callExpression: SyntaxNode;
    callee: SyntaxNode;
    argumentList?: SyntaxNode;
    closeParenTokenIndex: number;
}

const defaultHost: SignatureHelpDocumentHost = {
    openTextDocument: async (target) => typeof target === 'string'
        ? vscode.workspace.openTextDocument(target)
        : vscode.workspace.openTextDocument(target)
};

export class LanguageSignatureHelpService {
    private readonly renderer: CallableDocRenderer;
    private readonly callSiteAnalyzer: CallSiteAnalyzer;
    private readonly discoveryService: CallableTargetDiscoveryService;
    private readonly docResolver: CallableDocResolver;

    public constructor(dependencies: LanguageSignatureHelpDependencies = {}) {
        const documentationService = dependencies.documentationService ?? new FunctionDocumentationService();
        const host = dependencies.host ?? defaultHost;

        this.renderer = dependencies.renderer ?? new CallableDocRenderer();
        this.callSiteAnalyzer = dependencies.callSiteAnalyzer ?? new SyntaxAwareCallSiteAnalyzer();
        this.discoveryService = dependencies.discoveryService
            ?? new DefaultCallableTargetDiscoveryService(
                dependencies.efunDocsManager,
                dependencies.objectInferenceService,
                dependencies.targetMethodLookup
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
                .filter((candidate): candidate is { target: DedupedCallableTarget; doc: CallableDoc } => Boolean(candidate.doc))
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

class SyntaxAwareCallSiteAnalyzer implements CallSiteAnalyzer {
    private readonly astManager = ASTManager.getInstance();

    public analyze(document: vscode.TextDocument, position: vscode.Position): AnalyzedCallSite | undefined {
        const syntax = this.astManager.getSyntaxDocument(document, false)
            ?? this.astManager.getSyntaxDocument(document, true);
        if (!syntax) {
            return undefined;
        }
        const parsed = getParsedDocument(syntax);

        const candidates = [...syntax.nodes]
            .filter((node) => node.kind === SyntaxKind.CallExpression && node.range.contains(position))
            .sort((left, right) => compareRangeSize(left.range, right.range));

        for (const candidate of candidates) {
            const callee = candidate.children[0];
            const argumentList = candidate.children.find((child) => child.kind === SyntaxKind.ArgumentList);
            const calleeInfo = getCalleeInfo(callee);
            if (!callee || !calleeInfo) {
                continue;
            }

            const callBounds = getCallBoundaryTokens(parsed, candidate, callee);
            if (!callBounds || !isPositionInsideCallArguments(document, position, callBounds)) {
                continue;
            }

            return {
                document,
                position,
                callExpressionRange: candidate.range,
                calleeName: calleeInfo.name,
                callKind: calleeInfo.callKind,
                calleeLookupPosition: getCalleeLookupPosition(callee),
                parsed,
                callExpression: candidate,
                callee,
                argumentList,
                closeParenTokenIndex: callBounds.closeParen.tokenIndex
            };
        }

        return undefined;
    }
}

class DefaultCallableTargetDiscoveryService implements CallableTargetDiscoveryService {
    public constructor(
        private readonly efunDocsManager?: EfunDocsManager,
        private readonly objectInferenceService?: ObjectInferenceService,
        private readonly targetMethodLookup?: TargetMethodLookup
    ) {}

    public async discoverLocalOrInheritedTargets(
        request: CallableDiscoveryRequest
    ): Promise<ResolvedCallableTarget[]> {
        if (request.callKind === 'objectMethod' || !this.efunDocsManager) {
            return [];
        }

        const targets: ResolvedCallableTarget[] = [];
        const currentFileDoc = await this.efunDocsManager.getCurrentFileDocForDocument(request.document, request.calleeName);
        const inheritedDoc = await this.efunDocsManager.getInheritedFileDocForDocument(
            request.document,
            request.calleeName,
            { forceFresh: true }
        );

        const localTarget = toSourceBackedTarget(currentFileDoc, request.calleeName, 'local', 'current-file', 1);
        if (localTarget) {
            targets.push(localTarget);
        }

        const inheritedTarget = toSourceBackedTarget(inheritedDoc, request.calleeName, 'inherit', 'inherited', 2);
        if (inheritedTarget) {
            targets.push(inheritedTarget);
        }

        return targets;
    }

    public async discoverIncludeTargets(
        request: CallableDiscoveryRequest
    ): Promise<ResolvedCallableTarget[]> {
        if (request.callKind === 'objectMethod' || !this.efunDocsManager) {
            return [];
        }

        const includeDoc = await this.efunDocsManager.getIncludedFileDoc(
            request.document,
            request.calleeName,
            { forceFresh: true }
        );
        const target = toSourceBackedTarget(includeDoc, request.calleeName, 'include', 'include', 3);
        return target ? [target] : [];
    }

    public async discoverObjectMethodTargets(
        request: CallableDiscoveryRequest
    ): Promise<ResolvedCallableTarget[]> {
        if (
            request.callKind !== 'objectMethod'
            || !this.objectInferenceService
            || !this.targetMethodLookup
        ) {
            return [];
        }

        const inferredAccess = await this.objectInferenceService.inferObjectAccess(
            request.document,
            request.calleeLookupPosition ?? request.callExpressionRange.start
        );
        if (!isResolvedObjectAccess(inferredAccess, request.calleeName)) {
            return [];
        }

        const targets: ResolvedCallableTarget[] = [];
        for (const candidate of inferredAccess.inference.candidates) {
            const resolvedMethod = await this.targetMethodLookup.findMethod(
                request.document,
                candidate.path,
                request.calleeName,
                { useFreshSnapshots: true }
            );
            if (!resolvedMethod) {
                continue;
            }
            const declarationKey = buildDeclarationKey(
                resolvedMethod.document.uri.toString(),
                fromVsCodeRange(resolvedMethod.declarationRange)
            );

            targets.push({
                kind: 'objectMethod',
                name: request.calleeName,
                targetKey: declarationKey,
                documentUri: resolvedMethod.document.uri.toString(),
                declarationKey,
                sourceLabel: 'object-method',
                priority: 4
            });
        }

        return targets;
    }

    public async discoverEfunTargets(
        request: CallableDiscoveryRequest
    ): Promise<ResolvedCallableTarget[]> {
        if (request.callKind === 'objectMethod' || !this.efunDocsManager) {
            return [];
        }

        const targets: ResolvedCallableTarget[] = [];
        const simulatedDoc = this.efunDocsManager.getSimulatedDoc(request.calleeName);
        const simulatedTarget = toSourceBackedTarget(simulatedDoc, request.calleeName, 'simulEfun', 'simul_efun', 5)
            ?? (simulatedDoc
                ? {
                    kind: 'simulEfun' as const,
                    name: request.calleeName,
                    targetKey: `simulEfun:${request.calleeName}`,
                    sourceLabel: 'simul_efun',
                    priority: 5
                }
                : undefined);
        if (simulatedTarget) {
            targets.push(simulatedTarget);
        }

        const standardDoc = this.efunDocsManager.getStandardCallableDoc(request.calleeName);
        if (standardDoc) {
            targets.push({
                kind: 'efun',
                name: request.calleeName,
                targetKey: `efun:${request.calleeName}`,
                sourceLabel: 'efun',
                priority: 6
            });
        }

        return targets;
    }
}

class DefaultCallableDocResolver implements CallableDocResolver {
    public constructor(
        private readonly documentationService: FunctionDocumentationService,
        private readonly efunDocsManager: EfunDocsManager | undefined,
        private readonly host: SignatureHelpDocumentHost
    ) {}

    public async resolveFromTarget(target: ResolvedCallableTarget): Promise<CallableDoc | undefined> {
        if (target.kind === 'efun') {
            return this.efunDocsManager?.getStandardCallableDoc(target.name);
        }

        if (target.kind === 'simulEfun' && (!target.documentUri || !target.declarationKey)) {
            const simulatedDoc = this.efunDocsManager?.getSimulatedDoc(target.name);
            return simulatedDoc ? materializeCompatCallableDoc(simulatedDoc, 'simulEfun') : undefined;
        }

        if (!target.documentUri || !target.declarationKey) {
            return undefined;
        }

        const document = await this.host.openTextDocument(vscode.Uri.parse(target.documentUri));
        this.documentationService.invalidate(target.documentUri);
        const callableDoc = this.documentationService.getDocForDeclaration(document, target.declarationKey);
        return callableDoc
            ? {
                ...callableDoc,
                sourceKind: target.kind
            }
            : undefined;
    }
}

function toSourceBackedTarget(
    doc: EfunDoc | undefined,
    name: string,
    kind: ResolvedCallableTarget['kind'],
    sourceLabel: string,
    priority: number
): ResolvedCallableTarget | undefined {
    if (!doc?.sourceFile || !doc.sourceRange) {
        return undefined;
    }

    const documentUri = vscode.Uri.file(doc.sourceFile).toString();
    const declarationKey = buildDeclarationKey(documentUri, doc.sourceRange);

    return {
        kind,
        name,
        targetKey: declarationKey,
        documentUri,
        declarationKey,
        sourceLabel,
        priority
    };
}

function materializeCompatCallableDoc(doc: EfunDoc, sourceKind: CallableDoc['sourceKind']): CallableDoc {
    const signatures = doc.signatures?.length
        ? doc.signatures.map((signature) => ({
            label: signature.label,
            returnType: signature.returnType,
            parameters: signature.parameters.map((parameter) => ({
                name: parameter.name,
                type: parameter.type,
                description: parameter.description,
                optional: parameter.optional,
                variadic: parameter.variadic
            })),
            isVariadic: signature.isVariadic,
            rawSyntax: signature.label
        }))
        : [{
            label: doc.syntax || `${doc.name}()`,
            returnType: doc.returnType,
            parameters: [],
            isVariadic: false,
            rawSyntax: doc.syntax || `${doc.name}()`
        }];

    return {
        name: doc.name,
        declarationKey: `${sourceKind}:${doc.name}`,
        signatures,
        summary: doc.description || undefined,
        details: doc.details,
        note: doc.note,
        returns: doc.returnValue
            ? {
                type: doc.returnType,
                description: doc.returnValue
            }
            : undefined,
        returnObjects: doc.returnObjects ? [...doc.returnObjects] : undefined,
        sourceKind,
        sourcePath: doc.sourceFile,
        sourceRange: doc.sourceRange
    };
}

function dedupeTargets(targets: ResolvedCallableTarget[]): DedupedCallableTarget[] {
    const deduped = new Map<string, DedupedCallableTarget>();

    for (const target of targets) {
        const existing = deduped.get(target.targetKey);
        if (!existing) {
            deduped.set(target.targetKey, {
                ...target,
                additionalSourceLabels: []
            });
            continue;
        }

        if (compareTargetOrder(target, existing) < 0) {
            const replacement: DedupedCallableTarget = {
                ...target,
                additionalSourceLabels: mergeSourceLabels(
                    [existing.sourceLabel, ...existing.additionalSourceLabels],
                    []
                )
            };
            deduped.set(target.targetKey, replacement);
            continue;
        }

        existing.additionalSourceLabels = mergeSourceLabels(existing.additionalSourceLabels, [target.sourceLabel]);
    }

    return [...deduped.values()].sort(compareTargetOrder);
}

function mergeCallableDocGroups(
    candidates: Array<{
        target: DedupedCallableTarget;
        doc: CallableDoc;
    }>
): MergedCallableDocGroup[] {
    const groups: MergedCallableDocGroup[] = [];

    for (const candidate of candidates) {
        const existing = groups.find((group) => areSameSignatureGroup(group.doc, candidate.doc));
        if (existing) {
            existing.additionalSourceLabels = mergeSourceLabels(
                existing.additionalSourceLabels,
                [candidate.target.sourceLabel, ...candidate.target.additionalSourceLabels]
            );
            continue;
        }

        groups.push({
            doc: candidate.doc,
            sourceLabel: candidate.target.sourceLabel,
            additionalSourceLabels: [...candidate.target.additionalSourceLabels]
        });
    }

    return groups;
}

function flattenMergedGroups(
    groups: MergedCallableDocGroup[],
    renderer: CallableDocRenderer,
    activeParameter: number
): LanguageSignatureHelpResult['signatures'] {
    return groups.flatMap((group) => group.doc.signatures.map((signature, signatureIndex) => {
        const summary = renderer.renderSignatureSummary(group.doc, signatureIndex, activeParameter);
        const documentation = buildSignatureDocumentation(
            summary.documentation,
            group.sourceLabel,
            group.additionalSourceLabels
        );

        return {
            label: summary.label,
            documentation,
            sourceLabel: group.sourceLabel,
            additionalSourceLabels: group.additionalSourceLabels.length > 0
                ? [...group.additionalSourceLabels]
                : undefined,
            parameters: signature.parameters.map((parameter, parameterIndex) => ({
                label: formatParameterLabel(parameter),
                documentation: summary.parameterDocs[parameterIndex]
            }))
        };
    }));
}

function buildSignatureDocumentation(
    documentation: string | undefined,
    sourceLabel: string,
    additionalSourceLabels: string[]
): string {
    const parts = [`Source: ${sourceLabel}`];

    if (additionalSourceLabels.length > 0) {
        parts.push(`Also from: ${additionalSourceLabels.join(', ')}`);
    }

    if (documentation) {
        parts.push(documentation);
    }

    return parts.join('\n\n');
}

function selectActiveSignature(doc: CallableDoc, activeParameter: number): number {
    const exactParameterCount = activeParameter + 1;
    const exactMatchIndex = doc.signatures.findIndex((signature) => signature.parameters.length === exactParameterCount);
    if (exactMatchIndex >= 0) {
        return exactMatchIndex;
    }

    const variadicMatchIndex = doc.signatures.findIndex((signature) => canVariadicSignatureAcceptIndex(signature.parameters.length, signature, activeParameter));
    if (variadicMatchIndex >= 0) {
        return variadicMatchIndex;
    }

    return 0;
}

function canVariadicSignatureAcceptIndex(
    parameterCount: number,
    docSignature: CallableDoc['signatures'][number],
    activeParameter: number
): boolean {
    return docSignature.isVariadic
        && parameterCount > 0
        && activeParameter >= parameterCount - 1;
}

function areSameSignatureGroup(left: CallableDoc, right: CallableDoc): boolean {
    if (left.name !== right.name || left.signatures.length !== right.signatures.length) {
        return false;
    }

    return left.signatures.every((signature, index) => signature.label === right.signatures[index]?.label);
}

function mergeSourceLabels(existing: string[], incoming: string[]): string[] {
    const merged = [...existing];

    for (const label of incoming) {
        if (!merged.includes(label)) {
            merged.push(label);
        }
    }

    return merged;
}

function compareTargetOrder(left: ResolvedCallableTarget, right: ResolvedCallableTarget): number {
    if (left.priority !== right.priority) {
        return left.priority - right.priority;
    }

    return left.targetKey.localeCompare(right.targetKey);
}

function formatParameterLabel(parameter: CallableParameter): string {
    return [parameter.type, parameter.name].filter(Boolean).join(' ').trim() || parameter.name;
}

function compareRangeSize(left: vscode.Range, right: vscode.Range): number {
    return toRangeSize(left) - toRangeSize(right);
}

function toRangeSize(range: vscode.Range): number {
    return (range.end.line - range.start.line) * 10_000 + (range.end.character - range.start.character);
}

function getCalleeInfo(
    callee: SyntaxNode | undefined
): { name: string; callKind: 'function' | 'objectMethod' } | undefined {
    if (!callee) {
        return undefined;
    }

    if (callee.kind === SyntaxKind.Identifier && callee.name) {
        return {
            name: callee.name,
            callKind: 'function'
        };
    }

    if (callee.kind === SyntaxKind.MemberAccessExpression && callee.children.length >= 2) {
        const member = callee.children[1];
        if (member.kind !== SyntaxKind.Identifier || !member.name) {
            return undefined;
        }

        return {
            name: member.name,
            callKind: callee.metadata?.operator === '->' ? 'objectMethod' : 'function'
        };
    }

    return undefined;
}

function getCalleeLookupPosition(callee: SyntaxNode | undefined): vscode.Position | undefined {
    if (!callee) {
        return undefined;
    }

    if (callee.kind === SyntaxKind.MemberAccessExpression && callee.children.length >= 2) {
        return callee.children[1].range.start;
    }

    return callee.range.start;
}

function isPositionInsideCallArguments(
    document: vscode.TextDocument,
    position: vscode.Position,
    callBounds: ReturnType<typeof getCallBoundaryTokens>
): boolean {
    if (!callBounds) {
        return false;
    }

    const cursorOffset = document.offsetAt(position);
    return cursorOffset >= callBounds.openParen.stopIndex + 1 && cursorOffset <= callBounds.closeParen.startIndex;
}

function countActiveParameterIndex(
    document: vscode.TextDocument,
    position: vscode.Position,
    analyzedCallSite: AnalyzedCallSite
): number {
    const { argumentList, closeParenTokenIndex, parsed } = analyzedCallSite;
    if (!argumentList || argumentList.children.length === 0) {
        return 0;
    }
    const cursorOffset = document.offsetAt(position);
    const separatorTokens = getTopLevelArgumentSeparators(parsed.visibleTokens, argumentList, closeParenTokenIndex);
    return separatorTokens.filter((token) => token.startIndex < cursorOffset).length;
}

function buildDeclarationKey(uri: string, range: LanguageRange): string {
    return `${uri}#${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`;
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

function getParsedDocument(syntax: NonNullable<ReturnType<ASTManager['getSyntaxDocument']>>) {
    return syntax.parsed;
}

function getCallBoundaryTokens(
    parsed: ReturnType<typeof getParsedDocument>,
    callExpression: SyntaxNode,
    callee: SyntaxNode
): { openParen: ReturnType<typeof getParsedDocument>['visibleTokens'][number]; closeParen: ReturnType<typeof getParsedDocument>['visibleTokens'][number] } | undefined {
    const candidateTokens = parsed.visibleTokens.filter((token) =>
        token.tokenIndex > callee.tokenRange.end
        && token.tokenIndex <= callExpression.tokenRange.end
    );
    const openParen = candidateTokens.find((token) => token.text === '(');
    const closeParen = [...candidateTokens].reverse().find((token) => token.text === ')');

    return openParen && closeParen ? { openParen, closeParen } : undefined;
}

function getTopLevelArgumentSeparators(
    visibleTokens: ReturnType<typeof getParsedDocument>['visibleTokens'],
    argumentList: SyntaxNode,
    closeParenTokenIndex: number
): ReturnType<typeof getParsedDocument>['visibleTokens'] {
    const expressions = [...argumentList.children].sort((left, right) => left.tokenRange.start - right.tokenRange.start);
    const separators: ReturnType<typeof getParsedDocument>['visibleTokens'] = [];

    for (let index = 0; index < expressions.length - 1; index += 1) {
        const separator = findVisibleTokenBetween(
            visibleTokens,
            expressions[index].tokenRange.end,
            expressions[index + 1].tokenRange.start,
            ','
        );
        if (separator) {
            separators.push(separator);
        }
    }

    if (argumentList.metadata?.hasTrailingComma === true) {
        const trailingSeparator = findVisibleTokenBetween(
            visibleTokens,
            expressions[expressions.length - 1].tokenRange.end,
            closeParenTokenIndex,
            ','
        );
        if (trailingSeparator) {
            separators.push(trailingSeparator);
        }
    }

    return separators;
}

function findVisibleTokenBetween(
    visibleTokens: ReturnType<typeof getParsedDocument>['visibleTokens'],
    startTokenIndex: number,
    endTokenIndex: number,
    text: string
) {
    return visibleTokens.find((token) =>
        token.tokenIndex > startTokenIndex
        && token.tokenIndex < endTokenIndex
        && token.text === text
    );
}

function isResolvedObjectAccess(
    inferredAccess: InferredObjectAccess | undefined,
    memberName: string
): inferredAccess is InferredObjectAccess {
    return Boolean(
        inferredAccess
        && inferredAccess.memberName === memberName
        && inferredAccess.inference.status !== 'unknown'
        && inferredAccess.inference.status !== 'unsupported'
    );
}
