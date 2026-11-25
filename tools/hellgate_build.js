// node tools/hellgate_build.js [--dry]  -- writes specs/44_hellgate.json, GDLM 44 hellgate v3 (2026-11-25, Evgeni: "redo it
//   completely ... helish theme, on the beat, lets start with 1 minute long"), by the pipeline in LEGO.md "The build
//   pipeline Evgeni set": song -> sections at the song's boundaries -> each section filled from our own verified bricks
//   whose presses land on the song's real hits (tools/brickpick.js) -> fly sections as smooth fly-path corridors -> the
//   fire theme kit Evgeni picked (tools/themes/fire.js, via tools/scenes/theme.js). Then: node tools/make.js specs/44_hellgate.json, node tools/hits.js --level.
// The song: Infertehno 2 (343707) from 19.306 s, 1 min. Its whole-song beat grid is low confidence (100 ms drift, half a
//   beat off here); this part alone is 145.012 BPM with bars from 1.101 s (beats.js on a cut: drift 5 ms, high), so the
//   spec pins that grid and hits come from `node tools/hits.js 343707 --bpm 145.012 --t0 1.101 --downbeat 0`.
// Sections (level beats; b1 = the level's start, on a downbeat; song bar = level bar + 12):
//   b1-21 intro, quiet (no hits detected): cube on the grid's beats  | b21 the drop (song 27.6 s): ship
//   b37-61 cube on the hits | b61-90 wave | b91-105 ball | b105-145 cube, the climax (Hard bricks allowed)
"use strict";
const fs = require("fs"), path = require("path");
const { pick } = require("./brickpick.js");
const ROOT = path.join(__dirname, "..");
const OFFSET = 19.3064, BPM = 145.012, T0 = 1.101, P = 60 / BPM, V = 0.9 * 5.77000189 * 60 / 30;   // blocks per second at 1x
const col = b => (b - 1) * P * V;
const H = JSON.parse(fs.readFileSync(path.join(ROOT, "local", "hits", "343707.json"), "utf8"));
if (Math.abs(H.t0 - T0) > 1e-3) throw new Error("local/hits/343707.json is on another grid: run node tools/hits.js 343707 --bpm 145.012 --t0 1.101 --downbeat 0");
const base = { slots: H.slots, grid: { period: P }, offset: OFFSET, speed: "1x" };
// never picked here: slope-down-spike (its jump off the slope is a prejump, block 56 in v3), orb-ladder-2 (after a
//   single its 3 orb taps came under 500 ms apart: fairness "chain")
const used = ["slope-down-spike", "orb-ladder-2"], objs = [], report = [], plan = [];
const fill = (name, o) => {
  const r = pick(Object.assign({}, base, { used }, o));
  for (const p of r.picks) if (!p.j) used.push(p.id);
  objs.push(...r.objects);
  const t0 = (o.startCol ?? col(o.fromBeat)) / V, t1 = r.endCol / V;
  plan.push({ name, t0: +t0.toFixed(3), t1: +t1.toFixed(3), presses: r.picks.flatMap(p => p.presses) });
  report.push(`${name}: ${r.picks.map(p => p.id).join(", ")} -- ${r.presses} presses, ${Math.round(r.onHit * 100)}% on a hit`);
  return r;
};
// fly-path width (tools/patterns.js): lead + sum |rise| + flat * (knots - 1) + tail
const flyW = a => a.lead + a.rows.slice(1).reduce((s, r, i) => s + Math.abs(r - a.rows[i]), 0) + a.flat * (a.rows.length - 1) + a.tail;

