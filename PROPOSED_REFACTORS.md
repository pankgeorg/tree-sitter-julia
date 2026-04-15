# Proposed Refactors for tree-sitter-julia

Hard problems that need architectural changes. Documented here with full context so we can revisit.

## `begin`/`end` as identifiers inside indexing brackets

**Problem**: `a[begin+1]`, `a[(begin+1):end]` fail. Julia treats `begin` and `end` as identifiers inside `x[...]` indexing, but tree-sitter's `compound_statement` (`begin...end` block) wins because `begin +1 end` is a valid block.

**What works**: `a[end-1]` (end doesn't start any rule), `a[begin]`, `a[begin:end]` (compound_statement fails fast on `:` or `]`).

**What fails**: `a[begin+1]`, `a[begin-1]`, `a[(begin+1):end]`, `a[(begin+1):(end-1)]`. Any arithmetic on `begin` inside brackets.

**Root cause**: GLR explores both paths — `begin` as identifier (prec -1) and `begin` as compound_statement start (prec 0). The compound_statement path interprets `+1` as unary `+1` inside the block, producing a valid (but wrong) tree. Since both paths produce valid trees, the higher-precedence compound_statement wins. `prec.dynamic` doesn't help because the paths resolve at different grammar levels.

**Julia's rule**: Inside `x[...]` (ref), `begin` and `end` are identifiers. Inside `[...]` (array literal), `begin...end` is a block. The distinction is whether there's a preceding expression (context-dependent).

**Affected files**: 4 unique in focused corpus (MTK abstractsystem.jl, discrete_system.jl × copies).

**Attempted fixes**:
- `prec(-1, alias('begin', $.identifier))` in `_primary_expression` — helps `a[begin]` and `a[begin:end]` but not arithmetic
- `prec.dynamic(-1)` on `compound_statement` — no effect, GLR resolves at different levels
- `prec.dynamic(1)` on the alias — no effect

**Possible approaches**:
1. **Separate `_bracket_expression`** — create a subset of `_expression` that excludes `compound_statement` (and `quote_statement`?), use it in `_bracket_form`. Large refactor affecting many rules.
2. **External scanner with bracket depth tracking** — scanner maintains a stack of `[` depth. When inside brackets, `begin` produces `BEGIN_IDENTIFIER` token instead of being consumed by keyword rules. Complex state management in scanner.c (need serialize/deserialize).
3. **Accept limitation** — `a[begin:end]` works, `a[begin+1:end]` doesn't. Users can write `a[(begin)+1:end]` as workaround (though this also fails currently).

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
