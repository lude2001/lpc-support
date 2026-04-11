import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { Token } from 'antlr4ts';
import { LPCLexer } from '../../../antlr/LPCLexer';
import { ASTManager } from '../../../ast/astManager';
import { SymbolType } from '../../../ast/symbolTable';
import {
    DefaultLanguageFoldingService
} from '../../../language/services/structure/LanguageFoldingService';
import {
    DefaultLanguageSemanticTokensService,
    loadConfiguredEfunNames,
    resolveSemanticTokensConfigPath
} from '../../../language/services/structure/LanguageSemanticTokensService';
import {
    createSyntaxNode,
    createTokenRange,
    SyntaxKind
} from '../../../syntax/types';

function createDocument(content: string): vscode.TextDocument {
    return {
        uri: vscode.Uri.file('/virtual/structure-test.c'),
        fileName: '/virtual/structure-test.c',
        languageId: 'lpc',
        version: 1,
        lineCount: content.split(/\r?\n/).length,
        getText: jest.fn(() => content)
    } as unknown as vscode.TextDocument;
}

function createCapabilityContext(document: vscode.TextDocument) {
    return {
        document: document as unknown as { uri: string; version: number; getText(): string },
        workspace: {
            workspaceRoot: '/virtual'
        },
        mode: 'lsp' as const
    };
}

function createToken(
    type: number,
    text: string,
    line: number,
    charPositionInLine: number,
    channel: number = LPCLexer.DEFAULT_TOKEN_CHANNEL
): Token {
    return {
        type,
        text,
        line,
        charPositionInLine,
        channel
    } as Token;
}

