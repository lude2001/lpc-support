import { MacroFactResolver } from '../MacroFactResolver';
import { PreprocessorConditionEvaluator } from '../PreprocessorConditionEvaluator';
import { PreprocessorScanner } from '../PreprocessorScanner';

describe('MacroFactResolver', () => {
    test('resolves macro references by source order and stops after undef', () => {
        const text = [
            '#define FOO 1',
            'int before = FOO;',
            '#undef FOO',
            'int after = FOO;'
        ].join('\n');
        const scanned = new PreprocessorScanner().scan('file:///macro-order.c', 1, text);
        const conditional = new PreprocessorConditionEvaluator().evaluate(text, scanned.directives, []);

        const result = new MacroFactResolver().resolve(text, scanned.directives, conditional.inactiveRanges);

        expect(result.macroReferences).toEqual([
            expect.objectContaining({
                name: 'FOO',
                resolved: expect.objectContaining({ replacement: '1' })
            })
        ]);
        expect(result.macroReferences[0].range.start.line).toBe(1);
    });

    test('does not activate macro definitions from inactive branches', () => {
        const text = [
            '#if 0',
            '#define BAR 1',
            '#endif',
            'int value = BAR;'
        ].join('\n');
        const scanned = new PreprocessorScanner().scan('file:///macro-inactive.c', 1, text);
        const conditional = new PreprocessorConditionEvaluator().evaluate(text, scanned.directives, []);

        const result = new MacroFactResolver().resolve(text, scanned.directives, conditional.inactiveRanges);

        expect(result.macroReferences).toEqual([]);
    });
});
