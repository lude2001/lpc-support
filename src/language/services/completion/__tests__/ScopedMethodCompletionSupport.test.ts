import { describe, expect, jest, test } from '@jest/globals';
import * as path from 'path';
import * as vscode from 'vscode';
import { ScopedMethodDiscoveryResult } from '../../../../objectInference/ScopedMethodDiscoveryService';

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

function loadSupport(): any {
    return require('../ScopedMethodCompletionSupport').ScopedMethodCompletionSupport;
}

describe('ScopedMethodCompletionSupport', () => {
    test('scoped completion buildCandidates converts discovery results into scoped-method candidates', () => {
        const ScopedMethodCompletionSupport = loadSupport();
        const support = new ScopedMethodCompletionSupport({
            documentLoader: jest.fn()
        });
        const document = createDocument(
            path.join(process.cwd(), '.tmp-scoped-method-completion', 'std', 'room.c'),
            'object create() { return 0; }\n'
        );
        const discovery: ScopedMethodDiscoveryResult = {
            status: 'resolved',
            methods: [{
                name: 'create',
                path: document.uri.fsPath,
                documentUri: document.uri.toString(),
                declarationRange: new vscode.Range(0, 0, 0, 29),
                definition: 'object create() { return 0; }',
                documentation: 'Room create',
                returnType: 'object',
                parameters: []
            }]
        };

        const candidates = support.buildCandidates(discovery, document, 'create');

        expect(candidates).toHaveLength(1);
        expect(candidates[0].metadata.sourceType).toBe('scoped-method');
        expect(candidates[0].metadata.declarationKey).toBe(`${document.uri.toString()}#0:0-0:29`);
    });

    test('scoped completion resolveScopedDocumentation reads callable docs by declaration key', async () => {
        const ScopedMethodCompletionSupport = loadSupport();
        const targetDocument = createDocument(
            path.join(process.cwd(), '.tmp-scoped-method-completion', 'std', 'base_room.c'),
            [
                '/**',
                ' * @brief Base room create',
                ' */',
                'object create() { return 0; }'
            ].join('\n')
        );
        const documentLoader = jest.fn(async () => targetDocument);
        const documentationService = {
            getDocForDeclaration: jest.fn(() => ({
                declarationKey: `${targetDocument.uri.toString()}#3:0-3:30`,
                name: 'create',
                signature: 'object create()',
                documentation: 'Base room create'
            }))
        };
        const support = new ScopedMethodCompletionSupport({
            documentLoader,
            documentationService
        });

        const doc = await support.resolveScopedDocumentation({
            documentUri: targetDocument.uri.toString(),
            declarationKey: `${targetDocument.uri.toString()}#3:0-3:30`
        });

        expect(documentLoader).toHaveBeenCalledWith(targetDocument.uri.toString());
        expect(documentationService.getDocForDeclaration).toHaveBeenCalledWith(targetDocument, `${targetDocument.uri.toString()}#3:0-3:30`);
        expect(doc?.value ?? doc).toContain('object create()');
        expect(doc?.value ?? doc).toContain('Base room create');
    });

    test('scoped completion unknown or unsupported discovery results produce no candidates or fallback docs', async () => {
        const ScopedMethodCompletionSupport = loadSupport();
        const document = createDocument(
            path.join(process.cwd(), '.tmp-scoped-method-completion', 'std', 'room.c'),
            'void create() {}\n'
        );
        const support = new ScopedMethodCompletionSupport({
            documentLoader: jest.fn(),
            documentationService: {
                getDocForDeclaration: jest.fn()
            }
        });

        expect(support.buildCandidates({ status: 'unknown', methods: [] } as ScopedMethodDiscoveryResult, document, 'cr')).toEqual([]);
        expect(support.buildCandidates({ status: 'unsupported', methods: [], reason: 'unsupported-expression' } as ScopedMethodDiscoveryResult, document, 'cr')).toEqual([]);
        await expect(support.resolveScopedDocumentation({
            documentUri: document.uri.toString(),
            declarationKey: `${document.uri.toString()}#0:0-0:16`
        })).resolves.toBeUndefined();
    });
});
