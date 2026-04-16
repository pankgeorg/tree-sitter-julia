/**
 * @file Julia grammar for tree-sitter
 * @author Max Brunsfeld <maxbrunsfeld@gmail.com>
 * @author Sergio A. Vargas <savargasqu+git@unal.edu.co>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const PREC = [
  'afunc',
  'pair',
  'conditional',
  'arrow',
  'lazy_or',
  'lazy_and',
  'where', // FIXME
  'comparison',
  'pipe_left',
  'pipe_right',
  'colon',
  'plus',
  'times',
  'rational',
  'bitshift',
  'prefix',
  'power',
  'decl',
  'dot',
].reduce((result, name, index) => {
  result[name] = index + 10;
  return result;
}, {});

PREC.array = -1;
PREC.tuple = -1;
PREC.assign = -2;
PREC.stmt = -3;
PREC.macro_arg = -4;

// Julia operators can have subscript/superscript suffixes: +₁, <ₑ, →ₜ, etc.
// U+1D62-U+1D6A (ᵢ-ᵪ), U+2070-U+209C (⁰-ₜ) minus gaps.
const OPERATOR_SUFFIX = /[\u1D62-\u1D6A\u2070\u2071\u2074-\u207F\u2080-\u209C]*/;

const OPERATORS = {
  assignment: `
    += -= *= /= //= \\= ^= %= <<= >>= >>>= |= &=
    −= ÷= ⊻= ≔ ⩴ ≕
  `,

  arrow: `
    <-- --> <-->
    ← → ↔ ↚ ↛ ↞ ↠ ↢ ↣ ↦ ↤ ↮ ⇎ ⇍ ⇏ ⇐ ⇒ ⇔ ⇴ ⇶ ⇷ ⇸ ⇹ ⇺ ⇻ ⇼ ⇽ ⇾ ⇿ ⟵ ⟶ ⟷ ⟹ ⟺ ⟻ ⟼ ⟽ ⟾ ⟿
    ⤀ ⤁ ⤂ ⤃ ⤄ ⤅ ⤆ ⤇ ⤌ ⤍ ⤎ ⤏ ⤐ ⤑ ⤔ ⤕ ⤖ ⤗ ⤘ ⤝ ⤞ ⤟ ⤠ ⥄ ⥅ ⥆ ⥇ ⥈ ⥊ ⥋ ⥎ ⥐ ⥒ ⥓ ⥖ ⥗ ⥚ ⥛ ⥞
    ⥟ ⥢ ⥤ ⥦ ⥧ ⥨ ⥩ ⥪ ⥫ ⥬ ⥭ ⥰ ⧴ ⬱ ⬰ ⬲ ⬳ ⬴ ⬵ ⬶ ⬷ ⬸ ⬹ ⬺ ⬻ ⬼ ⬽ ⬾ ⬿ ⭀ ⭁ ⭂ ⭃ ⥷ ⭄ ⥺ ⭇ ⭈ ⭉
    ⭊ ⭋ ⭌ ￩ ￫ ⇜ ⇝ ↜ ↝ ↩ ↪ ↫ ↬ ↼ ↽ ⇀ ⇁ ⇄ ⇆ ⇇ ⇉ ⇋ ⇌ ⇚ ⇛ ⇠ ⇢ ↷ ↶ ↺ ↻
  `,

  comparison: `
    > < >= <= == === != !==
    ≥ ≤ ≡ ≠ ≢ ∈ ∉ ∋ ∌ ⊆ ⊈ ⊂ ⊄ ⊊ ∝ ∊ ∍ ∥ ∦ ∷ ∺ ∻ ∽ ∾ ≁ ≃ ≂ ≄ ≅ ≆ ≇ ≈ ≉ ≊ ≋ ≌ ≍ ≎ ≐
    ≑ ≒ ≓ ≖ ≗ ≘ ≙ ≚ ≛ ≜ ≝ ≞ ≟ ≣ ≦ ≧ ≨ ≩ ≪ ≫ ≬ ≭ ≮ ≯ ≰ ≱ ≲ ≳ ≴ ≵ ≶ ≷ ≸ ≹ ≺ ≻ ≼ ≽ ≾
    ≿ ⊀ ⊁ ⊃ ⊅ ⊇ ⊉ ⊋ ⊏ ⊐ ⊑ ⊒ ⊜ ⊩ ⊬ ⊮ ⊰ ⊱ ⊲ ⊳ ⊴ ⊵ ⊶ ⊷ ⋍ ⋐ ⋑ ⋕ ⋖ ⋗ ⋘ ⋙ ⋚ ⋛ ⋜ ⋝ ⋞ ⋟ ⋠
    ⋡ ⋢ ⋣ ⋤ ⋥ ⋦ ⋧ ⋨ ⋩ ⋪ ⋫ ⋬ ⋭ ⋲ ⋳ ⋴ ⋵ ⋶ ⋷ ⋸ ⋹ ⋺ ⋻ ⋼ ⋽ ⋾ ⋿ ⟈ ⟉ ⟒ ⦷ ⧀ ⧁ ⧡ ⧣ ⧤ ⧥ ⩦ ⩧
    ⩪ ⩫ ⩬ ⩭ ⩮ ⩯ ⩰ ⩱ ⩲ ⩳ ⩵ ⩶ ⩷ ⩸ ⩹ ⩺ ⩻ ⩼ ⩽ ⩾ ⩿ ⪀ ⪁ ⪂ ⪃ ⪄ ⪅ ⪆ ⪇ ⪈ ⪉ ⪊ ⪋ ⪌ ⪍ ⪎ ⪏ ⪐ ⪑
    ⪒ ⪓ ⪔ ⪕ ⪖ ⪗ ⪘ ⪙ ⪚ ⪛ ⪜ ⪝ ⪞ ⪟ ⪠ ⪡ ⪢ ⪣ ⪤ ⪥ ⪦ ⪧ ⪨ ⪩ ⪪ ⪫ ⪬ ⪭ ⪮ ⪯ ⪰ ⪱ ⪲ ⪳ ⪴ ⪵ ⪶ ⪷ ⪸
    ⪹ ⪺ ⪻ ⪼ ⪽ ⪾ ⪿ ⫀ ⫁ ⫂ ⫃ ⫄ ⫅ ⫆ ⫇ ⫈ ⫉ ⫊ ⫋ ⫌ ⫍ ⫎ ⫏ ⫐ ⫑ ⫒ ⫓ ⫔ ⫕ ⫖ ⫗ ⫘ ⫙ ⫷ ⫸ ⫹ ⫺ ⊢ ⊣
    ⟂ ⫪ ⫫
  `,

  ellipsis: '… ⁝ ⋮ ⋱ ⋰ ⋯',

  plus: `
    ++ |
    − ¦ ⊕ ⊖ ⊞ ⊟ ∪ ∨ ⊔ ∔ ∸ ≏ ⊎ ⊻ ⊽ ⋎ ⋓ ⟇ ⧺ ⧻ ⨈ ⨢ ⨣ ⨤ ⨥ ⨦ ⨧ ⨨ ⨩ ⨪ ⨫ ⨬ ⨭ ⨮ ⨹ ⨺ ⩁ ⩂ ⩅
    ⩊ ⩌ ⩏ ⩐ ⩒ ⩔ ⩖ ⩗ ⩛ ⩝ ⩡ ⩢ ⩣
  `,

  times: `
    * / % & \\
    ⌿ ÷ · · ⋅ ∘ × ∩ ∧ ⊗ ⊘ ⊙ ⊚ ⊛ ⊠ ⊡ ⊓ ∗ ∙ ∤ ⅋ ≀ ⊼ ⋄ ⋆ ⋇ ⋉ ⋊ ⋋ ⋌ ⋏ ⋒ ⟑ ⦸ ⦼ ⦾ ⦿ ⧶ ⧷
    ⨇ ⨰ ⨱ ⨲ ⨳ ⨴ ⨵ ⨶ ⨷ ⨸ ⨻ ⨼ ⨽ ⩀ ⩃ ⩄ ⩋ ⩍ ⩎ ⩑ ⩓ ⩕ ⩘ ⩚ ⩜ ⩞ ⩟ ⩠ ⫛ ⊍ ▷ ⨝ ⟕ ⟖ ⟗ ⨟
  `,

  bitshift: '<< >> >>>',

  power: `
    ^
    ↑ ↓ ⇵ ⟰ ⟱ ⤈ ⤉ ⤊ ⤋ ⤒ ⤓ ⥉ ⥌ ⥍ ⥏ ⥑ ⥔ ⥕ ⥘ ⥙ ⥜ ⥝ ⥠ ⥡ ⥣ ⥥ ⥮ ⥯ ￪ ￬
  `,

  unary: '! ¬ √ ∛ ∜',

  unary_plus: '+ - ± ∓',
};

