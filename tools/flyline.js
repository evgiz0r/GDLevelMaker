// node tools/flyline.js <level.gdlvl | official:N | c<id>> [--events file.json] [--replan] [--from BLOCK --to BLOCK]
// How a route flies its ship / UFO / wave / swing stretches, as a player would judge it (the user on Stereo
// Madness's ship: "it's unnatural to wait so late and fly up ... just flying somewhat straight through the
// paths ... It just creates a fake timing which is unneeded in an easy section"). Per stretch:
//   clearance  distance from the player's box to the nearest wall/hazard above or below (median, 10th pct)
//   close      share of ticks riding a surface or within 12 units of one
//   jerk       altitude jerk: mean |change of vertical speed| per frame (late, sharp climbs score high)
//   presses    presses in the stretch
// The route: the saved one (tools/solutions.js; official: local/difficulty/NN.json); --replan also prints the
// natural plan made now (lib/natural.js, with humanCost), so a change to the plan shows before/after.
const fs = require("fs"), path = require("path");
const { GD, readGdlvl, unpack } = require("./io.js");
Object.assign(GD, require("../lib/difficulty.js"), require("../lib/natural.js"));
const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf("--" + k); return i < 0 ? d : a[i + 1]; };
const lv = a[0];
if (!lv) { console.log(fs.readFileSync(__filename, "utf8").split("\n").slice(0, 2).join("\n")); process.exit(1); }
let L, ev = null;
if (lv.startsWith("official:")) {
  const n = +lv.slice(9), src = require("./gdpaths.js").LEVELS;
  const levelStr = unpack(fs.readFileSync(src + n + ".txt", "utf8")); L = { levelStr, level: GD.parseLevel(levelStr) };
  try { ev = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "local", `official_${String(n).padStart(2, "0")}.json`), "utf8")).solution.events; } catch (e) {}
  if (!ev) try { ev = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "local", "difficulty", String(n).padStart(2, "0") + ".json"), "utf8")).events; } catch (e) {}
} else if (/^c\d+$/.test(lv)) { L = readGdlvl(path.join(__dirname, "..", "local", "community", lv.slice(1) + ".gdlvl"));
  try { ev = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "local", "difficulty", lv + ".json"), "utf8")).events; } catch (e) {}
} else { L = readGdlvl(lv); const s = require("./solutions.js").get(L.levelStr, true); if (s) ev = s.events; }
if (opt("events")) ev = JSON.parse(fs.readFileSync(opt("events"), "utf8")).events;
if (!ev) { console.log("no saved route"); process.exit(1); }
const w = GD.makeWorld(L.level.objects, L.level.header);
const boxes = L.level.objects.map(o => ({ d: GD.objInfo(o.id), hb: GD.hitbox(o) }))
  .filter(b => b.hb && (b.d.kind === "solid" || b.d.kind === "hazard" || b.d.kind === "slope")).map(b => b.hb);
const FLY = { ship: 1, ufo: 1, wave: 1, swing: 1 };
const B0 = +opt("from", -1e9) * 30, B1 = +opt("to", 1e9) * 30;
function clear(s) {
  let lo = isFinite(s.floorY) ? s.floorY : 0, hi = isFinite(s.ceilY) ? s.ceilY : Infinity;
  for (const b of boxes) { if (b.x1 < s.x - 15 || b.x0 > s.x + 15) continue; if (b.y1 <= s.y && b.y1 > lo) lo = b.y1; else if (b.y0 >= s.y && b.y0 < hi) hi = b.y0; }
  const h = s.mini ? 9 : 15; return Math.min(s.y - h - lo, hi - s.y - h);
}
function report(name, events) {
  const p = GD.run(w, events).path, rows = [];
  for (let t = 0; t < p.length; t++) {
    if (!FLY[p[t].mode] || p[t].x < B0 || p[t].x > B1) continue;
    const a0 = t, mode = p[t].mode; while (t < p.length && p[t].mode === mode && p[t].x <= B1) t++;
    const cs = [], jerk = []; let close = 0;
    for (let k = a0; k < t; k += 4) { const c = clear(p[k]); cs.push(c); if (p[k].grounded || c < 12) close++; if (k >= a0 + 8) jerk.push(Math.abs((p[k].vy - p[k - 4].vy) - (p[k - 4].vy - p[k - 8].vy))); }
    cs.sort((x, y) => x - y); const med = cs[cs.length >> 1], p10 = cs[Math.floor(cs.length / 10)];
    const pr = events.filter(e => e.type === "press" && e.tick >= a0 && e.tick < t).length;
    rows.push(`  ${mode.padEnd(5)} blocks ${(p[a0].x / 30).toFixed(0)}-${(p[t - 1].x / 30).toFixed(0)}: clearance median ${med.toFixed(0)}, 10th ${p10.toFixed(0)}; close ${Math.round(close / cs.length * 100)}%; jerk ${(jerk.reduce((x, y) => x + y, 0) / Math.max(1, jerk.length)).toFixed(2)}; presses ${pr}`);
  }
  console.log(name + (p[p.length - 1].done ? "" : " (does not finish)")); for (const r of rows) console.log(r);
}
report("saved route", ev);
if (a.includes("--replan")) {
  const t0 = Date.now(), n = GD.naturalPlan(w, { ok: true, events: ev }, L.level.objects, { cost: true });
  if (n) report(`natural plan now (${((Date.now() - t0) / 1000).toFixed(0)} s)`, n.events); else console.log("natural plan failed");
}
