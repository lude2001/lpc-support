import { describe, expect, test } from '@jest/globals';
import { createDefaultFluffOSDialectProfile } from '../dialect';
import {
    isLpcBuiltinType,
    isLpcDeclarationModifier,
    isLpcDocumentationType,
    isLpcKeyword,
    isLpcNonCallParenKeyword,
    isLpcPreprocessorDirective,
    LPC_BUILTIN_TYPES,
    LPC_COMPLETION_KEYWORDS,
    LPC_CONTROL_KEYWORDS,
    LPC_DECLARATION_MODIFIERS,
    LPC_PREPROCESSOR_DIRECTIVES,
    stripLeadingLpcDeclarationModifiers
} from '../languageFacts';

describe('LPC language facts', () => {
    test('centralizes lexer-backed type, modifier, keyword, and preprocessor facts', () => {
        expect(LPC_BUILTIN_TYPES).toContain('function');
        expect(LPC_DECLARATION_MODIFIERS).toContain('nosave');
        expect(LPC_CONTROL_KEYWORDS).toContain('foreach');
        expect(LPC_COMPLETION_KEYWORDS).toContain('inherit');
        expect(LPC_PREPROCESSOR_DIRECTIVES).toEqual(expect.arrayContaining([
            'include',
            'define',
            'undef',
            'if',
            'elif',
            'else',
            'endif',
            'pragma'
        ]));

        expect(isLpcBuiltinType('MIXED')).toBe(true);
        expect(isLpcBuiltinType('array')).toBe(true);
        expect(isLpcBuiltinType('closure')).toBe(true);
        expect(isLpcBuiltinType('__TREE__')).toBe(true);
        expect(isLpcDeclarationModifier('VarArgs')).toBe(true);
        expect(isLpcKeyword('return')).toBe(true);
        expect(isLpcKeyword('nosave')).toBe(true);
        expect(isLpcNonCallParenKeyword('if')).toBe(true);
        expect(isLpcPreprocessorDirective('ifdef')).toBe(true);
        expect(isLpcPreprocessorDirective('unknown')).toBe(false);
        expect(isLpcDocumentationType('closure')).toBe(true);
    });

    test('drives the default dialect profile instead of duplicating facts there', () => {
        const dialect = createDefaultFluffOSDialectProfile();

        expect(dialect.builtinTypes).toEqual([...LPC_BUILTIN_TYPES]);
        expect(dialect.declarationModifiers).toEqual([...LPC_DECLARATION_MODIFIERS]);
        expect(dialect.controlKeywords).toEqual([...LPC_CONTROL_KEYWORDS]);
        expect(dialect.preprocessorDirectives).toEqual([...LPC_PREPROCESSOR_DIRECTIVES]);
        expect(dialect.supportedKeywords).toEqual(expect.arrayContaining([
            ...LPC_BUILTIN_TYPES,
            ...LPC_DECLARATION_MODIFIERS,
            ...LPC_CONTROL_KEYWORDS
        ]));
    });

    test('normalizes type prefixes through centralized modifier facts', () => {
        expect(stripLeadingLpcDeclarationModifiers('private nosave object *')).toBe('object *');
        expect(stripLeadingLpcDeclarationModifiers('const string')).toBe('string');
    });
});
