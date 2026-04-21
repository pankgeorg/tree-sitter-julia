# tree-sitter-julia

[![CI][ci]](https://github.com/tree-sitter/tree-sitter-julia/actions/workflows/ci.yml)
[![discord][discord]](https://discord.gg/w7nTvsVJhm)
[![matrix][matrix]](https://matrix.to/#/#tree-sitter-chat:matrix.org)
[![crates][crates]](https://crates.io/crates/tree-sitter-julia)
[![npm][npm]](https://www.npmjs.com/package/tree-sitter-julia)
[![pypi][pypi]](https://pypi.org/project/tree-sitter-julia/)

A [tree-sitter](https://github.com/tree-sitter/tree-sitter) parser for [Julia](https://julialang.org/).

## Known parsing differences from Julia

tree-sitter uses an LALR parser with external scanners; Julia's reference parsers
(the flisp parser and JuliaSyntax.jl) are hand-written recursive descent. A handful
of syntactic constructs rely on context-sensitive parser state that doesn't
translate cleanly to LALR. The grammar is designed to parse typical real-world
Julia code without errors, but the following edge cases are known to parse
differently or fail:

- **`(2)(3)x` as numeric juxtaposition**: Julia parses as `2 * 3 * x`; tree-sitter
  parses `(2)(3)` as `call_expression` because `(` immediately after `)` matches
  `_immediate_paren`. The tree shape differs but the source round-trips correctly.

- **`&` as unary prefix** (ccall pass-by-reference, e.g. `ccall(..., &x)`): Not
  supported. Adding `&` as unary ambiguates binary `&` in expressions like
  `a >> b & c`, which is far more common than ccall prefix usage.

- **Spaced range colon inside for-binding**: `for i = 1 : 3` doesn't parse as a
  range (top-level `1 : 3` does). tree-sitter's extras handling makes scanner
  state for "saw whitespace before `:`" unreliable in this specific position.

- **`public` as a function parameter name** (`function f(public) public + 3 end`):
  tree-sitter prefers `public_statement` in the function body. Julia's parser
  tracks scope to know `public` is a bound local.

- **Newlines inside brackets**: `[x\n, y]` — Julia treats `\n` as whitespace
  inside `[...]`; tree-sitter lexes `\n` as a statement terminator globally.

- **Docstring juxtaposition**: `""" doc """ foo` — Julia attaches the docstring
  to `foo` via juxtaposition across whitespace. tree-sitter's juxtaposition is
  whitespace-sensitive to disambiguate `2 x` (error) from `2x` (multiplication).

- **Dotted-operator field access standalone**: `A.⋆` fails outside import paths
  because the lexer greedily produces `.⋆` as a broadcast operator token. Inside
  import paths the `_scope_dot` external scanner resolves this; in expression
  contexts the ambiguity with `a .+ b` prevents a clean fix.

Gaps in the JuliaSyntax.jl parser test corpus: see
[`TOPIARY_PLAN.md`](TOPIARY_PLAN.md) for the full list and status.

## References

- [The Julia Parser](https://github.com/JuliaLang/julia/blob/master/src/julia-parser.scm)
- [Julia ASTs documentation](https://docs.julialang.org/en/v1/devdocs/ast/)
- [JuliaSyntax.jl](https://julialang.github.io/JuliaSyntax.jl/dev/)

[ci]: https://img.shields.io/github/actions/workflow/status/tree-sitter/tree-sitter-julia/ci.yml?logo=github&label=CI
[discord]: https://img.shields.io/discord/1063097320771698699?logo=discord&label=discord
[matrix]: https://img.shields.io/matrix/tree-sitter-chat%3Amatrix.org?logo=matrix&label=matrix
[npm]: https://img.shields.io/npm/v/tree-sitter-julia?logo=npm
[crates]: https://img.shields.io/crates/v/tree-sitter-julia?logo=rust
[pypi]: https://img.shields.io/pypi/v/tree-sitter-julia?logo=pypi&logoColor=ffd242

