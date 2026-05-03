import { PreprocessorConditionEvaluator } from '../PreprocessorConditionEvaluator';
import { PreprocessorScanner } from '../PreprocessorScanner';

describe('PreprocessorConditionEvaluator', () => {
    test('marks false ifdef branch inactive and true else branch active', () => {
        const text = [
            '#ifdef ENABLED',
            'int disabled = ;',
            '#else',
            'int enabled = 1;',
            '#endif',
            'void create() {}'
        ].join('\n');
        const scanned = new PreprocessorScanner().scan('file:///conditional.c', 1, text);

        const result = new PreprocessorConditionEvaluator().evaluate(text, scanned.directives, []);

        expect(result.inactiveRanges).toEqual([
            expect.objectContaining({
                range: expect.objectContaining({
                    start: expect.objectContaining({ line: 1, character: 0 }),
                    end: expect.objectContaining({ line: 2, character: 0 })
                }),
                reason: 'condition-false'
            })
        ]);
        expect(result.diagnostics).toEqual([]);
    });

    test('supports defined config macros, nested conditionals, and if zero', () => {
        const text = [
            '#ifdef OUTER',
            'int outer = 1;',
            '#if 0',
            'int disabled = ;',
            '#endif',
            '#endif'
        ].join('\n');
        const scanned = new PreprocessorScanner().scan('file:///nested.c', 1, text);

        const result = new PreprocessorConditionEvaluator().evaluate(text, scanned.directives, ['OUTER']);

        expect(result.inactiveRanges).toEqual([
            expect.objectContaining({
                range: expect.objectContaining({
                    start: expect.objectContaining({ line: 3, character: 0 }),
                    end: expect.objectContaining({ line: 4, character: 0 })
                })
            })
        ]);
    });

    test('reports unbalanced conditionals', () => {
        const text = [
            '#ifdef ENABLED',
            'int value = 1;'
        ].join('\n');
        const scanned = new PreprocessorScanner().scan('file:///broken.c', 1, text);

        const result = new PreprocessorConditionEvaluator().evaluate(text, scanned.directives, []);

        expect(result.diagnostics).toEqual([
            expect.objectContaining({
                code: 'preprocessor.unclosedConditional'
            })
        ]);
    });
});
