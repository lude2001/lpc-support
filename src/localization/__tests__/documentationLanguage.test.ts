import * as vscode from 'vscode';
import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { getDocumentationLanguage, resolveDocumentationLanguage } from '../documentationLanguage';

describe('documentation output language', () => {
    afterEach(() => {
        jest.restoreAllMocks();
        (vscode.env as { language: string }).language = 'zh-cn';
    });

    test.each([
        { setting: 'en', expected: 'en' },
        { setting: 'zh-cn', expected: 'zh-cn' },
        { setting: undefined, expected: 'zh-cn' },
        { setting: null, expected: 'zh-cn' },
        { setting: 'auto', expected: 'zh-cn' },
        { setting: 'EN', expected: 'zh-cn' },
        { setting: false, expected: 'zh-cn' }
    ])('resolves $setting to $expected', ({ setting, expected }) => {
        expect(resolveDocumentationLanguage(setting)).toBe(expected);
    });

    test.each(['en', 'zh-cn'])('keeps the default Chinese output with %s UI and reads resource configuration', language => {
        (vscode.env as { language: string }).language = language;
        const resource = vscode.Uri.file('D:/documentation-language-fixture/demo.c');
        const get = jest.fn((_key: string, defaultValue: unknown) => defaultValue);
        const configuration = { get } as unknown as vscode.WorkspaceConfiguration;
        const getConfiguration = jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(configuration);

        expect(getDocumentationLanguage(resource)).toBe('zh-cn');
        expect(getConfiguration).toHaveBeenCalledWith('lpc', resource);
        expect(get).toHaveBeenCalledWith('documentation.language', 'zh-cn');
    });
});
