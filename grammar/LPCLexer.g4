lexer grammar LPCLexer;

@members {
    /** 动态保存 heredoc 结束标记，例如 "LONG" */
    private heredocTag: string = "";
}

// ---------- 通用片段 ----------
fragment NL : '\r'? '\n';

// ---------- 数字 ----------
INTEGER : HexLiteral | OctLiteral | DecimalLiteral ;
FLOAT   : FloatLiteral ;

fragment DecimalLiteral : '0' | [1-9] [0-9_]* ;
fragment FloatLiteral   : [0-9]+ '.' [0-9]+ | '.' [0-9]+ ;
fragment HexLiteral     : '0' [xX] [0-9a-fA-F]+ ;
fragment OctLiteral     : '0' [0-7]+ ;

// ---------- 字符 / 字符串 ----------
CHAR_LITERAL    : '\'' ( '\\' . | ~['\\] ) '\'' ;
STRING_LITERAL  : '"' ( '\\' . | ~["\\] )* '"' ;

// ---------- Heredoc ----------
fragment HEREDOC_TAG : [A-Z_][A-Z_0-9]* ;

HEREDOC_START
    :   '@' HEREDOC_TAG NL
        {
            this.heredocTag = this.text.substring(1).trim();
            this.type = LPCLexer.STRING_LITERAL;
            this.pushMode(LPCLexer.LPC_HEREDOC);
        }
    ;

mode LPC_HEREDOC;

HEREDOC_END
    :   HEREDOC_TAG [ \t]*
        {
            if (this.text.trim() === this.heredocTag) {
                this.popMode();
                this.skip();
            } else {
                this.more();
            }
        }
    ;

HEREDOC_CHARS
    :   . -> more
    ;

mode DEFAULT_MODE;

// ---------- 空白 / 注释 ----------
WS            : [ \t\r\n\u000C]+ -> skip ;
LINE_COMMENT  : '//' ~[\r\n]* -> channel(HIDDEN);
BLOCK_COMMENT : '/*' .*? '*/' -> channel(HIDDEN);

// ---------- 预处理指令 ----------
DIRECTIVE : '#' ~[\r\n]* ( '\\' '\r'? '\n' ~[\r\n]* )* '\r'? '\n'? -> channel(HIDDEN);

// ---------- 关键字 ----------
IF:'if'; ELSE:'else'; FOR:'for'; WHILE:'while'; DO:'do'; SWITCH:'switch'; CASE:'case';
DEFAULT:'default'; BREAK:'break'; CONTINUE:'continue'; RETURN:'return'; FOREACH:'foreach';
INHERIT:'inherit'; INCLUDE:'include'; CATCH:'catch'; REF:'ref'; IN:'in';
KW_INT:'int'; KW_FLOAT:'float'; KW_STRING:'string'; KW_OBJECT:'object'; KW_MIXED:'mixed'; KW_MAPPING:'mapping'; KW_FUNCTION:'function'; KW_BUFFER:'buffer'; KW_VOID:'void'; KW_STRUCT:'struct';

// ---------- 操作符 / 标点 ----------
ELLIPSIS:'...'; RANGE_OP:'..'; ARROW:'->'; DOT:'.'; INC:'++'; DEC:'--';
PLUS_ASSIGN:'+='; MINUS_ASSIGN:'-='; STAR_ASSIGN:'*='; DIV_ASSIGN:'/='; PERCENT_ASSIGN:'%=';
PLUS:'+'; MINUS:'-'; STAR:'*'; DIV:'/'; PERCENT:'%'; SCOPE:'::';
SEMI:';'; COMMA:','; LPAREN:'(' ; RPAREN:')'; LBRACE:'{' ; RBRACE:'}'; LBRACK:'[' ; RBRACK:']'; QUESTION:'?'; COLON:':';

GT:'>'; LT:'<'; GE:'>='; LE:'<='; EQ:'=='; NE:'!='; ASSIGN:'='; NOT:'!'; AND:'&&'; OR:'||';

SHIFT_LEFT:'<<'; SHIFT_RIGHT:'>>';

BIT_AND:'&'; BIT_OR:'|'; BIT_XOR:'^'; BIT_NOT:'~';
BIT_OR_ASSIGN:'|='; BIT_AND_ASSIGN:'&=';

// ---------- 修饰符 ----------
MODIFIER : 'private' | 'public' | 'protected' | 'varargs' | 'nosave' | 'static' | 'nomask';

// ---------- 标识符 ----------
Identifier : [a-zA-Z_][a-zA-Z_0-9]* ;