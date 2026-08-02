import * as vscode from 'vscode';
import { describe, expect, jest, test } from '@jest/globals';
import type { FunctionDocumentationPanelEntry } from '../contracts/FunctionDocumentationPanelProtocol';
import { FunctionDocumentationAuthoringService } from '../services/FunctionDocumentationAuthoringService';

function createEntry(): FunctionDocumentationPanelEntry {
    return {
        id: 'entry', declarationKey: 'entry', name: 'die', sourceKind: 'local', sourceGroupId: 'local',
        declarationKind: 'implementation', sourceRange: { start: { line: 2, character: 0 }, end: { line: 4, character: 1 } },
        signatures: [{
            label: 'varargs void die(object killer)', returnType: 'void', isParameterVariadic: false,
            isFunctionVarargs: true, parameters: [{ name: 'killer', type: 'object', optional: false, variadic: false }]
        }],
        documentation: { hasAttachedComment: false },
        quality: { status: 'incomplete', action: 'generate', issues: [] },
        relation: { status: 'none', relatedEntryIds: [], relatedSourceUris: [] }, modifiers: ['varargs'],
        capabilities: {
            canGoToDefinition: true, canFindReferences: true, canCopySignature: true,
            canGenerateDocumentation: true, canCompleteDocumentation: false, canUpdateDocumentation: false
        }
    };
}

