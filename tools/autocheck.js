// node tools/autocheck.js <level.gdlvl> [...] [--every 30] [--follow 1200]
//   -> re-checks a saved AUTO level (no press) on today's physics: does it still clear with no press, and do stray presses
//      (a tap, or a 0.2 s hold, every `every` ticks) find a way that neither dies nor rejoins the auto run within `follow`
//      ticks (a "leak": a secret way / skip, the thing autobeat's saws are placed to shut). The same test autobeat runs while
//      building (strays()), but on a finished file, so a physics change can be checked against levels already made.
//   Made 2026-11-27 when saws switched to GD's "Fix Radius Collision" (header kA39, centre distance; PHYSICS.md): the auto
//   labs' saws had been verified with the old rect test. Compare with the old rule: GDLM_FIXRADIUS=0 node tools/autocheck.js ...
if (require.main === module) require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
"use strict";
const { GD, readGdlvl } = require("./io.js");

const CK = 120;
const snap = s => ({ x: s.x, y: s.y, grav: s.grav, mode: s.mode, sp: s.sp, mini: !!s.mini });
const same = (a, b) => a && b && a.mode === b.mode && a.grav === b.grav && a.sp === b.sp && a.mini === b.mini && Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1;

function check(levelStr, o = {}) {
  const every = o.every || 30, follow = o.follow || 1200, hold = o.hold || 48;
  const lv = GD.parseLevel(levelStr), w = GD.makeWorld(lv.objects, lv.header);
  // the auto run with checkpoints
  let s = GD.startState(w); const P = [snap(s)], cks = new Map();
  while (!s.dead && !s.done && s.tick < 240 * 600) { GD.step(w, s, { press: false, held: false }); P.push(snap(s)); if (s.tick % CK === 0) cks.set(s.tick, structuredClone(s)); }
  const res = { clears: !s.dead, why: s.dead ? s.why : null, secs: +(P.length / 240).toFixed(1), checked: 0, leaks: [] };
  if (s.dead) return res;
  for (let t0 = every; t0 < P.length - 2; t0 += every) {
    const ck = Math.floor(t0 / CK) * CK;
    for (const len of [1, hold]) {
      const q = ck > 0 && cks.has(ck) ? structuredClone(cks.get(ck)) : GD.startState(w);
      while (q.tick < t0) GD.step(w, q, { press: false, held: false });
      let fate = "leak";
      for (let k = 0; k < follow; k++) {
        const down = k < len;
        GD.step(w, q, { press: k === 0, held: down });
        if (q.dead) { fate = "dies"; break; }
        if (q.done) { fate = "end"; break; }
        const a = P[q.tick]; if (!a) { fate = "end"; break; }
        if (!down && same(snap(q), a)) { fate = "back"; break; }
      }
      res.checked++;
      if (fate === "leak" || fate === "end") res.leaks.push({ t: +(t0 / 240).toFixed(2), x: Math.round(P[t0].x), hold: len > 1, fate });
    }
  }
  return res;
}
module.exports = { check };

if (require.main === module) {
  const a = process.argv.slice(2), opt = k => { const i = a.indexOf(k); return i >= 0 ? +a[i + 1] : undefined; };
  const files = a.filter((f, i) => f.endsWith(".gdlvl") && !["--every", "--follow"].includes(a[i - 1]));
  for (const f of files) {
    const r = check(readGdlvl(f).levelStr, { every: opt("--every"), follow: opt("--follow") });
    const lk = r.leaks.length ? " leaks at " + r.leaks.slice(0, 6).map(l => `${l.t}s${l.hold ? " hold" : ""}${l.fate === "end" ? " (to the end)" : ""}`).join(", ") + (r.leaks.length > 6 ? ` +${r.leaks.length - 6}` : "") : "";
    console.log(`${f}: ${r.clears ? "clears" : "DIES (" + r.why + ")"} ${r.secs} s, ${r.checked} stray presses, ${r.leaks.length} leak(s)${lk}`);
  }
}
