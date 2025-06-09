lexer grammar LPCLexer;

// --- Keywords ---

// Control Flow
IF: 'if';
ELSE: 'else';
WHILE: 'while';
FOR: 'for';
DO: 'do';
SWITCH: 'switch';
CASE: 'case';
DEFAULT: 'default';
BREAK: 'break';
CONTINUE: 'continue';
RETURN: 'return';
FOREACH: 'foreach';
IN: 'in';
FALLTHROUGH: 'fallthrough';

// Declarations
INHERIT: 'inherit';

// Special Keywords that can be identifiers
EFUN: 'efun';
NEW: 'new';
CATCH: 'catch';
SSCANF: 'sscanf';
PARSE_COMMAND: 'parse_command';
TIME_EXPRESSION: 'time_expression';

// Modifiers
PRIVATE: 'private';
PROTECTED: 'protected';
PUBLIC: 'public';
STATIC: 'static';
NOMASK: 'nomask';
VARARGS: 'varargs';
NOSAVE: 'nosave';
REF: 'ref';

// Base Types
VOID: 'void';
INT: 'int';
STRING: 'string';
OBJECT: 'object';
ARRAY: 'array';
MAPPING: 'mapping';
FLOAT: 'float';
BUFFER: 'buffer';
MIXED: 'mixed';
FUNCTION: 'function';
CLASS: 'class';
STRUCT: 'struct';
CLOSURE: 'closure';

// New token for preprocessor line content
PP_BODY:;

// --- Preprocessor Directives (Lexer) ---
// Note: #include is handled separately in the parser and does not need a mode change.
PP_INCLUDE: '#include';
PP_DEFINE: '#define'     -> pushMode(PP_ID_THEN_BODY);
PP_IFDEF: '#ifdef'       -> pushMode(PP_ID_ONLY);
PP_IFNDEF: '#ifndef'      -> pushMode(PP_ID_ONLY);
PP_IF: '#if'          -> pushMode(PP_BODY_ONLY);
PP_ELSE: '#else'        -> pushMode(PP_BODY_ONLY);
PP_ENDIF: '#endif'       -> pushMode(PP_BODY_ONLY);
PP_ERROR: '#error'       -> pushMode(PP_BODY_ONLY);
PP_PRAGMA: '#pragma'      -> pushMode(PP_BODY_ONLY);

// --- Symbols & Operators ---
LBRACK: '[';
RBRACK: ']';
LBRACE: '{';
RBRACE: '}';
SEMICOLON: ';';
LPAREN: '(';
RPAREN: ')';
ASSIGN: '=';
PLUS_ASSIGN: '+=';
MINUS_ASSIGN: '-=';
STAR_ASSIGN: '*=';
DIV_ASSIGN: '/=';
MOD_ASSIGN: '%=';
AND_ASSIGN: '&=';
OR_ASSIGN: '|=';
XOR_ASSIGN: '^=';
LSHIFT_ASSIGN: '<<=';
RSHIFT_ASSIGN: '>>=';
COMMA: ',';
QUESTION: '?';
COLON: ':';
SCOPE_RESOLUTION: '::';
RANGE: '..';
ELLIPSIS: '...';
ARROW: '->';
PLUS: '+';
MINUS: '-';
STAR: '*';
DIV: '/';
MOD: '%';
INC: '++';
DEC: '--';
EQ: '==';
NEQ: '!=';
GT: '>';
LT: '<';
GTE: '>=';
LTE: '<=';
NOT: '!';
AND: '&&';
OR: '||';
BITWISE_AND: '&';
BITWISE_OR: '|';
BITWISE_XOR: '^';
BITWISE_NOT: '~';
LSHIFT: '<<';
RSHIFT: '>>';
HASH_SINGLE_QUOTE: '#\''; // For function pointers like #'my_func

// --- Literals & Identifiers ---
STRING_LITERAL: '"' ( '\\'. | ~[\\"] )*? '"';
LESS_THAN_PATH: '<' (~[>])+ '>';

NUMBER
    : HexLiteral
    | BinaryLiteral
    | DecimalLiteral
    ;

IDENTIFIER: [a-zA-Z_][a-zA-Z0-9_]*;

fragment DecimalDigit: [0-9];
fragment DecimalDigits: DecimalDigit ('_'? DecimalDigit)*;
fragment HexDigit: [0-9a-fA-F];
fragment HexDigits: HexDigit ('_'? HexDigit)*;
fragment BinaryDigit: '0' | '1';
fragment BinaryDigits: BinaryDigit ('_'? BinaryDigit)*;
fragment DecimalLiteral: '0' | [1-9] ('_'? DecimalDigits)?;
fragment HexLiteral: '0' [xX] HexDigits;
fragment BinaryLiteral: '0' [bB] BinaryDigits;

// --- Whitespace & Comments ---
WHITESPACE: [ \t\r\n\uFEFF]+ -> skip;
LINE_COMMENT: '//' ~[\r\n]* -> skip;
BLOCK_COMMENT: '/*' .*? '*/' -> skip;

// --- Preprocessor Modes ---

// Mode for directives like #if, #else, #error, #pragma that are followed by a body.
// Also used by PP_ID_THEN_BODY mode after it has consumed the identifier.
mode PP_BODY_ONLY;
  PP_BODY_WS:     [ \t]+    -> skip;
  PP_BODY_CONTENT: ~[\r\n]* -> type(PP_BODY), popMode;

// Mode for directives like #ifdef, #ifndef that are followed by only an identifier.
mode PP_ID_ONLY;
  PP_ID_WS: [ \t]+ -> skip;
  PP_ID_ID: [a-zA-Z_][a-zA-Z0-9_]* -> type(IDENTIFIER);
  PP_ID_NL: [\r\n]+ -> popMode, skip;

// Mode for #define, which is followed by an identifier and then a body.
mode PP_ID_THEN_BODY;
  PP_ID_BODY_WS: [ \t]+ -> skip;
  PP_ID_BODY_ID: [a-zA-Z_][a-zA-Z0-9_]* -> type(IDENTIFIER), mode(PP_BODY_ONLY);
  PP_ID_BODY_NL: [\r\n]+ -> popMode, skip; // Handle defines with no identifier or body. 