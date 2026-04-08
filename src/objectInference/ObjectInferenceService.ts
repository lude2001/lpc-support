import * as vscode from 'vscode';
import { ASTManager } from '../ast/astManager';
import { MacroManager } from '../macroManager';
import { SyntaxDocument, SyntaxKind, SyntaxNode } from '../syntax/types';
import { PathResolver } from '../utils/pathResolver';
import { ObjectCandidateResolver } from './ObjectCandidateResolver';
import { ReceiverClassifier } from './ReceiverClassifier';
import { ReceiverTraceService } from './ReceiverTraceService';
import { ReturnObjectResolver } from './ReturnObjectResolver';
import { ClassifiedReceiver, InferredObjectAccess, ObjectCandidate } from './types';

export class ObjectInferenceService {
    private readonly astManager = ASTManager.getInstance();
    private readonly classifier = new ReceiverClassifier();
    private readonly candidateResolver = new ObjectCandidateResolver();
    private readonly returnObjectResolver: ReturnObjectResolver;
    private readonly traceService = new ReceiverTraceService();

    constructor(private readonly macroManager?: MacroManager) {
        this.returnObjectResolver = new ReturnObjectResolver(macroManager);
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
                inference: this.candidateResolver.resolve([], 'array-element')
            };
        }

        const candidates = await this.resolveCandidates(document, receiverNode, classifiedReceiver);

        return {
            receiver: this.getNodeText(document, receiverNode),
            memberName: memberNode.name,
            inference: this.candidateResolver.resolve(
                candidates,
                classifiedReceiver.kind === 'unsupported' ? classifiedReceiver.reason : undefined
            )
        };
    }

    private findMemberAccess(syntax: SyntaxDocument, position: vscode.Position): SyntaxNode | undefined {
        return [...syntax.nodes]
            .filter((node) => node.kind === SyntaxKind.MemberAccessExpression)
            .filter((node) => node.range.contains(position))
            .filter((node) => node.children.length >= 2)
            .filter((node) => node.children[1].kind === SyntaxKind.Identifier)
            .sort((left, right) => this.getRangeSize(left.range) - this.getRangeSize(right.range))[0];
    }

    private async resolveCandidates(
        document: vscode.TextDocument,
        receiverNode: SyntaxNode,
        receiver: ClassifiedReceiver
    ): Promise<ObjectCandidate[]> {
        if (receiver.kind === 'literal') {
            return this.resolvePathCandidate(document, receiver.expression, 'literal');
        }

        if (receiver.kind === 'macro') {
            return this.resolvePathCandidate(document, receiver.expression, 'macro');
        }

        if (receiver.kind === 'call') {
            return this.returnObjectResolver.resolveCall(document, receiver);
        }

        if (receiver.kind === 'identifier') {
            return (await this.traceService.traceIdentifier(document, receiverNode)) ?? [];
        }

        return [];
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
