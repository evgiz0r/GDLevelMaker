// tools/stitch.js: practice attempts (probe v0.4 logs) -> one full run. Builds fake practice logs from a solved level --
// the route cut at three checkpoints, with wasted attempts and junk presses after each checkpoint -- and checks the
// stitched run is the route again and that our sim clears it; then a seam where the respawn kept the button held.
// usage: node tests/stitch.js
"use strict";
const assert = require("assert");
const path = require("path");
const { GD, readGdlvl } = require("../tools/io.js");
const { stitch } = require("../tools/stitch.js");

const L = readGdlvl(path.join(__dirname, "..", "levels", "archive", "gdlm_02_on_the_beat.gdlvl"));
const lv = GD.parseLevel(L.levelStr);
const w = GD.makeWorld(lv.objects, lv.header);
const route = GD.solve(w).events;
const END = GD.run(w, route).path.length - 1;

let wall = 1;
// one attempt's log, as probe.js read() gives it: from tick `from` (checkpoint `cp`), the route's inputs in [from, to),
// junk inputs after, checkpoints stored at the given ticks, and how it ended
function att({ from, cp = -1, to, junk = [], cps = [], end = "death", hold = 0 }) {
  const btn = [];
  for (const e of route) if (e.tick >= from && e.tick < to) btn.push({ n: e.tick - from, down: e.type === "press" ? 1 : 0, button: 1, p1: 1 });
  for (const j of junk) btn.push({ n: j - from, down: 1, button: 1, p1: 1 }, { n: j - from + 1, down: 0, button: 1, p1: 1 });
  btn.sort((a, b) => a.n - b.n);
  const last = Math.max(to, ...junk.map((j) => j + 2)) - from;
  const ticks = [];
  for (let n = 1; n <= last; n++) ticks.push({ n, lt: (from + n) / 240, p: [0, 0, 0, "cube", 0, 1, 1, 1] });
  return { file: `x/${wall}.jsonl`, start: { level: "GDLM 02 on the beat", id: 0, attempt: wall++, practice: 1, lt: from / 240, from: cp, cps: 0, hold },
    ticks, btn, cps: cps.map(([id, t]) => ({ id, n: t - from, lt: t / 240, x: 0, y: 0 })), cpdel: [], death: null, end: { n: last, result: end } };
}

const T1 = 870, T2 = 1500, T3 = 2000;
for (const t of [T1, T2, T3]) assert(route.every((e) => Math.abs(e.tick - t) > 3), "seams away from presses");
const logs = [
  att({ from: 0, to: T1 + 40, junk: [T1 + 50], cps: [[1, T1]] }),              // reaches cp 1, dies after
  att({ from: T1, cp: 1, to: T1, junk: [T1 + 20] }),                          // wasted
  att({ from: T1, cp: 1, to: T3 + 10, junk: [T3 + 30], cps: [[2, T2], [3, T3]] }), // stores cp 2 and 3 in one go
  att({ from: T3, cp: 3, to: T3 + 30, junk: [T3 + 31] }),                     // wasted
  att({ from: T3, cp: 3, to: END + 1, end: "complete" }),                     // the clear
  { file: "x/n.jsonl", start: { level: "GDLM 02 on the beat", practice: 0, lt: 0, from: -1 }, ticks: [], btn: [], cps: [], end: { n: 5, result: "death" } },
];
// as on GD 2.2091: every checkpoint id reads 0, and the first attempt began in normal mode (switched to practice mid-run)
for (const l of logs) for (const c of l.cps || []) c.id = 0;
logs[0].start.practice = 0;
const S = stitch(logs);
assert(!S.error, S.error);
assert.strictEqual(S.complete, true);
assert.strictEqual(S.segments.length, 3, "segments: start->cp1, cp1->cp3, cp3->end");
assert.deepStrictEqual(S.events, route, "the stitched run is the route");
const run = GD.run(w, S.events);
assert(run.done, "our sim clears the stitched run");
console.log(`ok: ${S.segments.length} segments from ${S.attempts} practice attempts, ${S.events.length} inputs = the route; sim clears`);

// no clear yet -> an error, or the chain to the furthest attempt with partial
assert(stitch(logs.slice(0, 4)).error);
const P = stitch(logs.slice(0, 4), { partial: true });
assert(!P.error && !P.complete && P.segments.length === 3);

// a checkpoint nobody logged
assert(/no earlier logged attempt got there/.test(stitch([att({ from: T1, cp: 9, to: END + 1, end: "complete" })]).error));

// the respawn kept the button held: a press is added at the seam
const H = stitch([att({ from: 0, to: T1, cps: [[1, T1]] }), att({ from: T1, cp: 1, to: END + 1, end: "complete", hold: 1 })]);
assert(H.events.some((e) => e.tick === T1 && e.type === "press"), "press added at the seam");
assert(H.seams.some((s) => s.fix && /press added/.test(s.fix)));

// old logs (no lt) are refused with a reason
assert(/v0.3/.test(stitch([{ start: { practice: 1 }, ticks: [], btn: [] }]).error));
console.log("ok: partial, missing checkpoint, held seam, old logs");
