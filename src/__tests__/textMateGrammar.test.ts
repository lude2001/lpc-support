import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

const grammarPath = path.resolve(__dirname, '../../syntaxes/lpc.tmLanguage.json');
const packagePath = path.resolve(__dirname, '../../package.json');

function loadGrammar(): any {
    return JSON.parse(fs.readFileSync(grammarPath, 'utf8'));
}

describe('TextMate LPC grammar', () => {
    test('semantic token contributions expose richer LPC visual roles and theme scopes', () => {
        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        const contributes = packageJson.contributes;
        const tokenTypes = contributes.semanticTokenTypes.map((token: { id: string }) => token.id);
        const tokenModifiers = contributes.semanticTokenModifiers.map((modifier: { id: string }) => modifier.id);
        const semanticTokenScopes = contributes.semanticTokenScopes.find(
            (entry: { language: string }) => entry.language === 'lpc'
        )?.scopes;

        expect(tokenTypes).toEqual(expect.arrayContaining([
            'lpcType',
            'method',
            'parameter',
            'inactive'
        ]));
        expect(tokenModifiers).toEqual(expect.arrayContaining([
            'declaration',
            'local',
            'defaultLibrary',
            'readonly',
            'static'
        ]));
        expect(semanticTokenScopes).toEqual(expect.objectContaining({
            lpcType: ['support.type.primitive.lpc'],
            method: ['entity.name.function.member.lpc'],
            macro: ['entity.name.function.preprocessor.lpc'],
            builtin: ['support.function.efun.lpc'],
            inactive: ['comment.block.preprocessor.lpc']
        }));
    });

    test('stays lexical and does not duplicate semantic token responsibilities', () => {
        const grammarSource = fs.readFileSync(grammarPath, 'utf8');

        expect(grammarSource).not.toContain('support.function.efun.lpc');
        expect(grammarSource).not.toContain('variable.other.lpc');
    });

    test('provides richer lexical fallback scopes without owning semantic facts', () => {
        const grammarSource = fs.readFileSync(grammarPath, 'utf8');

        expect(grammarSource).toContain('meta.preprocessor.define.lpc');
        expect(grammarSource).toContain('entity.name.function.preprocessor.lpc');
        expect(grammarSource).toContain('variable.parameter.preprocessor.lpc');
        expect(grammarSource).toContain('meta.function-call.lpc');
        expect(grammarSource).toContain('entity.name.function.fallback.lpc');
        expect(grammarSource).toContain('meta.member-access.lpc');
        expect(grammarSource).toContain('entity.name.function.member.lpc');
        expect(grammarSource).toContain('comment.block.preprocessor.lpc');
        expect(grammarSource).toContain('comment.block.documentation.lpc');
        expect(grammarSource).not.toContain('support.function.efun.lpc');
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