describe('shared structure services', () => {
    afterEach(() => {
        ASTManager.getInstance().clearAllCache();
        jest.restoreAllMocks();
    });

    test('DefaultLanguageFoldingService preserves trivia-backed folding ranges and deduplicates syntax regions', async () => {
        const document = createDocument('/* header */\nvalue\n');
        jest.spyOn(ASTManager.getInstance(), 'getSyntaxDocument').mockReturnValue({
            parsed: {
                tokenTriviaIndex: {
                    getAllTrivia: () => [
                        {
                            kind: 'block-comment',
                            range: new vscode.Range(0, 0, 1, 0)
                        },
                        {
                            kind: 'directive',
                            range: new vscode.Range(2, 0, 4, 0)
                        },
                        {
                            kind: 'block-comment',
                            range: new vscode.Range(0, 0, 1, 0)
                        }
                    ]
                }
            },
            root: createSyntaxNode({
                kind: SyntaxKind.SourceFile,
                range: new vscode.Range(0, 0, 10, 0),
                tokenRange: createTokenRange(0, 0),
                children: [
                    createSyntaxNode({
                        kind: SyntaxKind.FunctionDeclaration,
                        range: new vscode.Range(5, 0, 8, 1),
                        tokenRange: createTokenRange(1, 1)
                    }),
                    createSyntaxNode({
                        kind: SyntaxKind.Block,
                        range: new vscode.Range(5, 0, 8, 1),
                        tokenRange: createTokenRange(2, 2)
                    }),
                    createSyntaxNode({
                        kind: SyntaxKind.IfStatement,
                        range: new vscode.Range(9, 0, 9, 8),
                        tokenRange: createTokenRange(3, 3)
                    })
                ]
            })
        } as any);

        const service = new DefaultLanguageFoldingService();
        const ranges = await service.provideFoldingRanges({
            context: createCapabilityContext(document)
        });

        expect(ranges).toEqual([
            expect.objectContaining({
                startLine: 0,
                endLine: 1,
                kind: 'comment'
            }),
            expect.objectContaining({
                startLine: 2,
                endLine: 4,
                kind: 'region'
            }),
            expect.objectContaining({
                startLine: 5,
                endLine: 8,
                kind: 'region'
            })
        ]);
    });

    test('DefaultLanguageSemanticTokensService preserves legend semantics and identifier classification rules', async () => {
        const document = createDocument('int demo() { payload->hp; if (PAYLOAD_MAX) {} }');
        const symbolTable = {
            findSymbol: jest.fn((name: string) => {
                if (name === 'demo') {
                    return { type: SymbolType.FUNCTION };
                }

                if (name === 'payload') {
                    return { type: SymbolType.VARIABLE };
                }

                return undefined;
            })
        };
        const fill = jest.fn();
        jest.spyOn(ASTManager.getInstance(), 'parseDocument').mockReturnValue({
            parsed: {
                tokens: {
                    fill,
                    getTokens: () => [
                        createToken(LPCLexer.KW_INT, 'int', 1, 0),
                        createToken(LPCLexer.Identifier, 'demo', 1, 4),
                        createToken(LPCLexer.LPAREN, '(', 1, 8),
                        createToken(LPCLexer.Identifier, 'payload', 1, 11),
                        createToken(LPCLexer.ARROW, '->', 1, 18),
                        createToken(LPCLexer.Identifier, 'hp', 1, 20),
                        createToken(LPCLexer.IF, 'if', 1, 24),
                        createToken(LPCLexer.Identifier, 'PAYLOAD_MAX', 1, 28)
                    ]
                }
            },
            snapshot: {
                symbolTable
            }
        } as any);

        const service = new DefaultLanguageSemanticTokensService();
        const result = await service.provideSemanticTokens({
            context: createCapabilityContext(document)
        });

        expect(fill).toHaveBeenCalledTimes(1);
        expect(result.legend).toEqual({
            tokenTypes: [
                'keyword',
                'type',
                'variable',
                'function',
                'property',
                'macro',
                'builtin',
                'number',
                'string',
                'comment',
                'operator'
            ],
            tokenModifiers: []
        });
        expect(result.tokens).toEqual([
            {
                line: 0,
                startCharacter: 0,
                length: 3,
                tokenType: 'type'
            },
            {
                line: 0,
                startCharacter: 4,
                length: 4,
                tokenType: 'function'
            },
            {
                line: 0,
                startCharacter: 11,
                length: 7,
                tokenType: 'variable'
            },
            {
                line: 0,
                startCharacter: 20,
                length: 2,
                tokenType: 'property'
            },
            {
                line: 0,
                startCharacter: 24,
                length: 2,
                tokenType: 'keyword'
            },
            {
                line: 0,
                startCharacter: 28,
                length: 11,
                tokenType: 'macro'
            }
        ]);
        expect(symbolTable.findSymbol).toHaveBeenCalledWith(
            'demo',
            new vscode.Position(0, 4)
        );
        expect(symbolTable.findSymbol).toHaveBeenCalledWith(
            'payload',
            new vscode.Position(0, 11)
        );
        expect(symbolTable.findSymbol).toHaveBeenCalledWith(
            'hp',
            new vscode.Position(0, 20)
        );
    });

    test('DefaultLanguageSemanticTokensService emits comment tokens from hidden-channel lexer output', async () => {
        const document = createDocument('/* note */\nvalue;\n');
        const fill = jest.fn();
        jest.spyOn(ASTManager.getInstance(), 'parseDocument').mockReturnValue({
            parsed: {
                tokens: {
                    fill,
                    getTokens: () => [
                        createToken(LPCLexer.BLOCK_COMMENT, '/* note */', 1, 0, 1),
                        createToken(LPCLexer.Identifier, 'value', 2, 0)
                    ]
                }
            },
            snapshot: {
                symbolTable: {
                    findSymbol: jest.fn(() => undefined)
                }
            }
        } as any);

        const service = new DefaultLanguageSemanticTokensService();
        const result = await service.provideSemanticTokens({
            context: createCapabilityContext(document)
        });

        expect(result.tokens).toEqual([
            {
                line: 0,
                startCharacter: 0,
                length: 10,
                tokenType: 'comment'
            },
            {
                line: 1,
                startCharacter: 0,
                length: 5,
                tokenType: 'variable'
            }
        ]);
    });

    test('DefaultLanguageSemanticTokensService classifies common LPC keywords and operators that previously fell through', async () => {
        const document = createDocument('class new public ++ -- += -= *= /= %= |= &= :: ... ..');
        const fill = jest.fn();
        jest.spyOn(ASTManager.getInstance(), 'parseDocument').mockReturnValue({
            parsed: {
                tokens: {
                    fill,
                    getTokens: () => [
                        createToken(LPCLexer.KW_CLASS, 'class', 1, 0),
                        createToken(LPCLexer.KW_NEW, 'new', 1, 6),
                        createToken(LPCLexer.MODIFIER, 'public', 1, 10),
                        createToken(LPCLexer.INC, '++', 1, 17),
                        createToken(LPCLexer.DEC, '--', 1, 20),
                        createToken(LPCLexer.PLUS_ASSIGN, '+=', 1, 23),
                        createToken(LPCLexer.MINUS_ASSIGN, '-=', 1, 26),
                        createToken(LPCLexer.STAR_ASSIGN, '*=', 1, 29),
                        createToken(LPCLexer.DIV_ASSIGN, '/=', 1, 32),
                        createToken(LPCLexer.PERCENT_ASSIGN, '%=', 1, 35),
                        createToken(LPCLexer.BIT_OR_ASSIGN, '|=', 1, 38),
                        createToken(LPCLexer.BIT_AND_ASSIGN, '&=', 1, 41),
                        createToken(LPCLexer.SCOPE, '::', 1, 44),
                        createToken(LPCLexer.ELLIPSIS, '...', 1, 47),
                        createToken(LPCLexer.RANGE_OP, '..', 1, 51)
                    ]
                }
            },
            snapshot: {
                symbolTable: {
                    findSymbol: jest.fn(() => undefined)
                }
            }
        } as any);

        const service = new DefaultLanguageSemanticTokensService();
        const result = await service.provideSemanticTokens({
            context: createCapabilityContext(document)
        });

        expect(result.tokens).toEqual([
            {
                line: 0,
                startCharacter: 0,
                length: 5,
                tokenType: 'type'
            },
            {
                line: 0,
                startCharacter: 6,
                length: 3,
                tokenType: 'keyword'
            },
            {
                line: 0,
                startCharacter: 10,
                length: 6,
                tokenType: 'keyword'
            },
            {
                line: 0,
                startCharacter: 17,
                length: 2,
                tokenType: 'operator'
            },
            {
                line: 0,
                startCharacter: 20,
                length: 2,
                tokenType: 'operator'
            },
            {
                line: 0,
                startCharacter: 23,
                length: 2,
                tokenType: 'operator'
            },
            {
                line: 0,
                startCharacter: 26,
                length: 2,
                tokenType: 'operator'
            },
            {
                line: 0,
                startCharacter: 29,
                length: 2,
                tokenType: 'operator'
            },
            {
                line: 0,
                startCharacter: 32,
                length: 2,
                tokenType: 'operator'
            },
            {
                line: 0,
                startCharacter: 35,
                length: 2,
                tokenType: 'operator'
            },
            {
                line: 0,
                startCharacter: 38,
                length: 2,
                tokenType: 'operator'
            },
            {
                line: 0,
                startCharacter: 41,
                length: 2,
                tokenType: 'operator'
            },
            {
                line: 0,
                startCharacter: 44,
                length: 2,
                tokenType: 'operator'
            },
            {
                line: 0,
                startCharacter: 47,
                length: 3,
                tokenType: 'operator'
            },
            {
                line: 0,
                startCharacter: 51,
                length: 2,
                tokenType: 'operator'
            }
        ]);
    });

    test('resolveSemanticTokensConfigPath finds root config from source and bundled runtime layouts', () => {
        const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-semantic-config-'));
        const configFile = path.join(fixtureRoot, 'config', 'lpc-config.json');
        fs.mkdirSync(path.dirname(configFile), { recursive: true });
        fs.writeFileSync(configFile, JSON.stringify({ efuns: { write: {} } }), 'utf8');

        try {
            expect(resolveSemanticTokensConfigPath(path.join(fixtureRoot, 'src', 'language', 'services', 'structure')))
                .toBe(configFile);
            expect(resolveSemanticTokensConfigPath(path.join(fixtureRoot, 'dist', 'language', 'services', 'structure')))
                .toBe(configFile);
            expect(resolveSemanticTokensConfigPath(path.join(fixtureRoot, 'dist', 'lsp', 'server')))
                .toBe(configFile);
        } finally {
            fs.rmSync(fixtureRoot, { recursive: true, force: true });
        }
    });

    test('loadConfiguredEfunNames reads efuns from resolved config path in bundled layouts', () => {
        const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-semantic-efuns-'));
        const configFile = path.join(fixtureRoot, 'config', 'lpc-config.json');
        fs.mkdirSync(path.dirname(configFile), { recursive: true });
        fs.writeFileSync(configFile, JSON.stringify({
            efuns: {
                write: {},
                tell_object: {}
            }
        }), 'utf8');

        try {
            const efuns = loadConfiguredEfunNames(path.join(fixtureRoot, 'dist', 'lsp', 'server'));
            expect(Array.from(efuns).sort()).toEqual(['tell_object', 'write']);
        } finally {
            fs.rmSync(fixtureRoot, { recursive: true, force: true });
        }
    });
});
