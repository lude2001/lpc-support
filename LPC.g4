grammar LPC;

// Parser Rules

program: (preprocessorDirective | declaration | functionDefinition | classDefinition)* EOF;

// Preprocessor Directives
preprocessorDirective
    : includeDirective
    | defineDirective
    | ifdefDirective
    | ifndefDirective
    | elseDirective
    | endifDirective
    | undefDirective
    | pragmaDirective
    ;

includeDirective: HASH INCLUDE (STRING_LITERAL | ANGLE_BRACKET_STRING_LITERAL);

defineDirective: HASH DEFINE IDENTIFIER (LPAREN identifierList? RPAREN)? preprocessorTokenSequence?;
identifierList: IDENTIFIER (COMMA IDENTIFIER)*;
preprocessorTokenSequence: PREPROCESSOR_TOKEN*; // any sequence of tokens until end of line

ifdefDirective: HASH IFDEF IDENTIFIER;
ifndefDirective: HASH IFNDEF IDENTIFIER;
elseDirective: HASH ELSE;
endifDirective: HASH ENDIF;
undefDirective: HASH UNDEF IDENTIFIER;
pragmaDirective: HASH PRAGMA preprocessorTokenSequence;

// Declarations
declaration: typeModifier* typeSpecifier variableDeclaratorList SEMICOLON;
variableDeclaratorList: variableDeclarator (COMMA variableDeclarator)*;
variableDeclarator: IDENTIFIER arrayIndices? (ASSIGN (expression | initializerList))?;
arrayIndices: (LBRACKET (expression | ) RBRACKET)+; // Simplified from EBNF's recursive form
initializerList: LBRACE_LITERAL (expression (COMMA expression)* COMMA?)? RBRACE_LITERAL; // For ({ }) array literals

// Type Specifiers
typeSpecifier: baseTypeSpecifier arraySpecifier?;
baseTypeSpecifier
    : VOID | INT | STRING | OBJECT | FLOAT | MIXED | STATUS | BUFFER | MAPPING | FUNCTION | classIdentifier
    ;
arraySpecifier: MUL_OP; // '*'
classIdentifier: IDENTIFIER;

typeModifier
    : STATIC | NOMASK | PRIVATE | PUBLIC | VARARGS | NOSAVE
    ;

// Expressions
expression: assignmentExpression;

assignmentExpression: conditionalExpression (assignmentOperator assignmentExpression)?;
assignmentOperator
    : ASSIGN | ADD_ASSIGN | SUB_ASSIGN | MUL_ASSIGN | DIV_ASSIGN | MOD_ASSIGN
    | AND_ASSIGN | OR_ASSIGN | XOR_ASSIGN | LSHIFT_ASSIGN | RSHIFT_ASSIGN
    ;

conditionalExpression: logicalOrExpression (QUESTION expression COLON conditionalExpression)?;

logicalOrExpression: logicalAndExpression (OR_OP logicalAndExpression)*;
logicalAndExpression: bitwiseOrExpression (AND_OP bitwiseOrExpression)*;
bitwiseOrExpression: bitwiseXorExpression (BITOR_OP bitwiseXorExpression)*;
bitwiseXorExpression: bitwiseAndExpression (CARET_OP bitwiseAndExpression)*;
bitwiseAndExpression: equalityExpression (BITAND_OP equalityExpression)*;

equalityExpression: relationalExpression ((EQ_OP | NE_OP) relationalExpression)*;
relationalExpression: shiftExpression ((LT_OP | GT_OP | LE_OP | GE_OP) shiftExpression)*;
shiftExpression: additiveExpression ((LSHIFT_OP | RSHIFT_OP) additiveExpression)*;
additiveExpression: multiplicativeExpression ((ADD_OP | SUB_OP) multiplicativeExpression)*;
multiplicativeExpression: castExpression ((MUL_OP | DIV_OP | MOD_OP) castExpression)*;

castExpression: (LPAREN typeSpecifier RPAREN castExpression) | unaryExpression;

unaryExpression
    : (BANG_OP | BITNOT_OP | SUB_OP | INC_OP | DEC_OP) unaryExpression
    | postfixExpression
    ;

postfixExpression: primaryExpression (postfixOperator | memberAccess | functionCall | arrayAccess | rangeAccess | remoteFunctionPointerSuffix)*;

remoteFunctionPointerSuffix // New rule for the obj->#'id' part
    : ARROW HASH SINGLE_QUOTE IDENTIFIER
    ;

postfixOperator: INC_OP | DEC_OP;
memberAccess: ARROW IDENTIFIER;
functionCall: LPAREN argumentExpressionList? RPAREN;
argumentExpressionList: assignmentExpression (COMMA assignmentExpression)*;
arrayAccess: LBRACKET expression RBRACKET;
rangeAccess: LBRACKET expression? RANGE_OP expression? RBRACKET;

