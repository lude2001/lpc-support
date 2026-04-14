import { describe, expect, test } from '@jest/globals';
import { CallableDocRenderer } from '../CallableDocRenderer';

describe('CallableDocRenderer', () => {
    const callableDoc = {
        name: 'query_value',
        sourceKind: 'local',
        sourcePath: '/std/test.c',
        signatures: [
            {
                label: 'int query_value(string name)',
                returnType: 'int',
                isVariadic: false,
                parameters: [
                    {
                        name: 'name',
                        type: 'string',
                        description: 'Name of the value to fetch.'
                    }
                ]
            },
            {
                label: 'string query_value(string name, int index)',
                returnType: 'string',
                isVariadic: false,
                parameters: [
                    {
                        name: 'name',
                        type: 'string',
                        description: 'Name of the value to fetch.'
                    },
                    {
                        name: 'index',
                        type: 'int',
                        description: 'Zero-based overload index.'
                    }
                ]
            }
        ],
        summary: 'Fetches a value from the current object.',
        details: 'This call reads from the cached value table.',
        note: 'Call after initialization has completed.',
        returns: {
            description: 'The matching value.'
        }
    } as const;

    test('renderHover outputs signature, summary, params, returns, details, and note without selecting one signature', () => {
        const renderer = new CallableDocRenderer();

        const markdown = renderer.renderHover(callableDoc, { sourceLabel: 'current-file' });

        expect(markdown).toContain('Source: current-file');
        expect(markdown).toContain('```lpc\nint query_value(string name)\n```');
        expect(markdown).toContain('```lpc\nstring query_value(string name, int index)\n```');
        expect(markdown).toContain('Fetches a value from the current object.');
        expect(markdown).toContain('#### Parameters');
        expect(markdown).toContain('`name`');
        expect(markdown).toContain('Name of the value to fetch.');
        expect(markdown).toContain('`index`');
        expect(markdown).toContain('Zero-based overload index.');
        expect(markdown).toContain('#### Returns');
        expect(markdown).toContain('The matching value.');
        expect(markdown).toContain('#### Details');
        expect(markdown).toContain('This call reads from the cached value table.');
        expect(markdown).toContain('> **Note**');
        expect(markdown).toContain('Call after initialization has completed.');
    });

    test('renderPanel formats structured callable docs without source selection behavior', () => {
        const renderer = new CallableDocRenderer();

        const markdown = renderer.renderPanel(callableDoc);

        expect(markdown).not.toContain('Source:');
        expect(markdown).toContain('```lpc\nint query_value(string name)\n```');
        expect(markdown).toContain('```lpc\nstring query_value(string name, int index)\n```');
        expect(markdown).toContain('#### Parameters');
        expect(markdown).toContain('`index`');
        expect(markdown).toContain('Zero-based overload index.');
        expect(markdown).toContain('#### Returns');
        expect(markdown).toContain('#### Details');
        expect(markdown).toContain('> **Note**');
    });

    test('renderSignatureSummary returns presentation data for the selected signature only', () => {
        const renderer = new CallableDocRenderer();

        const summary = renderer.renderSignatureSummary(callableDoc, 1, 1);

        expect(Object.keys(summary).sort()).toEqual(['documentation', 'label', 'parameterDocs']);
        expect(summary.label).toBe('string query_value(string name, int index)');
        expect(summary.documentation).toContain('Fetches a value from the current object.');
        expect(summary.documentation).toContain('The matching value.');
        expect(summary.parameterDocs).toEqual([
            'string name: Name of the value to fetch.',
            'int index: Zero-based overload index.'
        ]);
    });

    test('renderSignatureSummary never switches to a different signature on its own', () => {
        const renderer = new CallableDocRenderer();

        const firstSignature = renderer.renderSignatureSummary(callableDoc, 0, 0);
        const secondSignature = renderer.renderSignatureSummary(callableDoc, 1, 1);

        expect(firstSignature.label).toBe('int query_value(string name)');
        expect(firstSignature.parameterDocs).toEqual([
            'string name: Name of the value to fetch.'
        ]);
        expect(secondSignature.label).toBe('string query_value(string name, int index)');
        expect(secondSignature.parameterDocs).toEqual([
            'string name: Name of the value to fetch.',
            'int index: Zero-based overload index.'
        ]);
    });
});
