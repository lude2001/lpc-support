import { composeLpcType, getTypeLookupName, normalizeLpcType, parseLpcType } from '../ast/typeNormalization';

describe('typeNormalization', () => {
    test('normalizes LPC compound types without losing qualifiers', () => {
        expect(normalizeLpcType('string*')).toBe('string *');
        expect(normalizeLpcType('object  **')).toBe('object **');
        expect(normalizeLpcType('class   Payload *')).toBe('class Payload *');
        expect(normalizeLpcType('struct Stats')).toBe('struct Stats');
    });

    test('produces reusable lookup names for member resolution', () => {
        expect(getTypeLookupName('class Payload *')).toBe('Payload');
        expect(getTypeLookupName('struct Stats')).toBe('Stats');
        expect(getTypeLookupName('string *')).toBe('string');
    });

    test('composes declarator stars onto the base type', () => {
        expect(composeLpcType('object', 1)).toBe('object *');
        expect(composeLpcType('class Payload', 2)).toBe('class Payload **');
        expect(parseLpcType('class Payload *[]')).toMatchObject({
            normalized: 'class Payload *[]',
            lookupName: 'Payload',
            pointerDepth: 1,
            arrayDepth: 1
        });
    });
});
