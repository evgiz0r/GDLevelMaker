// node tools/profsum.js <file.cpuprofile | dir> [--top N]  -- where a node job spends its time, from a V8 CPU profile.
//   Make one with: node --cpu-prof --cpu-prof-dir=local/prof tools/<tool>.js ...  (a dir: its newest .cpuprofile)
//   Prints the top functions by self time and by total time (self + what they call), with file:line, in % of the run.
//   Used to find what to cut in slow solves and route plans (CLAUDE.md "How long things take").
const fs = require("fs"), path = require("path");
const args = process.argv.slice(2);
if (!args.length) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }
let f = args[0];
if (fs.statSync(f).isDirectory()) f = fs.readdirSync(f).filter(n => n.endsWith(".cpuprofile")).map(n => path.join(args[0], n)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
const top = +(args[args.indexOf("--top") + 1] || 0) || 25;
const P = JSON.parse(fs.readFileSync(f, "utf8")), byId = new Map(P.nodes.map(n => [n.id, n]));
const self = new Map(); for (const s of P.samples) self.set(s, (self.get(s) || 0) + 1);
const total = P.samples.length, parent = new Map();
for (const n of P.nodes) for (const c of n.children || []) parent.set(c, n.id);
const name = n => { const c = n.callFrame; return `${c.functionName || "(anon)"} ${path.basename(c.url || "")}:${c.lineNumber + 1}`; };
const selfBy = new Map(), totalBy = new Map();
for (const [id, cnt] of self) {
  const n = byId.get(id); selfBy.set(name(n), (selfBy.get(name(n)) || 0) + cnt);
  const seen = new Set(); for (let k = id; k != null; k = parent.get(k)) { const nm = name(byId.get(k)); if (seen.has(nm)) continue; seen.add(nm); totalBy.set(nm, (totalBy.get(nm) || 0) + cnt); }
}
const pct = c => (c / total * 100).toFixed(1).padStart(5) + "%";
console.log(`${path.basename(f)}: ${total} samples`);
console.log("self time:"); for (const [k, c] of [...selfBy].sort((a, b) => b[1] - a[1]).slice(0, top)) console.log(`  ${pct(c)}  ${k}`);
console.log("total time:"); for (const [k, c] of [...totalBy].sort((a, b) => b[1] - a[1]).slice(0, top)) console.log(`  ${pct(c)}  ${k}`);
