# tree-sitter-julia improvements for topiary-julia

This branch contains grammar fixes to improve tree-sitter-julia's coverage
of Julia syntax, driven by gaps found via the
[topiary-julia](https://github.com/pankgeorg/topiary-julia) formatter.

Base: `tree-sitter/tree-sitter-julia` v0.25.0  
Includes: aviatesk's PRs #182 (CLI 0.26.6 regen) and #183 (typegroup syntax)

## Progress checklist

### Tier 1 — Easy wins (grammar.js only)

- [ ] **`public` as contextual identifier** (~6 snippets)
  - `public = 4`, `public[7] = 5`, `function f(public) end`
  - Add to KEYWORDS + alias in `_expression` (like `begin`)
  - Upstream: no issue yet — file one
  
- [ ] **Tuple destructuring `x, = xs`** (~2 snippets)
  - `x, = xs`, `x, = (2, 3)`
  - Fix `open_tuple` to allow trailing comma
  - Upstream: issue #164

- [ ] **Character literal `'α'`** (~1 snippet)
  - Test if it already works; fix regex if not
  - Upstream: no issue

### Tier 2 — Medium complexity

- [ ] **Semicolons in brackets** (~6 snippets)
  - `[;]`, `{a ;; b}`, `{x ;;; y}`
  - Add semicolon support to `vector_expression` and `curly_expression`
  - Upstream: issue #120

- [ ] **Advanced import paths** (~5 snippets)
  - `import A.:+`, `import A.(:+)`, `using A: b.:c`
  - Extend `_scoped_identifier` / `_exportable`
  - Upstream: issue #74

### Tier 3 — Deferred (hard / architectural)

- [ ] `$` as operator (`$$a`, `a $ b`) — upstream issue #161
- [ ] `var"..."` identifiers — upstream issue #92 (needs scanner)
- [ ] Multi-paren juxtaposition `(2)(3)x` — upstream issue #92

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
