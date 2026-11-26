// node tools/modeshare.js [official:N | all | <level.gdlvl>] ... [--json]   -- share of play TIME in each game mode, and
//   upside down (reversed gravity) and mirrored (reversed direction), from the level's saved route (no solve, no heavy lock).
//   Default: the 22 main levels (local/official_NN.json) and the levels in levels/ that have a saved route.
//   Evgeni, 2026-11-26: "can you show the % of gameplay modes and reverse". Time = route ticks (240 a second) until the end
//   or the route's last tick; past a route that stops early (stale after a physics change) or with none, the rest comes from
//   the layout's portals (speed-weighted; gravity flips by orbs / pads not seen there). Mirror from the portals 45 / 46.
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), io = require("./io.js"), GD = io.GD;
const MODES = ["cube", "ship", "ball", "ufo", "wave", "robot", "spider", "swing"];

function load(w) {
  let m;
  if ((m = /^official:(\d+)$/.exec(w))) { const j = JSON.parse(fs.readFileSync(path.join(ROOT, "local", `official_${String(+m[1]).padStart(2, "0")}.json`), "utf8"));
    return { name: j.name, levelStr: j.level, sol: j.solution }; }
  const L = io.readGdlvl(w); let sol = null; try { sol = require("./solutions.js").get(L.levelStr, true); } catch (e) {}
  return { name: L.name, levelStr: L.levelStr, sol };
}
// the rest of a level the route does not reach (a stale route, or none): the layout's portals along x from where it stopped,
// time = distance / the speed there; gravity flips from orbs and pads are not seen there (portals only)
function layoutTicks(level, from, n) {
  const P = GD.PHYS || GD, SP = P.SPEEDS || GD.SPEEDS, O = require("../lib/objects.js");
  const ev = []; let endX = 0;
  for (const o of level.objects) { if (o.x > endX) endX = o.x; const d = O.objInfo(o.id) || {};
    if (d.kind === "mode" || d.kind === "gravity" || d.kind === "speed" || o.id === 45 || o.id === 46) ev.push({ x: o.x, d, id: o.id }); }
  ev.sort((a, b) => a.x - b.x);
  let st = { mode: from.mode, grav: from.grav, sp: from.sp, mir: from.mir }, x = from.x;
  const add = x1 => { if (x1 <= x) return; const v = (SP[st.sp] || SP[1]).x * 60 / 240, t = (x1 - x) / v; n.total += t; n[st.mode] = (n[st.mode] || 0) + t;
    if (st.grav < 0) n.up += t; if (st.mir) n.mirror += t; n.layout += t; x = x1; };
  for (const e of ev) { if (e.x <= x) continue; add(e.x);
    if (e.d.kind === "mode") st.mode = e.d.mode; else if (e.d.kind === "speed") st.sp = e.d.speed;
    else if (e.d.kind === "gravity") st.grav = e.d.grav === 0 ? -st.grav : e.d.grav; else st.mir = e.id === 45; }
  add(endX);
}
function share(w) {
  const lv = load(w), level = GD.parseLevel(lv.levelStr), world = GD.makeWorld(level.objects, level.header);
  const mir = level.objects.filter(o => o.id === 45 || o.id === 46).map(o => ({ x: o.x, on: o.id === 45 })).sort((a, b) => a.x - b.x);
  const mirAt = x => { let on = false; for (const p of mir) { if (p.x > x) break; on = p.on; } return on; };
  const n = { total: 0, up: 0, mirror: 0, layout: 0 }; for (const k of MODES) n[k] = 0;
  let r = null;
  if (lv.sol && lv.sol.events) { r = GD.run(world, lv.sol.events);
    for (const s of r.path) { n.total++; n[s.mode] = (n[s.mode] || 0) + 1; if (s.grav < 0) n.up++; if (mirAt(s.x)) n.mirror++; } }
  if (!r || !r.done) { const e = r ? r.path[r.path.length - 1] : null; const hk = k => { const m = new RegExp("(?:^|,)" + k + ",([^,;]*)").exec(String(lv.levelStr).split(";")[0]); return m ? +m[1] : 0; };
    const s0 = e || { x: 0, mode: MODES[hk("kA2")] || "cube", grav: hk("kA11") ? -1 : 1, sp: [1, 0, 2, 3, 4][hk("kA4")] ?? 1 };
    layoutTicks(level, { x: s0.x || 0, mode: s0.mode || "cube", grav: s0.grav || 1, sp: s0.sp == null ? 0 : s0.sp, mir: mirAt(s0.x || 0) }, n); }
  const pct = k => Math.round(1000 * n[k] / n.total) / 10;
  const out = { name: lv.name, seconds: +(n.total / 240).toFixed(1), fromLayout: pct("layout") };
  for (const k of MODES) out[k] = pct(k); out.upsideDown = pct("up"); out.mirrored = pct("mirror");
  return out;
}

if (require.main === module) {
  const a = process.argv.slice(2), json = a.includes("--json");
  let what = a.filter(x => !x.startsWith("--"));
  if (!what.length || what.includes("all")) {
    what = what.filter(x => x !== "all");
    for (let i = 1; i <= 22; i++) if (fs.existsSync(path.join(ROOT, "local", `official_${String(i).padStart(2, "0")}.json`))) what.push("official:" + i);
    for (const f of fs.readdirSync(path.join(ROOT, "levels")).filter(f => f.endsWith(".gdlvl"))) what.push(path.join("levels", f));
  }
  const rows = what.map(w => { try { return share(w); } catch (e) { return { name: w, err: e.message }; } });
  if (json) { console.log(JSON.stringify(rows, null, 1)); process.exit(0); }
  const cols = MODES.filter(k => rows.some(r => r[k] > 0));
  console.log(["level".padEnd(26), "sec".padStart(5), ...cols.map(c => c.padStart(6)), "upside".padStart(7), "mirror".padStart(7)].join(" "));
  for (const r of rows) {
    if (r.err) { console.log(String(r.name).slice(0, 26).padEnd(26), " ", r.err); continue; }
    console.log([String(r.name).slice(0, 26).padEnd(26), String(r.seconds).padStart(5), ...cols.map(c => (r[c] ? r[c].toFixed(0) + "%" : "-").padStart(6)),
      (r.upsideDown ? r.upsideDown.toFixed(0) + "%" : "-").padStart(7), (r.mirrored ? r.mirrored.toFixed(0) + "%" : "-").padStart(7)].join(" ") + (r.fromLayout ? `  (${r.fromLayout.toFixed(0)}% from the layout)` : ""));
  }
  const mains = rows.filter((r, i) => !r.err && /^official:/.test(what[i]));
  if (mains.length) { const avg = k => (mains.reduce((s, r) => s + r[k], 0) / mains.length).toFixed(0) + "%";
    console.log(["main levels, mean".padEnd(26), "".padStart(5), ...cols.map(c => avg(c).padStart(6)), avg("upsideDown").padStart(7), avg("mirrored").padStart(7)].join(" ")); }
}
module.exports = { share };
