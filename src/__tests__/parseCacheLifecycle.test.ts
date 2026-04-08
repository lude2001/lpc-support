describe('parseCache lifecycle', () => {
    function createDocument(content: string, fileName: string = '/virtual/lifecycle.c', version: number = 1) {
        return {
            uri: { toString: () => `file://${fileName}` },
            fileName,
            languageId: 'lpc',
            version,
            lineCount: content.split(/\r?\n/).length,
            getText: jest.fn(() => content)
        };
    }

    afterEach(() => {
        jest.restoreAllMocks();
        jest.resetModules();
    });

    test('starts cleanup timers lazily when the legacy facade first creates ParsedDocumentService', () => {
        const unref = jest.fn();
        const fakeTimer = { unref } as unknown as NodeJS.Timeout;
        const setIntervalSpy = jest.spyOn(global, 'setInterval').mockReturnValue(fakeTimer);

        jest.isolateModules(() => {
            const { getParsed } = require('../parseCache');
            getParsed(createDocument('int demo() { return 1; }'));
        });

        expect(setIntervalSpy).toHaveBeenCalledTimes(1);
        expect(unref).toHaveBeenCalledTimes(1);
    });

    test('disposeParseCache drops the compatibility singleton so the next parse rebuilds lifecycle state', () => {
        const unref = jest.fn();
        const fakeTimer = { unref } as unknown as NodeJS.Timeout;
        const setIntervalSpy = jest.spyOn(global, 'setInterval').mockReturnValue(fakeTimer);

        jest.isolateModules(() => {
            const { disposeParseCache, getParsed } = require('../parseCache');
            const document = createDocument('int demo() { return 1; }');

            getParsed(document);
            disposeParseCache();
            getParsed(document);
        });

        expect(setIntervalSpy).toHaveBeenCalledTimes(2);
        expect(unref).toHaveBeenCalledTimes(2);
    });
});
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
