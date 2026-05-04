import type { PreprocessorDirectiveKind } from './types';

export const LPC_BUILTIN_TYPES = [
    'void',
    'int',
    'float',
    'string',
    'object',
    'mixed',
    'mapping',
    'function',
    'buffer',
    'array',
    'closure',
    '__TREE__',
    'struct',
    'class'
] as const;

export const LPC_DECLARATION_MODIFIERS = [
    'private',
    'public',
    'protected',
    'varargs',
    'nosave',
    'static',
    'nomask'
] as const;

export const LPC_CONTROL_KEYWORDS = [
    'if',
    'else',
    'for',
    'while',
    'do',
    'switch',
    'case',
    'default',
    'break',
    'continue',
    'return',
    'foreach',
    'catch',
    'in'
] as const;

export const LPC_DECLARATION_KEYWORDS = [
    'inherit',
    'include',
    'ref',
    'struct',
    'class'
] as const;

export const LPC_EXPRESSION_KEYWORDS = [
    'new',
    'sizeof',
    'efun'
] as const;

export const LPC_COMPLETION_KEYWORDS = [
    'inherit',
    'include',
    'if',
    'else',
    'for',
    'while',
    'foreach',
    'switch',
    'return',
    'new',
    'catch'
] as const;

export const LPC_PREPROCESSOR_DIRECTIVES = [
    'include',
    'define',
    'undef',
    'if',
    'ifdef',
    'ifndef',
    'elif',
    'else',
    'endif',
    'pragma',
    'error',
    'warning',
    'line'
] as const;

export const LPC_OPERATORS = [
    '...',
    '..',
    '->',
    '.',
    '++',
    '--',
    '<<=',
    '>>=',
    '+=',
    '-=',
    '*=',
    '/=',
    '%=',
    '^=',
    '+',
    '-',
    '*',
    '/',
    '%',
    '::',
    ';',
    ',',
    '(',
    ')',
    '{',
    '}',
    '[',
    ']',
    '?',
    ':',
    '$',
    '>',
    '<',
    '>=',
    '<=',
    '==',
    '!=',
    '=',
    '!',
    '&&',
    '||',
    '<<',
    '>>',
    '&',
    '|',
    '^',
    '~',
    '|=',
    '&='
] as const;

export const LPC_PARTIAL_DIALECT_KEYWORDS = [
    'any',
    'bytes',
    'const',
    'deprecated',
    'false',
    'functions',
    'intrinsic',
    'is',
    'lwobject',
    'null',
    'status',
    'symbol',
    'true',
    'undefined',
    'unknown',
    'virtual',
    'async'
] as const;

export const LPC_PARTIAL_DIALECT_OPERATORS = [
    '**',
    '**=',
    '===',
    '!==',
    '=>',
    '??',
    '??=',
    '?.',
    '||=',
    '&&=',
    '>>>',
    '>>>=',
    '<..',
    '@',
    '@@',
    '#',
    '(*',
    '`'
] as const;

export const LPC_NON_CALL_PAREN_KEYWORDS = [
    'return',
    'if',
    'while',
    'for',
    'foreach',
    'switch',
    'catch'
] as const;

export const LPC_DOCUMENTATION_TYPE_ALIASES = [
    'status',
    'closure',
    'array',
    'any'
] as const;

const BUILTIN_TYPE_SET = toReadonlySet(LPC_BUILTIN_TYPES);
const DECLARATION_MODIFIER_SET = toReadonlySet(LPC_DECLARATION_MODIFIERS);
const CONTROL_KEYWORD_SET = toReadonlySet(LPC_CONTROL_KEYWORDS);
const DECLARATION_KEYWORD_SET = toReadonlySet(LPC_DECLARATION_KEYWORDS);
const EXPRESSION_KEYWORD_SET = toReadonlySet(LPC_EXPRESSION_KEYWORDS);
const PREPROCESSOR_DIRECTIVE_SET = toReadonlySet(LPC_PREPROCESSOR_DIRECTIVES);
const NON_CALL_PAREN_KEYWORD_SET = toReadonlySet(LPC_NON_CALL_PAREN_KEYWORDS);
const DOCUMENTATION_TYPE_SET = toReadonlySet([
    ...LPC_BUILTIN_TYPES,
    ...LPC_DOCUMENTATION_TYPE_ALIASES
]);
const TYPE_PREFIX_MODIFIER_SET = toReadonlySet([
    ...LPC_DECLARATION_MODIFIERS,
    'const'
]);
const LPC_IDENTIFIER_TEXT = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function isLpcBuiltinType(value: string | undefined): boolean {
    return hasLowercase(BUILTIN_TYPE_SET, value);
}

export function isLpcDeclarationModifier(value: string | undefined): boolean {
    return hasLowercase(DECLARATION_MODIFIER_SET, value);
}

export function isLpcKeyword(value: string | undefined): boolean {
    const lower = value?.toLowerCase();
    return Boolean(
        lower
        && (
            CONTROL_KEYWORD_SET.has(lower)
            || DECLARATION_KEYWORD_SET.has(lower)
            || EXPRESSION_KEYWORD_SET.has(lower)
            || DECLARATION_MODIFIER_SET.has(lower)
        )
    );
}

export function isLpcNonCallParenKeyword(value: string | undefined): boolean {
    return hasLowercase(NON_CALL_PAREN_KEYWORD_SET, value);
}

export function isLpcPreprocessorDirective(value: string | undefined): value is PreprocessorDirectiveKind {
    return hasLowercase(PREPROCESSOR_DIRECTIVE_SET, value);
}

export function isLpcIdentifierLikeText(value: string | undefined): boolean {
    return Boolean(value && LPC_IDENTIFIER_TEXT.test(value));
}

export function isLpcDocumentationType(value: string | undefined): boolean {
    return hasLowercase(DOCUMENTATION_TYPE_SET, value);
}

export function stripLeadingLpcDeclarationModifiers(typeName: string): string {
    const parts = typeName.trim().split(/\s+/);
    let index = 0;
    while (index < parts.length && hasLowercase(TYPE_PREFIX_MODIFIER_SET, parts[index])) {
        index += 1;
    }

    return parts.slice(index).join(' ');
}

function toReadonlySet(values: readonly string[]): ReadonlySet<string> {
    return new Set(values.map((value) => value.toLowerCase()));
}

function hasLowercase(set: ReadonlySet<string>, value: string | undefined): boolean {
    return Boolean(value && set.has(value.toLowerCase()));
}
