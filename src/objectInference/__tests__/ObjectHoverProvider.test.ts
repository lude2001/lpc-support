import * as vscode from 'vscode';
import { ObjectHoverProvider } from '../ObjectHoverProvider';

describe('ObjectHoverProvider', () => {
    beforeEach(() => {
        (vscode.workspace.openTextDocument as jest.Mock).mockReset();
    });

    test('hovering the receiver side of USER_D->query_name() does not return object-method hover', async () => {
        const content = 'USER_D->query_name();';
        const objectInferenceService = {
            inferObjectAccess: jest.fn().mockResolvedValue({
                receiver: 'USER_D',
                memberName: 'query_name',
                inference: {
                    status: 'resolved',
                    candidates: [{ path: 'D:/code/lpc/obj/userd.c', source: 'macro' }]
                }
            })
        };
        (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue({
            getText: () => [
                '/**',
                ' * @brief 返回名字。',
                ' */',
                'string query_name() {',
                '    return "npc";',
                '}'
            ].join('\n')
        });

        const provider = new ObjectHoverProvider(objectInferenceService as any);
        const document = {
            getWordRangeAtPosition: jest.fn(() => new vscode.Range(0, 0, 0, 6)),
            getText: jest.fn((range?: vscode.Range) => {
                if (!range) {
                    return content;
                }

                return content.slice(range.start.character, range.end.character);
            })
        } as unknown as vscode.TextDocument;

        const hover = await provider.provideHover(document, new vscode.Position(0, 2));

        expect(hover).toBeUndefined();
    });

    test('resolved target file shows method syntax from parsed object docs', async () => {
        const content = 'target->query_name();';
        const objectInferenceService = {
            inferObjectAccess: jest.fn().mockResolvedValue({
                receiver: 'target',
                memberName: 'query_name',
                inference: {
                    status: 'resolved',
                    candidates: [{ path: 'D:/code/lpc/obj/npc.c', source: 'literal' }]
                }
            })
        };
        (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue({
            getText: () => [
                '/**',
                ' * @brief 返回名字。',
                ' */',
                'string query_name() {',
                '    return "npc";',
                '}'
            ].join('\n')
        });

        const provider = new ObjectHoverProvider(objectInferenceService as any);
        const document = {
            getWordRangeAtPosition: jest.fn(() => new vscode.Range(0, 8, 0, 18)),
            getText: jest.fn((range?: vscode.Range) => {
                if (!range) {
                    return content;
                }

                return content.slice(range.start.character, range.end.character);
            })
        } as unknown as vscode.TextDocument;

        const hover = await provider.provideHover(document, new vscode.Position(0, 10));

        expect(objectInferenceService.inferObjectAccess).toHaveBeenCalledWith(document, expect.any(vscode.Position));
        expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(vscode.Uri.file('D:/code/lpc/obj/npc.c'));
        expect(hover).toBeInstanceOf(vscode.Hover);

        const hoverContent = (hover as vscode.Hover).contents as vscode.MarkdownString;
        expect(hoverContent.value).toContain('string query_name()');
        expect(hoverContent.value).toContain('返回名字。');
    });

    test('merged candidates without unique implementation return a conservative summary containing 可能来自多个对象', async () => {
        const content = 'ob->start();';
        const objectInferenceService = {
            inferObjectAccess: jest.fn().mockResolvedValue({
                receiver: 'ob',
                memberName: 'start',
                inference: {
                    status: 'multiple',
                    candidates: [
                        { path: 'D:/code/lpc/obj/a.c', source: 'assignment' },
                        { path: 'D:/code/lpc/obj/b.c', source: 'assignment' }
                    ]
                }
            })
        };
        (vscode.workspace.openTextDocument as jest.Mock)
            .mockResolvedValueOnce({
                getText: () => [
                    '/**',
                    ' * @brief A start。',
                    ' */',
                    'void start() {}'
                ].join('\n')
            })
            .mockResolvedValueOnce({
                getText: () => [
                    '/**',
                    ' * @brief B start。',
                    ' */',
                    'void start() {}'
                ].join('\n')
            });

        const provider = new ObjectHoverProvider(objectInferenceService as any);

        const hover = await provider.provideHover({
            getWordRangeAtPosition: jest.fn(() => new vscode.Range(0, 4, 0, 9)),
            getText: jest.fn((range?: vscode.Range) => {
                if (!range) {
                    return content;
                }

                return content.slice(range.start.character, range.end.character);
            })
        } as unknown as vscode.TextDocument, new vscode.Position(0, 5));

        expect(hover).toBeInstanceOf(vscode.Hover);
        const hoverContent = (hover as vscode.Hover).contents as vscode.MarkdownString;
        expect(hoverContent.value).toContain('可能来自多个对象');
    });
});
