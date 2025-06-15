grammar LPC;

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
    :   MODIFIER* typeSpec? STAR* Identifier '(' parameterList? ')' block
    ;

variableDecl
    :   MODIFIER* typeSpec variableDeclarator (',' variableDeclarator)*
    ;

variableDeclarator
    :   STAR* Identifier ('=' expression)?
    ;

parameterList
    :   parameter (',' parameter)*
    ;

parameter
    :   typeSpec REF? STAR* Identifier      // int ref a | int a
    |   STAR* Identifier                    // a
    ;

typeSpec
    :   'int'
    |   'float'
    |   'string'
    |   'object'
    |   'mixed'
    |   'mapping'
    |   'function'
    |   'buffer'
    |   'void'
    |   'struct'
    |   Identifier ('*')*
    ;

block
    :   '{' statement* '}'
    ;

exprStatement
    :   expression ';'
    ;

// === 表达式（逻辑、比较、算术、赋值） ===
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
    :   (INC | DEC)? postfixExpression                 // 前缀 ++var, --var
    |   (PLUS | MINUS | NOT | BIT_NOT | STAR) unaryExpression // 去除 REF，避免与参数冲突
    |   CATCH '(' expression ')'
    |   CATCH block
    |   castExpression
    ;

castExpression
    :   '(' castType ')' unaryExpression
    ;

castType
    :   'int'
    |   'float'
    |   'string'
    |   'object'
    |   'mixed'
    |   'mapping'
    |   'function'
    |   'buffer'
    |   'void'
    |   'struct'
    ;

postfixExpression
    :   primary (
          ( (ARROW | DOT | SCOPE) Identifier ( '(' argumentList? ')' )? )
        | ( '(' argumentList? ')' )
        | '[' sliceExpr ']'                 // 下标或切片访问 arr[i] / arr[i..j] / arr[..j]
        | INC
        | DEC
      )*
    ;

argumentList
    :   assignmentExpression (ELLIPSIS)? (',' assignmentExpression (ELLIPSIS)?)*
    ;

primary
    :   SCOPE Identifier                              # scopeIdentifier
    |   stringConcat                                  # stringConcatenation
    |   CLOSURE                                       # closureExpr
    |   mappingLiteral                                # mappingLiteralExpr
    |   'function' '(' parameterList? ')' block       # anonFunction
    |   Identifier                                    # identifierPrimary
    |   INTEGER                                       # integerPrimary
    |   FLOAT                                         # floatPrimary
    |   (STRING_LITERAL | HEREDOC_STRING)             # stringPrimary
    |   CHAR_LITERAL                                  # charPrimary
    |   '(' '{' expressionList? '}' ')'               # arrayLiteral
    |   '(' expression ')'                            # parenExpr
    |   REF Identifier                                # refVariable
    ;

stringConcat
    :   concatItem+
    ;

concatItem
    :   STRING_LITERAL
    |   Identifier '(' argumentList? ')'   // 宏调用/函数调用
    |   Identifier
    ;

ifStatement
    :   IF '(' expression ')' statement (ELSE statement)?
    ;

whileStatement
    :   WHILE '(' expression ')' statement
    ;

doWhileStatement
    :   DO statement WHILE '(' expression ')' ';'
    ;

forStatement
    :   FOR '(' forInit? ';' expression? ';' expressionList? ')' statement
    ;

forInit
    :   variableDecl
    |   expressionList
    ;

expressionList
    :   expression (',' expression)* (',')?
    ;

foreachStatement
    :   FOREACH '(' foreachInit IN expression ')' statement
    ;

foreachInit
    :   foreachVar (',' foreachVar)?
    ;

foreachVar
    :   typeSpec REF? STAR* Identifier
    |   STAR* Identifier
    ;

switchStatement
    :   SWITCH '(' expression ')' '{' switchSection* '}'
    ;

switchSection
    :   switchLabelWithColon statement* (switchLabelWithColon statement*)*
    ;

switchLabelWithColon
    :   CASE switchLabel ':'
    |   DEFAULT ':'
    ;

switchLabel
    :   expression (RANGE_OP expression)?
    |   RANGE_OP expression                 // ..x or x.. or x..y range support
    ;

breakStatement
    :   BREAK ';'
    ;

continueStatement
    :   CONTINUE ';'
    ;

returnStatement
    :   RETURN expression? ';'
    ;

// inherit path 支持 __DIR__"foo" 等连续拼接的标识符/字符串
inheritStatement
    :   INHERIT inheritPath ';'
    ;

inheritPath
    :   (Identifier | STRING_LITERAL)+
    ;

prototypeStatement
    :   MODIFIER* typeSpec? STAR* Identifier '(' parameterList? ')' ';'
    ;

mappingLiteral
    :   '(' '[' mappingPairList? ']' ')' 
    ;

