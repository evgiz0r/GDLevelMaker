// node tools/hellgate_build.js [--dry]  -- writes specs/44_hellgate.json, GDLM 44 hellgate v4 (2026-11-25).
//   v3 (Evgeni: "redo it completely ... helish theme, on the beat, lets start with 1 minute long") came out 60% cube
//   in three look-alike cube parts: the brick picker only took same-mode bricks at 1x, so no variety (Evgeni: "why is it
//   a cube 90%", "we know many modes", "no variance"). v4: 12 sections of 3-7 s, changing where the song's drums
//   come in, 9 modes, faster where it is louder, gravity flips and a mini part. And his rule for it: "watch out with things that fly, and
//   can skip portals (almost anything but cube basically)" -- every portal stands in a full wall (gate()), so no mode
//   can go over or under it; score.js "skips" checks it.
// How each section is made: ground modes (cube, ball, robot, ufo, spider) from our own verified bricks on the song's hits
//   (tools/brickpick.js, placed by beat so earlier speed portals don't shift them); mini and the 0.5x ending from single
//   spikes timed on the hits ("j<beat>"); flying modes (ship, wave, swing) as smooth fly-path corridors sized to fill
//   their section at its speed, exiting through a walled portal into the next mode.
// The song: Infertehno 2 (343707) from 19.306 s, 1 min, on its local grid (145.012 BPM, bars from 1.101 s; SYNC.md).
"use strict";
const fs = require("fs"), path = require("path");
const { pick } = require("./brickpick.js");
const ROOT = path.join(__dirname, "..");
const OFFSET = 19.3064, BPM = 145.012, T0 = 1.101, P = 60 / BPM;
const BPS = { "0.5x": 8.372, "1x": 10.386, "2x": 12.914, "3x": 15.6 };   // blocks per second (lib/physics.js SPEEDS x * 60 / 30)
const H = JSON.parse(fs.readFileSync(path.join(ROOT, "local", "hits", "343707.json"), "utf8"));
if (Math.abs(H.t0 - T0) > 1e-3) throw new Error("local/hits/343707.json is on another grid: run node tools/hits.js 343707 --bpm 145.012 --t0 1.101 --downbeat 0");

// the plan shown to Evgeni (thread, 2026-11-25 22:54): [from beat, to beat, mode, speed, kind]
const PLAN = [
  // revised on Evgeni's note (22:56): "on some high beats it should enter a different section. the more heavy it is, the
  // more chances we can increase speed" -- the song's kick and loudness per beat (local/hits/343707.json): quiet b1-20,
  // the kick comes in at b21, a big kick at b37, drums at b53 (his example), loud from b61, louder from b89, the
  // loudest from b121-125 to the end. So the changes sit there and the loud end is fast, not a calm ending.
  [1, 13, "cube", "1x", "intro"], [13, 21, "ball", "1x", "build-up"], [21, 37, "ship", "2x", "the drop"],
  [37, 45, "robot", "1x", "big kick"], [45, 53, "ufo", "1x", ""], [53, 61, "cube", "2x", "drums come in"],
  [61, 77, "wave", "2x", "gravity flips"], [77, 89, "spider", "1x", ""], [89, 105, "swing", "2x", "louder"],
  [105, 121, "mini", "1x", "climax"], [121, 137, "ship", "3x", "the loudest"], [137, 147, "cube", "2x", "the end, still loud"],
];
const FLY = new Set(["ship", "wave", "swing"]);
const PORTAL = { cube: "cube portal", mini: "cube portal", ball: "ball portal", ship: "ship portal", robot: "robot portal",
  ufo: "ufo portal", wave: "wave portal", spider: "spider portal", swing: "swing portal" };
// block column of a beat, through the speed changes
const colOf = b => { let c = 0; for (const [a, z, , sp] of PLAN) { if (b <= a) break; c += (Math.min(b, z) - a) * P * BPS[sp]; } return c; };

