import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { PreprocessorScanner } from '../PreprocessorScanner';

describe('PreprocessorScanner', () => {
    test('scans include, object macro, function macro, undef, and condition directives with ranges', () => {
        const text = [
            '#include <globals.h>',
            '#define FOO 42',
            '#define RequestType(name, method) int name##_request_type = 1',
            '#undef FOO',
            '#ifdef ENABLE_PAY',
            'public void pay_add() {}',
            '#else',
            'broken else',
            '#endif'
        ].join('\n');

        const snapshot = new PreprocessorScanner().scan('file:///pay_game.c', 1, text);

        expect(snapshot.directives.map((directive) => directive.kind)).toEqual([
            'include',
            'define',
            'define',
            'undef',
            'ifdef',
            'else',
            'endif'
        ]);
        expect(snapshot.includeReferences).toEqual([
            expect.objectContaining({
                value: 'globals.h',
                isSystemInclude: true,
                range: expect.anything()
            })
        ]);
        expect(snapshot.macros).toEqual([
            expect.objectContaining({
                name: 'FOO',
                replacement: '42',
                parameters: undefined
            }),
            expect.objectContaining({
                name: 'RequestType',
                replacement: 'int name##_request_type = 1',
                parameters: ['name', 'method'],
                isFunctionLike: true
            })
        ]);
        expect(snapshot.undefs).toEqual([
            expect.objectContaining({ name: 'FOO' })
        ]);
        expect(snapshot.directives[0].range.start.line).toBe(0);
        expect(snapshot.directives[6].range.start.line).toBe(8);
    });

    test('supports continued define bodies and ignores indented hash inside normal code', () => {
        const text = [
            '#define MULTI(a) ({ \\',
            '    a, \\',
            '    a + 1 \\',
            '})',
            'void create() {',
            '    string value = "#not_directive";',
            '}'
        ].join('\n');

        const snapshot = new PreprocessorScanner().scan('file:///multi.c', 1, text);

        expect(snapshot.macros).toEqual([
            expect.objectContaining({
                name: 'MULTI',
                parameters: ['a'],
                replacement: '({ \n    a, \n    a + 1 \n})'
            })
        ]);
        expect(snapshot.directives).toHaveLength(1);
        expect(snapshot.directives[0].range.end.line).toBe(3);
    });
});
