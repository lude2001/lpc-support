import { describe, expect, test } from '@jest/globals';
import {
    candidateSetValue,
    configuredCandidateSetValue,
    literalValue,
    objectValue,
    unionValue,
    unknownValue
} from '../valueFactories';
import {
    evaluateLpcObjectSourceValue,
    isLpcObjectSourceCallName
} from '../static/LpcObjectSourceEvaluator';

describe('LpcObjectSourceEvaluator', () => {
    test('maps a literal string target to an object value', () => {
        expect(evaluateLpcObjectSourceValue(literalValue('/adm/model/login'))).toEqual(
            objectValue('/adm/model/login')
        );
    });

    test('joins a union of literal string targets into object candidates', () => {
        expect(evaluateLpcObjectSourceValue(unionValue([
            literalValue('/adm/model/login'),
            literalValue('/adm/model/logout')
        ]))).toEqual(unionValue([
            objectValue('/adm/model/login'),
            objectValue('/adm/model/logout')
        ]));
    });

    test('joins a candidate set of literal string targets into object candidates', () => {
        expect(evaluateLpcObjectSourceValue(candidateSetValue([
            literalValue('/adm/model/login'),
            literalValue('/adm/model/logout')
        ]))).toEqual(unionValue([
            objectValue('/adm/model/login'),
            objectValue('/adm/model/logout')
        ]));
    });

    test('joins a configured candidate set of literal string targets into object candidates', () => {
        expect(evaluateLpcObjectSourceValue(configuredCandidateSetValue(
            'provider-a',
            [
                literalValue('/adm/model/login'),
                literalValue('/adm/model/logout')
            ]
        ))).toEqual(unionValue([
            objectValue('/adm/model/login'),
            objectValue('/adm/model/logout')
        ]));
    });

    test('returns unknown when the object source target is not statically known', () => {
        expect(evaluateLpcObjectSourceValue(unknownValue())).toEqual(unknownValue());
    });

    test('recognizes only the current object source call names', () => {
        expect(isLpcObjectSourceCallName('load_object')).toBe(true);
        expect(isLpcObjectSourceCallName('find_object')).toBe(true);
        expect(isLpcObjectSourceCallName('clone_object')).toBe(false);
        expect(isLpcObjectSourceCallName(undefined)).toBe(false);
    });
});
