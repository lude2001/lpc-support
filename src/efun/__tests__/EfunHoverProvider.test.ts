import * as vscode from 'vscode';
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

        const provider = new EfunHoverProvider(manager);
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

        const provider = new EfunHoverProvider(manager);
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
});
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
