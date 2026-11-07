// node test/juliasyntax/check.mjs [--update] [--verbose]
//
// Julia's own parser as the oracle for the grammar, with no Julia install: every snippet of
// the grammar's corpus (test/corpus/*.txt) and of JuliaSyntax's parser tests
// (juliasyntax_parser.jl, from JuliaSyntax.jl's test/parser.jl) is parsed by
//   - tree-sitter-julia, compiled to WebAssembly (tree-sitter-julia.wasm, web-tree-sitter), and
//   - JuliaSyntax, compiled to WebAssembly (juliasyntax.wasm),
// and classified:
//   agree      both parse cleanly
//   gap        tree-sitter reports ERROR/MISSING, JuliaSyntax parses cleanly (a grammar gap)
//   permissive JuliaSyntax rejects it, tree-sitter parses cleanly
//   both_error both reject it (intentional-error snippets land here)
// Snippets whose status is not `agree` are listed in expected.json. A snippet that becomes a
// gap without being listed fails the check (regression); a listed gap that now agrees is
// reported as resolved and also fails, so the baseline stays exact. `--update` rewrites it.
import fs from 'node:fs';
import path from 'node:path';
import { Parser, Language } from 'web-tree-sitter';
import { JuliaSyntax } from './juliasyntax.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, '../..');
const args = new Set(process.argv.slice(2));

// ─── snippets ────────────────────────────────────────────────────────

function corpusSnippets() {
  const out = [];
  const dir = path.join(root, 'test/corpus');
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.txt')).sort()) {
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    // ===\nname\n===\ncode\n---\nexpected  (repeated)
    const re = /^(=+)\n(.*)\n\1\n([\s\S]*?)\n-{3,}\n([\s\S]*?)(?=\n=+\n.*\n=+\n|$)/gm;
    let m;
    while ((m = re.exec(text))) {
      const [, , name, code, expected] = m;
      out.push({ id: `corpus/${f.replace('.txt', '')}/${name.trim()}`, code, intentional: /\(ERROR|\(MISSING/.test(expected) });
    }
  }
  return out;
}

function juliaString(s) {
  if (!s.startsWith('"')) return null;
  let r = '';
  for (let i = 1; i < s.length; i++) {
    const c = s[i];
    if (c === '"') return r;
    if (c === '\\') {
      const e = s[++i];
      r += { n: '\n', t: '\t', '\\': '\\', '"': '"', $: '$', r: '\r', 0: '\0' }[e] ?? '\\' + e;
    } else r += c;
  }
  return null;
}

// Same extraction as topiary-julia's build.rs: `"code" => expected` lines of test/parser.jl.
function juliaSyntaxSnippets() {
  const out = [];
  const lines = fs.readFileSync(path.join(here, 'juliasyntax_parser.jl'), 'utf8').split('\n');
  lines.forEach((line, k) => {
    const t = line.trim();
    if (!t || /^(#|\]|\[|tests|JuliaSyntax|with_version|function|end|PARSE_ERROR|"""|parsestmt)/.test(t)) return;
    const a = t.indexOf('=>');
    if (a < 0) return;
    const lhs = t.slice(0, a).trim(), rhs = t.slice(a + 2).trim();
    if (rhs.startsWith('PARSE_ERROR') || rhs.startsWith('r"')) return;
    let code = null;
    if (lhs.startsWith('"')) code = juliaString(lhs);
    else if (lhs.startsWith('((')) {
      const q = Math.max(lhs.lastIndexOf('", "'), lhs.lastIndexOf('), "'));
      if (q >= 0) { const rest = lhs.slice(q); code = juliaString(rest.slice(rest.indexOf('"'))); }
    }
    if (code) out.push({ id: `juliasyntax/line_${String(k + 1).padStart(4, '0')}`, code, intentional: /error/i.test(rhs) });
  });
  return out;
}

// ─── classify ────────────────────────────────────────────────────────

const wasm = path.join(root, 'tree-sitter-julia.wasm');
if (!fs.existsSync(wasm)) {
  console.error(`missing ${wasm}: run \`tree-sitter build --wasm\` first`);
  process.exit(2);
}
await Parser.init();
const ts = new Parser();
ts.setLanguage(await Language.load(wasm));
const js = new JuliaSyntax();

const snippets = [...corpusSnippets(), ...juliaSyntaxSnippets()];
const got = {};
const t0 = performance.now();
for (const s of snippets) {
  const tree = ts.parse(s.code);
  const tsErr = tree.rootNode.hasError;
  tree.delete();
  const jsErr = js.parse(s.code).hasErrors;
  got[s.id] = !tsErr && !jsErr ? 'agree' : tsErr && !jsErr ? 'gap' : !tsErr ? 'permissive' : 'both_error';
}
const ms = performance.now() - t0;

const expectedPath = path.join(here, 'expected.json');
const counts = {};
for (const v of Object.values(got)) counts[v] = (counts[v] || 0) + 1;
console.log(`${snippets.length} snippets (${snippets.filter((s) => s.id.startsWith('corpus/')).length} grammar corpus, ` +
  `${snippets.filter((s) => s.id.startsWith('juliasyntax/')).length} JuliaSyntax parser tests) in ${ms.toFixed(0)} ms: ` +
  Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', '));

if (args.has('--update')) {
  const base = Object.fromEntries(Object.entries(got).filter(([, v]) => v !== 'agree').sort());
  fs.writeFileSync(expectedPath, JSON.stringify(base, null, 1) + '\n');
  console.log(`wrote ${expectedPath} (${Object.keys(base).length} entries)`);
  process.exit(0);
}

const expected = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));
const byId = Object.fromEntries(snippets.map((s) => [s.id, s]));
let bad = 0;
for (const [id, status] of Object.entries(got)) {
  const want = expected[id] ?? 'agree';
  if (status === want) continue;
  bad++;
  const what = want === 'agree' ? 'REGRESSION' : status === 'agree' ? 'RESOLVED (remove from expected.json)' : 'CHANGED';
  console.log(`${what}: ${id}: expected ${want}, got ${status}: ${JSON.stringify(byId[id].code).slice(0, 100)}`);
}
for (const id of Object.keys(expected)) if (!(id in got)) { bad++; console.log(`STALE: ${id} is not a snippet any more`); }
if (args.has('--verbose')) for (const [id, st] of Object.entries(got)) if (st === 'gap') console.log(`gap: ${id}: ${JSON.stringify(byId[id].code).slice(0, 100)}`);
console.log(bad ? `${bad} difference(s) from expected.json` : 'matches expected.json');
process.exit(bad ? 1 : 0);
