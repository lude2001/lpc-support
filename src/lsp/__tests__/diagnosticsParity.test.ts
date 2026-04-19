import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import { ASTManager } from '../../ast/astManager';
import { DiagnosticsOrchestrator } from '../../diagnostics/DiagnosticsOrchestrator';
import type { LanguageDocument } from '../../language/contracts/LanguageDocument';
import { createSharedDiagnosticsService } from '../../language/services/diagnostics/createSharedDiagnosticsService';
import {
    configureAstManagerSingletonForTests,
    getAstManagerForTests,
    resetAstManagerSingletonForTests
} from '../../__tests__/testAstManagerSingleton';
import {
    createLanguageDiagnosticsService,
    type LanguageDiagnostic,
    type LanguageDiagnosticsAnalysis,
    type LanguageDiagnosticsCollector,
    type LanguageDiagnosticsRequest
} from '../../language/services/diagnostics/LanguageDiagnosticsService';
import { SyntaxKind } from '../../syntax/types';
import type { IDiagnosticCollector } from '../../diagnostics/types';

function createDocument(fileName: string, content: string, version = 1): vscode.TextDocument {
    const lines = content.split(/\r?\n/);
    const lineStarts = [0];

    for (let index = 0; index < content.length; index += 1) {
        if (content[index] === '\n') {
            lineStarts.push(index + 1);
        }
    }

    const offsetAt = (position: vscode.Position): number => {
        const lineStart = lineStarts[position.line] ?? content.length;
        return Math.min(lineStart + position.character, content.length);
    };

    return {
        uri: vscode.Uri.file(fileName),
        fileName,
        languageId: 'lpc',
        version,
        lineCount: lines.length,
        getText: jest.fn((range?: vscode.Range) => {
            if (!range) {
                return content;
            }

            return content.slice(offsetAt(range.start), offsetAt(range.end));
        }),
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
        }),
        offsetAt: jest.fn((position: vscode.Position) => offsetAt(position)),
        getWordRangeAtPosition: jest.fn((position: vscode.Position) => {
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
        })
    } as unknown as vscode.TextDocument;
}

function createSharedAnalysis(): LanguageDiagnosticsAnalysis {
    const snapshotDiagnostic: LanguageDiagnostic = {
        range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 1 }
        },
        severity: 'error',
        message: 'snapshot parse error'
    };

    return {
        syntax: {
            nodes: [
                {
                    kind: SyntaxKind.MemberAccessExpression,
                    children: [
                        {
                            kind: SyntaxKind.Identifier,
                            name: 'BAD_OBJECT',
                            range: new vscode.Range(1, 4, 1, 14)
                        },
                        {
                            kind: SyntaxKind.Identifier,
                            name: 'query_name',
                            range: new vscode.Range(1, 16, 1, 26)
                        }
                    ]
                }
            ]
        },
        semantic: {
            parseDiagnostics: []
        },
        parseDiagnostics: [snapshotDiagnostic]
    };
}

function createSharedParseResult() {
    const snapshotDiagnostic = new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 1),
        'snapshot parse error',
        vscode.DiagnosticSeverity.Error
    );

    return {
        parsed: {
            version: 1,
            tokens: {} as any,
            tree: {} as any,
            diagnostics: [],
            lastAccessed: Date.now(),
            parseTime: 1,
            size: 1
        },
        syntax: createSharedAnalysis().syntax,
        semantic: createSharedAnalysis().semantic,
        snapshot: {
            parseDiagnostics: [snapshotDiagnostic]
        }
    };
}

function normalizeDiagnostics(diagnostics: Array<LanguageDiagnostic | vscode.Diagnostic>): unknown {
    return diagnostics.map((diagnostic) => ({
        range: {
            start: {
                line: diagnostic.range.start.line,
                character: diagnostic.range.start.character
            },
            end: {
                line: diagnostic.range.end.line,
                character: diagnostic.range.end.character
            }
        },
        severity: typeof diagnostic.severity === 'string'
            ? diagnostic.severity
            : diagnostic.severity === vscode.DiagnosticSeverity.Error
                ? 'error'
                : diagnostic.severity === vscode.DiagnosticSeverity.Warning
                    ? 'warning'
                    : diagnostic.severity === vscode.DiagnosticSeverity.Information
                        ? 'information'
                        : 'hint',
        message: diagnostic.message,
        code: diagnostic.code,
        source: diagnostic.source
    }));
}

