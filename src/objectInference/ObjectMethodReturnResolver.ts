import * as vscode from 'vscode';
import { TargetMethodLookup } from '../targetMethodLookup';
import { ObjectResolutionOutcome, ReturnObjectResolver } from './ReturnObjectResolver';

export class ObjectMethodReturnResolver {
    constructor(
        private readonly returnObjectResolver: ReturnObjectResolver,
        private readonly targetMethodLookup: TargetMethodLookup
    ) {}

    public async resolveMethodReturnOutcome(
        document: vscode.TextDocument,
        receiverCandidates: readonly { path: string }[],
        methodName: string
    ): Promise<ObjectResolutionOutcome> {
        const outcomesByImplementation = new Map<string, ObjectResolutionOutcome>();
        const mergedCandidates = [] as ObjectResolutionOutcome['candidates'];
        const diagnostics = [] as NonNullable<ObjectResolutionOutcome['diagnostics']>;

        for (const receiverCandidate of receiverCandidates) {
            const resolvedMethod = await this.targetMethodLookup.findMethod(
                document,
                receiverCandidate.path,
                methodName
            );
            if (!resolvedMethod) {
                return { candidates: [] };
            }

            let outcome = outcomesByImplementation.get(resolvedMethod.path);
            if (!outcome) {
                outcome = await this.returnObjectResolver.resolveDocumentedReturnOutcome(
                    resolvedMethod.document,
                    methodName,
                    {
                        contextLabel: '对象方法',
                        requireAnnotation: true,
                        diagnosticMethodName: methodName
                    }
                );
                outcomesByImplementation.set(resolvedMethod.path, outcome);
            }

            if (outcome.diagnostics?.length) {
                diagnostics.push(...outcome.diagnostics);
                continue;
            }

            if (outcome.candidates.length === 0) {
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

    private dedupeDiagnostics(diagnostics: NonNullable<ObjectResolutionOutcome['diagnostics']>) {
        const deduped = new Map<string, typeof diagnostics[number]>();
        for (const diagnostic of diagnostics) {
            deduped.set(`${diagnostic.code}:${diagnostic.methodName}`, diagnostic);
        }

        return [...deduped.values()];
    }
}
