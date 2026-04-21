import { describe, expect, test } from '@jest/globals';
import {
    arrayShapeValue,
    candidateSetValue,
    literalValue,
    mappingShapeValue,
    objectValue,
    unknownValue
} from '../valueFactories';
import {
    evaluateLpcTypePredicate,
    isLpcTypePredicateName,
    LPC_TYPE_PREDICATE_NAMES
} from '../static/LpcTypePredicateEvaluator';

describe('LpcTypePredicateEvaluator', () => {
    test('exposes the supported LPC type predicate names explicitly', () => {
        expect(LPC_TYPE_PREDICATE_NAMES).toEqual([
            'mapp',
            'pointerp',
            'stringp',
            'objectp',
            'undefinedp'
        ]);
        expect(isLpcTypePredicateName('mapp')).toBe(true);
        expect(isLpcTypePredicateName('call_other')).toBe(false);
        expect(isLpcTypePredicateName(undefined)).toBe(false);
    });

    test('evaluates known static shapes and leaves unknown predicate inputs unknown', () => {
        expect(evaluateLpcTypePredicate('mapp', mappingShapeValue({}))).toBe(true);
        expect(evaluateLpcTypePredicate('mapp', literalValue('login'))).toBe(false);
        expect(evaluateLpcTypePredicate('pointerp', arrayShapeValue([]))).toBe(true);
        expect(evaluateLpcTypePredicate('stringp', literalValue('login'))).toBe(true);
        expect(evaluateLpcTypePredicate('objectp', objectValue('/adm/protocol/model/login_model'))).toBe(true);
        expect(evaluateLpcTypePredicate('objectp', candidateSetValue([
            objectValue('/adm/protocol/model/login_model')
        ]))).toBe(true);
        expect(evaluateLpcTypePredicate('undefinedp', literalValue('login'))).toBe(false);
        expect(evaluateLpcTypePredicate('mapp', unknownValue())).toBeUndefined();
    });
});
