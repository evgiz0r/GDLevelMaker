// node tests/sectiongen.js -- every section generator (tools/sectiongen.js) returns a map of the asked size in board
// letters, the same map for the same seed, another for another seed, and a mode + concept (no solves); a type with planned
// presses is cleared by them alone (sim runs, ~10 s; --quick skips)
const SG = require("../tools/sectiongen.js");
let bad = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) bad++; };
for (const key of SG.KEYS) for (const cols of [20, 75]) for (const tier of ["easy", "harder"]) {
  const a = SG.make(key, { cols, seed: 3, tier }), b = SG.make(key, { cols, seed: 3, tier }), c = SG.make(key, { cols, seed: 4, tier });
  const rect = a.map.every(l => l.length === cols) && /^[.#/\\7r^voqsGNRYBEJKWHUALP]+$/.test(a.map.join(""));
  ok(rect && a.mode && a.concept && a.map.join() === b.map.join() && (cols < 30 || a.map.join() !== c.map.join()), `${key} ${cols} cols ${tier}`);
}
// PRESSES FIRST: a type that carries its planned presses must be cleared by exactly those taps, no search (each a sim run:
// a few seconds in all). Off with --quick.
if (!process.argv.includes("--quick")) { const LC = require("../tools/layoutcheck.js"), log = console.log;
  for (const key of SG.KEYS) for (const [cols, rows] of [[60, undefined], [60, 20]]) for (const tier of ["easy", "harder"]) {
    const z = SG.make(key, { cols, rows, seed: 2, tier }); if (!z.presses) continue;
    console.log = () => {}; let r; try { r = LC.planCheck(z); } finally { console.log = log; }
    ok(r.ok, `plan ${key} ${cols}x${rows || "-"} ${tier}: ${z.presses.length} presses` + (r.ok ? "" : ` die col ${r.dieCol} row ${r.dieRow} (${r.why})`)); } }
// BEATS: with a bpm, the tap types put every planned press on a half beat; fly at least 3/4 of its press and release ends
{ const CPS = 311.58 / 30, hb = CPS * 60 / 140 / 2;
  for (const key of SG.KEYS) { const z = SG.make(key, { cols: 60, seed: 2, tier: "normal", bpm: 140 }); if (!z.presses) continue;
    const cs = z.presses.flatMap(q => Array.isArray(q) ? q : [q]).filter(c => c < 59), on = cs.filter(c => Math.abs(c / hb - Math.round(c / hb)) < 0.02).length;
    // holds: 3/4 of the ends; orbs (my-mwz2haf0): half (an orb rides the arc of the last one, so a beat is taken only
    // where an arc can carry an orb); the other tap types: every press
    // the stair path (my-mwz1637w): its lattice fixes where the cube can jump (Evgeni chose to keep it), so its presses go
    // NEAR the beat: the mean distance to the nearest half beat under 0.8 of a random press's (a quarter of a half beat)
    if (key === "my-mwz1637w") { const off = cs.reduce((a, c) => a + Math.abs(c / hb - Math.round(c / hb)), 0) / cs.length;
      ok(off < 0.25 * 0.8, `beats ${key}: presses near the beat, mean ${(off * hb / CPS * 1000).toFixed(0)} ms off (random ${(0.25 * hb / CPS * 1000).toFixed(0)})`); continue; }
    const holds = z.presses.some(q => Array.isArray(q)); ok(on >= (holds ? 0.75 : key === "my-mwz2haf0" ? 0.5 : 1) * cs.length, `beats ${key}: ${on}/${cs.length} presses on half beats`); } }
// A SONG'S REAL HITS (tools/sectionbeats.js, from the committed knowledge/song_notes): the cube, ball and spider types put
// every planned press on a note of Back On Track from 20 s, and the plans still clear
{ const { songBeats } = require("../tools/sectionbeats.js"), CPS = 311.58 / 30, beats = songBeats("official_BackOnTrack", 20, 20 + 70 / CPS);
  const LC = require("../tools/layoutcheck.js"), log = console.log;
  for (const key of ["opencube", "closecube", "staircase", "ball", "my-mwz7nxue"]) { const z = SG.make(key, { cols: 60, seed: 2, tier: "normal", beats });
    const on = z.presses.filter(c => beats.some(b => Math.abs(b.t * CPS - c) < 0.03)).length;
    console.log = () => {}; let r; try { r = LC.planCheck(z); } finally { console.log = log; }
    ok(on === z.presses.length && r.ok, `song hits ${key}: ${on}/${z.presses.length} presses on a note` + (r.ok ? "" : ", plan dies")); } }
// PATH: every presses-first type returns its planned path ([column, bottom row] every 8 ticks); the tap types' path is
// traced in the page (sectiongen tracePath): it reaches the section's end and stays within 0.35 rows of the real sim's
// run of the same presses (points next to a jump of a row or more in the sim's path, e.g. a spider's teleport, skipped)
if (!process.argv.includes("--quick")) { const LC = require("../tools/layoutcheck.js"), { GD } = require("../tools/io.js"), { build } = require("../tools/make.js"), log = console.log;
  for (const key of SG.KEYS) for (const rows of [undefined, 20]) { const z = SG.make(key, { cols: 60, rows, seed: 1, tier: "normal" }); if (!z.presses) continue;
    if (!z.path || !z.path.length) { ok(false, `path ${key}: none`); continue; }
    if (!["cube", "ball", "spider"].includes(z.mode)) { ok(z.path.length > 10, `path ${key}: from its planner, ${z.path.length} points`); continue; }
    console.log = () => {}; let S, level; try { S = LC.specOf(z); level = build(S.spec, "test", {}).level; } finally { console.log = log; }
    const w = GD.makeWorld(level.objects, level.header), p0 = GD.run(w, []).path, dx = p0[1].x - p0[0].x, T0 = Math.ceil((S.x0 * 30 - p0[0].x) / dx - 1e-9);
    const real = GD.run(w, z.presses.map(q => T0 + Math.round((Array.isArray(q) ? q[0] : q) * 30 / dx))).path.map(q => [q.x / 30 - S.x0, q.y / 30 - 0.5]);
    let mx = 0; for (const [c, y] of z.path) { if (c < 3) continue; const near = real.filter(q => Math.abs(q[0] - c) < 0.3); if (!near.length) continue;   // (c < 3: the first columns hang on the join in front, off a slope the player comes in still moving)
      const ys = near.map(q => q[1]); if (Math.max(...ys) - Math.min(...ys) > 1) continue;
      const b = near.reduce((a, q) => Math.abs(q[0] - c) < Math.abs(a[0] - c) ? q : a); mx = Math.max(mx, Math.abs(b[1] - y)); }
    const end = z.path[z.path.length - 1][0];
    ok(end >= 59 && mx < 0.35, `path ${key} 60x${rows || "-"}: traced to column ${end.toFixed(1)}, ${mx.toFixed(2)} rows from the sim at most`); } }
// ENTRY (Evgeni 2026-11-28: "lets make the initial spot in the generation random ... could be at any height (for the non
// starting cube)"): over 12 seeds, the floor at column 0 (the height the player comes in at) takes at least 4 heights in
// a 20-row map for every presses-first type (o.entry sets it)
for (const key of SG.KEYS) { const hs = new Set(); let pr = false;
  for (let seed = 1; seed <= 12; seed++) { const z = SG.make(key, { cols: 60, rows: 20, seed, tier: "normal" }), H = z.map.length; if (z.presses) pr = true;
    let f = 0; while (f < H && "#/\\".includes(z.map[H - 1 - f][0])) f++; hs.add(f); }
  if (pr && key !== "flappy" && key !== "entrance") ok(hs.size >= 4, `entry ${key}: ${hs.size} heights over 12 seeds (${[...hs].sort((a, b) => a - b).join(" ")})`); }   // the entrance starts the level: always from the ground
process.exit(bad ? 1 : 0);
