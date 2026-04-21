import type { SemanticValue } from '../types';

export const LPC_TYPE_PREDICATE_NAMES = [
    'mapp',
    'pointerp',
    'stringp',
    'objectp',
    'undefinedp'
] as const;

export type LpcTypePredicateName = typeof LPC_TYPE_PREDICATE_NAMES[number];

const LPC_TYPE_PREDICATE_NAME_SET = new Set<string>(LPC_TYPE_PREDICATE_NAMES);

export function isLpcTypePredicateName(name: string | undefined): name is LpcTypePredicateName {
    return Boolean(name && LPC_TYPE_PREDICATE_NAME_SET.has(name));
}

export function evaluateLpcTypePredicate(
    predicateName: LpcTypePredicateName,
    value: SemanticValue
): boolean | undefined {
    switch (predicateName) {
        case 'mapp':
            return isKnownKind(value, 'mapping-shape');
        case 'pointerp':
            return isKnownKind(value, 'array-shape');
        case 'stringp':
            return value.kind === 'literal' ? typeof value.value === 'string' : isKnownNegative(value);
        case 'objectp':
            return ['object', 'candidate-set', 'configured-candidate-set'].includes(value.kind)
                ? true
                : isKnownNegative(value);
        case 'undefinedp':
            return value.kind === 'unknown' ? undefined : false;
        default:
            return undefined;
    }
}

function isKnownKind(value: SemanticValue, expectedKind: SemanticValue['kind']): boolean | undefined {
    if (value.kind === expectedKind) {
        return true;
    }

    return isKnownNegative(value);
}

function isKnownNegative(value: SemanticValue): false | undefined {
    return value.kind === 'unknown' || value.kind === 'union'
        ? undefined
        : false;
}
