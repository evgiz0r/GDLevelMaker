// node tools/rules.js [levels/*.gdlvl | all] [--fast] [--json]
//
// Every soft rule from the user's notes, swept over levels at once, counted per rule (the user,
// 2026-11-23: "each fix to be somewhat a soft rule. and reapplied across the level and anything in the
// future"). Uses each level's SAVED route (tools/solutions.js: the player's natural replay); no solving,
// so a level without a saved solution gets only the rules that need no route. `all` = every
// levels/gdlm_*.gdlvl. --fast skips the per-jump window scan (player timing, a jump cut by a block).
// The same checks are score.js gates (one per rule); a brief may accept one with a reason
// ("accept": {"<gate>": "why"}). Families, their notes and checklist lines: knowledge/checklist.md.
//   reactive        exact-hop chains, a lone landing block, a spike then a step 2-5 blocks after it,
//                   a jump over a spike that must be timed around a block (+ player timing windows)
//   hazards matter  hazards walked over without a jump
//   symmetry        an orb off the centre of its spike row
//   deco coverage   screen-wide stretches under half the level's deco per block
//   jump marks      a mark over a hazard, two marks under 2 blocks apart
//   attempt counter text under GD's "Attempt N" at the start
//   height          floor changes, range, flat stretches, bare floor (tools/flow.js)
//   repetition      4-move patterns repeated within 10 s
//   clusters        overlapping / ragged spike groups, a hazard right before a pad (polish's tools/clusters.js)
const fs = require("fs"), path = require("path");
const { GD, readGdlvl } = require("./io.js");
const S = require("./score.js"), F = require("./flow.js"), deco = require("./decorate.js");
const ROOT = path.join(__dirname, "..");

function rulesOf(file, opts = {}) {
  const L = readGdlvl(file), out = { name: L.name, file: path.relative(ROOT, file).replace(/\\/g, "/"), rules: {} };
  const add = (rule, items) => { out.rules[rule] = items; };
  for (const g of S.staticRules(L.level)) add(g.name, g.status === "PASS" ? [] : (g.note ? g.note.split("; ") : [g.value]));
  const Z = deco.ATTEMPT_ZONE, att = [];
  for (const o of L.level.objects.filter(o => o.id === 914)) {
    const t = Buffer.from(String((o.props || {})[31] || ""), "base64").toString(), half = deco.textHalfWidth(t, +((o.props || {})[32] || 1));
    if (o.x - half < Z.x1 && o.x + half > Z.x0 && o.y > Z.y0 - 20 && o.y < Z.y1 + 20) att.push(`"${t}" at block ${((o.x - 15) / 30).toFixed(0)}`);
  }
  add("attempt counter", att);
  add("clusters", require("./clusters.js").check(L.level.objects).map(s => `block ${(s.x / 30 - 0.5).toFixed(1)} ${s.kind}: ${s.note}`));
  const sol = require("./solutions.js").get(L.levelStr);
  if (!sol || !sol.events) { out.note = "no saved solution: route rules not run (node tools/solutions.js " + out.file + ")"; return out; }
  const w = GD.makeWorld(L.level.objects, L.level.header), r = { ok: true, events: sol.events };
  const presses = sol.events.filter(e => e.type === "press").map(e => ({ tick: e.tick }));
  const re = S.reactiveSpots(L.level, w, r, presses, { natural: true, noWindows: !!opts.fast });
  add("reactive", re.map(s => `block ${s.block}: ${s.why}`));
  if (!opts.fast) {   // lib/windows.js's player windows (the viewer's number), every input of the route
    const WI = require("../lib/windows.js"), p = GD.run(w, sol.events).path;
    const ws = WI.inputWindows(w, sol.events, p, {}).map(x => ({ x: (p[x.tick] || {}).x || 0, t: x.tick / GD.PHYS.TPS, type: x.type, ms: Math.round((x.hi - x.lo + 1) / GD.PHYS.TPS * 1000) }));
    add("player timing", ws.filter(x => x.ms < (opts.minMs || 60)).map(x => `block ${(x.x / 30).toFixed(1)} (${x.t.toFixed(2)} s) ${x.type} ${x.ms} ms`));
  }
  add("hazards matter", S.inertHazards(L.level, w, r).map(s => `blocks ${s.a}-${s.b}: ${s.why}`));
  const m = F.measure(L.level, sol.events), h = [];
  if (m.jumpS >= 10) {
    if (m.changesPer10s < 10) h.push(`${m.changesPer10s} floor changes per 10 s (want 10+)`);
    if (m.range != null && m.range < 3) h.push(`range ${m.range} blocks (want 3+)`);
    if (m.flat10 > 0) h.push(`${Math.round(m.flat10 * 100)}% of 10 s windows flat`);
    if (m.ground > 0.45) h.push(`${Math.round(m.ground * 100)}% on the bare floor (want 45% or less)`);
  }
  add("height", h);
  add("repetition", m.jumpS >= 10 && m.repeat > 0.05 ? [`${Math.round(m.repeat * 100)}% of 4-move patterns repeat within 10 s`] : []);
  out.flow = m;
  return out;
}
module.exports = { rulesOf };

if (require.main === module) {
  const args = process.argv.slice(2), fast = args.includes("--fast");
  let files = args.filter(a => a.endsWith(".gdlvl"));
  if (args.includes("all")) files = fs.readdirSync(path.join(ROOT, "levels")).filter(f => /^gdlm_\d+/.test(f)).map(f => path.join(ROOT, "levels", f));
  if (!files.length) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }
  const res = files.map(f => rulesOf(f, { fast }));
  if (args.includes("--json")) { console.log(JSON.stringify(res, null, 1)); process.exit(0); }
  const totals = {};
  for (const r of res) {
    console.log(`\n== ${r.name}${r.note ? "  (" + r.note + ")" : ""}`);
    for (const [k, v] of Object.entries(r.rules)) { totals[k] = (totals[k] || 0) + v.length; if (v.length) console.log(`   ${k.padEnd(16)} ${v.length}: ${v.slice(0, 6).join("; ")}${v.length > 6 ? " ..." : ""}`); }
  }
  console.log("\n== spots per rule, all levels: " + Object.entries(totals).map(([k, v]) => `${k} ${v}`).join(", "));
}
