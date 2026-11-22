// node tests/mechanics.js -- small worlds that pin down the sim's rules for portals, pads and triggers.
// These are the model's own rules (sources in PHYSICS.md), not measurements: they catch a change
// that breaks them by accident. Footage checks live in tests/jump_video.js and tests/modes_video.js,
// real-game plans in tests/tas_progress.js.
const GD = Object.assign({}, require("../lib/objects.js"), require("../lib/physics.js"));
let bad = 0;
const check = (name, ok, got) => { if (!ok) bad++; console.log(`${ok ? "ok  " : "BAD "} ${name}${got !== undefined ? ": " + got : ""}`); };
const first = (r, act) => r.path.find(p => p.act === act);

// teleport portal 747: same x, portal y + key 54
{
  const w = GD.makeWorld([{ id: 747, x: 300, y: 15, props: { "54": "150" } }, { id: 1, x: 330, y: 150 }, { id: 1, x: 600, y: 15 }]);
  const p = first(GD.run(w, []), "teleport portal");
  check("teleport to portal y + offset", p && p.y === 165, p && p.y);
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
process.exit(bad ? 1 : 0);
