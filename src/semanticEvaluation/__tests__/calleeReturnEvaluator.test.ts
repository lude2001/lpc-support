import { afterEach, describe, expect, jest, test } from '@jest/globals';
import * as path from 'path';
import * as vscode from 'vscode';
import { clearGlobalParsedDocumentService } from '../../parser/ParsedDocumentService';
import { DocumentSemanticSnapshotService } from '../../semantic/documentSemanticSnapshotService';
import { SyntaxKind, SyntaxNode } from '../../syntax/types';
import { WorkspaceDocumentPathSupport } from '../../language/shared/WorkspaceDocumentPathSupport';
import { literalValue, objectValue, unionValue, unknownValue } from '../valueFactories';
import type { SemanticValue } from '../types';
import { createStaticEvaluationContext } from '../static/StaticEvaluationContext';
import { createStaticEvaluationState } from '../static/StaticEvaluationState';
import { ExpressionEvaluator } from '../static/ExpressionEvaluator';
import { StatementTransfer } from '../static/StatementTransfer';
import { CallTargetResolver } from '../calls/CallTargetResolver';
import { CalleeReturnEvaluator } from '../calls/CalleeReturnEvaluator';

function normalizeWorkspaceFsPath(filePath: string): string {
    return path.normalize(filePath.replace(/^\/([A-Za-z]:)/, '$1'));
}

