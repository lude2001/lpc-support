import * as vscode from 'vscode';
import * as docParser from '../../efun/docParser';
import { FunctionDocumentationService } from '../../language/documentation/FunctionDocumentationService';
import { PathResolver } from '../../utils/pathResolver';
import { ReturnObjectResolver } from '../ReturnObjectResolver';

function createTextDocument(filePath: string, content: string): vscode.TextDocument {
    const normalized = content.replace(/\r\n/g, '\n');
    const lineStarts = [0];
    for (let index = 0; index < normalized.length; index += 1) {
        if (normalized[index] === '\n') {
            lineStarts.push(index + 1);
        }
    }

    const offsetAt = (position: vscode.Position): number => {
        const lineStart = lineStarts[position.line] ?? normalized.length;
        return Math.min(lineStart + position.character, normalized.length);
    };

    const positionAt = (offset: number): vscode.Position => {
        let line = 0;
        for (let index = 0; index < lineStarts.length; index += 1) {
            if (lineStarts[index] <= offset) {
                line = index;
            } else {
                break;
            }
        }

        return new vscode.Position(line, offset - lineStarts[line]);
    };

    return {
        uri: vscode.Uri.file(filePath),
        fileName: filePath,
        languageId: 'lpc',
        version: 1,
        lineCount: lineStarts.length,
        isDirty: false,
        isClosed: false,
        isUntitled: false,
        eol: vscode.EndOfLine.LF,
        getText: (range?: vscode.Range) => {
            if (!range) {
                return normalized;
            }

            return normalized.slice(offsetAt(range.start), offsetAt(range.end));
        },
        lineAt: (line: number) => ({
            text: normalized.split('\n')[line] ?? ''
        }),
        positionAt,
        offsetAt,
        save: async () => true,
        validateRange: (range: vscode.Range) => range,
        validatePosition: (position: vscode.Position) => position
    } as unknown as vscode.TextDocument;
}

describe('ReturnObjectResolver', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (vscode.workspace.getWorkspaceFolder as jest.Mock).mockReturnValue({
            uri: vscode.Uri.file('D:/code/lpc')
        });
    });

    test('resolveDocumentedReturnOutcome reads returnObjects from shared callable docs instead of reparsing comments', async () => {
        const getDocsByNameSpy = jest.spyOn(FunctionDocumentationService.prototype, 'getDocsByName');
        const parseFunctionDocsSpy = jest.spyOn(docParser, 'parseFunctionDocs');
        jest.spyOn(PathResolver, 'resolveObjectPath').mockImplementation(async (_document, expression) => {
            if (expression === '"/obj/npc"') {
                return 'D:/code/lpc/obj/npc.c';
            }

            if (expression === '"/adm/daemons/room_d"') {
                return 'D:/code/lpc/adm/daemons/room_d.c';
            }

            return undefined;
        });

        const resolver = new ReturnObjectResolver();
        const document = createTextDocument(
            'D:/code/lpc/obj/test.c',
            [
                '/**',
                ' * @brief 返回对象。',
                ' * @lpc-return-objects {"\/obj\/npc", "\/adm\/daemons\/room_d"}',
                ' */',
                'object helper() {',
                '    return 0;',
                '}'
            ].join('\n')
        );

        const outcome = await resolver.resolveDocumentedReturnOutcome(document, 'helper');

        expect(getDocsByNameSpy).toHaveBeenCalledWith(document, 'helper');
        expect(parseFunctionDocsSpy).not.toHaveBeenCalled();
        expect(outcome.candidates).toEqual([
            { path: 'D:/code/lpc/obj/npc.c', source: 'doc' },
            { path: 'D:/code/lpc/adm/daemons/room_d.c', source: 'doc' }
        ]);
    });
});
