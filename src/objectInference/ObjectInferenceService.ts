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
    private readonly traceService: ReceiverTraceService;

    constructor(private readonly macroManager?: MacroManager) {
        this.returnObjectResolver = new ReturnObjectResolver(macroManager);
        this.traceService = new ReceiverTraceService(this.returnObjectResolver);
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

        const candidates = await this.resolveCandidates(document, syntax, receiverNode, classifiedReceiver);
        const inferenceReason = this.getInferenceReason(classifiedReceiver);

        return {
            receiver: this.getNodeText(document, receiverNode),
            memberName: memberNode.name,
            inference: this.candidateResolver.resolve(
                candidates,
                inferenceReason
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
    ): Promise<ObjectCandidate[]> {
        if (receiver.kind === 'literal') {
            return this.resolvePathCandidate(document, receiver.expression, 'literal');
        }

        if (receiver.kind === 'macro') {
            return this.resolvePathCandidate(document, receiver.expression, 'macro');
        }

        if (receiver.kind === 'call') {
            return this.returnObjectResolver.resolveExpression(document, receiverNode);
        }

        if (receiver.kind === 'identifier') {
            const tracedCandidates = (await this.traceService.traceIdentifier(document, syntax, receiverNode)) ?? [];
            if (tracedCandidates.length > 0 || this.hasEnclosingLocalDeclaration(syntax, receiverNode)) {
                return tracedCandidates;
            }

            return this.resolvePathCandidate(document, receiver.expression, 'macro');
        }

        return [];
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

    private hasEnclosingLocalDeclaration(syntax: SyntaxDocument, receiverNode: SyntaxNode): boolean {
        if (!receiverNode.name) {
            return false;
        }

        const enclosingFunction = [...syntax.nodes]
            .filter((node) => node.kind === SyntaxKind.FunctionDeclaration)
            .filter((node) => node.range.contains(receiverNode.range.start))
            .sort((left, right) => this.getRangeSize(left.range) - this.getRangeSize(right.range))[0];

        if (!enclosingFunction) {
            return false;
        }

        return syntax.nodes.some((node) => {
            if (!this.isLocalDeclarationNode(node, receiverNode.name!)) {
                return false;
            }

            return enclosingFunction.range.contains(node.range.start)
                && this.isBeforeOrEqual(node.range.start, receiverNode.range.start);
        });
    }

    private isLocalDeclarationNode(node: SyntaxNode, name: string): boolean {
        return (node.kind === SyntaxKind.ParameterDeclaration || node.kind === SyntaxKind.VariableDeclarator)
            && node.name === name;
    }

    private isBeforeOrEqual(left: vscode.Position, right: vscode.Position): boolean {
        return left.isBefore(right) || left.isEqual(right);
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
