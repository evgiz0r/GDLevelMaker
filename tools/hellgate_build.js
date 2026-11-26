// node tools/hellgate_build.js [--dry]  -- writes specs/44_hellgate.json, GDLM 44 hellgate v8 (2026-11-26; v6-v8 notes below).
//   History (git log has every version): v3 was 60% cube; v4 12 sections, 9 modes; v5 (Evgeni: the song started mid-phrase,
//   heights reset at every portal) on a phrase, the height carried over. v5's judge report: layout 3.8/10 (flow 0, variety
//   2.5, pacing 2); the gates: 11 mode changes (official 1.3-5.2 a minute), 2x / 3x / spider / swing / mini "Insane" in a
//   Hard level, two 33-38 ms taps, long fly-path corridors. The cause: 2x and fly sections had no bricks (our verified library
//   is 1x: 52 cube, 12 ship, 9 wave, 4 ball ...), so they became one long generated corridor each, or single spikes.
// v6 (Evgeni, 2026-11-26: "iterate on hellgate, always taking the improved data and methods ... redo its all if needed"):
//   - 7 sections at 1x on the song's phrases, 6 mode changes (cube, ship, cube, wave, ball, ship, cube): where the library is
//   - every section, flying ones too, filled by tools/brickpick.js pickSection (a beam search over the whole section: presses on
//     the hits, pieces close in CPS, 2-4 block joins, no brick twice, filled to its end), so no long generated corridors
//   - the height carries over through each mode's play band (a fly / ball section's floor is its band's floor around the
//     entry portal; a fly section leaves where its last brick leaves), ground sections climb a block at a time
//   - an auto ending (make.js "outro", AUTO.md: no-click, not on the ground -- Evgeni's mark on v5)
//   - the pieces' own presses go into the spec as "seedPresses": make.js solves from them (tools/seedsolve.js) and searches
//     only the joins, not the whole level (v5: 30 min)
// The song: Infertehno 2 (343707) from 20.9615 s (a 4-bar phrase, the kick at b17), its local grid (145.012 BPM, t0 1.101).
"use strict";
const fs = require("fs"), path = require("path");
const { pickSection, beatAt } = require("./brickpick.js");
const ROOT = path.join(__dirname, "..");
const BPM = 145.012, T0 = 1.101, P = 60 / BPM, BPS = 10.386;   // blocks a second at 1x
// v8 (Evgeni on v7: "we still start in the middle of the music"): the song from its first beat (t0, after 1.1 s of silence);
// beat 1 = the song's beat 1, on the grid exactly (an offset a hair past a beat makes make.js's b1 the NEXT beat: v5-v7)
const OFFSET = T0;
const H = JSON.parse(fs.readFileSync(path.join(ROOT, "local", "hits", "343707.json"), "utf8"));
if (Math.abs(H.t0 - T0) > 1e-3) throw new Error("local/hits/343707.json is on another grid: run node tools/hits.js 343707 --bpm 145.012 --t0 1.101 --downbeat 0");
const ST = JSON.parse(fs.readFileSync(path.join(ROOT, "knowledge", "structures.json"), "utf8")).structures;

// [from beat, to beat, mode, kind, climb, opts] on the song from its start (knowledge/song_notes/custom_343707.json, in
// these beats): quiet to b37, the kick at b37, the biggest entry at b66, entries at b82, b98, the music speeds up at b105,
// entries b126 / b130, b137. v8 (Evgeni on v7: "still too much cube. almost no reverse. ... some places just nothing for few
// seconds"): cube 44% (the mains' harder levels: 24-50%), an upside-down cube section (~ud pieces), 6 mode changes in 60 s,
// rests (opts.rest, beats with nothing to press) before the kick and inside the long sections
// v9 (Evgeni, 2026-11-26: "sections have to be cut by the transitions of the level"): the plan comes from the song --
// tools/songplan.js cuts it at its transitions (tools/sections.js) and gives each section a mode and feel by its type
const SP = require("./songplan.js").plan(343707, { to: 75, from: OFFSET });
const PLAN = SP.sections.map(x => [x.b0, x.b1, x.mode === "cube-ud" ? "cube" : x.mode, x.type, x.mode === "cube" ? 2 : 0,
  Object.assign({ type: x.type }, x.mode === "cube-ud" ? { ud: true } : {}, x.rest ? { rest: x.rest } : {})]);

