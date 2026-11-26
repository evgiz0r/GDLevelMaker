// node tests/autobricks.js -- auto (no-click) bricks: a few families build, clear with ZERO presses, and their contract's
// exit matches a replay; the lab level clears with no press. ~2 s. (tools/autobricks.js, AUTO.md)
"use strict";
const A = require("../tools/autobricks.js");
let bad = 0;
const ok = (c, m) => { if (!c) { bad++; console.log("FAIL " + m); } else console.log("ok   " + m); };
const pick = ["launch-yellow-3", "pad-stairs-zigzag", "pingpong-h5-n5-g1", "gravpp-h7-n4-g4", "spider-zz-h6-n5", "pad-into-ship", "ball-pp-h7"];
const built = [];
for (const [f, v] of A.variants(pick)) {
  const b = A.buildBrick(f, v);
  ok(b.ok, `${v.id} clears with no press${b.ok ? "" : ": " + b.why}`);
  if (!b.ok) continue;
  built.push(b);
  // replay the stored objects: still no death up to the exit, and the exit state is the contract's "leaves"
  const objs = b.objects.map(([t, c, r, e]) => Object.assign({ t, c, r }, e || {}));
  const s = A.simOf(objs, { mode: b.needs.mode, grav: b.needs.grav, speed: b.needs.speed }, b.width + 2);
  ok(!s.dead, `${v.id} replays from its stored objects`);
  ok(s.end.mode === b.leaves.mode && s.end.grav === b.leaves.grav, `${v.id} leaves ${b.leaves.mode} grav ${b.leaves.grav} (got ${s.end.mode} ${s.end.grav})`);
  ok(b.nMovers >= 1 && b.secs >= 0.6, `${v.id} moves the player (${b.nMovers} movers, ${b.secs} s)`);
}
const lab = A.labObjects(built), s = A.simOf(lab.objs, { mode: "cube", grav: 1, speed: "1x" }, lab.width + 6);
ok(!s.dead, `the lab of ${built.length} bricks in a row clears with no press`);
console.log(bad ? `${bad} failed` : "all ok");
process.exit(bad ? 1 : 0);
