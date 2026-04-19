import { describe, expect, test } from '@jest/globals';
import type { AttachedDocComment } from '../types';
import { DocCommentTagParser } from '../DocCommentTagParser';

function createAttachedDocComment(lines: string[]): AttachedDocComment {
    return {
        kind: 'javadoc',
        range: {
            start: { line: 0, character: 0 },
            end: { line: lines.length, character: 0 }
        },
        text: lines.join('\n')
    };
}

describe('DocCommentTagParser', () => {
    test('parses supported tags while ignoring malformed and unknown tags', () => {
        const parser = new DocCommentTagParser();
        const attachedDocComment = createAttachedDocComment([
            '/**',
            ' * @brief Primary summary',
            ' * @brief Ignored summary',
            ' * @details First details line',
            ' *   continuation line',
            ' *',
            ' *   second paragraph',
            ' * @details Second details block',
            ' * @note First note block',
            ' * @note Second note block',
            ' * @unknown should be ignored',
            ' * still ignored',
            ' * @param int value Value parameter description',
            ' *   continuation',
            ' * @param string name Name parameter description',
            ' * @param missing',
            ' * @return Returns the computed value.',
            ' * @return Ignored duplicate return.',
            ' * @lpc-return-objects { "/obj/alpha", "/obj/beta" }',
            ' */'
        ]);

        const parsed = parser.parse(attachedDocComment, 'int');

        expect(parsed).toEqual({
            summary: 'Primary summary',
            details: 'First details line\ncontinuation line\n\nsecond paragraph\n\nSecond details block',
            note: 'First note block\n\nSecond note block',
            params: [
                {
                    type: 'int',
                    name: 'value',
                    description: 'Value parameter description\ncontinuation'
                },
                {
                    type: 'string',
                    name: 'name',
                    description: 'Name parameter description'
                }
            ],
            returns: {
                type: 'int',
                description: 'Returns the computed value.'
            },
            returnObjects: ['/obj/alpha', '/obj/beta']
        });
    });

    test('drops malformed return object literals without losing supported tags', () => {
        const parser = new DocCommentTagParser();
        const attachedDocComment = createAttachedDocComment([
            '/**',
            ' * @brief Broken objects summary',
            ' * @details Details still survive.',
            ' * @lpc-return-objects { "/obj/valid", 12 }',
            ' */'
        ]);

        const parsed = parser.parse(attachedDocComment, 'int');

        expect(parsed.summary).toBe('Broken objects summary');
        expect(parsed.details).toBe('Details still survive.');
        expect(parsed.returnObjects).toBeUndefined();
    });
});
