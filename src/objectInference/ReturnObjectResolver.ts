import * as vscode from 'vscode';
import { MacroManager } from '../macroManager';
import { PathResolver } from '../utils/pathResolver';
import { ClassifiedReceiver, ObjectCandidate } from './types';

export class ReturnObjectResolver {
    constructor(private readonly macroManager?: MacroManager) {}

    public async resolveCall(
        document: vscode.TextDocument,
        receiver: Extract<ClassifiedReceiver, { kind: 'call' }>
    ): Promise<ObjectCandidate[]> {
        if (receiver.calleeName === 'this_object') {
            return [{ path: document.fileName, source: 'builtin-call' }];
        }

        if (!['load_object', 'find_object', 'clone_object'].includes(receiver.calleeName)) {
            return [];
        }

        if (!receiver.firstArgument) {
            return [];
        }

        const resolvedPath = await PathResolver.resolveObjectPath(document, receiver.firstArgument, this.macroManager);
        if (!resolvedPath) {
            return [];
        }

        return [{ path: resolvedPath, source: 'builtin-call' }];
    }
}
