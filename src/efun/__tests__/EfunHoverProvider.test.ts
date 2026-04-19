import * as vscode from 'vscode';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { EfunDocsManager } from '../../efunDocs';
import { FunctionDocumentationService } from '../../language/documentation/FunctionDocumentationService';
import {
    WorkspaceDocumentPathSupport,
    createVsCodeTextDocumentHost
} from '../../language/shared/WorkspaceDocumentPathSupport';
import { DocumentSemanticSnapshotService } from '../../semantic/documentSemanticSnapshotService';
import { SyntaxDocument, SyntaxKind, SyntaxNode } from '../../syntax/types';
import { EfunHoverProvider } from '../EfunHoverProvider';

const mockGetSyntaxDocument = jest.fn();

jest.mock('../../ast/astManager', () => ({
    ASTManager: {
        getInstance: () => ({
            getSyntaxDocument: mockGetSyntaxDocument
        })
    }
}));

function createIdentifier(name: string, start: number, end: number): SyntaxNode {
    return {
        kind: SyntaxKind.Identifier,
        category: 'expression',
        range: new vscode.Range(0, start, 0, end),
        tokenRange: { start, end },
        leadingTrivia: [],
        trailingTrivia: [],
        children: [],
        name,
        isMissing: false,
        isOpaque: false
    };
}

function createMemberAccessSyntaxDocument(memberName: string, memberStart: number, memberEnd: number): SyntaxDocument {
    const receiver = createIdentifier('target', 0, 6);
    const member = createIdentifier(memberName, memberStart, memberEnd);
    const memberAccess: SyntaxNode = {
        kind: SyntaxKind.MemberAccessExpression,
        category: 'expression',
        range: new vscode.Range(0, 0, 0, memberEnd),
        tokenRange: { start: 0, end: memberEnd },
        leadingTrivia: [],
        trailingTrivia: [],
        children: [receiver, member],
        isMissing: false,
        isOpaque: false
    };

    return {
        uri: 'test:///hover.c',
        version: 1,
        parsed: {} as any,
        root: {
            kind: SyntaxKind.SourceFile,
            category: 'document',
            range: new vscode.Range(0, 0, 0, memberEnd),
            tokenRange: { start: 0, end: memberEnd },
            leadingTrivia: [],
            trailingTrivia: [],
            children: [memberAccess],
            isMissing: false,
            isOpaque: false
        },
        nodes: [memberAccess, receiver, member],
        nodesByTokenRange: new Map(),
        metadata: {
            createdAt: Date.now(),
            nodeCount: 3,
            opaqueNodeCount: 0,
            missingNodeCount: 0
        }
    };
}

