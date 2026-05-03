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

    test('evaluates numeric macro expressions in if and elif branches', () => {
        const text = [
            '#define VALUE 2',
            '#define MASK 4',
            '#if defined(VALUE) && VALUE == 1',
            'int disabled_first = ;',
            '#elif VALUE == 2 && (MASK & 4)',
            'int enabled = 1;',
            '#else',
            'int disabled_else = ;',
            '#endif'
        ].join('\n');
        const scanned = new PreprocessorScanner().scan('file:///numeric-condition.c', 1, text);

        const result = new PreprocessorConditionEvaluator().evaluate(text, scanned.directives, []);

        expect(result.inactiveRanges).toEqual([
            expect.objectContaining({
                range: expect.objectContaining({
                    start: expect.objectContaining({ line: 3, character: 0 }),
                    end: expect.objectContaining({ line: 4, character: 0 })
                })
            }),
            expect.objectContaining({
                range: expect.objectContaining({
                    start: expect.objectContaining({ line: 7, character: 0 }),
                    end: expect.objectContaining({ line: 8, character: 0 })
                })
            })
        ]);
    });

    test('evaluates unary, relational, equality, and logical operators in if expressions', () => {
        const text = [
            '#define FLAGS 3',
            '#if !defined(MISSING) && FLAGS >= 3 && FLAGS != 0',
            'int enabled = 1;',
            '#else',
            'int disabled = ;',
            '#endif'
        ].join('\n');
        const scanned = new PreprocessorScanner().scan('file:///operator-condition.c', 1, text);

        const result = new PreprocessorConditionEvaluator().evaluate(text, scanned.directives, []);

        expect(result.inactiveRanges).toEqual([
            expect.objectContaining({
                range: expect.objectContaining({
                    start: expect.objectContaining({ line: 4, character: 0 }),
                    end: expect.objectContaining({ line: 5, character: 0 })
                })
            })
        ]);
    });
});
