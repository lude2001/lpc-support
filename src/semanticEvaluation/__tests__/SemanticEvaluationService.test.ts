import * as path from 'path';
import * as vscode from 'vscode';
import { afterEach, describe, expect, test } from '@jest/globals';
import { clearGlobalParsedDocumentService, getGlobalParsedDocumentService } from '../../parser/ParsedDocumentService';
import { DocumentSemanticSnapshotService } from '../../semantic/documentSemanticSnapshotService';
import { createDefaultSemanticEvaluationService } from '../SemanticEvaluationService';
import { SyntaxBuilder } from '../../syntax/SyntaxBuilder';
import { SyntaxKind, SyntaxNode } from '../../syntax/types';
import { WorkspaceDocumentPathSupport } from '../../language/shared/WorkspaceDocumentPathSupport';
import { configuredCandidateSetValue, objectValue, unknownValue } from '../valueFactories';

function normalizeFsPath(filePath: string): string {
    return path.normalize(filePath.replace(/^\/([A-Za-z]:)/, '$1'));
}

function createTextDocument(fileName: string, source: string): vscode.TextDocument {
    const fsPath = normalizeFsPath(fileName);
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
        uri: vscode.Uri.file(fsPath),
        fileName: fsPath,
        languageId: 'lpc',
        version: 1,
        lineCount: lines.length,
        getText: (range?: vscode.Range) => {
            if (!range) {
                return source;
            }

            return source.slice(offsetAt(range.start), offsetAt(range.end));
        },
        lineAt: (line: number) => ({ text: lines[line] ?? '' }),
        positionAt,
        offsetAt
    } as unknown as vscode.TextDocument;
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

function getCallExpression(source: string, fileName: string, calleeName: string): SyntaxNode {
    const document = createTextDocument(fileName, source);
    const syntaxDocument = new SyntaxBuilder(getGlobalParsedDocumentService().get(document)).build();
    const callExpression = findFirstNode(
        syntaxDocument.root,
        (node) =>
            node.kind === SyntaxKind.CallExpression
            && node.children[0]?.kind === SyntaxKind.MemberAccessExpression
            && node.children[0].children[1]?.kind === SyntaxKind.Identifier
            && node.children[0].children[1].name === calleeName
    );

    if (!callExpression) {
        throw new Error(`Expected call expression for ${calleeName}.`);
    }

    return callExpression;
}

function getIdentifierCallExpression(source: string, fileName: string, calleeName: string): SyntaxNode {
    const document = createTextDocument(fileName, source);
    const syntaxDocument = new SyntaxBuilder(getGlobalParsedDocumentService().get(document)).build();
    const callExpression = findFirstNode(
        syntaxDocument.root,
        (node) =>
            node.kind === SyntaxKind.CallExpression
            && node.children[0]?.kind === SyntaxKind.Identifier
            && node.children[0].name === calleeName
    );

    if (!callExpression) {
        throw new Error(`Expected identifier call expression for ${calleeName}.`);
    }

    return callExpression;
}

function getMemberAccessReceiverIdentifierAtMemberCall(
    source: string,
    fileName: string,
    memberName: string
): SyntaxNode {
    const document = createTextDocument(fileName, source);
    const syntaxDocument = new SyntaxBuilder(getGlobalParsedDocumentService().get(document)).build();
    const receiverIdentifier = findFirstNode(
        syntaxDocument.root,
        (node) =>
            node.kind === SyntaxKind.MemberAccessExpression
            && node.children[1]?.kind === SyntaxKind.Identifier
            && node.children[1].name === memberName
    )?.children[0];

    if (!receiverIdentifier) {
        throw new Error(`Expected member access receiver identifier for ${memberName}.`);
    }

    return receiverIdentifier;
}

