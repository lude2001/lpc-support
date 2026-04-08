import * as vscode from 'vscode';
import { ObjectHoverProvider } from '../ObjectHoverProvider';

describe('ObjectHoverProvider', () => {
    beforeEach(() => {
        (vscode.workspace.openTextDocument as jest.Mock).mockReset();
    });

    test('resolved target file shows method syntax from parsed object docs', async () => {
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
        const document = {} as vscode.TextDocument;

        const hover = await provider.provideHover(document, new vscode.Position(0, 0));

        expect(objectInferenceService.inferObjectAccess).toHaveBeenCalledWith(document, expect.any(vscode.Position));
        expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(vscode.Uri.file('D:/code/lpc/obj/npc.c'));
        expect(hover).toBeInstanceOf(vscode.Hover);

        const content = (hover as vscode.Hover).contents as vscode.MarkdownString;
        expect(content.value).toContain('string query_name()');
        expect(content.value).toContain('返回名字。');
    });

    test('merged candidates without unique implementation return a conservative summary containing 可能来自多个对象', async () => {
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

        const hover = await provider.provideHover({} as vscode.TextDocument, new vscode.Position(0, 0));

        expect(hover).toBeInstanceOf(vscode.Hover);
        const content = (hover as vscode.Hover).contents as vscode.MarkdownString;
        expect(content.value).toContain('可能来自多个对象');
    });
});
