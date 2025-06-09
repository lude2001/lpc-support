parser grammar LPCParser;

options {
  tokenVocab = LPCLexer;
}

// --- Parser Rules ---

// The entry point of the grammar. A program is zero or more declarations.
program: declaration* EOF;

// A top-level declaration.
declaration
    : preprocessorDirective
    | inheritStatement
    | functionDeclaration
    | variableDeclaration
    ;

// A statement can be a block or a single statement.
statement
    : block
    | variableDeclaration // Allow local variable declarations
    | expressionStatement
    | returnStatement
    | ifStatement
    | forStatement
    | foreachStatement
    | whileStatement
    | doWhileStatement
    | switchStatement
    | breakStatement
    | continueStatement
    | fallthroughStatement
    ;

// A block is a sequence of statements in curly braces.
block
    : '{' statement* '}'
    ;

// An expression followed by a semicolon is a statement.
expressionStatement: expression ';';

// --- Declarations ---

// A variable declaration, e.g., `string s, *p;`
variableDeclaration
    : typeSpecifier variableDeclarator (',' variableDeclarator)* ';'
    ;

variableDeclarator
    : (STAR)* identifier ('=' expression)?
    ;

// A function declaration, e.g., `void func(int i) { ... }` or `void func();`
functionDeclaration
    : typeSpecifier identifier '(' parameterList? ')' (block | ';')
    ;

parameterList
    : (parameter (',' parameter)* (',' ELLIPSIS)?) | ELLIPSIS
    ;

parameter
    : typeSpecifier (STAR)* identifier ('=' expression)?
    ;

// An inherit statement, e.g., `inherit "/std/object";`
inheritStatement: INHERIT (STRING_LITERAL | IDENTIFIER) ';';


// --- Preprocessor Directives ---

preprocessorDirective
    : ppInclude
    | ppDefine
    | ppError
    | ppPragma
    | ppConditional
    ;

ppInclude: PP_INCLUDE (STRING_LITERAL | LESS_THAN_PATH);
ppDefine: PP_DEFINE IDENTIFIER ppBody?;
ppConditional
    : ( (PP_IFDEF | PP_IFNDEF) IDENTIFIER | PP_IF ppBody? )
      declaration*
      (PP_ELSE ppBody? declaration*)?
      PP_ENDIF ppBody?
    ;
ppError: PP_ERROR ppBody?;
ppPragma: PP_PRAGMA ppBody?;

ppBody: PP_BODY;


// --- Expressions ---

expression
    : primary                                                 # PrimaryExpr
    
    // Postfix operators
    | expression '[' expression ']'                           # ArrayAccessExpr
    | expression '[' expression '..' expression ']'           # ArraySliceExpr
    | expression '(' argumentList? ')'                        # FunctionCallExpr
    | expression ARROW identifier                             # MemberAccessExpr
    | expression INC                                          # PostIncrementExpr
    | expression DEC                                          # PostDecrementExpr

    // Prefix operators
    | INC expression                                          # PreIncrementExpr
    | DEC expression                                          # PreDecrementExpr
    | (MINUS | NOT | BITWISE_NOT) expression                  # UnaryExpr
    
    | castExpression                                          # CastExpr

    // Binary operators by precedence
    | expression (STAR | DIV | MOD) expression                # MultiplicativeExpr
    | expression (PLUS | MINUS) expression                    # AdditiveExpr
    | expression (LSHIFT | RSHIFT) expression                 # ShiftExpr
    | expression (LT | GT | LTE | GTE) expression             # RelationalExpr
    | expression (EQ | NEQ) expression                        # EqualityExpr
    | expression BITWISE_AND expression                       # BitwiseAndExpr
    | expression BITWISE_XOR expression                       # BitwiseXorExpr
    | expression BITWISE_OR expression                        # BitwiseOrExpr
    | expression primary                                      # ImplicitConcatExpr
    | <assoc=right> expression AND expression                 # LogicalAndExpr
    | <assoc=right> expression OR expression                  # LogicalOrExpr
    | <assoc=right> expression '?' expression ':' expression  # ConditionalExpr
    | <assoc=right> expression assignmentOperator expression  # AssignmentExpr
    ;

castExpression
    : LPAREN typeSpecifier RPAREN primary
    ;

closureExpression
    : LPAREN COLON expression (COLON RPAREN | RPAREN)
    ;

assignmentOperator
    : ASSIGN | PLUS_ASSIGN | MINUS_ASSIGN | STAR_ASSIGN | DIV_ASSIGN | MOD_ASSIGN | AND_ASSIGN | OR_ASSIGN | XOR_ASSIGN | LSHIFT_ASSIGN | RSHIFT_ASSIGN
    ;

primary
    : '(' expression ')'
    | literal
    | identifier
    | mappingLiteral
    | arrayLiteral
    | closureExpression
    | SCOPE_RESOLUTION identifier
    | IDENTIFIER STRING_LITERAL
    ;

argumentList
    : expressionOrEllipsis (',' expressionOrEllipsis)*
    ;

expressionOrEllipsis
    : expression
    | ELLIPSIS
    ;

literal
    : STRING_LITERAL
    | NUMBER
    ;

mappingLiteral
    : LPAREN LBRACK mappingElementList? RBRACK RPAREN
    ;

mappingElementList
    : mappingElement (COMMA mappingElement)* (COMMA)?
    ;

mappingElement
    : expression COLON expression
    ;

arrayLiteral
    : LPAREN LBRACE expressionList? RBRACE RPAREN
    ;

expressionList
    : expression (COMMA expression)* (COMMA)?
    ;


// --- Types and Modifiers ---

typeSpecifier
    : (modifier)+ typeName (modifier)*
    | typeName (modifier)*
    | (modifier)+
    ;

typeName
    : VOID | INT | STRING | OBJECT | ARRAY | MAPPING | FLOAT | BUFFER | MIXED | FUNCTION | CLASS | STRUCT | CLOSURE
    ;

modifier:
    STATIC | NOMASK | PRIVATE | PROTECTED | PUBLIC | VARARGS | NOSAVE | REF
    ;

identifier: IDENTIFIER | keywordIdentifier;

keywordIdentifier
    : EFUN | NEW | SSCANF | CATCH | PARSE_COMMAND | TIME_EXPRESSION
    ;

// --- Control Structures ---

ifStatement
    : IF '(' expression ')' statement ( ELSE statement )?
    ;

forStatement
    : FOR '(' (variableDeclaration | expression)? ';' expression? ';' expression? ')' statement
    ;

whileStatement
    : WHILE '(' expression ')' statement
    ;

doWhileStatement
    : DO statement WHILE '(' expression ')' ';'
    ;

foreachStatement
    : FOREACH '(' (typeSpecifier)? identifier IN expression ')' statement
    ;

switchStatement
    : SWITCH '(' expression ')' '{' switchBlock? '}'
    ;

switchBlock
    : (caseClause | defaultClause)+
    ;

caseClause
    : CASE expression ':' statement*
    ;

defaultClause
    : DEFAULT ':' statement*
    ;

returnStatement
    : RETURN expression? ';'
    ;

breakStatement
    : BREAK ';'
    ;

continueStatement
    : CONTINUE ';'
    ;

fallthroughStatement
    : FALLTHROUGH ';'
    ; 