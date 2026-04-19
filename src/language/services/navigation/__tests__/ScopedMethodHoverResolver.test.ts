import { describe, expect, jest, test } from '@jest/globals';
import * as path from 'path';
import * as vscode from 'vscode';
import { CallableDocRenderer } from '../../../documentation/CallableDocRenderer';

declare const require: any;

function createVsCodeTextDocument(filePath: string, source: string): vscode.TextDocument {
    const lines = source.split(/\r?\n/);
    const lineStarts = [0];

    for (let index = 0; index < source.length; index += 1) {
        if (source[index] === '\n') {
            lineStarts.push(index + 1);
        }
    }

    const offsetAt = (position: vscode.Position): number => {
        const lineStart = lineStarts[position.line] ?? source.length;
        return Math.min(lineStart + position.character, source.length);
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
        lineCount: lines.length,
        isDirty: false,
        isClosed: false,
        isUntitled: false,
        eol: vscode.EndOfLine.LF,
        getText: (range?: vscode.Range) => {
            if (!range) {
                return source;
            }

            return source.slice(offsetAt(range.start), offsetAt(range.end));
        },
        lineAt: (line: number) => ({ text: lines[line] ?? '' }),
        getWordRangeAtPosition: (position: vscode.Position) => {
            const lineText = lines[position.line] ?? '';
            const isWordCharacter = (char: string | undefined) => Boolean(char && /[A-Za-z0-9_]/.test(char));

            let start = position.character;
            while (start > 0 && isWordCharacter(lineText[start - 1])) {
                start -= 1;
            }

            let end = position.character;
            while (end < lineText.length && isWordCharacter(lineText[end])) {
                end += 1;
            }

            if (start === end) {
                return undefined;
            }

            return new vscode.Range(position.line, start, position.line, end);
        },
        positionAt,
        offsetAt,
        save: async () => true,
        validateRange: (range: vscode.Range) => range,
        validatePosition: (position: vscode.Position) => position
    } as unknown as vscode.TextDocument;
}

function createCallableDoc(name: string, label: string, summary: string) {
    return {
        name,
        declarationKey: `${name}-declaration`,
        signatures: [{
            label,
            parameters: [],
            isVariadic: false
        }],
        summary,
        sourceKind: 'scopedMethod' as const
    };
}

function loadResolver(): any {
    return require('../hover/ScopedMethodHoverResolver').ScopedMethodHoverResolver;
}

describe('ScopedMethodHoverResolver', () => {
    test('renders bare ::create() docs only when hovering the method identifier', async () => {
        const ScopedMethodHoverResolver = loadResolver();
        const currentDocument = createVsCodeTextDocument(
            path.join(process.cwd(), '.tmp-hover-scoped', 'room.c'),
            '::create();'
        );
        const targetDocument = createVsCodeTextDocument(
            path.join(process.cwd(), '.tmp-hover-scoped', 'std', 'base_room.c'),
            '/** test */\nvoid create() {}\n'
        );
        const resolver = new ScopedMethodHoverResolver({
            scopedMethodResolver: {
                resolveCallAt: jest.fn().mockResolvedValue({
                    status: 'resolved',
                    methodName: 'create',
                    targets: [{
                        path: targetDocument.fileName,
                        methodName: 'create',
                        declarationRange: new vscode.Range(1, 5, 1, 11),
                        location: new vscode.Location(targetDocument.uri, new vscode.Range(1, 5, 1, 11)),
                        document: targetDocument,
                        sourceLabel: targetDocument.fileName
                    }]
                })
            },
            documentationService: {
                getDocForDeclaration: jest.fn().mockReturnValue(
                    createCallableDoc('create', 'void create()', '父类创建')
                )
            },
            renderer: new CallableDocRenderer(),
            isScopedIdentifier: jest.fn().mockReturnValue(true),
            analysisService: { getSyntaxDocument: jest.fn() }
        });

        const hover = await resolver.provideScopedHover(currentDocument, new vscode.Position(0, 4));

        expect(hover?.contents[0].value).toContain('父类创建');
        expect(hover?.contents[0].value).toContain('void create()');
    });

    test('named room::init() respects identifier gating and skips qualifier hover', async () => {
        const ScopedMethodHoverResolver = loadResolver();
        const currentDocument = createVsCodeTextDocument(
            path.join(process.cwd(), '.tmp-hover-scoped', 'named.c'),
            'room::init();'
        );
        const targetDocument = createVsCodeTextDocument(
            path.join(process.cwd(), '.tmp-hover-scoped', 'std', 'room.c'),
            'void init() {}\n'
        );
        const isScopedIdentifier = jest
            .fn()
            .mockReturnValueOnce(false)
            .mockReturnValueOnce(true);
        const resolver = new ScopedMethodHoverResolver({
            scopedMethodResolver: {
                resolveCallAt: jest.fn().mockResolvedValue({
                    status: 'resolved',
                    qualifier: 'room',
                    methodName: 'init',
                    targets: [{
                        path: targetDocument.fileName,
                        methodName: 'init',
                        declarationRange: new vscode.Range(0, 5, 0, 9),
                        location: new vscode.Location(targetDocument.uri, new vscode.Range(0, 5, 0, 9)),
                        document: targetDocument,
                        sourceLabel: targetDocument.fileName
                    }]
                })
            },
            documentationService: {
                getDocForDeclaration: jest.fn().mockReturnValue(
                    createCallableDoc('init', 'void init()', '房间初始化')
                )
            },
            renderer: new CallableDocRenderer(),
            isScopedIdentifier,
            analysisService: { getSyntaxDocument: jest.fn() }
        });

        const qualifierHover = await resolver.provideScopedHover(currentDocument, new vscode.Position(0, 2));
        const methodHover = await resolver.provideScopedHover(currentDocument, new vscode.Position(0, 7));

        expect(qualifierHover).toBeUndefined();
        expect(methodHover?.contents[0].value).toContain('房间初始化');
        expect(isScopedIdentifier).toHaveBeenCalledTimes(2);
    });

    test.each(['unknown', 'unsupported'] as const)('returns undefined for %s scoped results', async (status) => {
        const ScopedMethodHoverResolver = loadResolver();
        const currentDocument = createVsCodeTextDocument(
            path.join(process.cwd(), '.tmp-hover-scoped', 'unknown.c'),
            'room::init();'
        );
        const resolver = new ScopedMethodHoverResolver({
            scopedMethodResolver: {
                resolveCallAt: jest.fn().mockResolvedValue({
                    status,
                    qualifier: 'room',
                    methodName: 'init',
                    targets: []
                })
            },
            documentationService: {
                getDocForDeclaration: jest.fn()
            },
            renderer: new CallableDocRenderer(),
            isScopedIdentifier: jest.fn().mockReturnValue(true),
            analysisService: { getSyntaxDocument: jest.fn() }
        });

        const hover = await resolver.provideScopedHover(currentDocument, new vscode.Position(0, 7));

        expect(hover).toBeUndefined();
    });
});
