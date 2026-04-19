import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as path from 'path';
import * as vscode from 'vscode';
import { QueryBackedLanguageCompletionService } from '../LanguageCompletionService';
import { DocumentSemanticSnapshotService } from '../../../../semantic/documentSemanticSnapshotService';
import { configureScopedMethodIdentifierAnalysisService } from '../../navigation/ScopedMethodIdentifierSupport';

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
        configureScopedMethodIdentifierAnalysisService(analysisService);
    });

    afterEach(() => {
        DocumentSemanticSnapshotService.getInstance().clear();
        configureScopedMethodIdentifierAnalysisService(undefined);
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
        const service = new QueryBackedLanguageCompletionService(
            efunDocsManager as any,
            macroManager as any,
            undefined,
            undefined,
            undefined,
            {
                analysisService,
                documentationService: documentationService as any,
                scopedDocumentLoader
            }
        ) as any;
        const applyStructuredDocumentation = jest.spyOn(service, 'applyStructuredDocumentation');

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
        expect(applyStructuredDocumentation).not.toHaveBeenCalled();
        expect(resolved.documentation?.value ?? '').toContain('object create()');
        expect(resolved.documentation?.value ?? '').toContain('Base room create');
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
        const service = new QueryBackedLanguageCompletionService(
            efunDocsManager as any,
            macroManager as any,
            undefined,
            undefined,
            undefined,
            {
                analysisService,
                documentationService: documentationService as any,
                scopedDocumentLoader
            }
        ) as any;
        const applyStructuredDocumentation = jest.spyOn(service, 'applyStructuredDocumentation');

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
        expect(applyStructuredDocumentation).not.toHaveBeenCalled();
        expect(resolved.documentation).toBeUndefined();
    });
});
