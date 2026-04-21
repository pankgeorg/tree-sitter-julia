# Proposed Refactors for tree-sitter-julia

Hard problems that need architectural changes. Documented here with full context so we can revisit.

## `begin`/`end` as identifiers inside indexing brackets

**Status**: MOSTLY SOLVED via BEGIN_IDENTIFIER external scanner.

**Solution**: External scanner with lookahead heuristic. When the parser is in a state where `begin` could be either a keyword or identifier, the scanner checks what follows: if `begin` is followed by an operator (`+`, `-`, `*`, etc.), it produces `BEGIN_IDENTIFIER` (identifier semantics). If followed by `;` or newline, it produces the normal `begin` keyword (block semantics). This correctly handles `a[begin+1:end]`, `a[(begin+1):(end-1)]`, and all arithmetic-on-begin patterns.

**What now works**: `a[begin]`, `a[begin:end]`, `a[begin+1]`, `a[begin-1]`, `a[(begin+1):end]`, `a[(begin+1):(end-1)]`.

**Remaining issue**: `$sym -> begin` — the arrow tokenization interacts with `begin` in a way unrelated to the identifier-vs-keyword problem. This is an arrow/interpolation edge case, not a begin-as-identifier issue.

**Previous attempted approaches** (for historical reference):

1. **`prec(-1, alias('begin', $.identifier))` in `_primary_expression`** — helped `a[begin]` and `a[begin:end]` but not arithmetic. The `_primary_expression` match can't extend into `binary_expression` because `compound_statement` at the `_expression` level wins the GLR race.

2. **`prec.dynamic` on `_bracket_form` + compound_statement** — adding `prec.dynamic(10, alias('begin', $.identifier))` to `_bracket_form` with `prec.dynamic(-10)` on `compound_statement` WORKS for indexing but BREAKS `begin...end` blocks inside array literals `[begin; 1; end]`, function calls `f(begin; 1; end)`, and parens `(begin; 1; end)` — because `_bracket_form` is shared across ALL bracket contexts, not just indexing.

3. **Separate `_index_array` with `_index_bracket_form`** — creating index-specific versions of vector/matrix/comprehension rules. Generated but caused 7/70 corpus test failures. The split propagates through too many rules and causes widespread GLR conflicts.

## Emoji in space-separated macro arguments

**Problem**: `@named 😄 = Lorenz()` fails. The `EMOJI_IDENTIFIER` external scanner token isn't in `valid_symbols` when the parser is in the `macro_argument_list` state.

**What works**: `@foo(😄)` — paren-form macro calls. `😄 = 1` — standalone. Any context where `_primary_expression` is reachable through the normal grammar path.

**What fails**: `@foo 😄` — space-separated macro arguments. The `macro_argument_list` uses `_block_form` → `_expression` → `_primary_expression`, but tree-sitter's external scanner doesn't fire because the parser state doesn't include `EMOJI_IDENTIFIER` in valid_symbols.

**Root cause**: tree-sitter only calls the external scanner when the token is valid in the current parser state. The `alias($._emoji_identifier, $.identifier)` in `_primary_expression` should make it reachable, but the macro argument list parsing state may not include it due to how tree-sitter computes valid symbol sets for external tokens.

**Affected files**: 2 unique (MTK variable_utils.jl).

**Possible approaches**:
1. **Use `_emoji_identifier` directly in `macro_argument_list`** — add it as an explicit alternative
2. **Move emoji to the `_word_identifier` regex** — but `\p{So}` breaks `token.immediate(KEYWORDS)` for `:where`, `:in`. Need to find which specific So ranges conflict and exclude them.
3. **Accept limitation** — emoji in macro args is very rare in real code
