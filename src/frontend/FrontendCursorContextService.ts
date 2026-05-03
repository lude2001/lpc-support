import * as vscode from 'vscode';
import type { CompletionContextKind } from '../completion/types';
import type { LpcFrontendService } from './LpcFrontendService';
import type { LpcFrontendSnapshot, PreprocessorDirective } from './types';

export interface FrontendCursorContext {
    kind?: CompletionContextKind;
    directive?: PreprocessorDirective;
    isInactive: boolean;
}

export class FrontendCursorContextService {
    public constructor(private readonly frontendService: Pick<LpcFrontendService, 'get'>) {}

    public analyze(document: vscode.TextDocument, position: vscode.Position): FrontendCursorContext {
        const snapshot = this.frontendService.get(document);
        const directive = this.findDirectiveAt(snapshot, position);
        if (directive) {
            return {
                directive,
                kind: directive.kind === 'include' ? 'include-path' : 'preprocessor',
                isInactive: false
            };
        }

        return {
            isInactive: this.isInactivePosition(snapshot, position)
        };
    }

    private findDirectiveAt(
        snapshot: LpcFrontendSnapshot,
        position: vscode.Position
    ): PreprocessorDirective | undefined {
        return snapshot.preprocessor.directives.find((directive) =>
            directive.range.contains(position)
            || directive.range.start.isEqual(position)
            || directive.range.end.isEqual(position)
        );
    }

    private isInactivePosition(snapshot: LpcFrontendSnapshot, position: vscode.Position): boolean {
        return snapshot.preprocessor.inactiveRanges.some((range) =>
            range.range.contains(position)
            || range.range.start.isEqual(position)
            || range.range.end.isEqual(position)
        );
    }
}
