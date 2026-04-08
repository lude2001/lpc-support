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
});
