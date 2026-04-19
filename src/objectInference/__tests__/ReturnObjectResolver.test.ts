import * as vscode from 'vscode';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { ASTManager } from '../../ast/astManager';
import * as docParser from '../../efun/docParser';
import { FunctionDocumentationService } from '../../language/documentation/FunctionDocumentationService';
import { SyntaxKind, SyntaxNode } from '../../syntax/types';
import { PathResolver } from '../../utils/pathResolver';
import {
    configureAstManagerSingletonForTests,
    resetAstManagerSingletonForTests
} from '../../__tests__/testAstManagerSingleton';
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

function findFirstCallExpression(document: vscode.TextDocument): SyntaxNode {
    const astManager = ASTManager.getInstance();
    const syntax = astManager.getSyntaxDocument(document, false)
        ?? astManager.getSyntaxDocument(document, true);
    if (!syntax) {
        throw new Error('Expected syntax document to be available for test document.');
    }

    const callExpression = [...syntax.nodes].find((node) => node.kind === SyntaxKind.CallExpression);
    if (!callExpression) {
        throw new Error('Expected first call expression in test document.');
    }

    return callExpression;
}

describe('ReturnObjectResolver', () => {
    beforeEach(() => {
        configureAstManagerSingletonForTests();
        jest.clearAllMocks();
        (vscode.workspace.getWorkspaceFolder as jest.Mock).mockReturnValue({
            uri: vscode.Uri.file('D:/code/lpc')
        });
    });

    afterEach(() => {
        resetAstManagerSingletonForTests();
        jest.restoreAllMocks();
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

        const resolver = new ReturnObjectResolver(undefined, undefined, new FunctionDocumentationService());
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

    test('ReturnObjectResolver delegates ::factory() to scoped return resolution before ordinary function docs', async () => {
        const documentationService = new FunctionDocumentationService();
        const getDocsByNameSpy = jest.spyOn(documentationService, 'getDocsByName');
        const scopedMethodResolver = {
            resolveCallAt: jest.fn().mockResolvedValue({
                status: 'resolved',
                methodName: 'factory',
                targets: [{
                    path: 'D:/code/lpc/std/base_room.c',
                    methodName: 'factory',
                    document: createTextDocument('D:/code/lpc/std/base_room.c', 'object factory() { return 0; }\n'),
                    location: new vscode.Location(vscode.Uri.file('D:/code/lpc/std/base_room.c'), new vscode.Position(0, 0)),
                    declarationRange: new vscode.Range(0, 0, 0, 7),
                    sourceLabel: 'D:/code/lpc/std/base_room.c'
                }]
            })
        };
        const resolver = new ReturnObjectResolver(undefined, undefined, documentationService, scopedMethodResolver as any);
        const scopedMethodReturnResolver = {
            resolveScopedMethodReturnOutcome: jest.fn().mockResolvedValue({
                candidates: [{ path: 'D:/code/lpc/obj/sword.c', source: 'doc' }]
            })
        };
        resolver.attachScopedMethodReturnResolver(scopedMethodReturnResolver as any);

        const document = createTextDocument('D:/code/lpc/room.c', 'object ob = ::factory();');
        const outcome = await resolver.resolveExpressionOutcome(document, findFirstCallExpression(document));

        expect(scopedMethodResolver.resolveCallAt).toHaveBeenCalled();
        expect(scopedMethodReturnResolver.resolveScopedMethodReturnOutcome).toHaveBeenCalled();
        expect(getDocsByNameSpy).not.toHaveBeenCalled();
        expect(outcome.candidates).toEqual([{ path: 'D:/code/lpc/obj/sword.c', source: 'doc' }]);
    });

    test('ReturnObjectResolver delegates room::factory() to scoped return resolution before ordinary function docs', async () => {
        const documentationService = new FunctionDocumentationService();
        const getDocsByNameSpy = jest.spyOn(documentationService, 'getDocsByName');
        const scopedMethodResolver = {
            resolveCallAt: jest.fn().mockResolvedValue({
                status: 'resolved',
                methodName: 'factory',
                qualifier: 'room',
                targets: [{
                    path: 'D:/code/lpc/std/room.c',
                    methodName: 'factory',
                    document: createTextDocument('D:/code/lpc/std/room.c', 'object factory() { return 0; }\n'),
                    location: new vscode.Location(vscode.Uri.file('D:/code/lpc/std/room.c'), new vscode.Position(0, 0)),
                    declarationRange: new vscode.Range(0, 0, 0, 7),
                    sourceLabel: 'D:/code/lpc/std/room.c'
                }]
            })
        };
        const resolver = new ReturnObjectResolver(undefined, undefined, documentationService, scopedMethodResolver as any);
        const scopedMethodReturnResolver = {
            resolveScopedMethodReturnOutcome: jest.fn().mockResolvedValue({
                candidates: [{ path: 'D:/code/lpc/obj/room_item.c', source: 'doc' }]
            })
        };
        resolver.attachScopedMethodReturnResolver(scopedMethodReturnResolver as any);

        const document = createTextDocument('D:/code/lpc/room.c', 'object ob = room::factory();');
        const outcome = await resolver.resolveExpressionOutcome(document, findFirstCallExpression(document));

        expect(scopedMethodResolver.resolveCallAt).toHaveBeenCalled();
        expect(scopedMethodReturnResolver.resolveScopedMethodReturnOutcome).toHaveBeenCalled();
        expect(getDocsByNameSpy).not.toHaveBeenCalled();
        expect(outcome.candidates).toEqual([{ path: 'D:/code/lpc/obj/room_item.c', source: 'doc' }]);
    });
});
