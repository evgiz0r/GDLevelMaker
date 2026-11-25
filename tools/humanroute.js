// node tools/humanroute.js [n ...] [--all-bursts]  -- is each official level's viewer route (local/official_NN.json) humanly
//   playable? Per level: presses, the busiest second (presses in any 1 s window, where, in which mode), the shortest
//   gap between two presses (where, which mode), and holds over 0.6 s outside ship / wave / swing / UFO (a hold
//   through an auto-jump chain a person would tap). One replay each, seconds; no solving.
// Flags (the user, 2026-11-24: "taps ~60 ms, no holds through jump chains"; "no 35 presses in 0.9 s"):
//   FAST  a second with more than MAX_CPS presses (12: past what a good player keeps up)
//   GAP   two presses under MIN_GAP_MS (50 ms) apart
//   HOLD  a hold over 0.6 s in a jumping mode that fires 2+ jumps
// A flagged spot on an official level means the solver found only an inhuman way there: a physics lead (the game's
// players do it humanly) unless the level really asks for it. PHYSICS.md "How the route is chosen".
const fs = require("fs"), path = require("path");
const { GD, unpack } = require("./io.js");
const SRC = require("./gdpaths.js").LEVELS;
const MAX_CPS = 12, MIN_GAP_MS = 50, TPS = GD.PHYS.TPS, FLY = new Set(["ship", "wave", "swing", "ufo"]);
const args = process.argv.slice(2), nums = args.filter(a => /^\d+$/.test(a)).map(Number);
const levels = nums.length ? nums : Array.from({ length: 22 }, (_, i) => i + 1);

function check(n) {
  const tag = String(n).padStart(2, "0"); let v;
  try { v = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "local", `official_${tag}.json`), "utf8")); } catch (e) { return null; }
  const L = GD.parseLevel(v.level || unpack(fs.readFileSync(path.join(SRC, n + ".txt"), "utf8"))), w = GD.makeWorld(L.objects, L.header);
  const ev = v.solution.events, q = GD.run(w, ev), p = q.path, at = t => p[Math.min(t, p.length - 1)];
  const pr = ev.filter(e => e.type === "press").map(e => e.tick), flags = [];
  let best = { c: 0 }, gap = { ms: Infinity };
  for (let i = 0; i < pr.length; i++) {
    let j = i; while (j < pr.length && pr[j] - pr[i] < TPS) j++;
    if (j - i > best.c) best = { c: j - i, t: pr[i], mode: at(pr[i]).mode };
    if (j - i > MAX_CPS && !(flags.length && flags[flags.length - 1].k === "FAST" && pr[i] - flags[flags.length - 1].t < TPS)) flags.push({ k: "FAST", t: pr[i], txt: `${j - i} presses in 1 s` });
    if (i) { const ms = (pr[i] - pr[i - 1]) / TPS * 1000; if (ms < gap.ms) gap = { ms, t: pr[i], mode: at(pr[i]).mode };
      if (ms < MIN_GAP_MS) flags.push({ k: "GAP", t: pr[i], txt: `${Math.round(ms)} ms after the last press` }); }
  }
  for (let i = 0; i < ev.length; i++) {
    if (ev[i].type !== "press") continue;
    const r = ev.slice(i + 1).find(e => e.type === "release"), end = r ? r.tick : p.length - 1;
    if ((end - ev[i].tick) / TPS < 0.6) continue;
    let jumps = 0; for (let t = ev[i].tick; t < end && t + 1 < p.length; t++) { if (FLY.has(p[t].mode)) { jumps = -99; break; } const a = p[t + 1].act || ""; if (a && a !== (p[t].act || "") && /jump|orb|pad|flip/.test(a)) jumps++; }
    if (jumps >= 2) flags.push({ k: "HOLD", t: ev[i].tick, txt: `held ${((end - ev[i].tick) / TPS).toFixed(1)} s through ${jumps} jumps` });
  }
  const end = p[p.length - 1];
  return { n, name: v.name, kind: v.solution.kind, ok: v.solution.ok, beaten: end.done || (!end.dead && end.x >= w.endX), presses: pr.length, best, gap, flags,
    where: t => `block ${(at(t).x / 30).toFixed(1)} (${at(t).mode})` };
}

if (require.main === module) {
  let flagged = 0;
  for (const n of levels) {
    const r = check(n); if (!r) { console.log(`${String(n).padStart(2)} (no route)`); continue; }
    console.log(`${String(n).padStart(2)} ${r.name.padEnd(24)} ${(r.beaten ? "beaten" : "unbeaten").padEnd(8)} ${String(r.kind).padEnd(8)} ${String(r.presses).padStart(4)} presses; busiest second ${r.best.c} at ${r.best.t != null ? r.where(r.best.t) : "-"}; shortest gap ${isFinite(r.gap.ms) ? Math.round(r.gap.ms) + " ms at " + r.where(r.gap.t) : "-"}`);
    const fl = args.includes("--all-bursts") ? r.flags : r.flags.slice(0, 4);
    for (const f of fl) console.log(`     ${f.k.padEnd(4)} ${f.txt} at ${r.where(f.t)}`);
    if (r.flags.length > fl.length) console.log(`     ... ${r.flags.length - fl.length} more (--all-bursts)`);
    if (r.flags.length) flagged++;
  }
  console.log(`${flagged} level(s) with a flag (FAST > ${MAX_CPS}/s, GAP < ${MIN_GAP_MS} ms, HOLD through jumps)`);
}
module.exports = { check };
