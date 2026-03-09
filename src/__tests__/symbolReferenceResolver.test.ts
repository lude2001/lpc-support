import * as vscode from 'vscode';
import { ASTManager } from '../ast/astManager';
import { LPCReferenceProvider } from '../referenceProvider';
import { LPCRenameProvider } from '../renameProvider';
import { disposeParseCache } from '../parseCache';
import { resolveSymbolReferences } from '../symbolReferenceResolver';
import { TestHelper } from './utils/TestHelper';

describe('local symbol references', () => {
    const source = [
        'void alpha() {',
        '    int round = 1;',
        '    round += 1;',
        '}',
        '',
        'void beta() {',
        '    int round = 2;',
        '    round += 2;',
        '}'
    ].join('\n');

    const getRoundPosition = (line: number, occurrence: number = 0): vscode.Position => {
        const text = source.split('\n')[line];
        let searchStart = 0;
        let column = -1;

        for (let index = 0; index <= occurrence; index += 1) {
            column = text.indexOf('round', searchStart);
            searchStart = column + 'round'.length;
        }

        return new vscode.Position(line, column + 1);
    };

    afterEach(() => {
        ASTManager.getInstance().clearAllCache();
    });

    afterAll(() => {
        disposeParseCache();
    });

    test('resolves only references bound to the local variable in the current function', () => {
        const document = TestHelper.createMockDocument(source);
        const references = resolveSymbolReferences(document, getRoundPosition(2));

        expect(references?.matches.map(match => match.range.start.line)).toEqual([1, 2]);
        expect(references?.matches.every(match => match.range.start.line < 5)).toBe(true);
    });

    test('reference provider excludes same-named locals from other functions', async () => {
        const document = TestHelper.createMockDocument(source);
        const provider = new LPCReferenceProvider();
        const locations = await provider.provideReferences(
            document,
            getRoundPosition(2),
            { includeDeclaration: true } as vscode.ReferenceContext,
            {} as vscode.CancellationToken
        );

        expect(locations.map(location => location.range.start.line)).toEqual([1, 2]);
    });

    test('rename provider only edits the selected local variable scope', async () => {
        const document = TestHelper.createMockDocument(source);
        const provider = new LPCRenameProvider();
        const edits = await provider.provideRenameEdits(
            document,
            getRoundPosition(2),
            'turn',
            {} as vscode.CancellationToken
        );

        const [, changes] = edits.entries()[0];

        expect(changes.map(change => change.range.start.line)).toEqual([1, 2]);
        expect(changes.every(change => change.newText === 'turn')).toBe(true);
    });
});
