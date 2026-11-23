// node tools/fairness.js <level.gdlvl> [...] [--json]   -- deaths that would not be the player's fault
// node tools/fairness.js fit                             -- the thresholds against the user's labelled deaths
//
// The user: "I mostly died deaths not really my fault" (GDLM 46 v2: of 11 real deaths the physics
// session labelled 7 unfair, 3 borderline, 1 fair; local/real_stats.jsonl `fair`). A level must pass
// this before the user sees it (tools/score.js gate "fairness"). Families flagged, each from a
// real death (DIFFICULTY.md "Fairness"):
//   switch     after a portal switch (mode, speed, gravity portal, size) the next input's strict
//              window (that input moved, every other kept) closes within SWITCH_MS of the portal:
//              forced before the player settles into the new mode. Not ship/UFO (they fall slowly and
//              are steered), not an input already going at the portal (a jump into it) (GDLM 44 v5 x 1643, 46 v2 x 3326)
//   mark       a jump mark (deco in group 990, tools/decorate.js) with no jump near it: it misleads
//              (46 v2: a "v" at x 825 and no input there, death at 950)
//   floor      the floor around a portal into a ground mode slopes (within FLOOR_RANGE): the
//              exit is unreadable (46 v2: a sawtooth under the wave exit, death at 3150)
//   chain      orb taps in a row, each under CHAIN_MS after the last, CHAIN_LEN or more: nothing is
//              left to correct a late tap (46 v2 end orb chain, deaths at 3732, 3800)
//   blind      a jump with a window under BLIND_MS that has no mark and leads straight into an orb:
//              a two-step opener nobody can read in time (46 v2 first orb, borderline, 436)
//   wave       wave turns under WAVE_MS apart (GDLM 44 v5 zigzag, 75 ms, death at 1694)
// FAIL: switch, mark, floor, chain, wave. WARN: blind (borderline in the labels).
// Cost: one solve plus the difficulty windows (~1 min for a 60 s level). One at a time.
const fs = require("fs"), path = require("path");
const { GD, readGdlvl } = require("./io.js");
const DF = require("../lib/difficulty.js");
const { naturalPlan } = require("../lib/natural.js");

const TH = { SWITCH_MS: 250, MARK_DIST: 60, FLOOR_RANGE: 90, CHAIN_MS: 500, CHAIN_LEN: 3, BLIND_MS: 100, WAVE_MS: 150 };
const SEVERITY = { switch: "FAIL", mark: "FAIL", floor: "FAIL", chain: "FAIL", wave: "FAIL", blind: "WARN" };
const MARK_GROUP = "990";

