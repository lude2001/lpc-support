import { describe, expect, test } from '@jest/globals';
import type { CallableDoc } from '../../language/documentation/types';
import { DocumentationQualityService } from '../services/DocumentationQualityService';

function createDoc(overrides: Partial<CallableDoc> = {}): CallableDoc {
    return {
        name: 'calculate',
        declarationKey: 'file:///test.c#0:0-2:1',
        sourceKind: 'local',
        declarationKind: 'implementation',
        signatures: [{
            label: 'int calculate(int value)',
            returnType: 'int',
            isVariadic: false,
            parameters: [{ name: 'value', type: 'int' }]
        }],
        ...overrides
    };
}

describe('DocumentationQualityService', () => {
    test('reports deterministic structural gaps and generate action without attached docs', () => {
        const quality = new DocumentationQualityService().analyze(createDoc());

        expect(quality.status).toBe('incomplete');
        expect(quality.action).toBe('generate');
        expect(quality.issues.map((issue) => issue.code)).toEqual([
            'missing-summary',
            'missing-param-description',
            'missing-return-description'
        ]);
    });

    test('uses complete action for an attached comment and does not require void return prose', () => {
        const quality = new DocumentationQualityService().analyze(createDoc({
            attachedCommentRange: {
                start: { line: 0, character: 0 },
                end: { line: 2, character: 3 }
            },
            summary: '执行计算。',
            signatures: [{
                label: 'void calculate(int value)',
                returnType: 'void',
                isVariadic: false,
                parameters: [{ name: 'value', type: 'int' }]
            }]
        }));

        expect(quality.action).toBe('complete');
        expect(quality.issues.map((issue) => issue.code)).toEqual(['missing-param-description']);
    });

    test('marks fully documented declarations complete', () => {
        const quality = new DocumentationQualityService().analyze(createDoc({
            summary: '执行计算。',
            returns: { type: 'int', description: '计算结果。' },
            signatures: [{
                label: 'int calculate(int value)',
                returnType: 'int',
                isVariadic: false,
                parameters: [{ name: 'value', type: 'int', description: '输入值。' }]
            }]
        }));

        expect(quality).toEqual({ status: 'complete', issues: [], action: 'none' });
    });

    test('does not demand documentation from a redundant undocumented prototype', () => {
        const quality = new DocumentationQualityService().analyze(createDoc({
            declarationKind: 'prototype'
        }));

        expect(quality).toEqual({ status: 'notApplicable', issues: [], action: 'none' });
    });

    test('assesses simulated functions from external search using the same documentation rules', () => {
        const quality = new DocumentationQualityService().analyze(createDoc({
            sourceKind: 'simulEfun',
            declarationKind: 'external',
            summary: '执行计算。',
            returns: { type: 'int', description: '计算结果。' },
            signatures: [{
                label: 'int calculate(int value)',
                returnType: 'int',
                isVariadic: false,
                parameters: [{ name: 'value', type: 'int', description: '输入值。' }]
            }]
        }));

        expect(quality).toEqual({ status: 'complete', issues: [], action: 'none' });
    });

    test('keeps standard efuns outside source-document quality assessment', () => {
        const quality = new DocumentationQualityService().analyze(createDoc({
            sourceKind: 'efun',
            declarationKind: 'external',
            summary: '执行计算。'
        }));

        expect(quality).toEqual({ status: 'notApplicable', issues: [], action: 'none' });
    });

    test('marks stale and duplicate tags inconsistent instead of complete', () => {
        const quality = new DocumentationQualityService().analyze(createDoc({
            summary: '执行计算。',
            returns: { type: 'int', description: '计算结果。' },
            documentationIssues: [
                { code: 'stale-parameter-name', parameterName: 'oldValue' },
                { code: 'duplicate-param-tag', parameterName: 'value' }
            ],
            signatures: [{
                label: 'int calculate(int value)',
                returnType: 'int',
                isVariadic: false,
                parameters: [{ name: 'value', type: 'int', description: '输入值。' }]
            }]
        }));

        expect(quality.status).toBe('inconsistent');
        expect(quality.action).toBe('update');
        expect(quality.issues.map((issue) => issue.code)).toEqual([
            'stale-parameter-name',
            'duplicate-param-tag'
        ]);
    });
});