// 1. intro: cube on the beats, from 8 blocks in to a calm run-up before the drop's portal
fill("intro b1-21 (cube, on the beats)", { mode: "cube", startCol: 8, fromBeat: 1, toBeat: 19.5, beats: true });
// 2. the drop: a ship corridor, entry portal on b21
const ship = { mode: "ship", rows: [3, 6, 2, 5, 3, 6, 4], flat: 7, lead: 3, tail: 2, gap: 5, spikes: "both", every: 5, gates: [2, 4], gateGap: 4, portal: true, portalRow: 3, exit: "cube" };
const shipCol = Math.round(col(21)) + 1;
objs.push(["pattern", "fly-path", shipCol, 0, ship]);
const shipEnd = shipCol + flyW(ship) + 1;
// 3. cube on the hits
fill("b37-61 (cube, on the hits)", { mode: "cube", startCol: shipEnd + 6, fromBeat: 37, toBeat: 60 });
// 4. wave: hills of changing height (no two legs alike in a row), exit straight into the ball
const wave = { mode: "wave", rows: [2, 6, 3, 7, 2, 5, 4, 8, 3, 6, 2, 7, 4, 6, 2, 8, 3, 5, 2, 6, 3], flat: 2, lead: 4, tail: 3, gap: 5, spikes: "turns", portal: true, portalRow: 2, exit: "ball" };
const waveCol = Math.round(col(61)) + 1;
objs.push(["pattern", "fly-path", waveCol, 0, wave]);
const waveEnd = waveCol + flyW(wave) + 1;
// 5. ball bricks (no spike filler outside the cube), back to the cube on b105
fill("b91-105 (ball)", { mode: "ball", startCol: waveEnd + 5, fromBeat: 91, toBeat: 104, filler: false });
const cubeCol = Math.round(col(105));
objs.push(["cube portal", cubeCol, 1]);
// 6. the climax: cube on the hits, Hard bricks allowed
const climax = fill("b105-145 (cube climax, on the hits)", { mode: "cube", startCol: cubeCol + 6, fromBeat: 105, toBeat: 145, max: "Hard" });

const endCol = climax.endCol;
const spec = {
  name: "GDLM 44 hellgate",
  desc: "Down through the gates of hell: every jump on the beat. Made by Claude.",
  notes: "v3, rebuilt from scratch by tools/hellgate_build.js (sections at the song's boundaries, our verified bricks on its hits)",
  style: "hell", indicators: {}, signature: true,
  // the deco: Evgeni's picks from the deco gallery, the fire theme kit (tools/themes/fire.js): molten for the cube and
  // ball, inferno for the drops (ship, wave, the climax), ash for the ending
  scene: "tools/scenes/theme.js",
  theme: { name: "fire", sections: [{ from: 0, variant: "molten" }, { from: shipCol - 4, variant: "inferno" }, { from: shipEnd + 2, variant: "molten" },
    { from: waveCol - 4, variant: "inferno" }, { from: waveEnd + 2, variant: "molten" }, { from: cubeCol, variant: "inferno" }, { from: endCol - 12, variant: "ash" }] },
  song: { custom: 343707 }, offset: OFFSET, grid: { bpm: BPM, t0: T0 },
  drop: 21, pulseZones: [[21, 37], [117, 145]],
  colours: { bg: [30, 6, 6], ground: [12, 0, 0], ground2: [12, 0, 0], line: [170, 60, 20] },
  objects: objs,
};
console.log(report.join("\n"));
console.log(`ship cols ${shipCol}-${shipEnd} (b${(shipCol / P / V + 1).toFixed(1)}-b${(shipEnd / P / V + 1).toFixed(1)}), wave ${waveCol}-${waveEnd} (b${(waveCol / P / V + 1).toFixed(1)}-b${(waveEnd / P / V + 1).toFixed(1)}), cube portal ${cubeCol}`);
if (!process.argv.includes("--dry")) { fs.writeFileSync(path.join(ROOT, "specs", "44_hellgate.json"), JSON.stringify(spec, null, 1) + "\n");
  // the planned presses (level seconds) of the brick sections: the route a player pressing on the hits takes
  fs.writeFileSync(path.join(ROOT, "specs", "44_hellgate.plan.json"), JSON.stringify(plan, null, 1) + "\n"); console.log("-> specs/44_hellgate.json, specs/44_hellgate.plan.json"); }