const objs = [], used = ["slope-down-spike", "orb-ladder-2"], report = [];
// a portal in a full wall: blocks above and below its 3 rows up to row 9, so nothing flies over or under it
const gate = (at, names, row) => {
  for (const n of names) objs.push([n, at, row]);
  for (let r = 0; r < 10; r++) if (r < row - 1 || r > row + 1) objs.push(["block", at, r]);
};
// the floor climbs (Evgeni, 23:00: "move up along the y axis a bit here and there (making the ground higher and higher) so
// it doesnt feel static on the ground"): in cube / mini / robot / ufo sections each piece stands on a floor 0-4 blocks
// up, one block higher or lower than the last (a cube steps up a block with a jump; down is a drop), back to the ground
// before the section ends (the next portal's wall starts at row 3). Ball and spider stay low: a ball or a spider can't
// step up a block (its flip would take it to a ceiling). Placed by beat like the pieces: "b<b0>+<columns>".
const CLIMB = [1, 2, 1, 3, 2, 3, 4, 3, 2, 1, 2, 3];
const rise = (b0, vcol, picks, mode) => {
  if (!["cube", "mini", "robot", "ufo"].includes(mode)) return null;
  const out = []; let h = 0, k = 0;
  picks.forEach((p, i) => {
    const prevEnd = i ? picks[i - 1].col + picks[i - 1].width : p.col - 2;
    let nh = CLIMB[(k++ + b0) % CLIMB.length]; if (nh > h + 1) nh = h + 1;      // up one at most
    h = nh;
    const a = Math.round(prevEnd - vcol), z = Math.round(p.col + p.width - vcol);
    for (let c = a; c < z; c++) for (let r = 0; r < h; r++) out.push(["block", `b${b0}+${c}`, r]);
    p.h = h;
  });
  return out;
};
const base = { slots: H.slots, grid: { period: P }, offset: OFFSET, used, beatCols: true, deadAir: 1.0 };

