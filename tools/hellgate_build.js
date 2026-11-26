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
// The song: Infertehno 2 (343707) from 20.962 s, 1 min, on its local grid (145.012 BPM, bars from 1.101 s; SYNC.md).
// v5 (Evgeni on v4, 2026-11-26): the song started mid-phrase ("its wierd that the song starts in the middle of some
//   rythim"): it now starts on a 4-bar phrase, one phrase before the kick comes in (song 27.58 s = b17); and the height
//   carries over from section to section instead of resetting at every portal ("between sections we always reset ...
//   none of them goes up twice"), with shorter buffers between sections ("we need smaller buffers").
"use strict";
const fs = require("fs"), path = require("path");
const { pick } = require("./brickpick.js");
const ROOT = path.join(__dirname, "..");
const OFFSET = 20.9615, BPM = 145.012, T0 = 1.101, P = 60 / BPM;
const BPS = { "0.5x": 8.372, "1x": 10.386, "2x": 12.914, "3x": 15.6 };   // blocks per second (lib/physics.js SPEEDS x * 60 / 30)
const H = JSON.parse(fs.readFileSync(path.join(ROOT, "local", "hits", "343707.json"), "utf8"));
if (Math.abs(H.t0 - T0) > 1e-3) throw new Error("local/hits/343707.json is on another grid: run node tools/hits.js 343707 --bpm 145.012 --t0 1.101 --downbeat 0");

// the plan shown to Evgeni (thread, 2026-11-25 22:54): [from beat, to beat, mode, speed, kind]
const PLAN = [
  // revised on Evgeni's note (22:56): "on some high beats it should enter a different section. the more heavy it is, the
  // more chances we can increase speed" -- the song's kick and loudness per beat (local/hits/343707.json): quiet b1-20,
  // the kick comes in at b21, a big kick at b37, drums at b53 (his example), loud from b61, louder from b89, the
  // loudest from b121-125 to the end. So the changes sit there and the loud end is fast, not a calm ending.
  // (v5: the song starts 4 beats later, on a phrase, so every change sits 4 beats earlier than in v4: the kick at b17)
  [1, 9, "cube", "1x", "intro"], [9, 17, "ball", "1x", "build-up"], [17, 33, "ship", "2x", "the drop"],
  [33, 41, "robot", "1x", "big kick"], [41, 49, "ufo", "1x", ""], [49, 57, "cube", "2x", "drums come in"],
  [57, 73, "wave", "2x", ""], [73, 81, "spider", "1x", ""], [81, 101, "swing", "2x", "louder"],
  [101, 117, "mini", "1x", "climax"], [117, 133, "ship", "3x", "the loudest"], [133, 147, "cube", "2x", "the end, still loud"],
];
const FLY = new Set(["ship", "wave", "swing"]);
// each ground section's floor height in blocks (Evgeni on v4, 23:44: "we still remain almost on the ground every section"):
// a fly section leaves through its exit portal at any height, so the next section can start up high; ground -> ground
// steps go up at most one block (a ufo flies up any height). The ball stays on the ground (it can't step up).
// v5: END = the floor height (blocks) each section ENDS on; the next one starts there (no reset). Ground sections climb
// to it piece by piece; fly sections exit at it. Up twice in a row, then down, then up again: a level that rises overall.
// Fly sections only go up (a fly-path exits above its floor); ground sections climb or drop (a cube falls any height).
// (the ufo stays level: v5's first build climbed it a block onto its orb-over-a-wall piece and the solver could not get over)
const END = [2, 2, 7, 9, 9, 6, 11, 11, 14, 12, 16, 13];
const START = END.map((_, i) => i ? END[i - 1] : 0);
const PORTAL = { cube: "cube portal", mini: "cube portal", ball: "ball portal", ship: "ship portal", robot: "robot portal",
  ufo: "ufo portal", wave: "wave portal", spider: "spider portal", swing: "swing portal" };
// block column of a beat, through the speed changes
const colOf = b => { let c = 0; for (const [a, z, , sp] of PLAN) { if (b <= a) break; c += (Math.min(b, z) - a) * P * BPS[sp]; } return c; };

const objs = [], used = ["slope-down-spike", "orb-ladder-2"], report = [];
// a portal in a full wall: blocks above and below its 3 rows up to row 9, so nothing flies over or under it
const gate = (at, names, row) => {
  for (const n of names) objs.push([n, at, row]);
  for (let r = 0; r < Math.max(10, row + 10); r++) if (r < row - 1 || r > row + 1) objs.push(["block", at, r]);
};
// a section's floor: blocks under its whole width up to its base height
const floorOf = (b0, b1, sp, B) => { const out = [], w = Math.ceil((b1 - b0) * P * BPS[sp]);
  for (let c = 1; c < w; c++) for (let r = 0; r < B; r++) out.push(["block", `b${b0}+${c}`, r]); return out; };
