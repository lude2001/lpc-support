import * as vscode from 'vscode';
import { describe, expect, test } from '@jest/globals';
import { clearGlobalParsedDocumentService, getGlobalParsedDocumentService } from '../../parser/ParsedDocumentService';
import { SyntaxBuilder } from '../../syntax/SyntaxBuilder';
import { SyntaxKind, SyntaxNode } from '../../syntax/types';
import {
    arrayShapeValue,
    literalValue,
    mappingShapeValue,
    objectValue,
    unionValue,
    unknownValue
} from '../valueFactories';
import { ExpressionEvaluator } from '../static/ExpressionEvaluator';
import { createStaticEvaluationContext } from '../static/StaticEvaluationContext';
import {
    createStaticEvaluationState,
    createValueEnvironment
} from '../static/StaticEvaluationState';
import { CoreStaticEvaluator } from '../static/CoreStaticEvaluator';

function createDocument(content: string, fileName = '/virtual/semantic-eval.c'): vscode.TextDocument {
    const lines = content.split('\n');

    return {
        fileName,
        languageId: 'lpc',
        uri: vscode.Uri.file(fileName),
        version: 1,
        lineCount: lines.length,
        getText: (range?: vscode.Range) => {
            if (!range) {
                return content;
            }

            const startOffset = lines
                .slice(0, range.start.line)
                .reduce((total, line) => total + line.length + 1, 0) + range.start.character;
            const endOffset = lines
                .slice(0, range.end.line)
                .reduce((total, line) => total + line.length + 1, 0) + range.end.character;

            return content.substring(startOffset, endOffset);
        },
        lineAt: (line: number) => ({
            lineNumber: line,
            text: lines[line] ?? ''
        }),
        positionAt: (offset: number) => {
            let runningOffset = 0;

            for (let line = 0; line < lines.length; line += 1) {
                const lineLength = lines[line].length + 1;
                if (runningOffset + lineLength > offset) {
                    return new vscode.Position(line, offset - runningOffset);
                }

                runningOffset += lineLength;
            }

            return new vscode.Position(lines.length - 1, lines[lines.length - 1]?.length ?? 0);
        },
        offsetAt: (position: vscode.Position) => lines
            .slice(0, position.line)
            .reduce((total, line) => total + line.length + 1, 0) + position.character
    } as unknown as vscode.TextDocument;
}

