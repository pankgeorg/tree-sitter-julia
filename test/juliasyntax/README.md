# JuliaSyntax check: Julia's own parser as the oracle, in WebAssembly

`node test/juliasyntax/check.mjs` (or `npm run test:juliasyntax`) parses every snippet of the
grammar's corpus (`test/corpus/*.txt`) and of JuliaSyntax.jl's parser tests
(`juliasyntax_parser.jl`, from JuliaSyntax.jl's `test/parser.jl`) twice:

- with this grammar's **Wasm build** (`tree-sitter-julia.wasm`, via web-tree-sitter), and
- with **JuliaSyntax**, the parser shipped with Julia 1.13, compiled to WebAssembly
  (`juliasyntax.wasm`, 735 KB),

so no Julia and no native compiler are needed. Each snippet is classified as `agree` (both
parse cleanly), `gap` (tree-sitter reports ERROR/MISSING, JuliaSyntax parses it: a grammar
gap), `permissive` (JuliaSyntax rejects it, tree-sitter doesn't) or `both_error`. Everything
but `agree` is listed in `expected.json`; a new gap fails the check, and so does a listed gap
that now parses (update the baseline with `--update`). `--verbose` lists the gaps.

`juliasyntax.mjs` is a small, dependency-free host for `juliasyntax.wasm`: `new JuliaSyntax()`
compiles it synchronously, and `parse(src)` returns the green tree (kinds, flags, UTF-8 byte
ranges) and the diagnostics.

`juliasyntax.wasm` is built from topiary-julia's `jlparse/parser.jl` with
[WasmCodegen.jl](https://github.com/gbaraldi/WasmCodegen.jl) (main 316bbaf, Julia 1.13.2,
`wasm-opt -O3`). It matches native JuliaSyntax node for node on topiary-julia's reference
corpus. Rebuild instructions: topiary-julia `jlparse/README.md`.
