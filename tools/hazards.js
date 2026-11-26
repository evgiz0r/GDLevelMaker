// node tools/hazards.js level <official:N | c<id> | <id> | level.gdlvl> [--json]   -- one level's hazards against the reference
// node tools/hazards.js study [--write] [--only official|community|gdlm]             -- every level we have, by group and tier
// node tools/hazards.js ref                                                          -- print knowledge/hazards_ref.json
//
// How rated levels place and dress their spikes, saws and pit spikes (HAZARDS.md has the findings and the rules; the work is
// lib/hazards.js). With the player's path (a route that clears) every hazard gets a role: threat (the path passes within a
// block: what a press is for), guard (1-3 blocks: frames the lane, shuts a secret way), fill (further: pit floors, scenery).
// Paths: official:N -> the human route in knowledge/mains/routes.json, else local/difficulty/NN.json (the solver's), on
// today's sim; a route that dies counts only the hazards up to where it died ("cut at x%"). c<id> -> local/community/<id>.gdlvl
// with local/difficulty/c<id>.json. A .gdlvl -> its saved solution (viewer/levels.js, local/solutions/), none for an auto level.
// study --write writes knowledge/hazards_ref.json: numbers only (medians per group and tier), no level data.
// Takes ~1 s a level (a replay + the measures); `study` over ~120 levels: ~2 min (cloud, 2026-11-26).
if (require.main === module) require("./heavy.js").claim();
const fs = require("fs"), path = require("path");
const { GD, readGdlvl } = require("./io.js");
Object.assign(GD, require("../lib/hazards.js"));
const ROOT = path.join(__dirname, ".."), LOCAL = path.join(ROOT, "local");
const REF = path.join(ROOT, "knowledge", "hazards_ref.json");
const readJ = f => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return null; } };
const args = process.argv.slice(2), has = k => args.includes(k), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };

function runPath(L, events, G) {
  G = G || GD; const wxy = s => G.worldXY ? G.worldXY(s) : [s.x, s.y];
  const w = G.makeWorld(L.objects, L.header), q = G.run(w, events || []), e = q.path[q.path.length - 1];
  const x = wxy(e)[0], done = !!(q.done || (!q.dead && x >= w.endX));
  return { path: q.path.map(s => ({ ...s, wx: wxy(s) })), done, pct: +Math.min(100, x / w.endX * 100).toFixed(1), endX: w.endX };
}
// the sim as it was at a physics commit (a git worktree in local/tmp/wt/), for routes solved before a physics change:
// the path a route takes is what is measured here, and the route clears on the physics it was solved on
const atCache = {};
function gdAt(commit) {
  if (!commit || has("--no-old-physics")) return null;
  if (atCache[commit] !== undefined) return atCache[commit];
  const dir = path.join(LOCAL, "tmp", "wt", commit);
  try {
    if (!fs.existsSync(path.join(dir, "tools", "io.js")))
      require("child_process").execFileSync("git", ["worktree", "add", "-q", "--detach", dir, commit], { cwd: ROOT, stdio: "ignore", windowsHide: true });
    return atCache[commit] = require(path.join(dir, "tools", "io.js")).GD;
  } catch (e) { return atCache[commit] = null; }
}
// the source whose route goes furthest: today's sim first, then the physics the route was solved on
function bestPath(L, sources) {
  let best = null;
  for (const [name, ev, commit] of sources) { if (!ev || !ev.length) continue;
    let r = runPath(L, ev); r.src = name; r.events = ev;
    if (!r.done && commit) { const G = gdAt(commit); if (G) { const r2 = runPath(L, ev, G); r2.src = name + " (physics " + commit + ")"; r2.events = ev; if (r2.pct > r.pct) r = r2; } }
    if (!best || r.pct > best.pct) best = r; if (best.done) break; }
  return best;
}
function load(spec) {
  if (/^official:\d+$/.test(spec)) {
    const n = +spec.split(":")[1], L = require("./corpus.js").official(n);
    const rt = (readJ(path.join(ROOT, "knowledge", "mains", "routes.json")) || { levels: [] }).levels.find(l => l.n === n);
    const sol = readJ(path.join(LOCAL, "difficulty", String(n).padStart(2, "0") + ".json"));
    return { name: L.short, group: "official", tier: null, n, objects: L.objects, run: bestPath(L, [["human route", rt && rt.events, rt && rt.physics], ["solver", sol && sol.events, sol && sol.physics]]), L };
  }
  const cm = /^c?(\d+)$/.exec(spec);
  if (cm) {
    const id = cm[1], f = path.join(LOCAL, "community", id + ".gdlvl"); if (!fs.existsSync(f)) throw new Error("no " + f);
    const r = readGdlvl(f), meta = ((readJ(path.join(LOCAL, "community", "list.json")) || []).find(x => x.id === id)) || {};
    const sol = readJ(path.join(LOCAL, "difficulty", "c" + id + ".json"));
    return { name: meta.name || r.name, group: "community", tier: meta.tier || null, rating: meta.rating, era: meta.era, id,
      objects: r.level.objects, run: sol && sol.events ? bestPath(r.level, [["solver", sol.events, sol.physics]]) : null, L: r.level };
  }
  const r = readGdlvl(spec);
  let ev = null;
  try { global.window = global.window || {}; require(path.join(ROOT, "viewer", "levels.js"));
    const v = (global.window.GD_LEVELS || []).find(l => l.file && path.resolve(ROOT, l.file) === path.resolve(spec)); if (v && v.solution) ev = v.solution.events; } catch (e) {}
  if (!ev) try { const s = require("./solutions.js").get(r.levelStr); if (s && s.events) ev = s.events; } catch (e) {}
  const run = bestPath(r.level, [["saved solution", ev]]) || runPath(r.level, []);
  if (!run.src) { run.src = "no presses"; run.events = []; }
  return { name: r.name, group: "gdlm", tier: null, file: spec, objects: r.level.objects, run, L: r.level };
}