function buildSyntaxDocument(source: string, fileName = '/virtual/semantic-eval.c') {
    const document = createDocument(source, fileName);
    return new SyntaxBuilder(getGlobalParsedDocumentService().get(document)).build();
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

function getReturnedExpression(source: string): SyntaxNode {
    const syntaxDocument = buildSyntaxDocument(source);
    const returnNode = findFirstNode(
        syntaxDocument.root,
        (node) => node.kind === SyntaxKind.ReturnStatement
    );

    if (!returnNode || returnNode.children.length === 0) {
        throw new Error('Expected return expression in test fixture.');
    }

    return returnNode.children[0];
}

function evaluateReturnedExpression(
    source: string,
    initialBindings: Record<string, ReturnType<typeof literalValue>> | Record<string, unknown> = {}
) {
    const expression = getReturnedExpression(source);
    const context = createStaticEvaluationContext({
        metadata: {
            documentUri: '/virtual/semantic-eval.c',
            functionName: 'demo',
            callDepth: 0
        }
    });
    const state = createStaticEvaluationState({
        environment: createValueEnvironment(initialBindings as Record<string, any>)
    });
    const evaluator = new ExpressionEvaluator(context);

    return evaluator.evaluate(expression, state);
}

function getFunctionDeclaration(source: string): SyntaxNode {
    const syntaxDocument = buildSyntaxDocument(source);
    const functionNode = findFirstNode(
        syntaxDocument.root,
        (node) => node.kind === SyntaxKind.FunctionDeclaration
    );

    if (!functionNode) {
        throw new Error('Expected function declaration in test fixture.');
    }

    return functionNode;
}

function evaluateFunction(
    source: string,
    options: {
        bindings?: Record<string, unknown>;
        budget?: Parameters<typeof createStaticEvaluationContext>[0]['budget'];
    } = {}
) {
    const functionNode = getFunctionDeclaration(source);
    const context = createStaticEvaluationContext({
        metadata: {
            documentUri: '/virtual/semantic-eval.c',
            functionName: functionNode.name ?? 'demo',
            callDepth: 0
        },
        budget: options.budget,
        initialEnvironment: createValueEnvironment(options.bindings as Record<string, any> | undefined)
    });
    const evaluator = new CoreStaticEvaluator(context);

    return evaluator.evaluateFunction(functionNode);
}

function createFunctionEvaluator(
    source: string,
    options: {
        bindings?: Record<string, unknown>;
        budget?: Parameters<typeof createStaticEvaluationContext>[0]['budget'];
    } = {}
) {
    const functionNode = getFunctionDeclaration(source);
    const context = createStaticEvaluationContext({
        metadata: {
            documentUri: '/virtual/semantic-eval.c',
            functionName: functionNode.name ?? 'demo',
            callDepth: 0
        },
        budget: options.budget,
        initialEnvironment: createValueEnvironment(options.bindings as Record<string, any> | undefined)
    });

    return {
        functionNode,
        evaluator: new CoreStaticEvaluator(context)
    };
}

describe('ExpressionEvaluator', () => {
    afterEach(() => {
        clearGlobalParsedDocumentService();
    });

    test('resolves local identifier aliases through the environment', () => {
        const result = evaluateReturnedExpression(
            'mixed demo() { return alias; }',
            { alias: literalValue('login') }
        );

        expect(result).toEqual(literalValue('login'));
    });

    test('propagates string literals and parentheses', () => {
        const result = evaluateReturnedExpression('mixed demo() { return ("login"); }');

        expect(result).toEqual(literalValue('login'));
    });

    test('evaluates new("/x/y") to an exact object value', () => {
        const result = evaluateReturnedExpression('mixed demo() { return new("/adm/model/login"); }');

        expect(result).toEqual(objectValue('/adm/model/login'));
    });

    test('evaluates load_object("/x/y") to an exact object value', () => {
        const result = evaluateReturnedExpression('mixed demo() { return load_object("/adm/model/login"); }');

        expect(result).toEqual(objectValue('/adm/model/login'));
    });

    test('evaluates find_object("/x/y") to an exact object value', () => {
        const result = evaluateReturnedExpression('mixed demo() { return find_object("/adm/model/login"); }');

        expect(result).toEqual(objectValue('/adm/model/login'));
    });

    test('evaluates mapping literals into static mapping shapes', () => {
        const result = evaluateReturnedExpression([
            'mixed demo() {',
            '    return ([ "path": "/adm/model/login", "mode": "load" ]);',
            '}'
        ].join('\n'));

        expect(result).toEqual(mappingShapeValue({
            path: literalValue('/adm/model/login'),
            mode: literalValue('load')
        }));
    });

    test('evaluates fixed-key mapping indexing', () => {
        const result = evaluateReturnedExpression([
            'mixed demo() {',
            '    return ([ "path": "/adm/model/login", "mode": "load" ])["path"];',
            '}'
        ].join('\n'));

        expect(result).toEqual(literalValue('/adm/model/login'));
    });

    test('evaluates array literals into static array shapes', () => {
        const result = evaluateReturnedExpression('mixed demo() { return ({ "alpha", "beta" }); }');

        expect(result).toEqual(arrayShapeValue([
            literalValue('alpha'),
            literalValue('beta')
        ]));
    });

    test('evaluates conditional expressions over literal values', () => {
        const result = evaluateReturnedExpression(
            'mixed demo() { return flag ? "login" : "logout"; }',
            { flag: literalValue(1) }
        );

        expect(result).toEqual(literalValue('login'));
    });

    test('treats falsy literals as false in conditional expressions', () => {
        const result = evaluateReturnedExpression('mixed demo() { return 0 ? "login" : "logout"; }');

        expect(result).toEqual(literalValue('logout'));
    });

    test('treats exact objects as false in unary negation consumers', () => {
        const result = evaluateReturnedExpression('mixed demo() { return !new("/adm/model/login"); }');

        expect(result).toEqual(literalValue(false, 'boolean'));
    });

    test('treats exact object-valued conditional expressions as truthy', () => {
        const result = evaluateReturnedExpression(
            'mixed demo() { return new("/adm/model/login") ? "login" : "logout"; }'
        );

        expect(result).toEqual(literalValue('login'));
    });

    test('joins conditional expressions over object values when the condition is unknown', () => {
        const result = evaluateReturnedExpression(
            'mixed demo() { return flag ? load_object("/adm/model/login") : new("/adm/model/logout"); }',
            { flag: unknownValue() }
        );

        expect(result).toEqual(unionValue([
            objectValue('/adm/model/login'),
            objectValue('/adm/model/logout')
        ]));
    });

    test('supports local declaration and assignment statements', () => {
        const result = evaluateFunction([
            'mixed demo() {',
            '    string model;',
            '    model = "login";',
            '    return model;',
            '}'
        ].join('\n'));

        expect(result).toEqual(literalValue('login'));
    });

    test('joins simple if/else statement branches', () => {
        const result = evaluateFunction([
            'mixed demo() {',
            '    string model;',
            '    if (flag)',
            '        model = "login";',
            '    else',
            '        model = "logout";',
            '    return model;',
            '}'
        ].join('\n'), {
            bindings: { flag: unknownValue() }
        });

        expect(result).toEqual(unionValue([
            literalValue('login'),
            literalValue('logout')
        ]));
    });

    test('takes the truthy object branch in if statements', () => {
        const result = evaluateFunction([
            'mixed demo() {',
            '    string model;',
            '    if (new("/adm/model/login"))',
            '        model = "login";',
            '    else',
            '        model = "logout";',
            '    return model;',
            '}'
        ].join('\n'));

        expect(result).toEqual(literalValue('login'));
    });

    test('uses real conditional expressions inside statement transfer joins', () => {
        const result = evaluateFunction([
            'mixed demo() {',
            '    object model;',
            '    model = flag ? load_object("/adm/model/login") : new("/adm/model/logout");',
            '    return model;',
            '}'
        ].join('\n'), {
            bindings: { flag: unknownValue() }
        });

        expect(result).toEqual(unionValue([
            objectValue('/adm/model/login'),
            objectValue('/adm/model/logout')
        ]));
    });

    test('preserves the continuing branch return after a partial-return join', () => {
        const result = evaluateFunction([
            'mixed demo() {',
            '    string ob;',
            '    if (flag) {',
            '        return "sword";',
            '    } else {',
            '        ob = "shield";',
            '    }',
            '    return ob;',
            '}'
        ].join('\n'), {
            bindings: { flag: unknownValue() }
        });

        expect(result).toEqual(unionValue([
            literalValue('sword'),
            literalValue('shield')
        ]));
    });

    test('skips mapp guard returns when the checked value is a static mapping shape', () => {
        const result = evaluateFunction([
            'mixed demo() {',
            '    mapping info = ([ "path": "/adm/model/navigation_popup" ]);',
            '    if (!mapp(info))',
            '        return 0;',
            '    return load_object(info["path"]);',
            '}'
        ].join('\n'));

        expect(result).toEqual(objectValue('/adm/model/navigation_popup'));
    });

    test('keeps model object through real protocol mode and initialization guards', () => {
        const result = evaluateFunction([
            'mixed demo() {',
            '    mapping info = ([ "path": "/adm/model/navigation_popup", "mode": "load" ]);',
            '    object model;',
            '    if (!mapp(info))',
            '        return 0;',
            '    if (info["mode"] == "new")',
            '        model = new(info["path"]);',
            '    else',
            '        model = load_object(info["path"]);',
            '    if (objectp(model) && stringp(info["init_method"]) && !undefinedp(init_arg))',
            '        call_other(model, info["init_method"], init_arg);',
            '    return model;',
            '}'
        ].join('\n'), {
            bindings: { init_arg: unknownValue() }
        });

        expect(result).toEqual(objectValue('/adm/model/navigation_popup'));
    });

    test('keeps model object through protocol mode branch before initialization guards', () => {
        const result = evaluateFunction([
            'mixed demo() {',
            '    mapping info = ([ "path": "/adm/model/navigation_popup", "mode": "load" ]);',
            '    object model;',
            '    if (info["mode"] == "new")',
            '        model = new(info["path"]);',
            '    else',
            '        model = load_object(info["path"]);',
            '    return model;',
            '}'
        ].join('\n'));

        expect(result).toEqual(objectValue('/adm/model/navigation_popup'));
    });

    test('preserves known bindings when an unknown guard only calls a function', () => {
        const result = evaluateFunction([
            'mixed demo() {',
            '    object model = load_object("/adm/model/navigation_popup");',
            '    if (flag)',
            '        call_other(model, "init");',
            '    return model;',
            '}'
        ].join('\n'), {
            bindings: { flag: unknownValue() }
        });

        expect(result).toEqual(objectValue('/adm/model/navigation_popup'));
    });

    test('returns through a local variable', () => {
        const result = evaluateFunction([
            'mixed demo() {',
            '    object model = load_object("/adm/model/login");',
            '    return model;',
            '}'
        ].join('\n'));

        expect(result).toEqual(objectValue('/adm/model/login'));
    });

    test('downgrades unsupported loops to unknown', () => {
        const result = evaluateFunction([
            'mixed demo() {',
            '    string model = "login";',
            '    while (flag) {',
            '        model = "logout";',
            '    }',
            '    return model;',
            '}'
        ].join('\n'), {
            bindings: { flag: unknownValue() }
        });

        expect(result).toEqual(unknownValue());
    });

    test('downgrades unsupported loops to unknown even with an empty environment', () => {
        const result = evaluateFunction([
            'mixed demo() {',
            '    while (flag) {',
            '    }',
            '    return "login";',
            '}'
        ].join('\n'), {
            bindings: { flag: unknownValue() }
        });

        expect(result).toEqual(unknownValue());
    });

    test('does not let exact sibling returns escape when an unknown branch hits an unsupported loop', () => {
        const result = evaluateFunction([
            'mixed demo() {',
            '    if (flag) {',
            '        while (flag) {',
            '        }',
            '    } else {',
            '        return "login";',
            '    }',
            '}'
        ].join('\n'), {
            bindings: { flag: unknownValue() }
        });

        expect(result).toEqual(unknownValue());
    });

    test('surfaces budget exhaustion as unknown instead of throwing', () => {
        const result = evaluateFunction([
            'mixed demo() {',
            '    string model;',
            '    model = "login";',
            '    return model;',
            '}'
        ].join('\n'), {
            budget: { maxStatements: 2 }
        });

        expect(result).toEqual(unknownValue());
    });

    test('does not leak exhausted statement budget across repeated evaluator calls', () => {
        const { evaluator, functionNode } = createFunctionEvaluator([
            'mixed demo() {',
            '    string model;',
            '    model = "login";',
            '    return model;',
            '}'
        ].join('\n'), {
            budget: { maxStatements: 3 }
        });

        expect(evaluator.evaluateFunction(functionNode)).toEqual(literalValue('login'));
        expect(evaluator.evaluateFunction(functionNode)).toEqual(literalValue('login'));
    });
});
