parser grammar LPCParser;

options { tokenVocab=LPCLexer; }

// Parser rules
sourceFile
    :   (statement)* EOF
    ;

statement
    :   functionDef
    |   variableDecl ';'
    |   macroInvoke
    |   ifStatement
    |   whileStatement
    |   forStatement
    |   doWhileStatement
    |   foreachStatement
    |   switchStatement
    |   breakStatement
    |   continueStatement
    |   returnStatement
    |   inheritStatement
    |   block
    |   exprStatement
    |   prototypeStatement
    |   ';'
    ;

functionDef
    :   MODIFIER* typeSpec? STAR* Identifier LPAREN parameterList? RPAREN block
    ;

variableDecl
    :   MODIFIER* typeSpec variableDeclarator (',' variableDeclarator)*
    ;

variableDeclarator
    :   STAR* Identifier (ASSIGN expression)?
    ;

parameterList
    :   parameter (COMMA parameter)*
    ;

parameter
    :   typeSpec REF? STAR* Identifier ELLIPSIS?      // int ref a | int a
    |   typeSpec REF? STAR*                 // 仅类型，无参数名，用于函数原型
    |   STAR* Identifier ELLIPSIS?                    // a
    ;

typeSpec
    :   KW_INT
    |   KW_FLOAT
    |   KW_STRING
    |   KW_OBJECT
    |   KW_MIXED
    |   KW_MAPPING
    |   KW_FUNCTION
    |   KW_BUFFER
    |   KW_VOID
    |   KW_STRUCT
    |   Identifier ('*')*
    ;

block
    :   LBRACE statement* RBRACE
    ;

exprStatement
    :   expression ';'
    ;

// === 表达式 ===
expression
    :   assignmentExpression (',' assignmentExpression)*
    ;

assignmentExpression
    :   conditionalExpression ( (ASSIGN | PLUS_ASSIGN | MINUS_ASSIGN | STAR_ASSIGN | DIV_ASSIGN | PERCENT_ASSIGN | BIT_OR_ASSIGN | BIT_AND_ASSIGN) expression )?
    ;

conditionalExpression
    :   logicalOrExpression ( '?' expression ':' conditionalExpression )?
    ;

logicalOrExpression
    :   logicalAndExpression (OR logicalAndExpression)*
    ;

logicalAndExpression
    :   bitwiseOrExpression (AND bitwiseOrExpression)*
    ;

bitwiseOrExpression
    :   bitwiseXorExpression (BIT_OR bitwiseXorExpression)*
    ;

bitwiseXorExpression
    :   bitwiseAndExpression (BIT_XOR bitwiseAndExpression)*
    ;

bitwiseAndExpression
    :   equalityExpression (BIT_AND equalityExpression)*
    ;

equalityExpression
    :   relationalExpression ( (EQ | NE) relationalExpression)*
    ;

relationalExpression
    :   shiftExpression ( (GT | LT | GE | LE) shiftExpression )*
    ;

shiftExpression
    :   additiveExpression ( (SHIFT_LEFT | SHIFT_RIGHT) additiveExpression )*
    ;

additiveExpression
    :   multiplicativeExpression ( (PLUS | MINUS) multiplicativeExpression )*
    ;

multiplicativeExpression
    :   unaryExpression ( (STAR | DIV | PERCENT) unaryExpression )*
    ;

unaryExpression
    :   (INC | DEC)? postfixExpression
    |   (PLUS | MINUS | NOT | BIT_NOT | STAR) unaryExpression
    |   CATCH LPAREN expression RPAREN
    |   CATCH block
    |   castExpression
    ;

castExpression
    :   LPAREN castType RPAREN unaryExpression
    ;

castType
    :   KW_INT
    |   KW_FLOAT
    |   KW_STRING
    |   KW_OBJECT
    |   KW_MIXED
    |   KW_MAPPING
    |   KW_FUNCTION
    |   KW_BUFFER
    |   KW_VOID
    |   KW_STRUCT
    ;

postfixExpression
    :   primary ( ( (ARROW | DOT | SCOPE) Identifier ( LPAREN argumentList? RPAREN )? )
                | ( LPAREN argumentList? RPAREN )
                | LBRACK sliceExpr RBRACK
                | INC
                | DEC
                )*
    ;

argumentList
    :   assignmentExpression (ELLIPSIS)? (COMMA assignmentExpression (ELLIPSIS)?)* (COMMA)?
    ;

primary
    :   SCOPE Identifier                              # scopeIdentifier
    |   stringConcat                                  # stringConcatenation
    |   closureExpr                                   # closurePrimary
    |   mappingLiteral                                # mappingLiteralExpr
    |   KW_FUNCTION LPAREN parameterList? RPAREN block      # anonFunction
    |   Identifier                                    # identifierPrimary
    |   INTEGER                                       # integerPrimary
    |   FLOAT                                         # floatPrimary
    |   STRING_LITERAL                                # stringPrimary
    |   CHAR_LITERAL                                  # charPrimary
    |   LPAREN LBRACE expressionList? RBRACE RPAREN               # arrayLiteral
    |   LPAREN expression RPAREN                            # parenExpr
    |   REF Identifier                                # refVariable
    ;

stringConcat
    :   concatItem+
    ;

concatItem
    :   STRING_LITERAL
    |   Identifier LPAREN argumentList? RPAREN
    |   Identifier
    ;

ifStatement
    :   IF LPAREN expression RPAREN statement (ELSE statement)?
    ;

whileStatement
    :   WHILE LPAREN expression RPAREN statement
    ;

doWhileStatement
    :   DO statement WHILE LPAREN expression RPAREN SEMI
    ;

forStatement
    :   FOR LPAREN forInit? SEMI expression? SEMI expressionList? RPAREN statement
    ;

forInit
    :   variableDecl
    |   expressionList
    ;

expressionList
    :   expression (COMMA expression)* (COMMA)?
    ;

foreachStatement
    :   FOREACH LPAREN foreachInit IN expression RPAREN statement
    ;

foreachInit
    :   foreachVar (',' foreachVar)?
    ;

foreachVar
    :   typeSpec REF? STAR* Identifier
    |   STAR* Identifier
    ;

switchStatement
    :   SWITCH LPAREN expression RPAREN LBRACE switchSection* RBRACE
    ;

switchSection
    :   switchLabelWithColon statement* (switchLabelWithColon statement*)*
    ;

switchLabelWithColon
    :   CASE switchLabel COLON
    |   DEFAULT COLON
    ;

switchLabel
    :   expression (RANGE_OP expression)?
    |   RANGE_OP expression
    ;

breakStatement : BREAK ';' ;
continueStatement : CONTINUE ';' ;
returnStatement : RETURN expression? SEMI ;

closureExpr : LPAREN COLON expression? COLON RPAREN ;

inheritStatement : INHERIT expression SEMI ;

macroInvoke : Identifier LPAREN argumentList? RPAREN ;

prototypeStatement : MODIFIER* typeSpec? STAR* Identifier LPAREN parameterList? RPAREN SEMI ;

mappingLiteral : LPAREN LBRACK mappingPairList? RBRACK RPAREN ;

mappingPairList : mappingPair (COMMA mappingPair)* (COMMA)? ;
mappingPair : expression COLON expression ;

sliceExpr
    :   LT expression                               # tailIndexOnly
    |   expression RANGE_OP LT? expression?         # headRange
    |   RANGE_OP LT? expression?                    # openRange
    |   expression                                  # singleIndex
    |   LT expression RANGE_OP LT? expression?      # tailHeadRange
    ; 