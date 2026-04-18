import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import { ASTManager } from '../ast/astManager';
import { AstBackedLanguageReferenceService } from '../language/services/navigation/LanguageReferenceService';
import { AstBackedLanguageRenameService } from '../language/services/navigation/LanguageRenameService';
import { AstBackedLanguageSymbolService } from '../language/services/navigation/LanguageSymbolService';
import { disposeGlobalParsedDocumentService } from '../parser/ParsedDocumentService';
import {
    configureSymbolReferenceAnalysisService,
    resolveSymbolReferences
} from '../symbolReferenceResolver';
import { TestHelper } from './utils/TestHelper';

function createContext(document: vscode.TextDocument) {
    return {
        document,
        workspace: {
            workspaceRoot: process.cwd()
        },
        mode: 'lsp' as const,
        cancellation: {
            isCancellationRequested: false
        }
    };
}

describe('local symbol references', () => {
    const source = [
        'void alpha() {',
        '    int round = 1;',
        '    round += 1;',
        '}',
        '',
        'void beta() {',
        '    int round = 2;',
        '    round += 2;',
        '}'
    ].join('\n');

    const getRoundPosition = (line: number, occurrence: number = 0): vscode.Position => {
        const text = source.split('\n')[line];
        let searchStart = 0;
        let column = -1;

        for (let index = 0; index <= occurrence; index += 1) {
            column = text.indexOf('round', searchStart);
            searchStart = column + 'round'.length;
        }

        return new vscode.Position(line, column + 1);
    };

    afterEach(() => {
        ASTManager.getInstance().clearAllCache();
        configureSymbolReferenceAnalysisService(undefined);
    });

    afterAll(() => {
        disposeGlobalParsedDocumentService();
    });

    test('resolves only references bound to the local variable in the current function', () => {
        const document = TestHelper.createMockDocument(source);
        const analysisService = {
            parseDocument: ASTManager.getInstance().parseDocument.bind(ASTManager.getInstance())
        };
        const references = resolveSymbolReferences(document, getRoundPosition(2), analysisService);

        expect(references?.matches.map(match => match.range.start.line)).toEqual([1, 2]);
        expect(references?.matches.every(match => match.range.start.line < 5)).toBe(true);
    });

    test('reference service excludes same-named locals from other functions', async () => {
        const document = TestHelper.createMockDocument(source);
        configureSymbolReferenceAnalysisService({
            parseDocument: ASTManager.getInstance().parseDocument.bind(ASTManager.getInstance())
        });
        const service = new AstBackedLanguageReferenceService();
        const locations = await service.provideReferences({
            context: createContext(document),
            position: {
                line: 2,
                character: 5
            },
            includeDeclaration: true
        });

        expect(locations.map(location => location.range.start.line)).toEqual([1, 2]);
    });

    test('rename service only edits the selected local variable scope', async () => {
        const document = TestHelper.createMockDocument(source);
        configureSymbolReferenceAnalysisService({
            parseDocument: ASTManager.getInstance().parseDocument.bind(ASTManager.getInstance())
        });
        const service = new AstBackedLanguageRenameService();
        const edits = await service.provideRenameEdits({
            context: createContext(document),
            position: {
                line: 2,
                character: 5
            },
            newName: 'turn'
        });

        const changes = edits.changes[document.uri.toString()];
        expect(changes.map(change => change.range.start.line)).toEqual([1, 2]);
        expect(changes.every(change => change.newText === 'turn')).toBe(true);
    });

    test('reference service preserves includeDeclaration filtering for current-file references', async () => {
        const document = TestHelper.createMockDocument(source);
        configureSymbolReferenceAnalysisService({
            parseDocument: ASTManager.getInstance().parseDocument.bind(ASTManager.getInstance())
        });
        const service = new AstBackedLanguageReferenceService();

        const references = await service.provideReferences({
            context: createContext(document),
            position: {
                line: 2,
                character: 6
            },
            includeDeclaration: false
        });

        expect(references.map((reference) => reference.range.start.line)).toEqual([2]);
    });

    test('rename service returns precise same-file edit ranges from resolved references', async () => {
        const document = TestHelper.createMockDocument(source);
        configureSymbolReferenceAnalysisService({
            parseDocument: ASTManager.getInstance().parseDocument.bind(ASTManager.getInstance())
        });
        const service = new AstBackedLanguageRenameService();

        const edit = await service.provideRenameEdits({
            context: createContext(document),
            position: {
                line: 2,
                character: 6
            },
            newName: 'turn'
        });

        expect(edit.changes[document.uri.toString()].map((change) => change.range.start.line)).toEqual([1, 2]);
        expect(edit.changes[document.uri.toString()].every((change) => change.newText === 'turn')).toBe(true);
    });

    test('symbol service reuses semantic summaries for classes, structs, functions, and child members', async () => {
        const document = TestHelper.createMockDocument(source);
        const getBestAvailableSnapshot = jest.fn().mockReturnValue({
            typeDefinitions: [
                {
                    name: 'Payload',
                    kind: 'class',
                    members: [
                        {
                            name: 'query_name',
                            dataType: 'string',
                            parameters: [{ name: 'who', dataType: 'object', range: new vscode.Range(0, 0, 0, 0) }],
                            range: new vscode.Range(0, 0, 0, 0)
                        },
                        {
                            name: 'query_id',
                            dataType: 'string',
                            parameters: [],
                            range: new vscode.Range(0, 0, 0, 0)
                        },
                        {
                            name: 'hp',
                            dataType: 'int',
                            range: new vscode.Range(0, 0, 0, 0)
                        }
                    ],
                    sourceUri: document.uri.toString(),
                    range: new vscode.Range(0, 0, 1, 0)
                },
                {
                    name: 'Stats',
                    kind: 'struct',
                    members: [
                        {
                            name: 'mp',
                            dataType: 'int',
                            range: new vscode.Range(0, 0, 0, 0)
                        }
                    ],
                    sourceUri: document.uri.toString(),
                    range: new vscode.Range(2, 0, 3, 0)
                }
            ],
            exportedFunctions: [
                {
                    name: 'alpha',
                    returnType: 'void',
                    parameters: [],
                    modifiers: [],
                    sourceUri: document.uri.toString(),
                    origin: 'local',
                    range: new vscode.Range(4, 0, 5, 0)
                }
            ]
        } as any);
        const service = new AstBackedLanguageSymbolService({
            analysisService: { getBestAvailableSnapshot }
        });

        const symbols = await service.provideDocumentSymbols({
            context: createContext(document)
        });

        expect(symbols.map((symbol) => symbol.name)).toEqual(['Payload', 'Stats', 'alpha']);
        expect(symbols[0].children?.map((child) => child.name)).toEqual(['query_name', 'query_id', 'hp']);
        expect(symbols[0].children?.[0].kind).toBe('method');
        expect(symbols[0].children?.[1].kind).toBe('method');
        expect(symbols[1].children?.[0].kind).toBe('field');
        expect(getBestAvailableSnapshot).toHaveBeenCalledWith(document as any);
    });
});
