import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as path from 'path';
import * as vscode from 'vscode';
import {
    createDefaultQueryBackedLanguageCompletionService
} from '../LanguageCompletionService';
import { CompletionContextAnalyzer } from '../../../../completion/completionContextAnalyzer';
import { CompletionInstrumentation } from '../../../../completion/completionInstrumentation';
import { InheritanceResolver } from '../../../../completion/inheritanceResolver';
import { ProjectSymbolIndex } from '../../../../completion/projectSymbolIndex';
import { ScopedMethodCompletionSupport } from '../ScopedMethodCompletionSupport';
import { createVsCodeTextDocumentHost } from '../../../shared/WorkspaceDocumentPathSupport';
import { DocumentSemanticSnapshotService } from '../../../../semantic/documentSemanticSnapshotService';
import { createDefaultScopedMethodDiscoveryService } from '../../../../objectInference/ScopedMethodDiscoveryService';

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
        getText: () => content,
        lineAt: (lineOrPosition: number | vscode.Position) => {
            const line = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
            return { text: lines[line] ?? '' };
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
        offsetAt: (position: vscode.Position) => offsetAt(position)
    } as unknown as vscode.TextDocument;
}

describe('LanguageCompletionService scoped completion resolve', () => {
    const efunDocsManager = {
        getAllFunctions: jest.fn(() => []),
        getStandardDoc: jest.fn(() => undefined),
        getAllSimulatedFunctions: jest.fn(() => []),
        getSimulatedDoc: jest.fn(() => undefined)
    };
    const macroManager = {
        getMacro: jest.fn(),
        getAllMacros: jest.fn(() => []),
        getMacroHoverContent: jest.fn(),
        scanMacros: jest.fn(),
        getIncludePath: jest.fn(() => undefined),
        canResolveMacro: jest.fn(() => false)
    };

    const analysisService = DocumentSemanticSnapshotService.getInstance();

    beforeEach(() => {
    });

    afterEach(() => {
        DocumentSemanticSnapshotService.getInstance().clear();
    });

    test('scoped completion resolveCompletionItem loads callable docs by declaration key', async () => {
        const targetDocument = createDocument(
            path.join(process.cwd(), '.tmp-scoped-method-completion', 'std', 'base_room.c'),
            [
                '/**',
                ' * @brief Base room create',
                ' */',
                'object create() {',
                '    return 0;',
                '}'
            ].join('\n')
        );
        const scopedDocumentLoader = jest.fn(async () => targetDocument);
        const documentationService = {
            getDocForDeclaration: jest.fn(() => ({
                declarationKey: `${targetDocument.uri.toString()}#3:0-5:1`,
                name: 'create',
                signature: 'object create()',
                documentation: 'Base room create'
            }))
        };
        const documentHost = createVsCodeTextDocumentHost();
        const service = createDefaultQueryBackedLanguageCompletionService({
            efunDocsManager: efunDocsManager as any,
            macroManager: macroManager as any,
            analysisService,
            documentationService: documentationService as any,
            objectInferenceService: {} as any,
            instrumentation: new CompletionInstrumentation(),
            inheritanceReporter: {
                clear: jest.fn(),
                show: jest.fn(),
                appendLine: jest.fn()
            } as any,
            projectSymbolIndex: new ProjectSymbolIndex(new InheritanceResolver(macroManager as any)),
            contextAnalyzer: new CompletionContextAnalyzer(),
            scopedMethodDiscoveryService: createDefaultScopedMethodDiscoveryService({
                macroManager: macroManager as any,
                analysisService,
                host: documentHost
            }),
            scopedCompletionSupport: new ScopedMethodCompletionSupport({
                documentationService: documentationService as any,
                documentLoader: scopedDocumentLoader
            })
        }) as any;

        const resolved = await service.resolveCompletionItem({
            context: {
                document: targetDocument,
                workspace: { workspaceRoot: process.cwd() },
                cancellation: { isCancellationRequested: false }
            } as any,
            item: {
                label: 'create',
                detail: 'scoped detail sentinel',
                data: {
                    candidate: {
                        key: 'scoped-method:create',
                        label: 'create',
                        kind: vscode.CompletionItemKind.Method,
                        detail: 'scoped detail sentinel',
                        sortGroup: 'inherited',
                        metadata: {
                            sourceType: 'scoped-method',
                            sourceUri: targetDocument.uri.toString(),
                            declarationKey: `${targetDocument.uri.toString()}#3:0-5:1`
                        }
                    },
                    context: {
                        kind: 'scoped-member',
                        receiverChain: [],
                        receiverExpression: '::',
                        currentWord: 'cr',
                        linePrefix: '::cr'
                    },
                    documentUri: targetDocument.uri.toString(),
                    documentVersion: targetDocument.version
                }
            } as any
        });

        expect(scopedDocumentLoader).toHaveBeenCalledWith(targetDocument.uri.toString());
        expect(documentationService.getDocForDeclaration).toHaveBeenCalledWith(targetDocument, `${targetDocument.uri.toString()}#3:0-5:1`);
        expect(resolved.documentation?.value ?? '').toContain('object create()');
        expect(resolved.documentation?.value ?? '').toContain('Base room create');
        expect(resolved.documentation?.value ?? '').not.toContain('scoped detail sentinel');
    });

    test('scoped completion resolveCompletionItem does not fabricate docs for ambiguous merged candidates', async () => {
        const targetDocument = createDocument(
            path.join(process.cwd(), '.tmp-scoped-method-completion', 'std', 'room.c'),
            'void init() {}\n'
        );
        const scopedDocumentLoader = jest.fn();
        const documentationService = {
            getDocForDeclaration: jest.fn()
        };
        const documentHost = createVsCodeTextDocumentHost();
        const service = createDefaultQueryBackedLanguageCompletionService({
            efunDocsManager: efunDocsManager as any,
            macroManager: macroManager as any,
            analysisService,
            documentationService: documentationService as any,
            objectInferenceService: {} as any,
            instrumentation: new CompletionInstrumentation(),
            inheritanceReporter: {
                clear: jest.fn(),
                show: jest.fn(),
                appendLine: jest.fn()
            } as any,
            projectSymbolIndex: new ProjectSymbolIndex(new InheritanceResolver(macroManager as any)),
            contextAnalyzer: new CompletionContextAnalyzer(),
            scopedMethodDiscoveryService: createDefaultScopedMethodDiscoveryService({
                macroManager: macroManager as any,
                analysisService,
                host: documentHost
            }),
            scopedCompletionSupport: new ScopedMethodCompletionSupport({
                documentationService: documentationService as any,
                documentLoader: scopedDocumentLoader
            })
        }) as any;

        const resolved = await service.resolveCompletionItem({
            context: {
                document: targetDocument,
                workspace: { workspaceRoot: process.cwd() },
                cancellation: { isCancellationRequested: false }
            } as any,
            item: {
                label: 'init',
                data: {
                    candidate: {
                        key: 'scoped-method:multiple:init',
                        label: 'init',
                        kind: vscode.CompletionItemKind.Method,
                        detail: 'void init',
                        sortGroup: 'inherited',
                        metadata: {
                            sourceType: 'scoped-method'
                        }
                    },
                    context: {
                        kind: 'scoped-member',
                        receiverChain: [],
                        receiverExpression: '::',
                        currentWord: 'in',
                        linePrefix: '::in'
                    },
                    documentUri: targetDocument.uri.toString(),
                    documentVersion: targetDocument.version
                }
            } as any
        });

        expect(scopedDocumentLoader).not.toHaveBeenCalled();
        expect(documentationService.getDocForDeclaration).not.toHaveBeenCalled();
        expect(resolved.documentation).toBeUndefined();
    });
});
