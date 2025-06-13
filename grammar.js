// Tree-sitter grammar for the LPC language (Core Subset)

// Helper function for comma-separated lists
function commaSep1(rule) {
  return seq(rule, repeat(seq(',', rule)));
}

function commaSep(rule) {
  return optional(commaSep1(rule));
}

module.exports = grammar({
  name: 'lpc',

  // Extras: whitespace and comments
  extras: $ => [
    /\s/, // Whitespace, including newlines
    $.line_comment,
    $.block_comment,
  ],

  // Conflicts: Handle potential ambiguities
  // Example: an identifier could be a type name or a variable name.
  // Tree-sitter's default conflict resolution should handle many cases.
  conflicts: $ => [
    [$._type, $.identifier],
    [$._primary_expression, $._type], // For things like casts if they were C-style
    [$.if_statement], // Resolve dangling else
  ],

  // Word rule: not strictly necessary if keywords are directly used as strings
  // word: $ => $.identifier,

  rules: {
    // 1. Basic Structure: source_file
    source_file: $ => repeat($._top_level_item),

    _top_level_item: $ => choice(
      $.preprocessor_directive,
      $.function_definition,
      $.variable_declaration,
      $.inherit_statement // Added
      // More can be added here (e.g., class/struct definitions)
    ),

    inherit_statement: $ => seq(
      'inherit', // This should be recognized as a keyword
      field('path', choice($.identifier, $.string_literal)),
      ';'
    ),

    // 2. Comments (handled in extras, but also define them as tokens)
    line_comment: $ => token(seq('//', /.*/)),
    block_comment: $ => token(seq('/*', /[^*]*\*+([^/*][^*]*\*+)*/, '/')),

    // 3. Preprocessor Directives
    preprocessor_directive: $ => choice(
      $.preproc_include,
      $.preproc_define,
      $.preproc_if,
      $.preproc_ifdef,
      $.preproc_ifndef,
      $.preproc_elif,
      $.preproc_else,
      $.preproc_endif
    ),

    preproc_include: $ => seq(
      '#include',
      field('path', choice(
        $.string_literal, // e.g., #include "my_file.c"
        seq('<', field('system_path', /[^>]+/), '>') // e.g., #include <std.h>
      ))
    ),

    preproc_define: $ => seq(
      '#define',
      field('name', $.identifier),
      optional(field('parameters', $.preproc_define_parameters)),
      optional(field('value', $.preproc_macro_value)) // Value can be empty
    ),
    preproc_define_parameters: $ => seq(
        '(',
        commaSep($.identifier),
        ')'
    ),
    preproc_macro_value: $ => token(repeat1(/.|\\\r?\n/)), // Consumes tokens until end of line, handles line continuation

    // 条件编译指令
    preproc_if: $ => seq('#if', /[^\r\n]*/),
    preproc_ifdef: $ => seq('#ifdef', /[^\r\n]*/),
    preproc_ifndef: $ => seq('#ifndef', /[^\r\n]*/),
    preproc_elif: $ => seq('#elif', /[^\r\n]*/),
    preproc_else: $ => seq('#else'),
    preproc_endif: $ => seq('#endif'),

    // 4. Types
    _type: $ => choice(
      $._type_identifier,
      $.array_type
    ),

    // Basic type identifiers (keywords)
    _type_identifier: $ => choice(
      'int',
      'string',
      'void',
      'mixed',
      'object',
      'mapping',
      'float',
      'status', // common in LPC
      'buffer', // from doc
      'function' // from doc
      // 'array' is a keyword in the doc but syntax is 'type *var'
    ),

    array_type: $ => prec(1, seq(
        field('element_type', $._type),
        '*'
    )),

    // 5. Variable Declarations
    variable_declaration: $ => seq(
      optional($.type_modifiers),
      field('type', $._type),
      commaSep1($._variable_declarator),
      ';'
    ),

    _variable_declarator: $ => seq(
      // The '*' for array is handled by array_type now.
      // If type is 'mixed *foo', it's an array of mixed.
      // If type is 'int *foo', it's an array of int.
      field('name', $.identifier),
      optional(field('initializer', $.initializer))
    ),

    initializer: $ => seq('=', field('value', $._expression)),

    type_modifiers: $ => repeat1(choice(
      'static', // Not in doc keywords, but common and expected
      'private',
      'public',
      'protected', // Added for completeness, common in OO-LPC
      'varargs', // Usually for functions, but listed as a general modifier
      'nosave',
      'nomask'
    )),

    // 6. Function Definitions
    function_definition: $ => seq(
      optional($.type_modifiers),
      field('return_type', $._type),
      field('name', $.identifier),
      '(',
      optional(field('parameters', $.parameter_list)),
      ')',
      // Optional inheritance specifier could go here: optional($.inheritance_specifier),
      field('body', $.block_statement)
    ),

    parameter_list: $ => commaSep1($.parameter_declaration),

    parameter_declaration: $ => seq(
      field('type', $._type),
      // Optional 'ref' keyword for pass-by-reference
      optional('ref'),
      // Optional '...' for varargs, though 'varargs' modifier is also used
      // The doc states 'mixed *x...' - the '*' is part of the type, '...' might be part of name or special token
      field('name', $.identifier)
      // Optional default value: optional(seq(':', $._expression)) // e.g. type param : (: default :)
    ),

    block_statement: $ => seq( // Renamed from 'block' to avoid conflict with potential 'block' keyword
      '{',
      repeat($._statement),
      '}'
    ),

    // 7. Statements (Core)
    _statement: $ => choice(
      $.block_statement, // Note: block_statement itself can contain other statements
      $.expression_statement,
      $.if_statement,
      $.while_statement,
      $.return_statement,
      $.variable_declaration, // Local variable declarations
      $.preprocessor_directive // 允许在语句块中出现预处理指令
      // TODO: Add for, foreach, switch, break, continue, do-while
    ),

    expression_statement: $ => seq($._expression, ';'),

    if_statement: $ => seq(
      'if',
      '(', field('condition', $._expression), ')',
      field('consequence', $._statement),
      optional(field('alternative', $.else_clause))
    ),
    else_clause: $ => seq(
      'else',
      field('body', $._statement) // This can be another if_statement for 'else if'
    ),

    while_statement: $ => seq(
      'while',
      '(', field('condition', $._expression), ')',
      field('body', $._statement)
    ),

    return_statement: $ => seq(
      'return',
      optional(field('value', $._expression)),
      ';'
    ),

    break_statement: $ => seq('break', ';'),

    continue_statement: $ => seq('continue', ';'),

    do_while_statement: $ => seq(
      'do',
      field('body', $._statement),
      'while',
      '(', field('condition', $._expression), ')', ';'
    ),

    for_statement: $ => seq(
      'for',
      '(',
      field('initializer', optional($._for_initializer)),
      ';',
      field('condition', optional($._expression)),
      ';',
      field('update', optional($._expression)),
      ')',
      field('body', $._statement)
    ),

    // Helper for for_statement initializer
    // Allows either an expression or a variable_declaration without its trailing semicolon
    _for_initializer: $ => choice(
      $._expression,
      seq(
        optional($.type_modifiers),
        field('type', $._type),
        commaSep1($._variable_declarator) // variable_declarator already handles optional initializer
      )
    ),

    foreach_statement: $ => seq(
      'foreach',
      '(',
      field('variables', $.foreach_variables),
      'in',
      field('iterable', $._expression),
      ')',
      field('body', $._statement)
    ),

    foreach_variables: $ => choice(
      seq(optional('ref'), field('variable', $.identifier)), // Single variable with optional ref
      commaSep1(field('variable', $.identifier))             // Multiple variables (ref not typical here based on doc)
      // If 'ref' should apply to each in a multi-variable list, the grammar would need adjustment.
      // The doc `foreach (ref var in array)` implies ref is for a single var.
      // `foreach (var1, var2 in expr)` does not show ref.
    ),

    switch_statement: $ => seq(
      'switch',
      '(', field('value', $._expression), ')',
      '{',
      repeat($.case_clause),
      '}'
    ),

    case_clause: $ => choice(
      seq(
        'case',
        field('value', $._expression),
        optional(seq(
          field('range_operator', '..'), // Explicitly field the '..'
          field('upper_value', $._expression)
        )),
        ':',
        repeat($._statement) // Allow multiple statements per case
      ),
      seq(
        'default',
        ':',
        repeat($._statement) // Allow multiple statements for default
      )
    ),

    // 8. Expressions (Core)
    // Using precedence climbing for binary expressions
    _expression: $ => choice(
      $._primary_expression, // This includes parenthesized_expression, literals, identifiers
      $.assignment_expression,
      $.binary_expression,
      $.unary_expression,
      $.postfix_expression,
      $.conditional_expression,
      $.call_expression,
      $.subscript_expression,
      $.member_access_expression
      // function_pointer_literal is now in _primary_expression
    ),

    unary_expression: $ => prec.right(12, seq( // LPC Precedence Level 3
      field('operator', choice('!', '~', '-', '+', '++', '--')), // Added +
      field('operand', $._expression)
    )),

    // Helper for valid operands of postfix ++/--
    _postfix_operand: $ => choice(
      $.identifier,
      $.subscript_expression,
      $.member_access_expression,
      $.parenthesized_expression // e.g. (obj->member)++
    ),

    postfix_expression: $ => prec.left(13, seq( // LPC Precedence Level 2
      field('operand', $._postfix_operand),
      field('operator', choice('++', '--'))
    )),

    _primary_expression: $ => choice(
      $.identifier,
      $.number_literal,
      $.string_literal,
      $.heredoc_literal, // Added
      $.parenthesized_expression,
      $.array_literal, // Added for basic array usage
      $.mapping_literal, // Added for basic mapping usage
      $.function_pointer_literal // Moved here from _expression directly
    ),

    function_pointer_literal: $ => seq(
      '(:',
      // More detailed parsing of content can be added later
      // For now, capture common forms
      choice(
        seq( // (: func_name :) or (: func_name, arg1, arg2 :)
          field('function_name', $.identifier),
          optional(seq(',', commaSep($._expression))) // Simplified: allows any expression as pre-filled args
        ),
        field('code_block', $._expression) // (: $1 + $2 :) or (: write("hello") :)
        // TODO: Specific parsing for $1, $(var) etc.
      ),
      ':)'
    ),

    heredoc_literal: $ => choice(
      $.string_heredoc,
      $.array_heredoc
    ),

    // Content for heredoc. This is a simplified version and might be greedy.
    // Ideally, an external scanner would handle proper non-greedy matching
    // up to the specific delimiter.
    _heredoc_content_block: $ => alias(token(prec(-1, /(.|\n)+/)), $.heredoc_content),

    string_heredoc: $ => seq(
      '@',
      field('delimiter_name', $.identifier),
      optional(field('content', $._heredoc_content_block)),
      // The end_delimiter_name identifier should semantically match the delimiter_name.
      // The grammar itself cannot enforce this specific string equality.
      field('end_delimiter_name', alias($.identifier, $.heredoc_end_identifier)),
      ';'
    ),

    array_heredoc: $ => seq(
      '@@',
      field('delimiter_name', $.identifier),
      optional(field('content', $._heredoc_content_block)),
      field('end_delimiter_name', alias($.identifier, $.heredoc_end_identifier)),
      ';'
    ),

    parenthesized_expression: $ => seq('(', $._expression, ')'),

    identifier: $ => /[a-zA-Z_][a-zA-Z0-9_]*/,

    number_literal: $ => token(choice(
        /[1-9][0-9_]*[0-9]|[0-9]/, // Decimal
        /0[xX][0-9a-fA-F_]+/, // Hex
        /0[bB][01_]+/, // Binary (from doc)
        seq("'", /[^']/, "'") // Character literal (from doc, e.g. 'a')
        // Note: float literals are deferred for this core subset
    )),

    string_literal: $ => seq(
      '"',
      repeat(choice(
        token.immediate(/[^"\\]+/), // String content
        $.escape_sequence
      )),
      '"'
      // TODO: Heredoc strings (@DELIMITER...DELIMITER;) require an external scanner or complex rules.
      // Acknowledged: Heredocs like @EOF ... EOF; are deferred.
    ),

    escape_sequence: $ => token.immediate(seq(
      '\\',
      choice(
        /[^ux]/, // \n, \t, \\, \" etc.
        /u[0-9a-fA-F]{4}/, // \uXXXX (standard, though not explicitly in doc's list)
        /x[0-9a-fA-F]{2}/,  // \xXX (from doc)
        /[0-7]{1,3}/       // \OOO (octal, from doc)
      )
    )),

    array_literal: $ => seq('({', commaSep($._expression), '})'),
    mapping_literal: $ => seq('([', optional(commaSep1($.mapping_pair)), '])'),
    mapping_pair: $ => seq($._expression, ':', $._expression),


    // Operator precedence, adjusted according to LPC documentation
    // LPC Precedence (lower number = higher precedence in doc):
    // 15. Assignment operators
    // 14. ?:
    // 13. ||
    // 12. &&
    // 11. |
    // 10. ^
    // 9.  &
    // 8.  ==, !=
    // 7.  <, <=, >, >=
    // 6.  <<, >>
    // 5.  +, - (binary)
    // 4.  *, /, %
    // 3.  prefix ++/--, +, -, !, ~ (unary)
    // 2.  [], (), ->, postfix ++/--

    assignment_expression: $ => prec.right(0, seq( // LPC level 15
      field('left', $._expression),
      field('operator', choice(
        '=', '+=', '-=', '*=', '/=', '%=',
        '<<=', '>>=', '&=', '|=', '^='
      )),
      field('right', $._expression)
    )),

    conditional_expression: $ => prec.right(1, seq( // LPC level 14
      field('condition', $._expression),
      '?',
      field('consequence', $._expression),
      ':',
      field('alternative', $._expression)
    )),

    binary_expression: $ => choice(
      prec.left(2, seq(field('left', $._expression), field('operator', '||'), field('right', $._expression))),      // LPC level 13
      prec.left(3, seq(field('left', $._expression), field('operator', '&&'), field('right', $._expression))),     // LPC level 12
      prec.left(4, seq(field('left', $._expression), field('operator', '|'), field('right', $._expression))),       // LPC level 11
      prec.left(5, seq(field('left', $._expression), field('operator', '^'), field('right', $._expression))),       // LPC level 10
      prec.left(6, seq(field('left', $._expression), field('operator', '&'), field('right', $._expression))),       // LPC level 9
      prec.left(7, seq(field('left', $._expression), field('operator', choice('==', '!=')), field('right', $._expression))), // LPC level 8
      prec.left(8, seq(field('left', $._expression), field('operator', choice('<', '<=', '>', '>=')), field('right', $._expression))), // LPC level 7
      prec.left(9, seq(field('left', $._expression), field('operator', choice('<<', '>>')), field('right', $._expression))), // LPC level 6
      prec.left(10, seq(field('left', $._expression), field('operator', choice('+', '-')), field('right', $._expression))), // LPC level 5
      prec.left(11, seq(field('left', $._expression), field('operator', choice('*', '/', '%')), field('right', $._expression)))  // LPC level 4
    ),


    // LPC level 2 expressions (postfix ++/--, call, subscript, member_access)
    // These should have higher precedence than unary (LPC level 3) in tree-sitter's system (larger number)
    // So, unary is 12, these are 13.

    call_expression: $ => prec.left(13, seq(
      field('function', $._expression), // More general: can be primary, member_access, etc.
      '(',
      field('arguments', commaSep($._expression)),
      ')'
    )),

    subscript_expression: $ => prec.left(13, seq(
      field('target', $._expression),
      '[',
      field('index', $._expression),
      ']'
    )),

    member_access_expression: $ => prec.left(13, seq(
      field('object', $._expression),
      '->',
      field('member', $.identifier)
    )),

    // 9. Keywords: Handled by using string literals (e.g., 'if', 'while', 'int') directly in rules.
    // These take precedence over the 'identifier' rule in the contexts where they appear.
  }
});
