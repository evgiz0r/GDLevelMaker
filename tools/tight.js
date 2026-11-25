// node tools/tight.js [n ...] [--fix] [--coins]   -- main levels' timings too hard for the level (the user, 2026-11-25:
//   "in the main levels, wherever a timing is too hard for the level, its probably not the path").
// Per level: every input of the viewer's human route (local/official_NN.json; --coins: official_NN_coins.json) and its
// player window (lib/windows.js), against the level's tier floor -- FLOOR below: 40 ms Easy..Harder, 30 Insane, 20 Demon
// (the board's first cut, 2026-11-25). Each press under the floor is a spot where the route is probably not the
// intended one. --fix re-searches those spots (lib/difficulty.js easierRoute, only for inputs under the floor: drop /
// move / add taps around it that rejoin the route, judged by the windows and the joint chance) and saves the route when
// it got easier and still clears every portal. What stays under the floor is listed: a physics lead or a path the local
// search cannot reach (a different branch further back). Steering inputs (ship / wave / swing) are not re-searched.
// Windows are cached in local/mains/windows/ keyed by route + physics + windows commits. DIFFICULTY.md "Too tight for
// the level". tools/mains.js runs --fix after every job it does.
if (require.main === module) require("./heavy.js").claim();
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const { GD } = require("./io.js");
require("../lib/difficulty.js"); require("../lib/windows.js");
const ROOT = path.join(__dirname, ".."), TPS = GD.PHYS.TPS;
const FLOOR = { Easy: 40, Normal: 40, Hard: 40, Harder: 40, Insane: 30, Demon: 20 };
const tag = n => String(n).padStart(2, "0");
const msOf = ticks => ticks * 1000 / TPS;

function windowsOf(n, w, events, runPath, kind) {
  const S = require("./solutions.js");
  const key = crypto.createHash("sha1").update(JSON.stringify(events) + S.physicsCommit() + S.windowsCommit()).digest("hex").slice(0, 16);
  const f = path.join(ROOT, "local", "mains", "windows", `official_${tag(n)}${kind}.json`);
  try { const c = JSON.parse(fs.readFileSync(f, "utf8")); if (c.key === key) return c.windows; } catch (e) {}
  const ws = GD.inputWindows(w, events, runPath, {}).map(x => ({ type: x.type, tick: x.tick, lo: x.lo, hi: x.hi }));
  fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify({ key, windows: ws }));
  return ws;
}

function check(n, opts) {
  const ds = require("./difficulty_solve.js"), RATED = require("./difficulty.js").RATED;
  const kind = opts.coins ? "_coins" : "", file = path.join(ROOT, "local", `official_${tag(n)}${kind}.json`);
  if (!fs.existsSync(file)) return { n, none: true };
  const doc = JSON.parse(fs.readFileSync(file, "utf8")), face = RATED[n][1], floor = FLOOR[face];
  const L = GD.parseLevel(ds.levelText(n)), w = GD.makeWorld(L.objects, L.header);
  if (opts.coins) w.needCoins = true;
  let events = doc.solution.events, r = GD.run(w, events);
  if (!r.done) return { n, name: RATED[n][0], floor, notClear: true };
  const actsOf = (evs, rr) => {
    const ws = windowsOf(n, w, evs, rr.path, kind);
    const rel = new Map(); { let down = null; for (const e of evs) { if (e.type === "press") down = e.tick; else if (down !== null) { rel.set(down, e.tick - down); down = null; } } }
    return ws.map(x => { const s = rr.path[Math.min(x.tick, rr.path.length - 1)];
      return { tick: x.tick, lo: x.lo, hi: x.hi, ms: msOf(x.hi - x.lo + 1), type: x.type, mode: s.mode, x: s.x, dur: rel.get(x.tick) }; });
  };
  let acts = actsOf(events, r);
  const under = a => a.filter(x => x.type !== "release" && x.ms < floor);
  const before = under(acts);
  let log = [];
  if (opts.fix && before.length) {
    const res = GD.easierRoute(w, events, acts, { below: floor });
    if (res.changed) {
      const r2 = GD.run(w, res.events), sk = r2.done ? GD.skipCheck(w, r2.path, res.events) : true;
      if (r2.done && !sk) {
        events = res.events; r = r2; log = res.log; acts = actsOf(events, r);
        doc.solution.events = events; doc.solution.tight = { at: new Date().toISOString(), floor, fixed: log };
        fs.writeFileSync(file, JSON.stringify(doc));
        require("./index_levels.js").buildIndex();
      }
    }
  }
  const after = under(acts);
  return { n, name: RATED[n][0], face, floor, before: before.length, after: after.map(a => ({ ms: Math.round(a.ms), block: +(a.x / 30).toFixed(1), mode: a.mode })), fixed: log };
}

module.exports = { check, FLOOR };
if (require.main === module) {
  const a = process.argv.slice(2), ns = a.filter(x => /^\d+$/.test(x)).map(Number), list = ns.length ? ns : Array.from({ length: 22 }, (_, i) => i + 1);
  const opts = { fix: a.includes("--fix"), coins: a.includes("--coins") };
  const out = [];
  for (const n of list) {
    let r; try { r = check(n, opts); } catch (e) { console.log(`${n}: ${e.message.split("\n")[0]}`); continue; }
    out.push(r);
    if (r.none) { console.log(`${n}: no ${opts.coins ? "coin " : ""}route`); continue; }
    if (r.notClear) { console.log(`${n} ${r.name}: route does not clear on today's sim (tools/mains.js first)`); continue; }
    console.log(`${String(n).padStart(2)} ${r.name.padEnd(23)} ${r.face.padEnd(6)} floor ${r.floor} ms: ${r.before} under` +
      (opts.fix ? `, ${r.fixed.length} re-routed, ${r.after.length} left` : "") +
      (r.after.length ? "  -- " + r.after.map(x => `${x.ms} ms @ block ${x.block} (${x.mode})`).join("; ") : ""));
    for (const f of r.fixed || []) console.log(`     re-routed block ${(f.x / 30).toFixed(1)} (${Math.round(f.was)} ms): ${f.why}`);
  }
  fs.mkdirSync(path.join(ROOT, "local", "mains"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "local", "mains", `tight${opts.coins ? "_coins" : ""}.json`), JSON.stringify({ at: new Date().toISOString(), levels: out }, null, 1));
}
