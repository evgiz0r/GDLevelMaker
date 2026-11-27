// node tools/seedsolve.js <level.gdlvl> <seed.json> [--out route.json]   -- solve a level from its pieces' known presses
//   (Evgeni on v5's 30-min solve, 2026-11-26: "what does it do there exactly?" -- the solver searched the whole level as if
//   nothing were known, though every brick was verified with its own route). A builder that places verified bricks knows
//   roughly when each press comes (tools/brickpick.js picks[].presses, level seconds): this replays them, and where the
//   run dies it searches only from a calm point 1 / 2.5 / 6 s before the death to a bit past it (a flying stretch: to its
//   end), keeps that, and goes on with the seeds after it -- presslib.js solveWithLib's repair loop with the bricks'
//   presses in place of the press library. So only the joins and the stretches with no seed are searched.
//   seed.json: [{ t: <level s>, hold?: <s> }] (hold default 0.02 s: a tap). make.js uses it when a spec has "seedPresses".
// As a module: solveSeeded(w, seeds, { maxRepairs, cap }) -> { ok, events, repairs, ms, log } (ok false: fall back to GD.solveAny).
if (require.main === module) require("./heavy.js").claim();
"use strict";
const { GD } = require("./io.js");
const FLY = { ship: 1, wave: 1, ufo: 1, swing: 1 };

function seedEvents(seeds, fromTick = 0) {
  const ev = []; let last = -1;
  for (const s of seeds.slice().sort((a, b) => a.t - b.t)) {
    const t = Math.round(s.t * GD.PHYS.TPS); if (t < fromTick || t <= last + 1) continue;
    const r = t + Math.max(2, Math.round((s.hold || 0.02) * GD.PHYS.TPS));
    ev.push({ type: "press", tick: t }, { type: "release", tick: r }); last = r;
  }
  return ev;
}
function heldAt(ev, t) { let h = false; for (const e of ev) { if (e.tick >= t) break; h = e.type === "press"; } return h; }
// the seeds after tick T, fitted to the held state there (a release first when the button is down)
function after(seeds, T, held) {
  const ev = seedEvents(seeds, T + 1);
  if (held) ev.unshift({ type: "release", tick: T + 1 });
  return ev.filter((e, i) => !(held && e.type === "release" && i > 0 && e.tick <= T + 1));
}

function solveSeeded(w, seeds, opts = {}) {
  const I = require("../lib/incsolve.js").incsolve, t0 = Date.now(), log = [];
  let events = seedEvents(seeds), repairs = 0, lastDie = -1, sameDie = 0;
  for (;;) {
    const res = GD.run(w, events), p = res.path, end = p[p.length - 1];
    const skip = !res.dead && end.done ? GD.skipCheck(w, p, events) : null;
    if (end.done && !skip) return { ok: true, events, repairs, ms: Date.now() - t0, log };
    if (repairs >= (opts.maxRepairs || 120)) return { ok: false, events, repairs, ms: Date.now() - t0, log, dieX: end.x };
    repairs++;
    const td = skip ? Math.max(0, p.findIndex(q => q.x >= skip.dieAt.x)) : p.length - 1, xd = p[td].x;
    if (Math.abs(xd - lastDie) < 1) sameDie++; else sameDie = 0; lastDie = xd;
    let back = 0, fixed = false;
    for (const secs of sameDie ? [2.5, 6, 12] : [1, 2.5, 6]) {
      let c = Math.max(0, td - Math.round(secs * GD.PHYS.TPS));
      while (c > 0 && !I.calm(w, p[c])) c--;
      if (back && c >= back) continue; back = c;   // only a calm point further back than the last try
      let goalX = xd + 180;
      if (FLY[p[td].mode] || FLY[p[Math.max(0, td - 60)].mode]) {   // a flying stretch: searched to its end in one go
        const out = w.items.filter(b => b.kind === "mode" && b.x0 > xd && !FLY[b.d.mode]).sort((x, y) => x.x0 - y.x0)[0];
        goalX = Math.max(goalX, out ? out.x1 + 60 : w.endX);
      }
      const h = heldAt(events, c);
      const sv = GD.solveSweep(w, { start: p[c], held: h, cap: opts.cap || 20000, goal: st => GD.progressX ? GD.progressX(st) >= goalX && (!!st.grounded || !!FLY[st.mode]) : st.x >= goalX && (!!st.grounded || !!FLY[st.mode]) });
      if (!sv || !sv.ok) continue;
      const T = sv.goalTick != null ? sv.goalTick : (sv.events.length ? sv.events[sv.events.length - 1].tick + 1 : c);
      const prefix = events.filter(e => e.tick < c).concat(sv.events.filter(e => e.tick >= c && e.tick < T));
      const pp = GD.run(w, prefix).path, st = pp[Math.min(T, pp.length - 1)];
      if (st.dead) continue;
      events = prefix.concat(after(seeds, T, heldAt(prefix, T + 1)));
      log.push(`block ${(xd / 30).toFixed(1)}: searched from block ${(p[c].x / 30).toFixed(1)} (${secs} s back) to ${(goalX / 30).toFixed(0)}`);
      fixed = true; break;
    }
    if (!fixed) { log.push(`block ${(xd / 30).toFixed(1)}: no local repair`); return { ok: false, events, repairs, ms: Date.now() - t0, log, dieX: xd }; }
  }
}

if (require.main === module) {
  const [f, sf] = process.argv.slice(2);
  if (!sf) { console.log(require("fs").readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }
  const L = require("./io.js").readGdlvl(f), w = GD.makeWorld(L.level.objects, L.level.header);
  const r = solveSeeded(w, JSON.parse(require("fs").readFileSync(sf, "utf8")));
  console.log(`${f}: ${r.ok ? "beaten" : "not beaten (dies at block " + (r.dieX / 30).toFixed(1) + ")"}, ${r.repairs} repairs, ${(r.ms / 1000).toFixed(1)} s`);
  const oi = process.argv.indexOf("--out"); if (oi > 0 && r.events) require("fs").writeFileSync(process.argv[oi + 1], JSON.stringify({ ok: r.ok, events: r.events }));
  for (const l of r.log) console.log("  " + l);
}
module.exports = { solveSeeded, seedEvents };