describe('EfunHoverProvider', () => {
    beforeEach(() => {
        mockGetSyntaxDocument.mockReset();
    });

    test('renders bundled standard efun documentation when no source-backed docs match', async () => {
        const content = 'write("hello");';
        mockGetSyntaxDocument.mockReturnValue(undefined);
        const manager = new EfunDocsManager({
            subscriptions: [],
            extensionPath: process.cwd()
        } as unknown as vscode.ExtensionContext, undefined, DocumentSemanticSnapshotService.getInstance(), undefined, new FunctionDocumentationService(), new WorkspaceDocumentPathSupport({
            host: createVsCodeTextDocumentHost()
        }));
        const provider = new EfunHoverProvider(manager, {
            getSyntaxDocument: mockGetSyntaxDocument
        } as any);
        const document = {
            uri: vscode.Uri.file('D:/code/lpc/room/test.c'),
            languageId: 'lpc',
            fileName: 'D:/code/lpc/room/test.c',
            version: 1,
            getWordRangeAtPosition: jest.fn().mockReturnValue(new vscode.Range(0, 0, 0, 5)),
            getText: jest.fn((range?: vscode.Range) => {
                if (!range) {
                    return content;
                }

                return content.slice(range.start.character, range.end.character);
            })
        } as unknown as vscode.TextDocument;

        const hover = await provider.provideHover(document, new vscode.Position(0, 2));

        expect(hover).toBeInstanceOf(vscode.Hover);
        const markdown = (hover as vscode.Hover).contents as vscode.MarkdownString;
        expect(markdown.value).toContain('void write(mixed str)');
        expect(markdown.value).toContain('对当前玩家显示');
    });

    test('prefers current-file callable docs over inherited, include, simulated, and standard efun sources', async () => {
        const content = 'shared_call();';
        mockGetSyntaxDocument.mockReturnValue(undefined);
        const manager = {
            prepareHoverLookup: jest.fn().mockResolvedValue(undefined),
            getCurrentFileDoc: jest.fn().mockReturnValue({
                name: 'shared_call',
                syntax: 'int shared_call()',
                description: 'current-file docs'
            }),
            getInheritedFileDoc: jest.fn().mockReturnValue({
                name: 'shared_call',
                syntax: 'int shared_call()',
                description: 'inherited docs'
            }),
            getIncludedFileDoc: jest.fn().mockResolvedValue({
                name: 'shared_call',
                syntax: 'int shared_call()',
                description: 'include docs'
            }),
            getSimulatedDoc: jest.fn().mockReturnValue({
                name: 'shared_call',
                syntax: 'int shared_call()',
                description: 'simulated docs'
            }),
            getStandardCallableDoc: jest.fn().mockReturnValue({
                name: 'shared_call',
                declarationKey: 'efun:shared_call',
                sourceKind: 'efun',
                signatures: [{
                    label: 'int shared_call()',
                    returnType: 'int',
                    parameters: [],
                    isVariadic: false
                }],
                summary: 'standard efun docs'
            }),
            getEfunDoc: jest.fn()
        } as any;

        const provider = new EfunHoverProvider(manager, {
            getSyntaxDocument: mockGetSyntaxDocument
        } as any);
        const document = {
            getWordRangeAtPosition: jest.fn().mockReturnValue(new vscode.Range(0, 0, 0, 11)),
            getText: jest.fn((range?: vscode.Range) => {
                if (!range) {
                    return content;
                }

                return content.slice(range.start.character, range.end.character);
            })
        } as unknown as vscode.TextDocument;

        const hover = await provider.provideHover(document, new vscode.Position(0, 2));

        expect(hover).toBeInstanceOf(vscode.Hover);
        const markdown = (hover as vscode.Hover).contents as vscode.MarkdownString;
        expect(markdown.value).toContain('current-file docs');
        expect(markdown.value).not.toContain('inherited docs');
        expect(markdown.value).not.toContain('include docs');
        expect(markdown.value).not.toContain('simulated docs');
        expect(markdown.value).not.toContain('standard efun docs');
        expect(manager.prepareHoverLookup).toHaveBeenCalledTimes(1);
        expect(manager.getCurrentFileDoc).toHaveBeenCalledWith('shared_call');
        expect(manager.getInheritedFileDoc).not.toHaveBeenCalled();
        expect(manager.getIncludedFileDoc).not.toHaveBeenCalled();
        expect(manager.getSimulatedDoc).not.toHaveBeenCalled();
        expect(manager.getStandardCallableDoc).not.toHaveBeenCalled();
        expect(manager.getEfunDoc).not.toHaveBeenCalled();
    });

    test('does not fall back to simulated or standard efun docs for arrow member access', async () => {
        const content = 'target->write();';
        mockGetSyntaxDocument.mockReturnValue(createMemberAccessSyntaxDocument('write', 8, 13));
        const manager = {
            prepareHoverLookup: jest.fn().mockResolvedValue(undefined),
            getCurrentFileDoc: jest.fn().mockReturnValue(undefined),
            getInheritedFileDoc: jest.fn().mockReturnValue(undefined),
            getIncludedFileDoc: jest.fn().mockResolvedValue(undefined),
            getSimulatedDoc: jest.fn(),
            getEfunDoc: jest.fn()
        } as any;

        const provider = new EfunHoverProvider(manager, {
            getSyntaxDocument: mockGetSyntaxDocument
        } as any);
        const document = {
            getWordRangeAtPosition: jest.fn().mockReturnValue(new vscode.Range(0, 8, 0, 13)),
            getText: jest.fn((range?: vscode.Range) => {
                if (!range) {
                    return content;
                }

                return content.slice(range.start.character, range.end.character);
            })
        } as unknown as vscode.TextDocument;

        const hover = await provider.provideHover(document, new vscode.Position(0, 10));

        expect(hover).toBeUndefined();
        expect(manager.getCurrentFileDoc).not.toHaveBeenCalled();
        expect(manager.getInheritedFileDoc).not.toHaveBeenCalled();
        expect(manager.getIncludedFileDoc).not.toHaveBeenCalled();
        expect(manager.getSimulatedDoc).not.toHaveBeenCalled();
        expect(manager.getEfunDoc).not.toHaveBeenCalled();
    });

    test('does not fall back to simulated or standard efun docs when arrow access includes trivia', async () => {
        const content = 'target-> /* gap */ write();';
        mockGetSyntaxDocument.mockReturnValue(createMemberAccessSyntaxDocument('write', 19, 24));
        const manager = {
            prepareHoverLookup: jest.fn().mockResolvedValue(undefined),
            getCurrentFileDoc: jest.fn().mockReturnValue(undefined),
            getInheritedFileDoc: jest.fn().mockReturnValue(undefined),
            getIncludedFileDoc: jest.fn().mockResolvedValue(undefined),
            getSimulatedDoc: jest.fn(),
            getEfunDoc: jest.fn()
        } as any;

        const provider = new EfunHoverProvider(manager, {
            getSyntaxDocument: mockGetSyntaxDocument
        } as any);
        const document = {
            getWordRangeAtPosition: jest.fn().mockReturnValue(new vscode.Range(0, 19, 0, 24)),
            getText: jest.fn((range?: vscode.Range) => {
                if (!range) {
                    return content;
                }

                return content.slice(range.start.character, range.end.character);
            })
        } as unknown as vscode.TextDocument;

        const hover = await provider.provideHover(document, new vscode.Position(0, 21));

        expect(hover).toBeUndefined();
        expect(manager.getSimulatedDoc).not.toHaveBeenCalled();
        expect(manager.getEfunDoc).not.toHaveBeenCalled();
    });

    test('prefers the in-file implementation hover over a leading prototype with the same name', async () => {
        const content = [
            'private mapping execute_command(object actor, string arg);',
            '',
            'void demo() {',
            '    execute_command(this_object(), "go");',
            '}',
            '',
            '/**',
            ' * @brief 执行最小正式突破命令的结构化逻辑。',
            ' */',
            'mapping execute_command(object actor, string arg) {',
            '    return ([]);',
            '}'
        ].join('\n');
        mockGetSyntaxDocument.mockReturnValue(undefined);
        const manager = new EfunDocsManager({
            subscriptions: [],
            extensionPath: process.cwd()
        } as unknown as vscode.ExtensionContext, undefined, DocumentSemanticSnapshotService.getInstance(), undefined, new FunctionDocumentationService(), new WorkspaceDocumentPathSupport({
            host: createVsCodeTextDocumentHost()
        }));
        const provider = new EfunHoverProvider(manager, {
            getSyntaxDocument: mockGetSyntaxDocument
        } as any);
        const document = {
            uri: vscode.Uri.file('D:/workspace/prototype-hover.c'),
            languageId: 'lpc',
            fileName: 'D:/workspace/prototype-hover.c',
            version: 1,
            getWordRangeAtPosition: jest.fn().mockReturnValue(new vscode.Range(3, 4, 3, 19)),
            getText: jest.fn((range?: vscode.Range) => {
                if (!range) {
                    return content;
                }

                const lines = content.split('\n');
                const startOffset = lines.slice(0, range.start.line).reduce((sum, line) => sum + line.length + 1, 0) + range.start.character;
                const endOffset = lines.slice(0, range.end.line).reduce((sum, line) => sum + line.length + 1, 0) + range.end.character;
                return content.slice(startOffset, endOffset);
            }),
            positionAt: jest.fn(),
            offsetAt: jest.fn(),
            lineAt: jest.fn((line: number) => ({ text: content.split('\n')[line] ?? '' }))
        } as unknown as vscode.TextDocument;

        const hover = await provider.provideHover(document, new vscode.Position(3, 8));

        expect(hover).toBeInstanceOf(vscode.Hover);
        const markdown = (hover as vscode.Hover).contents as vscode.MarkdownString;
        expect(markdown.value).toContain('mapping execute_command(object actor, string arg)');
        expect(markdown.value).toContain('执行最小正式突破命令的结构化逻辑');
        expect(markdown.value).not.toContain('private mapping execute_command(object actor, string arg);');
    });
});