function createTextDocument(uriValue: string, source: string, version: number = 1): vscode.TextDocument {
    const fsPath = normalizeWorkspaceFsPath(
        uriValue.startsWith('file:')
            ? vscode.Uri.parse(uriValue).fsPath
            : uriValue
    );
    const uri = vscode.Uri.file(fsPath);
    Object.defineProperty(uri, 'fsPath', {
        value: fsPath,
        configurable: true
    });
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
        fileName: fsPath,
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
    const normalizeFsPath = (value: string) => normalizeWorkspaceFsPath(value);

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

function getCallExpressionName(node: SyntaxNode): string | undefined {
    if (node.kind !== SyntaxKind.CallExpression) {
        return undefined;
    }

    const callee = node.children[0];
    if (callee?.kind === SyntaxKind.Identifier && callee.name) {
        return callee.name;
    }

    if (callee?.kind === SyntaxKind.MemberAccessExpression) {
        const member = callee.children[1];
        if (member?.kind === SyntaxKind.Identifier && member.name) {
            return member.name;
        }
    }

    return typeof node.name === 'string'
        ? node.name
        : undefined;
}

function prepareCallEvaluation(
    documents: readonly vscode.TextDocument[],
    callerDocument: vscode.TextDocument,
    initialBindings: Record<string, SemanticValue> = {},
    predicate: (node: SyntaxNode) => boolean = (node) => node.kind === SyntaxKind.CallExpression
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
        const matchedCall = findFirstNode(statement, (node) =>
            node.kind === SyntaxKind.CallExpression && predicate(node)
        );
        if (matchedCall) {
            callExpression = matchedCall;
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
    initialBindings: Record<string, SemanticValue> = {},
    predicate: (node: SyntaxNode) => boolean = (node) => node.kind === SyntaxKind.CallExpression
) {
    const documents = Object.entries(sourceByUri).map(([uri, source]) => createTextDocument(uri, source));
    const callerFsPath = normalizeWorkspaceFsPath(vscode.Uri.parse(callerUri).fsPath);
    const callerDocument = documents.find((document) => document.fileName === callerFsPath);
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

    const { context, state, callExpression } = prepareCallEvaluation(
        documents,
        callerDocument,
        initialBindings,
        predicate
    );
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

    test('resolves include-backed callees when a local prototype shadows the body', async () => {
        const sourceByUri = {
            'file:///D:/workspace/helper.c': [
                'string include_name(string model) {',
                '    return model;',
                '}'
            ].join('\n'),
            'file:///D:/workspace/demo.c': [
                'string include_name(string model);',
                '#include "helper.c"',
                '',
                'mixed demo() {',
                    '    return include_name("login");',
                '}'
            ].join('\n')
        };
        const documents = Object.entries(sourceByUri).map(([uri, source]) => createTextDocument(uri, source));
        const includeCallerFsPath = normalizeWorkspaceFsPath(vscode.Uri.parse('file:///D:/workspace/demo.c').fsPath);
        const callerDocument = documents.find((document) => document.fileName === includeCallerFsPath);
        if (!callerDocument) {
            throw new Error('Missing include caller document');
        }
        const host = createDocumentHost(documents);
        const pathSupport = new WorkspaceDocumentPathSupport({ host });
        const analysisService = DocumentSemanticSnapshotService.getInstance();
        const resolver = new CallTargetResolver({ analysisService, pathSupport });
        const { callExpression } = prepareCallEvaluation(documents, callerDocument, {});
        const target = await resolver.resolveCallTarget(callerDocument, callExpression);
        expect(target).toBeDefined();

        const result = await evaluateReturnCall(sourceByUri, 'file:///D:/workspace/demo.c');

        expect(result).toEqual(literalValue('login'));
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

    test('model_get query_model_registry resolves PROTOCOL_D->model_get("login") to the exact model object', async () => {
        const result = await evaluateReturnCall({
            'file:///D:/workspace/adm/protocol/protocol_server.c': [
                'private mapping query_model_registry() {',
                '    return ([',
                '        "login": ([',
                '            "path": "/adm/protocol/model/login_model",',
                '            "mode": "load",',
                '        ]),',
                '        "classify_popup": ([',
                '            "path": "/adm/protocol/model/classify_popup_model",',
                '            "mode": "new",',
                '        ]),',
                '    ]);',
                '}',
                '',
                'object model_get(string model_name) {',
                '    mapping registry;',
                '    mapping info;',
                '    object model;',
                '',
                '    registry = query_model_registry();',
                '    info = registry[model_name];',
                '    if (info["mode"] == "new") {',
                '        model = new(info["path"]);',
                '    } else {',
                '        model = load_object(info["path"]);',
                '    }',
                '',
                '    return model;',
                '}'
            ].join('\n'),
            'file:///D:/workspace/demo.c': [
                'mixed demo() {',
                '    return PROTOCOL_D->model_get("login")->error_result("ban_msg");',
                '}'
            ].join('\n')
        }, 'file:///D:/workspace/demo.c', {
            PROTOCOL_D: objectValue('/adm/protocol/protocol_server')
        }, (node) => getCallExpressionName(node) === 'model_get');

        expect(result).toEqual(objectValue('/adm/protocol/model/login_model'));
    });

    test('model_get query_model_registry resolves local aliases to classify_popup objects', async () => {
        const result = await evaluateReturnCall({
            'file:///D:/workspace/adm/protocol/protocol_server.c': [
                'private mapping query_model_registry() {',
                '    return ([',
                '        "login": ([',
                '            "path": "/adm/protocol/model/login_model",',
                '            "mode": "load",',
                '        ]),',
                '        "classify_popup": ([',
                '            "path": "/adm/protocol/model/classify_popup_model",',
                '            "mode": "new",',
                '        ]),',
                '    ]);',
                '}',
                '',
                'object model_get(string model_name) {',
                '    mapping registry;',
                '    mapping info;',
                '    object model;',
                '',
                '    registry = query_model_registry();',
                '    info = registry[model_name];',
                '    if (info["mode"] == "new") {',
                '        model = new(info["path"]);',
                '    } else {',
                '        model = load_object(info["path"]);',
                '    }',
                '',
                '    return model;',
                '}'
            ].join('\n'),
            'file:///D:/workspace/demo.c': [
                'mixed demo() {',
                '    string model_name = "classify_popup";',
                '    return PROTOCOL_D->model_get(model_name);',
                '}'
            ].join('\n')
        }, 'file:///D:/workspace/demo.c', {
            PROTOCOL_D: objectValue('/adm/protocol/protocol_server')
        });

        expect(result).toEqual(objectValue('/adm/protocol/model/classify_popup_model'));
    });

    test('model_get query_model_registry returns unions when keys come from simple if else flow', async () => {
        const result = await evaluateReturnCall({
            'file:///D:/workspace/adm/protocol/protocol_server.c': [
                'private mapping query_model_registry() {',
                '    return ([',
                '        "login": ([',
                '            "path": "/adm/protocol/model/login_model",',
                '            "mode": "load",',
                '        ]),',
                '        "classify_popup": ([',
                '            "path": "/adm/protocol/model/classify_popup_model",',
                '            "mode": "new",',
                '        ]),',
                '    ]);',
                '}',
                '',
                'object model_get(string model_name) {',
                '    mapping registry;',
                '    mapping info;',
                '    object model;',
                '',
                '    registry = query_model_registry();',
                '    info = registry[model_name];',
                '    if (info["mode"] == "new") {',
                '        model = new(info["path"]);',
                '    } else {',
                '        model = load_object(info["path"]);',
                '    }',
                '',
                '    return model;',
                '}'
            ].join('\n'),
            'file:///D:/workspace/demo.c': [
                'mixed demo() {',
                '    string model_name;',
                '    if (flag) {',
                '        model_name = "login";',
                '    } else {',
                '        model_name = "classify_popup";',
                '    }',
                '    return PROTOCOL_D->model_get(model_name);',
                '}'
            ].join('\n')
        }, 'file:///D:/workspace/demo.c', {
            PROTOCOL_D: objectValue('/adm/protocol/protocol_server'),
            flag: unknownValue()
        });

        expect(result.kind).toBe('union');
        if (result.kind !== 'union') {
            throw new Error('Expected union result for model_get registry branch join.');
        }

        expect(result.values).toHaveLength(2);
        expect(result.values).toEqual(expect.arrayContaining([
            objectValue('/adm/protocol/model/login_model'),
            objectValue('/adm/protocol/model/classify_popup_model')
        ]));
    });

    test('model_get query_model_registry returns unknown when the registry shape is not statically evaluable', async () => {
        const result = await evaluateReturnCall({
            'file:///D:/workspace/adm/protocol/protocol_server.c': [
                'private mapping query_model_registry() {',
                '    mapping registry;',
                '',
                '    registry = ([]);',
                '    registry["login"] = ([',
                '        "path": "/adm/protocol/model/login_model",',
                '        "mode": "load",',
                '    ]);',
                '    return registry;',
                '}',
                '',
                'object model_get(string model_name) {',
                '    mapping registry;',
                '    mapping info;',
                '    object model;',
                '',
                '    registry = query_model_registry();',
                '    info = registry[model_name];',
                '    if (info["mode"] == "new") {',
                '        model = new(info["path"]);',
                '    } else {',
                '        model = load_object(info["path"]);',
                '    }',
                '',
                '    return model;',
                '}'
            ].join('\n'),
            'file:///D:/workspace/demo.c': [
                'mixed demo() {',
                '    return PROTOCOL_D->model_get("login");',
                '}'
            ].join('\n')
        }, 'file:///D:/workspace/demo.c', {
            PROTOCOL_D: objectValue('/adm/protocol/protocol_server')
        });

        expect(result).toEqual(unknownValue());
    });

    test('model_get query_model_registry include-backed helpers still drive natural return inference', async () => {
        const result = await evaluateReturnCall({
            'file:///D:/workspace/adm/protocol/protocol_registry.c': [
                'private mapping query_model_registry() {',
                '    return ([',
                '        "login": ([',
                '            "path": "/adm/protocol/model/login_model",',
                '            "mode": "load",',
                '        ]),',
                '    ]);',
                '}'
            ].join('\n'),
            'file:///D:/workspace/adm/protocol/protocol_server.c': [
                'private mapping query_model_registry();',
                '#include "protocol_registry.c"',
                '',
                'object model_get(string model_name) {',
                '    mapping registry;',
                '    mapping info;',
                '    object model;',
                '',
                '    registry = query_model_registry();',
                '    info = registry[model_name];',
                '    if (info["mode"] == "new") {',
                '        model = new(info["path"]);',
                '    } else {',
                '        model = load_object(info["path"]);',
                '    }',
                '',
                '    return model;',
                '}'
            ].join('\n'),
            'file:///D:/workspace/demo.c': [
                'mixed demo() {',
                '    return PROTOCOL_D->model_get("login")->error_result("ban_msg");',
                '}'
            ].join('\n')
        }, 'file:///D:/workspace/demo.c', {
            PROTOCOL_D: objectValue('/adm/protocol/protocol_server')
        }, (node) => getCallExpressionName(node) === 'model_get');

        expect(result).toEqual(objectValue('/adm/protocol/model/login_model'));
    });
});