function measure(lv) {
  const run = lv.run;
  // a route that died: only the part it played (hazards past its end have no path to be measured against)
  let objs = lv.objects;
  if (run && !run.done) { const xEnd = run.endX * run.pct / 100; objs = objs.filter(o => o.x <= xEnd + 60); }
  const st = GD.hazardStats(objs, run ? run.path : null);
  // what dresses the hazards: deco ids sitting on them, most used first
  const dc = {}; for (const r of GD.hazardRecords(objs, null)) for (const id of r.dressIds || []) dc[id] = (dc[id] || 0) + 1;
  st.dressIds = Object.entries(dc).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, c]) => [+id, c]);
  st.path = run ? (run.done ? run.src : `${run.src}, cut at ${run.pct}%`) : "none";
  return st;
}

// the measures HAZARDS.md compares, flattened (dotted keys), and which way each is "ours vs rated"
const KEYS = ["per100", "kinds", "shapes.spike", "shapes.pit", "shapes.saw", "shapes.smallspike", "support.ground", "support.top", "support.under",
  "support.side", "support.stack", "support.float", "hanging", "rotated", "scaled", "dressed", "ownChannel", "runs1", "runs4",
  "role.threat", "role.guard", "role.fill", "guardAbove", "guardBelow", "perObstacle", "obsGap.p50", "threatGapMed",
  "nearPerSec", "arcs.withHazard", "arcs.underPerJump", "arcs.abovePerJump", "arcs.where.0", "arcs.where.2", "arcs.where.4", "lane.ground.belowHaz", "lane.ground.aboveHaz", "lane.ground.aboveOpen", "lane.fly.belowHaz", "lane.fly.aboveHaz", "lane.fly.open"];
function flat(st) {
  const g = (o, k) => k.split(".").reduce((a, b) => a == null ? a : a[b], o);
  const out = {};
  const rt = st.runs ? Object.values(st.runs).reduce((a, b) => a + b, 0) : 0;
  for (const k of KEYS) {
    if (k === "runs1") out[k] = rt ? +(100 * st.runs[1] / rt).toFixed(1) : null;
    else if (k === "runs4") out[k] = rt ? +(100 * st.runs["4+"] / rt).toFixed(1) : null;
    else if (k.startsWith("lane.")) {
      const [, grp, what] = k.split("."), L = st.lane && st.lane[grp]; if (!L || L.n < 20) { out[k] = null; continue; }
      const p = v => +(100 * v / L.n).toFixed(1);
      out[k] = what === "belowHaz" ? p(L.below.haz) : what === "aboveHaz" ? p(L.above.haz) : what === "aboveOpen" ? p(L.above.open)
        : p(L.above.open + L.below.open) / 2;
    } else { const v = g(st, k); out[k] = v == null ? (k.startsWith("shapes.") || k.startsWith("support.") ? 0 : null) : v; }
  }
  return out;
}
const median = a => { const b = a.filter(v => v != null && Number.isFinite(v)).sort((x, y) => x - y); if (!b.length) return null;
  const m = b.length >> 1; return +(b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2).toFixed(1); };
const quant = (a, q) => { const b = a.filter(v => v != null && Number.isFinite(v)).sort((x, y) => x - y); return b.length ? +b[Math.min(b.length - 1, Math.floor(q * b.length))].toFixed(1) : null; };

