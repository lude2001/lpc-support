import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { DocumentStore } from '../runtime/DocumentStore';

describe('DocumentStore', () => {
    test('stores open, full change, get, and close state', () => {
        const store = new DocumentStore();
        const uri = 'file:///phase-a-test.c';

        store.open(uri, 1, 'one');
        expect(store.get(uri)).toEqual({
            uri,
            version: 1,
            text: 'one'
        });

        store.applyFullChange(uri, 2, 'two');
        expect(store.get(uri)?.version).toBe(2);
        expect(store.get(uri)?.text).toBe('two');

        store.close(uri);
        expect(store.get(uri)).toBeUndefined();
    });

    test('get returns a defensive snapshot instead of the internal object', () => {
        const store = new DocumentStore();
        const uri = 'file:///phase-a-test.c';

        store.open(uri, 1, 'one');
        const snapshot = store.get(uri);

        expect(snapshot).toEqual({
            uri,
            version: 1,
            text: 'one'
        });

        const mutated = {
            ...snapshot,
            text: 'mutated'
        };

        expect(mutated.text).toBe('mutated');
        expect(store.get(uri)?.text).toBe('one');
    });
});
