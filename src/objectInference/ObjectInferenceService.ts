import * as vscode from 'vscode';
import { InheritanceResolver } from '../completion/inheritanceResolver';
import { MacroManager } from '../macroManager';
import { assertAnalysisService } from '../semantic/assertAnalysisService';
import type { DocumentAnalysisService } from '../semantic/documentAnalysisService';
import { FunctionDocumentationService } from '../language/documentation/FunctionDocumentationService';
import { assertDocumentationService } from '../language/documentation/assertDocumentationService';
import {
    assertDocumentPathSupport,
    assertTextDocumentHost,
    type TextDocumentHost,
    WorkspaceDocumentPathSupport
} from '../language/shared/WorkspaceDocumentPathSupport';
import { SyntaxDocument, SyntaxKind, SyntaxNode } from '../syntax/types';
import {
    SemanticEvaluationService,
    createDefaultSemanticEvaluationService
} from '../semanticEvaluation/SemanticEvaluationService';
import type { SemanticValue } from '../semanticEvaluation/types';
import { TargetMethodLookup } from '../targetMethodLookup';
import { ObjectCandidateResolver } from './ObjectCandidateResolver';
import { GlobalObjectBindingResolver } from './GlobalObjectBindingResolver';
import { InheritedGlobalObjectBindingResolver } from './InheritedGlobalObjectBindingResolver';
import { ObjectMethodReturnResolver } from './ObjectMethodReturnResolver';
import { ReceiverBindingResolver } from './ReceiverBindingResolver';
import { ReceiverClassifier } from './ReceiverClassifier';
import { ReceiverFlowCollector } from './ReceiverFlowCollector';
import { ReceiverFunctionLocator } from './ReceiverFunctionLocator';
import { ReceiverTraceService } from './ReceiverTraceService';
import { ObjectResolutionOutcome, ReturnObjectResolver } from './ReturnObjectResolver';
import { ScopedMethodResolver } from './ScopedMethodResolver';
import { ScopedMethodReturnResolver } from './ScopedMethodReturnResolver';
import { ClassifiedReceiver, InferredObjectAccess, ObjectCandidate } from './types';

export interface ObjectInferenceServiceDependencies {
    analysisService?: Pick<DocumentAnalysisService, 'getSyntaxDocument' | 'getSemanticSnapshot'>;
    pathSupport?: WorkspaceDocumentPathSupport;
    returnObjectResolver: ReturnObjectResolver;
    semanticEvaluationService?: Pick<SemanticEvaluationService, 'evaluateExpressionAtPosition'>;
    traceService: ReceiverTraceService;
    globalBindingResolver: GlobalObjectBindingResolver;
    inheritedGlobalBindingResolver: InheritedGlobalObjectBindingResolver;
}

export interface DefaultObjectInferenceServiceDependencies {
    macroManager?: MacroManager;
    analysisService?: Pick<DocumentAnalysisService, 'getSyntaxDocument' | 'getSemanticSnapshot'>;
    documentationService?: FunctionDocumentationService;
    host?: TextDocumentHost;
    pathSupport?: WorkspaceDocumentPathSupport;
    semanticEvaluationService?: SemanticEvaluationService;
}

export class ObjectInferenceService {
    private readonly analysisService: Pick<DocumentAnalysisService, 'getSyntaxDocument' | 'getSemanticSnapshot'>;
    private readonly classifier = new ReceiverClassifier();
    private readonly candidateResolver = new ObjectCandidateResolver();
    private readonly functionLocator = new ReceiverFunctionLocator();
    private readonly bindingResolver = new ReceiverBindingResolver();
    private readonly flowCollector = new ReceiverFlowCollector(this.bindingResolver);
    private readonly pathSupport: WorkspaceDocumentPathSupport;
    private readonly returnObjectResolver: ReturnObjectResolver;
    private readonly semanticEvaluationService?: Pick<SemanticEvaluationService, 'evaluateExpressionAtPosition'>;
    private readonly traceService: ReceiverTraceService;
    private readonly globalBindingResolver: GlobalObjectBindingResolver;
    private readonly inheritedGlobalBindingResolver: InheritedGlobalObjectBindingResolver;

