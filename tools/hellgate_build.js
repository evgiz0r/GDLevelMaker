// node tools/hellgate_build.js [--dry]  -- writes specs/44_hellgate.json, GDLM 44 hellgate v6 (2026-11-26).
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
const OFFSET = 20.9615, BPM = 145.012, T0 = 1.101, P = 60 / BPM, BPS = 10.386;   // blocks a second at 1x
const H = JSON.parse(fs.readFileSync(path.join(ROOT, "local", "hits", "343707.json"), "utf8"));
if (Math.abs(H.t0 - T0) > 1e-3) throw new Error("local/hits/343707.json is on another grid: run node tools/hits.js 343707 --bpm 145.012 --t0 1.101 --downbeat 0");
const ST = JSON.parse(fs.readFileSync(path.join(ROOT, "knowledge", "structures.json"), "utf8")).structures;

// [from beat, to beat, mode, kind, climb (blocks a ground section ends above its start)]; the song (local/hits/343707.json):
// quiet to b16, the kick at b17, a big kick at b33, drums at b49, loud from b57, louder from b85, the loudest from b117
const PLAN = [
  [1, 17, "cube", "intro", 2], [17, 33, "ship", "the drop"], [33, 57, "cube", "big kick, drums", 5], [57, 73, "wave", "loud"],
  [73, 89, "ball", ""], [89, 105, "ship", "louder"], [105, 141, "cube", "the loudest", 5],
];
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
const fill = (c0, c1, h) => { for (let c = Math.round(c0); c < Math.round(c1); c++) for (let r = Math.max(0, h - 3); r < h; r++) objs.push(["block", c, r]); };
const CLIMB = [0, 1, 0, 1, 1, 0, 1, 0];
// v6b (Evgeni, 2026-11-26: "i want levels not to be so sparse, the beats are decently quick"; LEGO.md "Clicks and timing by
// tier": rated bricks click ~1.8-2.15 a second at every tier, ours 1.2): a 2 clicks/s target, 1-3 block joins, cube pieces
// of 2+ presses per 10 blocks, the new dense ship / wave pieces (lego-*-rapid)
const base = { slots: H.slots, grid: { period: P }, offset: OFFSET, beatCols: true, deadAir: 1.0, gap: [1, 3], beats: true, speed: "1x", targetCps: 2, fillGap: 0.25 };

let E = 0, prev = null;   // E: the floor height (rows) the player arrives on; prev: the last section's mode
PLAN.forEach(([b0, b1, mode, kind, climb], i) => {
  const fly = FLY.has(mode), banded = !!BAND[mode];
  // the entry: a walled portal (none at the start)
  let F = E, entry = E + 1;
  if (prev) gate(b0, [PORTAL[mode]], entry);
  if (banded) F = bandFloor(entry, mode);
  // v7: run-up after a portal (v6b's switches: a tap 246 ms after ship -> cube, a button change 133 ms after cube -> wave) and
  // a calm first second (v6b: a 50 ms tap at block 0); the last 1.5 beats before the next gate stay free
  const lead = !prev ? 8 : fly ? 6 : banded ? 5 : 4;
  const r = pickSection(Object.assign({}, base, { mode, used, startCol: col(b0) + lead, fromBeat: b0, toBeat: b1 - 1.5,
    filler: mode === "cube", minDensity: mode === "cube" || mode === "ball" ? 1.5 : 0, usedPenalty: mode === "cube" ? 6 : 1.5, singleRun: 1.2, max: "Hard", beam: 60 }));
  for (const p of r.picks) if (!p.j) used.push(p.id);
  // heights: a ground section walks up `climb` blocks, a block at a time, piece by piece (CLIMB wiggles it)
  let h = F, top = F;
  r.picks.forEach((p, k) => {
    if (!banded) { const goal = F + Math.round((climb || 0) * (k + 1) / r.picks.length), wig = k === r.picks.length - 1 ? 0 : CLIMB[(k + i) % CLIMB.length];
      h = Math.min(h + 1, Math.max(F, goal + wig)); }
    p.h = h; top = Math.max(top, h);
    seeds.push(...p.presses.map(t => ({ t })));
  });
  // the floor: under the section to F, and under each ground piece (and the run-up before it) to its own height
  fill(col(b0) + 1, col(b1), F, b0);
  if (!banded) r.picks.forEach((p, k) => { const a = k ? r.picks[k - 1].col + r.picks[k - 1].width : col(b0) + 1; if (p.h > F) fill(a, p.col + p.width, p.h, b0); });
  const lastH = r.picks.length ? r.picks[r.picks.length - 1].h : F;
  if (!banded && lastH > F) fill(r.picks[r.picks.length - 1].col + r.picks[r.picks.length - 1].width, col(b1), lastH, b0);
  for (const p of r.picks) objs.push(p.j ? ["pattern", "single", "j" + p.beat, p.h] : mode === "cube" ? ["pattern", "s:" + p.id, beatAt(p), p.h] : ["pattern", "s:" + p.id, beatAt(p), p.h, { raw: true }]);
  // the height the next section arrives on: a ground section's last floor; a banded one leaves where its last brick does
  const last = r.picks.filter(p => !p.j).pop();
  E = banded ? F + (last ? exitRow(last.id) : 2) - 1 : lastH;
  heights.push(`${mode} ${F}->${E}`);
  report.push(`b${b0}-${b1} ${mode}${kind ? " (" + kind + ")" : ""}: ${r.picks.map(p => p.id).join(", ") || "(none)"} -- ${r.presses} presses, ${Math.round(r.onHit * 100)}% on a hit, cps ${r.cps.join(" ")} (spread ${r.cv}), tail ${r.tail} blocks`);
  prev = mode;
});

const variant = { intro: "molten", "the drop": "inferno", "big kick, drums": "molten", loud: "inferno", louder: "inferno", "the loudest": "ash" };
const spec = {
  name: "GDLM 44 hellgate",
  desc: "Down through the gates of hell. Made by Claude.",
  notes: "v7 by tools/hellgate_build.js (run-up after portals, guards along the route): 7 sections at 1x on the song's phrases, every one from verified bricks (pickSection beam search), the height through each mode's band, an auto ending",
  style: "hell", indicators: {}, signature: true, outro: 2, hazardsAlong: { tier: "normal", seed: 7 },
  scene: "tools/scenes/theme.js",
  theme: { name: "fire", sections: PLAN.map(([b0, , m, kind]) => ({ from: Math.max(0, Math.round(col(b0)) - 2), variant: variant[kind] || (FLY.has(m) ? "inferno" : "molten") })) },
  song: { custom: 343707 }, offset: OFFSET, grid: { bpm: BPM, t0: T0 },
  drop: 17, pulseZones: [[17, 33], [57, 73], [105, 141]],
  colours: { bg: [30, 6, 6], ground: [12, 0, 0], ground2: [12, 0, 0], line: [170, 60, 20] },
  seedPresses: seeds.map(s => ({ t: +s.t.toFixed(4) })),
  objects: objs,
};
console.log(report.join("\n"));
console.log(`~${Math.round(col(141))} blocks + the outro, ${(140 * P).toFixed(1)} s of gameplay; heights ${heights.join(", ")}`);
if (!process.argv.includes("--dry")) { fs.writeFileSync(path.join(ROOT, "specs", "44_hellgate.json"), JSON.stringify(spec, null, 1) + "\n"); console.log("-> specs/44_hellgate.json"); }