PLAN.forEach(([b0, b1, mode, sp, kind], i) => {
  const prev = PLAN[i - 1], label = `b${b0}-${b1} ${mode} ${sp}${kind ? " (" + kind + ")" : ""}`;
  const vcol = (b0 - 1) * P * BPS[sp];                                    // brickpick's virtual column of the start at this speed
  if (FLY.has(mode)) return;                                              // placed by the section before (its exit)
  // the entry: a walled portal on the bar (from a fly-path the exit portal already stands in its wall)
  if (i > 0 && !FLY.has(prev[2])) {
    const names = [];
    if (PORTAL[mode] !== PORTAL[prev[2]]) names.push(PORTAL[mode]);
    if (sp !== prev[3]) names.push(sp + " speed");
    if (mode === "mini") names.push(101); if (prev[2] === "mini") names.push(99);
    if (names.length) gate("b" + b0, names, 1);
  }
  if (mode === "mini") {
    // single spikes timed on the hits (no verified bricks at this size / speed)
    const r = pick(Object.assign({}, base, { mode: "cube", speed: sp, startCol: vcol + 4, fromBeat: b0, toBeat: b1 - 1, max: "Easy", beats: true, fillerOnly: true }));
    const ps = r.picks.filter(p => p.j), floor = rise(b0, vcol, ps, mode);
    const singles = ps.map(p => ["pattern", "single", "j" + p.beat, p.h || 0]);
    objs.push(...floor, ...singles);
    report.push(`${label}: ${singles.length} spikes on the hits`);
  } else {
    const r = pick(Object.assign({}, base, { mode, speed: sp, startCol: vcol + 4, fromBeat: b0, toBeat: b1 - 0.5, beats: true, usedPenalty: 1.2,
      filler: mode === "cube", max: sp !== "1x" || kind === "climax" ? "Hard" : "Normal" }));
    for (const p of r.picks) if (!p.j) used.push(p.id);
    const floor = rise(b0, vcol, r.picks, mode);
    if (floor) objs.push(...floor, ...r.picks.map(p => p.j ? ["pattern", "single", "j" + p.beat, p.h] : mode === "cube" ? ["pattern", "s:" + p.id, "b" + p.beat, p.h] : ["pattern", "s:" + p.id, "b" + p.beat, p.h, { raw: true }]));
    else objs.push(...r.objects);
    report.push(`${label}: ${r.picks.map(p => p.id).join(", ") || "(none)"} -- ${r.presses} presses, ${Math.round(r.onHit * 100)}% on a hit`);
  }
  // the next section flies: its corridor, sized to fill its bars at its speed, exiting into the one after
  const nx = PLAN[i + 1];
  if (nx && FLY.has(nx[2])) {
    const [f0, f1, fm, fsp] = nx, after = PLAN[i + 2];
    const width = Math.floor((f1 - f0) * P * BPS[fsp]) - 2;
    const heights = fm === "wave" ? [2, 6, 3, 7, 2, 5, 4, 8, 3, 6, 2, 7, 4, 6, 2, 8, 3, 6, 2, 7, 3, 5]
      : fm === "swing" ? [2, 5, 3, 6, 2, 6, 3, 5, 2, 6, 4, 2] : [2, 5, 3, 6, 2, 5, 3, 6, 4, 2, 5, 3];
    const flat = fm === "wave" ? 2 : fm === "swing" ? 5 : 6, lead = 4;
    const rows = [heights[0]]; let w = lead;
    for (let k = 1; k < heights.length; k++) { const add = Math.abs(heights[k] - rows[rows.length - 1]) + flat; if (w + add + 3 > width) break; rows.push(heights[k]); w += add; }
    const tail = Math.max(3, width - w);
    const a = { mode: fm, rows, flat, lead, tail, gap: fm === "wave" ? 4 : 5, spikes: fm === "wave" ? "turns" : "both", every: 5,
      exit: after ? (after[2] === "mini" ? "cube" : after[2]) : undefined };
    if (fm === "wave") a.turns = "mix";                                   // gravity portals at every other turn
    if (fm === "ship") a.gates = [2, 4];
    // the entry portal (with the speed) in a wall at row 1, then the corridor from the next column
    const names = [PORTAL[fm]]; if (fsp !== sp) names.push(fsp + " speed"); if (mode === "mini") names.push(99);
    gate("b" + f0, names, 1);
    objs.push(["pattern", "fly-path", "b" + f0 + "+1", 0, a]);
    // leaving: the exit portal stands in the corridor's end wall; the speed (and size) change in the same column
    const exitAt = "b" + f0 + "+" + (1 + w + tail), er = rows[rows.length - 1];
    if (after && after[3] !== fsp) objs.push([after[3] + " speed", exitAt, er]);
    if (after && after[2] === "mini") objs.push([101, exitAt, er]);
    report.push(`b${f0}-${f1} ${fm} ${fsp}: fly-path ${rows.join("-")}, ${width} blocks`);
  }
});

const endCol = Math.round(colOf(147));
const variant = { intro: "molten", "the drop": "inferno", "drums come in": "inferno", "the loudest": "inferno", "the end, still loud": "ash" };
const spec = {
  name: "GDLM 44 hellgate",
  desc: "Down through the gates of hell, every mode on the way down. Made by Claude.",
  notes: "v4 by tools/hellgate_build.js: 12 sections on the song's bars, 9 modes, 4 speeds; every portal walled (no skips)",
  style: "hell", indicators: {}, signature: true,
  // the deco: Evgeni's picks from the deco gallery, the fire theme kit (tools/themes/fire.js)
  scene: "tools/scenes/theme.js",
  theme: { name: "fire", sections: PLAN.map(([b0, , m, , kind]) => ({ from: Math.max(0, Math.round(colOf(b0)) - 2), variant: variant[kind] || (FLY.has(m) ? "inferno" : "molten") })) },
  song: { custom: 343707 }, offset: OFFSET, grid: { bpm: BPM, t0: T0 },
  drop: 21, pulseZones: [[21, 37], [53, 77], [121, 147]],
  colours: { bg: [30, 6, 6], ground: [12, 0, 0], ground2: [12, 0, 0], line: [170, 60, 20] },
  objects: objs,
};
console.log(report.join("\n"));
console.log(`~${endCol} blocks, 60.8 s`);
if (!process.argv.includes("--dry")) { fs.writeFileSync(path.join(ROOT, "specs", "44_hellgate.json"), JSON.stringify(spec, null, 1) + "\n"); console.log("-> specs/44_hellgate.json"); }
