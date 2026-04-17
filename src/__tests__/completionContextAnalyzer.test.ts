import * as vscode from 'vscode';
import { CompletionContextAnalyzer } from '../completion/completionContextAnalyzer';

function createDocument(content: string): vscode.TextDocument {
    const lines = content.split(/\r?\n/);

    return {
        uri: vscode.Uri.file('/virtual/context-test.c'),
        fileName: '/virtual/context-test.c',
        languageId: 'lpc',
        version: 1,
        lineCount: lines.length,
        getText: jest.fn(() => content),
        lineAt: jest.fn((lineOrPosition: number | vscode.Position) => {
            const line = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
            return { text: lines[line] ?? '' };
        })
    } as unknown as vscode.TextDocument;
}

describe('CompletionContextAnalyzer', () => {
    const analyzer = new CompletionContextAnalyzer();

    test('classifies identifier, member, preprocessor, inherit/include path and type positions', () => {
        const document = createDocument([
            'localVal',
            'payload->hp',
            'this_object()->qu',
            'arr[0]->',
            '#if',
            'inherit "/lib/ba',
            'include "game/co',
            'class Pay'
        ].join('\n'));

        expect(analyzer.analyze(document, new vscode.Position(0, 'localVal'.length)).kind).toBe('identifier');

        const member = analyzer.analyze(document, new vscode.Position(1, 'payload->hp'.length));
        expect(member.kind).toBe('member');
        expect(member.receiverChain).toEqual(['payload']);
        expect(member.receiverExpression).toBeUndefined();
        expect(member.currentWord).toBe('hp');

        const builtinReceiver = analyzer.analyze(document, new vscode.Position(2, 'this_object()->qu'.length));
        expect(builtinReceiver.kind).toBe('member');
        expect(builtinReceiver.receiverChain).toEqual([]);
        expect(builtinReceiver.receiverExpression).toBe('this_object()');
        expect(builtinReceiver.currentWord).toBe('qu');

        const indexedReceiver = analyzer.analyze(document, new vscode.Position(3, 'arr[0]->'.length));
        expect(indexedReceiver.kind).toBe('member');
        expect(indexedReceiver.receiverChain).toEqual([]);
        expect(indexedReceiver.receiverExpression).toBe('arr[0]');

        expect(analyzer.analyze(document, new vscode.Position(4, '#if'.length)).kind).toBe('preprocessor');
        expect(analyzer.analyze(document, new vscode.Position(5, 'inherit "/lib/ba'.length)).kind).toBe('inherit-path');
        expect(analyzer.analyze(document, new vscode.Position(6, 'include "game/co'.length)).kind).toBe('include-path');
        expect(analyzer.analyze(document, new vscode.Position(7, 'class Pay'.length)).kind).toBe('type-position');
    });

    test('classifies bare and named scoped prefixes as scoped-member contexts', () => {
        const document = createDocument([
            '::cr',
            'room::in'
        ].join('\n'));

        const bareScoped = analyzer.analyze(document, new vscode.Position(0, '::cr'.length));
        expect(bareScoped.kind).toBe('scoped-member');
        expect(bareScoped.currentWord).toBe('cr');
        expect(bareScoped.receiverExpression).toBe('::');

        const namedScoped = analyzer.analyze(document, new vscode.Position(1, 'room::in'.length));
        expect(namedScoped.kind).toBe('scoped-member');
        expect(namedScoped.currentWord).toBe('in');
        expect(namedScoped.receiverExpression).toBe('room::');
    });

    test('classifies scoped method name positions while excluding qualifier and argument positions', () => {
        const document = createDocument('room::init(arg);');

        const scopedMethod = analyzer.analyze(document, new vscode.Position(0, 'room::init'.length));
        expect(scopedMethod.kind).toBe('scoped-member');
        expect(scopedMethod.currentWord).toBe('init');
        expect(scopedMethod.receiverExpression).toBe('room::');

        const qualifier = analyzer.analyze(document, new vscode.Position(0, 'room'.length));
        expect(qualifier.kind).toBe('identifier');

        const argument = analyzer.analyze(document, new vscode.Position(0, 'room::init(arg'.length));
        expect(argument.kind).toBe('identifier');
    });

    test('does not classify scoped prefixes when the cursor is already inside outer call arguments', () => {
        const document = createDocument([
            'call((::cr',
            'call(',
            '    room::in'
        ].join('\n'));

        const nestedGroupedArgument = analyzer.analyze(document, new vscode.Position(0, 'call((::cr'.length));
        expect(nestedGroupedArgument.kind).toBe('identifier');

        const multilineArgument = analyzer.analyze(document, new vscode.Position(2, '    room::in'.length));
        expect(multilineArgument.kind).toBe('identifier');
    });

    test('keeps grouped scoped prefixes available outside call-argument contexts', () => {
        const document = createDocument([
            '(::cr',
            'return (room::in'
        ].join('\n'));

        const groupedBare = analyzer.analyze(document, new vscode.Position(0, '(::cr'.length));
        expect(groupedBare.kind).toBe('scoped-member');
        expect(groupedBare.currentWord).toBe('cr');

        const groupedNamed = analyzer.analyze(document, new vscode.Position(1, 'return (room::in'.length));
        expect(groupedNamed.kind).toBe('scoped-member');
        expect(groupedNamed.currentWord).toBe('in');
        expect(groupedNamed.receiverExpression).toBe('room::');
    });
});
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
