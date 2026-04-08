import * as vscode from 'vscode';
import { SyntaxNode } from '../syntax/types';
import { ObjectCandidate } from './types';

export class ReceiverTraceService {
    public async traceIdentifier(
        _document: vscode.TextDocument,
        _identifierNode: SyntaxNode
    ): Promise<ObjectCandidate[] | undefined> {
        return undefined;
    }
}
