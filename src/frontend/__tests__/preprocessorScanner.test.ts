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

    test('treats directive block comments as whitespace across physical lines', () => {
        const text = [
            '#define WARNING_LEVEL 1 /* block comment starts on the directive line',
            'and ends on the next physical line */',
            '',
            '#define COMMENT_TAIL 10 /* the tail after the comment still belongs',
            'to the directive */ + 5',
            '#define COMMENT_STRING "a/*not-comment*/b"',
            '#ifdef COMMENT_STRING // trailing comment is ignored for lookup',
            '#define IFDEF_COMMENT_OK 1',
            '#endif',
            '#if 1 /* live conditional comment spans',
            'the next physical line */ && 1',
            '#define LIVE_IF_COMMENT_OK 1',
            '#endif',
            '#undef COMMENT_STRING // trailing comment is ignored for lookup'
        ].join('\n');

        const snapshot = new PreprocessorScanner().scan('file:///preprocessor.c', 1, text);

        expect(snapshot.directives.map((directive) => directive.kind)).toEqual([
            'define',
            'define',
            'define',
            'ifdef',
            'define',
            'endif',
            'if',
            'define',
            'endif',
            'undef'
        ]);
        expect(snapshot.directives[0].range.end.line).toBe(1);
        expect(snapshot.directives[1].range.end.line).toBe(4);
        expect(snapshot.directives[6].range.end.line).toBe(10);
        expect(snapshot.macros).toEqual(expect.arrayContaining([
            expect.objectContaining({ name: 'WARNING_LEVEL', replacement: '1' }),
            expect.objectContaining({ name: 'COMMENT_TAIL', replacement: '10   + 5' }),
            expect.objectContaining({ name: 'COMMENT_STRING', replacement: '"a/*not-comment*/b"' })
        ]));
        expect(snapshot.undefs).toEqual([
            expect.objectContaining({ name: 'COMMENT_STRING' })
        ]);
    });
});
