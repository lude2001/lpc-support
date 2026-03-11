import * as vscode from 'vscode';
import { ASTManager } from '../ast/astManager';
import { LPCSemanticTokensProvider } from '../semanticTokensProvider';

function createDocument(content: string): vscode.TextDocument {
    const lines = content.split(/\r?\n/);
    const lineStarts = [0];

    for (let index = 0; index < content.length; index += 1) {
        if (content[index] === '\n') {
            lineStarts.push(index + 1);
        }
    }

    return {
        uri: vscode.Uri.file('/virtual/semantic-test.c'),
        fileName: '/virtual/semantic-test.c',
        languageId: 'lpc',
        version: 1,
        lineCount: lines.length,
        getText: jest.fn(() => content),
        lineAt: jest.fn((lineOrPosition: number | vscode.Position) => {
            const line = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
            return { text: lines[line] ?? '' };
        }),
        positionAt: jest.fn((offset: number) => {
            let line = 0;
            for (let index = 0; index < lineStarts.length; index += 1) {
                if (lineStarts[index] <= offset) {
                    line = index;
                } else {
                    break;
                }
            }

            return new vscode.Position(line, offset - lineStarts[line]);
        })
    } as unknown as vscode.TextDocument;
}

describe('LPCSemanticTokensProvider', () => {
    afterEach(() => {
        ASTManager.getInstance().clearAllCache();
        jest.restoreAllMocks();
    });

    test('reuses ASTManager analysis outputs for identifier classification', async () => {
        const document = createDocument([
            'class Payload {',
            '    int hp;',
            '}',
            '',
            'int local_call() {',
            '    class Payload payload;',
            '    payload->hp;',
            '}'
        ].join('\n'));

        const parseDocumentSpy = jest.spyOn(ASTManager.getInstance(), 'parseDocument');

        const provider = new LPCSemanticTokensProvider();
        const result = await provider.provideDocumentSemanticTokens(
            document,
            { isCancellationRequested: false } as vscode.CancellationToken
        ) as any;

        expect(parseDocumentSpy).toHaveBeenCalledTimes(1);
        expect(Array.isArray(result.data)).toBe(true);
        expect(result.data.length).toBeGreaterThan(0);
    });
});