function createPureLanguageDocument(content: string): LanguageDocument {
    return {
        uri: 'file:///virtual/diagnostics-parity.c',
        version: 1,
        getText: () => content
    };
}

async function collectHostDiagnostics(
    document: vscode.TextDocument,
    collectors?: IDiagnosticCollector[],
    astManager?: ASTManager
): Promise<vscode.Diagnostic[]> {
    const macroManager = {
        getMacro: jest.fn(),
        getAllMacros: jest.fn(() => []),
        getMacroHoverContent: jest.fn(),
        canResolveMacro: jest.fn(),
        scanMacros: jest.fn(),
        getIncludePath: jest.fn(() => undefined)
    };
    const resolvedCollectors = collectors ?? [];
    const diagnosticsService = createSharedDiagnosticsService(astManager ?? getAstManagerForTests(), resolvedCollectors);
    const orchestrator = new DiagnosticsOrchestrator(
        { subscriptions: [], extensionPath: process.cwd() } as any,
        {
            diagnosticsService
        }
    );

    return await (orchestrator as any).collectDiagnostics(document);
}

function createHostParityCollector(): IDiagnosticCollector {
    return {
        name: 'ClassicParityCollector',
        collect: async (_document, _parsed, context) => {
            const receiver = context?.syntax?.nodes[0]?.children?.[0];
            if (!receiver?.range) {
                return [];
            }

            return [
                new vscode.Diagnostic(
                    receiver.range as vscode.Range,
                    '对象名应该使用大写字母和下划线，例如: USER_OB',
                    vscode.DiagnosticSeverity.Warning
                )
            ];
        }
    };
}

