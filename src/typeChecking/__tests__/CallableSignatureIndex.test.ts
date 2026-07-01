import { describe, expect, test } from '@jest/globals';
import { CallableSignatureIndex } from '../CallableSignatureIndex';

interface TestSignature {
    name: string;
    returnType?: string;
}

describe('CallableSignatureIndex', () => {
    test('groups signatures by name while preserving overload order', () => {
        const index = new CallableSignatureIndex<TestSignature>([
            { name: 'pick', returnType: 'int' },
            { name: 'other', returnType: 'void' },
            { name: 'pick', returnType: 'string' }
        ]);

        expect(index.has('pick')).toBe(true);
        expect(index.get('pick').map((signature) => signature.returnType)).toEqual(['int', 'string']);
        expect(index.get('other')).toEqual([{ name: 'other', returnType: 'void' }]);
    });

    test('returns an empty signature list for missing names', () => {
        const index = new CallableSignatureIndex<TestSignature>();

        expect(index.has(undefined)).toBe(false);
        expect(index.has('missing')).toBe(false);
        expect(index.get(undefined)).toEqual([]);
        expect(index.get('missing')).toEqual([]);
    });
});