function createDocumentHost(documents: readonly vscode.TextDocument[]) {
    const byFsPath = new Map<string, vscode.TextDocument>();
    let workspaceRoot = path.dirname(documents[0]?.uri.fsPath ?? 'D:\\workspace');

    for (const document of documents) {
        byFsPath.set(normalizeFsPath(document.uri.fsPath), document);
    }

    if (documents.length > 0) {
        const roots = documents.map((document) => normalizeFsPath(document.uri.fsPath).split(/[\\/]+/));
        const common: string[] = [];
        const shortest = Math.min(...roots.map((segments) => segments.length));

        for (let index = 0; index < shortest; index += 1) {
            const segment = roots[0][index];
            if (roots.every((segments) => segments[index] === segment)) {
                common.push(segment);
                continue;
            }

            break;
        }

        if (common.length > 0) {
            workspaceRoot = common.join(path.sep);
        }
    }

    return {
        openTextDocument: async (target: string | vscode.Uri) => {
            const key = typeof target === 'string' ? target : target.fsPath;
            const document = byFsPath.get(normalizeFsPath(key));
            if (!document) {
                throw new Error(`Unknown document: ${key}`);
            }

            return document;
        },
        fileExists: (filePath: string) => byFsPath.has(normalizeFsPath(filePath)),
        getWorkspaceFolder: () => ({ uri: { fsPath: workspaceRoot } })
    };
}

