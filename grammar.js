```javascript
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
  ],

  // Word rule: not strictly necessary if keywords are directly used as strings
  // word: $ => $.identifier,

  rules: {
    // 1. Basic Structure: source_file
    source_file: $ => repeat($._top_level_item),

    _top_level_item: $ => choice(
      $.preprocessor_directive,
      $.function_definition,
      $.variable_declaration
      // More can be added here (e.g., class/struct definitions)
    ),

    // 2. Comments (handled in extras, but also define them as tokens)
    line_comment: $ => token(seq('//', /.*/)),
    block_comment: $ => token(seq('/*', /[^*]*\*+([^/*][^*]*\*+)*/, '/')),

    // 3. Preprocessor Directives
    preprocessor_directive: $ => choice(
      $.preproc_include,
      $.preproc_define
      // TODO: Add other preprocessor directives like #ifdef, #ifndef, #else, #endif
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
      // 'array' is a keyword in the doc but syntax is `type *var`
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
      // The doc states `mixed *x...` - the `*` is part of the type, `...` might be part of name or special token
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
      $.variable_declaration // Local variable declarations
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

    // 8. Expressions (Core)
    // Using precedence climbing for binary expressions
    _expression: $ => choice(
      $._primary_expression,
      $.assignment_expression,
      $.binary_expression,
      $.call_expression // Call expression can be primary, but to resolve ambiguity put here
      // TODO: Add unary_expression, conditional_expression (ternary), etc.
    ),

    _primary_expression: $ => choice(
      $.identifier,
      $.number_literal,
      $.string_literal,
      $.parenthesized_expression,
      $.array_literal, // Added for basic array usage
      $.mapping_literal // Added for basic mapping usage
      // TODO: function_pointer_literal `(: ... :)`
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


    // Operator precedence, from lowest to highest that's implemented
    assignment_expression: $ => prec.right(1, seq(
      field('left', $._primary_expression), // LHS of assignment is often more restricted (e.g. identifier, member access)
      '=',
      field('right', $._expression)
    )),

    // For arithmetic: +, -, *, /, %
    // Additive: +, -
    // Multiplicative: *, /, %
    // Using Tree-sitter's precedence helpers
    binary_expression: $ => choice(
      prec.left(3, seq(field('left', $._expression), field('operator', choice('+', '-')), field('right', $._expression))),
      prec.left(4, seq(field('left', $._expression), field('operator', choice('*', '/', '%')), field('right', $._expression)))
      // TODO: Add other binary operators (logical, bitwise, relational) with correct precedence
    ),

    call_expression: $ => prec.left(5, seq( // Higher precedence than binary ops for func_name(a) + b
      field('function', $._primary_expression), // Usually an identifier or member access
      '(',
      field('arguments', commaSep($._expression)),
      ')'
    )),

    // 9. Keywords: Handled by using string literals (e.g., 'if', 'while', 'int') directly in rules.
    // These take precedence over the `identifier` rule in the contexts where they appear.
  }
});
```
