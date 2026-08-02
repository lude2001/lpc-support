import { describe, expect, test } from '@jest/globals';
import { isFunctionDocsToExtensionMessage } from '../contracts/FunctionDocumentationPanelProtocol';

describe('FunctionDocumentationPanelProtocol', () => {
    test('accepts allowlisted ID-based actions', () => {
        expect(isFunctionDocsToExtensionMessage({
            type: 'goToDefinition',
            entryId: 'file:///safe.c#1:0-2:1',
            revision: 3
        })).toBe(true);
    });

    test('rejects arbitrary path actions and malformed revisions', () => {
        expect(isFunctionDocsToExtensionMessage({
            type: 'gotoDefinition',
            filePath: 'C:/outside.c',
            line: 0
        })).toBe(false);
        expect(isFunctionDocsToExtensionMessage({
            type: 'goToDefinition',
            entryId: '</script><script>alert(1)</script>',
            revision: '3'
        })).toBe(false);
    });
});