describe('SemanticEvaluationService', () => {
    afterEach(() => {
        DocumentSemanticSnapshotService.getInstance().clearAllCache();
        clearGlobalParsedDocumentService();
    });

    test('preserves nested if-branch assignments before semantic evaluation of a call site', async () => {
        const protocolServerSource = [
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
        ].join('\n');
        const callerSource = [
            'mixed demo() {',
            '    object protocol = load_object("/adm/protocol/protocol_server");',
            '    string model_name = "login";',
            '    if (1) {',
            '        model_name = "classify_popup";',
            '        return protocol->model_get(model_name);',
            '    }',
            '',
            '    return 0;',
            '}'
        ].join('\n');

        const protocolServerDocument = createTextDocument('file:///D:/workspace/adm/protocol/protocol_server.c', protocolServerSource);
        const callerDocument = createTextDocument('file:///D:/workspace/demo.c', callerSource);
        const host = createDocumentHost([protocolServerDocument, callerDocument]);
        const pathSupport = new WorkspaceDocumentPathSupport({ host });
        const analysisService = DocumentSemanticSnapshotService.getInstance();
        const semanticEvaluationService = createDefaultSemanticEvaluationService({
            analysisService,
            pathSupport
        });
        const callExpression = getCallExpression(callerSource, 'file:///D:/workspace/demo.c', 'model_get');

        const result = await semanticEvaluationService.evaluateCallExpression(callerDocument, callExpression);

        expect(result).toEqual({
            value: objectValue('/adm/protocol/model/classify_popup_model'),
            source: 'natural'
        });
    });

    test('treats unsupported containers as outside the nested white zone', async () => {
        const protocolServerSource = [
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
        ].join('\n');
        const callerSource = [
            'mixed demo() {',
            '    object protocol = load_object("/adm/protocol/protocol_server");',
            '    string model_name = "login";',
            '    switch (1) {',
            '        case 1:',
            '            model_name = "classify_popup";',
            '            return protocol->model_get(model_name);',
            '        default:',
            '            return 0;',
            '    }',
            '}'
        ].join('\n');

        const protocolServerDocument = createTextDocument('file:///D:/workspace/adm/protocol/protocol_server.c', protocolServerSource);
        const callerDocument = createTextDocument('file:///D:/workspace/demo.c', callerSource);
        const host = createDocumentHost([protocolServerDocument, callerDocument]);
        const pathSupport = new WorkspaceDocumentPathSupport({ host });
        const analysisService = DocumentSemanticSnapshotService.getInstance();
        const semanticEvaluationService = createDefaultSemanticEvaluationService({
            analysisService,
            pathSupport
        });
        const callExpression = getCallExpression(callerSource, 'file:///D:/workspace/demo.c', 'model_get');

        const result = await semanticEvaluationService.evaluateCallExpression(callerDocument, callExpression);

        expect(result).toEqual({
            value: unknownValue(),
            source: 'unknown'
        });
    });

    test('preserves branch-local state through nested else if call sites', async () => {
        const protocolServerSource = [
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
        ].join('\n');
        const callerSource = [
            'mixed demo() {',
            '    object protocol = load_object("/adm/protocol/protocol_server");',
            '    string model_name = "login";',
            '    if (0) {',
            '        return 0;',
            '    } else if (1) {',
            '        model_name = "classify_popup";',
            '        return protocol->model_get(model_name);',
            '    } else {',
            '        return 0;',
            '    }',
            '}'
        ].join('\n');

        const protocolServerDocument = createTextDocument('file:///D:/workspace/adm/protocol/protocol_server.c', protocolServerSource);
        const callerDocument = createTextDocument('file:///D:/workspace/demo.c', callerSource);
        const host = createDocumentHost([protocolServerDocument, callerDocument]);
        const pathSupport = new WorkspaceDocumentPathSupport({ host });
        const analysisService = DocumentSemanticSnapshotService.getInstance();
        const semanticEvaluationService = createDefaultSemanticEvaluationService({
            analysisService,
            pathSupport
        });
        const callExpression = getCallExpression(callerSource, 'file:///D:/workspace/demo.c', 'model_get');

        const result = await semanticEvaluationService.evaluateCallExpression(callerDocument, callExpression);

        expect(result).toEqual({
            value: objectValue('/adm/protocol/model/classify_popup_model'),
            source: 'natural'
        });
    });

    test('preserves helper-wrapped this_player() runtime sources through natural evaluation', async () => {
        const callerSource = [
            'object current_actor() {',
            '    return this_player();',
            '}',
            '',
            'void demo() {',
            '    current_actor()->query_name();',
            '}'
        ].join('\n');

        const playerDocument = createTextDocument('file:///D:/workspace/adm/objects/player.c', 'void query_name() {}\n');
        const callerDocument = createTextDocument('file:///D:/workspace/demo.c', callerSource);
        const host = createDocumentHost([playerDocument, callerDocument]);
        const pathSupport = new WorkspaceDocumentPathSupport({ host });
        const analysisService = DocumentSemanticSnapshotService.getInstance();
        const semanticEvaluationService = createDefaultSemanticEvaluationService({
            analysisService,
            pathSupport,
            playerObjectPath: '/adm/objects/player'
        });
        const callExpression = getIdentifierCallExpression(callerSource, 'file:///D:/workspace/demo.c', 'current_actor');
        const expectedPlayerPath = pathSupport.resolveObjectFilePath(callerDocument, '"/adm/objects/player"');
        if (!expectedPlayerPath) {
            throw new Error('Expected player object path to resolve in test fixture.');
        }

        const result = await semanticEvaluationService.evaluateCallExpression(callerDocument, callExpression);

        expect(result).toEqual({
            value: configuredCandidateSetValue('this_player', [
                objectValue(expectedPlayerPath)
            ]),
            source: 'natural'
        });
    });

    test('evaluates a member-access receiver identifier from the built static state', async () => {
        const callerSource = [
            'void demo() {',
            '    object model = load_object("/adm/model/navigation_popup");',
            '    model->create_action("上一页", cmd);',
            '}'
        ].join('\n');

        const callerDocument = createTextDocument('file:///D:/workspace/demo.c', callerSource);
        const host = createDocumentHost([callerDocument]);
        const pathSupport = new WorkspaceDocumentPathSupport({ host });
        const analysisService = DocumentSemanticSnapshotService.getInstance();
        const semanticEvaluationService = createDefaultSemanticEvaluationService({
            analysisService,
            pathSupport
        });
        const receiverIdentifier = getMemberAccessReceiverIdentifierAtMemberCall(
            callerSource,
            'file:///D:/workspace/demo.c',
            'create_action'
        );

        const result = await semanticEvaluationService.evaluateExpressionAtPosition(
            callerDocument,
            receiverIdentifier
        );

        expect(result).toEqual({
            value: objectValue('/adm/model/navigation_popup'),
            source: 'natural'
        });
    });

    test('returns unknown when an expression cannot be resolved from the built state', async () => {
        const callerSource = [
            'void demo() {',
            '    model->create_action("上一页", cmd);',
            '}'
        ].join('\n');

        const callerDocument = createTextDocument('file:///D:/workspace/demo.c', callerSource);
        const host = createDocumentHost([callerDocument]);
        const pathSupport = new WorkspaceDocumentPathSupport({ host });
        const analysisService = DocumentSemanticSnapshotService.getInstance();
        const semanticEvaluationService = createDefaultSemanticEvaluationService({
            analysisService,
            pathSupport
        });
        const receiverIdentifier = getMemberAccessReceiverIdentifierAtMemberCall(
            callerSource,
            'file:///D:/workspace/demo.c',
            'create_action'
        );

        const result = await semanticEvaluationService.evaluateExpressionAtPosition(
            callerDocument,
            receiverIdentifier
        );

        expect(result).toEqual({
            value: unknownValue(),
            source: 'unknown'
        });
    });
});
