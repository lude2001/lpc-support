import * as vscode from 'vscode';
import { InheritanceResolver } from '../completion/inheritanceResolver';
import { MacroManager } from '../macroManager';
import type { LpcProjectConfigService } from '../projectConfig/LpcProjectConfigService';
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
import { TargetMethodLookup } from '../targetMethodLookup';
import { ObjectCandidateResolver } from './ObjectCandidateResolver';
import { GlobalObjectBindingResolver } from './GlobalObjectBindingResolver';
import { InheritedGlobalObjectBindingResolver } from './InheritedGlobalObjectBindingResolver';
import { ObjectMethodReturnResolver } from './ObjectMethodReturnResolver';
import { ReceiverClassifier } from './ReceiverClassifier';
import { ReceiverTraceService } from './ReceiverTraceService';
import { ObjectResolutionOutcome, ReturnObjectResolver } from './ReturnObjectResolver';
import { ScopedMethodResolver } from './ScopedMethodResolver';
import { ScopedMethodReturnResolver } from './ScopedMethodReturnResolver';
import { ClassifiedReceiver, InferredObjectAccess, ObjectCandidate } from './types';

export interface ObjectInferenceServiceDependencies {
    analysisService?: Pick<DocumentAnalysisService, 'getSyntaxDocument' | 'getSemanticSnapshot'>;
    pathSupport?: WorkspaceDocumentPathSupport;
    returnObjectResolver: ReturnObjectResolver;
    traceService: ReceiverTraceService;
    globalBindingResolver: GlobalObjectBindingResolver;
    inheritedGlobalBindingResolver: InheritedGlobalObjectBindingResolver;
}

export interface DefaultObjectInferenceServiceDependencies {
    macroManager?: MacroManager;
    playerObjectPathOrProjectConfig?: string | LpcProjectConfigService;
    analysisService?: Pick<DocumentAnalysisService, 'getSyntaxDocument' | 'getSemanticSnapshot'>;
    documentationService?: FunctionDocumentationService;
    host?: TextDocumentHost;
    pathSupport?: WorkspaceDocumentPathSupport;
}

export class ObjectInferenceService {
    private readonly analysisService: Pick<DocumentAnalysisService, 'getSyntaxDocument' | 'getSemanticSnapshot'>;
    private readonly classifier = new ReceiverClassifier();
    private readonly candidateResolver = new ObjectCandidateResolver();
    private readonly pathSupport: WorkspaceDocumentPathSupport;
    private readonly returnObjectResolver: ReturnObjectResolver;
    private readonly traceService: ReceiverTraceService;
    private readonly globalBindingResolver: GlobalObjectBindingResolver;
    private readonly inheritedGlobalBindingResolver: InheritedGlobalObjectBindingResolver;

    constructor(dependencies: ObjectInferenceServiceDependencies) {
        this.analysisService = assertAnalysisService('ObjectInferenceService', dependencies.analysisService);
        this.pathSupport = assertDocumentPathSupport('ObjectInferenceService', dependencies.pathSupport);
        this.returnObjectResolver = dependencies.returnObjectResolver;
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
        if (receiverNode.kind === SyntaxKind.NewExpression) {
            return this.returnObjectResolver.resolveExpressionOutcome(document, receiverNode);
        }

        if (
            receiverNode.kind === SyntaxKind.CallExpression
            && receiverNode.children[0]?.kind === SyntaxKind.MemberAccessExpression
            && receiverNode.children[0].metadata?.operator === '->'
        ) {
            const tracedOutcome = await this.traceService.traceExpressionOutcome(document, syntax, receiverNode);
            if (tracedOutcome.candidates.length > 0 || tracedOutcome.reason || tracedOutcome.diagnostics?.length) {
                return tracedOutcome;
            }
        }

        if (receiver.kind === 'literal') {
            return {
                candidates: await this.resolvePathCandidate(document, receiver.expression, 'literal')
            };
        }

        if (receiver.kind === 'macro') {
            return {
                candidates: await this.resolvePathCandidate(document, receiver.expression, 'macro')
            };
        }

        if (receiver.kind === 'call') {
            const tracedOutcome = await this.traceService.traceExpressionOutcome(document, syntax, receiverNode);
            if (tracedOutcome.candidates.length > 0 || tracedOutcome.reason || tracedOutcome.diagnostics?.length) {
                return tracedOutcome;
            }

            return this.returnObjectResolver.resolveExpressionOutcome(document, receiverNode);
        }

        if (receiver.kind === 'identifier') {
            const tracedResult = await this.traceService.traceIdentifier(document, syntax, receiverNode);
            if (tracedResult && (tracedResult.candidates.length > 0 || tracedResult.hasVisibleBinding)) {
                return tracedResult;
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
                return globalBindingResult;
            }

            const inheritedBindingResult = await this.inheritedGlobalBindingResolver.resolveInheritedBinding(
                document,
                receiver.expression
            );
            if (inheritedBindingResult && (inheritedBindingResult.candidates.length > 0 || inheritedBindingResult.hasVisibleBinding)) {
                return inheritedBindingResult;
            }

            return {
                candidates: await this.resolvePathCandidate(document, receiver.expression, 'macro')
            };
        }

        return { candidates: [] };
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
        pathSupport
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
        traceService,
        globalBindingResolver,
        inheritedGlobalBindingResolver
    });
}
