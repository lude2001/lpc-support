import { describe, expect, test } from '@jest/globals';
import {
    literalValue,
    objectValue,
    unionValue,
    unknownValue
} from '../valueFactories';
import { evaluateLpcTruthiness } from '../static/LpcConditionEvaluator';

describe('evaluateLpcTruthiness', () => {
    test('treats exact objects as truthy', () => {
        expect(evaluateLpcTruthiness(objectValue('/adm/model/login'))).toBe(true);
    });

    test('returns literal boolean values unchanged', () => {
        expect(evaluateLpcTruthiness(literalValue(true, 'boolean'))).toBe(true);
        expect(evaluateLpcTruthiness(literalValue(false, 'boolean'))).toBe(false);
    });

    test('treats zero and nonzero numbers as falsey and truthy', () => {
        expect(evaluateLpcTruthiness(literalValue(0, 'int'))).toBe(false);
        expect(evaluateLpcTruthiness(literalValue(5, 'int'))).toBe(true);
    });

    test('treats empty and non-empty strings as falsey and truthy', () => {
        expect(evaluateLpcTruthiness(literalValue('', 'string'))).toBe(false);
        expect(evaluateLpcTruthiness(literalValue('login', 'string'))).toBe(true);
    });

    test('treats null literals as false', () => {
        expect(evaluateLpcTruthiness(literalValue(null, 'null'))).toBe(false);
    });

    test('returns undefined for unknown and union values', () => {
        expect(evaluateLpcTruthiness(unknownValue())).toBeUndefined();
        expect(evaluateLpcTruthiness(unionValue([literalValue(true, 'boolean')]))).toBeUndefined();
    });
});