// the floor climbs (Evgeni, 23:00: "move up along the y axis a bit here and there (making the ground higher and higher) so
// it doesnt feel static on the ground"): in cube / mini / robot / ufo sections each piece stands on a floor 0-4 blocks
// up, one block higher or lower than the last (a cube steps up a block with a jump; down is a drop), back to the ground
// before the section ends (the next portal's wall starts at row 3). Ball and spider stay low: a ball or a spider can't
// step up a block (its flip would take it to a ceiling). Placed by beat like the pieces: "b<b0>+<columns>".
const CLIMB = [1, 2, 1, 3, 2, 3, 4, 3, 2, 1, 2, 3];
const rise = (b0, vcol, picks, mode, B = 0, D = 0, F = B) => {   // F: the floor's own top under the section (pieces stand on columns from F)
  if (!["cube", "robot"].includes(mode)) { for (const p of picks) p.h = B; rise.end = B; return []; }   // (mini stays level: v5 died at 48 s where a mini cube met a block step)
  const out = []; let h = 0, k = 0;
  picks.forEach((p, i) => {
    const prevEnd = i ? picks[i - 1].col + picks[i - 1].width : p.col - 2;
    // v5: walk toward D (this section's climb), a block of wiggle from CLIMB on the way, the last piece on D
    const goal = Math.round(D * (i + 1) / picks.length), wig = i === picks.length - 1 ? 0 : (CLIMB[(k++ + b0) % CLIMB.length] % 2);
    let nh = Math.max(F - B, goal + wig); if (nh > h + 1) nh = h + 1;      // up one at most (down any height)
    h = nh;
    const a = Math.round(prevEnd - vcol), z = Math.round(p.col + p.width - vcol);
    for (let c = a; c < z; c++) for (let r = F; r < B + h; r++) out.push(["block", `b${b0}+${c}`, r]);
    p.h = B + h;
  });
  rise.end = B + h;
  return out;
};
// gaps of 2-4 blocks between pieces and no thin pieces (Evgeni on v4: "the gaps between structures is too long, some of
// them are way too boring"): minDensity = presses per 10 blocks
const base = { slots: H.slots, grid: { period: P }, offset: OFFSET, used, beatCols: true, deadAir: 1.0, gap: [2, 4], minDensity: 1.5 };
const ACT = END.slice();   // the height each section really ends on (a short section may not reach its END)

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
    if (names.length) gate("b" + b0, names, ACT[i - 1] + 1);
  }
  // a banded mode (ball, spider, ufo) gets a play band of BAND units centred on its portal (lib/physics.js portal(): floor =
  // the portal's y - BAND/2, snapped down to a block); its section's floor is that band's floor, else the band's roof sits
  // low over a raised floor (v5's first build: the ufo entered 9 blocks up, its band roof 5 blocks over the floor, and its
  // orb-over-a-wall piece needed 6 -- dead at 18 s). So the player drops a few blocks after such a portal.
  const BANDU = { ball: 240, spider: 270, ufo: 300 }, prevEnd = i ? ACT[i - 1] : 0;
  const B = BANDU[mode] && i ? Math.max(0, Math.floor(((prevEnd + 1) * 30 + 15 - BANDU[mode] / 2) / 30)) : prevEnd, D = END[i] - B, climbs = ["cube", "robot"].includes(mode), F = climbs ? Math.min(B, END[i]) : B;
  ACT[i] = B;
  objs.push(...floorOf(b0, b1, sp, F));
  if (mode === "mini") {
    // single spikes timed on the hits (no verified bricks at this size / speed)
    const r = pick(Object.assign({}, base, { mode: "cube", speed: sp, startCol: vcol + 2, fromBeat: b0, toBeat: b1 - 1, max: "Easy", beats: true, fillerOnly: true }));
    const ps = r.picks.filter(p => p.j), floor = rise(b0, vcol, ps, mode, B, D, F); ACT[i] = rise.end ?? B;
    const singles = ps.map(p => ["pattern", "single", "j" + p.beat, p.h || 0]);
    objs.push(...floor, ...singles);
    report.push(`${label}: ${singles.length} spikes on the hits`);
  } else {
    const r = pick(Object.assign({}, base, { mode, speed: sp, startCol: vcol + 2, fromBeat: b0, toBeat: b1 - 0.5, beats: true, usedPenalty: 1.2,
      filler: mode === "cube" || mode === "robot", max: sp !== "1x" || kind === "climax" ? "Hard" : "Normal" }));
    for (const p of r.picks) if (!p.j) used.push(p.id);
    rise.end = B; const floor = rise(b0, vcol, r.picks, mode, B, D, F); ACT[i] = rise.end;
    objs.push(...floor, ...r.picks.map(p => p.j ? ["pattern", "single", "j" + p.beat, p.h] : mode === "cube" ? ["pattern", "s:" + p.id, "b" + p.beat, p.h] : ["pattern", "s:" + p.id, "b" + p.beat, p.h, { raw: true }]));
    report.push(`${label}: ${r.picks.map(p => p.id).join(", ") || "(none)"} -- ${r.presses} presses, ${Math.round(r.onHit * 100)}% on a hit`);
  }
  // the next section flies: its corridor, sized to fill its bars at its speed, exiting into the one after
  const nx = PLAN[i + 1];
  if (nx && FLY.has(nx[2])) {
    const [f0, f1, fm, fsp] = nx, after = PLAN[i + 2];
    const width = Math.floor((f1 - f0) * P * BPS[fsp]) - 2;
    const heights = fm === "wave" ? [2, 6, 3, 7, 2, 5, 4, 8, 3, 6, 2, 7, 4, 6, 2, 8, 3, 6, 2, 7, 3, 5]
      : fm === "swing" ? [2, 5, 3, 6, 2, 6, 3, 5, 2, 6, 4, 2] : [2, 5, 3, 6, 2, 5, 3, 6, 4, 2, 5, 3];
    const flat = fm === "wave" ? 2 : fm === "swing" ? 5 : 6, lead = 3;
    // the corridor sits on this section's floor (Bp) and its last knot leads to the exit portal one row above the next
    // section's floor (Bn; when that is lower, the player drops after the portal)
    // v5: it enters at this section's end height and leaves at its own END (so the next starts there, no reset)
    // ...and stays inside its play band: 10 blocks centred on its entry portal at Bp + 1 (lib/physics.js), so the corridor's
    // roof (a knot + its gap) may reach the band's roof and no higher (above it the player meets an unseen ceiling)
    // So the corridor is built on the band's floor Bc (the portal's row - 5, snapped; 0 at most), its knots 1..10-gap above it,
    // the first one level with the entry portal. A fly section can climb only ~1 block over its entry this way: the climbs
    // come from the ground sections (a cube steps up any number of blocks).
    const Bp = ACT[i], gapB = fm === "wave" ? 4 : 5, Bc = Math.max(0, Math.floor(((Bp + 1) * 30 + 15 - 150) / 30)), maxRow = 10 - gapB;
    const L = Math.max(2, Math.min(maxRow, END[i + 1] - Bc + 1));
    const rows = [Math.max(1, Math.min(maxRow, Bp + 2 - Bc))]; let w = lead;
    ACT[i + 1] = Bc + L - 1;
    // heights cycle until the corridor fills its section, so no long empty tail before the next section (v4's buffers)
    for (let k = 1; k < 200; k++) { const hk = Math.max(1, Math.min(maxRow, heights[k % heights.length])), add = Math.abs(hk - rows[rows.length - 1]) + flat, fin = Math.abs(L - hk) + flat;
      if (w + add + fin + 3 > width) break; rows.push(hk); w += add; }
    if (rows[rows.length - 1] !== L) { w += Math.abs(L - rows[rows.length - 1]) + flat; rows.push(L); }
    const tail = Math.max(3, width - w);   // at most ~5 now: the heights cycle above
    const a = { mode: fm, rows, flat, lead, tail, gap: fm === "wave" ? 4 : 5, spikes: fm === "wave" ? "turns" : "both", every: 5,
      exit: after ? (after[2] === "mini" ? "cube" : after[2]) : undefined };
    // (no gravity-portal turns in the wave: in v4 they forced a button change within 33 ms of the portal -- fairness FAIL)
    if (fm === "ship") a.gates = [2, 4];
    // the entry portal (with the speed) in a wall at row 1, then the corridor from the next column
    const names = [PORTAL[fm]]; if (fsp !== sp) names.push(fsp + " speed"); if (mode === "mini") names.push(99);
    gate("b" + f0, names, Bp + 1);
    objs.push(["pattern", "fly-path", "b" + f0 + "+1", Bc, a]);
    // leaving: the exit portal stands in the corridor's end wall; the speed (and size) change in the same column
    const exitAt = "b" + f0 + "+" + (1 + w + tail), er = Bc + rows[rows.length - 1];
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
  notes: "v5 by tools/hellgate_build.js: 12 sections on the song's bars, 9 modes, 4 speeds; every portal walled (no skips); the height carries over between sections",
  style: "hell", indicators: {}, signature: true,
  // the deco: Evgeni's picks from the deco gallery, the fire theme kit (tools/themes/fire.js)
  scene: "tools/scenes/theme.js",
  theme: { name: "fire", sections: PLAN.map(([b0, , m, , kind]) => ({ from: Math.max(0, Math.round(colOf(b0)) - 2), variant: variant[kind] || (FLY.has(m) ? "inferno" : "molten") })) },
  song: { custom: 343707 }, offset: OFFSET, grid: { bpm: BPM, t0: T0 },
  drop: 17, pulseZones: [[17, 33], [49, 73], [117, 147]],
  colours: { bg: [30, 6, 6], ground: [12, 0, 0], ground2: [12, 0, 0], line: [170, 60, 20] },
  objects: objs,
};
console.log(report.join("\n"));
console.log(`~${endCol} blocks, ${(146 * P).toFixed(1)} s; section end heights ${ACT.join(" ")}`);
if (!process.argv.includes("--dry")) { fs.writeFileSync(path.join(ROOT, "specs", "44_hellgate.json"), JSON.stringify(spec, null, 1) + "\n"); console.log("-> specs/44_hellgate.json"); }