primaryExpression
    : IDENTIFIER
    | constant
    | LPAREN expression RPAREN
    | arrayLiteral
    | mappingLiteral
    | closureExpression
    | simpleFunctionPointerLiteral // Changed from functionPointerLiteral
    | classConstructorCall
    | closureArgPlaceholder        // Added for $n
    | closureCapture             // Added for $(expression)
    ;

closureArgPlaceholder: DOLLAR INTEGER_LITERAL;
closureCapture: DOLLAR_LPAREN expression RPAREN;

constant: INTEGER_LITERAL | FLOAT_LITERAL | STRING_LITERAL;

arrayLiteral: LBRACE_LITERAL (argumentExpressionList | (expression (COMMA expression)* COMMA?))? RBRACE_LITERAL; // ({ ... })
mappingLiteral: LBRACKET_LITERAL (mappingElement (COMMA mappingElement)* COMMA?)? RBRACKET_LITERAL; // ([ ... ])
mappingElement: expression COLON expression;

// Closure Expressions - Simplified
closureExpression
    : LBRACE_LPAREN (closureArgsAndBody | closureBodyOnly | expressionClosure | objectFunctionClosure) RBRACE_RPAREN
    ;
closureArgsAndBody: parameterList (ARROW | LAMBDA_ARROW) statement*; // e.g. (: int x -> write(x) :)
closureBodyOnly: statement+; // e.g. (: write("hello") :)
expressionClosure: expression; // e.g. (: $1 + $2 :) or (: this_object()->foo() :)
objectFunctionClosure: expression COMMA (STRING_LITERAL | IDENTIFIER) (COMMA arrayLiteral)?; // e.g. (: ob, "func" :)

// Renamed to simpleFunctionPointerLiteral and kept only the non-recursive part
simpleFunctionPointerLiteral
    : HASH SINGLE_QUOTE IDENTIFIER // #'ident'
    ;
// The part 'expression ARROW HASH SINGLE_QUOTE IDENTIFIER' is now handled by 'remoteFunctionPointerSuffix' in 'postfixExpression'

classConstructorCall: NEW LPAREN CLASS classIdentifier (COMMA namedArgumentList)? RPAREN;
namedArgumentList: namedArgument (COMMA namedArgument)*;
namedArgument: IDENTIFIER COLON expression;

// Function Definition
functionDefinition: typeModifier* typeSpecifier IDENTIFIER LPAREN parameterList? RPAREN compoundStatement;
parameterList: parameterDeclaration (COMMA parameterDeclaration)* (COMMA ELLIPSIS)?; // Varargs
parameterDeclaration: typeSpecifier IDENTIFIER arraySpecifier?;

compoundStatement: LBRACE (declaration | statement)* RBRACE;

// Statements
statement
    : expressionStatement
    | compoundStatement
    | selectionStatement
    | iterationStatement
    | jumpStatement
    | inheritStatement
    | tryCatchStatement
    ;

expressionStatement: expression? SEMICOLON;

selectionStatement: ifStatement | switchStatement;
ifStatement: IF LPAREN expression RPAREN statement (ELSE statement)?;
switchStatement: SWITCH LPAREN expression RPAREN LBRACE switchCase* defaultCase? RBRACE;
switchCase: CASE (expression | STRING_LITERAL) COLON statement*;
defaultCase: DEFAULT COLON statement*;

iterationStatement: whileStatement | forStatement | doWhileStatement | foreachStatement;
whileStatement: WHILE LPAREN expression RPAREN statement;
doWhileStatement: DO statement WHILE LPAREN expression RPAREN SEMICOLON;
forStatement: FOR LPAREN expressionStatement expressionStatement expression? RPAREN statement;
foreachStatement: FOREACH LPAREN typeSpecifier? IDENTIFIER (COMMA typeSpecifier? IDENTIFIER)? IN expression RPAREN statement; // Reverted to original

jumpStatement: BREAK SEMICOLON | CONTINUE SEMICOLON | RETURN expression? SEMICOLON;

inheritStatement: INHERIT typeModifier? STRING_LITERAL SEMICOLON;

tryCatchStatement: TRY compoundStatement CATCH LPAREN IDENTIFIER RPAREN compoundStatement;

// Class Definition
classDefinition: CLASS IDENTIFIER (EXTENDS classIdentifier)? LBRACE (declaration | functionDefinition)* RBRACE SEMICOLON?;

// Lexer Rules
// Keywords
HASH: '#';
INCLUDE: 'include';
DEFINE: 'define';
IFDEF: 'ifdef';
IFNDEF: 'ifndef';
ELSE: 'else';
ENDIF: 'endif';
UNDEF: 'undef';
PRAGMA: 'pragma';

VOID: 'void';
INT: 'int';
STRING: 'string';
OBJECT: 'object';
FLOAT: 'float';
MIXED: 'mixed';
STATUS: 'status';
BUFFER: 'buffer';
MAPPING: 'mapping';
FUNCTION: 'function';

