import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { Token } from 'antlr4ts';
import { LPCLexer } from '../../../antlr/LPCLexer';
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
        jest.restoreAllMocks();
    });

    test('DefaultLanguageFoldingService preserves trivia-backed folding ranges and deduplicates syntax regions', async () => {
        const document = createDocument('/* header */\nvalue\n');
        const analysisService = {
            getSyntaxDocument: jest.fn().mockReturnValue({
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
            })
        };

        const service = new DefaultLanguageFoldingService(analysisService as any);
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
        const analysisService = {
            parseDocument: jest.fn().mockReturnValue({
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
                    symbolTable,
                    macroReferences: [
                        {
                            name: 'PAYLOAD_MAX',
                            range: new vscode.Range(0, 28, 0, 39)
                        }
                    ]
                }
            })
        };

        const service = new DefaultLanguageSemanticTokensService(analysisService as any);
        const result = await service.provideSemanticTokens({
            context: createCapabilityContext(document)
        });

        expect(fill).toHaveBeenCalledTimes(1);
        expect(result.legend).toEqual({
            tokenTypes: [
                'keyword',
                'lpcType',
                'type',
                'variable',
                'parameter',
                'function',
                'method',
                'property',
                'macro',
                'builtin',
                'number',
                'string',
                'comment',
                'operator',
                'inactive'
            ],
            tokenModifiers: [
                'declaration',
                'local',
                'defaultLibrary',
                'readonly',
                'static'
            ]
        });
        expect(result.tokens).toEqual([
            {
                line: 0,
                startCharacter: 0,
                length: 3,
                tokenType: 'lpcType'
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
                startCharacter: 18,
                length: 2,
                tokenType: 'operator'
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
        expect(symbolTable.findSymbol).not.toHaveBeenCalledWith(
            'hp',
            new vscode.Position(0, 20)
        );
        expect(analysisService.parseDocument).toHaveBeenCalledWith(document as any);
    });

    test('DefaultLanguageSemanticTokensService enriches LPC semantic token roles and modifiers', async () => {
        const document = createDocument([
            '#if 0',
            'int disabled;',
            '#endif',
            'int hp;',
            'void heal(object target, int amount) {',
            '    int local;',
            '    target->heal(amount);',
            '}'
        ].join('\n'));
        const text = document.getText();
        const tokenAt = (type: number, tokenText: string, line: number, character: number) =>
            createToken(type, tokenText, line + 1, character);
        const globalSymbol = {
            name: 'hp',
            type: SymbolType.VARIABLE,
            range: new vscode.Range(3, 4, 3, 6),
            selectionRange: new vscode.Range(3, 4, 3, 6),
            scope: { name: 'global' }
        };
        const functionSymbol = {
            name: 'heal',
            type: SymbolType.FUNCTION,
            range: new vscode.Range(4, 5, 4, 9),
            selectionRange: new vscode.Range(4, 5, 4, 9),
            scope: { name: 'global' }
        };
        const targetParameter = {
            name: 'target',
            type: SymbolType.PARAMETER,
            range: new vscode.Range(4, 17, 4, 23),
            selectionRange: new vscode.Range(4, 17, 4, 23),
            scope: { name: 'function' }
        };
        const amountParameter = {
            name: 'amount',
            type: SymbolType.PARAMETER,
            range: new vscode.Range(4, 29, 4, 35),
            selectionRange: new vscode.Range(4, 29, 4, 35),
            scope: { name: 'function' }
        };
        const localSymbol = {
            name: 'local',
            type: SymbolType.VARIABLE,
            range: new vscode.Range(5, 8, 5, 13),
            selectionRange: new vscode.Range(5, 8, 5, 13),
            scope: { name: 'function' }
        };
        const symbols = [globalSymbol, functionSymbol, targetParameter, amountParameter, localSymbol];
        const symbolTable = {
            findSymbol: jest.fn((name: string, position: vscode.Position) => {
                if (name === 'target') {
                    return targetParameter;
                }
                if (name === 'amount') {
                    return amountParameter;
                }
                return symbols.find((symbol) => symbol.name === name);
            }),
            getGlobalScope: jest.fn(() => globalSymbol.scope)
        };
        const fill = jest.fn();
        const analysisService = {
            parseDocument: jest.fn().mockReturnValue({
                parsed: {
                    tokens: {
                        fill,
                        getTokens: () => [
                            tokenAt(LPCLexer.KW_INT, 'int', 1, 0),
                            tokenAt(LPCLexer.Identifier, 'disabled', 1, 4),
                            tokenAt(LPCLexer.KW_INT, 'int', 3, 0),
                            tokenAt(LPCLexer.Identifier, 'hp', 3, 4),
                            tokenAt(LPCLexer.KW_VOID, 'void', 4, 0),
                            tokenAt(LPCLexer.Identifier, 'heal', 4, 5),
                            tokenAt(LPCLexer.KW_OBJECT, 'object', 4, 10),
                            tokenAt(LPCLexer.Identifier, 'target', 4, 17),
                            tokenAt(LPCLexer.KW_INT, 'int', 4, 25),
                            tokenAt(LPCLexer.Identifier, 'amount', 4, 29),
                            tokenAt(LPCLexer.KW_INT, 'int', 5, 4),
                            tokenAt(LPCLexer.Identifier, 'local', 5, 8),
                            tokenAt(LPCLexer.Identifier, 'target', 6, 4),
                            tokenAt(LPCLexer.ARROW, '->', 6, 10),
                            tokenAt(LPCLexer.Identifier, 'heal', 6, 12),
                            tokenAt(LPCLexer.LPAREN, '(', 6, 16),
                            tokenAt(LPCLexer.Identifier, 'amount', 6, 17)
                        ]
                    },
                    frontend: {
                        preprocessor: {
                            inactiveRanges: [{
                                startOffset: text.indexOf('int disabled;'),
                                endOffset: text.indexOf('#endif'),
                                reason: 'condition-false'
                            }]
                        }
                    }
                },
                snapshot: {
                    symbolTable,
                    macroReferences: [],
                    fileGlobals: [{
                        name: 'hp',
                        range: globalSymbol.range,
                        selectionRange: globalSymbol.selectionRange,
                        dataType: 'int'
                    }]
                }
            })
        };

        const service = new DefaultLanguageSemanticTokensService(analysisService as any);
        const result = await service.provideSemanticTokens({
            context: createCapabilityContext(document)
        });

        expect(result.legend.tokenTypes).toEqual(expect.arrayContaining([
            'method',
            'parameter',
            'lpcType',
            'inactive'
        ]));
        expect(result.legend.tokenModifiers).toEqual(expect.arrayContaining([
            'declaration',
            'local'
        ]));
        expect(result.tokens).toEqual(expect.arrayContaining([
            expect.objectContaining({
                line: 1,
                startCharacter: 0,
                length: 13,
                tokenType: 'inactive'
            }),
            expect.objectContaining({
                line: 3,
                startCharacter: 0,
                length: 3,
                tokenType: 'lpcType'
            }),
            expect.objectContaining({
                line: 3,
                startCharacter: 4,
                length: 2,
                tokenType: 'variable',
                tokenModifiers: ['declaration']
            }),
            expect.objectContaining({
                line: 4,
                startCharacter: 5,
                length: 4,
                tokenType: 'function',
                tokenModifiers: ['declaration']
            }),
            expect.objectContaining({
                line: 4,
                startCharacter: 17,
                length: 6,
                tokenType: 'parameter',
                tokenModifiers: ['declaration', 'local']
            }),
            expect.objectContaining({
                line: 5,
                startCharacter: 8,
                length: 5,
                tokenType: 'variable',
                tokenModifiers: ['declaration', 'local']
            }),
            expect.objectContaining({
                line: 6,
                startCharacter: 12,
                length: 4,
                tokenType: 'method'
            }),
            expect.objectContaining({
                line: 6,
                startCharacter: 17,
                length: 6,
                tokenType: 'parameter',
                tokenModifiers: ['local']
            })
        ]));
    });

    test('DefaultLanguageSemanticTokensService does not classify uppercase identifiers as macros without macro facts', async () => {
        const document = createDocument('int HP = 1;');
        const symbolTable = {
            findSymbol: jest.fn((name: string) => {
                if (name === 'HP') {
                    return { type: SymbolType.VARIABLE };
                }
                return undefined;
            })
        };
        const analysisService = {
            parseDocument: jest.fn().mockReturnValue({
                parsed: {
                    tokens: {
                        fill: jest.fn(),
                        getTokens: () => [
                            createToken(LPCLexer.KW_INT, 'int', 1, 0),
                            createToken(LPCLexer.Identifier, 'HP', 1, 4),
                            createToken(LPCLexer.ASSIGN, '=', 1, 7),
                            createToken(LPCLexer.INTEGER, '1', 1, 9)
                        ]
                    }
                },
                snapshot: {
                    symbolTable,
                    macroReferences: []
                }
            })
        };

        const service = new DefaultLanguageSemanticTokensService(analysisService as any);
        const result = await service.provideSemanticTokens({
            context: createCapabilityContext(document)
        });

        expect(result.tokens).toEqual([
            { line: 0, startCharacter: 0, length: 3, tokenType: 'lpcType' },
            { line: 0, startCharacter: 4, length: 2, tokenType: 'variable' },
            { line: 0, startCharacter: 7, length: 1, tokenType: 'operator' },
            { line: 0, startCharacter: 9, length: 1, tokenType: 'number' }
        ]);
    });

    test('DefaultLanguageSemanticTokensService emits comment tokens from hidden-channel lexer output', async () => {
        const document = createDocument('/* note */\nvalue;\n');
        const fill = jest.fn();
        const analysisService = {
            parseDocument: jest.fn().mockReturnValue({
                parsed: {
                    tokens: {
                        fill,
                        getTokens: () => [
                            createToken(LPCLexer.BLOCK_COMMENT, '/* note */', 1, 0, 1),
                            createToken(LPCLexer.Identifier, 'value', 2, 0)
                        ]
                    }
                }
                ,
                snapshot: {
                    symbolTable: {
                        findSymbol: jest.fn(() => undefined)
                    }
                }
            })
        };

        const service = new DefaultLanguageSemanticTokensService(analysisService as any);
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
        const analysisService = {
            parseDocument: jest.fn().mockReturnValue({
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
                }
                ,
                snapshot: {
                    symbolTable: {
                        findSymbol: jest.fn(() => undefined)
                    }
                }
            })
        };

        const service = new DefaultLanguageSemanticTokensService(analysisService as any);
        const result = await service.provideSemanticTokens({
            context: createCapabilityContext(document)
        });

        expect(result.tokens).toEqual([
            {
                line: 0,
                startCharacter: 0,
                length: 5,
                tokenType: 'lpcType'
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

    test('DefaultLanguageSemanticTokensService emits standalone operator tokens for member and punctuation operators', async () => {
        const document = createDocument('payload->hp; value ? left : right; ob.field;');
        const fill = jest.fn();
        const analysisService = {
            parseDocument: jest.fn().mockReturnValue({
                parsed: {
                    tokens: {
                        fill,
                        getTokens: () => [
                            createToken(LPCLexer.Identifier, 'payload', 1, 0),
                            createToken(LPCLexer.ARROW, '->', 1, 7),
                            createToken(LPCLexer.Identifier, 'hp', 1, 9),
                            createToken(LPCLexer.QUESTION, '?', 1, 19),
                            createToken(LPCLexer.COLON, ':', 1, 26),
                            createToken(LPCLexer.Identifier, 'ob', 1, 35),
                            createToken(LPCLexer.DOT, '.', 1, 37),
                            createToken(LPCLexer.Identifier, 'field', 1, 38)
                        ]
                    }
                },
                snapshot: {
                    symbolTable: {
                        findSymbol: jest.fn(() => undefined)
                    }
                }
            })
        };

        const service = new DefaultLanguageSemanticTokensService(analysisService as any);
        const result = await service.provideSemanticTokens({
            context: createCapabilityContext(document)
        });

        expect(result.tokens).toEqual([
            {
                line: 0,
                startCharacter: 0,
                length: 7,
                tokenType: 'variable'
            },
            {
                line: 0,
                startCharacter: 7,
                length: 2,
                tokenType: 'operator'
            },
            {
                line: 0,
                startCharacter: 9,
                length: 2,
                tokenType: 'property'
            },
            {
                line: 0,
                startCharacter: 19,
                length: 1,
                tokenType: 'operator'
            },
            {
                line: 0,
                startCharacter: 26,
                length: 1,
                tokenType: 'operator'
            },
            {
                line: 0,
                startCharacter: 35,
                length: 2,
                tokenType: 'variable'
            },
            {
                line: 0,
                startCharacter: 37,
                length: 1,
                tokenType: 'operator'
            },
            {
                line: 0,
                startCharacter: 38,
                length: 5,
                tokenType: 'property'
            }
        ]);
    });

    test('DefaultLanguageSemanticTokensService splits multiline lexer tokens into line-local tokens', async () => {
        const document = createDocument('/* first\n * second\n */\nvalue;\n');
        const fill = jest.fn();
        const analysisService = {
            parseDocument: jest.fn().mockReturnValue({
                parsed: {
                    tokens: {
                        fill,
                        getTokens: () => [
                            createToken(LPCLexer.BLOCK_COMMENT, '/* first\n * second\n */', 1, 0, 1),
                            createToken(LPCLexer.Identifier, 'value', 4, 0)
                        ]
                    }
                },
                snapshot: {
                    symbolTable: {
                        findSymbol: jest.fn(() => undefined)
                    }
                }
            })
        };

        const service = new DefaultLanguageSemanticTokensService(analysisService as any);
        const result = await service.provideSemanticTokens({
            context: createCapabilityContext(document)
        });

        expect(result.tokens).toEqual([
            {
                line: 0,
                startCharacter: 0,
                length: 8,
                tokenType: 'comment'
            },
            {
                line: 1,
                startCharacter: 0,
                length: 9,
                tokenType: 'comment'
            },
            {
                line: 2,
                startCharacter: 0,
                length: 3,
                tokenType: 'comment'
            },
            {
                line: 3,
                startCharacter: 0,
                length: 5,
                tokenType: 'variable'
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