const FLY = new Set(["ship", "wave", "swing", "ufo"]), BAND = { ship: 300, ufo: 300, wave: 300, swing: 300, ball: 240, spider: 270 };
const PORTAL = { cube: "cube portal", ball: "ball portal", ship: "ship portal", robot: "robot portal", ufo: "ufo portal", wave: "wave portal", spider: "spider portal", swing: "swing portal" };
// lib/physics.js portal(): a banded mode plays in BAND units centred on its portal, the floor snapped down to a block
const bandFloor = (row, mode) => Math.max(0, Math.floor((row * 30 + 15 - BAND[mode] / 2) / 30));
const col = b => (b - 1) * P * BPS;
// the row a brick's run leaves at (its verified route's height at its last column, in rows over its floor)
const exitRow = id => { const s = ST[id], x1 = s.pic.x0 + 60 + s.width * 30; let best = s.pic.path[0];
  for (const q of s.pic.path) if (Math.abs(q[0] - x1) < Math.abs(best[0] - x1)) best = q; return Math.max(1, Math.min(7, Math.floor(best[1] / 30))); };

const objs = [], used = ["slope-down-spike", "orb-ladder-2"], report = [], seeds = [], heights = [];
// a portal in a full wall (Evgeni: flying modes skip portals): blocks over and under its 3 rows, up to 10 rows over it
const gate = (b, names, row) => { for (const n of names) objs.push([n, "b" + b, row]);
  for (let r = 0; r < row + 11; r++) if (r < row - 1 || r > row + 1) objs.push(["block", "b" + b, r]); };
// the floor by absolute column (the whole level is 1x, so a column is a column; bricks sit on whole columns, beatAt())
// only its top 3 rows: under them the fire ground deco shows (v6's first build filled every row: 22.7k objects)
// placed through beat 1 like the bricks ("b1+<c + 0.5>", as brickpick.beatAt): make.js's beat -> x carries the song grid's
// small offset (0.3 of a block here), so a floor by plain column sat 0.3 off every brick (v7 died on that lip at 51.6 s)
const fill = (c0, c1, h) => { for (let c = Math.round(c0); c < Math.round(c1); c++) for (let r = Math.max(0, h - 3); r < h; r++) objs.push(["block", "b1+" + (c + 0.5), r]); };
const CLIMB = [0, 1, 0, 1, 1, 0, 1, 0];
// v6b (Evgeni, 2026-11-26: "i want levels not to be so sparse, the beats are decently quick"; LEGO.md "Clicks and timing by
// tier": rated bricks click ~1.8-2.15 a second at every tier, ours 1.2): a 2 clicks/s target, 1-3 block joins, cube pieces
// of 2+ presses per 10 blocks, the new dense ship / wave pieces (lego-*-rapid)
const base = { slots: H.slots, grid: { period: P }, offset: OFFSET, beatCols: true, deadAir: 1.0, gap: [1, 3], beats: true, speed: "1x", targetCps: 2, fillGap: 0.25 };

let E = 0, prev = null, prevUd = false;
// the ceiling of an upside-down section: its bottom 3 rows from row C up
const fillCeil = (c0, c1, C) => { for (let c = Math.round(c0); c < Math.round(c1); c++) for (let r = C; r < C + 3; r++) objs.push(["block", "b1+" + (c + 0.5), r]); };
// pieces that flip (patterns.js "ud:<id>"): plain cube structures, not already about gravity
const { expand } = require("./patterns.js");
const flippable = b => { if (/~ud$/.test(b.id) || b.tags.some(t => /gravity|ceiling|portal/.test(t))) return false; const st = ST[b.id], pa = st && st.pic && st.pic.path;
  // flat pieces only: one that climbs leaves the flipped cube 2-4 rows off the ceiling (v8a died on pillar-climb's steps)
  if (!pa || !pa.length || Math.abs(pa[pa.length - 1][1] - pa[0][1]) > 20 || Math.max(...pa.map(q => q[1])) - pa[0][1] > 130) return false;
  try { expand("ud:" + b.id, 0, 5); return true; } catch (e) { return false; } };   // E: the floor height (rows) the player arrives on; prev: the last section's mode