describe('diagnostics parity harness', () => {
    beforeEach(() => {
        configureAstManagerSingletonForTests();
        jest.clearAllMocks();
        (vscode.workspace as any).getWorkspaceFolder = jest.fn().mockReturnValue({
            uri: {
                fsPath: process.cwd()
            }
        });
        (vscode.workspace as any).onDidDeleteFiles = jest.fn().mockReturnValue({ dispose: jest.fn() });
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: jest.fn((key: string) => {
                if (key === 'batchSize') {
                    return 1;
                }

                return undefined;
            })
        });
        (vscode.languages.createDiagnosticCollection as jest.Mock).mockReturnValue({
            set: jest.fn(),
            delete: jest.fn(),
            clear: jest.fn(),
            dispose: jest.fn()
        });
    });

    afterEach(() => {
        resetAstManagerSingletonForTests();
    });

    test('shared diagnostics matches host diagnostics and stays on parser/syntax/semantic truth sources', async () => {
        const vscodeDocument = createDocument(
            '/virtual/diagnostics-parity.c',
            [
                'void demo() {',
                '    BAD_OBJECT->query_name();',
                '}'
            ].join('\n')
        );
        const parseDocumentSpy = jest.fn(() => createSharedParseResult());
        const astManager = {
            parseDocument: parseDocumentSpy,
            clearCache: jest.fn()
        } as unknown as ASTManager;
        const hostCollectors = [createHostParityCollector()];
        const hostDiagnostics = await collectHostDiagnostics(vscodeDocument, hostCollectors, astManager);
        const diagnosticsService = createLanguageDiagnosticsService({
            analyzeDocument: {
                analyze: jest.fn().mockResolvedValue(createSharedAnalysis())
            },
            collectors: [
                {
                    collect: async (_document, analysis) => {
                        const memberAccess = analysis.syntax?.nodes[0];
                        const receiver = memberAccess?.children?.[0];

                        if (!memberAccess || memberAccess.kind !== SyntaxKind.MemberAccessExpression || receiver?.kind !== SyntaxKind.Identifier) {
                            return [];
                        }

                        return [{
                            range: {
                                start: {
                                    line: receiver.range?.start.line ?? 0,
                                    character: receiver.range?.start.character ?? 0
                                },
                                end: {
                                    line: receiver.range?.end.line ?? 0,
                                    character: receiver.range?.end.character ?? 0
                                }
                            },
                            severity: 'warning',
                            message: '对象名应该使用大写字母和下划线，例如: USER_OB'
                        }];
                    }
                } satisfies LanguageDiagnosticsCollector
            ]
        });
        const request: LanguageDiagnosticsRequest = {
            context: {
                document: createPureLanguageDocument(vscodeDocument.getText()),
                workspace: {
                    workspaceRoot: process.cwd()
                },
                mode: 'lsp',
            }
        };

        const shared = await diagnosticsService.collectDiagnostics(request);

        expect(normalizeDiagnostics(shared)).toEqual(normalizeDiagnostics(hostDiagnostics));
        expect(parseDocumentSpy).toHaveBeenCalledTimes(1);
    });

    test('shared diagnostics service batches collectors and yields without requiring a vscode text document', async () => {
        const document = createPureLanguageDocument([
            'void demo() {',
            '    BAD_OBJECT->query_name();',
            '}'
        ].join('\n'));
        const analysis = createSharedAnalysis();
        const analyzer = {
            analyze: jest.fn().mockResolvedValue(analysis)
        };
        const collectorOne = {
            collect: jest.fn().mockResolvedValue([
                {
                    range: {
                        start: { line: 1, character: 4 },
                        end: { line: 1, character: 14 }
                    },
                    severity: 'warning',
                    message: '对象名应该使用大写字母和下划线，例如: USER_OB'
                }
            ])
        } satisfies LanguageDiagnosticsCollector;
        const collectorTwo = {
            collect: jest.fn().mockResolvedValue([
                {
                    range: {
                        start: { line: 0, character: 0 },
                        end: { line: 0, character: 1 }
                    },
                    severity: 'error',
                    message: 'snapshot parse error'
                }
            ])
        } satisfies LanguageDiagnosticsCollector;
        const yieldToMainThread = jest.fn().mockResolvedValue(undefined);
        const diagnosticsService = createLanguageDiagnosticsService({
            analyzeDocument: analyzer,
            collectors: [collectorOne, collectorTwo]
        });

        const diagnostics = await diagnosticsService.collectDiagnostics(
            {
                context: {
                    document,
                    workspace: {
                        workspaceRoot: process.cwd()
                    },
                    mode: 'lsp'
                }
            },
            {
                batchSize: 1,
                yieldToMainThread
            }
        );

        expect(analyzer.analyze).toHaveBeenCalledWith(document);
        expect(yieldToMainThread).toHaveBeenCalledTimes(2);
        expect(collectorOne.collect).toHaveBeenCalledWith(document, analysis, expect.objectContaining({
            document,
            workspace: {
                workspaceRoot: process.cwd()
            },
            mode: 'lsp'
        }));
        expect(collectorTwo.collect).toHaveBeenCalledWith(document, analysis, expect.objectContaining({
            document,
            workspace: {
                workspaceRoot: process.cwd()
            },
            mode: 'lsp'
        }));
        expect(normalizeDiagnostics(diagnostics)).toEqual([
            ...normalizeDiagnostics(analysis.parseDiagnostics),
            ...normalizeDiagnostics(await collectorOne.collect.mock.results[0].value),
            ...normalizeDiagnostics(await collectorTwo.collect.mock.results[0].value)
        ]);
    });

    test('diagnostics orchestrator async path passes batching and yield controls into the shared service', async () => {
        const document = createDocument(
            '/virtual/diagnostics-orchestrator-async.c',
            [
                'void demo() {',
                '    BAD_OBJECT->query_name();',
                '}'
            ].join('\n')
        );
        const collectDiagnostics = jest.fn(async (_request, options?: { batchSize?: number; yieldToMainThread?: () => Promise<void> }) => {
            await options?.yieldToMainThread?.();
            return [{
                range: {
                    start: { line: 1, character: 4 },
                    end: { line: 1, character: 14 }
                },
                severity: 'warning',
                message: '对象名应该使用大写字母和下划线，例如: USER_OB'
            } satisfies LanguageDiagnostic];
        });
        const orchestrator = new DiagnosticsOrchestrator(
            { subscriptions: [], extensionPath: process.cwd() } as any,
            {
                diagnosticsService: {
                    collectDiagnostics
                }
            }
        );
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: jest.fn((key: string, defaultValue?: unknown) => {
                if (key === 'enableAsyncDiagnostics') {
                    return true;
                }

                if (key === 'batchSize') {
                    return 2;
                }

                return defaultValue;
            })
        });

        const diagnostics = await (orchestrator as any).collectDiagnosticsAsync(document);

        expect(collectDiagnostics).toHaveBeenCalledWith(
            expect.objectContaining({
                context: expect.objectContaining({
                    mode: 'lsp',
                    workspace: {
                        workspaceRoot: process.cwd()
                    }
                })
            }),
            expect.objectContaining({
                batchSize: 2,
                yieldToMainThread: expect.any(Function)
            })
        );
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].message).toBe('对象名应该使用大写字母和下划线，例如: USER_OB');
    });
});
