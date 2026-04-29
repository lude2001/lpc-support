import * as fs from 'fs';
import * as path from 'path';

const grammarPath = path.resolve(__dirname, '../../syntaxes/lpc.tmLanguage.json');

function loadGrammar(): any {
    return JSON.parse(fs.readFileSync(grammarPath, 'utf8'));
}

describe('TextMate LPC grammar', () => {
    test('stays lexical and does not duplicate semantic token responsibilities', () => {
        const grammarSource = fs.readFileSync(grammarPath, 'utf8');

        expect(grammarSource).not.toContain('support.function.efun.lpc');
        expect(grammarSource).not.toContain('entity.name.function.lpc');
        expect(grammarSource).not.toContain('variable.other.lpc');
        expect(grammarSource).not.toContain('meta.member.access.lpc');
    });

    test('keeps lexer-level keywords covered as a fallback', () => {
        const grammar = loadGrammar();
        const keywordPatterns = grammar.repository.keywords.patterns
            .map((pattern: { match: string }) => pattern.match)
            .join('\n');
        const typePatterns = grammar.repository.types.patterns
            .map((pattern: { match: string }) => pattern.match)
            .join('\n');
        const combined = `${keywordPatterns}\n${typePatterns}`;

        for (const word of ['catch', 'include', 'in', 'new', 'nosave', 'ref']) {
            expect(combined).toContain(word);
        }
    });

    test('covers LPC delimiter forms that semantic tokens may receive late', () => {
        const grammar = loadGrammar();

        expect(grammar.repository.heredoc.begin).toBe('@([A-Z_][A-Z0-9_]*)\\s*$');
        expect(grammar.repository.arrayDelimiter.begin).toBe('@@([A-Z_][A-Z0-9_]*)\\s*$');
        expect(grammar.repository.heredoc.patterns).toEqual([]);
        expect(grammar.repository.arrayDelimiter.patterns).toEqual([]);
    });

    test('orders multi-character operators before their shorter forms', () => {
        const grammar = loadGrammar();
        const operatorMatches = grammar.repository.operators.patterns
            .map((pattern: { match: string }) => pattern.match);
        const operatorSource = operatorMatches.join('\n');

        expect(operatorSource).toContain('\\.\\.\\.');
        expect(operatorSource).toContain('\\.\\.');
        expect(operatorSource).toContain('::');
        expect(operatorSource).toContain('<<');
        expect(operatorSource).toContain('>>');
        expect(operatorSource).toContain('->');
        expect(operatorMatches[0]).toContain('<<=');
        expect(operatorMatches[0]).toContain('>>=');
        expect(operatorMatches[0]).toContain('::');
        expect(operatorMatches[0]).toContain('\\.\\.\\.');
        expect(operatorMatches[0]).toContain('\\.\\.');
    });
});
