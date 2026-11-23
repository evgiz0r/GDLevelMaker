// node tools/review.js <level> [--gates] [--render] [--no-fair] [--top N] [--json] [--no-html]
//
// LEVEL -> ISSUE REPORT (USE_CASES 4, EDITING.md "Review"): every check we have, run on one level, merged into ONE
// ranked list. Each issue: what, where (block, level time, a viewer link), the effect on the player (fairness >
// readability > flow > boredom > look), the effort to fix (look = decoration only / local = a small gameplay edit /
// redesign = a section rebuilt), a suggested fix, and whether tools/fix.js can apply it by itself ("auto").
//   <level>   as tools/edit.js: a .gdlvl, save:<name>, official:N, a community ID, a viewer #lv= link
// Checks (all on the level's saved route -- the human route, tools/solutions.js; solved once if it has none):
//   route       beaten? the presses, the route kind (human / limit)
//   soft rules  tools/rules.js (reactive, player timing, hazards matter, symmetry, deco coverage, jump marks,
//               attempt counter, clusters, height, repetition) + tools/softrules.js (arrows, stubs, flash) +
//               tools/indicators.js -- the list tools/edit.js re-runs after every edit
//   fairness    tools/fairness.js flags (switch, mark, floor, chain, wave, blind) -- ~1 min on a long level; --no-fair
//   skips       tools/skips.js: portals the route never touches (FAIL), orbs never used (WARN)
//   craft       tools/craft.js targets missed (one issue per target)
//   ending / length / mode changes   as score.js's gates, on the route
//   readability tools/readability.js's saved numbers (local/readability/<name>.json) when there are some;
//               --render measures them now (~8 min)
//   --gates     also every tools/score.js gate (solves the level again: 10 s to 15 min)
// Prints the list (most harmful, cheapest first), writes local/review/<slug>.json and a phone-friendly page
// local/review/<slug>.html (open it, or publish it as an artifact). Heavy (may solve, fairness): one-heavy-job slot.
if (require.main === module) require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
"use strict";
const fs = require("fs"), path = require("path"), cp = require("child_process");
const { GD, readGdlvl } = require("./io.js");
const E = require("./edit.js"), FAM = require("./families.js");
const ROOT = path.join(__dirname, ".."), OUT = path.join(ROOT, "local", "review");
const rel = f => path.relative(ROOT, f).replace(/\\/g, "/");
const slug = s => String(s || "level").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

// a .gdlvl to run the file-based checks on, with a saved route
function fileFor(L, sol) {
  if (L.file) return L.file;
  fs.mkdirSync(OUT, { recursive: true });
  const f = path.join(OUT, slug(L.name) + ".gdlvl"), A = E.writeCopy(f, L, L.level.objects);
  const S = require("./solutions.js");
  if (sol && sol.events && !S.get(A.levelStr, true)) S.put(A.levelStr, JSON.parse(JSON.stringify(sol)), A.level);
  return f;
}

