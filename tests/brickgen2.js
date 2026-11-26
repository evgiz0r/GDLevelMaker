// node tests/brickgen2.js -- round 2 of the brick generator (tools/brickgen2.js, BRICKGEN.md "Round 2"): the ball generator
// makes move-sequence bricks whose planned presses clear, with at least two kinds of move and movement numbers inside the
// official range on most axes; and every kept brick in knowledge/brickgen2.json still clears on today's physics (~10 s).
"use strict";
const G = require("../tools/brickgen.js"), G2 = require("../tools/brickgen2.js");
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log("FAIL " + m); } else console.log("ok   " + m); };
let s = 4242; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
let good = 0, tries = 0, kinds = new Set();
while (good < 3 && tries < 60) {
  tries++;
  const b = G2.genBall(r, "Normal"); if (b.why) continue;
  const v = G.verify(b); if (!v.ok || v.skip) continue;
  const d = G2.movement(b, v), out = G2.outside(d, "ball");
  b.args.moves.forEach(m => kinds.add(m));
  ok(out.length <= 4, `ball: ${b.args.moves.join(" ")}: ${out.length} axes outside the official range`);
  ok(d.yRange >= 1.5, `ball: height range ${d.yRange} blocks`);
  good++;
}
ok(good === 3, `ball: 3 verified bricks in ${tries} tries`);
ok(kinds.size >= 3, `ball: ${kinds.size} kinds of move (${[...kinds].join(", ")})`);
const kept = G2.load().bricks;
let bad = 0;
for (const b of kept) { const { h, r: run } = G.play(b.mode, b.objects, b.width, b.events); if (run.path.some(q => q.dead && q.x < (h.s1 + 3) * 30)) { bad++; console.log("  dies now: " + b.id + " (" + run.why + ")"); } }
ok(bad === 0, `${kept.length} kept bricks clear with their planned presses`);
console.log(fails ? `${fails} FAILED` : "all ok");
process.exit(fails ? 1 : 0);