function groups(rows) {
  const out = {};
  const add = (g, r) => (out[g] = out[g] || []).push(r);
  for (const r of rows) {
    add(r.group, r);
    if (r.group === "official") add(r.n <= 8 ? "official 1-8" : r.n <= 14 ? "official 9-14" : "official 15-21", r);
    if (r.group === "community" && r.tier) add("rated " + (/(Easy|Normal)/.test(r.tier) ? "Easy-Normal" : /(Hard|Harder)/.test(r.tier) ? "Hard-Harder" : "Insane+"), r);
    if (r.group === "community" && r.era) add("rated " + r.era, r);
  }
  const agg = {};
  for (const [g, rs] of Object.entries(out)) {
    agg[g] = { n: rs.length, withPath: rs.filter(r => r.f["role.threat"] != null).length, median: {}, p25: {}, p75: {} };
    for (const k of KEYS) { const v = rs.map(r => r.f[k]); agg[g].median[k] = median(v); agg[g].p25[k] = quant(v, 0.25); agg[g].p75[k] = quant(v, 0.75); }
  }
  return agg;
}

function listAll(only) {
  const specs = [];
  if (!only || only === "official") for (let n = 1; n <= 22; n++) specs.push("official:" + n);
  if (!only || only === "community") {
    const seen = new Set();
    for (const x of readJ(path.join(LOCAL, "community", "list.json")) || []) { seen.add(x.id); specs.push("c" + x.id); }
    // community levels with a solved route (the difficulty session's), rated or not
    try { for (const f of fs.readdirSync(path.join(LOCAL, "difficulty"))) { const m = /^c(\d+)\.json$/.exec(f);
      if (m && !seen.has(m[1]) && fs.existsSync(path.join(LOCAL, "community", m[1] + ".gdlvl"))) specs.push("c" + m[1]); } } catch (e) {}
  }
  if (!only || only === "gdlm") for (const d of ["levels", "levels/lab"]) {
    try { for (const f of fs.readdirSync(path.join(ROOT, d))) if (f.endsWith(".gdlvl")) specs.push(path.join(d, f)); } catch (e) {} }
  return specs;
}

function study() {
  const rows = [];
  for (const spec of listAll(opt("--only"))) {
    let lv; try { lv = load(spec); } catch (e) { console.error("skip " + spec + ": " + e.message); continue; }
    const st = measure(lv), f = flat(st);
    rows.push({ spec, name: lv.name, group: lv.group, tier: lv.tier, era: lv.era, n: lv.n, path: st.path, f, dressIds: st.dressIds });
    console.log([spec.padEnd(28), String(lv.name).slice(0, 22).padEnd(22), (lv.tier || "").padEnd(7), "haz/100", f.per100, "threat", f["role.threat"],
      "guard", f["role.guard"], "fill", f["role.fill"], "dressed", f.dressed, "|", st.path].join(" "));
  }
  const agg = groups(rows);
  console.log("\nmedians by group:");
  const show = ["per100", "nearPerSec", "arcs.withHazard", "arcs.underPerJump", "arcs.where.0", "arcs.where.2", "arcs.where.4", "role.threat", "role.guard", "role.fill", "guardAbove", "guardBelow", "support.top", "support.under", "support.stack", "hanging", "rotated", "dressed", "runs1", "runs4", "perObstacle", "obsGap.p50", "lane.ground.belowHaz", "lane.ground.aboveHaz", "lane.fly.aboveHaz", "lane.fly.belowHaz"];
  console.log("group".padEnd(22) + "n   " + show.map(k => k.replace(/^lane\./, "").slice(0, 11).padStart(12)).join(""));
  for (const [g, a] of Object.entries(agg)) if (a.median) console.log(g.padEnd(22) + String(a.n).padEnd(4) + show.map(k => String(a.median[k] == null ? "-" : a.median[k]).padStart(12)).join(""));
  // dressing: which deco ids sit on hazards, counted by how many levels use each (official and community)
  const byLv = {};
  for (const r of rows) if (r.group !== "gdlm") for (const [id] of r.dressIds || []) byLv[id] = (byLv[id] || 0) + 1;
  const dressTop = Object.entries(byLv).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([id, n]) => ({ id: +id, levels: n }));
  console.log("\ndeco on hazards (levels using it): " + dressTop.map(d => d.id + "x" + d.levels).join(" "));
  agg.dressTop = dressTop;
  if (has("--write")) {
    const out = { note: "Hazard measures (lib/hazards.js, tools/hazards.js study): medians and quartiles per group of levels. Numbers only, no level data. HAZARDS.md explains each.",
      made: new Date().toISOString(), keys: KEYS, groups: agg };
    fs.writeFileSync(REF, JSON.stringify(out, null, 1) + "\n");
    console.log("\nwrote " + path.relative(ROOT, REF));
  }
}

