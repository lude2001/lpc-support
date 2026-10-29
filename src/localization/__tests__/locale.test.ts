import { describe, expect, test } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { resolveUiLocale, type UiLocale } from '../locale';

const cases: Array<{ input: unknown; expected: UiLocale; reason: string }> = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../../../tests/fixtures/localization/locale-cases.json'), 'utf8')
);

describe('the shared host and sidecar locale contract', () => {
    test.each(cases)('$input uses $expected: $reason', ({ input, expected }) => {
        expect(resolveUiLocale(input)).toBe(expected);
    });

    test.each([undefined, false, 42, {}, ['zh-cn']])('invalid locale input %p uses English', (input) => {
        expect(resolveUiLocale(input)).toBe('en');
    });
});
