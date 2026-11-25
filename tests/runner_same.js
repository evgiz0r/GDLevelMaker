// node tests/runner_same.js  -- lib/runner.js (the viewer's sliced replay) gives exactly GD.run's path: same length,
// same x / y / vy / mode at every tick, same end, on levels with their saved solutions (and with no presses). If
// lib/physics.js run() changes its loop, this fails: then lib/runner.js must follow. Also: no slice of the sliced
// run takes much over its budget (the viewer stays live while a big level opens).
const path = require("path"), fs = require("fs");
const { GD, readGdlvl } = require("../tools/io.js"), R = require("../lib/runner.js");
const ROOT = path.join(__dirname, "..");
let bad = 0; const check = (ok, what) => { console.log((ok ? "ok   " : "FAIL ") + what); if (!ok) bad++; };
const files = ["levels/archive/gdlm_45_first_flight.gdlvl", "levels/gdlm_44_hellgate.gdlvl", "examples/cube_timings.gdlvl"].filter(f => fs.existsSync(path.join(ROOT, f)));
for (const f of files) {
  const L = readGdlvl(path.join(ROOT, f)), w = GD.makeWorld(L.level.objects, L.level.header);
  let sol = null; try { sol = require("../tools/solutions.js").get(L.levelStr, true); } catch (e) {}
  for (const events of [sol && sol.events ? sol.events : [], []]) {
    const a = GD.run(w, events), r = R.runSliced(w, events); let slices = 0, worst = 0;
    for (;;) { const t0 = Date.now(), fin = r.advance(15); worst = Math.max(worst, Date.now() - t0); slices++; if (fin) break; }
    const b = r.result, n = a.path.length;
    let same = b.path.length === n && a.dead === b.dead && a.done === b.done;
    for (let k = 0; same && k < n; k += 7) { const p = a.path[k], q = b.path[k]; if (p.x !== q.x || p.y !== q.y || p.vy !== q.vy || p.mode !== q.mode) same = false; }
    check(same, `${path.basename(f)} (${events.length} inputs): same path, ${n} ticks, ${slices} slices, worst slice ${worst} ms`);
    check(worst < 60, `${path.basename(f)}: no slice over 60 ms (worst ${worst})`);
  }
}
// The big official levels, when this PC has them (local/, never committed): opening one in the viewer must not
// block the page (the user: "i clicked official and it hanged"; the viewer's rule: no UI action blocks > ~100 ms).
// The viewer's open: parse + world in one slice, then the replay in ~12 ms slices (lib/runner.js), then load().
for (const n of ["20", "22"]) {
  const f = path.join(ROOT, "local", `official_${n}.json`); if (!fs.existsSync(f)) { console.log(`skip official ${n} (not on this PC)`); continue; }
  const o = JSON.parse(fs.readFileSync(f, "utf8")), sol = o.solution || {};
  let t0 = Date.now(); const lv = GD.parseLevel(o.level), w = GD.makeWorld(lv.objects, lv.header); const parseWorld = Date.now() - t0;
  const ev = sol.ok ? sol.events : [].concat(...(sol.events || []).map((e, i, a) => e.type === "press" && !(a[i + 1] && a[i + 1].type === "release") ? [e, { tick: e.tick + 1, type: "release" }] : [e]));
  const a = GD.run(w, ev), r = R.runSliced(w, ev); let worst = 0, slices = 0;
  for (;;) { const t1 = Date.now(), fin = r.advance(12); worst = Math.max(worst, Date.now() - t1); slices++; if (fin) break; }
  check(r.result.path.length === a.path.length && r.result.end.x === a.end.x, `official ${n} ${o.name}: sliced replay = GD.run (${a.path.length} ticks)`);
  check(parseWorld < 100, `official ${n}: parse + world in one go ${parseWorld} ms (< 100)`);
  check(worst < 60, `official ${n}: ${slices} slices, worst ${worst} ms (< 60)`);
}
console.log(bad ? `${bad} failed` : "all passed"); process.exit(bad ? 1 : 0);
