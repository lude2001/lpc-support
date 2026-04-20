import { afterEach, describe, expect, jest, test } from '@jest/globals';
import * as path from 'path';
import * as vscode from 'vscode';
import { clearGlobalParsedDocumentService } from '../../parser/ParsedDocumentService';
import { DocumentSemanticSnapshotService } from '../../semantic/documentSemanticSnapshotService';
import { SyntaxKind, SyntaxNode } from '../../syntax/types';
import { WorkspaceDocumentPathSupport } from '../../language/shared/WorkspaceDocumentPathSupport';
import { unknownValue, literalValue, unionValue } from '../valueFactories';
import { createStaticEvaluationContext } from '../static/StaticEvaluationContext';
import { createStaticEvaluationState } from '../static/StaticEvaluationState';
import { ExpressionEvaluator } from '../static/ExpressionEvaluator';
import { StatementTransfer } from '../static/StatementTransfer';
import { CallTargetResolver } from '../calls/CallTargetResolver';
import { CalleeReturnEvaluator } from '../calls/CalleeReturnEvaluator';

function createTextDocument(uriValue: string, source: string, version: number = 1): vscode.TextDocument {
    const uri = uriValue.startsWith('file:')
        ? vscode.Uri.file(vscode.Uri.parse(uriValue).fsPath)
        : vscode.Uri.file(uriValue);
    const lines = source.split(/\r?\n/);
    const lineStarts = [0];

    for (let index = 0; index < source.length; index += 1) {
        if (source[index] === '\n') {
            lineStarts.push(index + 1);
        }
    }

    const offsetAt = (position: vscode.Position): number => {
        const lineStart = lineStarts[position.line] ?? source.length;
        return Math.min(lineStart + position.character, source.length);
    };

    const positionAt = (offset: number): vscode.Position => {
        let line = 0;
        for (let index = 0; index < lineStarts.length; index += 1) {
            if (lineStarts[index] <= offset) {
                line = index;
            } else {
                break;
            }
        }

        return new vscode.Position(line, offset - lineStarts[line]);
    };

    return {
        uri,
        fileName: uri.fsPath,
        languageId: 'lpc',
        version,
        lineCount: lines.length,
        isDirty: false,
        isClosed: false,
        isUntitled: false,
        eol: vscode.EndOfLine.LF,
        getText: jest.fn((range?: vscode.Range) => {
            if (!range) {
                return source;
            }

            return source.slice(offsetAt(range.start), offsetAt(range.end));
        }),
        lineAt: jest.fn((line: number) => ({ text: lines[line] ?? '' })),
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
        }),
        positionAt: jest.fn(positionAt),
        offsetAt: jest.fn(offsetAt),
        save: jest.fn(async () => true),
        validateRange: jest.fn((range: vscode.Range) => range),
        validatePosition: jest.fn((position: vscode.Position) => position)
    } as unknown as vscode.TextDocument;
}

function createDocumentHost(documents: readonly vscode.TextDocument[]) {
    const byUri = new Map<string, vscode.TextDocument>();
    const byFsPath = new Map<string, vscode.TextDocument>();
    const normalizeFsPath = (value: string) => path.normalize(value);

    for (const document of documents) {
        byUri.set(document.uri.toString(), document);
        byFsPath.set(normalizeFsPath(document.uri.fsPath), document);
    }

    return {
        openTextDocument: jest.fn(async (target: string | vscode.Uri) => {
            const key = typeof target === 'string' ? target : target.toString();
            const document = byUri.get(key) ?? byFsPath.get(normalizeFsPath(key));
            if (!document) {
                throw new Error(`Unknown document ${key}`);
            }

            return document;
        }),
        fileExists: (filePath: string) => byFsPath.has(normalizeFsPath(filePath)),
        getWorkspaceFolder: (uri: vscode.Uri) => ({ uri: { fsPath: path.dirname(uri.fsPath) } })
    };
}

function findFirstNode(root: SyntaxNode, predicate: (node: SyntaxNode) => boolean): SyntaxNode | undefined {
    const queue: SyntaxNode[] = [root];

    while (queue.length > 0) {
        const current = queue.shift()!;
        if (predicate(current)) {
            return current;
        }

        queue.push(...current.children);
    }

    return undefined;
}

