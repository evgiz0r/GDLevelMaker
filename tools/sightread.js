// node tools/sightread.js <level.gdlvl> [...]  -- is each click cued by what is right in front?
//
// The user's rule (after playing GDLM 41/42): a fair, sight-readable level never makes you
// "prejump" -- commit to a jump while the thing it is for is still far ahead, in the middle of
// nothing, so you can only get it right by knowing the pattern in advance.
//
// For each press of the solver's solution: drop that press (and the ones after it), run on, and
// see what kills the cube; that object, or a nearer gameplay object ahead within reach (a
// block to land on, an orb), is the press's CUE. The LEAD is how far ahead of the cube's
// front edge the cue still is at the LATEST moment the press works (the end of its window).
// Small lead = you jump when the obstacle is in your face = reactable. Big lead = a prejump.
// Flagged: lead > LIMIT blocks (default 1.5; --limit n; 3 in ship/UFO/wave/swing). A press that
// fires an orb counts as cued.
const { GD, readGdlvl } = require("./io.js");
// flying modes turn slowly, so steering starts further ahead of what it is for: allow 3 blocks
const FLYING = new Set(["ship", "ufo", "wave", "swing"]), FLY_LIMIT = 3;

function sightread(level, limit = 1.5) {
  const w = GD.makeWorld(level.objects, level.header);
  const r = GD.solveAny(w);
  if (!r.ok) return { ok: false };
  const presses = r.clicks.filter(c => c.type === "press");
  const base = r.events;
  const out = [];
  for (const c of presses) {
    // events strictly before this press (with their auto releases)
    const before = base.filter(e => e.tick < c.tick);
    const res = GD.run(w, before);
    const hiState = GD.run(w, before.concat([{ tick: c.hi, type: "press" }, { tick: c.hi + 1, type: "release" }])).path[c.hi] || res.path[c.hi];
    const xHi = hiState ? hiState.x : c.x;
    const loState = res.path[c.lo];
    const xLo = loState ? loState.x : c.x;
    // the cue: what kills you without this press, or the nearest gameplay object ahead within
    // reach (a hop's front face, an orb) if that is closer -- either way, something to react to
    let cue = null, lead = null;
    const y = hiState ? hiState.y : 0;
    const cands = level.objects.filter(o => { const k = GD.objInfo(o.id).kind; return ["solid", "slope", "hazard", "orb", "pad"].includes(k); })
      .map(o => ({ o, hb: GD.hitbox(o) })).filter(c => c.hb && c.hb.x0 >= xHi + 15 - 1 && c.hb.y0 < y + 120 && c.hb.y1 > y - 15);
    if (res.dead && res.killer) cands.push({ o: res.killer, hb: GD.hitbox(res.killer) });
    for (const c of cands) {
      if (!c.hb) continue;
      const l = (c.hb.x0 - (xHi + 15)) / 30;
      if (lead == null || l < lead) { lead = l; cue = c.o; }
    }
    // a press that fires an orb is cued by that orb: the cube is touching it
    if (c.act && GD.objInfo && /orb/.test(c.act)) { lead = 0; cue = null; }
    out.push({ act: c.act, block: c.x / 30, from: xLo / 30, to: xHi / 30, ms: c.ms, cue: cue && GD.objInfo(cue.id).name, cueAt: cue && cue.x / 30,
      mode: hiState && hiState.mode, lead, flag: lead != null && lead > (FLYING.has(hiState && hiState.mode) ? FLY_LIMIT : limit) });
  }
  return { ok: true, presses: out };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const li = args.indexOf("--limit");
  const limit = li >= 0 ? +args[li + 1] : 1.5;
  const files = args.filter((a, i) => a.endsWith(".gdlvl"));
  let bad = 0;
  for (const f of files) {
    const L = readGdlvl(f);
    const s = sightread(L.level, limit);
    console.log(`== ${L.name}`);
    if (!s.ok) { console.log("   not beatable"); bad++; continue; }
    for (const p of s.presses)
      console.log(`   ${p.flag ? "PREJUMP" : "ok     "} press at block ${p.from.toFixed(1)}-${p.to.toFixed(1)} (${p.ms} ms) for ${p.cue || "?"} at ${p.cueAt ? p.cueAt.toFixed(1) : "?"}: lead ${p.lead == null ? "?" : p.lead.toFixed(1)} blocks`);
    const n = s.presses.filter(p => p.flag).length;
    console.log(`   ${n ? n + " prejump(s)" : "sight-readable"} (limit ${limit} blocks)`);
    if (n) bad++;
  }
  process.exit(bad ? 2 : 0);
}
module.exports = { sightread };