mappingPairList
    :   mappingPair (',' mappingPair)* (',')?  // 允许尾随逗号
    ;

mappingPair
    :   expression ':' expression
    ;

// Lexer rules
INTEGER
    :   HexLiteral
    |   OctLiteral
    |   DecimalLiteral
    ;

FLOAT
    :   FloatLiteral
    ;

fragment NL : '\r'? '\n';

HEREDOC_STRING
    :   (
            '@LONG'
        |   '@HELP'
        |   '@DESC'
        |   '@TEXT'
        )
        NL ( . | '\r' | '\n' )*?
        NL ( 'LONG' | 'HELP' | 'DESC' | 'TEXT' ) [ \t]*
        -> type(STRING_LITERAL)
    ;

STRING_LITERAL
    :   '"' ( '\\' . | ~["\\] )* '"'
    ;

fragment DecimalLiteral
    :   '0'
    |   [1-9] [0-9_]*
    ;

fragment FloatLiteral
    :   [0-9]+ '.' [0-9]+                      // 必须至少有一位小数避免与范围 '..' 冲突
    |   '.' [0-9]+                             // .123
    ;

fragment HexLiteral
    :   '0' [xX] [0-9a-fA-F]+
    ;

fragment OctLiteral
    :   '0' [0-7]+
    ;

WS
    :   [ \t\r\n\u000C]+ -> skip
    ;

LINE_COMMENT
    :   '//' ~[\r\n]* -> skip
    ;

BLOCK_COMMENT
    :   '/*' .*? '*/' -> skip
    ;

// 预处理指令：#define/#include/#if/#ifdef/#ifndef/#else/#elif/#endif等整行忽略
DIRECTIVE
    :   '#' ~[\r\n]* ( '\\' '\r'? '\n' ~[\r\n]* )* '\r'? '\n'? -> skip
    ;

// === Lexer rules ===
// 关键字
IF          : 'if';
ELSE        : 'else';
FOR         : 'for';
WHILE       : 'while';
DO          : 'do';
SWITCH      : 'switch';
CASE        : 'case';
DEFAULT     : 'default';
BREAK       : 'break';
CONTINUE    : 'continue';
RETURN      : 'return';
FOREACH     : 'foreach';
INHERIT     : 'inherit';
CATCH       : 'catch';
REF         : 'ref';
IN          : 'in';

// 操作符
ELLIPSIS   : '...';
RANGE_OP    : '..';
ARROW       : '->';
DOT         : '.';
INC         : '++';
DEC         : '--';
PLUS_ASSIGN : '+=';
MINUS_ASSIGN: '-=';
STAR_ASSIGN : '*=';
DIV_ASSIGN  : '/=';
PERCENT_ASSIGN : '%=';
PLUS        : '+';
MINUS       : '-';
STAR        : '*';
DIV         : '/';
PERCENT     : '%';
SCOPE       : '::';

// 比较运算符词法
GT          : '>';
LT          : '<';
GE          : '>=';
LE          : '<=';
EQ          : '==';
NE          : '!=';
ASSIGN      : '=';
NOT         : '!';
AND         : '&&';
OR          : '||';

// 闭包/匿名函数片段，如 (: command("foo") :)
CLOSURE     : '(:' .*? ':)';

// 修饰符
MODIFIER    : 'private' | 'public' | 'protected' | 'varargs' | 'nosave' | 'static' | 'nomask';

// 标识符（需在关键字和操作符之后）
Identifier
    :   [a-zA-Z_][a-zA-Z_0-9]*
    ;

// slice/index 语法：
// arr[i]        单索引
// arr[<n]       倒数索引
// arr[i..j]
// arr[i..<n]
// arr[..j] / arr[..<n] / arr[..]
sliceExpr
    :   LT expression                               # tailIndexOnly   // <n
    |   expression RANGE_OP LT? expression?         # headRange       // i..  i..j  i..<n
    |   RANGE_OP LT? expression?                    # openRange       // ..   ..j   ..<n
    |   expression                                  # singleIndex
    |   LT expression RANGE_OP LT? expression?          # tailHeadRange       // <n.. <n..j <n.. <n..<m
    ;

// 位移运算符、比较运算符词法
SHIFT_LEFT  : '<<';
SHIFT_RIGHT : '>>';

CHAR_LITERAL
    :   '\'' ( '\\' . | ~['\\] ) '\''
    ;

// 位运算符
BIT_AND    : '&';
BIT_OR     : '|';
BIT_XOR    : '^';
BIT_NOT    : '~';
BIT_OR_ASSIGN : '|=';
BIT_AND_ASSIGN : '&=';

macroInvoke
    :   Identifier '(' argumentList? ')'   // 宏调用行，无需分号
    ;