// Everything the thresholds need, measured once (slow part).
function analyse(w, sol) {
  // judged on the route a person plays (lib/natural.js: taps, no empty jumps, flying through the
  // middle) -- the solver's route has jumps nobody needs (the GDLM 46 v2 mark at 825 sits on one)
  const nat = naturalPlan(w, sol, w.objects);
  const d = DF.difficulty(w, nat ? { ok: true, events: nat.events } : sol, { chains: false });
  const run = GD.run(w, d.events), P = run.path;
  const orbNames = new Set(Object.values(GD.OBJECTS || {}).filter(o => o.kind === "orb").map(o => o.name));
  // what each input did: the first jump/orb act while it is held
  const inputs = d.actions.map(a => {
    let did = null;
    for (let t = a.tick; t < Math.min(P.length - 1, a.tick + Math.max(a.dur || 0, 1) + 1); t++) {
      const act = P[t + 1].act;
      if (act === "jump" || orbNames.has(act) || /flap|teleport|swing/.test(act || "")) { did = { act, x: P[t + 1].x, t }; break; }
    }
    return { tick: a.tick, type: a.type, ms: a.ms, x: a.x, mode: a.mode, afterSwitchMs: a.afterSwitchMs,
             act: did ? did.act : null, orb: !!(did && orbNames.has(did.act)), actX: did ? did.x : a.x };
  });
  // jump takeoffs on the route (where a mark should be)
  const jumps = [];
  for (let t = 1; t < P.length; t++) if (P[t].act === "jump") jumps.push(P[t - 1].x);
  const marks = w.objects.filter(o => o.props && String(o.props["57"] || "").split(".").includes(MARK_GROUP))
    .map(o => ({ x: o.x, near: jumps.reduce((m, j) => Math.min(m, Math.abs(j - o.x)), Infinity) }));
  // portal switches: how long the player lives after it with NO new input (the button stays as it
  // is). Dying soon means an input is forced before the player has settled into the new mode.
  const held = new Array(P.length).fill(false);
  { let h = false, j = 0; const ev = d.events.slice().sort((a, b) => a.tick - b.tick);
    for (let t = 0; t < P.length; t++) { while (j < ev.length && ev[j].tick === t) { h = ev[j].type === "press"; j++; } held[t] = h; } }
  const clone = st => { const c = Object.assign({}, st); c.used = st.used.slice(); if (Array.isArray(st.prev)) c.prev = st.prev.slice(); return c; };
  // strict window of one input: shift it (a tap moves whole), keep every other input, live 1 s on
  const strict = a => {
    const span = a.type === "tap" ? (a.dur || 1) : 0, A0 = a.tick;
    const ok = dd => {
      const B = A0 + dd;
      const at = a.type === "tap" ? t => (t >= B && t < B + span) ? true : (t >= A0 && t < A0 + span) ? false : held[t]
        : a.type === "press" ? t => (dd < 0 && t >= B && t < A0) ? true : (dd > 0 && t >= A0 && t < B) ? false : held[t]
        : t => (dd < 0 && t >= B && t < A0) ? false : (dd > 0 && t >= A0 && t < B) ? true : held[t];
      const t0 = Math.max(1, Math.min(A0, B) - 1); if (t0 >= P.length - 1) return false;
      const st = clone(P[t0]); let prev = at(t0 - 1);
      for (let t = t0, end = Math.min(P.length - 1, Math.max(A0, B) + span + 240); t < end; t++) {
        const hv = at(t); GD.step(w, st, { press: hv && !prev, held: hv }); prev = hv;
        if (st.dead) return false; if (st.done) return true;
      }
      return true;
    };
    let lo = 0, hi = 0; while (lo < 72 && ok(-(lo + 1))) lo++; while (hi < 72 && ok(hi + 1)) hi++;
    return { lo: A0 - lo, hi: A0 + hi };
  };
  const acts = DF.actionsOf(d.events);
  const switches = [];
  for (let t = 1; t < P.length; t++) {
    const a = P[t - 1], b = P[t];
    if (!(b.mode !== a.mode || b.sp !== a.sp || !!b.mini !== !!a.mini || (b.grav !== a.grav && /portal/.test(b.act || "")))) continue;
    // the inputs around it: their strict windows, and how soon after the portal each one closes
    const near = acts.filter(x => x.tick >= t - 24 && x.tick <= t + 144 && !(x.type === "release" && /cube|robot|ball|spider/.test(P[Math.min(x.tick, P.length - 1)].mode)));
    const wins = near.map(x => { const sw = strict(x); return { tick: x.tick, type: x.type, x: P[Math.min(x.tick, P.length - 1)].x, ms: (sw.hi - sw.lo + 1) / 240 * 1000, closeMs: (sw.hi - t) / 240 * 1000, openMs: (sw.lo - t) / 240 * 1000 }; });
    const first = wins.filter(x => x.closeMs >= 0).sort((p, q) => p.closeMs - q.closeMs)[0] || null;
    // held through the portal (a ship entered on the jump that got there): the input is already
    // going, nothing new to start
    switches.push({ x: b.x, tick: t, from: a.mode, to: b.mode, first, heldIn: held[t - 1] && held[t], firstTick: first ? first.tick - t : null });
  }
  // portals the route takes: the floor under them
  const portals = [];
  for (let t = 1; t < P.length; t++) {
    if (P[t].mode === P[t - 1].mode) continue;
    const px = P[t].x, py = P[t - 1].y;
    const surf = x => { let best = 0, slope = false;
      for (const b of w.items) {
        if (b.kind !== "solid" && b.kind !== "slope") continue;
        if (b.x0 > x || b.x1 < x || b.y1 > py + 15) continue;
        if (b.y1 >= best) { slope = b.kind === "slope" && b.y1 > best ? true : (b.y1 === best ? slope || b.kind === "slope" : false); best = b.y1; }
      }
      return { y: best, slope }; };
    const cols = [];
    for (let x = px - 150; x <= px + 150; x += 15) cols.push(Object.assign({ dx: x - px }, surf(x)));
    portals.push({ x: px, from: P[t - 1].mode, to: P[t].mode, cols });
  }
  return { name: w.name, inputs, marks, portals, switches, seconds: d.seconds, complete: d.complete, logAttempts: d.logAttempts };
}

