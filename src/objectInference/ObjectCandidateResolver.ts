import { ObjectCandidate, ObjectInferenceDiagnostic, ObjectInferenceReason, ObjectInferenceResult } from './types';

export class ObjectCandidateResolver {
    public resolve(
        candidates: readonly ObjectCandidate[],
        reason?: ObjectInferenceReason,
        diagnostics?: readonly ObjectInferenceDiagnostic[]
    ): ObjectInferenceResult {
        const dedupedCandidates = this.dedupeByPath(candidates);
        const isUnsupported = reason === 'unsupported-expression';
        const resultDiagnostics = diagnostics && diagnostics.length > 0 ? [...diagnostics] : undefined;

        if (dedupedCandidates.length === 0) {
            if (isUnsupported) {
                return {
                    status: 'unsupported',
                    reason,
                    candidates: [],
                    diagnostics: resultDiagnostics
                };
            }

            return {
                status: 'unknown',
                candidates: [],
                diagnostics: resultDiagnostics
            };
        }

        if (dedupedCandidates.length === 1) {
            return {
                status: 'resolved',
                candidates: dedupedCandidates,
                diagnostics: resultDiagnostics
            };
        }

        return {
            status: 'multiple',
            candidates: dedupedCandidates,
            diagnostics: resultDiagnostics
        };
    }

    private dedupeByPath(candidates: readonly ObjectCandidate[]): ObjectCandidate[] {
        const deduped = new Map<string, ObjectCandidate>();

        for (const candidate of candidates) {
            if (!deduped.has(candidate.path)) {
                deduped.set(candidate.path, candidate);
            }
        }

        return [...deduped.values()];
    }
}
