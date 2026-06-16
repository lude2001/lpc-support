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

    test('expands expression-level function-like macro invocations', () => {
        const text = [
            '#define MAX(a,b) ((a) > (b) ? (a) : (b))',
            'int value = MAX(foo(1, 2), scores[0]);'
        ].join('\n');
        const scanner = new PreprocessorScanner();
        const scanned = scanner.scan('file:///inline-function-macro.c', 1, text);
        const conditional = new PreprocessorConditionEvaluator().evaluate(text, scanned.directives, []);
        const macroFacts = new MacroFactResolver().resolve(text, scanned.directives, conditional.inactiveRanges);
        const activeView = new ActiveSourceBuilder().build(text, scanned.directives, conditional.inactiveRanges);

        const expanded = new MacroExpansionBuilder().expand(activeView, macroFacts.macroReferences);

        expect(expanded.text).toContain('int value = ((foo(1, 2)) > (scores[0]) ? (foo(1, 2)) : (scores[0]));');
        expect(expanded.expandedRanges).toEqual([
            expect.objectContaining({
                macroName: 'MAX'
            })
        ]);
    });

    test('expands object-like macros recursively in active source', () => {
        const text = [
            '#define ACCESS private',
            '#define SECTION ACCESS:',
            '#define FALLBACK_VALUE 1',
            '#define DEFAULT_VALUE FALLBACK_VALUE',
            'SECTION',
            'int hidden = DEFAULT_VALUE;'
        ].join('\n');
        const scanner = new PreprocessorScanner();
        const scanned = scanner.scan('file:///recursive-object-macro.c', 1, text);
        const conditional = new PreprocessorConditionEvaluator().evaluate(text, scanned.directives, []);
        const macroFacts = new MacroFactResolver().resolve(text, scanned.directives, conditional.inactiveRanges);
        const activeView = new ActiveSourceBuilder().build(text, scanned.directives, conditional.inactiveRanges);

        const expanded = new MacroExpansionBuilder().expand(
            activeView,
            macroFacts.macroReferences,
            macroFacts.activeMacros
        );

        expect(expanded.text).toContain('private:');
        expect(expanded.text).toContain('int hidden = 1;');
    });

    test('does not expand object-like macros inside quoted strings or comments', () => {
        const text = [
            '#define NPC "/inherit/char/npc"',
            'inherit NPC;',
            'string description = "NPC 使用者除张三丰外防御能力会折减。";',
            'string escaped = "quoted \\"NPC\\" text";',
            '// NPC should stay in comments',
            '/* NPC should also stay here */'
        ].join('\n');
        const scanner = new PreprocessorScanner();
        const scanned = scanner.scan('file:///quoted-object-macro.c', 1, text);
        const conditional = new PreprocessorConditionEvaluator().evaluate(text, scanned.directives, []);
        const macroFacts = new MacroFactResolver().resolve(text, scanned.directives, conditional.inactiveRanges);
        const activeView = new ActiveSourceBuilder().build(text, scanned.directives, conditional.inactiveRanges);

        const expanded = new MacroExpansionBuilder().expand(
            activeView,
            macroFacts.macroReferences,
            macroFacts.activeMacros
        );

        expect(expanded.text).toContain('inherit "/inherit/char/npc";');
        expect(expanded.text).toContain('"NPC 使用者除张三丰外防御能力会折减。"');
        expect(expanded.text).toContain('"quoted \\"NPC\\" text"');
        expect(expanded.text).toContain('// NPC should stay in comments');
        expect(expanded.text).toContain('/* NPC should also stay here */');
        expect(expanded.expandedRanges?.map((range) => range.macroName)).toEqual(['NPC']);
    });

    test('strips source comments from macro replacements without truncating string literals', () => {
        const text = [
            '#define ZONE my["zone"]      // receiving object zone',
            '#define URL "http://example.test/path" /* endpoint */',
            'void create() {',
            '    ZONE = URL;',
            '}'
        ].join('\n');
        const scanner = new PreprocessorScanner();
        const scanned = scanner.scan('file:///commented-macro.c', 1, text);
        const conditional = new PreprocessorConditionEvaluator().evaluate(text, scanned.directives, []);
        const macroFacts = new MacroFactResolver().resolve(text, scanned.directives, conditional.inactiveRanges);
        const activeView = new ActiveSourceBuilder().build(text, scanned.directives, conditional.inactiveRanges);

        const expanded = new MacroExpansionBuilder().expand(
            activeView,
            macroFacts.macroReferences,
            macroFacts.activeMacros
        );

        expect(macroFacts.activeMacros.find((macro) => macro.name === 'ZONE')?.replacement).toBe('my["zone"]');
        expect(macroFacts.activeMacros.find((macro) => macro.name === 'URL')?.replacement).toBe('"http://example.test/path"');
        expect(expanded.text).toContain('my["zone"] = "http://example.test/path";');
        expect(expanded.text).not.toContain('receiving object zone');
    });

    test('does not expand object-like macros inside heredoc delimiters and bodies', () => {
        const text = [
            '#define LONG 16',
            'int value = LONG;',
            'void create() {',
            '    set("long", @LONG',
            'LONG should remain text',
            'LONG );',
            '}'
        ].join('\n');
        const scanner = new PreprocessorScanner();
        const scanned = scanner.scan('file:///heredoc-macro.c', 1, text);
        const conditional = new PreprocessorConditionEvaluator().evaluate(text, scanned.directives, []);
        const macroFacts = new MacroFactResolver().resolve(text, scanned.directives, conditional.inactiveRanges);
        const activeView = new ActiveSourceBuilder().build(text, scanned.directives, conditional.inactiveRanges);

        const expanded = new MacroExpansionBuilder().expand(
            activeView,
            macroFacts.macroReferences,
            macroFacts.activeMacros
        );

        expect(expanded.text).toContain('int value = 16;');
        expect(expanded.text).toContain('set("long", @LONG');
        expect(expanded.text).toContain('LONG should remain text');
        expect(expanded.text).toContain('LONG );');
        expect(expanded.text).not.toContain('@16');
    });
});
