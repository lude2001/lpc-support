import * as vscode from 'vscode';
import { SyntaxNode } from '../syntax/types';
import { ObjectResolutionOutcome } from './ReturnObjectResolver';

export interface TracedReceiverResult extends ObjectResolutionOutcome {
    hasVisibleBinding: boolean;
}

export interface FlowState {
    expressions: SyntaxNode[];
    isConservativeUnknown: boolean;
}

export interface ReceiverIdentifierTraceResolver {
    traceIdentifierInFunction(
        document: vscode.TextDocument,
        functionNode: SyntaxNode,
        identifierName: string,
        usagePosition: vscode.Position,
        visited: Set<string>,
        binding?: SyntaxNode
    ): Promise<TracedReceiverResult>;
}
