import { parseConfigHell } from '../configHellParser';

describe('parseConfigHell', () => {
    test('parses config.hell key value pairs and include directories', () => {
        const source = [
            '# comment',
            'name : 武侠黎明',
            'include directories : /include:/include2',
            'simulated efun file : /adm/single/simul_efun'
        ].join('\n');

        const result = parseConfigHell(source);

        expect(result.name).toBe('武侠黎明');
        expect(result.includeDirectories).toEqual(['/include', '/include2']);
        expect(result.simulatedEfunFile).toBe('/adm/single/simul_efun');
    });

    test('uses the last value for repeated supported keys and ignores unknown keys', () => {
        const source = [
            'global include file : <globals.h>',
            'unknown field : ignored',
            'global include file : <global.h>'
        ].join('\n');

        const result = parseConfigHell(source);

        expect(result.globalIncludeFile).toBe('<global.h>');
        expect((result as Record<string, unknown>).unknown).toBeUndefined();
    });

    test('returns undefined includeDirectories for empty include directories value', () => {
        const source = 'include directories :    ';

        const result = parseConfigHell(source);

        expect(result.includeDirectories).toBeUndefined();
    });
});
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
