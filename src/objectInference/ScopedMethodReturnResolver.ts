import * as vscode from 'vscode';
import { ScopedMethodTarget } from './ScopedMethodResolver';
import { ObjectResolutionOutcome } from './ReturnObjectResolver';

type ResolveDocumentedReturnOutcome = (
    document: vscode.TextDocument,
    functionName: string,
    options?: {
        contextLabel?: string;
        requireAnnotation?: boolean;
        diagnosticMethodName?: string;
    }
) => Promise<ObjectResolutionOutcome>;

export class ScopedMethodReturnResolver {
    public constructor(
        private readonly resolveDocumentedReturnOutcome: ResolveDocumentedReturnOutcome
    ) {}

    public async resolveScopedMethodReturnOutcome(
        _document: vscode.TextDocument,
        targets: readonly ScopedMethodTarget[]
    ): Promise<ObjectResolutionOutcome> {
        const outcomesByImplementation = new Map<string, ObjectResolutionOutcome>();
        const mergedCandidates = [] as ObjectResolutionOutcome['candidates'];
        const diagnostics = [] as NonNullable<ObjectResolutionOutcome['diagnostics']>;

        for (const target of targets) {
            const targetKey = this.getTargetKey(target);
            let outcome = outcomesByImplementation.get(targetKey);

            if (!outcome) {
                outcome = await this.resolveDocumentedReturnOutcome(
                    target.document,
                    target.methodName,
                    {
                        contextLabel: target.sourceLabel,
                        requireAnnotation: true,
                        diagnosticMethodName: target.methodName
                    }
                );
                outcomesByImplementation.set(targetKey, outcome);
            }

            if (outcome.diagnostics?.length) {
                diagnostics.push(...outcome.diagnostics);
                continue;
            }

            if (outcome.candidates.length === 0) {
                if (diagnostics.length > 0) {
                    return {
                        candidates: [],
                        diagnostics: this.dedupeDiagnostics(diagnostics)
                    };
                }

                return { candidates: [] };
            }

            mergedCandidates.push(...outcome.candidates);
        }

        if (diagnostics.length > 0) {
            return {
                candidates: [],
                diagnostics: this.dedupeDiagnostics(diagnostics)
            };
        }

        return { candidates: mergedCandidates };
    }

    private getTargetKey(target: ScopedMethodTarget): string {
        const range = target.declarationRange;
        return `${target.path}:${range.start.line}:${range.start.character}:${range.end.line}:${range.end.character}`;
    }

    private dedupeDiagnostics(diagnostics: NonNullable<ObjectResolutionOutcome['diagnostics']>) {
        const deduped = new Map<string, typeof diagnostics[number]>();
        for (const diagnostic of diagnostics) {
            deduped.set(`${diagnostic.code}:${diagnostic.methodName}`, diagnostic);
        }

        return [...deduped.values()];
    }
}
