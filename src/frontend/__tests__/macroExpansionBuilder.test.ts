import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { ActiveSourceBuilder } from '../ActiveSourceBuilder';
import { MacroExpansionBuilder } from '../MacroExpansionBuilder';
import { MacroFactResolver } from '../MacroFactResolver';
import { PreprocessorConditionEvaluator } from '../PreprocessorConditionEvaluator';
import { PreprocessorScanner } from '../PreprocessorScanner';

describe('MacroExpansionBuilder', () => {
    test('expands whole-line function-like macro invocations with token paste and records expansion ranges', () => {
        const text = [
            '#define RequestType(f_name,http_type) string f_name##_request_type = http_type;',
            'RequestType(pay_add,"POST")',
            'public mapping pay_add() { return ([]); }'
        ].join('\n');
        const scanner = new PreprocessorScanner();
        const scanned = scanner.scan('file:///pay_game.c', 1, text);
        const conditional = new PreprocessorConditionEvaluator().evaluate(text, scanned.directives, []);
        const macroFacts = new MacroFactResolver().resolve(text, scanned.directives, conditional.inactiveRanges);
        const activeView = new ActiveSourceBuilder().build(text, scanned.directives, conditional.inactiveRanges);

        const expanded = new MacroExpansionBuilder().expand(activeView, macroFacts.macroReferences);

        expect(expanded.text.length).toBeGreaterThan(text.length);
        expect(expanded.text).toContain('string pay_add_request_type = "POST";');
        expect(expanded.expandedRanges).toEqual([
            expect.objectContaining({
                macroName: 'RequestType'
            })
        ]);
    });

    test('expands function-like macro stringize parameters', () => {
        const text = [
            '#define NamedValue(name) string name##_label = #name;',
            'NamedValue(pay_add)'
        ].join('\n');
        const scanner = new PreprocessorScanner();
        const scanned = scanner.scan('file:///stringize.c', 1, text);
        const conditional = new PreprocessorConditionEvaluator().evaluate(text, scanned.directives, []);
        const macroFacts = new MacroFactResolver().resolve(text, scanned.directives, conditional.inactiveRanges);
        const activeView = new ActiveSourceBuilder().build(text, scanned.directives, conditional.inactiveRanges);

        const expanded = new MacroExpansionBuilder().expand(activeView, macroFacts.macroReferences);

        expect(expanded.text).toContain('string pay_add_label = "pay_add";');
    });
});
