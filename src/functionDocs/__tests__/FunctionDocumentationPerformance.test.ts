import * as vscode from 'vscode';
import { describe, expect, jest, test } from '@jest/globals';
import type { FunctionDocSourceGroup } from '../../efun/FunctionDocLookupTypes';
import type { CallableDoc } from '../../language/documentation/types';
import { FunctionDocumentationSnapshotService } from '../services/FunctionDocumentationSnapshotService';

function createCallable(index: number, sourceKind: 'local' | 'include'): CallableDoc {
    const name = `function_${index}`;
    return {
        name,
        declarationKey: `file:///workspace/${sourceKind}.c#${index}:0-${index}:20`,
        sourceKind,
        declarationKind: 'prototype',
        modifiers: [],
        sourceRange: {
            start: { line: index, character: 0 },
            end: { line: index, character: 20 }
        },
        selectionRange: {
            start: { line: index, character: 4 },
            end: { line: index, character: 4 + name.length }
        },
        summary: `summary ${index}`,
        signatures: [{
            label: `int ${name}(object value);`,
            returnType: 'int',
            parameters: [{ name: 'value', type: 'object', description: 'value' }],
            isVariadic: false
        }]
    };
}

function createGroup(
    filePath: string,
    sourceKind: 'local' | 'include',
    startIndex: number,
    count: number
): FunctionDocSourceGroup {
    const entries = Array.from({ length: count }, (_, offset) => createCallable(startIndex + offset, sourceKind));
    return {
        source: filePath,
        filePath,
        sourceKind,
        entries,
        docs: new Map(entries.map((entry) => [entry.name, entry]))
    };
}

function percentile95(samples: number[]): number {
    const sorted = [...samples].sort((left, right) => left - right);
    return sorted[Math.ceil(sorted.length * 0.95) - 1];
}

describe('function documentation projection performance baseline', () => {
    test('keeps current-file and dependency-complete warm projections inside the specification budgets', async () => {
        (vscode.workspace.getWorkspaceFolder as jest.Mock).mockReturnValue({ uri: { fsPath: 'D:/workspace' } });
        const document = {
            uri: vscode.Uri.file('D:/workspace/main.c'),
            fileName: 'D:/workspace/main.c',
            languageId: 'lpc',
            version: 1
        } as vscode.TextDocument;
        const localOnly = {
            currentFile: createGroup('D:/workspace/main.c', 'local', 0, 200),
            inheritedGroups: [],
            includeGroups: []
        };
        const dependencyComplete = {
            currentFile: createGroup('D:/workspace/main.c', 'local', 0, 50),
            inheritedGroups: [],
            includeGroups: Array.from({ length: 29 }, (_, index) => ({
                ...createGroup(`D:/workspace/include/header-${index}.h`, 'include', 50 + index * 50, 50),
                depth: 1,
                parentFilePath: 'D:/workspace/main.c'
            }))
        };
        let lookup = localOnly;
        const service = new FunctionDocumentationSnapshotService({
            getFunctionDocLookupForDocument: jest.fn(async () => lookup)
        });
        const measure = async (runs: number): Promise<number[]> => {
            const samples: number[] = [];
            for (let revision = 0; revision < runs; revision += 1) {
                const startedAt = performance.now();
                await service.build(document, { sessionId: 'performance', revision });
                samples.push(performance.now() - startedAt);
            }
            return samples;
        };

        await measure(2);
        const localSamples = await measure(20);
        lookup = dependencyComplete;
        await measure(2);
        const dependencySamples = await measure(20);

        expect(percentile95(localSamples)).toBeLessThan(300);
        expect(percentile95(dependencySamples)).toBeLessThan(1500);
    }, 30_000);
});
