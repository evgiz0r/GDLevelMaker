// node tests/brickgen.js -- the brick generator (tools/brickgen.js, BRICKGEN.md): each mode's generator makes bricks that its
// planned presses clear, that die with no press, and that tools/lego.js classifies as their own mode; and every kept brick
// in knowledge/brickgen.json still clears with its planned presses on today's physics (~5 s).
"use strict";
const G = require("../tools/brickgen.js");
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log("FAIL " + m); } else console.log("ok   " + m); };
let s = 12345; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
for (const mode of ["ship", "wave", "ball", "ufo"]) {
  let made = 0, good = 0, tries = 0;
  while (good < 2 && tries < 30) {
    tries++;
    const b = G.GEN[mode](r, "Normal"); if (b.why) continue; made++;
    const v = G.verify(b); if (!v.ok) continue;
    const j = G.judge(b, v);
    ok(j.sig.split(" / ")[1] === mode, `${mode}: classified as ${j.sig}`);
    ok(v.minMs >= 50, `${mode}: tightest window ${v.minMs} ms`);
    good++;
  }
  ok(good === 2, `${mode}: 2 verified bricks in ${tries} tries (${made} built)`);
}
const kept = G.load().bricks;
let bad = 0;
for (const b of kept) { const { h, r: run } = G.play(b.mode, b.objects, b.width, b.events); if (run.path.some(q => q.dead && q.x < (h.s1 + 3) * 30)) { bad++; console.log("  dies now: " + b.id + " (" + run.why + ")"); } }
ok(bad === 0, `${kept.length} kept bricks clear with their planned presses`);
console.log(fails ? `${fails} FAILED` : "all ok");
process.exit(fails ? 1 : 0);
