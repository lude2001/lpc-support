import * as vscode from 'vscode';
import { afterEach, describe, expect, test } from '@jest/globals';
import { clearGlobalParsedDocumentService } from '../../../parser/ParsedDocumentService';
import { CallableDocDocumentBuilder } from '../CallableDocDocumentBuilder';

function createDocument(
    content: string,
    fileName: string = '/virtual/function-docs.c',
    version: number = 1
): vscode.TextDocument {
    const lineStarts = [0];

    for (let index = 0; index < content.length; index += 1) {
        if (content[index] === '\n') {
            lineStarts.push(index + 1);
        }
    }

    return {
        uri: vscode.Uri.file(fileName),
        fileName,
        languageId: 'lpc',
        version,
        lineCount: lineStarts.length,
        getText: (range?: vscode.Range) => {
            if (!range) {
                return content;
            }

            const startOffset = lineStarts[range.start.line] + range.start.character;
            const endOffset = lineStarts[range.end.line] + range.end.character;
            return content.slice(startOffset, endOffset);
        },
        positionAt: (offset: number) => {
            let line = 0;
            for (let index = 0; index < lineStarts.length; index += 1) {
                if (lineStarts[index] <= offset) {
                    line = index;
                } else {
                    break;
                }
            }

            return new vscode.Position(line, offset - lineStarts[line]);
        },
        offsetAt: (position: vscode.Position) => lineStarts[position.line] + position.character,
        lineAt: (lineOrPosition: number | vscode.Position) => {
            const line = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
            const start = lineStarts[line] ?? 0;
            const nextStart = line + 1 < lineStarts.length ? lineStarts[line + 1] : content.length;
            const end = content[nextStart - 1] === '\n' ? nextStart - 1 : nextStart;

            return {
                text: content.slice(start, end)
            };
        }
    } as unknown as vscode.TextDocument;
}

describe('CallableDocDocumentBuilder', () => {
    afterEach(() => {
        clearGlobalParsedDocumentService();
    });

    test('orders an implementation ahead of a leading prototype for the same function name', () => {
        const document = createDocument([
            'private mapping execute_command(object actor, string arg);',
            '',
            '/**',
            ' * @brief 执行最小正式突破命令的结构化逻辑。',
            ' */',
            'mapping execute_command(object actor, string arg) {',
            '    return ([]);',
            '}'
        ].join('\n'), '/virtual/prototype-leading-docs.c');
        const builder = new CallableDocDocumentBuilder();

        const docs = builder.build(document);
        const declarationKeys = docs.byName.get('execute_command');

        expect(declarationKeys).toHaveLength(2);
        expect(docs.byDeclaration.get(declarationKeys![0])?.summary).toBe('执行最小正式突破命令的结构化逻辑。');
        expect(docs.byDeclaration.get(declarationKeys![0])?.signatures[0].label)
            .toBe('mapping execute_command(object actor, string arg)');
        expect(docs.byDeclaration.get(declarationKeys![1])?.summary).toBeUndefined();
        expect(docs.byDeclaration.get(declarationKeys![1])?.signatures[0].label)
            .toBe('private mapping execute_command(object actor, string arg);');
    });
});