function prepareCallEvaluation(
    documents: readonly vscode.TextDocument[],
    callerDocument: vscode.TextDocument,
    initialBindings: Record<string, ReturnType<typeof literalValue> | ReturnType<typeof unknownValue>> = {}
): {
    context: ReturnType<typeof createStaticEvaluationContext>;
    state: ReturnType<typeof createStaticEvaluationState>;
    callExpression: SyntaxNode;
} {
    const analysisService = DocumentSemanticSnapshotService.getInstance();
    const syntax = analysisService.getSyntaxDocument(callerDocument, false);
    const semantic = analysisService.getSemanticSnapshot(callerDocument, false);

    if (!syntax) {
        throw new Error('Expected syntax document for caller.');
    }

    const functionNode = findFirstNode(
        syntax.root,
        (node) => node.kind === SyntaxKind.FunctionDeclaration && node.name === 'demo'
    );
    if (!functionNode) {
        throw new Error('Expected demo function in caller fixture.');
    }

    const functionSummary = semantic.exportedFunctions.find((entry) => entry.name === 'demo');
    if (!functionSummary) {
        throw new Error('Expected demo function summary in caller fixture.');
    }

    const blockNode = functionNode.children.find((child) => child.kind === SyntaxKind.Block);
    if (!blockNode) {
        throw new Error('Expected demo function block in caller fixture.');
    }

    const context = createStaticEvaluationContext({
        syntax,
        semantic,
        functionSummary,
        metadata: {
            documentUri: callerDocument.uri.toString(),
            functionName: 'demo',
            callDepth: 0
        },
        initialEnvironment: undefined
    });

    let state = createStaticEvaluationState({
        environment: context.initialEnvironment
    });
    for (const [name, value] of Object.entries(initialBindings)) {
        state = {
            ...state,
            environment: {
                bindings: new Map([
                    ...state.environment.bindings.entries(),
                    [name, value]
                ])
            }
        };
    }

    const expressionEvaluator = new ExpressionEvaluator(context);
    const statementTransfer = new StatementTransfer(context, expressionEvaluator, () => true);
    let callExpression: SyntaxNode | undefined;

    for (const statement of blockNode.children) {
        if (statement.kind === SyntaxKind.ReturnStatement) {
            callExpression = statement.children[0];
            break;
        }

        const nextState = statementTransfer.transfer(statement, state);
        if (!nextState) {
            throw new Error('Unexpected undefined state while preparing call evaluation.');
        }

        state = nextState;
    }

    if (!callExpression || callExpression.kind !== SyntaxKind.CallExpression) {
        throw new Error('Expected return call expression in caller fixture.');
    }

    return { context, state, callExpression };
}

async function evaluateReturnCall(
    sourceByUri: Record<string, string>,
    callerUri: string,
    initialBindings: Record<string, ReturnType<typeof literalValue> | ReturnType<typeof unknownValue>> = {}
) {
    const documents = Object.entries(sourceByUri).map(([uri, source]) => createTextDocument(uri, source));
    const callerDocument = documents.find((document) => document.uri.fsPath === vscode.Uri.parse(callerUri).fsPath);
    if (!callerDocument) {
        throw new Error(`Missing caller document for ${callerUri}`);
    }

    const host = createDocumentHost(documents);
    const pathSupport = new WorkspaceDocumentPathSupport({ host });
    const analysisService = DocumentSemanticSnapshotService.getInstance();
    const callTargetResolver = new CallTargetResolver({
        analysisService,
        pathSupport
    });

    const { context, state, callExpression } = prepareCallEvaluation(documents, callerDocument, initialBindings);
    const evaluator = new CalleeReturnEvaluator({
        callTargetResolver
    });
    return evaluator.evaluateCallExpression(callerDocument, callExpression, context, state);
}

describe('CalleeReturnEvaluator', () => {
    afterEach(() => {
        DocumentSemanticSnapshotService.getInstance().clearAllCache();
        clearGlobalParsedDocumentService();
    });

    test('binds direct literal arguments into current-file callees', async () => {
        const result = await evaluateReturnCall({
            'file:///D:/workspace/demo.c': [
                'string echo_name(string model) {',
                '    return model;',
                '}',
                '',
                'mixed demo() {',
                '    return echo_name("login");',
                '}'
            ].join('\n')
        }, 'file:///D:/workspace/demo.c');

        expect(result).toEqual(literalValue('login'));
    });

    test('binds local alias arguments into current-file callees', async () => {
        const result = await evaluateReturnCall({
            'file:///D:/workspace/demo.c': [
                'string echo_name(string model) {',
                '    return model;',
                '}',
                '',
                'mixed demo() {',
                '    string alias = "classify_popup";',
                '    return echo_name(alias);',
                '}'
            ].join('\n')
        }, 'file:///D:/workspace/demo.c');

        expect(result).toEqual(literalValue('classify_popup'));
    });

    test('returns literal unions when caller arguments are joined before binding', async () => {
        const result = await evaluateReturnCall({
            'file:///D:/workspace/demo.c': [
                'string echo_name(string model) {',
                '    return model;',
                '}',
                '',
                'mixed demo() {',
                '    string alias;',
                '    if (flag) {',
                '        alias = "login";',
                '    } else {',
                '        alias = "logout";',
                '    }',
                '    return echo_name(alias);',
                '}'
            ].join('\n')
        }, 'file:///D:/workspace/demo.c', {
            flag: unknownValue()
        });

        expect(result).toEqual(unionValue([
            literalValue('login'),
            literalValue('logout')
        ]));
    });

    test('returns unknown when the callee definition cannot be resolved', async () => {
        const result = await evaluateReturnCall({
            'file:///D:/workspace/demo.c': [
                'mixed demo() {',
                '    return missing_name("login");',
                '}'
            ].join('\n')
        }, 'file:///D:/workspace/demo.c');

        expect(result).toEqual(unknownValue());
    });

    test('resolves inherit-backed callable targets', async () => {
        const result = await evaluateReturnCall({
            'file:///D:/workspace/base.c': [
                'string inherited_name(string model) {',
                '    return model;',
                '}'
            ].join('\n'),
            'file:///D:/workspace/demo.c': [
                'inherit "/base";',
                '',
                'mixed demo() {',
                '    return inherited_name("login");',
                '}'
            ].join('\n')
        }, 'file:///D:/workspace/demo.c');

        expect(result).toEqual(literalValue('login'));
    });
});
