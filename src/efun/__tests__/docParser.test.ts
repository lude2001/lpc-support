import { parseFunctionDocs } from '../docParser';

describe('parseFunctionDocs', () => {
    test('parses @lpc-return-objects into returnObjects', () => {
        const docs = parseFunctionDocs([
            '/**',
            ' * @brief helper docs',
            ' * @return object 返回对象',
            ' * @lpc-return-objects {"/adm/daemons/combat_d", "ROOM_D"}',
            ' */',
            'object helper() {',
            '    return this_object();',
            '}'
        ].join('\n'), '当前文件');

        expect(docs.get('helper')).toMatchObject({
            name: 'helper',
            returnType: 'object',
            returnObjects: ['/adm/daemons/combat_d', 'ROOM_D']
        });
    });

    test('keeps @return parsing bounded when @lpc-return-objects follows it', () => {
        const docs = parseFunctionDocs([
            '/**',
            ' * @brief helper docs',
            ' * @return object 返回对象',
            ' * @lpc-return-objects {"/adm/daemons/combat_d"}',
            ' */',
            'object helper() {',
            '    return this_object();',
            '}'
        ].join('\n'), '当前文件');

        expect(docs.get('helper')?.returnValue).toBe('object 返回对象');
    });

    test('keeps @param parsing bounded when @lpc-return-objects follows it', () => {
        const docs = parseFunctionDocs([
            '/**',
            ' * @brief helper docs',
            ' * @param object target 目标对象',
            ' * @lpc-return-objects {"/adm/daemons/combat_d"}',
            ' */',
            'object helper(object target) {',
            '    return target;',
            '}'
        ].join('\n'), '当前文件');

        expect(docs.get('helper')?.description).toBe('helper docs\n\n参数:\nobject target: 目标对象');
        expect(docs.get('helper')?.returnObjects).toEqual(['/adm/daemons/combat_d']);
    });

    test('rejects malformed @lpc-return-objects input instead of partially parsing it', () => {
        const docs = parseFunctionDocs([
            '/**',
            ' * @brief helper docs',
            ' * @lpc-return-objects {"/adm/a", bad}',
            ' */',
            'object helper() {',
            '    return this_object();',
            '}'
        ].join('\n'), '当前文件');

        expect(docs.get('helper')?.returnObjects).toBeUndefined();
    });
});
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