describe('FunctionDocumentationAuthoringService', () => {
    test('generates a deterministic parameter-aware skeleton and omits return for void', async () => {
        const insert = jest.fn();
        const editor = {
            document: { lineAt: jest.fn(() => ({ text: '    varargs void die(object killer) {' })) },
            edit: jest.fn(async (callback: (builder: { insert: typeof insert }) => void) => {
                callback({ insert });
                return true;
            })
        } as unknown as vscode.TextEditor;

        const changed = await new FunctionDocumentationAuthoringService().apply(editor, createEntry(), 'generate');

        expect(changed).toBe(true);
        expect(insert.mock.calls[0][1]).toContain('@param object killer TODO: 说明 killer。');
        expect(insert.mock.calls[0][1]).not.toContain('@return');
    });

    test('uses the editor CRLF contract when generating a documentation skeleton', async () => {
        const insert = jest.fn();
        const editor = {
            document: {
                eol: vscode.EndOfLine.CRLF,
                lineAt: jest.fn(() => ({ text: 'varargs void die(object killer) {' }))
            },
            edit: jest.fn(async (callback: (builder: { insert: typeof insert }) => void) => {
                callback({ insert });
                return true;
            })
        } as unknown as vscode.TextEditor;

        await new FunctionDocumentationAuthoringService().apply(editor, createEntry(), 'generate');

        const inserted = insert.mock.calls[0][1] as string;
        expect(inserted).toContain('\r\n');
        expect(inserted.replace(/\r\n/g, '')).not.toContain('\n');
    });

    test('removes only confirmed duplicate tag blocks while preserving the first tag', async () => {
        const entry = createEntry();
        entry.documentation = {
            hasAttachedComment: true,
            attachedCommentRange: { start: { line: 0, character: 0 }, end: { line: 6, character: 3 } }
        };
        entry.quality = {
            status: 'inconsistent', action: 'update',
            issues: [{ code: 'duplicate-param-tag', parameterName: 'killer', message: '重复' }]
        };
        const comment = [
            '/**',
            ' * @brief 处理死亡。',
            ' * @param object killer 首个说明。',
            ' * @param object killer 重复说明。',
            ' *   重复续行。',
            ' */'
        ].join('\n');
        const replace = jest.fn();
        const editor = {
            document: {
                lineAt: jest.fn(() => ({ text: '/**' })),
                getText: jest.fn(() => comment)
            },
            edit: jest.fn(async (callback: (builder: { replace: typeof replace }) => void) => {
                callback({ replace });
                return true;
            })
        } as unknown as vscode.TextEditor;

        await new FunctionDocumentationAuthoringService().apply(
            editor,
            entry,
            'update',
            { removeDuplicateTags: true }
        );

        const replacement = replace.mock.calls[0][1] as string;
        expect(replacement).toContain('首个说明');
        expect(replacement).not.toContain('重复说明');
        expect(replacement).not.toContain('重复续行');
    });

    test('preserves CRLF line endings while removing inconsistent tag blocks', async () => {
        const entry = createEntry();
        entry.documentation = {
            hasAttachedComment: true,
            attachedCommentRange: { start: { line: 0, character: 0 }, end: { line: 5, character: 3 } }
        };
        entry.quality = {
            status: 'inconsistent', action: 'update',
            issues: [{ code: 'duplicate-param-tag', parameterName: 'killer', message: '重复' }]
        };
        const comment = [
            '/**',
            ' * @brief 处理死亡。',
            ' * @param object killer 首个说明。',
            ' * @param object killer 重复说明。',
            ' */'
        ].join('\r\n');
        const replace = jest.fn();
        const editor = {
            document: {
                lineAt: jest.fn(() => ({ text: '/**' })),
                getText: jest.fn(() => comment)
            },
            edit: jest.fn(async (callback: (builder: { replace: typeof replace }) => void) => {
                callback({ replace });
                return true;
            })
        } as unknown as vscode.TextEditor;

        await new FunctionDocumentationAuthoringService().apply(
            editor,
            entry,
            'update',
            { removeDuplicateTags: true }
        );

        const replacement = replace.mock.calls[0][1] as string;
        expect(replacement).toContain('\r\n');
        expect(replacement.replace(/\r\n/g, '')).not.toContain('\n');
        expect(replacement.match(/@param/gu)).toHaveLength(1);
    });

    test('preserves CRLF line endings while adding missing tags', async () => {
        const entry = createEntry();
        entry.documentation = {
            hasAttachedComment: true,
            attachedCommentRange: { start: { line: 0, character: 0 }, end: { line: 3, character: 3 } }
        };
        entry.quality = {
            status: 'incomplete', action: 'complete',
            issues: [{ code: 'missing-param-description', parameterName: 'killer', message: '缺少说明' }]
        };
        const comment = ['/**', ' * @brief 处理死亡。', ' */'].join('\r\n');
        const replace = jest.fn();
        const editor = {
            document: {
                eol: vscode.EndOfLine.CRLF,
                lineAt: jest.fn(() => ({ text: '/**' })),
                getText: jest.fn(() => comment)
            },
            edit: jest.fn(async (callback: (builder: { replace: typeof replace }) => void) => {
                callback({ replace });
                return true;
            })
        } as unknown as vscode.TextEditor;

        await new FunctionDocumentationAuthoringService().apply(editor, entry, 'complete');

        const replacement = replace.mock.calls[0][1] as string;
        expect(replacement).toContain('@param object killer TODO: 说明 killer。');
        expect(replacement).toContain('\r\n');
        expect(replacement.replace(/\r\n/g, '')).not.toContain('\n');
    });

    test('completes existing empty tags in place instead of appending duplicates', async () => {
        const entry = createEntry();
        entry.signatures[0].returnType = 'int';
        entry.signatures[0].parameters[0] = {
            name: 'parts', type: 'string *', optional: false, variadic: false
        };
        entry.documentation = {
            hasAttachedComment: true,
            attachedCommentRange: { start: { line: 0, character: 0 }, end: { line: 5, character: 3 } }
        };
        entry.quality = {
            status: 'incomplete', action: 'complete',
            issues: [
                { code: 'missing-summary', message: '缺少简要说明' },
                { code: 'missing-param-description', parameterName: 'parts', message: '缺少参数说明' },
                { code: 'missing-return-description', message: '缺少返回说明' }
            ]
        };
        const comment = [
            '/**',
            ' * @brief',
            ' * @param string *parts',
            ' * @return',
            ' */'
        ].join('\n');
        const replace = jest.fn();
        const editor = {
            document: {
                lineAt: jest.fn(() => ({ text: '/**' })),
                getText: jest.fn(() => comment)
            },
            edit: jest.fn(async (callback: (builder: { replace: typeof replace }) => void) => {
                callback({ replace });
                return true;
            })
        } as unknown as vscode.TextEditor;

        await new FunctionDocumentationAuthoringService().apply(editor, entry, 'complete');

        const replacement = replace.mock.calls[0][1] as string;
        expect(replacement.match(/@brief/gu)).toHaveLength(1);
        expect(replacement.match(/@param/gu)).toHaveLength(1);
        expect(replacement.match(/@return/gu)).toHaveLength(1);
        expect(replacement).toContain('@brief TODO: 简要说明 die 的用途。');
        expect(replacement).toContain('@param string *parts TODO: 说明 parts。');
        expect(replacement).toContain('@return TODO: 说明返回值。');
    });

    test('removes duplicate pointer param tags by normalized parameter name', async () => {
        const entry = createEntry();
        entry.signatures[0].parameters[0] = {
            name: 'parts', type: 'string *', optional: false, variadic: false
        };
        entry.documentation = {
            hasAttachedComment: true,
            attachedCommentRange: { start: { line: 0, character: 0 }, end: { line: 5, character: 3 } }
        };
        entry.quality = {
            status: 'inconsistent', action: 'update',
            issues: [{ code: 'duplicate-param-tag', parameterName: 'parts', message: '重复' }]
        };
        const comment = [
            '/**',
            ' * @brief 删除路径。',
            ' * @param string *parts 首个说明。',
            ' * @param string *parts 重复说明。',
            ' */'
        ].join('\n');
        const replace = jest.fn();
        const editor = {
            document: {
                lineAt: jest.fn(() => ({ text: '/**' })),
                getText: jest.fn(() => comment)
            },
            edit: jest.fn(async (callback: (builder: { replace: typeof replace }) => void) => {
                callback({ replace });
                return true;
            })
        } as unknown as vscode.TextEditor;

        await new FunctionDocumentationAuthoringService().apply(
            editor,
            entry,
            'update',
            { removeDuplicateTags: true }
        );

        const replacement = replace.mock.calls[0][1] as string;
        expect(replacement.match(/@param/gu)).toHaveLength(1);
        expect(replacement).toContain('首个说明');
        expect(replacement).not.toContain('重复说明');
    });

    test('removes confirmed stale param blocks and adds the current parameter once', async () => {
        const entry = createEntry();
        entry.signatures[0].parameters[0] = {
            name: 'parts', type: 'string *', optional: false, variadic: false
        };
        entry.documentation = {
            hasAttachedComment: true,
            attachedCommentRange: { start: { line: 0, character: 0 }, end: { line: 5, character: 3 } }
        };
        entry.quality = {
            status: 'inconsistent', action: 'update',
            issues: [
                { code: 'stale-parameter-name', parameterName: 'oldParts', message: '过时' },
                { code: 'missing-param-description', parameterName: 'parts', message: '缺少说明' }
            ]
        };
        const comment = [
            '/**',
            ' * @brief 删除路径。',
            ' * @param string *oldParts 旧参数说明。',
            ' *   旧参数续行。',
            ' */'
        ].join('\n');
        const replace = jest.fn();
        const editor = {
            document: {
                lineAt: jest.fn(() => ({ text: '/**' })),
                getText: jest.fn(() => comment)
            },
            edit: jest.fn(async (callback: (builder: { replace: typeof replace }) => void) => {
                callback({ replace });
                return true;
            })
        } as unknown as vscode.TextEditor;

        await new FunctionDocumentationAuthoringService().apply(
            editor,
            entry,
            'update',
            { removeStaleParamTags: true }
        );

        const replacement = replace.mock.calls[0][1] as string;
        expect(replacement).not.toContain('oldParts');
        expect(replacement).not.toContain('旧参数续行');
        expect(replacement.match(/@param/gu)).toHaveLength(1);
        expect(replacement).toContain('@param string * parts TODO: 说明 parts。');
    });

    test('removes confirmed orphan param blocks and adds the structured parameter once', async () => {
        const entry = createEntry();
        entry.documentation = {
            hasAttachedComment: true,
            attachedCommentRange: { start: { line: 0, character: 0 }, end: { line: 5, character: 3 } }
        };
        entry.quality = {
            status: 'inconsistent', action: 'update',
            issues: [
                { code: 'orphan-param-tag', message: '孤立标签' },
                { code: 'missing-param-description', parameterName: 'killer', message: '缺少说明' }
            ]
        };
        const comment = [
            '/**',
            ' * @brief 处理死亡。',
            ' * @param malformed',
            ' *   无法关联的续行。',
            ' */'
        ].join('\n');
        const replace = jest.fn();
        const editor = {
            document: {
                lineAt: jest.fn(() => ({ text: '/**' })),
                getText: jest.fn(() => comment)
            },
            edit: jest.fn(async (callback: (builder: { replace: typeof replace }) => void) => {
                callback({ replace });
                return true;
            })
        } as unknown as vscode.TextEditor;

        await new FunctionDocumentationAuthoringService().apply(
            editor,
            entry,
            'update',
            { removeOrphanParamTags: true }
        );

        const replacement = replace.mock.calls[0][1] as string;
        expect(replacement).not.toContain('@param malformed');
        expect(replacement).not.toContain('无法关联的续行');
        expect(replacement.match(/@param/gu)).toHaveLength(1);
        expect(replacement).toContain('@param object killer TODO: 说明 killer。');
    });
});