PLAN.forEach(([b0, b1, mode, kind, climb, opt = {}], i) => {
  const fly = FLY.has(mode), banded = !!BAND[mode], ground = !banded;
  // v8 transitions (LEGO.md "Combining": 93% of official portals are entered on the move, ours 46% walking): out of a flight
  // the ground sits 2 rows under the portal, so the player drops into the new mode; out of the cube, a spike right before
  // the gate, so its jump carries the cube through the portal
  // opt.ud: the whole section upside down (a yellow gravity portal in the entry gate, a ceiling 3 rows over the portal, the
  // pieces flipped as "ud:<id>" patterns with no portals of their own; a blue portal in the next gate)
  const ud = !!opt.ud;
  if (prev && FLY.has(prev) && ground && !ud) E = Math.max(0, E - 2);
  let F = E, entry = E + 1;
  const gateRow = prev && FLY.has(prev) && ground && !ud ? E + 3 : entry, C = gateRow + 4;
  if (prev) gate(b0, [PORTAL[mode]].concat(ud ? ["upside down"] : prevUd ? ["normal gravity"] : []), gateRow);
  if ((prev === "cube" || prev === "robot") && !prevUd) objs.push(["spike", "b1+" + (Math.round(col(b0)) - 2.5), E]);
  if (banded) F = bandFloor(entry, mode);
  // v7: run-up after a portal (v6b's switches: a tap 246 ms after ship -> cube, a button change 133 ms after cube -> wave) and
  // a calm first second (v6b: a 50 ms tap at block 0); the last 1.5 beats before the next gate stay free
  // v8: 6 blocks into the upside-down section (it falls up 3 rows first; v8c: a 33 ms press at its entry)
  const lead = !prev ? 8 : fly || ud ? 6 : banded ? 5 : 4;
  // balanced pieces (Evgeni on v7: "some have like 2 cps without frame windows, and some seem mega hard ... we need to pick
  // balanced structures, with similar cps and frame windows"): every piece's tightest window 120 ms or more and 1.2-2.7
  // clicks a second (rated Normal / Hard bricks: p10-p90 1.1-2.4, window p10 108-150), windows close within the section
  const segs = [], rests = opt.rest || [];
  let from = b0, start = col(b0) + lead;
  for (const [ra, rb] of rests) { segs.push([from, ra, start]); from = rb; start = col(rb); }
  // the last beats before the next gate stay free: 1.5, 2.5 in a flight (it lines up with the 3-row gate)
  segs.push([from, b1 - (fly ? 2.5 : 1.5), start]);
  const r = { picks: [], presses: 0, onHit: 0, cps: [], cv: 0, tail: 0 };
  for (const [fb, tb, sc] of segs) {
    const q = pickSection(Object.assign({}, base, { mode, used, startCol: sc, fromBeat: fb, toBeat: tb, prefer: opt.prefer, filter: ud ? flippable : null,
      window: [120], cpsBand: [1.2, 3.0], targetCps: opt.type === "break" ? 1.6 : opt.type === "drop" ? 2.3 : 2, filler: mode === "cube", minDensity: opt.prefer ? 1.0 : mode === "cube" || mode === "ball" ? 1.5 : 0,
      gap: opt.prefer ? [1, 4] : base.gap, preferBonus: 8, usedPenalty: mode === "cube" ? 6 : 3, singleWidth: 6, singleRun: 1.2, max: "Hard", beam: 60 }));
    for (const p of q.picks) if (!p.j) used.push(p.id);
    r.picks.push(...q.picks); r.presses += q.presses; r.onHit += q.onHit * q.presses; r.cps.push(...q.cps); r.tail = q.tail; r.cv = Math.max(r.cv, q.cv);
  }
  r.onHit = r.presses ? r.onHit / r.presses : 0;
  // heights: a ground section walks up `climb` blocks, a block at a time, piece by piece (CLIMB wiggles it)
  let h = F, top = F;
  r.picks.forEach((p, k) => {
    if (!banded && !ud) { const goal = F + Math.round((climb || 0) * (k + 1) / r.picks.length), wig = k === r.picks.length - 1 ? 0 : CLIMB[(k + i) % CLIMB.length];
      // a step up needs its own jump: only where the run-up before the piece has room for it (v7: a step right before
      // double-rhythm's spikes left 2 blocks to land and jump again -- the seeded and the full solve both died there)
      const a = k ? r.picks[k - 1].col + r.picks[k - 1].width : col(b0) + 1, nh = Math.min(h + 1, Math.max(F, goal + wig));
      // so the step is a 45-degree slope the cube walks up (no press), at the run-up's first column, 2 blocks clear of the
      // piece's first press
      // (v7d: a slope right after a spike and 1 block before red-orb-wall~ud's gravity portal stopped the solve: the slope's
      // top throws the cube up a little) -- a block clear of the last piece, 3 before this one
      const st = Math.round(a) + 1;
      if (nh > h && p.col - st >= 3 && (p.presses.length ? p.presses[0] * BPS : p.col + p.width) - (st + 1) >= 2) { h = nh; p.step = st; }
      else if (nh < h) h = nh; }
    p.h = h; top = Math.max(top, h);
    seeds.push(...p.presses.map(t => ({ t })));
  });
  // the floor: under the section to F, and under each ground piece (and the run-up before it) to its own height
  fill(col(b0) + 1, col(b1), F, b0);
  if (ud) fillCeil(col(b0) + 1, col(b1), C);
  if (!banded && !ud) r.picks.forEach((p, k) => { const a = k ? r.picks[k - 1].col + r.picks[k - 1].width : col(b0) + 1;
    if (p.step != null) { fill(a, p.step + 1, p.h - 1, b0); objs.push(["slope", "b1+" + (p.step + 0.5), p.h - 1, {}]); fill(p.step + 1, p.col + p.width, p.h, b0); }
    else if (p.h > F) fill(a, p.col + p.width, p.h, b0); });
  const lastH = r.picks.length ? r.picks[r.picks.length - 1].h : F;
  if (!banded && !ud && lastH > F) fill(r.picks[r.picks.length - 1].col + r.picks[r.picks.length - 1].width, col(b1), lastH, b0);
  // a single spike at its press + the jump lead (2.2 blocks at 1x, make.js jumpAt), on a whole column: not "jN", which slides
  // the spike to centre its window and, between pieces, slid it onto the next one (v8b)
  const single = (p, row, flip) => ["spike", "b1+" + (Math.round(p.col + 2.2) + 0.5), row, flip ? { flipY: true } : {}];
  if (ud) for (const p of r.picks) objs.push(p.j ? single(p, C - 1, true) : ["pattern", "ud:" + p.id, beatAt(p), C - 1]);
  else for (const p of r.picks) objs.push(p.j ? single(p, p.h) : mode === "cube" ? ["pattern", "s:" + p.id, beatAt(p), p.h] : ["pattern", "s:" + p.id, beatAt(p), p.h, { raw: true }]);
  // the height the next section arrives on: a ground section's last floor; a banded one leaves where its last brick does
  const last = r.picks.filter(p => !p.j).pop();
  E = ud ? C - 2 : banded ? F + (last ? exitRow(last.id) : 2) - 1 : lastH;
  heights.push(`${mode} ${F}->${E}`);
  report.push(`b${b0}-${b1} ${mode}${kind ? " (" + kind + ")" : ""}: ${r.picks.map(p => p.id).join(", ") || "(none)"} -- ${r.presses} presses, ${Math.round(r.onHit * 100)}% on a hit, cps ${r.cps.join(" ")} (spread ${r.cv}), tail ${r.tail} blocks`);
  prev = mode; prevUd = ud;
});

