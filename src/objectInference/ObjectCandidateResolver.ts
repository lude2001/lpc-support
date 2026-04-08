import { ObjectCandidate, ObjectInferenceResult } from './types';

export class ObjectCandidateResolver {
    public resolve(
        candidates: readonly ObjectCandidate[],
        reason?: 'array-element' | 'unsupported-expression'
    ): ObjectInferenceResult {
        const dedupedCandidates = this.dedupeByPath(candidates);

        if (dedupedCandidates.length === 0) {
            if (reason === 'array-element' || reason === 'unsupported-expression') {
                return {
                    status: 'unsupported',
                    reason,
                    candidates: []
                };
            }

            return {
                status: 'unknown',
                candidates: []
            };
        }

        if (dedupedCandidates.length === 1) {
            return {
                status: 'resolved',
                candidates: dedupedCandidates
            };
        }

        return {
            status: 'multiple',
            candidates: dedupedCandidates
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
