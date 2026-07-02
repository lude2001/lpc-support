import { describe, expect, test } from '@jest/globals';
import { LpcTypeParser } from '../LpcTypeParser';

describe('LpcTypeParser', () => {
    const parser = new LpcTypeParser();

    test('parses primitive and special base types', () => {
        expect(parser.parse('int')).toMatchObject({
            kind: 'primitive',
            name: 'int',
            isMixed: false,
            isVoid: false
        });
        expect(parser.parse('mixed')).toMatchObject({
            kind: 'primitive',
            name: 'mixed',
            isMixed: true
        });
        expect(parser.parse('void')).toMatchObject({
            kind: 'primitive',
            name: 'void',
            isVoid: true
        });
        expect(parser.parse(undefined)).toMatchObject({
            kind: 'unknown',
            isUnknown: true
        });
    });

    test('parses pointer and bracket arrays as nested array types', () => {
        const single = parser.parse('string *');
        expect(single).toMatchObject({
            kind: 'array',
            name: 'string',
            pointerDepth: 1,
            elementType: {
                kind: 'primitive',
                name: 'string'
            }
        });

        const nested = parser.parse('class Payload *[]');
        expect(nested).toMatchObject({
            kind: 'array',
            name: 'Payload',
            pointerDepth: 2,
            elementType: {
                kind: 'array',
                name: 'Payload',
                elementType: {
                    kind: 'class',
                    name: 'Payload'
                }
            }
        });

        const builtinArray = parser.parse('array');
        expect(builtinArray).toMatchObject({
            kind: 'array',
            name: 'mixed',
            pointerDepth: 1,
            sourceText: 'array',
            elementType: {
                kind: 'primitive',
                name: 'mixed'
            }
        });
    });

    test('parses class, struct, mapping, and function-like types', () => {
        expect(parser.parse('class Payload')).toMatchObject({
            kind: 'class',
            name: 'Payload'
        });
        expect(parser.parse('struct Stats')).toMatchObject({
            kind: 'struct',
            name: 'Stats'
        });
        expect(parser.parse('mapping')).toMatchObject({
            kind: 'mapping',
            name: 'mapping'
        });
        expect(parser.parse('closure')).toMatchObject({
            kind: 'function',
            name: 'function'
        });
    });

    test('parses documented union types into alternatives', () => {
        expect(parser.parse('string | string *')).toMatchObject({
            kind: 'union',
            sourceText: 'string | string *',
            alternatives: [
                {
                    kind: 'primitive',
                    name: 'string'
                },
                {
                    kind: 'array',
                    name: 'string',
                    elementType: {
                        kind: 'primitive',
                        name: 'string'
                    }
                }
            ]
        });
        expect(parser.parse('void | object *')).toMatchObject({
            kind: 'union',
            sourceText: 'void | object *',
            alternatives: [
                {
                    kind: 'primitive',
                    name: 'void'
                },
                {
                    kind: 'array',
                    name: 'object'
                }
            ]
        });
    });

    test('downgrades ambiguous documented parameter text to unknown', () => {
        expect(parser.parse('string substr | int')).toMatchObject({
            kind: 'unknown',
            isUnknown: true,
            sourceText: 'string substr | int'
        });
    });
});