function review(spec, o = {}) {
  const L = E.loadLevel(spec);
  let route = E.routeOf(L), solvedNow = false;
  if (!route) {   // no saved route: solve once (heavy) and keep it
    const S = require("./solutions.js"); S.solve(L.level, L.levelStr); route = E.routeOf(L); solvedNow = true;
  }
  const file = fileFor(L, route && route.sol), issues = [];
  const tAt = x => { if (!route) return null; const i = route.path.findIndex(p => p.x >= x); return i < 0 ? null : +(i / GD.PHYS.TPS).toFixed(2); };
  const add = (rule, severity, block, text, extra) => issues.push(Object.assign({ rule, severity, block: block == null ? null : +(+block).toFixed(1), text }, extra || {}));
  const meta = { level: L.name, src: L.src, file: rel(file), solvedNow };

  // route
  if (route) {
    meta.route = { beaten: route.beaten, presses: route.sol.events.filter(e => e.type === "press").length, kind: route.sol.kind || "?", seconds: +(route.path.length / GD.PHYS.TPS).toFixed(1) };
    if (!route.beaten) add("beatable", "FAIL", route.end.x / 30 - 0.5, `the route dies at block ${(route.end.x / 30).toFixed(1)}: not beaten in the sim`);
    if (route.sol.kind === "limit") add("route", "WARN", null, "no human route finishes: the shown route is the solver's raw one (" + (route.sol.why || "") + ")");
  }
  // soft rules (full: with the player-timing windows)
  for (const q of E.quickChecks(file, { fast: !!o.fast })) if (!q.info) add(q.rule, "WARN", q.block, q.text);
  // fairness
  if (!o.noFair && route && route.beaten) {
    try { const FA = require("./fairness.js"), w = GD.makeWorld(L.level.objects, L.level.header); w.name = L.name;
      for (const f of FA.flags(FA.analyse(w, Object.assign({ ok: true }, route.sol)))) add(f.family, f.severity, (f.x0 - 15) / 30, `${f.family}: ${f.note}`);
    } catch (e) { meta.fairError = e.message; }
  }
  // skips
  if (route) try {
    const s = require("./skips.js").skipsOf(L.level.objects, L.level.header, route.sol.events);
    for (const p of s.missedPortals.filter(p => !p.far && !p.noop && !p.lane && !p.moves)) add("skips", "FAIL", p.block, `the route never touches the ${p.name} at block ${p.block}: a way past it`);
    for (const b of s.missedOrbs.filter(p => !p.far && !p.moves)) add("skips", "WARN", b.block, `the ${b.name} at block ${b.block} is never used`);
  } catch (e) {}
  // craft
  try { const C = require("./craft.js").check(L.level.objects); for (const c of C.warn) add("craft", "WARN", null, `${c.key} ${typeof c.value === "number" ? +c.value.toFixed(2) : c.value} (want ${c.target}): ${c.doc || ""}`.trim()); } catch (e) {}
  // ending, length, mode changes (score.js's gates, on the route)
  if (route && route.beaten) {
    const p = route.path, ev = route.sol.events, last = ev.filter(e => e.type === "press").pop(), endX = Math.max(...L.level.objects.map(o => o.x));
    const tEnd = p.findIndex(q => q.x >= endX), secs = p.length / GD.PHYS.TPS;
    if (last) { const s = ((tEnd < 0 ? p.length : tEnd) - last.tick) / GD.PHYS.TPS; if (s > 2.5) add("ending", "WARN", (p[last.tick].x) / 30, `${s.toFixed(1)} s from the last input to the end (official median 0.8 s)`); }
    let ch = 0; for (let i = 1; i < p.length; i++) if (p[i].mode !== p[i - 1].mode) ch++;
    if (secs < 60) add("length", "WARN", null, `${secs.toFixed(0)} s long (official 78-95 s; want 60+)`);
    if (ch / (secs / 60) > 6) add("mode changes", "WARN", null, `${ch} mode changes, ${(ch / (secs / 60)).toFixed(1)} a minute (official 1.3-5.2)`);
  }
  // readability (rendered): the saved numbers, or --render now
  try {
    const rf = path.join(ROOT, "local", "readability", slug(L.name) + ".json");
    if (o.render) cp.spawnSync(process.execPath, [path.join(__dirname, "readability.js"), file], { windowsHide: true, stdio: "ignore", timeout: 3600000 });
    const cand = fs.existsSync(path.join(ROOT, "local", "readability")) ? fs.readdirSync(path.join(ROOT, "local", "readability")).filter(f => f.startsWith(slug(L.name).slice(0, 12))).map(f => path.join(ROOT, "local", "readability", f)) : [];
    const R = [rf, ...cand].filter(f => fs.existsSync(f)).map(f => ({ f, m: fs.statSync(f).mtimeMs })).sort((a, b) => b.m - a.m)[0];
    if (R) { const j = JSON.parse(fs.readFileSync(R.f, "utf8")); meta.readability = rel(R.f);
      for (const fr of (j.frames || []).filter(fr => fr.contrast != null && fr.contrast < 3)) add("readability", "WARN", fr.x != null ? fr.x / 30 : null, `hazard contrast ${(+fr.contrast).toFixed(2)} at ${fr.t} s (want 3+)`, { t: fr.t });
      if (j.fails && j.fails.length) add("readability", "WARN", null, "readability gate: " + j.fails.join("; ")); }
  } catch (e) {}
  // score.js gates (solves again)
  if (o.gates) {
    const r = cp.spawnSync(process.execPath, [path.join(__dirname, "score.js"), file, "--json"], { windowsHide: true, encoding: "utf8", timeout: 3600000 });
    try { const j = JSON.parse(r.stdout.trim().split("\n").pop()); meta.gates = j.ok ? "READY" : "NOT READY";
      for (const g of j.gates.filter(g => g.status !== "PASS")) if (!issues.some(i => i.rule === g.name)) for (const part of (g.note || g.value).split("; ")) add(g.name, g.status, FAM.blockIn(part), `${g.name}: ${part}`);
    } catch (e) { meta.gatesError = (r.stderr || "").slice(-300); }
  }
  // enrich, de-duplicate, rank
  const seen = new Set(), out = [];
  for (const i of issues) {
    const k = i.rule + "|" + i.block + "|" + i.text; if (seen.has(k)) continue; seen.add(k);
    const f = FAM.of(i.rule) || { id: i.rule, effect: "look", effort: "local", fix: "", auto: null };
    const x = i.block != null ? i.block * 30 + 15 : null, t = i.t != null ? i.t : x != null ? tAt(x) : null;
    out.push(Object.assign(i, { family: f.id, effect: f.effect, effort: f.effort, fix: f.fix, auto: !!(f.auto && f.auto(i)), t,
      link: t != null ? `http://localhost:8765/viewer/#lv=${encodeURIComponent("../" + rel(file))}&t=${t}` : null, score: FAM.rank(i) }));
  }
  out.sort((a, b) => b.score - a.score || (a.block ?? 1e9) - (b.block ?? 1e9));
  meta.counts = { issues: out.length, fail: out.filter(i => i.severity === "FAIL").length, byEffect: Object.fromEntries(Object.keys(FAM.EFFECT_RANK).map(k => [k, out.filter(i => i.effect === k).length])) };
  return { meta, issues: out };
}