const variant = { break: "molten", build: "molten", drop: "inferno", entry: "inferno", groove: "ash" };
const spec = {
  name: "GDLM 44 hellgate",
  desc: "Down through the gates of hell. Made by Claude.",
  notes: "v8 by tools/hellgate_build.js (the song from its start, balanced pieces, rests, upside down, portals on the move): 7 sections at 1x on the song's phrases, every one from verified bricks (pickSection beam search), the height through each mode's band, an auto ending",
  style: "hell", indicators: {}, signature: true, outro: 2, hazardsAlong: { tier: "normal", seed: 7 },
  scene: "tools/scenes/theme.js",
  theme: { name: "fire", sections: PLAN.map(([b0, , m, kind]) => ({ from: Math.max(0, Math.round(col(b0)) - 2), variant: variant[kind] || (FLY.has(m) ? "inferno" : "molten") })) },
  song: { custom: 343707 }, offset: OFFSET, grid: { bpm: BPM, t0: T0 },
  drop: (PLAN.find(x => x[3] === "drop") || PLAN[0])[0], pulseZones: PLAN.filter(x => x[3] !== "break").map(x => [x[0], x[1]]),
  colours: { bg: [30, 6, 6], ground: [12, 0, 0], ground2: [12, 0, 0], line: [170, 60, 20] },
  seedPresses: seeds.map(s => ({ t: +s.t.toFixed(4) })),
  objects: objs,
};
console.log(report.join("\n"));
console.log(`~${Math.round(col(PLAN[PLAN.length - 1][1]))} blocks + the outro, ${((PLAN[PLAN.length - 1][1] - 1) * P).toFixed(1)} s of gameplay; heights ${heights.join(", ")}`);
if (!process.argv.includes("--dry")) { fs.writeFileSync(path.join(ROOT, "specs", "44_hellgate.json"), JSON.stringify(spec, null, 1) + "\n"); console.log("-> specs/44_hellgate.json"); }