// one level against the reference: the measures outside the rated band (p25..p75 of official + rated), as notes
function compare(f, ref) {
  const notes = [];
  const pool = ref && (ref.groups["official"] || ref.groups["community"]);
  if (!pool) return notes;
  const lo = k => Math.min(...["official", "community"].map(g => ref.groups[g] && ref.groups[g].p25[k]).filter(v => v != null));
  const hi = k => Math.max(...["official", "community"].map(g => ref.groups[g] && ref.groups[g].p75[k]).filter(v => v != null));
  for (const k of KEYS) { const v = f[k]; if (v == null) continue; const a = lo(k), b = hi(k); if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    if (v < a) notes.push({ k, v, lo: a, hi: b, dir: "low" }); else if (v > b) notes.push({ k, v, lo: a, hi: b, dir: "high" }); }
  return notes;
}

function level(spec) {
  const lv = load(spec), st = measure(lv), f = flat(st), ref = readJ(REF), notes = compare(f, ref);
  if (has("--json")) { console.log(JSON.stringify({ name: lv.name, path: st.path, stats: st, flat: f, notes }, null, 1)); return; }
  console.log(`${lv.name}: ${st.hazards} hazards, ${st.per100} per 100 blocks, ${st.kinds} kinds; path: ${st.path}`);
  console.log("shapes " + JSON.stringify(st.shapes) + "  held by " + JSON.stringify(st.support));
  console.log(`runs ${JSON.stringify(st.runs)}  hanging ${st.hanging}%  side-turned ${st.rotated}%  scaled ${st.scaled}%  dressed ${st.dressed}%`);
  if (st.role) console.log(`roles: threat ${st.role.threat}%  guard ${st.role.guard}% (above ${st.guardAbove} / below ${st.guardBelow})  fill ${st.role.fill}%;  ${st.obstacles} obstacles, ${st.perObstacle} threats each, gap p50 ${st.obsGap.p50} s`);
  if (st.lane) for (const g of ["ground", "fly"]) { const L = st.lane[g]; if (L.n) console.log(`lane (${g}, ${L.n} blocks): above ${JSON.stringify(L.above)}  below ${JSON.stringify(L.below)}`); }
  if (!ref) { console.log("(no knowledge/hazards_ref.json yet: node tools/hazards.js study --write)"); return; }
  console.log(notes.length ? "outside the rated band (official + rated p25-p75):" : "inside the rated band on every measure");
  for (const n of notes) console.log(`  ${n.k}: ${n.v} (rated ${n.lo}-${n.hi}) ${n.dir}`);
}

// score.js gate "hazards": the role mix around the level's own route against the rated band (HAZARDS.md "Rules").
// Soft (WARN): a level may break it with a reason in its brief (accept.hazards).
const BAND = { fillMax: 60, threatMin: 8, threatMax: 40, guardMin: 25, arcsMin: 50, nearMin: 2 };
function check(level, events) {
  const run = runPath(level, events || []);
  const st = GD.hazardStats(level.objects, run.path), f = flat(st), flags = [];
  if (!st.hazards) return { flags: ["no hazards at all"], summary: "no hazards", f };
  if (f["role.fill"] > BAND.fillMax) flags.push(`${f["role.fill"]}% of hazards are 3+ blocks off the path (rated 19-58%): they do not follow it`);
  if (f["role.threat"] < BAND.threatMin) flags.push(`only ${f["role.threat"]}% of hazards within a block of the path (rated 11-31%)`);
  if (f["role.threat"] > BAND.threatMax) flags.push(`${f["role.threat"]}% of hazards within a block of the path (rated 11-31%): no frame, all threat`);
  if (f["role.guard"] < BAND.guardMin) flags.push(`only ${f["role.guard"]}% guards 1-3 blocks off the path (rated 31-57%): the lane has no frame, secret ways stay open`);
  if (f["arcs.withHazard"] != null && st.arcs.jumps >= 5 && f["arcs.withHazard"] < BAND.arcsMin) flags.push(`${f["arcs.withHazard"]}% of jumps have a hazard under them (rated 50-88%)`);
  if (f.nearPerSec < BAND.nearMin) flags.push(`${f.nearPerSec} hazards near the path per second (official 3.9-10.9)`);
  const summary = `threat ${f["role.threat"]}% / guard ${f["role.guard"]}% / fill ${f["role.fill"]}% (official 17 / 45 / 38); jumps with a hazard under ${f["arcs.withHazard"]}%; ${f.nearPerSec} near the path a second`;
  return { flags, summary, f };
}

module.exports = { load, measure, flat, compare, check, BAND, KEYS, REF };
if (require.main === module) {
  const cmd = args[0];
  if (cmd === "study") study();
  else if (cmd === "level" && args[1]) level(args[1]);
  else if (cmd === "ref") console.log(fs.readFileSync(REF, "utf8"));
  else console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).slice(0, 3).join("\n"));
}
