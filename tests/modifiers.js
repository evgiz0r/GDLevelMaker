// node tests/modifiers.js -- GD 2.2's gameplay modifiers and the time warp in lib/physics.js (PHYSICS.md "Gameplay
// modifiers", "Time warp"; both first met on Dash, block 124-152).
const GD = require("../lib/physics.js");
let fails = 0;
const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
const NONE = { press: false, held: false }, PRESS = { press: true, held: true }, HOLD = { press: false, held: true };

// a cube jumps into a low ceiling (blocks at y 75-105, bottom 60... a jump reaches ~ 85): with 2866 (flip on head hit)
// over its path it turns over and stands on the ceiling; without it, its inner box hits the block and it dies
function ceilingRun(withFlip, withNoAuto) {
  const objs = [];
  for (let x = 105; x < 600; x += 30) objs.push({ id: 1, x, y: 75, props: {} });          // ceiling: bottom face y 60
  objs.push({ id: 1, x: 1200, y: 300, props: {} });                                          // the level's end
  if (withFlip) objs.push({ id: 2866, x: 105, y: 15, props: { "128": "3", "129": "3" } });   // 90x90 box where it jumps
  if (withNoAuto) objs.push({ id: 1813, x: 105, y: 15, props: { "128": "3", "129": "3" } });
  const w = GD.makeWorld(objs, "kA4,0"), s = GD.startState(w);
  let flipAt = null, jumps = 0;
  for (let t = 0; t < 400 && !s.dead && !s.done; t++) {
    const inp = t === 50 ? PRESS : t > 50 && t < 200 ? HOLD : NONE;   // a held press: the cube would keep jumping
    GD.step(w, s, inp);
    if (s.act === "head flip" && flipAt === null) flipAt = { y: s.y, grav: s.grav, tick: s.tick };
    if (s.act === "jump") jumps++;
  }
  return { s, flipAt, jumps };
}
const a = ceilingRun(false, false);
ok(a.s.dead && a.s.why === "block", `without 2866 the cube's head hits the ceiling and it dies (${a.s.why})`);
const b = ceilingRun(true, false);
ok(b.flipAt && b.flipAt.grav === -1 && Math.abs(b.flipAt.y - 45) < 1e-6, `with 2866 it flips and stands on the ceiling's underside (y ${b.flipAt && b.flipAt.y})`);
// it may still die later on the ground: its held jumps off the ceiling drive it, upside down, into the floor at speed, which
// kills in the game (PHYSICS.md "Upside-down cube and the ground", the auto lab's v11 / v12 probe logs)
ok(!b.s.dead || b.s.why === "ground, upside down", `... and lives on, the flip itself kills nothing (${b.s.dead ? b.s.why : "alive"})`);
ok(b.jumps >= 2, `with the button still held it jumps again off the ceiling (${b.jumps} jumps)`);
const c = ceilingRun(true, true);
ok(c.flipAt && c.jumps === 1, `with 1813 (no auto jump) armed too, the held button is dropped: no jump off the ceiling (${c.jumps} jump)`);

// time warp: 0.2 from x 300, back to 1 at x 600
{
  const objs = [{ id: 1, x: 2000, y: 300, props: {} },
    { id: 1935, x: 300, y: 100, props: { "120": "0.2" } }, { id: 1935, x: 600, y: 100, props: { "120": "1" } }];
  const w = GD.makeWorld(objs, "kA4,0"), s = GD.startState(w), dx = [];
  for (let t = 0; t < 4000 && !s.done; t++) { const x0 = s.x; GD.step(w, s, NONE); dx.push([x0, s.x - x0]); }
  const full = GD.SPEEDS[1].x * GD.PHYS.DT;
  const before = dx.find(d => d[0] > 200 && d[0] < 290), inW = dx.find(d => d[0] > 400 && d[0] < 500), after = dx.find(d => d[0] > 700);
  // 1e-3, not exact: x is a 32-bit float like GD's (lib/physics.js F32X), so a step at x ~500 rounds to ~3e-5
  ok(Math.abs(before[1] - full) < 1e-3 && Math.abs(inW[1] - full * 0.2) < 1e-3 && Math.abs(after[1] - full) < 1e-3,
     `x per tick ${before[1].toFixed(3)} -> ${inW[1].toFixed(3)} inside the 0.2 warp -> ${after[1].toFixed(3)} after it`);
  const w2 = GD.makeWorld(objs.slice(0, 1), "kA4,0");
  ok(!w2.warps, "a level without a warp has none (unchanged path)");
}
console.log(fails ? `${fails} failed` : "all ok");
process.exit(fails ? 1 : 0);
