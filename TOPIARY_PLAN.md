# tree-sitter-julia improvements for topiary-julia

This branch contains grammar fixes to improve tree-sitter-julia's coverage
of Julia syntax, driven by gaps found via the
[topiary-julia](https://github.com/pankgeorg/topiary-julia) formatter.

Base: `tree-sitter/tree-sitter-julia` v0.25.0
Includes: aviatesk's PRs #182 (CLI 0.26.6 regen) and #183 (typegroup syntax)

Current status (measured against JuliaSyntax.jl parser corpus, 828 snippets):
- Intentional errors: 89 (JuliaSyntax expects an error parse)
- Grammar gaps: **24** (was 57 at baseline)
- Testable: 715
- Pass rate: **715/715 (100%)** — zero format errors, zero AST mismatches

## Completed

### Tier 1 — Easy wins
- [x] `public` contextual identifier (partial: in module/scope but not function body)
- [x] Tuple destructuring `x, = xs` (upstream #164)
- [x] Character literal `'α'`
- [x] Unicode identifier start (`\p{Sc}` + Sm allowlist)

### Tier 2 — Medium complexity
- [x] Semicolons in brackets `[;]`, `{a ;; b}` (upstream #120)
- [x] Advanced import paths `import A.:+`, `import A.(:+)`, `using A: b.:c` (upstream #74)
- [x] `!` in identifier middle (`foo!bar`, `permute!!`) via external scanner
- [x] Juxtaposition whitespace sensitivity via `_no_ws_here` external scanner
- [x] Juxtaposition rejects reserved keywords (`1where 'c'`, `1in foo`, `1isa Int`)
- [x] Call expression as juxtaposition LHS (`f(x)y`, `(2)(3)x`)
- [x] Integer/float/adjoint/parens as juxtaposition LHS; unary op as RHS (`1√x`, `f'ᵀ`)

### Context-sensitive lexing (external scanner tokens)
- [x] `_no_ws_here` — juxtaposition gate (no whitespace between operands)
- [x] `_ident_tail` — `!` in identifier middle, matching JuliaSyntax lex_identifier
- [x] `_spaced_range_colon` — `a : b` (range with spaces), avoids `quote :b` misread
- [x] `_ternary_colon` — `a ? b : c`, priority over range_colon
- [x] `_scope_dot` — import paths with operators (`import A.⋆`, `import .⋆`)
- [x] `_binary_tilde` — `~` binary vs unary based on spacing
- [x] `_emoji_identifier` — SMP emoji as identifiers
- [x] `_begin_identifier` — `begin` as identifier in indexing (`a[begin+1:end]`)
- [x] `_immediate_*` — paren/bracket/brace/string/command without intervening whitespace
- [x] `_import_from_current_module` — leading dots in imports

### Block-construct edge cases (this branch's batch)
- [x] Inline do-block: `f(x) do y body end`, `do y end` (params-only)
- [x] Inline let with multi-binding: `let x=1, y=2 end`
- [x] Generator in curly braces: `x where {y for y in ys}`
- [x] Trailing args after generator: `T{y for x=xs; a}`
- [x] Interpolation as catch variable: `try x catch $e y end`
- [x] Interpolation as function signature: `function $f end`
- [x] Closed macrocall signature: `function @callmemacro(a) ... end`
- [x] Operator as zero-method signature: `function ⊇ end`
- [x] Typed expression with int/float/if RHS: `x::1`, `y::if x z end`
- [x] Parenthesized macro identifier: `@(A) x`
- [x] Contextual keywords as field names: `p.in`, `p.isa`
- [x] Contextual keywords as string macro prefix: `in"str"`, `isa"str"`
- [x] Integer/float as assignment LHS: `f(x) = 1 = 2`
- [x] Expression (not just integer) as primitive type size: `primitive type X sizeof(Ptr) * 8 end`
- [x] Unicode assignment operators as bare symbols: `≔`, `⩴`, `≕`

## Known grammar gaps (24 remaining)

The gaps below are edge cases where Julia's context-sensitive parser
succeeds but tree-sitter's LALR parser can't replicate without major
restructuring. Most are rare in real-world code.

### Julia-intentional errors misclassified as gaps
These snippets error in Julia's `Meta.parse` too, but JuliaSyntax emits
a partial parse tree that the corpus test classifies as "no error".
Tree-sitter can't produce partial parses.

- `x.3` — field access with numeric literal
- `f(2)2` — numeric juxtaposition after call (Julia: ERR)
- `x' y`, `x 'y` — adjoint with whitespace
- `x@y` — `@` between identifiers
- `.+ =`, `.+)`, `+)`, `<: )`, `<: =`, `&)`, `@$ y`, `return)`, `:)` —
  partial-parse fragments (all error in Julia too)

### Lexer-ambiguity issues (accepted tradeoffs)
- **`A.⋆` standalone field access** — Works in `import A.⋆` (scope_dot
  scanner fires), but fails as standalone `A.⋆` because field_expression
  outside import contexts can't reliably distinguish from broadcast `.⋆`.
- **`&a` prefix operator** (ccall pass-by-reference) — Adding `&` as unary
  breaks `x >> y & z` parsing (becomes `x >> y + unary(&z)` instead of
  `(x >> y) & z`). Julia disambiguates via context (ccall arg position);
  tree-sitter's LALR can't. **Reverted to avoid regressions.**
- **`""" doc """ foo` docstring juxtaposition** — Would require allowing
  whitespace between operands in juxtaposition, breaks the
  whitespace-sensitive juxtaposition fix (which itself closes many gaps).
- **`for i = 1 : 3` spaced range inside for-binding** — Scanner state for
  "saw whitespace before `:`" isn't reliably preserved across tree-sitter's
  serialize/deserialize calls. Top-level `a : b` works; inner position fails.

### Whitespace-sensitive juxtaposition regressions (intentional tradeoff)
Fixing `x * y` vs `xy` disambiguation required making juxtaposition
whitespace-sensitive. These cases now fail (were previously parsing
incorrectly anyway):

- `1where'c'` — **fixed** via keyword peek-ahead in NO_WS_HERE scanner
- `(2)(3)x` — **fixed** by allowing call_expression as juxt LHS
- `f'ᵀ`, `1√x` — **fixed** by extending Unicode RHS starts / allowing
  unary_expression as juxt RHS

### JuliaSyntax partial-parse of for-binding context
- `outer i = rhs`, `outer (x,y) = rhs` — only valid inside `for` binding;
  standalone parsing matches Julia's error behavior.

### Advanced import with interpolation
- `import $A.@x` — dotted path with interpolation prefix and macro suffix.
  Grammar allows `interpolation_expression` or `identifier` before the dot,
  but scope_dot can't follow interpolation_expression directly.

### Contextual keyword `public` in function scope
- `function f(public) public + 3 end` — `public` as parameter should be
  identifier in body, but tree-sitter picks `public_statement` (rule priority).
  Julia's parser tracks scope and knows `public` is bound locally. Requires
  scope-aware disambiguation which tree-sitter's LALR can't provide.

### Newlines inside brackets
- `[x\n, y]`, `[x=1, ; y=2]`, `[a \n ;]` — Julia treats `\n` inside `[...]`
  as whitespace. Tree-sitter lexes `\n` as `_terminator` globally; would
  require a bracket-depth-aware lexer.

### Not worth fixing
- `in"str"` **regressed** when `in` became a contextual identifier
  (commit 5880b1e) — **later fixed** by allowing aliased contextual
  keywords in prefixed_string_literal.

## Dev workflow

```bash
tree-sitter generate    # after grammar.js changes
tree-sitter test        # run corpus tests (110+ tests)
tree-sitter parse /tmp/test.jl   # test a snippet
```

## Commit convention

```
feat(grammar): add public as contextual identifier
fix(grammar): allow trailing comma in tuple destructuring
test(corpus): add test cases for public keyword contexts
chore: regenerate parser
```
