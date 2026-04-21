import type { SemanticValue } from '../types';

export type LpcTruthiness = true | false | undefined;

export function evaluateLpcTruthiness(value: SemanticValue): LpcTruthiness {
    if (value.kind === 'object') {
        return true;
    }

    if (value.kind !== 'literal') {
        return undefined;
    }

    if (typeof value.value === 'boolean') {
        return value.value;
    }

    if (typeof value.value === 'number') {
        return value.value !== 0;
    }

    if (value.value === null) {
        return false;
    }

    if (typeof value.value === 'string') {
        return value.value.length > 0;
    }

    return undefined;
}
