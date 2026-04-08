import * as vscode from 'vscode';
import { ObjectHoverProvider } from '../ObjectHoverProvider';

const mockGetSemanticSnapshot = jest.fn();

jest.mock('../../ast/astManager', () => ({
    ASTManager: {
        getInstance: () => ({
            getSemanticSnapshot: mockGetSemanticSnapshot
        })
    }
}));

jest.mock('fs', () => ({
    existsSync: jest.fn().mockReturnValue(true)
}));

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

    test('method not found in direct file but found in inherited parent shows parent doc', async () => {
        const content = 'child->quest_info();';
        const objectInferenceService = {
            inferObjectAccess: jest.fn().mockResolvedValue({
                receiver: 'child',
                memberName: 'quest_info',
                inference: {
                    status: 'resolved',
                    candidates: [{ path: 'D:/code/lpc/obj/child.c', source: 'literal' }]
                }
            })
        };

        (vscode.workspace.openTextDocument as jest.Mock)
            .mockResolvedValueOnce({
                uri: vscode.Uri.file('D:/code/lpc/obj/child.c'),
                getText: () => 'inherit "/obj/parent.c";\nvoid setup() {}'
            })
            .mockResolvedValueOnce({
                uri: vscode.Uri.file('D:/code/lpc/obj/parent.c'),
                getText: () => [
                    '/**',
                    ' * @brief 父类任务描述。',
                    ' */',
                    'string quest_info() { return "parent quest"; }'
                ].join('\n')
            });

        mockGetSemanticSnapshot.mockReturnValue({
            inheritStatements: [{
                value: '/obj/parent.c',
                rawText: '"/obj/parent.c"',
                expressionKind: 0,
                range: new vscode.Range(0, 0, 0, 20),
                isResolved: true
            }]
        });

        (vscode.workspace.getWorkspaceFolder as jest.Mock).mockReturnValue({
            uri: { fsPath: 'D:/code/lpc' }
        });

        const provider = new ObjectHoverProvider(objectInferenceService as any);
        const document = {
            getWordRangeAtPosition: jest.fn(() => new vscode.Range(0, 7, 0, 17)),
            getText: jest.fn((range?: vscode.Range) => {
                if (!range) {
                    return content;
                }

                return content.slice(range.start.character, range.end.character);
            })
        } as unknown as vscode.TextDocument;

        const hover = await provider.provideHover(document, new vscode.Position(0, 10));

        expect(hover).toBeInstanceOf(vscode.Hover);
        const hoverContent = (hover as vscode.Hover).contents as vscode.MarkdownString;
        expect(hoverContent.value).toContain('string quest_info()');
        expect(hoverContent.value).toContain('父类任务描述');
    });

    test('multiple candidates converging to same parent implementation shows the unique doc', async () => {
        const content = 'ob->shared_method();';
        const objectInferenceService = {
            inferObjectAccess: jest.fn().mockResolvedValue({
                receiver: 'ob',
                memberName: 'shared_method',
                inference: {
                    status: 'multiple',
                    candidates: [
                        { path: 'D:/code/lpc/obj/childA.c', source: 'assignment' },
                        { path: 'D:/code/lpc/obj/childB.c', source: 'assignment' }
                    ]
                }
            })
        };

        const childContent = 'void setup() {}';
        const snapshotContent = 'inherit "/obj/parent.c";\nvoid setup() {}';
        const parentContent = [
            '/**',
            ' * @brief 共享实现。',
            ' */',
            'void shared_method() {}'
        ].join('\n');

        (vscode.workspace.openTextDocument as jest.Mock)
            .mockResolvedValueOnce({
                uri: vscode.Uri.file('D:/code/lpc/obj/childA.c'),
                getText: () => snapshotContent
            })
            .mockResolvedValueOnce({
                uri: vscode.Uri.file('D:/code/lpc/obj/parent.c'),
                getText: () => parentContent
            })
            .mockResolvedValueOnce({
                uri: vscode.Uri.file('D:/code/lpc/obj/childB.c'),
                getText: () => snapshotContent
            })
            .mockResolvedValueOnce({
                uri: vscode.Uri.file('D:/code/lpc/obj/parent.c'),
                getText: () => parentContent
            });

        mockGetSemanticSnapshot.mockReturnValue({
            inheritStatements: [{
                value: '/obj/parent.c',
                rawText: '"/obj/parent.c"',
                expressionKind: 0,
                range: new vscode.Range(0, 0, 0, 20),
                isResolved: true
            }]
        });

        (vscode.workspace.getWorkspaceFolder as jest.Mock).mockReturnValue({
            uri: { fsPath: 'D:/code/lpc' }
        });

        const provider = new ObjectHoverProvider(objectInferenceService as any);
        const document = {
            getWordRangeAtPosition: jest.fn(() => new vscode.Range(0, 4, 0, 17)),
            getText: jest.fn((range?: vscode.Range) => {
                if (!range) {
                    return content;
                }

                return content.slice(range.start.character, range.end.character);
            })
        } as unknown as vscode.TextDocument;

        const hover = await provider.provideHover(document, new vscode.Position(0, 5));

        expect(hover).toBeInstanceOf(vscode.Hover);
        const hoverContent = (hover as vscode.Hover).contents as vscode.MarkdownString;
        expect(hoverContent.value).toContain('shared_method');
        expect(hoverContent.value).toContain('共享实现');
        expect(hoverContent.value).not.toContain('可能来自多个对象');
    });
});