const ESCAPE_SEQUENCE = token(seq(
  '\\',
  choice(
    /[^uUx0-7]/,
    /[uU][0-9a-fA-F]{1,6}/, // unicode codepoints
    /[0-7]{1,3}/,
    /x[0-9a-fA-F]{2}/,
  ),
));

// Keywords that can be quoted. Some still fail depending on the context.
const KEYWORDS = choice(
  'baremodule',
  'module',
  'abstract',
  'primitive',
  'mutable',
  'struct',
  'typegroup',
  'quote',
  'let',
  'if',
  'else',
  'elseif',
  'try',
  'catch',
  'finally',
  'for',
  'while',
  'break',
  'continue',
  'using',
  'import',
  'export',
  'const',
  'global',
  'local',
  'end',
  'public',
  // Additional keywords that Julia allows as :keyword symbols
  // and as string macro suffixes (e.g., r"regex"in)
  'in',
  'isa',
  'where',
  'function',
  'macro',
  'return',
  'do',
  'begin',
  'type',
  'outer',
  'as',
  'nothing',
);

module.exports = grammar({
  name: 'julia',

  word: $ => $._word_identifier,

  inline: $ => [
    $._block_form,
    $._terminator,
    $._definition,
    $._statement,
    $._operation,
  ],

  externals: $ => [
    $._block_comment_rest,
    $._immediate_paren,
    $._immediate_bracket,
    $._immediate_brace,
    $._immediate_string_start,
    $._immediate_command_start,
    $._content_cmd_1,
    $._content_cmd_1_raw,
    $._content_cmd_3,
    $._content_cmd_3_raw,
    $._content_str_1,
    $._content_str_1_raw,
    $._content_str_3,
    $._content_str_3_raw,
    $._end_cmd,
    $._end_str,
    $._import_from_current_module,
    $._binary_tilde,
    $._emoji_identifier,
    $._begin_identifier,
  ],

  conflicts: $ => [
    [$.juxtaposition_expression, $._primary_expression], // adjoint
    [$.juxtaposition_expression, $._expression],
    [$.matrix_row, $.comprehension_expression], // Comprehensions with newlines
    [$.parenthesized_expression, $.tuple_expression],
    [$._bracket_form, $.binary_expression], // ~ in brackets: binary wins over matrix element boundary
    [$.open_tuple, $.binary_expression], // return a, b ~ c: ~ binds b and c
  ],

  supertypes: $ => [
    $._expression,
    $._statement,
    $._definition,
  ],

  extras: $ => [
    /\s/,
    $.line_comment,
    $.block_comment,
  ],

  rules: {
    source_file: $ => optional(seq(
      optional($._terminator),
      sep1($._terminator, $._block_form),
      optional($._terminator)
    )),

    block: $ => seq(
      sep1($._terminator, $._block_form),
      optional($._terminator)
    ),

    _block_form: $ => choice(
      $._expression,
      $.assignment,
      $.open_tuple,
    ),

    _bracket_form: $ => choice(
      $._expression,
      alias($._closed_assignment, $.assignment),
    ),

    open_tuple: $ => prec(PREC.tuple, choice(
      seq($._expression, repeat1(seq(',', $._expression)), optional(',')),  // x, y [, z ...] [,]
      seq($._expression, ','),  // x,  (trailing comma destructuring)
    )),

    // assignments inside blocks
    assignment: $ => prec.right(PREC.assign, seq(
      choice(
        $._primary_expression,
        $.open_tuple,
        $._operation,
        $.operator,
      ),
      alias('=', $.operator),
      $._block_form,
    )),

    // assignments inside brackets
    _closed_assignment: $ => prec.right(PREC.assign, seq(
      choice(
        $._primary_expression,
        $._operation,
        $.operator,
      ),
      alias('=', $.operator),
      $._bracket_form,
    )),

    _expression: $ => choice(
      $._definition,
      $._statement,
      $._primary_expression,
      $._operation,
      $.compound_assignment_expression,
      $.macrocall_expression,
      $.arrow_function_expression,
      $.juxtaposition_expression,
      $.ternary_expression,
      $.operator,
      $.integer_literal,
      $.float_literal,
    ),

    // Definitions

    _definition: $ => choice(
      $.module_definition,
      $.abstract_definition,
      $.primitive_definition,
      $.struct_definition,
      $.typegroup_definition,
      $.function_definition,
      $.macro_definition,
    ),

    module_definition: $ => seq(
      choice('module', 'baremodule'),
      field('name', choice($.identifier, $.interpolation_expression)),
      optional($._terminator),
      optional($.block),
      'end',
    ),

    // TODO: Rename
    type_head: $ => prec(PREC.stmt, choice(
      $._primary_expression,
      $.binary_expression,
      $.where_expression, // struct Foo{T} <: Bar where {T} end
    )),

    abstract_definition: $ => seq(
      'abstract',
      'type',
      $.type_head,
      optional($._terminator),
      'end',
    ),

    primitive_definition: $ => seq(
      'primitive',
      'type',
      $.type_head,
      $.integer_literal,
      optional($._terminator),
      'end',
    ),

    struct_definition: $ => seq(
      optional('mutable'),
      'struct',
      $.type_head,
      optional($._terminator),
      optional($.block),
      'end',
    ),

    typegroup_definition: $ => seq(
      'typegroup',
      optional($._terminator),
      optional($.block),
      'end',
    ),

    signature: $ => prec(PREC.stmt, choice(
      $.identifier, // zero-method definition
      $.var_identifier, // var"..." zero-method definition
      $.call_expression,
      alias($.tuple_expression, $.argument_list), // anonymous function
      $.typed_expression,
      $.where_expression,
    )),

    function_definition: $ => seq(
      'function',
      $.signature,
      optional($._terminator),
      optional($.block),
      'end',
    ),

    macro_definition: $ => seq(
      'macro',
      $.signature,
      optional($._terminator),
      optional($.block),
      'end',
    ),


    // Statements

    _statement: $ => choice(
      // block statements:
      $.compound_statement,
      $.quote_statement,
      $.let_statement,
      $.if_statement,
      $.try_statement,
      $.for_statement,
      $.while_statement,
      // simple statements:
      $.break_statement,
      $.continue_statement,
      $.return_statement,
      $.const_statement,
      $.global_statement,
      $.local_statement,
      $.export_statement,
      $.import_statement,
      $.public_statement,
      $.using_statement,
    ),

    compound_statement: $ => seq('begin', optional($._terminator), optional($.block), 'end'),

    quote_statement: $ => seq('quote', optional($._terminator), optional($.block), 'end'),

    let_statement: $ => seq(
      'let',
      sep(',', $._bracket_form),
      $._terminator,
      optional($.block),
      'end',
    ),

    if_statement: $ => seq(
      'if',
      field('condition', $._expression),
      optional($._terminator),
      optional($.block),
      field('alternative', repeat($.elseif_clause)),
      field('alternative', optional($.else_clause)),
      'end',
    ),

    elseif_clause: $ => seq(
      'elseif',
      field('condition', $._expression),
      optional($._terminator),
      optional($.block),
    ),

    else_clause: $ => seq(
      'else',
      optional($._terminator),
      optional($.block),
    ),

    try_statement: $ => seq(
      'try',
      optional($._terminator),
      optional($.block),
      optional(choice(
        seq(
          $.catch_clause,
          optional($.else_clause),
          optional($.finally_clause),
        ),
        seq(
          $.finally_clause,
          optional($.catch_clause),
          // `else` is not valid here.
        ),
      )),
      'end',
    ),

    catch_clause: $ => prec(1, seq(
      'catch',
      optional($.identifier),
      optional($._terminator),
      optional($.block),
    )),

    finally_clause: $ => seq(
      'finally',
      optional($._terminator),
      optional($.block),
    ),

    for_statement: $ => seq(
      'for',
      sep1(',', $.for_binding),
      optional($._terminator),
      optional($.block),
      'end',
    ),

    while_statement: $ => seq(
      'while',
      field('condition', $._expression),
      optional($._terminator),
      optional($.block),
      'end',
    ),

    break_statement: _ => 'break',

    continue_statement: _ => 'continue',

    return_statement: $ => prec.right(PREC.stmt, seq(
      'return',
      optional($._block_form),
    )),

    const_statement: $ => prec.right(PREC.stmt, seq(
      'const',
      $._block_form,
    )),

    global_statement: $ => prec.right(PREC.stmt, seq(
      'global',
      $._block_form,
    )),

    local_statement: $ => prec.right(PREC.stmt, seq(
      'local',
      $._block_form,
    )),

    import_alias: $ => seq($._importable, 'as', $._exportable),

    import_path: $ => seq(
      $._import_from_current_module, // dots with optional spaces: .A, ..A, . .A
      choice(
        $.identifier,
        $._scoped_identifier,
        $.macro_identifier, // import ..@symcheck
      ),
    ),

    _exportable: $ => choice(
      $.identifier,
      $.macro_identifier,
      $.operator,
      $.interpolation_expression,
      $.var_identifier,
      parenthesize($._exportable),
    ),

    _importable: $ => choice(
      $._exportable,
      alias($._scoped_identifier, $.import_path),
      $.import_path,
    ),

    _import_list: $ => prec.right(sep1(',', choice(
      $._importable,
      $.import_alias,
    ))),

    selected_import: $ => seq(
      $._importable,
      token.immediate(':'),
      $._import_list,
    ),

    export_statement: $ => seq('export', prec.right(sep1(',', $._exportable))),

    public_statement: $ => seq('public', prec.right(sep1(',', $._exportable))),

    import_statement: $ => seq(
      'import',
      choice(
        $._import_list,
        $.selected_import,
      ),
    ),

    using_statement: $ => seq(
      'using',
      choice(
        $._import_list,
        $.selected_import,
      ),
    ),

    // Primary expressions can be called, indexed, accessed, and type parametrized.
    _primary_expression: $ => choice(
      $.identifier,
      $.boolean_literal,
      $.curly_expression, // Only valid in macros
      $.parenthesized_expression,
      $.tuple_expression,
      $._array,
      $._string,
      $.adjoint_expression,
      $.broadcast_call_expression,
      $.call_expression,
      alias($._closed_macrocall_expression, $.macrocall_expression),
      $.parametrized_type_expression,
      $.field_expression,
      $.index_expression,
      $.interpolation_expression,
      $.quote_expression,
      prec(-1, alias('public', $.identifier)), // Julia 1.11: contextual keyword
      prec(-1, alias('primitive', $.identifier)), // contextual: only keyword in `primitive type`
      prec(-1, alias('abstract', $.identifier)),  // contextual: only keyword in `abstract type`
      prec(-1, alias('mutable', $.identifier)),   // contextual: only keyword in `mutable struct`
      // `in` and `isa` are binary operators AND valid function names.
      // Allow them as identifiers at low precedence so `!isa(x)` parses as
      // `!(isa(x))` (unary + call) instead of `! isa (x)` (binary).
      prec(-1, alias('in', $.identifier)),
      prec(-1, alias('isa', $.identifier)),
      alias($._begin_identifier, $.identifier),    // begin as identifier via external scanner (a[begin+1:end])
      alias($._emoji_identifier, $.identifier),    // SMP emoji identifiers via external scanner
    ),

    _array: $ => choice(
      $.comprehension_expression,
      $.matrix_expression,
      $.vector_expression,
    ),

    comprehension_expression: $ => prec(PREC.array, seq(
      '[',
      $._bracket_form,
      optional($._terminator),
      $.for_clause,
      repeat(choice(
        $.for_clause,
        $.if_clause,
      )),
      ']',
    )),

    generator: $ => seq(
      $._bracket_form,
      $.for_clause,
      repeat(choice(
        $.for_clause,
        $.if_clause,
      )),
    ),

    if_clause: $ => seq(
      'if',
      $._expression,
    ),

    for_clause: $ => prec.right(seq(
      'for',
      sep1(',', $.for_binding),
    )),

    for_binding: $ => prec(1, seq(
      optional('outer'),
      choice(
        $.identifier,
        $.tuple_expression,
        $.typed_expression,
        $.interpolation_expression,
      ),
      alias(choice('in', '=', '∈'), $.operator),
      $._expression,
    )),

    matrix_expression: $ => prec(PREC.array, seq(
      '[',
      choice(
        seq(
          $.matrix_row,
          repeat(seq($._terminator, $.matrix_row)),
          optional($._terminator),
        ),
        $._semicolon, // empty ncat: [;], [;;], [;;;], etc.
      ),
      ']',
    )),

    matrix_row: $ => repeat1(prec(PREC.array, $._bracket_form)),

    vector_expression: $ => choice(
      // Vector with parameters: comma-separated elements, then ; params
      // [a, b; c] → vect(a, b, parameters(c))
      // [a, b; c; d] → vect(a, b, parameters(c, d))
      // Requires at least one comma before first ; (otherwise it's vcat/matrix).
      // Used by JuMP: @variable(model, x[i=1:3, j=1:3; isodd(i); iseven(j)])
      seq(
        '[',
        $._bracket_form,
        repeat1(seq(',', $._bracket_form)),
        repeat1(seq($._semicolon, sep(',', $._bracket_form))),
        ']',
      ),
      // Regular vector: comma-separated
      seq(
        '[',
        sep(',', $._bracket_form),
        optional(','),
        ']',
      ),
    ),

    parenthesized_expression: $ => prec.dynamic(1, parenthesize(
      sep1($._semicolon, choice(
        $._bracket_form,
        $.generator,
      )),
      optional($._semicolon),
    )),

    tuple_expression: $ => parenthesize(
      optional($._semicolon),
      sep(choice(',', $._semicolon), choice(
        $._bracket_form,
        $.generator,
      )),
      optional(choice(',', $._semicolon)),
    ),

    curly_expression: $ => choice(
      seq(
        '{',
        sep(',', $._bracket_form),
        optional(','),
        '}',
      ),
      // bracescat: space/semicolon-separated {x y}, {a ;; b}
      prec(PREC.array, seq(
        '{',
        choice(
          seq(
            $.matrix_row,
            repeat(seq($._terminator, $.matrix_row)),
            optional($._terminator),
          ),
          $._semicolon,
        ),
        '}',
      )),
    ),

    adjoint_expression: $ => seq(
      $._primary_expression,
      token.immediate('\''),
    ),

    field_expression: $ => prec(PREC.dot, seq(
      field('value', $._primary_expression),
      token.immediate('.'),
      choice(
        $.identifier,
        alias($._emoji_identifier, $.identifier), // sys.😄
        $.interpolation_expression,
        $.quote_expression,
        $._string,
        alias('?', $.identifier), // x.? (getproperty with ?)
      ),
    )),

    index_expression: $ => seq(
      $._primary_expression,
      $._immediate_bracket,
      $._array,
    ),

    parametrized_type_expression: $ => seq(
      $._primary_expression,
      $._immediate_brace,
      $.curly_expression,
    ),

    call_expression: $ => seq(
      choice($._primary_expression, $.operator),
      $._immediate_paren,
      alias($.tuple_expression, $.argument_list),
      optional($.do_clause),
    ),

    broadcast_call_expression: $ => seq(
      $._primary_expression,
      token.immediate('.'),
      $._immediate_paren,
      alias($.tuple_expression, $.argument_list),
      optional($.do_clause),
    ),

    _qualified_macro_identifier: $ => seq(
      $._primary_expression,
      token.immediate('.'),
      $.macro_identifier,
    ),

    _macro_head: $ => choice(
      alias($._qualified_macro_identifier, $.field_expression),
      $.macro_identifier,
    ),

    _closed_macrocall_expression: $ => seq(
      $._macro_head,
      choice(
        seq($._immediate_brace, $.curly_expression),
        seq($._immediate_bracket, $._array),
        seq(
          $._immediate_paren,
          alias($.tuple_expression, $.argument_list),
          optional($.do_clause)
        ),
      ),
    ),

    // HIGH precedence: @f a in b should be @f(a in b), not (@f a) in b.
    // Must outrank PREC.comparison so binary operators can't steal the macro
    // body. Stays below PREC.dot so @f a.b still parses correctly.
    macrocall_expression: $ => prec.right(PREC.decl, seq($._macro_head, optional($.macro_argument_list))),

    macro_argument_list: $ => prec.left(repeat1(prec(PREC.macro_arg, $._block_form))),

    do_clause: $ => seq(
      'do',
      sep(',', $._bracket_form),
      $._terminator,
      optional($.block),
      'end',
    ),

    interpolation_expression: $ => prec.right(PREC.prefix, seq(
      '$',
      choice(
        $.interpolation_expression, // $$x = $($x) nested interpolation
        $.integer_literal,
        $.float_literal,
        $.identifier,
        $.curly_expression,
        $.parenthesized_expression,
        $.tuple_expression,
        $._array,
        $._string,
      ),
    )),

    quote_expression: $ => prec.right(PREC.prefix, seq(
      ':',
      choice(
        $.integer_literal,
        $.float_literal,
        $._string,
        $.identifier,
        alias($._emoji_identifier, $.identifier), // :👍
        $.operator,
        seq($._immediate_brace, $.curly_expression),
        seq($._immediate_bracket, $._array),
        seq($._immediate_paren, choice(
          $.parenthesized_expression,
          $.tuple_expression,
          // Syntactic operators in parentheses
          parenthesize(
            alias(
              choice(
                '::', ':=', '.=', '=',
                $._assignment_operator,
                $._lazy_or_operator,
                $._lazy_and_operator,
                $._syntactic_operator,
              ),
              $.operator,
            ),
          ),
        )),
        // Syntactic operators without parentheses
        alias(
          choice(
            $._assignment_operator,
            $._lazy_or_operator,
            $._lazy_and_operator,
            $._syntactic_operator,
          ),
          $.operator,
        ),
        alias(token.immediate(KEYWORDS), $.identifier),
      ),
    )),


    // Operations

    _operation: $ => choice(
      $.unary_expression,
      $.binary_expression,
      $.range_expression,
      $.splat_expression,
      $.typed_expression,
      $.unary_typed_expression,
      $.where_expression,
    ),

    binary_expression: $ => {
      const table = [
        // ~ has same precedence as = in Julia (both 1), but must be above
        // PREC.array (-1) so that [0 ~ expr, ...] parses as vector with
        // binary ~ elements rather than matrix with unary ~ elements.
        // Uses external scanner _binary_tilde for whitespace sensitivity:
        // `a ~ b` and `a~b` are binary, `a ~b` is unary (Julia's rule).
        [prec.right, 0, $._binary_tilde],
        [prec.right, PREC.pair, $._pair_operator],
        [prec.right, PREC.arrow, $._arrow_operator],
        [prec.left, PREC.lazy_or, $._lazy_or_operator],
        [prec.left, PREC.lazy_and, $._lazy_and_operator],
        [prec.left, PREC.comparison, choice('in', 'isa', $._comparison_operator, $._type_order_operator)],
        [prec.right, PREC.pipe_left, $._pipe_left_operator],
        [prec.left, PREC.pipe_right, $._pipe_right_operator],
        [prec.left, PREC.colon, $._ellipsis_operator],
        [prec.left, PREC.plus, choice($._unary_plus_operator, $._plus_operator)],
        [prec.left, PREC.times, $._times_operator],
        [prec.left, PREC.rational, $._rational_operator],
        [prec.left, PREC.bitshift, $._bitshift_operator],
        [prec.left, PREC.power, $._power_operator],
      ];

      return choice(...table.map(([fn, prec, op]) => fn(prec, seq(
        $._expression,
        alias(op, $.operator),
        $._expression,
      ))));
    },

    unary_expression: $ => choice(
      // Regular unary operators at PREC.prefix
      prec.right(PREC.prefix, seq(
        alias(choice(
          $._tilde_operator,
          $._unary_operator,
          $._unary_plus_operator,
        ), $.operator),
        $._expression,
      )),
      // Type-order operators (<:, >:) as unary at LOWER precedence than binary
      // comparison. This ensures `if S <: U` parses as `if (S <: U)` (binary),
      // not `if S; <:U; ...` (unary). Unary still wins in contexts with no LHS
      // like `Vector{<:Number}`.
      prec.right(PREC.comparison - 1, seq(
        alias($._type_order_operator, $.operator),
        $._expression,
      )),
    ),

    range_expression: $ => prec.left(PREC.colon, seq(
      $._expression,
      token.immediate(':'),
      $._expression,
    )),

    splat_expression: $ => prec(PREC.colon, seq($._expression, '...')),

    ternary_expression: $ => prec.right(PREC.conditional, seq(
      $._expression,
      '?',
      $._bracket_form,
      ':',
      $._bracket_form,
    )),

    typed_expression: $ => prec(PREC.decl, seq(
      $._expression,
      '::',
      $._primary_expression,
    )),

    unary_typed_expression: $ => prec.right(PREC.prefix, seq(
      '::',
      $._primary_expression,
    )),

    arrow_function_expression: $ => prec.right(PREC.afunc, seq(
      choice(
        $.identifier,
        alias($.tuple_expression, $.argument_list),
        $.typed_expression,
        $.interpolation_expression, // :($c -> $b) in metaprogramming
      ),
      '->',
      $._bracket_form,
    )),

    juxtaposition_expression: $ => prec.left(seq(
      choice(
        $.integer_literal,
        $.float_literal,
        $.adjoint_expression,
        $.parenthesized_expression, // (2//3)x, (2)x
        $._array,                   // [1,2]u"cm", [1.0]x
      ),
      $._primary_expression,
    )),

    compound_assignment_expression: $ => prec.right(PREC.assign, seq(
      $._primary_expression,
      alias($._assignment_operator, $.operator),
      $._expression,
    )),

    where_expression: $ => prec.left(PREC.where, seq(
      $._expression,
      'where',
      $._expression,
    )),


    // Tokens

    macro_identifier: $ => seq('@', choice(
      $.identifier,
      $.operator,
      alias($._syntactic_operator, $.operator),
      alias($._scoped_identifier, $.field_expression),
      $.var_identifier, // @var"..."
    )),

    _scoped_identifier: $ => seq(
      choice($.identifier, $.interpolation_expression),
      repeat1(
        seq(
          token.immediate('.'),
          choice(
            $.identifier,
            $.interpolation_expression,
            $.quote_expression,                             // A.:+
            $.operator,                                      // A.==, A.⋆
            parenthesize(choice($._exportable, $.quote_expression)), // A.(:+)
          ),
        ),
      ),
    ),

    _word_identifier: _ => {
      const nonIdentifierCharacters = [
        '#',
        '$',
        ',',
        ':',
        ';',
        '@',
        '~',
        '(', ')',
        '{', '}',
        ...Object.values(OPERATORS),
      ].join(' ')
        .trim()
        // Don't remove '!' — it's excluded from identifiers so that `a!=b`
        // parses as `a != b` (comparison), not `a! = b` (assignment).
        // Identifiers ending in '!' (push!, sort!) are handled by the
        // identifier rule via token.immediate('!').
        .replace(/-/g, '')
        .replace(/\\/g, '\\\\')
        .replace(/\s+/g, '');

      // Sm (Math Symbol) characters valid as identifier start in Julia.
      // From jl_id_start_char() in julia_extensions.c.
      const validSmSymbols = [
        '°',
        '∀-∇',       // U+2200-U+2207
        '∎-∑',       // U+220E-U+2211
        '∞-∟',       // U+221E-U+221F
        '∫-∳',       // U+222B-U+2233
        '⅀-⅄',       // U+2140-U+2144
        '∿',         // U+223F
        '⊤-⊥',       // U+22A4-U+22A5
        '⊾-⊿',       // U+22BE-U+22BF
        '⋀-⋃',       // U+22C0-U+22C3
        '◸-◿',       // U+25F8-U+25FF
        '∠-∢',       // U+2220-U+2222
        '♯',         // U+266F
        '℘',         // U+2118
        '℮',         // U+212E
      ].join('');

      // So (Other Symbol) ranges safe for identifiers.
      // Only BMP ranges — SMP emoji (U+1F000+) needs external scanner
      // because JS RegExp without 'u' flag can't handle supplementary plane.
      // BMP So ranges: selective Misc Technical + Misc Symbols + Dingbats.
      // Full U+2300-U+23FF breaks token.immediate(KEYWORDS) for :where/:in.
      // U+2310-U+231B covers ⌐ through ⌛ (hourglass) safely.
      const soSymbols = '\\u2310-\\u231B\\u2600-\\u266E\\u2670-\\u27BF';

      // Sc (Currency Symbol) covers €, £, ¥, ₹, ₿, etc.
      // Exclude $ (U+0024) from Sc — it's the interpolation operator, not an identifier.
      const start = `[_\\p{XID_Start}\\p{Sc}${soSymbols}${validSmSymbols}&&[^0-9#*$]]`;
      const rest = `[^"'\`\\s\\.\\-\\[\\]${nonIdentifierCharacters}]*`;
      return new RegExp(start + rest);
    },

    // Identifiers may end with '!' (push!, sort!).
    // The '!' is matched separately via token.immediate so it competes
    // at the lexer level with '!=' and '!=='. Longest-match means:
    //   push!(x) → push + ! → identifier push!  (! wins, next is '(')
    //   a!=b     → a + !=   → identifier a       (!= wins over !)
    identifier: $ => choice(
      seq($._word_identifier, token.immediate('!')),
      $._word_identifier,
    ),

    // Literals

    boolean_literal: _ => choice('true', 'false'),

    integer_literal: _ => choice(
      token(seq('0b', numeral('01'))),
      token(seq('0o', numeral('0-7'))),
      token(seq('0x', numeral('0-9a-fA-F'))),
      numeral('0-9'),
    ),

    float_literal: _ => {
      const dec = numeral('0-9');
      const hex = numeral('0-9a-fA-F');
      const exponent = /[eEf][+-]?\d+/;
      const hex_exponent = /p[+-]?\d+/;

      const leading_period = token(seq(
        '.',
        dec,
        optional(exponent),
      ));

      // This has to be split into two tokens to avoid conflicts with ellipsis
      const trailing_period = seq(
        dec,
        token.immediate(seq(
          '.',
          optional(dec),
          optional(exponent),
        )),
      );

      const just_exponent = token(seq(dec, exponent));

      const hex_float = token(seq(
        choice(
          seq('0x', hex, optional('.'), optional(hex)),
          seq('0x.', hex),
        ),
        hex_exponent,
      ));

      return choice(leading_period, trailing_period, just_exponent, hex_float);
    },

    _string: $ => choice(
      $.character_literal,
      $.string_literal,
      $.command_literal,
      $.prefixed_string_literal,
      $.prefixed_command_literal,
    ),

    escape_sequence: _ => ESCAPE_SEQUENCE,

    character_literal: _ => token(seq(
      '\'',
      choice(
        /[^'\\]/,
        ESCAPE_SEQUENCE,
      ),
      '\'',
    )),

    _delimiter_str_1: _ => '"',
    _delimiter_str_3: _ => '"""',
    _delimiter_cmd_1: _ => '`',
    _delimiter_cmd_3: _ => '```',

    string_literal: $ => choice(
      seq(
        $._delimiter_str_1,
        repeat(choice(alias($._content_str_1, $.content), $.string_interpolation, $.escape_sequence)),
        $._end_str,
      ),
      seq(
        $._delimiter_str_3,
        repeat(choice(alias($._content_str_3, $.content), $.string_interpolation, $.escape_sequence)),
        $._end_str,
      ),
    ),

    command_literal: $ => choice(
      seq(
        $._delimiter_cmd_1,
        repeat(choice(alias($._content_cmd_1, $.content), $.string_interpolation, $.escape_sequence)),
        $._end_cmd,
      ),
      seq(
        $._delimiter_cmd_3,
        repeat(choice(alias($._content_cmd_3, $.content), $.string_interpolation, $.escape_sequence)),
        $._end_cmd,
      ),
    ),

    prefixed_string_literal: $ => prec.left(seq(
      field('prefix', $.identifier),
      $._immediate_string_start,
      choice(
        seq(
          $._delimiter_str_1,
          repeat(choice(alias($._content_str_1_raw, $.content), $.escape_sequence)),
          $._end_str,
        ),
        seq(
          $._delimiter_str_3,
          repeat(choice(alias($._content_str_3_raw, $.content), $.escape_sequence)),
          $._end_str,
        ),
      ),
      optional(field('suffix', $._string_macro_suffix)),
    )),

    prefixed_command_literal: $ => prec.left(seq(
      field('prefix', $.identifier),
      $._immediate_command_start,
      choice(
        seq(
          $._delimiter_cmd_1,
          repeat(choice(alias($._content_cmd_1_raw, $.content), $.escape_sequence)),
          $._end_cmd,
        ),
        seq(
          $._delimiter_cmd_3,
          repeat(choice(alias($._content_cmd_3_raw, $.content), $.escape_sequence)),
          $._end_cmd,
        ),
      ),
      optional(field('suffix', $._string_macro_suffix)),
    )),

    // var"..." non-standard identifier (only 'var' prefix, not any identifier)
    var_identifier: $ => seq(
      'var',
      $._immediate_string_start,
      choice(
        seq(
          $._delimiter_str_1,
          repeat(choice(alias($._content_str_1_raw, $.content), $.escape_sequence)),
          $._end_str,
        ),
        seq(
          $._delimiter_str_3,
          repeat(choice(alias($._content_str_3_raw, $.content), $.escape_sequence)),
          $._end_str,
        ),
      ),
    ),

    // String/command macro suffixes: r"regex"i, x"s"end, x"s"2
    _string_macro_suffix: $ => choice(
      $.identifier,
      alias(KEYWORDS, $.identifier),
      $.integer_literal,
      $.float_literal,
    ),

    string_interpolation: $ => seq(
      '$',
      choice(
        $.identifier,
        seq($._immediate_paren, parenthesize($._bracket_form)),
      ),
    ),

    operator: $ => choice(
      // NOTE: Syntactic operators (&&, +=, etc) cannot be used as identifiers.
      $._pair_operator,
      $._arrow_operator,
      $._comparison_operator,
      $._pipe_left_operator,
      $._pipe_right_operator,
      $._ellipsis_operator,
      ':',
      $._plus_operator,
      $._times_operator,
      $._rational_operator,
      $._bitshift_operator,
      $._power_operator,
      $._tilde_operator,
      $._type_order_operator,
      $._unary_operator,
      $._unary_plus_operator,
    ),

    _assignment_operator: _ => choice(':=', '$=', '.=', addDot(OPERATORS.assignment)),

    _pair_operator: _ => addDot('=>'),

    _arrow_operator: _ => addDot(OPERATORS.arrow),

    _lazy_or_operator: _ => addDot('||'),

    _lazy_and_operator: _ => addDot('&&'),

    _comparison_operator: _ => addDot(OPERATORS.comparison),

    _pipe_right_operator: _ => addDot('|>'),

    _pipe_left_operator: _ => addDot('<|'),

    _ellipsis_operator: _ => token(choice('..', addDot(OPERATORS.ellipsis))),

    _plus_operator: _ => addDot(OPERATORS.plus),

    _times_operator: _ => addDot(OPERATORS.times),

    _rational_operator: _ => addDot('//'),

    _bitshift_operator: _ => addDot(OPERATORS.bitshift),

    _power_operator: _ => addDot(OPERATORS.power),


    _tilde_operator: _ => addDot('~'), // unary or assignment

    _type_order_operator: _ => addDot('<: >:'), // unary or comparison

    _unary_operator: _ => addDot(OPERATORS.unary),

    _unary_plus_operator: _ => addDot(OPERATORS.unary_plus),


    _syntactic_operator: _ => choice('$', '.', '...', '->', '?'),


    _semicolon: _ => seq(';', repeat(token.immediate(';'))),

    _terminator: $ => choice(/\r?\n/, $._semicolon),

    block_comment: $ => seq(/#=/, $._block_comment_rest),

    // FIXME: This is currently a seq to avoid conflicts with block_comment
    line_comment: _ => seq(/#/, /.*/),
  },
});

/**
 *
 * @param {RuleOrLiteral} separator
 * @param {RuleOrLiteral} rule
 */
function sep(separator, rule) {
  return optional(sep1(separator, rule));
}

/**
 *
 * @param {RuleOrLiteral} separator
 * @param {RuleOrLiteral} rule
 */
function sep1(separator, rule) {
  return seq(rule, repeat(seq(separator, rule)));
}

/**
 *
 * @param {string} operatorString
 */
function addDot(operatorString) {
  const operators = operatorString.trim().split(/\s+/);
  const op = operators.length > 1 ? choice(...operators) : operators[0];
  return token(seq(optional('.'), op, OPERATOR_SUFFIX));
}

/**
 * @param {string} range
 */
function numeral(range) {
  return RegExp(`[${range}]([${range}]|_[${range}])*`);
}

/**
 *
 * @param {...any} rules
 */
function parenthesize(...rules) {
  return seq('(', ...rules, ')');
}
