// JuliaSyntax — the parser shipped with Julia 1.13 — compiled to WebAssembly GC by
// WasmCodegen.jl (juliasyntax.wasm; built from topiary-julia's jlparse/parser.jl, see README).
// Only numbers cross the boundary: the source goes in 4 bytes per call, the parser's raw output
// (ParseStream.output: tokens and interior ranges in postorder) comes back node by node.
import fs from 'node:fs';

const CLASS = { INTERIOR: 1, TRIVIA: 2, ERROR: 4, WHITESPACE: 128 };

export class JuliaSyntax {
  constructor(wasmPath = new URL('./juliasyntax.wasm', import.meta.url)) {
    // synchronous compile + instantiate: usable from synchronous callers
    const mod = new WebAssembly.Module(fs.readFileSync(wasmPath));
    this.e = new WebAssembly.Instance(mod, {}).exports;
    this.names = new Map();
  }

  kindName(k) {
    let s = this.names.get(k);
    if (s === undefined) {
      const n = this.e.kind_name_len(k), b = new Uint8Array(n);
      for (let j = 0; j < n; j++) b[j] = this.e.kind_name_byte(k, j + 1);
      s = new TextDecoder().decode(b);
      this.names.set(k, s);
    }
    return s;
  }

  /** Parse `src` as a file: { nodes, root, diagnostics, hasErrors }. Byte offsets are UTF-8. */
  parse(src) {
    const e = this.e;
    const bytes = new TextEncoder().encode(src);
    e.src_resize(bytes.length);
    for (let i = 0; i < bytes.length; i += 4) {
      const w = bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) | (bytes[i + 3] << 24);
      e.src_set4(i + 1, w | 0);
    }
    const n = e.parse_src(1);
    // postorder → tree: an interior node's children are the stack entries within its nodespan
    const nodes = [], stack = [];
    let pos = 0;
    for (let k = 1; k <= n; k++) {
      const cls = e.out_class(k), span = e.out_span(k), ns = e.out_nodespan(k);
      const node = { kind: this.kindName(e.out_kind(k)), cls, flags: e.out_flags(k), start: pos, end: pos, children: [] };
      const i = k - 1;
      if (cls & CLASS.INTERIOR) {
        const first = i - ns;
        while (stack.length && stack[stack.length - 1].i >= first) node.children.unshift(stack.pop().node);
        if (node.children.length) node.start = node.children[0].start; else { node.end = pos + span; pos = node.end; }
        node.end = node.children.length ? pos : node.end;
      } else {
        pos += span;
        node.end = pos;
      }
      nodes.push(node);
      stack.push({ i, node });
    }
    // the output starts with a zero-width sentinel token outside the tree
    const roots = stack.map((s) => s.node).filter((x) => x.cls & CLASS.INTERIOR || x.end > x.start);
    const diagnostics = [];
    for (let k = 1; k <= e.ndiag(); k++) {
      const len = e.diag_msg_len(k), m = new Uint8Array(len);
      for (let j = 0; j < len; j++) m[j] = e.diag_msg_byte(k, j + 1);
      diagnostics.push({
        first: e.diag_first(k) - 1, last: e.diag_last(k), // 0-based, end exclusive (bytes)
        level: ['', 'error', 'warning', 'note'][e.diag_level(k)] || 'note',
        message: new TextDecoder().decode(m),
      });
    }
    return { nodes, root: roots[0], roots, diagnostics, hasErrors: diagnostics.some((d) => d.level === 'error') };
  }
}
