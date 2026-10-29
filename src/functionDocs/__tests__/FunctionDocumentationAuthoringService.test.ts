import * as vscode from 'vscode';
import { afterEach, describe, expect, jest, test } from '@jest/globals';
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
    const locales = [
        {
            language: 'en', missingRange: 'The selected declaration has no editable range.',
            stale: 'The function declaration has changed. Refresh the Function Documentation Center and try again.',
            attached: 'This function already has a documentation comment. Complete or update it instead.',
            incomplete: 'The existing documentation comment is incomplete and cannot be safely completed.'
        },
        {
            language: 'zh-cn', missingRange: '所选声明缺少可编辑范围。',
            stale: '函数声明已变化，请刷新文档中心后重试。', attached: '该函数已有文档注释，请使用补全或更新。',
            incomplete: '现有文档注释不完整，无法安全补全。'
        }
    ];

    afterEach(() => {
        jest.restoreAllMocks();
        (vscode.env as { language: string }).language = 'zh-cn';
    });

    const outputCombinations = ['en', 'zh-cn'].flatMap(uiLanguage => ['en', 'zh-cn'].map(outputLanguage => ({
        uiLanguage, outputLanguage
    })));

    function setOutputLanguage(uiLanguage: string, outputLanguage: string): void {
        (vscode.env as { language: string }).language = uiLanguage;
        jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
            get: (key: string, defaultValue: unknown) => key === 'documentation.language' ? outputLanguage : defaultValue
        } as unknown as vscode.WorkspaceConfiguration);
    }

    test.each(outputCombinations)('generates $outputLanguage skeleton with $uiLanguage UI and preserves signature, indent and EOL', async ({ uiLanguage, outputLanguage }) => {
        setOutputLanguage(uiLanguage, outputLanguage);
        const entry = createEntry();
        entry.signatures[0].returnType = 'int';
        const insert = jest.fn();
        const editor = {
            document: {
                uri: vscode.Uri.file('D:/documentation-language-fixture/demo.c'),
                eol: vscode.EndOfLine.CRLF,
                lineAt: jest.fn(() => ({ text: '    int die(object killer) {' }))
            },
            edit: jest.fn(async (callback: (builder: { insert: typeof insert }) => void) => {
                callback({ insert });
                return true;
            })
        } as unknown as vscode.TextEditor;

        await new FunctionDocumentationAuthoringService().apply(editor, entry, 'generate');

        expect(insert.mock.calls[0][1]).toBe([
            '    /**',
            outputLanguage === 'en' ? '     * @brief TODO: Briefly describe the purpose of die.' : '     * @brief TODO: 简要说明 die 的用途。',
            outputLanguage === 'en' ? '     * @param object killer TODO: Describe killer.' : '     * @param object killer TODO: 说明 killer。',
            outputLanguage === 'en' ? '     * @return TODO: Describe the return value.' : '     * @return TODO: 说明返回值。',
            '     */', ''
        ].join('\r\n'));
        expect(insert.mock.calls[0][0]).toEqual(new vscode.Position(2, 0));
    });

    test.each(outputCombinations)('completes only missing text in $outputLanguage with $uiLanguage UI', async ({ uiLanguage, outputLanguage }) => {
        setOutputLanguage(uiLanguage, outputLanguage);
        const entry = createEntry();
        entry.signatures[0].returnType = 'int';
        entry.signatures[0].parameters.push({ name: 'path', type: 'string', optional: false, variadic: false });
        entry.documentation = {
            hasAttachedComment: true,
            attachedCommentRange: { start: { line: 0, character: 0 }, end: { line: 7, character: 3 } }
        };
        entry.quality = {
            status: 'incomplete', action: 'complete',
            issues: [
                { code: 'missing-summary', message: 'missing summary' },
                { code: 'missing-param-description', parameterName: 'path', message: 'missing path' },
                { code: 'missing-return-description', message: 'missing return' }
            ]
        };
        const existingLines = [
            '/**',
            ' * User-authored text：保留原文 /user/path。',
            ' * @brief',
            ' * @param object killer 用户参数说明 (keep in Chinese)。',
            ' * @details Keep this English detail.',
            ' *   用户续行与 @customTag literal。',
            ' */'
        ];
        const replace = jest.fn();
        const editor = {
            document: {
                eol: vscode.EndOfLine.CRLF,
                lineAt: jest.fn(() => ({ text: '/**' })),
                getText: jest.fn(() => existingLines.join('\r\n'))
            },
            edit: jest.fn(async (callback: (builder: { replace: typeof replace }) => void) => {
                callback({ replace });
                return true;
            })
        } as unknown as vscode.TextEditor;

        await new FunctionDocumentationAuthoringService().apply(editor, entry, 'complete');

        const result = replace.mock.calls[0][1] as string;
        for (const line of existingLines.filter(line => line !== ' * @brief' && line !== ' */')) {
            expect(result).toContain(line);
        }
        expect(result).toContain(outputLanguage === 'en'
            ? '@brief TODO: Briefly describe the purpose of die.' : '@brief TODO: 简要说明 die 的用途。');
        expect(result).toContain(outputLanguage === 'en'
            ? '@param string path TODO: Describe path.' : '@param string path TODO: 说明 path。');
        expect(result).toContain(outputLanguage === 'en'
            ? '@return TODO: Describe the return value.' : '@return TODO: 说明返回值。');
        expect(result.match(/@param object killer/gu)).toHaveLength(1);
        expect(result.replace(/\r\n/gu, '')).not.toContain('\n');
    });

    test.each(outputCombinations)('leaves complete user documentation untouched with $uiLanguage UI and $outputLanguage output', async ({ uiLanguage, outputLanguage }) => {
        setOutputLanguage(uiLanguage, outputLanguage);
        const entry = createEntry();
        entry.signatures[0].returnType = 'int';
        entry.documentation = {
            hasAttachedComment: true,
            attachedCommentRange: { start: { line: 0, character: 0 }, end: { line: 6, character: 3 } }
        };
        entry.quality = { status: 'complete', action: 'none', issues: [] };
        const comment = [
            '/**',
            ' * @brief 用户原文说明。',
            ' * @param object killer Keep this original English description.',
            ' * @return 用户返回值说明。',
            ' * @customTag /user/path "中文 literal"',
            ' */'
        ].join('\r\n');
        const edit = jest.fn();
        const editor = {
            document: {
                eol: vscode.EndOfLine.CRLF,
                lineAt: jest.fn(() => ({ text: '/**' })),
                getText: jest.fn(() => comment)
            },
            edit
        } as unknown as vscode.TextEditor;

        expect(await new FunctionDocumentationAuthoringService().apply(editor, entry, 'complete')).toBe(false);
        expect(edit).not.toHaveBeenCalled();
    });

    test.each(locales)('refuses stale declarations or duplicate comments with localized errors in $language', async locale => {
        (vscode.env as { language: string }).language = locale.language;
        const entry = createEntry();
        entry.selectionRange = {
            start: { line: 2, character: 18 }, end: { line: 2, character: 21 }
        };
        const edit = jest.fn();
        const document = {
            getText: jest.fn(() => 'old_name'),
            lineAt: jest.fn(() => ({ text: 'void old_name() {}' }))
        };
        const editor = { document, edit } as unknown as vscode.TextEditor;
        const service = new FunctionDocumentationAuthoringService();

        await expect(service.apply(editor, entry, 'generate')).rejects.toThrow(new Error(locale.stale));
        document.getText.mockReturnValue('die');
        entry.documentation.attachedCommentRange = {
            start: { line: 0, character: 0 }, end: { line: 1, character: 3 }
        };
        await expect(service.apply(editor, entry, 'generate')).rejects.toThrow(new Error(locale.attached));
        expect(edit).not.toHaveBeenCalled();
    });

    test.each(locales)('refuses missing ranges and incomplete comments before any edit in $language', async locale => {
        (vscode.env as { language: string }).language = locale.language;
        const entry = createEntry();
        entry.sourceRange = undefined;
        const edit = jest.fn();
        const editor = {
            document: {
                lineAt: jest.fn(() => ({ text: '/**' })),
                getText: jest.fn(() => '/**\n * @brief Keep the user comment unchanged.\n')
            },
            edit
        } as unknown as vscode.TextEditor;
        const service = new FunctionDocumentationAuthoringService();

        await expect(service.apply(editor, entry, 'generate')).rejects.toThrow(new Error(locale.missingRange));
        entry.sourceRange = createEntry().sourceRange;
        entry.documentation = {
            hasAttachedComment: true,
            attachedCommentRange: { start: { line: 0, character: 0 }, end: { line: 2, character: 0 } }
        };
        await expect(service.apply(editor, entry, 'complete')).rejects.toThrow(new Error(locale.incomplete));
        expect(edit).not.toHaveBeenCalled();
    });

    test.each(locales)('keeps the existing parameter-aware skeleton output in $language and omits return for void', async locale => {
        (vscode.env as { language: string }).language = locale.language;
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

    test.each(locales)('removes only confirmed duplicate tag blocks and preserves user text in $language', async locale => {
        (vscode.env as { language: string }).language = locale.language;
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

    test.each(outputCombinations)('completes existing empty tags in $outputLanguage with $uiLanguage UI without duplicates', async ({ uiLanguage, outputLanguage }) => {
        setOutputLanguage(uiLanguage, outputLanguage);
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
        expect(replacement).toContain(outputLanguage === 'en'
            ? '@brief TODO: Briefly describe the purpose of die.' : '@brief TODO: 简要说明 die 的用途。');
        expect(replacement).toContain(outputLanguage === 'en'
            ? '@param string *parts TODO: Describe parts.' : '@param string *parts TODO: 说明 parts。');
        expect(replacement).toContain(outputLanguage === 'en'
            ? '@return TODO: Describe the return value.' : '@return TODO: 说明返回值。');
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