    constructor(dependencies: ObjectInferenceServiceDependencies) {
        this.analysisService = assertAnalysisService('ObjectInferenceService', dependencies.analysisService);
        this.pathSupport = assertDocumentPathSupport('ObjectInferenceService', dependencies.pathSupport);
        this.returnObjectResolver = dependencies.returnObjectResolver;
        this.semanticEvaluationService = dependencies.semanticEvaluationService;
        this.traceService = dependencies.traceService;
        this.globalBindingResolver = dependencies.globalBindingResolver;
        this.inheritedGlobalBindingResolver = dependencies.inheritedGlobalBindingResolver;
    }

    public async inferObjectAccess(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<InferredObjectAccess | undefined> {
        const syntax = this.analysisService.getSyntaxDocument(document, false)
            ?? this.analysisService.getSyntaxDocument(document, true);
        if (!syntax) {
            return undefined;
        }

        const memberAccess = this.findMemberAccess(syntax, position);
        if (!memberAccess || memberAccess.children.length < 2) {
            return undefined;
        }

        const receiverNode = memberAccess.children[0];
        const memberNode = memberAccess.children[1];
        if (memberNode.kind !== SyntaxKind.Identifier || !memberNode.name) {
            return undefined;
        }

        const classifiedReceiver = this.classifier.classify(receiverNode);
        if (classifiedReceiver.kind === 'index') {
            return {
                receiver: this.getNodeText(document, receiverNode),
                memberName: memberNode.name,
                inference: this.candidateResolver.resolve([], classifiedReceiver.reason)
            };
        }

        const resolution = await this.resolveCandidates(document, syntax, receiverNode, classifiedReceiver);
        const inferenceReason = resolution.reason ?? this.getInferenceReason(classifiedReceiver);

        return {
            receiver: this.getNodeText(document, receiverNode),
            memberName: memberNode.name,
            inference: this.candidateResolver.resolve(
                resolution.candidates,
                inferenceReason,
                resolution.diagnostics
            )
        };
    }

    private findMemberAccess(syntax: SyntaxDocument, position: vscode.Position): SyntaxNode | undefined {
        return [...syntax.nodes]
            .filter((node) => node.kind === SyntaxKind.MemberAccessExpression)
            .filter((node) => this.getMemberAccessOperator(node) === '->')
            .filter((node) => node.range.contains(position))
            .filter((node) => node.children.length >= 2)
            .filter((node) => node.children[1].kind === SyntaxKind.Identifier)
            .sort((left, right) => this.getRangeSize(left.range) - this.getRangeSize(right.range))[0];
    }

    private getMemberAccessOperator(node: SyntaxNode): string | undefined {
        const operator = node.metadata?.operator;
        return typeof operator === 'string' ? operator : undefined;
    }

    private async resolveCandidates(
        document: vscode.TextDocument,
        syntax: SyntaxDocument,
        receiverNode: SyntaxNode,
        receiver: ClassifiedReceiver
    ): Promise<ObjectResolutionOutcome> {
        const semanticOutcome = await this.resolveSemanticReceiverOutcome(document, receiverNode);

        if (receiverNode.kind === SyntaxKind.NewExpression) {
            return this.selectReceiverOutcome(
                await this.returnObjectResolver.resolveExpressionOutcome(document, receiverNode),
                semanticOutcome,
                receiver.kind
            );
        }

        if (
            receiverNode.kind === SyntaxKind.CallExpression
            && receiverNode.children[0]?.kind === SyntaxKind.MemberAccessExpression
            && receiverNode.children[0].metadata?.operator === '->'
        ) {
            const callOutcome = await this.returnObjectResolver.resolveExpressionOutcome(document, receiverNode);
            if (
                callOutcome.candidates.length > 0
                || callOutcome.reason === 'non-static'
                || callOutcome.diagnostics?.length
            ) {
                return this.selectReceiverOutcome(callOutcome, semanticOutcome, receiver.kind);
            }

            const tracedOutcome = await this.traceService.traceExpressionOutcome(document, syntax, receiverNode);
            if (tracedOutcome.candidates.length > 0 || tracedOutcome.reason || tracedOutcome.diagnostics?.length) {
                return this.selectReceiverOutcome(tracedOutcome, semanticOutcome, receiver.kind);
            }

            if (callOutcome.reason) {
                return this.selectReceiverOutcome(callOutcome, semanticOutcome, receiver.kind);
            }

            return this.selectReceiverOutcome(callOutcome, semanticOutcome, receiver.kind);
        }

        if (receiver.kind === 'literal') {
            return this.selectReceiverOutcome({
                candidates: await this.resolvePathCandidate(document, receiver.expression, 'literal')
            }, semanticOutcome, receiver.kind);
        }

        if (receiver.kind === 'macro') {
            return this.selectReceiverOutcome({
                candidates: await this.resolvePathCandidate(document, receiver.expression, 'macro')
            }, semanticOutcome, receiver.kind);
        }

        if (receiver.kind === 'call') {
            const tracedOutcome = await this.traceService.traceExpressionOutcome(document, syntax, receiverNode);
            if (tracedOutcome.candidates.length > 0 || tracedOutcome.reason || tracedOutcome.diagnostics?.length) {
                return this.selectReceiverOutcome(tracedOutcome, semanticOutcome, receiver.kind);
            }

            return this.selectReceiverOutcome(
                await this.returnObjectResolver.resolveExpressionOutcome(document, receiverNode),
                semanticOutcome,
                receiver.kind
            );
        }

        if (receiver.kind === 'identifier') {
            const tracedResult = await this.traceService.traceIdentifier(document, syntax, receiverNode);
            if (tracedResult && (tracedResult.candidates.length > 0 || tracedResult.hasVisibleBinding)) {
                const refinedResult = await this.resolveUnsupportedVisibleIdentifierSourceOutcome(
                    document,
                    syntax,
                    receiverNode,
                    receiver.expression,
                    tracedResult
                );
                return this.selectReceiverOutcome(refinedResult ?? tracedResult, semanticOutcome, receiver.kind);
            }

            const globalBindingResult = await this.globalBindingResolver.resolveVisibleBinding(
                document,
                receiver.expression,
                receiverNode.range.start,
                {
                    resolveInheritedIdentifier: (parentFile, name, visitedBindings) =>
                        this.inheritedGlobalBindingResolver.resolveInheritedBinding(
                            parentFile,
                            name,
                            undefined,
                            visitedBindings
                        )
                }
            );
            if (globalBindingResult && (globalBindingResult.candidates.length > 0 || globalBindingResult.hasVisibleBinding)) {
                return this.selectReceiverOutcome(globalBindingResult, semanticOutcome, receiver.kind);
            }

            const inheritedBindingResult = await this.inheritedGlobalBindingResolver.resolveInheritedBinding(
                document,
                receiver.expression
            );
            if (inheritedBindingResult && (inheritedBindingResult.candidates.length > 0 || inheritedBindingResult.hasVisibleBinding)) {
                return this.selectReceiverOutcome(inheritedBindingResult, semanticOutcome, receiver.kind);
            }

            return this.selectReceiverOutcome({
                candidates: await this.resolvePathCandidate(document, receiver.expression, 'macro')
            }, semanticOutcome, receiver.kind);
        }

        return this.selectReceiverOutcome({ candidates: [] }, semanticOutcome, receiver.kind);
    }

    private async resolveSemanticReceiverOutcome(
        document: vscode.TextDocument,
        receiverNode: SyntaxNode
    ): Promise<ObjectResolutionOutcome | undefined> {
        if (!this.semanticEvaluationService) {
            return undefined;
        }

        const semanticOutcome = await this.semanticEvaluationService.evaluateExpressionAtPosition(document, receiverNode);
        const converted = this.convertSemanticReceiverValue(document, semanticOutcome.value);
        if (!converted) {
            return undefined;
        }

        if (converted.candidates.length > 0 || converted.reason === 'non-static' || converted.diagnostics?.length) {
            return converted;
        }

        return undefined;
    }

    private convertSemanticReceiverValue(
        document: vscode.TextDocument,
        value: SemanticValue
    ): ObjectResolutionOutcome | undefined {
        switch (value.kind) {
            case 'object':
                return this.resolveSemanticObjectCandidate(document, value.path);
            case 'union':
                return this.convertSemanticUnionValue(document, value.values);
            case 'candidate-set':
            case 'configured-candidate-set':
                return this.convertSemanticCandidateSetValue(document, value.values);
            case 'non-static':
                return {
                    candidates: [],
                    reason: 'non-static'
                };
            default:
                return undefined;
        }
    }

    private convertSemanticUnionValue(
        document: vscode.TextDocument,
        values: readonly SemanticValue[]
    ): ObjectResolutionOutcome | undefined {
        const candidates: ObjectCandidate[] = [];

        for (const value of values) {
            const outcome = this.convertSemanticReceiverValue(document, value);
            if (!outcome) {
                return undefined;
            }

            if (outcome.reason === 'non-static') {
                return outcome;
            }

            candidates.push(...outcome.candidates);
        }

        return candidates.length > 0 ? { candidates } : undefined;
    }

    private selectReceiverOutcome(
        legacyOutcome: ObjectResolutionOutcome,
        semanticOutcome?: ObjectResolutionOutcome,
        receiverKind?: ClassifiedReceiver['kind']
    ): ObjectResolutionOutcome {
        if (receiverKind === 'identifier') {
            if (this.isTerminalIdentifierLegacyOutcome(legacyOutcome)) {
                return legacyOutcome;
            }

            if (semanticOutcome) {
                return semanticOutcome;
            }

            return legacyOutcome;
        }

        if (semanticOutcome) {
            return semanticOutcome;
        }

        if (this.isTerminalLegacyOutcome(legacyOutcome)) {
            return legacyOutcome;
        }

        return legacyOutcome;
    }

    private isTerminalIdentifierLegacyOutcome(outcome: ObjectResolutionOutcome): boolean {
        return this.isTerminalLegacyOutcome(outcome)
            || (outcome as { hasVisibleBinding?: boolean }).hasVisibleBinding === true;
    }

    private isTerminalLegacyOutcome(outcome: ObjectResolutionOutcome): boolean {
        return outcome.candidates.length > 0
            || outcome.reason === 'non-static'
            || (outcome.diagnostics?.length ?? 0) > 0;
    }

    private convertSemanticCandidateSetValue(
        document: vscode.TextDocument,
        values: readonly SemanticValue[]
    ): ObjectResolutionOutcome | undefined {
        const candidates: ObjectCandidate[] = [];

        for (const value of values) {
            if (value.kind === 'non-static') {
                return {
                    candidates: [],
                    reason: 'non-static'
                };
            }

            if (value.kind !== 'object') {
                return undefined;
            }

            const outcome = this.resolveSemanticObjectCandidate(document, value.path);
            if (!outcome) {
                return undefined;
            }

            if (outcome.reason === 'non-static') {
                return outcome;
            }

            candidates.push(...outcome.candidates);
        }

        return candidates.length > 0 ? { candidates } : undefined;
    }

    private async resolveUnsupportedVisibleIdentifierSourceOutcome(
        document: vscode.TextDocument,
        syntax: SyntaxDocument,
        receiverNode: SyntaxNode,
        identifierName: string,
        tracedResult: ObjectResolutionOutcome & { hasVisibleBinding?: boolean }
    ): Promise<(ObjectResolutionOutcome & { hasVisibleBinding: true }) | undefined> {
        if (
            !this.semanticEvaluationService
            || tracedResult.hasVisibleBinding !== true
            || tracedResult.reason !== 'unsupported-expression'
            || tracedResult.candidates.length > 0
        ) {
            return undefined;
        }

        const containingFunction = this.functionLocator.findContainingFunction(syntax, receiverNode.range.start);
        if (!containingFunction) {
            return undefined;
        }

        const binding = this.bindingResolver.resolveVisibleBinding(
            containingFunction,
            identifierName,
            receiverNode.range.start
        );
        if (!binding) {
            return undefined;
        }

        const sourceState = this.flowCollector.collectSourceExpressions(
            containingFunction,
            identifierName,
            receiverNode.range.start,
            binding
        );
        if (sourceState.isConservativeUnknown || sourceState.expressions.length === 0) {
            return undefined;
        }

        const candidates: ObjectCandidate[] = [];
        for (const expression of sourceState.expressions) {
            const outcome = await this.resolveSemanticReceiverOutcome(document, expression);
            if (!outcome) {
                return undefined;
            }

            if (outcome.reason === 'non-static' || outcome.diagnostics?.length) {
                return { ...outcome, hasVisibleBinding: true };
            }

            if (outcome.candidates.length === 0) {
                return undefined;
            }

            candidates.push(...outcome.candidates);
        }

        return candidates.length > 0
            ? { candidates, hasVisibleBinding: true }
            : undefined;
    }

    private resolveSemanticObjectCandidate(
        document: vscode.TextDocument,
        path: string
    ): ObjectResolutionOutcome | undefined {
        const resolvedPath = this.resolveObjectPath(document, path);
        if (!resolvedPath) {
            return undefined;
        }

        return {
            candidates: [{ path: resolvedPath, source: 'builtin-call' }]
        };
    }

    private getInferenceReason(receiver: ClassifiedReceiver) {
        if (receiver.kind === 'unsupported' || receiver.kind === 'index') {
            return receiver.reason;
        }

        if (receiver.kind === 'call') {
            return receiver.unsupportedReason;
        }

        return undefined;
    }

    private async resolvePathCandidate(
        document: vscode.TextDocument,
        expression: string,
        source: 'literal' | 'macro'
    ): Promise<ObjectCandidate[]> {
        const resolvedPath = this.pathSupport.resolveObjectFilePath(document, expression);
        if (!resolvedPath) {
            return [];
        }

        return [{ path: resolvedPath, source }];
    }

    private resolveObjectPath(document: vscode.TextDocument, objectPath: string): string | undefined {
        for (const expression of this.createObjectPathExpressions(objectPath)) {
            const resolvedPath = this.pathSupport.resolveObjectFilePath(document, expression);
            if (resolvedPath) {
                return resolvedPath;
            }
        }

        return undefined;
    }

    private createObjectPathExpressions(objectPath: string): string[] {
        if (objectPath.startsWith('"') && objectPath.endsWith('"')) {
            return [objectPath];
        }

        return [objectPath, `"${objectPath}"`];
    }

    private getNodeText(document: vscode.TextDocument, node: SyntaxNode): string {
        return document.getText(node.range);
    }

    private getRangeSize(range: vscode.Range): number {
        return (range.end.line - range.start.line) * 10_000 + (range.end.character - range.start.character);
    }
}

export function createDefaultObjectInferenceService(
    dependencies: DefaultObjectInferenceServiceDependencies
): ObjectInferenceService {
    const analysisService = assertAnalysisService('ObjectInferenceService', dependencies.analysisService);
    const textDocumentHost = assertTextDocumentHost('ObjectInferenceService', dependencies.host);
    const resolvedDocumentationService = assertDocumentationService(
        'ObjectInferenceService',
        dependencies.documentationService
    );
    const pathSupport = assertDocumentPathSupport('ObjectInferenceService', dependencies.pathSupport);
    const semanticEvaluationService = dependencies.semanticEvaluationService
        ?? createDefaultSemanticEvaluationService({
            analysisService,
            pathSupport
        });
    const inheritanceResolver = new InheritanceResolver(dependencies.macroManager);
    const targetMethodLookup = new TargetMethodLookup(
        analysisService,
        pathSupport
    );
    const scopedMethodResolver = new ScopedMethodResolver({
        analysisService,
        inheritanceResolver,
        host: textDocumentHost
    });
    const returnObjectResolver = new ReturnObjectResolver(
        dependencies.macroManager,
        resolvedDocumentationService,
        scopedMethodResolver,
        pathSupport,
        semanticEvaluationService
    );
    const scopedMethodReturnResolver = new ScopedMethodReturnResolver(
        (document, functionName, options) =>
            returnObjectResolver.resolveDocumentedReturnOutcome(document, functionName, options)
    );
    returnObjectResolver.attachScopedMethodReturnResolver(scopedMethodReturnResolver);
    const objectMethodReturnResolver = new ObjectMethodReturnResolver(returnObjectResolver, targetMethodLookup);
    const globalBindingResolver = new GlobalObjectBindingResolver(
        returnObjectResolver,
        objectMethodReturnResolver,
        inheritanceResolver,
        analysisService,
        textDocumentHost
    );
    const inheritedGlobalBindingResolver = new InheritedGlobalObjectBindingResolver(
        inheritanceResolver,
        globalBindingResolver,
        analysisService,
        textDocumentHost
    );
    const traceService = new ReceiverTraceService(
        returnObjectResolver,
        objectMethodReturnResolver,
        globalBindingResolver,
        inheritedGlobalBindingResolver
    );

    return new ObjectInferenceService({
        analysisService,
        pathSupport,
        returnObjectResolver,
        semanticEvaluationService,
        traceService,
        globalBindingResolver,
        inheritedGlobalBindingResolver
    });
}
