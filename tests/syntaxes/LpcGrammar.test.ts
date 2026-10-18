import * as fs from 'fs';
import * as path from 'path';
import { INITIAL, IGrammar, IToken, Registry, parseRawGrammar } from 'vscode-textmate';
import { loadWASM, OnigScanner, OnigString } from 'vscode-oniguruma';

describe('LPC TextMate conditional compilation', () => {
    let grammar: IGrammar;
    let registry: Registry;

    beforeAll(async () => {
        const wasm = fs.readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm'));
        await loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength));
        const grammarPath = path.resolve(__dirname, '../../syntaxes/lpc.tmLanguage.json');
        registry = new Registry({
            onigLib: Promise.resolve({
                createOnigScanner: patterns => new OnigScanner(patterns),
                createOnigString: source => new OnigString(source)
            }),
            loadGrammar: async scope => scope === 'source.lpc'
                ? parseRawGrammar(fs.readFileSync(grammarPath, 'utf8'), grammarPath)
                : null
        });
        grammar = (await registry.loadGrammar('source.lpc'))!;
    });

    afterAll(() => registry?.dispose());

    function tokenize(lines: string[]): IToken[][] {
        let stack = INITIAL;
        return lines.map(line => {
            const result = grammar.tokenizeLine(line, stack);
            stack = result.ruleStack;
            return result.tokens;
        });
    }

    function scopesAt(line: string, tokens: IToken[], text: string): string[] {
        const offset = line.indexOf(text);
        expect(offset).toBeGreaterThanOrEqual(0);
        const token = tokens.find(candidate => candidate.startIndex <= offset && offset < candidate.endIndex);
        expect(token).toBeDefined();
        return token!.scopes;
    }

    function expectInactive(line: string, tokens: IToken[]): void {
        expect(scopesAt(line, tokens, 'return')).toContain('comment.block.preprocessor.lpc');
    }

    function expectActive(line: string, tokens: IToken[]): void {
        const scopes = scopesAt(line, tokens, 'return');
        expect(scopes).not.toContain('comment.block.preprocessor.lpc');
        expect(scopes).toContain('keyword.control.lpc');
    }

    test('highlights async and await without treating identifier prefixes as keywords', () => {
        const lines = ['private async void drain() {', '    await async_yield();', '    string message = "async await";', '}'];
        const tokens = tokenize(lines);
        expect(scopesAt(lines[0], tokens[0], 'async')).toContain('keyword.other.lpc');
        expect(scopesAt(lines[1], tokens[1], 'await')).toContain('keyword.control.lpc');
        expect(scopesAt(lines[1], tokens[1], 'async_yield')).not.toContain('keyword.other.lpc');
        expect(scopesAt(lines[2], tokens[2], 'async')).toContain('string.quoted.double.lpc');
    });

    test('highlights promise, acatch and time_expression as language syntax', () => {
        const lines = ['promise<int> pending;', 'async mixed f() { return acatch(await next()); }', 'int elapsed = time_expression { work(); };'];
        const tokens = tokenize(lines);
        expect(scopesAt(lines[0], tokens[0], 'promise')).toContain('storage.type.lpc');
        expect(scopesAt(lines[1], tokens[1], 'acatch')).toContain('keyword.control.lpc');
        expect(scopesAt(lines[2], tokens[2], 'time_expression')).toContain('keyword.control.lpc');
    });

    test('keeps template text and nested interpolated code in their own scopes', () => {
        const line = 'string s = `hello ${`inner ${value + 1}`} tail`; int after;';
        const tokens = tokenize([line])[0];
        expect(scopesAt(line, tokens, 'hello')).toContain('string.template.lpc');
        expect(scopesAt(line, tokens, 'inner')).toContain('string.template.lpc');
        expect(scopesAt(line, tokens, 'value')).toContain('meta.embedded.expression.lpc');
        expect(scopesAt(line, tokens, '1')).toContain('constant.numeric.integer.lpc');
        expect(scopesAt(line, tokens, 'tail')).toContain('string.template.lpc');
        expect(scopesAt(line, tokens, 'after')).not.toContain('string.template.lpc');
    });

    test('recognizes literal boundaries, optional access and lowercase text markers', () => {
        const lines = ['float x = 1.; float y = 1_2.5e-2; mixed v = m?.key;', 'string *a = @@end', 'hello', 'ending', 'end;', 'return 1;'];
        const tokens = tokenize(lines);
        expect(scopesAt(lines[0], tokens[0], '1.')).toContain('constant.numeric.float.lpc');
        expect(scopesAt(lines[0], tokens[0], '1_2.5e-2')).toContain('constant.numeric.float.lpc');
        expect(scopesAt(lines[0], tokens[0], '?.')).toContain('keyword.operator.member.lpc');
        expect(scopesAt(lines[3], tokens[3], 'ending')).toContain('string.heredoc.lpc');
        expect(scopesAt(lines[5], tokens[5], 'return')).toContain('keyword.control.lpc');
    });

    test('restores keyword highlighting in the else branch and after endif', () => {
        const lines = ['#if 0', 'return 1;', '#else', 'if (flag) return file;', '#endif', 'return 0;'];
        const tokens = tokenize(lines);
        expectInactive(lines[1], tokens[1]);
        expectActive(lines[3], tokens[3]);
        expectActive(lines[5], tokens[5]);
        expect(scopesAt(lines[3], tokens[3], 'if')).toContain('keyword.control.lpc');
        expect(scopesAt(lines[2], tokens[2], '#else')).toContain('keyword.control.preprocessor.conditional.lpc');
    });

    test.each(['#elif 1', '#elif FEATURE'])('stops lexical disabling at %s without evaluating the condition', branch => {
        const lines = ['#if 0', 'return 1;', branch, 'return 2;', '#else', 'return 3;', '#endif'];
        const tokens = tokenize(lines);
        expectInactive(lines[1], tokens[1]);
        expectActive(lines[3], tokens[3]);
        expectActive(lines[5], tokens[5]);
    });

    test('keeps a literal elif zero inactive and restores the following branch', () => {
        const lines = ['#if 0', 'return 1;', '#elif 0', 'return 2;', '#elif FEATURE', 'return 3;', '#else', 'return 4;', '#endif'];
        const tokens = tokenize(lines);
        expectInactive(lines[1], tokens[1]);
        expectInactive(lines[3], tokens[3]);
        expectActive(lines[5], tokens[5]);
        expectActive(lines[7], tokens[7]);
    });

    test('does not treat directive lines in a heredoc as branch boundaries', () => {
        const lines = ['#if 0', '@TEXT', '#else', '#endif', 'TEXT', 'return 1;', '#else', 'return 2;', '#endif'];
        const tokens = tokenize(lines);
        expectInactive(lines[5], tokens[5]);
        expectActive(lines[7], tokens[7]);
    });

    test.each(['#if FEATURE', '#ifdef FEATURE', '#ifndef FEATURE', '#if 0'])('preserves the outer inactive branch around nested %s', nested => {
        const lines = [
            '#if 0', nested, 'return 1;', '#else', 'return 2;', '#endif',
            'return 3;', '#else', 'return 4;', '#endif', 'return 5;'
        ];
        const tokens = tokenize(lines);
        for (const index of [2, 4, 6]) {
            expectInactive(lines[index], tokens[index]);
        }
        expectActive(lines[8], tokens[8]);
        expectActive(lines[10], tokens[10]);
    });

    test('handles multiple nested levels and a new inactive block inside the active else branch', () => {
        const lines = [
            '#if 0', '#if FEATURE', '#if OTHER', 'return 1;', '#elif THIRD', 'return 2;',
            '#endif', '#endif', 'return 3;', '#else', '#if 0', 'return 4;', '#else',
            'return 5;', '#endif', 'return 6;', '#endif', 'return 7;'
        ];
        const tokens = tokenize(lines);
        for (const index of [3, 5, 8, 11]) {
            expectInactive(lines[index], tokens[index]);
        }
        for (const index of [13, 15, 17]) {
            expectActive(lines[index], tokens[index]);
        }
    });

    test('ignores directive text inside comments and strings in an inactive branch', () => {
        const lines = ['#if 0', '/*', '#else', '*/', '"#endif";', 'return 1;', '#else', 'return 2;', '#endif'];
        const tokens = tokenize(lines);
        expectInactive(lines[5], tokens[5]);
        expectActive(lines[7], tokens[7]);
    });

    test.each(['#if 0 || 1', '#if 0 + FEATURE', '#if 0 == 0', '#if 0x1', '#if 01'])('does not disable an expression starting with zero: %s', directive => {
        const lines = [directive, 'return 1;', '#else', 'return 2;', '#endif'];
        const tokens = tokenize(lines);
        expectActive(lines[1], tokens[1]);
        expectActive(lines[3], tokens[3]);
    });

    test.each(['  # if 0  ', '#if 0 // disabled', '#if 0 /* disabled */', '#if 0 /* disabled */ // note'])('accepts a literal zero with whitespace or comments: %s', directive => {
        const lines = [directive, 'return 1;', '  # else', 'return 2;', '#endif'];
        const tokens = tokenize(lines);
        expectInactive(lines[1], tokens[1]);
        expectActive(lines[3], tokens[3]);
    });
});
