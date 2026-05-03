import { ActiveSourceBuilder } from '../ActiveSourceBuilder';
import { PreprocessorConditionEvaluator } from '../PreprocessorConditionEvaluator';
import { PreprocessorScanner } from '../PreprocessorScanner';

describe('ActiveSourceBuilder', () => {
    test('blanks directives and inactive ranges while preserving line and column layout', () => {
        const text = [
            '#ifdef ENABLED',
            'int disabled = ;',
            '#else',
            'int enabled = 1;',
            '#endif'
        ].join('\n');
        const scanner = new PreprocessorScanner();
        const scanned = scanner.scan('file:///active.c', 1, text);
        const conditional = new PreprocessorConditionEvaluator().evaluate(text, scanned.directives, []);

        const activeView = new ActiveSourceBuilder().build(text, scanned.directives, conditional.inactiveRanges);

        const lines = activeView.text.split('\n');
        expect(lines).toHaveLength(5);
        expect(lines[0]).toMatch(/^ +$/);
        expect(lines[1]).toMatch(/^ +$/);
        expect(lines[2]).toMatch(/^ +$/);
        expect(lines[3]).toBe('int enabled = 1;');
        expect(lines[4]).toMatch(/^ +$/);
        expect(activeView.text.length).toBe(text.length);
    });
});
