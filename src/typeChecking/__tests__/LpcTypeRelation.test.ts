import { describe, expect, test } from '@jest/globals';
import {
    createMappingType,
    createPrimitiveType,
    createUnknownType,
    createZeroLiteralType
} from '../LpcType';
import { LpcTypeParser } from '../LpcTypeParser';
import { LpcTypeRelation } from '../LpcTypeRelation';

describe('LpcTypeRelation', () => {
    const parser = new LpcTypeParser();
    const relation = new LpcTypeRelation();

    test('keeps unknown and mixed conservative', () => {
        expect(relation.isAssignable(createUnknownType(), parser.parse('string'))).toBe(true);
        expect(relation.isAssignable(parser.parse('string'), createUnknownType())).toBe(true);
        expect(relation.isAssignable(parser.parse('mixed'), parser.parse('string'))).toBe(true);
        expect(relation.isAssignable(parser.parse('string'), parser.parse('mixed'))).toBe(true);
    });

    test('allows zero literal for any target but rejects void values', () => {
        expect(relation.isAssignable(createZeroLiteralType(), parser.parse('object'))).toBe(true);
        expect(relation.isAssignable(createZeroLiteralType(), parser.parse('void'))).toBe(false);
        expect(relation.isAssignable(parser.parse('void'), parser.parse('int'))).toBe(false);
        expect(relation.isAssignable(parser.parse('void'), parser.parse('void'))).toBe(true);
    });

    test('treats int, float, and status as one numeric domain', () => {
        expect(relation.isAssignable(parser.parse('int'), parser.parse('float'))).toBe(true);
        expect(relation.isAssignable(parser.parse('status'), parser.parse('int'))).toBe(true);
        expect(relation.isAssignable(parser.parse('string'), parser.parse('int'))).toBe(false);
    });

    test('requires class and struct names to match without object fallback', () => {
        expect(relation.isAssignable(parser.parse('class Payload'), parser.parse('class Payload'))).toBe(true);
        expect(relation.isAssignable(parser.parse('class Payload'), parser.parse('class Other'))).toBe(false);
        expect(relation.isAssignable(parser.parse('struct Payload'), parser.parse('class Payload'))).toBe(false);
        expect(relation.isAssignable(parser.parse('object'), parser.parse('class Payload'))).toBe(false);
        expect(relation.isAssignable(parser.parse('class Payload'), parser.parse('object'))).toBe(false);
    });

    test('checks arrays and mappings shallowly', () => {
        expect(relation.isAssignable(parser.parse('string *'), parser.parse('string *'))).toBe(true);
        expect(relation.isAssignable(parser.parse('int *'), parser.parse('string *'))).toBe(false);
        expect(relation.isAssignable(parser.parse('mixed *'), parser.parse('string *'))).toBe(true);

        expect(relation.isAssignable(
            createMappingType('mapping<string,int>', createPrimitiveType('string'), createPrimitiveType('int')),
            createMappingType('mapping<string,float>', createPrimitiveType('string'), createPrimitiveType('float'))
        )).toBe(true);
        expect(relation.isAssignable(
            createMappingType('mapping<int,string>', createPrimitiveType('int'), createPrimitiveType('string')),
            createMappingType('mapping<string,string>', createPrimitiveType('string'), createPrimitiveType('string'))
        )).toBe(false);
    });
});
