// node tools/press_window.js <level.gdlvl> --x X --y Y [--vy 0] [--hold-to X2] [--to X3] [--ticks 60]
// Which press ticks get a player through a spot? Plays the level's own solution up to x X (mode,
// speed, band as the level has them there), puts the player at (X, Y) with vertical speed vy, then
// for each tick k presses and holds from k until x X2 (default: never let go before X3), and says
// whether it is alive at x X3. The run of "ok" ticks is the human window (240 ticks a second).
// Example (GDLM 44's wave entrance, the cube landed on the block, 2026-11-23):
//   node tools/press_window.js local/wip/style/gdlm_44_hellgate.gdlvl --x 1590 --y 105 --hold-to 1665 --to 1700
// The solution comes from the level's .json beside it (wip) or a fresh solve.
if (require.main === module) require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
const fs = require("fs");
const { GD, readGdlvl } = require("./io.js");
const a = process.argv.slice(2), file = a[0];
const opt = (k, d) => { const i = a.indexOf("--" + k); return i < 0 ? d : +a[i + 1]; };
if (!file || opt("x", null) === null || opt("y", null) === null) { console.log(fs.readFileSync(__filename, "utf8").split("\n").slice(0, 8).join("\n")); process.exit(1); }
const X = opt("x"), Y = opt("y"), VY = opt("vy", 0), TO = opt("to", X + 120), HOLD = opt("hold-to", TO), N = opt("ticks", 60);
const L = readGdlvl(file), w = GD.makeWorld(L.level.objects);
const side = file.replace(/\.gdlvl$/, ".json");
let events = fs.existsSync(side) && JSON.parse(fs.readFileSync(side, "utf8")).solution;
// else the level's saved solution (tools/solutions.js), else a fresh solve with modes (GD.solve is
// cube-only: on a level with a ship it died early, and every tick then read as a death)
if (!(events && events.events)) { const c = require("./solutions.js").get(L.levelStr, true); if (c && c.ok) events = c; }
events = events && events.events ? events.events : (GD.solveAny(w).events || []);
// the solution's state just before x X
const s = GD.startState(w); let held = false, ev = events.slice();
for (let t = 0; t < 200000 && s.x < X - 2 && !s.dead; t++) {
  let press = false;
  while (ev.length && ev[0].tick === t) { const e = ev.shift(); if (e.type === "press") { press = true; held = true; } else held = false; }
  GD.step(w, s, { press, held });
}
const at = () => { const t = JSON.parse(JSON.stringify(s)); t.x = X; t.y = Y; t.vy = VY; t.grounded = VY === 0; return t; };
if (s.dead) { console.log(`the level's solution dies before x ${X} (${s.why} at ${s.x.toFixed(0)}): no state to start from`); process.exit(1); }
const out = [];
for (let k = 0; k < N; k++) {
  const t = at(); let i = 0;
  for (; i < 4000 && t.x < TO && !t.dead; i++) { const h = i >= k && t.x < HOLD; GD.step(w, t, { press: i === k, held: h }); }
  out.push(t.dead ? `${k}:X(${t.why} ${t.x.toFixed(0)},${t.y.toFixed(0)})` : `${k}:ok`);
}
console.log(`${L.name}: player at x ${X} y ${Y} (${s.mode}); press-and-hold from tick k (held to x ${HOLD}), alive at x ${TO}?`);
console.log(out.join(" "));
const ok = out.map(o => o.endsWith("ok"));
const runs = []; ok.forEach((v, k) => { if (v && (k === 0 || !ok[k - 1])) runs.push([k, k]); if (v) runs[runs.length - 1][1] = k; });
for (const [p, q] of runs) console.log(`window: ticks ${p}-${q} = ${((q - p + 1) / 240 * 1000).toFixed(0)} ms${q === N - 1 ? " (or more: raise --ticks)" : ""}`);
