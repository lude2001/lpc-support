import { describe, expect, jest, test } from '@jest/globals';
import * as path from 'path';
import * as vscode from 'vscode';
import { CallableDocRenderer } from '../../../documentation/CallableDocRenderer';

declare const require: any;

function createDocument(source: string, filePath = 'file:///D:/workspace/test.c'): any {
    return {
        uri: filePath.startsWith('file:///') ? filePath : vscode.Uri.file(filePath).toString(),
        path: filePath.startsWith('file:///') ? 'D:/workspace/test.c' : filePath,
        version: 1,
        getText: (range?: any) => {
            if (!range) {
                return source;
            }

            return source.slice(range.start.character, range.end.character);
        },
        getWordRangeAtPosition: (position: { line: number; character: number }) => {
            const isWordCharacter = (char: string | undefined) => Boolean(char && /[A-Za-z0-9_]/.test(char));
            let start = position.character;
            while (start > 0 && isWordCharacter(source[start - 1])) {
                start -= 1;
            }

            let end = position.character;
            while (end < source.length && isWordCharacter(source[end])) {
                end += 1;
            }

            if (start === end) {
                return undefined;
            }

            return {
                start: { line: 0, character: start },
                end: { line: 0, character: end }
            };
        }
    };
}

function createCallableDoc(name: string, label: string, summary: string) {
    return {
        name,
        declarationKey: `${name}-decl`,
        signatures: [{
            label,
            parameters: [],
            isVariadic: false
        }],
        summary,
        sourceKind: 'objectMethod' as const
    };
}

function loadResolver(): any {
    return require('../hover/ObjectMethodHoverResolver').ObjectMethodHoverResolver;
}

describe('ObjectMethodHoverResolver', () => {
    test('single implementation hover renders callable docs', async () => {
        const ObjectMethodHoverResolver = loadResolver();
        const resolver = new ObjectMethodHoverResolver({
            objectAccessProvider: {
                inferObjectAccess: jest.fn().mockResolvedValue({
                    memberName: 'query_name',
                    inference: {
                        status: 'resolved',
                        candidates: [{ path: 'D:/workspace/obj/npc.c', source: 'literal' }]
                    }
                })
            },
            methodResolver: {
                findMethod: jest.fn().mockResolvedValue({
                    path: 'D:/workspace/obj/npc.c',
                    documentText: 'string query_name() { return "npc"; }\n'
                })
            },
            documentationSupport: {
                toDocumentationTextDocument: jest.fn().mockReturnValue({
                    uri: { toString: () => 'synthetic://npc' },
                    fileName: 'D:/workspace/obj/npc.c',
                    version: 1,
                    getText: () => 'string query_name() { return "npc"; }\n'
                })
            },
            documentationService: {
                getDocsByName: jest.fn().mockReturnValue([
                    createCallableDoc('query_name', 'string query_name()', '返回名字')
                ])
            },
            renderer: new CallableDocRenderer()
        });

        const hover = await resolver.provideObjectHover(
            {} as any,
            createDocument('target->query_name();'),
            { line: 0, character: 10 }
        );

        expect(hover?.contents[0].value).toContain('string query_name()');
        expect(hover?.contents[0].value).toContain('返回名字');
    });

    test('multiple candidates converging on one implementation render merged docs with related paths', async () => {
        const ObjectMethodHoverResolver = loadResolver();
        const findMethod = jest.fn()
            .mockResolvedValueOnce({
                path: 'D:/workspace/std/base_npc.c',
                documentText: 'string query_name() { return "npc"; }\n'
            })
            .mockResolvedValueOnce({
                path: 'D:/workspace/std/base_npc.c',
                documentText: 'string query_name() { return "npc"; }\n'
            });
        const resolver = new ObjectMethodHoverResolver({
            objectAccessProvider: {
                inferObjectAccess: jest.fn().mockResolvedValue({
                    memberName: 'query_name',
                    inference: {
                        status: 'multiple',
                        candidates: [
                            { path: 'D:/workspace/obj/npc_a.c', source: 'literal' },
                            { path: 'D:/workspace/obj/npc_b.c', source: 'literal' }
                        ]
                    }
                })
            },
            methodResolver: { findMethod },
            documentationSupport: {
                toDocumentationTextDocument: jest.fn().mockReturnValue({
                    uri: { toString: () => 'synthetic://base_npc' },
                    fileName: 'D:/workspace/std/base_npc.c',
                    version: 1,
                    getText: () => 'string query_name() { return "npc"; }\n'
                })
            },
            documentationService: {
                getDocsByName: jest.fn().mockReturnValue([
                    createCallableDoc('query_name', 'string query_name()', '共同实现')
                ])
            },
            renderer: new CallableDocRenderer()
        });

        const hover = await resolver.provideObjectHover(
            {} as any,
            createDocument('target->query_name();'),
            { line: 0, character: 10 }
        );

        expect(hover?.contents[0].value).toContain('共同实现');
        expect(hover?.contents[0].value).toContain('部分分支继续沿用该实现');
        expect(hover?.contents[0].value).toContain('npc_a.c');
        expect(hover?.contents[0].value).toContain('npc_b.c');
    });

    test('multiple unresolved candidates fall back to summary hover text', async () => {
        const ObjectMethodHoverResolver = loadResolver();
        const resolver = new ObjectMethodHoverResolver({
            objectAccessProvider: {
                inferObjectAccess: jest.fn().mockResolvedValue({
                    memberName: 'query_name',
                    inference: {
                        status: 'multiple',
                        candidates: [
                            { path: 'D:/workspace/obj/npc_a.c', source: 'literal' },
                            { path: 'D:/workspace/obj/npc_b.c', source: 'literal' }
                        ]
                    }
                })
            },
            methodResolver: {
                findMethod: jest.fn().mockResolvedValue(undefined)
            },
            documentationSupport: {
                toDocumentationTextDocument: jest.fn()
            },
            documentationService: {
                getDocsByName: jest.fn()
            },
            renderer: new CallableDocRenderer()
        });

        const hover = await resolver.provideObjectHover(
            {} as any,
            createDocument('target->query_name();'),
            { line: 0, character: 10 }
        );

        expect(hover?.contents[0].value).toContain('可能来自多个对象的 `query_name`() 实现');
        expect(hover?.contents[0].value).toContain('npc_a.c');
        expect(hover?.contents[0].value).toContain('npc_b.c');
    });

    test('hovering outside the member name returns undefined', async () => {
        const ObjectMethodHoverResolver = loadResolver();
        const resolver = new ObjectMethodHoverResolver({
            objectAccessProvider: {
                inferObjectAccess: jest.fn().mockResolvedValue({
                    memberName: 'query_name',
                    inference: {
                        status: 'resolved',
                        candidates: [{ path: 'D:/workspace/obj/npc.c', source: 'literal' }]
                    }
                })
            },
            methodResolver: {
                findMethod: jest.fn()
            },
            documentationSupport: {
                toDocumentationTextDocument: jest.fn()
            },
            documentationService: {
                getDocsByName: jest.fn()
            },
            renderer: new CallableDocRenderer()
        });

        const hover = await resolver.provideObjectHover(
            {} as any,
            createDocument('target->query_name();'),
            { line: 0, character: 2 }
        );

        expect(hover).toBeUndefined();
    });
});
