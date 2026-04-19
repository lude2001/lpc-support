import { describe, expect, test } from '@jest/globals';
import { CodeActionDocumentSupport } from '../CodeActionDocumentSupport';
import { createDocument } from './testSupport';

describe('CodeActionDocumentSupport', () => {
    const support = new CodeActionDocumentSupport();

    test('creates line ranges and line-break ranges', () => {
        const document = createDocument('int value;\n');

        expect(support.createLineRange(document as any, 0, 10)).toEqual({
            start: { line: 0, character: 0 },
            end: { line: 0, character: 10 }
        });
        expect(support.createLineRangeIncludingBreak(document as any, 0, 10)).toEqual({
            start: { line: 0, character: 0 },
            end: { line: 0, character: 11 }
        });
    });

    test('normalizes snake and camel case names', () => {
        expect(support.toSnakeCase('MyValue_test')).toBe('_my_value_test');
        expect(support.toCamelCase('my_value_test')).toBe('myValueTest');
    });

    test('finds block/function starts and variable declarations', () => {
        const document = createDocument([
            'void demo()',
            '{',
            '    int value;',
            '    if (ok) {',
            '        int inner;',
            '    }',
            '}'
        ].join('\n'));

        expect(support.findFunctionStart(document as any, 4)).toBe(0);
        expect(support.findBlockStart(document as any, 4)).toBe(3);
        expect(support.isVariableDeclaration('int value;')).toBe(true);
        expect(support.isVariableDeclaration('value = 1;')).toBe(false);
    });
});
