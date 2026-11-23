// node tests/mechanics.js -- small worlds that pin down the sim's rules for portals, pads and triggers.
// These are the model's own rules (sources in PHYSICS.md), not measurements: they catch a change
// that breaks them by accident. Footage checks live in tests/jump_video.js and tests/modes_video.js,
// real-game plans in tests/tas_progress.js.
const GD = Object.assign({}, require("../lib/gd.js"), require("../lib/objects.js"), require("../lib/physics.js"));
let bad = 0;
const check = (name, ok, got) => { if (!ok) bad++; console.log(`${ok ? "ok  " : "BAD "} ${name}${got !== undefined ? ": " + got : ""}`); };
const first = (r, act) => r.path.find(p => p.act === act);

// teleport portal 747: same x, portal y + key 54
{
  const w = GD.makeWorld([{ id: 747, x: 300, y: 15, props: { "54": "150" } }, { id: 1, x: 330, y: 150 }, { id: 1, x: 600, y: 15 }]);
  const p = first(GD.run(w, []), "teleport portal");
  check("teleport to portal y + offset", p && p.y === 165, p && p.y);
}
// a teleport turned a quarter moves the full offset straight up, like an unturned one (Deadlocked's ball part)
{
  const w = GD.makeWorld([{ id: 747, x: 300, y: 15, rot: 90, props: { "54": "150" } }, { id: 1, x: 330, y: 150 }, { id: 1, x: 600, y: 15 }]);
  const p = first(GD.run(w, []), "teleport portal");
  check("quarter-turned teleport: full offset", p && p.y === 165, p && p.y);
}
// a slope turned a quarter is still a slope: 1338 flipped up and turned 90 rises to the right, so a cube
// walks up it onto a block (the old rule made it a wall: death); turned 90 unflipped it walks down
{
  const objs = [{ id: 1338, x: 315, y: 15, rot: 90, flipY: true }, { id: 1, x: 345, y: 15 }, { id: 1, x: 375, y: 15 },
    { id: 1338, x: 405, y: 15, rot: 90 }, { id: 1, x: 900, y: 15 }];
  const q = GD.run(GD.makeWorld(objs), []), top = q.path.find(s => s.x >= 360 && s.x <= 365);
  check("quarter-turned slopes: walk up and down", !q.dead || q.end.x > 500, (q.dead ? "dies " + q.why + " at " + q.end.x.toFixed(0) : "") + " y at step " + (top && top.y.toFixed(1)));
}
// no secret ways (the user, 2026-11-23: "if the solver skips something, its 99% wrong"): a portal the route
// can reach must be taken; one it cannot reach makes the level stuck there, never a pass that goes around it
{
  const lvl = row => [{ id: 202, x: 400, y: row * 30 + 15 }, { id: 1, x: 1500, y: 15 }];
  const a = GD.solveAny(GD.makeWorld(lvl(1.5)));
  const took = a.ok && GD.run(GD.makeWorld(lvl(1.5)), a.events).end.used.length > 0;
  check("no-skip: a reachable floating portal is taken", a.ok && took, a.ok ? (took ? "taken" : "skipped") : a.why);
  // just out of reach (a jump tops out ~2.1 blocks; the portal's box starts within 2 blocks of that): stuck
  const b = GD.solveAny(GD.makeWorld(lvl(5)));
  check("no-skip: a portal the route gets near but cannot take makes the level stuck", !b.ok && /skipped/.test(b.why || ""), b.ok ? "passed around it" : b.why + " " + (b.skipped || ""));
  // far above the play (decoration, ClockWood's ball portal at y 675): not a requirement, named in outOfReach
  const d = GD.solveAny(GD.makeWorld(lvl(25)));
  check("no-skip: a portal far out of reach is not required", d.ok && (d.outOfReach || []).length === 1, d.ok ? "ok, out of reach: " + (d.outOfReach || []).join(", ") : d.why + " " + (d.skipped || ""));
  // a long level: the portal is far behind at the end, out of the run's kept s.used, and still counts as taken
  // ten yellow pads after it fill s.used past 8, so step() trims the portal out of it
  const far = [{ id: 202, x: 400, y: 45 }, { id: 1, x: 9000, y: 15 }];
  for (let k = 0; k < 10; k++) far.push({ id: 35, x: 1200 + k * 600, y: 2 });
  const wf = GD.makeWorld(far), rf = GD.solveAny(wf);
  check("no-skip: a portal taken early still counts at the end of a long run", rf.ok, rf.ok ? "ok" : rf.why + " " + (rf.skipped || ""));
  // a 1x speed portal at 1x changes nothing: passing it untouched is fine
  const e = GD.solveAny(GD.makeWorld([{ id: 201, x: 400, y: 5 * 30 + 15 }, { id: 1, x: 1500, y: 15 }]));
  check("no-skip: a portal that would change nothing is not required", e.ok, e.ok ? "ok" : e.why + " " + (e.skipped || ""));
  const c = GD.solveAny(GD.makeWorld(lvl(5)), { allowSkips: true });
  check("no-skip: allowSkips (debugging) still finds the way around", c.ok, c.ok ? "ok" : c.why);
}
// solveFrom from a state already past a portal (the resume tool and the natural plan's flying stretches)
{
  const w = GD.makeWorld([{ id: 202, x: 300, y: 15 }, { id: 8, x: 900, y: 15 }, { id: 1, x: 1500, y: 15 }]);
  const s = GD.startState(w); while (s.x < 600) GD.step(w, s, { press: false, held: false });
  let r; try { r = GD.solveFrom(w, s, {}); } catch (e) { r = { ok: false, why: "threw: " + e.message }; }
  check("solveFrom from past a portal", r.ok, r.ok ? "ok" : r.why);
}
// pad table: a ball's yellow pad gives 16 x 0.6 = 9.6; a cube's 16
for (const [mode, want] of [["cube", 16], ["ball", 9.6]]) {
  const w = GD.makeWorld([{ id: 35, x: 300, y: 2 }, { id: 1, x: 900, y: 15 }]);
  const s = GD.startState(w); s.mode = mode; if (mode === "ball") { s.floorY = 0; s.ceilY = 240; }
  let got = null;
  for (let t = 0; t < 400 && got === null; t++) { GD.step(w, s, { press: false, held: false }); if (s.act === "yellow pad") got = s.vy; }
  // the pad sets vy, then that tick's gravity applies
  check(`${mode} yellow pad launch`, got !== null && Math.abs(got - want) < 0.4, got && got.toFixed(2));
}
// move trigger: a block 4 blocks down rises into place when the player passes the trigger
{
  const w = GD.makeWorld([
    { id: 901, x: 60, y: 300, props: { "51": "5", "29": "120", "10": "0.5" } },
    { id: 1, x: 300, y: -105, props: { "57": "5" } }, { id: 1, x: 900, y: 15 }]);
  const s = GD.startState(w);
  for (let t = 0; t < 400; t++) GD.step(w, s, { press: false, held: false });
  const p = GD.posedObjects(w, s).find(q => q.o.id === 1 && q.o.x === 300);
  check("move trigger moves its group by 30 units a block", p && Math.abs(p.o.y - 15) < 1e-6, p && p.o.y);
}
// rotate trigger about a centre object, then stop freezes a second one
{
  const w = GD.makeWorld([
    { id: 1346, x: 30, y: 300, props: { "51": "7", "71": "8", "68": "90", "10": "0" } },
    { id: 1, x: 360, y: 300, props: { "57": "7" } }, { id: 211, x: 300, y: 300, props: { "57": "8" } }, { id: 1, x: 900, y: 15 }]);
  const s = GD.startState(w);
  for (let t = 0; t < 60; t++) GD.step(w, s, { press: false, held: false });  // past the trigger at x 30
  const p = GD.posedObjects(w, s).find(q => q.o.id === 1);
  check("rotate 90 clockwise about the centre", p && Math.abs(p.o.x - 300) < 1e-6 && Math.abs(p.o.y - 240) < 1e-6, p && `${p.o.x.toFixed(1)},${p.o.y.toFixed(1)}`);
}
{
  const w = GD.makeWorld([
    { id: 901, x: 30, y: 300, props: { "51": "5", "28": "300", "10": "2", "57": "9" } },
    { id: 1616, x: 200, y: 300, props: { "51": "9" } },
    { id: 1, x: 600, y: 300, props: { "57": "5" } }, { id: 1, x: 900, y: 15 }]);
  const s = GD.startState(w);
  const at = [];
  for (let t = 0; t < 300; t++) { GD.step(w, s, { press: false, held: false }); if (t === 200 || t === 290) at.push(GD.posedObjects(w, s)[0].o.x); }
  check("stop freezes a running move", at[0] > 600 && at[0] === at[1], at.map(v => v.toFixed(1)).join(" -> "));
}
// mini: half 9 and a 0.8 jump
{
  const w = GD.makeWorld([{ id: 101, x: 60, y: 15 }, { id: 1, x: 900, y: 15 }]);
  const s = GD.startState(w);
  for (let t = 0; t < 60; t++) GD.step(w, s, { press: false, held: false });
  GD.step(w, s, { press: true, held: true });
  check("mini rests at y 9 and jumps at 0.8", s.mini && Math.abs(s.vy - 11.18 * 0.8) < 0.3, `mini ${s.mini} vy ${s.vy.toFixed(2)}`);
}
// one-way block 143: walk through it, land on it
{
  const w = GD.makeWorld([{ id: 143, x: 300, y: 15 }, { id: 1, x: 900, y: 15 }]);
  const r = GD.run(w, []);
  check("one-way block never kills", !r.dead || r.end.x > 330, r.why || "passed");
}
// wave sliding on a block: survives along the top, dies as its centre passes the block's end
// (measured: the user's GDLM 44 runs, 2026-11-23, two deaths at the block's top-right corner)
{
  const objs = [{ id: 660, x: 200, y: 105 }];
  for (let x = 165; x <= 345; x += 30) objs.push({ id: 1, x, y: 75 });   // a row of blocks, top y 90, ends x 360
  objs.push({ id: 1, x: 900, y: 15 });
  const w = GD.makeWorld(objs);
  const s = GD.startState(w); s.y = 105; s.x = 150;
  let slidX = null;
  for (let t = 0; t < 400 && !s.dead; t++) { GD.step(w, s, { press: false, held: false }); if (s.mode === "wave" && s.y === 95 && slidX === null) slidX = s.x; }
  check("wave slides along a block top", slidX !== null && slidX < 300, slidX && slidX.toFixed(0));
  check("wave dies sliding off the block's end", s.dead && s.x > 360 && s.x < 362, `${s.why} at ${s.x.toFixed(1)}`);
}
// wave vs a rising 45-degree slope: held, it slides up along it; released (head-on), it dies
// (measured: the user's GDLM 44 zigzag, 2026-11-23_03-11-47.mkv ~25 s)
for (const hold of [true, false]) {
  const objs = [{ id: 660, x: 100, y: 45 }, { id: 1338, x: 315, y: 15 }, { id: 1338, x: 345, y: 45 }, { id: 1, x: 900, y: 15 }];
  const w = GD.makeWorld(objs), s = GD.startState(w);
  for (let t = 0; t < 260 && !s.dead; t++) { const h = hold && s.mode === "wave" && s.x > 280; GD.step(w, s, { press: h, held: h }); }
  check(hold ? "wave held slides up a slope" : "wave released dies head-on into a slope", hold ? !s.dead : s.dead && s.why === "slope", `${s.dead ? s.why : "alive"} at ${s.x.toFixed(0)},${s.y.toFixed(0)}`);
}
// the solver's click windows replay: every tick in a window clears (difficulty session's repro:
// triple spike with a yellow orb above, the merged-state solver claimed 429-450, real 440-450)
{
  const w = GD.makeWorld(GD.parseLevel("kA4,0;1,8,2,615,3,15;1,8,2,645,3,15;1,8,2,675,3,15;1,36,2,645,3,105;1,1,2,1215,3,-15;").objects);
  // allowSkips: this checks the exact solver's windows; its route clears the spikes without the orb, which
  // the no-skip rule (orb on the arc) would hand to the sweep
  const r = GD.solveAny(w, { allowSkips: true }), c = r.clicks[0], badT = [];
  for (let t = c.lo; t <= c.hi; t++) if (GD.run(w, [{ tick: t, type: "press" }, { tick: t + 1, type: "release" }]).dead) badT.push(t);
  check("every tick of a solver window clears", r.ok && !badT.length && !GD.run(w, r.events).dead, `${c.lo}-${c.hi}${badT.length ? " bad " + badT.join(",") : ""}`);
}
// the sweep plans the swing: a press flips gravity one tick later, so a just-pressed swing must not
// merge with one still holding from before (style's swing-wiggle: floor wall, roof wall, floor wall)
{
  const B = (c, r0, r1) => Array.from({ length: r1 - r0 }, (_, i) => ({ id: 1, x: c * 30 + 15, y: (r0 + i) * 30 + 15 }));
  const w = GD.makeWorld([{ id: 1933, x: 255, y: 45 }, ...B(20, 0, 5), ...B(26, 5, 10), ...B(32, 0, 5), { id: 1, x: 1515, y: 15 }]);
  const r = GD.solveAny(w);
  check("the sweep flips the swing past floor and roof walls", r.ok && !GD.run(w, r.events).dead, r.ok ? `${r.clicks.filter(c => c.type === "press").length} presses` : `dies at ${r.dieAt && r.dieAt.x.toFixed(0)}`);
}
// ---- dual (lib/dual.js; GD's rules from the 2.2081 decompile, PHYSICS.md "Dual") ----
{
  const DP = (x, y) => ({ id: 286, x, y }), SOLO = (x, y) => ({ id: 287, x, y });
  const runTo = (w, X, press) => { const s = GD.startState(w); while (!s.dead && s.x < X) GD.step(w, s, press && press(s) ? { press: true, held: true } : { press: false, held: false }); return s; };
  // the portal spawns player 2 mirrored: it falls to the band's roof (300 units, ASSUMED for a cube)
  const w1 = GD.makeWorld([DP(300, 60), { id: 1, x: 1500, y: 15 }]);
  const a = runTo(w1, 900);
  check("dual: player 2 spawns upside down and rides the roof", !a.dead && a.p2 && a.p2.grav === -1 && Math.abs(a.p2.y - 285) < 0.01 && a.y === 15, a.p2 ? `p1 ${a.y.toFixed(0)} p2 ${a.p2.y.toFixed(1)} grav ${a.p2.grav}` : a.why);
  // one button: a press jumps both, player 2 away from its roof
  let low = Infinity; const b = runTo(w1, 1000, s => { if (s.p2 && s.x > 850) low = Math.min(low, s.p2.y); return s.x > 900 && s.x < 905; });
  check("dual: one press jumps both players, mirrored (p2 tops out a jump below the roof)", !b.dead && Math.abs(low - 221.2) < 0.5, `p2 lowest ${low.toFixed(0)}`);
  // either one dying is a death: a spike hanging from the roof kills player 2
  const c = runTo(GD.makeWorld([DP(300, 60), { id: 8, x: 900, y: 285, flipY: true }, { id: 1, x: 1500, y: 15 }]), 1200);
  check("dual: player 2 dies on a roof spike", c.dead && /player 2/.test(c.why), c.dead ? c.why : "alive");
  // a mode portal switches only the player that touches it
  const d = runTo(GD.makeWorld([DP(300, 60), { id: 13, x: 600, y: 45 }, { id: 1, x: 1500, y: 15 }]), 700);
  check("dual: a ship portal low down switches only player 1", d.mode === "ship" && d.p2 && d.p2.mode === "cube", `${d.mode} / ${d.p2 && d.p2.mode}`);
  // a gravity portal flips the toucher, and the other one too while they share a mode (they stay mirrored)
  const e = runTo(GD.makeWorld([DP(300, 60), { id: 11, x: 600, y: 45 }, { id: 1, x: 1500, y: 15 }]), 900);
  check("dual: a gravity portal keeps both mirrored", e.grav === -1 && e.p2 && e.p2.grav === 1 && Math.abs(e.y - 285) < 0.01 && e.p2.y === 15, `p1 ${e.grav} at ${e.y.toFixed(0)}, p2 ${e.p2 && e.p2.grav} at ${e.p2 && e.p2.y.toFixed(0)}`);
  // the solo portal: the player that touched it goes on (here player 2, on the roof)
  const f = runTo(GD.makeWorld([DP(300, 60), SOLO(900, 255), { id: 1, x: 1500, y: 15 }]), 1000);
  check("dual: the solo portal keeps the player that touched it", !f.p2 && !f.dualBand && f.grav === -1, `p2 ${!!f.p2}, grav ${f.grav}, y ${f.y.toFixed(0)}`);
  // the solver takes the dual portal (no secret way around it) and gets both players past their spikes
  const g = GD.solveAny(GD.makeWorld([DP(300, 60), { id: 8, x: 800, y: 15 }, { id: 8, x: 1100, y: 285, flipY: true }, SOLO(1400, 60), { id: 1, x: 1800, y: 15 }]));
  check("dual: the solver clears a dual part with one button", g.ok, g.ok ? `${g.clicks.filter(c => c.type === "press").length} presses` : `${g.why} ${g.skipped || ""}`);
}
process.exit(bad ? 1 : 0);