function print(R, top) {
  const m = R.meta, list = top ? R.issues.slice(0, top) : R.issues;
  console.log(`== review: ${m.level}  (${m.route ? `${m.route.beaten ? "beaten" : "NOT beaten"}, ${m.route.seconds} s, ${m.route.presses} presses, ${m.route.kind} route` : "no route"})`);
  console.log(`   ${m.counts.issues} issues (${m.counts.fail} FAIL): ` + Object.entries(m.counts.byEffect).filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(", ") + (m.gates ? `; score.js ${m.gates}` : ""));
  list.forEach((i, n) => console.log(`${String(n + 1).padStart(3)}. ${i.severity.padEnd(4)} ${i.effect.padEnd(11)} ${i.effort.padEnd(8)} ${i.auto ? "auto" : "    "} ${i.block != null ? "block " + String(i.block).padEnd(6) : "level       "} ${i.t != null ? (i.t + " s").padEnd(8) : "        "} ${i.family}: ${i.text}`));
  if (top && R.issues.length > top) console.log(`   ... ${R.issues.length - top} more (--top 0 for all)`);
  console.log("   fix them: node tools/fix.js " + m.src + "   (the 'auto' ones by itself; the rest: tools/edit.js at the block)");
}

const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
function html(R) {
  const m = R.meta, col = { fairness: "#d64545", readability: "#d08a1f", flow: "#b5a320", boredom: "#4f86c6", look: "#7b6fc4" };
  const cards = R.issues.map((i, n) => `<li class="c"><div class="h"><span class="n">${n + 1}</span><span class="tag" style="background:${col[i.effect]}">${i.effect}</span><span class="tag e">${i.effort}</span>${i.severity === "FAIL" ? '<span class="tag f">FAIL</span>' : ""}${i.auto ? '<span class="tag a">auto-fix</span>' : ""}</div>
<p class="w"><b>${esc(i.family)}</b>${i.block != null ? ` · block ${i.block}` : " · whole level"}${i.t != null ? ` · ${i.t} s` : ""}</p><p>${esc(i.text)}</p>${i.fix ? `<p class="fx">Fix: ${esc(i.fix)}</p>` : ""}${i.link ? `<p class="l"><a href="${esc(i.link)}">open in the viewer</a></p>` : ""}</li>`).join("\n");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Review ${esc(m.level)}</title>
<style>:root{--bg:#fafafa;--fg:#1d1d1f;--card:#fff;--mut:#666;--bd:#e3e3e3}@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#141416;--fg:#ececec;--card:#1f1f23;--mut:#aaa;--bd:#333}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.45 system-ui,sans-serif}main{max-width:760px;margin:0 auto;padding:16px}h1{font-size:1.3em;margin:.2em 0}
.s{color:var(--mut)}ol{list-style:none;padding:0}.c{background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:10px 12px;margin:8px 0}.h{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.n{font-weight:700;min-width:1.6em}.tag{font-size:12px;color:#fff;border-radius:6px;padding:1px 7px}.tag.e{background:#777}.tag.f{background:#a00}.tag.a{background:#2f8f4e}.c p{margin:.3em 0}.w{font-size:14px}.fx{color:var(--mut)}a{color:#3b82f6}</style></head>
<body><main><h1>Review: ${esc(m.level)}</h1><p class="s">${m.route ? `${m.route.beaten ? "Beaten" : "NOT beaten"} in the sim · ${m.route.seconds} s · ${m.route.presses} presses` : "no route"} · ${m.counts.issues} issues, ${m.counts.fail} FAIL · ${new Date().toISOString().slice(0, 16).replace("T", " ")}</p>
<p class="s">Ranked: what hurts the player most first (fairness, readability, flow, boredom, look), the cheapest fix first among equals. "auto-fix" = tools/fix.js applies it by itself.</p><ol>${cards}</ol></main></body></html>`;
}

module.exports = { review, print, html };

if (require.main === module) {
  const a = process.argv.slice(2), opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  const spec = a.find((x, i) => !x.startsWith("--") && a[i - 1] !== "--top");
  if (!spec) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }
  const R = review(spec, { gates: a.includes("--gates"), render: a.includes("--render"), noFair: a.includes("--no-fair"), fast: a.includes("--fast") });
  fs.mkdirSync(OUT, { recursive: true });
  const base = path.join(OUT, slug(R.meta.level));
  fs.writeFileSync(base + ".json", JSON.stringify(R, null, 1));
  if (!a.includes("--no-html")) { fs.writeFileSync(base + ".html", html(R)); R.meta.html = rel(base + ".html"); }
  if (a.includes("--json")) console.log(JSON.stringify(R, null, 1));
  else { print(R, opt("--top") != null ? +opt("--top") : 25); console.log(`   written: ${rel(base + ".json")}${R.meta.html ? ", " + R.meta.html : ""}`); }
}
