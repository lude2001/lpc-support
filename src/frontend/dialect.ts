import { LpcDialectProfile } from './types';
import {
    LPC_BUILTIN_TYPES,
    LPC_CONTROL_KEYWORDS,
    LPC_DECLARATION_KEYWORDS,
    LPC_DECLARATION_MODIFIERS,
    LPC_EXPRESSION_KEYWORDS,
    LPC_OPERATORS,
    LPC_PARTIAL_DIALECT_KEYWORDS,
    LPC_PARTIAL_DIALECT_OPERATORS,
    LPC_PREPROCESSOR_DIRECTIVES
} from './languageFacts';

export function createDefaultFluffOSDialectProfile(): LpcDialectProfile {
    return {
        name: 'FluffOS',
        supportedKeywords: [
            ...LPC_CONTROL_KEYWORDS,
            ...LPC_DECLARATION_KEYWORDS,
            ...LPC_EXPRESSION_KEYWORDS,
            ...LPC_BUILTIN_TYPES,
            ...LPC_DECLARATION_MODIFIERS
        ],
        supportedOperators: [...LPC_OPERATORS],
        builtinTypes: [...LPC_BUILTIN_TYPES],
        declarationModifiers: [...LPC_DECLARATION_MODIFIERS],
        controlKeywords: [...LPC_CONTROL_KEYWORDS],
        declarationKeywords: [...LPC_DECLARATION_KEYWORDS],
        expressionKeywords: [...LPC_EXPRESSION_KEYWORDS],
        preprocessorDirectives: [...LPC_PREPROCESSOR_DIRECTIVES],
        recognizedPartialKeywords: [...LPC_PARTIAL_DIALECT_KEYWORDS],
        recognizedPartialOperators: [...LPC_PARTIAL_DIALECT_OPERATORS]
    };
}