// Flags from the measured features (fast part).
function flags(A, th) {
  th = Object.assign({}, TH, th || {});
  const out = [];
  const add = (family, x0, x1, note) => out.push({ family, severity: SEVERITY[family], x0, x1, note });
  for (const p of A.switches || [])
    if (p.first && !/ship|ufo/.test(p.to) && p.firstTick > 0 && p.first.closeMs < th.SWITCH_MS) add("switch", p.x, p.first.x, `${p.from} -> ${p.to}: the ${p.first.type} after it has a ${Math.round(p.first.ms)} ms window that closes ${Math.round(p.first.closeMs)} ms after the portal`);
  for (const m of A.marks) if (m.near > th.MARK_DIST) add("mark", m.x, m.x, `mark with no jump within ${Math.round(m.near)} units`);
  for (const p of A.portals) {
    const c = p.cols.filter(k => Math.abs(k.dx) <= th.FLOOR_RANGE);
    const ys = c.map(k => k.y), spread = Math.max(...ys) - Math.min(...ys), slope = c.some(k => k.slope);
    // into a ground mode: the player lands on that floor right after the switch
    if (/cube|robot|ball|spider/.test(p.to) && slope) add("floor", p.x - th.FLOOR_RANGE, p.x + th.FLOOR_RANGE, `${p.from} -> ${p.to} portal: the floor slopes within ${th.FLOOR_RANGE / 30} blocks of it (steps ${spread} units)`);
  }
  // chains of orb taps
  let run = [];
  const endRun = () => { if (run.length >= th.CHAIN_LEN) add("chain", run[0].x, run[run.length - 1].actX, `${run.length} orb taps ${run.map(a => Math.round(a.ms)).join("/")} ms windows, under ${th.CHAIN_MS} ms apart`); run = []; };
  for (const a of A.inputs) {
    if (!a.orb) { endRun(); continue; }
    if (run.length && (a.tick - run[run.length - 1].tick) / 240 * 1000 >= th.CHAIN_MS) endRun();
    run.push(a);
  }
  endRun();
  // blind two-step: a tight-ish jump, no mark near it, and the next input is an orb soon after
  for (let i = 0; i + 1 < A.inputs.length; i++) {
    const a = A.inputs[i], b = A.inputs[i + 1];
    if (a.act !== "jump" || a.ms >= th.BLIND_MS || !b.orb || (b.tick - a.tick) / 240 * 1000 > 600) continue;
    if (A.marks.some(m => Math.abs(m.x - a.actX) <= th.MARK_DIST)) continue;
    add("blind", b.x, b.actX, `jump (${Math.round(a.ms)} ms) straight into an orb, no mark`);
  }
  // wave turns
  for (let i = 1; i < A.inputs.length; i++) {
    const a = A.inputs[i - 1], b = A.inputs[i];
    if (a.mode !== "wave" || b.mode !== "wave") continue;
    const gap = (b.tick - a.tick) / 240 * 1000;
    if (gap < th.WAVE_MS) add("wave", a.x, b.x, `wave turns ${Math.round(gap)} ms apart`);
  }
  return out.sort((p, q) => p.x0 - q.x0);
}

function analyseFile(file) {
  const L = readGdlvl(file), w = GD.makeWorld(L.level.objects, L.level.header);
  w.name = L.name;
  const r = GD.solveAny(w);
  if (!r.ok) return { name: L.name, unbeatable: true, inputs: [], marks: [], portals: [] };
  return analyse(w, r);
}

// a death is explained by a flag that starts at most LEAD units before it (the cause comes first)
const LEAD = 330;
const explains = (f, x) => x >= f.x0 - 45 && x <= f.x1 + LEAD;

module.exports = { TH, analyse, flags, analyseFile, explains, LEAD };

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === "fit") { require("./fairness_fit.js"); return; }
  const json = args.includes("--json");
  let failed = 0;
  for (const f of args.filter(a => !a.startsWith("--"))) {
    const A = analyseFile(f), F = A.unbeatable ? [] : flags(A);
    if (json) { console.log(JSON.stringify({ file: f, flags: F })); continue; }
    console.log(`== ${A.name}: ${A.unbeatable ? "not beatable, not checked" : F.length ? F.filter(x => x.severity === "FAIL").length + " unfair, " + F.filter(x => x.severity === "WARN").length + " borderline" : "fair"}`);
    for (const x of F) console.log(`   ${x.severity} ${x.family.padEnd(6)} block ${(x.x0 / 30).toFixed(1)}: ${x.note}`);
    if (F.some(x => x.severity === "FAIL")) failed++;
  }
  process.exitCode = failed ? 1 : 0;
}
