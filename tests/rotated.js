// node tests/rotated.js -- rotated gameplay (id 2900) and GD's trigger channels in lib/physics.js (PHYSICS.md "Rotated gameplay").
// A made-up level: a cube runs right on the ground; a 2900 at x 300 (channel 0, switches to channel 1) turns the travel
// UP with gravity to the LEFT; a 2900 in channel 1 at y 600 turns it back to +X with gravity down. A move trigger in
// channel 1 (at y 400) must fire on the way up; one in channel 0 at x 320 must wait until channel 0 is active again.
const GD = require("../lib/physics.js");
let fails = 0;
const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };

const objs = [];
for (let x = 15; x < 1500; x += 30) objs.push({ id: 1, x, y: -15, props: {} });          // a floor under the ground line
objs.push({ id: 1, x: 1500, y: 300, props: { "57": "9" } });                               // something far, sets endX
objs.push({ id: 2900, x: 300, y: 15, rot: -90, props: { "166": "3", "167": "1", "169": "1", "583": "1", "171": "1", "173": "1" } });
objs.push({ id: 2900, x: 300, y: 600, props: { "166": "2", "167": "4", "169": "1", "583": "0", "170": "1", "171": "1", "173": "0" } });
objs.push({ id: 1, x: 2000, y: 2000, props: { "57": "5" } });                              // groups 5 and 6: moved, never in the way
objs.push({ id: 1, x: 2000, y: 2100, props: { "57": "6" } });
objs.push({ id: 901, x: 300, y: 400, props: { "51": "5", "28": "30", "29": "0", "10": "0", "170": "1" } });   // channel 1
objs.push({ id: 901, x: 320, y: 15, props: { "51": "6", "28": "30", "29": "0", "10": "0" } });                // channel 0
const w = GD.makeWorld(objs, "kA4,0");
ok(w.trig.queue && w.trig.queue.rots.length === 2, "the level's trigger queue has its two 2900s");

const s = GD.startState(w), path = [];
const NONE = { press: false, held: false };
const fireTick = k => { const t = w.trig.list.find(t => t.i === k); return s.fired && t && s.fired[t.k] !== undefined ? s.fired[t.k] : null; };
let turnUp = null, turnBack = null, f1 = null, f0 = null;
while (!s.dead && !s.done && s.tick < 12000) {
  const hd0 = s.hd || 0;
  GD.step(w, s, NONE);
  const [X, Y] = GD.worldXY(s);
  if (hd0 === 0 && s.hd === 3) turnUp = { tick: s.tick, X, Y, vy: s.vy, grav: s.grav };
  if (hd0 === 3 && !s.hd) turnBack = { tick: s.tick, X, Y, vy: s.vy, grav: s.grav };
  if (f1 === null) f1 = fireTick(objs.length - 2);
  if (f0 === null) f0 = fireTick(objs.length - 1);
  path.push({ X, Y, hd: s.hd || 0 });
}
ok(turnUp && Math.abs(turnUp.X - 301) < 3 && turnUp.Y < 20, `turns up at the first 2900 (world ${turnUp && turnUp.X.toFixed(1)}, ${turnUp && turnUp.Y.toFixed(1)})`);
ok(turnUp && Math.abs(turnUp.vy - GD.SPEEDS[1].x) < 0.25 && turnUp.grav === 1,
   `the turn onto the other axis sets vy to the travel speed x 583 (one tick later: ${turnUp && turnUp.vy}) and gravity from 166 (left = normal in that frame)`);
ok(path.some(p => p.hd === 3 && p.X > 310), "going up, the old travel carries it away from its gravity (world x grows) ...");
ok(path.some(p => p.hd === 3 && p.X < 290 && p.Y > 100), "... and its gravity (left) pulls it back past where it turned");
ok(turnBack && turnBack.Y >= 600 && turnBack.Y < 610, `turns back to +X when world y passes the channel-1 2900 (y ${turnBack && turnBack.Y.toFixed(1)})`);
ok(turnBack && Math.abs(turnBack.vy) < 0.25 && turnBack.grav === 1, `169 with 583 = 0 stops the y speed (one tick of gravity later: ${turnBack && turnBack.vy}); 166 down = normal gravity`);
ok(f1 !== null && turnUp && turnBack && f1 > turnUp.tick && f1 < turnBack.tick, `the channel-1 move fires on the way up (tick ${f1})`);
ok(f0 !== null && turnBack && f0 >= turnBack.tick, `the channel-0 move at x 320 waits for channel 0 (tick ${f0}, back at ${turnBack && turnBack.tick})`);
ok(s.done, `the run ends at the level's end (${s.done ? "done" : s.why || "not done"}), progressX ${GD.progressX(s).toFixed(0)} > world end ${w.endX}`);

// a level without 2900s or channels keeps the plain x walk (no queue)
const w2 = GD.makeWorld(objs.filter(o => o.id !== 2900 && !(o.props && o.props["170"])), "kA4,0");
ok(!w2.trig.queue, "a level with no 2900 and no channels has no queue (unchanged path)");
console.log(fails ? `${fails} failed` : "all ok");
process.exit(fails ? 1 : 0);
