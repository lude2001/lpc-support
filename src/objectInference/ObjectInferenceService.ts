import * as vscode from 'vscode';
import { ASTManager } from '../ast/astManager';
import { MacroManager } from '../macroManager';
import type { LpcProjectConfigService } from '../projectConfig/LpcProjectConfigService';
import { SyntaxDocument, SyntaxKind, SyntaxNode } from '../syntax/types';
import { TargetMethodLookup } from '../targetMethodLookup';
import { PathResolver } from '../utils/pathResolver';
import { ObjectCandidateResolver } from './ObjectCandidateResolver';
import { GlobalObjectBindingResolver } from './GlobalObjectBindingResolver';
import { ObjectMethodReturnResolver } from './ObjectMethodReturnResolver';
import { ReceiverClassifier } from './ReceiverClassifier';
import { ReceiverTraceService } from './ReceiverTraceService';
import { ObjectResolutionOutcome, ReturnObjectResolver } from './ReturnObjectResolver';
import { ClassifiedReceiver, InferredObjectAccess, ObjectCandidate } from './types';

export class ObjectInferenceService {
    private readonly astManager = ASTManager.getInstance();
    private readonly classifier = new ReceiverClassifier();
    private readonly candidateResolver = new ObjectCandidateResolver();
    private readonly returnObjectResolver: ReturnObjectResolver;
    private readonly objectMethodReturnResolver: ObjectMethodReturnResolver;
    private readonly traceService: ReceiverTraceService;
    private readonly globalBindingResolver: GlobalObjectBindingResolver;

    constructor(
        private readonly macroManager?: MacroManager,
        playerObjectPathOrProjectConfig?: string | LpcProjectConfigService
    ) {
        const projectConfigService = typeof playerObjectPathOrProjectConfig === 'string'
            ? undefined
            : playerObjectPathOrProjectConfig;
        const targetMethodLookup = new TargetMethodLookup(macroManager, projectConfigService);
        this.returnObjectResolver = new ReturnObjectResolver(macroManager, playerObjectPathOrProjectConfig);
        this.objectMethodReturnResolver = new ObjectMethodReturnResolver(this.returnObjectResolver, targetMethodLookup);
        this.globalBindingResolver = new GlobalObjectBindingResolver(
            this.returnObjectResolver,
            this.objectMethodReturnResolver
        );
        this.traceService = new ReceiverTraceService(
            this.returnObjectResolver,
            this.objectMethodReturnResolver,
            this.globalBindingResolver
        );
    }

    public async inferObjectAccess(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<InferredObjectAccess | undefined> {
        const syntax = this.astManager.getSyntaxDocument(document, false)
            ?? this.astManager.getSyntaxDocument(document, true);
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
                receiverNode.range.start
            );
            if (globalBindingResult && (globalBindingResult.candidates.length > 0 || globalBindingResult.hasVisibleBinding)) {
                return globalBindingResult;
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
        const resolvedPath = await PathResolver.resolveObjectPath(document, expression, this.macroManager);
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
