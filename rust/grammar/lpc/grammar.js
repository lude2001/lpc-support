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

  supertypes: $ => [
    $._statement,
    $._expression,
  ],

  conflicts: $ => [
    [$.parameter, $._type],
    [$.parameter, $._type, $._expression],
    [$.argument_list, $.parenthesized_expression],
    [$.struct_declaration, $._type],
    [$.class_declaration, $._type],
    [$._type, $._expression],
    [$._type],
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
      $._statement,
    )),

    preprocessor_directive: _ => token(seq(
      '#',
      repeat(choice(/[^\\\r\n]/, /\\\r?\n/)),
    )),

    comment: _ => token(choice(
      seq('//', /[^\r\n]*/),
      seq('/*', /[^*]*\*+([^/*][^*]*\*+)*/, '/'),
    )),

    function_declaration: $ => seq(
      repeat($.modifier),
      optional(field('return_type', $._type)),
      repeat('*'),
      field('name', $.identifier),
      field('parameters', $.parameter_list),
      choice(field('body', $.block), ';'),
    ),

    variable_declaration: $ => seq(
      repeat($.modifier),
      field('type', $._type),
      commaSep1($.variable_declarator),
      ';',
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
          optional('ref'),
          field('type', $._type),
          optional('ref'),
          repeat('*'),
          optional(field('name', $.identifier)),
        ),
        seq('ref', repeat('*'), field('name', $.identifier)),
        seq(repeat('*'), field('name', $.identifier)),
      ),
      optional('...'),
      optional(seq(':', field('default', $._expression))),
    ),

    struct_declaration: $ => seq(
      'struct',
      field('name', $.identifier),
      '{',
      repeat($.field_declaration),
      '}',
    ),

    class_declaration: $ => seq(
      'class',
      field('name', $.identifier),
      '{',
      repeat($.field_declaration),
      '}',
    ),

    field_declaration: $ => seq($._type, repeat('*'), $.identifier, ';'),

    modifier_section: $ => seq(repeat1($.modifier), ':'),

    inherit_declaration: $ => seq('inherit', $._expression, ';'),
    include_declaration: $ => seq('include', $._expression, ';'),

    modifier: _ => choice(
      'private',
      'public',
      'protected',
      'varargs',
      'nosave',
      'static',
      'nomask',
    ),

    _type: $ => choice(
      $.primitive_type,
      seq(choice('struct', 'class'), optional($.identifier)),
      seq($.identifier, repeat('*')),
    ),

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
      '__TREE__',
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
    ),

    expression_statement: $ => seq($._expression, ';'),
    empty_statement: _ => ';',

    if_statement: $ => prec.right(seq(
      'if',
      '(',
      field('condition', $._expression),
      ')',
      field('consequence', $._statement),
      optional(seq('else', field('alternative', $._statement))),
    )),

    while_statement: $ => seq('while', '(', $._expression, ')', $._statement),
    do_statement: $ => seq('do', $._statement, 'while', '(', $._expression, ')', ';'),

    for_statement: $ => seq(
      'for',
      '(',
      optional(choice($.variable_declaration_without_semicolon, $.expression_list)),
      ';',
      optional($._expression),
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
      optional('ref'),
      repeat('*'),
      $.identifier,
    ),

    switch_statement: $ => seq(
      'switch',
      '(',
      $._expression,
      ')',
      '{',
      repeat($.switch_section),
      '}',
    ),

    switch_section: $ => seq($.switch_label, repeat($._statement)),
    switch_label: $ => choice(
      seq('case', optional($._expression), optional(seq('..', optional($._expression))), ':'),
      seq('default', ':'),
    ),

    return_statement: $ => seq('return', optional($._expression), ';'),
    break_statement: _ => seq('break', ';'),
    continue_statement: _ => seq('continue', ';'),

    expression_list: $ => seq(
      commaSep1(choice(
        $._expression,
        seq('...', $._expression),
      )),
      optional(','),
    ),

    _expression: $ => choice(
      $.assignment_expression,
      $.conditional_expression,
      $.binary_expression,
      $.unary_expression,
      $.update_expression,
      $.cast_expression,
      $.sizeof_expression,
      $.catch_expression,
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
      $.character_literal,
      $.parameter_placeholder,
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
      choice('+', '-', '!', '~', '*'),
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

    sizeof_expression: $ => prec(PREC.UNARY, seq('sizeof', '(', choice($._expression, $._type), ')')),
    catch_expression: $ => prec(PREC.UNARY, seq('catch', choice(seq('(', $._expression, ')'), $.block))),

    postfix_expression: $ => prec.left(PREC.POSTFIX, seq(
      field('value', choice(
        $.parenthesized_expression,
        $.array_literal,
        $.mapping_literal,
        $.identifier,
        $.string_literal,
        $.number_literal,
        $.parameter_placeholder,
        seq('::', $.identifier),
        seq('efun', '::', $.identifier),
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
    member_suffix: $ => seq(choice('->', '.', '::'), $.identifier),
    subscript_suffix: $ => seq('[', optional($.slice_expression), ']'),

    slice_expression: $ => choice(
      $._expression,
      seq(optional(choice($._expression, seq('<', $._expression))), '..', optional(seq(optional('<'), $._expression))),
      seq('<', $._expression),
    ),

    argument_list: $ => seq(
      commaSep1(seq($._expression, optional('...'))),
      optional(','),
    ),

    anonymous_function: $ => seq('function', $.parameter_list, $.block),
    new_expression: $ => seq('new', '(', commaSep1($._expression), ')'),

    closure_expression: $ => seq(
      '(:',
      optional(commaSep1(choice(
        seq('$', $.identifier),
        seq('$', '(', $._expression, ')'),
        seq($._expression, optional('...')),
      ))),
      ':)',
    ),

    concatenated_string: $ => prec.left(PREC.ADDITIVE + 1, choice(
      seq(
        $.string_literal,
        repeat1(choice($.string_literal, $.identifier, $.postfix_expression)),
      ),
      seq(
        $.identifier,
        $.string_literal,
        repeat(choice($.identifier, $.string_literal)),
      ),
    )),

    array_literal: $ => seq('(', '{', optional($.expression_list), '}', ')'),
    mapping_literal: $ => seq('(', '[', optional(commaSep1($.mapping_pair)), optional(','), ']', ')'),
    mapping_pair: $ => seq(field('key', $._expression), ':', field('value', $._expression)),
    parenthesized_expression: $ => seq('(', $._expression, ')'),

    number_literal: _ => token(choice(
      /0[xX][0-9a-fA-F_]+/,
      /0[bB][01_]+/,
      /0[0-7_]+/,
      /[0-9][0-9_]*\.[0-9_]+([eE][+-]?[0-9_]+)?/,
      /[0-9][0-9_]*[eE][+-]?[0-9_]+/,
      /[0-9][0-9_]*/,
    )),

    string_literal: _ => token(seq('"', repeat(choice(/[^"\\\r\n]/, /\\(.|\r?\n)/)), '"')),
    character_literal: _ => token(seq("'", choice(/[^'\\\r\n]/, /\\./), "'")),
    parameter_placeholder: _ => token(/\$[0-9]+/),
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
