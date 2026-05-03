import { describe, expect, jest, test } from '@jest/globals';
import * as path from 'path';
import * as vscode from 'vscode';
import { InheritanceResolver } from '../../../../completion/inheritanceResolver';
import { ProjectSymbolIndex } from '../../../../completion/projectSymbolIndex';

declare const require: any;

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

function loadService(): any {
    return require('../CompletionItemPresentationService').CompletionItemPresentationService;
}

describe('CompletionItemPresentationService', () => {
    test('createCompletionItem keeps kind/detail/sort/data shape stable', () => {
        const CompletionItemPresentationService = loadService();
        const service = new CompletionItemPresentationService(
            {
                getStandardCallableDoc: jest.fn(),
                getSimulatedDoc: jest.fn()
            },
            new ProjectSymbolIndex(new InheritanceResolver()),
            { applyScopedDocumentation: jest.fn() }
        );
        const document = createDocument(path.join(process.cwd(), '.tmp-completion-presentation', 'demo.c'), 'demo();\n', 4);
        const candidate = {
            key: 'object-member:shared:query_name',
            label: 'query_name',
            kind: vscode.CompletionItemKind.Method,
            detail: 'string query_name',
            sortGroup: 'inherited',
            metadata: { sourceType: 'inherited', sourceUri: document.uri.toString() }
        };
        const result = {
            context: {
                kind: 'member',
                receiverChain: [],
                currentWord: '',
                linePrefix: 'ob->'
            }
        };

        const item = service.createCompletionItem(candidate as any, result as any, document);

        expect(item).toEqual({
            label: 'query_name',
            kind: 'method',
            detail: 'string query_name',
            sortText: '2_0_query_name',
            data: {
                candidate,
                context: result.context,
                documentUri: document.uri.toString(),
                documentVersion: 4,
                resolved: false
            }
        });
    });

    test('resolveCompletionItem attaches efun docs', async () => {
        const CompletionItemPresentationService = loadService();
        const service = new CompletionItemPresentationService(
            {
                getStandardCallableDoc: jest.fn(() => ({
                    name: 'write',
                    declarationKey: 'efun:write',
                    sourceKind: 'efun',
                    summary: 'Writes a message.',
                    signatures: [{
                        label: 'void write(string msg);',
                        returnType: 'void',
                        isVariadic: false,
                        parameters: [{ name: 'msg', type: 'string' }]
                    }]
                })),
                getSimulatedDoc: jest.fn()
            },
            new ProjectSymbolIndex(new InheritanceResolver()),
            { applyScopedDocumentation: jest.fn() }
        );
        const item = { label: 'write', detail: 'void write' };

        const resolved = await service.resolveCompletionItem(item as any, {
            key: 'efun:write',
            label: 'write',
            kind: vscode.CompletionItemKind.Function,
            detail: 'void write',
            sortGroup: 'builtin',
            metadata: { sourceType: 'efun' }
        } as any);

        expect(resolved.documentation?.value ?? '').toContain('void write(string msg);');
        expect(resolved.documentation?.value ?? '').toContain('Writes a message.');
        expect(resolved.insertText).toBe('write($1)');
    });

    test('resolveCompletionItem attaches macro docs', async () => {
        const CompletionItemPresentationService = loadService();
        const service = new CompletionItemPresentationService(
            {
                getStandardCallableDoc: jest.fn(),
                getSimulatedDoc: jest.fn()
            },
            new ProjectSymbolIndex(new InheritanceResolver()),
            { applyScopedDocumentation: jest.fn() }
        );

        const resolved = await service.resolveCompletionItem({ label: 'ROOM_D' } as any, {
            key: 'macro:ROOM_D',
            label: 'ROOM_D',
            kind: vscode.CompletionItemKind.Constant,
            detail: '#define ROOM_D',
            sortGroup: 'scope',
            metadata: { sourceType: 'macro' }
        } as any);

        expect(resolved.documentation?.value ?? '').toContain('#define ROOM_D');
    });

    test('resolveCompletionItem delegates scoped docs through ScopedMethodCompletionSupport', async () => {
        const CompletionItemPresentationService = loadService();
        const applyScopedDocumentation = jest.fn(async (item) => ({
            ...item,
            documentation: {
                kind: 'markdown',
                value: 'scoped callable docs'
            }
        }));
        const service = new CompletionItemPresentationService(
            {
                getStandardCallableDoc: jest.fn(),
                getSimulatedDoc: jest.fn()
            },
            new ProjectSymbolIndex(new InheritanceResolver()),
            { applyScopedDocumentation }
        );

        const resolved = await service.resolveCompletionItem({ label: 'create' } as any, {
            key: 'scoped:create',
            label: 'create',
            kind: vscode.CompletionItemKind.Method,
            detail: 'object create',
            sortGroup: 'inherited',
            metadata: { sourceType: 'scoped-method', declarationKey: 'decl-key' }
        } as any);

        expect(applyScopedDocumentation).toHaveBeenCalled();
        expect(resolved.documentation?.value).toBe('scoped callable docs');
    });

    test('resolveCompletionItem materializes structured docs from ProjectSymbolIndex records', async () => {
        const CompletionItemPresentationService = loadService();
        const sourceDocument = createDocument(
            path.join(process.cwd(), '.tmp-completion-presentation', 'room.c'),
            'string query_name(int mode) { return "room"; }\n'
        );
        const projectSymbolIndex = new ProjectSymbolIndex(new InheritanceResolver());
        projectSymbolIndex.updateFromSnapshot({
            uri: sourceDocument.uri.toString(),
            version: sourceDocument.version,
            exportedFunctions: [{
                name: 'query_name',
                returnType: 'string',
                parameters: [{
                    name: 'mode',
                    dataType: 'int',
                    range: new vscode.Range(0, 18, 0, 22)
                }],
                modifiers: [],
                sourceUri: sourceDocument.uri.toString(),
                range: new vscode.Range(0, 0, 0, 43),
                origin: 'local',
                definition: 'string query_name(int mode)',
                documentation: 'Structured room name docs'
            }],
            typeDefinitions: [],
            fileGlobals: [],
            inheritStatements: [],
            includeStatements: [],
            macroReferences: [],
            createdAt: Date.now()
        } as any);
        const service = new CompletionItemPresentationService(
            {
                getStandardCallableDoc: jest.fn(),
                getSimulatedDoc: jest.fn()
            },
            projectSymbolIndex,
            { applyScopedDocumentation: jest.fn() }
        );

        const resolved = await service.resolveCompletionItem({ label: 'query_name' } as any, {
            key: 'local:query_name',
            label: 'query_name',
            kind: vscode.CompletionItemKind.Function,
            detail: 'string query_name',
            sortGroup: 'scope',
            metadata: {
                sourceType: 'local',
                sourceUri: sourceDocument.uri.toString()
            }
        } as any);

        expect(resolved.documentation?.value ?? '').toContain('string query_name(int mode)');
        expect(resolved.documentation?.value ?? '').toContain('Structured room name docs');
        expect(resolved.insertText).toBe('query_name(${1:mode})');
    });
});
