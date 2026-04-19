import * as vscode from 'vscode';
import { describe, expect, jest, test } from '@jest/globals';
import { FunctionDocCompatMaterializer } from '../FunctionDocCompatMaterializer';
import { FunctionDocumentationService } from '../../language/documentation/FunctionDocumentationService';
import type { RawFunctionDocLookup } from '../FunctionDocLookupTypes';

function createDocument(content: string, fileName: string = '/virtual/function-docs.c'): vscode.TextDocument {
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
        version: 1,
        lineCount: lineStarts.length,
        getText: jest.fn((range?: vscode.Range) => {
            if (!range) {
                return content;
            }

            const startOffset = lineStarts[range.start.line] + range.start.character;
            const endOffset = lineStarts[range.end.line] + range.end.character;
            return content.slice(startOffset, endOffset);
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
        }),
        offsetAt: jest.fn((position: vscode.Position) => lineStarts[position.line] + position.character),
        lineAt: jest.fn((lineOrPosition: number | vscode.Position) => {
            const line = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
            const start = lineStarts[line] ?? 0;
            const nextStart = line + 1 < lineStarts.length ? lineStarts[line + 1] : content.length;
            const end = content[nextStart - 1] === '\n' ? nextStart - 1 : nextStart;

            return {
                text: content.slice(start, end)
            };
        })
    } as unknown as vscode.TextDocument;
}

describe('FunctionDocCompatMaterializer', () => {
    test('prefers implementation docs over a leading prototype and materializes source groups', () => {
        const document = createDocument([
            'private mapping execute_command(object actor, string arg);',
            '',
            '/**',
            ' * @brief 执行最小正式突破命令的结构化逻辑。',
            ' */',
            'mapping execute_command(object actor, string arg) {',
            '    return ([]);',
            '}'
        ].join('\n'));
        const materializer = new FunctionDocCompatMaterializer();
        const rawLookup: RawFunctionDocLookup = {
            inheritedFiles: [],
            currentFile: {
                source: '当前文件',
                filePath: document.fileName,
                docs: new FunctionDocumentationService().getDocumentDocs(document)
            },
            inheritedGroups: [],
            includeGroups: []
        };
        const materialized = materializer.materializeLookup(rawLookup);

        expect(materialized.currentFileDocs.get('execute_command')).toMatchObject({
            name: 'execute_command',
            description: '执行最小正式突破命令的结构化逻辑。',
            syntax: 'mapping execute_command(object actor, string arg)'
        });
        expect(materialized.lookup.inheritedGroups).toHaveLength(0);
        expect(materialized.lookup.includeGroups).toHaveLength(0);
        expect(materialized.lookup.currentFile.source).toBe('当前文件');
        expect(materialized.lookup.currentFile.docs.get('execute_command')).toBe(
            materialized.currentFileDocs.get('execute_command')
        );
    });
});