STATIC: 'static';
NOMASK: 'nomask';
PRIVATE: 'private';
PUBLIC: 'public';
VARARGS: 'varargs';
NOSAVE: 'nosave';

NEW: 'new';
CLASS: 'class';

IF: 'if';
SWITCH: 'switch';
CASE: 'case';
DEFAULT: 'default';
WHILE: 'while';
DO: 'do';
FOR: 'for';
FOREACH: 'foreach';
IN: 'in'; // Used in foreach
BREAK: 'break';
CONTINUE: 'continue';
RETURN: 'return';
INHERIT: 'inherit';
TRY: 'try';
CATCH: 'catch';
EXTENDS: 'extends';


// Literals
LBRACE_LITERAL: '({'; // For array literals
RBRACE_LITERAL: '})'; // For array literals
LBRACKET_LITERAL: '(['; // For mapping literals
RBRACKET_LITERAL: '])'; // For mapping literals

LBRACE_LPAREN: '(:' ; // For closures
RBRACE_RPAREN: ':)' ; // For closures


// Operators and Punctuation
LPAREN: '(';
RPAREN: ')';
LBRACE: '{';
RBRACE: '}';
LBRACKET: '[';
RBRACKET: ']';
SEMICOLON: ';';
COMMA: ',';
COLON: ':';
QUESTION: '?';
ELLIPSIS: '...';
SINGLE_QUOTE: '\'';


ASSIGN: '=';
ADD_ASSIGN: '+=';
SUB_ASSIGN: '-=';
MUL_ASSIGN: '*=';
DIV_ASSIGN: '/=';
MOD_ASSIGN: '%=';
AND_ASSIGN: '&=';
OR_ASSIGN: '|=';
XOR_ASSIGN: '^=';
LSHIFT_ASSIGN: '<<=';
RSHIFT_ASSIGN: '>>=';

OR_OP: '||';
AND_OP: '&&';
BITOR_OP: '|';
CARET_OP: '^';
BITAND_OP: '&';
EQ_OP: '==';
NE_OP: '!=';
LT_OP: '<';
GT_OP: '>';
LE_OP: '<=';
GE_OP: '>=';
LSHIFT_OP: '<<';
RSHIFT_OP: '>>';
ADD_OP: '+';
SUB_OP: '-';
MUL_OP: '*';
DIV_OP: '/';
MOD_OP: '%';
BANG_OP: '!';
BITNOT_OP: '~';
INC_OP: '++';
DEC_OP: '--';
ARROW: '->';
LAMBDA_ARROW: '=>'; // Or use ARROW if it's the same token for closures
RANGE_OP: '..';
DOLLAR: '$';
DOLLAR_LPAREN: '$(';


// Identifiers, Literals, Comments, Whitespace
ANGLE_BRACKET_STRING_LITERAL : '<' ~[>]+ '>' ; // Moved here and ensured definition

IDENTIFIER: [a-zA-Z_] [a-zA-Z0-9_]*;

DECIMAL_LITERAL: '0' | [1-9] [0-9]*;
HEX_LITERAL: '0' [xX] [0-9a-fA-F]+;
OCTAL_LITERAL: '0' [0-7]+;
INTEGER_LITERAL: DECIMAL_LITERAL | HEX_LITERAL | OCTAL_LITERAL;

FLOAT_LITERAL
    : [0-9]+ '.' [0-9]+ ([eE] [+-]? [0-9]+)?
    | '.' [0-9]+ ([eE] [+-]? [0-9]+)?
    | [0-9]+ [eE] [+-]? [0-9]+
    ;

STRING_LITERAL: '"' (ESCAPE_SEQUENCE | ~["\\\r\n])*? '"';

fragment HEX_DIGIT: [0-9a-fA-F];
fragment OCT_DIGIT: [0-7];

fragment ESCAPE_SEQUENCE
    : '\\' ( // Standard escapes
             '"'
           | '\\'
           | 'r'
           | 'n'
           | 't'
           | 'b'
           | 'f'
           // Octal escapes: \o, \oo, \ooo
           | OCT_DIGIT OCT_DIGIT? OCT_DIGIT?
           // Hex escapes: \xhh
           | 'x' HEX_DIGIT HEX_DIGIT
           )
    ;

LINE_COMMENT: '//' ~[\r\n]* -> skip;
BLOCK_COMMENT: '/*' .*? '*/' -> skip; // Non-greedy match

PREPROCESSOR_TOKEN: ~[\r\n]; // Catches anything on a line for #define value, use with care

WS: [ \t\r\n]+ -> skip;
// NEWLINE_TOKEN is not explicitly needed if WS skips \r\n and preprocessor handles line ends.
// If PREPROCESSOR_TOKEN needs to stop at newline, newline handling in lexer is critical.
// For now, assuming preprocessor rules in parser handle line-oriented nature.

// Fallback for unrecognized characters if needed, though ideally grammar is complete
// ERROR_CHARACTER: . ;
