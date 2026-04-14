# tree-sitter-julia improvements for topiary-julia

This branch contains grammar fixes to improve tree-sitter-julia's coverage
of Julia syntax, driven by gaps found via the
[topiary-julia](https://github.com/pankgeorg/topiary-julia) formatter.

Base: `tree-sitter/tree-sitter-julia` v0.25.0  
Includes: aviatesk's PRs #182 (CLI 0.26.6 regen) and #183 (typegroup syntax)

## Progress checklist

### Tier 1 — Easy wins (grammar.js only)

- [x] **`public` in KEYWORDS** — added to KEYWORDS constant for `var"public"` support.
  Contextual identifier (public=4 in function scope) deferred — tree-sitter can't
  distinguish module scope from function scope.
  
- [x] **Tuple destructuring `x, = xs`** — fixed `open_tuple` to allow trailing comma.
  Fixes upstream issue #164.

- [x] **Character literal `'α'`** — already works, confirmed.

- [x] **Unicode identifier start** — added `\p{Sc}` (currency: €, £, ¥, ₿) and
  expanded Sm allowlist (∞, ⊤, ⊥, ⋀-⋃, ◸-◿, ♯, ℘, etc.) to match Julia's
  `jl_id_start_char()`.

### Tier 2 — Medium complexity

- [x] **Semicolons in brackets** (~6 snippets)
  - Empty ncat `[;]`, `[;;]`, `[;;;]` — modified `matrix_expression` to allow bare semicolons
  - Bracescat `{x y}`, `{a ;; b}`, `{x ;;; y}` — added space/semicolon branch to `curly_expression`
  - Upstream: issue #120

- [x] **Advanced import paths** (~5 snippets)
  - `import A.:+`, `import A.(:+)`, `import A.:(+)`, `using A: b.:c`
  - Extended `_scoped_identifier` to allow `quote_expression`, `operator`, parenthesized exportable after dot
  - Note: `import A.==` still fails — lexer combines `.==` as broadcast operator
  - Upstream: issue #74

- [ ] **Operator suffixes** (`+₁`, `×ᵀ`, `⊕′`)
  - Julia supports 121 suffix characters (subscripts, superscripts, primes, combining marks)
  - tree-sitter-julia has zero support for operator suffixes
  - Needs `token(seq(op, optional(suffix_pattern)))` wrapping
  - See: `jl_op_suffix_char()` in `src/flisp/julia_extensions.c`

### Tier 3 — Deferred (hard / architectural)

- [ ] `$` as operator (`$$a`, `a $ b`) — upstream issue #161
- [ ] `var"..."` identifiers — upstream issue #92 (needs scanner)
- [ ] Multi-paren juxtaposition `(2)(3)x` — upstream issue #92
- [ ] `public` as contextual identifier — needs scope awareness
- [ ] Emoji identifiers — excluded to avoid parser size explosion

## Dev workflow

```bash
tree-sitter generate    # after grammar.js changes
tree-sitter test        # run corpus tests
tree-sitter parse /tmp/test.jl   # test a snippet
```

## Commit convention

```
feat(grammar): add public as contextual identifier
fix(grammar): allow trailing comma in tuple destructuring  
test(corpus): add test cases for public keyword contexts
chore: regenerate parser
```
