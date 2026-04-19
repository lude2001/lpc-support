import { describe, expect, test } from '@jest/globals';
import { CallableDocRenderer } from '../../../documentation/CallableDocRenderer';
import {
    dedupeTargets,
    flattenMergedGroups,
    mergeCallableDocGroups,
    selectActiveSignature
} from '../SignatureHelpPresentationSupport';
import { createCallableDoc } from './testSupport';

describe('SignatureHelpPresentationSupport', () => {
    test('dedupeTargets keeps higher-priority targets and aggregates source labels', () => {
        const deduped = dedupeTargets([
            {
                kind: 'include',
                name: 'demo',
                targetKey: 'decl:demo',
                sourceLabel: 'include',
                priority: 3
            },
            {
                kind: 'local',
                name: 'demo',
                targetKey: 'decl:demo',
                sourceLabel: 'current-file',
                priority: 1
            }
        ]);

        expect(deduped).toEqual([
            expect.objectContaining({
                sourceLabel: 'current-file',
                additionalSourceLabels: ['include']
            })
        ]);
    });

    test('merge and flatten preserve grouped provenance labels', () => {
        const renderer = new CallableDocRenderer();
        const grouped = mergeCallableDocGroups([
            {
                target: {
                    kind: 'local',
                    name: 'demo',
                    targetKey: 'decl:one',
                    sourceLabel: 'current-file',
                    priority: 1,
                    additionalSourceLabels: []
                },
                doc: createCallableDoc('demo', 'local', 'decl:one', [{
                    label: 'void demo(int value)',
                    returnType: 'void',
                    isVariadic: false,
                    parameters: [{ name: 'value', type: 'int', description: 'demo value' }]
                }])
            },
            {
                target: {
                    kind: 'inherit',
                    name: 'demo',
                    targetKey: 'decl:two',
                    sourceLabel: 'inherited',
                    priority: 2,
                    additionalSourceLabels: []
                },
                doc: createCallableDoc('demo', 'inherit', 'decl:two', [{
                    label: 'void demo(int value)',
                    returnType: 'void',
                    isVariadic: false,
                    parameters: [{ name: 'value', type: 'int', description: 'demo value' }]
                }])
            }
        ]);

        const flattened = flattenMergedGroups(grouped, renderer, 0);

        expect(flattened).toEqual([
            expect.objectContaining({
                label: 'void demo(int value)',
                sourceLabel: 'current-file',
                additionalSourceLabels: ['inherited'],
                documentation: expect.stringContaining('Also from: inherited')
            })
        ]);
    });

    test('selectActiveSignature prefers exact arity before variadic fallback', () => {
        const doc = createCallableDoc('demo', 'local', 'decl:demo', [
            {
                label: 'void demo(int value)',
                returnType: 'void',
                isVariadic: false,
                parameters: [{ name: 'value', type: 'int' }]
            },
            {
                label: 'void demo(int value, mixed ... rest)',
                returnType: 'void',
                isVariadic: true,
                parameters: [
                    { name: 'value', type: 'int' },
                    { name: 'rest', type: 'mixed', variadic: true }
                ]
            }
        ]);

        expect(selectActiveSignature(doc, 0)).toBe(0);
        expect(selectActiveSignature(doc, 2)).toBe(1);
    });
});
