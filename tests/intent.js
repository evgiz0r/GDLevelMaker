// node tests/intent.js [--save <dir>] [--main]   (--main: with the private main-level bricks, local/bricks_main.js)   -- the ✨ one pen (lib/intent.js, DRAW.md "One pen: path or shape"): hand-drawn
// strokes (a little wobble) are read as path or shape, turned into bricks / corridors with their presses, and the result
// must play with those presses alone. --save writes each result as a sketch (for tools/sketchshot.js pictures).
"use strict";
const fs = require("fs"), path = require("path"), R = path.join(__dirname, "..");
global.window = global.window || {}; require(path.join(R, "viewer", "bricks.js"));
const BR = window.GD_BRICKS.concat(process.argv.includes("--main") && fs.existsSync(path.join(R, "local", "bricks_main.js")) ? (require(path.join(R, "local", "bricks_main.js")), window.GD_BRICKS_MAIN) : []);
const I = require(path.join(R, "lib", "intent.js")), SK = require(path.join(R, "lib", "sketch.js"));
const G = Object.assign({}, require(path.join(R, "lib", "gd.js")), require(path.join(R, "lib", "objects.js")), require(path.join(R, "lib", "physics.js")));
const A = process.argv.slice(2), save = A.includes("--save") ? A[A.indexOf("--save") + 1] : null;
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, wob = () => (rnd() - 0.5) * 6;
const line = (f, x0, x1, step = 10) => { const p = []; for (let x = x0; x <= x1; x += step) p.push([x + wob() / 2, f(x) + wob()]); return p; };
const CASES = [
  { name: "hops", want: "path", pts: line(x => 15 + Math.max(0, 60 * Math.sin((x - 150) / 120 * Math.PI)), 150, 1950) },
  { name: "wave zigzag", want: "path", pts: line(x => { const t = ((x - 150) % 300) / 300; return 60 + (t < .5 ? t : 1 - t) * 240; }, 150, 1650) },
  { name: "ship swoop", want: "path", pts: line(x => 120 + 50 * Math.sin((x - 150) / 260 * Math.PI), 150, 1650) },
  { name: "run then fly", want: "path", pts: line(x => x < 900 ? 15 + Math.max(0, 50 * Math.sin((x - 150) / 110 * Math.PI)) : 15 + Math.min(110, (x - 900) * 0.6), 150, 2100) },
  { name: "steps", want: "shape", pts: [[150, 0], [152, 30], [240, 31], [241, 60], [330, 61], [331, 90], [450, 89], [452, 0]] },
  { name: "pillar", want: "shape", pts: [[150, 0], [210, 1], [211, 60], [270, 61], [271, 0], [390, 0]] },
];
let bad = 0;
for (const c of CASES) {
  const sk = { v: 1, id: "intent-" + c.name.replace(/\W+/g, "-"), name: "✨ " + c.name, speed: 1, items: [] }, it = { k: "stroke", pen: "auto", pts: c.pts };
  sk.items.push(it);
  const t0 = Date.now(), r = I.apply(sk, it, BR), ms = Date.now() - t0;
  // a shape built as drawn has no presses of its own: the layout fitter (what the board runs) makes it play
  let play = sk, ev = null;
  if (r.placed.length && !sk.items.some(i => i.k === "press")) { const f = require(path.join(R, "lib", "sketchfit.js")).fit(JSON.parse(JSON.stringify(sk))); play = f.sketch; ev = f.events; }
  const lv = SK.convert(play), q = G.run(G.makeWorld(lv.play, lv.header), ev || SK.planEvents(play));
  const ok = r.kind === c.want && r.placed.length && !q.dead;
  if (!ok) bad++;
  console.log((ok ? "ok   " : "FAIL ") + c.name.padEnd(13) + " " + r.kind.padEnd(5) + " " + ms + " ms  " + (q.dead ? "dies at block " + (q.end.x / 30).toFixed(1) + " (" + q.why + ")" : "plays") + "  " + r.note);
  if (save) { fs.mkdirSync(save, { recursive: true }); fs.writeFileSync(path.join(save, sk.id + ".json"), JSON.stringify(sk)); }
}
console.log(bad ? bad + " failed" : "all ok");
process.exit(bad ? 1 : 0);
