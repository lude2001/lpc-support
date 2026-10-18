/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const PREC = {
  ASSIGNMENT: 1,
  CONDITIONAL: 2,
  NULLISH: 3,
  LOGICAL_OR: 4,
  LOGICAL_AND: 5,
  BITWISE_OR: 6,
  BITWISE_XOR: 7,
  BITWISE_AND: 8,
  EQUALITY: 9,
  RELATIONAL: 10,
  SHIFT: 11,
  ADDITIVE: 12,
  MULTIPLICATIVE: 13,
  CAST: 14,
  UNARY: 15,
  POSTFIX: 16,
  CALL: 17,
};

module.exports = grammar({
  name: 'lpc',

  extras: $ => [
    /[\s\uFEFF\u2060\u200B]/,
    $.comment,
    $.preprocessor_directive,
  ],

  word: $ => $.identifier,

  externals: $ => [
    $.heredoc_literal,
    $.macro_identifier,
    $._trailing_dot_float,
    $.type_identifier,
  ],

  supertypes: $ => [
    $._statement,
    $._expression,
  ],

  conflicts: $ => [
    [$.custom_type, $._expression],
    [$.parameter, $.custom_type],
    [$.parameter, $.custom_type, $._expression],
    [$.macro_annotation, $.parameter_list, $.macro_control_statement],
    [$.macro_control_statement, $.macro_invocation],
    [$.source_file, $._expression],
  ],

  rules: {
    source_file: $ => repeat(choice(
      $.function_declaration,
      $.variable_declaration,
      $.struct_declaration,
      $.class_declaration,
      $.inherit_declaration,
      $.include_declaration,
      $.modifier_section,
      $.macro_invocation,
      $.macro_annotation,
      $._statement,
    )),

    preprocessor_directive: _ => token(seq(
      '#',
      repeat(choice(/[^\\\r\n]/, /\\\r?\n/)),
    )),

    macro_annotation: $ => prec(-1, seq(
      field('name', $.identifier),
      '(',
      optional($.argument_list),
      ')',
    )),

    comment: _ => token(choice(
      seq('//', /[^\r\n]*/),
      seq('/*', /[^*]*\*+([^/*][^*]*\*+)*/, '/'),
    )),

    function_declaration: $ => prec(1, seq(
      repeat($.modifier),
      optional(field('return_type', choice($._type, alias($.macro_return_type, $.custom_type)))),
      repeat('*'),
      field('name', $.identifier),
      field('parameters', $.parameter_list),
      choice(field('body', $.block), ';'),
    )),

    variable_declaration: $ => choice(
      seq(repeat($.modifier), field('type', $._type), commaSep1($.variable_declarator), ';'),
      seq(repeat1($.modifier), commaSep1($.variable_declarator), ';'),
    ),

    variable_declarator: $ => seq(
      repeat('*'),
      field('name', $.identifier),
      optional(seq('=', field('value', $._expression))),
    ),

    parameter_list: $ => seq('(', optional(commaSep1($.parameter)), ')'),

    parameter: $ => seq(
      choice(
        seq(
          optional(choice('ref', '&')),
          field('type', $._type),
          optional(choice('ref', '&')),
          repeat('*'),
          optional(field('name', $.identifier)),
        ),
        seq('ref', repeat('*'), field('name', $.identifier)),
        seq(repeat('*'), field('name', $.identifier)),
      ),
      optional('...'),
      optional(seq(':', field('default', $.closure_expression))),
    ),

    struct_declaration: $ => seq(
      repeat($.modifier),
      'struct',
      field('name', $.identifier),
      '{',
      repeat($.field_declaration),
      '}',
    ),

    class_declaration: $ => seq(
      repeat($.modifier),
      'class',
      field('name', $.identifier),
      '{',
      repeat($.field_declaration),
      '}',
    ),

    field_declaration: $ => seq(field('type', $._type), commaSep1(seq(repeat('*'), field('name', $.identifier))), ';'),

    modifier_section: $ => seq(repeat1($.modifier), ':'),

    inherit_declaration: $ => seq(repeat($.modifier), 'inherit', field('path', $._expression), ';'),
    include_declaration: $ => seq('include', field('path', $._expression), ';'),

    modifier: _ => choice(
      'private',
      'public',
      'protected',
      'varargs',
      'nosave',
      'static',
      'nomask',
      'async',
    ),

    _type: $ => choice(
      $.primitive_type,
      $.class_type,
      $.promise_type,
      $.array_type,
      $.custom_type,
    ),

    custom_type: $ => $.identifier,
    // Restrict the lookahead token to function headers. In expression contexts,
    // `value * helper(...)` must remain multiplication rather than a type hint.
    macro_return_type: $ => alias($.type_identifier, $.identifier),

    class_type: $ => seq(choice('struct', 'class'), field('name', $.identifier)),
    promise_type: $ => seq('promise', optional(seq('<', field('payload', choice($.primitive_type, $.class_type, $.array_type)), optional('*'), '>'))),
    array_type: $ => seq(choice($.primitive_type, $.class_type, $.promise_type), 'array'),

    primitive_type: _ => choice(
      'int',
      'float',
      'string',
      'object',
      'mixed',
      'mapping',
      'function',
      'buffer',
      'void',
      'array',
      'closure',
    ),

    block: $ => seq('{', repeat(choice($.variable_declaration, $._statement)), '}'),

    _statement: $ => choice(
      $.block,
      $.expression_statement,
      $.if_statement,
      $.while_statement,
      $.do_statement,
      $.for_statement,
      $.foreach_statement,
      $.switch_statement,
      $.return_statement,
      $.break_statement,
      $.continue_statement,
      $.empty_statement,
      $.macro_control_statement,
    ),

    expression_statement: $ => seq($._sequence_expression, ';'),
    empty_statement: _ => ';',

    macro_control_statement: $ => prec.right(seq(
      field('name', choice($.identifier, alias($.macro_identifier, $.identifier))), '(', optional($.argument_list), ')',
      field('body', $.block), optional(seq('else', field('alternative', $.block))),
    )),

    if_statement: $ => prec.right(seq(
      'if',
      '(',
      field('condition', choice($._expression, $.comma_expression)),
      ')',
      field('consequence', $._statement),
      optional(seq('else', field('alternative', $._statement))),
    )),

    while_statement: $ => seq('while', '(', choice($._expression, $.comma_expression), ')', $._statement),
    do_statement: $ => seq('do', $._statement, 'while', '(', choice($._expression, $.comma_expression), ')', ';'),

    for_statement: $ => seq(
      'for',
      '(',
      optional(choice($.variable_declaration_without_semicolon, $.expression_list)),
      ';',
      optional($._sequence_expression),
      ';',
      optional($.expression_list),
      ')',
      $._statement,
    ),

    variable_declaration_without_semicolon: $ => seq(
      repeat($.modifier),
      $._type,
      commaSep1($.variable_declarator),
    ),

    foreach_statement: $ => seq(
      'foreach',
      '(',
      commaSep1($.foreach_variable),
      'in',
      $._expression,
      ')',
      $._statement,
    ),

    foreach_variable: $ => seq(
      optional($._type),
      optional(choice('ref', '&')),
      repeat('*'),
      $.identifier,
    ),

    switch_statement: $ => seq(
      'switch',
      '(',
      $._sequence_expression,
      ')',
      '{',
      repeat($.variable_declaration),
      repeat($.switch_section),
      '}',
    ),

    switch_section: $ => seq($.switch_label, repeat($._statement)),
    switch_label: $ => choice(
      seq('case', optional($._expression), optional(seq('..', optional($._expression))), ':'),
      seq('default', ':'),
    ),

    return_statement: $ => seq('return', optional($._sequence_expression), ';'),
    break_statement: _ => seq('break', ';'),
    continue_statement: _ => seq('continue', ';'),

    expression_list: $ => seq(
      commaSep1(choice($._expression, $.spread_expression)),
      optional(','),
    ),

    spread_expression: $ => seq($._expression, '...'),

    _expression: $ => choice(
      $.assignment_expression,
      $.conditional_expression,
      $.binary_expression,
      $.unary_expression,
      $.update_expression,
      $.cast_expression,
      $.catch_expression,
      $.acatch_expression,
      $.time_expression,
      $.tree_expression,
      $.postfix_expression,
      $.anonymous_function,
      $.new_expression,
      $.closure_expression,
      $.array_literal,
      $.mapping_literal,
      $.concatenated_string,
      $.parenthesized_expression,
      $.number_literal,
      $.string_literal,
      $.template_string,
      $.heredoc_literal,
      $.character_literal,
      $.parameter_placeholder,
      $.captured_expression,
      $.reference_expression,
      $.qualified_identifier,
      $.macro_concatenation,
      $.macro_invocation,
      $.identifier,
    ),

    assignment_expression: $ => prec.right(PREC.ASSIGNMENT, seq(
      field('left', $._expression),
      field('operator', choice(
        '=', '+=', '-=', '*=', '/=', '%=', '|=', '&=', '^=',
        '<<=', '>>=', '??=', '||=', '&&=',
      )),
      field('right', $._expression),
    )),

    conditional_expression: $ => prec.right(PREC.CONDITIONAL, seq(
      $._expression,
      '?',
      $._expression,
      ':',
      $._expression,
    )),

    binary_expression: $ => choice(
      binaryLeft(PREC.NULLISH, '??', $),
      binaryLeft(PREC.LOGICAL_OR, '||', $),
      binaryLeft(PREC.LOGICAL_AND, '&&', $),
      binaryLeft(PREC.BITWISE_OR, '|', $),
      binaryLeft(PREC.BITWISE_XOR, '^', $),
      binaryLeft(PREC.BITWISE_AND, '&', $),
      binaryLeft(PREC.EQUALITY, choice('==', '!='), $),
      binaryLeft(PREC.RELATIONAL, choice('<', '<=', '>', '>='), $),
      binaryLeft(PREC.SHIFT, choice('<<', '>>'), $),
      binaryLeft(PREC.ADDITIVE, choice('+', '-'), $),
      binaryLeft(PREC.MULTIPLICATIVE, choice('*', '/', '%'), $),
    ),

    unary_expression: $ => prec.right(PREC.UNARY, seq(
      choice('+', '-', '!', '~', '*', 'await'),
      $._expression,
    )),

    update_expression: $ => choice(
      prec.right(PREC.UNARY, seq(choice('++', '--'), $._expression)),
      prec.left(PREC.POSTFIX, seq($._expression, choice('++', '--'))),
    ),

    cast_expression: $ => prec(PREC.CAST, seq(
      '(',
      field('type', $._type),
      repeat('*'),
      ')',
      field('value', $._expression),
    )),

    catch_expression: $ => seq('catch', $._special_body),
    acatch_expression: $ => seq('acatch', $._special_body),
    time_expression: $ => seq('time_expression', $._special_body),
    tree_expression: $ => seq('__TREE__', $._special_body),
    _special_body: $ => choice(seq('(', $._sequence_expression, ')'), $.block),

    postfix_expression: $ => prec.left(PREC.POSTFIX, seq(
      field('value', choice(
        $.parenthesized_expression,
        $.array_literal,
        $.mapping_literal,
        $.new_expression,
        $.catch_expression,
        $.acatch_expression,
        $.time_expression,
        $.tree_expression,
        $.closure_expression,
        $.template_string,
        $.captured_expression,
        $.macro_invocation,
        $.identifier,
        $.string_literal,
        $.heredoc_literal,
        $.character_literal,
        $.parameter_placeholder,
        $.qualified_identifier,
      )),
      repeat1(choice(
        $.call_suffix,
        $.member_suffix,
        $.subscript_suffix,
        '++',
        '--',
      )),
    )),

    call_suffix: $ => prec(PREC.CALL, seq('(', optional($.argument_list), ')')),
    member_suffix: $ => seq(choice('->', '.', '::', '?.'), $.identifier),
    subscript_suffix: $ => seq(choice('[', seq(choice('?.', '.?'), '[')), optional($.slice_expression), ']'),
    qualified_identifier: $ => prec(PREC.POSTFIX, choice(seq('::', $.identifier), seq(choice('efun', $.primitive_type), '::', $.identifier))),

    slice_expression: $ => choice(
      $._sequence_expression,
      seq(optional(choice($._sequence_expression, seq('<', $._sequence_expression))), '..', optional(seq(optional('<'), $._sequence_expression))),
      seq('<', $._sequence_expression),
    ),

    argument_list: $ => seq(
      commaSep1(seq($._expression, optional('...'))),
      optional(','),
    ),

    anonymous_function: $ => seq('function', $.parameter_list, $.block),
    new_expression: $ => seq(
      'new',
      '(',
      commaSep1(choice($._expression, $.class_type, $.struct_initializer)),
      ')',
    ),

    struct_initializer: $ => seq(
      field('name', $.identifier),
      ':',
      field('value', $._expression),
    ),

    closure_expression: $ => seq(
      token(seq('(', /\s*/, ':')),
      optional(commaSep1(choice(
        seq('$', $.identifier),
        seq($._expression, optional('...')),
      ))),
      token(seq(':', /\s*/, ')')),
    ),

    concatenated_string: $ => prec.left(PREC.ADDITIVE + 1, choice(
      prec.dynamic(3, seq(
        $.identifier,
        repeat1(choice($.string_literal, $.template_string)),
        $.postfix_expression,
        repeat(choice(choice($.string_literal, $.template_string), $.identifier)),
      )),
      prec.dynamic(3, seq(
        repeat1(choice($.string_literal, $.template_string)),
        $.postfix_expression,
        repeat(choice(choice($.string_literal, $.template_string), $.identifier)),
      )),
      prec.dynamic(2, seq(
        $.identifier,
        repeat1(choice($.string_literal, $.template_string)),
        $.macro_invocation,
        repeat(choice(choice($.string_literal, $.template_string), $.identifier, $.macro_invocation)),
      )),
      prec.dynamic(2, seq(
        choice($.string_literal, $.template_string),
        $.macro_invocation,
        repeat(choice(choice($.string_literal, $.template_string), $.identifier, $.macro_invocation)),
      )),
      seq(
        choice($.string_literal, $.template_string),
        repeat1(choice(choice($.string_literal, $.template_string), $.identifier, $.macro_invocation)),
      ),
      seq(
        $.identifier,
        choice($.string_literal, $.template_string),
        repeat(choice($.identifier, choice($.string_literal, $.template_string), $.macro_invocation)),
      ),
      seq(
        $.identifier,
        repeat1($.identifier),
        choice($.string_literal, $.template_string),
        repeat(choice($.identifier, choice($.string_literal, $.template_string), $.macro_invocation)),
      ),
      seq(
        $.heredoc_literal,
        repeat1(choice(choice($.string_literal, $.template_string), $.identifier, $.macro_invocation)),
      ),
      seq(
        $.identifier,
        $.heredoc_literal,
        repeat(choice($.identifier, choice($.string_literal, $.template_string), $.macro_invocation)),
      ),
      seq(
        $.macro_invocation,
        repeat1(choice(choice($.string_literal, $.template_string), $.identifier)),
      ),
    )),

    array_literal: $ => seq('(', '{', optional($.expression_list), '}', ')'),
    mapping_literal: $ => seq('(', '[', optional(commaSep1($.mapping_pair)), optional(','), ']', ')'),
    mapping_pair: $ => seq(field('key', $._expression), ':', field('value', $._expression)),
    parenthesized_expression: $ => seq('(', choice($._expression, $.comma_expression), ')'),
    comma_expression: $ => seq($._expression, repeat1(seq(',', $._expression))),

    number_literal: $ => choice($._trailing_dot_float, token(choice(
      /0[xX][0-9a-fA-F](_?[0-9a-fA-F])*/,
      /0[bB][01](_?[01])*/,
      /[0-9](_?[0-9])*\.(_?[0-9])+([eE][+-]?[0-9](_?[0-9])*)?/,
      /[0-9](_?[0-9])*[eE][+-]?[0-9](_?[0-9])*/,
      /[0-9](_?[0-9])*/,
    ))),

    template_string: $ => seq('`', repeat(choice($.template_text, '$', $.template_interpolation)), '`'),
    template_text: _ => token.immediate(repeat1(choice(/[^`\\$]/, /\\[\s\S]/, /\$[^{`\\]/))),
    template_interpolation: $ => seq('${', field('value', $._expression), '}'),

    string_literal: _ => token(seq('"', repeat(choice(/[^"\\]/, /\\(.|\r?\n)/)), '"')),
    character_literal: _ => token(seq("'", choice(/[^'\\\r\n]/, /\\x[0-9a-fA-F]+/, /\\[0-7]+/, /\\./), "'")),
    parameter_placeholder: _ => token(/\$[0-9]+/),
    captured_expression: $ => seq('$', '(', $._sequence_expression, ')'),
    reference_expression: $ => prec(PREC.UNARY, seq(choice('ref', '&'), $._expression)),
    _sequence_expression: $ => choice($._expression, $.comma_expression),
    macro_concatenation: $ => prec.left(PREC.ADDITIVE + 1, seq($.identifier, repeat1($.identifier))),
    macro_invocation: $ => seq(
      field('name', alias($.macro_identifier, $.identifier)),
      '(',
      optional($.argument_list),
      ')',
    ),
    identifier: _ => /[A-Za-z_][A-Za-z0-9_]*/,
  },
});

function binaryLeft(precedence, operator, $) {
  return prec.left(precedence, seq(
    field('left', $._expression),
    field('operator', operator),
    field('right', $._expression),
  ));
}

function commaSep1(rule) {
  return seq(rule, repeat(seq(',', rule)));
}
